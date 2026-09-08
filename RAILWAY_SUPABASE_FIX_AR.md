# إصلاح مزامنة Supabase على Railway

## متغيرات Railway المطلوبة
ضع هذه المتغيرات في **Variables** الخاصة بالخدمة ثم اعمل **Redeploy**:

- `SUPABASE_URL` = رابط مشروع Supabase
- `SUPABASE_PUBLISHABLE_KEY` = المفتاح Publishable فقط
- `SUPABASE_AUTH_EMAIL` = `admin@ifc.academy` (أو بريد مستخدم Auth الفعلي)

لا تستخدم `VITE_` في أسماء المتغيرات. Vite يقرأ المتغيرات في وقت البناء عبر `vite.config.ts` ويضع القيم العامة فقط داخل التطبيق.

## ممنوع
`SUPABASE_SECRET_KEY` لا يوضع في React أو Vite أو `.env` أو GitHub أو EXE. المفتاح السري الذي تم إرساله في المحادثة يعتبر مكشوفًا ويجب تدويره/إلغاؤه من Supabase Dashboard.

## Supabase SQL
يجب تنفيذ الملف:
`supabase/migrations/001_ifc_academy_cloud_sync.sql`
مرة واحدة داخل Supabase SQL Editor. وجود الملف داخل المشروع وحده لا ينشئ الجدول.

## بعد Redeploy
1. افتح الموقع من Railway.
2. سجّل الدخول بحساب Supabase/Auth.
3. أضف أو عدّل بيانات.
4. استخدم زر المزامنة إن وجد، أو انتظر دورة المزامنة التلقائية.
5. افحص جدول `public.academy_cloud_state` في Supabase.

إذا لم يظهر الصف `id = 1` بعد تسجيل الدخول، راجع تنفيذ الـ SQL وRLS وحساب Auth.
