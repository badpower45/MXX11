'use client';

import Link from 'next/link';
import { ShopRole } from '@prisma/client';
import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';
import { SerializedStaffListItem } from '@/lib/serializers/staff';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

type ManagedShop = {
  id: string;
  name: string;
  slug: string;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10';

function roleTone(role: ShopRole) {
  switch (role) {
    case 'ADMIN':
      return 'blue';
    case 'MANAGER':
      return 'amber';
    default:
      return 'stone';
  }
}

function roleLabel(role: ShopRole, t: (key: string, params?: Record<string, string | number>) => string) {
  return t(`roles.${role}`);
}

export default function StaffListManager({
  initialItems,
  shops,
  defaultShopId
}: {
  initialItems: SerializedStaffListItem[];
  shops: ManagedShop[];
  defaultShopId: string;
}) {
  const t = useTranslations('staff');
  const lp = useLocalizedPath();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [shopFilter, setShopFilter] = useState(defaultShopId);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [mountedAt] = useState(() => Date.now());

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery =
        !term ||
        [item.name, item.email, item.role, item.shopName].join(' ').toLowerCase().includes(term);
      const matchesRole = !roleFilter || item.role === roleFilter;
      const matchesShop = !shopFilter || item.shopId === shopFilter;
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'active' && item.isActive) ||
        (statusFilter === 'inactive' && !item.isActive);

      return matchesQuery && matchesRole && matchesShop && matchesStatus;
    });
  }, [items, query, roleFilter, shopFilter, statusFilter]);

  const activeCount = items.filter((item) => item.isActive).length;
  const inactiveCount = items.length - activeCount;
  const recentlySeenCount = items.filter((item) => {
    if (!item.lastLogin) {
      return false;
    }

    return mountedAt - new Date(item.lastLogin).getTime() <= 1000 * 60 * 60 * 24 * 7;
  }).length;

  async function toggleActive(item: SerializedStaffListItem) {
    setError('');
    setSuccess('');
    setLoadingId(item.id);

    const response = await fetch(`/api/staff/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: item.role,
        shopId: item.shopId,
        isActive: !item.isActive,
        customPermissions: item.customPermissions
      })
    });

    const data = await response.json().catch(() => ({ error: t('errors.updateStatus') }));
    setLoadingId(null);

    if (!response.ok || !data?.item) {
      setError(data?.error ?? t('errors.updateStatus'));
      return;
    }

    setItems((current) => current.map((entry) => (entry.id === item.id ? data.item : entry)));
    setSuccess(
      t('statusUpdated', {
        name: data.item.name,
        status: data.item.isActive ? t('status.active') : t('status.inactive'),
        shop: data.item.shopName
      })
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">{t('hero.tag')}</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">{t('hero.title')}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">{t('hero.subtitle')}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('stats.active')}</div>
              <div className="mt-1 text-2xl font-black text-stone-950">{activeCount}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('stats.inactive')}</div>
              <div className="mt-1 text-2xl font-black text-stone-950">{inactiveCount}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('stats.seenThisWeek')}</div>
              <div className="mt-1 text-2xl font-black text-blue-700">{recentlySeenCount}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('filters.searchPlaceholder')}
          />

          <select className={selectClassName} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">{t('filters.allRoles')}</option>
            <option value="ADMIN">{roleLabel('ADMIN', t)}</option>
            <option value="MANAGER">{roleLabel('MANAGER', t)}</option>
            <option value="CASHIER">{roleLabel('CASHIER', t)}</option>
          </select>

          <select className={selectClassName} value={shopFilter} onChange={(event) => setShopFilter(event.target.value)}>
            <option value="">{t('filters.allShops')}</option>
            {shops.map((shop) => (
              <option key={shop.id} value={shop.id}>
                {shop.name}
              </option>
            ))}
          </select>

          <select className={selectClassName} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">{t('filters.allStatuses')}</option>
            <option value="active">{t('filters.activeOnly')}</option>
            <option value="inactive">{t('filters.inactiveOnly')}</option>
          </select>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {success ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            {success}
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('directory.tag')}</div>
            <h2 className="mt-2 text-xl font-black text-stone-950">{t('directory.title')}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {t('directory.matches', { count: filteredItems.length })}
            </p>
          </div>

          <Link href={lp('/staff/new')}>
            <Button>{t('directory.addStaff')}</Button>
          </Link>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5">{t('table.staff')}</th>
                  <th className="px-4 py-3.5">{t('table.role')}</th>
                  <th className="px-4 py-3.5">{t('table.shop')}</th>
                  <th className="px-4 py-3.5">{t('table.status')}</th>
                  <th className="px-4 py-3.5">{t('table.assigned')}</th>
                  <th className="px-4 py-3.5">{t('table.lastLogin')}</th>
                  <th className="px-4 py-3.5">{t('table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                    <td className="px-4 py-4">
                      <Link href={lp(`/staff/${item.id}`)} className="font-semibold text-blue-700">
                        {item.name}
                      </Link>
                      <div className="mt-1 text-xs text-stone-500">{item.email}</div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={roleTone(item.role)}>{roleLabel(item.role, t)}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-stone-900">{item.shopName}</div>
                      <div className="mt-1 text-xs text-stone-500">{item.shopSlug}</div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={item.isActive ? 'emerald' : 'red'}>
                        {item.isActive ? t('status.active') : t('status.inactive')}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-stone-600">{shortDate(item.assignedAt)}</td>
                    <td className="px-4 py-4 text-stone-600">
                      {item.lastLogin ? dateTime(item.lastLogin) : t('table.never')}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={lp(`/staff/${item.id}`)}>
                          <Button type="button" variant="secondary">{t('table.open')}</Button>
                        </Link>
                        <Button
                          type="button"
                          variant={item.isActive ? 'ghost' : 'secondary'}
                          onClick={() => toggleActive(item)}
                          disabled={loadingId === item.id}
                        >
                          {loadingId === item.id
                            ? t('table.saving')
                            : item.isActive
                              ? t('table.deactivate')
                              : t('table.activate')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!filteredItems.length ? (
            <div className="border-t border-stone-200 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
              {t('empty')}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
