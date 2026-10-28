'use client';

import Badge from '@/components/ui/Badge';
import { dateTime } from '@/lib/format';
import { useTranslations } from '@/lib/i18n/client';

type Movement = {
  id: string;
  type: string;
  qtyChange: number;
  referenceId?: string | null;
  notes?: string | null;
  reasonLabel?: string | null;
  reasonCode?: string | null;
  createdAt: string;
  product: {
    name: string;
  };
};

function toneForType(type: string) {
  const normalized = type.toUpperCase();

  if (normalized.includes('SALE')) {
    return 'red';
  }

  if (normalized.includes('PURCHASE') || normalized.includes('OPENING')) {
    return 'emerald';
  }

  if (normalized.includes('COUNT')) {
    return 'blue';
  }

  return 'stone';
}

export default function InventoryMovementTable({
  movements
}: {
  movements: Movement[];
  lowStockThreshold: number;
}) {
  const t = useTranslations('inventory');

  if (!movements.length) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
        {t('noMovements')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-start text-sm">
        <thead className="text-stone-500">
          <tr>
            <th className="px-3 py-3">{t('dateHeader')}</th>
            <th className="px-3 py-3">{t('productHeader')}</th>
            <th className="px-3 py-3">{t('typeHeader')}</th>
            <th className="px-3 py-3">{t('reasonHeader')}</th>
            <th className="px-3 py-3">{t('qtyChangeHeader')}</th>
            <th className="px-3 py-3">{t('referenceHeader')}</th>
            <th className="px-3 py-3">{t('notesHeader')}</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <tr key={movement.id} className="border-t border-stone-200">
              <td className="px-3 py-3 text-stone-600">{dateTime(movement.createdAt)}</td>
              <td className="px-3 py-3 font-medium text-stone-900">{movement.product.name}</td>
              <td className="px-3 py-3">
                <Badge tone={toneForType(movement.type)}>
                  {movement.type === 'PURCHASE_RECEIVED'
                    ? t('purchaseReceived')
                    : movement.type === 'SUPPLIER_RETURN_POSTED'
                      ? t('supplierReturn')
                      : movement.type === 'SALE_COMPLETED'
                        ? t('saleCompleted')
                        : movement.type === 'SALE_VOIDED'
                          ? t('saleVoided')
                          : movement.type === 'RETURN_RESTOCKED'
                            ? t('returnRestocked')
                            : movement.type === 'EXCHANGE_ISSUED'
                              ? t('exchangeIssued')
                              : movement.type === 'STOCK_COUNT_POSTED'
                                ? t('countVariance')
                                : movement.type === 'MANUAL_ADJUSTMENT'
                                  ? t('manualAdjustment')
                                  : movement.type === 'OPENING_STOCK'
                                    ? t('openingStock')
                                    : movement.type === 'TRANSFER_OUT'
                                      ? t('transferOut')
                                      : movement.type === 'TRANSFER_IN'
                                        ? t('transferIn')
                                        : movement.type}
                </Badge>
              </td>
              <td className="px-3 py-3 text-stone-600">
                {movement.reasonLabel ? (
                  <div>
                    <div className="font-medium text-stone-900">{movement.reasonLabel}</div>
                    <div className="text-xs uppercase tracking-[0.12em] text-stone-400">
                      {movement.reasonCode?.replaceAll('_', ' ') ?? t('reasonHeader')}
                    </div>
                  </div>
                ) : t('notAvailable')}
              </td>
              <td className={`px-3 py-3 font-semibold ${movement.qtyChange >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {movement.qtyChange > 0 ? `+${movement.qtyChange}` : movement.qtyChange}
              </td>
              <td className="px-3 py-3 text-stone-600">{movement.referenceId ?? t('notAvailable')}</td>
              <td className="px-3 py-3 text-stone-600">{movement.notes ?? t('notAvailable')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
