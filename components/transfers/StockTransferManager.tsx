'use client';

import { useMemo, useState, useEffect } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime } from '@/lib/format';
import { useTranslations } from '@/lib/i18n/client';
import {
  getStockTransferStatusLabel,
  stockTransferStatusTone,
  type StockTransferStatusValue
} from '@/lib/stock-transfers';

type ShopOption = {
  id: string;
  name: string;
  role: string;
};

type ProductOption = {
  id: string;
  shopId?: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  stockQty: number;
};

type TransferItemView = {
  id: string;
  fromProductId: string;
  toProductId: string;
  productNameSnapshot: string;
  destinationProductNameSnapshot: string;
  qty: number;
  createdAt: string;
  fromProduct: {
    id: string;
    name: string;
    stockQty: number;
    sku: string | null;
    barcode: string | null;
  };
  toProduct: {
    id: string;
    name: string;
    stockQty: number;
    sku: string | null;
    barcode: string | null;
  };
};

export type StockTransferView = {
  id: string;
  fromShopId: string;
  toShopId: string;
  transferNumber: string;
  status: string;
  notes: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fromShop: { id: string; name: string };
  toShop: { id: string; name: string };
  createdByUser: { id: string; name: string | null; email: string };
  receivedByUser?: { id: string; name: string | null; email: string } | null;
  items: TransferItemView[];
};

type DraftLine = {
  fromProductId: string;
  toProductId: string;
  fromProductName: string;
  toProductName: string;
  qty: number;
};

function matchDestinationProduct(sourceProduct: ProductOption, destinationProducts: ProductOption[]) {
  const normalizedSku = sourceProduct.sku?.trim().toLowerCase();
  const normalizedBarcode = sourceProduct.barcode?.trim();
  const normalizedName = sourceProduct.name.trim().toLowerCase();

  return (
    destinationProducts.find((product) => normalizedBarcode && product.barcode?.trim() === normalizedBarcode) ??
    destinationProducts.find((product) => normalizedSku && product.sku?.trim().toLowerCase() === normalizedSku) ??
    destinationProducts.find((product) => product.name.trim().toLowerCase() === normalizedName) ??
    null
  );
}

export default function StockTransferManager({
  activeShopId,
  activeShopName,
  otherShops,
  sourceProducts,
  destinationProducts,
  initialTransfers,
  userRole
}: {
  activeShopId: string;
  activeShopName: string;
  currencySymbol: string;
  otherShops: ShopOption[];
  sourceProducts: ProductOption[];
  destinationProducts: ProductOption[];
  initialTransfers: StockTransferView[];
  userRole: string;
}) {
  const t = useTranslations('transfers');
  const tRoot = useTranslations();
  const [history, setHistory] = useState(initialTransfers);
  const [toShopId, setToShopId] = useState(otherShops[0]?.id ?? '');
  const [fromProductId, setFromProductId] = useState('');
  const [toProductId, setToProductId] = useState('');
  const [scanQuery, setScanQuery] = useState('');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyTransferId, setBusyTransferId] = useState<string | null>(null);

  const searchedProduct = useMemo(() => {
    const term = scanQuery.trim().toLowerCase();
    if (!term) return null;
    return sourceProducts.find(
      (p) =>
        (p.barcode && p.barcode.trim() === term) ||
        (p.sku && p.sku.trim().toLowerCase() === term) ||
        p.name.toLowerCase().includes(term)
    ) ?? null;
  }, [scanQuery, sourceProducts]);

  const availableDestinationProducts = useMemo(
    () => destinationProducts.filter((product) => product.shopId === toShopId),
    [destinationProducts, toShopId]
  );

  useEffect(() => {
    if (searchedProduct) {
      setFromProductId(searchedProduct.id);
      const suggestedMatch = matchDestinationProduct(searchedProduct, availableDestinationProducts);
      setToProductId(suggestedMatch?.id ?? '');
    } else {
      setFromProductId('');
      setToProductId('');
    }
  }, [searchedProduct, availableDestinationProducts]);

  const isAdmin = userRole === 'ADMIN';
  const selectedSourceProduct = useMemo(
    () => sourceProducts.find((product) => product.id === fromProductId) ?? null,
    [fromProductId, sourceProducts]
  );

  function replaceTransfer(nextTransfer: StockTransferView) {
    setHistory((current) => current.map((entry) => (entry.id === nextTransfer.id ? nextTransfer : entry)));
  }

  function onChangeDestinationShop(nextShopId: string) {
    setToShopId(nextShopId);
    const destinationPool = destinationProducts.filter((product) => product.shopId === nextShopId);
    const sourceProduct = sourceProducts.find((product) => product.id === fromProductId);
    const suggestedMatch = sourceProduct ? matchDestinationProduct(sourceProduct, destinationPool) : null;
    setToProductId(suggestedMatch?.id ?? destinationPool[0]?.id ?? '');
  }

  function onChangeSourceProduct(nextProductId: string) {
    setFromProductId(nextProductId);
    const sourceProduct = sourceProducts.find((product) => product.id === nextProductId);
    const suggestedMatch = sourceProduct ? matchDestinationProduct(sourceProduct, availableDestinationProducts) : null;
    setToProductId(suggestedMatch?.id ?? availableDestinationProducts[0]?.id ?? '');
  }

  function addLine() {
    setError('');
    setSuccess('');

    const sourceProduct = sourceProducts.find((product) => product.id === fromProductId);
    const parsedQty = Number(qty);

    if (!toShopId) {
      setError(t('selectDestinationFirst'));
      return;
    }

    if (!sourceProduct) {
      setError(t('selectSourceDestinationProducts'));
      return;
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError(t('qtyZeroError'));
      return;
    }

    if (parsedQty > sourceProduct.stockQty) {
      setError(t('qtyExceedsStock', { name: sourceProduct.name, qty: sourceProduct.stockQty }));
      return;
    }

    const matchedDest = toProductId
      ? (availableDestinationProducts.find((p) => p.id === toProductId) || matchDestinationProduct(sourceProduct, availableDestinationProducts))
      : matchDestinationProduct(sourceProduct, availableDestinationProducts);

    setLines((current) => [
      ...current,
      {
        fromProductId: sourceProduct.id,
        toProductId: matchedDest?.id ?? '',
        fromProductName: sourceProduct.name,
        toProductName: matchedDest ? matchedDest.name : `${sourceProduct.name} (${t('autoCreateProductSuffix')})`,
        qty: parsedQty
      }
    ]);
    setQty('1');
    setScanQuery('');
    setFromProductId('');
    setToProductId('');
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function createTransfer() {
    setError('');
    setSuccess('');

    if (!toShopId) {
      setError(t('selectDestinationFirst'));
      return;
    }

    if (!lines.length) {
      setError(t('noTransferLines'));
      return;
    }

    setLoading(true);
    const response = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toShopId,
        notes: notes || null,
        items: lines.map((line) => ({
          fromProductId: line.fromProductId,
          toProductId: line.toProductId,
          qty: line.qty
        }))
      })
    });
    const data = await response.json().catch(() => ({ error: t('unableCreate') }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? t('unableCreate'));
      return;
    }

    setHistory((current) => [data.stockTransfer, ...current]);
    setLines([]);
    setNotes('');
    setSuccess(t('sentSuccess'));
  }

  async function updateTransfer(transferId: string, action: 'SEND' | 'RECEIVE' | 'CANCEL') {
    setBusyTransferId(transferId);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/transfers/${transferId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const data = await response.json().catch(() => ({ error: t('unableUpdate') }));
    setBusyTransferId(null);

    if (!response.ok) {
      setError(data.error ?? t('unableUpdate'));
      return;
    }

    replaceTransfer(data.stockTransfer);
    if (action === 'SEND') {
      setSuccess(t('sentSuccess'));
    } else if (action === 'RECEIVE') {
      setSuccess(t('receivedSuccess'));
    } else {
      setSuccess(t('cancelledSuccess'));
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <div className="mb-4">
          <div className="text-lg font-black text-stone-900">{t('createTransfer')}</div>
          <div className="text-sm text-stone-500">{t('sourceBranch')}: {activeShopName}</div>
        </div>

        {otherShops.length ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <select
                className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
                value={toShopId}
                onChange={(event) => onChangeDestinationShop(event.target.value)}
              >
                {otherShops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name} ({tRoot(`roles.${shop.role}`)})
                  </option>
                ))}
              </select>
              <Input placeholder={t('transferNotes')} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="grid gap-3 md:grid-cols-4 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    {t('searchProduct') || 'امسح الباركود أو ابحث عن المنتج'}
                  </label>
                  <Input
                    placeholder="امسح الباركود أو اكتب الكود..."
                    value={scanQuery}
                    onChange={(event) => setScanQuery(event.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                    الكمية
                  </label>
                  <Input type="number" min={1} value={qty} onChange={(event) => setQty(event.target.value)} />
                </div>
                <Button type="button" variant="secondary" onClick={addLine}>{t('addTransferLine')}</Button>
              </div>
              {searchedProduct && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs space-y-1">
                  <div className="font-semibold text-blue-900">
                    العنصر المحدد: {searchedProduct.name} {searchedProduct.sku ? `(SKU: ${searchedProduct.sku})` : ''}
                  </div>
                  <div className="text-stone-600">
                    المخزون المتوفر بالفرع الحالي: <span className="font-bold text-stone-900">{searchedProduct.stockQty}</span>
                  </div>
                  {toProductId ? (
                    <div className="text-emerald-700 font-semibold">
                      سيتم تحويله إلى: {availableDestinationProducts.find(p => p.id === toProductId)?.name || ''}
                    </div>
                  ) : (
                    <div className="text-amber-700 font-semibold">
                      ⚠️ لا يوجد منتج مطابق بالفرع الآخر. سيتم إنشاء منتج جديد هناك تلقائياً عند الاستلام.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {lines.length ? (
                lines.map((line, index) => (
                  <div key={`${line.fromProductId}-${line.toProductId}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                    <div>
                      <div className="font-semibold text-stone-900">{line.fromProductName}</div>
                      <div className="text-xs text-stone-500">
                        {t('unitsTo', { qty: line.qty, product: line.toProductName })}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => removeLine(index)}>{t('removeTransferLine')}</Button>
                  </div>
                ))
              ) : (
                <div className="text-sm text-stone-500">{t('noTransferLines')}</div>
              )}
            </div>

            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{success}</div> : null}

            <Button onClick={createTransfer} disabled={!lines.length || loading}>
              {loading ? t('savingTransfer') : t('saveTransferDraft')}
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
            {t('accessMultiBranchRequired')}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4">
          <div className="text-lg font-black text-stone-900">{t('transferHistory')}</div>
          <div className="text-sm text-stone-500">{t('activeBranchRules')}</div>
        </div>

        <div className="space-y-4">
          {history.length ? (
            history.map((transfer) => {
              const isSourceBranch = transfer.fromShopId === activeShopId;
              const isDestinationBranch = transfer.toShopId === activeShopId;
              const status = transfer.status as StockTransferStatusValue;

              return (
                <div key={transfer.id} className="rounded-2xl border border-stone-200 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-stone-900">{transfer.transferNumber}</div>
                      <div className="text-sm text-stone-500">
                        {transfer.fromShop.name} {t('toShop', { shop: transfer.toShop.name })}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge tone={stockTransferStatusTone(status)}>
                          {t('status_' + status)}
                        </Badge>
                        <Badge tone={isSourceBranch ? 'amber' : 'blue'}>
                          {isSourceBranch ? t('outgoing') : t('incoming')}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right text-sm text-stone-600">
                      <div>{t('createdWhen', { date: dateTime(transfer.createdAt) })}</div>
                      {transfer.sentAt ? <div>{t('sentWhen', { date: dateTime(transfer.sentAt) })}</div> : null}
                      {transfer.receivedAt ? <div>{t('receivedWhen', { date: dateTime(transfer.receivedAt) })}</div> : null}
                    </div>
                  </div>

                  {transfer.notes ? <div className="mt-3 text-sm text-stone-600">{t('notes')}: {transfer.notes}</div> : null}

                  <div className="mt-4 space-y-2 rounded-2xl bg-stone-50 p-4">
                    {transfer.items.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                        <div className="font-semibold text-stone-900">{item.productNameSnapshot}</div>
                        <div className="text-xs text-stone-500">
                          {t('unitsTo', { qty: item.qty, product: item.destinationProductNameSnapshot })}
                        </div>
                      </div>
                    ))}
                  </div>

                   <div className="mt-4 flex flex-wrap gap-2 items-center">
                    {isSourceBranch && transfer.status === 'DRAFT' ? (
                      isAdmin ? (
                        <Button type="button" onClick={() => updateTransfer(transfer.id, 'SEND')} disabled={busyTransferId === transfer.id}>
                          {busyTransferId === transfer.id ? t('sending') : t('sendTransfer')}
                        </Button>
                      ) : (
                        <Badge tone="amber">{t('pendingAdminApproval')}</Badge>
                      )
                    ) : null}
                    {isSourceBranch && transfer.status === 'DRAFT' ? (
                      <Button type="button" variant="danger" onClick={() => updateTransfer(transfer.id, 'CANCEL')} disabled={busyTransferId === transfer.id}>
                        {t('cancelTransfer')}
                      </Button>
                    ) : null}
                    {isDestinationBranch && transfer.status === 'IN_TRANSIT' ? (
                      isAdmin ? (
                        <Button type="button" variant="secondary" onClick={() => updateTransfer(transfer.id, 'RECEIVE')} disabled={busyTransferId === transfer.id}>
                          {busyTransferId === transfer.id ? t('receiving') : t('confirmReceipt')}
                        </Button>
                      ) : (
                        <Badge tone="amber">{t('pendingAdminConfirmation')}</Badge>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-stone-500">{t('noTransfersRecorded')}</div>
          )}
        </div>
      </Card>
    </div>
  );
}
