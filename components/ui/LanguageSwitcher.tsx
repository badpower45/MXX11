'use client';

import { locales, type Locale } from '@/lib/i18n/locales';
import { useLocale } from '@/lib/i18n/client';

const labels: Record<Locale, string> = {
  ar: 'عربي',
  en: 'English'
};

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="inline-flex items-center rounded-full border border-white/80 bg-white/88 p-1 text-xs font-semibold text-stone-600 shadow-[0_18px_36px_-28px_rgba(28,25,23,0.35)] backdrop-blur">
      {locales.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          className={`rounded-full px-3 py-1.5 transition ${
            locale === option
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}
