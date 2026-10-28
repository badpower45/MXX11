import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { getActiveCashSession } from '@/lib/register';
import { TrafficInvoiceStatus } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const { shopId } = await requireRole('CASHIER');
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('query') || '';
    const status = searchParams.get('status') || null;
    const fromDate = searchParams.get('fromDate') || null;
    const toDate = searchParams.get('toDate') || null;

    const where: any = { shopId };

    if (query) {
      where.customerName = { contains: query, mode: 'insensitive' };
    }

    if (status) {
      where.status = status as TrafficInvoiceStatus;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) {
        where.createdAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.createdAt.lte = new Date(toDate);
      }
    }

    const invoices = await prisma.trafficInvoice.findMany({
      where,
      include: {
        sale: {
          select: {
            saleNumber: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format output
    return NextResponse.json({
      invoices: invoices.map((inv) => ({
        ...inv,
        transportCost: inv.transportCost.toString(),
        cairoReceiptCost: inv.cairoReceiptCost.toString(),
        deliveryFeeCollected: inv.deliveryFeeCollected.toString(),
        createdAt: inv.createdAt.toISOString(),
        updatedAt: inv.updatedAt.toISOString(),
        receivedAtCairo: inv.receivedAtCairo?.toISOString() ?? null,
        deliveredToCustomerAt: inv.deliveredToCustomerAt?.toISOString() ?? null
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to retrieve traffic invoices.');
  }
}

export async function PATCH(request: Request) {
  try {
    const { shopId, userId } = await requireRole('CASHIER');
    const body = await request.json();
    const { id, status, transportCost, cairoReceiptCost, deliveryFeeCollected, drawerType } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and target status are required.' }, { status: 400 });
    }

    const invoice = await prisma.trafficInvoice.findFirst({
      where: { id, shopId }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Traffic invoice not found.' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Transition: PENDING_SEND -> IN_TRANSIT (Send to Cairo)
      if (status === 'IN_TRANSIT') {
        const cost = Number(transportCost || 0);
        
        const updated = await tx.trafficInvoice.update({
          where: { id },
          data: {
            status: 'IN_TRANSIT',
            transportCost: cost
          }
        });

        // Record transport cost directly to the general branch expenses table
        if (cost > 0) {
          await tx.branchExpense.create({
            data: {
              shopId,
              userId,
              category: 'OTHER',
              amount: cost,
              reason: `تكلفة نقل فاتورة مرور القاهرة للعميل ${invoice.customerName}`
            }
          });
        }

        await logActivity({
          tx,
          shopId,
          userId,
          action: 'TRAFFIC_INVOICE_SENT',
          entityType: 'TrafficInvoice',
          entityId: invoice.id,
          description: `Sent traffic invoice of ${invoice.customerName} to Cairo. Transport cost: ${cost}.`
        });

        return updated;
      }

      // 2. Transition: IN_TRANSIT -> DELIVERED (Receive from Cairo)
      if (status === 'DELIVERED') {
        const cost = Number(cairoReceiptCost || 0);

        const updated = await tx.trafficInvoice.update({
          where: { id },
          data: {
            status: 'DELIVERED',
            cairoReceiptCost: cost,
            receivedAtCairo: new Date()
          }
        });

        // Record Cairo receipt cost directly to the general branch expenses table
        if (cost > 0) {
          await tx.branchExpense.create({
            data: {
              shopId,
              userId,
              category: 'OTHER',
              amount: cost,
              reason: `تكاليف استلام ورقة المرور من القاهرة للعميل ${invoice.customerName}`
            }
          });
        }

        await logActivity({
          tx,
          shopId,
          userId,
          action: 'TRAFFIC_INVOICE_RECEIVED',
          entityType: 'TrafficInvoice',
          entityId: invoice.id,
          description: `Received traffic invoice of ${invoice.customerName} from Cairo. Cairo cost: ${cost}.`
        });

        return updated;
      }

      // 3. Action: Deliver to Customer (from DELIVERED to actually handed over)
      if (status === 'COMPLETED') {
        const fee = Number(deliveryFeeCollected || 0);

        if (fee > 0 && !drawerType) {
          throw new Error('DRAWER_REQUIRED_FOR_FEE');
        }

        const updated = await tx.trafficInvoice.update({
          where: { id },
          data: {
            deliveryFeeCollected: fee,
            deliveredToCustomerAt: new Date()
          }
        });

        // If a fee is collected, inject it into the active cash session
        if (fee > 0 && drawerType) {
          const activeSession = await getActiveCashSession(tx, shopId, userId);
          if (!activeSession) {
            throw new Error('ACTIVE_SESSION_REQUIRED_FOR_FEE');
          }

          let movementNote = `رسوم تسليم ورقة مرور للعميل ${invoice.customerName}`;
          if (drawerType === 'INSTAPAY') movementNote += ' (InstaPay)';
          if (drawerType === 'WALLET') movementNote += ' (Wallet)';
          if (drawerType === 'VISA') movementNote += ' (Visa)';

          const movementDrawer = drawerType === 'DRAWER_CASH' ? 'CASH' : (drawerType || 'CASH');

          await tx.cashMovement.create({
            data: {
              shopId,
              cashSessionId: activeSession.id,
              type: 'MANUAL_CORRECTION',
              amount: fee,
              note: movementNote,
              createdByUserId: userId,
              drawer: movementDrawer
            }
          });
        }

        await logActivity({
          tx,
          shopId,
          userId,
          action: 'TRAFFIC_INVOICE_DELIVERED',
          entityType: 'TrafficInvoice',
          entityId: invoice.id,
          description: `Delivered traffic invoice to customer ${invoice.customerName}. Fee collected: ${fee}.`
        });

        return updated;
      }

      throw new Error('INVALID_STATUS_TRANSITION');
    });

    return NextResponse.json({ success: true, invoice: result });
  } catch (error: any) {
    if (error instanceof Error && error.message === 'ACTIVE_SESSION_REQUIRED_FOR_FEE') {
      return NextResponse.json(
        { error: 'Open a register session before collecting the delivery fee.' },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === 'DRAWER_REQUIRED_FOR_FEE') {
      return NextResponse.json(
        { error: 'Please select a drawer to deposit the delivery fee.' },
        { status: 400 }
      );
    }
    return apiErrorResponse(error, 'Unable to update traffic invoice.');
  }
}
