-- IFC Academy: Microsoft Excel Online / OneDrive connection metadata.
-- Refresh tokens are encrypted by the Railway server before being stored here.
create table if not exists public.excel_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  microsoft_email text not null default '',
  drive_id text,
  item_id text,
  item_name text,
  item_web_url text,
  refresh_token_enc text not null,
  sync_hash text,
  last_synced_at timestamptz,
  last_sync_direction text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.excel_connections enable row level security;

-- The application uses the Supabase service-role key on the server, so no
-- browser/client policy is required for this table.
revoke all on public.excel_connections from anon, authenticated;
grant all on public.excel_connections to service_role;

create index if not exists excel_connections_item_idx
  on public.excel_connections (drive_id, item_id);
