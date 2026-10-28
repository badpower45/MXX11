import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { getActiveCashSession } from '@/lib/register';
import { DocumentSequenceType, DealerPaymentMode } from '@prisma/client';

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const { supplierId, newSupplierName, paymentMode, downPayment, notes, clothingItems } = body;

    if ((!supplierId && !newSupplierName) || !paymentMode || !clothingItems || !Array.isArray(clothingItems) || clothingItems.length === 0) {
      return NextResponse.json({ error: 'Supplier, payment mode, and at least one clothing item are required.' }, { status: 400 });
    }

    const [settings, defaultUom] = await Promise.all([
      prisma.shopSetting.findUnique({ where: { shopId } }),
      prisma.unitOfMeasure.findFirst({
        where: { shopId, isActive: true }
      })
    ]);

    let supplier = null;
    if (supplierId) {
      supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, shopId, isActive: true }
      });
    } else if (newSupplierName) {
      const normalizedName = newSupplierName.trim();
      if (normalizedName) {
        supplier = await prisma.supplier.findFirst({
          where: { name: { equals: normalizedName, mode: 'insensitive' }, shopId }
        });
        if (!supplier) {
          supplier = await prisma.supplier.create({
            data: {
              shopId,
              name: normalizedName,
              isActive: true
            }
          });
        } else if (!supplier.isActive) {
          supplier = await prisma.supplier.update({
            where: { id: supplier.id },
            data: { isActive: true }
          });
        }
      }
    }

    if (!supplier) {
      return NextResponse.json({ error: 'Selected supplier was not found or could not be created.' }, { status: 404 });
    }

    if (!defaultUom) {
      return NextResponse.json({ error: 'No active Unit of Measure found in this shop. Please configure inventory units.' }, { status: 400 });
    }

    // Calculate total supplier price (what we owe the dealer)
    const totalSupplierPrice = clothingItems.reduce((sum, item) => {
      const totalQty = item.variants.reduce((qSum: number, v: any) => qSum + Number(v.stockQty || 0), 0);
      return sum + (totalQty * Number(item.cost || 0));
    }, 0);

    const payoutAmount = paymentMode === 'CASH' ? totalSupplierPrice : paymentMode === 'DEFERRED' ? Number(downPayment || 0) : 0;

    if (paymentMode === 'DEFERRED' && (payoutAmount <= 0 || payoutAmount > totalSupplierPrice)) {
      return NextResponse.json({ error: 'Valid down payment is required for deferred payment method.' }, { status: 400 });
    }

    // If CASH or DEFERRED, check active cash session
    let activeSessionId: string | null = null;
    if (payoutAmount > 0) {
      const activeSession = await getActiveCashSession(prisma, shopId, userId);
      if (!activeSession) {
        return NextResponse.json(
          { error: 'Open a register session before recording cash drawer payout.' },
          { status: 409 }
        );
      }
      activeSessionId = activeSession.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create unique Product & variants records for each clothing item
      const createdProducts = [];
      for (const item of clothingItems) {
        const costVal = Number(item.cost || 0);
        const priceVal = Number(item.price || 0);
        const totalQty = item.variants.reduce((acc: number, v: any) => acc + Number(v.stockQty || 0), 0);

        // Generate base SKU
        const baseSku = `CLO-${item.name.replace(/\s+/g, '-').slice(0, 10).toUpperCase()}-${Date.now().toString().slice(-4)}`;

        const product = await tx.product.create({
          data: {
            shopId,
            name: item.name,
            brand: item.brand || null,
            productType: 'SPARE_PART',
            cost: costVal,
            price: priceVal,
            stockQty: totalQty,
            baseUnitOfMeasureId: defaultUom.id,
            sku: baseSku,
            categoryId: item.categoryId || null,
            isActive: true,
            variants: {
              create: item.variants.map((v: any) => ({
                color: v.color || null,
                size: v.size || null,
                sku: v.sku || null,
                barcode: v.barcode || null,
                stockQty: Number(v.stockQty || 0),
                isActive: true
              }))
            }
          },
          include: {
            variants: true
          }
        });

        createdProducts.push(product);

        // Create inventory movement
        await tx.inventoryMovement.create({
          data: {
            shopId,
            productId: product.id,
            type: 'OPENING_STOCK',
            qtyChange: totalQty,
            userId,
            notes: `شراء ملابس: ${item.name} (${totalQty} قطعة)`
          }
        });
      }

      // 2. Create PurchaseOrder record
      const purchaseNumber = await getNextDocumentNumber(tx, {
        shopId,
        type: DocumentSequenceType.PURCHASE,
        prefix: settings?.purchasePrefix ?? 'PO'
      });

      const purchase = await tx.purchaseOrder.create({
        data: {
          shopId,
          supplierId: supplier.id,
          purchaseNumber,
          status: 'FULLY_RECEIVED',
          totalAmount: totalSupplierPrice,
          receivedAt: new Date(),
          notes: notes || 'شراء ملابس من تاجر مخصص',
          items: {
            create: createdProducts.flatMap((p) => {
              const totalQty = p.variants.reduce((sum, v) => sum + v.stockQty, 0);
              return {
                productId: p.id,
                unitOfMeasureId: defaultUom.id,
                unitCode: defaultUom.code,
                unitName: defaultUom.name,
                productName: p.name,
                qty: totalQty,
                ratioToBase: 1,
                receivedBaseQty: totalQty,
                unitCost: p.cost,
                lineTotal: Number(p.cost) * totalQty
              };
            })
          }
        }
      });

      // 3. Record Cash payout if applicable
      if (payoutAmount > 0 && activeSessionId) {
        await tx.cashMovement.create({
          data: {
            shopId,
            cashSessionId: activeSessionId,
            type: 'PAYOUT',
            amount: payoutAmount,
            note: `شراء ملابس من التاجر ${supplier.name} - فاتورة ${purchaseNumber}`,
            createdByUserId: userId
          }
        });
      }

      // 4. Create DealerDebt record
      const remainingDebt = totalSupplierPrice - payoutAmount;
      const isSettled = remainingDebt <= 0;

      const debt = await tx.dealerDebt.create({
        data: {
          shopId,
          supplierId: supplier.id,
          dealerCode: purchaseNumber,
          purchaseId: purchase.id,
          totalAmount: totalSupplierPrice,
          paidAmount: payoutAmount,
          remainingDebt,
          paymentMode: paymentMode as DealerPaymentMode,
          notes: notes || null,
          isSettled
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'DEALER_PURCHASE_RECORDED',
        entityType: 'PurchaseOrder',
        entityId: purchase.id,
        description: `Recorded dealer clothing purchase ${purchaseNumber} from ${supplier.name}. Mode: ${paymentMode}. Debt: ${remainingDebt}.`
      });

      return { purchase, debt };
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to record dealer purchase.');
  }
}
