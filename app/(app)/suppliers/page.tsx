import AppHeader from '@/components/layout/AppHeader';
import SupplierManager from '@/components/suppliers/SupplierManager';
import SupplierReturnManager from '@/components/suppliers/SupplierReturnManager';
import type { Supplier as SupplierView } from '@/components/suppliers/SupplierManager';
import type { SupplierReturn as SupplierReturnView } from '@/components/suppliers/SupplierReturnManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { supplierReturnDetailInclude } from '@/lib/supplier-return-operations';
import { serializeSupplierInvoice } from '@/lib/purchases';
import { serializeSupplierReturn } from '@/lib/supplier-returns';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function SuppliersPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  const [suppliers, products, supplierReturns, settings] = await Promise.all([
    prisma.supplier.findMany({
      where: { shopId },
      include: {
        _count: { select: { purchases: true, invoices: true } },
        invoices: {
          include: {
            purchase: {
              select: {
                id: true,
                purchaseNumber: true,
                status: true
              }
            },
            payments: {
              include: {
                createdByUser: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              },
              orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }]
            },
            payableEntry: true
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
        }
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    }),
    prisma.product.findMany({
      where: { shopId, isActive: true },
      select: {
        id: true,
        name: true,
        cost: true,
        stockQty: true,
        isActive: true
      },
      orderBy: { name: 'asc' }
    }),
    prisma.supplierReturn.findMany({
      where: { shopId },
      include: supplierReturnDetailInclude,
      orderBy: [{ createdAt: 'desc' }]
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('suppliers.title')}
        subtitle={t('suppliers.subtitle')}
      />
      <SupplierReturnManager
        suppliers={suppliers.map((supplier) => ({
          id: supplier.id,
          name: supplier.name,
          isActive: supplier.isActive
        }))}
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          cost: product.cost.toString(),
          stockQty: product.stockQty,
          isActive: product.isActive
        }))}
        supplierReturns={supplierReturns.map((supplierReturn) => serializeSupplierReturn(supplierReturn) as unknown as SupplierReturnView)}
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
      />
      <SupplierManager
        initialSuppliers={suppliers.map((supplier) => ({
          ...supplier,
          invoices: supplier.invoices.map(serializeSupplierInvoice)
        })) as unknown as SupplierView[]}
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
      />
    </div>
  );
}
