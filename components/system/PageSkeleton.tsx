import Card from '@/components/ui/Card';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

type Props = {
  title?: string;
  subtitle?: string;
  rows?: number;
};

export default async function PageSkeleton({
  title,
  subtitle,
  rows = 4
}: Props) {
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  const resolvedTitle = title ?? t('skeleton.loadingWorkspace');
  const resolvedSubtitle = subtitle ?? t('skeleton.preparingData');
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="animate-pulse">
        <div className="h-3 w-28 rounded-full bg-blue-100" />
        <div className="mt-4 h-10 w-72 rounded-2xl bg-stone-200" />
        <div className="mt-3 h-5 w-[34rem] max-w-full rounded-xl bg-stone-200" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="space-y-4">
              <div className="h-4 w-28 rounded-xl bg-stone-200" />
              <div className="h-9 w-24 rounded-2xl bg-stone-200" />
              <div className="h-4 w-full rounded-xl bg-stone-100" />
            </Card>
          ))}
        </div>
        <Card className="mt-6">
          <div className="h-6 w-56 rounded-xl bg-stone-200" />
          <div className="mt-3 h-4 w-80 max-w-full rounded-xl bg-stone-100" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: rows }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-stone-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded-xl bg-stone-200" />
                  <div className="h-4 w-2/3 rounded-xl bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <p className="mt-5 text-sm text-stone-500">{resolvedTitle} · {resolvedSubtitle}</p>
      </div>
    </main>
  );
}
