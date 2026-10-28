'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

export default function ForgotPasswordForm() {
  const localizedPath = useLocalizedPath();
  const t = useTranslations('auth.forgot');
  const tCommon = useTranslations('common');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json().catch(() => ({ error: t('errorFallback') }));
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? t('errorFallback'));
      return;
    }

    setSuccess(
      data?.message ??
        t('successFallback')
    );
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
        <div className="w-full rounded-3xl border border-stone-200 bg-white p-8 shadow-lg md:p-10">
          <div className="flex justify-end">
            <LanguageSwitcher />
          </div>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-black text-white">
            V
          </div>
          <h1 className="mt-6 text-3xl font-black text-stone-950">{t('title')}</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">{t('subtitle')}</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-800">{tCommon('email')}</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            {success ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {success}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('submitting') : t('submit')}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-stone-600">
            <Link href={localizedPath('/login')} className="font-semibold text-blue-600 hover:text-blue-700">
              {t('backToSignIn')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
