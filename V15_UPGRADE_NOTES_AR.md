# IFC Academy V15 — System Infrastructure Upgrade

تم بناء V15 فوق V14 بدون إزالة بنية Windows/Tauri أو SQLite أو Railway/Supabase.

## تم تنفيذه
- سرعة واستقرار: request IDs، منع الطلبات المكررة، فحوصات صحة النظام، وفهارس Supabase.
- Sync: كل عملية Offline لها ID ثابت، وتظل في Queue حتى نجاحها أو تسجيل تعارضها.
- UUID/IDs ثابتة للكيانات الموجودة، مع دعم idempotency على Railway.
- Trash حقيقي للاعبين والمدربين والمدفوعات والمصروفات والأرشيف: استرجاع أو حذف نهائي.
- Audit log مركزي للعمليات.
- تقرير API بين تاريخين مع إجماليات الدخل والمصروفات والصافي والحضور.
- مركز صحة النظام داخل Settings: Supabase، Sync Queue، Trash، وآخر العمليات.
- Excel bulk API الموجود في V14 محفوظ، مع حدود دفعات مناسبة.
- إصلاح حساب نهاية الاشتراك: 31 يناير + شهر = 28/29 فبراير، وليس 31 فبراير.
- لا يتم إضافة أي صلاحيات متعددة المستخدمين.
- لا يتم وضع مفاتيح Supabase السرية داخل Web/Windows client.
- `VITE_API_BASE_URL` غير مستخدم؛ عنوان Railway للـ Tauri يتم توليده من `RAILWAY_APP_URL` أثناء Release.

## مطلوب قبل أول Deploy
شغّل migration:
`supabase/migrations/005_v15_system_infrastructure.sql`

أو استخدم النسخة المجمعة `sql/supabase_schema.sql`.

## ملاحظة
بعض وظائف Windows Auto Update تحتاج Secrets الخاصة بـ Tauri التي تم تأجيل إعدادها:
- `TAURI_UPDATE_PUBLIC_KEY`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (اختياري)
