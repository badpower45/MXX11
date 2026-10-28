import type { Locale } from '@/lib/i18n/locales';
import { getActiveLocale } from '@/lib/i18n/request-locale';

export const DEFAULT_CURRENCY_SYMBOL = 'ج.م ';

export function localizeShopName(name: string, locale?: Locale | string) {
  const activeLocale = locale || getActiveLocale();
  if (activeLocale === 'en') {
    if (name === 'عادل الكابتن - الزمالك') return 'Adel El Captain - Zamalek';
    if (name === 'عادل الكابتن - التجمع') return 'Adel El Captain - New Cairo';
    if (name === 'شركة عادل الكابتن للموتوسيكلات') return 'Adel El Captain Motorcycles Co.';
  }
  return name;
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function intlLocale(locale?: Locale | string) {
  const activeLocale = locale || getActiveLocale();
  return activeLocale === 'en' ? 'en-US' : 'ar-EG';
}

export function money(
  value: number | string | null | undefined,
  currencySymbol = DEFAULT_CURRENCY_SYMBOL,
  locale?: Locale | string
) {
  const amount = toNumber(value);
  const activeLocale = locale || getActiveLocale();
  
  let symbol = currencySymbol;
  if (activeLocale === 'en' && (symbol === 'ج.م ' || symbol.trim() === 'ج.م')) {
    symbol = 'EGP ';
  }
  
  return `${symbol}${amount.toLocaleString(intlLocale(activeLocale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function shortDate(value: string | Date, locale?: Locale | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const activeLocale = locale || getActiveLocale();
  return new Intl.DateTimeFormat(intlLocale(activeLocale), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    timeZone: 'Africa/Cairo'
  }).format(date);
}

export function dateTime(value: string | Date, locale?: Locale | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const activeLocale = locale || getActiveLocale();
  return new Intl.DateTimeFormat(intlLocale(activeLocale), {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Cairo'
  }).format(date);
}

export function compactNumber(value: number, locale?: Locale | string) {
  const activeLocale = locale || getActiveLocale();
  return new Intl.NumberFormat(intlLocale(activeLocale), {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value);
}
