import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import SaleAdjustmentManager from '@/components/sales/SaleAdjustmentManager';
import { requirePagePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { saleDetailInclude, serializeSaleDetail } from '@/lib/sale-adjustments';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function SaleVoidPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { shopId, session } = await requirePagePermission('VOID_SALES');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const [sale, settings] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, shopId },
      include: saleDetailInclude
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: {
        currencySymbol: true
      }
    })
  ]);

  if (!sale) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('adjustmentManager.voidTitle', { saleNumber: sale.saleNumber })}
        subtitle={t('adjustmentManager.voidSubtitle')}
      />

      <SaleAdjustmentManager
        mode="void"
        sale={serializeSaleDetail(sale)}
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
        currentUserEmail={session.user.email ?? ''}
      />
    </div>
  );
}
