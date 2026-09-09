-- IFC Academy V15.2
-- Atomic idempotency + optimistic concurrency support.
-- Non-destructive.

-- Legacy-safe: some existing databases do not have updated_at on every table.
alter table if exists public.players add column if not exists updated_at timestamptz;
alter table if exists public.coaches add column if not exists updated_at timestamptz;
alter table if exists public.payments add column if not exists updated_at timestamptz;
alter table if exists public.expenses add column if not exists updated_at timestamptz;
alter table if exists public.monthly_archives add column if not exists updated_at timestamptz;
alter table if exists public.player_sessions add column if not exists updated_at timestamptz;
alter table if exists public.academy_settings add column if not exists updated_at timestamptz;

update public.players set updated_at = coalesce(updated_at, now()) where updated_at is null;
update public.coaches set updated_at = coalesce(updated_at, now()) where updated_at is null;
update public.payments set updated_at = coalesce(updated_at, now()) where updated_at is null;
update public.expenses set updated_at = coalesce(updated_at, now()) where updated_at is null;
update public.monthly_archives set updated_at = coalesce(updated_at, now()) where updated_at is null;
update public.player_sessions set updated_at = coalesce(updated_at, now()) where updated_at is null;
update public.academy_settings set updated_at = coalesce(updated_at, now()) where updated_at is null;

alter table if exists public.players alter column updated_at set default now();
alter table if exists public.coaches alter column updated_at set default now();
alter table if exists public.payments alter column updated_at set default now();
alter table if exists public.expenses alter column updated_at set default now();
alter table if exists public.monthly_archives alter column updated_at set default now();
alter table if exists public.player_sessions alter column updated_at set default now();
alter table if exists public.academy_settings alter column updated_at set default now();

create table if not exists public.idempotency_keys (
  request_id text primary key,
  route text not null,
  method text not null,
  status integer not null default 200,
  response jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  completed_at timestamptz
);
alter table if exists public.idempotency_keys add column if not exists completed_at timestamptz;

create table if not exists public.sync_operations (
  id text primary key,
  request_id text,
  entity_type text,
  entity_id text,
  operation text not null,
  device_id text,
  status text not null default 'pending',
  error text,
  payload jsonb,
  base_version bigint,
  result_version bigint,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.sync_conflicts (id text primary key);

alter table if exists public.sync_conflicts add column if not exists request_id text;
alter table if exists public.sync_conflicts add column if not exists entity_type text;
alter table if exists public.sync_conflicts add column if not exists entity_id text;
alter table if exists public.sync_conflicts add column if not exists device_id text;
alter table if exists public.sync_conflicts add column if not exists resolution text default 'pending';
alter table if exists public.sync_conflicts add column if not exists resolved_data jsonb;
alter table if exists public.sync_conflicts add column if not exists resolved_at timestamptz;
alter table if exists public.sync_conflicts add column if not exists created_at timestamptz default now();

alter table if exists public.sync_conflicts
  add column if not exists server_data jsonb;

alter table if exists public.sync_conflicts
  add column if not exists local_data jsonb;

alter table if exists public.sync_conflicts
  add column if not exists local_version bigint;

alter table if exists public.sync_conflicts
  add column if not exists server_version bigint;


alter table if exists public.sync_operations add column if not exists request_id text;
alter table if exists public.sync_operations add column if not exists entity_type text;
alter table if exists public.sync_operations add column if not exists entity_id text;
alter table if exists public.sync_operations add column if not exists operation text;
alter table if exists public.sync_operations add column if not exists device_id text;
alter table if exists public.sync_operations add column if not exists status text default 'pending';
alter table if exists public.sync_operations add column if not exists error text;
alter table if exists public.sync_operations add column if not exists payload jsonb;
alter table if exists public.sync_operations add column if not exists base_version bigint;
alter table if exists public.sync_operations add column if not exists result_version bigint;
alter table if exists public.sync_operations add column if not exists created_at timestamptz default now();
alter table if exists public.sync_operations add column if not exists completed_at timestamptz;

update public.sync_conflicts set resolution = coalesce(resolution, 'pending') where resolution is null;
update public.sync_conflicts set created_at = coalesce(created_at, now()) where created_at is null;
update public.sync_operations set status = coalesce(status, 'pending') where status is null;
update public.sync_operations set created_at = coalesce(created_at, now()) where created_at is null;

alter table if exists public.players
  add column if not exists version bigint;

alter table if exists public.coaches
  add column if not exists version bigint;

update public.players set version = 1 where version is null;
update public.coaches set version = 1 where version is null;

alter table if exists public.players alter column version set default 1;
alter table if exists public.coaches alter column version set default 1;

-- Version trigger: every successful UPDATE advances the server version.
create or replace function public.ifc_v15_2_bump_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.version := greatest(coalesce(new.version, 1), 1);
    new.updated_at := coalesce(new.updated_at, now());
  elsif tg_op = 'UPDATE' then
    new.version := greatest(coalesce(old.version, 1) + 1, coalesce(new.version, 1));
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_players_v15_2_version on public.players;
create trigger trg_players_v15_2_version before insert or update on public.players
for each row execute function public.ifc_v15_2_bump_version();

drop trigger if exists trg_coaches_v15_2_version on public.coaches;
create trigger trg_coaches_v15_2_version before insert or update on public.coaches
for each row execute function public.ifc_v15_2_bump_version();

create index if not exists idx_sync_conflicts_request_id on public.sync_conflicts(request_id);
create index if not exists idx_sync_conflicts_entity on public.sync_conflicts(entity_type, entity_id);
create index if not exists idx_sync_conflicts_created_at on public.sync_conflicts(created_at desc);
create index if not exists idx_sync_operations_request_id on public.sync_operations(request_id);
create index if not exists idx_sync_operations_status on public.sync_operations(status);

create index if not exists idx_idempotency_completed_at
  on public.idempotency_keys(completed_at desc);

create index if not exists idx_players_version_id
  on public.players(id, version);

create index if not exists idx_coaches_version_id
  on public.coaches(id, version);

notify pgrst, 'reload schema';
