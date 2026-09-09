# IFC Academy - المزامنة المحلية كل دقيقة

## 1) إعداد الاتصال
انسخ `config.example.json` إلى `config.json` ثم ضع:
- `supabaseUrl`: رابط مشروع Supabase.
- `supabaseServiceRoleKey`: مفتاح Service Role من Supabase.
- `dataDir`: مكان الحفظ، الافتراضي `C:\IFC_ACADEMY_DATA`.

> مفتاح Service Role سري جدًا. لا ترسله لأحد ولا تضعه داخل موقع Railway أو GitHub.

## 2) التشغيل اليدوي
شغّل `START_BACKUP_AGENT.cmd`.

## 3) التشغيل التلقائي مع Windows
افتح PowerShell كمسؤول وشغّل:
`Set-ExecutionPolicy -Scope Process Bypass`
ثم:
`.\install-startup.ps1`

سيتم إنشاء Scheduled Task يبدأ مع تسجيل الدخول ويشغّل الـAgent في الخلفية. الـAgent يزامن كل 60 ثانية.

## 4) مكان الحفظ
`C:\IFC_ACADEMY_DATA\Latest\` يحتوي آخر نسخة لكل جدول.
`C:\IFC_ACADEMY_DATA\Backups\YYYY-MM-DD\` يحتوي نسخة يومية عند أول تغيير في اليوم.
`C:\IFC_ACADEMY_DATA\Logs\` يحتوي سجل التشغيل.

## 5) ماذا يحدث كل دقيقة؟
يتم سحب البيانات كاملة من Supabase. إذا لم يتغير شيء، لا يتم إنشاء ملف Backup جديد. إذا حدث تغيير، يتم استبدال ملفات Latest بشكل ذري، وتنعكس الإضافات والتعديلات والحذف في النسخة المحلية.
