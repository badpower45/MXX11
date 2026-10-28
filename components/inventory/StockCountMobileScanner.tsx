'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

type StockCountItem = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  expectedQty: number;
  actualQty: number | null;
  varianceQty: number;
};

type StockCountDetail = {
  id: string;
  referenceNumber: string;
  title: string | null;
  status: string;
  isBlind: boolean;
  notes: string | null;
  items: StockCountItem[];
  assignees?: Array<{
    id: string;
    userId: string | null;
    guestStaffId: string | null;
    name: string;
    email: string;
    completedAt: string | null;
  }>;
};

type StockCountMobileScannerProps = {
  stockCount: StockCountDetail;
  locale: string;
  currencySymbol: string;
  currentUserId: string;
};

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string; format: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

export default function StockCountMobileScanner({
  stockCount: initialStockCount,
  locale,
  currentUserId
}: StockCountMobileScannerProps) {
  const router = useRouter();
  const isAr = locale === 'ar';

  const [stockCount, setStockCount] = useState<StockCountDetail>(initialStockCount);
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentScans, setRecentScans] = useState<Array<StockCountItem & { scanTime: string }>>([]);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const [flashDetection, setFlashDetection] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const scanningRef = useRef(false);
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const submittingRef = useRef(false);

  // Check BarcodeDetector support on mount
  useEffect(() => {
    setCameraSupported('BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  // Keep focus on barcode input when camera is off
  useEffect(() => {
    if (!cameraActive) {
      barcodeInputRef.current?.focus();
    }
  }, [cameraActive]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function playBeep(isSuccess = true) {
    try {
      const AudioCtx = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = isSuccess ? 880 : 220;
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + (isSuccess ? 0.12 : 0.35));
    } catch (e) {
      console.warn('Audio beep failed', e);
    }
  }

  const submitBarcode = useCallback(async (code: string) => {
    if (!code.trim() || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/stock-counts/${stockCount.id}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: code.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || (isAr ? 'فشل إرسال الباركود' : 'Failed to submit barcode'));
      }

      playBeep(true);
      setSuccess(isAr ? `✅ تم مسح: ${data.item.productNameSnapshot}` : `✅ Scanned: ${data.item.productNameSnapshot}`);

      setStockCount((prev) => {
        const index = prev.items.findIndex((item) => item.productId === data.item.productId);
        const updatedItems = [...prev.items];
        if (index > -1) {
          updatedItems[index] = data.item;
        } else {
          updatedItems.push(data.item);
        }
        return { ...prev, items: updatedItems };
      });

      setRecentScans((prev) => {
        const filtered = prev.filter((item) => item.productId !== data.item.productId);
        return [{ ...data.item, scanTime: new Date().toLocaleTimeString() }, ...filtered].slice(0, 15);
      });

      setBarcode('');
      setFlashDetection(true);
      setTimeout(() => setFlashDetection(false), 400);
    } catch (err: unknown) {
      playBeep(false);
      const msg = err instanceof Error ? err.message : (isAr ? 'خطأ أثناء المسح' : 'An error occurred during scanning.');
      setError(msg);
    } finally {
      setLoading(false);
      submittingRef.current = false;
      if (!cameraActive) {
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
      }
    }
  }, [stockCount.id, isAr, cameraActive]);

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitBarcode(barcode);
  }

  function stopCameraStream() {
    scanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startCamera() {
    setCameraError('');

    if (!('BarcodeDetector' in window)) {
      setCameraError(isAr
        ? 'متصفحك لا يدعم مسح الباركود بالكاميرا. استخدم Chrome على Android أو Samsung Internet.'
        : 'Your browser does not support camera barcode scanning. Use Chrome on Android.');
      return;
    }

    try {
      // Initialize detector
      const detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'qr_code', 'upc_a', 'upc_e', 'itf', 'codabar', 'data_matrix']
      });
      detectorRef.current = detector;

      // Get rear camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      scanningRef.current = true;
      startScanLoop();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setCameraError(isAr ? 'تم رفض الإذن للكاميرا. اسمح بالوصول في إعدادات المتصفح.' : 'Camera permission denied. Allow access in browser settings.');
      } else if (msg.includes('NotFound')) {
        setCameraError(isAr ? 'لا توجد كاميرا متاحة على هذا الجهاز.' : 'No camera found on this device.');
      } else {
        setCameraError(isAr ? `خطأ في الكاميرا: ${msg}` : `Camera error: ${msg}`);
      }
    }
  }

  function stopCamera() {
    stopCameraStream();
    setCameraActive(false);
    setCameraError('');
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  }

  function startScanLoop() {
    async function scan() {
      if (!scanningRef.current) return;

      if (
        videoRef.current &&
        detectorRef.current &&
        videoRef.current.readyState >= 2 &&
        !submittingRef.current
      ) {
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            const now = Date.now();
            const last = lastScannedRef.current;
            // Debounce: ignore same code within 2.5 seconds
            if (code !== last.code || now - last.time > 2500) {
              lastScannedRef.current = { code, time: now };
              void submitBarcode(code);
            }
          }
        } catch {
          // Ignore frame errors, keep scanning
        }
      }

      if (scanningRef.current) {
        requestAnimationFrame(scan);
      }
    }

    requestAnimationFrame(scan);
  }

  async function adjustQuantity(item: StockCountItem, delta: number) {
    setError('');
    setSuccess('');
    const nextActual = Math.max(0, (item.actualQty ?? 0) + delta);

    const myAssignee = stockCount.assignees?.find((a) => a.userId === currentUserId);
    if (!myAssignee) {
      setError(isAr 
        ? 'يرجى مسح باركود أولاً لتهيئة وردية الجرد الخاصة بك.' 
        : 'Please scan a barcode first to initialize your stock count session.');
      return;
    }

    try {
      const response = await fetch(`/api/stock-counts/${stockCount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE',
          userEntries: [{
            productId: item.productId,
            assigneeId: myAssignee.id,
            actualQty: nextActual
          }]
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update quantity');

      setStockCount(data.stockCount);
      setRecentScans((prev) =>
        prev.map((r) => (r.productId === item.productId ? { ...r, actualQty: nextActual } : r))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (isAr ? 'فشل تحديث الكمية' : 'Failed to update item quantity.');
      setError(msg);
    }
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-8" dir={isAr ? 'rtl' : 'ltr'}>

      {/* Header card */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">
              {isAr ? 'جرد الموبايل' : 'Mobile Stock Count'}
            </div>
            <h2 className="mt-1 text-xl font-black text-stone-950 truncate">{stockCount.referenceNumber}</h2>
            <p className="text-xs text-stone-500 mt-1 truncate">{stockCount.title || (isAr ? 'جرد مخزن' : 'Stock Count Sheet')}</p>
          </div>
          <Link href={`/stock-counts/${stockCount.id}`}>
            <Button type="button" variant="ghost" className="text-sm font-semibold whitespace-nowrap">
              {isAr ? '← رجوع' : '← Back'}
            </Button>
          </Link>
        </div>
      </Card>

      {/* Camera Section */}
      {cameraActive ? (
        <Card className="overflow-hidden p-0">
          {/* Live viewfinder */}
          <div className={`relative bg-stone-950 transition-all ${flashDetection ? 'ring-4 ring-emerald-400' : ''}`}>
            <video
              ref={videoRef}
              className="w-full"
              playsInline
              muted
              autoPlay
              style={{ display: 'block', maxHeight: '60vw', objectFit: 'cover' }}
            />
            {/* Aiming overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-28">
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-emerald-400/60 animate-pulse" />
              </div>
            </div>
            {/* Status overlay */}
            {loading && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-stone-900/80 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                {isAr ? '⏳ جاري التسجيل...' : '⏳ Processing...'}
              </div>
            )}
            {success && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap max-w-[80%] truncate">
                {success}
              </div>
            )}
          </div>

          {/* Camera controls */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="text-xs text-stone-500 flex-1">
              {isAr ? '🎯 وجّه الكاميرا نحو الباركود' : '🎯 Point camera at barcode'}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="text-sm font-semibold px-4 py-2 text-red-600"
              onClick={stopCamera}
            >
              {isAr ? '✕ إيقاف الكاميرا' : '✕ Stop Camera'}
            </Button>
          </div>
        </Card>
      ) : (
        /* Manual input + camera open button */
        <Card>
          <form onSubmit={handleScanSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-1.5">
                {isAr ? 'امسح الباركود أو ادخل الكود يدوياً' : 'Scan Barcode or Enter SKU'}
              </label>
              <div className="flex gap-2">
                <Input
                  ref={barcodeInputRef}
                  type="text"
                  inputMode="none"
                  placeholder={isAr ? 'اضغط هنا وامسح بماسح خارجي...' : 'Focus here to scan...'}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  disabled={loading}
                  className="flex-1"
                  autoComplete="off"
                />
                <Button type="submit" disabled={loading || !barcode.trim()} className="px-4 font-bold">
                  {loading ? '...' : isAr ? 'إرسال' : 'Submit'}
                </Button>
              </div>
            </div>

            {/* Camera open button */}
            {cameraSupported !== false && (
              <Button
                type="button"
                onClick={startCamera}
                className="w-full py-3.5 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl flex items-center justify-center gap-2"
              >
                <span>📷</span>
                <span>{isAr ? 'فتح كاميرا الهاتف للمسح' : 'Open Camera to Scan'}</span>
              </Button>
            )}

            {cameraSupported === false && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                ⚠️ {isAr
                  ? 'مسح الكاميرا غير مدعوم على هذا المتصفح. استخدم Chrome على Android.'
                  : 'Camera scanning is not supported in this browser. Use Chrome on Android.'}
              </div>
            )}

            {cameraError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
                ⚠️ {cameraError}
              </div>
            )}
          </form>
        </Card>
      )}

      {/* Error / success banners (manual mode) */}
      {!cameraActive && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
          ⚠️ {error}
        </div>
      )}
      {!cameraActive && success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
          {success}
        </div>
      )}

      {/* Error from camera mode */}
      {cameraActive && error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl border border-stone-200 bg-white p-3">
          <div className="text-2xl font-black text-stone-950">{recentScans.length}</div>
          <div className="text-xs text-stone-500 mt-0.5">{isAr ? 'منتجات ممسوحة' : 'Items Scanned'}</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-3">
          <div className="text-2xl font-black text-stone-950">
            {recentScans.reduce((sum, i) => sum + (i.actualQty ?? 0), 0)}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">{isAr ? 'إجمالي الوحدات' : 'Total Units'}</div>
        </div>
      </div>

      {/* Recent Scans */}
      <Card>
        <div className="border-b border-stone-200 pb-2 mb-4">
          <h3 className="text-sm font-bold text-stone-900">
            {isAr ? 'آخر عمليات المسح' : 'Recent Scans'}
          </h3>
          <p className="text-xs text-stone-500">
            {isAr ? 'العناصر التي قمت بمسحها في هذه الجلسة.' : 'Products scanned recently in this session.'}
          </p>
        </div>

        <div className="space-y-2">
          {recentScans.length > 0 ? (
            recentScans.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border border-stone-200 bg-white rounded-2xl p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-stone-900 truncate">{item.productNameSnapshot}</div>
                  {item.skuSnapshot && (
                    <div className="text-xs text-stone-400 mt-0.5">SKU: {item.skuSnapshot}</div>
                  )}
                  <div className="text-[10px] text-stone-400 font-mono mt-1">{item.scanTime}</div>
                </div>

                <div className="flex items-center gap-2 ms-3 shrink-0">
                  <button
                    type="button"
                    className="h-9 w-9 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center text-lg font-bold text-stone-700 active:scale-95 transition"
                    onClick={() => adjustQuantity(item, -1)}
                  >
                    −
                  </button>
                  <span className="inline-flex min-w-8 text-center justify-center font-black text-stone-950 text-base">
                    {item.actualQty ?? 0}
                  </span>
                  <button
                    type="button"
                    className="h-9 w-9 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-center text-lg font-bold text-emerald-700 active:scale-95 transition"
                    onClick={() => adjustQuantity(item, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-sm text-stone-500 border border-dashed border-stone-300 bg-stone-50 rounded-2xl">
              {isAr ? '📦 امسح باركود لبدء العد' : '📦 Scan a barcode to start counting'}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
