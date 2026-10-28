'use client';

import { useState, useTransition, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { shortDate, money } from '@/lib/format';

type TrafficInvoice = {
  id: string;
  shopId: string;
  saleId: string;
  customerName: string;
  status: 'PENDING_SEND' | 'IN_TRANSIT' | 'DELIVERED';
  transportCost: string;
  cairoReceiptCost: string;
  deliveryFeeCollected: string;
  createdAt: string;
  updatedAt: string;
  receivedAtCairo: string | null;
  deliveredToCustomerAt: string | null;
  sale: {
    saleNumber: string;
    createdAt: string;
  };
};

type TrafficClientProps = {
  initialInvoices: TrafficInvoice[];
  currencySymbol: string;
  locale: string;
};

export default function TrafficClient({
  initialInvoices,
  currencySymbol,
  locale
}: TrafficClientProps) {
  const isAr = locale === 'ar';

  const [invoices, setInvoices] = useState<TrafficInvoice[]>(initialInvoices);
  const [activeTab, setActiveTab] = useState<'pending_send' | 'in_transit' | 'delivered' | 'history'>('pending_send');
  
  // Search and date filters
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Transition modals
  const [sendModal, setSendModal] = useState<{ isOpen: boolean; item: TrafficInvoice | null }>({
    isOpen: false,
    item: null
  });
  const [receiveModal, setReceiveModal] = useState<{ isOpen: boolean; item: TrafficInvoice | null }>({
    isOpen: false,
    item: null
  });
  const [deliverModal, setDeliverModal] = useState<{ isOpen: boolean; item: TrafficInvoice | null }>({
    isOpen: false,
    item: null
  });

  // Modal form states
  const [transportCostInput, setTransportCostInput] = useState('');
  const [cairoReceiptCostInput, setCairoReceiptCostInput] = useState('');
  const [deliveryFeeSelected, setDeliveryFeeSelected] = useState<number>(100);
  const [selectedDrawer, setSelectedDrawer] = useState<'DRAWER_CASH' | 'INSTAPAY' | 'WALLET' | 'VISA'>('DRAWER_CASH');

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkModal, setBulkModal] = useState<{ isOpen: boolean; status: 'IN_TRANSIT' | 'DELIVERED' | '' }>({
    isOpen: false,
    status: ''
  });
  const [bulkCostInput, setBulkCostInput] = useState('');
  const [bulkDrawerSelected, setBulkDrawerSelected] = useState<'DRAWER_CASH' | 'INSTAPAY' | 'WALLET' | 'VISA'>('DRAWER_CASH');

  // Filter local state
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Tab filter
      const matchesTab =
        (activeTab === 'pending_send' && inv.status === 'PENDING_SEND') ||
        (activeTab === 'in_transit' && inv.status === 'IN_TRANSIT') ||
        (activeTab === 'delivered' && inv.status === 'DELIVERED' && !inv.deliveredToCustomerAt) ||
        (activeTab === 'history' && inv.deliveredToCustomerAt !== null);

      if (!matchesTab) return false;

      // Search query
      const matchesSearch =
        inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.sale.saleNumber.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Date range on creation date (sale date)
      let matchesDate = true;
      if (fromDate) {
        const fDate = new Date(fromDate);
        fDate.setHours(0,0,0,0);
        const itemDate = new Date(inv.createdAt);
        matchesDate = matchesDate && itemDate >= fDate;
      }
      if (toDate) {
        const tDate = new Date(toDate);
        tDate.setHours(23,59,59,999);
        const itemDate = new Date(inv.createdAt);
        matchesDate = matchesDate && itemDate <= tDate;
      }

      return matchesDate;
    });
  }, [invoices, activeTab, searchQuery, fromDate, toDate]);

  const isAllSelected = useMemo(() => {
    if (filteredInvoices.length === 0) return false;
    return filteredInvoices.every((inv) => selectedIds.includes(inv.id));
  }, [filteredInvoices, selectedIds]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      const idsToKeep = selectedIds.filter((id) => !filteredInvoices.some((inv) => inv.id === id));
      setSelectedIds(idsToKeep);
    } else {
      const currentTabIds = filteredInvoices.map((inv) => inv.id);
      setSelectedIds([...new Set([...selectedIds, ...currentTabIds])]);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkSubmit = async () => {
    if (selectedIds.length === 0 || !bulkModal.status) return;
    setError('');
    setSuccess('');
    const cost = Number(bulkCostInput || 0);

    startTransition(async () => {
      try {
        const response = await fetch('/api/traffic/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: selectedIds,
            status: bulkModal.status,
            totalCost: cost,
            drawerType: bulkDrawerSelected
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to complete bulk update.');
        }

        const costPerInvoice = (cost / selectedIds.length).toString();
        setInvoices((prev) =>
          prev.map((i) => {
            if (selectedIds.includes(i.id)) {
              if (bulkModal.status === 'IN_TRANSIT') {
                return {
                  ...i,
                  status: 'IN_TRANSIT',
                  transportCost: costPerInvoice
                };
              } else if (bulkModal.status === 'DELIVERED') {
                return {
                  ...i,
                  status: 'DELIVERED',
                  cairoReceiptCost: costPerInvoice,
                  receivedAtCairo: new Date().toISOString()
                };
              }
            }
            return i;
          })
        );

        setSuccess(
          isAr
            ? `تم تحديث عدد ${selectedIds.length} فاتورة بنجاح وتوزيع تكلفة إجمالية ${cost} ج.م!`
            : `Successfully updated ${selectedIds.length} invoices with total cost of ${cost} EGP!`
        );
        setSelectedIds([]);
        setBulkModal({ isOpen: false, status: '' });
        setBulkCostInput('');
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  // Dictionary for localization
  const t = {
    tabPendingSend: isAr ? 'فواتير قيد الإرسال' : 'Pending Send',
    tabInTransit: isAr ? 'استلام القاهرة' : 'Cairo Transit',
    tabDelivered: isAr ? 'جاهزة للتسليم' : 'Ready for Customer',
    tabHistory: isAr ? 'سجل الفواتير المسلمة' : 'Delivered History',
    searchPlaceholder: isAr ? 'ابحث باسم العميل أو رقم الفاتورة...' : 'Search customer or invoice...',
    fromDateLabel: isAr ? 'من تاريخ:' : 'From Date:',
    toDateLabel: isAr ? 'إلى تاريخ:' : 'To Date:',
    clearFilters: isAr ? 'تصفية الفلاتر' : 'Clear Filters',
    customer: isAr ? 'العميل' : 'Customer',
    invoiceNumber: isAr ? 'رقم الفاتورة' : 'Invoice Ref',
    saleDate: isAr ? 'تاريخ البيع' : 'Sale Date',
    transportCost: isAr ? 'تكلفة النقل' : 'Transport Cost',
    cairoCost: isAr ? 'تكاليف القاهرة' : 'Cairo Costs',
    collectedFee: isAr ? 'المبلغ المحصل' : 'Collected Fee',
    status: isAr ? 'الحالة' : 'Status',
    actions: isAr ? 'إجراءات' : 'Actions',
    noInvoices: isAr ? 'لا توجد فواتير مرور تطابق البحث.' : 'No traffic invoices match the filters.',
    alarm15Days: isAr ? 'إنذار: مضى أكثر من 15 يوماً ولم تصل للتسليم!' : 'Warning: Exceeded 15 days since sale!',

    // Actions
    sendBtn: isAr ? 'إرسال للقاهرة' : 'Send to Cairo',
    receiveBtn: isAr ? 'استلام من القاهرة' : 'Receive from Cairo',
    deliverBtn: isAr ? 'تسليم للعميل' : 'Deliver to Customer',

    // Modals
    sendTitle: isAr ? 'إرسال الفاتورة للقاهرة وتحديد تكلفة النقل' : 'Send to Cairo & Set Transport Cost',
    sendConfirm: isAr ? 'تسجيل الإرسال' : 'Confirm Send',
    transportPlaceholder: isAr ? 'ادخل تكلفة النقل بالجنيه' : 'Enter transport cost in EGP',
    
    receiveTitle: isAr ? 'استلام الفاتورة وتحديد التكاليف الكلية' : 'Receive & Set Cairo Costs',
    receiveConfirm: isAr ? 'تسجيل الاستلام' : 'Confirm Receipt',
    cairoCostPlaceholder: isAr ? 'ادخل تكاليف استلام القاهرة بالجنيه' : 'Enter Cairo receipt costs',
    
    deliverTitle: isAr ? 'تسليم الفاتورة للعميل وتحصيل الرسوم' : 'Deliver Invoice & Collect Fees',
    deliverConfirm: isAr ? 'تسجيل التسليم' : 'Confirm Delivery',
    feeSelect: isAr ? 'المبلغ المستلم من العميل:' : 'Delivery fee received from customer:',
    drawerSelect: isAr ? 'اختر درج إيداع المبلغ:' : 'Select deposit drawer:',
    
    cashDrawer: isAr ? 'كاش (درج الفرع)' : 'Branch Cash Drawer',
    instaPayDrawer: isAr ? 'انستا باي (InstaPay)' : 'InstaPay Drawer',
    walletDrawer: isAr ? 'محفظة إلكترونية (Wallet)' : 'Electronic Wallet',
    visaDrawer: isAr ? 'فيزا (Visa)' : 'Visa Drawer',
    cancel: isAr ? 'إلغاء' : 'Cancel',
    processing: isAr ? 'جاري التنفيذ...' : 'Processing...'
  };

  // Check 15-day alarm
  const isInvoiceExceeding15Days = (createdAtStr: string, status: string, deliveredAt: string | null) => {
    if (status === 'DELIVERED' && deliveredAt !== null) return false;
    const createdDate = new Date(createdAtStr);
    const today = new Date();
    // Reset hours to compare only days
    createdDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);
    
    const diffTime = today.getTime() - createdDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays >= 15;
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



  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      pending_send: invoices.filter((inv) => inv.status === 'PENDING_SEND').length,
      in_transit: invoices.filter((inv) => inv.status === 'IN_TRANSIT').length,
      delivered: invoices.filter((inv) => inv.status === 'DELIVERED' && !inv.deliveredToCustomerAt).length,
      history: invoices.filter((inv) => inv.deliveredToCustomerAt !== null).length
    };
  }, [invoices]);

  // Actions transitions
  const handleSendToCairo = async () => {
    if (!sendModal.item) return;
    setError('');
    setSuccess('');
    const cost = Number(transportCostInput || 0);

    startTransition(async () => {
      try {
        const response = await fetch('/api/traffic', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: sendModal.item!.id,
            status: 'IN_TRANSIT',
            transportCost: cost
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to update traffic invoice.');
        }

        // Update local state
        setInvoices((prev) =>
          prev.map((i) =>
            i.id === sendModal.item!.id
              ? { ...i, status: 'IN_TRANSIT', transportCost: cost.toString() }
              : i
          )
        );

        setSuccess(isAr ? 'تم تسجيل إرسال الفاتورة للقاهرة وتثبيت تكلفة النقل بنجاح!' : 'Invoice sent to Cairo, transport cost registered!');
        setSendModal({ isOpen: false, item: null });
        setTransportCostInput('');
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  const handleReceiveFromCairo = async () => {
    if (!receiveModal.item) return;
    setError('');
    setSuccess('');
    const cost = Number(cairoReceiptCostInput || 0);

    startTransition(async () => {
      try {
        const response = await fetch('/api/traffic', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: receiveModal.item!.id,
            status: 'DELIVERED',
            cairoReceiptCost: cost
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to update traffic invoice.');
        }

        // Update local state
        setInvoices((prev) =>
          prev.map((i) =>
            i.id === receiveModal.item!.id
              ? {
                  ...i,
                  status: 'DELIVERED',
                  cairoReceiptCost: cost.toString(),
                  receivedAtCairo: new Date().toISOString()
                }
              : i
          )
        );

        setSuccess(isAr ? 'تم استلام الفاتورة وتثبيت تكاليف القاهرة الكلية بنجاح!' : 'Invoice received from Cairo, costs registered!');
        setReceiveModal({ isOpen: false, item: null });
        setCairoReceiptCostInput('');
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  const handleDeliverToCustomer = async () => {
    if (!deliverModal.item) return;
    setError('');
    setSuccess('');

    startTransition(async () => {
      try {
        const response = await fetch('/api/traffic', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: deliverModal.item!.id,
            status: 'COMPLETED',
            deliveryFeeCollected: deliveryFeeSelected,
            drawerType: deliveryFeeSelected > 0 ? selectedDrawer : null
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to complete delivery.');
        }

        // Update local state
        setInvoices((prev) =>
          prev.map((i) =>
            i.id === deliverModal.item!.id
              ? {
                  ...i,
                  deliveryFeeCollected: deliveryFeeSelected.toString(),
                  deliveredToCustomerAt: new Date().toISOString()
                }
              : i
          )
        );

        setSuccess(isAr ? 'تم تسليم ورقة المرور للعميل وتغذية الرصيد للدرج بنجاح!' : 'License document delivered to customer successfully!');
        setDeliverModal({ isOpen: false, item: null });
        setDeliveryFeeSelected(100);
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

      {/* Search and Date Range bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end justify-between bg-white/50 backdrop-blur-sm p-4 rounded-[26px] border border-stone-200 shadow-[0_12px_24px_-16px_rgba(28,25,23,0.1)]">
        <div className="flex-1 space-y-1.5">
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">{isAr ? 'البحث عن الفاتورة' : 'Search Invoices'}</label>
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 px-4 rounded-2xl border border-stone-200 bg-white shadow-sm outline-none transition focus:border-blue-500 w-full text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">{t.fromDateLabel}</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-11 px-4 rounded-2xl border border-stone-200 bg-white shadow-sm outline-none text-sm text-stone-700"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">{t.toDateLabel}</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-11 px-4 rounded-2xl border border-stone-200 bg-white shadow-sm outline-none text-sm text-stone-700"
            />
          </div>

          {(fromDate || toDate || searchQuery) && (
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
                setSearchQuery('');
              }}
              className="h-11 px-4 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-600 transition text-xs font-bold mt-5 md:mt-0"
            >
              {t.clearFilters}
            </button>
          )}
        </div>
      </div>

      {/* Tabs list with counts */}
      <div className="flex p-1 gap-1 rounded-[22px] border border-stone-200 bg-white/70 backdrop-blur-sm shadow-[0_12px_24px_-16px_rgba(28,25,23,0.15)] max-w-2xl w-full">
        <button
          onClick={() => { setActiveTab('pending_send'); setSelectedIds([]); }}
          className={`flex-1 px-3 py-2.5 rounded-[18px] text-xs font-bold transition-all duration-200 ${
            activeTab === 'pending_send'
              ? 'bg-blue-600 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.4)]'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          {t.tabPendingSend} ({tabCounts.pending_send})
        </button>
        <button
          onClick={() => { setActiveTab('in_transit'); setSelectedIds([]); }}
          className={`flex-1 px-3 py-2.5 rounded-[18px] text-xs font-bold transition-all duration-200 ${
            activeTab === 'in_transit'
              ? 'bg-blue-600 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.4)]'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          {t.tabInTransit} ({tabCounts.in_transit})
        </button>
        <button
          onClick={() => { setActiveTab('delivered'); setSelectedIds([]); }}
          className={`flex-1 px-3 py-2.5 rounded-[18px] text-xs font-bold transition-all duration-200 ${
            activeTab === 'delivered'
              ? 'bg-blue-600 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.4)]'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          {t.tabDelivered} ({tabCounts.delivered})
        </button>
        <button
          onClick={() => { setActiveTab('history'); setSelectedIds([]); }}
          className={`flex-1 px-3 py-2.5 rounded-[18px] text-xs font-bold transition-all duration-200 ${
            activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.4)]'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          {t.tabHistory} ({tabCounts.history})
        </button>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-4 rounded-[26px] shadow-sm animate-fade-in">
          <div className="text-sm font-bold text-blue-900">
            {isAr
              ? `تم تحديد عدد ${selectedIds.length} فاتورة`
              : `Selected ${selectedIds.length} invoices`}
          </div>
          <button
            onClick={() =>
              setBulkModal({
                isOpen: true,
                status: activeTab === 'pending_send' ? 'IN_TRANSIT' : 'DELIVERED'
              })
            }
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition duration-150"
          >
            {activeTab === 'pending_send' ? t.sendBtn : t.receiveBtn}
          </button>
        </div>
      )}

      {/* Main Table */}
      <Card>
        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-stone-700">
              <thead className="bg-stone-50 text-stone-500 font-semibold text-xs uppercase tracking-wider border-b border-stone-200">
                <tr>
                  {(activeTab === 'pending_send' || activeTab === 'in_transit') && (
                    <th className="px-4 py-3.5 text-center w-12">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="rounded border-stone-300 accent-blue-600 h-4 w-4 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3.5 text-right">{t.customer}</th>
                  <th className="px-4 py-3.5 text-right">{t.invoiceNumber}</th>
                  <th className="px-4 py-3.5 text-right">{t.saleDate}</th>
                  
                  {activeTab !== 'pending_send' && (
                    <th className="px-4 py-3.5 text-right">{t.transportCost}</th>
                  )}
                  {activeTab !== 'pending_send' && activeTab !== 'in_transit' && (
                    <th className="px-4 py-3.5 text-right">{t.cairoCost}</th>
                  )}
                  {activeTab === 'history' && (
                    <th className="px-4 py-3.5 text-right">{t.collectedFee}</th>
                  )}
                  
                  <th className="px-4 py-3.5 text-right">{t.status}</th>
                  <th className="px-4 py-3.5 text-center">{t.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-150">
                {filteredInvoices.map((inv) => {
                  const hasAlarm = isInvoiceExceeding15Days(inv.createdAt, inv.status, inv.deliveredToCustomerAt);
                  let rowBg = 'bg-white hover:bg-stone-50/70';
                  
                  if (hasAlarm) {
                    rowBg = 'bg-red-50/70 hover:bg-red-100/60 border-l-4 border-l-red-500';
                  }

                  return (
                    <tr key={inv.id} className={`transition duration-150 ${rowBg}`}>
                      {(activeTab === 'pending_send' || activeTab === 'in_transit') && (
                        <td className="px-4 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(inv.id)}
                            onChange={() => toggleSelectRow(inv.id)}
                            className="rounded border-stone-300 accent-blue-600 h-4 w-4 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-4 py-4 font-semibold text-stone-900">{inv.customerName}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-blue-700">{inv.sale.saleNumber}</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">{inv.id}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>{shortDate(inv.sale.createdAt, locale)}</div>
                        {!inv.deliveredToCustomerAt && (() => {
                          const remaining = getRemainingDays(inv.sale.createdAt);
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
                      
                      {activeTab !== 'pending_send' && (
                        <td className="px-4 py-4 font-semibold text-stone-900">{money(inv.transportCost, currencySymbol, locale)}</td>
                      )}
                      {activeTab !== 'pending_send' && activeTab !== 'in_transit' && (
                        <td className="px-4 py-4 font-semibold text-stone-900">{money(inv.cairoReceiptCost, currencySymbol, locale)}</td>
                      )}
                      {activeTab === 'history' && (
                        <td className="px-4 py-4 font-bold text-emerald-700">{money(inv.deliveryFeeCollected, currencySymbol, locale)}</td>
                      )}

                      <td className="px-4 py-4 whitespace-nowrap">
                        {inv.deliveredToCustomerAt ? (
                          <Badge tone="emerald">{isAr ? 'تم التسليم' : 'Delivered'}</Badge>
                        ) : inv.status === 'DELIVERED' ? (
                          <Badge tone="blue">{isAr ? 'جاهزة بالمحل' : 'Ready'}</Badge>
                        ) : inv.status === 'IN_TRANSIT' ? (
                          <Badge tone="amber">{isAr ? 'في القاهرة' : 'In Cairo'}</Badge>
                        ) : (
                          <Badge tone="stone">{isAr ? 'قيد الإرسال' : 'Pending Send'}</Badge>
                        )}
                      </td>
                      
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        {inv.status === 'PENDING_SEND' && (
                          <button
                            onClick={() => setSendModal({ isOpen: true, item: inv })}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition duration-150"
                          >
                            {t.sendBtn}
                          </button>
                        )}
                        {inv.status === 'IN_TRANSIT' && (
                          <button
                            onClick={() => setReceiveModal({ isOpen: true, item: inv })}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition duration-150"
                          >
                            {t.receiveBtn}
                          </button>
                        )}
                        {inv.status === 'DELIVERED' && !inv.deliveredToCustomerAt && (
                          <button
                            onClick={() => setDeliverModal({ isOpen: true, item: inv })}
                            className="px-3.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-md transition duration-150"
                          >
                            {t.deliverBtn}
                          </button>
                        )}
                        {inv.deliveredToCustomerAt && (
                          <span className="text-xs text-stone-400">
                            {shortDate(inv.deliveredToCustomerAt, locale)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={activeTab === 'pending_send' || activeTab === 'in_transit' ? 11 : 10} className="px-6 py-12 text-center text-stone-500 font-semibold bg-stone-50">
                      {t.noInvoices}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Send to Cairo Modal */}
      {sendModal.isOpen && sendModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">{t.sendTitle}</h3>
            
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{t.transportCost}</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={transportCostInput}
                  onChange={(e) => setTransportCostInput(e.target.value)}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                  placeholder={t.transportPlaceholder}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSendModal({ isOpen: false, item: null })}
                disabled={isPending}
                className="px-5 py-3 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold transition"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleSendToCairo}
                disabled={isPending}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md"
              >
                {isPending ? t.processing : t.sendConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive from Cairo Modal */}
      {receiveModal.isOpen && receiveModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">{t.receiveTitle}</h3>
            
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{t.cairoCost}</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={cairoReceiptCostInput}
                  onChange={(e) => setCairoReceiptCostInput(e.target.value)}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                  placeholder={t.cairoCostPlaceholder}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReceiveModal({ isOpen: false, item: null })}
                disabled={isPending}
                className="px-5 py-3 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold transition"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleReceiveFromCairo}
                disabled={isPending}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md"
              >
                {isPending ? t.processing : t.receiveConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deliver to Customer Modal */}
      {deliverModal.isOpen && deliverModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">{t.deliverTitle}</h3>
            
            <div className="mt-5 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">{t.feeSelect}</label>
              <div className="grid grid-cols-3 gap-2">
                {[100, 150, 0].map((fee) => (
                  <button
                    key={fee}
                    type="button"
                    onClick={() => setDeliveryFeeSelected(fee)}
                    className={`h-12 rounded-2xl border font-bold text-sm transition ${
                      deliveryFeeSelected === fee
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    {fee === 0 ? (isAr ? '0 (مجاني)' : '0 (Free)') : `${fee} EGP`}
                  </button>
                ))}
              </div>
            </div>

            {deliveryFeeSelected > 0 && (
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
                        name="deliverDrawerType"
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
                onClick={() => setDeliverModal({ isOpen: false, item: null })}
                disabled={isPending}
                className="px-5 py-3 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold transition"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleDeliverToCustomer}
                disabled={isPending}
                className="px-6 py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-sm font-bold transition shadow-md"
              >
                {isPending ? t.processing : t.deliverConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Cost Modal */}
      {bulkModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">
              {bulkModal.status === 'IN_TRANSIT'
                ? (isAr ? 'إرسال الفواتير المحددة وتحديد التكلفة الإجمالية' : 'Send Selected & Set Total Cost')
                : (isAr ? 'استلام الفواتير المحددة وتحديد التكاليف الكلية الإجمالية' : 'Receive Selected & Set Total Cairo Cost')}
            </h3>
            
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                  {isAr ? 'التكلفة الإجمالية (لجميع الفواتير المحددة):' : 'Total Cost (for all selected):'}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={bulkCostInput}
                  onChange={(e) => setBulkCostInput(e.target.value)}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                  placeholder={isAr ? 'ادخل التكلفة الكلية بالجنيه' : 'Enter total cost in EGP'}
                />
              </div>

              {Number(bulkCostInput || 0) > 0 && (
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">
                    {t.drawerSelect}
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { value: 'DRAWER_CASH', label: t.cashDrawer },
                      { value: 'INSTAPAY', label: t.instaPayDrawer },
                      { value: 'WALLET', label: t.walletDrawer },
                      { value: 'VISA', label: t.visaDrawer }
                    ].map((drawer) => (
                      <label
                        key={drawer.value}
                        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                          bulkDrawerSelected === drawer.value
                            ? 'border-blue-500 bg-blue-50/50'
                            : 'border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="bulkDrawerType"
                          value={drawer.value}
                          checked={bulkDrawerSelected === drawer.value}
                          onChange={() => setBulkDrawerSelected(drawer.value as any)}
                          className="accent-blue-600 h-4.5 w-4.5"
                        />
                        <span className="text-sm font-bold text-stone-900">{drawer.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setBulkModal({ isOpen: false, status: '' })}
                disabled={isPending}
                className="px-5 py-3 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold transition"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={isPending}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md"
              >
                {isPending ? t.processing : (isAr ? 'تأكيد العملية الجماعية' : 'Confirm Bulk')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
