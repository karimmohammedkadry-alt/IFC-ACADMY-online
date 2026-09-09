# IFC Academy V15.2 — Backend/Sync final hardening

- Legacy-safe `updated_at` migration before indexes/triggers.
- Player/coach optimistic concurrency enforced with `_ifc_base_version`.
- Player/coach versions returned to the client and reused for later mutations.
- Coach deletion now uses optimistic concurrency too.
- Atomic idempotency reservation with in-progress protection, expiry handling, and request-key reuse protection.
- Sync conflicts are persisted server-side in `sync_conflicts`; operations are recorded in `sync_operations`.
- Device IDs are attached to offline sync mutations.

## Required migration
Run `supabase/migrations/006_v15_2_conflict_idempotency.sql` once in Supabase SQL Editor.
