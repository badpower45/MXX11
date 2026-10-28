'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';
import { useTranslations, useLocale } from '@/lib/i18n/client';

type StockCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'CANCELLED';
type ShopRole = 'CASHIER' | 'MANAGER' | 'ADMIN' | 'STOCK_COUNTER';

type StockCountItem = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  expectedQty: number;
  actualQty: number | null;
  varianceQty: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type StockCountDetail = {
  id: string;
  shopId: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  referenceNumber: string;
  title: string | null;
  status: StockCountStatus;
  isBlind: boolean;
  revealBlindQuantities: boolean;
  notes: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUser: {
    id: string;
    name: string | null;
    email: string;
  };
  approvedByUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  itemCount: number;
  countedItemCount: number;
  items: StockCountItem[];
  assignees: Array<{
    id: string;
    userId: string | null;
    guestStaffId: string | null;
    name: string;
    email: string;
    completedAt: string | null;
  }>;
  userEntries: Array<{
    id: string;
    productId: string;
    assigneeId: string;
    assigneeName: string;
    actualQty: number;
  }>;
};

type DraftLine = {
  actualQty: number | null;
  note: string;
};

function toneForStatus(status: StockCountStatus) {
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

function varianceTone(varianceQty: number) {
  if (varianceQty > 0) {
    return 'text-blue-700';
  }

  if (varianceQty < 0) {
    return 'text-red-700';
  }

  return 'text-stone-600';
}

function formatVariance(varianceQty: number) {
  if (varianceQty > 0) {
    return `+${varianceQty}`;
  }

  return String(varianceQty);
}

function createDraftLines(items: StockCountItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        actualQty: item.actualQty,
        note: item.note ?? ''
      }
    ])
  ) as Record<string, DraftLine>;
}

export default function StockCountDetailManager({
  initialStockCount,
  currentRole,
  currentUserId,
  staff = []
}: {
  initialStockCount: StockCountDetail;
  currentRole: ShopRole;
  currentUserId: string;
  staff?: Array<{ id: string; name: string; role: string }>;
}) {
  const router = useRouter();
  const t = useTranslations('stockCounts');
  const { locale } = useLocale();
  const isAr = locale === 'ar';
  const [stockCount, setStockCount] = useState(initialStockCount);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(() =>
    initialStockCount.assignees?.map((a) => a.id) ?? []
  );
  const [sheetNotes, setSheetNotes] = useState(initialStockCount.notes ?? '');
  const [draftLines, setDraftLines] = useState<Record<string, DraftLine>>(() => createDraftLines(initialStockCount.items));
  const [draftUserEntries, setDraftUserEntries] = useState<Array<{ productId: string; assigneeId: string; actualQty: number }>>(() =>
    initialStockCount.userEntries?.map((e) => ({
      productId: e.productId,
      assigneeId: e.assigneeId,
      actualQty: e.actualQty
    })) ?? []
  );
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingAction, setLoadingAction] = useState<'SAVE' | 'SUBMIT' | 'APPROVE' | 'POST' | 'CANCEL' | 'SUBMIT_USER_COUNT' | null>(null);

  const canManageApproval = currentRole === 'MANAGER' || currentRole === 'ADMIN';
  const isInitiator = stockCount.createdByUserId === currentUserId || canManageApproval;
  const myAssignee = stockCount.assignees?.find((a) => a.userId === currentUserId);
  const myAssigneeId = myAssignee?.id;
  const isAssigned = !!myAssignee;

  const counterCanEdit =
    ['DRAFT', 'IN_PROGRESS'].includes(stockCount.status) &&
    isAssigned &&
    !myAssignee?.completedAt;

  const editable = ['DRAFT', 'IN_PROGRESS'].includes(stockCount.status) && isInitiator;
  const canSubmit = editable && stockCount.itemCount > 0;
  const canApprove = stockCount.status === 'SUBMITTED' && canManageApproval;
  const canPost = stockCount.status === 'APPROVED' && canManageApproval && !stockCount.postedAt;
  const canCancel =
    !['POSTED', 'CANCELLED'].includes(stockCount.status) &&
    (stockCount.createdByUserId === currentUserId || canManageApproval);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return stockCount.items;
    }

    return stockCount.items.filter((item) =>
      [item.productNameSnapshot, item.skuSnapshot ?? ''].join(' ').toLowerCase().includes(term)
    );
  }, [query, stockCount.items]);

  const myCountedCount = useMemo(() => {
    if (!myAssigneeId) return 0;
    return stockCount.items.filter((item) => {
      const entry = draftUserEntries.find(
        (e) => e.productId === item.productId && e.assigneeId === myAssigneeId
      );
      return entry && entry.actualQty > 0;
    }).length;
  }, [stockCount.items, draftUserEntries, myAssigneeId]);

  const computedItemQty = useCallback((item: StockCountItem) => {
    if (isInitiator && stockCount.assignees.length > 0) {
      const productEntries = draftUserEntries.filter((e) => e.productId === item.productId);
      return productEntries.length > 0
        ? productEntries.reduce((sum, e) => sum + e.actualQty, 0)
        : null;
    }
    return draftLines[item.id]?.actualQty ?? null;
  }, [isInitiator, stockCount.assignees.length, draftUserEntries, draftLines]);

  const draftCountedItemCount = useMemo(
    () => stockCount.items.filter((item) => computedItemQty(item) !== null).length,
    [computedItemQty, stockCount.items]
  );

  const draftVarianceLineCount = useMemo(
    () =>
      stockCount.items.filter((item) => {
        const actualQty = computedItemQty(item);
        return actualQty !== null && actualQty - item.expectedQty !== 0;
      }).length,
    [computedItemQty, stockCount.items]
  );

  async function applyResponse(response: Response, fallbackMessage: string) {
    const data = await response.json().catch(() => ({ error: fallbackMessage }));
    if (!response.ok || !data?.stockCount) {
      throw new Error(data?.error ?? fallbackMessage);
    }

    setStockCount(data.stockCount);
    setSheetNotes(data.stockCount.notes ?? '');
    setDraftLines(createDraftLines(data.stockCount.items));
    if (data.stockCount.assignees) {
      setSelectedAssigneeIds(data.stockCount.assignees.map((a: any) => a.id));
    }
    if (data.stockCount.userEntries) {
      setDraftUserEntries(
        data.stockCount.userEntries.map((e: any) => ({
          productId: e.productId,
          assigneeId: e.assigneeId,
          actualQty: e.actualQty
        }))
      );
    }
    router.refresh();
  }

  async function saveSheet(showSuccessMessage = true) {
    setLoadingAction('SAVE');
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/stock-counts/${stockCount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE',
          notes: sheetNotes,
          assigneeUserIds: selectedAssigneeIds,
          items: stockCount.items.map((item) => ({
            id: item.id,
            actualQty: draftLines[item.id]?.actualQty ?? null,
            note: draftLines[item.id]?.note ?? ''
          })),
          userEntries: draftUserEntries
        })
      });

      await applyResponse(response, t('saveError'));
      if (showSuccessMessage) {
        setSuccess(t('savedSuccess'));
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('saveError'));
      throw saveError;
    } finally {
      setLoadingAction(null);
    }
  }

  async function runTransition(action: 'SUBMIT' | 'APPROVE' | 'POST' | 'CANCEL') {
    setLoadingAction(action);
    setError('');
    setSuccess('');

    try {
      if (action === 'SUBMIT' && editable) {
        await saveSheet(false);
      }

      const response = await fetch(`/api/stock-counts/${stockCount.id}`, {
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
        body: JSON.stringify({ action })
      });

      await applyResponse(response, t('updateError'));
      setSuccess(
        action === 'SUBMIT'
          ? t('submittedSuccess')
          : action === 'APPROVE'
            ? t('approvedSuccess')
            : action === 'POST'
              ? t('postedSuccess')
              : t('cancelledSuccess')
      );
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : t('updateError'));
    } finally {
      setLoadingAction(null);
    }
  }

  async function submitUserCount() {
    setLoadingAction('SUBMIT_USER_COUNT');
    setError('');
    setSuccess('');

    try {
      await saveSheet(false);

      const response = await fetch(`/api/stock-counts/${stockCount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_USER_COUNT'
        })
      });

      await applyResponse(response, t('updateError'));
      setSuccess(isAr ? 'تم حفظ وتقديم دور الجرد الخاص بك بنجاح (تم)' : 'Your stock count session has been submitted successfully.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t('updateError'));
    } finally {
      setLoadingAction(null);
    }
  }



  return (
    <div className="space-y-6">
      {!isInitiator && !isAssigned && (
        <Card className="border-red-200 bg-red-50 text-red-700">
          <p className="font-bold text-center">
            {isAr ? '⚠️ عذراً، أنت لست معيناً في هذا الجرد ولا يمكنك المشاركة فيه.' : '⚠️ Sorry, you are not assigned to this stock count.'}
          </p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">{t('title')}</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">{stockCount.referenceNumber}</h2>
              <p className="mt-2 text-sm text-stone-500">
                {stockCount.title ?? t('untitled')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={toneForStatus(stockCount.status)}>
                {stockCount.status === 'DRAFT'
                  ? t('draft')
                  : stockCount.status === 'IN_PROGRESS'
                    ? t('inProgress')
                    : stockCount.status === 'SUBMITTED'
                      ? t('submitted')
                      : stockCount.status === 'APPROVED'
                        ? t('approved')
                        : stockCount.status === 'POSTED'
                          ? t('postedToStock')
                          : stockCount.status === 'CANCELLED'
                            ? t('cancelled')
                            : stockCount.status}
              </Badge>
              {stockCount.isBlind ? <Badge tone="stone">{t('blind')}</Badge> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {isInitiator ? (
              <>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('progress')}</div>
                  <div className="mt-2 text-3xl font-black text-stone-950">
                    {draftCountedItemCount} / {stockCount.itemCount}
                  </div>
                  <div className="mt-1 text-sm text-stone-500">{t('countedProducts')}</div>
                </div>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('varianceLines')}</div>
                  <div className="mt-2 text-3xl font-black text-stone-950">
                    {stockCount.revealBlindQuantities ? draftVarianceLineCount : t('hidden')}
                  </div>
                  <div className="mt-1 text-sm text-stone-500">
                    {stockCount.revealBlindQuantities ? t('varianceLinesSub') : t('blindNotMatched')}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                    {isAr ? 'تقدمك في الجرد' : 'Your Progress'}
                  </div>
                  <div className="mt-2 text-3xl font-black text-stone-950">
                    {myCountedCount} / {stockCount.itemCount}
                  </div>
                  <div className="mt-1 text-sm text-stone-500">
                    {isAr ? 'المنتجات التي قمت بعدّها' : 'Products you counted'}
                  </div>
                </div>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                    {isAr ? 'حالتك الحالية' : 'Your Session Status'}
                  </div>
                  <div className="mt-2 text-2xl font-black text-stone-950">
                    {myAssignee?.completedAt ? (
                      <span className="text-emerald-700">{isAr ? 'تم الانتهاء' : 'Done'}</span>
                    ) : (
                      <span className="text-amber-700">{isAr ? 'جاري العمل' : 'In Progress'}</span>
                    )}
                  </div>
                  <div className="mt-1.5 text-xs text-stone-500">
                    {myAssignee?.completedAt
                      ? (isAr ? 'تم حفظ وإرسال مسودتك' : 'Your count is locked & submitted.')
                      : (isAr ? 'يرجى الضغط على "تم" عند الانتهاء' : 'Click "Done" when you finish scanning.')}
                  </div>
                </div>
              </>
            )}
          </div>

          {isInitiator && (
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
              <div>
                {t('createdByLabel')}{' '}
                <span className="font-semibold text-stone-900">
                  {stockCount.createdByUser.name ?? stockCount.createdByUser.email}
                </span>{' '}
                {t('atLabel')}{' '}
                <span className="font-semibold text-stone-900">{dateTime(stockCount.createdAt)}</span>
              </div>
              <div className="mt-2">
                {stockCount.approvedByUser ? (
                  <>
                    {t('approvedByLabel')}{' '}
                    <span className="font-semibold text-stone-900">
                      {stockCount.approvedByUser.name ?? stockCount.approvedByUser.email}
                    </span>{' '}
                    {t('atLabel')}{' '}
                    <span className="font-semibold text-stone-900">
                      {stockCount.approvedAt ? dateTime(stockCount.approvedAt) : t('notAvailable')}
                    </span>
                  </>
                ) : (
                  t('notApprovedYet')
                )}
              </div>
              <div className="mt-2">
                {stockCount.postedAt ? (
                  <>
                    {t('postedAtLabel')}{' '}
                    <span className="font-semibold text-stone-900">{dateTime(stockCount.postedAt)}</span>
                  </>
                ) : stockCount.submittedAt ? (
                  <>
                    {t('submittedAtLabel')}{' '}
                    <span className="font-semibold text-stone-900">{dateTime(stockCount.submittedAt)}</span>
                  </>
                ) : stockCount.startedAt ? (
                  <>
                    {t('startedAtLabel')}{' '}
                    <span className="font-semibold text-stone-900">{dateTime(stockCount.startedAt)}</span>
                  </>
                ) : (
                  t('countingNotStarted')
                )}
              </div>
            </div>
          )}

          {isInitiator && stockCount.isBlind && !stockCount.revealBlindQuantities && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              {t('blindAlert')}
            </div>
          )}

          {/* Assign Counters section */}
          {isInitiator ? (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-stone-700">
                {isAr ? 'الموظفون المكلفون بالجرد ومتابعة حالتهم:' : 'Assigned counters & status:'}
              </label>
              <div className="grid gap-2 sm:grid-cols-2 max-h-40 overflow-y-auto border border-stone-200 rounded-2xl p-3 bg-white">
                {staff.map((member) => {
                  const isChecked = selectedAssigneeIds.includes(member.id);
                  const dbAssignee = stockCount.assignees?.find((a) => a.id === member.id);
                  return (
                    <label key={member.id} className="flex items-center justify-between gap-2 text-sm text-stone-700 hover:text-stone-900 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!editable}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAssigneeIds((prev) => [...prev, member.id]);
                            } else {
                              setSelectedAssigneeIds((prev) => prev.filter((id) => id !== member.id));
                            }
                          }}
                          className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>
                          {member.name} ({member.role})
                        </span>
                      </div>
                      {dbAssignee && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold leading-none shrink-0 ${
                          dbAssignee.completedAt
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {dbAssignee.completedAt
                            ? (isAr ? 'تم' : 'Done')
                            : (isAr ? 'جاري' : 'In Progress')}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            selectedAssigneeIds.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-stone-500">
                  {isAr ? 'الموظفين المعينين للجرد:' : 'Assigned Counters:'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stockCount.assignees?.map((assignee) => (
                    <Badge key={assignee.id} tone="blue">
                      {assignee.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )
          )}

          {isInitiator && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-stone-700">{t('notesLabel')}</label>
              <textarea
                value={sheetNotes}
                onChange={(event) => setSheetNotes(event.target.value)}
                readOnly={!editable}
                className={`min-h-28 w-full rounded-[24px] border px-4 py-3 text-sm outline-none transition ${
                  editable
                    ? 'border-stone-200 bg-white/88 text-stone-900 hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10'
                    : 'border-stone-200 bg-stone-50 text-stone-600'
                }`}
              />
            </div>
          )}

          {(error || success) ? (
            <div className="space-y-3">
              {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
              {success ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{success}</div> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {isInitiator ? (
              <>
                {editable && (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loadingAction !== null}
                    onClick={() => void saveSheet()}
                  >
                    {loadingAction === 'SAVE' ? t('saving') : t('saveSheet')}
                  </Button>
                )}

                {['DRAFT', 'IN_PROGRESS'].includes(stockCount.status) && (
                  <Link href={`/stock-counts/${stockCount.id}/scan`}>
                    <Button type="button" variant="secondary" className="bg-blue-600 hover:bg-blue-700 text-white border-none">
                      {isAr ? 'الذهاب إلى شاشة المسح بالموبايل 📱' : 'Go to Mobile Scanner 📱'}
                    </Button>
                  </Link>
                )}

                {canSubmit && (
                  <Button
                    type="button"
                    disabled={loadingAction !== null || draftCountedItemCount !== stockCount.itemCount}
                    onClick={() => void runTransition('SUBMIT')}
                  >
                    {loadingAction === 'SUBMIT' ? t('submitting') : t('submitForApproval')}
                  </Button>
                )}

                {canApprove && (
                  <Button
                    type="button"
                    disabled={loadingAction !== null}
                    onClick={() => void runTransition('APPROVE')}
                  >
                    {loadingAction === 'APPROVE' ? t('approving') : t('approveCount')}
                  </Button>
                )}

                {canPost && (
                  <Button
                    type="button"
                    disabled={loadingAction !== null}
                    onClick={() => void runTransition('POST')}
                  >
                    {loadingAction === 'POST' ? t('posting') : t('postVariances')}
                  </Button>
                )}

                {canCancel && (
                  <Button
                    type="button"
                    variant="danger"
                    disabled={loadingAction !== null}
                    onClick={() => void runTransition('CANCEL')}
                  >
                    {loadingAction === 'CANCEL' ? t('cancelling') : t('cancelCount')}
                  </Button>
                )}
              </>
            ) : (
              <>
                {counterCanEdit && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={loadingAction !== null}
                      onClick={() => void saveSheet()}
                    >
                      {loadingAction === 'SAVE' ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ المسودة' : 'Save Draft')}
                    </Button>

                    <Link href={`/stock-counts/${stockCount.id}/scan`}>
                      <Button type="button" variant="secondary" className="bg-blue-600 hover:bg-blue-700 text-white border-none">
                        {isAr ? 'الذهاب إلى شاشة المسح بالموبايل 📱' : 'Go to Mobile Scanner 📱'}
                      </Button>
                    </Link>

                    <Button
                      type="button"
                      disabled={loadingAction !== null}
                      onClick={() => void submitUserCount()}
                    >
                      {loadingAction === 'SUBMIT_USER_COUNT' ? (isAr ? 'جاري التقديم...' : 'Submitting...') : (isAr ? 'تم (تأكيد الانتهاء)' : 'Done (Submit count)')}
                    </Button>
                  </>
                )}
              </>
            )}

            <Link href="/stock-counts">
              <Button type="button" variant="ghost">{t('backToCounts')}</Button>
            </Link>
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{t('sheetTitle')}</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">{t('sheetInputTitle')}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                {isInitiator
                  ? t('sheetSubtitle')
                  : (isAr ? 'قم بإدخال الكمية الفعلية لكل منتج في الخانات أدناه' : 'Enter the counted quantity for each product below')}
              </p>
            </div>
            <div className="w-full max-w-xs">
              <Input
                placeholder={t('searchProductPlaceholder')}
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
                    <th className="px-4 py-3.5">{t('productHeader')}</th>
                    <th className="px-4 py-3.5">{t('skuHeader')}</th>
                    {isInitiator && <th className="px-4 py-3.5">{t('expectedHeader')}</th>}
                    <th className="px-4 py-3.5">{t('actualHeader')}</th>
                    {isInitiator && <th className="px-4 py-3.5">{t('diffHeader')}</th>}
                    <th className="px-4 py-3.5">{t('noteHeader')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const actualQty = computedItemQty(item);
                    const varianceQty = actualQty === null ? 0 : actualQty - item.expectedQty;

                    const myEntry = draftUserEntries.find(
                      (e) => e.productId === item.productId && e.assigneeId === myAssigneeId
                    );
                    const myEntryQty = myEntry?.actualQty ?? 0;

                    return (
                      <tr key={item.id} className="border-t border-stone-200 bg-white align-top transition hover:bg-stone-50/70">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-stone-900">{item.productNameSnapshot}</div>
                          <div className="mt-1 text-xs text-stone-500">{t('created', { date: shortDate(item.createdAt) })}</div>
                        </td>
                        <td className="px-4 py-4 text-stone-600">{item.skuSnapshot ?? t('notAvailable')}</td>
                        {isInitiator && (
                          <td className="px-4 py-4 text-stone-600">
                            {stockCount.revealBlindQuantities ? item.expectedQty : t('hidden')}
                          </td>
                        )}
                        <td className="px-4 py-4">
                          {isInitiator ? (
                            stockCount.assignees.length > 0 ? (
                              <div className="space-y-2">
                                {stockCount.assignees.map((assignee) => {
                                  const entry = draftUserEntries.find(
                                    (e) => e.productId === item.productId && e.assigneeId === assignee.id
                                  );
                                  const qty = entry?.actualQty ?? 0;

                                  return (
                                    <div key={assignee.id} className="flex items-center gap-2 text-xs">
                                      <span className="text-stone-500 font-medium w-24 truncate">{assignee.name}:</span>
                                      {editable ? (
                                        <Input
                                          type="number"
                                          min="0"
                                          className="w-20 py-1 px-2 text-xs"
                                          value={qty === 0 && !entry ? '' : String(qty)}
                                          onChange={(event) => {
                                            const val = event.target.value === '' ? 0 : Math.max(0, Math.trunc(Number(event.target.value) || 0));
                                            setDraftUserEntries((prev) => {
                                              const existingIdx = prev.findIndex(
                                                (e) => e.productId === item.productId && e.assigneeId === assignee.id
                                              );
                                              if (existingIdx > -1) {
                                                const updated = [...prev];
                                                updated[existingIdx] = { ...updated[existingIdx], actualQty: val };
                                                return updated;
                                              } else {
                                                return [...prev, { productId: item.productId, assigneeId: assignee.id, actualQty: val }];
                                              }
                                            });
                                          }}
                                        />
                                      ) : (
                                        <span className="font-semibold text-stone-900">{qty}</span>
                                      )}
                                    </div>
                                  );
                                })}
                                <div className="pt-1.5 border-t border-stone-100 flex items-center gap-2 text-xs">
                                  <span className="font-bold text-stone-700 w-24">{isAr ? 'الإجمالي:' : 'Total:'}</span>
                                  <span className="font-extrabold text-stone-950">{actualQty ?? 0}</span>
                                </div>
                              </div>
                            ) : (
                              editable ? (
                                <Input
                                  type="number"
                                  min="0"
                                  value={actualQty === null ? '' : String(actualQty)}
                                  onChange={(event) =>
                                    setDraftLines((current) => ({
                                      ...current,
                                      [item.id]: {
                                        ...current[item.id],
                                        actualQty:
                                          event.target.value === ''
                                            ? null
                                            : Math.max(0, Math.trunc(Number(event.target.value) || 0))
                                      }
                                    }))
                                  }
                                />
                              ) : (
                                <div className="font-semibold text-stone-900">{actualQty ?? t('notCounted')}</div>
                              )
                            )
                          ) : (
                            counterCanEdit ? (
                              <Input
                                type="number"
                                min="0"
                                value={myEntryQty === 0 && !myEntry ? '' : String(myEntryQty)}
                                onChange={(event) => {
                                  const val = event.target.value === '' ? 0 : Math.max(0, Math.trunc(Number(event.target.value) || 0));
                                  setDraftUserEntries((prev) => {
                                    const existingIdx = prev.findIndex(
                                      (e) => e.productId === item.productId && e.assigneeId === myAssigneeId
                                    );
                                    if (existingIdx > -1) {
                                      const updated = [...prev];
                                      updated[existingIdx] = { ...updated[existingIdx], actualQty: val };
                                      return updated;
                                    } else {
                                      return [...prev, { productId: item.productId, assigneeId: myAssigneeId!, actualQty: val }];
                                    }
                                  });
                                }}
                              />
                            ) : (
                              <div className="font-semibold text-stone-900">{myEntryQty}</div>
                            )
                          )}
                        </td>
                        {isInitiator && (
                          <td className="px-4 py-4">
                            <div className={`font-semibold ${stockCount.revealBlindQuantities ? varianceTone(varianceQty) : 'text-stone-500'}`}>
                              {stockCount.revealBlindQuantities ? formatVariance(varianceQty) : t('hidden')}
                            </div>
                          </td>
                        )}
                        <td className="min-w-[220px] px-4 py-4">
                          {editable ? (
                            <Input
                              value={draftLines[item.id]?.note ?? ''}
                              onChange={(event) =>
                                setDraftLines((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...current[item.id],
                                    note: event.target.value
                                  }
                                }))
                              }
                              placeholder={t('optionalNotePlaceholder')}
                            />
                          ) : (
                            <div className="text-stone-600">{draftLines[item.id]?.note || t('noNote')}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!filteredItems.length ? (
              <div className="border-t border-stone-200 bg-stone-50 py-8 text-center text-sm text-stone-500">
                {t('noMatchingItems')}
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
