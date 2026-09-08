# IFC Academy — Tauri Offline Windows

This build keeps the existing React/TypeScript UI and replaces the online Express/Supabase data layer with a real local SQLite database through Tauri.

## Offline architecture
- UI: React + TypeScript + Vite
- Desktop: Tauri 2
- Local database: SQLite (`ifc_academy.db`) in the app data directory
- Authentication: local admin account with PBKDF2 password hashing
- Excel/PDF: existing client-side features retained
- Gemini AI: optional and requires internet; core academy operations do not.

## First login
- Username: `admin`
- Password: `5555`
Change it immediately from Settings.

## Development
1. Install Node.js 20+ (LTS), Rust, and Microsoft Visual Studio Build Tools with Desktop development with C++ and Windows SDK.
2. In this folder: `npm install`
3. Run: `npm run tauri dev`

## Build Windows installer
`npm run tauri build`

The installer artifacts will be under `src-tauri/target/release/bundle/`.

## Database
The app creates its SQLite database automatically on first run. No Supabase, PostgreSQL, Express server, or internet connection is required for player, coach, attendance, payments, expenses, settings, reports, and archives.

## Offline V2
- SQLite is the primary local database.
- Settings no longer contains the old Performance/Cache tab.
- Account credentials are stored locally using PBKDF2 + salt.
- Payment receipt numbers are unique and amounts must be positive.
- Player profiles include subscription, payments, attendance, absences and renewals.
- Coach profiles include groups and salary account statement.
- Notifications and notification trash are stored in SQLite.
- An automatic database snapshot is maintained in `Documents/IFC Academy Data`.

See `OFFLINE_V2_CHANGELOG_AR.md` for the full change list and verification notes.
