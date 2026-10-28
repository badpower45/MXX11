import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { requirePagePermission } from '@/lib/authz';
import { money } from '@/lib/format';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { getReportFilterOptions, getReportsOverviewData, parseReportFilters } from '@/lib/reporting';
import { prisma } from '@/lib/prisma';
import { getActiveCashSessionsForShop, buildCashSessionSummary } from '@/lib/register';

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, overview, activeSessions] = await Promise.all([
    getReportFilterOptions(shopId),
    getReportsOverviewData(shopId, filters),
    getActiveCashSessionsForShop(prisma, shopId)
  ]);

  const sessionSummaries = await Promise.all(
    activeSessions.map(async (session) => {
      const summary = await buildCashSessionSummary(prisma, session);
      return {
        cashierName: session.user.name || session.user.email,
        expectedCash: summary.expectedCash,
        expectedInstaPay: summary.expectedInstaPay,
        expectedWallet: summary.expectedWallet,
      };
    })
  );

  const totalDrawerCash = sessionSummaries.reduce((sum, s) => sum + s.expectedCash, 0);
  const totalDrawerInstaPay = sessionSummaries.reduce((sum, s) => sum + s.expectedInstaPay, 0);
  const totalDrawerWallet = sessionSummaries.reduce((sum, s) => sum + s.expectedWallet, 0);

  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const sections = [
    {
      href: '/reports/sales',
      title: t('reports.overview.sections.sales.title'),
      description: t('reports.overview.sections.sales.description')
    },
    {
      href: '/reports/inventory',
      title: t('reports.overview.sections.inventory.title'),
      description: t('reports.overview.sections.inventory.description')
    },
    {
      href: '/reports/profit',
      title: t('reports.overview.sections.profit.title'),
      description: t('reports.overview.sections.profit.description')
    },
    {
      href: '/reports/cashier',
      title: t('reports.overview.sections.cashier.title'),
      description: t('reports.overview.sections.cashier.description')
    }
  ];

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('reports.overview.title')}
        subtitle={t('reports.overview.subtitle')}
      />

      <ReportsNav />

      {/* Drawer Balances Section */}
      <Card className="overflow-hidden border border-stone-200">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-stone-100 pb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">
              {t('reports.overview.drawerBalances')}
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {t('reports.overview.activeSessionsCount', { count: activeSessions.length })}
            </p>
          </div>
          {activeSessions.length > 0 && (
            <Badge tone="emerald">{t('reports.nav.cashier')}</Badge>
          )}
        </div>

        {activeSessions.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-stone-50/80 p-4 border border-stone-100">
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                {t('reports.overview.totalDrawerCash')}
              </div>
              <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
                {money(totalDrawerCash, options.currencySymbol)}
              </div>
            </div>
            <div className="rounded-2xl bg-stone-50/80 p-4 border border-stone-100">
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                {t('reports.overview.totalDrawerInstaPay')}
              </div>
              <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
                {money(totalDrawerInstaPay, options.currencySymbol)}
              </div>
            </div>
            <div className="rounded-2xl bg-stone-50/80 p-4 border border-stone-100">
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                {t('reports.overview.totalDrawerWallet')}
              </div>
              <div className="mt-2 text-2xl font-black text-stone-900 font-mono">
                {money(totalDrawerWallet, options.currencySymbol)}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-stone-500 text-center py-4 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
            {t('reports.overview.noActiveSessions')}
          </div>
        )}

        {sessionSummaries.length > 0 && (
          <div className="mt-5 border-t border-stone-100 pt-4">
            <div className="text-xs font-bold text-stone-600 mb-2">
              {locale === 'ar' ? 'تفاصيل الخزائن النشطة لكل كاشير:' : 'Active cashier drawer breakdown:'}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {sessionSummaries.map((summary, index) => (
                <div key={index} className="text-xs bg-white p-3 rounded-xl border border-stone-200 flex flex-col justify-between">
                  <div className="font-bold text-stone-800 border-b border-stone-100 pb-1 mb-1">
                    {summary.cashierName}
                  </div>
                  <div className="space-y-1 font-mono text-stone-600">
                    <div className="flex justify-between">
                      <span>{t('reports.overview.totalDrawerCash')}:</span>
                      <span className="font-bold text-stone-900">{money(summary.expectedCash, options.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('reports.overview.totalDrawerInstaPay')}:</span>
                      <span className="font-bold text-stone-900">{money(summary.expectedInstaPay, options.currencySymbol)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{t('reports.overview.totalDrawerWallet')}:</span>
                      <span className="font-bold text-stone-900">{money(summary.expectedWallet, options.currencySymbol)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">{t('reports.overview.revenueInRange')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">
            {money(overview.revenue, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">{t('reports.overview.completedSales', { count: overview.transactionCount })}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.overview.estimatedGrossProfit')}</div>
          <div className="mt-2 text-3xl font-black text-blue-700">
            {money(overview.grossProfit, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">{t('reports.overview.grossProfitNote')}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.overview.inventoryValuation')}</div>
          <div className="mt-2 text-3xl font-black text-stone-900">
            {money(overview.inventoryValuation, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">{t('reports.overview.inventoryValuationNote')}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">{t('reports.overview.refundsAndVoids')}</div>
          <div className="mt-2 text-3xl font-black text-red-700">
            {money(overview.refundTotal + overview.voidTotal, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">
            {t('reports.overview.refundsBreakdown', {
              refund: money(overview.refundTotal, options.currencySymbol),
              voids: money(overview.voidTotal, options.currencySymbol)
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-blue-200">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">{t('reports.overview.moduleLabel')}</div>
              <h2 className="mt-2 text-2xl font-black text-stone-900">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">{section.description}</p>
              <div className="mt-6 text-sm font-semibold text-blue-700">{t('reports.overview.openReport')}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
