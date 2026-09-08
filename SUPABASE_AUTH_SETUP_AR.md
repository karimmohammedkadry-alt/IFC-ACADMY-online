# إعداد تسجيل الدخول Supabase — IFC Academy

## سبب رسالة Invalid login credentials

نسخة Web/Windows الحالية تستخدم **Supabase Auth كمرجع تسجيل الدخول عند وجود الإنترنت**. كلمة المرور المحلية لا يتم استخدامها كبديل أثناء وجود اتصال ناجح بالسحابة.

لذلك يجب إنشاء مستخدم Auth مرة واحدة في مشروع Supabase.

## 1. إنشاء مستخدم المدير

من:

`Supabase Dashboard → Authentication → Users → Add user`

أنشئ:

- Email: `admin@ifc.academy`
- Password: `1234567` في أول تشغيل، أو نفس كلمة المرور الحالية الموجودة في البرنامج.
- اجعل الحساب Confirmed/Email confirmed.

إذا كنت تستخدم بريدًا مختلفًا، غيّر `SUPABASE_AUTH_EMAIL` في بيئة Railway وملف `.env` المحلي لنفس البريد.

## 2. تأكد من المستخدم

من SQL Editor يمكن تشغيل:

```sql
select id, email, confirmed_at, raw_user_meta_data->>'username' as username
from auth.users
where email = 'admin@ifc.academy';
```

المفروض يظهر صف للمستخدم، و`confirmed_at` لا يكون NULL.

## 3. تشغيل التطبيق

بعد إنشاء المستخدم:

1. افتح Railway.
2. امسح Cache الموقع/اعمل Hard Refresh (`Ctrl+Shift+R`).
3. سجّل الدخول بـ `admin` + كلمة المرور التي عيّنتها في Supabase Auth.
4. بعد الدخول سيتم حفظ hash كلمة المرور في القاعدة المحلية تلقائيًا.
5. بعدها يمكن العمل Offline.

## 4. تغيير كلمة المرور

- Online: يتم تحديث Supabase Auth والقاعدة المحلية.
- Offline: يتم تحديث القاعدة المحلية فورًا وتسجيل التغيير في طابور مشفر.
- عند رجوع الإنترنت: يحاول التطبيق تطبيق التغيير على Supabase Auth تلقائيًا.

## 5. مهم

لا تضع `service_role` أو `sb_secret_*` داخل React أو Vite أو Tauri. التطبيق يحتاج فقط إلى Publishable/Anon key.
