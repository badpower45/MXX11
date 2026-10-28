'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';
import {
  getDefaultPermissionList,
  PERMISSION_KEYS,
  type PermissionKey
} from '@/lib/permissions';
import { SerializedAuthAuditLog } from '@/lib/serializers/staff';
import { useTranslations } from '@/lib/i18n/client';

type ManagedShop = {
  id: string;
  name: string;
  slug: string;
};

type StaffDetail = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER' | 'STOCK_COUNTER';
  shopId: string;
  shopName: string;
  shopSlug: string;
  isActive: boolean;
  assignedAt: string;
  disabledAt: string | null;
  lastLogin: string | null;
  customPermissions: PermissionKey[];
  authActivity: SerializedAuthAuditLog[];
  hasPin: boolean;
  pinSetAt: string | null;
  emailVerifiedAt: string | null;
  forcePasswordReset: boolean;
  lockedUntil: string | null;
  baseSalary?: string | null;
  commissionRate?: string | null;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10';

function authTone(action: string) {
  if (action.includes('FAILURE') || action.includes('BLOCKED')) {
    return 'red';
  }

  if (action.includes('COMPLETED') || action.includes('SUCCESS')) {
    return 'emerald';
  }

  return 'amber';
}

function getPermissionDraft(role: StaffDetail['role'], customPermissions: PermissionKey[]) {
  return customPermissions.length ? customPermissions : getDefaultPermissionList(role);
}

function isLocked(lockedUntil: string | null) {
  return Boolean(lockedUntil && new Date(lockedUntil) > new Date());
}

export default function StaffDetailManager({
  initialStaff,
  shops
}: {
  initialStaff: StaffDetail;
  shops: ManagedShop[];
}) {
  const t = useTranslations('staff');
  const [staff, setStaff] = useState(initialStaff);
  const [assignment, setAssignment] = useState({
    role: initialStaff.role,
    shopId: initialStaff.shopId,
    isActive: initialStaff.isActive,
    customPermissions: getPermissionDraft(initialStaff.role, initialStaff.customPermissions),
    baseSalary: initialStaff.baseSalary ?? '',
    commissionRate: initialStaff.commissionRate ?? ''
  });
  const [guestName, setGuestName] = useState(initialStaff.name);
  const [pin, setPin] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [resetExpiresAt, setResetExpiresAt] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentSuccess, setAssignmentSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [issuingReset, setIssuingReset] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  async function saveAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssignmentError('');
    setAssignmentSuccess('');
    setSavingAssignment(true);

    const response = await fetch(`/api/staff/${staff.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...assignment,
        name: guestName
      })
    });

    const data = await response.json().catch(() => ({ error: t('detail.errorUpdate') }));
    setSavingAssignment(false);

    if (!response.ok || !data?.item) {
      setAssignmentError(data?.error ?? t('detail.errorUpdate'));
      return;
    }

    setStaff((current) => ({
      ...current,
      ...data.item,
      hasPin: data.item.role === 'CASHIER' ? current.hasPin : false,
      pinSetAt: data.item.role === 'CASHIER' ? current.pinSetAt : null
    }));
    setAssignment({
      role: data.item.role,
      shopId: data.item.shopId,
      isActive: data.item.isActive,
      customPermissions: getPermissionDraft(data.item.role, data.item.customPermissions ?? []),
      baseSalary: data.item.baseSalary ?? '',
      commissionRate: data.item.commissionRate ?? ''
    });
    setAssignmentSuccess(t('detail.successUpdate'));
  }

  async function issueResetLink() {
    setResetError('');
    setResetSuccess('');
    setIssuingReset(true);

    const response = await fetch(`/api/staff/${staff.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInHours: 24 })
    });

    const data = await response.json().catch(() => ({ error: t('detail.resetError') }));
    setIssuingReset(false);

    if (!response.ok) {
      setResetError(data?.error ?? t('detail.resetError'));
      return;
    }

    setResetUrl(data.resetUrl);
    setResetExpiresAt(data.expiresAt);
    setStaff((current) => ({
      ...current,
      forcePasswordReset: true,
      lockedUntil: null
    }));
    setResetSuccess(t('detail.resetSuccess'));
  }

  async function copyResetLink() {
    try {
      await navigator.clipboard.writeText(resetUrl);
      setResetSuccess(t('detail.copied'));
    } catch {
      setResetError(t('detail.copyError'));
    }
  }

  async function savePin(nextPin: string | null) {
    setPinError('');
    setPinSuccess('');
    setSavingPin(true);

    const response = await fetch(`/api/staff/${staff.id}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: nextPin })
    });

    const data = await response.json().catch(() => ({ error: t('detail.pinError') }));
    setSavingPin(false);

    if (!response.ok) {
      setPinError(data?.error ?? t('detail.pinError'));
      return;
    }

    setStaff((current) => ({
      ...current,
      hasPin: data.hasPin,
      pinSetAt: data.pinSetAt
    }));
    setPin('');
    setPinSuccess(data.hasPin ? t('detail.pinSuccessSet') : t('detail.pinSuccessClear'));
  }

  function togglePermission(permission: PermissionKey) {
    setAssignment((current) => ({
      ...current,
      customPermissions: current.customPermissions.includes(permission)
        ? current.customPermissions.filter((entry) => entry !== permission)
        : [...current.customPermissions, permission]
    }));
  }

  const currentlyLocked = isLocked(staff.lockedUntil);

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">{t('detail.tag')}</div>
            <h2 className="mt-2 text-3xl font-black text-stone-950">{staff.name}</h2>
            <p className="mt-2 text-sm text-stone-500">{staff.email}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone={staff.isActive ? 'emerald' : 'red'}>
                {staff.isActive ? t('status.active') : t('status.inactive')}
              </Badge>
              <Badge tone={staff.role === 'ADMIN' ? 'blue' : staff.role === 'MANAGER' ? 'amber' : 'stone'}>
                {t(`roles.${staff.role}`)}
              </Badge>
              <Badge tone="stone">{staff.shopName}</Badge>
              <Badge tone={staff.emailVerifiedAt ? 'emerald' : 'amber'}>
                {staff.emailVerifiedAt ? t('detail.verified') : t('detail.unverified')}
              </Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('detail.assigned')}</div>
              <div className="mt-2 text-lg font-black text-stone-950">{shortDate(staff.assignedAt)}</div>
              <div className="mt-1 text-sm text-stone-500">{staff.shopSlug}</div>
            </div>
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('detail.lastLogin')}</div>
              <div className="mt-2 text-lg font-black text-stone-950">
                {staff.lastLogin ? dateTime(staff.lastLogin) : t('detail.never')}
              </div>
              <div className="mt-1 text-sm text-stone-500">
                {staff.disabledAt ? t('detail.disabledAt', { date: dateTime(staff.disabledAt) }) : t('detail.live')}
              </div>
            </div>
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('detail.securityState')}</div>
              <div className="mt-2 text-lg font-black text-stone-950">
                {currentlyLocked ? t('detail.locked') : staff.forcePasswordReset ? t('detail.resetRequired') : t('detail.healthy')}
              </div>
              <div className="mt-1 text-sm text-stone-500">
                {currentlyLocked
                  ? t('detail.unlocksAt', { date: dateTime(staff.lockedUntil!) })
                  : staff.forcePasswordReset
                    ? t('detail.resetRequiredMsg')
                    : t('detail.healthyMsg')}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className={staff.userId ? "grid gap-6 xl:grid-cols-[1.1fr_0.9fr]" : "grid gap-6 max-w-4xl mx-auto w-full"}>
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('detail.controlsTitle')}</div>
          <h3 className="mt-2 text-xl font-black text-stone-950">{t('detail.controlsHeader')}</h3>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            {t('detail.controlsDesc')}
          </p>

          <form onSubmit={saveAssignment} className="mt-6 space-y-4">
            {!staff.userId && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">الاسم</label>
                <Input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder="اسم الموظف"
                  required
                />
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {staff.userId ? (
                <div>
                  <label className="mb-2 block text-sm font-semibold text-stone-700">{t('detail.roleLabel')}</label>
                  <select
                    className={selectClassName}
                    value={assignment.role}
                    onChange={(event) =>
                      setAssignment((current) => ({
                        ...current,
                        role: event.target.value as StaffDetail['role'],
                        customPermissions: getPermissionDraft(event.target.value as StaffDetail['role'], [])
                      }))
                    }
                  >
                    <option value="ADMIN">{t('roles.ADMIN')}</option>
                    <option value="MANAGER">{t('roles.MANAGER')}</option>
                    <option value="CASHIER">{t('roles.CASHIER')}</option>
                    <option value="STOCK_COUNTER">{t('roles.STOCK_COUNTER')}</option>
                  </select>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">{t('detail.baseSalaryLabel')}</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={assignment.baseSalary}
                  onChange={(event) =>
                    setAssignment((current) => ({
                      ...current,
                      baseSalary: event.target.value
                    }))
                  }
                  placeholder={t('detail.baseSalaryPlaceholder')}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">{t('detail.commissionRateLabel')}</label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={assignment.commissionRate}
                  onChange={(event) =>
                    setAssignment((current) => ({
                      ...current,
                      commissionRate: event.target.value
                    }))
                  }
                  placeholder={t('detail.commissionRatePlaceholder')}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">{t('detail.shopLabel')}</label>
                <select
                  className={selectClassName}
                  value={assignment.shopId}
                  onChange={(event) =>
                    setAssignment((current) => ({
                      ...current,
                      shopId: event.target.value
                    }))
                  }
                >
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={assignment.isActive}
                onChange={(event) =>
                  setAssignment((current) => ({
                    ...current,
                    isActive: event.target.checked
                  }))
                }
              />
              {t('detail.activeCheckbox')}
            </label>

            {staff.userId ? (
              <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('detail.matrixTitle')}</div>
                <div className="mt-2 text-sm text-stone-600">
                  {t('detail.matrixDesc')}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {PERMISSION_KEYS.map((permission) => (
                    <label key={permission} className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
                      <input
                        type="checkbox"
                        checked={assignment.customPermissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                      />
                      <span>
                        <span className="block font-semibold text-stone-900">{t(`detail.permissions.${permission}.label`)}</span>
                        <span className="mt-1 block text-xs text-stone-500">{t(`detail.permissions.${permission}.desc`)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            {assignmentError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{assignmentError}</div>
            ) : null}

            {assignmentSuccess ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {assignmentSuccess}
              </div>
            ) : null}

            <Button type="submit" disabled={savingAssignment}>
              {savingAssignment ? t('detail.savingChanges') : t('detail.saveAssignment')}
            </Button>
          </form>
        </Card>

        {staff.userId ? (
          <div className="space-y-6">
          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('detail.securityTitle')}</div>
            <h3 className="mt-2 text-xl font-black text-stone-950">{t('detail.securityHeader')}</h3>
            <div className="mt-5 space-y-3 text-sm text-stone-600">
              <div>
                {t('detail.emailVerification', {
                  status: staff.emailVerifiedAt ? `${t('detail.verified')} (${dateTime(staff.emailVerifiedAt)})` : t('detail.unverified')
                })}
              </div>
              <div>
                {t('detail.forcedReset', {
                  status: staff.forcePasswordReset ? t('detail.forcedResetRequired') : t('detail.forcedResetNotRequired')
                })}
              </div>
              <div>
                {t('detail.loginLockout', {
                  status: currentlyLocked ? t('detail.lockedUntil', { date: dateTime(staff.lockedUntil!) }) : t('detail.noLockout')
                })}
              </div>
            </div>
          </Card>

          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('detail.resetTitle')}</div>
            <h3 className="mt-2 text-xl font-black text-stone-950">{t('detail.resetHeader')}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {t('detail.resetDesc')}
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={issueResetLink} disabled={issuingReset}>
                {issuingReset ? t('detail.generatingLink') : t('detail.generateLink')}
              </Button>
              {resetUrl ? (
                <Button type="button" variant="secondary" onClick={copyResetLink}>
                  {t('detail.copyLink')}
                </Button>
              ) : null}
            </div>

            {resetUrl ? (
              <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('detail.secureLink')}</div>
                <div className="mt-2 break-all text-sm text-stone-700">{resetUrl}</div>
                <div className="mt-2 text-xs text-stone-500">{t('detail.expires', { date: dateTime(resetExpiresAt) })}</div>
              </div>
            ) : null}

            {resetError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{resetError}</div>
            ) : null}

            {resetSuccess ? (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {resetSuccess}
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('detail.pinTitle')}</div>
            <h3 className="mt-2 text-xl font-black text-stone-950">{t('detail.pinHeader')}</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              {t('detail.pinDesc')}
            </p>

            {staff.role === 'CASHIER' ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder={t('detail.pinPlaceholder')}
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                  />
                  <Button type="button" onClick={() => savePin(pin)} disabled={savingPin}>
                    {savingPin ? t('detail.saving') : staff.hasPin ? t('detail.updatePin') : t('detail.setPin')}
                  </Button>
                  {staff.hasPin ? (
                    <Button type="button" variant="secondary" onClick={() => savePin(null)} disabled={savingPin}>
                      {t('detail.clearPin')}
                    </Button>
                  ) : null}
                </div>

                <div className="mt-3 text-sm text-stone-500">
                  {staff.hasPin && staff.pinSetAt ? t('detail.pinUpdated', { date: dateTime(staff.pinSetAt) }) : t('detail.noPin')}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                {t('detail.pinCashiersOnly')}
              </div>
            )}

            {pinError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pinError}</div>
            ) : null}

            {pinSuccess ? (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {pinSuccess}
              </div>
            ) : null}
          </Card>
          </div>
        ) : null}
      </div>

      <Card>
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{t('detail.activityTitle')}</div>
          <h3 className="mt-2 text-xl font-black text-stone-950">{t('detail.activityHeader')}</h3>
          <p className="mt-2 text-sm text-stone-500">
            {t('detail.activityDesc')}
          </p>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5">{t('detail.tableWhen')}</th>
                  <th className="px-4 py-3.5">{t('detail.tableAction')}</th>
                  <th className="px-4 py-3.5">{t('detail.tableEmail')}</th>
                  <th className="px-4 py-3.5">{t('detail.tableIp')}</th>
                  <th className="px-4 py-3.5">{t('detail.tableUserAgent')}</th>
                </tr>
              </thead>
              <tbody>
                {staff.authActivity.map((log) => (
                  <tr key={log.id} className="border-t border-stone-200 bg-white">
                    <td className="px-4 py-4 text-stone-600">{dateTime(log.createdAt)}</td>
                    <td className="px-4 py-4">
                      <Badge tone={authTone(log.action)}>{log.action.replaceAll('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-4 text-stone-700">{log.email ?? staff.email}</td>
                    <td className="px-4 py-4 text-stone-600">{log.ipAddress ?? 'N/A'}</td>
                    <td className="max-w-xs px-4 py-4 text-xs text-stone-500">{log.userAgent ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!staff.authActivity.length ? (
            <div className="border-t border-stone-200 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
              {t('detail.noActivity')}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
