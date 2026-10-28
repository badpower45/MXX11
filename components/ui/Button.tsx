import React from 'react';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

export default function Button({ className = '', variant = 'primary', ...props }: Props) {
  const map = {
    primary:
      'border border-blue-700/90 bg-[linear-gradient(180deg,#2563eb,#1d4ed8)] text-white shadow-[0_18px_30px_-20px_rgba(37,99,235,0.9)] hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(37,99,235,0.85)]',
    secondary:
      'border border-stone-200 bg-white text-stone-800 shadow-[0_12px_24px_-18px_rgba(28,25,23,0.18)] hover:-translate-y-0.5 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-950',
    danger:
      'border border-red-700/90 bg-[linear-gradient(180deg,#dc2626,#b91c1c)] text-white shadow-[0_18px_30px_-20px_rgba(220,38,38,0.7)] hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(220,38,38,0.72)]',
    ghost:
      'border border-stone-200/80 bg-stone-50 text-stone-700 hover:-translate-y-0.5 hover:border-stone-300 hover:bg-stone-100 hover:text-stone-900'
  } as const;

  return (
    <button
      {...props}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 ${map[variant]} ${className}`}
    />
  );
}
