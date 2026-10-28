import { describe, expect, it } from 'vitest';
import {
  getPaymentSummary,
  normalizePaymentInput,
  requiresReferenceNumber,
  validatePaymentsForSale
} from '@/lib/payments';

describe('payments', () => {
  it('requires references for non-cash payments', () => {
    expect(requiresReferenceNumber('كاش')).toBe(false);
    expect(requiresReferenceNumber('فيزا')).toBe(true);
    expect(requiresReferenceNumber('مايلو')).toBe(true);
    expect(requiresReferenceNumber('محفظه الكترونيه')).toBe(true);
  });

  it('normalizes payment input amounts and empty references', () => {
    expect(
      normalizePaymentInput({
        method: 'كاش',
        amount: 100.456,
        referenceNumber: '   '
      })
    ).toEqual({
      method: 'كاش',
      amount: 100.46,
      referenceNumber: null,
      pullAmount: null,
      adminFees: 0
    });
  });

  it('rejects missing reference numbers for non-cash payments', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'فيزا', amount: 500, referenceNumber: null }
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('فيزا payments require a reference number.');
    }
  });

  it('rejects duplicate non-cash references for the same payment method', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'فيزا', amount: 250, referenceNumber: 'ABC123' },
      { method: 'فيزا', amount: 250, referenceNumber: 'abc123' }
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Duplicate فيزا reference numbers are not allowed in one sale.');
    }
  });

  it('allows cash overpayment while returning change', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'كاش', amount: 1000, referenceNumber: null }
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.changeDue).toBe(500);
      expect(result.summary.totalPaid).toBe(1000);
    }
  });

  it('blocks non-cash overpayment', () => {
    const result = validatePaymentsForSale(500, [
      { method: 'فيزا', amount: 600, referenceNumber: 'CARD-1' }
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Non-cash payments must match the sale total exactly.');
    }
  });

  it('summarizes mixed cash and non-cash tenders correctly', () => {
    const summary = getPaymentSummary(500, [
      { method: 'كاش', amount: 300, referenceNumber: null },
      { method: 'فيزا', amount: 200, referenceNumber: 'CARD-2' }
    ]);

    expect(summary).toEqual({
      totalPaid: 500,
      remainingAmount: 0,
      changeDue: 0,
      cashReceived: 300,
      hasCashPayment: true
    });
  });
});
