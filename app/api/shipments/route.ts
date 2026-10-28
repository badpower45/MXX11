import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { sendUserNotification } from '@/lib/notifications';
import { ShipmentStage, NotificationType } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const { shopId, userId } = await requireRole('CASHIER');
    const { searchParams } = new URL(request.url);

    const stage = searchParams.get('stage') as ShipmentStage | null;
    const search = searchParams.get('search')?.trim();
    const assignedToMe = searchParams.get('assignedToMe') === 'true';

    const where: any = { shopId };

    if (stage && Object.values(ShipmentStage).includes(stage)) {
      where.currentStage = stage;
    }

    if (search) {
      where.OR = [
        { vesselName: { contains: search, mode: 'insensitive' } },
        { trackingNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { berthLocation: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (assignedToMe) {
      where.OR = [
        ...(where.OR ? [where.OR] : []),
        { coordinatorId: userId },
        { procurementOfficerId: userId },
        { warehouseOfficerId: userId },
        { customsOfficerId: userId },
        { deliveryOfficerId: userId }
      ];
    }

    const shipments = await prisma.shipSupplyOrder.findMany({
      where,
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
    });

    return NextResponse.json({
      shipments: shipments.map((s) => ({
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
        deliveryDate: s.deliveryDate ? s.deliveryDate.toISOString() : null
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to retrieve shipments.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('CASHIER');
    const body = await request.json();

    const {
      vesselName,
      vesselImo,
      berthLocation,
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      notes,
      eta,
      etd,
      procurementOfficerId,
      warehouseOfficerId,
      customsOfficerId,
      deliveryOfficerId,
      items = []
    } = body;

    if (!vesselName || !vesselName.trim()) {
      return NextResponse.json({ error: 'اسم السفينة مطلوب.' }, { status: 400 });
    }

    if (!customerName || !customerName.trim()) {
      return NextResponse.json({ error: 'اسم العميل / الوكيل الملاحي مطلوب.' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'يجب إضافة صنف واحد على الأقل في طلب التموين.' }, { status: 400 });
    }

    const count = await prisma.shipSupplyOrder.count({ where: { shopId } });
    const year = new Date().getFullYear();
    const orderNumber = `ORD-${year}-${String(count + 1).padStart(4, '0')}`;
    const trackingNumber = `SHP-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

    let calculatedTotal = 0;
    const validatedItems = items.map((item: any) => {
      const qty = Math.max(0.01, Number(item.quantity) || 1);
      const price = item.unitPrice ? Number(item.unitPrice) : 0;
      calculatedTotal += qty * price;

      return {
        itemName: String(item.itemName || '').trim(),
        category: item.category || 'PROVISIONS',
        quantity: qty,
        unit: item.unit || 'كجم',
        unitPrice: price > 0 ? price : null,
        isExternallyProcured: Boolean(item.isExternallyProcured),
        notes: item.notes || null
      };
    });

    const newOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.shipSupplyOrder.create({
        data: {
          shopId,
          orderNumber,
          trackingNumber,
          vesselName: vesselName.trim(),
          vesselImo: vesselImo ? vesselImo.trim() : null,
          berthLocation: berthLocation ? berthLocation.trim() : null,
          customerId: customerId || null,
          customerName: customerName.trim(),
          customerPhone: customerPhone ? customerPhone.trim() : null,
          customerEmail: customerEmail ? customerEmail.trim() : null,
          currentStage: ShipmentStage.NEW,
          notes: notes ? notes.trim() : null,
          eta: eta ? new Date(eta) : null,
          etd: etd ? new Date(etd) : null,
          coordinatorId: userId,
          procurementOfficerId: procurementOfficerId || null,
          warehouseOfficerId: warehouseOfficerId || null,
          customsOfficerId: customsOfficerId || null,
          deliveryOfficerId: deliveryOfficerId || null,
          totalAmount: calculatedTotal > 0 ? calculatedTotal : null,
          items: {
            create: validatedItems
          },
          stageLogs: {
            create: {
              fromStage: null,
              toStage: ShipmentStage.NEW,
              performedById: userId,
              notes: 'تم تسجيل وتأكيد طلب التموين الملاحي وبدء التتبع.'
            }
          }
        },
        include: {
          items: true,
          stageLogs: true
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'SHIP_SUPPLY_ORDER_CREATED',
        entityType: 'ShipSupplyOrder',
        entityId: order.id,
        description: `تم إنشاء طلب تموين وشحنة للسفينة ${order.vesselName} برقم تتبع ${order.trackingNumber}`,
        metadata: { trackingNumber, vesselName, itemsCount: items.length }
      });

      return order;
    });

    // Notify assigned officers
    const notifyPromises = [];
    if (procurementOfficerId) {
      notifyPromises.push(
        sendUserNotification({
          shopId,
          userId: procurementOfficerId,
          type: NotificationType.SHIPMENT_ASSIGNED,
          title: `تكليف مشتريات وتوريد: ${vesselName}`,
          message: `تم تكليفك بتوريد الأصناف لطلب تموين السفينة ${vesselName} (كود ${trackingNumber}).`
        })
      );
    }

    if (warehouseOfficerId) {
      notifyPromises.push(
        sendUserNotification({
          shopId,
          userId: warehouseOfficerId,
          type: NotificationType.SHIPMENT_ASSIGNED,
          title: `طلب تجهيز وتعبئة: ${vesselName}`,
          message: `يوجد طلب تموين جديد للسفينة ${vesselName} بحاجة للتجهيز من المخزن (كود ${trackingNumber}).`
        })
      );
    }

    if (deliveryOfficerId) {
      notifyPromises.push(
        sendUserNotification({
          shopId,
          userId: deliveryOfficerId,
          type: NotificationType.SHIPMENT_ASSIGNED,
          title: `تكليف تسليم بحري: ${vesselName}`,
          message: `تم تعيينك لتسليم شحنة السفينة ${vesselName} عند وصولها للرصيف (كود ${trackingNumber}).`
        })
      );
    }

    if (customsOfficerId) {
      notifyPromises.push(
        sendUserNotification({
          shopId,
          userId: customsOfficerId,
          type: NotificationType.SHIPMENT_ASSIGNED,
          title: `متابعة تصاريح الميناء: ${vesselName}`,
          message: `شحنة جديدة للسفينة ${vesselName} تتطلب استخراج أذونات الرصيف والميناء (كود ${trackingNumber}).`
        })
      );
    }

    await Promise.allSettled(notifyPromises);

    return NextResponse.json({
      success: true,
      order: {
        ...newOrder,
        totalAmount: newOrder.totalAmount?.toString()
      }
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to create shipment order.');
  }
}

