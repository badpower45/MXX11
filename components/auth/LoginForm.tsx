'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

function getSafeCallbackUrl(callbackUrl: string | null) {
  if (!callbackUrl) {
    return '/dashboard';
  }

  if (callbackUrl.startsWith('/')) {
    return callbackUrl;
  }

  try {
    const url = new URL(callbackUrl);
    return `${url.pathname}${url.search}${url.hash}` || '/dashboard';
  } catch {
    return '/dashboard';
  }
}

export default function LoginForm({
  inactiveAccess,
  callbackUrl
}: {
  inactiveAccess: boolean;
  callbackUrl: string | null;
}) {
  const showDevAutofill = process.env.NODE_ENV !== 'production';
  const devAdminBypassEnabled =
    process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEV_ADMIN_BYPASS === 'true';
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const t = useTranslations('auth.login');
  const tCommon = useTranslations('common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const destination = localizedPath(getSafeCallbackUrl(callbackUrl));
  const devAdminEmail = 'dev-admin@local';
  const devAdminPassword = 'dev-admin';

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: destination
    });
    setLoading(false);

    if (result?.error) {
      setError(t('invalidCredentials'));
      return;
    }

    router.push(destination);
    router.refresh();
  }

  async function onDevAdminLogin() {
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email: devAdminEmail,
      password: devAdminPassword,
      redirect: false,
      callbackUrl: destination
    });
    setLoading(false);

    if (result?.error) {
      setError(t('invalidCredentials'));
      return;
    }

    router.push(destination);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 md:grid-cols-2">
        <div className="hidden rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 p-10 text-white shadow-xl md:block">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black">V</div>
            <h1 className="text-4xl font-black leading-tight">{t('heroTitle')}</h1>
            <p className="mt-4 text-base leading-7 text-blue-50">{t('heroText')}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-lg md:p-10">
          <div className="mb-4 flex justify-end">
            <LanguageSwitcher />
          </div>
          <h2 className="text-3xl font-black text-stone-900">{t('title')}</h2>
          <p className="mt-2 text-sm text-stone-500">{t('subtitle')}</p>
          {inactiveAccess ? (
            <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              {t('inactiveAccess')}
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-800">{tCommon('email')}</label>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-stone-800">{tCommon('password')}</label>
                <button
                  type="button"
                  onClick={() => router.push(localizedPath('/forgot-password'))}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  {t('forgotPassword')}
                </button>
              </div>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {showDevAutofill || devAdminBypassEnabled ? (
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                <div className="font-semibold">{t('devHelperTitle')}</div>
                <div className="mt-1 text-sky-800">{t('devHelperNote')}</div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {showDevAutofill ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('owner@azraqpos.local');
                        setPassword('password123');
                      }}
                      className="font-semibold text-sky-700 hover:text-sky-900"
                    >
                      {t('devHelperAction')}
                    </button>
                  ) : null}
                  {devAdminBypassEnabled ? (
                    <button
                      type="button"
                      onClick={onDevAdminLogin}
                      className="font-semibold text-sky-700 hover:text-sky-900"
                    >
                      {t('devAdminAction')}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? t('submitting') : t('submit')}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-stone-600">{t('createAccountPrompt')} <button type="button" onClick={() => router.push(localizedPath('/signup'))} className="font-semibold text-blue-600 hover:text-blue-700">{t('createAccountCta')}</button></p>
        </div>
      </div>
    </main>
  );
}
