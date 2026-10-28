import PageSkeleton from '@/components/system/PageSkeleton';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function RootLoading() {
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  return <PageSkeleton title={t('skeleton.loadingApp')} subtitle={t('skeleton.startingApp')} rows={5} />;
}
