# نشر Vertex-POS (دليل سريع)

هذا الدليل يشرح كيفية إعداد المشروع للعمل مع قاعدة بيانات مستضافة (online) وتشغيل المايجريشن والسييد ثم نشر التطبيق.

ملاحظة: التعليمات بالعربية لتسهيل التنفيذ.

1) إنشاء قاعدة بيانات مستضافة
- أنسب الحلال السريعة: Supabase, Railway, Neon, Heroku Postgres.
- أنشئ مشروع Postgres واحصل على `DATABASE_URL` بصيغة:
  postgresql://USER:PASS@HOST:PORT/DATABASE?schema=public

2) إعداد المتغيرات البيئية
- في لوحة الـ hosting (Vercel أو مشابه) أو على الخادم، عيّن المتغيرات:
  - `DATABASE_URL` → السلسلة من مزود DB
  - `AUTH_SECRET` → قيمة سرية طويلة وعشوائية
  - `APP_URL` → عنوان النطاق العام (مثلاً https://my-pos.example)
  - `AUTH_TRUST_HOST` → `true` (حسب الحاجة)
  - إعدادات SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM_ADDRESS`

3) تشغيل المراحل محلياً أو على CI ضد الـ DB المستضاف
- على جهازك أو على CI تأكد من أن `DATABASE_URL` مضبوطة.

أوامر موصى بها (نسخ/لصق):

```bash
# توليد عميل بريزما
npm run prisma:generate

# تشغيل المايجريشن (local dev)
# لو تستخدم ملفات migrations المحلية
npm run prisma:migrate

# لو بيئة مُدارة وتدعم prisma deploy (بدون خلق migration محلي)
npm run prisma:deploy

# تشغيل السكريبت لعمل seeding
npm run seed
```

4) نشر التطبيق (Vercel مثال)
- اربط المستودع بـ Vercel.
- في Settings > Environment Variables أضف المتغيرات من الخطوة (2) للبيئات `Preview` و`Production`.
- اضبط Build Command: `npm run build` و Output Directory: (Next.js App Router يستخدم `.next` تلقائياً).
- بعد النشر، شغّل السكريبت التالي على بيئة الإنتاج أو استخدم Console/SSH لتنفيذ المايجريت والسييد. تأكد أن `DATABASE_URL` مضبوطة في متغيرات Vercel.

5) تشغيل الـ worker
- خيارات:
  - نشر worker كخدمة منفصلة على نفس مزود الـ hosting (مثلاً Deploy on a separate Vercel project or Fly/Render)
  - تشغيله على VPS مع process manager مثل `pm2` أو systemd
- لتشغيل محلي: `npm run worker` أو `npm run worker:once` لفحص دورة واحدة.

6) تحقق وsmoke tests
- افتح التطبيق على `APP_URL` وسجل دخول بأحد حسابات السييد (الـ seed يطبع بيانات المستخدمين لو متاحة).
- راجع صفحات: `/dashboard`, `/checkout`, `/inventory`, `/stock-counts`, `/sales`.

7) سكريبت مساعدة لتشغيل المايجريت والسييد على Remote DB
- تم تضمين سكريبت في `scripts/remote_seed.sh`.


---

أسئلة سريعة بعد تنفيذك لهذه الخطوات: هل تفضل نشر على Vercel أم تريد سكريبت نشر كامل على VPS (Ubuntu + PM2)؟
