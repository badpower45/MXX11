import './globals.css';
import type { Metadata } from 'next';
import { Cairo, Geist, Geist_Mono } from 'next/font/google';
import AuthSessionProvider from '@/components/providers/AuthSessionProvider';
import LocaleProvider from '@/components/providers/LocaleProvider';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { fallbackLocale, getDirection } from '@/lib/i18n/locales';
import { getMessages } from '@/lib/i18n/messages';
import { setRequestLocale } from '@/lib/i18n/request-locale';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const cairo = Cairo({ variable: '--font-cairo', subsets: ['arabic'] });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  setRequestLocale(locale);
  const t = getServerTranslator(locale);
  const title = t('app.title');

  return {
    title: { default: title, template: `%s | ${title}` },
    description: t('app.description')
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();
  setRequestLocale(locale);
  const dir = getDirection(locale);
  const messages = getMessages(locale);
  const fallbackMessages = getMessages(fallbackLocale);

  return (
    <html lang={locale} dir={dir}>
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} antialiased`}>
        <LocaleProvider initialLocale={locale} messages={messages} fallbackMessages={fallbackMessages}>
          <AuthSessionProvider>{children}</AuthSessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
