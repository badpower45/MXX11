import { redirect } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import ProductManager from '@/components/products/ProductManager';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { ensureUnitsOfMeasure } from '@/lib/uom';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { localizePath } from '@/lib/i18n/locales';

export default async function ProductsPage() {
  const { shop, shopId, permissions } = await getActiveShopContext();
  const canEditProducts = permissions.EDIT_PRODUCTS;
  const canViewPurchaseCosts = permissions.VIEW_PURCHASE_COSTS || permissions.EDIT_PRODUCTS;

  if (!canEditProducts && !canViewPurchaseCosts) {
    redirect(localizePath('/dashboard', await getServerLocale()));
  }

  const units = await ensureUnitsOfMeasure(shopId);
  const [products, categories, settings] = await Promise.all([
    prisma.product.findMany({
      where: { shopId },
      include: {
        category: true,
        baseUnitOfMeasure: true,
        uomConversions: {
          include: {
            unitOfMeasure: true
          },
          orderBy: {
            ratioToBase: 'asc'
          }
        },
        variants: {
          orderBy: { createdAt: 'asc' }
        },
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
        },
        priceHistory: {
          include: {
            changedByUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { effectiveDate: 'desc' },
          take: 5
        },
        costHistory: {
          include: {
            changedByUser: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: { effectiveDate: 'desc' },
          take: 5
        },
        batches: {
          orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'desc' }]
        }
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    }),
    prisma.category.findMany({
      where: { shopId },
      orderBy: { name: 'asc' }
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('productManager.title')}
        subtitle={t('productManager.subtitle')}
      />
      <ProductManager
        initialProducts={products.map((product) => ({
          id: product.id,
          categoryId: product.categoryId,
          baseUnitOfMeasureId: product.baseUnitOfMeasureId,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          description: product.description,
          cost: canViewPurchaseCosts ? product.cost.toString() : '0',
          price: product.price.toString(),
          stockQty: Number(product.stockQty),
          reorderPoint: Number(product.reorderPoint),
          trackBatches: product.trackBatches,
          trackExpiry: product.trackExpiry,
          isActive: product.isActive,
          productType: product.productType,
          brand: product.brand,
          supplierPrice: product.supplierPrice ? product.supplierPrice.toString() : null,
          dealerCode: product.dealerCode,
          assemblyCost: product.assemblyCost ? product.assemblyCost.toString() : null,
          externalTransportCost: product.externalTransportCost ? product.externalTransportCost.toString() : null,
          internalTransportCost: product.internalTransportCost ? product.internalTransportCost.toString() : null,
          maintenanceCost: product.maintenanceCost ? product.maintenanceCost.toString() : null,
          otherCosts: product.otherCosts ? product.otherCosts.toString() : null,
          condition: product.condition,
          color: product.color,
          motorNumber: product.motorNumber,
          chassisNumber: product.chassisNumber,
          chassisPhotoUrl: product.chassisPhotoUrl,
          motorPhotoUrl: product.motorPhotoUrl,
          category: product.category ? { id: product.category.id, name: product.category.name } : null,
          baseUnitOfMeasure: product.baseUnitOfMeasure
            ? {
                id: product.baseUnitOfMeasure.id,
                code: product.baseUnitOfMeasure.code,
                name: product.baseUnitOfMeasure.name,
                isBase: product.baseUnitOfMeasure.isBase
              }
            : null,
          uomConversions: product.uomConversions.map((conversion) => ({
            id: conversion.id,
            unitOfMeasureId: conversion.unitOfMeasureId,
            ratioToBase: parseFloat(conversion.ratioToBase.toString()),
            unitOfMeasure: {
              id: conversion.unitOfMeasure.id,
              code: conversion.unitOfMeasure.code,
              name: conversion.unitOfMeasure.name,
              isBase: conversion.unitOfMeasure.isBase
            }
          })),
          variants: product.variants.map((variant) => ({
            id: variant.id,
            color: variant.color,
            size: variant.size,
            flavor: variant.flavor,
            model: variant.model,
            sku: variant.sku,
            barcode: variant.barcode,
            priceOverride: variant.priceOverride?.toString() ?? null,
            costOverride: variant.costOverride?.toString() ?? null,
            stockQty: variant.stockQty,
            isActive: variant.isActive,
            createdAt: variant.createdAt.toISOString(),
            updatedAt: variant.updatedAt.toISOString()
          })),
          images: product.images.map((image) => ({
            id: image.id,
            imageUrl: image.imageUrl,
            altText: image.altText,
            sortOrder: image.sortOrder,
            createdAt: image.createdAt.toISOString()
          })),
          priceHistory: product.priceHistory.map((entry) => ({
            id: entry.id,
            previousPrice: entry.previousPrice.toString(),
            newPrice: entry.newPrice.toString(),
            effectiveDate: entry.effectiveDate.toISOString(),
            createdAt: entry.createdAt.toISOString(),
            note: entry.note,
            changedByUser: {
              id: entry.changedByUser.id,
              name: entry.changedByUser.name,
              email: entry.changedByUser.email
            }
          })),
          costHistory: product.costHistory.map((entry) => ({
            id: entry.id,
            previousCost: canViewPurchaseCosts ? entry.previousCost.toString() : '0',
            newCost: canViewPurchaseCosts ? entry.newCost.toString() : '0',
            effectiveDate: entry.effectiveDate.toISOString(),
            createdAt: entry.createdAt.toISOString(),
            note: entry.note,
            changedByUser: {
              id: entry.changedByUser.id,
              name: entry.changedByUser.name,
              email: entry.changedByUser.email
            }
          })),
          batches: product.batches.map((batch) => ({
            id: batch.id,
            lotNumber: batch.lotNumber,
            expiryDate: batch.expiryDate?.toISOString() ?? null,
            quantity: Number(batch.quantity)
          }))
        }))}
        categories={categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          parentId: cat.parentId
        }))}
        units={units.map((unit) => ({
          id: unit.id,
          code: unit.code,
          name: unit.name,
          isBase: unit.isBase
        }))}
        canEditProducts={canEditProducts}
        canViewPurchaseCosts={canViewPurchaseCosts}
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
        lowStockThreshold={settings?.lowStockThreshold ?? 5}
        inventoryDefaults={{
          batchTrackingEnabled: settings?.batchTrackingEnabled ?? false,
          expiryTrackingEnabled: settings?.expiryTrackingEnabled ?? false,
          expiryAlertDays: settings?.expiryAlertDays ?? 30
        }}
        shopType={shop.posType}
        locale={locale}
      />
    </div>
  );
}
