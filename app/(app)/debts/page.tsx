import AppHeader from '@/components/layout/AppHeader';
import DebtsClient from '@/components/debts/DebtsClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { getServerLocale } from '@/lib/i18n/server';

export default async function DebtsPage() {
  const { shopId } = await getActiveShopContext();
  const locale = await getServerLocale();

  const [debts, suppliers, settings, categories] = await Promise.all([
    prisma.dealerDebt.findMany({
      where: { shopId },
      include: {
        supplier: {
          select: {
            name: true,
            contactName: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.supplier.findMany({
      where: { shopId },
      orderBy: { name: 'asc' }
    }),
    prisma.shopSetting.findUnique({ where: { shopId } }),
    prisma.category.findMany({
      where: { shopId },
      orderBy: { name: 'asc' }
    })
  ]);

  const currencySymbol = settings?.currencySymbol ?? 'ج.م ';

  return (
    <div className="space-y-6">
      <AppHeader
        title={locale === 'ar' ? 'مديونيات ومشتريات التجار' : 'Dealer Debts & Purchases'}
        subtitle={
          locale === 'ar'
            ? 'إدخال مشتريات الملابس وتسجيل مديونيات التجار وسدادها وتحديث الدرج.'
            : 'Register apparel dealer purchases, track outstanding debts, and record payouts.'
        }
      />
      <DebtsClient
        initialDebts={debts.map((d) => ({
          ...d,
          totalAmount: d.totalAmount.toString(),
          paidAmount: d.paidAmount.toString(),
          remainingDebt: d.remainingDebt.toString(),
          createdAt: d.createdAt.toISOString(),
          supplier: {
            name: d.supplier.name,
            contactName: d.supplier.contactName,
            phone: d.supplier.phone
          }
        }))}
        suppliers={suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          contactName: s.contactName,
          email: s.email,
          phone: s.phone,
          address: s.address,
          notes: s.notes,
          isActive: s.isActive
        }))}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          parentId: c.parentId
        }))}
        currencySymbol={currencySymbol}
        locale={locale}
      />
    </div>
  );
}

