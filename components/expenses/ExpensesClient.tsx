'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { shortDate, dateTime, money } from '@/lib/format';

type Expense = {
  id: string;
  category: 'PRINTING_PAPER' | 'PENS' | 'STAPLES' | 'ELECTRICITY' | 'RENT' | 'MISCELLANEOUS' | 'TIPS' | 'PERSONAL_WITHDRAWAL' | 'OTHER' | 'SALARY';
  amount: string;
  reason: string | null;
  recipient: string | null;
  createdAt: string;
  drawer?: string | null;
  user: {
    name: string | null;
    email: string;
  };
};

type ExpensesClientProps = {
  initialExpenses: Expense[];
  currencySymbol: string;
  locale: string;
  shopType: string;
  sparePartsShops: { id: string; name: string }[];
};

export default function ExpensesClient({
  initialExpenses,
  currencySymbol,
  locale,
  shopType,
  sparePartsShops
}: ExpensesClientProps) {
  const isAr = locale === 'ar';
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const isCategoryCode = ['PRINTING_PAPER', 'PENS', 'STAPLES', 'ELECTRICITY', 'RENT', 'TIPS', 'PERSONAL_WITHDRAWAL', 'MISCELLANEOUS', 'OTHER', 'SALARY'].includes(initialSearch);

  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [searchQuery, setSearchQuery] = useState(isCategoryCode ? '' : initialSearch);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>(isCategoryCode ? initialSearch : 'ALL');

  useEffect(() => {
    const q = searchParams.get('search') ?? '';
    if (q) {
      const isCat = ['PRINTING_PAPER', 'PENS', 'STAPLES', 'ELECTRICITY', 'RENT', 'TIPS', 'PERSONAL_WITHDRAWAL', 'MISCELLANEOUS', 'OTHER', 'SALARY'].includes(q);
      if (isCat) {
        setSelectedCategoryFilter(q);
        setSearchQuery('');
      } else {
        setSelectedCategoryFilter('ALL');
        setSearchQuery(q);
      }
    }
  }, [searchParams]);

  // New expense form state
  const [form, setForm] = useState({
    category: 'MISCELLANEOUS' as Expense['category'],
    amount: '',
    reason: '',
    recipient: '',
    purchaseFromSpareParts: false,
    fromBranchId: sparePartsShops[0]?.id ?? '',
    drawer: 'CASH'
  });

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Categories metadata
  const categoriesList = [
    { value: 'PRINTING_PAPER', label: isAr ? 'ورق طباعة' : 'Printing Paper' },
    { value: 'PENS', label: isAr ? 'أقلام' : 'Pens' },
    { value: 'STAPLES', label: isAr ? 'دبابيس' : 'Staples' },
    { value: 'ELECTRICITY', label: isAr ? 'كهرباء' : 'Electricity' },
    { value: 'RENT', label: isAr ? 'إيجار' : 'Rent' },
    { value: 'TIPS', label: isAr ? 'إكراميات' : 'Tips' },
    { value: 'PERSONAL_WITHDRAWAL', label: isAr ? 'سحوبات شخصية' : 'Personal Withdrawal' },
    { value: 'MISCELLANEOUS', label: isAr ? 'مصاريف متنوعة' : 'Miscellaneous' },
    { value: 'SALARY', label: isAr ? 'رواتب موظفين' : 'Employee Salaries' },
    { value: 'OTHER', label: isAr ? 'تكاليف أخرى' : 'Other' }
  ];

  const getCategoryLabel = (cat: Expense['category']) => {
    return categoriesList.find((c) => c.value === cat)?.label ?? cat;
  };

  const getCategoryBadgeTone = (cat: Expense['category']) => {
    switch (cat) {
      case 'RENT': return 'red';
      case 'ELECTRICITY': return 'amber';
      case 'PERSONAL_WITHDRAWAL': return 'stone';
      case 'TIPS': return 'emerald';
      case 'SALARY': return 'emerald';
      default: return 'blue';
    }
  };

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchesSearch =
        e.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.recipient?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategoryFilter === 'ALL' || e.category === selectedCategoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [expenses, searchQuery, selectedCategoryFilter]);

  // Handle submit new expense
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.category || !form.amount || Number(form.amount) <= 0) {
      setError(isAr ? 'الرجاء إدخال مبلغ صحيح.' : 'Please enter a valid amount.');
      return;
    }

    if (form.category === 'TIPS' && !form.recipient.trim()) {
      setError(isAr ? 'اسم مستلم الإكرامية مطلوب.' : 'Recipient name is required for tips.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: form.category,
            amount: Number(form.amount),
            reason: form.reason || null,
            recipient: form.category === 'TIPS' ? form.recipient : null,
            fromBranchId: form.purchaseFromSpareParts ? form.fromBranchId : null,
            drawer: form.drawer
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to record expense.');
        }

        // Add to local state
        setExpenses((prev) => [
          {
            ...data.expense,
            amount: data.expense.amount.toString(),
            createdAt: data.expense.createdAt,
            user: {
              name: data.expense.user?.name ?? 'Me',
              email: data.expense.user?.email ?? ''
            }
          },
          ...prev
        ]);

        setSuccess(isAr ? 'تم تسجيل المصروف وخصمه من الدرج بنجاح!' : 'Expense recorded and deducted from cash drawer!');
        setForm({
          category: 'MISCELLANEOUS',
          amount: '',
          reason: '',
          recipient: '',
          purchaseFromSpareParts: false,
          fromBranchId: sparePartsShops[0]?.id ?? '',
          drawer: 'CASH'
        });
        setCreateModalOpen(false);
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
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

      {/* Control bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="h-11 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white transition text-sm font-bold flex items-center gap-2 shadow-[0_12px_24px_-16px_rgba(37,99,235,0.5)]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {isAr ? 'تسجيل مصروفات جديد' : 'New Expense Entry'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="h-11 px-4 rounded-2xl border border-stone-200 bg-white text-sm outline-none transition focus:border-blue-500 text-stone-700"
          >
            <option value="ALL">{isAr ? 'كل التصنيفات' : 'All Categories'}</option>
            {categoriesList.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder={isAr ? 'البحث في الملاحظات أو الكاشير...' : 'Search note or cashier...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 px-4 rounded-2xl border border-stone-200 bg-white shadow-sm outline-none transition focus:border-blue-500 w-64 text-sm"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <Card>
        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-stone-700">
              <thead className="bg-stone-50 text-stone-500 font-semibold text-xs uppercase tracking-wider border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'تاريخ وتسجيل' : 'Date / Time'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'الموظف' : 'Cashier'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'التصنيف' : 'Category'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'الدرج' : 'Drawer'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'المبلغ' : 'Amount'}</th>
                  <th className="px-4 py-3.5 text-right">{isAr ? 'التفاصيل والبيان' : 'Reason / Recipient'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-150">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="bg-white hover:bg-stone-50/70 transition duration-150">
                    <td className="px-4 py-4 whitespace-nowrap text-stone-500">{dateTime(exp.createdAt, locale)}</td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-stone-900">{exp.user.name || 'Staff'}</div>
                      <div className="text-xs text-stone-400">{exp.user.email}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Badge tone={getCategoryBadgeTone(exp.category)}>
                        {getCategoryLabel(exp.category)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-xs font-semibold text-stone-600">
                        {exp.drawer === 'INSTAPAY' ? (isAr ? 'انستا باي' : 'InstaPay') : exp.drawer === 'WALLET' ? (isAr ? 'محفظة' : 'Wallet') : (isAr ? 'كاش' : 'Cash')}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-bold text-red-600">{money(exp.amount, currencySymbol, locale)}</td>
                    <td className="px-4 py-4">
                      {exp.reason && <span className="font-medium text-stone-950">{exp.reason}</span>}
                      {exp.recipient && (
                        <div className="mt-1 text-xs text-emerald-700 font-semibold">
                          {isAr ? `إلى: ${exp.recipient}` : `To: ${exp.recipient}`}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-stone-500 font-semibold bg-stone-50">
                      {isAr ? 'لا توجد مصاريف مسجلة تطابق الفلاتر.' : 'No recorded expenses match the current criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Record Expense Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">{isAr ? 'تسجيل حركة مصاريف جديدة' : 'Record Branch Expense'}</h3>
            
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{isAr ? 'تصنيف المصروفات' : 'Expense Category'} *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as any }))}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm text-stone-700"
                >
                  {categoriesList.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{isAr ? 'الدرج المسحوب منه' : 'Source Drawer'} *</label>
                <select
                  value={form.drawer}
                  onChange={(e) => setForm((prev) => ({ ...prev, drawer: e.target.value }))}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm text-stone-700"
                >
                  <option value="CASH">{isAr ? 'كاش (درج الفرع)' : 'Cash (Branch Drawer)'}</option>
                  <option value="INSTAPAY">{isAr ? 'انستا باي (InstaPay)' : 'InstaPay'}</option>
                  <option value="WALLET">{isAr ? 'محفظة إلكترونية (Wallet)' : 'Electronic Wallet'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{isAr ? 'القيمة والمبلغ' : 'Amount'} *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                  placeholder="50"
                />
              </div>

              {form.category === 'TIPS' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{isAr ? 'اسم مستلم الإكرامية' : 'Recipient Name (Tips)'} *</label>
                  <input
                    type="text"
                    required
                    value={form.recipient}
                    onChange={(e) => setForm((prev) => ({ ...prev, recipient: e.target.value }))}
                    className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                    placeholder={isAr ? 'ادخل اسم الشخص' : 'e.g. Mahmoud Ahmed'}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{isAr ? 'البيان والتفاصيل' : 'Reason / Note'}</label>
                <textarea
                  rows={2}
                  value={form.reason}
                  onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                  className="w-full p-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                  placeholder={isAr ? 'السبب أو البيان (اختياري)' : 'Supporting description (optional)'}
                />
              </div>

              {shopType === 'MOTORCYCLE_AND_SPARE_PARTS' && sparePartsShops.length > 0 && (
                <div className="space-y-3 border-t border-stone-100 pt-3">
                  <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.purchaseFromSpareParts}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, purchaseFromSpareParts: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-stone-900">
                      {isAr ? 'شراء من فرع قطع غيار' : 'Purchase from Spare Parts branch'}
                    </span>
                  </label>

                  {form.purchaseFromSpareParts && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                        {isAr ? 'فرع قطع الغيار المورد' : 'Supplier Spare Parts Branch'} *
                      </label>
                      <select
                        value={form.fromBranchId}
                        onChange={(e) => setForm((prev) => ({ ...prev, fromBranchId: e.target.value }))}
                        className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm text-stone-700"
                      >
                        {sparePartsShops.map((shop) => (
                          <option key={shop.id} value={shop.id}>
                            {shop.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
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
                  {isPending ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'حفظ المصروف' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
