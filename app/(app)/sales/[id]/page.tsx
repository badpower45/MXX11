import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { getAdjustmentTypeLabel, getSaleStatusLabel } from '@/lib/business-labels';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { getCustomerDisplayName } from '@/lib/customers';
import { dateTime, money } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getSaleRefundState, saleDetailInclude } from '@/lib/sale-adjustments';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function SaleDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { shopId, shop, permissions } = await getActiveShopContext();
  const { id } = await params;
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const [sale, settings] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, shopId },
      include: saleDetailInclude
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
    })
  ]);

  if (!sale) {
    return notFound();
  }

  const currencySymbol = settings?.currencySymbol ?? 'ج.م ';
  const refundState = getSaleRefundState(sale);
  const canRefundSales = permissions.REFUND_SALES;
  const canVoidSales = permissions.VOID_SALES;

  return (
    <div className="space-y-6">
      <AppHeader title={sale.saleNumber} subtitle={`${t('saleDetail.receiptNumber')} ${sale.receiptNumber} | ${dateTime(sale.createdAt)}`} />

      <div className="flex flex-wrap gap-3">
        <Link href={`/sales/${sale.id}/refund`}>
          <Button type="button" disabled={!canRefundSales || !refundState.canRefund}>{t('saleDetail.refundExchange')}</Button>
        </Link>
        <Link href={`/sales/${sale.id}/void`}>
          <Button type="button" variant="secondary" disabled={!canVoidSales || !refundState.canVoid}>{t('saleDetail.voidSale')}</Button>
        </Link>
        <Link href={`/print/receipt/${sale.id}`}>
          <Button type="button" variant="secondary">{t('saleDetail.openReceipt')}</Button>
        </Link>
        <Link href={`/print/receipt/${sale.id}?autoprint=1`}>
          <Button type="button" variant="secondary">{t('saleDetail.reprintReceipt')}</Button>
        </Link>
        <Link href="/returns">
          <Button type="button" variant="ghost">{t('saleDetail.returnsHistory')}</Button>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('saleDetail.receiptPreview')}</h2>

          <div className="mt-5 space-y-3 text-sm">
            <div>
              <div className="font-black text-stone-900">{settings?.receiptHeader || shop.name}</div>
              <div className="text-stone-500">{shop.address ?? t('saleDetail.noAddress')}</div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div>{t('saleDetail.receiptNumber')} <span className="font-semibold">{sale.receiptNumber}</span></div>
              <div>{t('saleDetail.cashier')} <span className="font-semibold">{sale.cashierName ?? t('salesLog.cashierFallback')}</span></div>
              <div>{t('saleDetail.paymentMethod')} <span className="font-semibold">{sale.paymentMethod}</span></div>
              <div>{t('saleDetail.date')} <span className="font-semibold">{dateTime(sale.createdAt)}</span></div>
            </div>

            <div className="space-y-2 rounded-2xl border border-stone-200 p-4">
              {sale.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.productName} x {item.qty}</span>
                  <span>{money(item.lineTotal.toString(), currencySymbol)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <div className="flex justify-between"><span>{t('saleDetail.subtotal')}</span><span>{money(sale.subtotal.toString(), currencySymbol)}</span></div>
              <div className="flex justify-between"><span>{t('saleDetail.tax')}</span><span>{money(sale.taxAmount.toString(), currencySymbol)}</span></div>
              <div className="flex justify-between"><span>{t('saleDetail.discount')}</span><span>-{money(sale.discountAmount.toString(), currencySymbol)}</span></div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-black"><span>{t('saleDetail.total')}</span><span>{money(sale.totalAmount.toString(), currencySymbol)}</span></div>
            </div>

            <div className="text-xs text-stone-500">{settings?.receiptFooter ?? t('saleDetail.receiptFooterFallback')}</div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">{t('saleDetail.saleMetadata')}</h2>
          <div className="mt-5 space-y-3 text-sm text-stone-600">
            <div>{t('saleDetail.customer')} <span className="font-semibold text-stone-900">{sale.customer ? getCustomerDisplayName(sale.customer) : sale.customerName ?? t('saleDetail.walkInCustomer')}</span></div>
            <div>{t('saleDetail.phone')} <span className="font-semibold text-stone-900">{sale.customerPhone ?? 'N/A'}</span></div>
            {sale.customer?.email ? <div>{t('saleDetail.email')} <span className="font-semibold text-stone-900">{sale.customer.email}</span></div> : null}
            <div>{t('saleDetail.customerType')} <span className="font-semibold text-stone-900">{sale.customer?.type ?? 'WALK_IN'}</span></div>
            <div>{t('saleDetail.notes')} <span className="font-semibold text-stone-900">{sale.notes ?? 'N/A'}</span></div>
            <div>{t('saleDetail.status')} <span className="font-semibold text-stone-900">{getSaleStatusLabel(sale.status)}</span></div>
            <div>{t('saleDetail.creditSale')} <span className="font-semibold text-stone-900">{sale.isCreditSale ? t('saleDetail.yes') : t('saleDetail.no')}</span></div>
            {sale.loyaltyPointsEarned > 0 || sale.loyaltyPointsRedeemed > 0 ? (
              <div>
                {t('saleDetail.loyalty')} <span className="font-semibold text-stone-900">{t('saleDetail.loyaltyPoints', { earned: sale.loyaltyPointsEarned, redeemed: sale.loyaltyPointsRedeemed })}</span>
              </div>
            ) : null}
            {sale.customerCreditLedger ? (
              <>
                <div>{t('saleDetail.dueDate')} <span className="font-semibold text-stone-900">{dateTime(sale.customerCreditLedger.dueDate)}</span></div>
                <div>{t('saleDetail.receivableBalance')} <span className="font-semibold text-stone-900">{money(sale.customerCreditLedger.balance.toString(), currencySymbol)}</span></div>
              </>
            ) : null}
            <div>{t('saleDetail.remainingRefundable')} <span className="font-semibold text-stone-900">{money(refundState.refundableAmount, currencySymbol)}</span></div>
            {sale.voidReason ? <div>{t('saleDetail.voidReason')} <span className="font-semibold text-stone-900">{sale.voidReason}</span></div> : null}
          </div>

          <div className="mt-6 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            <div>
              {refundState.canVoid
                ? canVoidSales
                  ? t('saleDetail.eligibleForVoid')
                  : t('saleDetail.voidNoPermission')
                : sale.isCreditSale
                  ? t('saleDetail.creditSalesLocked')
                  : t('saleDetail.voidNotAvailable')}
            </div>
            <div className="mt-2">
              {refundState.canRefund
                ? canRefundSales
                  ? t('saleDetail.refundAvailable')
                  : t('saleDetail.refundNoPermission')
                : sale.isCreditSale
                  ? t('saleDetail.creditRefundDisabled')
                  : t('saleDetail.noRefundableQty')}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">{t('saleDetail.adjustmentHistory')}</div>
            <h2 className="mt-2 text-xl font-black text-stone-900">{t('returns.sectionTitle')}</h2>
            <p className="mt-1 text-sm text-stone-500">{t('returns.sectionDesc')}</p>
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            {t('saleDetail.adjustmentsCount', { count: sale.adjustments.length })}
          </div>
        </div>

        <div className="space-y-4">
          {sale.adjustments.map((adjustment) => (
            <div key={adjustment.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={adjustment.type === 'VOID' ? 'red' : adjustment.type === 'EXCHANGE' ? 'blue' : 'amber'}>
                      {getAdjustmentTypeLabel(adjustment.type)}
                    </Badge>
                    <span className="text-sm font-semibold text-stone-900">{adjustment.adjustmentNumber}</span>
                  </div>
                  <div className="mt-3 text-sm text-stone-700">{adjustment.reason}</div>
                  <div className="mt-2 text-xs text-stone-500">
                    {t('saleDetail.createdWhenBy', { date: dateTime(adjustment.createdAt), user: adjustment.createdByUser.name ?? adjustment.createdByUser.email })}
                  </div>
                  <div className="mt-1 text-xs text-stone-500">
                    {t('saleDetail.approvedByUser', { user: adjustment.approvedByUser.name ?? adjustment.approvedByUser.email })}
                  </div>
                  {adjustment.notes ? <div className="mt-3 rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">{adjustment.notes}</div> : null}
                </div>
                <div className="min-w-[240px] space-y-2">
                  <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    {t('saleDetail.creditRefunded', { subtotal: money(adjustment.subtotal.toString(), currencySymbol), total: money(adjustment.totalAmount.toString(), currencySymbol) })}
                  </div>
                  {adjustment.exchangeSale ? (
                    <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                      {t('saleDetail.exchangeSaleLabel', { saleNumber: adjustment.exchangeSale.saleNumber, total: money(adjustment.exchangeSale.totalAmount.toString(), currencySymbol) })}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <Link href={`/print/refund/${adjustment.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">
                      {t('saleDetail.adjustmentReceipt')}
                    </Link>
                    {adjustment.exchangeSale ? (
                      <Link href={`/sales/${adjustment.exchangeSale.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                        {t('saleDetail.exchangeSaleLink')}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {adjustment.items.map((item) => (
                  <div key={item.id} className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="mt-1">{item.itemType} / {item.disposition} / {t('saleDetail.qty', { qty: item.qty })}</div>
                    <div className="mt-1">{money(item.lineTotal.toString(), currencySymbol)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!sale.adjustments.length ? (
            <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
              {t('saleDetail.noAdjustments')}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
