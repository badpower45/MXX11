'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useTranslations } from '@/lib/i18n/client';
import { useLocalizedPath } from '@/lib/i18n/client';

type Props = {
  title?: string;
  message?: string;
  resetLabel?: string;
  onReset?: (() => void) | null;
  homeHref?: string;
  homeLabel?: string;
};

export default function ErrorState({
  title,
  message,
  resetLabel,
  onReset,
  homeHref = '/dashboard',
  homeLabel
}: Props) {
  const t = useTranslations('errors');
  const localizedPath = useLocalizedPath();
  const resolvedTitle = title ?? t('title');
  const resolvedMessage = message ?? t('message');
  const resolvedResetLabel = resetLabel ?? t('tryAgain');
  const resolvedHomeLabel = homeLabel ?? t('backToDashboard');
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <Card className="w-full max-w-2xl border border-red-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(254,242,242,0.94))]">
        <div className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-red-700">
          {t('tag')}
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-stone-900">{resolvedTitle}</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">{resolvedMessage}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {onReset ? <Button onClick={onReset}>{resolvedResetLabel}</Button> : null}
          <Link href={localizedPath(homeHref)}>
            <Button variant="secondary">{resolvedHomeLabel}</Button>
          </Link>
          <Link href={localizedPath('/login')}>
            <Button variant="ghost">{t('backToSignIn')}</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
