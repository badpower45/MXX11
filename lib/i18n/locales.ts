export const locales = ['ar', 'en'] as const;
export type Locale = typeof locales[number];

export const defaultLocale: Locale = 'ar';
export const fallbackLocale: Locale = 'en';

export function isLocale(value: string | undefined | null): value is Locale {
  return locales.includes(value as Locale);
}

export function getDirection(locale: Locale) {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  return isLocale(segment) ? segment : null;
}

export function stripLocalePrefix(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0 || !isLocale(parts[0])) {
    return pathname || '/';
  }

  const stripped = `/${parts.slice(1).join('/')}`;
  return stripped === '/' ? '/' : stripped.replace(/\/$/, '');
}

export function localizePath(path: string, locale: Locale = defaultLocale) {
  if (!path) return `/${locale}`;

  if (/^(https?:|mailto:|tel:|#)/.test(path)) {
    return path;
  }

  const [pathWithoutHash, hash = ''] = path.split('#');
  const [pathnamePart, query = ''] = pathWithoutHash.split('?');
  const pathname = pathnamePart.startsWith('/') ? pathnamePart : `/${pathnamePart}`;

  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return path;
  }

  const stripped = stripLocalePrefix(pathname);
  const localized = stripped === '/' ? `/${locale}` : `/${locale}${stripped}`;
  return `${localized}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}
