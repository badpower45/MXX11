import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

const VALID_DRAWERS = ['CASH', 'INSTAPAY', 'WALLET', 'VISA'] as const;
type DrawerType = (typeof VALID_DRAWERS)[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { shopId, userId } = await requireRole('CASHIER');
    const body = await request.json();
    const { fromDrawer, toDrawer, amount, note } = body;

    const parsedAmount = Number(amount || 0);

    if (!fromDrawer || !toDrawer || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'من، إلى، والمبلغ قيم مطلوبة.' },
        { status: 400 }
      );
    }

    if (
      !VALID_DRAWERS.includes(fromDrawer as any) ||
      !VALID_DRAWERS.includes(toDrawer as any)
    ) {
      return NextResponse.json(
        { error: 'خزنة المصدر أو الهدف غير صالحة.' },
        { status: 400 }
      );
    }

    if (fromDrawer === toDrawer) {
      return NextResponse.json(
        { error: 'لا يمكن التحويل لنفس الخزنة.' },
        { status: 400 }
      );
    }

    const session = await prisma.cashSession.findFirst({
      where: { id: sessionId, shopId }
    });

    if (!session) {
      return NextResponse.json(
        { error: 'جلسة الخزينة غير موجودة.' },
        { status: 404 }
      );
    }

    if (session.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'يجب أن تكون جلسة الخزينة مفتوحة لإجراء التحويل.' },
        { status: 409 }
      );
    }

    // Compute expected balance for fromDrawer in this session
    const asOf = new Date();

    const [sales, refunds, movements] = await Promise.all([
      prisma.sale.findMany({
        where: {
          shopId,
          cashierUserId: session.userId,
          status: 'COMPLETED',
          createdAt: { gte: session.openedAt, lte: asOf }
        },
        include: { payments: true }
      }),
      prisma.refundPayment.findMany({
        where: {
          saleAdjustment: {
            shopId,
            createdByUserId: session.userId,
            createdAt: { gte: session.openedAt, lte: asOf }
          }
        }
      }),
      prisma.cashMovement.findMany({
        where: { cashSessionId: session.id }
      })
    ]);

    // Calculate source drawer balance
    let salesTotal = 0;
    let refundsTotal = 0;
    let movementsTotal = 0;

    // 1. Sales
    for (const sale of sales) {
      if (sale.payments.length > 0) {
        for (const p of sale.payments) {
          const amt = Number(p.amount);
          if (fromDrawer === 'CASH' && p.method === 'كاش') {
            salesTotal += amt - Number(sale.changeDue);
          } else if (fromDrawer === 'INSTAPAY' && p.method === 'انستا باي') {
            salesTotal += amt;
          } else if (fromDrawer === 'WALLET' && p.method === 'محفظه الكترونيه') {
            salesTotal += amt;
          } else if (fromDrawer === 'VISA' && ['فيزا', 'Visa', 'VISA'].includes(p.method)) {
            salesTotal += amt;
          }
        }
      } else {
        const amt = Number(sale.totalAmount);
        if (fromDrawer === 'CASH' && sale.paymentMethod === 'كاش') {
          salesTotal += amt - Number(sale.changeDue);
        } else if (fromDrawer === 'INSTAPAY' && sale.paymentMethod === 'انستا باي') {
          salesTotal += amt;
        } else if (fromDrawer === 'WALLET' && sale.paymentMethod === 'محفظه الكترونيه') {
          salesTotal += amt;
        } else if (fromDrawer === 'VISA' && ['فيزا', 'Visa', 'VISA'].includes(sale.paymentMethod)) {
          salesTotal += amt;
        }
      }
    }

    // 2. Refunds
    for (const r of refunds) {
      const amt = Number(r.amount);
      if (fromDrawer === 'CASH' && r.method === 'كاش') {
        refundsTotal += amt;
      } else if (fromDrawer === 'INSTAPAY' && r.method === 'انستا باي') {
        refundsTotal += amt;
      } else if (fromDrawer === 'WALLET' && r.method === 'محفظه الكترونيه') {
        refundsTotal += amt;
      } else if (fromDrawer === 'VISA' && ['فيزا', 'Visa', 'VISA'].includes(r.method)) {
        refundsTotal += amt;
      }
    }

    // 3. Movements
    for (const m of movements) {
      const amt = Number(m.amount);
      const mDrawer = m.drawer || 'CASH';
      if (mDrawer === fromDrawer) {
        const isWithdrawal = ['PAYOUT', 'CASH_DROP', 'PETTY_CASH'].includes(m.type);
        const signedAmt = isWithdrawal ? -amt : m.type === 'MANUAL_CORRECTION' ? amt : -amt;
        movementsTotal += signedAmt;
      }
    }

    let initialAmount = 0;
    if (fromDrawer === 'CASH') {
      initialAmount = Number(session.openingFloat);
    }

    const availableBalance = initialAmount + salesTotal - refundsTotal + movementsTotal;

    if (parsedAmount > availableBalance) {
      return NextResponse.json(
        {
          error: `الرصيد غير كافٍ في الخزنة المحددة للتحويل. الرصيد المتاح: ${availableBalance.toFixed(
            2
          )} ج.م`
        },
        { status: 400 }
      );
    }

    const fromDrawerTyped = fromDrawer as DrawerType;
    const toDrawerTyped = toDrawer as DrawerType;

    const drawerLabelsAr: Record<DrawerType, string> = {
      CASH: 'كاش',
      INSTAPAY: 'انستا باي',
      WALLET: 'محفظة',
      VISA: 'فيزا'
    };

    const transferNote = note || `تحويل رصيد من ${drawerLabelsAr[fromDrawerTyped]} إلى ${drawerLabelsAr[toDrawerTyped]}`;

    // Perform transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Payout movement from the source drawer
      const payout = await tx.cashMovement.create({
        data: {
          shopId,
          cashSessionId: session.id,
          type: 'PAYOUT',
          amount: parsedAmount,
          note: `${transferNote} (خصم من ${drawerLabelsAr[fromDrawerTyped]})`,
          createdByUserId: userId,
          drawer: fromDrawerTyped
        }
      });

      // 2. Correction movement to the target drawer
      const deposit = await tx.cashMovement.create({
        data: {
          shopId,
          cashSessionId: session.id,
          type: 'MANUAL_CORRECTION',
          amount: parsedAmount,
          note: `${transferNote} (إيداع في ${drawerLabelsAr[toDrawerTyped]})`,
          createdByUserId: userId,
          drawer: toDrawerTyped
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'REGISTER_CASH_MOVEMENT_RECORDED',
        entityType: 'CashSession',
        entityId: session.id,
        description: `Transferred ${parsedAmount} from ${fromDrawerTyped} to ${toDrawerTyped}.`,
        metadata: {
          sessionId: session.id,
          fromDrawer: fromDrawerTyped,
          toDrawer: toDrawerTyped,
          amount: parsedAmount,
          note: transferNote
        }
      });

      return { payout, deposit };
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to complete drawer transfer.');
  }
}
