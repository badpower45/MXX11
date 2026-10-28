'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money, shortDate } from '@/lib/format';
import { PAYMENT_METHODS } from '@/lib/payments';
import {
  CreatePurchaseStatus,
  getPayableStatusLabel,
  getPurchaseReceivedUnitQty,
  getPurchaseRemainingBaseQty,
  getPurchaseRemainingUnitQty,
  getPurchaseStatusLabel,
  payableStatusTone,
  purchaseStatusTone
} from '@/lib/purchases';
import { summarizeConversions } from '@/lib/uom-utils';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

type Supplier = { id: string; name: string };
type UnitOfMeasure = { id: string; code: string; name: string; isBase: boolean };
type Product = {
  id: string;
  name: string;
  cost: string;
  stockQty: number;
  baseUnitOfMeasureId: string | null;
  baseUnitOfMeasure?: UnitOfMeasure | null;
  uomConversions: Array<{
    id: string;
    unitOfMeasureId: string;
    ratioToBase: number;
    unitOfMeasure: UnitOfMeasure;
  }>;
};
type PurchaseItem = {
  id: string;
  productId: string;
  unitName: string;
  ratioToBase: number;
  receivedBaseQty: number;
  productName: string;
  qty: number;
  unitCost: string;
  lineTotal: string;
};
type PurchaseReceiptItem = {
  id: string;
  purchaseItemId: string;
  productId: string;
  qtyReceived: number;
  createdAt: string;
  product: { id: string; name: string };
};
type PurchaseReceipt = {
  id: string;
  receivedAt: string;
  notes: string | null;
  createdAt: string;
  receivedByUser: { id: string; name: string | null; email: string };
  items: PurchaseReceiptItem[];
};
type SupplierPayment = {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string | null;
  paidAt: string;
  createdAt: string;
  createdByUser: { id: string; name: string | null; email: string };
};
type AccountsPayableEntry = {
  id: string;
  amountDue: string;
  amountPaid: string;
  balance: string;
  status: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
};
type SupplierInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  payments?: SupplierPayment[];
  payableEntry?: AccountsPayableEntry | null;
};
export type Purchase = {
  id: string;
  purchaseNumber: string;
  totalAmount: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  receivedAt: string | null;
  supplier: { name: string };
  items: PurchaseItem[];
  receipts?: PurchaseReceipt[];
  supplierInvoice?: SupplierInvoice | null;
};
type Line = {
  productId: string;
  productName: string;
  unitOfMeasureId: string;
  unitName: string;
  ratioToBase: number;
  receivedBaseQty: number;
  qty: number;
  unitCost: number;
};
type ReceiptDraft = {
  receivedAt: string;
  notes: string;
  items: Record<string, string>;
};
type InvoiceDraft = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  notes: string;
};
type PaymentDraft = {
  method: string;
  amount: string;
  referenceNumber: string;
  paidAt: string;
};

function toDateInputValue(value = new Date()) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function isReceivable(status: string) {
  return status === 'DRAFT' || status === 'SENT' || status === 'PARTIALLY_RECEIVED';
}

function getAvailableStatusActions(status: string) {
  switch (status) {
    case 'DRAFT':
      return ['SENT', 'CANCELLED'] as const;
    case 'SENT':
      return ['DRAFT', 'CANCELLED'] as const;
    case 'PARTIALLY_RECEIVED':
      return ['CLOSED'] as const;
    case 'FULLY_RECEIVED':
      return ['CLOSED'] as const;
    default:
      return [] as const;
  }
}

function getStatusButtonLabel(status: string, t: any) {
  switch (status) {
    case 'SENT':
    case 'DRAFT':
    case 'CANCELLED':
    case 'CLOSED':
      return t('action_' + status);
    default:
      return t('status_' + status);
  }
}

function initializeReceiptDraft(purchase: Purchase): ReceiptDraft {
  return {
    receivedAt: toDateInputValue(),
    notes: '',
    items: Object.fromEntries(
      purchase.items.map((item) => [item.id, String(getPurchaseRemainingUnitQty(item))])
    )
  };
}

function initializeInvoiceDraft(purchase: Purchase): InvoiceDraft {
  return {
    invoiceNumber: purchase.supplierInvoice?.invoiceNumber ?? '',
    invoiceDate: purchase.supplierInvoice?.invoiceDate?.slice(0, 10) ?? toDateInputValue(),
    dueDate: purchase.supplierInvoice?.dueDate?.slice(0, 10) ?? toDateInputValue(),
    totalAmount: purchase.supplierInvoice?.totalAmount ?? purchase.totalAmount,
    notes: purchase.supplierInvoice?.notes ?? ''
  };
}

function initializePaymentDraft(invoice: SupplierInvoice | null | undefined): PaymentDraft {
  return {
    method: PAYMENT_METHODS[0],
    amount: invoice?.payableEntry?.balance ?? '0',
    referenceNumber: '',
    paidAt: toDateInputValue()
  };
}

export default function PurchaseManager({
  suppliers,
  products,
  units,
  purchases,
  currencySymbol
}: {
  suppliers: Supplier[];
  products: Product[];
  units: UnitOfMeasure[];
  purchases: Purchase[];
  currencySymbol: string;
}) {
  const t = useTranslations('purchases');
  const lp = useLocalizedPath();
  const [history, setHistory] = useState(purchases);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [status, setStatus] = useState<CreatePurchaseStatus>('DRAFT');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');
  const [selectedUnitId, setSelectedUnitId] = useState(
    products[0]?.uomConversions[0]?.unitOfMeasureId ?? products[0]?.baseUnitOfMeasureId ?? units[0]?.id ?? ''
  );
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState(products[0]?.cost ?? '0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [receiptDrafts, setReceiptDrafts] = useState<Record<string, ReceiptDraft>>({});
  const [invoiceDrafts, setInvoiceDrafts] = useState<Record<string, InvoiceDraft>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, PaymentDraft>>({});
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyPurchaseId, setBusyPurchaseId] = useState<string | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );
  const availableUnits = useMemo(() => {
    if (!selectedProduct) {
      return [];
    }

    const options = [];
    if (selectedProduct.baseUnitOfMeasure) {
      options.push({
        unitOfMeasureId: selectedProduct.baseUnitOfMeasure.id,
        unitName: selectedProduct.baseUnitOfMeasure.name,
        ratioToBase: 1
      });
    }

    for (const conversion of selectedProduct.uomConversions) {
      options.push({
        unitOfMeasureId: conversion.unitOfMeasureId,
        unitName: conversion.unitOfMeasure.name,
        ratioToBase: conversion.ratioToBase
      });
    }

    return options;
  }, [selectedProduct]);
  const selectedUnit = availableUnits.find((unit) => unit.unitOfMeasureId === selectedUnitId) ?? availableUnits[0] ?? null;
  const lineTotal = lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
  const canCreatePurchase = suppliers.length > 0 && products.length > 0;
  const missingSetup = [
    suppliers.length === 0 ? { href: lp('/suppliers'), label: t('addSupplier') } : null,
    products.length === 0 ? { href: lp('/products'), label: t('addProduct') } : null
  ].filter((item): item is { href: string; label: string } => Boolean(item));

  function replacePurchase(updatedPurchase: Purchase) {
    setHistory((currentHistory) =>
      currentHistory.map((purchase) => (purchase.id === updatedPurchase.id ? updatedPurchase : purchase))
    );
  }

  function addLine() {
    setError('');
    setSuccess('');

    if (!selectedProduct) {
      setError(t('selectProductError'));
      return;
    }

    if (!selectedUnit) {
      setError(t('selectUnitError'));
      return;
    }

    const parsedQty = Number(qty);
    const parsedCost = Number(unitCost);

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError(t('qtyPositiveError'));
      return;
    }

    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setError(t('costPositiveError'));
      return;
    }

    setLines((currentLines) => {
      const existing = currentLines.find(
        (line) => line.productId === selectedProduct.id && line.unitOfMeasureId === selectedUnit.unitOfMeasureId
      );
      if (existing) {
        return currentLines.map((line) =>
          line.productId === selectedProduct.id && line.unitOfMeasureId === selectedUnit.unitOfMeasureId
            ? {
                ...line,
                qty: line.qty + parsedQty,
                receivedBaseQty: (line.qty + parsedQty) * line.ratioToBase,
                unitCost: parsedCost
              }
            : line
        );
      }

      return [
        ...currentLines,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          unitOfMeasureId: selectedUnit.unitOfMeasureId,
          unitName: selectedUnit.unitName,
          ratioToBase: selectedUnit.ratioToBase,
          receivedBaseQty: parsedQty * selectedUnit.ratioToBase,
          qty: parsedQty,
          unitCost: parsedCost
        }
      ];
    });
    setQty('1');
  }

  function removeLine(productId: string, unitOfMeasureId: string) {
    setLines((currentLines) =>
      currentLines.filter((line) => !(line.productId === productId && line.unitOfMeasureId === unitOfMeasureId))
    );
  }

  async function createPurchase() {
    setError('');
    setSuccess('');

    if (!supplierId) {
      setError(t('selectSupplierError'));
      return;
    }

    if (!lines.length) {
      setError(t('addOneLineError'));
      return;
    }

    setLoading(true);

    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId,
        status,
        notes: notes || null,
        items: lines.map((line) => ({
          productId: line.productId,
          unitOfMeasureId: line.unitOfMeasureId,
          qty: line.qty,
          unitCost: line.unitCost
        }))
      })
    });

    const data = await response.json().catch(() => ({ error: t('failedCreate') }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? t('failedCreate'));
      return;
    }

    setHistory((currentHistory) => [data.purchase, ...currentHistory]);
    setLines([]);
    setNotes('');
    setStatus('DRAFT');
    setSuccess(
      status === 'FULLY_RECEIVED'
        ? t('purchaseCreatedFullyReceived')
        : status === 'SENT'
          ? t('purchaseOrderCreatedSent')
          : t('purchaseSavedAwaiting')
    );
  }

  async function updateStatus(purchaseId: string, nextStatus: string) {
    setBusyPurchaseId(purchaseId);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/purchases/${purchaseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_STATUS', status: nextStatus })
    });

    const data = await response.json().catch(() => ({ error: t('failedUpdate') }));
    setBusyPurchaseId(null);

    if (!response.ok) {
      setError(data.error ?? t('failedUpdate'));
      return;
    }

    replacePurchase(data.purchase);
    setSuccess(t('purchaseUpdated'));
  }

  async function receivePurchase(purchase: Purchase) {
    const draft = receiptDrafts[purchase.id] ?? initializeReceiptDraft(purchase);
    const items = purchase.items
      .map((item) => ({
        purchaseItemId: item.id,
        qtyReceived: Number(draft.items[item.id] ?? 0)
      }))
      .filter((item) => Number.isFinite(item.qtyReceived) && item.qtyReceived > 0);

    if (!items.length) {
      setError(t('deliveryQtyError'));
      return;
    }

    setBusyPurchaseId(purchase.id);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/purchases/${purchase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RECEIVE',
        receivedAt: draft.receivedAt,
        notes: draft.notes || null,
        items
      })
    });

    const data = await response.json().catch(() => ({ error: t('failedRecordReceipt') }));
    setBusyPurchaseId(null);

    if (!response.ok) {
      setError(data.error ?? t('failedRecordReceipt'));
      return;
    }

    replacePurchase(data.purchase);
    setReceiptDrafts((current) => ({
      ...current,
      [purchase.id]: initializeReceiptDraft(data.purchase)
    }));
    setActiveReceiptId(null);
    setSuccess(t('deliverySuccess'));
  }

  async function saveInvoice(purchase: Purchase) {
    const draft = invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase);

    setBusyPurchaseId(purchase.id);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/purchases/${purchase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPSERT_INVOICE',
        invoiceNumber: draft.invoiceNumber,
        invoiceDate: draft.invoiceDate,
        dueDate: draft.dueDate,
        totalAmount: Number(draft.totalAmount),
        notes: draft.notes || null
      })
    });

    const data = await response.json().catch(() => ({ error: t('failedSaveInvoice') }));
    setBusyPurchaseId(null);

    if (!response.ok) {
      setError(data.error ?? t('failedSaveInvoice'));
      return;
    }

    replacePurchase(data.purchase);
    setInvoiceDrafts((current) => ({
      ...current,
      [purchase.id]: initializeInvoiceDraft(data.purchase)
    }));
    setActiveInvoiceId(null);
    setSuccess(purchase.supplierInvoice ? t('invoiceUpdated') : t('invoiceRecorded'));
  }

  async function recordPayment(purchase: Purchase) {
    const draft = paymentDrafts[purchase.id] ?? initializePaymentDraft(purchase.supplierInvoice);

    setBusyPurchaseId(purchase.id);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/purchases/${purchase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RECORD_PAYMENT',
        method: draft.method,
        amount: Number(draft.amount),
        referenceNumber: draft.referenceNumber || null,
        paidAt: draft.paidAt
      })
    });

    const data = await response.json().catch(() => ({ error: t('failedRecordPayment') }));
    setBusyPurchaseId(null);

    if (!response.ok) {
      setError(data.error ?? t('failedRecordPayment'));
      return;
    }

    replacePurchase(data.purchase);
    setPaymentDrafts((current) => ({
      ...current,
      [purchase.id]: initializePaymentDraft(data.purchase.supplierInvoice)
    }));
    setActivePaymentId(null);
    setSuccess(t('paymentRecorded'));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <div id="record-purchase" className="mb-4 text-lg font-black text-stone-900">{t('entryTitle')}</div>
        {!canCreatePurchase ? (
          <div className="space-y-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-600">
            <div className="font-semibold text-stone-900">{t('noSupplierAndProductSetup')}</div>
            <div>{t('completeSetupCta')}</div>
            <div className="flex flex-wrap gap-3">
              {missingSetup.map((item) => (
                <Link key={item.href} href={item.href} className="font-semibold text-blue-700 hover:text-blue-800">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <select
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>

            <select
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as CreatePurchaseStatus)}
            >
              <option value="DRAFT">{t('saveAsAwaiting')}</option>
              <option value="SENT">{t('saveAsOrderSent')}</option>
              <option value="FULLY_RECEIVED">{t('createAndReceive')}</option>
            </select>

            <div className="grid gap-3 md:grid-cols-4">
              <select
                className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
                value={selectedProductId}
                onChange={(event) => {
                  setSelectedProductId(event.target.value);
                  const hit = products.find((product) => product.id === event.target.value);
                  if (hit) {
                    setUnitCost(hit.cost);
                    setSelectedUnitId(hit.uomConversions[0]?.unitOfMeasureId ?? hit.baseUnitOfMeasureId ?? '');
                  }
                }}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
                value={selectedUnitId}
                onChange={(event) => setSelectedUnitId(event.target.value)}
              >
                {availableUnits.map((unit) => (
                  <option key={unit.unitOfMeasureId} value={unit.unitOfMeasureId}>
                    {unit.unitName}
                  </option>
                ))}
              </select>
              <Input type="number" min={1} value={qty} onChange={(event) => setQty(event.target.value)} />
              <Input type="number" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
            </div>

            {selectedProduct ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                {t('currentStockFor', {
                  name: selectedProduct.name,
                  qty: selectedProduct.stockQty,
                  unit: selectedProduct.baseUnitOfMeasure?.name ?? t('baseUnits')
                })}
                <div className="mt-1 text-xs text-stone-500">
                  {summarizeConversions(
                    selectedProduct.uomConversions.map((conversion) => ({
                      unitName: conversion.unitOfMeasure.name,
                      ratioToBase: conversion.ratioToBase
                    })),
                    selectedProduct.baseUnitOfMeasure?.name
                  )}
                </div>
                {selectedUnit ? (
                  <div className="mt-1 text-xs text-stone-500">
                    {t('receiptPreview', {
                      qty: qty || '0',
                      unit: selectedUnit.unitName,
                      baseQty: (Number(qty) || 0) * selectedUnit.ratioToBase,
                      baseUnit: selectedProduct.baseUnitOfMeasure?.name ?? t('baseUnits')
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}

            <Button type="button" variant="secondary" onClick={addLine}>{t('addLine')}</Button>
            <textarea
              className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              placeholder={t('notesPlaceholder')}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />

            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              {lines.length ? (
                lines.map((line) => (
                  <div key={`${line.productId}-${line.unitOfMeasureId}`} className="flex items-center justify-between gap-3 text-sm text-stone-700">
                    <span>
                      {line.productName} | {line.qty} {line.unitName} x {money(line.unitCost, currencySymbol)}
                      <span className="ml-2 text-xs text-stone-500">
                        ({line.receivedBaseQty} {selectedProduct?.baseUnitOfMeasure?.name ?? t('baseUnits')})
                      </span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span>{money(line.qty * line.unitCost, currencySymbol)}</span>
                      <Button type="button" variant="ghost" onClick={() => removeLine(line.productId, line.unitOfMeasureId)}>
                        {t('remove')}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-stone-500">{t('noLines')}</div>
              )}
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              {t('estimatedTotal')}: <span className="font-semibold text-stone-950">{money(lineTotal, currencySymbol)}</span>
            </div>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{success}</div> : null}

            <Button onClick={createPurchase} disabled={!lines.length || loading}>
              {loading ? t('savingPurchase') : t('savePurchase')}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 text-lg font-black text-stone-900">{t('historyTitle')}</div>
        <div className="space-y-4">
          {history.length ? (
            history.map((purchase) => {
              const invoice = purchase.supplierInvoice ?? null;
              const outstandingBalance = Number(invoice?.payableEntry?.balance ?? 0);
              const statusActions = getAvailableStatusActions(purchase.status);

              return (
                <div key={purchase.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-stone-900">{purchase.purchaseNumber}</div>
                      <div className="text-sm text-stone-500">{purchase.supplier.name}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={purchaseStatusTone(purchase.status)}>{t('status_' + purchase.status)}</Badge>
                        <Badge tone="blue">{t('linesCount', { count: purchase.items.length })}</Badge>
                        {invoice?.payableEntry ? (
                          <Badge tone={payableStatusTone(invoice.payableEntry.status)}>
                            {t('payable_' + invoice.payableEntry.status)}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-stone-900">{money(purchase.totalAmount, currencySymbol)}</div>
                      <div className="text-xs text-stone-500">{t('createdDate', { date: dateTime(purchase.createdAt) })}</div>
                      {purchase.receivedAt ? (
                        <div className="text-xs text-stone-500">{t('lastReceiptDate', { date: dateTime(purchase.receivedAt) })}</div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-2xl bg-stone-50 p-4 text-sm text-stone-700">
                    {purchase.items.map((item) => {
                      const receivedUnits = getPurchaseReceivedUnitQty(item);
                      const remainingUnits = getPurchaseRemainingUnitQty(item);
                      const remainingBaseQty = getPurchaseRemainingBaseQty(item);

                      return (
                        <div key={item.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="font-semibold text-stone-900">{item.productName}</div>
                              <div className="text-xs text-stone-500">
                                {t('orderedQtyInfo', { qty: item.qty, unit: item.unitName, received: receivedUnits, remaining: remainingUnits })}
                              </div>
                              <div className="mt-1 text-xs text-stone-500">
                                {t('remainingBaseQty', { qty: remainingBaseQty })}
                              </div>
                            </div>
                            <div className="text-sm font-semibold text-stone-700">
                              {money(item.lineTotal, currencySymbol)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {purchase.notes ? (
                    <div className="mt-3 text-sm text-stone-500">{t('notesLabel', { notes: purchase.notes })}</div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {statusActions.map((nextStatus) => (
                      <Button
                        key={nextStatus}
                        type="button"
                        variant={nextStatus === 'CANCELLED' ? 'danger' : 'secondary'}
                        onClick={() => updateStatus(purchase.id, nextStatus)}
                        disabled={busyPurchaseId === purchase.id}
                      >
                        {getStatusButtonLabel(nextStatus, t)}
                      </Button>
                    ))}
                    {isReceivable(purchase.status) ? (
                        <Button
                        type="button"
                        onClick={() => {
                          setReceiptDrafts((current) => ({
                            ...current,
                            [purchase.id]: current[purchase.id] ?? initializeReceiptDraft(purchase)
                          }));
                          setActiveReceiptId((current) => (current === purchase.id ? null : purchase.id));
                        }}
                        disabled={busyPurchaseId === purchase.id}
                      >
                        {t('receiveDelivery')}
                      </Button>
                    ) : null}
                    {purchase.status !== 'CANCELLED' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setInvoiceDrafts((current) => ({
                            ...current,
                            [purchase.id]: current[purchase.id] ?? initializeInvoiceDraft(purchase)
                          }));
                          setActiveInvoiceId((current) => (current === purchase.id ? null : purchase.id));
                        }}
                        disabled={busyPurchaseId === purchase.id}
                      >
                        {t('saveInvoice')}
                      </Button>
                    ) : null}
                    {invoice ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          setPaymentDrafts((current) => ({
                            ...current,
                            [purchase.id]: current[purchase.id] ?? initializePaymentDraft(invoice)
                          }));
                          setActivePaymentId((current) => (current === purchase.id ? null : purchase.id));
                        }}
                        disabled={busyPurchaseId === purchase.id || outstandingBalance <= 0}
                      >
                        {t('recordPayment')}
                      </Button>
                    ) : null}
                  </div>

                  {activeReceiptId === purchase.id ? (
                    <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                        <div className="text-sm font-semibold text-stone-900">{t('receiveDelivery')}</div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Input
                          type="date"
                          value={(receiptDrafts[purchase.id] ?? initializeReceiptDraft(purchase)).receivedAt}
                          onChange={(event) =>
                            setReceiptDrafts((current) => ({
                              ...current,
                              [purchase.id]: {
                                ...(current[purchase.id] ?? initializeReceiptDraft(purchase)),
                                receivedAt: event.target.value
                              }
                            }))
                          }
                        />
                        <Input
                          placeholder={t('deliveryNotes')}
                          value={(receiptDrafts[purchase.id] ?? initializeReceiptDraft(purchase)).notes}
                          onChange={(event) =>
                            setReceiptDrafts((current) => ({
                              ...current,
                              [purchase.id]: {
                                ...(current[purchase.id] ?? initializeReceiptDraft(purchase)),
                                notes: event.target.value
                              }
                            }))
                          }
                        />
                      </div>
                      <div className="mt-4 space-y-3">
                        {purchase.items.map((item) => (
                          <div key={item.id} className="grid gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 md:grid-cols-[1fr_120px] md:items-center">
                            <div>
                              <div className="font-semibold text-stone-900">{item.productName}</div>
                              <div className="text-xs text-stone-500">
                                {t('remainingUnitQty', { qty: getPurchaseRemainingUnitQty(item), unit: item.unitName })}
                              </div>
                            </div>
                            <Input
                              type="number"
                              min={0}
                              max={getPurchaseRemainingUnitQty(item)}
                              value={(receiptDrafts[purchase.id] ?? initializeReceiptDraft(purchase)).items[item.id] ?? ''}
                              onChange={(event) =>
                                setReceiptDrafts((current) => ({
                                  ...current,
                                  [purchase.id]: {
                                    ...(current[purchase.id] ?? initializeReceiptDraft(purchase)),
                                    items: {
                                      ...(current[purchase.id] ?? initializeReceiptDraft(purchase)).items,
                                      [item.id]: event.target.value
                                    }
                                  }
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button type="button" onClick={() => receivePurchase(purchase)} disabled={busyPurchaseId === purchase.id}>
                          {busyPurchaseId === purchase.id ? t('savingReceipt') : t('saveReceipt')}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => setActiveReceiptId(null)}>
                          {t('hide')}
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">{t('receiveHistoryTitle')}</div>
                        <div className="text-xs text-stone-500">{t('deliveryStatsUpdateMsg')}</div>
                      </div>
                      <div className="text-xs text-stone-500">{t('receiptsCount', { count: purchase.receipts?.length ?? 0 })}</div>
                    </div>
                    <div className="mt-3 space-y-3">
                      {purchase.receipts?.length ? (
                        purchase.receipts.map((receipt) => (
                          <div key={receipt.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <div className="font-semibold text-stone-900">{dateTime(receipt.receivedAt)}</div>
                                <div className="text-xs text-stone-500">
                                  {t('receivedBy', { user: receipt.receivedByUser.name ?? receipt.receivedByUser.email })}
                                </div>
                              </div>
                              {receipt.notes ? <div className="text-sm text-stone-500">{receipt.notes}</div> : null}
                            </div>
                            <div className="mt-3 space-y-2 text-sm text-stone-600">
                              {receipt.items.map((item) => (
                                <div key={item.id} className="flex justify-between">
                                  <span>{item.product.name}</span>
                                  <span>{t('qtyReceivedLabel', { qty: item.qtyReceived })}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-stone-500">{t('noDeliveries')}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-stone-900">{t('supplierInvoiceAndPayableTitle')}</div>
                        <div className="text-xs text-stone-500">{t('supplierInvoiceAndPayableDesc')}</div>
                      </div>
                      {invoice?.payableEntry ? (
                        <div className="text-right">
                          <div className="text-xs text-stone-500">{t('outstanding')}</div>
                          <div className="font-black text-stone-900">{money(invoice.payableEntry.balance, currencySymbol)}</div>
                        </div>
                      ) : null}
                    </div>

                    {invoice ? (
                      <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-4 py-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="font-semibold text-stone-900">{invoice.invoiceNumber}</div>
                            <div className="mt-1 flex flex-wrap gap-2">
                              <Badge tone={payableStatusTone(invoice.paymentStatus)}>
                                {t('payable_' + invoice.paymentStatus)}
                              </Badge>
                              <Badge tone="stone">{t('dueLabel', { date: shortDate(invoice.dueDate) })}</Badge>
                            </div>
                          </div>
                          <div className="text-right text-sm text-stone-600">
                            <div>{t('totalLabel', { amount: money(invoice.totalAmount, currencySymbol) })}</div>
                            <div>{t('paidLabel', { amount: money(invoice.payableEntry?.amountPaid ?? '0', currencySymbol) })}</div>
                            <div>{t('balanceLabel', { amount: money(invoice.payableEntry?.balance ?? '0', currencySymbol) })}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-stone-500">
                          {t('invoiceDateLabel', { date: shortDate(invoice.invoiceDate) })}
                          {invoice.notes ? ` / ${invoice.notes}` : ''}
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="text-sm font-semibold text-stone-900">{t('paymentHistory')}</div>
                          {invoice.payments?.length ? (
                            invoice.payments.map((payment) => (
                              <div key={payment.id} className="flex flex-col gap-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="font-semibold text-stone-900">
                                    {payment.method} / {money(payment.amount, currencySymbol)}
                                  </div>
                                  <div className="text-xs text-stone-500">
                                    {dateTime(payment.paidAt)} / {payment.createdByUser.name ?? payment.createdByUser.email}
                                  </div>
                                </div>
                                <div className="text-xs text-stone-500">
                                  {payment.referenceNumber ? t('refLabel', { ref: payment.referenceNumber }) : t('noRef')}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-stone-500">{t('noPaymentsRecorded')}</div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-stone-500">{t('noInvoiceRecorded')}</div>
                    )}

                    {activeInvoiceId === purchase.id ? (
                      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            placeholder={t('invoiceNumber')}
                            value={(invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase)).invoiceNumber}
                            onChange={(event) =>
                              setInvoiceDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializeInvoiceDraft(purchase)),
                                  invoiceNumber: event.target.value
                                }
                              }))
                            }
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={t('invoiceTotal')}
                            value={(invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase)).totalAmount}
                            onChange={(event) =>
                              setInvoiceDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializeInvoiceDraft(purchase)),
                                  totalAmount: event.target.value
                                }
                              }))
                            }
                          />
                          <Input
                            type="date"
                            value={(invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase)).invoiceDate}
                            onChange={(event) =>
                              setInvoiceDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializeInvoiceDraft(purchase)),
                                  invoiceDate: event.target.value
                                }
                              }))
                            }
                          />
                          <Input
                            type="date"
                            value={(invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase)).dueDate}
                            onChange={(event) =>
                              setInvoiceDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializeInvoiceDraft(purchase)),
                                  dueDate: event.target.value
                                }
                              }))
                            }
                          />
                        </div>
                        <textarea
                          className="mt-3 min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                          placeholder={t('notesPlaceholder')}
                          value={(invoiceDrafts[purchase.id] ?? initializeInvoiceDraft(purchase)).notes}
                          onChange={(event) =>
                            setInvoiceDrafts((current) => ({
                              ...current,
                              [purchase.id]: {
                                ...(current[purchase.id] ?? initializeInvoiceDraft(purchase)),
                                notes: event.target.value
                              }
                            }))
                          }
                        />
                        <div className="mt-4 flex gap-2">
                          <Button type="button" onClick={() => saveInvoice(purchase)} disabled={busyPurchaseId === purchase.id}>
                            {busyPurchaseId === purchase.id ? t('savingInvoice') : t('saveInvoice')}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setActiveInvoiceId(null)}>
                            {t('hide')}
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {activePaymentId === purchase.id && invoice ? (
                      <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <select
                            className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
                            value={(paymentDrafts[purchase.id] ?? initializePaymentDraft(invoice)).method}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializePaymentDraft(invoice)),
                                  method: event.target.value
                                }
                              }))
                            }
                          >
                            {PAYMENT_METHODS.map((method) => (
                              <option key={method} value={method}>
                                {method}
                              </option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={t('amount')}
                            value={(paymentDrafts[purchase.id] ?? initializePaymentDraft(invoice)).amount}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializePaymentDraft(invoice)),
                                  amount: event.target.value
                                }
                              }))
                            }
                          />
                          <Input
                            placeholder={t('referenceNumber')}
                            value={(paymentDrafts[purchase.id] ?? initializePaymentDraft(invoice)).referenceNumber}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializePaymentDraft(invoice)),
                                  referenceNumber: event.target.value
                                }
                              }))
                            }
                          />
                          <Input
                            type="date"
                            value={(paymentDrafts[purchase.id] ?? initializePaymentDraft(invoice)).paidAt}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [purchase.id]: {
                                  ...(current[purchase.id] ?? initializePaymentDraft(invoice)),
                                  paidAt: event.target.value
                                }
                              }))
                            }
                          />
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Button type="button" onClick={() => recordPayment(purchase)} disabled={busyPurchaseId === purchase.id}>
                            {busyPurchaseId === purchase.id ? t('savingPayment') : t('recordPayment')}
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setActivePaymentId(null)}>
                            {t('hide')}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-stone-500">{t('noPurchasesRecorded')}</div>
          )}
        </div>
      </Card>
    </div>
  );
}
