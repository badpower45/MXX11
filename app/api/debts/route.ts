import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { getActiveCashSession } from '@/lib/register';

export async function GET() {
  try {
    const { shopId } = await requireRole('MANAGER');

    const debts = await prisma.dealerDebt.findMany({
      where: { shopId },
      include: {
        supplier: {
          select: {
            name: true,
            contactName: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      debts: debts.map((d) => ({
        ...d,
        totalAmount: d.totalAmount.toString(),
        paidAmount: d.paidAmount.toString(),
        remainingDebt: d.remainingDebt.toString(),
        createdAt: d.createdAt.toISOString()
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to retrieve dealer debts.');
  }
}

export async function PATCH(request: Request) {
  try {
    const { shopId, userId } = await requireRole('MANAGER');
    const body = await request.json();
    const { id, paymentAmount, drawerType } = body;

    if (!id || !paymentAmount || Number(paymentAmount) <= 0) {
      return NextResponse.json({ error: 'Valid ID and payment amount are required.' }, { status: 400 });
    }

    const debt = await prisma.dealerDebt.findFirst({
      where: { id, shopId },
      include: { supplier: true }
    });

    if (!debt) {
      return NextResponse.json({ error: 'Dealer debt record not found.' }, { status: 404 });
    }

    const payVal = Number(paymentAmount);
    const currentRemaining = Number(debt.remainingDebt);

    if (payVal > currentRemaining) {
      return NextResponse.json({ error: 'Payment amount cannot exceed the remaining debt.' }, { status: 400 });
    }

    // Verify active cash session for payout
    const activeSession = await getActiveCashSession(prisma, shopId, userId);
    if (!activeSession) {
      return NextResponse.json(
        { error: 'Open a register session before recording debt payment payout.' },
        { status: 409 }
      );
    }

    const updatedDebt = await prisma.$transaction(async (tx) => {
      const nextPaid = Number(debt.paidAmount) + payVal;
      const nextRemaining = currentRemaining - payVal;
      const isSettled = nextRemaining <= 0;

      const record = await tx.dealerDebt.update({
        where: { id },
        data: {
          paidAmount: nextPaid,
          remainingDebt: nextRemaining,
          isSettled
        }
      });

      // Record cash payout movement in the active session
      let movementNote = `سداد مديونية تاجر (${debt.supplier.name}) - كود ${debt.dealerCode}`;
      let dbDrawer = 'CASH';
      if (drawerType === 'INSTAPAY') {
        movementNote += ' (InstaPay)';
        dbDrawer = 'INSTAPAY';
      } else if (drawerType === 'WALLET') {
        movementNote += ' (Wallet)';
        dbDrawer = 'WALLET';
      } else if (drawerType === 'VISA') {
        movementNote += ' (Visa)';
        dbDrawer = 'VISA';
      }

      await tx.cashMovement.create({
        data: {
          shopId,
          cashSessionId: activeSession.id,
          type: 'PAYOUT',
          amount: payVal,
          note: movementNote,
          drawer: dbDrawer,
          createdByUserId: userId
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'DEALER_DEBT_PAID',
        entityType: 'DealerDebt',
        entityId: record.id,
        description: `Paid ${payVal} towards debt to dealer ${debt.supplier.name}. Remaining: ${nextRemaining}.`
      });

      return record;
    });

    return NextResponse.json({ success: true, debt: updatedDebt });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to update dealer debt payment.');
  }
}
