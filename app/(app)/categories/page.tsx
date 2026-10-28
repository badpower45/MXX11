import AppHeader from '@/components/layout/AppHeader';
import CategoryManager from '@/components/categories/CategoryManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { getServerLocale, getServerTranslator } from '@/lib/i18n/server';

export default async function CategoriesPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const locale = await getServerLocale();
  const t = getServerTranslator(locale);

  const categories = await prisma.category.findMany({
    where: { shopId },
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true, children: true } } }
  });

  return (
    <div className="space-y-6">
      <AppHeader
        title={t('categories.title')}
        subtitle={t('categories.subtitle')}
      />
      <CategoryManager initialCategories={categories} />
    </div>
  );
}
