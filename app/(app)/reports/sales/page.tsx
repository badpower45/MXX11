import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { compactNumber, money } from '@/lib/format';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { getReportFilterOptions, getSalesReportData, parseReportFilters } from '@/lib/reporting';

export default async function SalesReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getSalesReportData(shopId, filters)
  ]);
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('reports.sales.title')}
        subtitle={t('reports.sales.subtitle')}
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/sales"
          fromValue={filters.fromValue}
          toValue={filters.toValue}
          cashierId={filters.cashierId}
          paymentMethod={filters.paymentMethod}
          cashiers={options.cashiers}
          paymentMethods={options.paymentMethods}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">{t('reports.sales.revenue')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.revenue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.sales.transactions')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{compactNumber(report.summary.transactionCount)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.sales.averageTicket')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.averageTicket, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.sales.customerCreditSales')}</div>
          <div className="mt-2 text-3xl font-black text-sky-700">{money(report.summary.creditSales, options.currencySymbol)}</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.sales.dailySales')}</h2>
          <div className="mt-4 space-y-3">
            {report.dailySales.length ? report.dailySales.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.label}</div>
                  <div className="text-sm text-stone-500">{t('reports.sales.saleCount', { count: entry.count })}</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.sales.noCompletedSales')}</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.sales.monthlySales')}</h2>
          <div className="mt-4 space-y-3">
            {report.monthlySales.length ? report.monthlySales.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.label}</div>
                  <div className="text-sm text-stone-500">{t('reports.sales.saleCount', { count: entry.count })}</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.sales.noMonthlyTotals')}</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.sales.hourlySalesDistribution')}</h2>
          <div className="mt-4 space-y-3">
            {report.hourlySales.map((entry) => (
              <div key={entry.hour} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.label}</div>
                  <div className="text-sm text-stone-500">{t('reports.sales.saleCount', { count: entry.count })}</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.sales.paymentMethodTotals')}</h2>
          <div className="mt-4 space-y-3">
            {report.paymentMethodTotals.length ? report.paymentMethodTotals.map((entry) => (
              <div key={entry.method} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div className="font-semibold text-stone-900">{entry.method}</div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.sales.noPaymentTotals')}</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.sales.topItems')}</h2>
          <div className="mt-4 space-y-3">
            {report.topItems.length ? report.topItems.map((entry) => (
              <div key={entry.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.name}</div>
                  <div className="text-sm text-stone-500">{t('reports.sales.unitCount', { count: entry.qty })}</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.revenue, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.sales.noTopItems')}</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.sales.topCategories')}</h2>
          <div className="mt-4 space-y-3">
            {report.topCategories.length ? report.topCategories.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.name}</div>
                  <div className="text-sm text-stone-500">{t('reports.sales.unitCount', { count: entry.qty })}</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.revenue, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.sales.noTopCategories')}</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
