'use client';

import Input from '@/components/ui/Input';
import { useTranslations } from '@/components/providers/LocaleProvider';

type Option = {
  value: string;
  label: string;
};

type ReportFiltersProps = {
  action: string;
  fromValue: string;
  toValue: string;
  cashierId?: string;
  categoryId?: string;
  paymentMethod?: string;
  productId?: string;
  cashiers?: Option[];
  categories?: Option[];
  paymentMethods?: Option[];
  products?: Option[];
};

function SelectField({
  name,
  value,
  label,
  options,
  allLabel
}: {
  name: string;
  value: string;
  label: string;
  options: Option[];
  allLabel: string;
}) {
  return (
    <label className="space-y-1 text-sm">
      <div className="font-medium text-stone-600">{label}</div>
      <select
        name={name}
        defaultValue={value}
        className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none transition hover:border-stone-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function ReportFilters({
  action,
  fromValue,
  toValue,
  cashierId = '',
  categoryId = '',
  paymentMethod = '',
  productId = '',
  cashiers = [],
  categories = [],
  paymentMethods = [],
  products = []
}: ReportFiltersProps) {
  const t = useTranslations();

  return (
    <form action={action} method="GET" className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="space-y-1 text-sm">
        <div className="font-medium text-stone-600">{t('reports.filters.from')}</div>
        <Input type="date" name="from" defaultValue={fromValue} />
      </label>
      <label className="space-y-1 text-sm">
        <div className="font-medium text-stone-600">{t('reports.filters.to')}</div>
        <Input type="date" name="to" defaultValue={toValue} />
      </label>

      {cashiers.length ? (
        <SelectField
          name="cashierId"
          value={cashierId}
          label={t('reports.filters.cashier')}
          options={cashiers}
          allLabel={t('reports.filters.all')}
        />
      ) : null}

      {categories.length ? (
        <SelectField
          name="categoryId"
          value={categoryId}
          label={t('reports.filters.category')}
          options={categories}
          allLabel={t('reports.filters.all')}
        />
      ) : null}

      {paymentMethods.length ? (
        <SelectField
          name="paymentMethod"
          value={paymentMethod}
          label={t('reports.filters.payment')}
          options={paymentMethods}
          allLabel={t('reports.filters.all')}
        />
      ) : null}

      {products.length ? (
        <SelectField
          name="productId"
          value={productId}
          label={t('reports.filters.product')}
          options={products}
          allLabel={t('reports.filters.all')}
        />
      ) : null}

      <div className="flex items-end">
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-stone-900 px-4 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          {t('reports.filters.applyFilters')}
        </button>
      </div>
    </form>
  );
}
