import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import AppSidebar from '@/components/layout/AppSidebar';
import CommandPalette from '@/components/layout/CommandPalette';
import NotificationsBell from '@/components/layout/NotificationsBell';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { ensureOperationalNotifications } from '@/lib/notifications';
import { prisma } from '@/lib/prisma';
import { localizeShopName } from '@/lib/format';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { shop, role, userId, permissions } = await getActiveShopContext();
  const [memberships, notifications] = await Promise.all([
    prisma.userShop.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            posType: true
          }
        }
      },
      orderBy: [{ assignedAt: 'asc' }]
    }),
    prisma.notification.findMany({
      where: {
        shopId: shop.id,
        OR: [{ userId: null }, { userId }]
      },
      orderBy: { createdAt: 'desc' },
      take: 8
    })
  ]);

  // Run notification checks asynchronously to avoid blocking page transition
  ensureOperationalNotifications(shop.id).catch((err) => {
    console.error('Error running operational notifications:', err);
  });

  const formattedNotifications = notifications.map((notification) => ({
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString()
  }));

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900">
      <div className="relative lg:flex">
        <AppSidebar
          shopName={localizeShopName(shop.name)}
          shopType={shop.posType}
          role={role}
          permissions={permissions}
          activeShopId={shop.id}
          availableShops={memberships.map((membership) => ({
            id: membership.shop.id,
            name: localizeShopName(membership.shop.name),
            posType: membership.shop.posType,
            role: membership.role
          }))}
        />
        <main className="min-h-screen flex-1 min-w-0 flex flex-col">
          {/* Top Desktop Bar */}
          <header className="hidden lg:flex h-14 items-center justify-between border-b border-stone-200/80 bg-white/90 px-6 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-stone-800">
                <span>⚓</span>
                <span>{localizeShopName(shop.name)}</span>
              </span>
              <span className="text-stone-300">/</span>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-100">
                {shop.posType}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <NotificationsBell initialNotifications={formattedNotifications} />
            </div>
          </header>

          {/* Mobile Utility Bar */}
          <div className="flex lg:hidden items-center justify-end gap-2 px-4 py-2 bg-white/80 border-b border-stone-200/80">
            <LanguageSwitcher />
            <NotificationsBell initialNotifications={formattedNotifications} />
          </div>

          <div className="flex-1 p-3 sm:p-5 lg:p-6 max-w-[1600px] w-full mx-auto">
            <CommandPalette role={role} />
            <div className="mt-2">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
