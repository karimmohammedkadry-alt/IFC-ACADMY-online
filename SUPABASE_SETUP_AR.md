# إعداد Supabase — IFC Academy V5

## مهم جدًا
لا تضع `SUPABASE_SECRET_KEY` داخل التطبيق أو `.env` الخاص بالواجهة أو GitHub أو ملف EXE. المفتاح السري الذي تم إرساله أثناء المحادثة يجب اعتباره مكشوفًا ويُنصح بتدويره من Supabase Dashboard وإنشاء Secret Key جديد.

التطبيق يستخدم فقط:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

## 1) أنشئ مستخدم Supabase Auth
من Supabase Dashboard → Authentication → Users أنشئ مستخدمًا:
`admin@ifc.academy`

استخدم نفس كلمة مرور المدير المحلية الحالية في أول تسجيل دخول (أو عدّل `.env` إلى البريد الذي أنشأته).

## 2) نفّذ SQL
افتح SQL Editor وشغّل:
`supabase/migrations/001_ifc_academy_cloud_sync.sql`

هذا ينشئ جدولًا واحدًا `academy_cloud_state` لتخزين Snapshot كامل متسق بدل نسخ كل جدول بشكل مستقل. هذا يمنع تكرار الصفوف الناتج عن المزامنة ويستخدم نفس IDs المحلية.

## 3) طريقة المزامنة
- SQLite هي القاعدة الأساسية Offline-first.
- عند عدم وجود إنترنت: لا يتوقف البرنامج ولا يحتاج Supabase.
- عند وجود إنترنت: بعد تسجيل الدخول يحاول البرنامج إنشاء/استعادة جلسة Supabase Auth ثم يزامن Snapshot SQLite.
- المزامنة الدورية كل 30 ثانية، وعند عودة الإنترنت أيضًا.
- لو لم توجد نسخة سحابية: يرفع النسخة المحلية.
- لو النسخة السحابية أحدث ولم تتغير النسخة المحلية: ينزلها إلى SQLite.
- لو الجهاز المحلي تغيّر منذ آخر مزامنة: النسخة المحلية تفوز ويرفعها للسحابة؛ لا يتم دمج صفوف متكررة.

## 4) كلمة المرور
كلمة مرور المدير لا تُخزن في Supabase Cloud State ولا يتم إرسال hash المحلي إليها.
تغيير كلمة المرور يمكن أن يتم Online أو Offline. Online يتم تحديث Supabase Auth والـSQLite معًا. Offline يتم تحديث SQLite فورًا وتُحفظ عملية التغيير في طابور مشفر، ثم تُرسل إلى Supabase Auth تلقائيًا عند عودة الإنترنت.

## 5) لا تستخدم Secret Key
`SUPABASE_SECRET_KEY` لا يوضع في React/Vite/Tauri client. لو احتجنا لاحقًا عمليات إدارية server-side، تكون في Edge Function أو backend فقط.
