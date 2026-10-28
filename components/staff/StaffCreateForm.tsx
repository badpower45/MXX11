'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useLocalizedPath, useTranslations, useLocale } from '@/lib/i18n/client';

type ManagedShop = {
  id: string;
  name: string;
  slug: string;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-stone-700">{children}</label>;
}

export default function StaffCreateForm({
  shops,
  defaultShopId
}: {
  shops: ManagedShop[];
  defaultShopId: string;
}) {
  const t = useTranslations('staff');
  const lp = useLocalizedPath();
  const router = useRouter();
  const { locale } = useLocale();
  const isAr = locale === 'ar';
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
    shopId: defaultShopId,
    baseSalary: '',
    commissionRate: ''
  });
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const payload = isGuest
      ? {
          name: form.name,
          shopId: form.shopId,
          isGuest: true,
          baseSalary: form.baseSalary || null,
          commissionRate: form.commissionRate || null
        }
      : form;

    const response = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({ error: t('create.errorFallback') }));
    setLoading(false);

    if (!response.ok || !data?.item) {
      setError(data?.error ?? t('create.errorFallback'));
      return;
    }

    router.push(lp(`/staff/${data.item.id}`));
    router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">
            {t('create.tag')}
          </div>
          <h2 className="mt-2 text-2xl font-black text-stone-950">
            {t('create.title')}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            {t('create.subtitle')}
          </p>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
          {t('create.adminOnly')}
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('create.profile')}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGuest}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsGuest(checked);
                    if (checked) {
                      setForm((current) => ({
                        ...current,
                        role: 'STOCK_COUNTER',
                        email: `guest-${Date.now()}@local.none`,
                        password: 'dummy-password-123'
                      }));
                    } else {
                      setForm((current) => ({
                        ...current,
                        role: 'CASHIER',
                        email: '',
                        password: ''
                      }));
                    }
                  }}
                  className="rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                />
                <span>{isAr ? 'موظف بدون حساب (تسجيل اسم فقط للمهام والجرد)' : 'Add guest staff (register name only for tasks/stock count)'}</span>
              </label>
            </div>

            <div className={isGuest ? 'md:col-span-2' : ''}>
              <FieldLabel>{t('create.nameLabel')}</FieldLabel>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={t('create.namePlaceholder')}
                required
              />
            </div>

            {!isGuest && (
              <>
                <div>
                  <FieldLabel>{t('create.emailLabel')}</FieldLabel>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder={t('create.emailPlaceholder')}
                    required
                  />
                </div>

                <div>
                  <FieldLabel>{t('create.passwordLabel')}</FieldLabel>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder={t('create.passwordPlaceholder')}
                    required
                  />
                </div>

                <div>
                  <FieldLabel>{t('create.roleLabel')}</FieldLabel>
                  <select
                    className={selectClassName}
                    value={form.role}
                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                  >
                    <option value="ADMIN">{t('roles.ADMIN')}</option>
                    <option value="MANAGER">{t('roles.MANAGER')}</option>
                    <option value="CASHIER">{t('roles.CASHIER')}</option>
                    <option value="STOCK_COUNTER">{t('roles.STOCK_COUNTER')}</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <FieldLabel>{t('create.baseSalaryLabel')}</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.baseSalary}
                onChange={(event) => setForm((current) => ({ ...current, baseSalary: event.target.value }))}
                placeholder={t('create.baseSalaryPlaceholder')}
              />
            </div>

            <div>
              <FieldLabel>{t('create.commissionRateLabel')}</FieldLabel>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.commissionRate}
                onChange={(event) => setForm((current) => ({ ...current, commissionRate: event.target.value }))}
                placeholder={t('create.commissionRatePlaceholder')}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            {t('create.assignment')}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>{t('create.shopLabel')}</FieldLabel>
              <select
                className={selectClassName}
                value={form.shopId}
                onChange={(event) => setForm((current) => ({ ...current, shopId: event.target.value }))}
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
              {t('create.activeWarning')}
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={loading}>
            {loading ? t('create.creating') : t('create.submit')}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push(lp('/staff'))}>
            {t('create.back')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
