# IFC Academy V12 — Local-first / Online-first

- Supabase remains the authoritative central database whenever the network is available.
- IndexedDB is now the real local database/cache for the browser/PWA; localStorage is no longer the primary offline data store.
- Offline creates/updates/deletes and attendance are written locally and added to an ordered sync queue.
- Queue replay is sequential and idempotent for the main CRUD endpoints, so reconnect/retry does not intentionally duplicate records.
- A lightweight Supabase fingerprint avoids downloading all players/sessions every polling cycle when nothing changed.
- Reset uses a transactional Supabase RPC protected by a database advisory lock. A reset increments a data epoch; stale offline operations from before a global reset are discarded rather than resurrecting deleted data.
- The service worker caches the application shell only. API responses are never cached by the service worker.
- A PWA manifest allows installation from a Chromium browser as a standalone app.
- If a sync operation hits a non-network server error, it is kept as a conflict and is not silently replaced by a stale server snapshot.
