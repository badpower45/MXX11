import AppHeader from '@/components/layout/AppHeader';
import DailyRegisterLog from '@/components/register/DailyRegisterLog';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

async function getPriorBalance(shopId: string, beforeDate: Date, drawer: 'CASH' | 'INSTAPAY' | 'WALLET' | 'VISA') {
  if (drawer === 'CASH') {
    const sumOpeningFloatObj = await prisma.cashSession.aggregate({
      where: {
        shopId,
        openedAt: { lt: beforeDate }
      },
      _sum: {
        openingFloat: true
      }
    });
    const openingFloats = Number(sumOpeningFloatObj._sum.openingFloat || 0);

    const salePaymentsObj = await prisma.salePayment.aggregate({
      where: {
        method: 'كاش',
        createdAt: { lt: beforeDate },
        sale: {
          shopId,
          status: 'COMPLETED'
        }
      },
      _sum: {
        amount: true
      }
    });
    const salesChangeObj = await prisma.sale.aggregate({
      where: {
        shopId,
        status: 'COMPLETED',
        createdAt: { lt: beforeDate }
      },
      _sum: {
        changeDue: true
      }
    });
    const changeDueSum = Number(salesChangeObj._sum.changeDue || 0);
    const salePaymentsCash = Number(salePaymentsObj._sum.amount || 0);

    const legacyCashSalesObj = await prisma.sale.aggregate({
      where: {
        shopId,
        status: 'COMPLETED',
        createdAt: { lt: beforeDate },
        paymentMethod: 'كاش',
        payments: { none: {} }
      },
      _sum: {
        totalAmount: true
      }
    });
    const legacyCashSales = Number(legacyCashSalesObj._sum.totalAmount || 0);

    const totalSalesCash = salePaymentsCash + legacyCashSales - changeDueSum;

    const refundsObj = await prisma.refundPayment.aggregate({
      where: {
        method: 'كاش',
        createdAt: { lt: beforeDate },
        saleAdjustment: {
          shopId
        }
      },
      _sum: {
        amount: true
      }
    });
    const totalRefunds = Number(refundsObj._sum.amount || 0);

    const movementsObj = await prisma.cashMovement.findMany({
      where: {
        shopId,
        createdAt: { lt: beforeDate },
        OR: [
          { drawer: 'CASH' },
          { drawer: null }
        ]
      },
      select: {
        amount: true,
        type: true
      }
    });
    let movementsSum = 0;
    for (const m of movementsObj) {
      const amt = Number(m.amount);
      const isWithdrawal = ['PAYOUT', 'CASH_DROP', 'PETTY_CASH'].includes(m.type);
      const signedAmt = isWithdrawal ? -amt : m.type === 'MANUAL_CORRECTION' ? amt : -amt;
      movementsSum += signedAmt;
    }

    return openingFloats + totalSalesCash - totalRefunds + movementsSum;
  } else if (drawer === 'INSTAPAY') {
    const salePaymentsObj = await prisma.salePayment.aggregate({
      where: {
        method: 'انستا باي',
        createdAt: { lt: beforeDate },
        sale: {
          shopId,
          status: 'COMPLETED'
        }
      },
      _sum: {
        amount: true
      }
    });
    const salePayments = Number(salePaymentsObj._sum.amount || 0);

    const legacySalesObj = await prisma.sale.aggregate({
      where: {
        shopId,
        status: 'COMPLETED',
        createdAt: { lt: beforeDate },
        paymentMethod: 'انستا باي',
        payments: { none: {} }
      },
      _sum: {
        totalAmount: true
      }
    });
    const legacySales = Number(legacySalesObj._sum.totalAmount || 0);

    const totalSales = salePayments + legacySales;

    const refundsObj = await prisma.refundPayment.aggregate({
      where: {
        method: 'انستا باي',
        createdAt: { lt: beforeDate },
        saleAdjustment: {
          shopId
        }
      },
      _sum: {
        amount: true
      }
    });
    const totalRefunds = Number(refundsObj._sum.amount || 0);

    const movementsObj = await prisma.cashMovement.findMany({
      where: {
        shopId,
        createdAt: { lt: beforeDate },
        drawer: 'INSTAPAY'
      },
      select: {
        amount: true,
        type: true
      }
    });
    let movementsSum = 0;
    for (const m of movementsObj) {
      const amt = Number(m.amount);
      const isWithdrawal = ['PAYOUT', 'CASH_DROP', 'PETTY_CASH'].includes(m.type);
      const signedAmt = isWithdrawal ? -amt : m.type === 'MANUAL_CORRECTION' ? amt : -amt;
      movementsSum += signedAmt;
    }

    return totalSales - totalRefunds + movementsSum;
  } else if (drawer === 'WALLET') {
    const salePaymentsObj = await prisma.salePayment.aggregate({
      where: {
        method: 'محفظه الكترونيه',
        createdAt: { lt: beforeDate },
        sale: {
          shopId,
          status: 'COMPLETED'
        }
      },
      _sum: {
        amount: true
      }
    });
    const salePayments = Number(salePaymentsObj._sum.amount || 0);

    const legacySalesObj = await prisma.sale.aggregate({
      where: {
        shopId,
        status: 'COMPLETED',
        createdAt: { lt: beforeDate },
        paymentMethod: 'محفظه الكترونيه',
        payments: { none: {} }
      },
      _sum: {
        totalAmount: true
      }
    });
    const legacySales = Number(legacySalesObj._sum.totalAmount || 0);

    const totalSales = salePayments + legacySales;

    const refundsObj = await prisma.refundPayment.aggregate({
      where: {
        method: 'محفظه الكترونيه',
        createdAt: { lt: beforeDate },
        saleAdjustment: {
          shopId
        }
      },
      _sum: {
        amount: true
      }
    });
    const totalRefunds = Number(refundsObj._sum.amount || 0);

    const movementsObj = await prisma.cashMovement.findMany({
      where: {
        shopId,
        createdAt: { lt: beforeDate },
        drawer: 'WALLET'
      },
      select: {
        amount: true,
        type: true
      }
    });
    let movementsSum = 0;
    for (const m of movementsObj) {
      const amt = Number(m.amount);
      const isWithdrawal = ['PAYOUT', 'CASH_DROP', 'PETTY_CASH'].includes(m.type);
      const signedAmt = isWithdrawal ? -amt : m.type === 'MANUAL_CORRECTION' ? amt : -amt;
      movementsSum += signedAmt;
    }

    return totalSales - totalRefunds + movementsSum;
  } else if (drawer === 'VISA') {
    const salePaymentsObj = await prisma.salePayment.findMany({
      where: {
        method: { in: ['فيزا', 'Visa', 'VISA'] },
        createdAt: { lt: beforeDate },
        sale: {
          shopId,
          status: 'COMPLETED'
        }
      },
      select: {
        amount: true
      }
    });
    const salePayments = salePaymentsObj.reduce((sum, p) => sum + Number(p.amount), 0);

    const legacySalesObj = await prisma.sale.aggregate({
      where: {
        shopId,
        status: 'COMPLETED',
        createdAt: { lt: beforeDate },
        paymentMethod: { in: ['فيزا', 'Visa', 'VISA'] },
        payments: { none: {} }
      },
      _sum: {
        totalAmount: true
      }
    });
    const legacySales = Number(legacySalesObj._sum.totalAmount || 0);

    const totalSales = salePayments + legacySales;

    const refundsObj = await prisma.refundPayment.aggregate({
      where: {
        method: { in: ['فيزا', 'Visa', 'VISA'] },
        createdAt: { lt: beforeDate },
        saleAdjustment: {
          shopId
        }
      },
      _sum: {
        amount: true
      }
    });
    const totalRefunds = Number(refundsObj._sum.amount || 0);

    const movementsObj = await prisma.cashMovement.findMany({
      where: {
        shopId,
        createdAt: { lt: beforeDate },
        drawer: 'VISA'
      },
      select: {
        amount: true,
        type: true
      }
    });
    let movementsSum = 0;
    for (const m of movementsObj) {
      const amt = Number(m.amount);
      const isWithdrawal = ['PAYOUT', 'CASH_DROP', 'PETTY_CASH'].includes(m.type);
      const signedAmt = isWithdrawal ? -amt : m.type === 'MANUAL_CORRECTION' ? amt : -amt;
      movementsSum += signedAmt;
    }

    return totalSales - totalRefunds + movementsSum;
  }
  return 0;
}

export default async function DailyRegisterPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  const { shopId, userId } = await requirePageRole('CASHIER');

  // Query the active cash session for the current user to allow transfers
  const activeSession = await prisma.cashSession.findFirst({
    where: {
      shopId,
      userId,
      status: 'OPEN'
    }
  });

  // Default to today in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];
  const targetDateStr = date || todayStr;
  const targetDate = new Date(targetDateStr);

  const start = new Date(targetDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(targetDate);
  end.setHours(23, 59, 59, 999);

  // Query Cash Sessions opened on that day (to get opening float events)
  const cashSessions = await prisma.cashSession.findMany({
    where: {
      shopId,
      openedAt: { gte: start, lte: end }
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

  // Query Sales on that day
  const sales = await prisma.sale.findMany({
    where: {
      shopId,
      status: 'COMPLETED',
      createdAt: { gte: start, lte: end }
    },
    include: {
      payments: {
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  // Query Refunds on that day
  const refunds = await prisma.refundPayment.findMany({
    where: {
      saleAdjustment: {
        shopId,
        createdAt: { gte: start, lte: end }
      }
    },
    include: {
      saleAdjustment: {
        include: {
          createdByUser: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  // Query Cash Movements on that day
  const movements = await prisma.cashMovement.findMany({
    where: {
      shopId,
      createdAt: { gte: start, lte: end }
    },
    include: {
      createdByUser: {
        select: {
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  });

  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  const currencySymbol = settings?.currencySymbol ?? 'ج.م ';

  // 1. Map Cash Sessions (Opening Float)
  const cashOpeningEvents = cashSessions.map((session) => ({
    id: `session-open-${session.id}`,
    time: session.openedAt.toISOString(),
    type: 'OPENING_FLOAT',
    label: locale === 'ar' ? 'رصيد افتتاحي للوردية' : 'Shift Opening Float',
    details: `${locale === 'ar' ? 'كاشير:' : 'Cashier:'} ${session.user.name || session.user.email}`,
    amount: Number(session.openingFloat),
    cashierName: session.user.name || session.user.email,
    sourceLink: null
  }));

  // 2. Map Sales
  const salesEvents: any[] = [];
  const instapaySalesEvents: any[] = [];
  const walletSalesEvents: any[] = [];
  const visaSalesEvents: any[] = [];

  for (const sale of sales) {
    const cashier = sale.cashierName || 'System';
    const saleNum = sale.saleNumber;
    const clientName = sale.customerName ? ` (${sale.customerName})` : '';

    if (sale.payments.length > 0) {
      for (const p of sale.payments) {
        const amt = Number(p.amount);
        if (p.method === 'كاش') {
          // Subtract change due from cash payment
          const netCash = amt - Number(sale.changeDue);
          if (netCash > 0) {
            salesEvents.push({
              id: `sale-payment-${p.id}`,
              time: sale.createdAt.toISOString(),
              type: 'SALE',
              label: locale === 'ar' ? 'مبيعات كاش' : 'Cash Sale',
              details: `${saleNum}${clientName}`,
              amount: netCash,
              cashierName: cashier,
              sourceLink: `/sales?search=${saleNum}`
            });
          }
        } else if (p.method === 'انستا باي') {
          instapaySalesEvents.push({
            id: `sale-payment-${p.id}`,
            time: sale.createdAt.toISOString(),
            type: 'SALE',
            label: locale === 'ar' ? 'مبيعات انستا باي' : 'InstaPay Sale',
            details: `${saleNum}${clientName}`,
            amount: amt,
            cashierName: cashier,
            sourceLink: `/sales?search=${saleNum}`
          });
        } else if (p.method === 'محفظه الكترونيه') {
          walletSalesEvents.push({
            id: `sale-payment-${p.id}`,
            time: sale.createdAt.toISOString(),
            type: 'SALE',
            label: locale === 'ar' ? 'مبيعات محفظة إلكترونية' : 'Wallet Sale',
            details: `${saleNum}${clientName}`,
            amount: amt,
            cashierName: cashier,
            sourceLink: `/sales?search=${saleNum}`
          });
        } else if (p.method === 'فيزا' || p.method === 'Visa' || p.method === 'VISA') {
          visaSalesEvents.push({
            id: `sale-payment-${p.id}`,
            time: sale.createdAt.toISOString(),
            type: 'SALE',
            label: locale === 'ar' ? 'مبيعات فيزا' : 'Visa Sale',
            details: `${saleNum}${clientName}`,
            amount: amt,
            cashierName: cashier,
            sourceLink: `/sales?search=${saleNum}`
          });
        }
      }
    } else {
      const amt = Number(sale.totalAmount);
      if (sale.paymentMethod === 'كاش') {
        const netCash = amt - Number(sale.changeDue);
        if (netCash > 0) {
          salesEvents.push({
            id: `sale-${sale.id}`,
            time: sale.createdAt.toISOString(),
            type: 'SALE',
            label: locale === 'ar' ? 'مبيعات كاش' : 'Cash Sale',
            details: `${saleNum}${clientName}`,
            amount: netCash,
            cashierName: cashier,
            sourceLink: `/sales?search=${saleNum}`
          });
        }
      } else if (sale.paymentMethod === 'انستا باي') {
        instapaySalesEvents.push({
          id: `sale-${sale.id}`,
          time: sale.createdAt.toISOString(),
          type: 'SALE',
          label: locale === 'ar' ? 'مبيعات انستا باي' : 'InstaPay Sale',
          details: `${saleNum}${clientName}`,
          amount: amt,
          cashierName: cashier,
          sourceLink: `/sales?search=${saleNum}`
        });
      } else if (sale.paymentMethod === 'محفظه الكترونيه') {
        walletSalesEvents.push({
          id: `sale-${sale.id}`,
          time: sale.createdAt.toISOString(),
          type: 'SALE',
          label: locale === 'ar' ? 'مبيعات محفظة إلكترونية' : 'Wallet Sale',
          details: `${saleNum}${clientName}`,
          amount: amt,
          cashierName: cashier,
          sourceLink: `/sales?search=${saleNum}`
        });
      } else if (sale.paymentMethod === 'فيزا' || sale.paymentMethod === 'Visa' || sale.paymentMethod === 'VISA') {
        visaSalesEvents.push({
          id: `sale-${sale.id}`,
          time: sale.createdAt.toISOString(),
          type: 'SALE',
          label: locale === 'ar' ? 'مبيعات فيزا' : 'Visa Sale',
          details: `${saleNum}${clientName}`,
          amount: amt,
          cashierName: cashier,
          sourceLink: `/sales?search=${saleNum}`
        });
      }
    }
  }

  // 3. Map Refunds
  const cashRefundsEvents: any[] = [];
  const instapayRefundsEvents: any[] = [];
  const walletRefundsEvents: any[] = [];

  for (const r of refunds) {
    const amt = Number(r.amount);
    const cashier = r.saleAdjustment.createdByUser?.name || r.saleAdjustment.createdByUser?.email || 'System';
    const adjNum = r.saleAdjustment.adjustmentNumber;
    const refDetails = `${locale === 'ar' ? 'مرتجع فاتورة:' : 'Invoice Refund:'} ${adjNum}`;

    const event = {
      id: `refund-${r.id}`,
      time: r.createdAt.toISOString(),
      type: 'REFUND',
      label: locale === 'ar' ? `مرتجع ${r.method}` : `${r.method} Refund`,
      details: refDetails,
      amount: -amt,
      cashierName: cashier,
      sourceLink: `/sales?search=${adjNum}`
    };

    if (r.method === 'كاش') {
      cashRefundsEvents.push(event);
    } else if (r.method === 'انستا باي') {
      instapayRefundsEvents.push(event);
    } else if (r.method === 'محفظه الكترونيه') {
      walletRefundsEvents.push(event);
    }
  }

  // 4. Map Cash Movements
  const cashMovementsEvents: any[] = [];
  const instapayMovementsEvents: any[] = [];
  const walletMovementsEvents: any[] = [];
  const visaMovementsEvents: any[] = [];

  // Fetch branch expenses and dealer purchases to link source links
  const [expenses, purchases] = await Promise.all([
    prisma.branchExpense.findMany({
      where: {
        shopId,
        createdAt: { gte: start, lte: end }
      }
    }),
    prisma.purchaseOrder.findMany({
      where: {
        shopId,
        createdAt: { gte: start, lte: end }
      }
    })
  ]);

  for (const m of movements) {
    const amt = Number(m.amount);
    const isWithdrawal = ['PAYOUT', 'CASH_DROP', 'PETTY_CASH'].includes(m.type);
    const signedAmt = isWithdrawal ? -amt : m.type === 'MANUAL_CORRECTION' ? amt : -amt;

    let resolvedLink: string | null = null;
    if (m.type === 'PAYOUT') {
      // Check if it matches an expense
      const matchingExpense = expenses.find(
        (e) => Math.abs(e.createdAt.getTime() - m.createdAt.getTime()) < 5000 && Number(e.amount) === amt
      );
      if (matchingExpense) {
        resolvedLink = `/expenses?search=${matchingExpense.category}`;
      } else {
        // Check if it matches a purchase order note
        const poMatch = m.note?.match(/PO-\d+/);
        if (poMatch) {
          resolvedLink = `/purchases?search=${poMatch[0]}`;
        }
      }
    }

    const drawerType = m.drawer || 'CASH';
    const isTransfer = m.note?.includes('تحويل رصيد') || m.note?.includes('Transferred');
    const movementEvent = {
      id: `movement-${m.id}`,
      time: m.createdAt.toISOString(),
      type: m.type,
      label: locale === 'ar'
        ? isTransfer
          ? (m.type === 'PAYOUT' ? 'تحويل صادر' : 'تحويل وارد')
          : `${m.type === 'PAYOUT' ? 'صرف نقدية / مصروف' : m.type === 'CASH_DROP' ? 'سحب للبنك' : m.type === 'PETTY_CASH' ? 'عهدة نقدية' : 'تعديل رصيد'}`
        : isTransfer
          ? (m.type === 'PAYOUT' ? 'Transfer Out' : 'Transfer In')
          : `${m.type === 'PAYOUT' ? 'Payout' : m.type === 'CASH_DROP' ? 'Cash Drop' : m.type === 'PETTY_CASH' ? 'Petty Cash' : 'Correction'}`,
      details: m.note || '',
      amount: signedAmt,
      cashierName: m.createdByUser.name || m.createdByUser.email,
      sourceLink: resolvedLink
    };

    if (drawerType === 'INSTAPAY') {
      instapayMovementsEvents.push(movementEvent);
    } else if (drawerType === 'WALLET') {
      walletMovementsEvents.push(movementEvent);
    } else if (drawerType === 'VISA') {
      visaMovementsEvents.push(movementEvent);
    } else {
      cashMovementsEvents.push(movementEvent);
    }
  }

  // Combine and sort events
  const cashEvents = [...cashOpeningEvents, ...salesEvents, ...cashRefundsEvents, ...cashMovementsEvents].sort(
    (left, right) => new Date(left.time).getTime() - new Date(right.time).getTime()
  );

  const instapayEvents = [...instapaySalesEvents, ...instapayRefundsEvents, ...instapayMovementsEvents].sort(
    (left, right) => new Date(left.time).getTime() - new Date(right.time).getTime()
  );

  const walletEvents = [...walletSalesEvents, ...walletRefundsEvents, ...walletMovementsEvents].sort(
    (left, right) => new Date(left.time).getTime() - new Date(right.time).getTime()
  );

  const visaEvents = [...visaSalesEvents, ...visaMovementsEvents].sort(
    (left, right) => new Date(left.time).getTime() - new Date(right.time).getTime()
  );

  const [priorCash, priorInstapay, priorWallet, priorVisa] = await Promise.all([
    getPriorBalance(shopId, start, 'CASH'),
    getPriorBalance(shopId, start, 'INSTAPAY'),
    getPriorBalance(shopId, start, 'WALLET'),
    getPriorBalance(shopId, start, 'VISA')
  ]);

  const initialBalances = {
    CASH: priorCash,
    INSTAPAY: priorInstapay,
    WALLET: priorWallet,
    VISA: priorVisa
  };

  return (
    <div className="space-y-6">
      <AppHeader
        title={locale === 'ar' ? 'السجل اليومي للدرج' : 'Daily Drawer Log'}
        subtitle={
          locale === 'ar'
             ? 'متابعة حركة درج الكاش ومحفظة التاجر وانستا باي بالتفصيل يوم بيوم.'
            : 'Track the daily movements of cash, wallet, and InstaPay drawers in detail.'
        }
      />
      <DailyRegisterLog
        selectedDate={targetDateStr}
        cashEvents={cashEvents}
        instapayEvents={instapayEvents}
        walletEvents={walletEvents}
        visaEvents={visaEvents}
        initialBalances={initialBalances}
        currencySymbol={currencySymbol}
        locale={locale}
        activeSessionId={activeSession?.id}
      />
    </div>
  );
}
