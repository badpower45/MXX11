import AppHeader from '@/components/layout/AppHeader';
import ActivityLogTable from '@/components/activity/ActivityLogTable';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { requirePageRole } from '@/lib/authz';
import { dateTime } from '@/lib/format';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { prisma } from '@/lib/prisma';

export default async function ActivityPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  const [items, authItems] = await Promise.all([
    prisma.activityLog.findMany({
      where: { shopId },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    }),
    prisma.authAuditLog.findMany({
      where: { shopId },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
  ]);
  const safeItems = items.map((item) => ({
    id: item.id,
    action: item.action,
    entityType: item.entityType,
    description: item.description,
    createdAt: item.createdAt.toISOString(),
    user: item.user
      ? {
          name: item.user.name,
          email: item.user.email
        }
      : null
  }));

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('activity.title')}
        subtitle={t('activity.subtitle')}
      />

      <Card>
        <ActivityLogTable
          items={safeItems}
        />
      </Card>

      <Card>
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('activity.security.tag')}</div>
          <h2 className="mt-2 text-xl font-black text-stone-900">{t('activity.security.title')}</h2>
          <p className="mt-1 text-sm text-stone-500">{t('activity.security.subtitle')}</p>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5">{t('activity.security.table.when')}</th>
                  <th className="px-4 py-3.5">{t('activity.security.table.user')}</th>
                  <th className="px-4 py-3.5">{t('activity.security.table.action')}</th>
                  <th className="px-4 py-3.5">{t('activity.security.table.ip')}</th>
                  <th className="px-4 py-3.5">{t('activity.security.table.userAgent')}</th>
                </tr>
              </thead>
              <tbody>
                {authItems.map((item) => (
                  <tr key={item.id} className="border-t border-stone-200 bg-white">
                    <td className="px-4 py-4 text-stone-600">{dateTime(item.createdAt)}</td>
                    <td className="px-4 py-4 text-stone-700">
                      {item.user?.name ?? item.user?.email ?? item.email ?? t('activity.unknownUser')}
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={item.action.includes('FAILURE') || item.action.includes('BLOCKED') ? 'red' : item.action.includes('SUCCESS') || item.action.includes('VERIFIED') ? 'emerald' : 'amber'}>
                        {item.action.replaceAll('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-stone-600">{item.ipAddress ?? t('activity.notAvailable')}</td>
                    <td className="max-w-xs px-4 py-4 text-xs text-stone-500">{item.userAgent ?? t('activity.notAvailable')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!authItems.length ? (
            <div className="border-t border-stone-200 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
              {t('activity.security.empty')}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
