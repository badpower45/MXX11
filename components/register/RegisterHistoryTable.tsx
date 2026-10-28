'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { dateTime, money, shortDate } from '@/lib/format';
import { SerializedCashSession } from '@/lib/serializers/register';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

function statusTone(status: SerializedCashSession['status']) {
  if (status === 'OPEN') {
    return 'blue';
  }

  if (status === 'OVERRIDE_CLOSED') {
    return 'amber';
  }

  return 'emerald';
}

function varianceTone(variance: string | null) {
  const amount = Number(variance ?? 0);
  if (amount > 0) {
    return 'emerald';
  }

  if (amount < 0) {
    return 'red';
  }

  return 'stone';
}

export default function RegisterHistoryTable({
  sessions: initialSessions,
  currencySymbol,
  canManageSessions,
  locale
}: {
  sessions: SerializedCashSession[];
  currencySymbol: string;
  canManageSessions: boolean;
  locale: string;
}) {
  const t = useTranslations('register.history');
  const lp = useLocalizedPath();

  const [sessions, setSessions] = useState(initialSessions);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionSummaries, setSessionSummaries] = useState<Record<string, any>>({});
  const [loadingSummaryId, setLoadingSummaryId] = useState<string | null>(null);

  async function toggleExpand(sessionId: string) {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }

    setExpandedSessionId(sessionId);

    if (!sessionSummaries[sessionId]) {
      setLoadingSummaryId(sessionId);
      setError('');
      try {
        const response = await fetch(`/api/register/sessions/${sessionId}/summary`);
        if (!response.ok) {
          throw new Error('Failed to fetch summary');
        }
        const data = await response.json();
        setSessionSummaries((prev) => ({
          ...prev,
          [sessionId]: data.summary
        }));
      } catch (err) {
        console.error(err);
        setError(isAr ? 'عفوًا، تعذر تحميل ملخص الوردية.' : 'Failed to load shift summary.');
      } finally {
        setLoadingSummaryId(null);
      }
    }
  }

  const closedSessions = sessions.filter((session) => session.status !== 'OPEN');
  const openSessions = sessions.length - closedSessions.length;
  const totalVariance = closedSessions.reduce((sum, session) => sum + Number(session.variance ?? 0), 0);
  const isAr = locale === 'ar';
  const openSessionsList = sessions.filter((s) => s.status === 'OPEN');
  const activeExpectedCash = openSessionsList.reduce((sum, s) => sum + Number(s.closingExpectedCash ?? 0), 0);
  const activeExpectedInstaPay = openSessionsList.reduce((sum, s) => sum + Number(s.closingExpectedInstaPay ?? 0), 0);
  const activeExpectedWallet = openSessionsList.reduce((sum, s) => sum + Number(s.closingExpectedWallet ?? 0), 0);
  const activeExpectedTotal = activeExpectedCash + activeExpectedInstaPay + activeExpectedWallet;

  function getStatusLabel(status: SerializedCashSession['status']) {
    switch (status) {
      case 'OPEN':
        return t('statusOpen');
      case 'CLOSED':
        return t('statusClosed');
      case 'OVERRIDE_CLOSED':
        return t('statusOverrideClosed');
      default:
        return status;
    }
  }

  async function reviewSession(session: SerializedCashSession) {
    const reviewNote = window.prompt(
      t('managerReviewPrompt'),
      session.reviewNote ?? ''
    );

    if (reviewNote === null) {
      return;
    }

    setError('');
    setLoadingId(session.id);

    const response = await fetch(`/api/register/sessions/${session.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNote: reviewNote || null })
    });
    const data = await response.json().catch(() => ({ error: t('unableReview') }));
    setLoadingId(null);

    if (!response.ok || !data?.session) {
      setError(data?.error ?? t('unableReview'));
      return;
    }

    setSessions((current) =>
      current.map((entry) => (entry.id === session.id ? data.session : entry))
    );
  }

  async function reopenSession(session: SerializedCashSession) {
    const reason = window.prompt(t('reopenPromptReason'));

    if (!reason) {
      return;
    }

    setError('');
    setLoadingId(session.id);

    const response = await fetch(`/api/register/sessions/${session.id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await response.json().catch(() => ({ error: t('unableReopen') }));
    setLoadingId(null);

    if (!response.ok || !data?.session) {
      setError(data?.error ?? t('unableReopen'));
      return;
    }

    setSessions((current) =>
      current.map((entry) => (entry.id === session.id ? data.session : entry))
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
              {t('title')}
            </div>
            <h2 className="mt-2 text-2xl font-black text-stone-955">{t('sessionTimeline')}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              {t('subtitle')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                {t('sessionsCount')}
              </div>
              <div className="mt-1 text-2xl font-black text-stone-950">{sessions.length}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                {t('openSessionsCount')}
              </div>
              <div className="mt-1 text-2xl font-black text-sky-700">{openSessions}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                {t('netVariance')}
              </div>
              <div className={`mt-1 text-2xl font-black ${totalVariance > 0 ? 'text-blue-700' : totalVariance < 0 ? 'text-red-700' : 'text-stone-950'}`}>
                {money(totalVariance, currencySymbol)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {openSessionsList.length > 0 && (
        <Card className="border-blue-100 bg-blue-50/20">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">
                {isAr ? 'الدرج النشط حالياً' : 'Current Active Drawer'}
              </div>
              <h3 className="mt-1 text-lg font-black text-stone-950">
                {isAr ? 'الأرصدة المتوقعة في الوردية المفتوحة حالياً' : 'Live Expected Balances in Open Shift'}
              </h3>
            </div>
            <Badge tone="blue">{isAr ? 'نشط الآن' : 'Active Now'}</Badge>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
                {isAr ? '💵 درج الكاش' : 'Cash Drawer'}
              </div>
              <div className="mt-2 text-xl font-black text-stone-900">{money(activeExpectedCash, currencySymbol)}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
                {isAr ? '⚡ رصيد انستا باي' : 'InstaPay Balance'}
              </div>
              <div className="mt-2 text-xl font-black text-blue-700">{money(activeExpectedInstaPay, currencySymbol)}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-white p-4 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
                {isAr ? '📱 رصيد المحافظ' : 'Wallet Balance'}
              </div>
              <div className="mt-2 text-xl font-black text-emerald-700">{money(activeExpectedWallet, currencySymbol)}</div>
            </div>
            <div className="rounded-[22px] border border-blue-200 bg-blue-50/80 p-4 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-800">
                {isAr ? '💰 إجمالي المتوفر نشط' : 'Total Live Active'}
              </div>
              <div className="mt-2 text-xl font-black text-blue-900">{money(activeExpectedTotal, currencySymbol)}</div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="px-4 py-3.5">{t('table.cashier')}</th>
                  <th className="px-4 py-3.5">{t('table.opened')}</th>
                  <th className="px-4 py-3.5">{t('table.closed')}</th>
                  <th className="px-4 py-3.5">{t('table.float')}</th>
                  <th className="px-4 py-3.5">{t('table.expected')}</th>
                  <th className="px-4 py-3.5">{t('table.actual')}</th>
                  <th className="px-4 py-3.5">{t('table.variance')}</th>
                  <th className="px-4 py-3.5">{t('table.review')}</th>
                  <th className="px-4 py-3.5">{t('table.status')}</th>
                  <th className="px-4 py-3.5">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <React.Fragment key={session.id}>
                    <tr className="border-t border-stone-200 bg-white align-top hover:bg-stone-50/20">
                      <td className="px-4 py-4 w-10">
                        <button
                          type="button"
                          onClick={() => void toggleExpand(session.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 transition"
                          title={isAr ? 'عرض التفاصيل' : 'View Details'}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className={`h-4 w-4 transition-transform duration-200 ${expandedSessionId === session.id ? 'rotate-90' : ''}`}
                          >
                            <path d="m9 5 7 7-7 7" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{session.cashierName}</div>
                        <div className="mt-1 text-xs text-stone-500">{session.cashierEmail ?? 'Cashier account'}</div>
                        {session.reopenedAt ? (
                          <div className="mt-2 text-xs text-sky-700">
                            {t('reopenedAtBy', {
                              time: dateTime(session.reopenedAt),
                              name: session.reopenedByName ?? ''
                            })}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-stone-600">{dateTime(session.openedAt)}</td>
                      <td className="px-4 py-4 text-stone-600">
                        {session.closedAt ? (
                          <>
                            <div>{dateTime(session.closedAt)}</div>
                            {session.closedByName ? <div className="mt-1 text-xs text-stone-500">{t('byUser', { name: session.closedByName })}</div> : null}
                          </>
                        ) : t('stillOpen')}
                      </td>
                      <td className="px-4 py-4 font-semibold text-stone-900">{money(session.openingFloat, currencySymbol)}</td>
                      <td className="px-4 py-4 text-stone-700">{session.closingExpected ? money(session.closingExpected, currencySymbol) : t('awaitingCloseout')}</td>
                      <td className="px-4 py-4 text-stone-700">{session.closingActual ? money(session.closingActual, currencySymbol) : t('awaitingCount')}</td>
                      <td className="px-4 py-4">
                        <Badge tone={varianceTone(session.variance)}>
                          {session.variance ? money(session.variance, currencySymbol) : t('awaitingCloseout')}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {session.reviewedAt ? (
                          <div className="text-xs text-stone-600">
                            <div className="font-semibold text-blue-700">{t('approvedStatus')}</div>
                            <div>{dateTime(session.reviewedAt)}</div>
                            {session.reviewedByName ? <div>{t('byUser', { name: session.reviewedByName })}</div> : null}
                          </div>
                        ) : (
                          <span className="text-xs text-stone-500">{t('pendingReviewStatus')}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={statusTone(session.status)}>{getStatusLabel(session.status)}</Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[220px] flex-col gap-2">
                          <Link href={lp(`/print/register-z-read/${session.id}`)} className="inline-flex">
                            <Button type="button" variant="secondary" className="w-full justify-center">
                              {t('zReadButton')}
                            </Button>
                          </Link>
                          {canManageSessions && session.status !== 'OPEN' ? (
                            <Button
                                type="button"
                                disabled={loadingId === session.id}
                                onClick={() => void reviewSession(session)}
                              >
                                {loadingId === session.id ? t('saveReviewProgress') : session.reviewedAt ? t('updateReviewButton') : t('approveButton')}
                              </Button>
                          ) : null}
                          {canManageSessions && session.status !== 'OPEN' ? (
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={loadingId === session.id}
                                onClick={() => void reopenSession(session)}
                              >
                                {t('reopenShiftButton')}
                              </Button>
                          ) : null}
                          {session.status === 'OPEN' ? (
                            <Link href={lp('/register/close')} className="inline-flex">
                              <Button type="button" className="w-full justify-center">{t('goToCloseoutButton')}</Button>
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>

                    {expandedSessionId === session.id && (
                      <tr className="bg-stone-50/60 border-t border-stone-200">
                        <td colSpan={11} className="px-6 py-6">
                          <div className="space-y-6 text-right" dir={isAr ? 'rtl' : 'ltr'}>
                            {/* Title */}
                            <div>
                              <h3 className="text-base font-black text-stone-900">
                                {isAr ? 'تفاصيل الخزن الفرعية والجدول الزمني للوردية' : 'Sub-Drawers & Shift Timeline Detail'}
                              </h3>
                              <p className="text-xs text-stone-500 mt-1">
                                {isAr 
                                  ? 'تفاصيل المبالغ المتوقعة والمسجلة فعلياً لكل درج فرعي، بالإضافة إلى جدول الحركات المتسلسلة وجرد فئات العملة.'
                                  : 'Breakdown of expected/actual amounts for each drawer, plus chronological timeline and denomination breakdown.'}
                              </p>
                            </div>

                            {loadingSummaryId === session.id ? (
                              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-250 border-t-blue-600"></div>
                                <span className="text-sm font-semibold text-stone-500">
                                  {isAr ? 'جاري تحميل تفاصيل الوردية والجدول الزمني...' : 'Loading shift details and timeline...'}
                                </span>
                              </div>
                            ) : (
                              <>
                                {/* 3 Drawer Cards */}
                                <div className="grid gap-4 md:grid-cols-3">
                                  {/* Cash Drawer */}
                                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                    <h4 className="font-bold text-sm text-stone-850 border-b border-stone-100 pb-2 mb-2">
                                      <span>💵 {isAr ? 'درج الكاش الفرعي' : 'Cash Drawer'}</span>
                                    </h4>
                                    <div className="space-y-2 text-xs text-stone-600">
                                      <div className="flex justify-between">
                                        <span>{isAr ? 'الرصيد الافتتاحي:' : 'Opening Float:'}</span>
                                        <span className="font-semibold text-stone-900">{money(session.openingFloat, currencySymbol)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>{isAr ? 'المتوقع (اللايف):' : 'Expected (Live):'}</span>
                                        <span className="font-bold text-blue-700">
                                          {sessionSummaries[session.id] 
                                            ? money(sessionSummaries[session.id].expectedCash, currencySymbol)
                                            : (session.closingExpectedCash ? money(session.closingExpectedCash, currencySymbol) : '-')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>{isAr ? 'الفعلي المسجل:' : 'Actual Counted:'}</span>
                                        <span className="font-semibold text-stone-900">
                                          {session.closingActualCash 
                                            ? money(session.closingActualCash, currencySymbol) 
                                            : (session.status === 'OPEN' ? (isAr ? 'جاري العمل' : 'In Progress') : '-')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-t border-stone-100 pt-1.5 font-bold">
                                        <span>{isAr ? 'الفارق المالي:' : 'Variance:'}</span>
                                        {(() => {
                                          const exp = sessionSummaries[session.id]
                                            ? Number(sessionSummaries[session.id].expectedCash)
                                            : (session.closingExpectedCash ? Number(session.closingExpectedCash) : null);
                                          const act = session.closingActualCash ? Number(session.closingActualCash) : null;
                                          if (exp !== null && act !== null) {
                                            const diff = act - exp;
                                            return (
                                              <span className={diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-700' : 'text-stone-900'}>
                                                {money(diff, currencySymbol)}
                                              </span>
                                            );
                                          }
                                          return <span>-</span>;
                                        })()}
                                      </div>
                                    </div>
                                  </div>

                                  {/* InstaPay Drawer */}
                                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                    <h4 className="font-bold text-sm text-stone-850 border-b border-stone-100 pb-2 mb-2">
                                      <span>⚡ {isAr ? 'درج انستا باي (InstaPay)' : 'InstaPay Drawer'}</span>
                                    </h4>
                                    <div className="space-y-2 text-xs text-stone-600">
                                      <div className="flex justify-between">
                                        <span>{isAr ? 'المتوقع (اللايف):' : 'Expected (Live):'}</span>
                                        <span className="font-bold text-blue-700">
                                          {sessionSummaries[session.id] 
                                            ? money(sessionSummaries[session.id].expectedInstaPay, currencySymbol)
                                            : (session.closingExpectedInstaPay ? money(session.closingExpectedInstaPay, currencySymbol) : '-')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>{isAr ? 'الفعلي المسجل:' : 'Actual Counted:'}</span>
                                        <span className="font-semibold text-stone-900">
                                          {session.closingActualInstaPay 
                                            ? money(session.closingActualInstaPay, currencySymbol) 
                                            : (session.status === 'OPEN' ? (isAr ? 'جاري العمل' : 'In Progress') : '-')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-t border-stone-100 pt-1.5 font-bold">
                                        <span>{isAr ? 'الفارق المالي:' : 'Variance:'}</span>
                                        {(() => {
                                          const exp = sessionSummaries[session.id]
                                            ? Number(sessionSummaries[session.id].expectedInstaPay)
                                            : (session.closingExpectedInstaPay ? Number(session.closingExpectedInstaPay) : null);
                                          const act = session.closingActualInstaPay ? Number(session.closingActualInstaPay) : null;
                                          if (exp !== null && act !== null) {
                                            const diff = act - exp;
                                            return (
                                              <span className={diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-700' : 'text-stone-900'}>
                                                {money(diff, currencySymbol)}
                                              </span>
                                            );
                                          }
                                          return <span>-</span>;
                                        })()}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Wallet Drawer */}
                                  <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                                    <h4 className="font-bold text-sm text-stone-850 border-b border-stone-100 pb-2 mb-2">
                                      <span>📱 {isAr ? 'درج المحافظ الإلكترونية' : 'Wallet Drawer'}</span>
                                    </h4>
                                    <div className="space-y-2 text-xs text-stone-600">
                                      <div className="flex justify-between">
                                        <span>{isAr ? 'المتوقع (اللايف):' : 'Expected (Live):'}</span>
                                        <span className="font-bold text-blue-700">
                                          {sessionSummaries[session.id] 
                                            ? money(sessionSummaries[session.id].expectedWallet, currencySymbol)
                                            : (session.closingExpectedWallet ? money(session.closingExpectedWallet, currencySymbol) : '-')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>{isAr ? 'الفعلي المسجل:' : 'Actual Counted:'}</span>
                                        <span className="font-semibold text-stone-900">
                                          {session.closingActualWallet 
                                            ? money(session.closingActualWallet, currencySymbol) 
                                            : (session.status === 'OPEN' ? (isAr ? 'جاري العمل' : 'In Progress') : '-')}
                                        </span>
                                      </div>
                                      <div className="flex justify-between border-t border-stone-100 pt-1.5 font-bold">
                                        <span>{isAr ? 'الفارق المالي:' : 'Variance:'}</span>
                                        {(() => {
                                          const exp = sessionSummaries[session.id]
                                            ? Number(sessionSummaries[session.id].expectedWallet)
                                            : (session.closingExpectedWallet ? Number(session.closingExpectedWallet) : null);
                                          const act = session.closingActualWallet ? Number(session.closingActualWallet) : null;
                                          if (exp !== null && act !== null) {
                                            const diff = act - exp;
                                            return (
                                              <span className={diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-700' : 'text-stone-900'}>
                                                {money(diff, currencySymbol)}
                                              </span>
                                            );
                                          }
                                          return <span>-</span>;
                                        })()}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Denominations Count Grid */}
                                {(() => {
                                  const hasDenominations = session.denominationBreakdown && Object.values(session.denominationBreakdown).some(count => Number(count) > 0);
                                  if (!hasDenominations) {
                                    if (session.status !== 'OPEN') {
                                      return (
                                        <div className="text-xs text-stone-500 rounded-xl border border-stone-200 bg-stone-50 p-3">
                                          ℹ️ {isAr ? 'تم إغلاق هذه الوردية بإدخال المبلغ الإجمالي مباشرة (دون تفصيل الفئات).' : 'This shift was closed by entering the total amount directly (no denominations breakdown).'}
                                        </div>
                                      );
                                    }
                                    return null;
                                  }

                                  const denominations = [
                                    { value: 1000, labelAr: '١٠٠٠ جنيه', labelEn: '1000 EGP' },
                                    { value: 500, labelAr: '٥٠٠ جنيه', labelEn: '500 EGP' },
                                    { value: 200, labelAr: '٢٠٠ جنيه', labelEn: '200 EGP' },
                                    { value: 100, labelAr: '١٠٠ جنيه', labelEn: '100 EGP' },
                                    { value: 50, labelAr: '٥٠ جنيه', labelEn: '50 EGP' },
                                    { value: 20, labelAr: '٢٠ جنيه', labelEn: '20 EGP' },
                                    { value: 10, labelAr: '١٠ جنيه', labelEn: '10 EGP' },
                                    { value: 5, labelAr: '٥ جنيه', labelEn: '5 EGP' },
                                    { value: 1, labelAr: '١ جنيه', labelEn: '1 EGP' },
                                    { value: 0.25, labelAr: '٠.٢٥ جنيه', labelEn: '0.25 EGP' }
                                  ];

                                  return (
                                    <div className="space-y-3">
                                      <h4 className="font-bold text-sm text-stone-900">
                                        {isAr ? '🔢 جرد فئات العملة الورقية والمعدنية للكاش' : 'Counted Cash Denominations Grid'}
                                      </h4>
                                      <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
                                        {denominations.map((d) => {
                                          const key = d.value.toFixed(2);
                                          const count = Number(session.denominationBreakdown[key] ?? 0);
                                          if (count === 0) return null;
                                          return (
                                            <div key={d.value} className="rounded-2xl border border-stone-200 bg-white p-3 text-center shadow-sm">
                                              <div className="text-[10px] font-bold text-stone-400">
                                                {isAr ? d.labelAr : d.labelEn}
                                              </div>
                                              <div className="mt-1 text-base font-black text-stone-900">
                                                {count} {isAr ? 'ورقة' : 'pcs'}
                                              </div>
                                              <div className="mt-1 text-xs font-semibold text-stone-500">
                                                {money(count * d.value, currencySymbol)}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}

                                {/* Timeline Section */}
                                <div className="space-y-3">
                                  <h4 className="font-bold text-sm text-stone-900">
                                    {isAr ? '⏱️ الجدول الزمني المفصل للوردية' : 'Chronological Shift Timeline'}
                                  </h4>
                                  
                                  {sessionSummaries[session.id]?.timeline && sessionSummaries[session.id].timeline.length > 0 ? (
                                    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                                      <table className="min-w-full text-right text-xs">
                                        <thead className="bg-stone-50 text-stone-500">
                                          <tr>
                                            <th className="px-4 py-2.5 text-right">{isAr ? 'الوقت' : 'Time'}</th>
                                            <th className="px-4 py-2.5 text-right">{isAr ? 'الحدث' : 'Event / Type'}</th>
                                            <th className="px-4 py-2.5 text-right">{isAr ? 'المبلغ' : 'Amount'}</th>
                                            <th className="px-4 py-2.5 text-right">{isAr ? 'التفاصيل والبيان' : 'Details / Notes'}</th>
                                            <th className="px-4 py-2.5 text-right">{isAr ? 'بواسطة' : 'User'}</th>
                                            <th className="px-4 py-2.5 text-right">{isAr ? 'المصدر' : 'Source'}</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {sessionSummaries[session.id].timeline.map((entry: any) => {
                                            const amt = Number(entry.amount);
                                            const isPositive = amt >= 0;
                                            
                                            // Timeline localization function
                                            const localizedLabel = (() => {
                                              if (!isAr) return entry.label;
                                              switch (entry.type) {
                                                case 'OPENING_FLOAT': return 'رصيد افتتاحي للوردية';
                                                case 'CASH_SALE': return 'مبيعات كاش';
                                                case 'REFUND': return 'مرتجع كاش';
                                                case 'CLOSING_COUNT': return 'جرد الإغلاق للدرج';
                                                case 'PAYOUT': return entry.label.replace('Payout', 'صرف نقدية / مصروف');
                                                case 'CASH_DROP': return entry.label.replace('Cash drop', 'سحب للبنك/الخزنة');
                                                case 'PETTY_CASH': return entry.label.replace('Petty cash', 'عهد نقدية');
                                                case 'MANUAL_CORRECTION': return entry.label.replace('Manual correction', 'تعديل رصيد يدوي');
                                                default: return entry.label;
                                              }
                                            })();

                                            return (
                                              <tr key={entry.id} className="border-t border-stone-150 bg-white hover:bg-stone-50/50">
                                                <td className="px-4 py-2.5 text-stone-500 font-mono text-right">
                                                  {dateTime(new Date(entry.occurredAt))}
                                                </td>
                                                <td className="px-4 py-2.5 font-semibold text-stone-900 text-right">
                                                  {localizedLabel}
                                                </td>
                                                <td className={`px-4 py-2.5 font-bold text-right ${isPositive ? 'text-emerald-700' : 'text-red-700'}`}>
                                                  {isPositive ? '+' : ''}
                                                  {money(amt, currencySymbol)}
                                                </td>
                                                <td className="px-4 py-2.5 text-stone-500 text-right">
                                                  {entry.note || entry.reference || '-'}
                                                </td>
                                                <td className="px-4 py-2.5 text-stone-600 text-right">
                                                  {entry.userName || '-'}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                  {entry.sourceLink ? (
                                                    <a
                                                      href={lp(entry.sourceLink)}
                                                      className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline"
                                                    >
                                                      {isAr ? 'عرض المستند ↗' : 'View Doc ↗'}
                                                    </a>
                                                  ) : (
                                                    <span className="text-stone-400">-</span>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 py-6 text-center text-xs text-stone-500">
                                      {isAr ? 'لا توجد حركات مسجلة للوردية حالياً.' : 'No movements recorded for this shift yet.'}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {!sessions.length ? (
            <div className="border-t border-stone-200 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
              {t('noSessionsYet')}
            </div>
          ) : null}
        </div>

        {sessions.some((session) => session.notes || session.reviewNote || session.reopenReason) ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {sessions
              .filter((session) => session.notes || session.reviewNote || session.reopenReason)
              .slice(0, 8)
              .map((session) => (
                <div key={session.id} className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-stone-900">{session.cashierName}</div>
                    <div className="text-xs text-stone-500">{shortDate(session.openedAt)}</div>
                  </div>
                  {session.notes ? <div className="mt-2 text-sm leading-6 text-stone-600">{session.notes}</div> : null}
                  {session.reviewNote ? <div className="mt-3 rounded-[18px] border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{t('managerReviewNoteLabel', { note: session.reviewNote })}</div> : null}
                  {session.reopenReason ? <div className="mt-3 rounded-[18px] border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">{t('reopenReasonLabel', { reason: session.reopenReason })}</div> : null}
                </div>
              ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
