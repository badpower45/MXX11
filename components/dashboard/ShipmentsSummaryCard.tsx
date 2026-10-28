'use client';

import Link from 'next/link';
import Card from '@/components/ui/Card';
import { shortDate } from '@/lib/format';
import { useLocalizedPath } from '@/lib/i18n/client';

export type DashboardShipment = {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  vesselName: string;
  vesselImo: string | null;
  berthLocation: string | null;
  customerName: string;
  currentStage: string;
  eta: string | null;
  itemsCount: number;
  itemsPreview: string[];
};

const STAGE_META: Record<string, { labelAr: string; icon: string; tone: string }> = {
  NEW: { labelAr: 'طلب جديد', icon: '📝', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  EXTERNAL_PROCUREMENT: { labelAr: 'شراء وتوريد خارجي', icon: '🛒', tone: 'bg-purple-100 text-purple-800 border-purple-200' },
  WAREHOUSE_PREPARATION: { labelAr: 'تجهيز المخزن', icon: '📦', tone: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  PORT_CUSTOMS_CLEARANCE: { labelAr: 'تصريح الميناء والجمارك', icon: '🛂', tone: 'bg-amber-100 text-amber-800 border-amber-200' },
  IN_TRANSIT_TO_BERTH: { labelAr: 'في الطريق للرصيف', icon: '🚚', tone: 'bg-sky-100 text-sky-800 border-sky-200' },
  DELIVERED_TO_VESSEL: { labelAr: 'تم التسليم للسفينة', icon: '⚓', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
};

export default function ShipmentsSummaryCard({
  shipments,
  locale
}: {
  shipments: DashboardShipment[];
  locale: string;
}) {
  const isAr = locale === 'ar';
  const lp = useLocalizedPath();

  return (
    <Card className="overflow-hidden border-stone-200/90 bg-white shadow-xs">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-blue-700">
            {isAr ? 'العمليات اللوجستية البحرية' : 'Marine Operations Pulse'}
          </div>
          <h2 className="text-xl font-black text-stone-900 flex items-center gap-2 mt-0.5">
            <span>🚢</span>
            <span>{isAr ? 'نداءات وشحنات تموين السفن النشطة' : 'Active Vessel Provisioning Calls'}</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {isAr
              ? 'متابعة نداءات السفن بموانئ بورسعيد والسويس ومراحل التوريد والتسليم لحظياً.'
              : 'Live tracking of vessel supply calls, external procurement, and berth delivery.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href={lp('/shipments')}
            className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
          >
            {isAr ? 'عرض كل الشحنات ←' : 'All Shipments →'}
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {shipments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 p-8 text-center text-xs text-stone-500">
            <span className="text-2xl block mb-2">⚓</span>
            {isAr ? 'لا توجد نداءات سفن نشطة مسجلة حالياً.' : 'No active ship supply orders right now.'}
          </div>
        ) : (
          shipments.map((shp) => {
            const meta = STAGE_META[shp.currentStage] || {
              labelAr: shp.currentStage,
              icon: '📋',
              tone: 'bg-stone-100 text-stone-700 border-stone-200'
            };

            return (
              <div
                key={shp.id}
                className="flex flex-col gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/50 p-4 transition-all hover:border-stone-300 hover:bg-white sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-stone-900">
                      🚢 {shp.vesselName}
                    </span>
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[11px] font-bold text-stone-600 border border-stone-200">
                      {shp.trackingNumber}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-bold border ${meta.tone}`}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.labelAr}</span>
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                    {shp.berthLocation && (
                      <span className="font-medium text-stone-700">📍 {shp.berthLocation}</span>
                    )}
                    <span>👤 {shp.customerName}</span>
                    {shp.eta && (
                      <span className="font-medium text-blue-700">⏱️ ETA: {shortDate(shp.eta)}</span>
                    )}
                  </div>

                  {shp.itemsPreview.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {shp.itemsPreview.map((item, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-white border border-stone-200/70 px-2 py-0.5 text-[11px] font-medium text-stone-700 shadow-2xs"
                        >
                          📦 {item}
                        </span>
                      ))}
                      {shp.itemsCount > shp.itemsPreview.length && (
                        <span className="text-[11px] text-stone-400 font-bold self-center">
                          +{shp.itemsCount - shp.itemsPreview.length} {isAr ? 'أصناف أخرى' : 'more items'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <Link
                  href={lp('/shipments')}
                  className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-center text-xs font-bold text-stone-700 shadow-2xs hover:bg-stone-50 hover:text-stone-900 transition-colors shrink-0"
                >
                  {isAr ? 'تحديث وتمرير ➡️' : 'Track & Advance ➡️'}
                </Link>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

