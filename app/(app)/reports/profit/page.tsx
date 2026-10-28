import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { money, shortDate } from '@/lib/format';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { getProfitReportData, getReportFilterOptions, parseReportFilters } from '@/lib/reporting';

export default async function ProfitReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getProfitReportData(shopId, filters)
  ]);
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('reports.profit.title')}
        subtitle={t('reports.profit.subtitle')}
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/profit"
          fromValue={filters.fromValue}
          toValue={filters.toValue}
          categoryId={filters.categoryId}
          productId={filters.productId}
          categories={options.categories}
          products={options.products}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">{t('reports.profit.netRevenueBasis')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.revenue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.profit.estimatedCostOfGoods')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.costOfGoods, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.profit.grossProfit')}</div>
          <div className="mt-2 text-3xl font-black text-blue-700">{money(report.summary.grossProfit, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.profit.grossMargin')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{report.summary.grossMarginPercent.toFixed(2)}%</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.profit.profitByDay')}</h2>
          <div className="mt-4 space-y-3">
            {report.dailyProfit.length ? report.dailyProfit.map((entry) => (
              <div key={entry.key} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.label}</div>
                    <div className="text-sm text-stone-500">
                      {t('reports.profit.revenueAndCost', {
                        revenue: money(entry.revenue, options.currencySymbol),
                        cost: money(entry.cost, options.currencySymbol)
                      })}
                    </div>
                  </div>
                  <div className={`font-black ${entry.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {money(entry.profit, options.currencySymbol)}
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.profit.noProfitTrendData')}</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.profit.profitByMonth')}</h2>
          <div className="mt-4 space-y-3">
            {report.monthlyProfit.length ? report.monthlyProfit.map((entry) => (
              <div key={entry.key} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.label}</div>
                    <div className="text-sm text-stone-500">
                      {t('reports.profit.revenueAndCost', {
                        revenue: money(entry.revenue, options.currencySymbol),
                        cost: money(entry.cost, options.currencySymbol)
                      })}
                    </div>
                  </div>
                  <div className={`font-black ${entry.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {money(entry.profit, options.currencySymbol)}
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.profit.noMonthlyProfitData')}</div>}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-black text-stone-900">{t('reports.profit.profitPerSale')}</h2>
        <div className="mt-4 space-y-3">
          {report.profitPerSale.length ? report.profitPerSale.map((entry) => (
            <div key={entry.saleId} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{entry.saleNumber}</div>
                  <div className="text-sm text-stone-500">
                    {t('reports.profit.saleDateAndUnits', { date: shortDate(entry.saleDate), count: entry.qty })}
                  </div>
                  {entry.returnCount ? (
                    <div className="text-xs text-sky-700">{t('reports.profit.returnAdjustmentsAffected', { count: entry.returnCount })}</div>
                  ) : null}
                </div>
                <div className="text-right">
                  <div className="font-black text-blue-700">{money(entry.profit, options.currencySymbol)}</div>
                  <div className="text-sm text-stone-500">
                    {t('reports.profit.revenueAndMargin', {
                      revenue: money(entry.revenue, options.currencySymbol),
                      margin: entry.marginPercent.toFixed(2)
                    })}
                  </div>
                </div>
              </div>
            </div>
          )) : <div className="text-sm text-stone-500">{t('reports.profit.noSaleProfitabilityData')}</div>}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.profit.profitPerCategory')}</h2>
          <div className="mt-4 space-y-3">
            {report.profitPerCategory.length ? report.profitPerCategory.map((entry) => (
              <div key={entry.name} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">
                      {t('reports.profit.revenueAndCost', {
                        revenue: money(entry.revenue, options.currencySymbol),
                        cost: money(entry.cost, options.currencySymbol)
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black ${entry.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {money(entry.profit, options.currencySymbol)}
                    </div>
                    <div className="text-sm text-stone-500">{t('reports.profit.marginPercent', { margin: entry.marginPercent.toFixed(2) })}</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.profit.noCategoryProfitabilityData')}</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.profit.profitPerItem')}</h2>
          <div className="mt-4 space-y-3">
            {report.profitPerItem.length ? report.profitPerItem.map((entry) => (
              <div key={entry.productId} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">{t('reports.profit.categoryAndUnits', { category: entry.categoryName, count: entry.qty })}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black ${entry.profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                      {money(entry.profit, options.currencySymbol)}
                    </div>
                    <div className="text-sm text-stone-500">{t('reports.profit.marginPercent', { margin: entry.marginPercent.toFixed(2) })}</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.profit.noItemProfitabilityData')}</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
