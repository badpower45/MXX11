import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import StaffDetailManager from '@/components/staff/StaffDetailManager';
import { requirePagePermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { serializeAuthAuditLog, serializeStaffListItem } from '@/lib/serializers/staff';
import { getManagedShops } from '@/lib/staff';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function StaffDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { userId } = await requirePagePermission('MANAGE_STAFF');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  const shops = await getManagedShops(userId);
  const shopIds = shops.map((entry) => entry.id);

  const membership = await prisma.userShop.findFirst({
    where: {
      id,
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
          emailVerifiedAt: true,
          forcePasswordReset: true,
          lockedUntil: true,
          authAuditLogs: {
            orderBy: { createdAt: 'desc' },
            take: 25,
            select: {
              id: true,
              action: true,
              email: true,
              ipAddress: true,
              userAgent: true,
              createdAt: true
            }
          }
        }
      }
    }
  });

  let serialized: any;
  let authActivity: any[] = [];
  let name = '';
  let email = '';
  let hasPin = false;
  let pinSetAt = null;
  let emailVerifiedAt = null;
  let forcePasswordReset = false;
  let lockedUntil = null;

  if (!membership) {
    const guest = await prisma.guestStaff.findFirst({
      where: {
        id,
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
      }
    });

    if (!guest) {
      notFound();
    }

    serialized = {
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
    };

    name = guest.name;
    email = 'بدون حساب';
  } else {
    const regularSerialized = serializeStaffListItem({
      ...membership,
      user: {
        ...membership.user,
        authAuditLogs: membership.user.authAuditLogs.filter((log) => log.action === 'LOGIN_SUCCESS')
      }
    });

    serialized = regularSerialized;
    authActivity = membership.user.authAuditLogs.map(serializeAuthAuditLog);
    hasPin = Boolean(membership.staffPinHash);
    pinSetAt = membership.pinSetAt?.toISOString() ?? null;
    emailVerifiedAt = membership.user.emailVerifiedAt?.toISOString() ?? null;
    forcePasswordReset = membership.user.forcePasswordReset;
    lockedUntil = membership.user.lockedUntil?.toISOString() ?? null;
    name = membership.user.name ?? membership.user.email;
    email = membership.user.email;
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title={name}
        subtitle={t('staff.detail.subtitle')}
      />
      <StaffDetailManager
        initialStaff={{
          ...serialized,
          authActivity,
          hasPin,
          pinSetAt,
          emailVerifiedAt,
          forcePasswordReset,
          lockedUntil
        }}
        shops={shops}
      />
    </div>
  );
}
