-- IFC Academy: preserve academy settings when operational data is reset.
create or replace function public.reset_academy_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted jsonb;
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

  truncate table
    public.player_sessions,
    public.players,
    public.payments,
    public.expenses,
    public.coaches,
    public.monthly_archives;

  update public.academy_settings
     set data_epoch = coalesce(data_epoch, 0) + 1,
         updated_at = now()
   where id = 1;

  if not found then
    insert into public.academy_settings(id, data_epoch) values (1, 2);
  end if;

  return jsonb_build_object('success', true, 'deleted', deleted);
end;
$$;

revoke all on function public.reset_academy_data() from public;
