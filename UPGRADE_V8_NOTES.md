# IFC Academy V8

## Settings redesign
- No user-management section.
- Academy identity, admin credentials, subscriptions, notifications, WhatsApp template, appearance, performance/security, backup/restore, and monthly cycle are grouped into tabs.
- Monthly subscription sessions default to 8 and warning period defaults to 7 days.
- Performance/security preferences are stored locally so older Supabase schemas are not broken by new UI-only settings.

## Reports redesign
- Added a monthly analysis report.
- Monthly income vs expenses visual comparison.
- Monthly analysis table: income, expenses, net profit, payments, expenses, active players, overdue players, attendance and absence.
- Existing attendance, financial, player statement and audit reports retained.
- Added separate reports for subscriptions expiring within 7 days and expired subscriptions.
- Excel export covers the new monthly and subscription reports.

## Server hardening/performance
- Disabled Express X-Powered-By header.
- Added basic security response headers.
- Added no-store caching for API responses.
- Increased JSON body limit to 10 MB for large Excel bulk imports.
- Added database indexes for membership/search/date/report workloads.
