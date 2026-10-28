'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';
import { useTranslations } from '@/lib/i18n/client';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  stockQty: number;
  reorderPoint: number;
  trackBatches: boolean;
  trackExpiry: boolean;
  isActive: boolean;
};

type ProductBatch = {
  id: string;
  lotNumber: string;
  expiryDate: string | null;
  quantity: number;
  receivedAt: string;
  notes: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    trackBatches: boolean;
    trackExpiry: boolean;
  };
};

function batchTone(batch: ProductBatch, expiryAlertDays: number) {
  if (batch.quantity <= 0) {
    return 'stone';
  }

  if (batch.expiryDate) {
    const now = new Date();
    const expiry = new Date(batch.expiryDate);
    if (expiry.getTime() < now.getTime()) {
      return 'red';
    }

    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= expiryAlertDays) {
      return 'amber';
    }
  }

  return 'emerald';
}

function batchStatusLabel(batch: ProductBatch, expiryAlertDays: number, t: any) {
  if (batch.quantity <= 0) {
    return t('exhausted');
  }

  if (!batch.expiryDate) {
    return t('noExpiry');
  }

  const now = new Date();
  const expiry = new Date(batch.expiryDate);
  if (expiry.getTime() < now.getTime()) {
    return t('expired');
  }

  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= expiryAlertDays) {
    return t('nearExpiry');
  }

  return t('active');
}

export default function ProductBatchManager({
  products,
  initialBatches,
  inventoryFeatures
}: {
  products: Product[];
  initialBatches: ProductBatch[];
  inventoryFeatures: {
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    fefoEnabled: boolean;
    expiryAlertDays: number;
  };
}) {
  const router = useRouter();
  const t = useTranslations('inventory');
  const trackedProducts = useMemo(
    () => products.filter((product) => product.isActive && (product.trackBatches || product.trackExpiry)),
    [products]
  );
  const [batches, setBatches] = useState(initialBatches);
  const [productId, setProductId] = useState(trackedProducts[0]?.id ?? '');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedProduct = trackedProducts.find((product) => product.id === productId);
  const sortedBatches = useMemo(
    () =>
      [...batches].sort((left, right) => {
        if (left.expiryDate && right.expiryDate) {
          return new Date(left.expiryDate).getTime() - new Date(right.expiryDate).getTime();
        }

        if (left.expiryDate) {
          return -1;
        }

        if (right.expiryDate) {
          return 1;
        }

        return new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime();
      }),
    [batches]
  );

  const expiryAlerts = useMemo(
    () =>
      sortedBatches.filter((batch) => {
        if (!batch.expiryDate || batch.quantity <= 0) {
          return false;
        }

        const now = new Date();
        const expiry = new Date(batch.expiryDate);
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= inventoryFeatures.expiryAlertDays;
      }),
    [inventoryFeatures.expiryAlertDays, sortedBatches]
  );

  async function createBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!productId) {
      setError(t('selectTrackedProductError'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/products/${productId}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotNumber,
          expiryDate: expiryDate || null,
          quantity: Number(quantity),
          notes: notes || null
        })
      });

      const data = await response.json().catch(() => ({ error: t('saveBatchError') }));
      setLoading(false);

      if (!response.ok || !data?.batch) {
        setError(data?.error ?? t('saveBatchError'));
        return;
      }

      setBatches((current) => [data.batch, ...current]);
      setLotNumber('');
      setExpiryDate('');
      setQuantity('0');
      setNotes('');
      setSuccess(t('saveBatchSuccess'));
      router.refresh();
    } catch {
      setLoading(false);
      setError(t('saveBatchError'));
    }
  }

  if (!inventoryFeatures.batchTrackingEnabled && !inventoryFeatures.expiryTrackingEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
        {t('batchTrackingDisabled')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-stone-900">{t('batchManagerTitle')}</h2>
        <p className="mt-2 text-sm text-stone-500">
          {t('batchManagerDesc')}
        </p>
      </div>

      {inventoryFeatures.expiryTrackingEnabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700">{t('expiryAlertsLabel')}</div>
            <div className="mt-2 text-3xl font-black text-stone-950">{expiryAlerts.length}</div>
            <div className="mt-1 text-sm text-red-800">{t('expiryAlertsSub', { days: inventoryFeatures.expiryAlertDays })}</div>
          </div>
          <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('fefoModeLabel')}</div>
            <div className="mt-2 text-lg font-black text-stone-950">
              {inventoryFeatures.fefoEnabled ? t('fefoModeEnabled') : t('fefoModeAvailable')}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              {inventoryFeatures.fefoEnabled ? t('fefoModeEnabledSub') : t('fefoModeAvailableSub')}
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={createBatch} className="space-y-4 rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('logTrackedBatch')}</div>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none transition focus:border-blue-500"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">{t('selectTrackedProduct')}</option>
            {trackedProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} / {product.sku ?? t('noSKU')}
              </option>
            ))}
          </select>
          <Input placeholder={t('lotNumberPlaceholder')} value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} />
          <Input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
          <Input type="number" min="0" placeholder={t('batchQtyPlaceholder')} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </div>
        <Input placeholder={t('notesPlaceholder')} value={notes} onChange={(event) => setNotes(event.target.value)} />

        {selectedProduct ? (
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
            {t('productStockSummary', {
              qty: selectedProduct.stockQty,
              type: selectedProduct.trackExpiry ? t('batchAndExpiry') : t('batchOnly')
            })}
          </div>
        ) : null}

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{success}</div> : null}

        <Button type="submit" disabled={loading || !trackedProducts.length}>
          {loading ? t('savingBatch') : t('saveBatch')}
        </Button>
      </form>

      <div className="overflow-hidden rounded-[24px] border border-stone-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-start text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3.5">{t('productHeader')}</th>
                <th className="px-4 py-3.5">{t('batchHeader')}</th>
                <th className="px-4 py-3.5">{t('expiryHeader')}</th>
                <th className="px-4 py-3.5">{t('qtyHeader')}</th>
                <th className="px-4 py-3.5">{t('status')}</th>
                <th className="px-4 py-3.5">{t('receivedDateHeader')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedBatches.map((batch) => (
                <tr key={batch.id} className="border-t border-stone-200 bg-white">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-stone-900">{batch.product.name}</div>
                    <div className="mt-1 text-xs text-stone-500">{batch.product.sku ?? t('noSKU')}</div>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-700">{batch.lotNumber}</td>
                  <td className="px-4 py-4 text-stone-600">{batch.expiryDate ? shortDate(batch.expiryDate) : t('noExpiry')}</td>
                  <td className={`px-4 py-4 font-semibold ${batch.quantity <= 0 ? 'text-stone-500' : 'text-stone-900'}`}>{batch.quantity}</td>
                  <td className="px-4 py-4">
                    <Badge tone={batchTone(batch, inventoryFeatures.expiryAlertDays)}>
                      {batchStatusLabel(batch, inventoryFeatures.expiryAlertDays, t)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    <div>{dateTime(batch.receivedAt)}</div>
                    <div className="mt-1 text-xs text-stone-500">{batch.notes ?? t('noNotes')}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!sortedBatches.length ? (
          <div className="border-t border-stone-200 bg-stone-50 py-8 text-center text-sm text-stone-500">
            {t('noBatches')}
          </div>
        ) : null}
      </div>
    </div>
  );
}
