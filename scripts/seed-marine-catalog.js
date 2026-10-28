const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Marine Chandlery Catalog in Egyptian Pounds (EGP)...');

  const shops = await prisma.shop.findMany({ select: { id: true, name: true } });
  if (shops.length === 0) {
    console.error('No shops found.');
    return;
  }

  const marineCategories = [
    { name: 'مؤن وأغذية طازجة (Fresh Provisions)', code: 'FRESH' },
    { name: 'لحوم ودواجن مجمدة (Frozen Meats & Poultry)', code: 'FROZEN' },
    { name: 'بضائع ومؤن جافة (Dry Provisions)', code: 'DRY' },
    { name: 'مشروبات ومياه معبأة (Beverages & Mineral Water)', code: 'BEV' },
    { name: 'مهمات السطح والمخطاف (Deck Stores & Mooring Gear)', code: 'DECK' },
    { name: 'مهمات غرفة المحركات وفلاتر (Engine Stores & Filters)', code: 'ENGINE' },
    { name: 'زيوت وشحوم بحرية معتمدة (Marine Lubricants)', code: 'LUBE' },
    { name: 'مهمات السلامة ومكافحة الحريق (SOLAS Safety Gear)', code: 'SAFETY' }
  ];

  const marineProductsData = [
    {
      categoryCode: 'FRESH',
      name: 'بطاطس مصرية طازجة فرز أول (Fresh Egyptian Potatoes)',
      sku: 'PROV-POT-25KG',
      barcode: '150101',
      cost: 450.00,
      price: 650.00,
      stockQty: 140,
      description: 'شكائر بطاطس طازجة درجة أولى مخصصة لتموين السفن، تعبئة شكارة 25 كجم جيدة التهوية.',
      variant: {
        color: 'طازج فرز أول (Fresh)',
        size: 'شكارة 25 كجم',
        sku: 'PROV-POT-25KG-VAR1',
        barcode: '150101-25K',
        stockQty: 140,
        priceOverride: 650.00,
        costOverride: 450.00
      }
    },
    {
      categoryCode: 'FRESH',
      name: 'بصل أحمر مصري فاخر (Grade A Red Onions)',
      sku: 'PROV-ONI-25KG',
      barcode: '150102',
      cost: 500.00,
      price: 720.00,
      stockQty: 95,
      description: 'بصل أحمر بلدي عالي الجفاف والصلاحية للشحنات البحرية، شكائر 25 كجم.',
      variant: {
        color: 'طازج فرز أول (Fresh)',
        size: 'شكارة 25 كجم',
        sku: 'PROV-ONI-25KG-VAR1',
        barcode: '150102-25K',
        stockQty: 95,
        priceOverride: 720.00,
        costOverride: 500.00
      }
    },
    {
      categoryCode: 'FROZEN',
      name: 'لحم بقري مجمد منزوع العظم (Frozen Boneless Beef 20kg)',
      sku: 'PROV-BEEF-20KG',
      barcode: '150501',
      cost: 4800.00,
      price: 6400.00,
      stockQty: 50,
      description: 'كرتونة لحم بقري مجمد برازيلي توب سايد عالي الجودة لتموين خطوط الشحن، حفظ -18°C.',
      variant: {
        color: 'مجمد -18°C (Frozen)',
        size: 'كرتونة 20 كجم',
        sku: 'PROV-BEEF-20KG-VAR1',
        barcode: '150501-20K',
        stockQty: 50,
        priceOverride: 6400.00,
        costOverride: 4800.00
      }
    },
    {
      categoryCode: 'FROZEN',
      name: 'دواجن كاملة مجمدة سيرا (Whole Frozen Chicken 10x1200g)',
      sku: 'PROV-CHICK-12KG',
      barcode: '150520',
      cost: 1650.00,
      price: 2200.00,
      stockQty: 75,
      description: 'كرتونة دجاج مجمد 10 حبات زنة 1200 جم معتمدة للملاحة الدولية.',
      variant: {
        color: 'مجمد -18°C (Frozen)',
        size: 'كرتونة 10 كجم',
        sku: 'PROV-CHICK-12KG-VAR1',
        barcode: '150520-12K',
        stockQty: 75,
        priceOverride: 2200.00,
        costOverride: 1650.00
      }
    },
    {
      categoryCode: 'DRY',
      name: 'أرز مصري أبيض فاخر شكائر (Egyptian White Rice 25kg)',
      sku: 'PROV-RICE-25KG',
      barcode: '170110',
      cost: 780.00,
      price: 990.00,
      stockQty: 110,
      description: 'أرز مصري كامولينو نمرة 1 شكارة 25 كجم عالية التخزين للملاحة البحرية.',
      variant: {
        color: 'مؤن جافة (Dry Provisions)',
        size: 'شكارة 25 كجم',
        sku: 'PROV-RICE-25KG-VAR1',
        barcode: '170110-25K',
        stockQty: 110,
        priceOverride: 990.00,
        costOverride: 780.00
      }
    },
    {
      categoryCode: 'BEV',
      name: 'مياه شرب معبأة كراتين (Bottled Drinking Water 12 x 1.5L)',
      sku: 'BEV-WATER-1.5L',
      barcode: '190105',
      cost: 95.00,
      price: 145.00,
      stockQty: 420,
      description: 'كرتونة مياه معدنية نقية 12 عبوة 1.5 لتر صالحة للملاحة والتموين المباشر للبحارة.',
      variant: {
        color: 'مؤن جافة (Dry Provisions)',
        size: 'طرد 12×1.5 لتر',
        sku: 'BEV-WATER-1.5L-VAR1',
        barcode: '190105-12P',
        stockQty: 420,
        priceOverride: 145.00,
        costOverride: 95.00
      }
    },
    {
      categoryCode: 'DECK',
      name: 'حبل رباط بولي بروبلين 8 جدائل (Mooring Rope 8-Strand PP 40mm x 220m)',
      sku: 'DECK-ROPE-40MM',
      barcode: '210142',
      cost: 14800.00,
      price: 20500.00,
      stockQty: 16,
      description: 'حبل رباط بحري معتمد عالي الشد قطر 40 مم بطول 220 متر للموانئ والسفن التجارية، كود إيمبا 210142.',
      variant: {
        color: 'معتمد بحرياً (Marine Grade)',
        size: 'قطر 40 مم',
        sku: 'DECK-ROPE-40MM-VAR1',
        barcode: '210142-40M',
        stockQty: 16,
        priceOverride: 20500.00,
        costOverride: 14800.00
      }
    },
    {
      categoryCode: 'DECK',
      name: 'زنك حماية كاثودية للبدن (Zinc Sacrificial Anode 10kg)',
      sku: 'DECK-ZINC-10KG',
      barcode: '232011',
      cost: 1850.00,
      price: 2650.00,
      stockQty: 60,
      description: 'قوالب زنك نقي 10 كجم مانعة للصدأ والتآكل الكهروكيميائي لبدن السفن والمحركات، كود إيمبا 232011.',
      variant: {
        color: 'مواصفات إيمبا (IMPA Spec)',
        size: 'قطعة معيارية',
        sku: 'DECK-ZINC-10KG-VAR1',
        barcode: '232011-10K',
        stockQty: 60,
        priceOverride: 2650.00,
        costOverride: 1850.00
      }
    },
    {
      categoryCode: 'ENGINE',
      name: 'فلتر زيت تشحيم محركات بحرية (Lube Oil Filter Element MAN B&W)',
      sku: 'ENG-FILT-MAN32',
      barcode: '591522',
      cost: 3300.00,
      price: 4750.00,
      stockQty: 28,
      description: 'عنصر فلتر زيت أصلي لمحركات الديزل البحرية MAN B&W 32/40، كود إيمبا 591522.',
      variant: {
        color: 'أصلي OEM',
        size: 'قطعة معيارية',
        sku: 'ENG-FILT-MAN32-VAR1',
        barcode: '591522-MAN',
        stockQty: 28,
        priceOverride: 4750.00,
        costOverride: 3300.00
      }
    },
    {
      categoryCode: 'ENGINE',
      name: 'فلتر وقود ديزل بحري فارتسيلا (HFO/MGO Filter Element Wartsila 38)',
      sku: 'ENG-FILT-WAR38',
      barcode: '591540',
      cost: 4200.00,
      price: 6100.00,
      stockQty: 22,
      description: 'فلتر وقود ديزل بحري عالي الكفاءة لمحركات Wartsila 38، كود إيمبا 591540.',
      variant: {
        color: 'أصلي OEM',
        size: 'قطعة معيارية',
        sku: 'ENG-FILT-WAR38-VAR1',
        barcode: '591540-WAR',
        stockQty: 22,
        priceOverride: 6100.00,
        costOverride: 4200.00
      }
    },
    {
      categoryCode: 'LUBE',
      name: 'زيت محركات بحرية موبيل جارد (Mobilgard 412 Engine Oil 208L)',
      sku: 'LUBE-MOBIL-412',
      barcode: '270102',
      cost: 28500.00,
      price: 37200.00,
      stockQty: 15,
      description: 'برميل زيت محركات ديزل بحرية موبيل جارد 412 عالي القلوية TBN 12 سعة 208 لتر، كود إيمبا 270102.',
      variant: {
        color: 'معتمد بحرياً (Marine Grade)',
        size: 'برميل 208 لتر',
        sku: 'LUBE-MOBIL-412-VAR1',
        barcode: '270102-208L',
        stockQty: 15,
        priceOverride: 37200.00,
        costOverride: 28500.00
      }
    },
    {
      categoryCode: 'SAFETY',
      name: 'طوق نجاة بحري معتمد مع حبل (SOLAS Lifebuoy 4.0kg with Rope & Tape)',
      sku: 'SAFE-LIFEBUOY-4K',
      barcode: '330151',
      cost: 1450.00,
      price: 2150.00,
      stockQty: 35,
      description: 'طوق نجاة صلب بولي إيثيلين زنة 4.0 كجم مع حبل نجاة 30 متر وشريط عاكس معتمد SOLAS/MED.',
      variant: {
        color: 'معتمد SOLAS',
        size: 'قطعة معيارية',
        sku: 'SAFE-LIFEBUOY-4K-VAR1',
        barcode: '330151-4KG',
        stockQty: 35,
        priceOverride: 2150.00,
        costOverride: 1450.00
      }
    },
    {
      categoryCode: 'SAFETY',
      name: 'بدلة غمر حرارية بحرية (Marine Insulated Immersion Suit SOLAS)',
      sku: 'SAFE-IMMSUIT-MED',
      barcode: '330182',
      cost: 5600.00,
      price: 7950.00,
      stockQty: 25,
      description: 'بدلة غمر ونجاة عازلة للحرارة مصنوعة من النيوبرين مع صفارة وإضاءة استغاثة معتمدة للمحيطات SOLAS.',
      variant: {
        color: 'معتمد SOLAS',
        size: 'طرد فردي',
        sku: 'SAFE-IMMSUIT-MED-VAR1',
        barcode: '330182-UNIV',
        stockQty: 25,
        priceOverride: 7950.00,
        costOverride: 5600.00
      }
    }
  ];

  for (const shop of shops) {
    console.log(`Processing shop: ${shop.name} (${shop.id})`);

    // Ensure UOMs exist
    let pieceUom = await prisma.unitOfMeasure.findFirst({
      where: { shopId: shop.id, code: 'PIECE' }
    });
    if (!pieceUom) {
      pieceUom = await prisma.unitOfMeasure.create({
        data: {
          shopId: shop.id,
          code: 'PIECE',
          name: 'قطعة / وحدة',
          isBase: true
        }
      });
    }

    // Upsert marine categories
    const categoryMap = new Map();
    for (const cat of marineCategories) {
      let existingCat = await prisma.category.findFirst({
        where: { shopId: shop.id, name: cat.name }
      });
      if (!existingCat) {
        existingCat = await prisma.category.create({
          data: {
            shopId: shop.id,
            name: cat.name,
            slug: `${cat.code.toLowerCase()}-${shop.id.slice(-6)}`
          }
        });
      }
      categoryMap.set(cat.code, existingCat.id);
    }

    // Upsert products
    for (const prod of marineProductsData) {
      const categoryId = categoryMap.get(prod.categoryCode);
      const existingProduct = await prisma.product.findFirst({
        where: { shopId: shop.id, sku: prod.sku }
      });

      if (!existingProduct) {
        const createdProduct = await prisma.product.create({
          data: {
            shopId: shop.id,
            categoryId,
            baseUnitOfMeasureId: pieceUom.id,
            sku: prod.sku,
            barcode: prod.barcode,
            name: prod.name,
            description: prod.description,
            cost: prod.cost,
            price: prod.price,
            stockQty: prod.stockQty,
            reorderPoint: 10,
            productType: 'SPARE_PART',
            isActive: true,
            variants: {
              create: {
                color: prod.variant.color,
                size: prod.variant.size,
                sku: prod.variant.sku,
                barcode: prod.variant.barcode,
                stockQty: prod.variant.stockQty,
                priceOverride: prod.variant.priceOverride,
                costOverride: prod.variant.costOverride,
                isActive: true
              }
            }
          }
        });
        console.log(`  + Created: ${createdProduct.name} (${prod.price} ج.م)`);
      } else {
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            categoryId,
            price: prod.price,
            cost: prod.cost,
            stockQty: prod.stockQty,
            description: prod.description,
            productType: 'SPARE_PART',
            isActive: true
          }
        });
        console.log(`  * Updated: ${prod.name}`);
      }
    }
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
