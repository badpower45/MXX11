import Link from 'next/link';
import { getOwnerAnalyticsData } from '@/lib/owner-analytics';
import { money } from '@/lib/format';
import Card from '@/components/ui/Card';
import { getServerTranslator } from '@/lib/i18n/server';
import { localizePath, type Locale } from '@/lib/i18n/locales';

type OwnerAnalytics = Awaited<ReturnType<typeof getOwnerAnalyticsData>>;

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function heatColor(intensity: number) {
  if (intensity >= 0.85) return 'bg-blue-700 text-white';
  if (intensity >= 0.65) return 'bg-blue-600 text-white';
  if (intensity >= 0.45) return 'bg-blue-500 text-white';
  if (intensity >= 0.25) return 'bg-blue-200 text-blue-950';
  if (intensity > 0) return 'bg-blue-100 text-blue-800';
  return 'bg-stone-100 text-stone-400';
}

export default function OwnerAnalyticsPanel({
  analytics,
  locale
}: {
  analytics: OwnerAnalytics;
  locale: Locale;
}) {
  const t = getServerTranslator(locale);
  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            {t('dashboard.ownerAnalytics.kicker')}
          </div>
          <h2 className="mt-2 text-2xl font-black text-stone-950">{t('dashboard.ownerAnalytics.title')}</h2>
          <p className="mt-2 max-w-3xl text-sm text-stone-500">
            {t('dashboard.ownerAnalytics.subtitle', { period: analytics.periodLabel.toLowerCase() })}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={localizePath('/inventory', locale)}
            className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            {t('dashboard.ownerAnalytics.openReorder')}
          </Link>
          <Link
            href={localizePath('/reports', locale)}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            {t('dashboard.ownerAnalytics.openReports')}
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-4">
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(37,99,235,0.12),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.sellThrough.label')}
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">{percent(analytics.summary.sellThroughPercent)}</div>
          <div className="mt-2 text-sm text-stone-500">{t('dashboard.ownerAnalytics.sellThrough.helper')}</div>
        </div>
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.marginLeakage.label')}
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">
            {money(analytics.summary.marginLeakageValue, analytics.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">{t('dashboard.ownerAnalytics.marginLeakage.helper')}</div>
        </div>
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.stockAge.label')}
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">
            {t('dashboard.ownerAnalytics.stockAge.value', { value: analytics.summary.averageStockAgeDays.toFixed(1) })}
          </div>
          <div className="mt-2 text-sm text-stone-500">{t('dashboard.ownerAnalytics.stockAge.helper')}</div>
        </div>
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(120,113,108,0.14),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.reorderQueue.label')}
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">{analytics.summary.reorderCount}</div>
          <div className="mt-2 text-sm text-stone-500">
            {t('dashboard.ownerAnalytics.reorderQueue.helper', {
              value: money(analytics.summary.reorderCost, analytics.currencySymbol)
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                {t('dashboard.ownerAnalytics.heatmap.kicker')}
              </div>
              <div className="mt-1 text-lg font-black text-stone-950">{t('dashboard.ownerAnalytics.heatmap.title')}</div>
            </div>
            <div className="text-xs text-stone-500">{analytics.periodLabel}</div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[80px_repeat(24,minmax(24px,1fr))] gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                <div />
                {analytics.heatmap.hours.map((hour) => (
                  <div key={hour.hour} className="text-center">
                    {hour.label.replace(':00', '')}
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                {analytics.heatmap.rows.map((row) => (
                  <div
                    key={row.dayLabel}
                    className="grid grid-cols-[80px_repeat(24,minmax(24px,1fr))] gap-1"
                  >
                    <div className="flex items-center text-xs font-semibold text-stone-500">
                      {row.dayLabel}
                    </div>
                    {row.cells.map((cell) => (
                      <div
                        key={`${row.dayLabel}-${cell.hour}`}
                        className={`flex h-9 items-center justify-center rounded-md text-[10px] font-semibold ${heatColor(cell.intensity)}`}
                        title={t('dashboard.ownerAnalytics.heatmap.tooltip', {
                          day: row.dayLabel,
                          hour: analytics.heatmap.hours[cell.hour]?.label ?? '',
                          value: money(cell.revenue, analytics.currencySymbol),
                          count: cell.count
                        })}
                      >
                        {cell.count > 0 ? cell.count : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.pressurePoints.kicker')}
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">{t('dashboard.ownerAnalytics.pressurePoints.refund.label')}</div>
              <div className="mt-1 text-stone-500">
                {t('dashboard.ownerAnalytics.pressurePoints.refund.helper', {
                  value: money(analytics.summary.totalRefunds, analytics.currencySymbol)
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">{t('dashboard.ownerAnalytics.pressurePoints.shrinkage.label')}</div>
              <div className="mt-1 text-stone-500">
                {t('dashboard.ownerAnalytics.pressurePoints.shrinkage.helper', {
                  value: money(analytics.summary.totalShrinkageValue, analytics.currencySymbol)
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">{t('dashboard.ownerAnalytics.pressurePoints.leadTime.label')}</div>
              <div className="mt-1 text-stone-500">
                {t('dashboard.ownerAnalytics.pressurePoints.leadTime.helper', {
                  value: analytics.summary.averageLeadTimeDays.toFixed(1)
                })}
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">{t('dashboard.ownerAnalytics.pressurePoints.stockouts.label')}</div>
              <div className="mt-1 text-stone-500">
                {t('dashboard.ownerAnalytics.pressurePoints.stockouts.helper', {
                  count: analytics.summary.stockoutEvents
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.fastMovers.kicker')}
          </div>
          <div className="mt-4 space-y-3">
            {analytics.fastMovers.length ? (
              analytics.fastMovers.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-xs text-stone-500">{t('dashboard.ownerAnalytics.fastMovers.itemStats', {
                      sold: item.soldQty,
                      left: item.currentStock
                    })}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-950">{item.avgDailySales.toFixed(1)}</div>
                    <div className="text-xs text-stone-500">{t('dashboard.ownerAnalytics.fastMovers.unitsPerDay')}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">{t('dashboard.ownerAnalytics.fastMovers.empty')}</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.slowMovers.kicker')}
          </div>
          <div className="mt-4 space-y-3">
            {analytics.slowMovers.length ? (
              analytics.slowMovers.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-xs text-stone-500">{t('dashboard.ownerAnalytics.slowMovers.onHand', { count: item.currentStock })}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-950">{item.avgDailySales.toFixed(1)}</div>
                    <div className="text-xs text-stone-500">{t('dashboard.ownerAnalytics.fastMovers.unitsPerDay')}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">{t('dashboard.ownerAnalytics.slowMovers.empty')}</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.stockAging.kicker')}
          </div>
          <div className="mt-4 space-y-3">
            {analytics.stockAging.length ? (
              analytics.stockAging.map((item) => (
                <div key={item.productId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">{item.productName}</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {t('dashboard.ownerAnalytics.stockAging.itemStats', {
                      count: item.stockQty,
                      date: item.lastInboundAt.toLocaleDateString('ar-EG')
                    })}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-stone-900">{t('dashboard.ownerAnalytics.stockAging.ageDays', { count: item.ageDays })}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">{t('dashboard.ownerAnalytics.stockAging.empty')}</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.marginReport.kicker')}
          </div>
          <div className="mt-4 space-y-3">
            {analytics.marginLeakage.length ? (
              analytics.marginLeakage.map((item) => (
                <div key={item.productId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">{item.productName}</div>
                  <div className="mt-2 flex justify-between text-xs text-stone-500">
                    <span>{t('dashboard.ownerAnalytics.marginReport.discounts')}</span>
                    <span>{money(item.discountLeak, analytics.currencySymbol)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-stone-500">
                    <span>{t('dashboard.ownerAnalytics.marginReport.refunds')}</span>
                    <span>{money(item.refundLeak, analytics.currencySymbol)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-stone-500">
                    <span>{t('dashboard.ownerAnalytics.marginReport.squeeze')}</span>
                    <span>{money(item.marginSqueeze, analytics.currencySymbol)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm font-semibold text-stone-900">
                    <span>{t('dashboard.ownerAnalytics.marginReport.total')}</span>
                    <span>{money(item.totalLeak, analytics.currencySymbol)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">{t('dashboard.ownerAnalytics.marginReport.empty')}</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.refundShrink.kicker')}
          </div>
          <div className="mt-4 space-y-3">
            {analytics.refundTrend.length ? (
              analytics.refundTrend.slice(-6).map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-stone-900">{item.label}</div>
                    <div className="text-xs text-stone-500">{t('dashboard.ownerAnalytics.refundShrink.refundCount', { count: item.count })}</div>
                  </div>
                  <div className="font-semibold text-stone-900">{money(item.total, analytics.currencySymbol)}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">{t('dashboard.ownerAnalytics.refundShrink.emptyRefunds')}</div>
            )}
            {analytics.shrinkageTrend.length ? (
              analytics.shrinkageTrend.slice(-6).map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-red-50/60 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-stone-900">{item.label}</div>
                    <div className="text-xs text-stone-500">{t('dashboard.ownerAnalytics.refundShrink.shrinkQty', { count: item.qty })}</div>
                  </div>
                  <div className="font-semibold text-red-700">{money(item.value, analytics.currencySymbol)}</div>
                </div>
              ))
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.purchaseLeadTimes.kicker')}
          </div>
          <div className="mt-4 space-y-3">
            {analytics.purchaseLeadTimes.length ? (
              analytics.purchaseLeadTimes.map((item) => (
                <div key={item.supplierId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">{item.supplierName}</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {t('dashboard.ownerAnalytics.purchaseLeadTimes.receiptCount', {
                      count: item.receiptCount,
                      date: item.lastReceivedAt.toLocaleDateString('ar-EG')
                    })}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-stone-900">
                    {t('dashboard.ownerAnalytics.purchaseLeadTimes.avgLeadTime', { value: item.avgLeadTimeDays.toFixed(1) })}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">{t('dashboard.ownerAnalytics.purchaseLeadTimes.empty')}</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('dashboard.ownerAnalytics.stockoutFrequency.kicker')}
          </div>
          <div className="mt-4 space-y-3">
            {analytics.stockoutFrequency.length ? (
              analytics.stockoutFrequency.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-xs text-stone-500">
                      {t('dashboard.ownerAnalytics.stockoutFrequency.itemStats', {
                        left: item.currentStock,
                        point: item.reorderPoint
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-950">{item.stockoutEvents}</div>
                    <div className="text-xs text-stone-500">{t('dashboard.ownerAnalytics.stockoutFrequency.events', { count: item.stockoutEvents })}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">{t('dashboard.ownerAnalytics.stockoutFrequency.empty')}</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                {t('dashboard.ownerAnalytics.reorderPreview.kicker')}
              </div>
              <div className="mt-1 text-lg font-black text-stone-950">{t('dashboard.ownerAnalytics.reorderPreview.title')}</div>
            </div>
            <Link
              href={localizePath('/inventory', locale)}
              className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-white"
            >
              {t('dashboard.ownerAnalytics.reorderPreview.reviewQueue')}
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {analytics.reorderPreview.length ? (
              analytics.reorderPreview.map((item) => (
                <div key={item.productId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-stone-900">{item.productName}</div>
                      <div className="text-xs text-stone-500">
                        {t('dashboard.ownerAnalytics.reorderPreview.leadTime', {
                          supplier: item.supplierName,
                          count: item.leadTimeDays
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-stone-950">{item.suggestedQty}</div>
                      <div className="text-xs text-stone-500">{t('dashboard.ownerAnalytics.reorderPreview.suggested')}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-stone-500">
                    <span>{t('dashboard.ownerAnalytics.reorderPreview.reorderPoint', { count: item.reorderPoint })}</span>
                    <span>{money(item.suggestedCost, analytics.currencySymbol)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">{t('dashboard.ownerAnalytics.reorderPreview.empty')}</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
