'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import { useLocalizedPath, useTranslations } from '@/lib/i18n/client';

type SignupFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function SignupPage() {
  const router = useRouter();
  const localizedPath = useLocalizedPath();
  const t = useTranslations('auth.signup');
  const tCommon = useTranslations('common');
  const [form, setForm] = useState<SignupFormState>({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [verificationExpiresAt, setVerificationExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setResendMessage('');
    setLoading(true);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = await response.json().catch(() => ({ error: t('errorFallback') }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Unable to create account.');
      return;
    }

    setPendingEmail(form.email.trim().toLowerCase());
    setVerificationExpiresAt(data.expiresAt ?? '');
    setSuccess(data.message ?? t('successFallback'));
    setForm({ name: '', email: '', password: '', confirmPassword: '' });
  }

  async function resendVerificationEmail() {
    if (!pendingEmail) {
      setError(t('pendingEmailMissing'));
      return;
    }

    setError('');
    setResendMessage('');
    setResendLoading(true);

    const response = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail })
    });

    const data = await response.json().catch(() => ({ error: t('errorFallback') }));
    setResendLoading(false);

    if (!response.ok) {
      setError(data.error ?? t('errorFallback'));
      return;
    }

    setVerificationExpiresAt(data.expiresAt ?? '');
    setResendMessage(data.message ?? t('resendMessageFallback'));
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
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div><label className="mb-2 block text-sm font-semibold text-stone-800">{tCommon('name')}</label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></div>
            <div><label className="mb-2 block text-sm font-semibold text-stone-800">{tCommon('email')}</label><Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required /></div>
            <div><label className="mb-2 block text-sm font-semibold text-stone-800">{tCommon('password')}</label><Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required /></div>
            <div><label className="mb-2 block text-sm font-semibold text-stone-800">{tCommon('confirmPassword')}</label><Input type="password" value={form.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))} required /></div>
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{success}</div> : null}
            {pendingEmail ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                <div className="font-semibold text-stone-900">{t('pendingTitle')}</div>
                <div className="mt-2">{t('pendingMessage', { email: pendingEmail })}</div>
                {verificationExpiresAt ? (
                  <div className="mt-2 text-xs text-stone-500">{t('pendingExpires', { timestamp: new Date(verificationExpiresAt).toLocaleString() })}</div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button type="button" variant="secondary" onClick={resendVerificationEmail} disabled={resendLoading}>
                    {resendLoading ? t('resending') : t('resend')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => router.push(localizedPath('/login'))}>
                    {t('goToSignIn')}
                  </Button>
                </div>
                {resendMessage ? <div className="mt-3 text-sm text-blue-700">{resendMessage}</div> : null}
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? t('submitting') : t('submit')}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-stone-600">{t('alreadyVerified')} <button type="button" onClick={() => router.push(localizedPath('/login'))} className="font-semibold text-blue-600 hover:text-blue-700">{t('goToSignIn')}</button></p>
        </div>
      </div>
    </main>
  );
}
