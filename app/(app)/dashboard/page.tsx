import Link from 'next/link';
import DashboardStats from '@/components/dashboard/DashboardStats';
import LowStockCard from '@/components/dashboard/LowStockCard';
import OwnerAnalyticsPanel from '@/components/dashboard/OwnerAnalyticsPanel';
import RecentSalesCard from '@/components/dashboard/RecentSalesCard';
import ShipmentsSummaryCard, { type DashboardShipment } from '@/components/dashboard/ShipmentsSummaryCard';
import Card from '@/components/ui/Card';
import { getInventoryMovementTypeLabel } from '@/lib/business-labels';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { dateTime, money, shortDate } from '@/lib/format';
import { getOwnerAnalyticsData } from '@/lib/owner-analytics';
import { prisma } from '@/lib/prisma';
import {
  lowStockCardProductSelect,
  recentSaleCardSelect,
  serializeLowStockProduct,
  serializeRecentSale
} from '@/lib/serializers/dashboard';
import DailyRegisterLog from '@/components/register/DailyRegisterLog';
import { getActiveCashSession as getOpenCashSession } from '@/lib/register';
import { getServerLocale } from '@/lib/i18n/server';

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

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

export default async function DashboardPage() {
  const { shopId, shop, role, userId } = await getActiveShopContext();
  const locale = await getServerLocale();
  const isAr = locale === 'ar';

  if (role === 'STOCK_COUNTER') {
    const { redirect } = require('next/navigation');
    const { localizePath } = require('@/lib/i18n/locales');
    redirect(localizePath('/stock-counts', locale));
  }
  
  const showBackOfficeInsights = role !== 'CASHIER';
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 6);

  // Today String for Daily Log
  const todayStr = now.toISOString().split('T')[0];

  const [
    totalProducts,
    lowStockCount,
    lowStockProducts,
    recentSales,
    todaySales,
    todayRefunds,
    todaySaleCount,
    weeklySales,
    weeklyRefunds,
    pendingPurchases,
    recentMovements,
    recentSupplyOrders,
    ownerAnalytics,
    // Daily Drawer Log dependencies
    activeSession,
    cashSessions,
    sales,
    refunds,
    movements
  ] = await Promise.all([
    prisma.product.count({ where: { shopId, isActive: true } }),
    prisma.product.count({
      where: {
        shopId,
        isActive: true,
        stockQty: { lte: settings?.lowStockThreshold ?? 5 }
      }
    }),
    prisma.product.findMany({
      where: {
        shopId,
        isActive: true,
        stockQty: { lte: settings?.lowStockThreshold ?? 5 }
      },
      select: lowStockCardProductSelect,
      orderBy: [{ stockQty: 'asc' }, { name: 'asc' }],
      take: 8
    }),
    prisma.sale.findMany({
      where: { shopId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: recentSaleCardSelect
    }),
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: todayStart } },
      _sum: { totalAmount: true }
    }),
    prisma.saleAdjustment.aggregate({
      where: { shopId, createdAt: { gte: todayStart } },
      _sum: { totalAmount: true }
    }),
    prisma.sale.count({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: todayStart } }
    }),
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: weekStart } },
      _sum: { totalAmount: true }
    }),
    prisma.saleAdjustment.aggregate({
      where: { shopId, createdAt: { gte: weekStart } },
      _sum: { totalAmount: true }
    }),
    showBackOfficeInsights
      ? prisma.purchaseOrder.count({
          where: {
            shopId,
            status: { in: ['DRAFT', 'SENT', 'PARTIALLY_RECEIVED'] }
          }
        })
      : Promise.resolve(0),
    showBackOfficeInsights
      ? prisma.inventoryMovement.findMany({
          where: { shopId },
          include: {
            product: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 6
        })
      : Promise.resolve([]),
    prisma.shipSupplyOrder.findMany({
      where: { shopId },
      include: {
        items: {
          take: 3,
          select: { itemName: true, quantity: true, unit: true }
        },
        _count: {
          select: { items: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 6
    }),
    showBackOfficeInsights ? getOwnerAnalyticsData(shopId) : Promise.resolve(null),
    // Daily Drawer Log dependencies query
    getOpenCashSession(prisma, shopId, userId),
    prisma.cashSession.findMany({
      where: {
        shopId,
        openedAt: { gte: todayStart, lte: todayEnd }
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    }),
    prisma.sale.findMany({
      where: {
        shopId,
        status: 'COMPLETED',
        createdAt: { gte: todayStart, lte: todayEnd }
      },
      include: {
        payments: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.refundPayment.findMany({
      where: {
        saleAdjustment: {
          shopId,
          createdAt: { gte: todayStart, lte: todayEnd }
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
    }),
    prisma.cashMovement.findMany({
      where: {
        shopId,
        createdAt: { gte: todayStart, lte: todayEnd }
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
    })
  ]);

  const currency = settings?.currencySymbol ?? 'ج.م ';
  const dashboardShipments: DashboardShipment[] = recentSupplyOrders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    trackingNumber: order.trackingNumber,
    vesselName: order.vesselName,
    vesselImo: order.vesselImo,
    berthLocation: order.berthLocation,
    customerName: order.customerName,
    currentStage: order.currentStage,
    eta: order.eta ? order.eta.toISOString() : null,
    itemsCount: order._count.items,
    itemsPreview: order.items.map((i) => `${i.itemName} (${i.quantity} ${i.unit || ''})`)
  }));
  const todaySalesValue = Number(todaySales._sum.totalAmount ?? 0) - Number(todayRefunds._sum.totalAmount ?? 0);
  const weeklySalesValue = Number(weeklySales._sum.totalAmount ?? 0) - Number(weeklyRefunds._sum.totalAmount ?? 0);
  const averageTicket = todaySaleCount > 0 ? todaySalesValue / todaySaleCount : 0;
  const stockCoverage =
    totalProducts > 0 ? Math.max(0, Math.round(((totalProducts - lowStockCount) / totalProducts) * 100)) : 100;
  const criticalLowStockCount = lowStockProducts.filter(
    (product) => product.stockQty <= Math.max(1, Math.floor(product.reorderPoint / 2))
  ).length;

  const nextSteps = [
    totalProducts === 0
      ? {
          href: '/products',
          title: isAr ? 'أضف منتجاتك الأولى' : 'Add your first products',
          description: isAr
            ? 'تصبح شاشة البيع والبحث بالباركود وتنبيهات المخزون مفيدة بمجرد تحميل كتالوج الفرع.'
            : 'Checkout, barcode search, and inventory alerts become useful as soon as the branch catalog is loaded.'
        }
      : null,
    recentSales.length === 0
      ? {
          href: '/checkout',
          title: isAr ? 'أجرِ أول عملية بيع' : 'Make the first sale',
          description: isAr
            ? 'ابدأ بيعاً حياً لتعبئة الإيصالات وسجل المبيعات ومؤشرات الكاشير والتنبيهات اليومية.'
            : 'Run a live checkout to populate receipts, sales history, cashier metrics, and daily summary alerts.'
        }
      : null,
    showBackOfficeInsights && pendingPurchases === 0
      ? {
          href: '/purchases',
          title: isAr ? 'سجّل نشاط المورد' : 'Record supplier activity',
          description: isAr
            ? 'تساعد سجلات الشراء والاستلام في تحسين تغطية المخزون والتقييم والتوجيه عند نقص المخزون.'
            : 'Purchase and receiving records improve stock coverage, valuation, and low-stock guidance.'
        }
      : null,
    showBackOfficeInsights && (!shop.address || !settings?.receiptHeader)
      ? {
          href: '/settings',
          title: isAr ? 'أكمل إعدادات الفرع' : 'Finish branch settings',
          description: isAr
            ? 'أضف هوية الإيصال ومعلومات الاتصال والإعدادات الافتراضية للفرع لتبدو المستندات احترافية.'
            : 'Add receipt identity, contact details, and branch defaults so documents look ready for real customers.'
        }
      : null
  ].filter((step): step is { href: string; title: string; description: string } => Boolean(step));

  const allowedQuickLinks =
    role === 'CASHIER'
      ? [
          { href: '/checkout', label: isAr ? 'نقطة البيع والتوريد' : 'Start checkout' },
          { href: '/shipments', label: isAr ? 'تتبع الشحنات والنداءات' : 'Shipment Tracking' },
          { href: '/sales', label: isAr ? 'عرض فواتير التوريد' : 'View sales' }
        ]
      : [
          { href: '/checkout', label: isAr ? 'نقطة البيع والتوريد' : 'Start checkout' },
          { href: '/shipments', label: isAr ? 'نداءات وشحنات السفن' : 'Vessel Shipments' },
          { href: '/products', label: isAr ? 'مخزون المؤن والقطع' : 'Provisions & Spares' },
          { href: '/purchases', label: isAr ? 'أوامر المشتريات' : 'Purchase Orders' },
          { href: '/expenses', label: isAr ? 'مصاريف التشغيل' : 'Operating Expenses' }
        ];

  // Map Daily Drawer Log components
  const cashOpeningEvents = cashSessions.map((session) => ({
    id: `session-open-${session.id}`,
    time: session.openedAt.toISOString(),
    type: 'OPENING_FLOAT',
    label: isAr ? 'رصيد افتتاحي للوردية' : 'Shift Opening Float',
    details: `${isAr ? 'كاشير:' : 'Cashier:'} ${session.user.name || session.user.email}`,
    amount: Number(session.openingFloat),
    cashierName: session.user.name || session.user.email,
    sourceLink: null
  }));

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
          const netCash = amt - Number(sale.changeDue);
          if (netCash > 0) {
            salesEvents.push({
              id: `sale-payment-${p.id}`,
              time: sale.createdAt.toISOString(),
              type: 'SALE',
              label: isAr ? 'مبيعات كاش' : 'Cash Sale',
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
            label: isAr ? 'مبيعات انستا باي' : 'InstaPay Sale',
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
            label: isAr ? 'مبيعات محفظة إلكترونية' : 'Wallet Sale',
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
            label: isAr ? 'مبيعات فيزا' : 'Visa Sale',
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
            label: isAr ? 'مبيعات كاش' : 'Cash Sale',
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
          label: isAr ? 'مبيعات انستا باي' : 'InstaPay Sale',
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
          label: isAr ? 'مبيعات محفظة إلكترونية' : 'Wallet Sale',
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
          label: isAr ? 'مبيعات فيزا' : 'Visa Sale',
          details: `${saleNum}${clientName}`,
          amount: amt,
          cashierName: cashier,
          sourceLink: `/sales?search=${saleNum}`
        });
      }
    }
  }

  const cashRefundsEvents: any[] = [];
  const instapayRefundsEvents: any[] = [];
  const walletRefundsEvents: any[] = [];

  for (const r of refunds) {
    const amt = Number(r.amount);
    const cashier = r.saleAdjustment.createdByUser?.name || r.saleAdjustment.createdByUser?.email || 'System';
    const adjNum = r.saleAdjustment.adjustmentNumber;
    const refDetails = `${isAr ? 'مرتجع فاتورة:' : 'Invoice Refund:'} ${adjNum}`;

    const event = {
      id: `refund-${r.id}`,
      time: r.createdAt.toISOString(),
      type: 'REFUND',
      label: isAr ? `مرتجع ${r.method}` : `${r.method} Refund`,
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

  const cashMovementsEvents: any[] = [];
  const instapayMovementsEvents: any[] = [];
  const walletMovementsEvents: any[] = [];
  const visaMovementsEvents: any[] = [];

  const [expensesList, purchasesList] = await Promise.all([
    prisma.branchExpense.findMany({
      where: {
        shopId,
        createdAt: { gte: todayStart, lte: todayEnd }
      }
    }),
    prisma.purchaseOrder.findMany({
      where: {
        shopId,
        createdAt: { gte: todayStart, lte: todayEnd }
      }
    })
  ]);

  for (const m of movements) {
    const amt = Number(m.amount);
    const isWithdrawal = ['PAYOUT', 'CASH_DROP', 'PETTY_CASH'].includes(m.type);
    const signedAmt = isWithdrawal ? -amt : m.type === 'MANUAL_CORRECTION' ? amt : -amt;

    let resolvedLink: string | null = null;
    if (m.type === 'PAYOUT') {
      const matchingExpense = expensesList.find(
        (e) => Math.abs(e.createdAt.getTime() - m.createdAt.getTime()) < 5000 && Number(e.amount) === amt
      );
      if (matchingExpense) {
        resolvedLink = `/expenses?search=${matchingExpense.category}`;
      } else {
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
      label: isAr
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
    getPriorBalance(shopId, todayStart, 'CASH'),
    getPriorBalance(shopId, todayStart, 'INSTAPAY'),
    getPriorBalance(shopId, todayStart, 'WALLET'),
    getPriorBalance(shopId, todayStart, 'VISA')
  ]);

  const initialBalances = {
    CASH: priorCash,
    INSTAPAY: priorInstapay,
    WALLET: priorWallet,
    VISA: priorVisa
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[24px] sm:rounded-[34px] border border-white/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(255,255,255,0.96),rgba(239,246,255,0.92))] p-4 shadow-[0_32px_100px_-48px_rgba(28,25,23,0.34)] sm:p-6 lg:p-8">

        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.18),_transparent_58%)] lg:block" />
        <div className="absolute left-10 top-10 h-28 w-28 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div>
            <div className="inline-flex rounded-full border border-sky-200 bg-sky-50/90 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-800 shadow-sm">
              {shortDate(now)} / {isAr ? 'لوحة العمليات البحرية المباشرة' : 'Live Marine Operations'}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-[3.1rem]">
              {isAr ? 'لوحة قيادة تموين السفن والمخازن' : 'Marine Chandlery Operations Hub'}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              {isAr
                ? `أهلاً بك مجدداً. ${shop.name} جاهز لإدارة نداءات السفن، وتوريد المؤن وقطع الغيار، والرقابة على الخزن والأدراج.`
                : `Welcome back. ${shop.name} is ready for vessel calls, provisions & technical stores supply, and multi-drawer cash tracking.`}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {allowedQuickLinks.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-full border border-white/90 bg-white/92 px-5 py-3 text-sm font-semibold text-stone-900 shadow-[0_16px_32px_-24px_rgba(28,25,23,0.35)] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  {action.label}
                </Link>
              ))}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[28px] border border-white/80 bg-white/82 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{isAr ? 'متوسط الفاتورة' : 'Average ticket'}</div>
                <div className="mt-2 text-2xl font-black text-stone-950">{money(averageTicket, currency)}</div>
                <div className="mt-1 text-sm text-stone-500">{isAr ? 'بناءً على مبيعات اليوم المكتملة.' : "Based on today's completed sales."}</div>
              </div>
              <div className="rounded-[28px] border border-white/80 bg-white/82 p-4 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{isAr ? 'آخر 7 أيام' : 'Last 7 days'}</div>
                <div className="mt-2 text-2xl font-black text-stone-950">{money(weeklySalesValue, currency)}</div>
                <div className="mt-1 text-sm text-stone-500">{isAr ? 'ملخص إيرادات الأسبوع الجاري.' : 'Rolling revenue snapshot for the week.'}</div>
              </div>
              {showBackOfficeInsights ? (
                <div className="rounded-[28px] border border-white/80 bg-white/82 p-4 backdrop-blur">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{isAr ? 'مشتريات معلقة' : 'Pending purchases'}</div>
                  <div className="mt-2 text-2xl font-black text-stone-950">{pendingPurchases}</div>
                  <div className="mt-1 text-sm text-stone-500">{isAr ? 'أوامر شراء مفتوحة لا تزال قيد المعالجة.' : 'Open purchase orders still moving through sending or receiving.'}</div>
                </div>
              ) : null}
            </div>
          </div>

          <Card className="border-white/70 bg-white/88">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{isAr ? 'نبض العمليات' : 'Operations pulse'}</div>
                <h2 className="mt-2 text-xl font-black text-stone-950">{isAr ? 'ما يحتاج اهتمامك الآن' : 'What needs attention now'}</h2>
              </div>
              <div className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">{isAr ? 'مباشر' : 'Live'}</div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-[26px] bg-[linear-gradient(135deg,#0f172a,#111827,#1f2937)] p-5 text-white shadow-[0_24px_50px_-34px_rgba(15,23,42,0.8)]">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-300">{isAr ? 'مبيعات اليوم' : 'Sales today'}</div>
                <div className="mt-2 text-3xl font-black">{money(todaySalesValue, currency)}</div>
                <div className="mt-2 text-sm text-stone-300">
                  {isAr ? `${todaySaleCount} بيعة مكتملة حتى الآن.` : `${todaySaleCount} sale${todaySaleCount !== 1 ? 's' : ''} completed so far.`}
                </div>
              </div>

              <div className={`grid gap-3 ${showBackOfficeInsights ? 'sm:grid-cols-2' : 'sm:grid-cols-1'}`}>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50/90 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{isAr ? 'ضغط التخزين' : 'Restock pressure'}</div>
                  <div className="mt-2 text-2xl font-black text-stone-950">{lowStockCount}</div>
                  <div className="mt-2 text-sm text-stone-500">
                    {criticalLowStockCount > 0
                      ? isAr ? `${criticalLowStockCount} منتج في المنطقة الحرجة.` : `${criticalLowStockCount} item${criticalLowStockCount !== 1 ? 's' : ''} are in the critical zone.`
                      : isAr ? 'لا يوجد منتج في المنطقة الحرجة حتى الآن.' : 'Nothing has dropped into the critical zone yet.'}
                  </div>
                </div>

                {showBackOfficeInsights ? (
                  <div className="rounded-[24px] border border-stone-200 bg-stone-50/90 p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{isAr ? 'قائمة الاستلام' : 'Receiving queue'}</div>
                    <div className="mt-2 text-2xl font-black text-stone-950">{pendingPurchases}</div>
                    <div className="mt-2 text-sm text-stone-500">
                      {pendingPurchases > 0
                        ? isAr ? 'أوامر شراء تنتظر إجراء المورد.' : 'Purchase orders are waiting for more supplier action.'
                        : isAr ? 'لا توجد أوامر شراء مفتوحة.' : 'No open purchase orders are waiting.'}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-4">
                <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                  <span>{isAr ? 'صحة الكتالوج' : 'Catalog health'}</span>
                  <span>{stockCoverage}% {isAr ? 'مستقر' : 'stable'}</span>
                </div>
                <div className="mt-3 h-2.5 rounded-full bg-stone-200">
                  <div className="h-full rounded-full bg-emerald-500 shadow-[0_10px_20px_-12px_rgba(16,185,129,0.9)]" style={{ width: `${stockCoverage}%` }} />
                </div>
                <div className="mt-3 text-sm text-stone-500">
                  {isAr
                    ? 'راقب قائمة إعادة التخزين لكي يظل المخزون جاهزاً طوال اليوم.'
                    : 'Keep an eye on the restock queue so the sales floor stays ready throughout the day.'}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <DashboardStats
        totalProducts={totalProducts}
        lowStockCount={lowStockCount}
        pendingPurchases={pendingPurchases}
        todaySales={money(todaySalesValue, currency)}
        todaySaleCount={todaySaleCount}
        stockCoverage={stockCoverage}
        showPendingPurchases={showBackOfficeInsights}
      />

      {showBackOfficeInsights && ownerAnalytics ? (
        <OwnerAnalyticsPanel analytics={ownerAnalytics} locale={locale} />
      ) : null}

      {nextSteps.length ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">{isAr ? 'إعداد موجَّه' : 'Guided setup'}</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">{isAr ? 'ما يجب فعله الآن' : 'What to do next'}</h2>
              <p className="mt-1 text-sm text-stone-500">{isAr ? 'هذه الاختصارات تظهر فقط بينما يحتاج الفرع إلى بعض السجلات الأساسية.' : 'These shortcuts only appear while the branch still needs a few foundational records.'}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {nextSteps.map((step) => (
              <Link key={step.href} href={step.href} className="rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.92))] p-5 transition hover:-translate-y-0.5 hover:border-emerald-200">
                <div className="text-lg font-black text-stone-900">{step.title}</div>
                <div className="mt-2 text-sm leading-6 text-stone-500">{step.description}</div>
                <div className="mt-4 text-sm font-semibold text-emerald-700">{isAr ? 'فتح المهمة' : 'Open task'}</div>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Active Vessel Provisioning Calls & Logistics Tracker */}
      <ShipmentsSummaryCard shipments={dashboardShipments} locale={locale} />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <RecentSalesCard
          sales={recentSales.map(serializeRecentSale)}
          currencySymbol={currency}
        />
        <LowStockCard
          products={lowStockProducts.map(serializeLowStockProduct)}
          currencySymbol={currency}
        />
      </div>

      {showBackOfficeInsights ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">{isAr ? 'مراقبة حركة المخزون' : 'Movement watch'}</div>
              <h2 className="mt-2 text-2xl font-black text-slate-950">{isAr ? 'آخر حركات مخزون المؤن والقطع' : 'Recent marine inventory movements'}</h2>
            </div>
            <Link href="/inventory" className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-100">
              {isAr ? 'فتح المخزون البحري' : 'Open inventory'}
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {recentMovements.length ? (
              recentMovements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.86))] p-4 transition hover:border-stone-300">
                  <div>
                    <div className="font-semibold text-stone-900">{movement.product.name}</div>
                    <div className="mt-1 text-sm text-stone-500">
                      {getInventoryMovementTypeLabel(movement.type)} / {dateTime(movement.createdAt)}
                    </div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-lg font-black ${movement.qtyChange >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {movement.qtyChange > 0 ? `+${movement.qtyChange}` : movement.qtyChange}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                {isAr ? 'لم يتم تسجيل أي حركة مخزون حتى الآن.' : 'No stock movement has been recorded yet.'}
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {/* Daily Audit Register Log */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-black text-stone-900">
            {isAr ? 'السجل اليومي لحركة الدرج والخزينة' : 'Today\'s Daily Drawer & Audit Log'}
          </h2>
          <p className="text-sm text-stone-500">
            {isAr ? 'الحركة المالية المفصلة لليوم في جميع الأدراج.' : 'Detailed transaction logs in drawers for the current day.'}
          </p>
        </div>

        <DailyRegisterLog
          selectedDate={todayStr}
          cashEvents={cashEvents}
          instapayEvents={instapayEvents}
          walletEvents={walletEvents}
          visaEvents={visaEvents}
          initialBalances={initialBalances}
          currencySymbol={currency}
          locale={locale}
          activeSessionId={activeSession?.id}
        />
      </div>
    </div>
  );
}
