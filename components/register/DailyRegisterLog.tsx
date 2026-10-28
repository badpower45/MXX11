'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { dateTime, money } from '@/lib/format';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

type DrawerEvent = {
  id: string;
  time: string;
  type: string;
  label: string;
  details: string;
  amount: number;
  cashierName: string;
  sourceLink: string | null;
};

type DailyRegisterLogProps = {
  selectedDate: string;
  cashEvents: DrawerEvent[];
  instapayEvents: DrawerEvent[];
  walletEvents: DrawerEvent[];
  visaEvents: DrawerEvent[];
  currencySymbol: string;
  locale: string;
  initialBalances?: { CASH: number; INSTAPAY: number; WALLET: number; VISA: number };
  activeSessionId?: string | null;
};

export default function DailyRegisterLog({
  selectedDate,
  cashEvents,
  instapayEvents,
  walletEvents,
  visaEvents = [],
  currencySymbol,
  locale,
  initialBalances = { CASH: 0, INSTAPAY: 0, WALLET: 0, VISA: 0 },
  activeSessionId = null
}: DailyRegisterLogProps) {
  const router = useRouter();
  const lp = useLocalizedPath();
  const isAr = locale === 'ar';

  const [dateInput, setDateInput] = useState(selectedDate);
  const [activeTab, setActiveTab] = useState<'CASH' | 'INSTAPAY' | 'WALLET' | 'VISA'>('CASH');
  const [isPending, startTransition] = useTransition();

  // Transfer Form States
  const [fromDrawer, setFromDrawer] = useState<'CASH' | 'INSTAPAY' | 'WALLET' | 'VISA'>('CASH');
  const [toDrawer, setToDrawer] = useState<'CASH' | 'INSTAPAY' | 'WALLET' | 'VISA'>('INSTAPAY');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  async function handleTransferSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSessionId) return;

    setTransferError('');
    setTransferSuccess('');

    const amt = Number(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError(isAr ? 'الرجاء إدخال مبلغ صالح للتحويل.' : 'Please enter a valid amount.');
      return;
    }

    if (fromDrawer === toDrawer) {
      setTransferError(isAr ? 'لا يمكن التحويل لنفس الخزنة.' : 'Cannot transfer to the same drawer.');
      return;
    }

    setTransferLoading(true);
    try {
      const response = await fetch(`/api/register/sessions/${activeSessionId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDrawer,
          toDrawer,
          amount: amt,
          note: transferNote || undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete transfer');
      }

      setTransferSuccess(isAr ? 'تم التحويل بنجاح! جاري تحديث الصفحة...' : 'Transfer completed successfully! Refreshing...');
      setTransferAmount('');
      setTransferNote('');

      router.refresh();
    } catch (err: any) {
      setTransferError(err.message || 'An error occurred during transfer.');
    } finally {
      setTransferLoading(false);
    }
  }

  // Computations
  const totalCash = cashEvents.reduce((sum, e) => sum + e.amount, 0);
  const totalInstapay = instapayEvents.reduce((sum, e) => sum + e.amount, 0);
  const totalWallet = walletEvents.reduce((sum, e) => sum + e.amount, 0);
  const totalVisa = visaEvents.reduce((sum, e) => sum + e.amount, 0);
  const grandTotal = totalCash + totalInstapay + totalWallet + totalVisa;

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextDate = e.target.value;
    setDateInput(nextDate);
    if (nextDate) {
      startTransition(() => {
        router.push(lp(`/register/daily?date=${nextDate}`));
      });
    }
  }

  function getEventsForActiveTab() {
    switch (activeTab) {
      case 'INSTAPAY':
        return instapayEvents;
      case 'WALLET':
        return walletEvents;
      case 'VISA':
        return visaEvents;
      default:
        return cashEvents;
    }
  }

  const activeEvents = getEventsForActiveTab();

  const eventsWithRunningBalance = React.useMemo(() => {
    const startBalance = initialBalances[activeTab] ?? 0;
    let runningSum = startBalance;
    const mapped = activeEvents.map((event) => {
      runningSum += event.amount;
      return {
        ...event,
        runningBalance: runningSum
      };
    });

    const initialRow = {
      id: 'initial-balance-row',
      time: new Date(new Date(selectedDate).setHours(0, 0, 0, 0)).toISOString(),
      type: 'INITIAL_BALANCE',
      label: isAr ? 'الرصيد المرحل من الأيام السابقة' : 'Carried-over Balance',
      details: isAr ? 'رصيد بداية اليوم' : 'Start of Day Balance',
      cashierName: '-',
      amount: 0,
      runningBalance: startBalance,
      sourceLink: null
    };

    return [initialRow, ...mapped];
  }, [activeEvents, activeTab, initialBalances, selectedDate, isAr]);

  return (
    <div className="space-y-6">
      {/* Date Selector & Total Summary */}
      <Card>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xs space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              {isAr ? 'تاريخ التقرير' : 'Report Date'}
            </div>
            <Input
              type="date"
              value={dateInput}
              onChange={handleDateChange}
              disabled={isPending}
              className="w-full"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-5 flex-1">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                {isAr ? '💵 درج الكاش' : 'Cash Drawer'}
              </div>
              <div className="mt-1 text-xl font-black text-stone-950">{money(totalCash, currencySymbol)}</div>
            </div>

            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                {isAr ? '⚡ انستا باي' : 'InstaPay'}
              </div>
              <div className="mt-1 text-xl font-black text-blue-700">{money(totalInstapay, currencySymbol)}</div>
            </div>

            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                {isAr ? '📱 المحافظ الإلكترونية' : 'E-Wallets'}
              </div>
              <div className="mt-1 text-xl font-black text-emerald-700">{money(totalWallet, currencySymbol)}</div>
            </div>

            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                {isAr ? '💳 فيزا / بنك' : 'Visa / Bank'}
              </div>
              <div className="mt-1 text-xl font-black text-indigo-700">{money(totalVisa, currencySymbol)}</div>
            </div>

            <div className="rounded-[22px] border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-800">
                {isAr ? '💰 إجمالي المبالغ باليوم' : 'Daily Grand Total'}
              </div>
              <div className="mt-1 text-xl font-black text-blue-900">{money(grandTotal, currencySymbol)}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Drawer-to-Drawer Transfer Interface */}
      <Card>
        <div className="border-b border-stone-200 pb-3 mb-4">
          <h3 className="text-lg font-black text-stone-900">
            {isAr ? 'التحويل بين الخزن الفرعية' : 'Drawer-to-Drawer Transfer'}
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            {isAr
              ? 'يمكنك تحويل الأرصدة بين الخزن المختلفة (كاش، انستا باي، محفظة، فيزا) للفرع الحالي.'
              : 'Transfer funds between different drawers (Cash, InstaPay, Wallet, Visa) for the current branch.'}
          </p>
        </div>

        {activeSessionId ? (
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            {transferError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
                {transferError}
              </div>
            )}
            {transferSuccess && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                {transferSuccess}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 items-end">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  {isAr ? 'من الخزنة' : 'From Drawer'}
                </label>
                <select
                  className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-950 outline-none focus:border-blue-500"
                  value={fromDrawer}
                  onChange={(e) => setFromDrawer(e.target.value as any)}
                >
                  <option value="CASH">💵 {isAr ? 'درج الكاش' : 'Cash Drawer'}</option>
                  <option value="INSTAPAY">⚡ {isAr ? 'انستا باي' : 'InstaPay'}</option>
                  <option value="WALLET">📱 {isAr ? 'المحفظة الإلكترونية' : 'E-Wallet'}</option>
                  <option value="VISA">💳 {isAr ? 'فيزا / بنك' : 'Visa / Bank'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  {isAr ? 'إلى الخزنة' : 'To Drawer'}
                </label>
                <select
                  className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-950 outline-none focus:border-blue-500"
                  value={toDrawer}
                  onChange={(e) => setToDrawer(e.target.value as any)}
                >
                  <option value="CASH">💵 {isAr ? 'درج الكاش' : 'Cash Drawer'}</option>
                  <option value="INSTAPAY">⚡ {isAr ? 'انستا باي' : 'InstaPay'}</option>
                  <option value="WALLET">📱 {isAr ? 'المحفظة الإلكترونية' : 'E-Wallet'}</option>
                  <option value="VISA">💳 {isAr ? 'فيزا / بنك' : 'Visa / Bank'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  {isAr ? 'المبلغ' : 'Amount'}
                </label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                  {isAr ? 'البيان / الملاحظة' : 'Note'}
                </label>
                <Input
                  type="text"
                  placeholder={isAr ? 'ملاحظة اختيارية...' : 'Optional note...'}
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={transferLoading} className="px-6 py-2.5 rounded-full font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                {transferLoading ? (isAr ? 'جاري التحويل...' : 'Transferring...') : (isAr ? 'تأكيد التحويل' : 'Confirm Transfer')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            ⚠️ {isAr 
              ? 'التحويل بين الخزن يتطلب وجود جلسة درج مفتوحة (وردية نشطة) للمستخدم الحالي. يرجى فتح الوردية أولاً.' 
              : 'Drawer transfers require an open cashier session (active shift) for the current user. Please open a register session first.'}
          </div>
        )}
      </Card>

      {/* Main Drawer Tabs and Log Table */}
      <Card>
        {/* Tab Header */}
        <div className="flex border-b border-stone-200 pb-3 mb-6 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('CASH')}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition ${
              activeTab === 'CASH'
                ? 'bg-stone-900 text-white shadow-sm'
                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            💵 {isAr ? 'درج الكاش' : 'Cash Drawer'} ({cashEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('INSTAPAY')}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition ${
              activeTab === 'INSTAPAY'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            ⚡ {isAr ? 'انستا باي (InstaPay)' : 'InstaPay'} ({instapayEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('WALLET')}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition ${
              activeTab === 'WALLET'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            📱 {isAr ? 'المحفظة الإلكترونية' : 'E-Wallet'} ({walletEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('VISA')}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition ${
              activeTab === 'VISA'
                ? 'bg-indigo-700 text-white shadow-sm'
                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            💳 {isAr ? 'فيزا / بنك' : 'Visa / Bank'} ({visaEvents.length})
          </button>
        </div>

        {/* List Table */}
        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-right text-sm" dir={isAr ? 'rtl' : 'ltr'}>
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'الوقت' : 'Time'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'النوع' : 'Event Type'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'التفاصيل / البيان' : 'Details'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'المستخدم' : 'Created By'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'القيمة' : 'Amount'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'الرصيد التراكمي' : 'Running Balance'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'المصدر' : 'Source'}</th>
                </tr>
              </thead>
              <tbody>
                {eventsWithRunningBalance.map((event) => (
                  <tr key={event.id} className="border-t border-stone-200 bg-white hover:bg-stone-50/20">
                    <td className="px-4 py-4 text-stone-600 font-mono">
                      {dateTime(new Date(event.time))}
                    </td>
                    <td className="px-4 py-4 font-semibold text-stone-900">
                      {event.label}
                    </td>
                    <td className="px-4 py-4 text-stone-500 max-w-sm truncate" title={event.details}>
                      {event.details}
                    </td>
                    <td className="px-4 py-4 text-stone-600">
                      {event.cashierName}
                    </td>
                    <td className={`px-4 py-4 font-bold ${event.type === 'INITIAL_BALANCE' ? 'text-stone-400' : event.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {event.type === 'INITIAL_BALANCE' ? '-' : `${event.amount >= 0 ? '+' : ''}${money(event.amount, currencySymbol)}`}
                    </td>
                    <td className="px-4 py-4 font-bold text-stone-900">
                      {money(event.runningBalance, currencySymbol)}
                    </td>
                    <td className="px-4 py-4">
                      {event.sourceLink ? (
                        <a
                          href={lp(event.sourceLink)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                        >
                          {isAr ? 'عرض المصدر ↗' : 'View Source ↗'}
                        </a>
                      ) : (
                        <span className="text-xs text-stone-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {activeEvents.length === 0 && (
            <div className="border-t border-stone-200 bg-stone-50 px-6 py-12 text-center text-sm text-stone-500">
              {isAr ? 'لا توجد حركات مسجلة في هذا الدرج لهذا اليوم.' : 'No movements recorded in this drawer for today.'}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
