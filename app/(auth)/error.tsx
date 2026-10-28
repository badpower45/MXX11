'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/system/ErrorState';
import { useTranslations } from '@/lib/i18n/client';

export default function AuthSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title={t('authTitle')}
      message={t('authMessage')}
      onReset={reset}
      homeHref="/login"
      homeLabel={t('backToSignIn')}
    />
  );
}
