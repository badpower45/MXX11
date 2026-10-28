'use client';

import Badge from '@/components/ui/Badge';
import { dateTime } from '@/lib/format';
import { useTranslations } from '@/lib/i18n/client';

type ActivityItem = {
  id: string;
  action: string;
  entityType: string;
  description: string;
  createdAt: string;
  user?: {
    name: string | null;
    email: string;
  } | null;
};

function toneForAction(action: string) {
  if (action.includes('ARCHIVED') || action.includes('CANCELLED')) {
    return 'amber';
  }

  if (action.includes('RECEIVED') || action.includes('COMPLETED') || action.includes('CREATED')) {
    return 'emerald';
  }

  if (action.includes('LOW_STOCK')) {
    return 'red';
  }

  return 'stone';
}

export default function ActivityLogTable({ items }: { items: ActivityItem[] }) {
  const t = useTranslations('activity');

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
        {t('empty')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-stone-500">
          <tr>
            <th className="px-3 py-3">{t('table.when')}</th>
            <th className="px-3 py-3">{t('table.action')}</th>
            <th className="px-3 py-3">{t('table.entity')}</th>
            <th className="px-3 py-3">{t('table.description')}</th>
            <th className="px-3 py-3">{t('table.user')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-stone-200">
              <td className="px-3 py-3 text-stone-600">{dateTime(item.createdAt)}</td>
              <td className="px-3 py-3">
                <Badge tone={toneForAction(item.action)}>{item.action.replaceAll('_', ' ')}</Badge>
              </td>
              <td className="px-3 py-3 font-medium text-stone-900">{item.entityType}</td>
              <td className="px-3 py-3 text-stone-700">{item.description}</td>
              <td className="px-3 py-3 text-stone-600">
                {item.user?.name || item.user?.email || t('systemUser')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
