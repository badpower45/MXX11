import PageSkeleton from '@/components/system/PageSkeleton';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function AuthSegmentLoading() {
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  return <PageSkeleton title={t('skeleton.loadingAccessFlow')} subtitle={t('skeleton.preparingAccess')} rows={3} />;
}
