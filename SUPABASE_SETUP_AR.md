# إعداد Supabase — IFC Academy V24

V24 رجّع طبقة السيرفر التي كانت موجودة في النسخة القديمة: Railway يشغّل Express، والمفتاح السري يبقى على السيرفر فقط. الواجهة تظل Offline-first، لكن المزامنة تمر عبر `/api/sync` وتكتب في جداول Supabase العادية، لذلك ستظهر البيانات مباشرة داخل Table Editor.

## Railway
ضع:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_AUTH_EMAIL=admin@ifc.academy`

لا تضع المفتاح السري داخل React/Vite أو EXE.

## Supabase
شغّل `supabase/migrations/002_ifc_server_sync.sql` مرة واحدة.

بعدها اعمل Deploy جديد في Railway.

## الاختبار
سجّل الدخول Online، أضف لاعبًا، ثم افتح Supabase → Table Editor → `players`. المفروض يظهر اللاعب هناك. كذلك المدفوعات في `payments` والحضور في `player_sessions`.

المزامنة الدورية أصبحت كل 60 ثانية لتقليل الحمل، مع مزامنة عند عودة الإنترنت.
