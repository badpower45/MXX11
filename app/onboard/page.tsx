'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments';
import {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_TIMEZONE,
  getPrinterConnectionLabel,
  getTaxModeLabel,
  PRINTER_CONNECTION_OPTIONS,
  type PrinterConnectionValue,
  TAX_MODE_OPTIONS,
  type TaxModeValue
} from '@/lib/shop-settings';
import { SHOP_TYPE_OPTIONS, getShopTypeDefaults, type SupportedShopType } from '@/lib/shop-config';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

function createCategoryRows(shopType: SupportedShopType) {
  return getShopTypeDefaults(shopType).starterCategories.map((name) => ({ name }));
}

function createSupplierRows(shopType: SupportedShopType) {
  return getShopTypeDefaults(shopType).starterSuppliers.map((supplier) => ({ ...supplier }));
}

function createProductRows(shopType: SupportedShopType) {
  return getShopTypeDefaults(shopType).starterProducts.map((product) => ({
    ...product,
    cost: String(product.cost),
    price: String(product.price),
    stockQty: String(product.stockQty),
    reorderPoint: String(product.reorderPoint)
  }));
}

export default function OnboardPage() {
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const t = useTranslations('onboard');
  const tSettings = useTranslations('settings');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    shopName: '',
    legalBusinessName: '',
    posType: 'HARDWARE' as SupportedShopType,
    phone: '',
    email: '',
    address: '',
    taxId: '',
    timezone: DEFAULT_TIMEZONE,
    currencyCode: 'EGP',
    currencySymbol: 'ج.م ',
    taxMode: 'EXCLUSIVE' as TaxModeValue,
    taxRate: '12',
    receiptHeader: 'Thank you for shopping with us!',
    receiptFooter: 'Please come again.',
    receiptWidth: '80mm' as '58mm' | '80mm',
    lowStockThreshold: String(getShopTypeDefaults('HARDWARE').lowStockThreshold),
    defaultPaymentMethods: [...DEFAULT_PAYMENT_METHODS] as PaymentMethod[],
    openingFloatRequired: true,
    openingFloatAmount: '0',
    printerName: '',
    printerConnection: 'MANUAL' as PrinterConnectionValue,
    barcodeScannerNotes: 'Scan barcode or SKU, then press Enter to add the item quickly at checkout.'
  });
  const [categories, setCategories] = useState(() => createCategoryRows('HARDWARE'));
  const [suppliers, setSuppliers] = useState(() => createSupplierRows('HARDWARE'));
  const [products, setProducts] = useState(() => createProductRows('HARDWARE'));

  const selectedShopType = useMemo(() => getShopTypeDefaults(form.posType), [form.posType]);

  function applyShopType(shopType: SupportedShopType) {
    const defaults = getShopTypeDefaults(shopType);
    setForm((current) => ({
      ...current,
      posType: shopType,
      lowStockThreshold: String(defaults.lowStockThreshold)
    }));
    setCategories(createCategoryRows(shopType));
    setSuppliers(createSupplierRows(shopType));
    setProducts(createProductRows(shopType));
  }

  function togglePaymentMethod(method: PaymentMethod) {
    setForm((current) => {
      const nextMethods = current.defaultPaymentMethods.includes(method)
        ? current.defaultPaymentMethods.filter((entry) => entry !== method)
        : [...current.defaultPaymentMethods, method];

      return {
        ...current,
        defaultPaymentMethods: nextMethods.length ? nextMethods : current.defaultPaymentMethods
      };
    });
  }

  function canContinue() {
    if (step === 1) {
      return form.shopName.trim().length >= 2 && form.legalBusinessName.trim().length >= 2;
    }

    return true;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (step < 4) {
      if (!canContinue()) {
        setError(t('errors.completeFields'));
        return;
      }

      setStep((value) => value + 1);
      return;
    }

    setLoading(true);
    const response = await fetch('/api/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        taxRate: Number(form.taxRate),
        lowStockThreshold: Number(form.lowStockThreshold),
        openingFloatAmount: Number(form.openingFloatAmount),
        categories: categories.filter((item) => item.name.trim().length >= 2),
        suppliers: suppliers.filter((item) => item.name.trim().length >= 2),
        products: products.filter((item) => item.name.trim().length >= 2).map((item) => ({
          ...item,
          cost: Number(item.cost),
          price: Number(item.price),
          stockQty: Number(item.stockQty),
          reorderPoint: Number(item.reorderPoint)
        }))
      })
    });

    const data = await response.json().catch(() => ({ error: t('errors.unableComplete') }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? t('errors.unableComplete'));
      return;
    }

    router.push(localizedPath('/dashboard'));
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-stone-50 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">{t('businessSetup')}</div>
          <h1 className="mt-2 text-4xl font-black text-stone-900">{t('title')}</h1>
          <p className="mt-2 text-sm text-stone-500">
            {t('subtitle')}
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          {[
            t('steps.1'),
            t('steps.2'),
            t('steps.3'),
            t('steps.4')
          ].map((label, index) => (
            <div
              key={label}
              className={`rounded-full px-4 py-2 font-semibold ${
                step >= index + 1 ? 'bg-blue-600 text-white' : 'border border-stone-200 bg-white text-stone-500'
              }`}
            >
              {t('steps.label', { step: index + 1, label })}
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step1.branchName')}</label>
                  <Input value={form.shopName} onChange={(event) => setForm((current) => ({ ...current, shopName: event.target.value }))} required />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step1.legalName')}</label>
                  <Input value={form.legalBusinessName} onChange={(event) => setForm((current) => ({ ...current, legalBusinessName: event.target.value }))} required />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step1.phone')}</label>
                  <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step1.email')}</label>
                  <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step1.taxId')}</label>
                  <Input value={form.taxId} onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step1.timezone')}</label>
                  <Input value={form.timezone} onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">{t('step1.address')}</label>
                  <Input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold text-stone-900">{t('step1.businessType')}</div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {SHOP_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => applyShopType(option.value)}
                      className={`rounded-[24px] border p-4 text-left transition ${
                        form.posType === option.value
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className="text-base font-black text-stone-950">{t(`step1.shopTypes.${option.value}.label`)}</div>
                      <div className="mt-2 text-sm leading-6 text-stone-500">{t(`step1.shopTypes.${option.value}.description`)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">{t('step1.inventoryDefaults')}</div>
                  <div className="mt-3 space-y-2 text-sm text-stone-600">
                    <div>{t('step1.batchTracking')}<span className="font-semibold text-stone-900">{selectedShopType.batchTrackingEnabled ? t('step1.enabled') : t('step1.optional')}</span></div>
                    <div>{t('step1.expiryTracking')}<span className="font-semibold text-stone-900">{selectedShopType.expiryTrackingEnabled ? t('step1.enabled') : t('step1.optional')}</span></div>
                    <div>{t('step1.fefoDisplay')}<span className="font-semibold text-stone-900">{selectedShopType.fefoEnabled ? t('step1.emphasized') : t('step1.available')}</span></div>
                    <div>{t('step1.expiryAlerts')}<span className="font-semibold text-stone-900">{t('step1.days', { days: selectedShopType.expiryAlertDays })}</span></div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('step1.starterGuidance')}</div>
                  <div className="mt-3 space-y-2 text-sm text-stone-600">
                    <div>{t(`step1.shopTypes.${form.posType}.hint0`)}</div>
                    <div>{t(`step1.shopTypes.${form.posType}.hint1`)}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step2.currencyCode')}</label>
                  <Input value={form.currencyCode} onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step2.currencySymbol')}</label>
                  <Input value={form.currencySymbol} onChange={(event) => setForm((current) => ({ ...current, currencySymbol: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step2.taxMode')}</label>
                  <select
                    className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm"
                    value={form.taxMode}
                    onChange={(event) => setForm((current) => ({ ...current, taxMode: event.target.value as TaxModeValue }))}
                  >
                    {TAX_MODE_OPTIONS.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry === 'INCLUSIVE' ? tSettings('taxModeInclusive') : entry === 'NON_TAXABLE' ? tSettings('taxModeNonTaxable') : tSettings('taxModeExclusive')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step2.taxRate')}</label>
                  <Input type="number" step="0.01" value={form.taxRate} onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step2.lowStockThreshold')}</label>
                  <Input type="number" value={form.lowStockThreshold} onChange={(event) => setForm((current) => ({ ...current, lowStockThreshold: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step2.receiptWidth')}</label>
                  <select
                    className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm"
                    value={form.receiptWidth}
                    onChange={(event) => setForm((current) => ({ ...current, receiptWidth: event.target.value as '58mm' | '80mm' }))}
                  >
                    <option value="58mm">{t('step2.width58')}</option>
                    <option value="80mm">{t('step2.width80')}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step2.requiredOpeningFloat')}</label>
                  <Input type="number" step="0.01" value={form.openingFloatAmount} onChange={(event) => setForm((current) => ({ ...current, openingFloatAmount: event.target.value }))} />
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={form.openingFloatRequired}
                    onChange={(event) => setForm((current) => ({ ...current, openingFloatRequired: event.target.checked }))}
                  />
                  {t('step2.requireOpeningFloatCheckbox')}
                </label>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step2.printerConnection')}</label>
                  <select
                    className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm"
                    value={form.printerConnection}
                    onChange={(event) => setForm((current) => ({ ...current, printerConnection: event.target.value as PrinterConnectionValue }))}
                  >
                    {PRINTER_CONNECTION_OPTIONS.map((entry) => (
                      <option key={entry} value={entry}>
                        {entry === 'NETWORK' ? tSettings('printerNetwork') : entry === 'BLUETOOTH' ? tSettings('printerBluetooth') : entry === 'MANUAL' ? tSettings('printerManual') : tSettings('printerUsb')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">{t('step2.printerName')}</label>
                  <Input value={form.printerName} onChange={(event) => setForm((current) => ({ ...current, printerName: event.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">{t('step2.receiptHeader')}</label>
                  <Input value={form.receiptHeader} onChange={(event) => setForm((current) => ({ ...current, receiptHeader: event.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">{t('step2.receiptFooter')}</label>
                  <Input value={form.receiptFooter} onChange={(event) => setForm((current) => ({ ...current, receiptFooter: event.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">{t('step2.barcodeScannerNotes')}</label>
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900"
                    value={form.barcodeScannerNotes}
                    onChange={(event) => setForm((current) => ({ ...current, barcodeScannerNotes: event.target.value }))}
                  />
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold text-stone-900">{t('step2.defaultPaymentMethods')}</div>
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const active = form.defaultPaymentMethods.includes(method);
                    return (
                      <button
                        key={method}
                        type="button"
                        onClick={() => togglePaymentMethod(method)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          active
                            ? 'border-blue-600 bg-blue-600 text-white'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {method}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <div className="mb-3 text-lg font-black text-stone-900">{t('step3.starterCategories')}</div>
                <div className="space-y-3">
                  {categories.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex gap-3">
                      <Input value={item.name} onChange={(event) => setCategories((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} />
                      <Button type="button" variant="secondary" onClick={() => setCategories((current) => current.filter((_, entryIndex) => entryIndex !== index))}>{t('step3.remove')}</Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="secondary" className="mt-3" onClick={() => setCategories((current) => [...current, { name: '' }])}>{t('step3.addCategory')}</Button>
              </div>

              <div>
                <div className="mb-3 text-lg font-black text-stone-900">{t('step3.starterSuppliers')}</div>
                <div className="space-y-3">
                  {suppliers.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="grid gap-3 md:grid-cols-3">
                      <Input placeholder={t('step3.supplierName')} value={item.name} onChange={(event) => setSuppliers((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} />
                      <Input placeholder={t('step3.contactName')} value={item.contactName} onChange={(event) => setSuppliers((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, contactName: event.target.value } : entry))} />
                      <div className="flex gap-3">
                        <Input placeholder={t('step3.phone')} value={item.phone} onChange={(event) => setSuppliers((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, phone: event.target.value } : entry))} />
                        <Button type="button" variant="secondary" onClick={() => setSuppliers((current) => current.filter((_, entryIndex) => entryIndex !== index))}>{t('step3.remove')}</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="secondary" className="mt-3" onClick={() => setSuppliers((current) => [...current, { name: '', contactName: '', phone: '' }])}>{t('step3.addSupplier')}</Button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <div className="mb-3 text-lg font-black text-stone-900">{t('step4.starterProducts')}</div>
              <div className="mb-4 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                {t('step4.shopTypeDefaults', {
                  batch: selectedShopType.batchTrackingEnabled ? t('step1.enabled') : t('step1.optional'),
                  expiry: selectedShopType.expiryTrackingEnabled ? t('step1.enabled') : t('step1.optional')
                })}
              </div>
              <div className="space-y-3">
                {products.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <Input placeholder={t('step4.name')} value={item.name} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} />
                      <Input placeholder={t('step4.categoryName')} value={item.categoryName} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, categoryName: event.target.value } : entry))} />
                      <Input placeholder={t('step4.sku')} value={item.sku} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, sku: event.target.value } : entry))} />
                      <Input placeholder={t('step4.barcode')} value={item.barcode} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, barcode: event.target.value } : entry))} />
                      <Input type="number" step="0.01" placeholder={t('step4.cost')} value={item.cost} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, cost: event.target.value } : entry))} />
                      <Input type="number" step="0.01" placeholder={t('step4.price')} value={item.price} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, price: event.target.value } : entry))} />
                      <Input type="number" placeholder={t('step4.openingStock')} value={item.stockQty} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, stockQty: event.target.value } : entry))} />
                      <div className="flex gap-3">
                        <Input type="number" placeholder={t('step4.reorderLevel')} value={item.reorderPoint} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, reorderPoint: event.target.value } : entry))} />
                        <Button type="button" variant="secondary" onClick={() => setProducts((current) => current.filter((_, entryIndex) => entryIndex !== index))}>{t('step3.remove')}</Button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-6 text-sm text-stone-600">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.trackBatches}
                          onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, trackBatches: event.target.checked, trackExpiry: event.target.checked ? entry.trackExpiry : false } : entry))}
                        />
                        {t('step4.trackBatches')}
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.trackExpiry}
                          onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, trackExpiry: event.target.checked, trackBatches: event.target.checked ? true : entry.trackBatches } : entry))}
                        />
                        {t('step4.trackExpiry')}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() =>
                  setProducts((current) => [
                    ...current,
                    {
                      name: '',
                      categoryName: '',
                      sku: '',
                      barcode: '',
                      cost: '0',
                      price: '0',
                      stockQty: '0',
                      reorderPoint: String(selectedShopType.lowStockThreshold),
                      trackBatches: selectedShopType.batchTrackingEnabled,
                      trackExpiry: selectedShopType.expiryTrackingEnabled
                    }
                  ])
                }
              >
                {t('step4.addProduct')}
              </Button>
            </div>
          ) : null}

          {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep((value) => Math.max(1, value - 1))} disabled={step === 1}>{t('buttons.back')}</Button>
            <Button type="submit" disabled={loading}>{loading ? t('buttons.finishing') : step === 4 ? t('buttons.finish') : t('buttons.continue')}</Button>
          </div>
        </form>
      </div>
    </main>
  );
}
