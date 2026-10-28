import AppHeader from '@/components/layout/AppHeader';
import RegisterOpenForm from '@/components/register/RegisterOpenForm';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { getActiveCashSession } from '@/lib/register';
import { serializeCashSession } from '@/lib/serializers/register';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function RegisterOpenPage() {
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const { shopId, userId } = await requirePageRole('CASHIER');
  const [settings, activeSession] = await Promise.all([
    prisma.shopSetting.findUnique({ where: { shopId } }),
    getActiveCashSession(prisma, shopId, userId)
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('register.open.title')}
        subtitle={t('register.open.subtitle')}
      />
      <RegisterOpenForm
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
        activeSession={activeSession ? serializeCashSession(activeSession) : null}
        openingFloatRequired={settings?.openingFloatRequired ?? true}
        openingFloatAmount={settings?.openingFloatAmount?.toString() ?? '0'}
      />
    </div>
  );
}
