'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from '@/components/providers/LocaleProvider';
import { useLocalizedPath } from '@/lib/i18n/client';
import { stripLocalePrefix } from '@/lib/i18n/locales';

const links = [
  { href: '/reports', labelKey: 'reports.nav.overview' },
  { href: '/reports/sales', labelKey: 'reports.nav.sales' },
  { href: '/reports/inventory', labelKey: 'reports.nav.inventory' },
  { href: '/reports/profit', labelKey: 'reports.nav.profit' },
  { href: '/reports/cashier', labelKey: 'reports.nav.cashier' }
] as const;

export default function ReportsNav() {
  const pathname = stripLocalePrefix(usePathname());
  const localizedPath = useLocalizedPath();
  const t = useTranslations();

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={localizedPath(link.href)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            {t(link.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
