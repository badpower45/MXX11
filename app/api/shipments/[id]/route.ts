import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { sendUserNotification } from '@/lib/notifications';
import { ShipmentStage, NotificationType } from '@prisma/client';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { shopId } = await requireRole('CASHIER');
    const { id } = await context.params;

    const shipment = await prisma.shipSupplyOrder.findFirst({
      where: { id, shopId },
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
      }
    });

    if (!shipment) {
      return NextResponse.json({ error: 'الشحنة غير موجودة.' }, { status: 404 });
    }

    return NextResponse.json({
      shipment: {
        ...shipment,
        totalAmount: shipment.totalAmount?.toString() ?? null,
        items: shipment.items.map((i) => ({
          ...i,
          quantity: i.quantity.toString(),
          unitPrice: i.unitPrice?.toString() ?? null
        })),
        createdAt: shipment.createdAt.toISOString(),
        updatedAt: shipment.updatedAt.toISOString(),
        eta: shipment.eta?.toISOString() ?? null,
        etd: shipment.etd?.toISOString() ?? null,
        deliveryDate: shipment.deliveryDate?.toISOString() ?? null
      }
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load shipment details.');
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { shopId, userId } = await requireRole('CASHIER');
    const { id } = await context.params;
    const body = await request.json();

    const shipment = await prisma.shipSupplyOrder.findFirst({
      where: { id, shopId },
      include: { items: true }
    });

    if (!shipment) {
      return NextResponse.json({ error: 'الشحنة غير موجودة.' }, { status: 404 });
    }

    const { action } = body;

    if (action === 'change_stage') {
      const toStage = body.toStage as ShipmentStage;

      if (!toStage || !Object.values(ShipmentStage).includes(toStage)) {
        return NextResponse.json({ error: 'المرحلة المطلوبة غير صحيحة.' }, { status: 400 });
      }

      const { notes, referenceDoc } = body;
      const prevStage = shipment.currentStage;

      const updated = await prisma.$transaction(async (tx) => {
        const order = await tx.shipSupplyOrder.update({
          where: { id },
          data: {
            currentStage: toStage,
            deliveryDate: toStage === ShipmentStage.DELIVERED_TO_VESSEL ? new Date() : undefined
          }
        });

        await tx.shipmentStageLog.create({
          data: {
            orderId: id,
            fromStage: prevStage,
            toStage,
            performedById: userId,
            notes: notes ? notes.trim() : null,
            referenceDoc: referenceDoc ? referenceDoc.trim() : null
          }
        });

        await logActivity({
          tx,
          shopId,
          userId,
          action: 'SHIPMENT_STAGE_TRANSITION',
          entityType: 'ShipSupplyOrder',
          entityId: id,
          description: `تغيير مرحلة شحنة السفينة ${order.vesselName} من ${prevStage} إلى ${toStage}`,
          metadata: { fromStage: prevStage, toStage, notes, referenceDoc }
        });

        return order;
      });

      // Target notifications depending on the new stage
      const stageLabelsAr: Record<ShipmentStage, string> = {
        NEW: 'طلب جديد',
        EXTERNAL_PROCUREMENT: 'شراء الأصناف الناقصة خارجيًا',
        WAREHOUSE_PREPARATION: 'تجهيز وتعبئة المخزن',
        PORT_CUSTOMS_CLEARANCE: 'استخراج تصريح الميناء والجمارك',
        IN_TRANSIT_TO_BERTH: 'في طريقها للتسليم بالرصيف',
        DELIVERED_TO_VESSEL: 'تم التسليم لطاقم السفينة',
        CANCELLED: 'شحنة ملغاة'
      };

      const notifyPromises = [];
      const stageTitle = `تحديث شحنة ${shipment.vesselName}: ${stageLabelsAr[toStage]}`;
      const stageMsg = `تم نقل الشحنة (${shipment.trackingNumber}) لمرحلة: ${stageLabelsAr[toStage]}. ${notes ? `ملاحظة: ${notes}` : ''}`;

      // Notify the officer designated for this new stage
      let targetOfficerId: string | null = null;
      if (toStage === ShipmentStage.EXTERNAL_PROCUREMENT) {
        targetOfficerId = shipment.procurementOfficerId;
      } else if (toStage === ShipmentStage.WAREHOUSE_PREPARATION) {
        targetOfficerId = shipment.warehouseOfficerId;
      } else if (toStage === ShipmentStage.PORT_CUSTOMS_CLEARANCE) {
        targetOfficerId = shipment.customsOfficerId;
      } else if (toStage === ShipmentStage.IN_TRANSIT_TO_BERTH) {
        targetOfficerId = shipment.deliveryOfficerId;
      }

      if (targetOfficerId && targetOfficerId !== userId) {
        notifyPromises.push(
          sendUserNotification({
            shopId,
            userId: targetOfficerId,
            type: NotificationType.SHIPMENT_STAGE_CHANGED,
            title: stageTitle,
            message: stageMsg
          })
        );
      }

      // Also notify the coordinator if someone else updated it
      if (shipment.coordinatorId && shipment.coordinatorId !== userId) {
        notifyPromises.push(
          sendUserNotification({
            shopId,
            userId: shipment.coordinatorId,
            type: NotificationType.SHIPMENT_STAGE_CHANGED,
            title: stageTitle,
            message: stageMsg
          })
        );
      }

      await Promise.allSettled(notifyPromises);

      return NextResponse.json({ success: true, order: updated });
    }

    if (action === 'update_item') {
      const { itemId, isPrepared, isExternallyProcured } = body;
      const targetItem = shipment.items.find((i) => i.id === itemId);

      if (!targetItem) {
        return NextResponse.json({ error: 'الصنف غير موجود بالشحنة.' }, { status: 404 });
      }

      const updatedItem = await prisma.shipSupplyOrderItem.update({
        where: { id: itemId },
        data: {
          isPrepared: typeof isPrepared === 'boolean' ? isPrepared : undefined,
          isExternallyProcured: typeof isExternallyProcured === 'boolean' ? isExternallyProcured : undefined
        }
      });

      return NextResponse.json({ success: true, item: updatedItem });
    }

    return NextResponse.json({ error: 'إجراء غير معروف.' }, { status: 400 });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update shipment.');
  }
}
