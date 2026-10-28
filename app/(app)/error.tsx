'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/system/ErrorState';
import { useTranslations } from '@/lib/i18n/client';

export default function AppSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title={t('appTitle')}
      message={t('appMessage')}
      onReset={reset}
      homeHref="/dashboard"
      homeLabel={t('backToDashboard')}
    />
  );
}
