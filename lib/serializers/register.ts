import { CashMovementType, CashSession, CashSessionStatus, User } from '@prisma/client';
import {
  RegisterDenominationSnapshot,
  RegisterSessionSummary,
  RegisterTimelineEntry,
  normalizeDenominationSnapshot
} from '@/lib/register';

type CashSessionWithUsers = CashSession & {
  user?: Pick<User, 'id' | 'name' | 'email'> | null;
  closedByUser?: Pick<User, 'id' | 'name' | 'email'> | null;
  reviewedByUser?: Pick<User, 'id' | 'name' | 'email'> | null;
  reopenedByUser?: Pick<User, 'id' | 'name' | 'email'> | null;
  movements?: Array<any>;
};

export type SerializedRegisterTimelineEntry = {
  id: string;
  type: RegisterTimelineEntry['type'];
  label: string;
  occurredAt: string;
  amount: string;
  note: string | null;
  reference: string | null;
  referenceId: string | null;
  userName: string | null;
};

export type SerializedCashMovementSummary = {
  id: string;
  type: CashMovementType;
  amount: string;
  note: string | null;
  drawer: string;
  createdAt: string;
  createdByName: string | null;
};

export type SerializedRegisterSessionSummary = {
  expectedCash: string;
  expectedInstaPay: string;
  expectedWallet: string;
  salesCount: number;
  grossSalesTotal: string;
  cashSalesTotal: string;
  instaPaySalesTotal: string;
  walletSalesTotal: string;
  refundCashTotal: string;
  refundInstaPayTotal: string;
  refundWalletTotal: string;
  paymentBreakdown: Array<{ method: string; amount: string }>;
  movementTotals: Record<CashMovementType, string>;
  movements: SerializedCashMovementSummary[];
  timeline: SerializedRegisterTimelineEntry[];
};

export type SerializedCashSession = {
  id: string;
  shopId: string;
  userId: string;
  cashierName: string;
  cashierEmail: string | null;
  openedAt: string;
  openingFloat: string;
  closedAt: string | null;
  closedByName: string | null;
  closingExpected: string | null;
  closingActual: string | null;
  variance: string | null;
  closingExpectedCash: string | null;
  closingActualCash: string | null;
  closingExpectedInstaPay: string | null;
  closingActualInstaPay: string | null;
  closingExpectedWallet: string | null;
  closingActualWallet: string | null;
  denominationBreakdown: RegisterDenominationSnapshot;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
  reopenedAt: string | null;
  reopenedByName: string | null;
  reopenReason: string | null;
  notes: string | null;
  status: CashSessionStatus;
  movements?: SerializedCashMovementSummary[];
};

export type SerializedActiveCashSession = SerializedCashSession & {
  expectedCash: string;
  canOverride: boolean;
  canReview: boolean;
  canReopen: boolean;
  summary: SerializedRegisterSessionSummary;
};

function getDisplayName(user?: Pick<User, 'name' | 'email'> | null) {
  return user?.name ?? user?.email ?? null;
}

export function serializeRegisterSessionSummary(
  summary: RegisterSessionSummary
): SerializedRegisterSessionSummary {
  return {
    expectedCash: summary.expectedCash.toFixed(2),
    expectedInstaPay: summary.expectedInstaPay.toFixed(2),
    expectedWallet: summary.expectedWallet.toFixed(2),
    salesCount: summary.salesCount,
    grossSalesTotal: summary.grossSalesTotal.toFixed(2),
    cashSalesTotal: summary.cashSalesTotal.toFixed(2),
    instaPaySalesTotal: summary.instaPaySalesTotal.toFixed(2),
    walletSalesTotal: summary.walletSalesTotal.toFixed(2),
    refundCashTotal: summary.refundCashTotal.toFixed(2),
    refundInstaPayTotal: summary.refundInstaPayTotal.toFixed(2),
    refundWalletTotal: summary.refundWalletTotal.toFixed(2),
    paymentBreakdown: summary.paymentBreakdown.map((entry) => ({
      method: entry.method,
      amount: entry.amount.toFixed(2)
    })),
    movementTotals: {
      PAYOUT: summary.movementTotals.PAYOUT.toFixed(2),
      CASH_DROP: summary.movementTotals.CASH_DROP.toFixed(2),
      PETTY_CASH: summary.movementTotals.PETTY_CASH.toFixed(2),
      MANUAL_CORRECTION: summary.movementTotals.MANUAL_CORRECTION.toFixed(2)
    },
    movements: summary.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      amount: movement.amount.toFixed(2),
      note: movement.note,
      drawer: movement.drawer,
      createdAt: movement.createdAt.toISOString(),
      createdByName: movement.createdByName
    })),
    timeline: summary.timeline.map((entry) => ({
      id: entry.id,
      type: entry.type,
      label: entry.label,
      occurredAt: entry.occurredAt.toISOString(),
      amount: entry.amount.toFixed(2),
      note: entry.note,
      reference: entry.reference,
      referenceId: entry.referenceId ?? null,
      userName: entry.userName
    }))
  };
}

export function serializeCashSession(session: CashSessionWithUsers): SerializedCashSession {
  const cashierName =
    session.user?.name ??
    session.user?.email?.split('@')[0] ??
    'Cashier';

  return {
    id: session.id,
    shopId: session.shopId,
    userId: session.userId,
    cashierName,
    cashierEmail: session.user?.email ?? null,
    openedAt: session.openedAt.toISOString(),
    openingFloat: session.openingFloat.toString(),
    closedAt: session.closedAt?.toISOString() ?? null,
    closedByName: getDisplayName(session.closedByUser),
    closingExpected: session.closingExpected?.toString() ?? null,
    closingActual: session.closingActual?.toString() ?? null,
    variance: session.variance?.toString() ?? null,
    closingExpectedCash: session.closingExpectedCash?.toString() ?? null,
    closingActualCash: session.closingActualCash?.toString() ?? null,
    closingExpectedInstaPay: session.closingExpectedInstaPay?.toString() ?? null,
    closingActualInstaPay: session.closingActualInstaPay?.toString() ?? null,
    closingExpectedWallet: session.closingExpectedWallet?.toString() ?? null,
    closingActualWallet: session.closingActualWallet?.toString() ?? null,
    denominationBreakdown: normalizeDenominationSnapshot(session.denominationBreakdown),
    reviewedAt: session.reviewedAt?.toISOString() ?? null,
    reviewedByName: getDisplayName(session.reviewedByUser),
    reviewNote: session.reviewNote ?? null,
    reopenedAt: session.reopenedAt?.toISOString() ?? null,
    reopenedByName: getDisplayName(session.reopenedByUser),
    reopenReason: session.reopenReason ?? null,
    notes: session.notes ?? null,
    status: session.status,
    movements: session.movements?.map((m: any) => ({
      id: m.id,
      type: m.type,
      amount: m.amount.toString(),
      note: m.note,
      drawer: m.drawer ?? 'CASH',
      createdAt: m.createdAt.toISOString(),
      createdByName: m.createdByUser?.name ?? m.createdByUser?.email ?? null
    }))
  };
}
