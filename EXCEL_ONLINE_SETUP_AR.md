# إعداد Excel Online / OneDrive الحقيقي في IFC Academy

هذا الإصدار يستخدم **Microsoft Graph + OAuth** بدل ملف Excel محلي فقط.

## 1) Microsoft Entra App Registration

من Microsoft Entra admin center:

- أنشئ App Registration جديد باسم `IFC Academy Excel Sync`.
- Supported account types: اختر النوع المناسب لك. لو الحساب قد يكون Outlook شخصي استخدم الخيار الذي يسمح بالحسابات الشخصية + المؤسسية.
- أضف Web Redirect URI:
  `https://YOUR-RAILWAY-DOMAIN/api/excel/callback`
- أنشئ Client Secret واحفظ القيمة في Railway.

## 2) API Permissions

أضف Delegated permissions:

- `User.Read`
- `Files.ReadWrite`
- `offline_access`
- `openid`
- `profile`
- `email`

لا تطلب صلاحيات أعلى من المطلوب.

## 3) Railway Variables

أضف:

```text
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://YOUR-RAILWAY-DOMAIN/api/excel/callback
APP_URL=https://YOUR-RAILWAY-DOMAIN
EXCEL_OAUTH_STATE_SECRET=ضع-قيمة-عشوائية-طويلة
EXCEL_TOKEN_ENCRYPTION_KEY=ضع-قيمة-عشوائية-طويلة
```

`EXCEL_TOKEN_ENCRYPTION_KEY` لا يظهر في الواجهة. الـ refresh token يُحفظ مشفراً في Supabase.

## 4) Supabase

شغّل migration:

`supabase/migrations/003_excel_online_sync.sql`

## 5) داخل IFC

الإعدادات → النسخ الاحتياطي → Excel Online / OneDrive:

1. اكتب إيميل Microsoft (اختياري كـ login hint فقط).
2. اضغط `ربط / تغيير حساب Microsoft`.
3. Microsoft نفسها تفتح صفحة الدخول والموافقة.
4. بعد العودة إلى IFC اضغط `اختيار ملف Excel` أو `إنشاء ملف الأكاديمية`.
5. `مزامنة الآن` تختبر الاتجاه الصحيح.
6. النظام يعمل بمزامنة تلقائية كل 30 ثانية عندما يكون Excel Online مربوطاً.
7. لو عدّل النظام وExcel في نفس الوقت، المزامنة تتوقف للحماية بدلاً من الكتابة فوق بيانات أحد الطرفين.

## مهم

- Supabase هو المصدر الأساسي للبيانات.
- Excel Online هو مرآة سحابية قابلة للتنزيل والتعديل والرفع.
- لا تدخل كلمة مرور Microsoft داخل IFC.
- ملف Excel يجب أن يكون `.xlsx`.
