import AppHeader from '@/components/layout/AppHeader';
import DuesClient from '@/components/dues/DuesClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function DuesPage() {
  const { shopId } = await getActiveShopContext();
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const [installmentDues, reservations, settings] = await Promise.all([
    prisma.installmentCompanyDue.findMany({
      where: { shopId },
      orderBy: { dueDate: 'asc' }
    }),
    prisma.reservation.findMany({
      where: { shopId },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  const currencySymbol = settings?.currencySymbol ?? 'ج.م ';

  return (
    <div className="space-y-6">
      <AppHeader
        title={locale === 'ar' ? 'مستحقات نداءات السفن' : 'Outstanding D/As & Bookings'}
        subtitle={
          locale === 'ar'
            ? 'تتبع مستحقات نداءات السفن D/As وحجوزات المؤن غير المتوفرة.'
            : 'Track outstanding disbursement accounts and customer supplies bookings.'
        }
      />
      <DuesClient
        initialInstallmentDues={installmentDues.map((due) => ({
          ...due,
          pullAmount: due.pullAmount.toString(),
          saleAmount: due.saleAmount.toString(),
          adminFees: due.adminFees.toString(),
          dueAmount: due.dueAmount.toString(),
          pullDate: due.pullDate.toISOString(),
          saleDate: due.saleDate.toISOString(),
          dueDate: due.dueDate.toISOString(),
          collectedAt: due.collectedAt?.toISOString() ?? null
        }))}
        initialReservations={reservations.map((res) => ({
          ...res,
          depositAmount: res.depositAmount.toString(),
          remainingAmount: res.remainingAmount.toString(),
          totalAmount: res.totalAmount.toString(),
          createdAt: res.createdAt.toISOString(),
          completedAt: res.completedAt?.toISOString() ?? null
        }))}
        currencySymbol={currencySymbol}
        locale={locale}
      />
    </div>
  );
}
