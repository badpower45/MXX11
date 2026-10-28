import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { getActiveCashSession } from '@/lib/register';
import { PaymentDrawerType } from '@prisma/client';

export async function GET() {
  try {
    const { shopId } = await requireRole('CASHIER');

    const [installmentDues, reservations] = await Promise.all([
      prisma.installmentCompanyDue.findMany({
        where: { shopId },
        orderBy: { dueDate: 'asc' }
      }),
      prisma.reservation.findMany({
        where: { shopId },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return NextResponse.json({
      installmentDues: installmentDues.map((due) => ({
        ...due,
        pullAmount: due.pullAmount.toString(),
        saleAmount: due.saleAmount.toString(),
        adminFees: due.adminFees.toString(),
        dueAmount: due.dueAmount.toString(),
        pullDate: due.pullDate.toISOString(),
        saleDate: due.saleDate.toISOString(),
        dueDate: due.dueDate.toISOString(),
        collectedAt: due.collectedAt?.toISOString() ?? null
      })),
      reservations: reservations.map((res) => ({
        ...res,
        depositAmount: res.depositAmount.toString(),
        remainingAmount: res.remainingAmount.toString(),
        totalAmount: res.totalAmount.toString(),
        createdAt: res.createdAt.toISOString(),
        completedAt: res.completedAt?.toISOString() ?? null
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to retrieve dues and reservations.');
  }
}

export async function PATCH(request: Request) {
  try {
    const { shopId, userId } = await requireRole('CASHIER');
    const body = await request.json();
    const { id, type, drawerType } = body; // type is 'INSTALLMENT' or 'RESERVATION', drawerType is CASH, INSTAPAY, WALLET

    if (!id || !type) {
      return NextResponse.json({ error: 'ID and type are required.' }, { status: 400 });
    }

    if (type === 'INSTALLMENT') {
      const due = await prisma.installmentCompanyDue.findFirst({
        where: { id, shopId }
      });

      if (!due) {
        return NextResponse.json({ error: 'Installment due record not found.' }, { status: 404 });
      }

      if (due.isCollected) {
        return NextResponse.json({ error: 'This due is already collected.' }, { status: 409 });
      }

      const updatedDue = await prisma.$transaction(async (tx) => {
        const record = await tx.installmentCompanyDue.update({
          where: { id },
          data: {
            isCollected: true,
            collectedAt: new Date()
          }
        });

        // Record cash movement if a drawer is selected
        if (drawerType) {
          const activeSession = await getActiveCashSession(tx, shopId, userId);
          if (!activeSession) {
            throw new Error('ACTIVE_SESSION_REQUIRED_FOR_COLLECTION');
          }

          let movementNote = `تحصيل مستحقات تقسيط (${record.companyName}) - عميل ${record.customerName}`;
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

          // Create cash payment to inject funds into the sub-drawer of the active session
          // We can create a CashMovement of type MANUAL_CORRECTION to increase the drawer balance
          await tx.cashMovement.create({
            data: {
              shopId,
              cashSessionId: activeSession.id,
              type: 'MANUAL_CORRECTION',
              amount: record.dueAmount,
              note: movementNote,
              drawer: dbDrawer,
              createdByUserId: userId
            }
          });
        }

        await logActivity({
          tx,
          shopId,
          userId,
          action: 'INSTALLMENT_DUE_COLLECTED',
          entityType: 'InstallmentCompanyDue',
          entityId: record.id,
          description: `Collected installment due of ${record.dueAmount} from ${record.companyName} for customer ${record.customerName}.`
        });

        return record;
      });

      return NextResponse.json({ success: true, due: updatedDue });
    } else if (type === 'RESERVATION') {
      const reservation = await prisma.reservation.findFirst({
        where: { id, shopId }
      });

      if (!reservation) {
        return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
      }

      if (reservation.isCompleted) {
        return NextResponse.json({ error: 'Reservation is already completed.' }, { status: 409 });
      }

      const updatedRes = await prisma.$transaction(async (tx) => {
        const record = await tx.reservation.update({
          where: { id },
          data: {
            isCompleted: true,
            completedAt: new Date()
          }
        });

        // Record collection of remaining amount in chosen drawer
        if (drawerType && Number(record.remainingAmount) > 0) {
          const activeSession = await getActiveCashSession(tx, shopId, userId);
          if (!activeSession) {
            throw new Error('ACTIVE_SESSION_REQUIRED_FOR_COLLECTION');
          }

          let movementNote = `تحصيل متبقي حجز مكنة - عميل ${record.customerName}`;
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
              type: 'MANUAL_CORRECTION',
              amount: record.remainingAmount,
              note: movementNote,
              drawer: dbDrawer,
              createdByUserId: userId
            }
          });
        }

        await logActivity({
          tx,
          shopId,
          userId,
          action: 'RESERVATION_COMPLETED',
          entityType: 'Reservation',
          entityId: record.id,
          description: `Completed reservation and collected ${record.remainingAmount} for customer ${record.customerName}.`
        });

        return record;
      });

      return NextResponse.json({ success: true, reservation: updatedRes });
    }

    return NextResponse.json({ error: 'Invalid due type.' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === 'ACTIVE_SESSION_REQUIRED_FOR_COLLECTION') {
      return NextResponse.json(
        { error: 'Open a register session before recording drawer collection.' },
        { status: 409 }
      );
    }
    return apiErrorResponse(error, 'Unable to update due status.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId } = await requireRole('CASHIER');
    const body = await request.json();
    const {
      customerName,
      customerPhone,
      motorcycleDetails,
      depositAmount,
      totalAmount,
      drawerType
    } = body;

    if (!customerName || !motorcycleDetails || depositAmount === undefined || !totalAmount) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const remainingAmount = Number(totalAmount) - Number(depositAmount);

    const reservation = await prisma.$transaction(async (tx) => {
      const record = await tx.reservation.create({
        data: {
          shopId,
          customerName,
          customerPhone: customerPhone || null,
          motorcycleDetails,
          depositAmount: Number(depositAmount),
          remainingAmount,
          totalAmount: Number(totalAmount),
          isCompleted: false
        }
      });

      if (Number(depositAmount) > 0 && drawerType) {
        const activeSession = await getActiveCashSession(tx, shopId, userId);
        if (!activeSession) {
          throw new Error('ACTIVE_SESSION_REQUIRED_FOR_DEPOSIT');
        }

        let movementNote = `عربون حجز مكنة - عميل ${customerName}`;
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
            type: 'MANUAL_CORRECTION',
            amount: Number(depositAmount),
            note: movementNote,
            drawer: dbDrawer,
            createdByUserId: userId
          }
        });
      }

      await logActivity({
        tx,
        shopId,
        userId,
        action: 'RESERVATION_CREATED',
        entityType: 'Reservation',
        entityId: record.id,
        description: `Created reservation for customer ${customerName} with deposit ${depositAmount} and remaining ${remainingAmount}.`
      });

      return record;
    });

    return NextResponse.json({ success: true, reservation });
  } catch (error) {
    if (error instanceof Error && error.message === 'ACTIVE_SESSION_REQUIRED_FOR_DEPOSIT') {
      return NextResponse.json(
        { error: 'Open a register session before recording drawer deposit.' },
        { status: 409 }
      );
    }
    return apiErrorResponse(error, 'Unable to create reservation.');
  }
}
