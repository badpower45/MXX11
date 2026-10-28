'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';
import { useTranslations } from '@/lib/i18n/client';

type StockCountSummary = {
  id: string;
  referenceNumber: string;
  title: string | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'CANCELLED';
  isBlind: boolean;
  notes: string | null;
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  createdBy: string;
  approvedBy: string | null;
  itemCount: number;
  countedItemCount: number;
};

function toneForStatus(status: StockCountSummary['status']) {
  switch (status) {
    case 'POSTED':
      return 'emerald';
    case 'APPROVED':
      return 'blue';
    case 'SUBMITTED':
      return 'amber';
    case 'CANCELLED':
      return 'red';
    default:
      return 'stone';
  }
}

export default function StockCountsManager({
  stockCounts
}: {
  stockCounts: StockCountSummary[];
}) {
  const router = useRouter();
  const t = useTranslations('stockCounts');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isBlind, setIsBlind] = useState(false);
  const [countType, setCountType] = useState<'ALL' | 'MOTORCYCLES' | 'SPARE_PARTS'>('ALL');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredCounts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return stockCounts;
    }

    return stockCounts.filter((count) =>
      [
        count.referenceNumber,
        count.title ?? '',
        count.status,
        count.createdBy,
        count.approvedBy ?? ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [query, stockCounts]);

  const submittedCount = stockCounts.filter((count) => count.status === 'SUBMITTED').length;
  const activeCount = stockCounts.filter((count) => ['DRAFT', 'IN_PROGRESS'].includes(count.status)).length;
  const postedCount = stockCounts.filter((count) => count.status === 'POSTED').length;

  async function createStockCount() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/stock-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes,
          isBlind,
          countType
        })
      });
      const data = await response.json().catch(() => ({ error: t('updateError') }));

      setLoading(false);
      if (!response.ok || !data?.stockCount?.id) {
        setError(data?.error ?? t('updateError'));
        return;
      }

      router.push(`/stock-counts/${data.stockCount.id}`);
      router.refresh();
    } catch {
      setLoading(false);
      setError(t('updateError'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="space-y-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">{t('newCount')}</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">{t('startOfficial')}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {t('description')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('active')}</div>
              <div className="mt-2 text-3xl font-black text-stone-950">{activeCount}</div>
              <div className="mt-1 text-sm text-stone-500">{t('activeSub')}</div>
            </div>
            <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">{t('pending')}</div>
              <div className="mt-2 text-3xl font-black text-stone-950">{submittedCount}</div>
              <div className="mt-1 text-sm text-sky-800">{t('pendingSub')}</div>
            </div>
            <div className="rounded-[24px] border border-blue-200 bg-blue-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">{t('posted')}</div>
              <div className="mt-2 text-3xl font-black text-stone-950">{postedCount}</div>
              <div className="mt-1 text-sm text-blue-800">{t('postedSub')}</div>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              placeholder={t('inputPlaceholder')}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
             <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t('notesPlaceholder')}
              className="min-h-28 w-full rounded-[24px] border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-500 px-1">{t('countTypeLabel')}</label>
              <select
                value={countType}
                onChange={(event) => setCountType(event.target.value as any)}
                className="h-11 w-full rounded-[24px] border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 outline-none transition hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
              >
                <option value="ALL">{t('countTypeAll')}</option>
                <option value="MOTORCYCLES">{t('countTypeMotorcycles')}</option>
                <option value="SPARE_PARTS">{t('countTypeParts')}</option>
              </select>
            </div>
            <label className="flex items-start gap-3 rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={isBlind}
                onChange={(event) => setIsBlind(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                <span className="block font-semibold text-stone-900">{t('blindCount')}</span>
                <span className="mt-1 block">{t('blindDescription')}</span>
              </span>
            </label>
          </div>

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <Button type="button" disabled={loading} onClick={() => void createStockCount()}>
            {loading ? t('creating') : t('create')}
          </Button>
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{t('historyKicker')}</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">{t('historyTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                {t('historySubtitle')}
              </p>
            </div>
            <div className="w-full max-w-xs">
              <Input
                placeholder={t('searchPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-stone-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-start text-sm">
                <thead className="bg-stone-50 text-stone-500">
                  <tr>
                    <th className="px-4 py-3.5">{t('reference')}</th>
                    <th className="px-4 py-3.5">{t('status')}</th>
                    <th className="px-4 py-3.5">{t('progress')}</th>
                    <th className="px-4 py-3.5">{t('users')}</th>
                    <th className="px-4 py-3.5">{t('dates')}</th>
                    <th className="px-4 py-3.5">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCounts.map((count) => (
                    <tr key={count.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{count.referenceNumber}</div>
                        <div className="mt-1 text-sm text-stone-600">{count.title ?? t('untitled')}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone={toneForStatus(count.status)}>
                            {count.status === 'DRAFT'
                              ? t('draft')
                              : count.status === 'IN_PROGRESS'
                                ? t('inProgress')
                                : count.status === 'SUBMITTED'
                                  ? t('submitted')
                                  : count.status === 'APPROVED'
                                    ? t('approved')
                                    : count.status === 'POSTED'
                                      ? t('postedToStock')
                                      : count.status === 'CANCELLED'
                                        ? t('cancelled')
                                        : count.status}
                          </Badge>
                          {count.isBlind ? <Badge tone="stone">{t('blind')}</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>{count.notes ?? t('noNotes')}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">
                          {count.countedItemCount} / {count.itemCount}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">{t('countedProducts')}</div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>{count.createdBy}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {count.approvedBy ? t('approvedBy', { name: count.approvedBy }) : t('approvalPending')}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>{t('created', { date: shortDate(count.createdAt) })}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {count.postedAt
                            ? t('postedAt', { date: dateTime(count.postedAt) })
                            : count.submittedAt
                              ? t('submittedAt', { date: dateTime(count.submittedAt) })
                              : count.startedAt
                                ? t('startedAt', { date: dateTime(count.startedAt) })
                                : t('notStarted')}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/stock-counts/${count.id}`}
                          className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600"
                        >
                          {t('openCount')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!filteredCounts.length ? (
              <div className="border-t border-stone-200 bg-stone-50 py-8 text-center text-sm text-stone-500">
                {t('noMatchingCounts')}
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
