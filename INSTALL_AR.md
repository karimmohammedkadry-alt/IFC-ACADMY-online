# تشغيل IFC Academy Offline — Windows

## نزّل وثبّت
1. Node.js LTS (20 أو أحدث).
2. Rust عبر rustup.
3. Visual Studio 2022/2026 أو Build Tools مع workload: Desktop development with C++ + Windows 10/11 SDK.
4. VS Code اختياري ومفضل للتحرير.

## بعد التثبيت
افتح PowerShell داخل مجلد المشروع ونفّذ:

```powershell
node --version
npm --version
rustc --version
cargo --version

npm install
npm run tauri dev
```

سيُفتح البرنامج كنافذة Windows مستقلة. أول تشغيل ينشئ قاعدة SQLite محلية تلقائيًا.

## بناء نسخة تثبيت
```powershell
npm run tauri build
```

ستجد ملفات التثبيت داخل:
`src-tauri\target\release\bundle\`

## الدخول الأول
اسم المستخدم: `admin`
كلمة المرور: `5555`

غيّر كلمة المرور فورًا من الإعدادات.

## مهم
البرنامج الأساسي Offline. Gemini AI فقط يحتاج الإنترنت عند استخدام ميزات الذكاء الاصطناعي. قاعدة البيانات لا تعتمد على Supabase.
