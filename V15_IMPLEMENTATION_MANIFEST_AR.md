# IFC Academy V15 implementation manifest

هذه النسخة مبنية مباشرة على ZIP V14 الذي تم رفعه.

تمت إضافة/تعديل:
- V15 backend idempotency + request IDs.
- centralized audit logging.
- soft-delete Trash + restore/permanent delete endpoints.
- date-range reporting API.
- system health diagnostics.
- local sync queue status/attempt/error tracking.
- safe month-end date calculation.
- performance indexes and V15 Supabase migration.
- Settings > Performance now includes System Center.
- version bumped to 15.0.0.
- Windows/Tauri auto-update setup from V14 remains intact.
