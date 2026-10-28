import AppHeader from '@/components/layout/AppHeader';
import SalariesManager from '@/components/salaries/SalariesManager';
import { requirePagePermission } from '@/lib/authz';
import { getServerLocale } from '@/lib/i18n/server';
import { prisma } from '@/lib/prisma';
import { getActiveCashSession } from '@/lib/register';

export default async function SalariesPage() {
  const { userId, shopId } = await requirePagePermission('MANAGE_STAFF', 'MANAGER');
  const locale = await getServerLocale();

  const [staffMembers, paymentHistory, settings, activeSession] = await Promise.all([
    prisma.userShop.findMany({
      where: {
        shopId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        role: 'asc'
      }
    }),
    prisma.salaryPayment.findMany({
      where: {
        shopId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        paidAt: 'desc'
      }
    }),
    prisma.shopSetting.findUnique({ where: { shopId } }),
    getActiveCashSession(prisma, shopId, userId)
  ]);

  const currencySymbol = settings?.currencySymbol ?? 'ج.م ';

  const serializedStaff = staffMembers.map((sm) => ({
    id: sm.id,
    userId: sm.userId,
    name: sm.user.name ?? sm.user.email.split('@')[0],
    email: sm.user.email,
    role: sm.role,
    baseSalary: sm.baseSalary ? sm.baseSalary.toString() : null,
    shopId: sm.shopId,
    isActive: sm.isActive,
    customPermissions: Array.isArray(sm.customPermissions) ? (sm.customPermissions as any[]) : []
  }));

  const serializedHistory = paymentHistory.map((p) => ({
    id: p.id,
    userId: p.userId,
    userName: p.user.name ?? p.user.email.split('@')[0],
    userEmail: p.user.email,
    amount: p.amount.toString(),
    paidAt: p.paidAt.toISOString(),
    paymentMode: p.paymentMode,
    notes: p.notes
  }));

  return (
    <div className="space-y-6">
      <AppHeader
        title={locale === 'ar' ? 'إدارة الرواتب' : 'Salaries Management'}
        subtitle={
          locale === 'ar'
            ? 'إدارة الرواتب الأساسية للموظفين، وتسجيل عمليات الصرف المباشرة من الخزن الفرعية.'
            : 'Manage employees base salaries and record direct payments from branch registers.'
        }
      />
      <SalariesManager
        initialStaff={serializedStaff}
        initialHistory={serializedHistory}
        currencySymbol={currencySymbol}
        locale={locale}
        hasActiveSession={!!activeSession}
      />
    </div>
  );
}
