import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import InventoryManager from '@/components/inventory/InventoryManager';
import Button from '@/components/ui/Button';
import { requirePagePermission } from '@/lib/authz';
import { ensureInventoryReasons } from '@/lib/inventory-reasons';
import { getSmartReorderSuggestions } from '@/lib/owner-analytics';
import { prisma } from '@/lib/prisma';
import { ensureUnitsOfMeasure } from '@/lib/uom';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function InventoryPage() {
  const { shopId } = await requirePagePermission('ADJUST_INVENTORY');
  const reasons = await ensureInventoryReasons(shopId);
  await ensureUnitsOfMeasure(shopId);
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const [settings, products, movements, batches, reorderSuggestions] = await Promise.all([
    prisma.shopSetting.findUnique({ where: { shopId } }),
    prisma.product.findMany({
      where: { shopId },
      include: {
        baseUnitOfMeasure: true,
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' }
        },
        uomConversions: {
          include: {
            unitOfMeasure: true
          },
          orderBy: {
            ratioToBase: 'asc'
          }
        },
        batches: {
          orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'desc' }]
        }
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    }),
    prisma.inventoryMovement.findMany({
      where: { shopId },
      include: {
        product: true,
        reason: true
      },
      orderBy: { createdAt: 'desc' },
      take: 80
    }),
    prisma.productBatch.findMany({
      where: { shopId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            trackBatches: true,
            trackExpiry: true
          }
        }
      },
      orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'desc' }],
      take: 120
    }),
    getSmartReorderSuggestions(shopId)
  ]);

  return (
    <div className="mx-auto max-w-6xl w-full space-y-6">
      <AppHeader
        title={t('inventory.title')}
        subtitle={t('inventory.subtitle')}
        actions={
          <>
            <Link href={locale === 'ar' ? '/ar/stock-counts' : '/stock-counts'}>
              <Button type="button" variant="secondary">
                {t('inventory.openStockCounts')}
              </Button>
            </Link>
            <Link href="/api/inventory/export">
              <Button type="button" variant="secondary">
                {t('inventory.exportCSV')}
              </Button>
            </Link>
          </>
        }
      />

      <InventoryManager
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          stockQty: Number(product.stockQty),
          reorderPoint: Number(product.reorderPoint),
          baseUnitOfMeasure: product.baseUnitOfMeasure
            ? {
                id: product.baseUnitOfMeasure.id,
                code: product.baseUnitOfMeasure.code,
                name: product.baseUnitOfMeasure.name,
                isBase: product.baseUnitOfMeasure.isBase
              }
            : null,
          variants: product.variants.map((variant) => ({
            id: variant.id,
            color: variant.color,
            size: variant.size,
            flavor: variant.flavor,
            model: variant.model,
            sku: variant.sku,
            barcode: variant.barcode
          })),
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
          trackBatches: product.trackBatches,
          trackExpiry: product.trackExpiry,
          batches: product.batches.map((batch) => ({
            id: batch.id,
            lotNumber: batch.lotNumber,
            expiryDate: batch.expiryDate?.toISOString() ?? null,
            quantity: Number(batch.quantity)
          })),
          isActive: product.isActive
        }))}
        reasons={reasons.map((reason) => ({
          id: reason.id,
          code: reason.code,
          label: reason.label
        }))}
        batches={batches.map((batch) => ({
          id: batch.id,
          lotNumber: batch.lotNumber,
          expiryDate: batch.expiryDate?.toISOString() ?? null,
          quantity: Number(batch.quantity),
          receivedAt: batch.receivedAt.toISOString(),
          notes: batch.notes,
          product: {
            id: batch.product.id,
            name: batch.product.name,
            sku: batch.product.sku,
            trackBatches: batch.product.trackBatches,
            trackExpiry: batch.product.trackExpiry
          }
        }))}
        movements={movements.map((movement) => ({
          id: movement.id,
          type: movement.type,
          qtyChange: Number(movement.qtyChange),
          referenceId: movement.referenceId,
          notes: movement.notes,
          reasonLabel: movement.reason?.label ?? null,
          reasonCode: movement.reason?.code ?? null,
          createdAt: movement.createdAt.toISOString(),
          product: {
            id: movement.product.id,
            name: movement.product.name,
            sku: movement.product.sku,
            barcode: movement.product.barcode
          }
        }))}
        lowStockThreshold={settings?.lowStockThreshold ?? 5}
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
        reorderSuggestions={reorderSuggestions}
        inventoryFeatures={{
          batchTrackingEnabled: settings?.batchTrackingEnabled ?? false,
          expiryTrackingEnabled: settings?.expiryTrackingEnabled ?? false,
          fefoEnabled: settings?.fefoEnabled ?? false,
          expiryAlertDays: settings?.expiryAlertDays ?? 30
        }}
      />
    </div>
  );
}
