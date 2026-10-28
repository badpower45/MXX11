import AppHeader from '@/components/layout/AppHeader';
import ShipmentsClient from '@/components/shipments/ShipmentsClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { getServerLocale } from '@/lib/i18n/server';

export default async function ShipmentsPage() {
  const { shopId, userId } = await getActiveShopContext();
  const locale = await getServerLocale();

  const [shipments, userShops, settings] = await Promise.all([
    prisma.shipSupplyOrder.findMany({
      where: { shopId },
      include: {
        items: true,
        stageLogs: {
          include: {
            performedBy: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        coordinator: { select: { id: true, name: true, email: true } },
        procurementOfficer: { select: { id: true, name: true, email: true } },
        warehouseOfficer: { select: { id: true, name: true, email: true } },
        customsOfficer: { select: { id: true, name: true, email: true } },
        deliveryOfficer: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    }),
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
        user: {
          name: 'asc'
        }
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
    })
  ]);

  const currencySymbol = settings?.currencySymbol ?? 'ج.م ';

  const formattedShipments = shipments.map((s) => ({
    ...s,
    totalAmount: s.totalAmount ? s.totalAmount.toString() : null,
    items: s.items.map((i) => ({
      ...i,
      quantity: i.quantity.toString(),
      unitPrice: i.unitPrice ? i.unitPrice.toString() : null
    })),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    eta: s.eta ? s.eta.toISOString() : null,
    etd: s.etd ? s.etd.toISOString() : null,
    deliveryDate: s.deliveryDate ? s.deliveryDate.toISOString() : null,
    stageLogs: s.stageLogs.map((log) => ({
      ...log,
      createdAt: log.createdAt.toISOString()
    }))
  }));

  const staff = userShops.map((m) => ({
    id: m.user.id,
    name: m.user.name || m.user.email,
    email: m.user.email,
    role: m.role
  }));

  return (
    <div className="space-y-6">
      <AppHeader
        title={locale === 'ar' ? 'شحنات وتموين السفن' : 'Shipments & Vessel Supply'}
        subtitle={
          locale === 'ar'
            ? 'تتبع طلبات تموين السفن بالمواد الغذائية وقطع الغيار، وإرسال التنبيهات لمسؤولي التوريد والمخزن والتسليم.'
            : 'Track marine provisions, external sourcing, warehouse packing, and berth delivery with automated in-app alerts.'
        }
      />
      <ShipmentsClient
        initialShipments={formattedShipments}
        staff={staff}
        currentUserId={userId}
        locale={locale}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}

