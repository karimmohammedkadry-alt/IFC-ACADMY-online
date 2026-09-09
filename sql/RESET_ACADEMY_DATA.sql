-- IFC Academy: reset operational data only.
-- Academy identity/settings (name, logo, colors, phone, email, etc.) are preserved.
-- This prevents a reset from silently restoring old/default academy information.

-- V12: install/refresh the same atomic reset function used by the Railway API.
create or replace function public.reset_academy_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare deleted jsonb;
begin
  perform pg_advisory_xact_lock(48291731);
  select jsonb_build_object(
    'player_sessions', (select count(*) from public.player_sessions),
    'players', (select count(*) from public.players),
    'payments', (select count(*) from public.payments),
    'expenses', (select count(*) from public.expenses),
    'coaches', (select count(*) from public.coaches),
    'monthly_archives', (select count(*) from public.monthly_archives)
  ) into deleted;
  truncate table public.player_sessions, public.players, public.payments, public.expenses, public.coaches, public.monthly_archives;
  -- Preserve all academy settings/identity exactly as configured by the administrator.
  update public.academy_settings
    set data_epoch = coalesce(data_epoch, 0) + 1, updated_at = now()
  where id = 1;
  if not found then
    insert into public.academy_settings (id, data_epoch) values (1, 2);
  end if;
  return jsonb_build_object('success', true, 'deleted', deleted);
end; $$;

revoke all on function public.reset_academy_data() from public;
grant execute on function public.reset_academy_data() to service_role;


create or replace function public.academy_data_epoch() returns bigint language sql security definer set search_path=public as $$ select coalesce((select data_epoch from public.academy_settings where id=1),1); $$;
revoke all on function public.academy_data_epoch() from public;
grant execute on function public.academy_data_epoch() to service_role;
