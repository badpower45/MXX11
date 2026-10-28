import AppHeader from '@/components/layout/AppHeader';
import ReturnsTable from '@/components/sales/ReturnsTable';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function ReturnsPage() {
  const { shopId } = await getActiveShopContext();
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const [items, settings] = await Promise.all([
    prisma.saleAdjustment.findMany({
      where: { shopId },
      include: {
        sale: {
          select: {
            id: true,
            saleNumber: true
          }
        },
        items: {
          select: {
            id: true
          }
        },
        createdByUser: {
          select: {
            name: true,
            email: true
          }
        },
        approvedByUser: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: {
        currencySymbol: true
      }
    })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('returns.title')}
        subtitle={t('returns.subtitle')}
      />

      <ReturnsTable
        items={items.map((item) => ({
          id: item.id,
          adjustmentNumber: item.adjustmentNumber,
          type: item.type,
          saleId: item.sale.id,
          saleNumber: item.sale.saleNumber,
          reason: item.reason,
          totalAmount: item.totalAmount.toString(),
          subtotal: item.subtotal.toString(),
          createdAt: item.createdAt.toISOString(),
          createdBy: item.createdByUser.name ?? item.createdByUser.email,
          approvedBy: item.approvedByUser.name ?? item.approvedByUser.email,
          itemCount: item.items.length
        }))}
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
      />
    </div>
  );
}
