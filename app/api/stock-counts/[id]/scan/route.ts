import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { shopId, userId, role } = await requireRole('CASHIER');
    const { barcode } = await request.json();

    if (!barcode || typeof barcode !== 'string') {
      return NextResponse.json({ error: 'Barcode is required.' }, { status: 400 });
    }

    const stockCount = await prisma.stockCount.findFirst({
      where: { id, shopId }
    });

    if (!stockCount) {
      return NextResponse.json({ error: 'Stock count not found.' }, { status: 404 });
    }

    if (!['DRAFT', 'IN_PROGRESS'].includes(stockCount.status)) {
      return NextResponse.json({ error: 'Stock count is no longer editable.' }, { status: 400 });
    }

    let assignee = await prisma.stockCountAssignee.findFirst({
      where: {
        stockCountId: id,
        userId
      }
    });

    if (!assignee) {
      const isManagerOrAdmin = role === 'MANAGER' || role === 'ADMIN';
      const isCreator = stockCount.createdByUserId === userId;

      if (isCreator || isManagerOrAdmin) {
        assignee = await prisma.stockCountAssignee.create({
          data: {
            stockCountId: id,
            userId
          }
        });
      } else {
        return NextResponse.json({ error: 'You do not have access to edit this stock count.' }, { status: 403 });
      }
    }

    if (assignee.completedAt) {
      return NextResponse.json({ error: 'You have already marked this stock count as completed.' }, { status: 400 });
    }

    // Find the product
    const product = await prisma.product.findFirst({
      where: {
        shopId,
        isActive: true,
        OR: [
          { barcode: barcode.trim() },
          { sku: barcode.trim() }
        ]
      }
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    // Check if the item is already in the count
    let item = await prisma.stockCountItem.findFirst({
      where: {
        stockCountId: id,
        productId: product.id
      }
    });

    if (!item) {
      item = await prisma.stockCountItem.create({
        data: {
          stockCountId: id,
          productId: product.id,
          productNameSnapshot: product.name,
          skuSnapshot: product.sku,
          expectedQty: product.stockQty,
          actualQty: null,
          varianceQty: 0
        }
      });
    }

    const userEntry = await prisma.stockCountUserEntry.upsert({
      where: {
        stockCountAssigneeId_productId: {
          stockCountAssigneeId: assignee.id,
          productId: product.id
        }
      },
      update: {
        actualQty: { increment: 1 }
      },
      create: {
        stockCountId: id,
        productId: product.id,
        stockCountAssigneeId: assignee.id,
        actualQty: 1
      }
    });

    const allUserEntries = await prisma.stockCountUserEntry.findMany({
      where: { stockCountId: id, productId: product.id }
    });
    const totalActual = allUserEntries.reduce((sum, entry) => sum + entry.actualQty, 0);

    const updatedItem = await prisma.stockCountItem.update({
      where: { id: item.id },
      data: {
        actualQty: totalActual,
        varianceQty: totalActual - item.expectedQty
      }
    });

    // Update stock count status if needed
    await prisma.stockCount.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: stockCount.startedAt ?? new Date()
      }
    });

    return NextResponse.json({
      success: true,
      item: {
        id: updatedItem.id,
        productId: updatedItem.productId,
        productNameSnapshot: updatedItem.productNameSnapshot,
        skuSnapshot: updatedItem.skuSnapshot,
        expectedQty: updatedItem.expectedQty,
        actualQty: userEntry.actualQty,
        varianceQty: userEntry.actualQty - updatedItem.expectedQty
      }
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to process barcode scan.');
  }
}
