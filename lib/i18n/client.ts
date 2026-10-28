'use client';

import { useContext } from 'react';
import { LocaleContext } from '@/components/providers/LocaleProvider';
import { translate } from './translate';
import { localizePath } from './locales';

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}

export function useTranslations(namespace?: string) {
  const { messages, fallbackMessages } = useLocale();
  return (key: string, params?: Record<string, string | number | boolean>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return translate({ messages, fallbackMessages, key: fullKey, params });
  };
}

export function useLocalizedPath() {
  const { locale } = useLocale();
  return (path: string) => localizePath(path, locale);
}
