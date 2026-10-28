import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { compactNumber, money } from '@/lib/format';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { getInventoryReportData, getReportFilterOptions, parseReportFilters } from '@/lib/reporting';

export default async function InventoryReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getInventoryReportData(shopId, filters)
  ]);
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('reports.inventory.title')}
        subtitle={t('reports.inventory.subtitle')}
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/inventory"
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
          <div className="text-sm text-stone-500">{t('reports.inventory.stockOnHand')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{compactNumber(report.summary.totalUnitsOnHand)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.inventory.costValue')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.costValue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.inventory.sellValue')}</div>
          <div className="mt-2 text-3xl font-black text-blue-700">{money(report.summary.sellValue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.inventory.lowStockValueAtRisk')}</div>
          <div className="mt-2 text-3xl font-black text-sky-700">{money(report.summary.lowStockValueAtRisk, options.currencySymbol)}</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.inventory.inventoryValuation')}</h2>
          <div className="mt-4 space-y-3">
            {report.valuationRows.length ? report.valuationRows.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">
                      {entry.categoryName} / {t('reports.inventory.onHandCount', { count: entry.stockQty })} / {entry.stockLevel === 'IN_STOCK' ? t('productManager.inStock') : entry.stockLevel === 'LOW_STOCK' ? t('productManager.lowStock') : t('productManager.outOfStock')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-900">{money(entry.costValue, options.currencySymbol)}</div>
                    <div className="text-sm text-stone-500">{t('reports.inventory.sellLabel', { value: money(entry.sellValue, options.currencySymbol) })}</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.inventory.noValuationData')}</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.inventory.lowStockValueAtRisk')}</h2>
          <div className="mt-4 space-y-3">
            {report.lowStockRisk.length ? report.lowStockRisk.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">
                      {entry.categoryName} / {t('reports.inventory.reorderPointLeft', { reorderPoint: entry.reorderPoint, count: entry.stockQty })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-sky-700">{money(entry.sellValue, options.currencySymbol)}</div>
                    <div className="text-sm text-stone-500">{t('reports.inventory.costLabel', { value: money(entry.costValue, options.currencySymbol) })}</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.inventory.noLowStockExposure')}</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.inventory.lowMovementItems')}</h2>
          <div className="mt-4 space-y-3">
            {report.lowMovement.length ? report.lowMovement.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">{entry.categoryName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-sky-700">{t('reports.inventory.soldCount', { count: entry.soldQty })}</div>
                    <div className="text-sm text-stone-500">
                      {t('reports.inventory.revenueAndCost', {
                        revenue: money(entry.soldRevenue, options.currencySymbol),
                        cost: money(entry.costValue, options.currencySymbol)
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.inventory.noLowMovementProducts')}</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('reports.inventory.deadStock')}</h2>
          <div className="mt-4 space-y-3">
            {report.deadStock.length ? report.deadStock.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">{entry.categoryName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-red-700">{t('reports.inventory.stillOnHand', { count: entry.stockQty })}</div>
                    <div className="text-sm text-stone-500">
                      {t('reports.inventory.costAndSell', {
                        cost: money(entry.costValue, options.currencySymbol),
                        sell: money(entry.sellValue, options.currencySymbol)
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">{t('reports.inventory.noDeadStock')}</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
