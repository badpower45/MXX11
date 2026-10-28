import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import PurchaseManager from '@/components/purchases/PurchaseManager';
import type { Purchase as PurchaseView } from '@/components/purchases/PurchaseManager';
import Card from '@/components/ui/Card';
import { requirePageRole } from '@/lib/authz';
import { purchaseDetailInclude } from '@/lib/purchase-operations';
import { prisma } from '@/lib/prisma';
import { serializePurchase } from '@/lib/purchases';
import { ensureUnitsOfMeasure } from '@/lib/uom';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function PurchasesPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  const units = await ensureUnitsOfMeasure(shopId);
  const [suppliers, products, purchases, settings] = await Promise.all([
    prisma.supplier.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' }
    }),
    prisma.product.findMany({
      where: { shopId, isActive: true },
      include: {
        baseUnitOfMeasure: true,
        uomConversions: {
          include: {
            unitOfMeasure: true
          },
          orderBy: {
            ratioToBase: 'asc'
          }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.purchaseOrder.findMany({
      where: { shopId },
      include: purchaseDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: 40
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);
  const safeSuppliers = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name
  }));
  const safeProducts = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    cost: product.cost.toString(),
    price: product.price.toString(),
    stockQty: Number(product.stockQty),
    isActive: product.isActive,
    baseUnitOfMeasureId: product.baseUnitOfMeasureId,
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
      ratioToBase: Number(conversion.ratioToBase),
      unitOfMeasure: {
        id: conversion.unitOfMeasure.id,
        code: conversion.unitOfMeasure.code,
        name: conversion.unitOfMeasure.name,
        isBase: conversion.unitOfMeasure.isBase
      }
    }))
  }));
  const safePurchases: PurchaseView[] = purchases.map((purchase) => ({
    ...(serializePurchase(purchase) as PurchaseView),
    supplier: {
      name: purchase.supplier.name
    }
  }));
  const missingSetup = [
    suppliers.length === 0 ? { href: '/suppliers', label: t('purchases.addSupplierLink') } : null,
    products.length === 0 ? { href: '/products', label: t('purchases.addProductLink') } : null
  ].filter((item): item is { href: string; label: string } => Boolean(item));

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('purchases.title')}
        subtitle={t('purchases.subtitle')}
      />
      {missingSetup.length ? (
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">{t('purchases.setupRequired')}</div>
          <h2 className="mt-2 text-xl font-black text-stone-900">{t('purchases.setupRequiredDesc')}</h2>
          <p className="mt-2 text-sm text-stone-500">
            {t('purchases.setupRequiredBody')}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {missingSetup.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-300 hover:bg-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
      <PurchaseManager
        suppliers={safeSuppliers}
        products={safeProducts}
        units={units.map((unit) => ({
          id: unit.id,
          code: unit.code,
          name: unit.name,
          isBase: unit.isBase
        }))}
        purchases={safePurchases}
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
      />
    </div>
  );
}
