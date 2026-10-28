'use client';

import Image from 'next/image';
import Link from 'next/link';
import { type FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ThermalReceipt from '@/components/receipts/ThermalReceipt';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { getCustomerDisplayName } from '@/lib/customers';
import { dateTime, money } from '@/lib/format';
import { roundCurrency } from '@/lib/inventory';
import {
  buildOfflineCheckoutDraftStorageKey,
  buildOfflineSalesQueueStorageKey,
  createOfflineClientRequestId,
  createOfflineReceiptNumber,
  getStockSnapshotAgeMinutes,
  readLocalStorageValue,
  removeLocalStorageValue,
  writeLocalStorageValue,
  type OfflineCheckoutDraft,
  type OfflineQueuedSale,
  type OfflineQueuedSaleItem,
  type OfflineReceiptSale
} from '@/lib/offline-checkout';
import {
  getPaymentSummary,
  getQuickCashAmounts,
  getSalePaymentSummaryLabel,
  normalizePaymentInput,
  PAYMENT_METHODS,
  type PaymentMethod,
  requiresReferenceNumber,
  validatePaymentsForSale
} from '@/lib/payments';
import { calculateTaxBreakdown, sanitizeDefaultPaymentMethods, type TaxModeValue } from '@/lib/shop-settings';
import { useLocalizedPath, useTranslations, useLocale } from '@/lib/i18n/client';

type Category = { id: string; name: string };
type Product = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  barcode: string | null;
  sku: string | null;
  price: string;
  stockQty: number;
  categoryId: string | null;
  imageUrl: string | null;
  category?: { id: string; name: string } | null;
  // siblings = other variants of the same product (for picker popup)
  siblings?: Product[];
};
type CartItem = Product & { qty: number };
type Customer = {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  loyaltyBalance: number;
  receivableBalance: string;
  lastPurchaseAt: string | null;
};
type ScanFeedback = { tone: 'success' | 'error'; message: string } | null;
type PaymentLine = {
  id: string;
  method: PaymentMethod;
  amount: string;
  referenceNumber: string;
  pullAmount?: string;
  adminFees?: string;
};
type ParkedSale = {
  id: string;
  shopId: string;
  cashierUserId: string;
  customerId: string | null;
  cashierName: string;
  cashierEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  title: string | null;
  quoteReference: string | null;
  type: 'SAVED_CART' | 'QUOTE';
  notes: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  status: 'HELD' | 'RESUMED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  resumedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: Array<{
    id: string;
    productId: string;
    productVariantId: string | null;
    productName: string;
    variantLabel: string | null;
    qty: number;
    unitPrice: string;
    lineTotal: string;
    createdAt: string;
  }>;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createPaymentLine(method: PaymentMethod): PaymentLine {
  return { id: crypto.randomUUID(), method, amount: '', referenceNumber: '', pullAmount: '', adminFees: '' };
}

function buildInitialPaymentLines(defaultPaymentMethods: PaymentMethod[], canAcceptCash: boolean) {
  const preferredMethods = sanitizeDefaultPaymentMethods(defaultPaymentMethods).filter(
    (method) => canAcceptCash || method !== 'كاش'
  );

  return preferredMethods.length
    ? preferredMethods.map(createPaymentLine)
    : [createPaymentLine(canAcceptCash ? 'كاش' : 'فيزا')];
}

function toDateInputValue(value = new Date()) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function getOptionDisplayName(product: Pick<Product, 'name' | 'variantLabel'>) {
  return product.variantLabel ? `${product.name} - ${product.variantLabel}` : product.name;
}

function getReservedQtyForProduct(items: CartItem[], productId: string, exceptOptionId?: string) {
  return items.reduce((sum, item) => {
    if (item.productId !== productId) return sum;
    if (exceptOptionId && item.id === exceptOptionId) return sum;
    return sum + item.qty;
  }, 0);
}

function getQueuedSaleStatusLabel(status: OfflineQueuedSale['status']) {
  switch (status) {
    case 'SYNCING':
      return 'Syncing';
    case 'CONFLICT':
      return 'Needs review';
    case 'ERROR':
      return 'Retry needed';
    default:
      return 'Queued';
  }
}

function getQueuedSaleStatusTone(status: OfflineQueuedSale['status']) {
  switch (status) {
    case 'SYNCING':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'CONFLICT':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'ERROR':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-blue-200 bg-blue-50 text-blue-700';
  }
}

function getQueueItemOptionId(item: Pick<OfflineQueuedSaleItem, 'productId' | 'variantId'>) {
  return item.variantId ?? item.productId;
}

function hasMeaningfulDraft(input: OfflineCheckoutDraft) {
  return (
    input.cart.length > 0 ||
    input.notes.trim().length > 0 ||
    input.customerName.trim().length > 0 ||
    input.customerPhone.trim().length > 0 ||
    input.customerSearch.trim().length > 0 ||
    input.selectedCustomerId !== null ||
    Number(input.discountAmount || 0) > 0 ||
    Number(input.loyaltyPointsToRedeem || 0) > 0 ||
    input.isCreditSale ||
    input.payments.some((payment) => payment.amount.trim().length > 0 || payment.referenceNumber.trim().length > 0)
  );
}

type RestoreNote =
  | { type: 'skipped_unavailable' }
  | { type: 'skipped_stock'; name: string }
  | { type: 'reduced'; name: string; qty: number };

function buildInitialCheckoutPersistenceState({
  draftStorageKey,
  queueStorageKey,
  products,
  defaultPaymentMethods,
  canAcceptCash
}: {
  draftStorageKey: string;
  queueStorageKey: string;
  products: Product[];
  defaultPaymentMethods: PaymentMethod[];
  canAcceptCash: boolean;
}) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const fallbackPayments = buildInitialPaymentLines(defaultPaymentMethods, canAcceptCash);
  const restored = {
    queuedSales: readLocalStorageValue<OfflineQueuedSale[]>(queueStorageKey, []),
    selectedCategory: '',
    query: '',
    cart: [] as CartItem[],
    discountAmount: '0',
    customerSearch: '',
    selectedCustomerId: null as string | null,
    customerName: '',
    customerPhone: '',
    loyaltyPointsToRedeem: '0',
    isCreditSale: false,
    creditDueDate: toDateInputValue(),
    notes: '',
    payments: fallbackPayments,
    draftRestored: false,
    restoreNotes: [] as RestoreNote[]
  };

  const draft = readLocalStorageValue<OfflineCheckoutDraft | null>(draftStorageKey, null);
  if (draft?.version !== 1) {
    return restored;
  }

  const restoredCart: CartItem[] = [];
  const restoreNotes: RestoreNote[] = [];

  for (const entry of draft.cart) {
    const product = productMap.get(entry.optionId);
    if (!product) {
      restoreNotes.push({ type: 'skipped_unavailable' });
      continue;
    }

    const reservedQty = getReservedQtyForProduct(restoredCart, product.productId);
    const availableQty = Math.max(product.stockQty - reservedQty, 0);
    const nextQty = Math.min(entry.qty, availableQty);

    if (nextQty <= 0) {
      restoreNotes.push({ type: 'skipped_stock', name: product.name });
      continue;
    }

    if (nextQty < entry.qty) {
      restoreNotes.push({ type: 'reduced', name: product.name, qty: nextQty });
    }

    restoredCart.push({ ...product, qty: nextQty });
  }

  restored.selectedCategory = draft.selectedCategory;
  restored.query = draft.query;
  restored.cart = restoredCart;
  restored.discountAmount = draft.discountAmount;
  restored.customerSearch = draft.customerSearch;
  restored.selectedCustomerId = draft.selectedCustomerId;
  restored.customerName = draft.customerName;
  restored.customerPhone = draft.customerPhone;
  restored.loyaltyPointsToRedeem = draft.loyaltyPointsToRedeem;
  restored.isCreditSale = draft.isCreditSale;
  restored.creditDueDate = draft.creditDueDate || toDateInputValue();
  restored.notes = draft.notes;
  restored.payments = draft.payments.length
    ? draft.payments.map((payment) => ({
        id: payment.id || crypto.randomUUID(),
        method: payment.method,
        amount: payment.amount,
        referenceNumber: payment.referenceNumber,
        pullAmount: payment.pullAmount || '',
        adminFees: payment.adminFees || ''
      }))
    : fallbackPayments;

  if (restoredCart.length) {
    restored.draftRestored = true;
  }

  restored.restoreNotes = restoreNotes;

  return restored;
}

async function uploadProductImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/uploads/products', {
    method: 'POST',
    body: formData
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || typeof payload?.imageUrl !== 'string') {
    throw new Error(payload?.error || 'Unable to upload image.');
  }

  return payload.imageUrl as string;
}

export default function CheckoutClient({
  products,
  categories,
  customers,
  taxRate,
  taxMode,
  currencySymbol,
  defaultPaymentMethods,
  barcodeScannerNotes,
  cashierName,
  hasActiveCashSession,
  activeCashSessionId,
  shopId,
  userId,
  offlineStockStrict,
  offlineStockMaxAgeMinutes,
  stockSnapshotCapturedAt,
  shop,
  receiptHeader,
  receiptFooter,
  receiptWidth,
  initialParkedSales,
  shopType,
  staff
}: {
  products: Product[];
  categories: Category[];
  customers: Customer[];
  taxRate: number;
  taxMode: TaxModeValue;
  currencySymbol: string;
  defaultPaymentMethods: PaymentMethod[];
  barcodeScannerNotes: string;
  cashierName: string;
  hasActiveCashSession: boolean;
  activeCashSessionId: string | null;
  shopId: string;
  userId: string;
  offlineStockStrict: boolean;
  offlineStockMaxAgeMinutes: number;
  stockSnapshotCapturedAt: string;
  shop: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  receiptHeader: string | null;
  receiptFooter: string | null;
  receiptWidth: '58mm' | '80mm';
  initialParkedSales: ParkedSale[];
  shopType?: string;
  staff: Array<{ id: string; name: string; role: string }>;
}) {
  const { locale } = useLocale();
  const isAr = locale === 'ar';
  const router = useRouter();
  const t = useTranslations('register');
  const tCheckout = useTranslations('checkoutPage');
  const lp = useLocalizedPath();
  const searchParams = useSearchParams();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<CartItem[]>([]);
  const queuedSalesRef = useRef<OfflineQueuedSale[]>([]);
  const syncInFlightRef = useRef(false);
  const retryTimerRef = useRef<number | null>(null);
  const handledSearchParamResumeRef = useRef<string | null>(null);
  const canAcceptCash = hasActiveCashSession;
  const draftStorageKey = useMemo(
    () => buildOfflineCheckoutDraftStorageKey(shopId, userId),
    [shopId, userId]
  );
  const queueStorageKey = useMemo(
    () => buildOfflineSalesQueueStorageKey(shopId, userId),
    [shopId, userId]
  );
  const [initialLocalState] = useState(() =>
    buildInitialCheckoutPersistenceState({
      draftStorageKey,
      queueStorageKey,
      products,
      defaultPaymentMethods,
      canAcceptCash
    })
  );

  const [selectedCategory, setSelectedCategory] = useState(initialLocalState.selectedCategory);
  const [query, setQuery] = useState(initialLocalState.query);
  const [scanQuery, setScanQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>(initialLocalState.cart);
  const [discountAmount, setDiscountAmount] = useState(initialLocalState.discountAmount);
  const [customerSearch, setCustomerSearch] = useState(initialLocalState.customerSearch);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialLocalState.selectedCustomerId);
  const [customerName, setCustomerName] = useState(initialLocalState.customerName);
  const [customerPhone, setCustomerPhone] = useState(initialLocalState.customerPhone);
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(initialLocalState.loyaltyPointsToRedeem);
  const [isCreditSale, setIsCreditSale] = useState(initialLocalState.isCreditSale);
  const [creditDueDate, setCreditDueDate] = useState(initialLocalState.creditDueDate);
  const [notes, setNotes] = useState(initialLocalState.notes);
  const [payments, setPayments] = useState<PaymentLine[]>(initialLocalState.payments);
  const [installmentCashbackAmount, setInstallmentCashbackAmount] = useState('0');
  const [salesmanId, setSalesmanId] = useState('');
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>(initialParkedSales);
  const [queuedSales, setQueuedSales] = useState<OfflineQueuedSale[]>(initialLocalState.queuedSales);
  const [activeReceiptId, setActiveReceiptId] = useState<string | null>(null);
  const [lastSyncedSale, setLastSyncedSale] = useState<{
    id: string;
    saleNumber: string;
    receiptNumber: string;
    localReceiptNumber: string;
  } | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [error, setError] = useState('');
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(null);
  const [parkedFeedback, setParkedFeedback] = useState('');

  const [variantPickerProductId, setVariantPickerProductId] = useState<string | null>(null);

  useEffect(() => {
    if (initialLocalState.draftRestored) {
      let msg = tCheckout('restoredDraft');
      if (initialLocalState.restoreNotes?.length) {
        const notes = initialLocalState.restoreNotes
          .map((note) => {
            if (note.type === 'skipped_unavailable') {
              return tCheckout('restoreNoteSkippedUnavailable');
            } else if (note.type === 'skipped_stock') {
              return tCheckout('restoreNoteSkippedStock', { name: note.name });
            } else if (note.type === 'reduced') {
              return tCheckout('restoreNoteReduced', { name: note.name, qty: note.qty });
            }
            return '';
          })
          .filter(Boolean)
          .join(' ');
        msg = `${msg} ${notes}`;
      }
      setParkedFeedback(msg);
    }
  }, [initialLocalState.draftRestored, initialLocalState.restoreNotes, tCheckout]);
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState<'SAVED_CART' | 'QUOTE' | null>(null);
  const [resumeLoadingId, setResumeLoadingId] = useState<string | null>(null);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const hasSearchFilters = Boolean(query.trim() || selectedCategory);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );
  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) {
      return customers.slice(0, 5);
    }

    return customers
      .filter((customer) =>
        [
          getCustomerDisplayName(customer),
          customer.phone ?? '',
          customer.email ?? '',
          customer.businessName ?? '',
          customer.contactPerson ?? ''
        ]
          .join(' ')
          .toLowerCase()
          .includes(term)
      )
      .slice(0, 20);
  }, [customerSearch, customers]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  // Group products by productId so variants of the same product show as one card
  const groupedProducts = useMemo(() => {
    const groups = new Map<string, Product[]>();
    for (const p of products) {
      const key = p.productId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    // Return the first variant per group as the "representative" with siblings attached
    const result: Product[] = [];
    for (const [, group] of groups) {
      const rep = { ...group[0], siblings: group.length > 1 ? group : undefined };
      result.push(rep);
    }
    return result;
  }, [products]);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    return groupedProducts
      .filter((product) => {
        const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
        const matchesTerm =
          !term ||
          [product.name, product.variantLabel ?? '', product.barcode ?? '', product.sku ?? '', product.category?.name ?? '']
            .join(' ')
            .toLowerCase()
            .includes(term);
        return matchesCategory && matchesTerm;
      })
      .slice(0, 30);
  }, [groupedProducts, query, selectedCategory]);

  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const manualDiscount = Number(discountAmount || 0);
  const loyaltyDiscount = Number(loyaltyPointsToRedeem || 0);
  const discount = manualDiscount + loyaltyDiscount;
  const taxPreview = calculateTaxBreakdown({
    subtotal,
    discountAmount: discount,
    taxRate,
    taxMode
  });
  const taxAmount = taxPreview.taxAmount;
  const total = taxPreview.totalAmount;

  const paymentInputs = useMemo(
    () =>
      payments.map((payment) =>
        normalizePaymentInput({
          method: payment.method,
          amount: toNumber(payment.amount),
          referenceNumber: payment.referenceNumber.trim() || null,
          pullAmount: payment.pullAmount ? toNumber(payment.pullAmount) : null,
          adminFees: payment.adminFees ? toNumber(payment.adminFees) : 0
        })
      ),
    [payments]
  );

  const paymentSummary = useMemo(
    () =>
      isCreditSale
        ? {
            totalPaid: 0,
            remainingAmount: total,
            changeDue: 0,
            cashReceived: 0,
            hasCashPayment: false
          }
        : getPaymentSummary(total, paymentInputs),
    [isCreditSale, paymentInputs, total]
  );

  const totalInstallmentSurplus = useMemo(() => {
    return payments.reduce((sum, p) => {
      if (['امان', 'مايلو', 'موجو', 'فاليو', 'كونتاكت'].includes(p.method)) {
        const pull = toNumber(p.pullAmount ?? '');
        const amt = toNumber(p.amount ?? '');
        if (pull > amt) {
          return sum + (pull - amt);
        }
      }
      return sum;
    }, 0);
  }, [payments]);

  const paymentError = useMemo(() => {
    if (isCreditSale) {
      if (!selectedCustomerId) return tCheckout('errorAttachCustomerCredit');
      if (!creditDueDate) return tCheckout('errorCreditDueDate');
      if (
        Number(loyaltyPointsToRedeem) > 0 &&
        selectedCustomer &&
        Number(loyaltyPointsToRedeem) > selectedCustomer.loyaltyBalance
      ) {
        return tCheckout('errorNotEnoughPoints');
      }
      return '';
    }

    if (Number(loyaltyPointsToRedeem) > 0) {
      if (!selectedCustomerId) return tCheckout('errorAttachCustomerLoyalty');
      if (selectedCustomer && Number(loyaltyPointsToRedeem) > selectedCustomer.loyaltyBalance) {
        return tCheckout('errorNotEnoughPoints');
      }
    }

    const paymentValidation = validatePaymentsForSale(total, paymentInputs);
    if (!paymentValidation.ok) {
      const err = paymentValidation.error;
      if (err === 'Add at least one payment line.') {
        return tCheckout('errorAddPaymentLine');
      }
      if (err === 'Each payment amount must be greater than zero.') {
        return tCheckout('errorPaymentAmountPositive');
      }
      if (err.endsWith('payments require a reference number.')) {
        const method = err.split(' ')[0];
        return tCheckout('errorPaymentRefRequired', { method });
      }
      if (err.startsWith('Duplicate') && err.endsWith('reference numbers are not allowed in one sale.')) {
        const method = err.split(' ')[1];
        return tCheckout('errorDuplicateRef', { method });
      }
      if (err === 'Total paid must cover the sale total before checkout can finish.') {
        return tCheckout('errorTotalPaidMustCoverTotal');
      }
      if (err === 'Only cash can exceed the remaining amount when change is due.') {
        return tCheckout('errorOnlyCashChange');
      }
      if (err === 'Non-cash payments must match the sale total exactly.') {
        return tCheckout('errorNonCashMustMatchExact');
      }
      return err;
    }
    return '';
  }, [
    creditDueDate,
    isCreditSale,
    loyaltyPointsToRedeem,
    paymentInputs,
    paymentSummary,
    payments.length,
    selectedCustomer,
    selectedCustomerId,
    total,
    tCheckout
  ]);

  const stockSnapshotAgeMinutes = getStockSnapshotAgeMinutes(stockSnapshotCapturedAt, clock);
  const isStockSnapshotStale = stockSnapshotAgeMinutes > offlineStockMaxAgeMinutes;
  const offlineCheckoutBlocked = !isOnline && offlineStockStrict && isStockSnapshotStale;
  const canCompleteSale =
    cart.length > 0 &&
    !loading &&
    discount >= 0 &&
    discount <= subtotal + taxAmount &&
    !paymentError &&
    !offlineCheckoutBlocked;

  const pendingQueuedSales = queuedSales.filter((sale) => sale.status === 'PENDING');
  const conflictedQueuedSales = queuedSales.filter((sale) => sale.status === 'CONFLICT');
  const failedQueuedSales = queuedSales.filter((sale) => sale.status === 'ERROR');
  const resolvedActiveReceiptId =
    activeReceiptId && queuedSales.some((sale) => sale.id === activeReceiptId)
      ? activeReceiptId
      : queuedSales[0]?.id ?? null;
  const activeReceiptSale = queuedSales.find((sale) => sale.id === resolvedActiveReceiptId) ?? null;

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    queuedSalesRef.current = queuedSales;
  }, [queuedSales]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function focusScanInput(selectText = false) {
    const input = scanInputRef.current;
    if (!input) return;
    input.focus();
    if (selectText) input.select();
  }

  useEffect(() => {
    focusScanInput();
  }, []);

  function resetPayments() {
    setPayments(buildInitialPaymentLines(defaultPaymentMethods, canAcceptCash));
  }
  const clearCartState = () => {
    setCart([]);
    setSelectedCustomerId(null);
    setCustomerSearch('');
    setCustomerName('');
    setCustomerPhone('');
    setDiscountAmount('0');
    setLoyaltyPointsToRedeem('0');
    setIsCreditSale(false);
    setCreditDueDate(toDateInputValue());
    setNotes('');
    setScanQuery('');
    setScanFeedback(null);
    setError('');
    resetPayments();
  };

  function resetCheckoutState() {
    setCart([]);
    setDiscountAmount('0');
    setCustomerSearch('');
    setSelectedCustomerId(null);
    setCustomerName('');
    setCustomerPhone('');
    setLoyaltyPointsToRedeem('0');
    setIsCreditSale(false);
    setCreditDueDate(toDateInputValue());
    setNotes('');
    setScanQuery('');
    setScanFeedback(null);
    setError('');
    setInstallmentCashbackAmount('0');
    setSalesmanId('');
    resetPayments();
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomerId(customer.id);
    setCustomerSearch(getCustomerDisplayName(customer));
    setCustomerName(getCustomerDisplayName(customer));
    setCustomerPhone(customer.phone ?? '');
    setError('');
  }

  function addToCart(product: Product) {
    setError('');
    setParkedFeedback('');
    const existing = cartRef.current.find((item) => item.id === product.id);
    const reservedQty = getReservedQtyForProduct(cartRef.current, product.productId);

    if (existing) {
      if (reservedQty + 1 > product.stockQty) {
        setError(`Cannot oversell. ${product.name} only has ${product.stockQty} in stock.`);
        return false;
      }
      setCart((current) => current.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item)));
      return true;
    }

    if (product.stockQty <= 0) {
      setError(`${product.name} is out of stock.`);
      return false;
    }

    if (reservedQty + 1 > product.stockQty) {
      setError(`Cannot oversell. ${product.name} only has ${product.stockQty} in stock.`);
      return false;
    }

    setCart((current) => [...current, { ...product, qty: 1 }]);
    return true;
  }

  function updateQty(optionId: string, direction: 'increase' | 'decrease') {
    const product = productMap.get(optionId);
    if (!product) return;
    setError('');
    setScanFeedback(null);
    setParkedFeedback('');
    setCart((current) => {
      const existing = current.find((item) => item.id === optionId);
      if (!existing) return current;
      const nextQty = direction === 'increase' ? existing.qty + 1 : existing.qty - 1;
      if (nextQty <= 0) return current.filter((item) => item.id !== optionId);

      const reservedOtherQty = getReservedQtyForProduct(current, product.productId, optionId);
      if (reservedOtherQty + nextQty > product.stockQty) {
        setError(`Cannot oversell. ${product.name} only has ${product.stockQty} in stock.`);
        return current;
      }

      return current.map((item) => (item.id === optionId ? { ...item, qty: nextQty } : item));
    });
  }

  function removeFromCart(optionId: string) {
    setError('');
    setScanFeedback(null);
    setParkedFeedback('');
    setCart((current) => current.filter((item) => item.id !== optionId));
  }

  function updatePrice(optionId: string, newPrice: number) {
    setCart((current) =>
      current.map((item) =>
        item.id === optionId ? { ...item, price: newPrice as any } : item
      )
    );
  }

  function requestClearCart() {
    if (!cart.length || loading || holding) return;
    if (!window.confirm('Clear all items from the current cart?')) return;
    resetCheckoutState();
    focusScanInput();
  }

  function findProductByScan(value: string) {
    const normalizedValue = value.trim();
    const normalizedSku = normalizedValue.toLowerCase();
    return (
      products.find((product) => product.barcode?.trim() === normalizedValue) ??
      products.find((product) => product.sku?.trim().toLowerCase() === normalizedSku) ??
      null
    );
  }

  function handleScanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = scanQuery.trim();
    setError('');
    setParkedFeedback('');
    setScanFeedback(null);
    if (!value) {
      setScanFeedback({ tone: 'error', message: tCheckout('scanErrorEmpty') });
      focusScanInput();
      return false;
    }
    const product = findProductByScan(value);
    if (!product) {
      setScanFeedback({ tone: 'error', message: tCheckout('scanErrorNoMatch', { value }) });
      focusScanInput(true);
      return;
    }
    const added = addToCart(product);
    if (!added) {
      focusScanInput(true);
      return;
    }
    setScanQuery('');
    setScanFeedback({ tone: 'success', message: tCheckout('scanSuccessAdded', { name: getOptionDisplayName(product) }) });
    focusScanInput();
  }

  function updatePaymentLine(lineId: string, patch: Partial<PaymentLine>) {
    setPayments((current) =>
      current.map((payment) => {
        if (payment.id !== lineId) return payment;
        const next = { ...payment, ...patch };
        if (patch.method && !requiresReferenceNumber(patch.method)) next.referenceNumber = '';
        if (patch.method && !['امان', 'مايلو', 'موجو', 'فاليو', 'كونتاكت'].includes(patch.method)) {
          next.pullAmount = '';
          next.adminFees = '';
        }
        return next;
      })
    );
  }

  function addPaymentLine() {
    const nextMethod = canAcceptCash && payments.every((payment) => payment.method !== 'كاش') ? 'كاش' : 'فيزا';
    setPayments((current) => [...current, createPaymentLine(nextMethod)]);
  }

  function removePaymentLine(lineId: string) {
    setPayments((current) => (current.length === 1 ? current : current.filter((payment) => payment.id !== lineId)));
  }

  function getExactAmountForLine(lineId: string) {
    const paidExcludingLine = roundCurrency(
      paymentInputs.reduce((sum, payment, index) => (payments[index]?.id === lineId ? sum : sum + payment.amount), 0)
    );
    return roundCurrency(Math.max(total - paidExcludingLine, 0));
  }

  function setPaymentLineAmount(lineId: string, amount: number) {
    updatePaymentLine(lineId, { amount: amount.toFixed(2) });
  }

  function buildSalePayload(clientRequestId: string, occurredAt: string, includePriceSnapshot: boolean) {
    return {
      clientRequestId,
      occurredAt,
      cashSessionId: activeCashSessionId,
      customerId: selectedCustomerId,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      loyaltyPointsToRedeem: Number(loyaltyPointsToRedeem),
      isCreditSale,
      creditDueDate: isCreditSale ? creditDueDate : null,
      discountAmount: manualDiscount,
      notes: notes || null,
      installmentCashbackAmount: toNumber(installmentCashbackAmount),
      salesmanId: salesmanId || null,
      customerNationalId: null,
      customerNationalIdPhoto: null,
      motorcycleColor: null,
      motorcycleMotorNumber: null,
      motorcycleChassisNumber: null,
      motorcycleChassisPhoto: null,
      motorcycleMotorPhoto: null,
      payments: isCreditSale
        ? []
        : paymentInputs.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
            referenceNumber: payment.referenceNumber ?? null,
            pullAmount: payment.pullAmount,
            adminFees: payment.adminFees
          })),
      items: cart.map((item) => ({
        optionId: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.name,
        variantLabel: item.variantLabel,
        qty: item.qty,
        priceSnapshot: includePriceSnapshot ? roundCurrency(Number(item.price)) : null
      }))
    };
  }

  function buildOfflineReceipt(
    clientRequestId: string,
    localReceiptNumber: string,
    occurredAt: string
  ): OfflineReceiptSale {
    const normalizedPayments = isCreditSale
      ? []
      : paymentInputs.map((payment, index) => ({
          id: payments[index]?.id ?? `${clientRequestId}-${index}`,
          method: payment.method,
          amount: payment.amount.toFixed(2),
          referenceNumber: payment.referenceNumber ?? null,
          createdAt: occurredAt
        }));

    return {
      id: clientRequestId,
      saleNumber: localReceiptNumber,
      receiptNumber: localReceiptNumber,
      paymentMethod: isCreditSale ? 'Customer Credit' : getSalePaymentSummaryLabel(normalizedPayments),
      cashierName,
      customerEmail: selectedCustomer?.email ?? null,
      customerBusinessName: selectedCustomer?.businessName ?? null,
      customerName: customerName || selectedCustomer?.businessName || selectedCustomer?.firstName || null,
      customerPhone: customerPhone || selectedCustomer?.phone || null,
      isCreditSale,
      creditDueDate: isCreditSale ? creditDueDate : null,
      loyaltyPointsEarned: 0,
      loyaltyPointsRedeemed: Number(loyaltyPointsToRedeem),
      loyaltyDiscountAmount: loyaltyDiscount.toFixed(2),
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      discountAmount: discount.toFixed(2),
      totalAmount: total.toFixed(2),
      totalPaid: (isCreditSale ? 0 : paymentSummary.totalPaid).toFixed(2),
      cashReceived: (isCreditSale ? 0 : paymentSummary.cashReceived).toFixed(2),
      changeDue: paymentSummary.changeDue.toFixed(2),
      notes,
      createdAt: occurredAt,
      payments: normalizedPayments,
      items: cart.map((item) => ({
        id: item.id,
        productName: item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name,
        qty: item.qty,
        unitPrice: Number(item.price).toFixed(2),
        lineTotal: roundCurrency(Number(item.price) * item.qty).toFixed(2)
      }))
    };
  }

  function scheduleQueueSync(delayMs = 4_000) {
    if (typeof window === 'undefined' || !window.navigator.onLine) {
      return;
    }

    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
    }

    retryTimerRef.current = window.setTimeout(() => {
      void syncQueuedSalesNow();
    }, delayMs);
  }

  function queueSaleForLater(clientRequestId: string, occurredAt: string, reason: string) {
    const localReceiptNumber = createOfflineReceiptNumber(new Date(occurredAt));
    const queuedSale: OfflineQueuedSale = {
      id: clientRequestId,
      shopId,
      userId,
      localReceiptNumber,
      queuedAt: new Date().toISOString(),
      status: 'PENDING',
      payload: buildSalePayload(clientRequestId, occurredAt, true),
      receipt: buildOfflineReceipt(clientRequestId, localReceiptNumber, occurredAt),
      conflicts: [],
      lastError: null
    };

    setQueuedSales((current) => [queuedSale, ...current.filter((entry) => entry.id !== queuedSale.id)]);
    setActiveReceiptId(queuedSale.id);
    setLastSyncedSale(null);
    resetCheckoutState();
    setParkedFeedback(reason);
    focusScanInput();
    scheduleQueueSync();
  }

  async function syncQueuedSalesNow() {
    if (syncInFlightRef.current) {
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const candidates = queuedSalesRef.current.filter(
      (sale) => sale.status === 'PENDING' || sale.status === 'ERROR'
    );

    if (!candidates.length) {
      return;
    }

    syncInFlightRef.current = true;
    setSyncingQueue(true);

    for (const queuedSale of candidates) {
      setQueuedSales((current) =>
        current.map((entry) =>
          entry.id === queuedSale.id
            ? { ...entry, status: 'SYNCING', lastError: null }
            : entry
        )
      );

      try {
        const response = await fetch('/api/sales', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...queuedSale.payload,
            items: queuedSale.payload.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              qty: item.qty,
              priceSnapshot: item.priceSnapshot
            }))
          })
        });
        const data = await response.json().catch(() => ({ error: 'Unable to sync queued sale.' }));

        if (response.ok && data?.sale) {
          setQueuedSales((current) => current.filter((entry) => entry.id !== queuedSale.id));
          setLastSyncedSale({
            id: data.sale.id,
            saleNumber: data.sale.saleNumber,
            receiptNumber: data.sale.receiptNumber,
            localReceiptNumber: queuedSale.localReceiptNumber
          });
          setParkedFeedback(
            `Queued sale ${queuedSale.localReceiptNumber} synced as receipt ${data.sale.receiptNumber}.`
          );
          router.refresh();
          continue;
        }

        if (response.status === 409 && data?.code === 'OFFLINE_SYNC_CONFLICT' && Array.isArray(data.conflicts)) {
          setQueuedSales((current) =>
            current.map((entry) =>
              entry.id === queuedSale.id
                ? {
                    ...entry,
                    status: 'CONFLICT',
                    conflicts: data.conflicts,
                    lastError: data.error ?? 'Queued sale needs cashier review before sync can continue.'
                  }
                : entry
            )
          );
          continue;
        }

        console.error('sync queued sale failure', data, response.status, queuedSale.id);
        setQueuedSales((current) =>
          current.map((entry) =>
            entry.id === queuedSale.id
              ? {
                  ...entry,
                  status: 'ERROR',
                  conflicts: [],
                  lastError: data?.error ?? 'Unable to sync queued sale.'
                }
              : entry
          )
        );
      } catch (err) {
        console.error('sync queued sale exception', err, queuedSale.id);
        setQueuedSales((current) =>
          current.map((entry) =>
            entry.id === queuedSale.id
              ? {
                  ...entry,
                  status: 'ERROR',
                  lastError: 'Connection dropped before the queued sale could sync.'
                }
              : entry
          )
        );
        break;
      }
    }

    syncInFlightRef.current = false;
    setSyncingQueue(false);
  }

  const syncQueuedSalesEffect = useEffectEvent(async () => {
    await syncQueuedSalesNow();
  });
  const handleOnlineEffect = useEffectEvent(() => {
    setIsOnline(true);
    setParkedFeedback('Connection restored. Syncing queued sales now.');
    void syncQueuedSalesNow();
  });

  useEffect(() => {
    const draft: OfflineCheckoutDraft = {
      version: 1,
      updatedAt: new Date().toISOString(),
      selectedCategory,
      query,
      cart: cart.map((item) => ({
        optionId: item.id,
        qty: item.qty
      })),
      discountAmount,
      customerSearch,
      selectedCustomerId,
      customerName,
      customerPhone,
      loyaltyPointsToRedeem,
      isCreditSale,
      creditDueDate,
      notes,
      payments: payments.map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: payment.amount,
        referenceNumber: payment.referenceNumber
      }))
    };

    if (hasMeaningfulDraft(draft)) {
      writeLocalStorageValue(draftStorageKey, draft);
      return;
    }

    removeLocalStorageValue(draftStorageKey);
  }, [
    cart,
    creditDueDate,
    customerName,
    customerPhone,
    customerSearch,
    discountAmount,
    draftStorageKey,
    isCreditSale,
    loyaltyPointsToRedeem,
    notes,
    payments,
    query,
    selectedCategory,
    selectedCustomerId
  ]);

  useEffect(() => {
    if (queuedSales.length) {
      writeLocalStorageValue(queueStorageKey, queuedSales);
      return;
    }

    removeLocalStorageValue(queueStorageKey);
  }, [queueStorageKey, queuedSales]);

  useEffect(() => {
    function handleOnline() {
      handleOnlineEffect();
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    if (!queuedSales.some((sale) => sale.status === 'PENDING' || sale.status === 'ERROR')) {
      return;
    }

    void syncQueuedSalesEffect();
  }, [isOnline, queuedSales]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const parkedSaleId = searchParams.get('parkedSaleId');
    if (!parkedSaleId || handledSearchParamResumeRef.current === parkedSaleId) {
      return;
    }

    const parkedSale = parkedSales.find((entry) => entry.id === parkedSaleId);
    if (!parkedSale) {
      handledSearchParamResumeRef.current = parkedSaleId;
      setError('That saved checkout entry is no longer available or has already expired.');
      router.replace('/checkout');
      return;
    }

    handledSearchParamResumeRef.current = parkedSaleId;
    void resumeParkedSale(parkedSale, {
      skipReplaceConfirm: true,
      clearSearchParamAfter: true
    });
  }, [parkedSales, router, searchParams]);

  async function saveCheckoutDraft(type: 'SAVED_CART' | 'QUOTE') {
    if (!cart.length) {
      setError(`Add at least one item before saving this ${type === 'QUOTE' ? 'quote' : 'cart'}.`);
      return;
    }

    setHolding(type);
    setError('');
    setParkedFeedback('');
    try {
      const response = await fetch('/api/parked-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title:
            type === 'QUOTE'
              ? `${selectedCustomerId ? 'Customer' : 'Walk-in'} quote`
              : null,
          customerId: selectedCustomerId,
          customerName,
          customerPhone,
          discountAmount: Number(discountAmount || 0),
          notes,
          items: cart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            qty: item.qty
          }))
        })
      });

      const data = await response.json().catch(() => ({ error: 'Unable to save the checkout draft.' }));

      if (!response.ok || !data?.parkedSale) {
        console.error('parked-sales save error', data, response.status);
        setError(data?.error ?? 'Unable to save the checkout draft.');
        return;
      }

      setParkedSales((current) => [data.parkedSale, ...current].slice(0, 20));
      setParkedFeedback(
        type === 'QUOTE'
          ? `Quote ${data.parkedSale.quoteReference ?? ''} saved successfully.`
          : 'Cart saved successfully and moved to the saved cart list.'
      );
      clearCartState();
    } catch (error) {
      console.error(error);
      setError('Unable to save the checkout draft.');
    } finally {
      setHolding(null);
    }
  }

  async function resumeParkedSale(parkedSale: ParkedSale, options?: { skipReplaceConfirm?: boolean; clearSearchParamAfter?: boolean }) {
    setError('');
    setParkedFeedback('');
    const missingOption = parkedSale.items.find((item) => !productMap.has(item.productVariantId ?? item.productId));
    if (missingOption) {
      setError('One or more items in this saved checkout entry are no longer available in the active catalog.');
      return false;
    }
    if (cart.length && !options?.skipReplaceConfirm && !window.confirm('Load this saved checkout entry and replace the current checkout cart?')) return false;
    setResumeLoadingId(parkedSale.id);
    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}/resume`, { method: 'POST' });
      const data = await response.json().catch(() => ({ error: 'Unable to load the saved checkout entry.' }));
      setResumeLoadingId(null);
      if (!response.ok) {
        console.error('parked-sales resume error', data, response.status);
        setError(data?.error ?? 'Unable to load the saved checkout entry.');
        return false;
      }
      setCart(
        parkedSale.items.map((item) => {
          const option = productMap.get(item.productVariantId ?? item.productId)!;
          return { ...option, qty: item.qty };
        })
      );
      setSelectedCustomerId(parkedSale.customerId ?? null);
      setCustomerSearch(
        parkedSale.customerId
          ? getCustomerDisplayName(customers.find((customer) => customer.id === parkedSale.customerId) ?? {})
          : parkedSale.customerName ?? ''
      );
      setCustomerName(parkedSale.customerName ?? '');
      setCustomerPhone(parkedSale.customerPhone ?? '');
      setLoyaltyPointsToRedeem('0');
      setIsCreditSale(false);
      setCreditDueDate(toDateInputValue());
      setNotes(parkedSale.notes ?? '');
      setDiscountAmount(parkedSale.discountAmount);
      setScanQuery('');
      setScanFeedback(null);
      resetPayments();
      setParkedSales((current) => current.filter((entry) => entry.id !== parkedSale.id));
      setParkedFeedback(`Loaded ${parkedSale.type === 'QUOTE' ? 'quote' : 'saved cart'} from ${parkedSale.cashierName}.`);
      focusScanInput();
      if (options?.clearSearchParamAfter) {
        router.replace('/checkout');
      }
      return true;
    } catch {
      setResumeLoadingId(null);
      setError('Unable to load the saved checkout entry.');
      return false;
    }
  }

  async function cancelParkedSale(parkedSale: ParkedSale) {
    setError('');
    setParkedFeedback('');
    if (!window.confirm('Cancel this saved checkout entry? This removes it from the active list.')) return;
    setCancelLoadingId(parkedSale.id);
    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({ error: 'Unable to cancel the saved checkout entry.' }));
      setCancelLoadingId(null);
      if (!response.ok) {
        console.error('parked-sales cancel error', data, response.status);
        setError(data?.error ?? 'Unable to cancel the saved checkout entry.');
        return;
      }
      setParkedSales((current) => current.filter((entry) => entry.id !== parkedSale.id));
      setParkedFeedback('Held cart cancelled successfully.');
    } catch {
      setCancelLoadingId(null);
      setError('Unable to cancel the saved checkout entry.');
    }
  }

  function restoreQueuedSaleToCheckout(queuedSale: OfflineQueuedSale) {
    if (cart.length && !window.confirm('Load this queued sale into checkout and replace the current cart?')) {
      return;
    }

    const restoredCart: CartItem[] = [];
    const restoreNotes: string[] = [];

    for (const item of queuedSale.payload.items) {
      const option = productMap.get(getQueueItemOptionId(item));
      if (!option) {
        restoreNotes.push(`${item.productName} was removed from the branch catalog and was skipped.`);
        continue;
      }

      const reservedQty = getReservedQtyForProduct(restoredCart, option.productId);
      const availableQty = Math.max(option.stockQty - reservedQty, 0);
      const resolvedQty = Math.min(item.qty, availableQty);

      if (resolvedQty <= 0) {
        restoreNotes.push(`${option.name} is now out of stock and was removed from this recovery cart.`);
        continue;
      }

      if (resolvedQty < item.qty) {
        restoreNotes.push(`${option.name} was reduced from ${item.qty} to ${resolvedQty} based on current stock.`);
      }

      restoredCart.push({ ...option, qty: resolvedQty });
    }

    if (!restoredCart.length) {
      setError('No sellable items remain in this queued sale. Remove it from the queue after reviewing the conflict notes.');
      return;
    }

    setCart(restoredCart);
    setSelectedCustomerId(queuedSale.payload.customerId);
    setCustomerSearch(
      queuedSale.payload.customerId
        ? getCustomerDisplayName(customers.find((customer) => customer.id === queuedSale.payload.customerId) ?? {})
        : queuedSale.payload.customerName ?? ''
    );
    setCustomerName(queuedSale.payload.customerName ?? '');
    setCustomerPhone(queuedSale.payload.customerPhone ?? '');
    setLoyaltyPointsToRedeem(String(queuedSale.payload.loyaltyPointsToRedeem));
    setIsCreditSale(queuedSale.payload.isCreditSale);
    setCreditDueDate(queuedSale.payload.creditDueDate ?? toDateInputValue());
    setNotes(queuedSale.payload.notes ?? '');
    setDiscountAmount(String(queuedSale.payload.discountAmount));
    setPayments(
      queuedSale.payload.isCreditSale
        ? buildInitialPaymentLines(defaultPaymentMethods, canAcceptCash)
        : queuedSale.payload.payments.map((payment) => ({
            id: crypto.randomUUID(),
            method: payment.method,
            amount: payment.amount.toFixed(2),
            referenceNumber: payment.referenceNumber ?? ''
          }))
    );
    setQueuedSales((current) => current.filter((entry) => entry.id !== queuedSale.id));
    setScanFeedback(null);
    setError('');
    setParkedFeedback(
      restoreNotes.length
        ? `Queued sale moved back into checkout. ${restoreNotes.join(' ')}`
        : 'Queued sale moved back into checkout for cashier review.'
    );
    focusScanInput();
  }

  function removeQueuedSale(queuedSale: OfflineQueuedSale) {
    if (!window.confirm('Remove this queued sale from local offline storage?')) {
      return;
    }

    setQueuedSales((current) => current.filter((entry) => entry.id !== queuedSale.id));
    setParkedFeedback(`Removed queued sale ${queuedSale.localReceiptNumber} from local storage.`);
  }

  async function completeSale() {
    setError('');
    setParkedFeedback('');
    if (!cart.length) return setError('Please add at least one item to the cart.');
    if (discount < 0) return setError('Discount amount cannot be negative.');
    if (discount > subtotal + taxAmount) return setError('Discount cannot exceed the sale total.');

    if (offlineCheckoutBlocked) {
      setError(
        `Offline checkout is blocked because the branch stock snapshot is ${Math.ceil(stockSnapshotAgeMinutes)} minutes old. Refresh the branch while online before selling offline again.`
      );
      return;
    }

    const occurredAt = new Date().toISOString();
    const clientRequestId = createOfflineClientRequestId(shopId, userId, new Date(occurredAt));
    const livePayload = buildSalePayload(clientRequestId, occurredAt, false);

    if (!isOnline) {
      queueSaleForLater(
        clientRequestId,
        occurredAt,
        `Offline mode detected. Sale ${clientRequestId.slice(-8)} was queued locally and a temporary receipt is ready to print.`
      );
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...livePayload,
          items: livePayload.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            qty: item.qty
          }))
        })
      });
      const data = await response.json().catch(() => ({ error: 'Failed to create sale.' }));
      setLoading(false);
      if (!response.ok) {
        console.error('create sale error', data, response.status);
        setError(data.error ?? 'Failed to create sale.');
        return;
      }
      resetCheckoutState();
      router.push(`/print/receipt/${data.sale.id}?autoprint=1`);
      router.refresh();
    } catch {
      setLoading(false);
      queueSaleForLater(
        clientRequestId,
        occurredAt,
        'Sale submission failed because the network dropped. The sale was queued locally and will sync automatically when the connection returns.'
      );
    }
  }

  const handleCompleteSaleShortcut = useEffectEvent(() => {
    void completeSale();
  });

  const handleClearCartShortcut = useEffectEvent(() => {
    requestClearCart();
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault();
        focusScanInput(true);
        return;
      }
      if (isTypingTarget(event.target)) return;
      if (event.key === 'F9' && canCompleteSale) {
        event.preventDefault();
        handleCompleteSaleShortcut();
        return;
      }
      if (event.key === 'F4' && cart.length) {
        event.preventDefault();
        handleClearCartShortcut();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canCompleteSale, cart.length]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                  isOnline ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-sky-200 bg-sky-50 text-sky-700'
                }`}
              >
                {isOnline ? tCheckout('online') : tCheckout('offline')}
              </span>
              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                {tCheckout('unsyncedSales', { count: queuedSales.length })}
              </span>
              {conflictedQueuedSales.length ? (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
                  {tCheckout('conflicts', { count: conflictedQueuedSales.length })}
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 text-2xl font-black text-stone-950">{tCheckout('offlineReadyCheckout')}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              {tCheckout('offlineReadyDesc')}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{tCheckout('queued')}</div>
              <div className="mt-1 text-2xl font-black text-stone-950">{queuedSales.length}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{tCheckout('pendingSync')}</div>
              <div className="mt-1 text-2xl font-black text-sky-700">{pendingQueuedSales.length + failedQueuedSales.length}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{tCheckout('stockAge')}</div>
              <div className={`mt-1 text-2xl font-black ${isStockSnapshotStale ? 'text-sky-700' : 'text-blue-700'}`}>
                {Number.isFinite(stockSnapshotAgeMinutes) ? `${Math.ceil(stockSnapshotAgeMinutes)}m` : tCheckout('unknown')}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className={`rounded-[24px] border px-4 py-4 text-sm ${
            offlineCheckoutBlocked
              ? 'border-red-200 bg-red-50 text-red-800'
              : !isOnline && isStockSnapshotStale
                ? 'border-sky-200 bg-sky-50 text-sky-800'
                : 'border-stone-200 bg-stone-50 text-stone-700'
          }`}>
            <div className="font-semibold text-stone-900">{tCheckout('offlineStockSafeguard')}</div>
            <div className="mt-2 leading-6">
              {offlineCheckoutBlocked
                ? tCheckout('offlineBlockedDesc', { minutes: offlineStockMaxAgeMinutes })
                : !isOnline && isStockSnapshotStale
                  ? tCheckout('offlineStaleDesc')
                  : tCheckout('offlineFreshDesc', { minutes: Math.ceil(stockSnapshotAgeMinutes) })}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button
              type="button"
              variant="secondary"
              disabled={!queuedSales.length || syncingQueue || !isOnline}
              onClick={() => void syncQueuedSalesNow()}
            >
              {syncingQueue ? tCheckout('syncingQueuedSales') : tCheckout('retrySyncNow')}
            </Button>
            {activeReceiptSale ? (
              <Button type="button" variant="secondary" onClick={() => setActiveReceiptId(activeReceiptSale.id)}>
                {tCheckout('openQueuedReceipt')}
              </Button>
            ) : null}
            {lastSyncedSale ? (
              <Link href={`/print/receipt/${lastSyncedSale.id}`} className="inline-flex">
                <Button type="button" className="w-full justify-center">
                  {tCheckout('openLastSyncedReceipt')}
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        {lastSyncedSale ? (
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {tCheckout('syncSuccess', { localReceipt: lastSyncedSale.localReceiptNumber, receiptNumber: lastSyncedSale.receiptNumber })}
          </div>
        ) : null}

        {queuedSales.length ? (
          <div className="mt-6 space-y-3">
            {queuedSales.map((queuedSale) => (
              <div key={queuedSale.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getQueuedSaleStatusTone(queuedSale.status)}`}>
                        {queuedSale.status === 'SYNCING'
                          ? tCheckout('statusSyncing')
                          : queuedSale.status === 'CONFLICT'
                          ? tCheckout('statusConflict')
                          : queuedSale.status === 'ERROR'
                          ? tCheckout('statusError')
                          : tCheckout('statusQueued')}
                      </span>
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                        {queuedSale.localReceiptNumber}
                      </span>
                    </div>
                    <div className="mt-3 text-lg font-black text-stone-950">
                      {money(queuedSale.receipt.totalAmount, currencySymbol)}
                    </div>
                    <div className="mt-1 text-sm text-stone-500">
                      {tCheckout('queued')} {dateTime(queuedSale.queuedAt)} / {tCheckout('unsyncedSales', { count: queuedSale.receipt.items.length })}
                    </div>
                    {queuedSale.lastError ? (
                      <div className="mt-3 rounded-[18px] border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                        {queuedSale.lastError}
                      </div>
                    ) : null}
                    {queuedSale.conflicts.length ? (
                      <div className="mt-3 space-y-2">
                        {queuedSale.conflicts.map((conflict, index) => (
                          <div key={`${queuedSale.id}-${conflict.productId}-${index}`} className="rounded-[18px] border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                            <div className="font-semibold text-sky-900">{conflict.productName}</div>
                            <div className="mt-1">{conflict.message}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-[240px] space-y-2">
                    <Button type="button" variant="secondary" className="w-full justify-center" onClick={() => setActiveReceiptId(queuedSale.id)}>
                      {tCheckout('printLocalReceipt')}
                    </Button>
                    {queuedSale.status !== 'SYNCING' ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full justify-center"
                        onClick={() => restoreQueuedSaleToCheckout(queuedSale)}
                      >
                        {tCheckout('reviewInCheckout')}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      disabled={queuedSale.status === 'SYNCING' || !isOnline}
                      className="w-full justify-center"
                      onClick={() => void syncQueuedSalesNow()}
                    >
                      {tCheckout('retrySync')}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      className="w-full justify-center"
                      disabled={queuedSale.status === 'SYNCING'}
                      onClick={() => removeQueuedSale(queuedSale)}
                    >
                      {tCheckout('removeQueuedSale')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {activeReceiptSale ? (
        <Card>
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">{tCheckout('offlineReceipt')}</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">{tCheckout('tempReceiptPreview')}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
                {tCheckout('tempReceiptDesc', { localReceiptNumber: activeReceiptSale.localReceiptNumber })}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <ThermalReceipt
              sale={activeReceiptSale.receipt}
              shop={shop}
              currencySymbol={currencySymbol}
              receiptHeader={receiptHeader}
              receiptFooter={receiptFooter}
              receiptWidth={receiptWidth}
            />
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="space-y-5 overflow-hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">{tCheckout('scannerFirstCheckout')}</div>
              <h2 className="mt-2 text-2xl font-black text-stone-900">{tCheckout('findProducts')}</h2>
              <p className="mt-1 text-sm text-stone-500">{tCheckout('scannerDesc')}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{tCheckout('visible')}</div><div className="mt-1 text-xl font-black text-stone-950">{filtered.length}</div></div>
              <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">{tCheckout('cartLines')}</div><div className="mt-1 text-xl font-black text-stone-950">{cart.length}</div></div>
            </div>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
              <form onSubmit={handleScanSubmit} className="flex gap-3">
                <Input ref={scanInputRef} placeholder={tCheckout('scanPlaceholder')} value={scanQuery} onChange={(event) => setScanQuery(event.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                <Button type="submit" variant="secondary" className="shrink-0">{tCheckout('add')}</Button>
              </form>
              <Input placeholder={tCheckout('searchPlaceholder')} value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1">{tCheckout('enterAddsScanned')}</span>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1">{tCheckout('f2Focuses')}</span>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1">{tCheckout('existingCartQty')}</span>
            </div>

            {barcodeScannerNotes ? (
              <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                {barcodeScannerNotes}
              </div>
            ) : null}

            <div className="mt-3 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
              <button type="button" onClick={() => setSelectedCategory('')} className={`rounded-full border px-4 py-2 text-sm font-semibold transition shrink-0 ${!selectedCategory ? 'border-blue-600 bg-blue-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}>{tCheckout('all')}</button>
              {categories.map((category) => (
                <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition shrink-0 ${selectedCategory === category.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}>{category.name}</button>
              ))}
            </div>

            {scanFeedback ? <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${scanFeedback.tone === 'success' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{scanFeedback.message}</div> : null}
          </div>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => {
              const hasSiblings = product.siblings && product.siblings.length > 1;
              const totalStock = hasSiblings
                ? product.siblings!.reduce((s, v) => s + v.stockQty, 0)
                : product.stockQty;
              return (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  setScanFeedback(null);
                  if (hasSiblings) {
                    setVariantPickerProductId(product.productId);
                  } else {
                    addToCart(product);
                  }
                }}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-3 text-start shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-600 hover:shadow-[0_20px_40px_rgba(2,107,201,0.12)]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-stone-100 bg-stone-50">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={getOptionDisplayName(product)}
                      fill
                      sizes="(max-width: 640px) 100vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-stone-100 text-stone-400">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-8 w-8">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </div>
                  )}
                  <span
                    className={`absolute top-2 start-2 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] backdrop-blur-[2px] shadow-sm ${
                      totalStock <= 0
                        ? 'border-red-200 bg-red-50/90 text-red-700'
                        : totalStock <= 5
                        ? 'border-sky-200 bg-sky-50/90 text-sky-700'
                        : 'border-blue-200 bg-blue-50/90 text-blue-700'
                    }`}
                  >
                    {totalStock <= 0 ? tCheckout('outOfStock') : totalStock <= 5 ? tCheckout('lowStock') : tCheckout('ready')}
                  </span>
                  {hasSiblings && (
                    <span className="absolute top-2 end-2 rounded-full border border-sky-200 bg-sky-50/90 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-[2px] shadow-sm text-sky-800">
                      {product.siblings!.length} {isAr ? 'مواصفات / عبوات' : 'options'}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-1 flex-col justify-between">
                  <div>
                    <div className="font-semibold text-stone-900 text-sm md:text-base leading-snug line-clamp-2 break-words" title={product.name}>
                      {product.name}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      {hasSiblings
                        ? product.siblings!.map(v => v.variantLabel).filter(Boolean).slice(0, 3).join(' · ') + (product.siblings!.length > 3 ? '...' : '')
                        : product.variantLabel ?? product.category?.name ?? tCheckout('standardItem')}
                    </div>
                    <div className="mt-2 text-[10px] text-stone-400">
                      {tCheckout('skuShort')}: {product.sku ?? '—'} / {tCheckout('barcodeShort')}: {product.barcode ?? '—'}
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between border-t border-stone-100 pt-2.5">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                        {tCheckout('sellingPrice')}
                      </div>
                      <div className="mt-0.5 text-xl font-black text-blue-900">
                        {money(product.price, currencySymbol)}
                      </div>
                    </div>
                    <div className="text-end text-xs font-semibold text-stone-500">
                      {hasSiblings ? `${totalStock} إجمالي` : tCheckout('inStock', { count: product.stockQty })}
                    </div>
                  </div>
                </div>
              </button>
              );
            })}
          </div>


          {!filtered.length ? (
            products.length ? (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6">
                <div className="text-sm font-semibold text-stone-900">{hasSearchFilters ? tCheckout('noProductsMatched') : tCheckout('noProductsVisible')}</div>
                <div className="mt-2 text-sm text-stone-500">
                  {hasSearchFilters
                    ? tCheckout('noProductsMatchedDesc')
                    : tCheckout('activeCatalogEmpty')}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => { setQuery(''); setSelectedCategory(''); focusScanInput(); }}>
                    {tCheckout('resetSearch')}
                  </Button>
                  <Link href={lp('/products')} className="inline-flex h-11 items-center justify-center rounded-2xl border border-blue-700/90 bg-[linear-gradient(180deg,#2563eb,#1d4ed8)] px-4 text-sm font-semibold text-white shadow-[0_18px_30px_-20px_rgba(37,99,235,0.9)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(37,99,235,0.85)]">
                    {tCheckout('addProducts')}
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6">
                <div className="text-sm font-semibold text-stone-900">{tCheckout('noSellableProducts')}</div>
                <div className="mt-2 text-sm text-stone-500">{tCheckout('noSellableProductsDesc')}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={lp('/products')} className="inline-flex h-11 items-center justify-center rounded-2xl border border-blue-700/90 bg-[linear-gradient(180deg,#2563eb,#1d4ed8)] px-4 text-sm font-semibold text-white shadow-[0_18px_30px_-20px_rgba(37,99,235,0.9)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(37,99,235,0.85)]">
                    {tCheckout('createFirstProduct')}
                  </Link>
                  <Link href={lp('/settings')} className="inline-flex h-11 items-center justify-center rounded-2xl border border-stone-200 bg-white/90 px-4 text-sm font-semibold text-stone-800 shadow-[0_12px_24px_-18px_rgba(28,25,23,0.32)] transition duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:bg-white">
                    {tCheckout('reviewBranchSettings')}
                  </Link>
                </div>
              </div>
            )
          ) : null}
        </Card>
        <Card className="space-y-5 xl:sticky xl:top-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">{tCheckout('saleDesk')}</div>
              <h2 className="mt-2 text-2xl font-black text-stone-900">{tCheckout('checkoutSummary')}</h2>
              <p className="mt-1 text-sm text-stone-500">{tCheckout('cashier', { name: cashierName })}</p>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3 text-end"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">{tCheckout('items')}</div><div className="text-2xl font-black text-stone-950">{itemCount}</div></div>
          </div>

          <div className="space-y-3">
            {cart.length ? cart.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.9))] p-3.5 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-stone-900 text-sm md:text-base leading-snug line-clamp-2 break-words text-start" title={item.name}>{item.name}</div>
                    <div className="text-sm text-stone-500 text-start">{item.variantLabel ?? tCheckout('standardItem')}</div>
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500 font-semibold">{isAr ? 'سعر البيع:' : 'Price:'}</span>
                        <input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updatePrice(item.id, Number(e.target.value))}
                          className="h-8 w-24 rounded-lg border border-stone-200 px-2 text-xs font-semibold text-stone-900 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto border-t border-stone-200/50 pt-3 sm:border-t-0 sm:pt-0">
                    <div className="flex items-center gap-1.5">
                      <Button type="button" variant="secondary" className="h-9 w-9 shrink-0 px-0 text-base" onClick={() => updateQty(item.id, 'decrease')}>-</Button>
                      <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl bg-white px-2 text-sm font-semibold text-stone-900 border border-stone-200/80">{item.qty}</span>
                      <Button type="button" variant="secondary" className="h-9 w-9 shrink-0 px-0 text-base" onClick={() => updateQty(item.id, 'increase')}>+</Button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800 transition shadow-2xs"
                      title={tCheckout('remove')}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                      </svg>
                      <span>{tCheckout('remove')}</span>
                    </button>
                  </div>
                </div>
                <div className="mt-3.5 flex items-center justify-between rounded-[20px] border border-stone-200/80 bg-white/80 px-3 py-2.5 text-sm"><span className="text-stone-500">{tCheckout('lineTotal')}</span><span className="font-semibold text-stone-900">{money(Number(item.price) * item.qty, currencySymbol)}</span></div>
              </div>
            )) : (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6">
                <div className="text-sm font-semibold text-stone-900">{tCheckout('noItemsInCart')}</div>
                <div className="mt-2 text-sm text-stone-500">{tCheckout('noItemsInCartDesc')}</div>
              </div>
            )}
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-stone-50/85 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{tCheckout('customerAndPayment')}</div>
            <p className="mt-1 text-sm text-stone-500">{tCheckout('attachCustomerDesc')}</p>
            {!canAcceptCash && !isCreditSale ? (
              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span>{t('warning.cashSessionRequired')}</span>
                <Link href={lp('/register/open?redirect=/checkout')} className="text-blue-700 hover:text-blue-800 underline font-semibold shrink-0">
                  {t('warning.openSessionLink')}
                </Link>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
              <div className="text-sm font-semibold text-stone-900">{tCheckout('customerSearch')}</div>
              <div className="mt-3 grid gap-3">
                <Input placeholder={tCheckout('customerSearchPlaceholder')} value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {filteredCustomers.map((customer) => (
                    <button key={customer.id} type="button" onClick={() => selectCustomer(customer)} className={`rounded-full border px-3 py-2 text-sm transition ${selectedCustomerId === customer.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-300 hover:bg-white'}`}>
                      {getCustomerDisplayName(customer)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedCustomer ? (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-stone-900">{getCustomerDisplayName(selectedCustomer)}</div>
                      <div className="text-stone-600">{selectedCustomer.phone || tCheckout('noPhone')}{selectedCustomer.email ? ` / ${selectedCustomer.email}` : ''}</div>
                      <div className="mt-1 text-xs text-stone-500">
                        {tCheckout('customerDetails', { points: selectedCustomer.loyaltyBalance, receivables: money(selectedCustomer.receivableBalance, currencySymbol) })}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" onClick={() => { setSelectedCustomerId(null); setCustomerSearch(''); setCustomerName(''); setCustomerPhone(''); setLoyaltyPointsToRedeem('0'); setIsCreditSale(false); }}>
                      {tCheckout('clear')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input placeholder={tCheckout('customerName')} value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
              <Input placeholder={tCheckout('customerPhone')} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
              <Input type="number" step="0.01" placeholder={tCheckout('discountAmount')} value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} />
              <Input placeholder={tCheckout('notesForSale')} value={notes} onChange={(event) => setNotes(event.target.value)} />
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-stone-500 mb-1.5">
                  {isAr ? 'البائع المسؤول' : 'Salesman / Staff'}
                </label>
                <select
                  className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-blue-500"
                  value={salesmanId}
                  onChange={(event) => setSalesmanId(event.target.value)}
                >
                  <option value="">{isAr ? '-- اختر البائع --' : '-- Select Salesman --'}</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-1">
              <Input type="number" min={0} placeholder={tCheckout('redeemLoyalty')} value={loyaltyPointsToRedeem} onChange={(event) => setLoyaltyPointsToRedeem(event.target.value)} />
            </div>


            {!isCreditSale ? <div className="mt-4 space-y-3">
              {payments.map((payment) => {
                const exactAmount = getExactAmountForLine(payment.id);
                const quickAmounts = getQuickCashAmounts(exactAmount).filter((amount) => amount !== exactAmount);
                return (
                  <div key={payment.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]">
                      <select className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-blue-500" value={payment.method} onChange={(event) => updatePaymentLine(payment.id, { method: event.target.value as PaymentMethod })}>
                        {PAYMENT_METHODS.filter((method) => {
                          if (shopType === 'SPARE_PARTS_ONLY') {
                            return !['مايلو', 'فاليو', 'امان', 'موجو', 'كونتاكت'].includes(method);
                          }
                          return true;
                        }).map((method) => (
                          <option key={method} value={method} disabled={method === 'كاش' && !canAcceptCash}>
                            {method === 'كاش' && !canAcceptCash ? `${method} (${t('open.title')})` : method}
                          </option>
                        ))}
                      </select>
                      <Input type="number" step="0.01" placeholder={payment.method === 'كاش' ? 'المبلغ المستلم' : 'المبلغ'} value={payment.amount} onChange={(event) => updatePaymentLine(payment.id, { amount: event.target.value })} />
                      <button
                        type="button"
                        onClick={() => removePaymentLine(payment.id)}
                        disabled={payments.length === 1}
                        className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs"
                        title={tCheckout('remove')}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                        <span className="hidden sm:inline">{tCheckout('remove')}</span>
                      </button>
                    </div>
                    {requiresReferenceNumber(payment.method) ? (
                      <div className="mt-3">
                        <Input placeholder="رقم المرجع" value={payment.referenceNumber} onChange={(event) => updatePaymentLine(payment.id, { referenceNumber: event.target.value })} />
                      </div>
                    ) : null}
                    {['امان', 'مايلو', 'موجو', 'فاليو', 'كونتاكت'].includes(payment.method) ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-stone-500 mb-1">مبلغ السحب (الشركة)</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="مبلغ السحب من شركة التقسيط"
                            value={payment.pullAmount ?? ''}
                            onChange={(event) => updatePaymentLine(payment.id, { pullAmount: event.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-stone-500 mb-1">المصاريف الإدارية</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="المصاريف الإدارية للشركة"
                            value={payment.adminFees ?? ''}
                            onChange={(event) => updatePaymentLine(payment.id, { adminFees: event.target.value })}
                          />
                        </div>
                      </div>
                    ) : null}
                    {payment.method === 'كاش' ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setPaymentLineAmount(payment.id, exactAmount)}>المبلغ كامل</Button>
                        {quickAmounts.map((amount) => (
                          <Button key={`${payment.id}-${amount}`} type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setPaymentLineAmount(payment.id, amount)}>{money(amount, currencySymbol)}</Button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              <Button type="button" variant="secondary" onClick={addPaymentLine}>{tCheckout('addPaymentLine')}</Button>
              {totalInstallmentSurplus > 0 ? (
                <div className="mt-4 p-4 rounded-[24px] border border-blue-200 bg-blue-50/70 space-y-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-blue-900">
                    <span>فائض السحب التقسيط المتوفر:</span>
                    <span>{money(totalInstallmentSurplus, currencySymbol)}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 items-center">
                    <div className="text-xs text-stone-600">
                      يمكنك اختيار رد جزء أو كامل الفائض كاش للعميل (سيسجل كحركة صادر من الخزينة)
                    </div>
                    <div>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="المبلغ المسترد كاش (Cashback)"
                        value={installmentCashbackAmount}
                        onChange={(event) => setInstallmentCashbackAmount(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div> : (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                {tCheckout('creditSaleNotice')}
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{tCheckout('paidTotal')}</div><div className="mt-1 text-2xl font-black text-stone-950">{money(paymentSummary.totalPaid, currencySymbol)}</div></div>
              <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{tCheckout('remaining')}</div><div className={`mt-1 text-2xl font-black ${paymentSummary.remainingAmount > 0 ? 'text-red-700' : 'text-blue-700'}`}>{money(paymentSummary.remainingAmount, currencySymbol)}</div></div>
              <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{tCheckout('cashReceived')}</div><div className="mt-1 text-2xl font-black text-stone-950">{money(paymentSummary.cashReceived, currencySymbol)}</div></div>
              <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{tCheckout('changeDue')}</div><div className={`mt-1 text-2xl font-black ${paymentSummary.changeDue > 0 ? 'text-blue-700' : 'text-stone-950'}`}>{money(paymentSummary.changeDue, currencySymbol)}</div></div>
            </div>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-stone-50/85 p-5 text-sm">
            <div className="flex justify-between"><span>{tCheckout('subtotal')}</span><span>{money(subtotal, currencySymbol)}</span></div>
            <div className="mt-2 flex justify-between"><span>{tCheckout('tax', { rate: taxRate })}</span><span>{money(taxAmount, currencySymbol)}</span></div>
            <div className="mt-2 flex justify-between"><span>{tCheckout('manualDiscount')}</span><span>-{money(manualDiscount, currencySymbol)}</span></div>
            <div className="mt-2 flex justify-between"><span>{tCheckout('loyaltyDiscount')}</span><span>-{money(loyaltyDiscount, currencySymbol)}</span></div>
            <div className="mt-2 flex justify-between"><span>{isCreditSale ? tCheckout('receivable') : tCheckout('paid')}</span><span>{money(isCreditSale ? total : paymentSummary.totalPaid, currencySymbol)}</span></div>
            <div className="mt-2 flex justify-between"><span>{tCheckout('change')}</span><span>{money(paymentSummary.changeDue, currencySymbol)}</span></div>
            <div className="mt-3 flex justify-between border-t border-stone-200 pt-3 text-lg font-black text-stone-900"><span>{tCheckout('total')}</span><span>{money(total, currencySymbol)}</span></div>
            <div className="mt-4 rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">{cart.length ? paymentError || tCheckout('readyForValidation', { count: itemCount, lines: cart.length }) : tCheckout('addAtLeastOneProduct')}</div>
          </div>

          {parkedFeedback ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{parkedFeedback}</div> : null}
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="flex-1" disabled={!canCompleteSale} onClick={() => void completeSale()}>{loading ? tCheckout('completingSale') : !isOnline ? tCheckout('queueOfflineSale') : tCheckout('completeSale')}</Button>
            <Button type="button" variant="secondary" className="sm:min-w-32" disabled={!cart.length || loading || Boolean(holding)} onClick={() => void saveCheckoutDraft('SAVED_CART')}>{holding === 'SAVED_CART' ? tCheckout('savingCart') : tCheckout('saveCart')}</Button>
            <Button type="button" variant="secondary" className="sm:min-w-32" disabled={!cart.length || loading || Boolean(holding)} onClick={() => void saveCheckoutDraft('QUOTE')}>{holding === 'QUOTE' ? tCheckout('savingQuote') : tCheckout('saveQuote')}</Button>
            <Button
              type="button"
              variant="secondary"
              className="sm:min-w-32 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-800 shadow-2xs gap-1.5"
              disabled={!cart.length || loading || Boolean(holding)}
              onClick={requestClearCart}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
              </svg>
              <span>{tCheckout('clear')}</span>
            </Button>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-stone-50/85 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{tCheckout('savedCheckouts')}</div>
                <h3 className="mt-2 text-xl font-black text-stone-900">{tCheckout('suspendResumeTitle')}</h3>
                <p className="mt-1 text-sm text-stone-500">{tCheckout('suspendResumeDesc')}</p>
              </div>
              <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3 text-end"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{tCheckout('savedCartsQuotes')}</div><div className="mt-1 text-2xl font-black text-stone-950">{parkedSales.length}</div></div>
            </div>
            <div className="mt-4 space-y-3">
              {parkedSales.length ? parkedSales.map((parkedSale) => (
                <div key={parkedSale.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">{tCheckout('held')}</span>
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">{tCheckout('unsyncedSales', { count: parkedSale.itemCount })}</span>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${parkedSale.type === 'QUOTE' ? 'border border-sky-200 bg-sky-50 text-sky-700' : 'border border-stone-200 bg-stone-50 text-stone-600'}`}>{parkedSale.type === 'QUOTE' ? tCheckout('quote') : tCheckout('savedCart')}</span>
                      </div>
                      <div className="mt-3 text-lg font-black text-stone-950">{money(parkedSale.totalAmount, currencySymbol)}</div>
                      <div className="mt-1 text-sm text-stone-500">{tCheckout('cashier', { name: parkedSale.cashierName })}{parkedSale.customerName ? ` / ${parkedSale.customerName}` : ''}</div>
                      <div className="mt-2 text-xs text-stone-500">{tCheckout('createdExpires', { createdAt: dateTime(parkedSale.createdAt), expiresAt: dateTime(parkedSale.expiresAt) })}</div>
                      {parkedSale.quoteReference ? <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">{parkedSale.quoteReference}</div> : null}
                      {parkedSale.title ? <div className="mt-2 text-sm font-semibold text-stone-700">{parkedSale.title}</div> : null}
                      {parkedSale.notes ? <div className="mt-3 rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">{parkedSale.notes}</div> : null}
                    </div>
                    <div className="min-w-[220px] space-y-2">
                      <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
                        {parkedSale.items.map((item) => `${item.qty}x ${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ''}`).join(', ')}
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                        <Button type="button" disabled={resumeLoadingId === parkedSale.id || cancelLoadingId === parkedSale.id} onClick={() => void resumeParkedSale(parkedSale)}>{resumeLoadingId === parkedSale.id ? tCheckout('loading') : parkedSale.type === 'QUOTE' ? tCheckout('loadQuote') : tCheckout('resume')}</Button>
                        <Button type="button" variant="danger" disabled={resumeLoadingId === parkedSale.id || cancelLoadingId === parkedSale.id} onClick={() => void cancelParkedSale(parkedSale)}>{cancelLoadingId === parkedSale.id ? tCheckout('cancelling') : tCheckout('cancel')}</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )) : <div className="rounded-[24px] border border-dashed border-stone-300 bg-white px-4 py-5 text-sm text-stone-500">{tCheckout('noSavedCarts')}</div>}
            </div>
          </div>
        </Card>
      </div>

      {/* ========== Variant Picker Modal ========== */}
      {variantPickerProductId && (() => {
        const pickerVariants = products.filter(p => p.productId === variantPickerProductId);
        const pickerProduct = pickerVariants[0];
        if (!pickerProduct) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={() => setVariantPickerProductId(null)}
          >
            <div
              className="relative w-full max-w-md rounded-[32px] bg-white shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="mb-5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-700">المواصفات الفنية والتعبئة البحرية</div>
                <div className="mt-1 text-xl font-black text-stone-900">{pickerProduct.name}</div>
                <div className="mt-1 text-sm text-stone-500">{pickerProduct.category?.name ?? ''}</div>
              </div>

              {/* Variants grid */}
              <div className="grid gap-3 max-h-80 overflow-y-auto pr-1">
                {pickerVariants.map((variant) => {
                  const inCart = cart.filter(c => c.id === variant.id).reduce((s, c) => s + c.qty, 0);
                  const available = Math.max(0, variant.stockQty - inCart);
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={available <= 0}
                      onClick={() => {
                        setScanFeedback(null);
                        addToCart(variant);
                        setVariantPickerProductId(null);
                      }}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 text-start transition-all ${
                        available <= 0
                          ? 'border-stone-100 bg-stone-50 opacity-50 cursor-not-allowed'
                          : 'border-stone-200 bg-white hover:border-sky-500 hover:bg-sky-50/40 hover:shadow-md active:scale-[0.98]'
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(() => {
                            const label = variant.variantLabel || '';
                            const parts = label.split(' / ').map(p => p.trim()).filter(Boolean);
                            if (parts.length > 0) {
                              return parts.map((part, pIdx) => {
                                const isSize = ['S', 'M', 'L', 'XL', '2XL', '3XL', 'Free Size'].includes(part) || /^[SMLX0-9\-]+$/i.test(part);
                                return (
                                  <span
                                    key={pIdx}
                                    className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                                      isSize
                                        ? 'bg-stone-100 text-stone-700 border border-stone-200'
                                        : 'bg-sky-50 text-sky-800 border border-sky-100'
                                    }`}
                                  >
                                    {part}
                                  </span>
                                );
                              });
                            }
                            return (
                              <span className="text-stone-900 font-semibold text-sm">
                                {variant.sku || variant.barcode || '—'}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
                          {available > 0 ? `${available} قطعة متاحة` : 'نفدت الكمية'}
                        </div>
                      </div>
                      <div className="text-end">
                        <div className="font-black text-blue-900">{money(variant.price, currencySymbol)}</div>
                        {inCart > 0 && (
                          <div className="mt-0.5 text-[10px] text-purple-600 font-semibold">{inCart} في السلة</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Close button */}
              <button
                type="button"
                onClick={() => setVariantPickerProductId(null)}
                className="mt-5 w-full rounded-2xl border border-stone-200 bg-stone-50 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                إغلاق
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
