'use client';

import { useState, useTransition, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { dateTime, money } from '@/lib/format';
import { useTranslations } from '@/lib/i18n/client';

type StaffMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  baseSalary: string | null;
  shopId: string;
  isActive: boolean;
  customPermissions: any[];
};

type PaymentHistoryItem = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: string;
  paidAt: string;
  paymentMode: string;
  notes: string | null;
};

type SalariesManagerProps = {
  initialStaff: StaffMember[];
  initialHistory: PaymentHistoryItem[];
  currencySymbol: string;
  locale: string;
  hasActiveSession: boolean;
};

function roleTone(role: string) {
  switch (role) {
    case 'ADMIN': return 'blue';
    case 'MANAGER': return 'amber';
    default: return 'stone';
  }
}

export default function SalariesManager({
  initialStaff,
  initialHistory,
  currencySymbol,
  locale,
  hasActiveSession
}: SalariesManagerProps) {
  const isAr = locale === 'ar';
  const t = useTranslations('salaries');
  const tStaff = useTranslations('staff');

  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff);
  const [historyList, setHistoryList] = useState<PaymentHistoryItem[]>(initialHistory);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<StaffMember | null>(null);
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);

  // Forms state
  const [payForm, setPayForm] = useState({
    amount: '',
    paymentMode: 'CASH',
    notes: ''
  });
  const [editForm, setEditForm] = useState({
    baseSalary: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, startTransition] = useTransition();

  // Filtered staff members
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const term = searchQuery.toLowerCase().trim();
      return (
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.role.toLowerCase().includes(term)
      );
    });
  }, [staffList, searchQuery]);

  // Open pay salary modal
  const handleOpenPay = (employee: StaffMember) => {
    setError('');
    setSuccess('');
    setPayTarget(employee);
    setPayForm({
      amount: employee.baseSalary ?? '',
      paymentMode: 'CASH',
      notes: ''
    });
    setPayModalOpen(true);
  };

  // Open edit salary modal
  const handleOpenEdit = (employee: StaffMember) => {
    setError('');
    setSuccess('');
    setEditTarget(employee);
    setEditForm({
      baseSalary: employee.baseSalary ?? ''
    });
    setEditModalOpen(true);
  };

  // Submit salary payment
  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payTarget) return;
    setError('');
    setSuccess('');

    if (!payForm.amount || Number(payForm.amount) <= 0) {
      setError(isAr ? 'الرجاء إدخال مبلغ صرف صحيح.' : 'Please enter a valid payout amount.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/salaries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: payTarget.userId,
            amount: Number(payForm.amount),
            paymentMode: payForm.paymentMode,
            notes: payForm.notes
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to pay salary.');
        }

        // Add to history log
        const newHistoryItem: PaymentHistoryItem = {
          id: data.payment.id,
          userId: data.payment.userId,
          userName: payTarget.name,
          userEmail: payTarget.email,
          amount: data.payment.amount,
          paidAt: data.payment.paidAt,
          paymentMode: data.payment.paymentMode,
          notes: data.payment.notes
        };

        setHistoryList((prev) => [newHistoryItem, ...prev]);
        setSuccess(t('payoutSuccess'));
        setPayModalOpen(false);
        setPayTarget(null);
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  // Submit base salary update
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setError('');
    setSuccess('');

    const newSalary = editForm.baseSalary.trim() === '' ? null : Number(editForm.baseSalary);
    if (newSalary !== null && (isNaN(newSalary) || newSalary < 0)) {
      setError(isAr ? 'الرجاء إدخال راتب صحيح.' : 'Please enter a valid salary amount.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/staff/${editTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: editTarget.role,
            shopId: editTarget.shopId,
            isActive: editTarget.isActive,
            customPermissions: editTarget.customPermissions,
            baseSalary: newSalary
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to update salary.');
        }

        // Update local state
        setStaffList((prev) =>
          prev.map((s) => (s.id === editTarget.id ? { ...s, baseSalary: data.item.baseSalary } : s))
        );

        setSuccess(t('updateSuccess'));
        setEditModalOpen(false);
        setEditTarget(null);
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  const roleLabel = (role: string) => {
    return tStaff(`roles.${role}`) || role;
  };

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm animate-pulse">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
          {success}
        </div>
      )}

      {/* Warning Alert if register session is closed */}
      {!hasActiveSession && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm font-bold text-amber-800 shadow-sm flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            {isAr
              ? 'تنبيه: يجب فتح وردية/جلسة خزينة نشطة لتتمكن من صرف الرواتب للموظفين.'
              : 'Warning: You must open an active register session (drawer) before you can pay salaries to staff.'}
          </div>
        </div>
      )}

      {/* Control bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-black text-stone-900">{isAr ? 'دليل رواتب الموظفين' : 'Employee Salaries Directory'}</h2>
          <p className="text-xs text-stone-500">{isAr ? 'عرض وتحديث الرواتب للموظفين وتنزيل الاستحقاقات' : 'View, edit and pay employee salaries'}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder={isAr ? 'البحث عن موظف...' : 'Search employee name or email...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 px-4 rounded-2xl border border-stone-200 bg-white shadow-sm outline-none transition focus:border-blue-500 w-72 text-sm"
          />
        </div>
      </div>

      {/* Staff Salaries Table */}
      <Card>
        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-stone-700">
              <thead className="bg-stone-50 text-stone-500 font-semibold text-xs uppercase tracking-wider border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3.5 text-right">{t('employee')}</th>
                  <th className="px-4 py-3.5 text-right">{t('role')}</th>
                  <th className="px-4 py-3.5 text-right">{t('baseSalary')}</th>
                  <th className="px-4 py-3.5 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-150">
                {filteredStaff.map((staff) => (
                  <tr key={staff.id} className="bg-white hover:bg-stone-50/70 transition duration-150">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-semibold text-stone-900">{staff.name}</div>
                      <div className="text-xs text-stone-400">{staff.email}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge tone={roleTone(staff.role)}>
                        {roleLabel(staff.role)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap font-bold text-stone-900">
                      {staff.baseSalary ? money(staff.baseSalary, currencySymbol, locale) : (isAr ? 'غير محدد' : 'Not Set')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="primary"
                          onClick={() => handleOpenPay(staff)}
                          disabled={!hasActiveSession}
                          className="h-9 rounded-xl text-xs"
                        >
                          {t('paySalary')}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleOpenEdit(staff)}
                          className="h-9 rounded-xl text-xs"
                        >
                          {t('editSalary')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-stone-500 font-semibold bg-stone-50">
                      {isAr ? 'لا يوجد موظفون نشطون يطابقون البحث.' : 'No active staff members match the query.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Payout History Log */}
      <div>
        <h3 className="text-lg font-black text-stone-900 mb-2">{t('historyTitle')}</h3>
        <Card>
          <div className="overflow-hidden rounded-[26px] border border-stone-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-stone-700">
                <thead className="bg-stone-50 text-stone-500 font-semibold text-xs uppercase tracking-wider border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3.5 text-right">{t('paidAt')}</th>
                    <th className="px-4 py-3.5 text-right">{t('employee')}</th>
                    <th className="px-4 py-3.5 text-right">{t('paymentMode')}</th>
                    <th className="px-4 py-3.5 text-right">{t('amount')}</th>
                    <th className="px-4 py-3.5 text-right">{t('notes')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-150">
                  {historyList.map((hist) => (
                    <tr key={hist.id} className="bg-white hover:bg-stone-50/70 transition duration-150">
                      <td className="px-4 py-4 whitespace-nowrap text-stone-500">
                        {dateTime(hist.paidAt, locale)}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{hist.userName}</div>
                        <div className="text-xs text-stone-400">{hist.userEmail}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs font-semibold text-stone-600">
                          {t(`drawerTypeLabel.${hist.paymentMode}`) || hist.paymentMode}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap font-bold text-red-600">
                        {money(hist.amount, currencySymbol, locale)}
                      </td>
                      <td className="px-4 py-4 text-stone-500 max-w-xs truncate">
                        {hist.notes || '-'}
                      </td>
                    </tr>
                  ))}

                  {historyList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-stone-500 font-semibold bg-stone-50">
                        {isAr ? 'لم يتم تسجيل عمليات صرف رواتب بعد.' : 'No salary payments recorded yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      {/* Pay Salary Modal */}
      {payModalOpen && payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">
              {isAr ? `صرف راتب - ${payTarget.name}` : `Pay Salary - ${payTarget.name}`}
            </h3>

            <form onSubmit={handlePaySubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                  {t('paymentDrawer')} *
                </label>
                <select
                  value={payForm.paymentMode}
                  onChange={(e) => setPayForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm text-stone-700"
                >
                  <option value="CASH">{isAr ? 'درج الفرع (كاش)' : 'Branch Drawer (Cash)'}</option>
                  <option value="INSTAPAY">{isAr ? 'انستا باي (InstaPay)' : 'InstaPay'}</option>
                  <option value="WALLET">{isAr ? 'محفظة إلكترونية (Wallet)' : 'Electronic Wallet'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                  {t('payAmount')} ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={payForm.amount}
                  onChange={(e) => setPayForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm font-bold"
                  placeholder="2000"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                  {t('optionalNotes')}
                </label>
                <textarea
                  rows={2}
                  value={payForm.notes}
                  onChange={(e) => setPayForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                  placeholder={isAr ? 'أدخل أي ملاحظات إضافية...' : 'Any optional details...'}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPayModalOpen(false);
                    setPayTarget(null);
                  }}
                  disabled={isPending}
                  className="px-5 py-3 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold transition"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md"
                >
                  {isPending ? t('paying') : t('paySalary')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Base Salary Modal */}
      {editModalOpen && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">
              {isAr ? `تعديل الراتب الأساسي - ${editTarget.name}` : `Edit Base Salary - ${editTarget.name}`}
            </h3>

            <form onSubmit={handleEditSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                  {t('baseSalary')} ({currencySymbol})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.baseSalary}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, baseSalary: e.target.value }))}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm font-bold"
                  placeholder={isAr ? 'مثال: 5000' : 'e.g. 5000'}
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  {isAr ? 'اتركه فارغاً لإلغاء تحديد الراتب الأساسي' : 'Leave empty to unset base salary'}
                </span>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setEditTarget(null);
                  }}
                  disabled={isPending}
                  className="px-5 py-3 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold transition"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md"
                >
                  {isPending ? t('updating') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
