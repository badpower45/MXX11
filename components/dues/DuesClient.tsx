'use client';

import { useState, useTransition, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { shortDate, money } from '@/lib/format';
import { useLocalizedPath } from '@/lib/i18n/client';

type InstallmentDue = {
  id: string;
  companyName: string;
  customerName: string;
  customerPhone: string | null;
  pullAmount: string;
  saleAmount: string;
  adminFees: string;
  dueAmount: string;
  pullDate: string;
  saleDate: string;
  dueDate: string;
  isCollected: boolean;
  collectedAt: string | null;
};

type Reservation = {
  id: string;
  customerName: string;
  customerPhone: string | null;
  motorcycleDetails: string;
  depositAmount: string;
  remainingAmount: string;
  totalAmount: string;
  isCompleted: boolean;
  createdAt: string;
  completedAt: string | null;
};

type DuesClientProps = {
  initialInstallmentDues: InstallmentDue[];
  initialReservations: Reservation[];
  currencySymbol: string;
  locale: string;
};

export default function DuesClient({
  initialInstallmentDues,
  initialReservations,
  currencySymbol,
  locale
}: DuesClientProps) {
  const isAr = locale === 'ar';
  const lp = useLocalizedPath();

  const [installmentDues, setInstallmentDues] = useState<InstallmentDue[]>(initialInstallmentDues);
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations);
  
  const [activeTab, setActiveTab] = useState<'installment' | 'reservation'>('installment');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'collected'>('all');
  
  // Modal states
  const [collectModal, setCollectModal] = useState<{ isOpen: boolean; item: InstallmentDue | null }>({
    isOpen: false,
    item: null
  });
  const [completeModal, setCompleteModal] = useState<{ isOpen: boolean; item: Reservation | null }>({
    isOpen: false,
    item: null
  });
  const [createResModal, setCreateResModal] = useState(false);
  
  // Drawer choice for collection
  const [selectedDrawer, setSelectedDrawer] = useState<'DRAWER_CASH' | 'INSTAPAY' | 'WALLET' | 'VISA'>('DRAWER_CASH');
  
  // Create reservation form state
  const [resForm, setResForm] = useState({
    customerName: '',
    customerPhone: '',
    motorcycleDetails: '',
    totalAmount: '',
    depositAmount: '',
    drawerType: 'DRAWER_CASH' as 'DRAWER_CASH' | 'INSTAPAY' | 'WALLET' | 'VISA'
  });

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dictionary for localization
  const t = {
    installmentTab: isAr ? 'مستحقات شركات التقسيط' : 'Installment Dues',
    reservationTab: isAr ? 'حجوزات المكن (المقدمات)' : 'Motorcycle Bookings',
    searchPlaceholder: isAr ? 'البحث بالاسم، الهاتف، أو اسم الشركة...' : 'Search name, phone, or company...',
    all: isAr ? 'الكل' : 'All',
    pending: isAr ? 'معلق / مستحق' : 'Pending',
    collected: isAr ? 'تم التحصيل' : 'Collected',
    completed: isAr ? 'مكتمل' : 'Completed',
    pullDate: isAr ? 'تاريخ السحب' : 'Pull Date',
    saleDate: isAr ? 'تاريخ البيع' : 'Sale Date',
    customer: isAr ? 'العميل' : 'Customer',
    companyName: isAr ? 'مقدم الخدمة' : 'Provider',
    pullAmount: isAr ? 'مبلغ السحب' : 'Pull Amount',
    saleAmount: isAr ? 'سعر التوريد' : 'Supply Price',
    adminFees: isAr ? 'مصاريف إدارية' : 'Admin Fees',
    dueDate: isAr ? 'تاريخ الاستحقاق' : 'Due Date',
    dueAmount: isAr ? 'صافي الاستحقاق' : 'Due Balance',
    status: isAr ? 'الحالة' : 'Status',
    actions: isAr ? 'إجراءات' : 'Actions',
    collectBtn: isAr ? 'تحصيل الدرج' : 'Mark Collected',
    completeResBtn: isAr ? 'تسليم وإكمال' : 'Complete Booking',
    createBooking: isAr ? 'إنشاء حجز جديد' : 'New Booking',
    noDues: isAr ? 'لا توجد مستحقات تطابق البحث.' : 'No dues match the search.',
    noReservations: isAr ? 'لا توجد حجوزات تطابق البحث.' : 'No bookings match the search.',
    
    // Modal Collect
    collectTitle: isAr ? 'تسجيل تحصيل المبلغ إلى الخزينة' : 'Record Collection to Drawer',
    collectMessage: isAr ? 'سيتم وضع هذا المبلغ في الخزنة المحددة وتسجيل الحركة في الجلسة المفتوحة.' : 'This amount will be placed in the selected drawer and logged in the active session.',
    drawerSelect: isAr ? 'اختر الخزنة المستلمة:' : 'Select target drawer:',
    cashDrawer: isAr ? 'كاش (درج الفرع)' : 'Branch Cash Drawer',
    instaPayDrawer: isAr ? 'انستا باي (InstaPay)' : 'InstaPay Drawer',
    walletDrawer: isAr ? 'محفظة إلكترونية (Wallet)' : 'Electronic Wallet',
    visaDrawer: isAr ? 'فيزا (Visa)' : 'Visa Drawer',
    confirm: isAr ? 'تأكيد' : 'Confirm',
    cancel: isAr ? 'إلغاء' : 'Cancel',
    processing: isAr ? 'جاري التنفيذ...' : 'Processing...',
    
    // Modal Reservation
    resCustomerName: isAr ? 'اسم العميل' : 'Customer Name',
    resCustomerPhone: isAr ? 'رقم الهاتف' : 'Customer Phone',
    resMotorcycleDetails: isAr ? 'تفاصيل البند/المؤن المطلوبة' : 'Requested Supplies/Item Details',
    resTotalAmount: isAr ? 'السعر الكلي المقدر' : 'Estimated Total Price',
    resDepositAmount: isAr ? 'المقدم المدفوع (عربون)' : 'Paid Deposit (Araboon)',
    resDrawerType: isAr ? 'خزنة استلام العربون' : 'Deposit Receipt Drawer',
    completeTitle: isAr ? 'تسليم الحجز وتحصيل المتبقي' : 'Complete Booking & Collect Remaining',
    completeMessage: isAr ? 'هل تود إغلاق الحجز وتسجيل تسليم البند للعميل؟ سيتم تحصيل المبلغ المتبقي:' : 'Do you want to close this booking and deliver the item? The remaining balance will be collected:',
    
    // Alarms
    day14Alarm: isAr ? 'إنذار: اليوم 14 من تاريخ البيع (يستحق غداً)' : 'Warning: Day 14 since sale (Due tomorrow)',
    day15Alarm: isAr ? 'متأخر: تجاوز 15 يوماً من تاريخ البيع!' : 'Overdue: Exceeded 15 days since sale!',
    dueStatusPending: isAr ? 'قيد الانتظار' : 'Pending',
    dueStatusWarning: isAr ? 'إنذار استحقاق' : 'Warning Due',
    dueStatusOverdue: isAr ? 'متأخر جداً' : 'Overdue'
  };

  // Date diff for Day 14 alarm
  const getDueAlarmStatus = (saleDateStr: string, isCollected: boolean) => {
    if (isCollected) return 'collected';
    const saleDate = new Date(saleDateStr);
    const now = new Date();
    // Reset hours to compare only days
    saleDate.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - saleDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays >= 15) return 'overdue';
    if (diffDays >= 14) return 'warning';
    return 'pending';
  };

  const getRemainingDays = (saleDateStr: string) => {
    const saleDate = new Date(saleDateStr);
    saleDate.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = today.getTime() - saleDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return 15 - diffDays;
  };

  // Filter & Search Installments
  const filteredInstallments = useMemo(() => {
    return installmentDues.filter((due: InstallmentDue) => {
      const matchesSearch =
        due.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (due.customerPhone && due.customerPhone.includes(searchQuery)) ||
        due.companyName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'pending' && !due.isCollected) ||
        (filterStatus === 'collected' && due.isCollected);
        
      return matchesSearch && matchesStatus;
    });
  }, [installmentDues, searchQuery, filterStatus]);

  // Filter & Search Reservations
  const filteredReservations = useMemo(() => {
    return reservations.filter((res: Reservation) => {
      const matchesSearch =
        res.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (res.customerPhone && res.customerPhone.includes(searchQuery)) ||
        res.motorcycleDetails.toLowerCase().includes(searchQuery.toLowerCase());
        
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'pending' && !res.isCompleted) ||
        (filterStatus === 'collected' && res.isCompleted);
        
      return matchesSearch && matchesStatus;
    });
  }, [reservations, searchQuery, filterStatus]);

  // Handle Mark Collected (Installment Company Due)
  const handleCollect = async () => {
    if (!collectModal.item) return;
    setError('');
    setSuccess('');
    
    startTransition(async () => {
      try {
        const response = await fetch('/api/dues', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: collectModal.item!.id,
            type: 'INSTALLMENT',
            drawerType: selectedDrawer
          })
        });
        
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to update due record.');
        }
        
        // Update local state
        setInstallmentDues((prev) =>
          prev.map((d) =>
            d.id === collectModal.item!.id
              ? { ...d, isCollected: true, collectedAt: new Date().toISOString() }
              : d
          )
        );
        
        setSuccess(isAr ? 'تم تسجيل التحصيل وتحديث الدرج بنجاح!' : 'Collection recorded and drawer updated successfully!');
        setCollectModal({ isOpen: false, item: null });
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  // Handle Complete Reservation
  const handleCompleteReservation = async () => {
    if (!completeModal.item) return;
    setError('');
    setSuccess('');
    
    startTransition(async () => {
      try {
        const response = await fetch('/api/dues', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: completeModal.item!.id,
            type: 'RESERVATION',
            drawerType: Number(completeModal.item!.remainingAmount) > 0 ? selectedDrawer : null
          })
        });
        
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to complete reservation.');
        }
        
        // Update local state
        setReservations((prev) =>
          prev.map((r) =>
            r.id === completeModal.item!.id
              ? { ...r, isCompleted: true, completedAt: new Date().toISOString() }
              : r
          )
        );
        
        setSuccess(isAr ? 'تم تسليم البند وإغلاق الحجز بنجاح!' : 'Booking completed and supply item delivered successfully!');
        setCompleteModal({ isOpen: false, item: null });
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  // Handle Create Reservation
  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!resForm.customerName || !resForm.motorcycleDetails || !resForm.totalAmount || resForm.depositAmount === '') {
      setError(isAr ? 'الرجاء ملء الحقول المطلوبة.' : 'Please fill out all required fields.');
      return;
    }
    
    startTransition(async () => {
      try {
        const response = await fetch('/api/dues', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: resForm.customerName,
            customerPhone: resForm.customerPhone || null,
            motorcycleDetails: resForm.motorcycleDetails,
            totalAmount: Number(resForm.totalAmount),
            depositAmount: Number(resForm.depositAmount),
            drawerType: Number(resForm.depositAmount) > 0 ? resForm.drawerType : null
          })
        });
        
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to create reservation.');
        }
        
        // Add to local state
        setReservations((prev) => [
          {
            ...data.reservation,
            depositAmount: data.reservation.depositAmount.toString(),
            remainingAmount: data.reservation.remainingAmount.toString(),
            totalAmount: data.reservation.totalAmount.toString(),
            createdAt: data.reservation.createdAt,
            completedAt: data.reservation.completedAt
          },
          ...prev
        ]);
        
        setSuccess(isAr ? 'تم إنشاء الحجز وتثبيت العربون بنجاح!' : 'Motorcycle booking created successfully!');
        setCreateResModal(false);
        setResForm({
          customerName: '',
          customerPhone: '',
          motorcycleDetails: '',
          totalAmount: '',
          depositAmount: '',
          drawerType: 'DRAWER_CASH'
        });
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

      {/* Control bar with Tabs and Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex p-1 gap-1 rounded-[22px] border border-stone-200 bg-white/70 backdrop-blur-sm shadow-[0_12px_24px_-16px_rgba(28,25,23,0.15)] max-w-md w-full">
          <button
            onClick={() => {
              setActiveTab('installment');
              setFilterStatus('all');
            }}
            className={`flex-1 px-4 py-2.5 rounded-[18px] text-xs font-bold transition-all duration-200 ${
              activeTab === 'installment'
                ? 'bg-blue-600 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.4)]'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {t.installmentTab}
          </button>
          <button
            onClick={() => {
              setActiveTab('reservation');
              setFilterStatus('all');
            }}
            className={`flex-1 px-4 py-2.5 rounded-[18px] text-xs font-bold transition-all duration-200 ${
              activeTab === 'reservation'
                ? 'bg-blue-600 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.4)]'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {t.reservationTab}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 px-4 rounded-2xl border border-stone-200 bg-white shadow-sm outline-none transition focus:border-blue-500 w-64 text-sm"
          />
          
          {activeTab === 'reservation' && (
            <button
              onClick={() => setCreateResModal(true)}
              className="h-11 px-5 rounded-2xl bg-stone-900 text-white hover:bg-stone-800 transition text-sm font-bold flex items-center gap-2 shadow-[0_12px_24px_-16px_rgba(0,0,0,0.5)]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t.createBooking}
            </button>
          )}
        </div>
      </div>

      {/* Filter Status buttons */}
      <div className="flex items-center gap-2">
        {(['all', 'pending', 'collected'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-full border text-xs font-semibold tracking-wide transition ${
              filterStatus === status
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            {status === 'all' && t.all}
            {status === 'pending' && t.pending}
            {status === 'collected' && (activeTab === 'installment' ? t.collected : t.completed)}
          </button>
        ))}
      </div>

      {/* Main Tables Container */}
      <Card>
        {activeTab === 'installment' ? (
          <div className="overflow-hidden rounded-[26px] border border-stone-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-stone-700">
                <thead className="bg-stone-50 text-stone-500 font-semibold text-xs uppercase tracking-wider border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3.5 text-right">{t.companyName}</th>
                    <th className="px-4 py-3.5 text-right">{t.customer}</th>
                    <th className="px-4 py-3.5 text-right">{t.pullDate}</th>
                    <th className="px-4 py-3.5 text-right">{t.saleDate}</th>
                    <th className="px-4 py-3.5 text-right">{t.pullAmount}</th>
                    <th className="px-4 py-3.5 text-right">{t.saleAmount}</th>
                    <th className="px-4 py-3.5 text-right">{t.adminFees}</th>
                    <th className="px-4 py-3.5 text-right">{t.dueDate}</th>
                    <th className="px-4 py-3.5 text-right">{t.dueAmount}</th>
                    <th className="px-4 py-3.5 text-right">{t.status}</th>
                    <th className="px-4 py-3.5 text-center">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-150">
                  {filteredInstallments.map((due) => {
                    const alarm = getDueAlarmStatus(due.saleDate, due.isCollected);
                    let rowBg = 'bg-white hover:bg-stone-50/70';
                    let alertText = '';
                    
                    if (alarm === 'warning') {
                      rowBg = 'bg-amber-50/70 hover:bg-amber-100/60 border-l-4 border-l-amber-500';
                      alertText = t.day14Alarm;
                    } else if (alarm === 'overdue') {
                      rowBg = 'bg-red-50/70 hover:bg-red-100/60 border-l-4 border-l-red-500';
                      alertText = t.day15Alarm;
                    }
                    
                    return (
                      <tr key={due.id} className={`transition duration-150 ${rowBg}`}>
                        <td className="px-4 py-4 font-semibold text-stone-900">{due.companyName}</td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-stone-900">{due.customerName}</div>
                          {due.customerPhone && <div className="text-xs text-stone-500">{due.customerPhone}</div>}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">{shortDate(due.pullDate, locale)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div>{shortDate(due.saleDate, locale)}</div>
                          {!due.isCollected && (() => {
                            const remaining = getRemainingDays(due.saleDate);
                            let toneClass = 'bg-red-50 text-red-700 border-red-200';
                            if (remaining > 10) {
                              toneClass = 'bg-emerald-50 text-emerald-700 border-emerald-250';
                            } else if (remaining > 5) {
                              toneClass = 'bg-amber-50 text-amber-700 border-amber-200';
                            }
                            return (
                              <div className="mt-1">
                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneClass}`}>
                                  {isAr ? `متبقي ${remaining} يوم` : `${remaining} days left`}
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-4 font-medium">{money(due.pullAmount, currencySymbol, locale)}</td>
                        <td className="px-4 py-4 font-medium">{money(due.saleAmount, currencySymbol, locale)}</td>
                        <td className="px-4 py-4 text-stone-500">{money(due.adminFees, currencySymbol, locale)}</td>
                        <td className="px-4 py-4 whitespace-nowrap font-medium text-stone-900">
                          {shortDate(due.dueDate, locale)}
                          {alertText && (
                            <div className={`mt-1 text-[10px] font-bold ${alarm === 'warning' ? 'text-amber-700' : 'text-red-700'}`}>
                              {alertText}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 font-bold text-stone-900">{money(due.dueAmount, currencySymbol, locale)}</td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          {due.isCollected ? (
                            <Badge tone="emerald">{t.collected}</Badge>
                          ) : alarm === 'overdue' ? (
                            <Badge tone="red">{t.dueStatusOverdue}</Badge>
                          ) : alarm === 'warning' ? (
                            <Badge tone="amber">{t.dueStatusWarning}</Badge>
                          ) : (
                            <Badge tone="stone">{t.dueStatusPending}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          {!due.isCollected ? (
                            <button
                              onClick={() => setCollectModal({ isOpen: true, item: due })}
                              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition duration-150"
                            >
                              {t.collectBtn}
                            </button>
                          ) : (
                            <span className="text-xs text-stone-400">
                              {due.collectedAt ? shortDate(due.collectedAt, locale) : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {filteredInstallments.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-6 py-12 text-center text-stone-500 font-semibold bg-stone-50">
                        {t.noDues}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[26px] border border-stone-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-stone-700">
                <thead className="bg-stone-50 text-stone-500 font-semibold text-xs uppercase tracking-wider border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3.5 text-right">{t.customer}</th>
                    <th className="px-4 py-3.5 text-right">{isAr ? 'البند / الخدمة المطلوبة' : 'Requested Item / Service'}</th>
                    <th className="px-4 py-3.5 text-right">{t.resTotalAmount}</th>
                    <th className="px-4 py-3.5 text-right">{t.resDepositAmount}</th>
                    <th className="px-4 py-3.5 text-right">{isAr ? 'المتبقي' : 'Remaining'}</th>
                    <th className="px-4 py-3.5 text-right">{isAr ? 'تاريخ الحجز' : 'Booking Date'}</th>
                    <th className="px-4 py-3.5 text-right">{t.status}</th>
                    <th className="px-4 py-3.5 text-center">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-150">
                  {filteredReservations.map((res) => (
                    <tr key={res.id} className="bg-white hover:bg-stone-50/70 transition duration-150">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{res.customerName}</div>
                        {res.customerPhone && <div className="text-xs text-stone-500">{res.customerPhone}</div>}
                      </td>
                      <td className="px-4 py-4 font-semibold text-stone-900">{res.motorcycleDetails}</td>
                      <td className="px-4 py-4 font-medium">{money(res.totalAmount, currencySymbol, locale)}</td>
                      <td className="px-4 py-4 text-blue-700 font-semibold">{money(res.depositAmount, currencySymbol, locale)}</td>
                      <td className="px-4 py-4 font-bold text-stone-900">{money(res.remainingAmount, currencySymbol, locale)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{shortDate(res.createdAt, locale)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {res.isCompleted ? (
                          <Badge tone="emerald">{t.completed}</Badge>
                        ) : (
                          <Badge tone="stone">{t.pending}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        {!res.isCompleted ? (
                          <button
                            onClick={() => setCompleteModal({ isOpen: true, item: res })}
                            className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-md transition duration-150"
                          >
                            {t.completeResBtn}
                          </button>
                        ) : (
                          <span className="text-xs text-stone-400">
                            {res.completedAt ? shortDate(res.completedAt, locale) : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  
                  {filteredReservations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-stone-500 font-semibold bg-stone-50">
                        {t.noReservations}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* Collect Modal (Mark Installment Collected) */}
      {collectModal.isOpen && collectModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">{t.collectTitle}</h3>
            <p className="mt-3 text-sm text-stone-600 leading-relaxed">
              {t.collectMessage}
            </p>
            
            <div className="mt-5 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex justify-between items-center text-sm font-semibold">
              <span className="text-stone-600">{t.dueAmount}:</span>
              <span className="text-blue-700 text-lg font-black">{money(collectModal.item.dueAmount, currencySymbol, locale)}</span>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">{t.drawerSelect}</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: 'DRAWER_CASH', label: t.cashDrawer, desc: isAr ? 'الدرج المادي بالمحل' : 'Physical store drawer' },
                  { value: 'INSTAPAY', label: t.instaPayDrawer, desc: isAr ? 'حساب الاستقبال انستا باي' : 'InstaPay account' },
                  { value: 'WALLET', label: t.walletDrawer, desc: isAr ? 'المحفظة الإلكترونية للمحل' : 'Store mobile wallet' },
                  { value: 'VISA', label: t.visaDrawer, desc: isAr ? 'حساب فيزا / بنك' : 'Visa / Bank account' }
                ].map((drawer) => (
                  <label
                    key={drawer.value}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                      selectedDrawer === drawer.value
                        ? 'border-blue-500 bg-blue-50/50'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="drawerType"
                      value={drawer.value}
                      checked={selectedDrawer === drawer.value}
                      onChange={() => setSelectedDrawer(drawer.value as any)}
                      className="accent-blue-600 h-4.5 w-4.5"
                    />
                    <div>
                      <div className="text-sm font-bold text-stone-900">{drawer.label}</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">{drawer.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCollectModal({ isOpen: false, item: null })}
                disabled={isPending}
                className="px-5 py-3 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold transition"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleCollect}
                disabled={isPending}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md"
              >
                {isPending ? t.processing : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Reservation Modal */}
      {completeModal.isOpen && completeModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">{t.completeTitle}</h3>
            <p className="mt-3 text-sm text-stone-600 leading-relaxed">
              {t.completeMessage}
            </p>
            
            <div className="mt-5 p-4 rounded-2xl bg-blue-50 border border-blue-100 flex justify-between items-center text-sm font-semibold">
              <span className="text-stone-600">{isAr ? 'المتبقي للتحصيل:' : 'Remaining to collect:'}</span>
              <span className="text-blue-700 text-lg font-black">{money(completeModal.item.remainingAmount, currencySymbol, locale)}</span>
            </div>

            {Number(completeModal.item.remainingAmount) > 0 && (
              <div className="mt-5 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">{t.drawerSelect}</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { value: 'DRAWER_CASH', label: t.cashDrawer, desc: isAr ? 'الدرج المادي بالمحل' : 'Physical store drawer' },
                    { value: 'INSTAPAY', label: t.instaPayDrawer, desc: isAr ? 'حساب الاستقبال انستا باي' : 'InstaPay account' },
                    { value: 'WALLET', label: t.walletDrawer, desc: isAr ? 'المحفظة الإلكترونية للمحل' : 'Store mobile wallet' },
                    { value: 'VISA', label: t.visaDrawer, desc: isAr ? 'حساب فيزا / بنك' : 'Visa / Bank account' }
                  ].map((drawer) => (
                    <label
                      key={drawer.value}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                        selectedDrawer === drawer.value
                          ? 'border-blue-500 bg-blue-50/50'
                          : 'border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="completeDrawerType"
                        value={drawer.value}
                        checked={selectedDrawer === drawer.value}
                        onChange={() => setSelectedDrawer(drawer.value as any)}
                        className="accent-blue-600 h-4.5 w-4.5"
                      />
                      <div>
                        <div className="text-sm font-bold text-stone-900">{drawer.label}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5">{drawer.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCompleteModal({ isOpen: false, item: null })}
                disabled={isPending}
                className="px-5 py-3 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold transition"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleCompleteReservation}
                disabled={isPending}
                className="px-6 py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold transition shadow-md"
              >
                {isPending ? t.processing : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Reservation Modal */}
      {createResModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="w-full max-w-lg rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8 my-8">
            <h3 className="text-xl font-black text-stone-900">{isAr ? 'إنشاء حجز مؤن/خدمات غير متوفرة' : 'Create Booking for Unavailable Supplies/Services'}</h3>
            
            <form onSubmit={handleCreateReservation} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{t.resCustomerName} *</label>
                <input
                  type="text"
                  required
                  value={resForm.customerName}
                  onChange={(e) => setResForm((prev) => ({ ...prev, customerName: e.target.value }))}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                  placeholder={isAr ? 'مثال: محمد أحمد علي' : 'e.g. John Doe'}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{t.resCustomerPhone}</label>
                <input
                  type="text"
                  value={resForm.customerPhone}
                  onChange={(e) => setResForm((prev) => ({ ...prev, customerPhone: e.target.value }))}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm text-left"
                  placeholder="01234567890"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{t.resMotorcycleDetails} *</label>
                <textarea
                  required
                  rows={2}
                  value={resForm.motorcycleDetails}
                  onChange={(e) => setResForm((prev) => ({ ...prev, motorcycleDetails: e.target.value }))}
                  className="w-full p-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                  placeholder={isAr ? 'مثال: قطع غيار محرك سفينة موديل 2026' : 'e.g. Marine engine spare parts model 2026'}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{t.resTotalAmount} *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={resForm.totalAmount}
                    onChange={(e) => setResForm((prev) => ({ ...prev, totalAmount: e.target.value }))}
                    className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                    placeholder="45000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{t.resDepositAmount} *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={resForm.depositAmount}
                    onChange={(e) => setResForm((prev) => ({ ...prev, depositAmount: e.target.value }))}
                    className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                    placeholder="5000"
                  />
                </div>
              </div>

              {Number(resForm.depositAmount) > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">{t.resDrawerType}</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { value: 'DRAWER_CASH', label: isAr ? 'كاش' : 'Cash' },
                      { value: 'INSTAPAY', label: 'InstaPay' },
                      { value: 'WALLET', label: isAr ? 'محفظة' : 'Wallet' },
                      { value: 'VISA', label: isAr ? 'فيزا' : 'Visa' }
                    ].map((drawer) => (
                      <label
                        key={drawer.value}
                        className={`flex items-center justify-center p-3 rounded-2xl border cursor-pointer text-xs font-bold transition ${
                          resForm.drawerType === drawer.value
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-stone-200 hover:bg-stone-50 text-stone-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name="formDrawerType"
                          value={drawer.value}
                          checked={resForm.drawerType === drawer.value}
                          onChange={() => setResForm((prev) => ({ ...prev, drawerType: drawer.value as any }))}
                          className="sr-only"
                        />
                        {drawer.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateResModal(false)}
                  disabled={isPending}
                  className="px-5 py-3 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold transition"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md"
                >
                  {isPending ? t.processing : isAr ? 'حفظ الحجز' : 'Save Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
