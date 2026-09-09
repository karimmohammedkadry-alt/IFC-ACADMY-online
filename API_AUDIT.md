# IFC Academy – Full Page/API Audit

## Audited areas
- Dashboard
- Players
- Attendance
- Payments
- Finance / Expenses
- Coaches
- Reports
- Settings
- Authentication/session handling
- Shared import/export and API layer

## Fixed in this pass
1. Player member numbers are generated server-side when absent and collision retries are handled.
2. Player update no longer fails silently on a duplicate member number; the server retries a generated unique number.
3. Attendance now creates a missing `player_sessions` row instead of only issuing an UPDATE against a non-existent row. The requested attendance date is preserved.
4. Attendance API now exposes the real backend error instead of a generic English message.
5. Settings and monthly archive APIs now expose backend error details to the UI.
6. Expense creation uses INSERT with collision-safe IDs instead of `upsert`, preventing an imported record from unexpectedly overwriting an existing expense.
7. Coach creation uses INSERT with collision-safe IDs for the same reason.
8. Player Excel import supports Arabic/English headers, Excel date serials, Arabic member/phone/ID fields, and reports per-row failures.
9. Payment and expense Excel imports now support Arabic/English headers and process rows independently, reporting saved/skipped/failed counts.
10. New-player UI no longer invents a numeric member number client-side; an empty value lets the server create the canonical `IFC-###` number.
11. Existing authentication middleware protects `/api` academy data endpoints after the public auth endpoints.

## Remaining design limitations checked
- Salary disbursement is a multi-step operation (expense + payment + coach update). If a later step fails, an earlier step can remain saved. This is a transactional consistency concern and should ideally be moved into a Supabase RPC/database transaction for full atomicity.
- Attendance bulk marking performs multiple requests sequentially. It is reliable but can be slow for very large rosters.
- Browser `alert()` calls remain in some secondary settings/export/browser-permission flows. They are not database corruption issues, but can be visually inconsistent with the system toast design.

## Deployment
The project includes Railway/Docker configuration and is packaged separately after these changes.


## Hardening pass 2026-09-08
- UI import is Excel-only (.xlsx/.xls); JSON/CSV are not offered as import formats.
- Mutating handlers update React state only after the server confirms persistence.
- Player import/restore can reuse stable IDs; payments/expenses/coaches use ID upsert semantics.
- Player session replacement and attendance totals have compensation logic on failure.
- Salary disbursement rolls back created payment/expense when a later persistence step fails.
- Monthly archive state is updated locally only after archive persistence succeeds.
- Complete Excel backup includes internal IDs and an Attendance sheet.
