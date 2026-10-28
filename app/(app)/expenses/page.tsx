import AppHeader from '@/components/layout/AppHeader';
import ExpensesClient from '@/components/expenses/ExpensesClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { getServerLocale } from '@/lib/i18n/server';

export default async function ExpensesPage() {
  const { shopId, shop, userId } = await getActiveShopContext();
  const locale = await getServerLocale();

  const [expenses, settings] = await Promise.all([
    prisma.branchExpense.findMany({
      where: { shopId },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  const sparePartsShops = shop?.posType === 'MOTORCYCLE_AND_SPARE_PARTS'
    ? (await prisma.userShop.findMany({
        where: {
          userId,
          isActive: true,
          shop: {
            posType: 'SPARE_PARTS_ONLY'
          }
        },
        include: {
          shop: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })).map((us) => us.shop)
    : [];

  const currencySymbol = settings?.currencySymbol ?? 'ج.م ';

  return (
    <div className="space-y-6">
      <AppHeader
        title={locale === 'ar' ? 'مصاريف الفرع' : 'Branch Expenses'}
        subtitle={
          locale === 'ar'
            ? 'تسجيل ومتابعة مصاريف الفرع (إيجار، كهرباء، أقلام، إكراميات بالاسم، سحوبات شخصية).'
            : 'Record and track branch operating expenses like rent, electricity, office items, tips, and personal withdrawals.'
        }
      />
      <ExpensesClient
        initialExpenses={expenses.map((e) => ({
          ...e,
          amount: e.amount.toString(),
          createdAt: e.createdAt.toISOString(),
          user: {
            name: e.user.name,
            email: e.user.email
          }
        }))}
        currencySymbol={currencySymbol}
        locale={locale}
        shopType={shop?.posType ?? 'RETAIL'}
        sparePartsShops={sparePartsShops}
      />
    </div>
  );
}
