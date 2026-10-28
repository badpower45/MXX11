'use client';

import { motion } from 'framer-motion';
import Card from '@/components/ui/Card';
import { useTranslations } from '@/lib/i18n/client';

type Props = {
  totalProducts: number;
  lowStockCount: number;
  pendingPurchases: number;
  todaySales: string;
  todaySaleCount: number;
  stockCoverage: number;
  showPendingPurchases?: boolean;
};

const items = [
  {
    id: 'activeProducts',
    icon: 'products',
    tone: {
      shell: 'border-blue-200/80 bg-[linear-gradient(135deg,rgba(37,99,235,0.16),rgba(255,255,255,0.95))]',
      icon: 'bg-blue-100 text-blue-700',
      pill: 'bg-blue-100/90 text-blue-700'
    }
  },
  {
    id: 'lowStock',
    icon: 'alert',
    tone: {
      shell: 'border-sky-200/80 bg-[linear-gradient(135deg,rgba(14,165,233,0.18),rgba(255,255,255,0.95))]',
      icon: 'bg-sky-100 text-sky-700',
      pill: 'bg-sky-100/90 text-sky-700'
    }
  },
  {
    id: 'pendingPurchases',
    icon: 'purchases',
    tone: {
      shell: 'border-sky-200/80 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(255,255,255,0.95))]',
      icon: 'bg-sky-100 text-sky-700',
      pill: 'bg-sky-100/90 text-sky-700'
    }
  },
  {
    id: 'salesToday',
    icon: 'sales',
    tone: {
      shell: 'border-stone-300/80 bg-[linear-gradient(135deg,rgba(28,25,23,0.10),rgba(255,255,255,0.98))]',
      icon: 'bg-stone-950 text-white',
      pill: 'bg-stone-950 text-white'
    }
  }
] as const;

function StatIcon({ icon }: { icon: 'products' | 'alert' | 'purchases' | 'sales' }) {
  switch (icon) {
    case 'products':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
          <path d="m12 12 8-4.5" />
          <path d="m12 12-8-4.5" />
          <path d="M12 12v9" />
        </svg>
      );
    case 'alert':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      );
    case 'purchases':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M7 7h10" />
          <path d="M7 12h10" />
          <path d="M7 17h6" />
          <path d="M5 4h14v16H5z" />
        </svg>
      );
    case 'sales':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M7 4h10v16H7z" />
          <path d="M10 8h4" />
          <path d="M10 12h4" />
          <path d="M10 16h2" />
        </svg>
      );
  }
}

export default function DashboardStats({
  totalProducts,
  lowStockCount,
  pendingPurchases,
  todaySales,
  todaySaleCount,
  stockCoverage,
  showPendingPurchases = true
}: Props) {
  const t = useTranslations();
  const visibleItems = showPendingPurchases ? items : items.filter((item) => item.id !== 'pendingPurchases');
  const values: Record<string, string> = {
    activeProducts: String(totalProducts),
    lowStock: String(lowStockCount),
    pendingPurchases: String(pendingPurchases),
    salesToday: todaySales
  };

  const labels: Record<string, string> = {
    activeProducts: t('dashboard.stats.activeProducts.label'),
    lowStock: t('dashboard.stats.lowStock.label'),
    pendingPurchases: t('dashboard.stats.pendingPurchases.label'),
    salesToday: t('dashboard.stats.salesToday.label')
  };

  const helpers: Record<string, string> = {
    activeProducts: t('dashboard.stats.activeProducts.helper'),
    lowStock: t('dashboard.stats.lowStock.helper'),
    pendingPurchases: t('dashboard.stats.pendingPurchases.helper'),
    salesToday: t('dashboard.stats.salesToday.helper')
  };

  const metaText: Record<string, string> = {
    activeProducts: t('dashboard.stats.activeProducts.meta', { value: stockCoverage }),
    lowStock:
      lowStockCount === 0
        ? t('dashboard.stats.lowStock.metaClear')
        : t('dashboard.stats.lowStock.metaNeedsCheck', { value: 100 - stockCoverage }),
    pendingPurchases:
      pendingPurchases === 0
        ? t('dashboard.stats.pendingPurchases.metaClear')
        : t('dashboard.stats.pendingPurchases.metaOpen', { count: pendingPurchases }),
    salesToday: t('dashboard.stats.salesToday.meta', { count: todaySaleCount })
  };

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${showPendingPurchases ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
      {visibleItems.map((item) => {
        const index = items.findIndex((entry) => entry.id === item.id);

        return (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: index * 0.05 }}
          whileHover={{ y: -6 }}
        >
          <Card className={`overflow-hidden border ${item.tone.shell}`}>
            <div className="flex items-start justify-between gap-3">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-[18px] shadow-[0_16px_28px_-20px_rgba(28,25,23,0.38)] ${item.tone.icon}`}>
                <StatIcon icon={item.icon} />
              </div>
              <div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${item.tone.pill}`}>
                {metaText[item.id]}
              </div>
            </div>

            <div className="mt-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">{labels[item.id]}</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-stone-950">{values[item.id]}</div>
            <div className="mt-2 text-sm leading-6 text-stone-600">{helpers[item.id]}</div>
          </Card>
        </motion.div>
        );
      })}
    </div>
  );
}
