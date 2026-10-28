'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { shortDate, money } from '@/lib/format';

type DealerDebt = {
  id: string;
  supplierId: string;
  dealerCode: string;
  purchaseId: string | null;
  totalAmount: string;
  paidAmount: string;
  remainingDebt: string;
  paymentMode: 'CASH' | 'ON_ACCOUNT' | 'DEFERRED';
  notes: string | null;
  isSettled: boolean;
  createdAt: string;
  supplier: {
    name: string;
    contactName: string | null;
    phone: string | null;
  };
};

type Supplier = {
  id: string;
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
};

type Category = { id: string; name: string; parentId: string | null };

type DebtsClientProps = {
  initialDebts: DealerDebt[];
  suppliers: Supplier[];
  categories: Category[];
  currencySymbol: string;
  locale: string;
};

const COLOR_PRESETS = ['أسود', 'أبيض', 'كحلي', 'رمادي', 'أحمر', 'أزرق', 'زيتي', 'بيج'];
const SIZE_PRESETS = ['S', 'M', 'L', 'XL', '2XL', '3XL', 'Free Size'];

export default function DebtsClient({
  initialDebts,
  suppliers,
  categories,
  currencySymbol,
  locale
}: DebtsClientProps) {
  const isAr = locale === 'ar';
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';

  const [debts, setDebts] = useState<DealerDebt[]>(initialDebts);
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers);
  const [activeTab, setActiveTab] = useState<'debts_list' | 'new_purchase' | 'suppliers'>('debts_list');

  // Filters
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [filterMode, setFilterMode] = useState<'ALL' | 'CASH' | 'ON_ACCOUNT' | 'DEFERRED'>('ALL');
  const [filterSettled, setFilterSettled] = useState<'ALL' | 'PENDING' | 'SETTLED'>(initialSearch ? 'ALL' : 'PENDING');

  useEffect(() => {
    const q = searchParams.get('search') ?? '';
    if (q) {
      setSearchQuery(q);
      setFilterSettled('ALL');
    }
  }, [searchParams]);

  // Modal payment state
  const [payModal, setPayModal] = useState<{ isOpen: boolean; item: DealerDebt | null }>({
    isOpen: false,
    item: null
  });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedDrawer, setSelectedDrawer] = useState<'DRAWER_CASH' | 'INSTAPAY' | 'WALLET' | 'VISA'>('DRAWER_CASH');

  // New Purchase state
  const [supplierId, setSupplierId] = useState('');
  const [isNewSupplier, setIsNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'ON_ACCOUNT' | 'DEFERRED'>('ON_ACCOUNT');
  const [downPayment, setDownPayment] = useState('');
  const [notes, setNotes] = useState('');

  // Supplier Add/Edit Modal
  const [supplierModal, setSupplierModal] = useState<{
    isOpen: boolean;
    item: Supplier | null;
  }>({
    isOpen: false,
    item: null
  });
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    isActive: true
  });
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  
  // Dynamic list of clothing items in the purchase
  const [clothingItems, setClothingItems] = useState<Array<{
    name: string;
    brand: string;
    categoryId: string;
    cost: string; // supplier price
    price: string; // sale price
    colors: string[];
    sizes: string[];
    variants: Array<{
      color: string;
      size: string;
      stockQty: string;
      sku: string;
      barcode: string;
    }>;
  }>>([
    {
      name: '',
      brand: '',
      categoryId: '',
      cost: '',
      price: '',
      colors: [],
      sizes: [],
      variants: [
        {
          color: '',
          size: '',
          stockQty: '',
          sku: '',
          barcode: ''
        }
      ]
    }
  ]);
  const [customColors, setCustomColors] = useState<Record<number, string>>({});
  const [customSizes, setCustomSizes] = useState<Record<number, string>>({});

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Dictionary
  const t = {
    tabDebtsList: isAr ? 'مديونيات التجار' : 'Dealer Debts',
    tabNewPurchase: isAr ? 'تسجيل فواتير ومشتريات المقاولين' : 'New Subcontractor/Vendor Invoice',
    searchPlaceholder: isAr ? 'البحث باسم التاجر أو الكود...' : 'Search supplier name or code...',
    all: isAr ? 'الكل' : 'All',
    outstanding: isAr ? 'مستحق' : 'Outstanding',
    settled: isAr ? 'تم السداد' : 'Settled',
    supplier: isAr ? 'التاجر / المورد' : 'Supplier',
    dealerCode: isAr ? 'كود المرجع / الفاتورة' : 'Reference / Invoice Code',
    totalAmount: isAr ? 'القيمة الإجمالية' : 'Total Amount',
    paidAmount: isAr ? 'المدفوع' : 'Paid Amount',
    remainingDebt: isAr ? 'المتبقي' : 'Remaining',
    paymentMode: isAr ? 'طريقة الحساب' : 'Payment Mode',
    status: isAr ? 'الحالة' : 'Status',
    actions: isAr ? 'إجراءات' : 'Actions',
    payBtn: isAr ? 'سداد مديونية' : 'Post Payment',
    noDebts: isAr ? 'لا توجد مديونيات تجار تطابق البحث.' : 'No dealer debts match the filters.',
    
    // Purchase Form
    supplierSelect: isAr ? 'اختر التاجر المورد:' : 'Select Dealer/Supplier:',
    modeSelect: isAr ? 'طريقة دفع المشتريات:' : 'Accounting Payment Method:',
    cashMode: isAr ? 'كاش من الدرج (يخصم فورا)' : 'Cash (Deduct from Drawer)',
    onAccountMode: isAr ? 'تحت الحساب (يسجل كمديونية)' : 'On Account (Supplier Credit)',
    deferredMode: isAr ? 'آجل مع مقدم والباقي للمديونيات' : 'Deferred (Down payment + Debt)',
    downPaymentLabel: isAr ? 'المقدم المدفوع كاش:' : 'Down Payment Cash Amount:',
    notesLabel: isAr ? 'ملاحظات:' : 'Notes:',
    
    bikeName: isAr ? 'اسم البند / الخدمة' : 'Item / Service Name',
    bikeBrand: isAr ? 'المصنع / العلامة' : 'Manufacturer / Brand',
    bikeDealerCode: isAr ? 'كود المرجع / الفاتورة' : 'Reference / Invoice Code',
    bikeSupplierPrice: isAr ? 'سعر التكلفة' : 'Cost Price',
    bikeAssemblyCost: isAr ? 'تكلفة التقفيل' : 'Assembly Cost',
    bikeExtTransport: isAr ? 'نقل خارجي' : 'External Transport',
    bikeIntTransport: isAr ? 'نقل داخلي' : 'Internal Transport',
    bikeMaint: isAr ? 'صيانة' : 'Maintenance',
    bikeOtherCosts: isAr ? 'مصاريف أخرى' : 'Other Cost',
    bikeCondition: isAr ? 'الحالة' : 'Condition',
    bikeSalePrice: isAr ? 'سعر البيع للوكيل' : 'Sale Price',
    newBike: isAr ? 'جديد' : 'New',
    usedBike: isAr ? 'مستعمل' : 'Used',
    addBike: isAr ? 'إضافة بند آخر +' : 'Add another item +',
    removeBike: isAr ? 'حذف البند' : 'Remove Item',
    submitPurchase: isAr ? 'حفظ الفاتورة والمؤن' : 'Save Supply Invoice',
    
    // Pay Modal
    payTitle: isAr ? 'تسجيل سداد مديونية التاجر' : 'Record Dealer Debt Payment',
    payAmountLabel: isAr ? 'مبلغ السداد:' : 'Payment amount:',
    drawerSelect: isAr ? 'درج خصم المبلغ:' : 'Source cash drawer:',
    confirm: isAr ? 'تأكيد السداد' : 'Confirm Payment',
    cancel: isAr ? 'إلغاء' : 'Cancel',
    processing: isAr ? 'جاري التحميل...' : 'Processing...',
    cashDrawer: isAr ? 'كاش (درج الفرع)' : 'Branch Cash Drawer',
    instaPayDrawer: isAr ? 'انستا باي (InstaPay)' : 'InstaPay Drawer',
    walletDrawer: isAr ? 'محفظة إلكترونية (Wallet)' : 'Electronic Wallet',
    visaDrawer: isAr ? 'فيزا (Visa)' : 'Visa Drawer'
  };

  // Filter local state
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      const matchesSearch =
        d.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.dealerCode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesMode = filterMode === 'ALL' || d.paymentMode === filterMode;

      const matchesSettled =
        filterSettled === 'ALL' ||
        (filterSettled === 'PENDING' && !d.isSettled) ||
        (filterSettled === 'SETTLED' && d.isSettled);

      return matchesSearch && matchesMode && matchesSettled;
    });
  }, [debts, searchQuery, filterMode, filterSettled]);

  // Handle Pay Modal Open
  const handleOpenPay = (due: DealerDebt) => {
    setPayModal({ isOpen: true, item: due });
    setPaymentAmount(due.remainingDebt);
  };

  // Submit Debt Payment
  const handlePaySubmit = async () => {
    if (!payModal.item) return;
    setError('');
    setSuccess('');
    const amt = Number(paymentAmount);

    if (amt <= 0 || amt > Number(payModal.item.remainingDebt)) {
      setError(isAr ? 'مبلغ سداد غير صالح.' : 'Invalid payment amount.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/debts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: payModal.item!.id,
            paymentAmount: amt,
            drawerType: selectedDrawer
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to update payment.');
        }

        // Update local state
        setDebts((prev) =>
          prev.map((d) =>
            d.id === payModal.item!.id
              ? {
                  ...d,
                  paidAmount: (Number(d.paidAmount) + amt).toString(),
                  remainingDebt: (Number(d.remainingDebt) - amt).toString(),
                  isSettled: Number(d.remainingDebt) - amt <= 0
                }
              : d
          )
        );

        setSuccess(isAr ? 'تم تسجيل السداد وخصم المبلغ من الدرج بنجاح!' : 'Debt payment recorded and deducted from cash drawer!');
        setPayModal({ isOpen: false, item: null });
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  const handleAddClothingItem = () => {
    setClothingItems((prev) => [
      ...prev,
      {
        name: '',
        brand: '',
        categoryId: '',
        cost: '',
        price: '',
        colors: [],
        sizes: [],
        variants: [
          {
            color: '',
            size: '',
            stockQty: '',
            sku: '',
            barcode: ''
          }
        ]
      }
    ]);
  };

  const handleRemoveClothingItem = (index: number) => {
    if (clothingItems.length <= 1) return;
    setClothingItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClothingItemFieldChange = (index: number, field: string, value: any) => {
    setClothingItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRegenerateVariants = (itemIndex: number, newColors: string[], newSizes: string[]) => {
    const item = clothingItems[itemIndex];
    const combinations: any[] = [];
    if (newColors.length === 0 && newSizes.length === 0) {
      setClothingItems((prev) =>
        prev.map((it, idx) =>
          idx === itemIndex ? { ...it, colors: newColors, sizes: newSizes, variants: [] } : it
        )
      );
      return;
    }

    const colorsToUse = newColors.length > 0 ? newColors : [''];
    const sizesToUse = newSizes.length > 0 ? newSizes : [''];
    
    const baseSku = item.name
      ? `CLO-${item.name.replace(/\s+/g, '-').slice(0, 10).toUpperCase()}`
      : 'CLO-SKU';

    for (const color of colorsToUse) {
      for (const size of sizesToUse) {
        if (!color && !size) continue;

        const existing = item.variants.find(
          (v) => v.color === color && v.size === size
        );

        if (existing) {
          combinations.push(existing);
        } else {
          const colorCode = color ? color.slice(0, 3).toUpperCase() : '';
          const sizeCode = size ? size.toUpperCase() : '';
          const suffix = [colorCode, sizeCode].filter(Boolean).join('-');
          combinations.push({
            color,
            size,
            stockQty: '0',
            sku: suffix ? `${baseSku}-${suffix}` : baseSku,
            barcode: ''
          });
        }
      }
    }

    setClothingItems((prev) =>
      prev.map((it, idx) =>
        idx === itemIndex ? { ...it, colors: newColors, sizes: newSizes, variants: combinations } : it
      )
    );
  };

  const addColorToItem = (itemIndex: number, color: string) => {
    const trimmed = color.trim();
    const item = clothingItems[itemIndex];
    if (!trimmed || item.colors.includes(trimmed)) return;
    const nextColors = [...item.colors, trimmed];
    handleRegenerateVariants(itemIndex, nextColors, item.sizes);
  };

  const removeColorFromItem = (itemIndex: number, color: string) => {
    const item = clothingItems[itemIndex];
    const nextColors = item.colors.filter((c) => c !== color);
    handleRegenerateVariants(itemIndex, nextColors, item.sizes);
  };

  const addSizeToItem = (itemIndex: number, size: string) => {
    const trimmed = size.trim();
    const item = clothingItems[itemIndex];
    if (!trimmed || item.sizes.includes(trimmed)) return;
    const nextSizes = [...item.sizes, trimmed];
    handleRegenerateVariants(itemIndex, nextSizes, item.colors);
  };

  const removeSizeFromItem = (itemIndex: number, size: string) => {
    const item = clothingItems[itemIndex];
    const nextSizes = item.sizes.filter((s) => s !== size);
    handleRegenerateVariants(itemIndex, item.colors, nextSizes);
  };

  // Submit Purchase Form
  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isNewSupplier && !supplierId) {
      setError(isAr ? 'الرجاء اختيار المورد.' : 'Please select the supplier.');
      return;
    }

    if (isNewSupplier && !newSupplierName.trim()) {
      setError(isAr ? 'الرجاء إدخال اسم التاجر الجديد.' : 'Please enter the new supplier name.');
      return;
    }

    // Validate clothing items
    for (let i = 0; i < clothingItems.length; i++) {
      const item = clothingItems[i];
      if (!item.name || !item.brand || !item.categoryId || !item.cost || !item.price) {
        setError(isAr ? `الرجاء ملء حقول الموديل رقم ${i + 1} بالكامل.` : `Please complete details for item #${i + 1}.`);
        return;
      }
      
      const totalQty = item.variants.reduce((acc, v) => acc + Number(v.stockQty || 0), 0);
      if (totalQty <= 0) {
        setError(isAr ? `الرجاء تحديد كمية مخزون لقطعة واحدة على الأقل في الموديل رقم ${i + 1}.` : `Please enter stock quantity for at least one color/size in item #${i + 1}.`);
        return;
      }
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/purchases/dealer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplierId: isNewSupplier ? null : supplierId,
            newSupplierName: isNewSupplier ? newSupplierName.trim() : null,
            paymentMode,
            downPayment: paymentMode === 'DEFERRED' ? Number(downPayment) : null,
            notes: notes || null,
            clothingItems: clothingItems.map((item) => ({
              name: item.name,
              brand: item.brand || null,
              categoryId: item.categoryId || null,
              cost: Number(item.cost),
              price: Number(item.price),
              variants: item.variants.map((v) => ({
                color: v.color || null,
                size: v.size || null,
                stockQty: Number(v.stockQty || 0),
                sku: v.sku || null,
                barcode: v.barcode || null
              }))
            }))
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to record purchase.');
        }

        // Add created debt to state
        if (data.result?.debt) {
          const d = data.result.debt;
          const matchedSupplierName = isNewSupplier
            ? newSupplierName.trim()
            : (localSuppliers.find((s) => s.id === supplierId)?.name || 'N/A');
          setDebts((prev) => [
            {
              ...d,
              totalAmount: d.totalAmount.toString(),
              paidAmount: d.paidAmount.toString(),
              remainingDebt: d.remainingDebt.toString(),
              createdAt: d.createdAt,
              supplier: {
                name: matchedSupplierName,
                contactName: null,
                phone: null
              }
            },
            ...prev
          ]);

          // Add to local suppliers array
          if (isNewSupplier && d.supplierId) {
            setLocalSuppliers((prev) => [
              ...prev,
              {
                id: d.supplierId,
                name: matchedSupplierName,
                isActive: true
              }
            ]);
          }
        }

        setSuccess(isAr ? 'تم تسجيل الفاتورة والمؤن وتحديث المخزون بنجاح!' : 'Supply purchase recorded and stock updated successfully!');
        
        // Reset form
        setSupplierId('');
        setIsNewSupplier(false);
        setNewSupplierName('');
        setPaymentMode('ON_ACCOUNT');
        setDownPayment('');
        setNotes('');
        setClothingItems([
          {
            name: '',
            brand: '',
            categoryId: '',
            cost: '',
            price: '',
            colors: [],
            sizes: [],
            variants: [
              {
                color: '',
                size: '',
                stockQty: '',
                sku: '',
                barcode: ''
              }
            ]
          }
        ]);
        setActiveTab('debts_list');
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  // Supplier CRUD Handlers
  const handleOpenAddSupplier = () => {
    setSupplierForm({
      name: '',
      contactName: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
      isActive: true
    });
    setSupplierModal({ isOpen: true, item: null });
  };

  const handleOpenEditSupplier = (supplier: Supplier) => {
    setSupplierForm({
      name: supplier.name,
      contactName: supplier.contactName || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      isActive: supplier.isActive
    });
    setSupplierModal({ isOpen: true, item: supplier });
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!supplierForm.name.trim()) {
      setError(isAr ? 'الرجاء إدخال اسم التاجر.' : 'Please enter the supplier name.');
      return;
    }

    startTransition(async () => {
      try {
        const isEdit = Boolean(supplierModal.item);
        const url = isEdit ? `/api/suppliers/${supplierModal.item!.id}` : '/api/suppliers';
        const method = isEdit ? 'PATCH' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(supplierForm)
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to save supplier.');
        }

        const savedSupplier = data.supplier;

        if (isEdit) {
          setLocalSuppliers((prev) =>
            prev.map((s) => (s.id === savedSupplier.id ? savedSupplier : s))
          );
          setSuccess(isAr ? 'تم تعديل بيانات التاجر بنجاح!' : 'Supplier details updated successfully!');
        } else {
          setLocalSuppliers((prev) => [savedSupplier, ...prev]);
          setSuccess(isAr ? 'تمت إضافة التاجر الجديد بنجاح!' : 'New supplier added successfully!');
        }

        setSupplierModal({ isOpen: false, item: null });
      } catch (err: any) {
        setError(err.message || 'An error occurred.');
      }
    });
  };

  const handleToggleSupplierActive = async (supplier: Supplier) => {
    const confirmed = window.confirm(
      supplier.isActive
        ? (isAr ? `هل أنت متأكد من أرشفة التاجر "${supplier.name}"؟` : `Are you sure you want to archive supplier "${supplier.name}"?`)
        : (isAr ? `هل تريد استعادة التاجر "${supplier.name}"؟` : `Do you want to restore supplier "${supplier.name}"?`)
    );
    if (!confirmed) return;

    setError('');
    setSuccess('');
    const nextActive = !supplier.isActive;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/suppliers/${supplier.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: nextActive })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? 'Failed to update supplier status.');
        }

        setLocalSuppliers((prev) =>
          prev.map((s) => (s.id === supplier.id ? { ...s, isActive: nextActive } : s))
        );

        setSuccess(
          isAr
            ? nextActive
              ? 'تم تنشيط التاجر بنجاح!'
              : 'تمت أرشفة التاجر بنجاح!'
            : nextActive
              ? 'Supplier activated successfully!'
              : 'Supplier archived successfully!'
        );
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
        <div className="flex p-1 gap-1 rounded-[22px] border border-stone-200 bg-white/70 backdrop-blur-sm shadow-[0_12px_24px_-16px_rgba(28,25,23,0.15)] max-w-lg w-full">
          <button
            onClick={() => setActiveTab('debts_list')}
            className={`flex-1 px-4 py-2.5 rounded-[18px] text-xs font-bold transition-all duration-200 ${
              activeTab === 'debts_list'
                ? 'bg-blue-600 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.4)]'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {t.tabDebtsList}
          </button>
          <button
            onClick={() => setActiveTab('new_purchase')}
            className={`flex-1 px-4 py-2.5 rounded-[18px] text-xs font-bold transition-all duration-200 ${
              activeTab === 'new_purchase'
                ? 'bg-blue-600 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.4)]'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {t.tabNewPurchase}
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`flex-1 px-4 py-2.5 rounded-[18px] text-xs font-bold transition-all duration-200 ${
              activeTab === 'suppliers'
                ? 'bg-blue-600 text-white shadow-[0_10px_20px_-10px_rgba(37,99,235,0.4)]'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            {isAr ? 'التجار والموردين' : 'Dealers / Suppliers'}
          </button>
        </div>

        {activeTab === 'debts_list' && (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterSettled}
              onChange={(e) => setFilterSettled(e.target.value as any)}
              className="h-11 px-4 rounded-2xl border border-stone-200 bg-white text-xs font-bold outline-none text-stone-700"
            >
              <option value="PENDING">{t.outstanding}</option>
              <option value="SETTLED">{t.settled}</option>
              <option value="ALL">{t.all}</option>
            </select>

            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as any)}
              className="h-11 px-4 rounded-2xl border border-stone-200 bg-white text-xs font-bold outline-none text-stone-700"
            >
              <option value="ALL">{isAr ? 'كل طرق الدفع' : 'All Payment Modes'}</option>
              <option value="CASH">{isAr ? 'كاش' : 'Cash'}</option>
              <option value="ON_ACCOUNT">{isAr ? 'تحت الحساب' : 'On Account'}</option>
              <option value="DEFERRED">{isAr ? 'تقسيط/آجل' : 'Deferred'}</option>
            </select>

            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 px-4 rounded-2xl border border-stone-200 bg-white shadow-sm outline-none transition focus:border-blue-500 w-64 text-sm"
            />
          </div>
        )}

        {activeTab === 'suppliers' && (
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder={isAr ? 'البحث عن تاجر...' : 'Search supplier...'}
              value={supplierSearchQuery}
              onChange={(e) => setSupplierSearchQuery(e.target.value)}
              className="h-11 px-4 rounded-2xl border border-stone-200 bg-white shadow-sm outline-none transition focus:border-blue-500 w-64 text-sm"
            />
            <button
              onClick={handleOpenAddSupplier}
              className="h-11 px-5 rounded-2xl bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold transition shadow-md"
            >
              {isAr ? 'إضافة تاجر جديد +' : 'Add New Supplier +'}
            </button>
          </div>
        )}
      </div>

      {/* Main UI */}
      {activeTab === 'debts_list' && (
        <Card>
          <div className="overflow-hidden rounded-[26px] border border-stone-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-stone-700">
                <thead className="bg-stone-50 text-stone-500 font-semibold text-xs uppercase tracking-wider border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3.5 text-right">{t.supplier}</th>
                    <th className="px-4 py-3.5 text-right">{t.dealerCode}</th>
                    <th className="px-4 py-3.5 text-right">{isAr ? 'تاريخ المعاملة' : 'Transaction Date'}</th>
                    <th className="px-4 py-3.5 text-right">{t.paymentMode}</th>
                    <th className="px-4 py-3.5 text-right">{t.totalAmount}</th>
                    <th className="px-4 py-3.5 text-right">{t.paidAmount}</th>
                    <th className="px-4 py-3.5 text-right">{t.remainingDebt}</th>
                    <th className="px-4 py-3.5 text-right">{t.status}</th>
                    <th className="px-4 py-3.5 text-center">{t.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-150">
                  {filteredDebts.map((d) => (
                    <tr key={d.id} className="bg-white hover:bg-stone-50/70 transition duration-150">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{d.supplier.name}</div>
                        {d.supplier.phone && <div className="text-xs text-stone-400">{d.supplier.phone}</div>}
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-stone-800">{d.dealerCode}</td>
                      <td className="px-4 py-4 whitespace-nowrap">{shortDate(d.createdAt, locale)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <Badge tone={d.paymentMode === 'CASH' ? 'emerald' : d.paymentMode === 'DEFERRED' ? 'amber' : 'stone'}>
                          {d.paymentMode}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 font-semibold">{money(d.totalAmount, currencySymbol, locale)}</td>
                      <td className="px-4 py-4 font-semibold text-emerald-700">{money(d.paidAmount, currencySymbol, locale)}</td>
                      <td className="px-4 py-4 font-bold text-stone-950">{money(d.remainingDebt, currencySymbol, locale)}</td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {d.isSettled ? (
                          <Badge tone="emerald">{t.settled}</Badge>
                        ) : (
                          <Badge tone="amber">{t.outstanding}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        {!d.isSettled ? (
                          <button
                            onClick={() => handleOpenPay(d)}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition duration-150"
                          >
                            {t.payBtn}
                          </button>
                        ) : (
                          <span className="text-xs text-stone-400">✓</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {filteredDebts.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-stone-500 font-semibold bg-stone-50">
                        {t.noDebts}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'new_purchase' && (
        <form onSubmit={handlePurchaseSubmit} className="space-y-6">
          {/* Purchase details */}
          <Card>
            <h3 className="text-lg font-black text-stone-900 mb-4">{isAr ? 'تفاصيل فاتورة مشتريات التاجر' : 'Dealer Purchase Invoice'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500">{t.supplierSelect} *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewSupplier(!isNewSupplier);
                      setSupplierId('');
                      setNewSupplierName('');
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                  >
                    {isNewSupplier
                      ? (isAr ? 'اختر من القائمة' : 'Select from list')
                      : (isAr ? 'تاجر جديد؟' : 'New supplier?')}
                  </button>
                </div>
                {isNewSupplier ? (
                  <input
                    type="text"
                    required
                    value={newSupplierName}
                    onChange={(e) => setNewSupplierName(e.target.value)}
                    className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm text-stone-900"
                    placeholder={isAr ? 'اسم التاجر الجديد...' : 'Enter new supplier name...'}
                  />
                ) : (
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm text-stone-700"
                  >
                    <option value="">{isAr ? 'اختر تاجر...' : 'Select Supplier...'}</option>
                    {localSuppliers.filter((s) => s.isActive).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">{t.modeSelect} *</label>
                <select
                  required
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm text-stone-700 font-semibold"
                >
                  <option value="ON_ACCOUNT">{t.onAccountMode}</option>
                  <option value="DEFERRED">{t.deferredMode}</option>
                  <option value="CASH">{t.cashMode}</option>
                </select>
              </div>

              {paymentMode === 'DEFERRED' && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">{t.downPaymentLabel} *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={downPayment}
                    onChange={(e) => setDownPayment(e.target.value)}
                    className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                    placeholder="10000"
                  />
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">{t.notesLabel}</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                placeholder={isAr ? 'ملاحظات إضافية على الفاتورة...' : 'Additional notes...'}
              />
            </div>
          </Card>

          {/* List of items inside the purchase */}
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 border-b border-stone-150 pb-3">
              <h3 className="text-lg font-black text-stone-900">{isAr ? 'البنود والمؤن المدرجة في الفاتورة' : 'Marine Supplies & Items in Shipment'}</h3>
              <button
                type="button"
                onClick={handleAddClothingItem}
                className="px-4 py-2 rounded-2xl bg-stone-900 hover:bg-stone-850 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {t.addBike}
              </button>
            </div>

            <div className="space-y-8 divide-y divide-stone-200">
              {clothingItems.map((item, index) => (
                <div key={index} className={`pt-6 ${index === 0 ? '!pt-0' : ''}`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">
                      {isAr ? `موديل رقم ${index + 1}` : `Model #${index + 1}`}
                    </span>
                    {clothingItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveClothingItem(index)}
                        className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
                      >
                        {t.removeBike}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">{t.bikeName} *</label>
                      <input
                        type="text"
                        required
                        value={item.name}
                        onChange={(e) => handleClothingItemFieldChange(index, 'name', e.target.value)}
                        className="h-10 w-full px-3 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:border-blue-500"
                        placeholder="e.g. تيشرت قطن سادة"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">{t.bikeBrand} *</label>
                      <input
                        type="text"
                        required
                        value={item.brand}
                        onChange={(e) => handleClothingItemFieldChange(index, 'brand', e.target.value)}
                        className="h-10 w-full px-3 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:border-blue-500"
                        placeholder="e.g. Volar"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">{isAr ? 'التصنيف' : 'Category'} *</label>
                      <select
                        required
                        value={item.categoryId}
                        onChange={(e) => handleClothingItemFieldChange(index, 'categoryId', e.target.value)}
                        className="h-10 w-full px-3 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:border-blue-500 text-stone-700"
                      >
                        <option value="">{isAr ? 'اختر تصنيف...' : 'Select Category...'}</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">{t.bikeSupplierPrice} *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={item.cost}
                        onChange={(e) => handleClothingItemFieldChange(index, 'cost', e.target.value)}
                        className="h-10 w-full px-3 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:border-blue-500 font-semibold text-stone-900"
                        placeholder="150"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">{t.bikeSalePrice} *</label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={item.price}
                        onChange={(e) => handleClothingItemFieldChange(index, 'price', e.target.value)}
                        className="h-10 w-full px-3 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:border-blue-500 font-semibold text-stone-900"
                        placeholder="350"
                      />
                    </div>
                  </div>

                  {/* Received Quantity Input */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">{isAr ? 'الكمية المستلمة *' : 'Received Quantity *'}</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.variants[0]?.stockQty || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updatedVariants = [{
                            color: '',
                            size: '',
                            stockQty: val,
                            sku: '',
                            barcode: ''
                          }];
                          handleClothingItemFieldChange(index, 'variants', updatedVariants);
                        }}
                        className="h-10 w-full px-3 rounded-xl border border-stone-200 bg-white text-sm outline-none focus:border-blue-500 font-semibold text-stone-900"
                        placeholder="10"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end gap-3 border-t border-stone-150 pt-5">
              <button
                type="submit"
                disabled={isPending}
                className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg transition duration-150 cursor-pointer"
              >
                {isPending ? t.processing : t.submitPurchase}
              </button>
            </div>
          </Card>
        </form>
      )}

      {activeTab === 'suppliers' && (
        <Card>
          <div className="overflow-hidden rounded-[26px] border border-stone-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-stone-700">
                <thead className="bg-stone-50 text-stone-500 font-semibold text-xs uppercase tracking-wider border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3.5 text-right">{isAr ? 'اسم التاجر / الشركة' : 'Dealer / Supplier Name'}</th>
                    <th className="px-4 py-3.5 text-right">{isAr ? 'اسم المسؤول' : 'Contact Person'}</th>
                    <th className="px-4 py-3.5 text-right">{isAr ? 'الهاتف' : 'Phone'}</th>
                    <th className="px-4 py-3.5 text-right">{isAr ? 'البريد الإلكتروني' : 'Email'}</th>
                    <th className="px-4 py-3.5 text-right">{isAr ? 'العنوان' : 'Address'}</th>
                    <th className="px-4 py-3.5 text-right">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="px-4 py-3.5 text-center">{isAr ? 'الخيارات' : 'Options'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-150">
                  {localSuppliers
                    .filter((s) => s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()))
                    .map((s) => (
                      <tr key={s.id} className="bg-white hover:bg-stone-50/70 transition duration-150">
                        <td className="px-4 py-4 font-semibold text-stone-900">{s.name}</td>
                        <td className="px-4 py-4 text-stone-600">{s.contactName || 'N/A'}</td>
                        <td className="px-4 py-4 text-stone-600 font-mono">{s.phone || 'N/A'}</td>
                        <td className="px-4 py-4 text-stone-600 font-mono">{s.email || 'N/A'}</td>
                        <td className="px-4 py-4 text-stone-600">{s.address || 'N/A'}</td>
                        <td className="px-4 py-4">
                          <Badge tone={s.isActive ? 'emerald' : 'stone'}>
                            {s.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'مؤرشف' : 'Archived')}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSupplier(s)}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition duration-150"
                          >
                            {isAr ? 'تعديل' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSupplierActive(s)}
                            className={`px-3 py-1.5 rounded-xl text-white text-xs font-bold transition duration-150 ${
                              s.isActive
                                ? 'bg-stone-500 hover:bg-stone-600'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            {s.isActive ? (isAr ? 'أرشفة' : 'Archive') : (isAr ? 'استعادة' : 'Restore')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  {localSuppliers.filter((s) => s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase())).length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-stone-500 font-semibold bg-stone-50">
                        {isAr ? 'لا يوجد تجار تطابق بحثك.' : 'No dealers or suppliers found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Pay Dealer Debt Modal */}
      {payModal.isOpen && payModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">{t.payTitle}</h3>
            
            <div className="mt-5 space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex justify-between items-center text-sm font-semibold">
                <span className="text-stone-600">{isAr ? 'المديونية المتبقية:' : 'Outstanding Debt:'}</span>
                <span className="text-blue-700 text-lg font-black">{money(payModal.item.remainingDebt, currencySymbol, locale)}</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">{t.payAmountLabel} *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm font-semibold"
                />
              </div>

              <div className="space-y-3">
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
                        name="debtDrawerType"
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
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPayModal({ isOpen: false, item: null })}
                disabled={isPending}
                className="px-5 py-3 rounded-2xl border border-stone-250 bg-white hover:bg-stone-50 text-stone-700 text-sm font-bold transition"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handlePaySubmit}
                disabled={isPending}
                className="px-6 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md"
              >
                {isPending ? t.processing : t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Supplier Modal */}
      {supplierModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-[30px] border border-white/80 bg-white/95 p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.35)] md:p-8">
            <h3 className="text-xl font-black text-stone-900">
              {supplierModal.item
                ? (isAr ? 'تعديل بيانات التاجر' : 'Edit Supplier')
                : (isAr ? 'إضافة تاجر جديد' : 'Add New Supplier')}
            </h3>

            <form onSubmit={handleSupplierSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                  {isAr ? 'اسم التاجر / الشركة *' : 'Supplier Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm font-semibold"
                  placeholder={isAr ? 'مثال: شركة النور للموتوسيكلات' : 'e.g. Al-Noor Motorcycles'}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                    {isAr ? 'اسم المسؤول' : 'Contact Person'}
                  </label>
                  <input
                    type="text"
                    value={supplierForm.contactName}
                    onChange={(e) => setSupplierForm((prev) => ({ ...prev, contactName: e.target.value }))}
                    className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                    placeholder={isAr ? 'مثال: أ/ محمد أحمد' : 'e.g. Mohamed Ahmed'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                    {isAr ? 'الهاتف' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm font-mono"
                    placeholder="010xxxxxxx"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                    {isAr ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={supplierForm.email}
                    onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm font-mono"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                    {isAr ? 'العنوان' : 'Address'}
                  </label>
                  <input
                    type="text"
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
                    className="h-11 w-full px-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                    placeholder={isAr ? 'العنوان...' : 'Address...'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1">
                  {isAr ? 'ملاحظات' : 'Notes'}
                </label>
                <textarea
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full p-4 rounded-2xl border border-stone-200 bg-white outline-none transition focus:border-blue-500 text-sm"
                  rows={2}
                  placeholder={isAr ? 'أي ملاحظات إضافية...' : 'Any extra details...'}
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSupplierModal({ isOpen: false, item: null })}
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
                  {isPending ? t.processing : (isAr ? 'حفظ' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
