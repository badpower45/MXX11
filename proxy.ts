import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { defaultLocale, getLocaleFromPathname, stripLocalePrefix } from '@/lib/i18n/locales';

const PUBLIC_FILE = /\.[^/]+$/;

type LocaleRequest = {
  cookies: {
    get(name: string): { value?: string } | undefined;
  };
};

function getPreferredLocale(request: LocaleRequest) {
  const cookieLocale = request.cookies.get('locale')?.value;
  return getLocaleFromPathname(`/${cookieLocale ?? ''}`) ?? defaultLocale;
}

function shouldBypass(pathname: string) {
  return (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    PUBLIC_FILE.test(pathname)
  );
}

export const proxy = auth((request) => {
  const { nextUrl } = request;
  const { pathname } = nextUrl;

  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  const locale = getLocaleFromPathname(pathname);

  if (!locale) {
    const redirectUrl = nextUrl.clone();
    const preferredLocale = getPreferredLocale(request);
    redirectUrl.pathname = pathname === '/' ? `/${defaultLocale}` : `/${preferredLocale}${pathname}`;
    return NextResponse.redirect(redirectUrl);
  }

  const rewrittenPathname = stripLocalePrefix(pathname);
  if (rewrittenPathname === pathname) {
    return NextResponse.next();
  }

  const rewriteUrl = nextUrl.clone();
  rewriteUrl.pathname = rewrittenPathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', locale);
  const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  response.cookies.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  return response;
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)']
};
