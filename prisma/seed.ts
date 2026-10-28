import {
  CashMovementType,
  CashSessionStatus,
  CustomerCreditStatus,
  CustomerLoyaltyLedgerType,
  CustomerType,
  DocumentSequenceType,
  NotificationType,
  PayableStatus,
  PrismaClient,
  PurchaseStatus,
  SaleAdjustmentDisposition,
  SaleAdjustmentItemType,
  SaleAdjustmentType,
  ShopRole,
  ShopType,
  StockCountStatus,
  SupplierCreditMemoStatus,
  SupplierReturnDisposition,
  SupplierReturnReason,
  SupplierReturnStatus,
  WorkerJobType
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DAY = 1000 * 60 * 60 * 24;

const INVENTORY_REASON_PRESETS = [
  { code: 'DAMAGED', label: 'Damaged' },
  { code: 'EXPIRED', label: 'Expired' },
  { code: 'LOST', label: 'Lost' },
  { code: 'SHRINKAGE', label: 'Shrinkage' },
  { code: 'OPENING_BALANCE_CORRECTION', label: 'Opening balance correction' },
  { code: 'SUPPLIER_RETURN', label: 'Supplier return' },
  { code: 'INTERNAL_USE', label: 'Internal use' }
] as const;

const DEFAULT_UNITS_OF_MEASURE = [
  { code: 'PIECE', name: 'Piece', isBase: true },
  { code: 'BOX', name: 'Box', isBase: false },
  { code: 'CARTON', name: 'Carton', isBase: false },
  { code: 'PACK', name: 'Pack', isBase: false }
] as const;

function createSeedImageDataUrl(label: string, _accent: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640"><defs><linearGradient id="volarGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff6600" /><stop offset="100%" stop-color="#111111" /></linearGradient></defs><rect width="640" height="640" fill="#ffffff"/><rect x="32" y="32" width="576" height="576" rx="48" fill="url(#volarGrad)"/><path d="M320,180 L220,240 L240,460 L400,460 L420,240 Z" fill="none" stroke="#ffffff" stroke-width="12" stroke-linejoin="round"/><path d="M320,180 C320,150 340,150 340,130 C340,110 320,110 320,130" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/><text x="320" y="520" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="800" fill="#ffffff" letter-spacing="2">VOLAR FASHION</text><text x="320" y="560" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#ff6600" font-weight="bold">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function ago(days: number, hour = 10) {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, (days * 7) % 60, 0, 0);
  return date;
}

function future(days: number) {
  return new Date(Date.now() + days * DAY);
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

async function seedShopBasics(shopId: string) {
  await prisma.inventoryReason.createMany({
    data: INVENTORY_REASON_PRESETS.map((reason) => ({
      shopId,
      code: reason.code,
      label: reason.label,
      isActive: true
    }))
  });

  await prisma.unitOfMeasure.createMany({
    data: DEFAULT_UNITS_OF_MEASURE.map((unit) => ({
      shopId,
      code: unit.code,
      name: unit.name,
      isBase: unit.isBase,
      isActive: true
    }))
  });
}

async function clearDatabase() {
  console.log('Clearing database tables...');
  const models = [
    'branchExpense',
    'installmentCompanyDue',
    'reservation',
    'dealerDebt',
    'trafficInvoice',
    'workerJob',
    'authAuditLog',
    'activityLog',
    'notification',
    'receivablePayment',
    'customerCreditLedger',
    'customerLoyaltyLedger',
    'inventoryMovement',
    'saleAdjustmentItem',
    'refundPayment',
    'saleAdjustment',
    'saleItem',
    'salePayment',
    'sale',
    'parkedSaleItem',
    'parkedSale',
    'stockCountItem',
    'stockCount',
    'stockTransferItem',
    'stockTransfer',
    'supplierPayment',
    'accountsPayableEntry',
    'supplierInvoice',
    'purchaseReceiptItem',
    'purchaseReceipt',
    'purchaseItem',
    'purchaseOrder',
    'supplierReturnItem',
    'supplierReturn',
    'productBatch',
    'productPriceHistory',
    'productCostHistory',
    'productImage',
    'productVariant',
    'productUomConversion',
    'product',
    'category',
    'supplier',
    'customer',
    'unitOfMeasure',
    'inventoryReason',
    'userShop',
    'shopSetting',
    'documentSequence',
    'cashMovement',
    'cashSession',
    'shop',
    'passwordResetToken',
    'emailVerificationToken',
    'user'
  ];

  for (const model of models) {
    try {
      const client = prisma as any;
      if (client[model]) {
        await client[model].deleteMany({});
      }
    } catch (e) {
      console.warn(`Could not clear table ${model}:`, e);
    }
  }
  console.log('Database tables cleared successfully.');
}

async function main() {
  await clearDatabase();

  const passwordHash = await bcrypt.hash('password123', 12);

  const owner = await prisma.user.create({
    data: {
      email: 'owner@volar.eg',
      name: 'مالك محلات فولار',
      passwordHash,
      emailVerifiedAt: new Date()
    }
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@volar.eg',
      name: 'مدير الفرع',
      passwordHash,
      emailVerifiedAt: new Date()
    }
  });

  const cashier = await prisma.user.create({
    data: {
      email: 'cashier@volar.eg',
      name: 'كاشير محلات فولار',
      passwordHash,
      emailVerifiedAt: new Date()
    }
  });

  const counter = await prisma.user.create({
    data: {
      email: 'counter@volar.eg',
      name: 'مسؤول الجرد فولار',
      passwordHash,
      emailVerifiedAt: new Date()
    }
  });

  const shop = await prisma.shop.create({
    data: {
      name: 'Volar - الزمالك',
      legalBusinessName: 'شركة فولار لبيع الملابس الجاهزة',
      slug: 'volar-zamalek',
      posType: ShopType.GENERAL_RETAIL,
      phone: '+201000111222',
      email: 'hello@volar.eg',
      address: '٢٦ شارع أبو الفدا، الزمالك، القاهرة',
      taxId: 'EG-VOLAR-2026',
      ownerId: owner.id
    }
  });

  const branchShop = await prisma.shop.create({
    data: {
      name: 'Volar - التجمع',
      legalBusinessName: 'شركة فولار لبيع الملابس الجاهزة',
      slug: 'volar-new-cairo',
      posType: ShopType.GENERAL_RETAIL,
      phone: '+201000111333',
      email: 'newcairo@volar.eg',
      address: 'داون تاون مول، التجمع الخامس، القاهرة الجديدة',
      taxId: 'EG-VOLAR-2026-B',
      ownerId: owner.id
    }
  });

  for (const currentShop of [shop, branchShop]) {
    await prisma.shopSetting.create({
      data: {
        shopId: currentShop.id,
        currencyCode: 'EGP',
        currencySymbol: 'ج.م ',
        timezone: 'Africa/Cairo',
        taxMode: 'EXCLUSIVE',
        taxRate: 14,
        defaultPaymentMethods: ['درج كاش الفرع', 'انستا باي', 'محفظه الكترونيه', 'فيزا', 'فاليو', 'امان'],
        receiptHeader: currentShop.name,
        receiptFooter: 'شكرًا لتسوقكم من محلات فولار (Volar) للملابس والموضة.',
        receiptWidth: '80mm',
        printerName: currentShop.slug.includes('zamalek') ? 'Zamalek Thermal Counter' : 'New Cairo Thermal Counter',
        printerConnection: 'USB',
        barcodeScannerNotes: 'امسح الباركود أو اكتب SKU ثم اضغط Enter في الكاشير.',
        lowStockThreshold: 12,
        openingFloatRequired: true,
        openingFloatAmount: 1500,
        batchTrackingEnabled: true,
        expiryTrackingEnabled: true,
        fefoEnabled: true,
        expiryAlertDays: 30,
        salePrefix: 'VO-SAL',
        receiptPrefix: 'VO-RCP',
        purchasePrefix: 'VO-PO'
      }
    });
    await seedShopBasics(currentShop.id);
  }

  const userRolesList = [
    { userId: owner.id, role: ShopRole.ADMIN, salary: 12000, rate: 0 },
    { userId: manager.id, role: ShopRole.MANAGER, salary: 7000, rate: 2 },
    { userId: cashier.id, role: ShopRole.CASHIER, salary: 6000, rate: 5 },
    { userId: counter.id, role: ShopRole.STOCK_COUNTER, salary: 5000, rate: 0 }
  ];

  for (const { userId, role, salary, rate } of userRolesList) {
    await prisma.userShop.create({
      data: {
        userId,
        shopId: shop.id,
        role,
        isActive: true,
        assignedAt: ago(30),
        baseSalary: salary,
        commissionRate: rate
      }
    });
    await prisma.user.update({ where: { id: userId }, data: { defaultShopId: shop.id } });
  }

  const branchUserRolesList = [
    { userId: owner.id, role: ShopRole.ADMIN, salary: 12000, rate: 0 },
    { userId: manager.id, role: ShopRole.MANAGER, salary: 7000, rate: 2 },
    { userId: counter.id, role: ShopRole.STOCK_COUNTER, salary: 5000, rate: 0 }
  ];

  for (const { userId, role, salary, rate } of branchUserRolesList) {
    await prisma.userShop.create({
      data: {
        userId,
        shopId: branchShop.id,
        role,
        isActive: true,
        assignedAt: ago(28),
        baseSalary: salary,
        commissionRate: rate
      }
    });
  }

  const units = await prisma.unitOfMeasure.findMany({ where: { shopId: shop.id } });
  const pieceUnit = units.find((unit) => unit.code === 'PIECE') ?? units[0];
  const boxUnit = units.find((unit) => unit.code === 'BOX') ?? pieceUnit;
  const packUnit = units.find((unit) => unit.code === 'PACK') ?? pieceUnit;

  const categoryNames = [
    'تيشرتات وبولو',
    'قمصان كلاسيك وكاجوال',
    'بنطلونات وجينز',
    'عطور وإكسسوارات',
    'أحذية وأحزمة',
    'جواكت ومعاطف',
    'حقائب ومحافظ',
    'ملابس رياضية',
    'ملابس نوم ومنازل',
    'ملابس شتوية'
  ];
  const categories = new Map<string, Awaited<ReturnType<typeof prisma.category.create>>>();
  for (const name of categoryNames) {
    categories.set(name, await prisma.category.create({ data: { shopId: shop.id, name, slug: name.replaceAll(' ', '-').replaceAll('و', 'w') } }));
  }

  const suppliersData = [
    ['شركة فولار للتصميم والاستيراد', 'أحمد عبدالعزيز', 'design@volar.eg', '+201001000001', 'مصمم ومستورد ملابس فولار الحصرية الفاخرة'],
    ['مصنع الشرق للمنسوجات والملابس الجاهزة', 'سارة نبيل', 'textiles@east.local', '+201001000002', 'أقمشة، قطنيات، وبنطلونات جينز عالية الجودة'],
    ['الشركة المصرية للأحذية والجلود', 'محمود عادل', 'shoes@egyptian.local', '+201001000003', 'أحذية كلاسيك ورياضية وأحزمة جلد طبيعي'],
    ['النور لإكسسوارات الملابس والخرز', 'نهى سمير', 'accessories@alnoor.local', '+201001000004', 'أزرار، أكمام، كابات، وأربطة فاخرة'],
    ['مركز تكنو فاشن للاستيراد', 'كريم فؤاد', 'techno@technofashion.local', '+201001000005', 'ملابس مستوردة وإكسسوارات حماية الرأس'],
    ['النصر للملابس الرياضية والجواكت', 'ليلى حمدي', 'sportswear@nasr.local', '+201001000006', 'أطقم رياضية، جواكت جلد، وبلوفرات صوف'],
    ['البشير للتعبئة والتغليف والعلب', 'حسن مصطفى', 'packaging@bashir.local', '+201001000007', 'أكياس ورقية فاخرة، علب أحذية، وكراتين تعبئة'],
    ['بورتو جروب للشنط والمحافظ', 'دينا عماد', 'bags@porto.local', '+201001000008', 'حقائب ظهر، محافظ جلدية ذكية، وحقائب سفر']
  ];
  
  const suppliers = [];
  for (const [name, contactName, email, phone, notes] of suppliersData) {
    const s = await prisma.supplier.create({
      data: { shopId: shop.id, name, contactName, email, phone, address: 'القاهرة الكبرى', notes }
    });
    suppliers.push(s);
  }

  const customersData = [
    ['INDIVIDUAL', 'كريم', 'أحمد', '', 'karim@demo.local'], ['INDIVIDUAL', 'أحمد', 'السقا', '', 'sakka@demo.local'],
    ['INDIVIDUAL', 'مصطفى', 'شعبان', '', 'shaban@demo.local'], ['INDIVIDUAL', 'محمد', 'حماقي', '', 'hamaki@demo.local'],
    ['INDIVIDUAL', 'هاني', 'شاكر', '', 'shaker@demo.local'], ['INDIVIDUAL', 'طارق', 'لطفي', '', 'lotfy@demo.local'],
    ['INDIVIDUAL', 'يسرا', 'الجميلة', '', 'yousra@demo.local'], ['INDIVIDUAL', 'رانيا', 'يوسف', '', 'rania@demo.local'],
    ['BUSINESS', '', '', 'شركة تسليم دليفري السريعة', 'delivery@demo.local'], ['BUSINESS', '', '', 'خدمة توصيل طلبات مصر', 'talabat@demo.local'],
    ['BUSINESS', '', '', 'أكاديمية الملابس والموضة بالقاهرة', 'academy@demo.local'], ['INDIVIDUAL', 'سيف', 'مراد', '', 'saif@demo.local']
  ];

  const customers = [];
  for (const [index, [type, firstName, lastName, businessName, email]] of customersData.entries()) {
    const c = await prisma.customer.create({
      data: {
        shopId: shop.id,
        type: type as CustomerType,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        businessName: businessName || undefined,
        contactPerson: businessName ? 'مسؤول المشتريات والتوريد' : undefined,
        phone: `+20101230${String(index + 1).padStart(4, '0')}`,
        email,
        address: index % 2 ? 'القاهرة الجديدة' : 'الزمالك',
        notes: businessName ? 'عميل شركات مع حد ائتماني لتوريد الزي الموحد والملابس.' : 'عميل فردي لملابس فولار.'
      }
    });
    customers.push(c);
  }

  const productSeeds: Array<{ category: string; name: string; cost: number; price: number; stock: number; reorder: number; expiry?: boolean }> = [];
  const groups = [
    ['تيشرتات وبولو', [
      'تيشرت قطن سادة برتقالي',
      'تيشرت بولو كلاسيك أسود',
      'تيشرت مطبوع عصري أبيض',
      'تيشرت أوفرسايز فولار',
      'تيشرت برقبة دائرية رمادي',
      'بولو قميص مخطط رياضى',
      'تيشرت قطن بيما فاخر',
      'تيشرت جرافيك أسود'
    ], 150, 350],
    ['قمصان كلاسيك وكاجوال', [
      'قميص كتان صيفي أبيض',
      'قميص أوكسفورد أزرق فاتح',
      'قميص كاروهات كاجوال',
      'قميص حرير أسود فاخر',
      'قميص جينز كلاسيك',
      'قميص رسمي أبيض مقلم',
      'قميص كاجوال ياقة كورية',
      'قميص صوفي خفيف مقلم'
    ], 200, 480],
    ['بنطلونات وجينز', [
      'بنطلون جينز سليم فيت أزرق',
      'بنطلون جينز بوي فريند أسود',
      'بنطلون جينز كلاسيك مريح',
      'بنطلون قماش شينو زيتي',
      'بنطلون كارجو رياضي أسود',
      'بنطلون رسمي رمادي كلاسيك',
      'بنطلون كتان واسع بيج',
      'شورت كاجوال قطن'
    ], 220, 520],
    ['عطور وإكسسوارات', [
      'عطر فولار الملكي للرجال',
      'عطر سحر الليل للنساء',
      'ساعة يد كلاسيك سوداء',
      'نظارة شمسية واقية سوداء',
      'كاب فولار برتقالي مميز',
      'طقم جوارب قطنية ملونة',
      'أزرار أكمام فضية أنيقة',
      'وشاح صوف دافئ رمادي'
    ], 180, 420],
    ['أحذية وأحزمة', [
      'حذاء رياضي أبيض كاجوال',
      'حذاء كلاسيك جلد أسود',
      'حذاء مريح للمشي بيج',
      'حذاء لوفر جلد بني',
      'حزام جلد طبيعي أسود',
      'حزام كاجوال منسوج برتقالي',
      'خف منزلي صوف مريح',
      'ملمع أحذية جلدي فاخر'
    ], 250, 650],
    ['جواكت ومعاطف', [
      'جاكيت جلد طبيعي أسود',
      'جاكيت جينز ممزق عصري',
      'جاكيت وندبريكر برتقالي رياضي',
      'معطف طويل صوف بيج',
      'جاكيت منفوخ شتوي أسود',
      'سترة بليزر كلاسيك سوداء',
      'جاكيت بومبر قطني رمادي',
      'سترة حماية خفيفة مميزة'
    ], 450, 1100],
    ['حقائب ومحافظ', [
      'حقيبة ظهر للابتوب سوداء',
      'محفظة جلدية ذكية برتقالية',
      'حقيبة يد نسائية كلاسيكية',
      'حقيبة كروس كاجوال رمادية',
      'محفظة كروت مدمجة جلد',
      'حقيبة سفر صغيرة قماش',
      'شنطة وسط رياضية برتقالية',
      'حقيبة تسوق قماشية فولار'
    ], 140, 380],
    ['ملابس رياضية', [
      'طقم رياضي سويت شيرت وبنطلون',
      'بنطلون ضاغط جري أسود',
      'تيشرت جري سريع الجفاف',
      'هودي رياضي برتقالي مميز',
      'حمالة صدر رياضية نسائية',
      'شورت جري خفيف تنفسي',
      'جاكيت رياضي خفيف بسحاب',
      'جوارب رياضية داعمة بيضاء'
    ], 230, 550],
    ['ملابس نوم ومنازل', [
      'بيجامة قطنية مريحة كحلي',
      'روب حمام قطيفة فاخر بيج',
      'سروال منزلي فضفاض رمادي',
      'تيشرت منزلي واسع أبيض',
      'طقم بيجامة صيفي قطعتين',
      'بيجامة ستان فاخرة سوداء',
      'سروال نوم قصير مريح',
      'جوارب منزلية حرارية دافئة'
    ], 160, 390],
    ['ملابس شتوية', [
      'بلوفر صوف محبوك رمادي',
      'سويت شيرت هودي أوفرسايز',
      'بلوفر ياقة عالية أسود',
      'كارديجان صوف طويل كحلي',
      'سويت شيرت بسحاب دافئ برتقالي',
      'سترة صوفية مخططة أنيقة',
      'وشاح شتوي عريض مخطط',
      'قفازات صوفية مبطنة دافئة'
    ], 190, 460]
  ] as const;

  groups.forEach(([category, names, baseCost, basePrice], groupIndex) => {
    names.forEach((name, index) => productSeeds.push({
      category,
      name,
      cost: baseCost + index * 15,
      price: basePrice + index * 30,
      stock: 60 + groupIndex * 10 - index * 3,
      reorder: 10 + (index % 4) * 2,
      expiry: ['عطور وإكسسوارات', 'ملابس نوم ومنازل', 'حقائب ومحافظ'].includes(category)
    }));
  });

  const products = [];
  for (const [index, item] of productSeeds.entries()) {
    const sku = `VO-${String(index + 1).padStart(3, '0')}`;
    const product = await prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: categories.get(item.category)!.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku,
        barcode: `622300${String(index + 1).padStart(7, '0')}`,
        name: item.name,
        description: `${item.name} بتصميم مميز وخامات قطنية فاخرة من محلات فولار للموضة.`,
        cost: item.cost,
        price: item.price,
        stockQty: item.stock,
        reorderPoint: item.reorder,
        trackBatches: Boolean(item.expiry),
        trackExpiry: Boolean(item.expiry),
        productType: 'SPARE_PART'
      }
    });
    products.push(product);
  }
  const productBySku = Object.fromEntries(products.map((product) => [product.sku!, product]));

  const categoryImages: Record<string, string[]> = {
    'تيشرتات وبولو': [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?w=500&auto=format&fit=crop&q=60'
    ],
    'قمصان كلاسيك وكاجوال': [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1620012253295-c05518e993be?w=500&auto=format&fit=crop&q=60'
    ],
    'بنطلونات وجينز': [
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=500&auto=format&fit=crop&q=60'
    ],
    'جواكت ومعاطف': [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1608063615781-e5ef8c13985b?w=500&auto=format&fit=crop&q=60'
    ],
    'ملابس رياضية': [
      'https://images.unsplash.com/photo-1483721310020-03333e577078?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1506152983158-b4a74a01c721?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=500&auto=format&fit=crop&q=60'
    ],
    'ملابس نوم ومنازل': [
      'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1618677831708-0e7fda3148b4?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1618220179428-22790b461013?w=500&auto=format&fit=crop&q=60'
    ],
    'ملابس شتوية': [
      'https://images.unsplash.com/photo-1614975058789-41316d0e2e9c?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1610556559408-9a318730eecc?w=500&auto=format&fit=crop&q=60'
    ],
    'عطور وإكسسوارات': [
      'https://images.unsplash.com/photo-1541643600914-78b084683601?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=500&auto=format&fit=crop&q=60'
    ],
    'أحذية وأحزمة': [
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=500&auto=format&fit=crop&q=60'
    ],
    'حقائب ومحافظ': [
      'https://images.unsplash.com/photo-1547949003-9792a18a2601?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=500&auto=format&fit=crop&q=60'
    ]
  };

  const fallbackImage = 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&auto=format&fit=crop&q=60';
  const productImagesData = [];
  for (const [index, product] of products.entries()) {
    const seedItem = productSeeds[index];
    const categoryName = seedItem.category;
    const urls = categoryImages[categoryName] || [fallbackImage];
    const imageUrl = urls[index % urls.length];
    productImagesData.push({
      productId: product.id,
      imageUrl,
      altText: `صورة ${product.name}`,
      sortOrder: 0
    });
  }

  await prisma.productImage.createMany({
    data: productImagesData
  });

  await prisma.productVariant.createMany({
    data: [
      { productId: productBySku['VO-001'].id, size: 'XL', sku: 'VO-001-XL', barcode: '6223999000001', priceOverride: 380, costOverride: 170 },
      { productId: productBySku['VO-001'].id, size: 'L', sku: 'VO-001-L', barcode: '6223999000002', priceOverride: 350, costOverride: 150 },
      { productId: productBySku['VO-025'].id, size: 'XL', sku: 'VO-025-R', barcode: '6223999000025', priceOverride: 700, costOverride: 280 },
      { productId: productBySku['VO-025'].id, size: 'L', sku: 'VO-025-F', barcode: '6223999000026', priceOverride: 650, costOverride: 250 }
    ]
  });

  await prisma.productUomConversion.createMany({
    data: [
      { productId: productBySku['VO-025'].id, unitOfMeasureId: boxUnit.id, ratioToBase: 2 },
      { productId: productBySku['VO-028'].id, unitOfMeasureId: packUnit.id, ratioToBase: 24 },
      { productId: productBySku['VO-030'].id, unitOfMeasureId: packUnit.id, ratioToBase: 10 },
      { productId: productBySku['VO-073'].id, unitOfMeasureId: boxUnit.id, ratioToBase: 50 }
    ]
  });

  await prisma.productPriceHistory.createMany({
    data: products.slice(0, 10).map((product, index) => ({ productId: product.id, previousPrice: Number(product.price) - 20, newPrice: product.price, effectiveDate: ago(18 - index), changedByUserId: manager.id, note: 'تحديث أسعار سنوي لقطع الملابس والمستلزمات.' }))
  });
  await prisma.productCostHistory.createMany({
    data: products.slice(10, 20).map((product, index) => ({ productId: product.id, previousCost: Number(product.cost) - 10, newCost: product.cost, effectiveDate: ago(20 - index), changedByUserId: manager.id, note: 'زيادة تكلفة الاستيراد وتكلفة الأقمشة.' }))
  });

  await prisma.productBatch.createMany({
    data: products.filter((product) => product.trackExpiry).slice(0, 30).map((product, index) => ({
      shopId: shop.id,
      productId: product.id,
      lotNumber: `LOT-VOLAR-${String(index + 1).padStart(3, '0')}`,
      expiryDate: future(100 + (index % 50)),
      quantity: Math.max(10, product.stockQty - 5),
      receivedAt: ago(10 + (index % 10)),
      notes: 'شحنة إنتاج جديدة مطابقة للمواصفات'
    }))
  });

  for (const product of products) {
    await prisma.inventoryMovement.create({ data: { shopId: shop.id, productId: product.id, type: 'OPENING_STOCK', qtyChange: product.stockQty, userId: owner.id, notes: 'رصيد افتتاحي لمخزن الملابس' } });
  }

  const branchPieceUnit = await prisma.unitOfMeasure.findFirstOrThrow({ where: { shopId: branchShop.id, code: 'PIECE' } });
  const branchCategory = await prisma.category.create({ data: { shopId: branchShop.id, name: 'قائمة سريعة التداول', slug: 'fast-moving-apparel' } });
  const branchProducts = [];
  for (const source of products.slice(0, 20)) {
    const branchProduct = await prisma.product.create({
      data: { shopId: branchShop.id, categoryId: branchCategory.id, baseUnitOfMeasureId: branchPieceUnit.id, sku: source.sku, barcode: source.barcode, name: source.name, description: source.description, cost: source.cost, price: source.price, stockQty: 30, reorderPoint: 5, trackBatches: source.trackBatches, trackExpiry: source.trackExpiry, productType: 'SPARE_PART' }
    });
    branchProducts.push(branchProduct);
    await prisma.inventoryMovement.create({ data: { shopId: branchShop.id, productId: branchProduct.id, type: 'OPENING_STOCK', qtyChange: 30, userId: owner.id, notes: 'رصيد افتتاحي فرع التجمع الخامس' } });
  }

  const purchase = await prisma.purchaseOrder.create({
    data: {
      shopId: shop.id,
      supplierId: suppliers[0].id,
      purchaseNumber: 'VO-PO-20260501-0001',
      status: PurchaseStatus.FULLY_RECEIVED,
      totalAmount: 32500,
      receivedAt: ago(8),
      notes: 'طلب توريد ملابس قطنية وتيشرتات صيفية لتغطية احتياجات الموسم',
      items: { create: products.slice(24, 32).map((product, index) => ({ productId: product.id, unitOfMeasureId: pieceUnit.id, unitCode: pieceUnit.code, unitName: pieceUnit.name, productName: product.name, qty: 15 + index, ratioToBase: 1, receivedBaseQty: 15 + index, unitCost: product.cost, lineTotal: Number(product.cost) * (15 + index) })) },
      supplierInvoice: { create: { shopId: shop.id, supplierId: suppliers[0].id, invoiceNumber: 'VOLAR-INV-2026-A', invoiceDate: ago(8), dueDate: future(14), totalAmount: 32500, paymentStatus: PayableStatus.PARTIALLY_PAID, notes: 'فاتورة توريد الدفعة الأولى من الملابس' } }
    },
    include: { items: true, supplierInvoice: true }
  });

  await prisma.purchaseReceipt.create({ data: { shopId: shop.id, purchaseId: purchase.id, receivedByUserId: manager.id, receivedAt: ago(7), notes: 'استلام وفحص كامل لجميع كراتين الملابس والقطنيات', items: { create: purchase.items.map((item) => ({ purchaseItemId: item.id, productId: item.productId, qtyReceived: item.qty })) } } });
  await prisma.supplierPayment.create({ data: { shopId: shop.id, supplierInvoiceId: purchase.supplierInvoice!.id, method: 'تحويل بنكي', amount: 15000, referenceNumber: 'TX-BANK-VOLAR-101', paidAt: ago(5), createdByUserId: manager.id } });
  await prisma.accountsPayableEntry.create({ data: { shopId: shop.id, supplierId: suppliers[0].id, supplierInvoiceId: purchase.supplierInvoice!.id, amountDue: 32500, amountPaid: 15000, balance: 17500, status: PayableStatus.PARTIALLY_PAID, dueDate: purchase.supplierInvoice!.dueDate } });

  const supplierReturn = await prisma.supplierReturn.create({
    data: {
      shopId: shop.id,
      supplierId: suppliers[2].id,
      createdByUserId: manager.id,
      approvedByUserId: manager.id,
      status: SupplierReturnStatus.POSTED,
      returnNumber: 'VO-RTS-0001',
      reasonSummary: 'تلف في خياطة وتصميم المعطف أثناء الشحن',
      notes: 'تم فحص الشحنة وإرجاع قطعتين معيبتين للمورد فورًا.',
      creditMemoNumber: 'CM-SHOES-009',
      creditMemoDate: ago(4),
      creditAmount: 1300,
      creditMemoStatus: SupplierCreditMemoStatus.ISSUED,
      postedAt: ago(4),
      items: { create: [{ productId: productBySku['VO-033'].id, productNameSnapshot: productBySku['VO-033'].name, qty: 2, unitCost: productBySku['VO-033'].cost, lineTotal: 1300, reason: SupplierReturnReason.DAMAGED_FROM_SUPPLIER, disposition: SupplierReturnDisposition.DAMAGED }] }
    }
  });
  await prisma.product.update({ where: { id: productBySku['VO-033'].id }, data: { stockQty: { decrement: 2 } } });
  await prisma.inventoryMovement.create({ data: { shopId: shop.id, productId: productBySku['VO-033'].id, type: 'SUPPLIER_RETURN_POSTED', qtyChange: -2, referenceId: supplierReturn.id, userId: manager.id, notes: 'إرجاع ملابس معيبة للمورد' } });

  const saleRecords = [];
  const paymentMethods = ['درج كاش الفرع', 'انستا باي', 'محفظه الكترونيه', 'فيزا', 'فاليو', 'امان'];
  for (let index = 0; index < 45; index++) {
    const first = products[(index * 3) % products.length];
    const second = products[(index * 5 + 13) % products.length];
    const third = products[(index * 7 + 17) % products.length];
    const lines = [
      { product: first, qty: 1 + (index % 2) },
      { product: second, qty: 1 },
      ...(index % 4 === 0 ? [{ product: third, qty: 1 }] : [])
    ];
    const subtotal = round(lines.reduce((sum, line) => sum + Number(line.product.price) * line.qty, 0));
    const discount = index % 8 === 0 ? 50 : 0;
    const tax = round((subtotal - discount) * 0.14);
    const total = round(subtotal - discount + tax);
    const customer = customers[index % customers.length];
    const isCredit = index === 5 || index === 21 || index === 37;
    const sale = await prisma.sale.create({
      data: {
        shopId: shop.id,
        cashierUserId: index % 6 === 0 ? manager.id : cashier.id,
        customerId: customer.id,
        saleNumber: `VO-SAL-202605${String((index % 28) + 1).padStart(2, '0')}-${String(index + 1).padStart(4, '0')}`,
        receiptNumber: `VO-RCP-202605${String((index % 28) + 1).padStart(2, '0')}-${String(index + 1).padStart(4, '0')}`,
        customerName: customer.businessName ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim(),
        customerPhone: customer.phone,
        subtotal,
        taxAmount: tax,
        discountAmount: discount,
        totalAmount: total,
        changeDue: 0,
        paymentMethod: isCredit ? 'فاليو' : paymentMethods[index % paymentMethods.length],
        isCreditSale: isCredit,
        loyaltyPointsEarned: Math.floor(total / 100),
        loyaltyPointsRedeemed: index % 9 === 0 ? 10 : 0,
        loyaltyDiscountAmount: index % 9 === 0 ? 10 : 0,
        notes: 'مبيعات يومية ملابس وتنسيق موضة للعملاء.',
        cashierName: index % 6 === 0 ? manager.name : cashier.name,
        createdAt: ago(20 - (index % 20), 9 + (index % 12)),
        items: { create: lines.map((line) => ({ productId: line.product.id, productName: line.product.name, qty: line.qty, unitPrice: line.product.price, lineTotal: round(Number(line.product.price) * line.qty) })) },
        payments: isCredit ? undefined : { create: [{ method: paymentMethods[index % paymentMethods.length], amount: total, referenceNumber: index % 2 ? `TX-VOLAR-${index + 1}` : undefined }] }
      },
      include: { items: true }
    });
    saleRecords.push(sale);
    await prisma.customerLoyaltyLedger.create({ data: { shopId: shop.id, customerId: customer.id, saleId: sale.id, type: CustomerLoyaltyLedgerType.EARNED, points: Math.floor(total / 100), balanceAfter: (index + 1) * 5, note: `نقاط ولاء من فاتورة ${sale.saleNumber}` } });
    if (isCredit) {
      const ledger = await prisma.customerCreditLedger.create({ data: { shopId: shop.id, customerId: customer.id, saleId: sale.id, dueDate: ago(-10), originalAmount: total, balance: total, status: CustomerCreditStatus.OPEN } });
      await prisma.receivablePayment.create({ data: { shopId: shop.id, customerCreditLedgerId: ledger.id, amount: round(total / 2), method: 'محفظه الكترونيه', referenceNumber: `AR-PAY-${index}`, paidAt: ago(2), createdByUserId: manager.id } });
      await prisma.customerCreditLedger.update({ where: { id: ledger.id }, data: { balance: round(total / 2), status: CustomerCreditStatus.PARTIALLY_PAID } });
    }
    for (const line of lines) {
      await prisma.product.update({ where: { id: line.product.id }, data: { stockQty: { decrement: line.qty } } });
      await prisma.inventoryMovement.create({ data: { shopId: shop.id, productId: line.product.id, type: 'SALE_COMPLETED', qtyChange: -line.qty, referenceId: sale.id, userId: sale.cashierUserId, notes: `فاتورة بيع ${sale.saleNumber}` } });
    }
  }

  for (let index = 0; index < 8; index++) {
    const sale = saleRecords[index];
    const sourceItem = sale.items[0];
    const isVoid = index % 4 === 0;
    const isDamaged = index % 3 === 0;
    const adjustment = await prisma.saleAdjustment.create({
      data: {
        shopId: shop.id,
        saleId: sale.id,
        adjustmentNumber: `VO-RET-202605-${String(index + 1).padStart(4, '0')}`,
        type: isVoid ? SaleAdjustmentType.VOID : SaleAdjustmentType.REFUND,
        reason: isVoid ? 'إلغاء الفاتورة بالكامل بناءً على طلب العميل' : 'إرجاع تيشرت أو قميص لم يستعمل ومعه التيكت',
        notes: isDamaged ? 'القطعة بها قطع أو عيب قماش ولا يمكن إعادة بيعها.' : 'تم فحص القطعة والتأكد من سلامتها وإعادتها للمخزون.',
        subtotal: sourceItem.lineTotal,
        totalAmount: sourceItem.lineTotal,
        approvedByUserId: manager.id,
        createdByUserId: cashier.id,
        createdAt: ago(10 - index, 17),
        items: { create: [{ saleItemId: sourceItem.id, productId: sourceItem.productId, itemType: SaleAdjustmentItemType.RETURN, productName: sourceItem.productName, qty: 1, unitPrice: sourceItem.unitPrice, lineTotal: sourceItem.unitPrice, disposition: isDamaged ? SaleAdjustmentDisposition.DAMAGED : SaleAdjustmentDisposition.RESTOCK }] },
        refundPayments: { create: [{ method: 'درج كاش الفرع', amount: sourceItem.unitPrice, referenceNumber: `RF-VOLAR-${index + 1}` }] }
      }
    });
    if (isVoid) {
      await prisma.sale.update({ where: { id: sale.id }, data: { status: 'VOIDED', voidReason: 'تعديل فاتورة مبيعات' } });
    }
    if (!isDamaged) {
      await prisma.product.update({ where: { id: sourceItem.productId }, data: { stockQty: { increment: 1 } } });
      await prisma.inventoryMovement.create({ data: { shopId: shop.id, productId: sourceItem.productId, type: isVoid ? 'SALE_VOIDED' : 'RETURN_RESTOCKED', qtyChange: 1, referenceId: adjustment.id, userId: manager.id, notes: 'إرجاع مخزون من فاتورة مرتجعة' } });
    }
  }

  const stockTransfer = await prisma.stockTransfer.create({
    data: { fromShopId: shop.id, toShopId: branchShop.id, createdByUserId: manager.id, receivedByUserId: manager.id, transferNumber: 'VO-TRF-0001', status: 'RECEIVED', notes: 'تحويل تيشرتات صيفية سريعة الحركة لفرع التجمع لتغطية عجز الرفوف.', sentAt: ago(3), receivedAt: ago(2), items: { create: [{ fromProductId: productBySku['VO-001'].id, toProductId: branchProducts[0].id, productNameSnapshot: productBySku['VO-001'].name, destinationProductNameSnapshot: branchProducts[0].name, qty: 5 }] } }
  });
  await prisma.inventoryMovement.create({ data: { shopId: shop.id, productId: productBySku['VO-001'].id, type: 'TRANSFER_OUT', qtyChange: -5, referenceId: stockTransfer.id, userId: manager.id, notes: 'تحويل مخزون لفرع التجمع' } });
  await prisma.inventoryMovement.create({ data: { shopId: branchShop.id, productId: branchProducts[0].id, type: 'TRANSFER_IN', qtyChange: 5, referenceId: stockTransfer.id, userId: manager.id, notes: 'استلام تحويل مخزون من فرع الزمالك' } });

  const stockCount = await prisma.stockCount.create({
    data: {
      shopId: shop.id,
      createdByUserId: manager.id,
      approvedByUserId: owner.id,
      referenceNumber: 'VO-STC-0001',
      title: 'جرد نهاية الشهر للتيشرتات والقمصان الكلاسيك',
      status: StockCountStatus.POSTED,
      isBlind: false,
      startedAt: ago(2),
      submittedAt: ago(2, 15),
      approvedAt: ago(2, 16),
      postedAt: ago(2, 17),
      notes: 'تم الجرد الفعلي للمخازن ومقارنته بنظام الـ POS لتسوية الفروق الدورية.',
      items: { create: products.slice(24, 36).map((product, index) => ({ productId: product.id, productNameSnapshot: product.name, skuSnapshot: product.sku, expectedQty: product.stockQty, actualQty: product.stockQty - (index % 4 === 0 ? 1 : 0), varianceQty: index % 4 === 0 ? -1 : 0, note: index % 4 === 0 ? 'عجز طفيف غير مبرر في القطع' : undefined })) }
    }
  });
  await prisma.inventoryMovement.create({ data: { shopId: shop.id, productId: products[24].id, type: 'STOCK_COUNT_POSTED', qtyChange: -1, referenceId: stockCount.id, userId: manager.id, notes: 'تسوية عجز جرد التيشرتات الدوري' } });

  const cashSession = await prisma.cashSession.create({ data: { shopId: shop.id, userId: cashier.id, openedAt: ago(1, 8), openingFloat: 1500, closedAt: ago(1, 23), closedByUserId: manager.id, closingExpected: 18650, closingActual: 18620, variance: -30, notes: 'نهاية شيفت الكاشير - عجز طفيف في الدرج عند التسليم النهائي.', status: CashSessionStatus.CLOSED } });
  await prisma.cashMovement.createMany({ data: [
    { shopId: shop.id, cashSessionId: cashSession.id, type: CashMovementType.CASH_DROP, amount: 5000, note: 'إيداع نقدي للدرج الأساسي', createdByUserId: manager.id, createdAt: ago(1, 16) },
    { shopId: shop.id, cashSessionId: cashSession.id, type: CashMovementType.PETTY_CASH, amount: 200, note: 'شراء ورق طباعة وأدوات كتابية للمكتب', createdByUserId: manager.id, createdAt: ago(1, 18) }
  ] });

  // --- NEW SEED DATA ---
  // Create a Luxury suits category (mapped to MOTORCYCLE enum conceptually)
  const bikeCategory = await prisma.category.create({
    data: {
      shopId: shop.id,
      name: 'بدلات وجواكت فاخرة',
      slug: 'suits-jackets'
    }
  });

  // Create some luxury apparel items of various types
  await prisma.product.createMany({
    data: [
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-SUIT-001',
        barcode: '6224000000001',
        name: 'بدلة كلاسيك إيطالية ثلاث قطع سوداء',
        brand: 'Volar Premium',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-111',
        supplierPrice: 2800,
        assemblyCost: 50,
        externalTransportCost: 40,
        internalTransportCost: 20,
        maintenanceCost: 30,
        otherCosts: 10,
        condition: 'NEW',
        cost: 2950,
        price: 4350,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-JACKET-002',
        barcode: '6224000000002',
        name: 'جاكيت بايكر جلد طبيعي فاخر بني',
        brand: 'Volar Leather',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-222',
        supplierPrice: 2500,
        assemblyCost: 40,
        externalTransportCost: 30,
        internalTransportCost: 20,
        maintenanceCost: 10,
        otherCosts: 10,
        condition: 'NEW',
        cost: 2610,
        price: 3980,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-TUX-003',
        barcode: '6224000000003',
        name: 'بدلة توكسيدو رسمية كاملة مع ربطة عنق',
        brand: 'Volar Tuxedo',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-333',
        supplierPrice: 3300,
        assemblyCost: 60,
        externalTransportCost: 50,
        internalTransportCost: 30,
        maintenanceCost: 40,
        otherCosts: 20,
        condition: 'NEW',
        cost: 3500,
        price: 4950,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-COAT-004',
        barcode: '6224000000004',
        name: 'معطف طويل صوف إنجليزي فاخر كسر زيرو',
        brand: 'Volar English',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-444',
        supplierPrice: 2750,
        assemblyCost: 50,
        externalTransportCost: 40,
        internalTransportCost: 20,
        maintenanceCost: 30,
        otherCosts: 10,
        condition: 'USED',
        cost: 2900,
        price: 3880,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-BLAZER-005',
        barcode: '6224000000005',
        name: 'سترة بليزر كلاسيك رسمية رمادية',
        brand: 'Volar Blazer',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-555',
        supplierPrice: 4000,
        assemblyCost: 80,
        externalTransportCost: 60,
        internalTransportCost: 30,
        maintenanceCost: 20,
        otherCosts: 10,
        condition: 'NEW',
        cost: 4200,
        price: 5700,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-JACKET-006',
        barcode: '6224000000006',
        name: 'جاكيت بايكر رياضي جلد أسود كلاسيك',
        brand: 'Volar Classic',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-666',
        supplierPrice: 1700,
        assemblyCost: 30,
        externalTransportCost: 30,
        internalTransportCost: 20,
        maintenanceCost: 15,
        otherCosts: 5,
        condition: 'NEW',
        cost: 1800,
        price: 2650,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-SUIT-007',
        barcode: '6224000000007',
        name: 'بدلة سبورت رسمية سليم فيت أزرق ملكي',
        brand: 'Volar Sport',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-777',
        supplierPrice: 4550,
        assemblyCost: 90,
        externalTransportCost: 70,
        internalTransportCost: 40,
        maintenanceCost: 30,
        otherCosts: 20,
        condition: 'NEW',
        cost: 4800,
        price: 6400,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-COAT-008',
        barcode: '6224000000008',
        name: 'معطف ترنش واقي من المطر كحلي فاخر',
        brand: 'Volar Trench',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-888',
        supplierPrice: 2950,
        assemblyCost: 50,
        externalTransportCost: 40,
        internalTransportCost: 20,
        maintenanceCost: 30,
        otherCosts: 10,
        condition: 'NEW',
        cost: 3100,
        price: 4550,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-SUIT-009',
        barcode: '6224000000009',
        name: 'بدلة رجالية صوفية كلاسيكية رمادي كسر زيرو',
        brand: 'Volar Wool',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-101',
        supplierPrice: 8500,
        assemblyCost: 120,
        externalTransportCost: 80,
        internalTransportCost: 40,
        maintenanceCost: 60,
        otherCosts: 20,
        condition: 'USED',
        cost: 8820,
        price: 11800,
        stockQty: 2,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-LEATHER-010',
        barcode: '6224000000010',
        name: 'معطف جلد تمساح فاخر أسود ملكي',
        brand: 'Volar Luxury',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-102',
        supplierPrice: 16500,
        assemblyCost: 200,
        externalTransportCost: 150,
        internalTransportCost: 60,
        maintenanceCost: 120,
        otherCosts: 30,
        condition: 'USED',
        cost: 17060,
        price: 24900,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-SUIT-011',
        barcode: '6224000000011',
        name: 'بدلة زفاف بيضاء فاخرة مطرزة بالكامل',
        brand: 'Volar Wedding',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-103',
        supplierPrice: 14200,
        assemblyCost: 180,
        externalTransportCost: 120,
        internalTransportCost: 50,
        maintenanceCost: 90,
        otherCosts: 20,
        condition: 'NEW',
        cost: 14660,
        price: 21200,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-COAT-012',
        barcode: '6224000000012',
        name: 'جاكيت فرو كشمير طبيعي ناعم أخضر داكن',
        brand: 'Volar Cashmere',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-104',
        supplierPrice: 11500,
        assemblyCost: 150,
        externalTransportCost: 100,
        internalTransportCost: 40,
        maintenanceCost: 80,
        otherCosts: 30,
        condition: 'NEW',
        cost: 11900,
        price: 16200,
        stockQty: 2,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-SUIT-013',
        barcode: '6224000000013',
        name: 'بدلة رجالية صوفية كاروهات رمادي كسر زيرو',
        brand: 'Volar Checks',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-105',
        supplierPrice: 2200,
        assemblyCost: 30,
        externalTransportCost: 25,
        internalTransportCost: 15,
        maintenanceCost: 20,
        otherCosts: 10,
        condition: 'USED',
        cost: 2300,
        price: 3650,
        stockQty: 3,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-SUIT-014',
        barcode: '6224000000014',
        name: 'بدلة كلاسيكية سوداء ملكية بقصة ضيقة',
        brand: 'Volar Fit',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-106',
        supplierPrice: 3200,
        assemblyCost: 60,
        externalTransportCost: 40,
        internalTransportCost: 20,
        maintenanceCost: 30,
        otherCosts: 10,
        condition: 'NEW',
        cost: 3360,
        price: 4800,
        stockQty: 4,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-JACKET-015',
        barcode: '6224000000015',
        name: 'جاكيت بومبر قطيفة ناعم كاجوال رمادي',
        brand: 'Volar Velvet',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-107',
        supplierPrice: 6200,
        assemblyCost: 110,
        externalTransportCost: 70,
        internalTransportCost: 30,
        maintenanceCost: 50,
        otherCosts: 20,
        condition: 'NEW',
        cost: 6480,
        price: 8350,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-SUIT-016',
        barcode: '6224000000016',
        name: 'بدلة كلاسيكية كحلي داكن فاخرة',
        brand: 'Volar Classic',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-108',
        supplierPrice: 1950,
        assemblyCost: 40,
        externalTransportCost: 30,
        internalTransportCost: 20,
        maintenanceCost: 10,
        otherCosts: 10,
        condition: 'NEW',
        cost: 2060,
        price: 2980,
        stockQty: 2,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-COAT-017',
        barcode: '6224000000017',
        name: 'معطف طويل فرو ثعلب أبيض فضي فاخر',
        brand: 'Volar Fur',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-109',
        supplierPrice: 10800,
        assemblyCost: 150,
        externalTransportCost: 100,
        internalTransportCost: 40,
        maintenanceCost: 80,
        otherCosts: 30,
        condition: 'USED',
        cost: 11200,
        price: 14500,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-SUIT-018',
        barcode: '6224000000018',
        name: 'بدلة رجالية صيفية كتان خفيف أبيض',
        brand: 'Volar Linen',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-110',
        supplierPrice: 1600,
        assemblyCost: 30,
        externalTransportCost: 25,
        internalTransportCost: 15,
        maintenanceCost: 10,
        otherCosts: 10,
        condition: 'NEW',
        cost: 1690,
        price: 2550,
        stockQty: 5,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-JACKET-019',
        barcode: '6224000000109',
        name: 'جاكيت مخمل فاخر أحمر خمري للحفلات',
        brand: 'Volar Velvet',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-112',
        supplierPrice: 3400,
        assemblyCost: 70,
        externalTransportCost: 50,
        internalTransportCost: 25,
        maintenanceCost: 40,
        otherCosts: 15,
        condition: 'NEW',
        cost: 3600,
        price: 4900,
        stockQty: 2,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-COAT-020',
        barcode: '6224000000110',
        name: 'معطف شتوي مبطن دافئ بني ملكي',
        brand: 'Volar Winter',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-113',
        supplierPrice: 2600,
        assemblyCost: 50,
        externalTransportCost: 40,
        internalTransportCost: 20,
        maintenanceCost: 20,
        otherCosts: 10,
        condition: 'NEW',
        cost: 2740,
        price: 3950,
        stockQty: 3,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-JACKET-021',
        barcode: '6224000000111',
        name: 'جاكيت جلد طبيعي كاجوال رمادي كسر زيرو',
        brand: 'Volar Casual',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-114',
        supplierPrice: 3150,
        assemblyCost: 60,
        externalTransportCost: 45,
        internalTransportCost: 25,
        maintenanceCost: 35,
        otherCosts: 15,
        condition: 'USED',
        cost: 3330,
        price: 4650,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-JACKET-022',
        barcode: '6224000000112',
        name: 'جاكيت مقاوم للماء شتوي برتقالي فولار',
        brand: 'Volar Active',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-115',
        supplierPrice: 2850,
        assemblyCost: 50,
        externalTransportCost: 35,
        internalTransportCost: 15,
        maintenanceCost: 20,
        otherCosts: 10,
        condition: 'NEW',
        cost: 2980,
        price: 4200,
        stockQty: 4,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-COAT-023',
        barcode: '6224000000113',
        name: 'جاكيت صوفي مبطن كحلي كلاسيك',
        brand: 'Volar Tweed',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-116',
        supplierPrice: 2150,
        assemblyCost: 40,
        externalTransportCost: 30,
        internalTransportCost: 15,
        maintenanceCost: 15,
        otherCosts: 10,
        condition: 'NEW',
        cost: 2260,
        price: 3280,
        stockQty: 2,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'CLO-SUIT-024',
        barcode: '6224000000114',
        name: 'بدلة رجالية توكسيدو مخمل كحلي فاخرة',
        brand: 'Volar Velvet',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEALER-C-117',
        supplierPrice: 3800,
        assemblyCost: 80,
        externalTransportCost: 50,
        internalTransportCost: 25,
        maintenanceCost: 30,
        otherCosts: 15,
        condition: 'NEW',
        cost: 4000,
        price: 5800,
        stockQty: 1,
        isActive: true
      },
      {
        shopId: shop.id,
        categoryId: bikeCategory.id,
        baseUnitOfMeasureId: pieceUnit.id,
        sku: 'BIKE-NOT-FOUND-DEFAULT',
        barcode: '6224999999999',
        name: 'مكنة ليست موجودة',
        brand: 'DEFAULT',
        productType: 'MOTORCYCLE',
        dealerCode: 'DEFAULT',
        supplierPrice: 0,
        assemblyCost: 0,
        externalTransportCost: 0,
        internalTransportCost: 0,
        maintenanceCost: 0,
        otherCosts: 0,
        condition: 'NEW',
        cost: 0,
        price: 0,
        stockQty: 9999,
        isActive: true
      }
    ]
  });

  // Create Branch Expenses
  await prisma.branchExpense.createMany({
    data: [
      {
        shopId: shop.id,
        userId: manager.id,
        category: 'RENT',
        amount: 8000,
        reason: 'إيجار المقر لشهر يونيو ٢٠٢٦',
        recipient: 'صاحب العقار'
      },
      {
        shopId: shop.id,
        userId: manager.id,
        category: 'ELECTRICITY',
        amount: 1450.50,
        reason: 'فاتورة الكهرباء لفرع الزمالك',
        recipient: 'شركة الكهرباء'
      },
      {
        shopId: shop.id,
        userId: cashier.id,
        category: 'TIPS',
        amount: 150,
        reason: 'إكرامية فني التغليف والكي للملابس',
        recipient: 'محمود عامل الكي'
      },
      {
        shopId: shop.id,
        userId: cashier.id,
        category: 'PERSONAL_WITHDRAWAL',
        amount: 2000,
        reason: 'مسحوبات شخصية للمالك مالك محلات فولار',
        recipient: 'المالك مالك محلات فولار'
      },
      {
        shopId: shop.id,
        userId: cashier.id,
        category: 'PENS',
        amount: 85,
        reason: 'شراء أقلام ودبابيس للمكتب والفرع',
        recipient: 'مكتبة الزمالك'
      }
    ]
  });

  // Create Installment Company Dues and Reservations
  const valSale = saleRecords.find((s) => s.paymentMethod === 'فاليو') || saleRecords[0];
  await prisma.installmentCompanyDue.create({
    data: {
      shopId: shop.id,
      saleId: valSale.id,
      companyName: 'فاليو',
      pullDate: ago(3),
      saleDate: ago(3),
      customerName: valSale.customerName || 'عميل افتراضي',
      customerPhone: valSale.customerPhone,
      pullAmount: valSale.totalAmount,
      saleAmount: valSale.totalAmount,
      adminFees: 250,
      dueAmount: Number(valSale.totalAmount) - 250,
      dueDate: future(12),
      isCollected: false
    }
  });

  await prisma.reservation.create({
    data: {
      shopId: shop.id,
      customerName: 'محمد صلاح',
      customerPhone: '+201112223334',
      motorcycleDetails: 'بدلة كلاسيك إيطالية ثلاث قطع سوداء',
      depositAmount: 5000,
      remainingAmount: 28500,
      totalAmount: 33500,
      isCompleted: false
    }
  });

  // Create Traffic Invoices
  const saleForTraffic1 = saleRecords[2];
  await prisma.trafficInvoice.create({
    data: {
      shopId: shop.id,
      saleId: saleForTraffic1.id,
      customerName: saleForTraffic1.customerName || 'عميل افتراضي',
      status: 'PENDING_SEND',
      transportCost: 300,
      cairoReceiptCost: 0,
      deliveryFeeCollected: 0
    }
  });

  const saleForTraffic2 = saleRecords[4];
  await prisma.trafficInvoice.create({
    data: {
      shopId: shop.id,
      saleId: saleForTraffic2.id,
      customerName: saleForTraffic2.customerName || 'عميل افتراضي',
      status: 'IN_TRANSIT',
      transportCost: 300,
      cairoReceiptCost: 500,
      receivedAtCairo: ago(16),
      deliveryFeeCollected: 0
    }
  });

  const saleForTraffic3 = saleRecords[6];
  await prisma.trafficInvoice.create({
    data: {
      shopId: shop.id,
      saleId: saleForTraffic3.id,
      customerName: saleForTraffic3.customerName || 'عميل افتراضي',
      status: 'DELIVERED',
      transportCost: 300,
      cairoReceiptCost: 500,
      receivedAtCairo: ago(22),
      deliveryFeeCollected: 150,
      deliveredToCustomerAt: ago(2)
    }
  });

  // Create Dealer Debts
  await prisma.dealerDebt.createMany({
    data: [
      {
        shopId: shop.id,
        supplierId: suppliers[1].id,
        dealerCode: 'DEALER-C-111',
        totalAmount: 28000,
        paidAmount: 10000,
        remainingDebt: 18000,
        paymentMode: 'DEFERRED',
        notes: 'مشتريات بدلة كلاسيك إيطالية كود ١١١',
        isSettled: false,
        createdAt: ago(4)
      },
      {
        shopId: shop.id,
        supplierId: suppliers[2].id,
        dealerCode: 'DEALER-C-222',
        totalAmount: 25000,
        paidAmount: 0,
        remainingDebt: 25000,
        paymentMode: 'ON_ACCOUNT',
        notes: 'مشتريات جاكيت بايكر جلد تحت الحساب',
        isSettled: false,
        createdAt: ago(6)
      }
    ]
  });

  await prisma.parkedSale.create({ data: { shopId: shop.id, cashierUserId: cashier.id, customerId: customers[0].id, customerName: 'كريم أحمد', customerPhone: customers[0].phone, title: 'طلب عرض أسعار بدلات راقية', quoteReference: 'VO-Q-0001', type: 'QUOTE', notes: 'عرض سعر يشمل بدلة كلاسيك إيطالية سوداء وتنسيق قميص فاخر.', subtotal: 1650, taxAmount: 231, discountAmount: 50, totalAmount: 1831, status: 'HELD', expiresAt: future(5), items: { create: [{ productId: productBySku['VO-001'].id, productName: productBySku['VO-001'].name, qty: 1, unitPrice: productBySku['VO-001'].price, lineTotal: Number(productBySku['VO-001'].price) }] } } });

  await prisma.notification.createMany({ data: [
    { shopId: shop.id, type: NotificationType.LOW_STOCK, title: 'تنبيه عجز مخزون التيشرتات', message: 'وصل تيشرت قطن سادة برتقالي إلى حد إعادة الطلب الأدنى.' },
    { shopId: shop.id, type: NotificationType.DAILY_SUMMARY, title: 'تقرير مبيعات اليوم جاهز', message: 'بلغت مبيعات البدلات والملابس اليومية مستويات ممتازة.' },
    { shopId: shop.id, type: NotificationType.SYSTEM, title: 'جاهزية نظام نقاط البيع لمحلات فولار (Volar)', message: 'تم إعادة تهيئة قاعدة البيانات بنجاح لفرع فولار - الزمالك.' }
  ] });

  await prisma.activityLog.createMany({ data: [
    { shopId: shop.id, userId: owner.id, action: 'SHOP_ONBOARDED', entityType: 'Shop', entityId: shop.id, description: `تم تهيئة وإطلاق فرع ${shop.name} بمجال الملابس الجاهزة والموضة.` },
    { shopId: shop.id, userId: manager.id, action: 'PURCHASE_RECEIVED', entityType: 'PurchaseOrder', entityId: purchase.id, description: `تم استلام شحنة ملابس قطنية من المورد ${purchase.purchaseNumber}.` },
    { shopId: shop.id, userId: manager.id, action: 'SUPPLIER_RETURN_POSTED', entityType: 'SupplierReturn', entityId: supplierReturn.id, description: `إرجاع ملابس معيبة للمورد ${supplierReturn.returnNumber}.` },
    { shopId: shop.id, userId: manager.id, action: 'STOCK_TRANSFER_SENT', entityType: 'StockTransfer', entityId: stockTransfer.id, description: `تحويل تيشرتات صيفية لفرع التجمع ${stockTransfer.transferNumber}.` },
    { shopId: shop.id, userId: cashier.id, action: 'REGISTER_CLOSED', entityType: 'CashSession', entityId: cashSession.id, description: 'إغلاق وردية كاشير محلات فولار وتسجيل العجز.' }
  ] });

  await prisma.authAuditLog.createMany({ data: [
    { userId: owner.id, shopId: shop.id, action: 'LOGIN_SUCCESS', email: owner.email, createdAt: ago(0, 9) },
    { userId: manager.id, shopId: shop.id, action: 'LOGIN_SUCCESS', email: manager.email, createdAt: ago(0, 10) },
    { userId: cashier.id, shopId: shop.id, action: 'LOGIN_SUCCESS', email: cashier.email, createdAt: ago(0, 11) }
  ] });

  await prisma.documentSequence.createMany({ data: [
    { shopId: shop.id, type: DocumentSequenceType.SALE, dateKey: '20260530', value: 45 },
    { shopId: shop.id, type: DocumentSequenceType.RECEIPT, dateKey: '20260530', value: 45 },
    { shopId: shop.id, type: DocumentSequenceType.PURCHASE, dateKey: '20260530', value: 1 },
    { shopId: shop.id, type: DocumentSequenceType.RETURN, dateKey: '20260530', value: 8 },
    { shopId: shop.id, type: DocumentSequenceType.TRANSFER, dateKey: '20260530', value: 1 },
    { shopId: branchShop.id, type: DocumentSequenceType.TRANSFER, dateKey: '20260530', value: 0 }
  ] });

  await prisma.workerJob.createMany({ data: [
    { shopId: shop.id, type: WorkerJobType.LOW_STOCK_SCAN },
    { shopId: shop.id, type: WorkerJobType.DAILY_SUMMARY }
  ] });

  console.log('Seeded Volar POS successfully with clothing dataset');
  console.log('Owner: owner@volar.eg / password123');
  console.log('Manager: manager@volar.eg / password123');
  console.log('Cashier: cashier@volar.eg / password123');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
