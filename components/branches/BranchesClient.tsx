'use client';

import { useState, useTransition } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

type Branch = {
  id: string;
  name: string;
  slug: string;
  posType: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  role: string;
};

type BranchesClientProps = {
  initialBranches: Branch[];
  locale: string;
  role: string;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10';

export default function BranchesClient({ initialBranches, locale, role }: BranchesClientProps) {
  const t = useTranslations('branches');
  const tRoles = useTranslations('roles');
  const isAr = locale === 'ar';
  const lp = useLocalizedPath();

  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [form, setForm] = useState({
    name: '',
    legalBusinessName: '',
    posType: 'MOTORCYCLE_AND_SPARE_PARTS',
    phone: '',
    email: '',
    address: '',
    timezone: 'Africa/Cairo',
    currencyCode: 'EGP',
    currencySymbol: 'ج.م ',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
    adminPin: '',
    createLinkedSpareParts: false,
    linkedShopId: ''
  });
  const [sparePartsMode, setSparePartsMode] = useState<'none' | 'create' | 'link'>('none');
  const [activeTab, setActiveTab] = useState<'motorcycle' | 'spare_parts'>('motorcycle');

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canManage = role === 'ADMIN' || role === 'MANAGER';

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError(isAr ? 'الرجاء إدخال اسم الفرع.' : 'Branch name is required.');
      return;
    }

    if (activeTab === 'motorcycle' && sparePartsMode === 'link' && !form.linkedShopId) {
      setError(isAr ? 'الرجاء اختيار محل قطع الغيار للمطابقة.' : 'Please select a spare parts shop to link.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            posType: activeTab === 'motorcycle' ? 'MOTORCYCLE_AND_SPARE_PARTS' : 'SPARE_PARTS_ONLY',
            name: form.name.trim(),
            createLinkedSpareParts: activeTab === 'motorcycle' && sparePartsMode === 'create',
            linkedShopId: activeTab === 'motorcycle' && sparePartsMode === 'link' ? form.linkedShopId : null
          })
        });

        const data = await response.json().catch(() => ({ error: 'Connection error' }));

        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to create branch.');
        }

        // Add to local state
        setBranches((prev) => [
          ...prev,
          {
            id: data.branch.id,
            name: data.branch.name,
            slug: data.branch.slug,
            posType: data.branch.posType,
            phone: data.branch.phone,
            email: data.branch.email,
            address: data.branch.address,
            role: 'ADMIN' // The creator automatically gets ADMIN role
          }
        ]);

        setSuccess(isAr ? 'تم إنشاء الفرع بنجاح! يمكنك الآن الانتقال إليه من القائمة الجانبية.' : 'Branch created successfully! You can switch to it from the sidebar.');
        setForm({
          name: '',
          legalBusinessName: '',
          posType: 'MOTORCYCLE_AND_SPARE_PARTS',
          phone: '',
          email: '',
          address: '',
          timezone: 'Africa/Cairo',
          currencyCode: 'EGP',
          currencySymbol: 'ج.م ',
          adminName: '',
          adminEmail: '',
          adminPassword: '',
          adminPin: '',
          createLinkedSpareParts: false,
          linkedShopId: ''
        });
        setSparePartsMode('none');
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  }

  function getShopTypeLabel(type: string) {
    if (type === 'MOTORCYCLE_AND_SPARE_PARTS') {
      return isAr ? 'محل مكن وقطع غيار' : 'Motorcycles & Spare Parts';
    }
    if (type === 'SPARE_PARTS_ONLY') {
      return isAr ? 'محل قطع غيار فقط' : 'Spare Parts Only';
    }
    return type;
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form component */}
        {canManage && (
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div>
                <h2 className="text-xl font-black text-stone-900">{isAr ? 'إنشاء فرع جديد' : 'New Branch Setup'}</h2>
                <p className="mt-1 text-sm text-stone-600">{isAr ? 'أدخل تفاصيل الفرع الجديد وسيتم توليد الإعدادات التلقائية له.' : 'Enter details of the new branch. Operating defaults will be set automatically.'}</p>
              </div>

            <div className="flex border-b border-stone-200 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab('motorcycle')}
                className={`py-3 px-5 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'motorcycle'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}
              >
                {isAr ? 'مكتب عمليات ومؤن بحرية' : 'Operations & Chandlery Office'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('spare_parts')}
                className={`py-3 px-5 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'spare_parts'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-stone-500 hover:text-stone-700'
                }`}
              >
                {isAr ? 'مخزن مستقل / مكتب فرعي' : 'Independent Warehouse / Sub-office'}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm block md:col-span-2">
                  <div className="font-semibold text-stone-700">{isAr ? 'اسم الفرع *' : 'Branch Name *'}</div>
                  <Input
                    required
                    placeholder={isAr ? 'مثال: فرع التجمع' : 'e.g. New Cairo Branch'}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </label>

                  <label className="space-y-2 text-sm block">
                    <div className="font-semibold text-stone-700">{isAr ? 'الاسم التجاري القانوني' : 'Legal Business Name'}</div>
                    <Input
                      placeholder={isAr ? 'شركة سي ويز للخدمات الملاحية' : 'e.g. Seaways Marine Services Co.'}
                      value={form.legalBusinessName}
                      onChange={(e) => setForm((prev) => ({ ...prev, legalBusinessName: e.target.value }))}
                    />
                  </label>

                  <label className="space-y-2 text-sm block">
                    <div className="font-semibold text-stone-700">{isAr ? 'رقم الهاتف' : 'Phone'}</div>
                    <Input
                      placeholder="+201000111222"
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </label>

                  <label className="space-y-2 text-sm block">
                    <div className="font-semibold text-stone-700">{isAr ? 'البريد الإلكتروني' : 'Email'}</div>
                    <Input
                      type="email"
                      placeholder="branch@example.com"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </label>

                  <label className="space-y-2 text-sm block">
                    <div className="font-semibold text-stone-700">{isAr ? 'المنطقة الزمنية' : 'Timezone'}</div>
                    <Input
                      value={form.timezone}
                      onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
                    />
                  </label>

                  <label className="space-y-2 text-sm block">
                    <div className="font-semibold text-stone-700">{isAr ? 'رمز العملة' : 'Currency Code'}</div>
                    <Input
                      placeholder="EGP"
                      value={form.currencyCode}
                      onChange={(e) => setForm((prev) => ({ ...prev, currencyCode: e.target.value }))}
                    />
                  </label>

                  <label className="space-y-2 text-sm block">
                    <div className="font-semibold text-stone-700">{isAr ? 'علامة العملة' : 'Currency Symbol'}</div>
                    <Input
                      placeholder="ج.م "
                      value={form.currencySymbol}
                      onChange={(e) => setForm((prev) => ({ ...prev, currencySymbol: e.target.value }))}
                    />
                  </label>

                  <label className="space-y-2 text-sm block md:col-span-2">
                    <div className="font-semibold text-stone-700">{isAr ? 'العنوان بالتفصيل' : 'Detailed Address'}</div>
                    <Input
                      placeholder={isAr ? 'شارع التسعين، التجمع الخامس، القاهرة' : 'e.g. 90th Street, Fifth Settlement, Cairo'}
                      value={form.address}
                      onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                    />
                  </label>

                  {activeTab === 'motorcycle' && (
                    <div className="md:col-span-2 border-t border-stone-100 pt-3 space-y-3">
                      <div className="font-semibold text-stone-700 text-sm">{isAr ? 'ربط قطع الغيار' : 'Spare Parts Link'}</div>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sparePartsMode"
                            value="none"
                            checked={sparePartsMode === 'none'}
                            onChange={() => setSparePartsMode('none')}
                            className="h-4 w-4 text-blue-600 border-stone-300 focus:ring-blue-500"
                          />
                          <span>{isAr ? 'لا يوجد ربط' : 'No link'}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sparePartsMode"
                            value="create"
                            checked={sparePartsMode === 'create'}
                            onChange={() => setSparePartsMode('create')}
                            className="h-4 w-4 text-blue-600 border-stone-300 focus:ring-blue-500"
                          />
                          <span>{isAr ? 'إنشاء محل قطع غيار جديد مرتبط' : 'Create new linked Spare Parts shop'}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sparePartsMode"
                            value="link"
                            checked={sparePartsMode === 'link'}
                            onChange={() => setSparePartsMode('link')}
                            className="h-4 w-4 text-blue-600 border-stone-300 focus:ring-blue-500"
                          />
                          <span>{isAr ? 'ربط بمحل قطع غيار موجود' : 'Link to an existing Spare Parts shop'}</span>
                        </label>
                      </div>

                      {sparePartsMode === 'link' && (
                        <div className="mt-2 space-y-2">
                          <div className="font-semibold text-stone-600 text-xs">{isAr ? 'اختر محل قطع الغيار المتاح *' : 'Select Available Spare Parts Shop *'}</div>
                          <select
                            className={selectClassName}
                            value={form.linkedShopId}
                            onChange={(e) => setForm((prev) => ({ ...prev, linkedShopId: e.target.value }))}
                          >
                            <option value="">{isAr ? '-- اختر المحل --' : '-- Select Shop --'}</option>
                            {branches
                              .filter((b) => b.posType === 'SPARE_PARTS_ONLY')
                              .map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="md:col-span-2 border-t border-stone-150 pt-4 mt-2">
                    <h3 className="text-sm font-bold text-stone-900 mb-3">
                      {isAr ? 'حساب أدمن للفرع الجديد (اختياري)' : 'New Branch Admin Account (Optional)'}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm block">
                        <div className="font-semibold text-stone-700">{isAr ? 'اسم الأدمن' : 'Admin Name'}</div>
                        <Input
                          placeholder={isAr ? 'مثال: أحمد محمد' : 'e.g. Ahmed Mohamed'}
                          value={form.adminName}
                          onChange={(e) => setForm((prev) => ({ ...prev, adminName: e.target.value }))}
                        />
                      </label>

                      <label className="space-y-2 text-sm block">
                        <div className="font-semibold text-stone-700">{isAr ? 'البريد الإلكتروني للأدمن' : 'Admin Email'}</div>
                        <Input
                          type="email"
                          placeholder="admin@example.com"
                          value={form.adminEmail}
                          onChange={(e) => setForm((prev) => ({ ...prev, adminEmail: e.target.value }))}
                        />
                      </label>

                      <label className="space-y-2 text-sm block">
                        <div className="font-semibold text-stone-700">{isAr ? 'كلمة مرور الأدمن' : 'Admin Password'}</div>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={form.adminPassword}
                          onChange={(e) => setForm((prev) => ({ ...prev, adminPassword: e.target.value }))}
                        />
                      </label>

                      <label className="space-y-2 text-sm block">
                        <div className="font-semibold text-stone-700">{isAr ? 'رمز الكاشير السريع (PIN)' : 'Quick Login PIN'}</div>
                        <Input
                          type="password"
                          maxLength={6}
                          placeholder="1234"
                          value={form.adminPin}
                          onChange={(e) => setForm((prev) => ({ ...prev, adminPin: e.target.value }))}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button type="submit" disabled={isPending}>
                    {isPending ? (isAr ? 'جاري الإنشاء...' : 'Creating...') : (isAr ? 'حفظ الفرع الجديد' : 'Save New Branch')}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Branches list sidebar */}
        <div className={canManage ? "space-y-6" : "lg:col-span-3 space-y-6"}>
          <Card>
            <div>
              <h2 className="text-xl font-black text-stone-900">{isAr ? 'الفروع الحالية' : 'Current Branches'}</h2>
              <p className="mt-1 text-sm text-stone-600">{isAr ? 'الفروع التي تمتلك صلاحية الدخول عليها.' : 'Branches you have access to.'}</p>
            </div>

            <div className="mt-6 space-y-4">
              {branches.map((branch) => (
                <div key={branch.id} className="rounded-2xl border border-stone-200 bg-stone-50/50 p-4 transition hover:bg-white hover:shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-stone-950">{branch.name}</span>
                    <Badge tone={branch.role === 'ADMIN' ? 'emerald' : 'blue'}>
                      {tRoles(branch.role).startsWith('roles.') ? branch.role : tRoles(branch.role)}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-stone-500">
                    <div>{isAr ? 'نوع الفرع:' : 'Type:'} <span className="font-semibold text-stone-700">{getShopTypeLabel(branch.posType)}</span></div>
                    {branch.phone && <div className="mt-1">{isAr ? 'الهاتف:' : 'Phone:'} {branch.phone}</div>}
                    {branch.address && <div className="mt-1">{isAr ? 'العنوان:' : 'Address:'} {branch.address}</div>}
                  </div>
                </div>
              ))}

              {branches.length === 0 && (
                <div className="py-6 text-center text-sm font-semibold text-stone-500">
                  {isAr ? 'لا توجد فروع مضافة حالياً.' : 'No branches added.'}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
