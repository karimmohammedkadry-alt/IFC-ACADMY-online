-- IFC Academy V15 infrastructure upgrade
-- Non-destructive migration: soft delete/trash, audit trail, idempotency and health telemetry.

alter table public.players add column if not exists deleted_at timestamptz;
alter table public.coaches add column if not exists deleted_at timestamptz;
alter table public.payments add column if not exists deleted_at timestamptz;
alter table public.expenses add column if not exists deleted_at timestamptz;
alter table public.monthly_archives add column if not exists deleted_at timestamptz;

create index if not exists idx_players_active_member on public.players(member_number) where deleted_at is null;
create index if not exists idx_players_deleted_at on public.players(deleted_at);
create index if not exists idx_coaches_deleted_at on public.coaches(deleted_at);
create index if not exists idx_payments_deleted_at on public.payments(deleted_at);
create index if not exists idx_expenses_deleted_at on public.expenses(deleted_at);
create index if not exists idx_archives_deleted_at on public.monthly_archives(deleted_at);

create table if not exists public.audit_logs (
  id text primary key,
  action text not null,
  method text not null,
  route text not null,
  status integer not null default 200,
  user_id uuid,
  user_name text,
  request_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_route on public.audit_logs(route);

create table if not exists public.idempotency_keys (
  request_id text primary key,
  route text not null,
  method text not null,
  status integer not null default 200,
  response jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
create index if not exists idx_idempotency_expires on public.idempotency_keys(expires_at);

create table if not exists public.sync_operations (
  id text primary key,
  request_id text,
  entity_type text,
  entity_id text,
  operation text not null,
  device_id text,
  status text not null default 'success',
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sync_operations_created_at on public.sync_operations(created_at desc);
create index if not exists idx_sync_operations_entity on public.sync_operations(entity_type, entity_id);

create table if not exists public.system_health_events (
  id text primary key,
  component text not null,
  status text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_health_events_created_at on public.system_health_events(created_at desc);

-- Clean expired idempotency records opportunistically.
create or replace function public.cleanup_ifc_v15()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  delete from public.idempotency_keys where expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.cleanup_ifc_v15() from public;
grant execute on function public.cleanup_ifc_v15() to service_role;

notify pgrst, 'reload schema';
