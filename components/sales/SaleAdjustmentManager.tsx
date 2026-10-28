'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { money } from '@/lib/format';
import { roundCurrency } from '@/lib/inventory';
import {
  getPaymentSummary,
  PAYMENT_METHODS,
  type PaymentMethod,
  requiresReferenceNumber
} from '@/lib/payments';
import { useTranslations } from '@/lib/i18n/client';

type SaleItem = {
  id: string;
  productId: string;
  productName: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
  fullCreditAmount: string;
  refundedQty: number;
  refundableQty: number;
  refundableAmount: string;
  productType?: string;
  condition?: string;
  cost?: string;
};

type SaleDetail = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paymentMethod: string;
  customerName: string | null;
  cashierName: string | null;
  notes: string | null;
  canVoid: boolean;
  canRefund: boolean;
  items: SaleItem[];
};

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  stockQty: number;
};

type PaymentLine = {
  id: string;
  method: PaymentMethod;
  amount: string;
  referenceNumber: string;
};

type ReturnLineState = {
  qty: number;
  disposition: 'RESTOCK' | 'DAMAGED';
  newCost?: string;
};

type ReplacementLineState = {
  id: string;
  productId: string;
  qty: number;
};

function createPaymentLine(amount = ''): PaymentLine {
  return {
    id: crypto.randomUUID(),
    method: 'كاش',
    amount,
    referenceNumber: ''
  };
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function SaleAdjustmentManager({
  mode,
  sale,
  products = [],
  taxRate = 0,
  currencySymbol,
  currentUserEmail
}: {
  mode: 'void' | 'refund';
  sale: SaleDetail;
  products?: ProductOption[];
  taxRate?: number;
  currencySymbol: string;
  currentUserEmail: string;
}) {
  const router = useRouter();
  const t = useTranslations('adjustmentManager');
  const [workflowType, setWorkflowType] = useState<'REFUND' | 'EXCHANGE'>('REFUND');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [approverEmail, setApproverEmail] = useState(currentUserEmail);
  const [approverPassword, setApproverPassword] = useState('');
  const [query, setQuery] = useState('');
  const [returnLines, setReturnLines] = useState<Record<string, ReturnLineState>>(
    () =>
      Object.fromEntries(
        sale.items.map((item) => [
          item.id,
          {
            qty: 0,
            disposition: 'RESTOCK',
            newCost: item.cost ?? '0.00'
          }
        ])
      )
  );
  const [replacementLines, setReplacementLines] = useState<ReplacementLineState[]>([]);
  const [refundPayments, setRefundPayments] = useState<PaymentLine[]>([
    createPaymentLine(mode === 'void' ? Number(sale.totalAmount).toFixed(2) : '')
  ]);
  const [exchangePayments, setExchangePayments] = useState<PaymentLine[]>([createPaymentLine('')]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const filteredProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products.slice(0, 25);
    return products
      .filter((product) =>
        [product.name, product.sku ?? '', product.barcode ?? ''].join(' ').toLowerCase().includes(term)
      )
      .slice(0, 25);
  }, [products, query]);

  const selectedReturns = useMemo(
    () =>
      sale.items
        .map((item) => {
          const state = returnLines[item.id];
          const qty = Math.min(state?.qty ?? 0, item.refundableQty);
          if (qty <= 0) return null;
          const remainingCredit = toNumber(item.refundableAmount);
          const fullCredit = toNumber(item.fullCreditAmount);
          const lineCredit =
            qty === item.refundableQty ? remainingCredit : roundCurrency((fullCredit / item.qty) * qty);
          return {
            saleItemId: item.id,
            productName: item.productName,
            qty,
            disposition: state?.disposition ?? 'RESTOCK',
            lineCredit: roundCurrency(lineCredit),
            newCost: state?.newCost ? toNumber(state.newCost) : undefined
          };
        })
        .filter(Boolean) as Array<{
        saleItemId: string;
        productName: string;
        qty: number;
        disposition: 'RESTOCK' | 'DAMAGED';
        lineCredit: number;
        newCost?: number;
      }>,
    [returnLines, sale.items]
  );

  const returnCredit = useMemo(
    () => roundCurrency(selectedReturns.reduce((sum, item) => sum + item.lineCredit, 0)),
    [selectedReturns]
  );

  const selectedReplacementLines = useMemo(
    () =>
      replacementLines
        .map((line) => {
          const product = productMap.get(line.productId);
          if (!product || line.qty <= 0) return null;
          return {
            ...line,
            product,
            lineTotal: roundCurrency(Number(product.price) * line.qty)
          };
        })
        .filter(Boolean) as Array<ReplacementLineState & { product: ProductOption; lineTotal: number }>,
    [productMap, replacementLines]
  );

  const replacementSubtotal = useMemo(
    () => roundCurrency(selectedReplacementLines.reduce((sum, item) => sum + item.lineTotal, 0)),
    [selectedReplacementLines]
  );
  const replacementTax = useMemo(() => roundCurrency(replacementSubtotal * (taxRate / 100)), [replacementSubtotal, taxRate]);
  const replacementGross = useMemo(() => roundCurrency(replacementSubtotal + replacementTax), [replacementSubtotal, replacementTax]);
  const appliedCredit = workflowType === 'EXCHANGE' ? Math.min(returnCredit, replacementGross) : 0;
  const refundDue = mode === 'void' ? roundCurrency(Number(sale.totalAmount)) : roundCurrency(returnCredit - appliedCredit);
  const exchangeDue = workflowType === 'EXCHANGE' ? roundCurrency(Math.max(replacementGross - appliedCredit, 0)) : 0;

  const normalizedRefundPayments = refundPayments
    .map((payment) => ({
      method: payment.method,
      amount: roundCurrency(toNumber(payment.amount)),
      referenceNumber: payment.referenceNumber.trim() || null
    }))
    .filter((payment) => payment.amount > 0);

  const normalizedExchangePayments = exchangePayments
    .map((payment) => ({
      method: payment.method,
      amount: roundCurrency(toNumber(payment.amount)),
      referenceNumber: payment.referenceNumber.trim() || null
    }))
    .filter((payment) => payment.amount > 0);

  const exchangeSummary = useMemo(
    () => getPaymentSummary(exchangeDue, normalizedExchangePayments),
    [exchangeDue, normalizedExchangePayments]
  );

  function updateRefundLine(lineId: string, patch: Partial<PaymentLine>) {
    setRefundPayments((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function updateExchangeLine(lineId: string, patch: Partial<PaymentLine>) {
    setExchangePayments((current) => current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  }

  function validateBeforeSubmit() {
    if (!reason.trim()) return t('errors.reasonRequired');
    if (!approverEmail.trim() || !approverPassword.trim()) return t('errors.approvalRequired');
    if (mode === 'void' && !sale.canVoid) return t('errors.cannotVoid');
    if (mode === 'refund' && !sale.canRefund) return t('errors.cannotAdjust');
    if (mode === 'refund' && !selectedReturns.length) return t('errors.selectReturnItem');
    if (workflowType === 'EXCHANGE' && !selectedReplacementLines.length) return t('errors.addReplacementItem');
    if (refundDue > 0) {
      if (!normalizedRefundPayments.length) return t('errors.addRefundPaymentLine');
      const refundTotal = roundCurrency(normalizedRefundPayments.reduce((sum, payment) => sum + payment.amount, 0));
      if (refundTotal !== refundDue) return t('errors.refundTotalMismatch');
      for (const payment of normalizedRefundPayments) {
        if (requiresReferenceNumber(payment.method) && !payment.referenceNumber) {
          return t('errors.refNumRequired', { method: payment.method });
        }
      }
    }
    if (exchangeDue > 0) {
      if (!normalizedExchangePayments.length) return t('errors.exchangePaymentDiff');
      if (exchangeSummary.totalPaid < exchangeDue) return t('errors.exchangeCoverBalance');
      if (!exchangeSummary.hasCashPayment && exchangeSummary.totalPaid !== exchangeDue) {
        return t('errors.exchangeExactBalance');
      }
      for (const payment of normalizedExchangePayments) {
        if (requiresReferenceNumber(payment.method) && !payment.referenceNumber) {
          return t('errors.refNumRequiredExchange', { method: payment.method });
        }
      }
    }
    return '';
  }

  async function submit() {
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    const endpoint = mode === 'void' ? `/api/sales/${sale.id}/void` : `/api/sales/${sale.id}/refund`;
    const payload =
      mode === 'void'
        ? {
            reason,
            notes: notes || null,
            approverEmail,
            approverPassword,
            refundPayments: normalizedRefundPayments
          }
        : {
            type: workflowType,
            reason,
            notes: notes || null,
            approverEmail,
            approverPassword,
            items: selectedReturns.map((item) => ({
              saleItemId: item.saleItemId,
              qty: item.qty,
              disposition: item.disposition,
              newCost: item.newCost
            })),
            replacementItems:
              workflowType === 'EXCHANGE'
                ? selectedReplacementLines.map((item) => ({
                    productId: item.productId,
                    qty: item.qty
                  }))
                : [],
            refundPayments: normalizedRefundPayments,
            exchangePayments: workflowType === 'EXCHANGE' ? normalizedExchangePayments : []
          };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({ error: t('errors.unableToComplete') }));
      setLoading(false);
      if (!response.ok || !data?.adjustment?.id) {
        setError(data?.error ?? t('errors.unableToComplete'));
        return;
      }
      router.push(`/print/refund/${data.adjustment.id}?autoprint=1`);
      router.refresh();
    } catch {
      setLoading(false);
      setError(t('errors.unableToComplete'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">
                {mode === 'void' ? t('voidSale') : t('refundAndExchange')}
              </div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">
                {sale.saleNumber} / {sale.receiptNumber}
              </h2>
              <p className="mt-2 text-sm text-stone-500">
                {t('customerLabel')} <span className="font-semibold text-stone-700">{sale.customerName ?? t('walkInCustomer')}</span>
                {' / '}
                {t('cashierLabel')} <span className="font-semibold text-stone-700">{sale.cashierName ?? t('cashierFallback')}</span>
              </p>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3 text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('saleTotal')}</div>
              <div className="mt-1 text-2xl font-black text-stone-950">{money(sale.totalAmount, currencySymbol)}</div>
              <div className="mt-1 text-xs text-stone-500">{sale.paymentMethod}</div>
            </div>
          </div>

          {mode === 'refund' ? (
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant={workflowType === 'REFUND' ? 'primary' : 'secondary'}
                onClick={() => setWorkflowType('REFUND')}
              >
                {t('refundBtn')}
              </Button>
              <Button
                type="button"
                variant={workflowType === 'EXCHANGE' ? 'primary' : 'secondary'}
                onClick={() => setWorkflowType('EXCHANGE')}
              >
                {t('exchangeBtn')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  setReturnLines((current) =>
                    Object.fromEntries(
                      sale.items.map((item) => [
                        item.id,
                        {
                          ...current[item.id],
                          qty: item.refundableQty
                        }
                      ])
                    )
                  )
                }
              >
                {t('selectAllBtn')}
              </Button>
            </div>
          ) : null}

          <div className="space-y-3">
            {sale.items.map((item) => {
              const line = returnLines[item.id];
              return (
                <div key={item.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="font-semibold text-stone-900">{item.productName}</div>
                      <div className="mt-1 text-sm text-stone-500">
                        {t('soldCount', { qty: item.qty })} / {t('refundedCount', { qty: item.refundedQty })} / {t('refundableCount', { qty: item.refundableQty })}
                      </div>
                      <div className="mt-2 text-sm text-stone-600">
                        {t('remainingValue', { value: money(item.refundableAmount, currencySymbol) })}
                      </div>
                    </div>
                    {mode === 'refund' ? (
                      <div className="flex flex-col gap-3">
                        <div className="grid gap-3 sm:grid-cols-[120px_170px_auto]">
                          <Input
                            type="number"
                            min="0"
                            max={item.refundableQty}
                            value={String(line?.qty ?? 0)}
                            onChange={(event) =>
                              setReturnLines((current) => ({
                                ...current,
                                [item.id]: {
                                  ...(current[item.id] ?? { disposition: 'RESTOCK', newCost: item.cost }),
                                  qty: Math.max(0, Math.min(item.refundableQty, Number(event.target.value)))
                                }
                              }))
                            }
                          />
                          <select
                            className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-blue-500"
                            value={line?.disposition ?? 'RESTOCK'}
                            onChange={(event) =>
                              setReturnLines((current) => ({
                                ...current,
                                [item.id]: {
                                  ...(current[item.id] ?? { qty: 0, newCost: item.cost }),
                                  disposition: event.target.value as ReturnLineState['disposition']
                                }
                              }))
                            }
                          >
                            <option value="RESTOCK">{t('returnToStock')}</option>
                            <option value="DAMAGED">{t('damagedDoNotRestock')}</option>
                          </select>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              setReturnLines((current) => ({
                                ...current,
                                [item.id]: {
                                  ...(current[item.id] ?? { disposition: 'RESTOCK', newCost: item.cost }),
                                  qty: item.refundableQty
                                }
                              }))
                            }
                          >
                            {t('maxBtn')}
                          </Button>
                        </div>
                        {item.productType === 'MOTORCYCLE' && (line?.qty ?? 0) > 0 && line?.disposition === 'RESTOCK' ? (
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 p-3 rounded-2xl border border-stone-150 bg-stone-50/50">
                            <span className="text-sm font-semibold text-stone-600">{t('newCostLabel')}:</span>
                            <div className="w-48">
                              <Input
                                type="number"
                                step="0.01"
                                placeholder={t('newCostPlaceholder')}
                                value={line?.newCost ?? ''}
                                onChange={(event) =>
                                  setReturnLines((current) => ({
                                    ...current,
                                    [item.id]: {
                                      ...(current[item.id] ?? { qty: 0, disposition: 'RESTOCK' }),
                                      newCost: event.target.value
                                    }
                                  }))
                                }
                              />
                            </div>
                            <span className="text-xs text-stone-500">({t('originalCost')}: {money(item.cost, currencySymbol)})</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {mode === 'refund' && workflowType === 'EXCHANGE' ? (
            <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('replacementItems')}</div>
                  <h3 className="mt-2 text-xl font-black text-stone-950">{t('buildExchangeSet')}</h3>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setReplacementLines((current) => [...current, { id: crypto.randomUUID(), productId: '', qty: 1 }])
                  }
                >
                  {t('addReplacementLine')}
                </Button>
              </div>

              <div className="mt-4">
                <Input
                  placeholder={t('filterPlaceholder')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>

              <div className="mt-4 space-y-3">
                {replacementLines.map((line) => {
                  const product = productMap.get(line.productId);
                  return (
                    <div key={line.id} className="grid gap-3 rounded-[22px] border border-stone-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_120px_auto]">
                      <select
                        className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-blue-500"
                        value={line.productId}
                        onChange={(event) =>
                          setReplacementLines((current) =>
                            current.map((item) => (item.id === line.id ? { ...item, productId: event.target.value } : item))
                          )
                        }
                      >
                        <option value="">{t('selectProductOption')}</option>
                        {filteredProducts.map((productOption) => (
                          <option key={productOption.id} value={productOption.id}>
                            {productOption.name} / {money(productOption.price, currencySymbol)} / {t('inStock', { qty: productOption.stockQty })}
                          </option>
                        ))}
                      </select>
                      <Input
                        type="number"
                        min="1"
                        value={String(line.qty)}
                        onChange={(event) =>
                          setReplacementLines((current) =>
                            current.map((item) =>
                              item.id === line.id ? { ...item, qty: Math.max(1, Number(event.target.value) || 1) } : item
                            )
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setReplacementLines((current) => current.filter((item) => item.id !== line.id))}
                      >
                        {t('removeBtn')}
                      </Button>
                      {product ? (
                        <div className="lg:col-span-3 text-sm text-stone-500">
                          {product.sku ?? t('noSKU')} / {product.barcode ?? t('noBarcode')} / {money(product.price, currencySymbol)} {t('each')}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {!replacementLines.length ? (
                  <div className="rounded-[22px] border border-dashed border-stone-300 bg-white px-4 py-5 text-sm text-stone-500">
                    {t('noReplacementAdded')}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{t('adjustmentControl')}</div>
          <h2 className="text-2xl font-black text-stone-950">{mode === 'void' ? t('voidConfirmation') : t('reasonPayoutApproval')}</h2>

          <Input placeholder={t('reasonPlaceholder')} value={reason} onChange={(event) => setReason(event.target.value)} />
          <Input placeholder={t('notesOptional')} value={notes} onChange={(event) => setNotes(event.target.value)} />
          <Input placeholder={t('managerEmail')} value={approverEmail} onChange={(event) => setApproverEmail(event.target.value)} />
          <Input type="password" placeholder={t('managerPassword')} value={approverPassword} onChange={(event) => setApproverPassword(event.target.value)} />

          <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
            <div className="flex justify-between"><span>{t('returnCredit')}</span><span>{money(mode === 'void' ? sale.totalAmount : returnCredit, currencySymbol)}</span></div>
            {mode === 'refund' && workflowType === 'EXCHANGE' ? (
              <>
                <div className="mt-2 flex justify-between"><span>{t('replacementSubtotal')}</span><span>{money(replacementSubtotal, currencySymbol)}</span></div>
                <div className="mt-2 flex justify-between"><span>{t('replacementTax')}</span><span>{money(replacementTax, currencySymbol)}</span></div>
                <div className="mt-2 flex justify-between"><span>{t('appliedCredit')}</span><span>-{money(appliedCredit, currencySymbol)}</span></div>
                <div className="mt-2 flex justify-between"><span>{t('exchangeDue')}</span><span>{money(exchangeDue, currencySymbol)}</span></div>
              </>
            ) : null}
            <div className="mt-3 flex justify-between border-t border-stone-200 pt-3 text-lg font-black text-stone-950">
              <span>{t('refundDue')}</span>
              <span>{money(refundDue, currencySymbol)}</span>
            </div>
          </div>

          {refundDue > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-stone-700">{t('refundPaymentLines')}</div>
              {refundPayments.map((payment) => (
                <div key={payment.id} className="rounded-[22px] border border-stone-200 bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_auto]">
                    <select className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-blue-500" value={payment.method} onChange={(event) => updateRefundLine(payment.id, { method: event.target.value as PaymentMethod })}>
                      {(['كاش', 'انستا باي', 'محفظه الكترونيه'] as const).map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                    <Input type="number" step="0.01" value={payment.amount} onChange={(event) => updateRefundLine(payment.id, { amount: event.target.value })} />
                    <Button type="button" variant="secondary" onClick={() => setRefundPayments((current) => current.length === 1 ? current : current.filter((line) => line.id !== payment.id))}>Remove</Button>
                  </div>
                  {requiresReferenceNumber(payment.method) ? <div className="mt-3"><Input placeholder={t('referenceNumber')} value={payment.referenceNumber} onChange={(event) => updateRefundLine(payment.id, { referenceNumber: event.target.value })} /></div> : null}
                </div>
              ))}
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={() => setRefundPayments((current) => [...current, createPaymentLine('')])}>{t('addRefundLine')}</Button>
                <Button type="button" variant="secondary" onClick={() => setRefundPayments((current) => current.map((line, index) => index === 0 ? { ...line, amount: refundDue.toFixed(2) } : { ...line, amount: '0' }))}>{t('setExactRefund')}</Button>
              </div>
            </div>
          ) : null}

          {mode === 'refund' && workflowType === 'EXCHANGE' && exchangeDue > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-stone-700">{t('exchangePaymentLines')}</div>
              {exchangePayments.map((payment) => (
                <div key={payment.id} className="rounded-[22px] border border-stone-200 bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_auto]">
                    <select className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-blue-500" value={payment.method} onChange={(event) => updateExchangeLine(payment.id, { method: event.target.value as PaymentMethod })}>
                      {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                    <Input type="number" step="0.01" value={payment.amount} onChange={(event) => updateExchangeLine(payment.id, { amount: event.target.value })} />
                    <Button type="button" variant="secondary" onClick={() => setExchangePayments((current) => current.length === 1 ? current : current.filter((line) => line.id !== payment.id))}>Remove</Button>
                  </div>
                  {requiresReferenceNumber(payment.method) ? <div className="mt-3"><Input placeholder={t('referenceNumber')} value={payment.referenceNumber} onChange={(event) => updateExchangeLine(payment.id, { referenceNumber: event.target.value })} /></div> : null}
                </div>
              ))}
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={() => setExchangePayments((current) => [...current, createPaymentLine('')])}>{t('addPaymentLine')}</Button>
                <Button type="button" variant="secondary" onClick={() => setExchangePayments((current) => current.map((line, index) => index === 0 ? { ...line, amount: exchangeDue.toFixed(2) } : { ...line, amount: '0' }))}>{t('setExactBalance')}</Button>
              </div>
            </div>
          ) : null}

          {!sale.canVoid && mode === 'void' ? <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{t('alreadyAdjusted')}</div> : null}
          {!sale.canRefund && mode === 'refund' ? <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{t('noRefundableQtyLeft')}</div> : null}
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <Button
            type="button"
            disabled={loading || (mode === 'void' ? !sale.canVoid : !sale.canRefund)}
            onClick={() => void submit()}
          >
            {loading ? t('processing') : mode === 'void' ? t('approveAndVoid') : workflowType === 'EXCHANGE' ? t('approveAndExchange') : t('approveAndRefund')}
          </Button>
        </Card>
      </div>
    </div>
  );
}
