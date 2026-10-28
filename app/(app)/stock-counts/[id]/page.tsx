import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import StockCountDetailManager from '@/components/inventory/StockCountDetailManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { serializeStockCount, stockCountInclude } from '@/lib/stock-counts';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function StockCountDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { shopId, role, userId } = await requirePageRole('STOCK_COUNTER');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const [stockCount, staff, guests] = await Promise.all([
    prisma.stockCount.findFirst({
      where: { id, shopId },
      include: stockCountInclude
    }),
    prisma.userShop.findMany({
      where: { shopId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    }),
    prisma.guestStaff.findMany({
      where: { shopId, isActive: true }
    })
  ]);

  if (!stockCount) {
    return notFound();
  }

  const regularStaff = staff.map((s) => ({
    id: s.id,
    name: s.user.name || s.user.email,
    role: s.role
  }));

  const guestStaff = guests.map((g) => ({
    id: g.id,
    name: g.name,
    role: 'STOCK_COUNTER'
  }));

  const staffList = [...regularStaff, ...guestStaff];

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('stockCounts.detailTitle', { ref: stockCount.referenceNumber })}
        subtitle={t('stockCounts.detailSubtitle')}
      />

      <StockCountDetailManager
        initialStockCount={serializeStockCount(stockCount)}
        currentRole={role}
        currentUserId={userId}
        staff={staffList}
      />
    </div>
  );
}
