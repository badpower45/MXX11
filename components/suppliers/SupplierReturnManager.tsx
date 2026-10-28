'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from '@/lib/i18n/client';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money, shortDate } from '@/lib/format';
import {
  getSupplierCreditMemoStatusLabel,
  getSupplierReturnDispositionLabel,
  getSupplierReturnReasonLabel,
  getSupplierReturnStatusLabel,
  supplierCreditMemoStatusTone,
  supplierReturnStatusTone,
  SupplierCreditMemoStatusValue,
  SupplierReturnCreateStatus,
  SupplierReturnDispositionValue,
  SupplierReturnReasonValue
} from '@/lib/supplier-returns';

type Supplier = { id: string; name: string; isActive?: boolean };
type Product = { id: string; name: string; cost: string; stockQty: number; isActive?: boolean };
type SupplierReturnItem = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  qty: number;
  unitCost: string;
  lineTotal: string;
  reason: string;
  disposition: string;
  createdAt: string;
};

export type SupplierReturn = {
  id: string;
  returnNumber: string;
  status: string;
  reasonSummary: string;
  notes: string | null;
  creditMemoNumber: string | null;
  creditMemoDate: string | null;
  creditAmount: string;
  creditMemoStatus: string;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  supplier: { id: string; name: string };
  createdByUser: { id: string; name: string | null; email: string };
  approvedByUser?: { id: string; name: string | null; email: string } | null;
  items: SupplierReturnItem[];
};

type Line = {
  productId: string;
  productNameSnapshot: string;
  qty: number;
  unitCost: number;
  reason: SupplierReturnReasonValue;
  disposition: SupplierReturnDispositionValue;
};

type CreditDraft = {
  creditMemoNumber: string;
  creditMemoDate: string;
  creditAmount: string;
  creditMemoStatus: SupplierCreditMemoStatusValue;
  notes: string;
};

const RETURN_REASONS: SupplierReturnReasonValue[] = [
  'DAMAGED_FROM_SUPPLIER',
  'WRONG_ITEM',
  'OVER_DELIVERY',
  'EXPIRED_ON_RECEIPT',
  'QUALITY_ISSUE'
];

const RETURN_DISPOSITIONS: SupplierReturnDispositionValue[] = ['SELLABLE', 'DAMAGED', 'EXPIRED'];

function toDateInputValue(value = new Date()) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function initializeCreditDraft(supplierReturn: SupplierReturn): CreditDraft {
  return {
    creditMemoNumber: supplierReturn.creditMemoNumber ?? '',
    creditMemoDate: supplierReturn.creditMemoDate?.slice(0, 10) ?? '',
    creditAmount: supplierReturn.creditAmount ?? '0',
    creditMemoStatus: (supplierReturn.creditMemoStatus as SupplierCreditMemoStatusValue) ?? 'PENDING',
    notes: supplierReturn.notes ?? ''
  };
}

export default function SupplierReturnManager({
  suppliers,
  products,
  supplierReturns,
  currencySymbol
}: {
  suppliers: Supplier[];
  products: Product[];
  supplierReturns: SupplierReturn[];
  currencySymbol: string;
}) {
  const t = useTranslations('suppliers.returns');

  const getLocalizedReason = (reason: string) => {
    switch (reason) {
      case 'DAMAGED_FROM_SUPPLIER': return t('reasonDamagedFromSupplier');
      case 'WRONG_ITEM': return t('reasonWrongItem');
      case 'OVER_DELIVERY': return t('reasonOverDelivery');
      case 'EXPIRED_ON_RECEIPT': return t('reasonExpiredOnReceipt');
      case 'QUALITY_ISSUE': return t('reasonQualityIssue');
      default: return reason.replaceAll('_', ' ');
    }
  };

  const getLocalizedDisposition = (disposition: string) => {
    switch (disposition) {
      case 'SELLABLE': return t('dispSellable');
      case 'DAMAGED': return t('dispDamaged');
      case 'EXPIRED': return t('dispExpired');
      default: return disposition.replaceAll('_', ' ');
    }
  };

  const getLocalizedReturnStatus = (status: string) => {
    switch (status) {
      case 'DRAFT': return t('statusDraft');
      case 'POSTED': return t('statusPosted');
      case 'CANCELLED': return t('statusCancelled');
      default: return status.replaceAll('_', ' ');
    }
  };

  const getLocalizedCreditMemoStatus = (status: string) => {
    switch (status) {
      case 'PENDING': return t('pending');
      case 'ISSUED': return t('issued');
      case 'APPLIED': return t('applied');
      default: return status.replaceAll('_', ' ');
    }
  };

  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive !== false);
  const activeProducts = products.filter((product) => product.isActive !== false);
  const [history, setHistory] = useState(supplierReturns);
  const [supplierId, setSupplierId] = useState(activeSuppliers[0]?.id ?? '');
  const [status, setStatus] = useState<SupplierReturnCreateStatus>('DRAFT');
  const [reasonSummary, setReasonSummary] = useState('');
  const [notes, setNotes] = useState('');
  const [creditMemoNumber, setCreditMemoNumber] = useState('');
  const [creditMemoDate, setCreditMemoDate] = useState('');
  const [creditAmount, setCreditAmount] = useState('0');
  const [creditMemoStatus, setCreditMemoStatus] = useState<SupplierCreditMemoStatusValue>('PENDING');
  const [selectedProductId, setSelectedProductId] = useState(activeProducts[0]?.id ?? '');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState(activeProducts[0]?.cost ?? '0');
  const [reason, setReason] = useState<SupplierReturnReasonValue>('DAMAGED_FROM_SUPPLIER');
  const [disposition, setDisposition] = useState<SupplierReturnDispositionValue>('DAMAGED');
  const [lines, setLines] = useState<Line[]>([]);
  const [creditDrafts, setCreditDrafts] = useState<Record<string, CreditDraft>>({});
  const [activeCreditId, setActiveCreditId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyReturnId, setBusyReturnId] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => activeProducts.find((product) => product.id === selectedProductId),
    [activeProducts, selectedProductId]
  );
  const returnTotal = lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
  const availableCreditTotal = history.reduce((sum, supplierReturn) => {
    if (supplierReturn.status === 'CANCELLED' || supplierReturn.creditMemoStatus === 'APPLIED') {
      return sum;
    }

    return sum + Number(supplierReturn.creditAmount ?? 0);
  }, 0);

  function replaceSupplierReturn(updatedReturn: SupplierReturn) {
    setHistory((current) =>
      current.map((supplierReturn) => (supplierReturn.id === updatedReturn.id ? updatedReturn : supplierReturn))
    );
  }

  function addLine() {
    setError('');
    setSuccess('');

    if (!selectedProduct) {
      setError(t('selectProduct'));
      return;
    }

    const parsedQty = Number(qty);
    const parsedUnitCost = Number(unitCost);

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError(t('quantityZeroError'));
      return;
    }

    if (!Number.isFinite(parsedUnitCost) || parsedUnitCost < 0) {
      setError(t('costZeroError'));
      return;
    }

    setLines((current) => [
      ...current,
      {
        productId: selectedProduct.id,
        productNameSnapshot: selectedProduct.name,
        qty: parsedQty,
        unitCost: parsedUnitCost,
        reason,
        disposition
      }
    ]);
    setQty('1');
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function createSupplierReturn() {
    setError('');
    setSuccess('');

    if (!supplierId) {
      setError(t('selectSupplier'));
      return;
    }

    if (!reasonSummary.trim()) {
      setError(t('reasonSummaryRequired'));
      return;
    }

    if (!lines.length) {
      setError(t('addReturnLine'));
      return;
    }

    setLoading(true);

    const response = await fetch('/api/suppliers/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId,
        status,
        reasonSummary,
        notes: notes || null,
        creditMemoNumber: creditMemoNumber || null,
        creditMemoDate: creditMemoDate || null,
        creditAmount: Number(creditAmount),
        creditMemoStatus,
        items: lines.map((line) => ({
          productId: line.productId,
          qty: line.qty,
          unitCost: line.unitCost,
          reason: line.reason,
          disposition: line.disposition
        }))
      })
    });

    const data = await response.json().catch(() => ({ error: t('failedCreateReturn') }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? t('failedCreateReturn'));
      return;
    }

    setHistory((current) => [data.supplierReturn, ...current]);
    setLines([]);
    setReasonSummary('');
    setNotes('');
    setCreditMemoNumber('');
    setCreditMemoDate('');
    setCreditAmount('0');
    setCreditMemoStatus('PENDING');
    setStatus('DRAFT');
    setSuccess(status === 'POSTED' ? t('postedSuccess') : t('draftSuccess'));
  }

  async function postSupplierReturn(supplierReturnId: string) {
    setBusyReturnId(supplierReturnId);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/suppliers/returns/${supplierReturnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'POST' })
    });

    const data = await response.json().catch(() => ({ error: t('failedPost') }));
    setBusyReturnId(null);

    if (!response.ok) {
      setError(data.error ?? t('failedPost'));
      return;
    }

    replaceSupplierReturn(data.supplierReturn);
    setSuccess(t('postReturnSuccess'));
  }

  async function cancelSupplierReturn(supplierReturnId: string) {
    setBusyReturnId(supplierReturnId);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/suppliers/returns/${supplierReturnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CANCEL' })
    });

    const data = await response.json().catch(() => ({ error: t('failedCancel') }));
    setBusyReturnId(null);

    if (!response.ok) {
      setError(data.error ?? t('failedCancel'));
      return;
    }

    replaceSupplierReturn(data.supplierReturn);
    setSuccess(t('cancelReturnSuccess'));
  }

  async function saveCreditMemo(supplierReturn: SupplierReturn) {
    const draft = creditDrafts[supplierReturn.id] ?? initializeCreditDraft(supplierReturn);

    setBusyReturnId(supplierReturn.id);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/suppliers/returns/${supplierReturn.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_CREDIT',
        creditMemoNumber: draft.creditMemoNumber || null,
        creditMemoDate: draft.creditMemoDate || null,
        creditAmount: Number(draft.creditAmount),
        creditMemoStatus: draft.creditMemoStatus,
        notes: draft.notes || null
      })
    });

    const data = await response.json().catch(() => ({ error: t('failedUpdateCredit') }));
    setBusyReturnId(null);

    if (!response.ok) {
      setError(data.error ?? t('failedUpdateCredit'));
      return;
    }

    replaceSupplierReturn(data.supplierReturn);
    setCreditDrafts((current) => ({
      ...current,
      [supplierReturn.id]: initializeCreditDraft(data.supplierReturn)
    }));
    setActiveCreditId(null);
    setSuccess(t('creditMemoUpdateSuccess'));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <div className="mb-4 text-lg font-black text-stone-900">{t('title')}</div>
        <div className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              {activeSuppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as SupplierReturnCreateStatus)}
            >
              <option value="DRAFT">{t('saveDraft')}</option>
              <option value="POSTED">{t('createPostNow')}</option>
            </select>
          </div>

          <Input placeholder={t('reasonSummaryPlaceholder')} value={reasonSummary} onChange={(event) => setReasonSummary(event.target.value)} />
          <textarea
            className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            placeholder={t('notesPlaceholder')}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="text-sm font-semibold text-stone-900">{t('creditMemo')}</div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input placeholder={t('creditMemoNumber')} value={creditMemoNumber} onChange={(event) => setCreditMemoNumber(event.target.value)} />
              <Input type="date" value={creditMemoDate} onChange={(event) => setCreditMemoDate(event.target.value)} />
              <Input type="number" step="0.01" value={creditAmount} placeholder={t('creditMemoAmount')} onChange={(event) => setCreditAmount(event.target.value)} />
              <select
                className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm"
                value={creditMemoStatus}
                onChange={(event) => setCreditMemoStatus(event.target.value as SupplierCreditMemoStatusValue)}
              >
                <option value="PENDING">{t('pending')}</option>
                <option value="ISSUED">{t('issued')}</option>
                <option value="APPLIED">{t('applied')}</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="grid gap-3 md:grid-cols-5">
              <select
                className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm md:col-span-2"
                value={selectedProductId}
                onChange={(event) => {
                  setSelectedProductId(event.target.value);
                  const hit = activeProducts.find((product) => product.id === event.target.value);
                  if (hit) {
                    setUnitCost(hit.cost);
                  }
                }}
              >
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <Input type="number" min={1} value={qty} onChange={(event) => setQty(event.target.value)} />
              <Input type="number" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
              <Button type="button" variant="secondary" onClick={addLine}>{t('addLine')}</Button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <select
                className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm"
                value={reason}
                onChange={(event) => setReason(event.target.value as SupplierReturnReasonValue)}
              >
                {RETURN_REASONS.map((entry) => (
                  <option key={entry} value={entry}>
                    {getLocalizedReason(entry)}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm"
                value={disposition}
                onChange={(event) => setDisposition(event.target.value as SupplierReturnDispositionValue)}
              >
                {RETURN_DISPOSITIONS.map((entry) => (
                  <option key={entry} value={entry}>
                    {getLocalizedDisposition(entry)}
                  </option>
                ))}
              </select>
            </div>

            {selectedProduct ? (
              <div className="mt-3 text-sm text-stone-600">
                {t('availableStock', { name: selectedProduct.name, qty: selectedProduct.stockQty })}
              </div>
            ) : null}

            <div className="mt-4 space-y-2">
              {lines.length ? (
                lines.map((line, index) => (
                  <div key={`${line.productId}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                    <div>
                      <div className="font-semibold text-stone-900">{line.productNameSnapshot}</div>
                      <div className="text-xs text-stone-500">
                        {t('unitsLabel', { qty: line.qty })} / {getLocalizedReason(line.reason)} / {getLocalizedDisposition(line.disposition)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>{money(line.qty * line.unitCost, currencySymbol)}</span>
                      <Button type="button" variant="ghost" onClick={() => removeLine(index)}>
                        {t('remove')}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-stone-500">{t('noLines')}</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            {t('returnTotal')} <span className="font-semibold text-stone-950">{money(returnTotal, currencySymbol)}</span>
          </div>

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{success}</div> : null}

          <Button onClick={createSupplierReturn} disabled={!lines.length || loading}>
            {loading ? t('savingReturn') : t('saveReturn')}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-black text-stone-900">{t('historyTitle')}</div>
            <div className="text-sm text-stone-500">{t('historyDesc')}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-stone-500">{t('availableCredits')}</div>
            <div className="text-2xl font-black text-stone-900">{money(availableCreditTotal, currencySymbol)}</div>
          </div>
        </div>

        <div className="space-y-4">
          {history.length ? (
            history.map((supplierReturn) => (
              <div key={supplierReturn.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-semibold text-stone-900">{supplierReturn.returnNumber}</div>
                    <div className="text-sm text-stone-500">{supplierReturn.supplier.name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={supplierReturnStatusTone(supplierReturn.status)}>
                        {getLocalizedReturnStatus(supplierReturn.status)}
                      </Badge>
                      <Badge tone={supplierCreditMemoStatusTone(supplierReturn.creditMemoStatus)}>
                        {getLocalizedCreditMemoStatus(supplierReturn.creditMemoStatus)}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right text-sm text-stone-600">
                    <div>{t('createdWhen', { date: dateTime(supplierReturn.createdAt) })}</div>
                    {supplierReturn.postedAt ? <div>{t('postedWhen', { date: dateTime(supplierReturn.postedAt) })}</div> : null}
                    <div>{t('creditAmount', { amount: money(supplierReturn.creditAmount, currencySymbol) })}</div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-stone-700">{supplierReturn.reasonSummary}</div>
                {supplierReturn.notes ? <div className="mt-1 text-sm text-stone-500">{t('notesPlaceholder')}: {supplierReturn.notes}</div> : null}

                <div className="mt-4 space-y-2 rounded-2xl bg-stone-50 p-4">
                  {supplierReturn.items.map((item) => (
                    <div key={item.id} className="flex flex-col gap-1 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold text-stone-900">{item.productNameSnapshot}</div>
                        <div className="text-xs text-stone-500">
                          {t('unitsLabel', { qty: item.qty })} / {getLocalizedReason(item.reason)} / {getLocalizedDisposition(item.disposition)}
                        </div>
                      </div>
                      <div>{money(item.lineTotal, currencySymbol)}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-stone-900">{t('creditMemo')}</div>
                      <div className="text-xs text-stone-500">
                        {supplierReturn.creditMemoNumber
                          ? `${supplierReturn.creditMemoNumber} / ${supplierReturn.creditMemoDate ? shortDate(supplierReturn.creditMemoDate) : t('noDate')}`
                          : t('noCreditMemo')}
                      </div>
                    </div>
                    <div className="font-semibold text-stone-900">{money(supplierReturn.creditAmount, currencySymbol)}</div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {supplierReturn.status === 'DRAFT' ? (
                      <Button type="button" onClick={() => postSupplierReturn(supplierReturn.id)} disabled={busyReturnId === supplierReturn.id}>
                        {busyReturnId === supplierReturn.id ? t('posting') : t('postReturn')}
                      </Button>
                    ) : null}
                    {supplierReturn.status === 'DRAFT' ? (
                      <Button type="button" variant="danger" onClick={() => cancelSupplierReturn(supplierReturn.id)} disabled={busyReturnId === supplierReturn.id}>
                        {t('cancelDraft')}
                      </Button>
                    ) : null}
                    {supplierReturn.status !== 'CANCELLED' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setCreditDrafts((current) => ({
                            ...current,
                            [supplierReturn.id]: current[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)
                          }));
                          setActiveCreditId((current) => (current === supplierReturn.id ? null : supplierReturn.id));
                        }}
                        disabled={busyReturnId === supplierReturn.id}
                      >
                        {t('updateCreditMemo')}
                      </Button>
                    ) : null}
                  </div>

                  {activeCreditId === supplierReturn.id ? (
                    <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          placeholder={t('creditMemoNumber')}
                          value={(creditDrafts[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)).creditMemoNumber}
                          onChange={(event) =>
                            setCreditDrafts((current) => ({
                              ...current,
                              [supplierReturn.id]: {
                                ...(current[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)),
                                creditMemoNumber: event.target.value
                              }
                            }))
                          }
                        />
                        <Input
                          type="date"
                          value={(creditDrafts[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)).creditMemoDate}
                          onChange={(event) =>
                            setCreditDrafts((current) => ({
                              ...current,
                              [supplierReturn.id]: {
                                ...(current[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)),
                                creditMemoDate: event.target.value
                              }
                            }))
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={t('creditMemoAmount')}
                          value={(creditDrafts[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)).creditAmount}
                          onChange={(event) =>
                            setCreditDrafts((current) => ({
                              ...current,
                              [supplierReturn.id]: {
                                ...(current[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)),
                                creditAmount: event.target.value
                              }
                            }))
                          }
                        />
                        <select
                          className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
                          value={(creditDrafts[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)).creditMemoStatus}
                          onChange={(event) =>
                            setCreditDrafts((current) => ({
                              ...current,
                              [supplierReturn.id]: {
                                ...(current[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)),
                                creditMemoStatus: event.target.value as SupplierCreditMemoStatusValue
                              }
                            }))
                          }
                        >
                          <option value="PENDING">{t('pending')}</option>
                          <option value="ISSUED">{t('issued')}</option>
                          <option value="APPLIED">{t('applied')}</option>
                        </select>
                      </div>
                      <textarea
                        className="mt-3 min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                        placeholder={t('notesPlaceholder')}
                        value={(creditDrafts[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)).notes}
                        onChange={(event) =>
                          setCreditDrafts((current) => ({
                            ...current,
                            [supplierReturn.id]: {
                              ...(current[supplierReturn.id] ?? initializeCreditDraft(supplierReturn)),
                              notes: event.target.value
                            }
                          }))
                        }
                      />
                      <div className="mt-4 flex gap-2">
                        <Button type="button" onClick={() => saveCreditMemo(supplierReturn)} disabled={busyReturnId === supplierReturn.id}>
                          {busyReturnId === supplierReturn.id ? t('saving') : t('saveCreditMemo')}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setActiveCreditId(null)}>
                          {t('hide')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-stone-500">{t('noReturns')}</div>
          )}
        </div>
      </Card>
    </div>
  );
}
