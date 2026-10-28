import AppHeader from '@/components/layout/AppHeader';
import TrafficClient from '@/components/traffic/TrafficClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { getServerLocale } from '@/lib/i18n/server';

export default async function TrafficPage() {
  const { shopId } = await getActiveShopContext();
  const locale = await getServerLocale();

  const [invoices, settings] = await Promise.all([
    prisma.trafficInvoice.findMany({
      where: { shopId },
      include: {
        sale: {
          select: {
            saleNumber: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  const currencySymbol = settings?.currencySymbol ?? 'ج.م ';

  return (
    <div className="space-y-6">
      <AppHeader
        title={locale === 'ar' ? 'تراخيص وتصاريح الموانئ' : 'Vessel Clearance & Licensing'}
        subtitle={
          locale === 'ar'
            ? 'تتبع وإدارة دورة تراخيص وتصاريح الجمارك والموانئ من الإرسال وحتى التسليم للوكيل.'
            : 'Track and manage customs clearance and port entry licensing files.'
        }
      />
      <TrafficClient
        initialInvoices={invoices.map((inv) => ({
          ...inv,
          transportCost: inv.transportCost.toString(),
          cairoReceiptCost: inv.cairoReceiptCost.toString(),
          deliveryFeeCollected: inv.deliveryFeeCollected.toString(),
          createdAt: inv.createdAt.toISOString(),
          updatedAt: inv.updatedAt.toISOString(),
          receivedAtCairo: inv.receivedAtCairo?.toISOString() ?? null,
          deliveredToCustomerAt: inv.deliveredToCustomerAt?.toISOString() ?? null,
          sale: {
            saleNumber: inv.sale.saleNumber,
            createdAt: inv.sale.createdAt.toISOString()
          }
        }))}
        currencySymbol={currencySymbol}
        locale={locale}
      />
    </div>
  );
}
