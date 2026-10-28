import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { localizePath } from '@/lib/i18n/locales';

export default async function NotFound() {
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-2xl text-center">
        <div className="mx-auto inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
          {t('notFound.tag')}
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-stone-900">{t('notFound.title')}</h1>
        <p className="mt-4 text-sm leading-7 text-stone-600">{t('notFound.message')}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href={localizePath('/dashboard', locale)}>
            <Button>{t('notFound.goToDashboard')}</Button>
          </Link>
          <Link href={localizePath('/login', locale)}>
            <Button variant="secondary">{t('notFound.signIn')}</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
