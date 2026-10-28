import { cache } from 'react';
import type { Locale } from './locales';
import { defaultLocale } from './locales';

const getRequestLocaleContainer = cache(() => ({
  locale: defaultLocale
}));

export function setRequestLocale(locale: Locale) {
  getRequestLocaleContainer().locale = locale;
}

export function getActiveLocale(): Locale {
  if (typeof window !== 'undefined') {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && (parts[0] === 'en' || parts[0] === 'ar')) {
      return parts[0] as Locale;
    }
    return defaultLocale;
  }
  return getRequestLocaleContainer().locale;
}
