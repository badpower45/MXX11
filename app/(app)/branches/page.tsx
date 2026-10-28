import AppHeader from '@/components/layout/AppHeader';
import { requirePageRole } from '@/lib/authz';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';
import { prisma } from '@/lib/prisma';
import BranchesClient from '@/components/branches/BranchesClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';

export default async function BranchesPage() {
  const { userId } = await requirePageRole('CASHIER');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);
  const { role } = await getActiveShopContext();

  // Fetch all active branch memberships of this user
  const memberships = await prisma.userShop.findMany({
    where: {
      userId,
      isActive: true
    },
    include: {
      shop: true
    },
    orderBy: { assignedAt: 'asc' }
  });

  const branches = memberships.map((m) => ({
    id: m.shop.id,
    name: m.shop.name,
    slug: m.shop.slug,
    posType: m.shop.posType,
    phone: m.shop.phone,
    email: m.shop.email,
    address: m.shop.address,
    role: m.role
  }));

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('branches.title')}
        subtitle={t('branches.subtitle')}
      />

      <BranchesClient initialBranches={branches} locale={locale} role={role} />
    </div>
  );
}
