import { redirect } from 'next/navigation';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { getServerLocale } from '@/lib/i18n/server';
import { prisma } from '@/lib/prisma';
import { serializeStockCount, stockCountInclude } from '@/lib/stock-counts';
import StockCountMobileScanner from '@/components/inventory/StockCountMobileScanner';
import AppHeader from '@/components/layout/AppHeader';

export default async function StockCountScanPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getServerLocale();
  const { shopId, userId, role } = await getActiveShopContext();

  const stockCount = await prisma.stockCount.findFirst({
    where: { id, shopId },
    include: stockCountInclude
  });

  if (!stockCount) {
    redirect('/stock-counts');
  }

  // Check if they have access
  const isAssignee = await prisma.stockCountAssignee.findFirst({
    where: {
      stockCountId: id,
      userId
    }
  });

  const isManagerOrAdmin = role === 'MANAGER' || role === 'ADMIN';

  if (stockCount.createdByUserId !== userId && !isManagerOrAdmin && !isAssignee) {
    redirect('/stock-counts');
  }

  const settings = await prisma.shopSetting.findUnique({
    where: { shopId }
  });

  const currencySymbol = settings?.currencySymbol ?? 'ج.م ';
  const serialized = serializeStockCount(stockCount);

  return (
    <div className="space-y-6">
      <StockCountMobileScanner
        stockCount={serialized}
        locale={locale}
        currencySymbol={currencySymbol}
        currentUserId={userId}
      />
    </div>
  );
}
