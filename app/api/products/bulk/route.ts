import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { apiErrorResponse } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const { shopId } = await requireRole('MANAGER');
    const { products } = await request.json();

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products provided.' }, { status: 400 });
    }

    const createdCount = await prisma.$transaction(async (tx) => {
      let count = 0;
      
      const defaultUom = await tx.unitOfMeasure.findFirst({
        where: { shopId, isBase: true, isActive: true }
      });
      if (!defaultUom) {
        throw new Error('Default base unit of measure not found for this shop.');
      }
      
      for (const item of products) {
        if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
          throw new Error(`Product name is missing or invalid for one of the rows.`);
        }

        // Check for barcode/SKU duplication
        if (item.sku?.trim()) {
          const dupSku = await tx.product.findFirst({
            where: { shopId, sku: item.sku.trim(), isActive: true }
          });
          if (dupSku) {
            throw new Error(`Duplicate SKU found in store: ${item.sku}`);
          }
        }

        if (item.barcode?.trim()) {
          const dupBarcode = await tx.product.findFirst({
            where: { shopId, barcode: item.barcode.trim(), isActive: true }
          });
          if (dupBarcode) {
            throw new Error(`Duplicate barcode found in store: ${item.barcode}`);
          }
        }

        // Category resolution
        let categoryId: string | null = null;
        if (item.categoryName?.trim()) {
          const catName = item.categoryName.trim();
          let category = await tx.category.findFirst({
            where: { shopId, name: catName, isActive: true }
          });
          if (!category) {
            const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            category = await tx.category.create({
              data: {
                shopId,
                name: catName,
                slug: slug || 'category',
                isActive: true
              }
            });
          }
          categoryId = category.id;
        }

        await tx.product.create({
          data: {
            shopId,
            name: item.name.trim(),
            sku: item.sku?.trim() || null,
            barcode: item.barcode?.trim() || null,
            categoryId,
            baseUnitOfMeasureId: defaultUom.id,
            price: Number(item.price || 0),
            cost: Number(item.cost || 0),
            stockQty: Number(item.initialStock || 0),
            isActive: true
          }
        });

        count++;
      }

      return count;
    });

    return NextResponse.json({ success: true, count: createdCount });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to import products.' }, { status: 400 });
  }
}
