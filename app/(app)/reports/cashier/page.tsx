import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { compactNumber, dateTime, money } from '@/lib/format';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { getCashierReportData, getReportFilterOptions, parseReportFilters } from '@/lib/reporting';

export default async function CashierReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getCashierReportData(shopId, filters)
  ]);
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('reports.cashier.title')}
        subtitle={t('reports.cashier.subtitle')}
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/cashier"
          fromValue={filters.fromValue}
          toValue={filters.toValue}
          cashierId={filters.cashierId}
          cashiers={options.cashiers}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">{t('reports.cashier.revenueHandled')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.totalRevenue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.cashier.salesCount')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{compactNumber(report.summary.totalTransactions)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.cashier.refundCount')}</div>
          <div className="mt-2 text-3xl font-black text-sky-700">{compactNumber(report.summary.refundCount)}</div>
          <div className="mt-2 text-sm text-stone-500">{money(report.summary.refundTotal, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.cashier.voidCount')}</div>
          <div className="mt-2 text-3xl font-black text-red-700">{compactNumber(report.summary.voidCount)}</div>
          <div className="mt-2 text-sm text-stone-500">{money(report.summary.voidTotal, options.currencySymbol)}</div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-black text-stone-900">{t('reports.cashier.cashierPerformance')}</h2>
        <div className="mt-4 space-y-3">
          {report.topCashiers.length ? report.topCashiers.map((entry) => (
            <div key={entry.cashierId} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{entry.cashierName}</div>
                  <div className="text-sm text-stone-500">
                    {t('reports.cashier.salesAndShifts', { sales: entry.salesCount, shifts: entry.shiftCount })}
                  </div>
                  <div className="text-xs text-stone-500">
                    {t('reports.cashier.refundsAndVoids', { refunds: entry.refundCount, voids: entry.voidCount })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-stone-900">{money(entry.revenueHandled, options.currencySymbol)}</div>
                  <div className="text-sm text-stone-500">
                    {t('reports.cashier.averageBasket', { count: entry.averageBasketSize.toFixed(1) })}
                  </div>
                  <div className="text-xs text-stone-500">
                    {t('reports.cashier.averageTicket', { value: money(entry.averageTicket, options.currencySymbol) })}
                  </div>
                  {entry.shiftCount ? (
                    <div className="text-xs text-stone-500">
                      {t('reports.cashier.shiftActualAndVariance', {
                        actual: money(entry.shiftActual, options.currencySymbol),
                        variance: money(entry.shiftVariance, options.currencySymbol)
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )) : <div className="text-sm text-stone-500">{t('reports.cashier.noCashierSales')}</div>}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-stone-900">{t('reports.cashier.shiftTotals')}</h2>
          <div className="text-sm text-stone-500">{t('reports.cashier.sessionCount', { count: report.summary.shiftCount })}</div>
        </div>
        <div className="mt-4 space-y-3">
          {report.shiftSessions.length ? report.shiftSessions.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{entry.cashierName}</div>
                  <div className="text-sm text-stone-500">
                    {t('reports.cashier.openedAt', {
                      opened: dateTime(entry.openedAt),
                      closed: entry.closedAt ? t('reports.cashier.closedAt', { date: dateTime(entry.closedAt) }) : t('reports.cashier.stillOpen')
                    })}
                  </div>
                  <div className="text-xs text-stone-500">{t('reports.cashier.status', { status: entry.status })}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-stone-500">{t('reports.cashier.expected', { value: money(entry.closingExpected, options.currencySymbol) })}</div>
                  <div className="font-black text-stone-900">{t('reports.cashier.actual', { value: money(entry.closingActual, options.currencySymbol) })}</div>
                  <div className={`text-xs ${entry.variance < 0 ? 'text-red-700' : 'text-stone-500'}`}>
                    {t('reports.cashier.variance', { value: money(entry.variance, options.currencySymbol) })}
                  </div>
                </div>
              </div>
            </div>
          )) : <div className="text-sm text-stone-500">{t('reports.cashier.noCashSessions')}</div>}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.cashier.refundReport')}</h2>
          <div className="mt-4 space-y-3">
            {report.refunds.length ? report.refunds.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.adjustmentNumber} / {entry.saleNumber}</div>
                    <div className="text-sm text-stone-600">{t('reports.cashier.adjustmentBy', { type: entry.type, cashier: entry.cashierName })}</div>
                    <div className="text-sm text-stone-500">{entry.reason}</div>
                    <div className="mt-1 text-xs text-stone-500">{t('reports.cashier.approvedBy', { name: entry.approvedByName, date: dateTime(entry.createdAt) })}</div>
                  </div>
                  <div className="font-black text-sky-700">{money(entry.totalAmount, options.currencySymbol)}</div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.cashier.noRefundAdjustments')}</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.cashier.voidReport')}</h2>
          <div className="mt-4 space-y-3">
            {report.voids.length ? report.voids.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.adjustmentNumber} / {entry.saleNumber}</div>
                    <div className="text-sm text-stone-600">{t('reports.cashier.voidedBy', { cashier: entry.cashierName })}</div>
                    <div className="text-sm text-stone-500">{entry.reason}</div>
                    <div className="mt-1 text-xs text-stone-500">{t('reports.cashier.approvedBy', { name: entry.approvedByName, date: dateTime(entry.createdAt) })}</div>
                  </div>
                  <div className="font-black text-red-700">{money(entry.totalAmount, options.currencySymbol)}</div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.cashier.noVoidAdjustments')}</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
