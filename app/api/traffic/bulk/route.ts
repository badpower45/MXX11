import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { getActiveCashSession } from '@/lib/register';

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('CASHIER');
    const body = await request.json();
    const { ids, status, totalCost, drawerType } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0 || !status) {
      return NextResponse.json({ error: 'IDs array and target status are required.' }, { status: 400 });
    }

    if (status !== 'IN_TRANSIT' && status !== 'DELIVERED') {
      return NextResponse.json({ error: 'Invalid bulk transition status.' }, { status: 400 });
    }

    const cost = Number(totalCost || 0);

    const invoices = await prisma.trafficInvoice.findMany({
      where: { id: { in: ids }, shopId }
    });

    if (invoices.length === 0) {
      return NextResponse.json({ error: 'No matching traffic invoices found.' }, { status: 404 });
    }

    const costPerInvoice = cost / invoices.length;
    const resolvedDrawer = drawerType === 'DRAWER_CASH' ? 'CASH' : (drawerType || 'CASH');

    const result = await prisma.$transaction(async (tx) => {
      // If cost is specified and is greater than 0, verify active session
      let activeSession = null;
      if (cost > 0) {
        activeSession = await getActiveCashSession(tx, shopId, userId);
        if (!activeSession) {
          throw new Error('ACTIVE_SESSION_REQUIRED_FOR_COST');
        }
      }

      // 1. Bulk Transition: PENDING_SEND -> IN_TRANSIT
      if (status === 'IN_TRANSIT') {
        // Update individual invoices
        await tx.trafficInvoice.updateMany({
          where: { id: { in: ids }, shopId },
          data: {
            status: 'IN_TRANSIT',
            transportCost: costPerInvoice
          }
        });

        // Record branch expense
        if (cost > 0) {
          await tx.branchExpense.create({
            data: {
              shopId,
              userId,
              category: 'OTHER',
              amount: cost,
              reason: `تكلفة نقل عدد ${invoices.length} فاتورة مرور للقاهرة`,
              drawer: resolvedDrawer
            }
          });

          // Record cash payout movement
          if (activeSession) {
            await tx.cashMovement.create({
              data: {
                shopId,
                cashSessionId: activeSession.id,
                type: 'PAYOUT',
                amount: cost,
                note: `تكلفة نقل عدد ${invoices.length} فاتورة مرور للقاهرة`,
                createdByUserId: userId,
                drawer: resolvedDrawer
              }
            });
          }
        }

        // Log activities
        for (const inv of invoices) {
          await logActivity({
            tx,
            shopId,
            userId,
            action: 'TRAFFIC_INVOICE_SENT',
            entityType: 'TrafficInvoice',
            entityId: inv.id,
            description: `Sent traffic invoice of ${inv.customerName} to Cairo (Bulk). Transport cost share: ${costPerInvoice}.`
          });
        }
      }

      // 2. Bulk Transition: IN_TRANSIT -> DELIVERED
      if (status === 'DELIVERED') {
        // Update individual invoices
        await tx.trafficInvoice.updateMany({
          where: { id: { in: ids }, shopId },
          data: {
            status: 'DELIVERED',
            cairoReceiptCost: costPerInvoice,
            receivedAtCairo: new Date()
          }
        });

        // Record branch expense
        if (cost > 0) {
          await tx.branchExpense.create({
            data: {
              shopId,
              userId,
              category: 'OTHER',
              amount: cost,
              reason: `تكاليف استلام عدد ${invoices.length} ورقة مرور من القاهرة`,
              drawer: resolvedDrawer
            }
          });

          // Record cash payout movement
          if (activeSession) {
            await tx.cashMovement.create({
              data: {
                shopId,
                cashSessionId: activeSession.id,
                type: 'PAYOUT',
                amount: cost,
                note: `تكاليف استلام عدد ${invoices.length} ورقة مرور من القاهرة`,
                createdByUserId: userId,
                drawer: resolvedDrawer
              }
            });
          }
        }

        // Log activities
        for (const inv of invoices) {
          await logActivity({
            tx,
            shopId,
            userId,
            action: 'TRAFFIC_INVOICE_RECEIVED',
            entityType: 'TrafficInvoice',
            entityId: inv.id,
            description: `Received traffic invoice of ${inv.customerName} from Cairo (Bulk). Cairo cost share: ${costPerInvoice}.`
          });
        }
      }

      return { count: invoices.length };
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    if (error instanceof Error && error.message === 'ACTIVE_SESSION_REQUIRED_FOR_COST') {
      return NextResponse.json(
        { error: 'Open a register session before recording traffic costs payout.' },
        { status: 409 }
      );
    }
    return apiErrorResponse(error, 'Unable to perform bulk traffic operation.');
  }
}
