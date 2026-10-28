'use client';

import React, { createContext, useCallback, useMemo } from 'react';
import type { Locale } from '@/lib/i18n/locales';
import { getDirection, localizePath, stripLocalePrefix } from '@/lib/i18n/locales';
import type { Messages } from '@/lib/i18n/messages';

type LocaleContextValue = {
  locale: Locale;
  messages: Messages;
  fallbackMessages: Messages;
  setLocale: (locale: Locale) => void;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useTranslations() {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) throw new Error('useTranslations must be used within LocaleProvider');
  const { messages, fallbackMessages } = ctx;
  return (key: string, params?: Record<string, string | number | boolean>) => {
    const translate = (obj: any, path: string) =>
      path.split('.').reduce((acc: any, part: string) => (acc && typeof acc === 'object' ? acc[part] : undefined), obj);
    const raw = translate(messages, key) ?? translate(fallbackMessages, key) ?? key;
    if (!params) return String(raw);
    return Object.entries(params).reduce((res, [k, v]) => res.replaceAll(`{${k}}`, String(v)), String(raw));
  };
}

type Props = {
  children: React.ReactNode;
  initialLocale: Locale;
  messages: Messages;
  fallbackMessages: Messages;
};

export default function LocaleProvider({ children, initialLocale, messages, fallbackMessages }: Props) {
  const setLocale = useCallback(
    (nextLocale: Locale) => {
      if (nextLocale === initialLocale) return;
      document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = nextLocale;
      document.documentElement.dir = getDirection(nextLocale);
      const nextPath = localizePath(stripLocalePrefix(window.location.pathname) + window.location.search + window.location.hash, nextLocale);
      window.location.assign(nextPath);
    },
    [initialLocale]
  );

  const value = useMemo(
    () => ({
      locale: initialLocale,
      messages,
      fallbackMessages,
      setLocale
    }),
    [fallbackMessages, initialLocale, messages, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
