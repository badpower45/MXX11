import AppHeader from '@/components/layout/AppHeader';
import CustomerDirectoryManager from '@/components/customers/CustomerDirectoryManager';
import type { CustomerRecord } from '@/components/customers/CustomerDirectoryManager';
import { requirePageRole } from '@/lib/authz';
import { customerDetailInclude } from '@/lib/customer-operations';
import { serializeCustomer } from '@/lib/customers';
import { prisma } from '@/lib/prisma';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function CustomersPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const [customers, settings] = await Promise.all([
    prisma.customer.findMany({
      where: { shopId },
      include: customerDetailInclude,
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }]
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('customers.title')}
        subtitle={t('customers.subtitle')}
      />
      <CustomerDirectoryManager
        customers={customers.map((customer) => serializeCustomer(customer)) as unknown as CustomerRecord[]}
        currencySymbol={settings?.currencySymbol ?? 'ج.م '}
      />
    </div>
  );
}
