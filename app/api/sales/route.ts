import { DocumentSequenceType } from '@prisma/client';
import { NextResponse } from 'next/server';
import { saleSchema } from '@/lib/auth/validation';
import { requireRole } from '@/lib/authz';
import { apiErrorResponse } from '@/lib/api';
import { logActivity } from '@/lib/activity';
import { getCustomerLoyaltyBalance } from '@/lib/customer-operations';
import {
  calculateLoyaltyDiscount,
  calculatePointsEarned,
  getCustomerDisplayName
} from '@/lib/customers';
import { getNextDocumentNumber } from '@/lib/document-sequence';
import { collapseSaleItems, normalizeText, roundCurrency } from '@/lib/inventory';
import {
  getPaymentDrawerType,
  getSalePaymentSummaryLabel,
  validatePaymentsForSale
} from '@/lib/payments';
import { buildVariantLabel } from '@/lib/product-merchandising';
import { prisma } from '@/lib/prisma';
import { CASH_PAYMENT_METHOD, getActiveCashSession } from '@/lib/register';
import { calculateTaxBreakdown } from '@/lib/shop-settings';

type SaleConflict = {
  type: 'INSUFFICIENT_STOCK' | 'PRICE_CHANGED' | 'PRODUCT_UNAVAILABLE';
  productId: string;
  variantId: string | null;
  productName: string;
  message: string;
  requestedQty?: number;
  availableQty?: number;
  queuedPrice?: number | null;
  currentPrice?: number | null;
};

function parseOptionalDateInput(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function serializeSale<T extends {
  createdAt: Date;
  subtotal: { toString(): string };
  taxAmount: { toString(): string };
  discountAmount: { toString(): string };
  totalAmount: { toString(): string };
  changeDue: { toString(): string };
}>(sale: T) {
  return {
    ...sale,
    subtotal: sale.subtotal.toString(),
    taxAmount: sale.taxAmount.toString(),
    discountAmount: sale.discountAmount.toString(),
    totalAmount: sale.totalAmount.toString(),
    changeDue: sale.changeDue.toString(),
    createdAt: sale.createdAt.toISOString()
  };
}

function conflictResponse(error: string, conflicts: SaleConflict[]) {
  return NextResponse.json(
    {
      error,
      code: 'OFFLINE_SYNC_CONFLICT',
      conflicts
    },
    { status: 409 }
  );
}

export async function GET() {
  try {
    const { shopId } = await requireRole('CASHIER');
    const sales = await prisma.sale.findMany({
      where: { shopId },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      sales: sales.map((sale) => ({
        ...serializeSale(sale),
        items: sale.items.map((item) => ({
          ...item,
          unitPrice: item.unitPrice.toString(),
          lineTotal: item.lineTotal.toString()
        }))
      }))
    });
  } catch (error) {
    return apiErrorResponse(error, 'Unable to load sales.');
  }
}

export async function POST(request: Request) {
  try {
    const { shopId, userId, session } = await requireRole('CASHIER');
    const body = await request.json();
    const parsed = saleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid sale payload.' },
        { status: 400 }
      );
    }

    const occurredAt = parseOptionalDateInput(parsed.data.occurredAt) ?? new Date();
    if (parsed.data.occurredAt && !parseOptionalDateInput(parsed.data.occurredAt)) {
      return NextResponse.json(
        { error: 'Enter a valid sale timestamp.' },
        { status: 400 }
      );
    }

    const clientRequestId = normalizeText(parsed.data.clientRequestId);
    if (clientRequestId) {
      const existingSale = await prisma.sale.findFirst({
        where: {
          shopId,
          clientRequestId
        },
        include: {
          items: true
        }
      });

      if (existingSale) {
        return NextResponse.json({
          sale: {
            ...serializeSale(existingSale),
            items: existingSale.items.map((item) => ({
              ...item,
              unitPrice: item.unitPrice.toString(),
              lineTotal: item.lineTotal.toString()
            }))
          },
          alreadySynced: true
        });
      }
    }

    const rawPayments = parsed.data.payments.map((payment) => ({
      method: payment.method,
      amount: Number(payment.amount),
      referenceNumber: payment.referenceNumber ?? null,
      pullAmount: payment.pullAmount !== undefined && payment.pullAmount !== null ? Number(payment.pullAmount) : null,
      adminFees: payment.adminFees !== undefined && payment.adminFees !== null ? Number(payment.adminFees) : 0
    }));
    const isCreditSale = parsed.data.isCreditSale;
    const creditDueDate = parseOptionalDateInput(parsed.data.creditDueDate);
    const loyaltyPointsToRedeem = parsed.data.loyaltyPointsToRedeem ?? 0;
    const loyaltyDiscountAmount = calculateLoyaltyDiscount(loyaltyPointsToRedeem);

    if (isCreditSale && !creditDueDate) {
      return NextResponse.json(
        { error: 'Enter a valid credit due date.' },
        { status: 400 }
      );
    }

    const hasCashPayment = !isCreditSale && rawPayments.some((payment) => payment.method === CASH_PAYMENT_METHOD);

    if (hasCashPayment) {
      if (parsed.data.cashSessionId?.trim()) {
        const referencedSession = await prisma.cashSession.findFirst({
          where: {
            id: parsed.data.cashSessionId.trim(),
            shopId,
            userId
          }
        });

        if (!referencedSession) {
          return NextResponse.json(
            { error: 'The referenced cash session was not found for this cashier.' },
            { status: 409 }
          );
        }

        const closesAt = referencedSession.closedAt ?? occurredAt;
        if (occurredAt < referencedSession.openedAt || occurredAt > closesAt) {
          return NextResponse.json(
            { error: 'The sale timestamp falls outside the referenced cash session.' },
            { status: 409 }
          );
        }
      } else {
        const activeCashSession = await getActiveCashSession(prisma, shopId, userId);
        if (!activeCashSession) {
          return NextResponse.json(
            { error: 'Open a register session before accepting cash sales.' },
            { status: 409 }
          );
        }
      }
    }

    const activeShop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, linkedShopId: true }
    });

    const allowedShopIds = [shopId];
    if (activeShop?.linkedShopId) {
      allowedShopIds.push(activeShop.linkedShopId);
    }

    const items = collapseSaleItems(parsed.data.items);
    const [settings, products, customer] = await Promise.all([
      prisma.shopSetting.findUnique({ where: { shopId } }),
      prisma.product.findMany({
        where: {
          shopId: { in: allowedShopIds },
          id: { in: items.map((item) => item.productId) }
        },
        include: {
          variants: true
        }
      }),
      parsed.data.customerId
        ? prisma.customer.findFirst({
            where: {
              id: parsed.data.customerId,
              shopId,
              isActive: true
            }
          })
        : Promise.resolve(null)
    ]);

    if (parsed.data.customerId && !customer) {
      return NextResponse.json(
        { error: 'Selected customer was not found or is archived.' },
        { status: 404 }
      );
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const productQtyTotals = new Map<string, number>();
    const variantQtyTotals = new Map<string, number>();
    const conflicts: SaleConflict[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product || !product.isActive) {
        conflicts.push({
          type: 'PRODUCT_UNAVAILABLE',
          productId: item.productId,
          variantId: item.variantId ?? null,
          productName: product?.name ?? 'Archived product',
          message: product
            ? `${product.name} is archived and cannot be sold.`
            : 'One queued item no longer exists in the branch catalog.'
        });
        continue;
      }

      const variant = item.variantId
        ? product.variants.find((entry) => entry.id === item.variantId)
        : null;

      if (item.variantId && (!variant || !variant.isActive)) {
        conflicts.push({
          type: 'PRODUCT_UNAVAILABLE',
          productId: item.productId,
          variantId: item.variantId,
          productName: product.name,
          message: `A selected variant for ${product.name} is no longer available.`
        });
        continue;
      }

      const currentUnitPrice = Number(variant?.priceOverride ?? product.price);
      if (item.priceSnapshot !== null && item.priceSnapshot !== undefined) {
        const queuedPrice = roundCurrency(Number(item.priceSnapshot));
        if (product.productType !== 'MOTORCYCLE' && queuedPrice !== roundCurrency(currentUnitPrice)) {
          conflicts.push({
            type: 'PRICE_CHANGED',
            productId: item.productId,
            variantId: item.variantId ?? null,
            productName: product.name,
            queuedPrice,
            currentPrice: roundCurrency(currentUnitPrice),
            message: `${product.name} changed price while this sale was queued offline.`
          });
        }
      }

      if (item.variantId) {
        variantQtyTotals.set(item.variantId, (variantQtyTotals.get(item.variantId) ?? 0) + item.qty);
      } else {
        productQtyTotals.set(item.productId, (productQtyTotals.get(item.productId) ?? 0) + item.qty);
      }
    }

    for (const [variantId, qty] of variantQtyTotals) {
      let parentProduct = null;
      let variant = null;
      for (const p of products) {
        const v = p.variants.find((entry) => entry.id === variantId);
        if (v) {
          parentProduct = p;
          variant = v;
          break;
        }
      }

      if (parentProduct && variant) {
        if (variant.stockQty < qty) {
          conflicts.push({
            type: 'INSUFFICIENT_STOCK',
            productId: parentProduct.id,
            variantId,
            productName: `${parentProduct.name} (${buildVariantLabel(variant)})`,
            requestedQty: qty,
            availableQty: variant.stockQty,
            message: `${parentProduct.name} (${buildVariantLabel(variant)}) has only ${variant.stockQty} item(s) available.`
          });
        }
      }
    }

    for (const [productId, qty] of productQtyTotals) {
      const product = productMap.get(productId);
      if (!product) continue;

      if (product.stockQty < qty) {
        conflicts.push({
          type: 'INSUFFICIENT_STOCK',
          productId,
          variantId: null,
          productName: product.name,
          requestedQty: qty,
          availableQty: product.stockQty,
          message: `${product.name} has only ${product.stockQty} item(s) available.`
        });
      }
    }

    if (conflicts.length) {
      return conflictResponse(
        'One or more queued sale lines need cashier review before sync can continue.',
        conflicts
      );
    }

    const saleLines = items.map((item) => {
      const product = productMap.get(item.productId)!;
      const variant = item.variantId ? product.variants.find((entry) => entry.id === item.variantId) ?? null : null;
      let unitPrice = Number(variant?.priceOverride ?? product.price);
      if (product.productType === 'MOTORCYCLE' && item.priceSnapshot !== null && item.priceSnapshot !== undefined) {
        unitPrice = Number(item.priceSnapshot);
      }

      if (product.productType === 'MOTORCYCLE') {
        const totalCosts = Number(product.supplierPrice || 0) +
          Number(product.assemblyCost || 0) +
          Number(product.externalTransportCost || 0) +
          Number(product.internalTransportCost || 0) +
          Number(product.maintenanceCost || 0) +
          Number(product.otherCosts || 0);
        if (unitPrice < totalCosts) {
          throw new Error('PRICE_FLOOR_VIOLATION');
        }
      }

      return {
        ...item,
        product,
        variant,
        unitPrice,
        lineTotal: roundCurrency(unitPrice * item.qty)
      };
    });

    const subtotal = roundCurrency(
      saleLines.reduce((sum, line) => sum + line.lineTotal, 0)
    );
    const manualDiscountAmount = roundCurrency(Number(parsed.data.discountAmount ?? 0));
    const discountAmount = roundCurrency(manualDiscountAmount + loyaltyDiscountAmount);
    const taxBreakdown = calculateTaxBreakdown({
      subtotal,
      discountAmount,
      taxRate: Number(settings?.taxRate ?? 0),
      taxMode: settings?.taxMode ?? 'EXCLUSIVE'
    });

    if (discountAmount > subtotal + taxBreakdown.taxAmount) {
      return NextResponse.json(
        { error: 'Discount cannot exceed the sale total.' },
        { status: 400 }
      );
    }

    const taxAmount = taxBreakdown.taxAmount;
    const totalAmount = taxBreakdown.totalAmount;
    const paymentValidation = isCreditSale
      ? {
          ok: true as const,
          payments: [],
          summary: {
            totalPaid: 0,
            remainingAmount: totalAmount,
            changeDue: 0,
            cashReceived: 0,
            hasCashPayment: false
          }
        }
      : validatePaymentsForSale(totalAmount, rawPayments);

    if (!paymentValidation.ok) {
      return NextResponse.json(
        { error: paymentValidation.error },
        { status: 400 }
      );
    }

    const paymentMethodSummary = isCreditSale
      ? 'Customer Credit'
      : getSalePaymentSummaryLabel(paymentValidation.payments);
    const pointsEarned = customer ? calculatePointsEarned(totalAmount) : 0;

    const sale = await prisma.$transaction(async (tx) => {
      const currentLoyaltyBalance = customer ? await getCustomerLoyaltyBalance(tx, customer.id) : 0;

      if (loyaltyPointsToRedeem > currentLoyaltyBalance) {
        throw new Error('LOYALTY_BALANCE_EXCEEDED');
      }

      const [saleNumber, receiptNumber] = await Promise.all([
        getNextDocumentNumber(tx, {
          shopId,
          type: DocumentSequenceType.SALE,
          prefix: settings?.salePrefix ?? 'SAL'
        }),
        getNextDocumentNumber(tx, {
          shopId,
          type: DocumentSequenceType.RECEIPT,
          prefix: settings?.receiptPrefix ?? 'RCP'
        })
      ]);

      let salesmanCommission: number | null = null;
      if (parsed.data.salesmanId) {
        const salesmanShop = await tx.userShop.findFirst({
          where: {
            userId: parsed.data.salesmanId,
            shopId,
            isActive: true
          },
          select: {
            commissionRate: true
          }
        });
        if (salesmanShop) {
          const rate = Number(salesmanShop.commissionRate || 0);
          salesmanCommission = roundCurrency(totalAmount * (rate / 100));
        }
      }

      const saleRecord = await tx.sale.create({
        data: {
          shopId,
          cashierUserId: userId,
          customerId: customer?.id ?? null,
          salesmanId: parsed.data.salesmanId || null,
          salesmanCommission,
          saleNumber,
          receiptNumber,
          clientRequestId,
          createdAt: occurredAt,
          customerName: normalizeText(parsed.data.customerName) ?? (customer ? getCustomerDisplayName(customer) : null),
          customerPhone: normalizeText(parsed.data.customerPhone) ?? normalizeText(customer?.phone),
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          changeDue: paymentValidation.summary.changeDue,
          paymentMethod: paymentMethodSummary,
          isCreditSale,
          loyaltyPointsEarned: pointsEarned,
          loyaltyPointsRedeemed: loyaltyPointsToRedeem,
          loyaltyDiscountAmount,
          notes: normalizeText(parsed.data.notes),
          cashierName: session.user.name || session.user.email || 'Cashier',
          customerNationalId: normalizeText(parsed.data.customerNationalId),
          customerNationalIdPhoto: normalizeText(parsed.data.customerNationalIdPhoto),
          motorcycleColor: normalizeText(parsed.data.motorcycleColor),
          motorcycleMotorNumber: normalizeText(parsed.data.motorcycleMotorNumber),
          motorcycleChassisNumber: normalizeText(parsed.data.motorcycleChassisNumber),
          motorcycleChassisPhoto: normalizeText(parsed.data.motorcycleChassisPhoto),
          motorcycleMotorPhoto: normalizeText(parsed.data.motorcycleMotorPhoto),
          items: {
            create: saleLines.map((line) => ({
              productId: line.productId,
              productVariantId: line.variant?.id ?? null,
              productName: line.product.name,
              variantLabel: line.variant ? buildVariantLabel(line.variant) || null : null,
              variantSkuSnapshot: line.variant?.sku ?? null,
              variantBarcodeSnapshot: line.variant?.barcode ?? null,
              qty: line.qty,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal
            }))
          },
          payments: paymentValidation.payments.length
            ? {
                create: paymentValidation.payments.map((payment) => ({
                  method: payment.method,
                  amount: payment.amount,
                  referenceNumber: normalizeText(payment.referenceNumber),
                  drawerType: getPaymentDrawerType(payment.method),
                  createdAt: occurredAt
                }))
              }
            : undefined
        },
        include: { items: true }
      });

      // --- Parallel: customer ledger entries + stock updates ---
      const customerOps: Promise<unknown>[] = [];
      if (customer) {
        let nextBalance = currentLoyaltyBalance;
        const ledgerRows: import('@prisma/client').Prisma.CustomerLoyaltyLedgerCreateManyInput[] = [];
        if (loyaltyPointsToRedeem > 0) {
          nextBalance -= loyaltyPointsToRedeem;
          ledgerRows.push({ shopId, customerId: customer.id, saleId: saleRecord.id, type: 'REDEEMED', points: loyaltyPointsToRedeem, balanceAfter: nextBalance, note: `Redeemed for sale ${saleRecord.saleNumber}.`, createdAt: occurredAt });
        }
        if (pointsEarned > 0) {
          nextBalance += pointsEarned;
          ledgerRows.push({ shopId, customerId: customer.id, saleId: saleRecord.id, type: 'EARNED', points: pointsEarned, balanceAfter: nextBalance, note: `Earned from sale ${saleRecord.saleNumber}.`, createdAt: occurredAt });
        }
        if (ledgerRows.length) {
          customerOps.push(tx.customerLoyaltyLedger.createMany({ data: ledgerRows }));
        }
        if (isCreditSale && creditDueDate) {
          customerOps.push(tx.customerCreditLedger.create({ data: { shopId, customerId: customer.id, saleId: saleRecord.id, dueDate: creditDueDate, originalAmount: totalAmount, balance: totalAmount, status: creditDueDate < new Date() ? 'OVERDUE' : 'OPEN', createdAt: occurredAt } }));
        }
      }

      // Batch stock decrements and inventory movement inserts
      const stockOps: Promise<unknown>[] = [];
      const movementRows: import('@prisma/client').Prisma.InventoryMovementCreateManyInput[] = [];

      for (const [variantId, qty] of variantQtyTotals) {
        let parentProduct = null;
        for (const p of products) {
          if (p.variants.some((v) => v.id === variantId)) { parentProduct = p; break; }
        }
        if (!parentProduct) continue;
        stockOps.push(tx.productVariant.update({ where: { id: variantId }, data: { stockQty: { decrement: qty } } }));
        stockOps.push(tx.product.update({ where: { id: parentProduct.id }, data: { stockQty: { decrement: qty } } }));
        movementRows.push({ shopId: parentProduct.shopId, productId: parentProduct.id, type: 'SALE_COMPLETED', qtyChange: qty * -1, referenceId: saleRecord.id, userId, notes: `Sale ${saleRecord.saleNumber} (Variant)`, createdAt: occurredAt });
      }

      for (const [productId, qty] of productQtyTotals) {
        const product = productMap.get(productId)!;
        stockOps.push(tx.product.update({ where: { id: product.id }, data: { stockQty: { decrement: qty } } }));
        movementRows.push({ shopId: product.shopId, productId: product.id, type: 'SALE_COMPLETED', qtyChange: qty * -1, referenceId: saleRecord.id, userId, notes: `Sale ${saleRecord.saleNumber}`, createdAt: occurredAt });
      }

      await Promise.all([
        ...customerOps,
        ...stockOps,
        movementRows.length ? tx.inventoryMovement.createMany({ data: movementRows }) : Promise.resolve()
      ]);



      // 1. Create InstallmentCompanyDue records for installment payments (parallel)
      const installmentMethods = ['امان', 'مايلو', 'موجو', 'فاليو', 'كونتاكت'];
      const installmentOps = rawPayments
        .filter((p) => installmentMethods.includes(p.method))
        .map((payment) => {
          const finalPullAmount = payment.pullAmount !== null ? payment.pullAmount : payment.amount;
          const finalAdminFees = payment.adminFees;
          const finalDueAmount = finalPullAmount - finalAdminFees;
          const dueDate = new Date(occurredAt.getTime() + 15 * 24 * 60 * 60 * 1000);
          return tx.installmentCompanyDue.create({
            data: {
              shopId,
              saleId: saleRecord.id,
              companyName: payment.method,
              pullDate: occurredAt,
              saleDate: occurredAt,
              customerName: customer ? getCustomerDisplayName(customer) : (normalizeText(parsed.data.customerName) ?? 'N/A'),
              customerPhone: customer ? customer.phone : (normalizeText(parsed.data.customerPhone) ?? null),
              pullAmount: finalPullAmount,
              saleAmount: payment.amount,
              adminFees: finalAdminFees,
              dueDate,
              dueAmount: finalDueAmount
            }
          });
        });
      if (installmentOps.length) await Promise.all(installmentOps);
      if (parsed.data.installmentCashbackAmount && parsed.data.installmentCashbackAmount > 0) {
        const activeCashSession = await getActiveCashSession(tx, shopId, userId);
        if (!activeCashSession) {
          throw new Error('CASH_SESSION_REQUIRED_FOR_CASHBACK');
        }

        await tx.cashMovement.create({
          data: {
            shopId,
            cashSessionId: activeCashSession.id,
            type: 'PAYOUT',
            amount: parsed.data.installmentCashbackAmount,
            note: `فائض سحب تقسيط مسترد كاش للعميل - فاتورة ${saleRecord.saleNumber}`,
            createdByUserId: userId,
            createdAt: occurredAt
          }
        });
      }

      // 3. Create TrafficInvoice records for motorcycle sales
      const hasMotorcycle = saleLines.some((line) => line.product.productType === 'MOTORCYCLE');
      if (hasMotorcycle) {
        await tx.trafficInvoice.create({
          data: {
            shopId,
            saleId: saleRecord.id,
            customerName: customer ? getCustomerDisplayName(customer) : (normalizeText(parsed.data.customerName) ?? 'N/A'),
            status: 'PENDING_SEND'
          }
        });
      }

      return saleRecord;
    });

    // Fire-and-forget: activity log does not need to block the HTTP response
    void logActivity({
      shopId,
      userId,
      action: clientRequestId ? 'SALE_SYNCED_FROM_OFFLINE_QUEUE' : 'SALE_COMPLETED',
      entityType: 'Sale',
      entityId: sale.id,
      description: clientRequestId
        ? `Synced offline sale ${sale.saleNumber}.`
        : `Completed sale ${sale.saleNumber}.`,
      metadata: {
        customerId: customer?.id ?? null,
        customerName: customer ? getCustomerDisplayName(customer) : normalizeText(parsed.data.customerName),
        itemCount: saleLines.reduce((sum, line) => sum + line.qty, 0),
        variantLineCount: saleLines.filter((line) => line.variant).length,
        paymentMethod: paymentMethodSummary,
        paymentCount: paymentValidation.payments.length,
        isCreditSale,
        creditDueDate: creditDueDate?.toISOString() ?? null,
        loyaltyPointsRedeemed: loyaltyPointsToRedeem,
        loyaltyPointsEarned: pointsEarned,
        totalAmount,
        totalPaid: paymentValidation.summary.totalPaid,
        changeDue: paymentValidation.summary.changeDue,
        clientRequestId,
        occurredAt: occurredAt.toISOString()
      }
    }).catch(console.error);

    return NextResponse.json(
      {
        sale: {
          ...serializeSale(sale),
          items: sale.items.map((item) => ({
            ...item,
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString()
          }))
        }
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'LOYALTY_BALANCE_EXCEEDED') {
      return NextResponse.json(
        { error: 'Customer does not have enough loyalty points for this redemption.' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'CASH_SESSION_REQUIRED_FOR_CASHBACK') {
      return NextResponse.json(
        { error: 'Open a register session before recording drawer cashback.' },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === 'PRICE_FLOOR_VIOLATION') {
      return NextResponse.json(
        { error: 'Cannot sell motorcycle below its total aggregated costs.' },
        { status: 400 }
      );
    }

    return apiErrorResponse(error, 'Unable to complete sale.');
  }
}
