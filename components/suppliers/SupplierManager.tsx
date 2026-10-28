'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from '@/lib/i18n/client';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money, shortDate } from '@/lib/format';
import { getPayableStatusLabel, payableStatusTone } from '@/lib/purchases';

type SupplierPayment = {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string | null;
  paidAt: string;
  createdAt: string;
  createdByUser: { id: string; name: string | null; email: string };
};

type SupplierInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  paymentStatus: string;
  notes: string | null;
  purchase: { id: string; purchaseNumber: string; status: string };
  payments?: SupplierPayment[];
  payableEntry?: {
    id: string;
    amountDue: string;
    amountPaid: string;
    balance: string;
    status: string;
    dueDate: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  invoices: SupplierInvoice[];
  _count?: { purchases: number; invoices: number };
};

export default function SupplierManager({
  initialSuppliers,
  currencySymbol
}: {
  initialSuppliers: Supplier[];
  currencySymbol: string;
}) {
  const t = useTranslations('suppliers');

  const getLocalizedPayableStatus = (status: string) => {
    switch (status) {
      case 'UNPAID': return t('statusUnpaid');
      case 'PARTIALLY_PAID': return t('statusPartiallyPaid');
      case 'PAID': return t('statusPaid');
      case 'OVERDUE': return t('statusOverdue');
      default: return status.replaceAll('_', ' ');
    }
  };

  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [form, setForm] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const supplierCards = useMemo(
    () =>
      suppliers.map((supplier) => {
        const outstanding = supplier.invoices.reduce(
          (sum, invoice) => sum + Number(invoice.payableEntry?.balance ?? 0),
          0
        );
        const overdueCount = supplier.invoices.filter(
          (invoice) => invoice.payableEntry?.status === 'OVERDUE'
        ).length;
        const openInvoiceCount = supplier.invoices.filter(
          (invoice) => invoice.payableEntry && invoice.payableEntry.status !== 'PAID'
        ).length;
        const recentPayments = supplier.invoices
          .flatMap((invoice) =>
            (invoice.payments ?? []).map((payment) => ({
              ...payment,
              invoiceNumber: invoice.invoiceNumber
            }))
          )
          .sort((left, right) => new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime())
          .slice(0, 3);

        return {
          ...supplier,
          outstanding,
          overdueCount,
          openInvoiceCount,
          recentPayments
        };
      }),
    [suppliers]
  );

  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const response = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = await response.json().catch(() => ({ error: t('failedCreate') }));
    if (!response.ok) {
      setError(data.error ?? t('failedCreate'));
      return;
    }

    setSuppliers((current) => [
      {
        ...data.supplier,
        invoices: [],
        _count: { purchases: 0, invoices: 0 }
      },
      ...current
    ]);
    setForm({ name: '', contactName: '', email: '', phone: '', address: '', notes: '' });
    setSuccess(t('supplierCreated'));
  }

  async function toggleSupplier(supplier: Supplier) {
    const confirmed = window.confirm(
      supplier.isActive
        ? t('archiveConfirm', { name: supplier.name })
        : t('restoreConfirm', { name: supplier.name })
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/suppliers/${supplier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !supplier.isActive })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.supplier) {
      setError(data?.error ?? t('unableUpdate'));
      return;
    }

    setSuppliers((current) =>
      current.map((item) =>
        item.id === supplier.id
          ? {
              ...item,
              ...data.supplier,
              invoices: item.invoices,
              _count: item._count
            }
          : item
      )
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <Card>
        <h2 id="new-supplier" className="text-xl font-black text-stone-900">{t('addSupplier')}</h2>
        <form onSubmit={saveSupplier} className="mt-5 grid gap-4">
          <Input placeholder={t('supplierName')} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          <Input placeholder={t('contactName')} value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} />
          <Input placeholder={t('email')} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          <Input placeholder={t('phone')} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          <Input placeholder={t('address')} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          <textarea
            className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            placeholder={t('notes')}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{success}</div> : null}

          <Button type="submit">{t('saveSupplier')}</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-xl font-black text-stone-900">{t('supplierList')}</h2>
        <div className="mt-4 space-y-4">
          {supplierCards.length ? (
            supplierCards.map((supplier) => (
              <div key={supplier.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-semibold text-stone-900">{supplier.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone={supplier.isActive ? 'emerald' : 'stone'}>
                        {supplier.isActive ? t('active') : t('archived')}
                      </Badge>
                      <Badge tone="blue">{t('purchasesCount', { count: supplier._count?.purchases ?? 0 })}</Badge>
                      <Badge tone="amber">{t('invoicesCount', { count: supplier._count?.invoices ?? 0 })}</Badge>
                      {supplier.overdueCount > 0 ? (
                        <Badge tone="red">{supplier.overdueCount} {t('overdue')}</Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm text-stone-500">
                      {supplier.contactName || t('noContact')} / {supplier.phone || t('noPhone')}
                    </div>
                    <div className="text-xs text-stone-500">{supplier.email || t('noEmail')}</div>
                    {supplier.address ? <div className="mt-1 text-xs text-stone-500">{supplier.address}</div> : null}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-stone-500">{t('outstandingPayable')}</div>
                    <div className="text-2xl font-black text-stone-900">{money(supplier.outstanding, currencySymbol)}</div>
                    <div className="text-xs text-stone-500">{t('openInvoicesCount', { count: supplier.openInvoiceCount })}</div>
                    <div className="mt-3">
                      <Button type="button" variant="secondary" onClick={() => toggleSupplier(supplier)}>
                        {supplier.isActive ? t('archive') : t('restore')}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-sm font-semibold text-stone-900">{t('openPayables')}</div>
                    <div className="mt-3 space-y-3">
                      {supplier.invoices.filter((invoice) => invoice.payableEntry && invoice.payableEntry.status !== 'PAID').length ? (
                        supplier.invoices
                          .filter((invoice) => invoice.payableEntry && invoice.payableEntry.status !== 'PAID')
                          .slice(0, 4)
                          .map((invoice) => (
                            <div key={invoice.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-stone-900">{invoice.invoiceNumber}</div>
                                  <div className="text-xs text-stone-500">
                                    {invoice.purchase.purchaseNumber} / {t('due', { date: shortDate(invoice.dueDate) })}
                                  </div>
                                </div>
                                <Badge tone={payableStatusTone(invoice.payableEntry?.status ?? invoice.paymentStatus)}>
                                  {getLocalizedPayableStatus(invoice.payableEntry?.status ?? invoice.paymentStatus)}
                                </Badge>
                              </div>
                              <div className="mt-2 text-sm text-stone-600">
                                {t('balance', { amount: money(invoice.payableEntry?.balance ?? '0', currencySymbol) })}
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="text-sm text-stone-500">{t('noOpenPayables')}</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-sm font-semibold text-stone-900">{t('recentPayments')}</div>
                    <div className="mt-3 space-y-3">
                      {supplier.recentPayments.length ? (
                        supplier.recentPayments.map((payment) => (
                          <div key={payment.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-semibold text-stone-900">
                                  {payment.invoiceNumber} / {money(payment.amount, currencySymbol)}
                                </div>
                                <div className="text-xs text-stone-500">
                                  {payment.method} / {dateTime(payment.paidAt)}
                                </div>
                              </div>
                              <div className="text-xs text-stone-500">
                                {payment.referenceNumber ? t('ref', { num: payment.referenceNumber }) : t('noRef')}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-stone-500">{t('noRecentPayments')}</div>
                      )}
                    </div>
                  </div>
                </div>

                {supplier.notes ? (
                  <div className="mt-4 text-sm text-stone-500">{t('notes')}: {supplier.notes}</div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
              {t('noSuppliers')}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
