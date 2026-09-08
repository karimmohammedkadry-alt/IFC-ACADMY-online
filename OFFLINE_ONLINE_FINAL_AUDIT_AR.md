# IFC Academy — Final Offline/Online Audit V1.2

## نتيجة فحص تسجيل الدخول

تم تحديد سبب رسالة `Invalid login credentials`: التطبيق يصل إلى Supabase Auth بنجاح، لكن حساب Auth أو كلمة مروره لا تطابق بيانات الدخول المدخلة. هذا يختلف عن خطأ `undefined invoke` السابق الذي كان سببه استدعاء Tauri من المتصفح.

## قواعد الدخول

- Online + Supabase reachable: Supabase Auth هو المرجع.
- Offline / network failure: القاعدة المحلية هي المرجع.
- لا يتم استخدام كلمة المرور المحلية لتجاوز Supabase عندما يكون الاتصال السحابي متاحًا؛ هذا يمنع الدخول بكلمة مرور قديمة بعد تغييرها من جهاز آخر.

## قواعد البيانات

- Windows/Tauri: SQLite محلية.
- Browser/Railway: IndexedDB محلية.
- Supabase: `academy_cloud_state` كنسخة سحابية موحدة للبيانات التشغيلية.
- المزامنة تشمل اللاعبين، الجلسات، المدفوعات، المصروفات، المدربين، إعدادات الأكاديمية، الأرشيف، والإشعارات.
- الحذف محفوظ كـ tombstone لمنع عودة السجلات المحذوفة.

## كلمات المرور

- المحلي: PBKDF2-SHA-256 مع salt عشوائي.
- التغيير Offline: local hash يتغير فورًا، والطلب يُخزن مشفرًا AES-GCM.
- التغيير Online: Supabase Auth + local hash.
- لا يتم تخزين كلمة المرور داخل `academy_cloud_state`.

## إصلاح إضافي

تم إصلاح مسار `refreshAdminSession` الذي كان يقارن refresh token بقيمة access token المحلية بطريقة غير صحيحة.

## التحقق

تم إجراء فحص TypeScript على المشروع. تعذر إجراء build كامل في بيئة التدقيق لأن `node_modules` غير متاحة، ومحاولة تثبيت dependencies تجاوزت وقت التنفيذ. أخطاء TypeScript الناتجة كانت أخطاء modules المفقودة فقط، ولم تظهر أخطاء syntax مستقلة في الملفات المعدلة.
