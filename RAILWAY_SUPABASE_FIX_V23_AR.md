# إصلاح مزامنة Supabase — V23

تم تعديل التطبيق ليقرأ إعدادات Supabase من متغيرات Railway التالية:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_AUTH_EMAIL`

ويظل دعم `VITE_SUPABASE_*` موجودًا كـ fallback للتوافق مع التشغيل المحلي القديم.

## مهم
`SUPABASE_SECRET_KEY` لا يوضع في React أو Vite أو EXE أو GitHub. يجب تدويره إذا تم كشفه.

## جدول academy_cloud_state
شغّل migration:
`supabase/migrations/001_ifc_academy_cloud_sync.sql`

ثم تأكد أن المستخدم `admin@ifc.academy` موجود في Supabase Authentication وأنه يستطيع تسجيل الدخول.

## المزامنة
بعد تسجيل الدخول أونلاين، التطبيق يرفع snapshot إلى `academy_cloud_state` ويستمر في المزامنة تلقائيًا عند تعديل البيانات وعودة الإنترنت.
