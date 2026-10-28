import { NextResponse } from 'next/server';
import { stockCountUpdateSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import {
  saveStockCountSheet,
  serializeStockCount,
  StockCountError,
  transitionStockCount,
  stockCountInclude
} from '@/lib/stock-counts';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { shopId, userId, role } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = stockCountUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid stock count update.' },
        { status: 400 }
      );
    }

    let stockCount;
    if (parsed.data.action === 'SUBMIT_USER_COUNT') {
      const assignee = await prisma.stockCountAssignee.findFirst({
        where: { stockCountId: id, userId }
      });
      if (!assignee) {
        return NextResponse.json({ error: 'You are not assigned to this stock count.' }, { status: 403 });
      }
      await prisma.stockCountAssignee.update({
        where: { id: assignee.id },
        data: { completedAt: new Date() }
      });

      const updated = await prisma.stockCount.findUnique({
        where: { id },
        include: stockCountInclude
      });
      if (!updated) {
        return NextResponse.json({ error: 'Stock count not found.' }, { status: 404 });
      }
      stockCount = updated;
    } else if (parsed.data.action === 'SAVE') {
      stockCount = await saveStockCountSheet({
        shopId,
        stockCountId: id,
        actorUserId: userId,
        actorRole: role,
        notes: parsed.data.notes,
        items: parsed.data.items,
        assigneeUserIds: parsed.data.assigneeUserIds,
        userEntries: parsed.data.userEntries
      });
    } else {
      stockCount = await transitionStockCount({
        shopId,
        stockCountId: id,
        actorUserId: userId,
        actorRole: role,
        action: parsed.data.action as any
      });
    }

    return NextResponse.json({
      stockCount: serializeStockCount(stockCount)
    });
  } catch (error) {
    if (error instanceof StockCountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return apiErrorResponse(error, 'Unable to update stock count.');
  }
}
