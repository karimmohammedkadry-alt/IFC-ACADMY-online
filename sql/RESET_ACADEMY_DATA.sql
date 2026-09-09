-- IFC Academy: reset operational/demo data only.
-- This clears players, attendance sessions, payments, expenses, coaches and monthly archives.
-- It intentionally preserves Supabase Auth users and admin_credentials.
-- It also restores academy_settings to clean defaults.

begin;

truncate table
  public.player_sessions,
  public.players,
  public.payments,
  public.expenses,
  public.coaches,
  public.monthly_archives;

insert into public.academy_settings (
  id, academy_name, logo_text, phone, email, address, currency, current_season,
  whatsapp_notifications_enabled, sms_alerts_enabled, custom_logo_url,
  color_theme, primary_color, background_color, navbar_color, desktop_notifications_enabled
)
values (
  1,
  'أكاديمية IFC للفنون القتالية والكيك بوكسينغ',
  'IFC ACADEMY',
  '',
  '',
  '',
  'ج.م',
  '',
  true,
  false,
  '',
  'classic-blue',
  '#2563eb',
  '#020617',
  '#0b1120',
  true
)
on conflict (id) do update set
  academy_name = excluded.academy_name,
  logo_text = excluded.logo_text,
  phone = excluded.phone,
  email = excluded.email,
  address = excluded.address,
  currency = excluded.currency,
  current_season = excluded.current_season,
  whatsapp_notifications_enabled = excluded.whatsapp_notifications_enabled,
  sms_alerts_enabled = excluded.sms_alerts_enabled,
  custom_logo_url = excluded.custom_logo_url,
  color_theme = excluded.color_theme,
  primary_color = excluded.primary_color,
  background_color = excluded.background_color,
  navbar_color = excluded.navbar_color,
  desktop_notifications_enabled = excluded.desktop_notifications_enabled,
  updated_at = now();

commit;


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
  insert into public.academy_settings (id, data_epoch, academy_name, logo_text, phone, email, address, currency, current_season, whatsapp_notifications_enabled, sms_alerts_enabled, custom_logo_url, color_theme, primary_color, background_color, navbar_color, desktop_notifications_enabled)
  values (1, coalesce((select data_epoch from public.academy_settings where id=1),0)+1, 'أكاديمية IFC للفنون القتالية والكيك بوكسينغ', 'IFC ACADEMY', '', '', '', 'ج.م', '', true, false, '', 'classic-blue', '#2563eb', '#020617', '#0b1120', true)
  on conflict (id) do update set data_epoch=excluded.data_epoch, academy_name=excluded.academy_name, logo_text=excluded.logo_text, phone=excluded.phone, email=excluded.email, address=excluded.address, currency=excluded.currency, current_season=excluded.current_season, whatsapp_notifications_enabled=excluded.whatsapp_notifications_enabled, sms_alerts_enabled=excluded.sms_alerts_enabled, custom_logo_url=excluded.custom_logo_url, color_theme=excluded.color_theme, primary_color=excluded.primary_color, background_color=excluded.background_color, navbar_color=excluded.navbar_color, desktop_notifications_enabled=excluded.desktop_notifications_enabled, updated_at=now();
  return jsonb_build_object('success', true, 'deleted', deleted);
end; $$;

revoke all on function public.reset_academy_data() from public;
grant execute on function public.reset_academy_data() to service_role;


create or replace function public.academy_data_epoch() returns bigint language sql security definer set search_path=public as $$ select coalesce((select data_epoch from public.academy_settings where id=1),1); $$;
revoke all on function public.academy_data_epoch() from public;
grant execute on function public.academy_data_epoch() to service_role;
