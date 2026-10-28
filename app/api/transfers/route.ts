import { DocumentSequenceType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { stockTransferSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { normalizeText } from '@/lib/inventory';
import { prisma } from '@/lib/prisma';
import { stockTransferDetailInclude } from '@/lib/stock-transfer-operations';
import { serializeStockTransfer } from '@/lib/stock-transfers';
import { ensureUnitsOfMeasure } from '@/lib/uom';

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const parsed = stockTransferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid stock transfer payload.' },
        { status: 400 }
      );
    }

    if (parsed.data.toShopId === shopId) {
      return NextResponse.json(
        { error: 'Destination branch must be different from the source branch.' },
        { status: 400 }
      );
    }

    const memberships = await prisma.userShop.findMany({
      where: {
        userId,
        isActive: true,
        shopId: {
          in: [shopId, parsed.data.toShopId]
        }
      },
      select: {
        shopId: true
      }
    });
    const membershipIds = new Set(memberships.map((membership) => membership.shopId));

    if (!membershipIds.has(parsed.data.toShopId)) {
      return NextResponse.json(
        { error: 'You can only transfer to branches you are assigned to.' },
        { status: 403 }
      );
    }

    const destinationShop = await prisma.shop.findUnique({
      where: { id: parsed.data.toShopId },
      select: {
        id: true,
        name: true
      }
    });

    if (!destinationShop) {
      return NextResponse.json({ error: 'Destination branch not found.' }, { status: 404 });
    }

    // Ensure standard UOMs exist for both shops to avoid transaction clashes
    await Promise.all([
      ensureUnitsOfMeasure(shopId),
      ensureUnitsOfMeasure(parsed.data.toShopId)
    ]);

    const stockTransfer = await prisma.$transaction(async (tx) => {
      const transferNumber = await getNextDocumentNumber(tx, {
        shopId,
        type: DocumentSequenceType.TRANSFER,
        prefix: 'TRF'
      });

      const resolvedItems: Array<{
        fromProductId: string;
        toProductId: string;
        qty: number;
        sourceName: string;
        targetName: string;
      }> = [];

      for (const item of parsed.data.items) {
        const sourceProd = await tx.product.findUnique({
          where: { id: item.fromProductId },
          include: {
            category: true,
            baseUnitOfMeasure: true,
            uomConversions: {
              include: {
                unitOfMeasure: true
              }
            },
            variants: true,
            images: true
          }
        });

        if (!sourceProd || !sourceProd.isActive) {
          throw new Error(`SOURCE_PRODUCT_NOT_FOUND:${item.fromProductId}`);
        }

        if (item.qty > sourceProd.stockQty) {
          throw new Error(`INSUFFICIENT_STOCK:${sourceProd.name}:${sourceProd.stockQty}`);
        }

        let targetProduct = null;

        // Try to resolve target product by provided ID
        if (item.toProductId) {
          targetProduct = await tx.product.findFirst({
            where: { id: item.toProductId, shopId: parsed.data.toShopId, isActive: true }
          });
        }

        // If not found by ID, try matching by SKU, barcode, or name in the target shop
        if (!targetProduct) {
          const matchConditions: any[] = [];
          if (sourceProd.sku) {
            matchConditions.push({ sku: sourceProd.sku });
          }
          if (sourceProd.barcode) {
            matchConditions.push({ barcode: sourceProd.barcode });
          }
          matchConditions.push({
            name: {
              equals: sourceProd.name,
              mode: 'insensitive'
            }
          });

          targetProduct = await tx.product.findFirst({
            where: {
              shopId: parsed.data.toShopId,
              isActive: true,
              OR: matchConditions
            }
          });
        }

        // If still not found, clone it!
        if (!targetProduct) {
          // 1. Resolve Category in target shop
          let targetCategoryId: string | null = null;
          if (sourceProd.category) {
            const existingCat = await tx.category.findFirst({
              where: {
                shopId: parsed.data.toShopId,
                name: { equals: sourceProd.category.name, mode: 'insensitive' }
              }
            });
            if (existingCat) {
              targetCategoryId = existingCat.id;
            } else {
              const slug = sourceProd.category.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
              const newCat = await tx.category.create({
                data: {
                  shopId: parsed.data.toShopId,
                  name: sourceProd.category.name,
                  slug,
                  isActive: true
                }
              });
              targetCategoryId = newCat.id;
            }
          }

          // 2. Resolve Base Unit of Measure in target shop
          let targetBaseUnitId = '';
          const existingBaseUnit = await tx.unitOfMeasure.findFirst({
            where: {
              shopId: parsed.data.toShopId,
              code: sourceProd.baseUnitOfMeasure.code
            }
          });
          if (existingBaseUnit) {
            targetBaseUnitId = existingBaseUnit.id;
          } else {
            const newBaseUnit = await tx.unitOfMeasure.create({
              data: {
                shopId: parsed.data.toShopId,
                code: sourceProd.baseUnitOfMeasure.code,
                name: sourceProd.baseUnitOfMeasure.name,
                isBase: sourceProd.baseUnitOfMeasure.isBase,
                isActive: true
              }
            });
            targetBaseUnitId = newBaseUnit.id;
          }

          // 3. Create/clone Product in target shop with 0 stockQty
          targetProduct = await tx.product.create({
            data: {
              shopId: parsed.data.toShopId,
              categoryId: targetCategoryId,
              baseUnitOfMeasureId: targetBaseUnitId,
              sku: sourceProd.sku,
              barcode: sourceProd.barcode,
              name: sourceProd.name,
              description: sourceProd.description,
              cost: sourceProd.cost,
              price: sourceProd.price,
              stockQty: 0, // MUST start at 0
              reorderPoint: sourceProd.reorderPoint,
              trackBatches: sourceProd.trackBatches,
              trackExpiry: sourceProd.trackExpiry,
              productType: sourceProd.productType,
              brand: sourceProd.brand,
              supplierPrice: sourceProd.supplierPrice,
              dealerCode: sourceProd.dealerCode,
              assemblyCost: sourceProd.assemblyCost,
              externalTransportCost: sourceProd.externalTransportCost,
              internalTransportCost: sourceProd.internalTransportCost,
              maintenanceCost: sourceProd.maintenanceCost,
              otherCosts: sourceProd.otherCosts,
              condition: sourceProd.condition,
              color: sourceProd.color,
              motorNumber: sourceProd.motorNumber,
              chassisNumber: sourceProd.chassisNumber,
              chassisPhotoUrl: sourceProd.chassisPhotoUrl,
              motorPhotoUrl: sourceProd.motorPhotoUrl,
              isActive: true,
              variants: {
                create: sourceProd.variants.map((v) => ({
                  color: v.color,
                  size: v.size,
                  flavor: v.flavor,
                  model: v.model,
                  sku: v.sku,
                  barcode: v.barcode,
                  priceOverride: v.priceOverride,
                  costOverride: v.costOverride,
                  isActive: v.isActive
                }))
              },
              images: {
                create: sourceProd.images.map((img) => ({
                  imageUrl: img.imageUrl,
                  altText: img.altText,
                  sortOrder: img.sortOrder
                }))
              }
            }
          });

          // 4. Create UoM Conversions in target shop
          for (const conv of sourceProd.uomConversions) {
            let targetConvUnitId = '';
            const existingConvUnit = await tx.unitOfMeasure.findFirst({
              where: {
                shopId: parsed.data.toShopId,
                code: conv.unitOfMeasure.code
              }
            });
            if (existingConvUnit) {
              targetConvUnitId = existingConvUnit.id;
            } else {
              const newConvUnit = await tx.unitOfMeasure.create({
                data: {
                  shopId: parsed.data.toShopId,
                  code: conv.unitOfMeasure.code,
                  name: conv.unitOfMeasure.name,
                  isBase: conv.unitOfMeasure.isBase,
                  isActive: true
                }
              });
              targetConvUnitId = newConvUnit.id;
            }

            await tx.productUomConversion.create({
              data: {
                productId: targetProduct.id,
                unitOfMeasureId: targetConvUnitId,
                ratioToBase: conv.ratioToBase
              }
            });
          }

          // Log cloning activity
          await logActivity({
            tx,
            shopId: parsed.data.toShopId,
            userId,
            action: 'PRODUCT_CREATED',
            entityType: 'Product',
            entityId: targetProduct.id,
            description: `Auto-created product ${targetProduct.name} via incoming transfer cloning.`,
            metadata: {
              isActive: true,
              stockQty: 0,
              trackBatches: targetProduct.trackBatches,
              trackExpiry: targetProduct.trackExpiry
            }
          });
        }

        resolvedItems.push({
          fromProductId: item.fromProductId,
          toProductId: targetProduct.id,
          qty: item.qty,
          sourceName: sourceProd.name,
          targetName: targetProduct.name
        });
      }

      const createdTransfer = await tx.stockTransfer.create({
        data: {
          fromShopId: shopId,
          toShopId: parsed.data.toShopId,
          createdByUserId: userId,
          transferNumber,
          status: 'DRAFT',
          notes: normalizeText(parsed.data.notes),
          items: {
            create: resolvedItems.map((item) => ({
              fromProductId: item.fromProductId,
              toProductId: item.toProductId,
              productNameSnapshot: item.sourceName,
              destinationProductNameSnapshot: item.targetName,
              qty: item.qty
            }))
          }
        },
        include: stockTransferDetailInclude
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'STOCK_TRANSFER_CREATED',
        entityType: 'StockTransfer',
        entityId: createdTransfer.id,
        description: `Created stock transfer ${createdTransfer.transferNumber} to ${destinationShop.name}.`,
        metadata: {
          destinationShopId: destinationShop.id,
          itemCount: resolvedItems.length
        }
      });

      return createdTransfer;
    });

    return NextResponse.json(
      {
        stockTransfer: serializeStockTransfer(stockTransfer)
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('SOURCE_PRODUCT_NOT_FOUND:')) {
      return NextResponse.json({ error: 'One or more source products were not found.' }, { status: 404 });
    }
    if (error instanceof Error && error.message.startsWith('INSUFFICIENT_STOCK:')) {
      const parts = error.message.split(':');
      const name = parts[1] || 'Product';
      const qty = parts[2] || '0';
      return NextResponse.json({ error: `${name} only has ${qty} unit(s) available.` }, { status: 400 });
    }
    return apiErrorResponse(error, 'Unable to create stock transfer.');
  }
}
