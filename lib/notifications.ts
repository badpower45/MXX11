import { NotificationType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function startOfToday() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

async function createNotificationOncePerDay({
  shopId,
  type,
  title,
  message
}: {
  shopId: string;
  type: NotificationType;
  title: string;
  message: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      shopId,
      type,
      title,
      createdAt: {
        gte: startOfToday()
      }
    },
    select: { id: true }
  });

  if (existing) {
    await prisma.notification.update({
      where: { id: existing.id },
      data: { message }
    });
    return;
  }

  await prisma.notification.create({
    data: {
      shopId,
      type,
      title,
      message
    }
  });
}

const lastRunCache = new Map<string, number>();

export async function ensureOperationalNotifications(shopId: string) {
  if (shopId === 'dev-shop') {
    return;
  }
  const now = Date.now();
  const lastRun = lastRunCache.get(shopId) ?? 0;
  if (now - lastRun < 15 * 60 * 1000) {
    return;
  }
  lastRunCache.set(shopId, now);
  const settings = await prisma.shopSetting.findUnique({
    where: { shopId },
    select: {
      lowStockEnabled: true,
      lowStockThreshold: true,
      currencySymbol: true
    }
  });

  if (settings?.lowStockEnabled) {
    const lowStockProducts = await prisma.product.findMany({
      where: {
        shopId,
        isActive: true,
        stockQty: { lte: settings.lowStockThreshold }
      },
      orderBy: [{ stockQty: 'asc' }, { name: 'asc' }],
      take: 5,
      select: {
        id: true,
        name: true,
        stockQty: true
      }
    });

    for (const product of lowStockProducts) {
      await createNotificationOncePerDay({
        shopId,
        type: NotificationType.LOW_STOCK,
        title: `Low stock: ${product.name}`,
        message: `${product.name} is down to ${product.stockQty} unit(s). Review inventory and replenish before it blocks checkout.`
      });
    }
  }

  const dayStart = startOfToday();
  const [sales, purchaseReceipts] = await Promise.all([
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: dayStart } },
      _count: true,
      _sum: { totalAmount: true }
    }),
    prisma.purchaseReceipt.findMany({
      where: { shopId, receivedAt: { gte: dayStart } },
      select: {
        purchaseId: true,
        items: {
          select: {
            qtyReceived: true,
            purchaseItem: {
              select: {
                unitCost: true
              }
            }
          }
        }
      }
    })
  ]);

  const purchaseSpend = purchaseReceipts.reduce(
    (sum, receipt) =>
      sum +
      receipt.items.reduce(
        (receiptSum, item) => receiptSum + item.qtyReceived * Number(item.purchaseItem.unitCost.toString()),
        0
      ),
    0
  );

  const purchaseCount = new Set(purchaseReceipts.map((receipt) => receipt.purchaseId)).size;
  const currency = settings?.currencySymbol ?? 'ج.م ';

  await createNotificationOncePerDay({
    shopId,
    type: NotificationType.DAILY_SUMMARY,
    title: 'Daily summary',
    message: `Sales today: ${sales._count} transaction(s), revenue ${currency}${Number(sales._sum.totalAmount ?? 0).toFixed(2)}. Purchases received: ${purchaseCount}, spend ${currency}${purchaseSpend.toFixed(2)}.`
  });
}

export function getNotificationHref(type: NotificationType | string) {
  switch (type) {
    case 'LOW_STOCK':
      return '/inventory';
    case 'DAILY_SUMMARY':
      return '/dashboard';
    case 'SHIPMENT_ASSIGNED':
    case 'SHIPMENT_STAGE_CHANGED':
      return '/shipments';
    default:
      return '/activity';
  }
}

export async function sendUserNotification({
  shopId,
  userId,
  type,
  title,
  message
}: {
  shopId: string;
  userId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
}) {
  return prisma.notification.create({
    data: {
      shopId,
      userId: userId || null,
      type,
      title,
      message
    }
  });
}
