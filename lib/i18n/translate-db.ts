import { getActiveLocale } from './request-locale';
import type { Locale } from './locales';

export function localizeDatabaseText(text: string | null | undefined, locale?: Locale | string): string {
  if (!text) return '';
  const activeLocale = locale || getActiveLocale();
  if (activeLocale !== 'en') return text;

  const translations: Record<string, string> = {
    // Categories
    'قهوة ساخنة': 'Hot Coffee',
    'قهوة باردة': 'Cold Coffee',
    'مشروبات باردة': 'Cold Drinks',
    'مخبوزات': 'Bakery',
    'ساندويتشات': 'Sandwiches',
    'حلويات': 'Desserts',
    'فطار': 'Breakfast',
    'كومبو': 'Combos',
    'إضافات وصوص': 'Add-ons & Sauces',
    'خامات تشغيل': 'Raw Materials',
    'قائمة مختصرة': 'Short Menu',

    // Products - Hot Coffee
    'إسبريسو': 'Espresso',
    'أمريكانو': 'Americano',
    'كابتشينو': 'Cappuccino',
    'لاتيه': 'Latte',
    'فلات وايت': 'Flat White',
    'موكا': 'Mocha',
    'كورتادو': 'Cortado',
    'قهوة تركي': 'Turkish Coffee',

    // Products - Cold Coffee
    'آيس لاتيه': 'Iced Latte',
    'آيس أمريكانو': 'Iced Americano',
    'كولد برو': 'Cold Brew',
    'فرابيه كراميل': 'Caramel Frappe',
    'آيس موكا': 'Iced Mocha',
    'سبانش لاتيه بارد': 'Iced Spanish Latte',
    'قهوة تونيك': 'Espresso Tonic',
    'كولد برو فانيليا': 'Vanilla Cold Brew',

    // Products - Cold Drinks
    'ليمون نعناع': 'Mint Lemonade',
    'عصير برتقال': 'Orange Juice',
    'سموثي فراولة': 'Strawberry Smoothie',
    'سموثي مانجو': 'Mango Smoothie',
    'شاي مثلج خوخ': 'Peach Ice Tea',
    'مياه معدنية': 'Mineral Water',
    'صودا تفاح': 'Apple Soda',
    'هيبسكس بارد': 'Iced Hibiscus',

    // Products - Bakery
    'كرواسون سادة': 'Plain Croissant',
    'كرواسون جبنة': 'Cheese Croissant',
    'دنش قرفة': 'Cinnamon Danish',
    'مافن شوكولاتة': 'Chocolate Muffin',
    'كوكيز شوفان': 'Oat Cookies',
    'باتيه زيتون': 'Olive Paté',
    'سينابون': 'Cinnabon',
    'بريوش عسل': 'Honey Brioche',

    // Products - Sandwiches
    'كلوب ساندويتش': 'Club Sandwich',
    'تونة ميلت': 'Tuna Melt',
    'دجاج سيزر': 'Chicken Caesar',
    'جبنة حلوم': 'Halloumi Cheese',
    'تركي مدخن': 'Smoked Turkey',
    'بيض أفوكادو': 'Avocado Egg',
    'روست بيف': 'Roast Beef',
    'خضار مشوي': 'Grilled Vegetables',

    // Products - Desserts
    'تشيز كيك توت': 'Blueberry Cheesecake',
    'براونيز': 'Brownies',
    'كيك تمر': 'Date Cake',
    'تيراميسو': 'Tiramisu',
    'بان كيك ميني': 'Mini Pancakes',
    'وافل شوكولاتة': 'Chocolate Waffle',
    'بودنج كراميل': 'Caramel Pudding',
    'كيك لوتس': 'Lotus Cake',

    // Products - Breakfast
    'فطار أزرق': 'Azraq Breakfast',
    'أومليت جبنة': 'Cheese Omelette',
    'جرانولا زبادي': 'Granola Yogurt',
    'فول بالطحينة': 'Foul with Tahini',
    'بيض بينديكت': 'Eggs Benedict',
    'توست أفوكادو': 'Avocado Toast',
    'شكشوكة': 'Shakshuka',
    'طبق فطير صغير': 'Small Feteer Plate',

    // Products - Combos
    'كومبو لاتيه وكرواسون': 'Latte & Croissant Combo',
    'كومبو فطار فردي': 'Single Breakfast Combo',
    'كومبو اجتماع ٤ أفراد': '4-Person Meeting Combo',
    'كومبو ساندويتش ومشروب': 'Sandwich & Drink Combo',
    'كومبو حلو وقهوة': 'Dessert & Coffee Combo',
    'كومبو أطفال': 'Kids Combo',
    'كومبو عمل سريع': 'Quick Work Combo',
    'كومبو نهاية الأسبوع': 'Weekend Combo',

    // Products - Add-ons
    'شوت إسبريسو إضافي': 'Extra Espresso Shot',
    'لبن لوز': 'Almond Milk',
    'لبن شوفان': 'Oat Milk',
    'صوص كراميل': 'Caramel Sauce',
    'صوص شوكولاتة': 'Chocolate Sauce',
    'كريمة إضافية': 'Extra Cream',
    'جبنة إضافية': 'Extra Cheese',
    'بطاطس جانبية': 'Side Fries',

    // Products - Raw Materials
    'بن أزرق ١ كجم': 'Azraq Coffee Beans 1kg',
    'أكواب ورق ١٠٠': 'Paper Cups (100pcs)',
    'شفاطات ورق': 'Paper Straws',
    'علب ساندويتش': 'Sandwich Boxes',
    'مناديل طاولة': 'Table Napkins',
    'سكر ستيك': 'Sugar Sticks',
    'أكياس تيك أواي': 'Takeaway Bags',
    'عبوات صوص': 'Sauce Cups',

    // Suppliers
    'محمصة النيل المختصة': 'Nile Specialty Roastery',
    'مخبوزات القاهرة الجديدة': 'New Cairo Bakery',
    'ألبان الدلتا': 'Delta Dairy',
    'فريش فروت مصر': 'Fresh Fruit Egypt',
    'مشروبات العاصمة': 'Capital Beverages',
    'تجهيزات كافيه برو': 'Cafe Pro Supplies',
    'سوق الخضار اليومي': 'Daily Vegetable Market',
    'حلواني أزرق': 'Azraq Desserts',
    
    // Supplier Contact Names
    'أحمد عبدالعزيز': 'Ahmed Abdelaziz',
    'سارة نبيل': 'Sara Nabil',
    'محموز عادل': 'Mahmoud Adel',
    'محمود عادل': 'Mahmoud Adel',
    'نهى سمير': 'Noha Samir',
    'كريم فؤاد': 'Karim Fouad',
    'ليلى حمدي': 'Layla Hamdy',
    'حسن مصطفى': 'Hassan Mostafa',
    'دينا عماد': 'Dina Emad',

    // Customers
    'عمر': 'Omar',
    'سليم': 'Selim',
    'مريم': 'Mariam',
    'حسن': 'Hassan',
    'ليلى': 'Layla',
    'كمال': 'Kamal',
    'يوسف': 'Youssef',
    'نادر': 'Nader',
    'ملك': 'Malak',
    'أشرف': 'Ashraf',
    'آدم': 'Adam',
    'ماهر': 'Maher',
    'نور': 'Nour',
    'شريف': 'Sherif',
    'هنا': 'Hana',
    'طارق': 'Tarek',
    'سيف': 'Seif',
    'مراد': 'Morad',
    'عادل الكابتن - الزمالك': 'Adel El Captain - Zamalek',
    'عادل الكابتن - التجمع': 'Adel El Captain - New Cairo',
    'شركة عادل الكابتن للموتوسيكلات': 'Adel El Captain Motorcycles Co.',
    'شركة وسط البلد للتصميم': 'Downtown Design Co.',
    'مساحة عمل كايرو هب': 'Cairo Hub Workspace',
    'استوديو النيل': 'Nile Studio',

    // Payment Methods
    'كاش': 'Cash',
    'فيزا': 'Visa',
    'مايلو': 'Maylo',
    'فاليو': 'valU',
    'امان': 'Aman',
    'محفظه الكترونيه': 'E-Wallet',
    'إنستاباي': 'Instapay',
    'فودافون كاش': 'Vodafone Cash',
    'ائتمان عميل': 'Customer Credit',
    'تحويل بنكي': 'Bank Transfer',

    // Stock Count Titles
    'فرق جرد بسيط': 'Minor count variance',
    'إغلاق درج مع فرق بسيط في الديمو.': 'Drawer close with minor demo variance.',
    'توريد نقدية للخزنة': 'Cash drop to safe',
    'مصاريف مشتريات عاجلة': 'Urgent purchases expenses',

    // Notifications & Logs
    'منتجات تحتاج توريد': 'Products needing replenishment',
    'بعض منتجات القهوة الباردة اقتربت من حد إعادة الطلب.': 'Some cold coffee products are near the reorder point.',
    'ملخص اليوم جاهز': 'Daily summary is ready',
    'راجع المبيعات والمرتجعات وجلسة الدرج الأخيرة.': 'Review sales, returns, and the latest drawer session.',
    'ديمو أزرق مكتمل': 'Azraq demo completed',
    'تم تجهيز بيانات المطعم والكافيه للتجربة.': 'Restaurant and cafe demo data has been prepared.',
    
    // Variant Values
    'كبير': 'Large',
    'فانيليا': 'Vanilla',
    'بدون سكر': 'Sugar Free',
    
    // Actions / Audit Log
    'إلغاء فاتورة بطلب المشرف': 'Voided sale by supervisor request',
    'مرتجع عميل بعد مراجعة الإيصال': 'Customer refund after receipt review',
    'تلف في بعض عبوات المخبوزات': 'Damaged packaging from supplier',
    'تم رد ٦ قطع بسبب تلف التغليف عند الاستلام.': 'Returned 6 units due to damaged packaging on receipt.',
    'رد مورد لديمو أزرق': 'Supplier return for Azraq demo',
    'بيع من ديمو أزرق': 'Sale from Azraq demo',
    'عملية بيع واقعية ضمن ديمو أزرق.': 'Realistic sale transaction in Azraq demo.',
    'تم رد المنتج للمخزون.': 'Restocked item back to inventory.',
    'تم تصنيف المنتج كتالف ولا يرجع للمخزون.': 'Item classified as damaged; not restocked.',
    'إرجاع مخزون من مرتجع عميل': 'Returned stock from customer refund',
    'تحويل منتجات قهوة سريعة الحركة لفرع التجمع.': 'Transfer fast-moving coffee products to New Cairo.',
    'تحويل فرع': 'Branch transfer',
    'استلام تحويل فرع': 'Branch transfer received',
    'جرد أسبوعي لقسم المشروبات': 'Weekly beverage inventory count',
    'جرد تجريبي مع فروقات بسيطة.': 'Demo stock take with minor variances.',
    'فرق جرد ديمو': 'Demo count variance',
    'إغلاق درج ديمو أزرق.': 'Closed Azraq demo cash drawer.'
  };

  if (translations[text]) {
    return translations[text];
  }

  if (text.startsWith('تم تجهيز ')) {
    return text
      .replace('تم تجهيز ', 'Prepared ')
      .replace('عادل الكابتن - الزمالك', 'Adel El Captain - Zamalek')
      .replace('عادل الكابتن - التجمع', 'Adel El Captain - New Cairo')
      .replace('أزرق كافيه - الزمالك', 'Azraq Cafe - Zamalek')
      .replace('أزرق كافيه - التجمع', 'Azraq Cafe - New Cairo');
  }
  if (text.includes('ضمن ديمو أزرق كافيه.')) {
    return text.replace(/ضمن ديمو أزرق كافيه\./g, 'as part of the Azraq Cafe demo.');
  }
  if (text.startsWith('تم استلام أمر الشراء ')) {
    return text.replace('تم استلام أمر الشراء ', 'Received purchase order ');
  }
  if (text.startsWith('تم تسجيل رد مورد ')) {
    return text.replace('تم تسجيل رد مورد ', 'Registered supplier return ');
  }
  if (text.startsWith('تم تحويل مخزون ')) {
    return text.replace('تم تحويل مخزون ', 'Transferred inventory ');
  }
  if (text.startsWith('نقاط من فاتورة ')) {
    return text.replace('نقاط من فاتورة ', 'Points from receipt ');
  }

  return text;
}
