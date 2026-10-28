import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { cashMovementSchema } from '@/lib/auth/validation';
import {
  buildCashSessionSummary,
  getCashMovementLabel
} from '@/lib/register';
import { prisma } from '@/lib/prisma';
import { serializeRegisterSessionSummary } from '@/lib/serializers/register';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { shopId, userId, role } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = cashMovementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid cash movement payload.' },
        { status: 400 }
      );
    }

    const cashSession = await prisma.cashSession.findFirst({
      where: {
        id,
        shopId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!cashSession) {
      return NextResponse.json({ error: 'Register session not found.' }, { status: 404 });
    }

    if (cashSession.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'Cash movements can only be recorded on an open register session.' },
        { status: 409 }
      );
    }

    if (cashSession.userId !== userId && role === 'CASHIER') {
      return NextResponse.json(
        { error: "Only a manager or admin can post a cash movement to another cashier's shift." },
        { status: 403 }
      );
    }

    const activeSummary = await buildCashSessionSummary(prisma, cashSession, new Date());
    const drawerType = parsed.data.drawer;
    const amountToWithdraw = parsed.data.amount;

    let availableBalance = 0;
    if (drawerType === 'INSTAPAY') {
      availableBalance = activeSummary.expectedInstaPay;
    } else if (drawerType === 'WALLET') {
      availableBalance = activeSummary.expectedWallet;
    } else {
      availableBalance = activeSummary.expectedCash;
    }

    const isWithdrawal = ['PAYOUT', 'CASH_DROP', 'PETTY_CASH'].includes(parsed.data.type);
    if (isWithdrawal && amountToWithdraw > availableBalance) {
      const drawerNamesAr: Record<string, string> = {
        CASH: 'درج الكاش',
        INSTAPAY: 'درج انستا باي',
        WALLET: 'درج المحفظة'
      };
      const drawerName = drawerNamesAr[drawerType] || 'الدرج';
      return NextResponse.json(
        { error: `الرصيد غير كافٍ في ${drawerName}. الرصيد المتاح: ${availableBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          shopId,
          cashSessionId: cashSession.id,
          type: parsed.data.type,
          amount: parsed.data.amount,
          note: parsed.data.note,
          createdByUserId: userId,
          drawer: parsed.data.drawer
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'REGISTER_CASH_MOVEMENT_RECORDED',
        entityType: 'CashSession',
        entityId: cashSession.id,
        description: `Recorded ${getCashMovementLabel(parsed.data.type).toLowerCase()} on ${cashSession.user.name ?? cashSession.user.email ?? 'cashier'}'s register session.`,
        metadata: {
          cashierUserId: cashSession.userId,
          type: parsed.data.type,
          amount: parsed.data.amount,
          note: parsed.data.note,
          drawer: parsed.data.drawer
        }
      });

      const summary = await buildCashSessionSummary(tx, cashSession, new Date());

      return {
        movement,
        summary
      };
    });

    return NextResponse.json({
      movement: {
        id: result.movement.id,
        type: result.movement.type,
        amount: result.movement.amount.toString(),
        note: result.movement.note,
        drawer: result.movement.drawer ?? 'CASH',
        createdAt: result.movement.createdAt.toISOString(),
        createdByName: result.movement.createdByUser.name ?? result.movement.createdByUser.email
      },
      summary: serializeRegisterSessionSummary(result.summary)
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to record cash movement.');
  }
}
