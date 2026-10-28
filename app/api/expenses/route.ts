import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { getActiveCashSession, buildCashSessionSummary } from '@/lib/register';
import { ExpenseCategory, DocumentSequenceType, ShopType } from '@prisma/client';
import { getNextDocumentNumber } from '@/lib/document-sequence';

export async function GET() {
  try {
    const { shopId } = await requireRole('CASHIER');

    const expenses = await prisma.branchExpense.findMany({
      where: { shopId },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      expenses: expenses.map((e) => ({
        ...e,
        amount: e.amount.toString(),
        createdAt: e.createdAt.toISOString()
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to retrieve branch expenses.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId, session } = await requireRole('CASHIER');
    const body = await request.json();
    const { category, amount, reason, recipient, fromBranchId, drawer: reqDrawer } = body;
    const drawer = reqDrawer || 'CASH';

    if (!category || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid category and amount are required.' }, { status: 400 });
    }

    if (!Object.values(ExpenseCategory).includes(category)) {
      return NextResponse.json({ error: 'Invalid expense category.' }, { status: 400 });
    }

    if (!['CASH', 'INSTAPAY', 'WALLET'].includes(drawer)) {
      return NextResponse.json({ error: 'Invalid drawer selected.' }, { status: 400 });
    }

    const expenseAmount = Number(amount);

    const activeSession = await getActiveCashSession(prisma, shopId, userId);
    if (!activeSession) {
      return NextResponse.json(
        { error: 'Open a register session before recording branch expenses.' },
        { status: 409 }
      );
    }

    // Verify drawer has enough balance
    const summary = await buildCashSessionSummary(prisma, activeSession, new Date());
    let currentBalance = 0;
    if (drawer === 'INSTAPAY') {
      currentBalance = summary.expectedInstaPay;
    } else if (drawer === 'WALLET') {
      currentBalance = summary.expectedWallet;
    } else {
      currentBalance = summary.expectedCash;
    }

    if (expenseAmount > currentBalance) {
      return NextResponse.json({
        error: `المبلغ المطلوب (${expenseAmount}) يتخطى الرصيد الحالي للدرج المحدد (${currentBalance}) / The requested amount (${expenseAmount}) exceeds the current balance of the selected drawer (${currentBalance}).`
      }, { status: 400 });
    }

    if (fromBranchId) {
      const targetShop = await prisma.shop.findFirst({
        where: { id: fromBranchId, posType: ShopType.SPARE_PARTS_ONLY }
      });
      if (!targetShop) {
        return NextResponse.json({ error: 'Invalid target branch selected.' }, { status: 400 });
      }
    }

    const expense = await prisma.$transaction(async (tx) => {
      const record = await tx.branchExpense.create({
        data: {
          shopId,
          userId,
          category: category as ExpenseCategory,
          amount: expenseAmount,
          reason: reason || null,
          recipient: recipient || null,
          drawer
        }
      });

      let drawerLabel = drawer === 'INSTAPAY' ? 'انستا باي' : drawer === 'WALLET' ? 'محفظة' : 'كاش';
      let movementNote = `مصروفات فرعية (${drawerLabel}): ${category}`;
      if (reason) movementNote += ` - ${reason}`;
      if (recipient) movementNote += ` (إلى: ${recipient})`;
      if (fromBranchId) {
        const targetShopName = await tx.shop.findUnique({
          where: { id: fromBranchId },
          select: { name: true }
        });
        movementNote += ` (شراء من فرع: ${targetShopName?.name || fromBranchId})`;
      }

      await tx.cashMovement.create({
        data: {
          shopId,
          cashSessionId: activeSession.id,
          type: 'PAYOUT',
          amount: expenseAmount,
          note: movementNote,
          createdByUserId: userId,
          drawer
        }
      });

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'BRANCH_EXPENSE_RECORDED',
        entityType: 'BranchExpense',
        entityId: record.id,
        description: `Recorded branch expense of ${expenseAmount} under ${category}. Reason: ${reason ?? 'none'}.`
      });

      // Handle inter-branch sale creation in SPARE_PARTS_ONLY shop
      if (fromBranchId) {
        // Find or create default category in the target Spare Parts shop
        let targetCategory = await tx.category.findFirst({
          where: { shopId: fromBranchId }
        });
        if (!targetCategory) {
          targetCategory = await tx.category.create({
            data: {
              shopId: fromBranchId,
              name: 'عام',
              slug: 'general'
            }
          });
        }

        // Get base unit of measure for the target Spare Parts shop
        const uom = await tx.unitOfMeasure.findFirst({
          where: { shopId: fromBranchId, isBase: true }
        });
        if (!uom) {
          throw new Error('Base unit of measure not found in target branch.');
        }

        // Find or create generic product in the target Spare Parts shop
        let genericProduct = await tx.product.findFirst({
          where: { shopId: fromBranchId, sku: 'GENERIC-TRANSFER' }
        });
        if (!genericProduct) {
          genericProduct = await tx.product.create({
            data: {
              shopId: fromBranchId,
              categoryId: targetCategory.id,
              baseUnitOfMeasureId: uom.id,
              sku: 'GENERIC-TRANSFER',
              barcode: '9999999999999',
              name: 'توريد قطع غيار لفرع المكن',
              description: 'حركة بيع مسجلة تلقائياً من مصروفات فرع الموتوسيكلات والقطع',
              cost: 0,
              price: 0,
              stockQty: 999999,
              productType: 'SPARE_PART'
            }
          });
        }

        // Generate sale and receipt numbers for the target shop
        const saleNumber = await getNextDocumentNumber(tx, {
          shopId: fromBranchId,
          type: DocumentSequenceType.SALE,
          prefix: 'SAL'
        });
        const receiptNumber = await getNextDocumentNumber(tx, {
          shopId: fromBranchId,
          type: DocumentSequenceType.RECEIPT,
          prefix: 'RCP'
        });

        const activeShop = await tx.shop.findUnique({
          where: { id: shopId },
          select: { name: true }
        });

        // Create the Sale
        const targetSale = await tx.sale.create({
          data: {
            shopId: fromBranchId,
            saleNumber,
            receiptNumber,
            customerName: `فرع الموتوسيكلات: ${activeShop?.name || shopId}`,
            subtotal: expenseAmount,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: expenseAmount,
            changeDue: 0,
            paymentMethod: 'كاش',
            notes: `توريد قطع غيار تلقائي مقابل مصروفات فرع الموتوسيكلات (مستند رقم ${record.id})`,
            items: {
              create: [
                {
                  productId: genericProduct.id,
                  productName: genericProduct.name,
                  qty: 1,
                  unitPrice: expenseAmount,
                  lineTotal: expenseAmount
                }
              ]
            },
            payments: {
              create: [
                {
                  method: 'كاش',
                  amount: expenseAmount
                }
              ]
            }
          }
        });

        await logActivity({
          tx,
          shopId: fromBranchId,
          userId,
          action: 'SALE_COMPLETED',
          entityType: 'Sale',
          entityId: targetSale.id,
          description: `Automatic inter-branch sale recorded for ${activeShop?.name || shopId} of amount ${expenseAmount}.`
        });
      }

      return record;
    });

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to record branch expense.');
  }
}

