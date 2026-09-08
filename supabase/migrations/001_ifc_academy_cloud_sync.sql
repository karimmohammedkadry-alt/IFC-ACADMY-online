-- IFC Academy: one-row cloud snapshot for offline-first desktop sync.
-- Do NOT store passwords here. Passwords belong to Supabase Auth.
create table if not exists public.academy_cloud_state (
  id integer primary key check (id = 1),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  device_id text not null default '',
  version bigint not null default 1
);

alter table public.academy_cloud_state enable row level security;

revoke all on public.academy_cloud_state from anon;
grant select, insert, update on public.academy_cloud_state to authenticated;

drop policy if exists "ifc cloud state read authenticated" on public.academy_cloud_state;
drop policy if exists "ifc cloud state insert authenticated" on public.academy_cloud_state;
drop policy if exists "ifc cloud state update authenticated" on public.academy_cloud_state;

create policy "ifc cloud state read authenticated"
on public.academy_cloud_state for select to authenticated
using (auth.uid() is not null);

create policy "ifc cloud state insert authenticated"
on public.academy_cloud_state for insert to authenticated
with check (auth.uid() is not null and (updated_by is null or updated_by = auth.uid()));

create policy "ifc cloud state update authenticated"
on public.academy_cloud_state for update to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null and (updated_by is null or updated_by = auth.uid()));

-- Client-side sync is row-aware inside the JSON snapshot: each record carries updated_at,
-- and deletions are kept as tombstones locally so offline deletes can be propagated.
-- Passwords are never stored in academy_cloud_state.
