'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money } from '@/lib/format';
import { SerializedCashSession } from '@/lib/serializers/register';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

export default function RegisterOpenForm({
  currencySymbol,
  activeSession,
  openingFloatRequired,
  openingFloatAmount
}: {
  currencySymbol: string;
  activeSession: SerializedCashSession | null;
  openingFloatRequired: boolean;
  openingFloatAmount: string;
}) {
  const t = useTranslations('register.open');
  const lp = useLocalizedPath();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [openingFloat, setOpeningFloat] = useState(openingFloatAmount);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function openRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await fetch('/api/register/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openingFloat: Number(openingFloat),
        notes: notes || null
      })
    });

    const data = await response.json().catch(() => ({ error: t('unableToOpen') }));
    setLoading(false);

    if (!response.ok) {
      // Localize backend minimum float error if it comes back
      let errMsg = data?.error ?? t('unableToOpen');
      if (typeof errMsg === 'string' && errMsg.includes('must be at least')) {
        errMsg = t('minimumFloatError', { amount: money(openingFloatAmount, currencySymbol) });
      }
      setError(errMsg);
      return;
    }

    window.location.href = lp(redirectParam || '/register/close');
  }

  if (activeSession) {
    return (
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
              {t('alreadyOpen')}
            </div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">{t('currentDrawerActive')}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              {t('alreadyHaveSession')}
            </p>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            {t('openedAt', { time: dateTime(activeSession.openedAt) })}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
              {t('openingFloat')}
            </div>
            <div className="mt-2 text-2xl font-black text-stone-950">
              {money(activeSession.openingFloat, currencySymbol)}
            </div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
              {t('status')}
            </div>
            <div className="mt-2 text-2xl font-black text-blue-700">{t('status_' + activeSession.status)}</div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
              {t('notes')}
            </div>
            <div className="mt-2 text-sm leading-6 text-stone-600">
              {activeSession.notes ?? t('noOpeningNotes')}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href={lp('/register/close')}>
            <Button>{t('goToClose')}</Button>
          </Link>
          <Link href={lp('/register/daily')}>
            <Button variant="secondary">{t('viewHistory')}</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
            {t('title')}
          </div>
          <h2 className="mt-2 text-2xl font-black text-stone-950">{t('startDrawerSession')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            {t('openingRecordsDescription')}
          </p>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
          {openingFloatRequired
            ? t('requiresMinimum', { amount: money(openingFloatAmount, currencySymbol) })
            : t('oneCashierRule')}
        </div>
      </div>

      <form onSubmit={openRegister} className="mt-6 space-y-6">
        {openingFloatRequired ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            {t('openingRequirementMinimum', { amount: money(openingFloatAmount, currencySymbol) })}
          </div>
        ) : null}

        <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('openingDetails')}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">
                {t('openingFloat')}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={(event) => setOpeningFloat(event.target.value)}
                placeholder={openingFloatAmount}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">
                {t('notes')}
              </label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t('optionalNotesPlaceholder')}
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={loading}>
            {loading ? t('openingRegisterProgress') : t('openRegisterButton')}
          </Button>
          <Link href={lp('/register/daily')}>
            <Button type="button" variant="secondary">{t('viewHistoryButton')}</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
