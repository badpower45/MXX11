'use client';

export default function CustomerStatementPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center justify-center rounded-2xl border border-blue-700/90 bg-[linear-gradient(180deg,#2563eb,#1d4ed8)] px-4 text-sm font-semibold text-white shadow-[0_18px_30px_-20px_rgba(37,99,235,0.9)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(37,99,235,0.85)]"
    >
      Print statement
    </button>
  );
}
