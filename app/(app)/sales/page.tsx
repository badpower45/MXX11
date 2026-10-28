import AppHeader from '@/components/layout/AppHeader';
import SalesTable from '@/components/sales/SalesTable';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function SalesPage({
  searchParams
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const { shopId, permissions } = await getActiveShopContext();
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const where: any = { shopId };
  if (search?.trim()) {
    where.OR = [
      { saleNumber: { contains: search.trim(), mode: 'insensitive' } },
      { receiptNumber: { contains: search.trim(), mode: 'insensitive' } },
      { customerName: { contains: search.trim(), mode: 'insensitive' } }
    ];
  }

  const [sales, settings] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 75
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('salesLog.title')}
        subtitle={t('salesLog.subtitle')}
      />
      <SalesTable
        sales={sales.map((sale) => ({
          ...sale,
          totalAmount: sale.totalAmount.toString(),
          createdAt: sale.createdAt.toISOString()
        }))}
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
        canRefundSales={permissions.REFUND_SALES}
        canVoidSales={permissions.VOID_SALES}
      />
    </div>
  );
}
