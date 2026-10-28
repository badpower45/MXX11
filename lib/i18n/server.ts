import { cookies, headers } from 'next/headers';
import { defaultLocale, fallbackLocale, isLocale, type Locale } from './locales';
import { getMessages } from './messages';
import { translate } from './translate';

export async function getServerLocale(): Promise<Locale> {
  const headerStore = await headers();
  const routeLocale = headerStore.get('x-locale');
  if (isLocale(routeLocale)) {
    return routeLocale;
  }

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;
  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const header = headerStore.get('accept-language');
  if (header) {
    const candidates = header.split(',').map((part) => part.trim().split(';')[0]);
    const match = candidates.find((value) => isLocale(value));
    if (match) return match;
  }

  return defaultLocale;
}

export function getServerTranslator(locale: Locale) {
  const messages = getMessages(locale);
  const fallbackMessages = getMessages(fallbackLocale);
  return (key: string, params?: Record<string, string | number | boolean>) =>
    translate({ messages, fallbackMessages, key, params });
}
