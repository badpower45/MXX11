import AppHeader from '@/components/layout/AppHeader';
import StockTransferManager from '@/components/transfers/StockTransferManager';
import type { StockTransferView } from '@/components/transfers/StockTransferManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { stockTransferDetailInclude } from '@/lib/stock-transfer-operations';
import { serializeStockTransfer } from '@/lib/stock-transfers';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function TransfersPage() {
  const { shopId, userId, role } = await requirePageRole('MANAGER');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const [shop, settings, memberships, sourceProducts, stockTransfers] = await Promise.all([
    prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: {
        currencySymbol: true
      }
    }),
    prisma.userShop.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ assignedAt: 'asc' }]
    }),
    prisma.product.findMany({
      where: {
        shopId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        stockQty: true
      },
      orderBy: { name: 'asc' }
    }),
    prisma.stockTransfer.findMany({
      where: {
        OR: [{ fromShopId: shopId }, { toShopId: shopId }]
      },
      include: stockTransferDetailInclude,
      orderBy: [{ createdAt: 'desc' }]
    })
  ]);

  const otherShops = memberships
    .filter((membership) => membership.shop.id !== shopId)
    .map((membership) => ({
      id: membership.shop.id,
      name: membership.shop.name,
      role: membership.role
    }));
  const safeSourceProducts = sourceProducts.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    stockQty: Number(product.stockQty)
  }));

  const destinationProducts = otherShops.length
    ? await prisma.product.findMany({
        where: {
          shopId: {
            in: otherShops.map((entry) => entry.id)
          },
          isActive: true
        },
        select: {
          id: true,
          shopId: true,
          name: true,
          sku: true,
          barcode: true,
          stockQty: true
        },
        orderBy: [{ shopId: 'asc' }, { name: 'asc' }]
      })
    : [];
  const safeDestinationProducts = destinationProducts.map((product) => ({
    id: product.id,
    shopId: product.shopId,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    stockQty: Number(product.stockQty)
  }));
  const safeTransfers = stockTransfers.map((stockTransfer) =>
    serializeStockTransfer(stockTransfer)
  ) as unknown as StockTransferView[];

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('transfers.title')}
        subtitle={t('transfers.subtitle')}
      />
      <StockTransferManager
        activeShopId={shop.id}
        activeShopName={shop.name}
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
        otherShops={otherShops}
        sourceProducts={safeSourceProducts}
        destinationProducts={safeDestinationProducts}
        initialTransfers={safeTransfers}
        userRole={role}
      />
    </div>
  );
}
