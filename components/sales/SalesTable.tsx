 'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useState, useTransition } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { dateTime, money } from '@/lib/format';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

type Sale = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  paymentMethod: string;
  cashierName: string | null;
  createdAt: string;
  totalAmount: string;
  customerName: string | null;
  status: string;
  isCreditSale?: boolean;
};

export default function SalesTable({
  sales,
  currencySymbol,
  canRefundSales,
  canVoidSales
}: {
  sales: Sale[];
  currencySymbol: string;
  canRefundSales: boolean;
  canVoidSales: boolean;
}) {
  const t = useTranslations('salesLog');
  const lp = useLocalizedPath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchVal, setSearchVal] = useState(searchParams.get('search') ?? '');

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(() => {
      if (searchVal.trim()) {
        router.push(lp(`/sales?search=${encodeURIComponent(searchVal.trim())}`));
      } else {
        router.push(lp('/sales'));
      }
    });
  }

  function handleClear() {
    setSearchVal('');
    startTransition(() => {
      router.push(lp('/sales'));
    });
  }

  return (
    <div className="space-y-6">
      {/* Search Input Bar */}
      <Card>
        <form onSubmit={handleSearchSubmit} className="flex gap-3 items-center">
          <div className="flex-1">
            <Input
              type="text"
              placeholder={t('searchPlaceholder') || 'البحث برقم الفاتورة، كود التاجر، أو اسم العميل...'}
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              disabled={isPending}
            />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? '...' : (t('search') || 'بحث')}
          </Button>
          {searchParams.get('search') && (
            <Button type="button" variant="secondary" onClick={handleClear} disabled={isPending}>
              {t('clear') || 'مسح'}
            </Button>
          )}
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">{t('transactions')}</div>
            <h2 className="mt-2 text-xl font-black text-stone-900">{t('title')}</h2>
            <p className="mt-1 text-sm text-stone-500">{t('subtitle')}</p>
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            {t('salesRecordsCount', { count: sales.length })}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500 font-semibold border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3.5">{t('invoiceHeader')}</th>
                  <th className="px-4 py-3.5">{t('statusHeader')}</th>
                  <th className="px-4 py-3.5">{t('customerHeader')}</th>
                  <th className="px-4 py-3.5">{t('paymentHeader')}</th>
                  <th className="px-4 py-3.5">{t('cashierHeader')}</th>
                  <th className="px-4 py-3.5">{t('dateHeader')}</th>
                  <th className="px-4 py-3.5">{t('totalHeader')}</th>
                  <th className="px-4 py-3.5">{t('actionsHeader')}</th>
                </tr>
              </thead>

              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                    <td className="px-4 py-4">
                      <Link href={lp(`/sales/${sale.id}`)} className="font-semibold text-blue-700">
                        {sale.saleNumber}
                      </Link>
                      <div className="mt-1 text-xs text-stone-500">{sale.receiptNumber}</div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={sale.status === 'VOIDED' ? 'red' : 'emerald'}>
                        {sale.status === 'COMPLETED' ? t('completed') : sale.status === 'VOIDED' ? t('voided') : sale.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">{sale.customerName ?? t('walkInCustomer')}</td>
                    <td className="px-4 py-4">
                      <Badge tone="blue">{sale.paymentMethod}</Badge>
                      {sale.isCreditSale ? <div className="mt-2"><Badge tone="amber">{t('creditSale')}</Badge></div> : null}
                    </td>
                    <td className="px-4 py-4">{sale.cashierName ?? t('cashierFallback')}</td>
                    <td className="px-4 py-4">{dateTime(sale.createdAt)}</td>
                    <td className="px-4 py-4 font-semibold text-stone-900">{money(sale.totalAmount, currencySymbol)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <Link href={lp(`/sales/${sale.id}`)} className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
                          {t('view')}
                        </Link>
                        <Link href={lp(`/sales/${sale.id}/receipt`)} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                          {t('reprint')}
                        </Link>
                        {canRefundSales ? (
                          <Link href={lp(`/sales/${sale.id}/refund`)} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                            {t('refund')}
                          </Link>
                        ) : null}
                        {canVoidSales ? (
                          <Link href={lp(`/sales/${sale.id}/void`)} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                            {t('void')}
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!sales.length ? (
            <div className="border-t border-stone-200 bg-stone-50 px-6 py-8 text-center text-sm text-stone-500">
              <div className="font-semibold text-stone-900">{t('noSalesYet')}</div>
              <div className="mt-2">{t('noSalesYetDesc')}</div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
