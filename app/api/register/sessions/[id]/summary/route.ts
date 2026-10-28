import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { buildCashSessionSummary } from '@/lib/register';
import { serializeRegisterSessionSummary } from '@/lib/serializers/register';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { shopId } = await requireRole('CASHIER');

    const cashSession = await prisma.cashSession.findFirst({
      where: {
        id,
        shopId
      }
    });

    if (!cashSession) {
      return NextResponse.json({ error: 'Register session not found.' }, { status: 404 });
    }

    const summary = await buildCashSessionSummary(prisma, cashSession);
    const serialized = serializeRegisterSessionSummary(summary);

    // Fetch branch expenses during the session's active period to match payouts
    const startOfSession = cashSession.openedAt;
    const endOfSession = cashSession.closedAt || new Date();

    const expenses = await prisma.branchExpense.findMany({
      where: {
        shopId,
        createdAt: {
          gte: startOfSession,
          lte: endOfSession
        }
      }
    });

    // Map source link for each movement/timeline item in the summary
    const movementsWithSource = serialized.movements.map((movement) => {
      let sourceLink: string | null = null;
      if (movement.type === 'PAYOUT') {
        const amt = Number(movement.amount);
        const matchingExpense = expenses.find(
          (e) =>
            Math.abs(e.createdAt.getTime() - new Date(movement.createdAt).getTime()) < 5000 &&
            Number(e.amount) === amt
        );
        if (matchingExpense) {
          sourceLink = `/expenses?search=${matchingExpense.category}`;
        } else {
          const poMatch = movement.note?.match(/PO-\d+/);
          if (poMatch) {
            sourceLink = `/purchases?search=${poMatch[0]}`;
          }
        }
      }
      return {
        ...movement,
        sourceLink
      };
    });

    const timelineWithSource = serialized.timeline.map((entry) => {
      let sourceLink: string | null = null;
      if (entry.type === 'CASH_SALE') {
        sourceLink = `/sales?search=${entry.reference}`;
      } else if (entry.type === 'REFUND') {
        sourceLink = `/sales?search=${entry.reference}`;
      } else if (entry.type === 'PAYOUT') {
        const amt = Number(entry.amount);
        const matchingExpense = expenses.find(
          (e) =>
            Math.abs(e.createdAt.getTime() - new Date(entry.occurredAt).getTime()) < 5000 &&
            Number(e.amount) === Math.abs(amt)
        );
        if (matchingExpense) {
          sourceLink = `/expenses?search=${matchingExpense.category}`;
        } else {
          const poMatch = entry.note?.match(/PO-\d+/);
          if (poMatch) {
            sourceLink = `/purchases?search=${poMatch[0]}`;
          }
        }
      }
      return {
        ...entry,
        sourceLink
      };
    });

    return NextResponse.json({
      summary: {
        ...serialized,
        movements: movementsWithSource,
        timeline: timelineWithSource
      }
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to retrieve session summary.');
  }
}
