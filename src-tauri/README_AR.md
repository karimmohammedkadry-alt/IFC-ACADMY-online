# IFC Academy — Windows / Tauri

هذه المجلدات تضيف نسخة Windows حقيقية إلى مشروع IFC Academy.

- قاعدة البيانات المحلية: `ifc_academy.db` داخل AppConfig الخاصة بالتطبيق.
- Web/Railway يظل المسار الأساسي عند الاتصال بالإنترنت.
- Offline Store يستخدم SQLite في نسخة Tauri وIndexedDB في Web.
- Sync Queue محفوظة محليًا وتُرسل تلقائيًا عند عودة الاتصال.
- Tauri Updater يتحقق من GitHub Releases ويثبت التحديثات تلقائيًا.
- تحديث البرنامج لا يستبدل قاعدة البيانات المحلية.

قبل أول Release يجب إعداد GitHub Secrets الموضحة في `WINDOWS_AUTO_UPDATE_SETUP_AR.md`.
