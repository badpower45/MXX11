import AppHeader from '@/components/layout/AppHeader';
import StaffCreateForm from '@/components/staff/StaffCreateForm';
import { requirePagePermission } from '@/lib/authz';
import { getManagedShops } from '@/lib/staff';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function NewStaffPage() {
  const { userId, shopId } = await requirePagePermission('MANAGE_STAFF');
  const shops = await getManagedShops(userId);
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('staff.new.title')}
        subtitle={t('staff.new.subtitle')}
      />
      <StaffCreateForm shops={shops} defaultShopId={shopId} />
    </div>
  );
}
