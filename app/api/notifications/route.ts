import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api';
import { getActiveShopContextOrThrow } from '@/lib/auth/get-active-shop';
import { ensureOperationalNotifications } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const { shopId, userId } = await getActiveShopContextOrThrow();
    await ensureOperationalNotifications(shopId);

    const userCondition = {
      shopId,
      OR: [{ userId: null }, { userId }]
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: userCondition,
        orderBy: { createdAt: 'desc' },
        take: 12
      }),
      prisma.notification.count({
        where: {
          ...userCondition,
          isRead: false
        }
      })
    ]);

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.isRead,
        createdAt: notification.createdAt.toISOString()
      })),
      unreadCount
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load notifications.');
  }
}

export async function PATCH() {
  try {
    const { shopId, userId } = await getActiveShopContextOrThrow();

    await prisma.notification.updateMany({
      where: {
        shopId,
        OR: [{ userId: null }, { userId }],
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update notifications.');
  }
}
