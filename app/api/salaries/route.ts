import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { getActiveCashSession, buildCashSessionSummary } from '@/lib/register';
import { ExpenseCategory } from '@prisma/client';

export async function GET() {
  try {
    const { shopId } = await requirePermission('MANAGE_STAFF', 'MANAGER');

    // Get all user shops (membership logs) in this branch
    const staffMembers = await prisma.userShop.findMany({
      where: {
        shopId,
        isActive: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        role: 'asc'
      }
    });

    const paymentHistory = await prisma.salaryPayment.findMany({
      where: {
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
      },
      orderBy: {
        paidAt: 'desc'
      }
    });

    return NextResponse.json({
      staff: staffMembers.map((sm) => ({
        id: sm.id,
        userId: sm.userId,
        name: sm.user.name ?? sm.user.email.split('@')[0],
        email: sm.user.email,
        role: sm.role,
        baseSalary: sm.baseSalary ? sm.baseSalary.toString() : null
      })),
      history: paymentHistory.map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: p.user.name ?? p.user.email.split('@')[0],
        userEmail: p.user.email,
        amount: p.amount.toString(),
        paidAt: p.paidAt.toISOString(),
        paymentMode: p.paymentMode,
        notes: p.notes
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to retrieve salaries and payments.');
  }
}

export async function POST(request: Request) {
  try {
    const { userId: managerId, shopId } = await requirePermission('MANAGE_STAFF', 'MANAGER');
    const body = await request.json();
    const { userId: targetUserId, amount, paymentMode, notes } = body;

    if (!targetUserId || !amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid employee ID and amount are required.' }, { status: 400 });
    }

    if (!['CASH', 'INSTAPAY', 'WALLET'].includes(paymentMode)) {
      return NextResponse.json({ error: 'Invalid drawer / payment mode selected.' }, { status: 400 });
    }

    const payAmount = Number(amount);

    // Verify employee exists and is assigned to this shop
    const userShop = await prisma.userShop.findUnique({
      where: {
        userId_shopId: {
          userId: targetUserId,
          shopId
        }
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    if (!userShop || !userShop.isActive) {
      return NextResponse.json({ error: 'Employee not found or inactive in this branch.' }, { status: 404 });
    }

    // Verify active cashier session for the manager/cashier submitting the payment
    const activeSession = await getActiveCashSession(prisma, shopId, managerId);
    if (!activeSession) {
      return NextResponse.json(
        { error: 'Open a register session (drawer) before paying employee salaries.' },
        { status: 409 }
      );
    }

    // Verify drawer has enough balance
    const summary = await buildCashSessionSummary(prisma, activeSession, new Date());
    let currentBalance = 0;
    if (paymentMode === 'INSTAPAY') {
      currentBalance = summary.expectedInstaPay;
    } else if (paymentMode === 'WALLET') {
      currentBalance = summary.expectedWallet;
    } else {
      currentBalance = summary.expectedCash;
    }

    if (payAmount > currentBalance) {
      return NextResponse.json({
        error: `Insufficient drawer balance. Amount requested (${payAmount}) exceeds drawer balance (${currentBalance}).`
      }, { status: 400 });
    }

    // Process payment in transaction
    const payment = await prisma.$transaction(async (tx) => {
      // 1. Create SalaryPayment record
      const salaryPayment = await tx.salaryPayment.create({
        data: {
          shopId,
          userId: targetUserId,
          amount: payAmount,
          paymentMode,
          notes: notes || null
        }
      });

      // 2. Create BranchExpense of category SALARY
      const employeeName = userShop.user.name ?? userShop.user.email.split('@')[0];
      const expenseReason = `صرف راتب الموظف / Salary payment: ${notes || ''}`;
      
      await tx.branchExpense.create({
        data: {
          shopId,
          userId: managerId,
          category: ExpenseCategory.SALARY,
          amount: payAmount,
          reason: expenseReason,
          recipient: employeeName,
          drawer: paymentMode
        }
      });

      // 3. Create CashMovement payout to record in session register history
      const drawerLabel = paymentMode === 'INSTAPAY' ? 'انستا باي' : paymentMode === 'WALLET' ? 'محفظة' : 'كاش';
      const movementNote = `صرف راتب موظف (${drawerLabel}): ${employeeName}${notes ? ` - ${notes}` : ''}`;
      
      await tx.cashMovement.create({
        data: {
          shopId,
          cashSessionId: activeSession.id,
          type: 'PAYOUT',
          amount: payAmount,
          note: movementNote,
          createdByUserId: managerId,
          drawer: paymentMode
        }
      });

      // 4. Log the activity
      await logActivity({
        tx,
        shopId,
        userId: managerId,
        action: 'STAFF_SALARY_PAID',
        entityType: 'SalaryPayment',
        entityId: salaryPayment.id,
        description: `Paid salary of ${payAmount} via ${paymentMode} to ${employeeName}.`
      });

      return salaryPayment;
    });

    return NextResponse.json({
      ok: true,
      payment: {
        id: payment.id,
        userId: payment.userId,
        amount: payment.amount.toString(),
        paidAt: payment.paidAt.toISOString(),
        paymentMode: payment.paymentMode,
        notes: payment.notes
      }
    });

  } catch (error) {
    return apiErrorResponse(error, 'Unable to process salary payment.');
  }
}
