'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from '@/lib/i18n/client';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments';
import {
  PRINTER_CONNECTION_OPTIONS,
  type PrinterConnectionValue,
  TAX_MODE_OPTIONS,
  type TaxModeValue
} from '@/lib/shop-settings';

type ReceiptWidth = '58mm' | '80mm';

type Props = {
  initialValues: {
    shopName: string;
    legalBusinessName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxId: string | null;
    timezone: string;
    currencyCode: string;
    currencySymbol: string;
    taxMode: TaxModeValue;
    taxRate: string;
    receiptHeader: string | null;
    receiptFooter: string | null;
    receiptWidth: ReceiptWidth;
    receiptShowBrandMark: boolean;
    printerSafeMode: boolean;
    defaultPaymentMethods: PaymentMethod[];
    printerName: string;
    printerConnection: PrinterConnectionValue;
    cashDrawerKickEnabled: boolean;
    barcodeScannerNotes: string;
    lowStockEnabled: boolean;
    lowStockThreshold: number;
    reorderSafetyStock: number;
    offlineStockStrict: boolean;
    offlineStockMaxAgeMinutes: number;
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    fefoEnabled: boolean;
    expiryAlertDays: number;
    openingFloatRequired: boolean;
    openingFloatAmount: string;
    salePrefix: string;
    receiptPrefix: string;
    purchasePrefix: string;
  };
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10';

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 p-5">
      <div>
        <h3 className="text-lg font-black text-stone-900">{title}</h3>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function SettingsForm({ initialValues }: Props) {
  const t = useTranslations('settings');

  const getLocalizedTaxMode = (mode: string) => {
    switch (mode) {
      case 'INCLUSIVE': return t('taxModeInclusive');
      case 'NON_TAXABLE': return t('taxModeNonTaxable');
      default: return t('taxModeExclusive');
    }
  };

  const getLocalizedPrinterConnection = (conn: string) => {
    switch (conn) {
      case 'NETWORK': return t('printerNetwork');
      case 'BLUETOOTH': return t('printerBluetooth');
      case 'MANUAL': return t('printerManual');
      default: return t('printerUsb');
    }
  };

  const [form, setForm] = useState({ ...initialValues, taxRate: String(initialValues.taxRate) });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function togglePaymentMethod(method: PaymentMethod) {
    setForm((current) => {
      const hasMethod = current.defaultPaymentMethods.includes(method);
      const nextMethods = hasMethod
        ? current.defaultPaymentMethods.filter((entry) => entry !== method)
        : [...current.defaultPaymentMethods, method];

      return {
        ...current,
        defaultPaymentMethods: nextMethods.length ? nextMethods : current.defaultPaymentMethods
      };
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        taxRate: Number(form.taxRate),
        lowStockThreshold: Number(form.lowStockThreshold),
        reorderSafetyStock: Number(form.reorderSafetyStock),
        offlineStockMaxAgeMinutes: Number(form.offlineStockMaxAgeMinutes),
        openingFloatAmount: Number(form.openingFloatAmount)
      })
    });

    const data = await response.json().catch(() => ({ error: t('saveError') }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? t('saveError'));
      return;
    }

    setMessage(t('saveSuccess'));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <h2 className="text-xl font-black text-stone-900">{t('branchSettings')}</h2>
        <p className="mt-2 text-sm text-stone-500">
          {t('branchSettingsDesc')}
        </p>
      </Card>

      <Section title={t('businessDetails')} description={t('businessDetailsDesc')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder={t('shopNamePlaceholder')}
            value={form.shopName}
            onChange={(event) => setForm((current) => ({ ...current, shopName: event.target.value }))}
          />
          <Input
            placeholder={t('legalBusinessNamePlaceholder')}
            value={form.legalBusinessName}
            onChange={(event) => setForm((current) => ({ ...current, legalBusinessName: event.target.value }))}
          />
          <Input
            placeholder={t('phonePlaceholder')}
            value={form.phone ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
          <Input
            placeholder={t('emailPlaceholder')}
            value={form.email ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <Input
            placeholder={t('taxIdPlaceholder')}
            value={form.taxId ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))}
          />
          <Input
            placeholder={t('timezonePlaceholder')}
            value={form.timezone}
            onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
          />
          <div className="md:col-span-2">
            <Input
              placeholder={t('addressPlaceholder')}
              value={form.address ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            />
          </div>
        </div>
      </Section>

      <Section title={t('taxAndCurrency')} description={t('taxAndCurrencyDesc')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder={t('currencyCodePlaceholder')}
            value={form.currencyCode}
            onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))}
          />
          <Input
            placeholder={t('currencySymbolPlaceholder')}
            value={form.currencySymbol}
            onChange={(event) => setForm((current) => ({ ...current, currencySymbol: event.target.value }))}
          />
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-700">{t('taxModeLabel')}</div>
            <select
              className={selectClassName}
              value={form.taxMode}
              onChange={(event) => setForm((current) => ({ ...current, taxMode: event.target.value as TaxModeValue }))}
            >
              {TAX_MODE_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {getLocalizedTaxMode(entry)}
                </option>
              ))}
            </select>
          </div>
          <Input
            type="number"
            step="0.01"
            placeholder={t('taxRatePlaceholder')}
            value={form.taxRate}
            onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))}
          />
        </div>
      </Section>

      <Section title={t('checkoutAndRegister')} description={t('checkoutAndRegisterDesc')}>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-stone-700">{t('defaultPaymentMethods')}</div>
            <div className="mt-3 flex flex-wrap gap-2">
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

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.openingFloatRequired}
                onChange={(event) => setForm((current) => ({ ...current, openingFloatRequired: event.target.checked }))}
              />
              {t('requireOpeningFloat')}
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder={t('openingFloatAmountPlaceholder')}
              value={form.openingFloatAmount}
              onChange={(event) => setForm((current) => ({ ...current, openingFloatAmount: event.target.value }))}
            />
            <Input
              type="number"
              placeholder={t('lowStockThresholdPlaceholder')}
              value={String(form.lowStockThreshold)}
              onChange={(event) => setForm((current) => ({ ...current, lowStockThreshold: Number(event.target.value) }))}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.lowStockEnabled}
                onChange={(event) => setForm((current) => ({ ...current, lowStockEnabled: event.target.checked }))}
              />
              {t('enableLowStockAlerts')}
            </label>
            <Input
              type="number"
              placeholder={t('offlineStockMaxAgePlaceholder')}
              value={String(form.offlineStockMaxAgeMinutes)}
              onChange={(event) => setForm((current) => ({ ...current, offlineStockMaxAgeMinutes: Number(event.target.value) }))}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.offlineStockStrict}
                onChange={(event) => setForm((current) => ({ ...current, offlineStockStrict: event.target.checked }))}
              />
              {t('blockOfflineCheckoutStale')}
            </label>
          </div>
        </div>
      </Section>

      <Section title={t('inventoryDefaults')} description={t('inventoryDefaultsDesc')}>
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            type="number"
            placeholder={t('safetyStockPlaceholder')}
            value={String(form.reorderSafetyStock)}
            onChange={(event) => setForm((current) => ({ ...current, reorderSafetyStock: Number(event.target.value) }))}
          />
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            {t('safetyStockNote')}
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.batchTrackingEnabled}
              onChange={(event) => setForm((current) => ({ ...current, batchTrackingEnabled: event.target.checked }))}
            />
            {t('enableBatchTracking')}
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.expiryTrackingEnabled}
              onChange={(event) => setForm((current) => ({ ...current, expiryTrackingEnabled: event.target.checked }))}
            />
            {t('enableExpiryTracking')}
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.fefoEnabled}
              onChange={(event) => setForm((current) => ({ ...current, fefoEnabled: event.target.checked }))}
            />
            {t('preferFefo')}
          </label>
          <Input
            type="number"
            placeholder={t('expiryAlertDaysPlaceholder')}
            value={String(form.expiryAlertDays)}
            onChange={(event) => setForm((current) => ({ ...current, expiryAlertDays: Number(event.target.value) }))}
          />
        </div>
      </Section>

      <Section title={t('receiptAndHardware')} description={t('receiptAndHardwareDesc')}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-700">{t('receiptWidth')}</div>
            <select
              className={selectClassName}
              value={form.receiptWidth}
              onChange={(event) =>
                setForm((current) => ({ ...current, receiptWidth: event.target.value as ReceiptWidth }))
              }
            >
              <option value="58mm">{t('receiptWidth58')}</option>
              <option value="80mm">{t('receiptWidth80')}</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-700">{t('printerConnection')}</div>
            <select
              className={selectClassName}
              value={form.printerConnection}
              onChange={(event) =>
                setForm((current) => ({ ...current, printerConnection: event.target.value as PrinterConnectionValue }))
              }
            >
              {PRINTER_CONNECTION_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {getLocalizedPrinterConnection(entry)}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.receiptShowBrandMark}
              onChange={(event) => setForm((current) => ({ ...current, receiptShowBrandMark: event.target.checked }))}
            />
            {t('receiptShowBrandMark')}
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.printerSafeMode}
              onChange={(event) => setForm((current) => ({ ...current, printerSafeMode: event.target.checked }))}
            />
            {t('printerSafeMode')}
          </label>
          <Input
            placeholder={t('printerNamePlaceholder')}
            value={form.printerName}
            onChange={(event) => setForm((current) => ({ ...current, printerName: event.target.value }))}
          />
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.cashDrawerKickEnabled}
              onChange={(event) => setForm((current) => ({ ...current, cashDrawerKickEnabled: event.target.checked }))}
            />
            {t('cashDrawerKickEnabled')}
          </label>
          <Input
            placeholder={t('receiptHeaderPlaceholder')}
            value={form.receiptHeader ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, receiptHeader: event.target.value }))}
          />
          <div className="md:col-span-2">
            <Input
              placeholder={t('receiptFooterPlaceholder')}
              value={form.receiptFooter ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, receiptFooter: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <textarea
              className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              placeholder={t('barcodeScannerNotesPlaceholder')}
              value={form.barcodeScannerNotes}
              onChange={(event) => setForm((current) => ({ ...current, barcodeScannerNotes: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            <div className="font-semibold text-stone-900">{t('printerTestTitle')}</div>
            <div className="mt-2">
              {t('printerTestBody')}
            </div>
            <div className="mt-4">
              <Link
                href="/print/receipt/test?autoprint=1"
                target="_blank"
                className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                {t('openPrintTest')}
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section title={t('documentNumbering')} description={t('documentNumberingDesc')}>
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            placeholder={t('salePrefixPlaceholder')}
            value={form.salePrefix}
            onChange={(event) => setForm((current) => ({ ...current, salePrefix: event.target.value.toUpperCase() }))}
          />
          <Input
            placeholder={t('receiptPrefixPlaceholder')}
            value={form.receiptPrefix}
            onChange={(event) => setForm((current) => ({ ...current, receiptPrefix: event.target.value.toUpperCase() }))}
          />
          <Input
            placeholder={t('purchasePrefixPlaceholder')}
            value={form.purchasePrefix}
            onChange={(event) => setForm((current) => ({ ...current, purchasePrefix: event.target.value.toUpperCase() }))}
          />
        </div>
      </Section>

      {message ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div>
        <Button type="submit" disabled={loading}>
          {loading ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
