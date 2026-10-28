import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { cashSessionCloseSchema } from '@/lib/auth/validation';
import {
  appendRegisterNotes,
  calculateDenominationTotal,
  computeClosingExpectedCash,
  normalizeDenominationSnapshot,
  buildCashSessionSummary
} from '@/lib/register';
import { prisma } from '@/lib/prisma';
import { serializeCashSession } from '@/lib/serializers/register';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { shopId, userId, role, session } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = cashSessionCloseSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid register closing payload.' },
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
        },
        closedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        reopenedByUser: {
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
      return NextResponse.json({ error: 'This register session is already closed.' }, { status: 409 });
    }

    const isOwnSession = cashSession.userId === userId;
    const canOverride = role === 'MANAGER' || role === 'ADMIN';
    const closeNotes = parsed.data.notes?.trim() ?? '';

    if (!isOwnSession && !canOverride) {
      return NextResponse.json(
        { error: "Only a manager or admin can close another cashier's session." },
        { status: 403 }
      );
    }

    if (!isOwnSession && canOverride && !closeNotes) {
      return NextResponse.json(
        { error: 'Manager override close requires notes.' },
        { status: 400 }
      );
    }

    const closedAt = new Date();
    const denominationBreakdown = normalizeDenominationSnapshot(parsed.data.denominationBreakdown);
    
    const closingActualCash = parsed.data.denominationBreakdown
      ? calculateDenominationTotal(denominationBreakdown)
      : (parsed.data.closingActualCash ?? parsed.data.closingActual ?? 0);
    const closingActualInstaPay = parsed.data.closingActualInstaPay ?? 0;
    const closingActualWallet = parsed.data.closingActualWallet ?? 0;

    const closedSession = await prisma.$transaction(async (tx) => {
      const summary = await buildCashSessionSummary(tx, cashSession, closedAt);
      const expectedCash = summary.expectedCash;
      const expectedInstaPay = summary.expectedInstaPay;
      const expectedWallet = summary.expectedWallet;

      const variance = closingActualCash - expectedCash;
      const status = !isOwnSession && canOverride ? 'OVERRIDE_CLOSED' : 'CLOSED';

      const updatedSession = await tx.cashSession.update({
        where: { id: cashSession.id },
        data: {
          closedAt,
          closedByUserId: userId,
          closingExpected: expectedCash,
          closingActual: closingActualCash,
          variance,
          denominationBreakdown,
          closingExpectedCash: expectedCash,
          closingActualCash,
          closingExpectedInstaPay: expectedInstaPay,
          closingActualInstaPay,
          closingExpectedWallet: expectedWallet,
          closingActualWallet,
          reviewedByUserId: null,
          reviewedAt: null,
          reviewNote: null,
          notes: appendRegisterNotes(cashSession.notes, closeNotes || null),
          status
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          closedByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reviewedByUser: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reopenedByUser: {
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
        action: status === 'OVERRIDE_CLOSED' ? 'REGISTER_OVERRIDE_CLOSED' : 'REGISTER_CLOSED',
        entityType: 'CashSession',
        entityId: updatedSession.id,
        description:
          status === 'OVERRIDE_CLOSED'
            ? `Override-closed register session for ${cashSession.user?.name ?? cashSession.user?.email ?? 'cashier'}.`
            : `Closed register session for ${session.user.name ?? session.user.email ?? 'cashier'}.`,
        metadata: {
          cashierUserId: cashSession.userId,
          closingExpected: expectedCash,
          closingActual: closingActualCash,
          variance,
          denominationBreakdown,
          closingExpectedCash: expectedCash,
          closingActualCash,
          closingExpectedInstaPay: expectedInstaPay,
          closingActualInstaPay,
          closingExpectedWallet: expectedWallet,
          closingActualWallet
        }
      });

      return updatedSession;
    });

    return NextResponse.json({ session: serializeCashSession(closedSession) });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to close register session.');
  }
}
