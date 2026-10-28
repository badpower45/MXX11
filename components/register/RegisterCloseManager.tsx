'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import {
  REGISTER_DENOMINATIONS,
  calculateDenominationTotal,
  createEmptyDenominationSnapshot,
  type RegisterDenominationSnapshot
} from '@/lib/register';
import { dateTime, money } from '@/lib/format';
import { SerializedActiveCashSession, SerializedCashSession, SerializedRegisterTimelineEntry } from '@/lib/serializers/register';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

type CountMethod = 'DENOMINATION' | 'MANUAL';
type MovementType = 'PAYOUT' | 'CASH_DROP' | 'PETTY_CASH';
type DrawerType = 'CASH' | 'INSTAPAY' | 'WALLET';

type SessionForm = {
  countMethod: CountMethod;
  closingActual: string;
  closingActualCash: string;
  closingActualInstaPay: string;
  closingActualWallet: string;
  notes: string;
  denominationBreakdown: RegisterDenominationSnapshot;
  movementType: MovementType;
  movementDrawer: DrawerType;
  movementAmount: string;
  movementNote: string;

  transferFromDrawer: 'CASH' | 'INSTAPAY' | 'WALLET' | 'VISA';
  transferToDrawer: 'CASH' | 'INSTAPAY' | 'WALLET' | 'VISA';
  transferAmount: string;
  transferNote: string;
};

type SessionForms = Record<string, SessionForm>;

const MOVEMENT_OPTIONS: MovementType[] = ['PAYOUT', 'CASH_DROP', 'PETTY_CASH'];

function createInitialForm(session: SerializedActiveCashSession): SessionForm {
  const denominationBreakdown =
    session.denominationBreakdown && Object.values(session.denominationBreakdown).some((value) => value > 0)
      ? session.denominationBreakdown
      : createEmptyDenominationSnapshot();

  return {
    countMethod: 'DENOMINATION',
    closingActual: session.expectedCash,
    closingActualCash: session.expectedCash,
    closingActualInstaPay: session.summary?.expectedInstaPay ?? '0.00',
    closingActualWallet: session.summary?.expectedWallet ?? '0.00',
    notes: '',
    denominationBreakdown,
    movementType: 'PAYOUT',
    movementDrawer: 'CASH',
    movementAmount: '',
    movementNote: '',

    transferFromDrawer: 'CASH',
    transferToDrawer: 'INSTAPAY',
    transferAmount: '',
    transferNote: ''
  };
}

function varianceTone(variance: number) {
  if (variance > 0) return 'emerald';
  if (variance < 0) return 'red';
  return 'stone';
}

function movementTone(type: string) {
  if (type === 'CASH_SALE' || type === 'OPENING_FLOAT' || type === 'CLOSING_COUNT') {
    return 'emerald';
  }

  if (type === 'REFUND') {
    return 'red';
  }

  return 'amber';
}

function getMovementLink(entry: SerializedRegisterTimelineEntry) {
  if (entry.type === 'CASH_SALE' || entry.type === 'REFUND') {
    if (entry.referenceId) {
      return `/sales/${entry.referenceId}`;
    }
    return '/sales';
  }

  const note = entry.note || '';
  if (note.includes('مصروفات فرعية') || note.includes('مصروفات')) {
    return '/expenses';
  }
  if (note.includes('مديونية تاجر') || note.includes('سداد مديونية')) {
    return '/debts';
  }
  if (note.includes('مستحقات تقسيط') || note.includes('حجز مكنة') || note.includes('حجز طلب') || note.includes('حجز مؤن') || note.includes('عربون حجز') || note.includes('متبقي حجز')) {
    return '/dues';
  }
  if (note.includes('ورقة مرور') || note.includes('رسوم تسليم') || note.includes('تصريح مرور') || note.includes('تصريح ميناء')) {
    return '/traffic';
  }
  if (note.includes('شراء مكن') || note.includes('شراء مؤن') || note.includes('شراء بضاعة') || note.includes('فاتورة مؤن')) {
    return '/purchases';
  }

  return null;
}

export default function RegisterCloseManager({
  initialSessions,
  currencySymbol
}: {
  initialSessions: SerializedActiveCashSession[];
  currencySymbol: string;
}) {
  const t = useTranslations('register.close');
  const lp = useLocalizedPath();

  const [sessions, setSessions] = useState(initialSessions);
  const [forms, setForms] = useState<SessionForms>(
    Object.fromEntries(initialSessions.map((session) => [session.id, createInitialForm(session)]))
  );
  const [result, setResult] = useState<SerializedCashSession | null>(null);
  const [error, setError] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [movementLoadingId, setMovementLoadingId] = useState<string | null>(null);
  const [nonSaleTabs, setNonSaleTabs] = useState<Record<string, 'MOVEMENT' | 'TRANSFER'>>({});
  const [transferLoadingId, setTransferLoadingId] = useState<string | null>(null);

  async function recordTransfer(session: SerializedActiveCashSession) {
    const form = forms[session.id];
    setError('');

    if (!form) return;

    const fromDrawer = form.transferFromDrawer;
    const toDrawer = form.transferToDrawer;
    const amount = form.transferAmount;
    const note = form.transferNote;

    if (!amount || Number(amount) <= 0) {
      setError(t('movementAmountError') || 'يرجى إدخال مبلغ صحيح.');
      return;
    }

    if (fromDrawer === toDrawer) {
      setError('لا يمكن التحويل لنفس الخزنة.');
      return;
    }

    setTransferLoadingId(session.id);

    try {
      const response = await fetch(`/api/register/sessions/${session.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDrawer,
          toDrawer,
          amount: Number(amount),
          note
        })
      });

      const data = await response.json().catch(() => ({ error: 'Unable to perform drawer transfer.' }));

      if (!response.ok) {
        setError(data?.error ?? 'Unable to perform drawer transfer.');
        setTransferLoadingId(null);
        return;
      }

      // Fetch updated summary
      const summaryRes = await fetch(`/api/register/sessions/${session.id}/summary`);
      const summaryData = await summaryRes.json();
      setTransferLoadingId(null);

      if (summaryRes.ok && summaryData?.summary) {
        setSessions((current) =>
          current.map((entry) =>
            entry.id === session.id
              ? {
                  ...entry,
                  expectedCash: summaryData.summary.expectedCash,
                  summary: summaryData.summary
                }
              : entry
          )
        );
        updateForm(session.id, { transferAmount: '', transferNote: '' });
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
      setTransferLoadingId(null);
    }
  }

  const sessionCountLabel = useMemo(
    () => t('activeSessionsCount', { count: sessions.length }),
    [sessions.length, t]
  );

  function getMovementTypeLabel(type: string) {
    switch (type) {
      case 'CASH_DROP':
        return t('cashDropLabel');
      case 'PETTY_CASH':
        return t('pettyCashLabel');
      case 'MANUAL_CORRECTION':
        return t('manualCorrectionLabel');
      default:
        return t('payoutLabel');
    }
  }

  function getTimelineLabel(type: string, fallbackLabel: string) {
    if (type === 'OPENING_FLOAT') return t('openingFloat');
    if (type === 'CASH_SALE') return t('cashSales');
    if (type === 'REFUND') return t('cashRefunds');
    if (type === 'CLOSING_COUNT') return t('closingCountLabel');
    return getMovementTypeLabel(type);
  }

  function updateForm(sessionId: string, patch: Partial<SessionForm>) {
    setForms((current) => ({
      ...current,
      [sessionId]: {
        ...current[sessionId],
        ...patch
      }
    }));
  }

  function updateDenomination(
    sessionId: string,
    denominationKey: string,
    value: string
  ) {
    const count = Math.max(0, Math.floor(Number(value) || 0));
    setForms((current) => {
      const form = current[sessionId];
      const nextBreakdown = {
        ...form.denominationBreakdown,
        [denominationKey]: count
      };
      const countedTotal = calculateDenominationTotal(nextBreakdown).toFixed(2);

      return {
        ...current,
        [sessionId]: {
          ...form,
          denominationBreakdown: nextBreakdown,
          closingActual: form.countMethod === 'DENOMINATION' ? countedTotal : form.closingActual,
          closingActualCash: form.countMethod === 'DENOMINATION' ? countedTotal : form.closingActualCash
        }
      };
    });
  }

  async function recordMovement(session: SerializedActiveCashSession) {
    const form = forms[session.id];
    setError('');

    if (!form?.movementAmount || Number(form.movementAmount) <= 0) {
      setError(t('movementAmountError'));
      return;
    }

    if (!form.movementNote.trim()) {
      setError(t('movementNoteError'));
      return;
    }

    setMovementLoadingId(session.id);

    const response = await fetch(`/api/register/sessions/${session.id}/movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: form.movementType,
        amount: Number(form.movementAmount),
        note: form.movementNote,
        drawer: form.movementDrawer
      })
    });

    const data = await response.json().catch(() => ({ error: t('unableRecordMovement') }));
    setMovementLoadingId(null);

    if (!response.ok || !data?.summary) {
      setError(data?.error ?? t('unableRecordMovement'));
      return;
    }

    setSessions((current) =>
      current.map((entry) =>
        entry.id === session.id
          ? {
              ...entry,
              expectedCash: data.summary.expectedCash,
              summary: data.summary
            }
          : entry
      )
    );
    updateForm(session.id, { movementAmount: '', movementNote: '' });
  }

  async function closeSession(session: SerializedActiveCashSession) {
    const form = forms[session.id];
    setError('');

    if (!form) return;

    if (session.canOverride && !form.notes.trim()) {
      setError(t('overrideNoteRequired'));
      return;
    }

    if (form.countMethod === 'MANUAL' && (!form.closingActual || Number(form.closingActual) < 0)) {
      setError(t('manualAmountRequired'));
      return;
    }

    setLoadingId(session.id);

    const response = await fetch(`/api/register/sessions/${session.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closingActual: Number(form.closingActual),
        closingActualCash: Number(form.closingActualCash),
        closingActualInstaPay: Number(form.closingActualInstaPay),
        closingActualWallet: Number(form.closingActualWallet),
        denominationBreakdown:
          form.countMethod === 'DENOMINATION' ? form.denominationBreakdown : null,
        notes: form.notes || null
      })
    });

    const data = await response.json().catch(() => ({ error: t('unableCloseSession') }));
    setLoadingId(null);

    if (!response.ok || !data?.session) {
      setError(data?.error ?? t('unableCloseSession'));
      return;
    }

    setResult(data.session);
    setSessions((current) => current.filter((entry) => entry.id !== session.id));
  }

  if (!sessions.length) {
    return (
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
              {t('title')}
            </div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">{t('noActiveSessions')}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              {t('noActiveSessionsDesc')}
            </p>
          </div>

          <Link href={lp('/register/open')}>
            <Button>{t('openRegisterButton')}</Button>
          </Link>
        </div>

        {result ? (
          <div className="mt-6 rounded-[26px] border border-blue-200 bg-blue-50 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">
              {t('lastClosedSession')}
            </div>
            <div className="mt-2 text-lg font-black text-blue-800">
              {result.cashierName} / {t('variance')}: {money(result.variance, currencySymbol)}
            </div>
            <div className="mt-1 text-sm text-blue-700">
              {t('closedWithExpected', {
                time: result.closedAt ? dateTime(result.closedAt) : dateTime(new Date()),
                expected: money(result.closingExpected, currencySymbol),
                actual: money(result.closingActual, currencySymbol)
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={lp(`/print/register-z-read/${result.id}?autoprint=1`)}>
                <Button type="button">{t('printZRead')}</Button>
              </Link>
              <Link href={lp('/register/daily')}>
                <Button type="button" variant="secondary">{t('openRegisterHistory')}</Button>
              </Link>
            </div>
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
              {t('drawerCloseout')}
            </div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">{t('closeActiveSessions')}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              {t('closeActiveSessionsDesc')}
            </p>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            {sessionCountLabel}
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
      </Card>

      {sessions.map((session) => {
        const form = forms[session.id];
        const countedTotal = calculateDenominationTotal(form?.denominationBreakdown ?? createEmptyDenominationSnapshot());
        
        const actualCash = form?.countMethod === 'DENOMINATION' ? countedTotal : Number(form?.closingActualCash ?? 0);
        const actualInstaPay = Number(form?.closingActualInstaPay ?? 0);
        const actualWallet = Number(form?.closingActualWallet ?? 0);

        const expectedCash = Number(session.expectedCash);
        const expectedInstaPay = Number(session.summary?.expectedInstaPay ?? 0);
        const expectedWallet = Number(session.summary?.expectedWallet ?? 0);

        const cashVariance = Number((actualCash - expectedCash).toFixed(2));
        const instaPayVariance = Number((actualInstaPay - expectedInstaPay).toFixed(2));
        const walletVariance = Number((actualWallet - expectedWallet).toFixed(2));

        const actual = actualCash;
        const expected = expectedCash;
        const variance = cashVariance;

        return (
          <Card key={session.id}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={session.canOverride ? 'amber' : 'emerald'}>
                    {session.canOverride ? t('managerOverride') : t('ownSession')}
                  </Badge>
                  <Badge tone="stone">{t('status_' + session.status)}</Badge>
                  {session.reopenedAt ? <Badge tone="amber">{t('reopenedShift')}</Badge> : null}
                </div>
                <h3 className="mt-3 text-2xl font-black text-stone-950">{session.cashierName}</h3>
                <p className="mt-1 text-sm text-stone-500">{session.cashierEmail ?? t('cashierAccount')}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('openedAt')}</div>
                  <div className="mt-1 text-sm font-semibold text-stone-900">{dateTime(session.openedAt)}</div>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('openingFloat')}</div>
                  <div className="mt-1 text-lg font-black text-stone-950">{money(session.openingFloat, currencySymbol)}</div>
                </div>
              </div>

              {/* تفاصيل الخزن الثلاثة */}
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {/* خزنة الكاش */}
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
                  <h4 className="text-sm font-bold text-stone-900 border-b border-stone-200 pb-2 mb-3">
                    {t('drawerCashTitle') || 'الدرج الفرعي (كاش)'}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-500">{t('expected') || 'المتوقع:'}</span>
                      <span className="font-bold text-blue-700">{money(session.expectedCash, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">{t('counted') || 'الفعلي:'}</span>
                      <span className="font-bold text-stone-800">{money(actualCash, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between border-t border-stone-200 pt-2 font-semibold">
                      <span className="text-stone-600">{t('variance') || 'الفارق:'}</span>
                      <span className={cashVariance > 0 ? 'text-blue-700' : cashVariance < 0 ? 'text-red-700' : 'text-stone-950'}>
                        {money(cashVariance, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* خزنة انستا باي */}
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
                  <h4 className="text-sm font-bold text-stone-900 border-b border-stone-200 pb-2 mb-3">
                    {t('drawerInstaPayTitle') || 'درج انستا باي (InstaPay)'}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-500">{t('expected') || 'المتوقع:'}</span>
                      <span className="font-bold text-blue-700">{money(expectedInstaPay, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">{t('counted') || 'الفعلي:'}</span>
                      <span className="font-bold text-stone-800">{money(actualInstaPay, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between border-t border-stone-200 pt-2 font-semibold">
                      <span className="text-stone-600">{t('variance') || 'الفارق:'}</span>
                      <span className={instaPayVariance > 0 ? 'text-blue-700' : instaPayVariance < 0 ? 'text-red-700' : 'text-stone-950'}>
                        {money(instaPayVariance, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* خزنة المحفظة */}
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
                  <h4 className="text-sm font-bold text-stone-900 border-b border-stone-200 pb-2 mb-3">
                    {t('drawerWalletTitle') || 'درج المحفظة الإلكترونية (Wallet)'}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-stone-500">{t('expected') || 'المتوقع:'}</span>
                      <span className="font-bold text-blue-700">{money(expectedWallet, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">{t('counted') || 'الفعلي:'}</span>
                      <span className="font-bold text-stone-800">{money(actualWallet, currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between border-t border-stone-200 pt-2 font-semibold">
                      <span className="text-stone-600">{t('variance') || 'الفارق:'}</span>
                      <span className={walletVariance > 0 ? 'text-blue-700' : walletVariance < 0 ? 'text-red-700' : 'text-stone-950'}>
                        {money(walletVariance, currencySymbol)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
              <div className="space-y-4">
                <div className="rounded-[26px] border border-stone-200 bg-stone-50/85 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('countedCash')}</div>
                      <div className="mt-1 text-xl font-black text-stone-950">{money(actual, currencySymbol)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateForm(session.id, { countMethod: 'DENOMINATION', closingActual: countedTotal.toFixed(2) })}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${form.countMethod === 'DENOMINATION' ? 'border-blue-600 bg-blue-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}
                      >
                        {t('denominationCount')}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateForm(session.id, { countMethod: 'MANUAL' })}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${form.countMethod === 'MANUAL' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}
                      >
                        {t('manualAmount')}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('denominationTotal')}</div>
                      <div className="mt-1 text-lg font-black text-stone-950">{money(countedTotal, currencySymbol)}</div>
                    </div>
                    <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('overShort')}</div>
                      <div className={`mt-1 text-lg font-black ${variance > 0 ? 'text-blue-700' : variance < 0 ? 'text-red-700' : 'text-stone-950'}`}>
                        {money(variance, currencySymbol)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {REGISTER_DENOMINATIONS.map((denomination) => {
                      const key = denomination.value.toFixed(2);
                      const count = form.denominationBreakdown[key] ?? 0;
                      return (
                        <div key={key} className="rounded-[22px] border border-stone-200 bg-white px-4 py-3">
                          <div className="text-sm font-semibold text-stone-900">{denomination.label}</div>
                          <div className="mt-1 text-xs text-stone-500">{money(denomination.value, currencySymbol)} {t('each')}</div>
                          <div className="mt-3 flex items-center gap-3">
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              value={String(count)}
                              onChange={(event) => updateDenomination(session.id, key, event.target.value)}
                            />
                            <div className="min-w-[88px] text-right text-sm font-semibold text-stone-700">
                              {money(denomination.value * count, currencySymbol)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-stone-700">{t('actualCountedCash') || 'الدرج الفعلي (كاش)'}</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.countMethod === 'DENOMINATION' ? countedTotal.toFixed(2) : form.closingActualCash}
                        onChange={(event) => {
                          const val = event.target.value;
                          updateForm(session.id, { closingActualCash: val, closingActual: val });
                        }}
                        disabled={form.countMethod === 'DENOMINATION'}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-stone-700">{t('actualCountedInstaPay') || 'الرصيد الفعلي (انستا باي)'}</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.closingActualInstaPay}
                        onChange={(event) => updateForm(session.id, { closingActualInstaPay: event.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-stone-700">{t('actualCountedWallet') || 'الرصيد الفعلي (محفظة)'}</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.closingActualWallet}
                        onChange={(event) => updateForm(session.id, { closingActualWallet: event.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-semibold text-stone-700">{t('closeoutNotes')}</label>
                    <Input
                      value={form.notes}
                      onChange={(event) => updateForm(session.id, { notes: event.target.value })}
                      placeholder={session.canOverride ? t('overrideReasonPlaceholder') : t('drawerNotesPlaceholder')}
                    />
                  </div>
                </div>

                <div className="rounded-[26px] border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('nonSaleMovements')}</div>
                      <h4 className="mt-2 text-lg font-black text-stone-900">{t('payoutsDropsPetty')}</h4>
                      <p className="mt-1 text-sm text-stone-500">{t('recordMovementDesc')}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {MOVEMENT_OPTIONS.map((type) => (
                        <div key={type} className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                          {getMovementTypeLabel(type)}
                          <div className="mt-1 font-semibold text-stone-900">
                            {money(session.summary.movementTotals[type], currencySymbol)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tab Selector */}
                  <div className="flex border-b border-stone-200 pb-2 mt-4 mb-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNonSaleTabs((prev) => ({ ...prev, [session.id]: 'MOVEMENT' }));
                      }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                        (nonSaleTabs[session.id] ?? 'MOVEMENT') === 'MOVEMENT'
                          ? 'bg-stone-900 text-white shadow-sm'
                          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      {t('recordMovementTab') || 'تسجيل حركة مالية'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNonSaleTabs((prev) => ({ ...prev, [session.id]: 'TRANSFER' }));
                      }}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${
                        nonSaleTabs[session.id] === 'TRANSFER'
                          ? 'bg-stone-900 text-white shadow-sm'
                          : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                      }`}
                    >
                      {t('drawerTransferTab') || 'تحويل بين الخزن'}
                    </button>
                  </div>

                  {(nonSaleTabs[session.id] ?? 'MOVEMENT') === 'MOVEMENT' ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,1.3fr)_auto]">
                      <select
                        className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-blue-500"
                        value={form.movementType}
                        onChange={(event) => updateForm(session.id, { movementType: event.target.value as MovementType })}
                      >
                        {MOVEMENT_OPTIONS.map((type) => (
                          <option key={type} value={type}>{getMovementTypeLabel(type)}</option>
                        ))}
                      </select>
                      <select
                        className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-blue-500"
                        value={form.movementDrawer}
                        onChange={(event) => updateForm(session.id, { movementDrawer: event.target.value as any })}
                      >
                        <option value="CASH">درج الكاش</option>
                        <option value="INSTAPAY">درج انستا باي</option>
                        <option value="WALLET">درج المحفظة</option>
                      </select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t('amountLabel')}
                        value={form.movementAmount}
                        onChange={(event) => updateForm(session.id, { movementAmount: event.target.value })}
                      />
                      <Input
                        placeholder={t('reasonNotePlaceholder')}
                        value={form.movementNote}
                        onChange={(event) => updateForm(session.id, { movementNote: event.target.value })}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={movementLoadingId === session.id}
                        onClick={() => void recordMovement(session)}
                      >
                        {movementLoadingId === session.id ? t('savingProgress') : t('recordButton')}
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.0fr)_minmax(0,1.0fr)_minmax(0,0.8fr)_minmax(0,1.5fr)_auto]">
                      <select
                        className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-blue-500"
                        value={form.transferFromDrawer}
                        onChange={(event) => updateForm(session.id, { transferFromDrawer: event.target.value as any })}
                      >
                        <option value="CASH">💵 درج الكاش</option>
                        <option value="INSTAPAY">⚡ انستا باي</option>
                        <option value="WALLET">📱 درج المحفظة</option>
                        <option value="VISA">💳 درج الفيزا</option>
                      </select>
                      <select
                        className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-blue-500"
                        value={form.transferToDrawer}
                        onChange={(event) => updateForm(session.id, { transferToDrawer: event.target.value as any })}
                      >
                        <option value="CASH">💵 درج الكاش</option>
                        <option value="INSTAPAY">⚡ انستا باي</option>
                        <option value="WALLET">📱 درج المحفظة</option>
                        <option value="VISA">💳 درج الفيزا</option>
                      </select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={t('amountLabel') || 'المبلغ'}
                        value={form.transferAmount}
                        onChange={(event) => updateForm(session.id, { transferAmount: event.target.value })}
                      />
                      <Input
                        placeholder={t('reasonNotePlaceholder') || 'ملاحظات التحويل'}
                        value={form.transferNote}
                        onChange={(event) => updateForm(session.id, { transferNote: event.target.value })}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={transferLoadingId === session.id}
                        onClick={() => void recordTransfer(session)}
                      >
                        {transferLoadingId === session.id ? t('savingProgress') : 'تأكيد التحويل'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(245,245,244,0.94))] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('shiftSummary')}</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('salesCount')}</div>
                      <div className="mt-1 text-2xl font-black text-stone-950">{session.summary.salesCount}</div>
                    </div>
                    <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('grossSales')}</div>
                      <div className="mt-1 text-2xl font-black text-stone-950">{money(session.summary.grossSalesTotal, currencySymbol)}</div>
                    </div>
                    <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('cashSales')}</div>
                      <div className="mt-1 text-2xl font-black text-blue-700">{money(session.summary.cashSalesTotal, currencySymbol)}</div>
                    </div>
                    <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('cashRefunds')}</div>
                      <div className={`mt-1 text-2xl font-black ${Number(session.summary.refundCashTotal) > 0 ? 'text-red-700' : 'text-stone-950'}`}>{money(session.summary.refundCashTotal, currencySymbol)}</div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[22px] border border-stone-200 bg-white px-4 py-4">
                    <div className="text-sm font-semibold text-stone-900">{t('paymentBreakdown')}</div>
                    <div className="mt-3 space-y-2">
                      {session.summary.paymentBreakdown.length ? session.summary.paymentBreakdown.map((entry) => (
                        <div key={entry.method} className="flex items-center justify-between rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
                          <span className="text-stone-600">{entry.method}</span>
                          <span className="font-semibold text-stone-900">{money(entry.amount, currencySymbol)}</span>
                        </div>
                      )) : (
                        <div className="rounded-[18px] border border-dashed border-stone-300 bg-stone-50 px-3 py-4 text-sm text-stone-500">
                          {t('noPaymentsPosted')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-[26px] border border-stone-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('cashMovementTimeline')}</div>
                      <h4 className="mt-2 text-lg font-black text-stone-900">{t('shiftCashTrail')}</h4>
                    </div>
                    <Badge tone={varianceTone(variance)}>
                      {variance > 0 ? t('overStatus') : variance < 0 ? t('shortStatus') : t('balancedStatus')}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {session.summary.timeline.map((entry) => {
                      const path = getMovementLink(entry);
                      const content = (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone={movementTone(entry.type)}>{getTimelineLabel(entry.type, entry.label)}</Badge>
                              {entry.reference ? <span className="text-xs text-stone-500">{entry.reference}</span> : null}
                            </div>
                            <div className="mt-2 text-sm text-stone-500">
                              {dateTime(entry.occurredAt)}
                              {entry.userName ? ` / ${entry.userName}` : ''}
                            </div>
                            {entry.note ? <div className="mt-2 text-sm text-stone-700">{entry.note}</div> : null}
                          </div>
                          <div className={`text-right text-lg font-black ${Number(entry.amount) >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                            {Number(entry.amount) >= 0 ? '+' : ''}
                            {money(entry.amount, currencySymbol)}
                          </div>
                        </div>
                      );

                      if (path) {
                        return (
                          <Link
                            key={entry.id}
                            href={lp(path)}
                            className="block rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3 transition hover:border-blue-300 hover:bg-stone-100/50 cursor-pointer"
                          >
                            {content}
                          </Link>
                        );
                      }

                      return (
                        <div key={entry.id} className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                disabled={loadingId === session.id}
                onClick={() => void closeSession(session)}
              >
                {loadingId === session.id
                  ? t('closingRegisterProgress')
                  : session.canOverride
                    ? t('overrideCloseButton')
                    : t('closeRegisterButton')}
              </Button>
              <Link href={lp('/register/daily')}>
                <Button type="button" variant="secondary">{t('viewHistoryButton')}</Button>
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
