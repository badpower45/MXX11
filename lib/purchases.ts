import { roundCurrency } from '@/lib/inventory';

type DecimalLike = { toString(): string };

export const PURCHASE_STATUS_OPTIONS = [
  'DRAFT',
  'SENT',
  'PARTIALLY_RECEIVED',
  'FULLY_RECEIVED',
  'CANCELLED',
  'CLOSED'
] as const;

export const CREATE_PURCHASE_STATUS_OPTIONS = ['DRAFT', 'SENT', 'FULLY_RECEIVED'] as const;
export const PAYABLE_STATUS_OPTIONS = ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] as const;
export const MANUAL_PURCHASE_STATUS_OPTIONS = ['DRAFT', 'SENT', 'CANCELLED', 'CLOSED'] as const;

export type PurchaseLifecycleStatus = (typeof PURCHASE_STATUS_OPTIONS)[number];
export type CreatePurchaseStatus = (typeof CREATE_PURCHASE_STATUS_OPTIONS)[number];
export type PayableLifecycleStatus = (typeof PAYABLE_STATUS_OPTIONS)[number];
export type ManualPurchaseStatus = (typeof MANUAL_PURCHASE_STATUS_OPTIONS)[number];
export type Tone = 'stone' | 'emerald' | 'amber' | 'red' | 'blue';

const PURCHASE_STATUS_LABELS: Record<PurchaseLifecycleStatus, string> = {
  DRAFT: 'Awaiting send',
  SENT: 'Order sent',
  PARTIALLY_RECEIVED: 'Partially received',
  FULLY_RECEIVED: 'Received in full',
  CANCELLED: 'Cancelled',
  CLOSED: 'Closed'
};

const PAYABLE_STATUS_LABELS: Record<PayableLifecycleStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue'
};

const MANUAL_PURCHASE_TRANSITIONS: Record<PurchaseLifecycleStatus, ManualPurchaseStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['DRAFT', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['CLOSED'],
  FULLY_RECEIVED: ['CLOSED'],
  CANCELLED: [],
  CLOSED: []
};

export function getPurchaseStatusLabel(status: PurchaseLifecycleStatus | string) {
  return PURCHASE_STATUS_LABELS[status as PurchaseLifecycleStatus] ?? String(status).replaceAll('_', ' ');
}

export function getPayableStatusLabel(status: PayableLifecycleStatus | string) {
  return PAYABLE_STATUS_LABELS[status as PayableLifecycleStatus] ?? String(status).replaceAll('_', ' ');
}

export function purchaseStatusTone(status: PurchaseLifecycleStatus | string): Tone {
  switch (status) {
    case 'FULLY_RECEIVED':
    case 'CLOSED':
      return 'emerald';
    case 'PARTIALLY_RECEIVED':
      return 'blue';
    case 'CANCELLED':
      return 'red';
    case 'SENT':
      return 'amber';
    default:
      return 'stone';
  }
}

export function payableStatusTone(status: PayableLifecycleStatus | string): Tone {
  switch (status) {
    case 'PAID':
      return 'emerald';
    case 'PARTIALLY_PAID':
      return 'blue';
    case 'OVERDUE':
      return 'red';
    default:
      return 'amber';
  }
}

export function getPurchaseOrderedBaseQty(item: { qty: number; ratioToBase: number }) {
  return item.qty * item.ratioToBase;
}

export function getPurchaseReceivedBaseQty(item: { receivedBaseQty: number }) {
  return Math.max(item.receivedBaseQty, 0);
}

export function getPurchaseRemainingBaseQty(item: { qty: number; ratioToBase: number; receivedBaseQty: number }) {
  return Math.max(getPurchaseOrderedBaseQty(item) - getPurchaseReceivedBaseQty(item), 0);
}

export function getPurchaseReceivedUnitQty(item: { ratioToBase: number; receivedBaseQty: number }) {
  if (item.ratioToBase <= 0) {
    return 0;
  }

  return Math.floor(getPurchaseReceivedBaseQty(item) / item.ratioToBase);
}

export function getPurchaseRemainingUnitQty(item: { qty: number; ratioToBase: number; receivedBaseQty: number }) {
  return Math.max(item.qty - getPurchaseReceivedUnitQty(item), 0);
}

export function derivePurchaseReceiptStatus(
  items: Array<{ qty: number; ratioToBase: number; receivedBaseQty: number }>
): Extract<PurchaseLifecycleStatus, 'PARTIALLY_RECEIVED' | 'FULLY_RECEIVED'> | null {
  const totalOrdered = items.reduce((sum, item) => sum + getPurchaseOrderedBaseQty(item), 0);
  const totalReceived = items.reduce((sum, item) => sum + getPurchaseReceivedBaseQty(item), 0);

  if (totalReceived <= 0 || totalOrdered <= 0) {
    return null;
  }

  return totalReceived >= totalOrdered ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED';
}

export function canTransitionPurchaseStatus(
  currentStatus: PurchaseLifecycleStatus,
  nextStatus: ManualPurchaseStatus
) {
  return MANUAL_PURCHASE_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function stripDateTime(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

export function derivePayableStatus({
  totalAmount,
  amountPaid,
  dueDate,
  today = new Date()
}: {
  totalAmount: number;
  amountPaid: number;
  dueDate: Date;
  today?: Date;
}): PayableLifecycleStatus {
  const roundedTotal = roundCurrency(totalAmount);
  const roundedPaid = roundCurrency(amountPaid);
  const balance = roundCurrency(Math.max(roundedTotal - roundedPaid, 0));

  if (balance <= 0) {
    return 'PAID';
  }

  const isOverdue = stripDateTime(dueDate).getTime() < stripDateTime(today).getTime();

  if (roundedPaid > 0) {
    return isOverdue ? 'OVERDUE' : 'PARTIALLY_PAID';
  }

  return isOverdue ? 'OVERDUE' : 'UNPAID';
}

function serializeDecimal(value: DecimalLike | number | null | undefined) {
  if (value === null || value === undefined) {
    return '0';
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  return value.toString();
}

function serializeDate(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function serializeSupplierPayment<
  T extends {
    id: string;
    method: string;
    referenceNumber: string | null;
    amount: DecimalLike;
    paidAt: Date;
    createdAt: Date;
    createdByUser?: {
      id: string;
      name: string | null;
      email: string;
    } | null;
  }
>(payment: T) {
  return {
    id: payment.id,
    method: payment.method,
    referenceNumber: payment.referenceNumber ?? null,
    createdByUser: payment.createdByUser
      ? {
          id: payment.createdByUser.id,
          name: payment.createdByUser.name,
          email: payment.createdByUser.email
        }
      : null,
    amount: serializeDecimal(payment.amount),
    paidAt: payment.paidAt.toISOString(),
    createdAt: payment.createdAt.toISOString()
  };
}

export function serializeAccountsPayableEntry<
  T extends {
    amountDue: DecimalLike;
    amountPaid: DecimalLike;
    balance: DecimalLike;
    dueDate: Date;
    createdAt: Date;
    updatedAt: Date;
    status: string;
  }
>(entry: T) {
  const effectiveStatus = derivePayableStatus({
    totalAmount: Number(entry.amountDue.toString()),
    amountPaid: Number(entry.amountPaid.toString()),
    dueDate: entry.dueDate
  });

  return {
    ...entry,
    amountDue: serializeDecimal(entry.amountDue),
    amountPaid: serializeDecimal(entry.amountPaid),
    balance: serializeDecimal(entry.balance),
    dueDate: entry.dueDate.toISOString(),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    status: effectiveStatus
  };
}

export function serializeSupplierInvoice<
  T extends {
    totalAmount: DecimalLike;
    invoiceDate: Date;
    dueDate: Date;
    createdAt: Date;
    updatedAt: Date;
    paymentStatus: string;
    payments?: Array<{
      id: string;
      method: string;
      referenceNumber: string | null;
      amount: DecimalLike;
      paidAt: Date;
      createdAt: Date;
      createdByUser?: {
        id: string;
        name: string | null;
        email: string;
      } | null;
    }>;
    payableEntry?: {
      amountDue: DecimalLike;
      amountPaid: DecimalLike;
      balance: DecimalLike;
      dueDate: Date;
      createdAt: Date;
      updatedAt: Date;
      status: string;
    } | null;
  }
>(invoice: T) {
  const totalAmount = Number(invoice.totalAmount.toString());
  const amountPaid = invoice.payments?.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0) ?? 0;
  const effectiveStatus = derivePayableStatus({
    totalAmount,
    amountPaid,
    dueDate: invoice.dueDate
  });

  return {
    ...invoice,
    totalAmount: serializeDecimal(invoice.totalAmount),
    invoiceDate: invoice.invoiceDate.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    paymentStatus: effectiveStatus,
    payments: invoice.payments?.map(serializeSupplierPayment),
    payableEntry: invoice.payableEntry ? serializeAccountsPayableEntry(invoice.payableEntry) : null
  };
}

export function serializePurchaseReceiptItem<
  T extends {
    id: string;
    purchaseItemId: string;
    productId: string;
    qtyReceived: number;
    createdAt: Date;
    product?: {
      id: string;
      name: string;
    } | null;
  }
>(item: T) {
  return {
    id: item.id,
    purchaseItemId: item.purchaseItemId,
    productId: item.productId,
    qtyReceived: Number(item.qtyReceived),
    createdAt: item.createdAt.toISOString(),
    product: item.product
      ? {
          id: item.product.id,
          name: item.product.name
        }
      : null
  };
}

export function serializePurchaseReceipt<
  T extends {
    id: string;
    notes?: string | null;
    receivedAt: Date;
    createdAt: Date;
    receivedByUser?: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    items?: Array<{
      id: string;
      purchaseItemId: string;
      productId: string;
      qtyReceived: number;
      createdAt: Date;
      product?: {
        id: string;
        name: string;
      } | null;
    }>;
  }
>(receipt: T) {
  return {
    id: receipt.id,
    notes: (receipt as { notes?: string | null }).notes ?? null,
    receivedByUser: receipt.receivedByUser
      ? {
          id: receipt.receivedByUser.id,
          name: receipt.receivedByUser.name,
          email: receipt.receivedByUser.email
        }
      : null,
    receivedAt: receipt.receivedAt.toISOString(),
    createdAt: receipt.createdAt.toISOString(),
    items: receipt.items?.map(serializePurchaseReceiptItem)
  };
}

export function serializePurchase<
  T extends {
    id: string;
    supplierId: string;
    purchaseNumber: string;
    status: string;
    notes?: string | null;
    totalAmount: DecimalLike;
    createdAt: Date;
    updatedAt: Date;
    receivedAt: Date | null;
    supplier?: {
      name: string;
    } | null;
    items: Array<{
      id: string;
      purchaseId: string;
      productId: string;
      unitOfMeasureId: string;
      unitCode: string;
      unitName: string;
      productName: string;
      qty: number;
      ratioToBase: number;
      receivedBaseQty: number;
      unitCost: DecimalLike;
      lineTotal: DecimalLike;
    }>;
    receipts?: Array<{
      id: string;
      notes?: string | null;
      receivedAt: Date;
      createdAt: Date;
      receivedByUser?: {
        id: string;
        name: string | null;
        email: string;
      } | null;
      items?: Array<{
        id: string;
        purchaseItemId: string;
        productId: string;
        qtyReceived: number;
        createdAt: Date;
        product?: {
          id: string;
          name: string;
        } | null;
      }>;
    }>;
    supplierInvoice?: {
      totalAmount: DecimalLike;
      invoiceDate: Date;
      dueDate: Date;
      createdAt: Date;
      updatedAt: Date;
      paymentStatus: string;
      payments?: Array<{
        id: string;
        method: string;
        referenceNumber: string | null;
        amount: DecimalLike;
        paidAt: Date;
        createdAt: Date;
        createdByUser?: {
          id: string;
          name: string | null;
          email: string;
        } | null;
      }>;
      payableEntry?: {
        amountDue: DecimalLike;
        amountPaid: DecimalLike;
        balance: DecimalLike;
        dueDate: Date;
        createdAt: Date;
        updatedAt: Date;
        status: string;
      } | null;
    } | null;
  }
>(purchase: T) {
  return {
    id: purchase.id,
    supplierId: purchase.supplierId,
    purchaseNumber: purchase.purchaseNumber,
    status: purchase.status,
    notes: purchase.notes ?? null,
    supplier: purchase.supplier ? { name: purchase.supplier.name } : null,
    totalAmount: serializeDecimal(purchase.totalAmount),
    createdAt: purchase.createdAt.toISOString(),
    updatedAt: purchase.updatedAt.toISOString(),
    receivedAt: serializeDate(purchase.receivedAt),
    items: purchase.items.map((item) => ({
      id: item.id,
      purchaseId: item.purchaseId,
      productId: item.productId,
      unitOfMeasureId: item.unitOfMeasureId,
      unitCode: item.unitCode,
      unitName: item.unitName,
      productName: item.productName,
      qty: Number(item.qty),
      ratioToBase: Number(item.ratioToBase),
      receivedBaseQty: Number(item.receivedBaseQty),
      unitCost: serializeDecimal(item.unitCost),
      lineTotal: serializeDecimal(item.lineTotal)
    })),
    receipts: purchase.receipts?.map(serializePurchaseReceipt),
    supplierInvoice: purchase.supplierInvoice ? serializeSupplierInvoice(purchase.supplierInvoice) : null
  };
}
