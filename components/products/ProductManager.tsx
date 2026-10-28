'use client';

import { type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import BarcodeLabelPreview, { type BarcodeLabelSize } from '@/components/products/BarcodeLabelPreview';
import { money, shortDate } from '@/lib/format';
import { getStockLevel, stockLevelLabel } from '@/lib/inventory';
import {
  buildVariantLabel,
  getMarginSummary
} from '@/lib/product-merchandising';
import { summarizeConversions } from '@/lib/uom-utils';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

type Category = { id: string; name: string; parentId: string | null };
type UnitOfMeasure = { id: string; code: string; name: string; isBase: boolean };
type Variant = {
  id: string;
  color: string | null;
  size: string | null;
  flavor: string | null;
  model: string | null;
  sku: string | null;
  barcode: string | null;
  priceOverride: string | null;
  costOverride: string | null;
  stockQty: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type ProductImage = {
  id: string;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
  createdAt: string;
};
type HistoryUser = { id: string; name: string | null; email: string };
type PriceHistory = {
  id: string;
  previousPrice: string;
  newPrice: string;
  effectiveDate: string;
  createdAt: string;
  note: string | null;
  changedByUser: HistoryUser;
};
type CostHistory = {
  id: string;
  previousCost: string;
  newCost: string;
  effectiveDate: string;
  createdAt: string;
  note: string | null;
  changedByUser: HistoryUser;
};
type Product = {
  id: string;
  categoryId: string | null;
  baseUnitOfMeasureId: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  cost: string;
  price: string;
  stockQty: number;
  reorderPoint: number;
  trackBatches: boolean;
  trackExpiry: boolean;
  isActive: boolean;
  baseUnitOfMeasure?: UnitOfMeasure | null;
  uomConversions: Array<{
    id: string;
    unitOfMeasureId: string;
    ratioToBase: number;
    unitOfMeasure: UnitOfMeasure;
  }>;
  variants: Variant[];
  images: ProductImage[];
  priceHistory: PriceHistory[];
  costHistory: CostHistory[];
  batches: Array<{
    id: string;
    lotNumber: string;
    expiryDate: string | null;
    quantity: number;
  }>;
  category?: { id: string; name: string } | null;
  productType?: 'MOTORCYCLE' | 'SPARE_PART';
  brand?: string | null;
  supplierPrice?: string | null;
  dealerCode?: string | null;
  assemblyCost?: string | null;
  externalTransportCost?: string | null;
  internalTransportCost?: string | null;
  maintenanceCost?: string | null;
  otherCosts?: string | null;
  condition?: 'NEW' | 'USED';
  color?: string | null;
  motorNumber?: string | null;
  chassisNumber?: string | null;
  chassisPhotoUrl?: string | null;
  motorPhotoUrl?: string | null;
};
type VariantDraft = {
  color: string;
  size: string;
  flavor: string;
  model: string;
  sku: string;
  barcode: string;
  priceOverride: string;
  costOverride: string;
  stockQty: string;
  isActive: boolean;
};
type ImageDraft = {
  imageUrl: string;
  altText: string;
  sortOrder: string;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10';

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-stone-700">{children}</label>;
}

function emptyVariant(): VariantDraft {
  return {
    color: '',
    size: '',
    flavor: '',
    model: '',
    sku: '',
    barcode: '',
    priceOverride: '',
    costOverride: '',
    stockQty: '0',
    isActive: true
  };
}

function emptyImage(sortOrder = 0): ImageDraft {
  return {
    imageUrl: '',
    altText: '',
    sortOrder: String(sortOrder)
  };
}

function toVariantLabel(variant: VariantDraft | Variant) {
  return buildVariantLabel({
    color: variant.color,
    size: variant.size,
    flavor: variant.flavor,
    model: variant.model
  });
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

const MARINE_SPEC_PRESETS = [
  'طازج فرز أول (Fresh)',
  'مجمد -18°C (Frozen)',
  'مؤن جافة (Dry Provisions)',
  'معتمد بحرياً (Marine Grade)',
  'مواصفات إيمبا (IMPA Spec)',
  'معتمد SOLAS',
  'أصلي OEM',
  'درجة أولى تجاري'
];
const MARINE_PACK_PRESETS = [
  'شكارة 25 كجم',
  'شكارة 50 كجم',
  'كرتونة 10 كجم',
  'كرتونة 20 كجم',
  'برميل 208 لتر',
  'سطل 18 كجم',
  'طرد 12×1.5 لتر',
  'قطر 32 مم',
  'قطر 40 مم',
  'قطعة معيارية'
];

export default function ProductManager({
  initialProducts,
  categories,
  units,
  canEditProducts,
  canViewPurchaseCosts,
  currencySymbol,
  lowStockThreshold,
  inventoryDefaults,
  shopType,
  locale
}: {
  initialProducts: Product[];
  categories: Category[];
  units: UnitOfMeasure[];
  canEditProducts: boolean;
  canViewPurchaseCosts: boolean;
  currencySymbol: string;
  lowStockThreshold: number;
  inventoryDefaults: {
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    expiryAlertDays: number;
  };
  shopType?: string;
  locale?: string;
}) {
  const t = useTranslations('productManager');
  const lp = useLocalizedPath();
  const isAr = locale === 'ar';
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState('');
  const [customSize, setCustomSize] = useState('');

  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  function handleExcelUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (rows.length === 0) {
          setImportError(isAr ? 'الملف فارغ أو غير صالح.' : 'File is empty or invalid.');
          return;
        }

        const mapped = rows.map((row) => {
          const name = row['Name'] || row['الاسم'] || row['اسم المنتج'];
          const sku = row['SKU'] || row['الكود'] || row['رمز المنتج'];
          const barcode = row['Barcode'] || row['الباركود'] || row['باركود'];
          const categoryName = row['Category'] || row['القسم'] || row['التصنيف'];
          const cost = Number(row['Cost'] || row['سعر المورد'] || row['التكلفة'] || 0);
          const price = Number(row['Price'] || row['سعر البيع'] || row['السعر'] || 0);
          const initialStock = Number(row['Initial Stock'] || row['الكمية'] || row['المخزون الابتدائي'] || 0);

          return { name, sku, barcode, categoryName, cost, price, initialStock };
        });

        const invalid = mapped.some(item => !item.name);
        if (invalid) {
          setImportError(isAr ? 'بعض الصفوف تفتقد لاسم المنتج الأساسي.' : 'Warning: Some rows are missing a product name.');
        }

        setImportPreview(mapped);
        setImportError('');
      } catch (err) {
        setImportError(isAr ? 'فشل قراءة ملف إكسيل.' : 'Failed to read Excel file.');
      }
    };
    reader.readAsBinaryString(file);
  }

  async function confirmImport() {
    if (!importPreview || importPreview.length === 0) return;
    setImportLoading(true);
    setImportError('');
    setImportSuccess('');

    try {
      const response = await fetch('/api/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: importPreview })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import products.');
      }

      setImportSuccess(isAr ? `تم استيراد ${data.count} منتج بنجاح!` : `Successfully imported ${data.count} products!`);
      setImportPreview(null);
      router.refresh();
    } catch (err: any) {
      setImportError(err.message || 'An error occurred during import.');
    } finally {
      setImportLoading(false);
    }
  }

  const handleRegenerateVariants = (newColors: string[], newSizes: string[]) => {
    const combinations: VariantDraft[] = [];
    if (newColors.length === 0 && newSizes.length === 0) {
      setForm((current) => ({ ...current, variants: [] }));
      return;
    }

    const baseSku = form.sku || 'SKU';
    const colorsToUse = newColors.length > 0 ? newColors : [''];
    const sizesToUse = newSizes.length > 0 ? newSizes : [''];

    for (const color of colorsToUse) {
      for (const size of sizesToUse) {
        if (!color && !size) continue;

        const existing = form.variants.find(
          (v) => (v.color || '') === color && (v.size || '') === size
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
            flavor: '',
            model: '',
            sku: suffix ? `${baseSku}-${suffix}` : baseSku,
            barcode: '',
            priceOverride: '',
            costOverride: '',
            stockQty: '0',
            isActive: true
          });
        }
      }
    }

    setForm((current) => ({ ...current, variants: combinations }));
  };

  const addColor = (color: string) => {
    const trimmed = color.trim();
    if (!trimmed || colors.includes(trimmed)) return;
    const next = [...colors, trimmed];
    setColors(next);
    handleRegenerateVariants(next, sizes);
  };

  const removeColor = (color: string) => {
    const next = colors.filter((c) => c !== color);
    setColors(next);
    handleRegenerateVariants(next, sizes);
  };

  const addSize = (size: string) => {
    const trimmed = size.trim();
    if (!trimmed || sizes.includes(trimmed)) return;
    const next = [...sizes, trimmed];
    setSizes(next);
    handleRegenerateVariants(next, sizes);
  };

  const removeSize = (size: string) => {
    const next = sizes.filter((s) => s !== size);
    setSizes(next);
    handleRegenerateVariants(next, sizes);
  };

  const removeVariant = (indexToRemove: number) => {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter((_, i) => i !== indexToRemove)
    }));
  };

  const addManualVariant = () => {
    const baseSku = form.sku || 'ITEM';
    const num = form.variants.length + 1;
    setForm((current) => ({
      ...current,
      variants: [
        ...current.variants,
        {
          color: '',
          size: '',
          flavor: '',
          model: '',
          sku: `${baseSku}-SPEC${num}`,
          barcode: '',
          priceOverride: '',
          costOverride: '',
          stockQty: '0',
          isActive: true
        }
      ]
    }));
  };

  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keepDetails, setKeepDetails] = useState(false);
  const [labelSize, setLabelSize] = useState<BarcodeLabelSize>('medium');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    categoryId: '',
    baseUnitOfMeasureId: units.find((unit) => unit.code === 'PIECE')?.id ?? units[0]?.id ?? '',
    sku: '',
    barcode: '',
    name: '',
    description: '',
    cost: '0.00',
    price: '0.00',
    stockQty: '0',
    reorderPoint: '5',
    trackBatches: inventoryDefaults.batchTrackingEnabled,
    trackExpiry: inventoryDefaults.expiryTrackingEnabled,
    changeNote: '',
    uomConversions: [] as Array<{ unitOfMeasureId: string; ratioToBase: string }>,
    variants: [] as VariantDraft[],
    images: [] as ImageDraft[],
    isActive: true,
    productType: (shopType === 'MOTORCYCLE_AND_SPARE_PARTS' ? 'MOTORCYCLE' : 'SPARE_PART') as 'MOTORCYCLE' | 'SPARE_PART',
    brand: '',
    supplierPrice: '0.00',
    dealerCode: '',
    assemblyCost: '0.00',
    externalTransportCost: '0.00',
    internalTransportCost: '0.00',
    maintenanceCost: '0.00',
    otherCosts: '0.00',
    condition: 'NEW' as 'NEW' | 'USED',
    color: '',
    motorNumber: '',
    chassisNumber: '',
    chassisPhotoUrl: '',
    motorPhotoUrl: ''
  });

  const computedCost = useMemo(() => {
    if (form.productType !== 'MOTORCYCLE') return form.cost;
    const total = 
      Number(form.supplierPrice || 0) +
      Number(form.assemblyCost || 0) +
      Number(form.externalTransportCost || 0) +
      Number(form.internalTransportCost || 0) +
      Number(form.maintenanceCost || 0) +
      Number(form.otherCosts || 0);
    return String(total);
  }, [
    form.productType,
    form.cost,
    form.supplierPrice,
    form.assemblyCost,
    form.externalTransportCost,
    form.internalTransportCost,
    form.maintenanceCost,
    form.otherCosts
  ]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();

    return products.filter((product) => {
      const variantSearch = product.variants
        .map((variant) => [variant.sku ?? '', variant.barcode ?? '', toVariantLabel(variant)].join(' '))
        .join(' ');
      const matchesTerm =
        !term ||
        [product.name, product.sku ?? '', product.barcode ?? '', product.category?.name ?? '', variantSearch]
          .join(' ')
          .toLowerCase()
          .includes(term);

      const matchesCategory = !categoryFilter || product.categoryId === categoryFilter;
      return matchesTerm && matchesCategory;
    });
  }, [products, query, categoryFilter]);

  const activeCount = products.filter((product) => product.isActive).length;
  const archivedCount = products.length - activeCount;
  const lowStockCount = products.filter(
    (product) => getStockLevel(product.stockQty, product.reorderPoint, lowStockThreshold) !== 'IN_STOCK'
  ).length;
  const selectedBaseUnit = units.find((unit) => unit.id === form.baseUnitOfMeasureId) ?? null;
  const currentMargin = getMarginSummary(Number(form.price || 0), Number(form.cost || 0));

  function resetForm() {
    setEditingId(null);
    setColors([]);
    setSizes([]);
    setCustomColor('');
    setCustomSize('');
    if (keepDetails) {
      setForm((current) => ({
        ...current,
        sku: '',
        barcode: '',
        name: '',
        description: '',
        stockQty: '0',
        motorNumber: '',
        chassisNumber: '',
        chassisPhotoUrl: '',
        motorPhotoUrl: '',
        changeNote: ''
      }));
    } else {
      setForm({
        categoryId: '',
        baseUnitOfMeasureId: units.find((unit) => unit.code === 'PIECE')?.id ?? units[0]?.id ?? '',
        sku: '',
        barcode: '',
        name: '',
        description: '',
        cost: '0.00',
        price: '0.00',
        stockQty: '0',
        reorderPoint: '5',
        trackBatches: inventoryDefaults.batchTrackingEnabled,
        trackExpiry: inventoryDefaults.expiryTrackingEnabled,
        changeNote: '',
        uomConversions: [],
        variants: [],
        images: [],
        isActive: true,
        productType: 'SPARE_PART',
        brand: '',
        supplierPrice: '0.00',
        dealerCode: '',
        assemblyCost: '0.00',
        externalTransportCost: '0.00',
        internalTransportCost: '0.00',
        maintenanceCost: '0.00',
        otherCosts: '0.00',
        condition: 'NEW',
        color: '',
        motorNumber: '',
        chassisNumber: '',
        chassisPhotoUrl: '',
        motorPhotoUrl: ''
      });
    }
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  }

  function beginEdit(product: Product) {
    setEditingId(product.id);
    setError('');
    setSuccess('');
    
    const uniqueColors = Array.from(new Set(product.variants.map((v) => v.color).filter(Boolean) as string[]));
    const uniqueSizes = Array.from(new Set(product.variants.map((v) => v.size).filter(Boolean) as string[]));
    setColors(uniqueColors);
    setSizes(uniqueSizes);

    setForm({
      categoryId: product.categoryId ?? '',
      baseUnitOfMeasureId: product.baseUnitOfMeasureId ?? units.find((unit) => unit.code === 'PIECE')?.id ?? '',
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      name: product.name,
      description: product.description ?? '',
      cost: product.cost,
      price: product.price,
      stockQty: String(product.stockQty),
      reorderPoint: String(product.reorderPoint),
      trackBatches: product.trackBatches,
      trackExpiry: product.trackExpiry,
      changeNote: '',
      uomConversions: product.uomConversions.map((conversion) => ({
        unitOfMeasureId: conversion.unitOfMeasureId,
        ratioToBase: String(conversion.ratioToBase)
      })),
      variants: product.variants.map((variant) => ({
        color: variant.color ?? '',
        size: variant.size ?? '',
        flavor: variant.flavor ?? '',
        model: variant.model ?? '',
        sku: variant.sku ?? '',
        barcode: variant.barcode ?? '',
        priceOverride: variant.priceOverride ?? '',
        costOverride: variant.costOverride ?? '',
        stockQty: String(variant.stockQty ?? 0),
        isActive: variant.isActive
      })),
      images: product.images.map((image) => ({
        imageUrl: image.imageUrl,
        altText: image.altText ?? '',
        sortOrder: String(image.sortOrder)
      })),
      isActive: product.isActive,
      productType: product.productType ?? 'SPARE_PART',
      brand: product.brand ?? '',
      supplierPrice: product.supplierPrice ? String(product.supplierPrice) : '0.00',
      dealerCode: product.dealerCode ?? '',
      assemblyCost: product.assemblyCost ? String(product.assemblyCost) : '0.00',
      externalTransportCost: product.externalTransportCost ? String(product.externalTransportCost) : '0.00',
      internalTransportCost: product.internalTransportCost ? String(product.internalTransportCost) : '0.00',
      maintenanceCost: product.maintenanceCost ? String(product.maintenanceCost) : '0.00',
      otherCosts: product.otherCosts ? String(product.otherCosts) : '0.00',
      condition: product.condition ?? 'NEW',
      color: product.color ?? '',
      motorNumber: product.motorNumber ?? '',
      chassisNumber: product.chassisNumber ?? '',
      chassisPhotoUrl: product.chassisPhotoUrl ?? '',
      motorPhotoUrl: product.motorPhotoUrl ?? ''
    });
  }

  async function addUploadedImages(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const remainingSlots = Math.max(0, 6 - form.images.length);
    if (!remainingSlots) {
      setError(t('imageUploadLimitError'));
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    setUploadingImages(true);
    setError('');

    try {
      const uploadedImageUrls = await Promise.all(selectedFiles.map((file) => uploadProductImage(file)));
      setForm((current) => ({
        ...current,
        images: [
          ...current.images,
          ...uploadedImageUrls.map((imageUrl, index) => ({
            ...emptyImage(current.images.length + index),
            imageUrl
          }))
        ]
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : t('imageUploadGenericError'));
    } finally {
      setUploadingImages(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError(t('nameRequired'));
      return;
    }

    if (Number(form.cost) < 0 || Number(form.price) < 0) {
      setError(t('costPriceNegativeError'));
      return;
    }

    if (!editingId && Number(form.stockQty) < 0) {
      setError(t('openingStockNegativeError'));
      return;
    }

    if (Number(form.reorderPoint) < 0) {
      setError(t('reorderLevelNegativeError'));
      return;
    }

    if (!form.baseUnitOfMeasureId) {
      setError(t('selectBaseUnitError'));
      return;
    }

    for (const conversion of form.uomConversions) {
      if (!conversion.unitOfMeasureId || !conversion.ratioToBase) {
        setError(t('packConversionBlankError'));
        return;
      }

      if (Number(conversion.ratioToBase) <= 0) {
        setError(t('packConversionRatioError'));
        return;
      }
    }

    for (const variant of form.variants) {
      if (![variant.color, variant.size, variant.flavor, variant.model, variant.sku, variant.barcode].some(Boolean)) {
        setError(t('variantDescriptorRequired'));
        return;
      }

      if (variant.priceOverride && Number(variant.priceOverride) < 0) {
        setError(t('variantPriceOverrideError'));
        return;
      }

      if (variant.costOverride && Number(variant.costOverride) < 0) {
        setError(t('variantCostOverrideError'));
        return;
      }
    }

    for (const image of form.images) {
      if (!image.imageUrl.trim()) {
        setError(t('imageBlankUrlError'));
        return;
      }
    }

    setLoading(true);

    const payload = {
      ...form,
      categoryId: form.categoryId || null,
      sku: form.sku || null,
      barcode: form.barcode || null,
      description: form.description || null,
      changeNote: form.changeNote || null,
      cost: Number(form.cost),
      price: Number(form.price),
      reorderPoint: Number(form.reorderPoint),
      productType: 'SPARE_PART' as const,
      supplierPrice: null,
      assemblyCost: null,
      externalTransportCost: null,
      internalTransportCost: null,
      maintenanceCost: null,
      otherCosts: null,
      brand: null,
      dealerCode: null,
      condition: 'NEW' as const,
      color: null,
      motorNumber: null,
      chassisNumber: null,
      chassisPhotoUrl: null,
      motorPhotoUrl: null,
      uomConversions: form.uomConversions.map((conversion) => ({
        unitOfMeasureId: conversion.unitOfMeasureId,
        ratioToBase: Number(conversion.ratioToBase)
      })),
      variants: form.variants.map((variant) => ({
        color: variant.color || null,
        size: variant.size || null,
        flavor: variant.flavor || null,
        model: variant.model || null,
        sku: variant.sku || null,
        barcode: variant.barcode || null,
        priceOverride: variant.priceOverride ? Number(variant.priceOverride) : null,
        costOverride: variant.costOverride ? Number(variant.costOverride) : null,
        stockQty: Number(variant.stockQty || 0),
        isActive: variant.isActive
      })),
      images: form.images.map((image, index) => ({
        imageUrl: image.imageUrl.trim(),
        altText: image.altText || null,
        sortOrder: Number(image.sortOrder || index)
      })),
      ...(editingId ? {} : {
        stockQty: form.variants.length > 0
          ? form.variants.reduce((sum, v) => sum + Number(v.stockQty || 0), 0)
          : Number(form.stockQty)
      })
    };

    const response = await fetch(editingId ? `/api/products/${editingId}` : '/api/products', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({ error: 'Failed to save product.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? t('saveError'));
      return;
    }

    const product = {
      ...data.product,
      cost: String(data.product.cost),
      price: String(data.product.price),
      baseUnitOfMeasure: data.product.baseUnitOfMeasure,
      uomConversions: data.product.uomConversions ?? [],
      variants: data.product.variants ?? [],
      images: data.product.images ?? [],
      priceHistory: data.product.priceHistory ?? [],
      costHistory: data.product.costHistory ?? [],
      supplierPrice: data.product.supplierPrice ? String(data.product.supplierPrice) : null,
      assemblyCost: data.product.assemblyCost ? String(data.product.assemblyCost) : null,
      externalTransportCost: data.product.externalTransportCost ? String(data.product.externalTransportCost) : null,
      internalTransportCost: data.product.internalTransportCost ? String(data.product.internalTransportCost) : null,
      maintenanceCost: data.product.maintenanceCost ? String(data.product.maintenanceCost) : null,
      otherCosts: data.product.otherCosts ? String(data.product.otherCosts) : null,
      batches: editingId
        ? products.find((item) => item.id === editingId)?.batches ?? []
        : []
    };

    setProducts((currentProducts) =>
      editingId
        ? currentProducts.map((item) => (item.id === editingId ? product : item))
        : [product, ...currentProducts]
    );

    setSuccess(editingId ? t('productUpdatedSuccess') : t('productCreatedSuccess'));
    resetForm();
  }

  async function toggleArchive(product: Product) {
    const confirmed = window.confirm(
      product.isActive
        ? t('archiveConfirm', { name: product.name })
        : t('restoreConfirm', { name: product.name })
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isActive: !product.isActive
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.product) {
      setError(data?.error ?? t('unableUpdateStatus'));
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((item) =>
        item.id === product.id
          ? { ...item, isActive: data.product.isActive }
          : item
      )
    );
  }

  return (
    <div className="space-y-6">
      {canEditProducts ? (
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">{t('catalogEditor')}</div>
            <div id="new-product" className="mt-2 text-2xl font-black text-stone-900">
              {editingId ? t('editProduct') : t('addProduct')}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              {t('editorDescription')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('active')}</div>
              <div className="mt-1 text-xl font-black text-stone-950">{activeCount}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('lowStock')}</div>
              <div className="mt-1 text-xl font-black text-sky-700">{lowStockCount}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">{t('archived')}</div>
              <div className="mt-1 text-xl font-black text-stone-950">{archivedCount}</div>
            </div>
          </div>
        </div>

        <form onSubmit={saveProduct} className="space-y-6">
          <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">التفاصيل الأساسية للمنتج</div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <FieldLabel>{t('productName')}</FieldLabel>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </div>
              <div>
                <FieldLabel>{t('category')}</FieldLabel>
                <select className={selectClassName} value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
                  <option value="">{t('uncategorized')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>{t('baseSellingUnit')}</FieldLabel>
                <select
                  className={selectClassName}
                  value={form.baseUnitOfMeasureId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      baseUnitOfMeasureId: event.target.value,
                      uomConversions: current.uomConversions.filter((conversion) => conversion.unitOfMeasureId !== event.target.value)
                    }))
                  }
                >
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>{t('sku')}</FieldLabel>
                <Input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} />
              </div>
              <div>
                <FieldLabel>{t('barcode')}</FieldLabel>
                <Input value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} />
              </div>
              {canViewPurchaseCosts ? (
                <div>
                  <FieldLabel>{t('costPrice')}</FieldLabel>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.cost}
                    onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))}
                  />
                </div>
              ) : null}
              <div>
                <FieldLabel>{t('sellingPrice')}</FieldLabel>
                <Input type="number" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
              </div>
              <div>
                <FieldLabel>{editingId ? t('currentStock') : t('openingStockQty')}</FieldLabel>
                <Input
                  type="number"
                  value={form.variants.length > 0 ? String(form.variants.reduce((sum, v) => sum + Number(v.stockQty || 0), 0)) : form.stockQty}
                  onChange={(event) => setForm((current) => ({ ...current, stockQty: event.target.value }))}
                  disabled={Boolean(editingId) || form.variants.length > 0}
                />
              </div>
              <div>
                <FieldLabel>{t('lowStockReorderLevel')}</FieldLabel>
                <Input type="number" value={form.reorderPoint} onChange={(event) => setForm((current) => ({ ...current, reorderPoint: event.target.value }))} />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <FieldLabel>{t('description')}</FieldLabel>
                <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div>
                <FieldLabel>{t('changeNote')}</FieldLabel>
                <Input value={form.changeNote} onChange={(event) => setForm((current) => ({ ...current, changeNote: event.target.value }))} placeholder={t('changeNotePlaceholder')} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
              <div className={`rounded-[20px] border px-4 py-3 text-sm ${currentMargin.tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : currentMargin.tone === 'amber' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>
                {t('marginCheck', { message: currentMargin.message, margin: currentMargin.percentage.toFixed(1) })}
              </div>
              <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
                {t('baseUnitLabel', { unit: selectedBaseUnit?.name ?? t('uncategorized'), days: inventoryDefaults.expiryAlertDays })}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{t('operations')}</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={form.trackBatches}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trackBatches: event.target.checked,
                      trackExpiry: event.target.checked ? current.trackExpiry : false
                    }))
                  }
                />
                {t('trackBatches')}
              </label>
              <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={form.trackExpiry}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trackExpiry: event.target.checked,
                      trackBatches: event.target.checked ? true : current.trackBatches
                    }))
                  }
                />
                {t('trackExpiry')}
              </label>
            </div>

            <div className="mt-4 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              {inventoryDefaults.batchTrackingEnabled ? t('batchTrackingDefaultMsg') : t('batchTrackingOptionalMsg')}
              {' '}
              {inventoryDefaults.expiryTrackingEnabled ? t('expiryTrackingDefaultMsg') : t('expiryTrackingOptionalMsg')}
            </div>

            {false && (
            <div className="mt-4 rounded-[20px] border border-stone-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-stone-900">{t('packConversions')}</div>
              <div className="space-y-3">
                {units
                  .filter((unit) => unit.id !== form.baseUnitOfMeasureId)
                  .map((unit) => {
                    const conversion = form.uomConversions.find((entry) => entry.unitOfMeasureId === unit.id);

                    return (
                      <div key={unit.id} className="grid gap-3 sm:grid-cols-[1fr_180px] sm:items-center">
                        <div className="text-sm text-stone-600">
                          1 <span className="font-semibold text-stone-900">{unit.name}</span>
                          {' = '}
                          <span className="font-semibold text-stone-900">{conversion?.ratioToBase || '...'}</span>
                          {' '}
                          <span className="font-semibold text-stone-900">{selectedBaseUnit?.name ?? ''}</span>
                        </div>
                        <Input
                          type="number"
                          min="1"
                          value={conversion?.ratioToBase ?? ''}
                          onChange={(event) =>
                            setForm((current) => {
                              const nextValue = event.target.value;
                              const remaining = current.uomConversions.filter((entry) => entry.unitOfMeasureId !== unit.id);

                              if (!nextValue) {
                                return { ...current, uomConversions: remaining };
                              }

                              return {
                                ...current,
                                uomConversions: [...remaining, { unitOfMeasureId: unit.id, ratioToBase: nextValue }]
                              };
                            })
                          }
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
            )}
          </div>

          {/* ========== Marine Specs & Packaging Builder ========== */}
          <div className="rounded-[26px] border border-cyan-100 bg-white/80 p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-600">نظام إدارة التعبئة والمواصفات البحرية</div>
                <div className="mt-1 text-lg font-black text-slate-900">خيارات التعبئة والمواصفات الفنية للمؤن والقطع</div>
              </div>
              <Button type="button" variant="secondary" onClick={addManualVariant} className="text-xs">
                + إضافة مواصفة / عبوة يدوياً
              </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Marine Specs / Storage Conditions */}
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/60 p-4">
                <FieldLabel>المواصفة الفنية أو حالة الحفظ البحرية</FieldLabel>
                <div className="flex flex-wrap gap-2 mb-3">
                  {MARINE_SPEC_PRESETS.map((spec) => {
                    const selected = colors.includes(spec);
                    return (
                      <button
                        key={spec}
                        type="button"
                        onClick={() => selected ? removeColor(spec) : addColor(spec)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                          selected
                            ? 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-200'
                            : 'bg-white border border-slate-200 text-slate-700 hover:border-sky-300'
                        }`}
                      >
                        {spec}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="مواصفة مخصصة (مثال: معتمد DNV, طازج هولندي)..."
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addColor(customColor);
                        setCustomColor('');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      addColor(customColor);
                      setCustomColor('');
                    }}
                  >
                    إضافة
                  </Button>
                </div>
                {colors.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-200 pt-3">
                    <span className="text-xs text-slate-500 w-full mb-1">المواصفات المختارة:</span>
                    {colors.map((spec) => (
                      <span
                        key={spec}
                        className="inline-flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-800 rounded-full px-3 py-1 text-xs font-semibold"
                      >
                        {spec}
                        <button type="button" onClick={() => removeColor(spec)} className="text-sky-600 hover:text-sky-800 font-bold ml-1">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Packaging / Dimensions selection */}
              <div className="rounded-[22px] border border-slate-200 bg-slate-50/60 p-4">
                <FieldLabel>وحدات وأحجام التعبئة / التغليف البحري</FieldLabel>
                <div className="flex flex-wrap gap-2 mb-3">
                  {MARINE_PACK_PRESETS.map((pack) => {
                    const selected = sizes.includes(pack);
                    return (
                      <button
                        key={pack}
                        type="button"
                        onClick={() => selected ? removeSize(pack) : addSize(pack)}
                        className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                          selected
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-200'
                            : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-300'
                        }`}
                      >
                        {pack}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="عبوة مخصصة (مثال: برميل 50 لتر, بالتة 1 طن)..."
                    value={customSize}
                    onChange={(e) => setCustomSize(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSize(customSize);
                        setCustomSize('');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      addSize(customSize);
                      setCustomSize('');
                    }}
                  >
                    إضافة
                  </Button>
                </div>
                {sizes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-200 pt-3">
                    <span className="text-xs text-slate-500 w-full mb-1">العبوات المختارة:</span>
                    {sizes.map((pack) => (
                      <span
                        key={pack}
                        className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full px-3 py-1 text-xs font-semibold"
                      >
                        {pack}
                        <button type="button" onClick={() => removeSize(pack)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-1">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Generated variant combinations matrix */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">جدول فئات التعبئة والمواصفات وكميات المخزون البحري ({form.variants.length})</div>
              </div>
              {form.variants.length > 0 ? (
                <div className="space-y-3">
                  {form.variants.map((variant, index) => (
                    <div key={`variant-${index}`} className="rounded-[22px] border border-slate-200 bg-slate-50/50 p-4 hover:border-slate-300 transition">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-800">
                            {variant.color && variant.size
                              ? `${variant.color} / ${variant.size}`
                              : variant.color || variant.size || `مواصفة #${index + 1}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={variant.isActive}
                              onChange={(e) =>
                                setForm((current) => ({
                                  ...current,
                                  variants: current.variants.map((v, i) =>
                                    i === index ? { ...v, isActive: e.target.checked } : v
                                  )
                                }))
                              }
                            />
                            متاح لتموين السفن
                          </label>
                          <button
                            type="button"
                            onClick={() => removeVariant(index)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium hover:underline"
                          >
                            حذف المواصفة
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">المخزون المتاح بالمستودع</label>
                          <Input
                            type="number"
                            value={variant.stockQty || '0'}
                            onChange={(e) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, stockQty: e.target.value } : v
                                )
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">كود الصنف (SKU)</label>
                          <Input
                            value={variant.sku}
                            onChange={(e) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, sku: e.target.value } : v
                                )
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">كود إيمبا / باركود (IMPA)</label>
                          <Input
                            placeholder="مثال: 232011"
                            value={variant.barcode}
                            onChange={(e) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, barcode: e.target.value } : v
                                )
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">سعر التوريد للسفن ({currencySymbol})</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={form.price}
                            value={variant.priceOverride}
                            onChange={(e) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, priceOverride: e.target.value } : v
                                )
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-600">سعر التكلفة الشراء ({currencySymbol})</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={form.cost}
                            value={variant.costOverride}
                            onChange={(e) =>
                              setForm((current) => ({
                                ...current,
                                variants: current.variants.map((v, i) =>
                                  i === index ? { ...v, costOverride: e.target.value } : v
                                )
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  يرجى اختيار العبوات والمواصفات البحرية لتوليد فئات التوريد وتحديد كميات المخزون.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{t('imagesCount', { count: form.images.length })}</div>
                  <div className="mt-1 text-lg font-black text-stone-900">{t('productMedia')}</div>
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => void addUploadedImages(event.target.files)}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => uploadInputRef.current?.click()} disabled={uploadingImages || form.images.length >= 6}>
                    {uploadingImages ? t('uploading') : t('uploadImage')}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, images: [...current.images, emptyImage(current.images.length)] }))}>
                    {t('addUrl')}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {form.images.length ? form.images.map((image, index) => (
                  <div key={`image-${index}`} className="rounded-[22px] border border-stone-200 bg-stone-50/80 p-4">
                    <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                      <div className="overflow-hidden rounded-[18px] border border-stone-200 bg-white">
                        {image.imageUrl ? (
                          <img src={image.imageUrl} alt={image.altText || form.name || t('productHeader')} className="h-28 w-full object-cover" />
                        ) : (
                          <div className="flex h-28 items-center justify-center text-xs text-stone-400">{t('noImage')}</div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <Input placeholder={t('imageUrlPlaceholder')} value={image.imageUrl} onChange={(event) => setForm((current) => ({ ...current, images: current.images.map((entry, entryIndex) => entryIndex === index ? { ...entry, imageUrl: event.target.value } : entry) }))} />
                        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                          <Input placeholder={t('altTextPlaceholder')} value={image.altText} onChange={(event) => setForm((current) => ({ ...current, images: current.images.map((entry, entryIndex) => entryIndex === index ? { ...entry, altText: event.target.value } : entry) }))} />
                          <Input type="number" placeholder={t('sortOrderPlaceholder')} value={image.sortOrder} onChange={(event) => setForm((current) => ({ ...current, images: current.images.map((entry, entryIndex) => entryIndex === index ? { ...entry, sortOrder: event.target.value } : entry) }))} />
                          <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, images: current.images.filter((_, entryIndex) => entryIndex !== index) }))}>
                            {t('remove')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                    {t('noImagesYet')}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{t('barcodeLabels')}</div>
                  <div className="mt-1 text-lg font-black text-stone-900">{t('previewAndPrint')}</div>
                </div>
                <select className={selectClassName} value={labelSize} onChange={(event) => setLabelSize(event.target.value as BarcodeLabelSize)}>
                  <option value="small">{t('small')}</option>
                  <option value="medium">{t('medium')}</option>
                  <option value="large">{t('large')}</option>
                </select>
              </div>

              <div className="mt-4 space-y-4">
                <BarcodeLabelPreview code={form.barcode || form.sku} productName={form.name || t('productHeader')} sku={form.sku || null} size={labelSize} />
                {form.variants.filter((variant) => variant.barcode || variant.sku).slice(0, 2).map((variant, index) => (
                  <BarcodeLabelPreview
                    key={`barcode-preview-${index}`}
                    code={variant.barcode || variant.sku}
                    productName={form.name || t('productHeader')}
                    variantLabel={toVariantLabel(variant)}
                    sku={variant.sku || null}
                    size={labelSize}
                  />
                ))}
              </div>

              {editingId ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={lp(`/print/barcode-labels?productId=${editingId}&size=${labelSize}`)} target="_blank">
                    <Button type="button">{t('printLabels')}</Button>
                  </Link>
                  {products
                    .find((product) => product.id === editingId)
                    ?.variants.filter((variant) => variant.barcode || variant.sku)
                    .slice(0, 2)
                    .map((variant) => (
                      <Link key={variant.id} href={lp(`/print/barcode-labels?productId=${editingId}&variantId=${variant.id}&size=${labelSize}`)} target="_blank">
                        <Button type="button" variant="secondary">
                          {t('printVariant', { name: toVariantLabel(variant) || 'variant' })}
                        </Button>
                      </Link>
                    ))}
                </div>
              ) : null}
            </div>
          </div>

          {editingId ? (
            <div className="grid gap-6 xl:grid-cols-2">
              {canViewPurchaseCosts ? (
                <>
                  <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{t('priceHistoryTitle')}</div>
                    <div className="mt-1 text-lg font-black text-stone-900">{t('priceChanges')}</div>
                    <div className="mt-4 space-y-3">
                      {(products.find((product) => product.id === editingId)?.priceHistory ?? []).length ? (
                        products.find((product) => product.id === editingId)!.priceHistory.map((entry) => (
                          <div key={entry.id} className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                            <div className="font-semibold text-stone-900">
                              {t('historyChangedBy', { prev: money(entry.previousPrice, currencySymbol), next: money(entry.newPrice, currencySymbol), date: shortDate(entry.effectiveDate), user: entry.changedByUser.name ?? entry.changedByUser.email })}
                            </div>
                            {entry.note ? <div className="mt-2 text-xs text-stone-500">{t('historyReason', { reason: entry.note })}</div> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                          {t('noPriceChanges')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">{t('costHistoryTitle')}</div>
                    <div className="mt-1 text-lg font-black text-stone-900">{t('costChanges')}</div>
                    <div className="mt-4 space-y-3">
                      {(products.find((product) => product.id === editingId)?.costHistory ?? []).length ? (
                        products.find((product) => product.id === editingId)!.costHistory.map((entry) => (
                          <div key={entry.id} className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                            <div className="font-semibold text-stone-900">
                              {t('historyChangedBy', { prev: money(entry.previousCost, currencySymbol), next: money(entry.newCost, currencySymbol), date: shortDate(entry.effectiveDate), user: entry.changedByUser.name ?? entry.changedByUser.email })}
                            </div>
                            {entry.note ? <div className="mt-2 text-xs text-stone-500">{t('historyReason', { reason: entry.note })}</div> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                          {t('noCostChanges')}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{success}</div> : null}

          {!editingId ? (
            <div className="flex items-center gap-2 mb-2 select-none">
              <input
                id="keepDetails"
                type="checkbox"
                checked={keepDetails}
                onChange={(event) => setKeepDetails(event.target.checked)}
                className="h-5 w-5 rounded-lg border-stone-300 text-blue-600 focus:ring-blue-500/30 transition cursor-pointer"
              />
              <label htmlFor="keepDetails" className="text-sm font-semibold text-stone-700 cursor-pointer">
                {t('keepDetails')}
              </label>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="submit" disabled={loading}>
              {loading ? t('saving') : editingId ? t('updateProduct') : t('save')}
            </Button>
            {editingId ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                {t('cancel')}
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
      ) : (
      <Card>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">{t('readOnlyTitle')}</div>
        <div className="mt-2 text-2xl font-black text-stone-900">{t('readOnlyTitle')}</div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
          {t('readOnlyDesc', { costInfo: canViewPurchaseCosts ? t('costInfo') : '' })}
        </p>
      </Card>
      )}

      {importSuccess && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-850 shadow-sm">
          {importSuccess}
        </div>
      )}

      {importPreview && (
        <Card className="border border-blue-200 bg-blue-50/10 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <div>
              <h3 className="text-lg font-black text-stone-900">
                {isAr ? 'معاينة المنتجات المراد استيرادها' : 'Preview Products to Import'}
              </h3>
              <p className="text-xs text-stone-500">
                {isAr ? `تم العثور على ${importPreview.length} منتج جاهز للاستيراد.` : `Found ${importPreview.length} products ready for import.`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setImportPreview(null)}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="button" disabled={importLoading} onClick={confirmImport}>
                {importLoading ? '...' : isAr ? 'تأكيد الاستيراد' : 'Confirm Import'}
              </Button>
            </div>
          </div>

          {importError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
              {importError}
            </div>
          )}

          <div className="max-h-60 overflow-y-auto rounded-2xl border border-stone-200 bg-white">
            <table className="min-w-full text-start text-xs">
              <thead className="bg-stone-50 text-stone-500 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-start">{isAr ? 'اسم المنتج' : 'Name'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'الكود (SKU)' : 'SKU'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'الباركود' : 'Barcode'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'التصنيف' : 'Category'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'التكلفة' : 'Cost'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'السعر' : 'Price'}</th>
                  <th className="px-3 py-2 text-start">{isAr ? 'المخزون' : 'Stock'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {importPreview.map((item, idx) => (
                  <tr key={idx} className="hover:bg-stone-50/50">
                    <td className="px-3 py-2 font-semibold text-stone-900">{item.name || <span className="text-red-500 font-bold">MISSING</span>}</td>
                    <td className="px-3 py-2 text-stone-600">{item.sku || '-'}</td>
                    <td className="px-3 py-2 text-stone-600">{item.barcode || '-'}</td>
                    <td className="px-3 py-2 text-stone-600">{item.categoryName || '-'}</td>
                    <td className="px-3 py-2 text-stone-600">{money(item.cost, currencySymbol)}</td>
                    <td className="px-3 py-2 text-stone-600">{money(item.price, currencySymbol)}</td>
                    <td className="px-3 py-2 text-stone-600">{item.initialStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-stone-900">{t('catalogTitle')}</h2>
            <p className="text-sm text-stone-500">{t('catalogSubtitle')}</p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Input placeholder={t('searchPlaceholder')} value={query} onChange={(event) => setQuery(event.target.value)} className="md:w-72" />
            <select className={`${selectClassName} md:w-56`} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">{t('allCategories')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {canEditProducts && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleExcelUpload}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-2xl"
                  onClick={() => fileInputRef.current?.click()}
                >
                  📁 {isAr ? 'استيراد من إكسيل' : 'Import from Excel'}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-start text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5">{t('productHeader')}</th>
                  <th className="px-4 py-3.5">{t('categoryHeader')}</th>
                  <th className="px-4 py-3.5">{t('commercialHeader')}</th>
                  <th className="px-4 py-3.5">{t('variantsHeader')}</th>
                  <th className="px-4 py-3.5">{t('pricingHeader')}</th>
                  <th className="px-4 py-3.5">{t('stockHeader')}</th>
                  <th className="px-4 py-3.5">{t('statusHeader')}</th>
                  <th className="px-4 py-3.5">{t('actionsHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const level = getStockLevel(product.stockQty, product.reorderPoint, lowStockThreshold);
                  const margin = getMarginSummary(Number(product.price), Number(product.cost));
                  const nextExpiryBatch = product.batches.find((batch) => batch.expiryDate && batch.quantity > 0) ?? null;

                  return (
                    <tr key={product.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                      <td className="px-4 py-4">
                        <div className="flex gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded-[18px] border border-stone-200 bg-stone-50">
                            {product.images[0] ? (
                              <img src={product.images[0].imageUrl} alt={product.images[0].altText ?? product.name} className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-semibold text-stone-900">{product.name}</div>
                            <div className="mt-1 text-xs text-stone-500">{product.description ?? t('noDescription')}</div>
                            {product.productType === 'MOTORCYCLE' && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                <Badge tone="blue">{product.brand || 'N/A'}</Badge>
                                <Badge tone="stone">{product.condition === 'NEW' ? t('new') : t('used')}</Badge>
                                {product.color && <Badge tone="emerald">{product.color}</Badge>}
                                {product.motorNumber && <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-mono">M: {product.motorNumber}</span>}
                                {product.chassisNumber && <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-mono">C: {product.chassisNumber}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">{product.category?.name ?? t('uncategorized')}</td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>{product.sku || 'N/A'} / {product.barcode || 'N/A'}</div>
                        <div className="mt-2 text-xs text-stone-500">
                          {t('baseUnitLabel').split('/')[0]?.trim() || 'Base'}: {product.baseUnitOfMeasure?.name ?? t('uncategorized')}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
                          {summarizeConversions(
                            product.uomConversions.map((conversion) => ({
                              unitName: conversion.unitOfMeasure.name,
                              ratioToBase: conversion.ratioToBase
                            })),
                            product.baseUnitOfMeasure?.name
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="blue">{t('variantsCount', { count: product.variants.length })}</Badge>
                          {product.images.length ? <Badge tone="stone">{t('imagesCount', { count: product.images.length })}</Badge> : null}
                        </div>
                        <div className="mt-2 text-xs text-stone-500">
                          {product.variants.slice(0, 2).map((variant) => toVariantLabel(variant) || variant.sku || variant.barcode || 'Variant').join(' | ') || t('noVariants')}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{money(product.price, currencySymbol)}</div>
                        {canViewPurchaseCosts ? (
                          <>
                            <div className="text-xs text-stone-500">{t('costPrice')} {money(product.cost, currencySymbol)}</div>
                            <div className={`mt-2 text-xs ${margin.tone === 'red' ? 'text-red-700' : margin.tone === 'amber' ? 'text-sky-700' : 'text-blue-700'}`}>
                              {margin.message}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-stone-500">{t('costRestricted')}</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{product.stockQty}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {nextExpiryBatch?.expiryDate
                            ? t('nextExpiry', { date: shortDate(nextExpiryBatch.expiryDate) })
                            : product.batches.length
                              ? t('batchRecords', { count: product.batches.length })
                              : t('noBatchRecords')}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={product.isActive ? 'emerald' : 'stone'}>{product.isActive ? t('active') : t('archived')}</Badge>
                          <Badge tone={level === 'OUT_OF_STOCK' ? 'red' : level === 'LOW_STOCK' ? 'amber' : 'blue'}>
                            {level === 'OUT_OF_STOCK'
                              ? t('productManager.outOfStock')
                              : level === 'LOW_STOCK'
                                ? t('productManager.lowStock')
                                : t('productManager.inStock')}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {canEditProducts ? (
                          <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => beginEdit(product)}>
                              {t('edit')}
                            </Button>
                            <Button type="button" variant="ghost" className="text-xs uppercase tracking-[0.14em]" onClick={() => toggleArchive(product)}>
                              {product.isActive ? t('archive') : t('restore')}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-500">{t('noEditAccess')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!filtered.length ? (
            <div className="border-t border-stone-200 bg-stone-50 py-10 text-center text-sm text-stone-500">
              {t('noProducts')}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
