# IFC Academy V15.2 — Final Technical Audit

## النتيجة
تمت مراجعة مسار Web/Windows/Tauri/Railway/Supabase/SQLite/Frontend/Backend والتحديث التلقائي والـ sync. تم إصلاح أخطاء برمجية واضحة في النسخة النهائية.

## ما تم إصلاحه في هذه المراجعة
- إضافة Device ID ثابت للـ Windows وإرساله مع عمليات المزامنة.
- إصلاح رمز كان سيؤدي إلى Runtime/TypeScript error بسبب `getDeviceId` غير معرف.
- إصلاح `SystemToast` لدعم `info` المستخدم في إشعار التحديث.
- إزالة effect غير صالح كان يستدعي `setExcelDataRevision` غير الموجود.
- منع إعادة كتابة كل صفوف SQLite في كل refresh إذا كانت الـ snapshot لم تتغير.
- تغيير polling كل 15 ثانية من تحميل كل البيانات إلى فحص fingerprint صغير ثم تحميل البيانات فقط عند وجود تغيير.
- منع Service Worker داخل Tauri حتى لا يعرض ملفات قديمة بعد تحديث EXE.
- جعل إصدار Tauri يبدأ من إصدار package الحقيقي (`15.2.x`) بدل بقاءه على `14.x`.
- جعل `SUPABASE_AUTH_EMAIL` قابلاً للضبط من البيئة.
- إزالة كلمة المرور الافتراضية الثابتة؛ إنشاء أول Admin يتطلب `SUPABASE_AUTH_INITIAL_PASSWORD` بطول 8 أحرف/أرقام على الأقل.
- جعل migration 006 تنشئ جداول idempotency/sync إذا لم تكن موجودة، وإضافة `updated_at` اللازمة لـ player_sessions وacademy_settings حتى لا يفشل fingerprint.
- إصلاح تعارض حذف المدرب ليعيد HTTP 409 ويسجل conflict.
- تنظيف `.env.example` من إعدادات Excel Online/OneDrive القديمة.
- تثبيت package version على `15.2.0`.

## البنية الحالية
- Web: React/Vite → Railway Backend → Supabase PostgreSQL.
- Windows: Tauri → Railway/Supabase عند الاتصال + SQLite `ifc_academy.db` عند عدم الاتصال.
- Offline mutations: SQLite sync queue ثم إرسالها عند عودة الاتصال.
- Player/Coach updates/deletes تستخدم optimistic concurrency عبر `version` وتمنع الكتابة فوق تعديل جهاز آخر.
- Idempotency عبر `X-IFC-Request-ID`.
- Trash/restore/permanent delete موجودة.
- Audit log موجود.
- MySQL غير مستخدم في المشروع الحالي؛ قاعدة الخادم هي Supabase PostgreSQL.

## نقاط يجب اعتبارها قبل الإطلاق النهائي
1. لا يوجد MySQL في هذه البنية، ولا حاجة لإضافته ما دام Supabase هو المصدر المركزي.
2. تعارضات Player/Coach مغطاة على مستوى backend. أما Payments/Expenses/Archives فلا توجد لها مسارات update تنافسية كاملة حتى الآن؛ الحذف/الإضافة تعمل، لكن optimistic concurrency الشامل لكل الكيانات يحتاج توسعة لاحقة إذا أصبحت هذه الكيانات تُعدل من أكثر من جهاز.
3. `npm install` لم يكتمل داخل بيئة التدقيق بسبب timeout في الوصول إلى registry، لذلك لا يمكن ادعاء أن build إنتاجي كامل تم محلياً. تم إجراء static TypeScript inspection وإصلاح الأخطاء الواضحة التي ظهرت. GitHub Actions/Railway هما مكان التحقق النهائي للبناء بعد تثبيت dependencies.
4. مفتاح توقيع Tauri الخاص بالتحديث لا يجب وضعه في الكود أو مشاركته. يلزم فقط حفظه كـ GitHub Secret.

## التحديث التلقائي Windows
الكود والـ workflow موجودان. عند Push إلى `main` أو `master`: GitHub Actions يبني EXE/MSI ويوقع updater artifacts وينشر Release. التطبيق يفحص التحديث عند التشغيل، كل 30 دقيقة، وعند عودة الاتصال ثم ينزل التحديث ويعيد تشغيل نفسه. قاعدة `ifc_academy.db` خارج حزمة التطبيق، لذلك لا ينبغي أن تُستبدل بالتحديث.

### الأسرار المطلوبة في GitHub
- `RAILWAY_APP_URL` — موجود بالفعل في إعداد المشروع.
- `TAURI_UPDATE_PUBLIC_KEY` — مطلوب.
- `TAURI_SIGNING_PRIVATE_KEY` — مطلوب وسري.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — اختياري إذا تم تعيين كلمة مرور للمفتاح.

### متغيرات Railway
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_AUTH_EMAIL`
- `SUPABASE_AUTH_INITIAL_PASSWORD` فقط عند الحاجة لإنشاء Admin لأول مرة.

## اختبارات القبول المطلوبة
- إنشاء لاعب من Chrome يظهر في Supabase ثم Windows.
- Windows offline يضيف/يعدل ثم يعود online وتتم المزامنة بدون فقد.
- تعديل نفس اللاعب من Chrome ثم تعديل نسخة قديمة من Windows يجب أن يعيد 409 ويُسجل conflict ولا يمسح تعديل Chrome.
- تشغيل التحديث من Release جديد يجب أن يغير البرنامج بدون حذف `ifc_academy.db`.
- استيراد 1000+ لاعب يجب ألا يعيد كتابة SQLite بالكامل في كل refresh.
