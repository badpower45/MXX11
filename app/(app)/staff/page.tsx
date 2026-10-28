import AppHeader from '@/components/layout/AppHeader';
import StaffListManager from '@/components/staff/StaffListManager';
import { requirePagePermission } from '@/lib/authz';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { prisma } from '@/lib/prisma';
import { serializeStaffListItem } from '@/lib/serializers/staff';
import { getManagedShops } from '@/lib/staff';

export default async function StaffPage() {
  const { userId, shopId } = await requirePagePermission('MANAGE_STAFF');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  const shops = await getManagedShops(userId);
  const shopIds = shops.map((entry) => entry.id);

  const [items, guestItems] = await Promise.all([
    prisma.userShop.findMany({
      where: {
        shopId: { in: shopIds }
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            authAuditLogs: {
              where: { action: 'LOGIN_SUCCESS' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                action: true,
                createdAt: true,
                ipAddress: true,
                userAgent: true
              }
            }
          }
        }
      },
      orderBy: [{ isActive: 'desc' }, { assignedAt: 'desc' }]
    }),
    prisma.guestStaff.findMany({
      where: {
        shopId: { in: shopIds }
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    })
  ]);

  const serializedRegular = items.map(serializeStaffListItem);
  const serializedGuests = guestItems.map((guest) => ({
    id: guest.id,
    userId: '',
    name: guest.name,
    email: 'بدون حساب',
    role: 'STOCK_COUNTER' as const,
    shopId: guest.shopId,
    shopName: guest.shop.name,
    shopSlug: guest.shop.slug,
    isActive: guest.isActive,
    assignedAt: guest.createdAt.toISOString(),
    disabledAt: null,
    lastLogin: null,
    customPermissions: [],
    baseSalary: null,
    commissionRate: null
  }));

  const combinedItems = [...serializedRegular, ...serializedGuests].sort((left, right) => {
    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }
    return new Date(right.assignedAt).getTime() - new Date(left.assignedAt).getTime();
  });

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('staff.title')}
        subtitle={t('staff.subtitle')}
      />
      <StaffListManager
        initialItems={combinedItems}
        shops={shops.map((shop) => ({
          id: shop.id,
          name: shop.name,
          slug: shop.slug
        }))}
        defaultShopId={shopId}
      />
    </div>
  );
}
