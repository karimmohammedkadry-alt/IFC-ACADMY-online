# إعداد Windows + Auto Update في IFC Academy

تم تجهيز المشروع ليبني نسخة Windows تلقائيًا من GitHub ويضعها في GitHub Releases، ثم تستخدم نسخة Windows الـ Tauri Updater لتثبيت آخر إصدار تلقائيًا.

## 1) Secrets المطلوبة في GitHub

من:
Settings → Secrets and variables → Actions → New repository secret

أضف:

- `RAILWAY_APP_URL` = رابط Railway العام، مثل `https://your-app.up.railway.app`
- `TAURI_UPDATE_PUBLIC_KEY` = المفتاح العام الناتج من Tauri signer
- `TAURI_SIGNING_PRIVATE_KEY` = المفتاح الخاص الناتج من Tauri signer
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = كلمة مرور المفتاح إذا اخترت استخدام كلمة مرور، وإلا قيمة فارغة/اتركه غير مستخدم.

## 2) إنشاء مفتاح Tauri مرة واحدة

على جهاز التطوير بعد تثبيت Tauri CLI:

```powershell
npx tauri signer generate -w "$HOME\.tauri\ifc-academy.key"
```

احتفظ بالملف الخاص `ifc-academy.key` بسرية تامة. لا ترفعه إلى GitHub.

المفتاح العام يوضع في `TAURI_UPDATE_PUBLIC_KEY`، والمفتاح الخاص في `TAURI_SIGNING_PRIVATE_KEY`.

## 3) النتيجة بعد ذلك

كل Push إلى `main` أو `master`:

GitHub → Build Windows → NSIS/MSI → GitHub Release → `latest.json` → Windows Updater.

نسخة Windows تفحص التحديث عند التشغيل وكل 30 دقيقة، وتفحص مرة أخرى عند رجوع الإنترنت.

## 4) قاعدة البيانات

`ifc_academy.db` موجودة في مساحة بيانات التطبيق، وليس داخل مجلد تثبيت البرنامج؛ لذلك تحديث البرنامج لا يستبدل قاعدة البيانات المحلية.

## 5) Railway

Railway يظل مسؤولًا عن Web/API. نسخة Windows تستخدم `RAILWAY_APP_URL` للاتصال بالـ API عندما يكون الإنترنت متاحًا.
