const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Marine Invoices, Returns, Tracking, and Drawers in EGP...');

  const shops = await prisma.shop.findMany({ select: { id: true, name: true } });
  if (shops.length === 0) {
    console.error('No shops found.');
    return;
  }

  // Target primary shop
  const targetShop = shops[0];
  const shopId = targetShop.id;
  console.log(`Using Shop: ${targetShop.name} (${shopId})`);

  // Get users
  const cashier = await prisma.user.findFirst({
    where: { memberships: { some: { shopId, role: 'CASHIER' } } }
  }) || await prisma.user.findFirst();

  const manager = await prisma.user.findFirst({
    where: { memberships: { some: { shopId, role: { in: ['MANAGER', 'ADMIN'] } } } }
  }) || cashier;

  if (!cashier || !manager) {
    console.error('Missing required cashier or manager user.');
    return;
  }

  // 1. Ensure Active Cash Session for Today
  let session = await prisma.cashSession.findFirst({
    where: { shopId, closedAt: null }
  });

  const today = new Date();
  today.setHours(8, 30, 0, 0);

  if (!session) {
    session = await prisma.cashSession.create({
      data: {
        shopId,
        userId: cashier.id,
        openedAt: today,
        openingFloat: 5000.00,
        status: 'OPEN',
        notes: 'وردية التموين والخدمات البحرية الصباحية'
      }
    });
    console.log(`+ Created Active Cash Session: #${session.id} (Opening float: 5,000 ج.م)`);
  } else {
    console.log(`* Using Existing Cash Session: #${session.id}`);
  }

  // 2. Shipping Agency Customers
  const agencyData = [
    {
      firstName: 'توكيل ملاحة',
      lastName: 'السويس وبورسعيد',
      businessName: 'شركة توكيل ملاحة السويس وبورسعيد البحرية',
      contactPerson: 'قبطان أحمد فؤاد',
      phone: '+201201112233',
      email: 'suez.agency@seaways-ops.com',
      address: 'مجمع التوكيلات الملاحية، ميناء بورسعيد الرصيف 4'
    },
    {
      firstName: 'توكيل كيمار',
      lastName: 'للملاحة',
      businessName: 'شركة كيمار للملاحة والخدمات البترولية',
      contactPerson: 'مهندس مروان حامد',
      phone: '+201104445566',
      email: 'operations@khemar-shipping.eg',
      address: 'مبنى هيئة الموانئ، الرصيف البترولي بالسويس'
    },
    {
      firstName: 'ميرسك إيجيبت',
      lastName: 'لتموين السفن',
      businessName: 'مجموعة ميرسك إيجيبت للشحن البحري',
      contactPerson: 'أ/ سامح البورسعيدي',
      phone: '+201009998877',
      email: 'provisions@maersk-eg.com',
      address: 'محطة الحاويات الدولية، ميناء دمياط'
    },
    {
      firstName: 'الوكالة العربية',
      lastName: 'للملاحة',
      businessName: 'الوكالة العربية للملاحة والتجارة الدولية',
      contactPerson: 'ربان يوسف النجار',
      phone: '+201223334455',
      email: 'fleet@arab-maritime.com',
      address: 'برج الملاحة، ميناء الإسكندرية'
    },
    {
      firstName: 'أورينت للخدمات',
      lastName: 'البحرية',
      businessName: 'شركة أورينت للخدمات البحرية والأوفشور',
      contactPerson: 'أ/ كريم الملاح',
      phone: '+201015556677',
      email: 'supply@orient-offshore.com',
      address: 'منطقة الغاطس الخارجي، البحر الأحمر'
    }
  ];

  const createdCustomers = [];
  for (const cust of agencyData) {
    let existing = await prisma.customer.findFirst({
      where: { shopId, phone: cust.phone }
    });
    if (!existing) {
      existing = await prisma.customer.create({
        data: {
          shopId,
          type: 'BUSINESS',
          firstName: cust.firstName,
          lastName: cust.lastName,
          businessName: cust.businessName,
          contactPerson: cust.contactPerson,
          phone: cust.phone,
          email: cust.email,
          address: cust.address,
          isActive: true
        }
      });
      console.log(`+ Created Shipping Agency Customer: ${cust.businessName}`);
    }
    createdCustomers.push(existing);
  }

  // 3. Find Marine Products
  const products = await prisma.product.findMany({
    where: { shopId },
    include: { variants: true }
  });

  const getProd = (skuPart) => products.find((p) => p.sku && p.sku.includes(skuPart)) || products[0];

  const prodPotatoes = getProd('PROV-POT');
  const prodBeef = getProd('PROV-BEEF');
  const prodWater = getProd('BEV-WATER');
  const prodLube = getProd('LUBE-MOBIL');
  const prodFilterMan = getProd('ENG-FILT-MAN');
  const prodFilterWar = getProd('ENG-FILT-WAR');
  const prodRope = getProd('DECK-ROPE');
  const prodZinc = getProd('DECK-ZINC');
  const prodSuit = getProd('SAFE-IMMSUIT');
  const prodLifebuoy = getProd('SAFE-LIFEBUOY');
  const prodRice = getProd('PROV-RICE');
  const prodOnions = getProd('PROV-ONI');
  const prodChicken = getProd('PROV-CHICK');

  // 4. Create Ship Supply Orders (Tracking system)
  const supplyOrdersData = [
    {
      orderNumber: 'SSO-20261028-001',
      trackingNumber: 'TRK-ALEX-9412',
      vesselName: 'MV Alexandria Star',
      vesselImo: '9412345',
      berthLocation: 'ميناء الإسكندرية - رصيف 4',
      customer: createdCustomers[0],
      currentStage: 'IN_TRANSIT_TO_BERTH',
      notes: 'شحنة مؤن طازجة ولحوم ومياه شرب مبردة جاهزة للتسليم للربان',
      eta: new Date(Date.now() + 4 * 3600 * 1000),
      items: [
        { itemName: 'بطاطس مصرية طازجة فرز أول (Fresh Potatoes)', quantity: 15, unit: 'شكارة 25 كجم', unitPrice: 650.00 },
        { itemName: 'لحم بقري مجمد برازيلي (Frozen Beef)', quantity: 4, unit: 'كرتونة 20 كجم', unitPrice: 6400.00 },
        { itemName: 'مياه شرب معبأة نقية (Mineral Water)', quantity: 30, unit: 'طرد 12×1.5 لتر', unitPrice: 145.00 }
      ]
    },
    {
      orderNumber: 'SSO-20261028-002',
      trackingNumber: 'TRK-SUEZ-9387',
      vesselName: 'MT Red Sea Pioneer',
      vesselImo: '9387654',
      berthLocation: 'ميناء السويس - رصيف ناقلات البترول 2',
      customer: createdCustomers[1],
      currentStage: 'WAREHOUSE_PREPARATION',
      notes: 'تجهيز براميل زيوت المحركات وفلاتر الديزل للمعاينة البحرية',
      eta: new Date(Date.now() + 12 * 3600 * 1000),
      items: [
        { itemName: 'زيت محركات بحرية موبيل جارد Mobilgard 412', quantity: 2, unit: 'برميل 208 لتر', unitPrice: 37200.00 },
        { itemName: 'فلاتر زيت ديزل بحري MAN B&W 32/40', quantity: 4, unit: 'طقم فلتر', unitPrice: 4750.00 }
      ]
    },
    {
      orderNumber: 'SSO-20261028-003',
      trackingNumber: 'TRK-PORT-9554',
      vesselName: 'MV Mediterranean Sky',
      vesselImo: '9554321',
      berthLocation: 'ميناء شرق بورسعيد - محطة الحاويات',
      customer: createdCustomers[3],
      currentStage: 'PORT_CUSTOMS_CLEARANCE',
      notes: 'جاري استخراج تصاريح الجمارك البحرية لدخول حبال الرباط والزنك',
      eta: new Date(Date.now() + 8 * 3600 * 1000),
      items: [
        { itemName: 'حبل رباط بولي بروبلين 8 جدائل قطر 40 مم', quantity: 1, unit: 'لفة 220 متر', unitPrice: 20500.00 },
        { itemName: 'زنك حماية كاثودية للبدن مانع للصدأ 10 كجم', quantity: 6, unit: 'قالب معيار', unitPrice: 2650.00 }
      ]
    },
    {
      orderNumber: 'SSO-20261028-004',
      trackingNumber: 'TRK-DAMI-9678',
      vesselName: 'CMA CGM Nile',
      vesselImo: '9678123',
      berthLocation: 'ميناء دمياط - رصيف 7 للبضائع العامة',
      customer: createdCustomers[2],
      currentStage: 'EXTERNAL_PROCUREMENT',
      notes: 'أمر توريد مهمات السلامة وبدل الغمر SOLAS معتمدة من هيئة السلامة البحرية',
      eta: new Date(Date.now() + 24 * 3600 * 1000),
      items: [
        { itemName: 'بدلة غمر حرارية نيوبرين معتمدة SOLAS', quantity: 3, unit: 'طقم كامل', unitPrice: 7950.00 },
        { itemName: 'أطواق نجاة صلبة مع حبل 30م وشريط عاكس', quantity: 4, unit: 'طوق معتمد', unitPrice: 2150.00 },
        { itemName: 'أرز مصري أبيض فاخر شكائر 25 كجم', quantity: 6, unit: 'شكارة 25 كجم', unitPrice: 990.00 }
      ]
    },
    {
      orderNumber: 'SSO-20261028-005',
      trackingNumber: 'TRK-ANCH-9234',
      vesselName: 'MV Nile Voyager',
      vesselImo: '9234567',
      berthLocation: 'غاطس السويس الخارجي - منطقة المخطاف B',
      customer: createdCustomers[4],
      currentStage: 'DELIVERED_TO_VESSEL',
      notes: 'تم التسليم بنجاح بلنش الخدمة البحرية وتوقيع الربان على إشعار الاستلام',
      eta: new Date(Date.now() - 6 * 3600 * 1000),
      items: [
        { itemName: 'بصل أحمر مصري فاخر شكائر 25 كجم', quantity: 8, unit: 'شكارة 25 كجم', unitPrice: 720.00 },
        { itemName: 'مياه شرب معبأة نقية كراتين 12×1.5 لتر', quantity: 25, unit: 'طرد 12 عبوة', unitPrice: 145.00 },
        { itemName: 'دواجن كاملة مجمدة سيرا 12 كجم', quantity: 4, unit: 'كرتونة 12 كجم', unitPrice: 2200.00 }
      ]
    }
  ];

  for (const sso of supplyOrdersData) {
    const existing = await prisma.shipSupplyOrder.findUnique({
      where: { trackingNumber: sso.trackingNumber }
    });
    if (!existing) {
      const total = sso.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      await prisma.shipSupplyOrder.create({
        data: {
          shopId,
          orderNumber: sso.orderNumber,
          trackingNumber: sso.trackingNumber,
          vesselName: sso.vesselName,
          vesselImo: sso.vesselImo,
          berthLocation: sso.berthLocation,
          customerId: sso.customer.id,
          customerName: sso.customer.businessName || sso.customer.firstName,
          customerPhone: sso.customer.phone,
          customerEmail: sso.customer.email,
          currentStage: sso.currentStage,
          notes: sso.notes,
          eta: sso.eta,
          totalAmount: total,
          coordinatorId: manager.id,
          items: {
            create: sso.items.map((i) => ({
              itemName: i.itemName,
              quantity: i.quantity,
              unit: i.unit,
              unitPrice: i.unitPrice
            }))
          },
          stageLogs: {
            create: {
              toStage: sso.currentStage,
              performedById: manager.id,
              notes: `تم إنشاء وتحديث مسار طلب التموين إلى ${sso.currentStage}`
            }
          }
        }
      });
      console.log(`+ Created Ship Supply Order: ${sso.orderNumber} - ${sso.vesselName} (${sso.trackingNumber})`);
    }
  }

  // 5. Create Completed Invoices (Sales) for Today with realistic payments
  const salesToCreate = [
    {
      saleNumber: 'SEAWAYS-INV-20261028-001',
      receiptNumber: 'REC-1028-001',
      customer: createdCustomers[0],
      customerName: 'شركة توكيل ملاحة السويس (السفينة MV Alexandria Star)',
      date: new Date(Date.now() - 3.5 * 3600 * 1000),
      items: [
        { product: prodPotatoes, qty: 15, price: 650.00 },
        { product: prodBeef, qty: 4, price: 6400.00 },
        { product: prodWater, qty: 30, price: 145.00 }
      ],
      paymentMethod: 'انستا باي',
      payments: [
        { method: 'انستا باي', amount: 39700.00, drawerType: 'INSTAPAY', referenceNumber: 'INSTA-882190' }
      ]
    },
    {
      saleNumber: 'SEAWAYS-INV-20261028-002',
      receiptNumber: 'REC-1028-002',
      customer: createdCustomers[1],
      customerName: 'شركة البحر الأحمر للتوكيلات (الناقلة MT Red Sea Pioneer)',
      date: new Date(Date.now() - 2.5 * 3600 * 1000),
      items: [
        { product: prodLube, qty: 2, price: 37200.00 },
        { product: prodFilterMan, qty: 4, price: 4750.00 }
      ],
      paymentMethod: 'كاش / انستا باي',
      payments: [
        { method: 'كاش', amount: 20000.00, drawerType: 'CASH' },
        { method: 'انستا باي', amount: 73400.00, drawerType: 'INSTAPAY', referenceNumber: 'INSTA-991201' }
      ]
    },
    {
      saleNumber: 'SEAWAYS-INV-20261028-003',
      receiptNumber: 'REC-1028-003',
      customer: createdCustomers[3],
      customerName: 'الوكالة العربية للملاحة (السفينة MV Mediterranean Sky)',
      date: new Date(Date.now() - 1.8 * 3600 * 1000),
      items: [
        { product: prodRope, qty: 1, price: 20500.00 },
        { product: prodZinc, qty: 6, price: 2650.00 }
      ],
      paymentMethod: 'محفظه الكترونيه',
      payments: [
        { method: 'محفظه الكترونيه', amount: 36400.00, drawerType: 'WALLET', referenceNumber: 'WALLET-771829' }
      ]
    },
    {
      saleNumber: 'SEAWAYS-INV-20261028-004',
      receiptNumber: 'REC-1028-004',
      customer: createdCustomers[2],
      customerName: 'مجموعة ميرسك إيجيبت (السفينة CMA CGM Nile)',
      date: new Date(Date.now() - 1.1 * 3600 * 1000),
      items: [
        { product: prodSuit, qty: 3, price: 7950.00 },
        { product: prodLifebuoy, qty: 4, price: 2150.00 },
        { product: prodRice, qty: 6, price: 990.00 }
      ],
      paymentMethod: 'فيزا',
      payments: [
        { method: 'فيزا', amount: 38390.00, referenceNumber: 'VISA-AUTH-6512' }
      ]
    },
    {
      saleNumber: 'SEAWAYS-INV-20261028-005',
      receiptNumber: 'REC-1028-005',
      customer: createdCustomers[4],
      customerName: 'شركة أورينت للخدمات البحرية (السفينة MV Nile Voyager)',
      date: new Date(Date.now() - 0.4 * 3600 * 1000),
      items: [
        { product: prodOnions, qty: 8, price: 720.00 },
        { product: prodWater, qty: 25, price: 145.00 },
        { product: prodChicken, qty: 4, price: 2200.00 }
      ],
      paymentMethod: 'كاش',
      payments: [
        { method: 'كاش', amount: 18185.00, drawerType: 'CASH' }
      ]
    }
  ];

  const createdSales = [];
  for (const s of salesToCreate) {
    let existingSale = await prisma.sale.findFirst({
      where: { shopId, saleNumber: s.saleNumber }
    });

    const subtotal = s.items.reduce((acc, item) => acc + item.qty * item.price, 0);

    if (!existingSale) {
      existingSale = await prisma.sale.create({
        data: {
          shopId,
          cashierUserId: cashier.id,
          customerId: s.customer.id,
          customerName: s.customerName,
          customerPhone: s.customer.phone,
          saleNumber: s.saleNumber,
          receiptNumber: s.receiptNumber,
          status: 'COMPLETED',
          subtotal,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: subtotal,
          changeDue: 0,
          paymentMethod: s.paymentMethod,
          cashierName: cashier.name,
          createdAt: s.date,
          items: {
            create: s.items.map((i) => ({
              productId: i.product.id,
              productVariantId: i.product.variants?.[0]?.id || null,
              productName: i.product.name,
              variantLabel: i.product.variants?.[0]?.size || 'مواصفة بحرية قياسية',
              qty: i.qty,
              unitPrice: i.price,
              lineTotal: i.qty * i.price
            }))
          },
          payments: {
            create: s.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              referenceNumber: p.referenceNumber || null,
              drawerType: p.drawerType || null,
              createdAt: s.date
            }))
          }
        },
        include: { items: true, payments: true }
      });
      console.log(`+ Created Marine Invoice: ${s.saleNumber} (${subtotal.toLocaleString('ar-EG')} ج.م)`);
    }
    createdSales.push(existingSale);
  }

  // 6. Create Realistic Returns (SaleAdjustments & RefundPayments)
  const returnAdjustments = [
    {
      adjustmentNumber: 'SEAWAYS-RET-20261028-001',
      sale: createdSales[0], // Linked to Sale 1
      reason: 'طلب ربان الباخرة تقليص كمية اللحم المجمد نظراً لامتلاء ثلاجة التجميد رقم 2',
      returnedItemIndex: 1, // Beef
      returnedQty: 1,
      unitPrice: 6400.00,
      refundMethod: 'انستا باي',
      drawer: 'INSTAPAY',
      refNum: 'REF-INSTA-01'
    },
    {
      adjustmentNumber: 'SEAWAYS-RET-20261028-002',
      sale: createdSales[1], // Linked to Sale 2
      reason: 'استرجاع فلتر زيت محرك مان B&W لتعديل الموديل المطلوب من قبل كبير المهندسين',
      returnedItemIndex: 1, // Filter MAN
      returnedQty: 1,
      unitPrice: 4750.00,
      refundMethod: 'كاش',
      drawer: 'CASH',
      refNum: null
    }
  ];

  for (const ret of returnAdjustments) {
    if (!ret.sale) continue;
    const existingAdj = await prisma.saleAdjustment.findFirst({
      where: { shopId, adjustmentNumber: ret.adjustmentNumber }
    });

    if (!existingAdj) {
      const saleItem = ret.sale.items[ret.returnedItemIndex] || ret.sale.items[0];
      const totalAmount = ret.returnedQty * ret.unitPrice;

      const createdAdj = await prisma.saleAdjustment.create({
        data: {
          shopId,
          saleId: ret.sale.id,
          adjustmentNumber: ret.adjustmentNumber,
          type: 'REFUND',
          reason: ret.reason,
          notes: 'تم فحص الصنف والتأكد من سلامة التغليف البحري وإعادته للمخزن',
          subtotal: totalAmount,
          totalAmount,
          createdByUserId: cashier.id,
          approvedByUserId: manager.id,
          createdAt: new Date(Date.now() - 45 * 60 * 1000),
          items: {
            create: {
              saleItemId: saleItem.id,
              productId: saleItem.productId,
              itemType: 'RETURN',
              productName: saleItem.productName,
              qty: ret.returnedQty,
              unitPrice: ret.unitPrice,
              lineTotal: totalAmount,
              disposition: 'RESTOCK'
            }
          },
          refundPayments: {
            create: {
              method: ret.refundMethod,
              amount: totalAmount,
              referenceNumber: ret.refNum,
              createdAt: new Date(Date.now() - 45 * 60 * 1000)
            }
          }
        }
      });

      // Register Cash Movement in Session Drawer
      await prisma.cashMovement.create({
        data: {
          shopId,
          cashSessionId: session.id,
          type: 'PAYOUT',
          amount: totalAmount,
          note: `استرداد مالي لمرتجع ${ret.adjustmentNumber} (${saleItem.productName})`,
          drawer: ret.drawer,
          createdByUserId: cashier.id,
          createdAt: new Date(Date.now() - 45 * 60 * 1000)
        }
      });

      console.log(`+ Created Marine Return: ${ret.adjustmentNumber} (${totalAmount.toLocaleString('ar-EG')} ج.م) via ${ret.refundMethod}`);
    }
  }

  // 7. Create Operational Port Expenses (Tied into Daily Drawer Log)
  const expensesData = [
    {
      category: 'MISCELLANEOUS',
      amount: 450.00,
      reason: 'رسوم تصاريح أمنية وبطاقات دخول رصيف الميناء للشاحنة',
      recipient: 'إدارة أمن موانئ بورسعيد',
      drawer: 'CASH'
    },
    {
      category: 'TIPS',
      amount: 350.00,
      reason: 'إكرامية عمال التعتيق والتحميل على رصيف السفينة',
      recipient: 'المعلم صبحي وطاقم التحميل',
      drawer: 'CASH'
    },
    {
      category: 'MISCELLANEOUS',
      amount: 1500.00,
      reason: 'نولون سيارة نقل مبردة لنقل اللحوم والمؤن للغاطس الخارجي',
      recipient: 'شركة الإسكندرية للنقل المبرد',
      drawer: 'INSTAPAY'
    }
  ];

  for (const exp of expensesData) {
    const existingExp = await prisma.branchExpense.findFirst({
      where: { shopId, reason: exp.reason }
    });

    if (!existingExp) {
      await prisma.branchExpense.create({
        data: {
          shopId,
          userId: cashier.id,
          category: exp.category,
          amount: exp.amount,
          reason: exp.reason,
          recipient: exp.recipient,
          drawer: exp.drawer,
          createdAt: new Date(Date.now() - 2 * 3600 * 1000)
        }
      });

      await prisma.cashMovement.create({
        data: {
          shopId,
          cashSessionId: session.id,
          type: 'PAYOUT',
          amount: exp.amount,
          note: `${exp.reason} - المستلم: ${exp.recipient}`,
          drawer: exp.drawer,
          createdByUserId: cashier.id,
          createdAt: new Date(Date.now() - 2 * 3600 * 1000)
        }
      });

      console.log(`+ Created Port Expense: ${exp.reason} (${exp.amount} ج.م) [${exp.drawer}]`);
    }
  }

  console.log('Seeding of Invoices, Returns, and Daily Register completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error in seeding script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
