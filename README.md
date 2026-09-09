# IFC ACADEMY

IFC Academy is a React/Vite + Express application. **Supabase is the single source of truth for database and authentication.**

## Architecture

- Frontend: React + Vite
- Backend: Express
- Database: Supabase PostgreSQL
- Authentication: Supabase Auth (one admin account)
- Offline support: browser localStorage cache for the last synchronized data and login session bridge
- Sync: automatic refresh while online and an immediate refresh when the browser returns online

## Required environment variables

Server:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
GEMINI_API_KEY=...
```

`SUPABASE_SECRET_KEY` is server-only. Never put it in `VITE_*` variables or frontend code.

## Supabase setup

1. Open the Supabase SQL Editor for the project.
2. Run `sql/supabase_schema.sql`. The migration is non-destructive and keeps existing academy records.
3. Configure the three Supabase variables above in the hosting provider.
4. Start the app.
5. On a fresh database, the server creates the Supabase Auth admin account: username `admin`, password `5555`.
6. Change the password and username from Settings.

## Authentication behavior

- Login checks the username stored in `admin_credentials`, then authenticates the password through Supabase Auth.
- The browser stores only the Supabase access/refresh session tokens and cached user/data state; the password is never stored in localStorage.
- When the access token expires while online, the app refreshes it through Supabase Auth.
- During a temporary internet outage, the last valid local session and cached academy data remain available for viewing.
- Once the connection returns, the app synchronizes from Supabase again.
- Logout clears only the local session tokens; it never deletes academy records.

## Data safety

The application does not use a reset operation to replace the database with mock data. Player, coach, attendance, payment, expense, settings, and archive records are persisted in Supabase.

## Vercel deployment

This package includes Vercel configuration for the Vite frontend plus the Express API as a Vercel Function.

1. Import the repository into Vercel.
2. Keep the project root at the folder containing `package.json`.
3. Build command: `npm run build:vercel`.
4. Output directory: `dist`.
5. Add these Production environment variables in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (server-only)
   - `GEMINI_API_KEY` if the AI feature is used.
6. Deploy.

The frontend calls the same-origin `/api/*` endpoints, and `vercel.json` routes those requests to `api/index.ts`.

## Deployment

### GitHub
- Push the project root (the folder containing `package.json`) to a repository.
- Do not commit `.env` files or real Supabase secret keys.

### Render
- Web Service
- Build Command: `npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- Add the Supabase environment variables in Render. `render.yaml` is included for Blueprint deployments.

### Railway
- Deploy the GitHub repository as a service.
- Build Command: `npm run build`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- `railway.json` is included for the service configuration.
- Do not add a Railway PostgreSQL database when Supabase is the project's database.

### Vercel
- Import the same GitHub repository.
- Build Command: `npm run build:vercel`
- Output Directory: `dist`
- Add `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and optionally `GEMINI_API_KEY`.
- The `/api` Express function is provided by `api/index.ts`.

### Koyeb
This repository is ready for Koyeb's GitHub + Node.js Buildpack deployment.

- Deployment method: GitHub repository
- Builder: Buildpack
- Build Command: `npm run build`
- Run Command: `npm start` (also provided by `Procfile`)
- Service type: Web
- Health check endpoint: `/api/health`
- Required environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY`
  - `GEMINI_API_KEY` (only if the AI feature is used)

Koyeb detects Node.js from the root `package.json` and the repository pins Node.js 22 through `.nvmrc`/`engines`. Connect the GitHub repository in Koyeb and enable automatic deployments for the production branch.

### One codebase for all hosts
The same repository can be used for GitHub, Koyeb, Railway, Render, and Vercel. Supabase remains the database and authentication provider; no separate PostgreSQL/MySQL database is required on those hosting platforms.

## Clean/Empty Database
The repository contains no demo player/payment/expense/coach records. If an existing Supabase project already has old data, run `sql/RESET_ACADEMY_DATA.sql` once in the Supabase SQL Editor. This preserves the admin Auth account and clears only academy operational data.

## V10: مزامنة محلية كل دقيقة

تمت إضافة `backup-agent/` لمزامنة نسخة محلية كاملة من Supabase كل 60 ثانية.

- آخر نسخة لكل جدول: `C:\IFC_ACADEMY_DATA\Latest`
- نسخة يومية: `C:\IFC_ACADEMY_DATA\Backups\YYYY-MM-DD`
- السجل: `C:\IFC_ACADEMY_DATA\Logs`
- الإعدادات: `backup-agent\config.json`
- التشغيل التلقائي في Windows: `backup-agent\install-startup.ps1`

المزامنة لا تعتمد على فلاتر الموقع، وتنعكس فيها الإضافة والتعديل والحذف من Supabase. لا يتم حفظ حقول كلمات المرور أو session tokens في النسخة المحلية.
