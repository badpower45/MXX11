'use client';

import { useState, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { shortDate } from '@/lib/format';

export type ShipmentStage =
  | 'NEW'
  | 'EXTERNAL_PROCUREMENT'
  | 'WAREHOUSE_PREPARATION'
  | 'PORT_CUSTOMS_CLEARANCE'
  | 'IN_TRANSIT_TO_BERTH'
  | 'DELIVERED_TO_VESSEL'
  | 'CANCELLED';

export type ShipmentItem = {
  id: string;
  itemName: string;
  category: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string | null;
  isExternallyProcured: boolean;
  isPrepared: boolean;
  notes: string | null;
};

export type StageLog = {
  id: string;
  fromStage: ShipmentStage | null;
  toStage: ShipmentStage;
  notes: string | null;
  referenceDoc: string | null;
  createdAt: string;
  performedBy: { id: string; name: string | null; email: string } | null;
};

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type Shipment = {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  vesselName: string;
  vesselImo: string | null;
  berthLocation: string | null;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  currentStage: ShipmentStage;
  notes: string | null;
  totalAmount: string | null;
  eta: string | null;
  etd: string | null;
  deliveryDate: string | null;
  createdAt: string;
  coordinatorId: string | null;
  procurementOfficerId: string | null;
  warehouseOfficerId: string | null;
  customsOfficerId: string | null;
  deliveryOfficerId: string | null;
  coordinator: { id: string; name: string | null; email: string } | null;
  procurementOfficer: { id: string; name: string | null; email: string } | null;
  warehouseOfficer: { id: string; name: string | null; email: string } | null;
  customsOfficer: { id: string; name: string | null; email: string } | null;
  deliveryOfficer: { id: string; name: string | null; email: string } | null;
  items: ShipmentItem[];
  stageLogs: StageLog[];
};

type Props = {
  initialShipments: Shipment[];
  staff: StaffMember[];
  currentUserId: string;
  locale: string;
  currencySymbol: string;
};

const STAGES: Array<{ key: ShipmentStage; labelAr: string; labelEn: string; icon: string }> = [
  { key: 'NEW', labelAr: '1. طلب جديد', labelEn: '1. New Order', icon: '📝' },
  { key: 'EXTERNAL_PROCUREMENT', labelAr: '2. شراء وتوريد خارجي', labelEn: '2. External Sourcing', icon: '🛒' },
  { key: 'WAREHOUSE_PREPARATION', labelAr: '3. تجهيز المخزن', labelEn: '3. Warehouse Packing', icon: '📦' },
  { key: 'PORT_CUSTOMS_CLEARANCE', labelAr: '4. تصريح الميناء والجمارك', labelEn: '4. Port & Customs', icon: '🛂' },
  { key: 'IN_TRANSIT_TO_BERTH', labelAr: '5. في الطريق للرصيف', labelEn: '5. In Transit', icon: '🚚' },
  { key: 'DELIVERED_TO_VESSEL', labelAr: '6. تم التسليم على السفينة', labelEn: '6. Delivered', icon: '⚓' }
];

export default function ShipmentsClient({
  initialShipments,
  staff,
  currentUserId,
  locale,
  currencySymbol
}: Props) {
  const isAr = locale === 'ar';
  const [shipments, setShipments] = useState<Shipment[]>(initialShipments);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [timelineModalShipment, setTimelineModalShipment] = useState<Shipment | null>(null);

  // Advance modal form states
  const [nextStage, setNextStage] = useState<ShipmentStage>('EXTERNAL_PROCUREMENT');
  const [stageNotes, setStageNotes] = useState('');
  const [referenceDoc, setReferenceDoc] = useState('');
  const [isSubmittingStage, setIsSubmittingStage] = useState(false);

  // Create modal form states
  const [formData, setFormData] = useState({
    vesselName: '',
    vesselImo: '',
    berthLocation: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    eta: '',
    notes: '',
    procurementOfficerId: '',
    warehouseOfficerId: '',
    customsOfficerId: '',
    deliveryOfficerId: ''
  });

  const [formItems, setFormItems] = useState<Array<{
    itemName: string;
    category: string;
    quantity: number;
    unit: string;
    unitPrice: string;
    isExternallyProcured: boolean;
    notes: string;
  }>>([
    {
      itemName: 'بطاطس طازجة (فرز أول)',
      category: 'PROVISIONS',
      quantity: 500,
      unit: 'كجم',
      unitPrice: '',
      isExternallyProcured: true,
      notes: 'شراء من سوق الجملة / المورد'
    },
    {
      itemName: 'فلاتر زيت محرك بحري',
      category: 'DECK_ENGINE',
      quantity: 4,
      unit: 'قطعة',
      unitPrice: '',
      isExternallyProcured: false,
      notes: 'من مخزن بورسعيد'
    }
  ]);

  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Counters
  const counts = useMemo(() => {
    return {
      all: shipments.length,
      new: shipments.filter((s) => s.currentStage === 'NEW').length,
      procurement: shipments.filter((s) => s.currentStage === 'EXTERNAL_PROCUREMENT').length,
      warehouse: shipments.filter((s) => s.currentStage === 'WAREHOUSE_PREPARATION').length,
      clearance: shipments.filter((s) => s.currentStage === 'PORT_CUSTOMS_CLEARANCE').length,
      transit: shipments.filter((s) => s.currentStage === 'IN_TRANSIT_TO_BERTH').length,
      delivered: shipments.filter((s) => s.currentStage === 'DELIVERED_TO_VESSEL').length
    };
  }, [shipments]);

  // Filtered shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      if (activeTab !== 'ALL' && s.currentStage !== activeTab) {
        return false;
      }
      if (onlyMyTasks) {
        const isMine =
          s.coordinatorId === currentUserId ||
          s.procurementOfficerId === currentUserId ||
          s.warehouseOfficerId === currentUserId ||
          s.customsOfficerId === currentUserId ||
          s.deliveryOfficerId === currentUserId;
        if (!isMine) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches =
          s.vesselName.toLowerCase().includes(query) ||
          s.trackingNumber.toLowerCase().includes(query) ||
          s.customerName.toLowerCase().includes(query) ||
          (s.berthLocation && s.berthLocation.toLowerCase().includes(query)) ||
          s.items.some((item) => item.itemName.toLowerCase().includes(query));
        if (!matches) return false;
      }
      return true;
    });
  }, [shipments, activeTab, onlyMyTasks, searchQuery, currentUserId]);

  const handleAddItemRow = () => {
    setFormItems((prev) => [
      ...prev,
      {
        itemName: '',
        category: 'PROVISIONS',
        quantity: 1,
        unit: 'كجم',
        unitPrice: '',
        isExternallyProcured: false,
        notes: ''
      }
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vesselName.trim() || !formData.customerName.trim()) {
      alert(isAr ? 'يرجى إدخال اسم السفينة واسم العميل / الوكيل الملاحي' : 'Please provide vessel and customer name');
      return;
    }

    if (formItems.some((i) => !i.itemName.trim())) {
      alert(isAr ? 'يرجى التأكد من كتابة اسم كل صنف مطلوب' : 'Please provide item names for all rows');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: formItems
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create shipment order');
      }

      // Re-fetch to get complete relations
      const freshRes = await fetch('/api/shipments');
      const freshData = await freshRes.json();
      if (freshData.shipments) {
        setShipments(freshData.shipments);
      }

      setIsCreateOpen(false);
      setFormData({
        vesselName: '',
        vesselImo: '',
        berthLocation: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        eta: '',
        notes: '',
        procurementOfficerId: '',
        warehouseOfficerId: '',
        customsOfficerId: '',
        deliveryOfficerId: ''
      });
      alert(isAr ? 'تم تسجيل طلب التموين وإرسال الإشعارات للمكلفين بنجاح!' : 'Shipment order created and officers notified!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const openAdvanceModal = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    // Suggest the natural next stage
    const currentIdx = STAGES.findIndex((st) => st.key === shipment.currentStage);
    if (currentIdx !== -1 && currentIdx < STAGES.length - 1) {
      setNextStage(STAGES[currentIdx + 1].key);
    } else {
      setNextStage(shipment.currentStage);
    }
    setStageNotes('');
    setReferenceDoc('');
    setIsAdvancing(true);
  };

  const handleAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShipment) return;

    setIsSubmittingStage(true);
    try {
      const res = await fetch(`/api/shipments/${selectedShipment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_stage',
          toStage: nextStage,
          notes: stageNotes,
          referenceDoc
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update stage');
      }

      // Re-fetch
      const freshRes = await fetch('/api/shipments');
      const freshData = await freshRes.json();
      if (freshData.shipments) {
        setShipments(freshData.shipments);
      }

      setIsAdvancing(false);
      setSelectedShipment(null);
      alert(isAr ? 'تم تحديث مرحلة الشحنة وإشعار الموظف المسؤول عن المرحلة التالية!' : 'Stage advanced and next officer notified!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingStage(false);
    }
  };

  const toggleItemStatus = async (shipmentId: string, itemId: string, field: 'isPrepared' | 'isExternallyProcured', currentVal: boolean) => {
    try {
      const res = await fetch(`/api/shipments/${shipmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_item',
          itemId,
          [field]: !currentVal
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to update item');
      }

      setShipments((prev) =>
        prev.map((s) => {
          if (s.id !== shipmentId) return s;
          return {
            ...s,
            items: s.items.map((it) => (it.id === itemId ? { ...it, [field]: !currentVal } : it))
          };
        })
      );
    } catch (err: any) {
      alert(err.message);
    }
  };

  const getStageIndex = (stage: ShipmentStage) => {
    return STAGES.findIndex((st) => st.key === stage);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <span>🚢</span>
            <span>{isAr ? 'شحنات وتموين السفن (Seaways Operations)' : 'Shipments & Vessel Supply'}</span>
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {isAr
              ? 'تتبع طلبات تموين السفن بالمواد الغذائية والمؤن وقطع الغيار، وإشعار مسؤولي التوريد والمخزن والتسليم لحظياً.'
              : 'Track marine provisions, external sourcing, customs clearance, and vessel delivery with automated team notifications.'}
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-lg focus:outline-none"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{isAr ? 'تسجيل طلب تموين جديد' : 'New Supply Order'}</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`rounded-2xl border p-4 text-start transition-all ${
            activeTab === 'ALL'
              ? 'border-blue-500 bg-blue-50/80 shadow-sm ring-2 ring-blue-500/20'
              : 'border-stone-200/80 bg-white hover:border-stone-300'
          }`}
        >
          <div className="text-xs font-semibold text-stone-500">{isAr ? 'إجمالي الطلبات' : 'All Orders'}</div>
          <div className="mt-1 text-2xl font-black text-stone-900">{counts.all}</div>
        </button>

        <button
          onClick={() => setActiveTab('NEW')}
          className={`rounded-2xl border p-4 text-start transition-all ${
            activeTab === 'NEW'
              ? 'border-amber-500 bg-amber-50/80 shadow-sm ring-2 ring-amber-500/20'
              : 'border-stone-200/80 bg-white hover:border-stone-300'
          }`}
        >
          <div className="text-xs font-semibold text-amber-700">📝 {isAr ? 'طلب جديد' : 'New'}</div>
          <div className="mt-1 text-2xl font-black text-amber-900">{counts.new}</div>
        </button>

        <button
          onClick={() => setActiveTab('EXTERNAL_PROCUREMENT')}
          className={`rounded-2xl border p-4 text-start transition-all ${
            activeTab === 'EXTERNAL_PROCUREMENT'
              ? 'border-purple-500 bg-purple-50/80 shadow-sm ring-2 ring-purple-500/20'
              : 'border-stone-200/80 bg-white hover:border-stone-300'
          }`}
        >
          <div className="text-xs font-semibold text-purple-700">🛒 {isAr ? 'شراء وتوريد' : 'Procuring'}</div>
          <div className="mt-1 text-2xl font-black text-purple-900">{counts.procurement}</div>
        </button>

        <button
          onClick={() => setActiveTab('WAREHOUSE_PREPARATION')}
          className={`rounded-2xl border p-4 text-start transition-all ${
            activeTab === 'WAREHOUSE_PREPARATION'
              ? 'border-indigo-500 bg-indigo-50/80 shadow-sm ring-2 ring-indigo-500/20'
              : 'border-stone-200/80 bg-white hover:border-stone-300'
          }`}
        >
          <div className="text-xs font-semibold text-indigo-700">📦 {isAr ? 'تجهيز المخزن' : 'Packing'}</div>
          <div className="mt-1 text-2xl font-black text-indigo-900">{counts.warehouse}</div>
        </button>

        <button
          onClick={() => setActiveTab('IN_TRANSIT_TO_BERTH')}
          className={`rounded-2xl border p-4 text-start transition-all ${
            activeTab === 'IN_TRANSIT_TO_BERTH'
              ? 'border-sky-500 bg-sky-50/80 shadow-sm ring-2 ring-sky-500/20'
              : 'border-stone-200/80 bg-white hover:border-stone-300'
          }`}
        >
          <div className="text-xs font-semibold text-sky-700">🚚 {isAr ? 'في الطريق للرصيف' : 'In Transit'}</div>
          <div className="mt-1 text-2xl font-black text-sky-900">{counts.transit}</div>
        </button>

        <button
          onClick={() => setActiveTab('DELIVERED_TO_VESSEL')}
          className={`rounded-2xl border p-4 text-start transition-all ${
            activeTab === 'DELIVERED_TO_VESSEL'
              ? 'border-emerald-500 bg-emerald-50/80 shadow-sm ring-2 ring-emerald-500/20'
              : 'border-stone-200/80 bg-white hover:border-stone-300'
          }`}
        >
          <div className="text-xs font-semibold text-emerald-700">⚓ {isAr ? 'تم التسليم' : 'Delivered'}</div>
          <div className="mt-1 text-2xl font-black text-emerald-900">{counts.delivered}</div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-stone-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث باسم السفينة، رقم التتبع، الوكيل، أو الصنف...' : 'Search vessel, tracking ID, agent, item...'}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 py-2.5 ps-10 pe-4 text-sm text-stone-900 placeholder-stone-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyMyTasks}
              onChange={(e) => setOnlyMyTasks(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-semibold text-stone-700">
              {isAr ? 'عرض الشحنات المكلفة لحسابي فقط 👤' : 'Assigned to my account only 👤'}
            </span>
          </label>
        </div>
      </Card>

      {/* Shipments List */}
      <div className="space-y-4">
        {filteredShipments.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <div className="text-5xl">⚓</div>
            <h3 className="mt-4 text-lg font-bold text-stone-800">
              {isAr ? 'لا توجد شحنات مطابقة' : 'No shipments found'}
            </h3>
            <p className="mt-1 text-sm text-stone-500 max-w-sm">
              {isAr
                ? 'لم يتم العثور على شحنات بالمعايير المحددة. جرب تغيير الفلتر أو تسجيل طلب تموين جديد.'
                : 'No shipments match your criteria. Try adjusting the filters or create a new order.'}
            </p>
          </Card>
        ) : (
          filteredShipments.map((shipment) => {
            const currentIdx = getStageIndex(shipment.currentStage);
            const isCompleted = shipment.currentStage === 'DELIVERED_TO_VESSEL';

            return (
              <Card key={shipment.id} className="overflow-hidden border border-stone-200/90 hover:border-stone-300 transition-all">
                <div className="p-5">
                  {/* Top Bar of Card */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-stone-100 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xl font-black text-stone-900 tracking-tight">
                          🚢 {shipment.vesselName}
                        </span>
                        {shipment.vesselImo && (
                          <Badge tone="stone">
                            IMO: {shipment.vesselImo}
                          </Badge>
                        )}
                        <span
                          onClick={() => handleCopy(shipment.trackingNumber)}
                          className="cursor-pointer inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-xs font-mono font-bold text-stone-700 hover:bg-stone-200 transition-colors"
                          title="انقر لنسخ كود التتبع"
                        >
                          <span>{shipment.trackingNumber}</span>
                          <span>{copiedId === shipment.trackingNumber ? '✓' : '📋'}</span>
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-stone-500">
                        {shipment.berthLocation && (
                          <span className="flex items-center gap-1 font-medium text-stone-700">
                            📍 <span>{shipment.berthLocation}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          👤 <span>{shipment.customerName}</span>
                          {shipment.customerPhone && <span className="text-stone-400">({shipment.customerPhone})</span>}
                        </span>
                        <span>
                          📅 {isAr ? 'تاريخ التسجيل:' : 'Created:'} {shortDate(shipment.createdAt)}
                        </span>
                        {shipment.eta && (
                          <span className="text-blue-700 font-medium">
                            ⏱️ {isAr ? 'وصول متوقع (ETA):' : 'ETA:'} {shortDate(shipment.eta)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        onClick={() => setTimelineModalShipment(shipment)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors"
                      >
                        <span>📜</span>
                        <span>{isAr ? 'سجل المراحل' : 'Stage History'}</span>
                      </button>

                      <button
                        onClick={() => openAdvanceModal(shipment)}
                        disabled={isCompleted}
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800 cursor-default'
                            : 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                        }`}
                      >
                        <span>{isCompleted ? '✓' : '➡️'}</span>
                        <span>
                          {isCompleted
                            ? isAr
                              ? 'تم التسليم بنجاح'
                              : 'Delivered'
                            : isAr
                            ? 'تحديث وتمرير المرحلة'
                            : 'Advance Stage'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Visual Stepper */}
                  <div className="my-5 overflow-x-auto py-2">
                    <div className="flex items-center justify-between min-w-[620px] px-2">
                      {STAGES.map((st, idx) => {
                        const isCurrent = st.key === shipment.currentStage;
                        const isPassed = currentIdx > idx;

                        return (
                          <div key={st.key} className="flex-1 flex flex-col items-center relative">
                            {/* Connecting line */}
                            {idx < STAGES.length - 1 && (
                              <div
                                className={`absolute top-4 start-1/2 w-full h-1 -z-0 transition-colors ${
                                  currentIdx > idx ? 'bg-emerald-500' : 'bg-stone-200'
                                }`}
                              />
                            )}

                            {/* Node Icon */}
                            <div
                              className={`z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all shadow-sm ${
                                isCurrent
                                  ? 'bg-blue-600 text-white ring-4 ring-blue-100 scale-110'
                                  : isPassed
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-stone-100 text-stone-400 border border-stone-200'
                              }`}
                            >
                              {isPassed ? '✓' : st.icon}
                            </div>

                            {/* Label */}
                            <span
                              className={`mt-2 text-[11px] font-bold text-center leading-tight ${
                                isCurrent
                                  ? 'text-blue-700'
                                  : isPassed
                                  ? 'text-emerald-700'
                                  : 'text-stone-400'
                              }`}
                            >
                              {isAr ? st.labelAr : st.labelEn}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Items List Checklist */}
                  <div className="rounded-xl border border-stone-200/80 bg-stone-50/60 p-3.5">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                        <span>📦</span>
                        <span>
                          {isAr
                            ? `الأصناف المطلوبة للتموين (${shipment.items.length})`
                            : `Supply Requisition Items (${shipment.items.length})`}
                        </span>
                      </span>
                      <span className="text-xs text-stone-500 font-medium">
                        {isAr
                          ? 'يمكنك وضع علامة تم الشراء أو تم التجهيز'
                          : 'Click checkbox to toggle prepared / procured'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {shipment.items.map((item) => (
                        <div
                          key={item.id}
                          className={`flex items-start justify-between rounded-lg border p-2.5 text-xs transition-colors ${
                            item.isPrepared
                              ? 'border-emerald-200 bg-emerald-50/70'
                              : 'border-stone-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={item.isPrepared}
                              onChange={() =>
                                toggleItemStatus(shipment.id, item.id, 'isPrepared', item.isPrepared)
                              }
                              className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                              title={isAr ? 'تم التجهيز' : 'Prepared'}
                            />
                            <div>
                              <div
                                className={`font-bold ${
                                  item.isPrepared ? 'line-through text-stone-500' : 'text-stone-900'
                                }`}
                              >
                                {item.itemName}
                              </div>
                              <div className="text-[11px] text-stone-500 mt-0.5">
                                {item.quantity} {item.unit || ''}
                                {item.notes ? ` • ${item.notes}` : ''}
                              </div>
                            </div>
                          </div>

                          {item.isExternallyProcured && (
                            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                              {isAr ? 'توريد خارجي' : 'External'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Assigned Officers Pills */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 text-xs">
                    <span className="font-bold text-stone-500 text-[11px]">
                      {isAr ? 'المكلفون بالطلب:' : 'Assigned Team:'}
                    </span>

                    {shipment.procurementOfficer && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-purple-800 border border-purple-200/60 font-medium">
                        <span>🛒 {isAr ? 'المشتريات:' : 'Procurement:'}</span>
                        <span className="font-bold">{shipment.procurementOfficer.name}</span>
                      </span>
                    )}

                    {shipment.warehouseOfficer && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-indigo-800 border border-indigo-200/60 font-medium">
                        <span>📦 {isAr ? 'المخزن والتجهيز:' : 'Warehouse:'}</span>
                        <span className="font-bold">{shipment.warehouseOfficer.name}</span>
                      </span>
                    )}

                    {shipment.customsOfficer && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800 border border-amber-200/60 font-medium">
                        <span>🛂 {isAr ? 'تصريح الميناء:' : 'Customs:'}</span>
                        <span className="font-bold">{shipment.customsOfficer.name}</span>
                      </span>
                    )}

                    {shipment.deliveryOfficer && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1 text-sky-800 border border-sky-200/60 font-medium">
                        <span>🚚 {isAr ? 'مندوب الرصيف:' : 'Delivery Rep:'}</span>
                        <span className="font-bold">{shipment.deliveryOfficer.name}</span>
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Modal: Create Ship Supply Order */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                  <span>🚢</span>
                  <span>{isAr ? 'تسجيل طلب تموين وشحنة جديدة' : 'New Ship Supply Order'}</span>
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  {isAr
                    ? 'أدخل بيانات السفينة والوكيل والأصناف وعيّن مسؤولي المراحل لإرسال الإشعارات لهم.'
                    : 'Fill vessel details, provisions list, and assign staff members for automated notifications.'}
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {/* Vessel & Agent Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isAr ? 'اسم السفينة *' : 'Vessel Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. M/V Atlantic Star"
                    value={formData.vesselName}
                    onChange={(e) => setFormData({ ...formData, vesselName: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isAr ? 'رقم الرصيف / الميناء' : 'Berth / Port'}
                  </label>
                  <input
                    type="text"
                    placeholder="رصيف 14 ميناء بورسعيد"
                    value={formData.berthLocation}
                    onChange={(e) => setFormData({ ...formData, berthLocation: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isAr ? 'رقم المنظمة البحرية (IMO)' : 'Vessel IMO / Call sign'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9845120"
                    value={formData.vesselImo}
                    onChange={(e) => setFormData({ ...formData, vesselImo: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isAr ? 'اسم العميل / الوكيل الملاحي *' : 'Customer / Agent *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="أدميرال للتوكيلات الملاحية"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isAr ? 'رقم هاتف الوكيل / القبطان' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    placeholder="010XXXXXXXX"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {isAr ? 'وقت الوصول المتوقع (ETA)' : 'ETA Date'}
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.eta}
                    onChange={(e) => setFormData({ ...formData, eta: e.target.value })}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-stone-800">
                    {isAr ? 'الأصناف والمؤن المطلوبة (بطاطس، خضروات، فلاتر، قطع غيار)' : 'Provisions & Spare Parts'}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="rounded-lg bg-stone-200 px-2.5 py-1 text-xs font-bold text-stone-800 hover:bg-stone-300 transition-colors"
                  >
                    + {isAr ? 'إضافة صنف' : 'Add Item'}
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pe-1">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-xl bg-white p-2 border border-stone-200 text-xs">
                      <input
                        type="text"
                        required
                        placeholder={isAr ? 'اسم الصنف (مثل بطاطس، بصل، فلاتر زيت)' : 'Item name'}
                        value={item.itemName}
                        onChange={(e) => {
                          const updated = [...formItems];
                          updated[idx].itemName = e.target.value;
                          setFormItems(updated);
                        }}
                        className="flex-1 rounded-lg border border-stone-200 px-2.5 py-1.5 focus:border-blue-500 focus:outline-none"
                      />

                      <select
                        value={item.category}
                        onChange={(e) => {
                          const updated = [...formItems];
                          updated[idx].category = e.target.value;
                          setFormItems(updated);
                        }}
                        className="rounded-lg border border-stone-200 px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="PROVISIONS">{isAr ? 'أغذية ومؤن' : 'Provisions'}</option>
                        <option value="DECK_ENGINE">{isAr ? 'قطع ومعدات' : 'Deck & Engine'}</option>
                        <option value="SAFETY">{isAr ? 'أمن وسلامة' : 'Safety Stores'}</option>
                        <option value="BONDED">{isAr ? 'بوندد ستورز' : 'Bonded Stores'}</option>
                      </select>

                      <input
                        type="number"
                        step="any"
                        min="0.1"
                        required
                        placeholder="الكمية"
                        value={item.quantity}
                        onChange={(e) => {
                          const updated = [...formItems];
                          updated[idx].quantity = Number(e.target.value);
                          setFormItems(updated);
                        }}
                        className="w-16 rounded-lg border border-stone-200 px-2 py-1.5 text-center focus:border-blue-500 focus:outline-none"
                      />

                      <input
                        type="text"
                        placeholder="الوحدة"
                        value={item.unit}
                        onChange={(e) => {
                          const updated = [...formItems];
                          updated[idx].unit = e.target.value;
                          setFormItems(updated);
                        }}
                        className="w-16 rounded-lg border border-stone-200 px-2 py-1.5 text-center focus:border-blue-500 focus:outline-none"
                      />

                      <label className="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap text-purple-700 font-semibold">
                        <input
                          type="checkbox"
                          checked={item.isExternallyProcured}
                          onChange={(e) => {
                            const updated = [...formItems];
                            updated[idx].isExternallyProcured = e.target.checked;
                            setFormItems(updated);
                          }}
                          className="h-3.5 w-3.5 rounded border-stone-300 text-purple-600"
                        />
                        <span>{isAr ? 'توريد خارجي' : 'External'}</span>
                      </label>

                      {formItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="text-stone-400 hover:text-red-500 px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Staff Assignments */}
              <div className="rounded-2xl border border-stone-200 bg-blue-50/40 p-4 space-y-3">
                <div className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <span>👥</span>
                  <span>{isAr ? 'تعيين طاقم العمل الداخلي (سيصلهم إشعار فوري في حساباتهم)' : 'Assign Internal Staff (Automated in-app alerts)'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      🛒 {isAr ? 'مسؤول التوريد الخارجي والمشتريات' : 'External Sourcing Officer'}
                    </label>
                    <select
                      value={formData.procurementOfficerId}
                      onChange={(e) => setFormData({ ...formData, procurementOfficerId: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">{isAr ? '-- غير محدد --' : '-- Unassigned --'}</option>
                      {staff.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      📦 {isAr ? 'مسؤول المخزن وتعبئة المؤن' : 'Warehouse Packing Keeper'}
                    </label>
                    <select
                      value={formData.warehouseOfficerId}
                      onChange={(e) => setFormData({ ...formData, warehouseOfficerId: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">{isAr ? '-- غير محدد --' : '-- Unassigned --'}</option>
                      {staff.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      🛂 {isAr ? 'مسؤول تصاريح الميناء والجمارك' : 'Port & Customs Officer'}
                    </label>
                    <select
                      value={formData.customsOfficerId}
                      onChange={(e) => setFormData({ ...formData, customsOfficerId: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">{isAr ? '-- غير محدد --' : '-- Unassigned --'}</option>
                      {staff.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      🚚 {isAr ? 'مندوب التسليم على الرصيف والسفينة' : 'Berth Delivery Rep'}
                    </label>
                    <select
                      value={formData.deliveryOfficerId}
                      onChange={(e) => setFormData({ ...formData, deliveryOfficerId: e.target.value })}
                      className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">{isAr ? '-- غير محدد --' : '-- Unassigned --'}</option>
                      {staff.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isAr ? 'ملاحظات إضافية' : 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={isAr ? 'أية تعليمات خاصة بالتسليم أو مواصفات الأصناف...' : 'Delivery instructions...'}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-stone-50"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmittingCreate
                    ? isAr
                      ? 'جاري الحفظ والإشعار...'
                      : 'Saving & Notifying...'
                    : isAr
                    ? 'تسجيل الطلب وتكليف الطاقم'
                    : 'Save & Assign Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Advance Stage */}
      {isAdvancing && selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-stone-900 tracking-tight flex items-center gap-2">
                  <span>➡️</span>
                  <span>{isAr ? 'تحديث وتمرير مرحلة الشحنة' : 'Advance Shipment Stage'}</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  🚢 {selectedShipment.vesselName} ({selectedShipment.trackingNumber})
                </p>
              </div>
              <button
                onClick={() => setIsAdvancing(false)}
                className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdvanceSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isAr ? 'المرحلة الجديدة المطلوبة' : 'Target Stage'}
                </label>
                <select
                  value={nextStage}
                  onChange={(e) => setNextStage(e.target.value as ShipmentStage)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-bold text-stone-900 focus:border-blue-500 focus:outline-none"
                >
                  {STAGES.map((st) => (
                    <option key={st.key} value={st.key}>
                      {st.icon} {isAr ? st.labelAr : st.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isAr ? 'رقم الإذن / بوليصة الشحن / تصريح الميناء' : 'Reference / Permit / Bill No.'}
                </label>
                <input
                  type="text"
                  placeholder="e.g. PERMIT-2026-904"
                  value={referenceDoc}
                  onChange={(e) => setReferenceDoc(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isAr ? 'ملاحظات وتفاصيل التحديث' : 'Update Notes'}
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    isAr
                      ? 'مثال: تم شراء البطاطس بالكامل والتعبئة، جاهزة لخروج التصريح...'
                      : 'e.g. Sourcing complete, ready for dispatch...'
                  }
                  value={stageNotes}
                  onChange={(e) => setStageNotes(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
                ℹ️{' '}
                {isAr
                  ? 'سيتم تسجيل الإجراء باسمك، وسيرسل النظام إشعاراً داخلياً فورياً للموظف المكلف بالمرحلة التالية.'
                  : 'Action is logged in your name. Next assigned staff member will be alerted automatically.'}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAdvancing(false)}
                  className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStage}
                  className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmittingStage ? (isAr ? 'جاري التحديث...' : 'Updating...') : isAr ? 'تأكيد التمرير' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Timeline / History */}
      {timelineModalShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-stone-900 tracking-tight flex items-center gap-2">
                  <span>📜</span>
                  <span>{isAr ? 'سجل تتبع الشحنة' : 'Shipment Timeline & Logs'}</span>
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  🚢 {timelineModalShipment.vesselName} ({timelineModalShipment.trackingNumber})
                </p>
              </div>
              <button
                onClick={() => setTimelineModalShipment(null)}
                className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3 pe-1">
              {timelineModalShipment.stageLogs.length === 0 ? (
                <div className="p-6 text-center text-sm text-stone-500">
                  {isAr ? 'لا توجد سجلات مسجلة بعد' : 'No logs recorded yet'}
                </div>
              ) : (
                timelineModalShipment.stageLogs.map((log) => {
                  const stageObj = STAGES.find((st) => st.key === log.toStage);
                  return (
                    <div key={log.id} className="relative ps-6 pb-3 border-s-2 border-stone-200 last:border-s-0">
                      <span className="absolute -start-[9px] top-0 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 ring-4 ring-white" />
                      <div className="rounded-xl border border-stone-200/90 bg-stone-50/70 p-3 text-xs">
                        <div className="flex items-center justify-between font-bold text-stone-900">
                          <span>
                            {stageObj?.icon} {isAr ? stageObj?.labelAr : stageObj?.labelEn}
                          </span>
                          <span className="text-[11px] text-stone-400 font-normal">
                            {shortDate(log.createdAt)}
                          </span>
                        </div>

                        {log.notes && <div className="mt-1 text-stone-700">{log.notes}</div>}

                        {log.referenceDoc && (
                          <div className="mt-1 font-mono text-[11px] text-blue-700">
                            📄 {log.referenceDoc}
                          </div>
                        )}

                        <div className="mt-2 text-[10px] text-stone-400">
                          {isAr ? 'بواسطة:' : 'By:'} {log.performedBy?.name || log.performedBy?.email || 'System'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-stone-100 flex justify-end">
              <button
                onClick={() => setTimelineModalShipment(null)}
                className="rounded-xl bg-stone-100 px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
