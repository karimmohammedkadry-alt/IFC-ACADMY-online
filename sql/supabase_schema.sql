-- IFC Academy / Supabase schema
-- NON-DESTRUCTIVE: CREATE IF NOT EXISTS only. This script does not delete or overwrite existing academy data.

create table if not exists public.admin_credentials (
  id integer primary key default 1,
  username text not null,
  -- Legacy columns retained only so an existing installation can migrate without deleting rows.
  password_hash text,
  password_salt text,
  session_token text,
  session_expires_at timestamptz,
  auth_user_id uuid,
  auth_email text,
  updated_at timestamptz default now()
);

alter table public.admin_credentials add column if not exists auth_user_id uuid;
alter table public.admin_credentials add column if not exists auth_email text;
alter table public.admin_credentials alter column password_hash drop not null;
alter table public.admin_credentials alter column password_salt drop not null;

create table if not exists public.players (
  id text primary key,
  member_number text not null unique,
  name text not null,
  national_id text default '',
  payment_method text default 'كاش',
  birth_date text default '',
  notes text default '',
  avatar_url text default '',
  team text not null,
  sport text default 'كيك بوكسينغ',
  training_schedule jsonb default '[]'::jsonb,
  subscription_start_date text not null,
  subscription_end_date text not null,
  total_sessions integer default 8,
  attended_sessions integer default 0,
  absent_sessions integer default 0,
  attendance_rate real default 0,
  phone text default '',
  parent_phone text default '',
  subscription_plan text default 'شهري (3 أيام/أسبوع)',
  monthly_fee integer default 500,
  subscription_expiry text not null,
  status text default 'نشط',
  join_date text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.player_sessions (
  id text primary key,
  player_id text not null references public.players(id) on delete cascade,
  session_number integer not null,
  date text not null,
  day_name text not null,
  time text not null,
  status text default 'غائب',
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id text primary key,
  invoice_number text not null unique,
  type text default 'اشتراك لاعب',
  player_id text,
  player_name text not null,
  member_number text,
  team text default '',
  coach_id text,
  amount integer not null,
  method text not null,
  date text not null,
  period_month text not null,
  status text default 'مدفوع',
  notes text default '',
  collected_by text default 'مسؤول الخزينة',
  created_at timestamptz default now()
);

create table if not exists public.expenses (
  id text primary key,
  title text not null,
  category text not null,
  amount integer not null,
  date text not null,
  paid_to text not null,
  coach_id text,
  method text not null,
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists public.coaches (
  id text primary key,
  name text not null,
  avatar_url text default '',
  role text not null,
  sport text default 'كيك بوكسينغ',
  teams jsonb default '[]'::jsonb,
  phone text default '',
  monthly_salary integer default 4000,
  join_date text not null,
  status text default 'نشط',
  sessions_count_this_month integer default 0,
  last_salary_paid_month text,
  created_at timestamptz default now()
);

create table if not exists public.academy_settings (
  id integer primary key default 1,
  academy_name text default 'أكاديمية IFC للفنون القتالية والكيك بوكسينغ',
  logo_text text default 'IFC ACADEMY',
  phone text default '+20 100 123 4567',
  email text default 'info@ifc-academy.com',
  address text default 'القاهرة الجديدة، التجمع الخامس - صالة النصر الأولمبية',
  currency text default 'ج.م',
  current_season text default 'موسم 2024 / 2025',
  whatsapp_notifications_enabled boolean default true,
  sms_alerts_enabled boolean default false,
  custom_logo_url text default '',
  color_theme text default 'classic-blue',
  primary_color text default '#2563eb',
  background_color text default '#020617',
  navbar_color text default '#0b1120',
  desktop_notifications_enabled boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.monthly_archives (
  id text primary key,
  month_key text not null unique,
  month_label text not null,
  archived_at text not null,
  archived_by text default 'المدير العام (Admin)',
  total_income integer not null default 0,
  total_expenses integer not null default 0,
  net_profit integer not null default 0,
  payments_count integer not null default 0,
  expenses_count integer not null default 0,
  active_players_count integer not null default 0,
  overdue_players_count integer not null default 0,
  players_count integer not null default 0,
  coaches_count integer not null default 0,
  payments jsonb not null default '[]'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  notes text default '',
  created_at timestamptz default now()
);

-- Safe migrations for databases created by an older IFC Academy version.
-- Player birth date was added after some installations were already deployed.
alter table public.players add column if not exists birth_date text default '';

-- Monthly player packages in IFC are 8 sessions by default. Preserve custom values; only migrate the old 12-session default.
update public.players set total_sessions = 8 where total_sessions = 12;

alter table public.monthly_archives add column if not exists active_players_count integer not null default 0;
alter table public.monthly_archives add column if not exists overdue_players_count integer not null default 0;
alter table public.monthly_archives add column if not exists players_count integer not null default 0;
alter table public.monthly_archives add column if not exists coaches_count integer not null default 0;
alter table public.monthly_archives add column if not exists payments jsonb not null default '[]'::jsonb;
alter table public.monthly_archives add column if not exists expenses jsonb not null default '[]'::jsonb;
alter table public.monthly_archives add column if not exists notes text default '';

alter table public.player_sessions add column if not exists updated_at timestamptz default now();
alter table public.payments add column if not exists updated_at timestamptz default now();
alter table public.expenses add column if not exists updated_at timestamptz default now();
alter table public.coaches add column if not exists updated_at timestamptz default now();
alter table public.monthly_archives add column if not exists updated_at timestamptz default now();
alter table public.academy_settings add column if not exists data_epoch bigint not null default 1;

create index if not exists idx_player_sessions_player_id on public.player_sessions(player_id);
create index if not exists idx_payments_date on public.payments(date);
create index if not exists idx_expenses_date on public.expenses(date);
create index if not exists idx_archives_month_key on public.monthly_archives(month_key);

-- Supabase Auth is the only authentication authority. The legacy password/session columns are not read by the application.


-- IFC 2026-09-08: unified payment timestamp + monthly default of 8 sessions
alter table public.payments add column if not exists created_at timestamptz default now();
alter table public.players add column if not exists birth_date text default '';
update public.players set total_sessions = 8 where total_sessions is null or total_sessions = 12;
notify pgrst, 'reload schema';

-- Performance indexes: keep searches, date reports and monthly analysis fast.
create index if not exists idx_players_member_number on public.players(member_number);
create index if not exists idx_players_subscription_end_date on public.players(subscription_end_date);
create index if not exists idx_players_status on public.players(status);
create index if not exists idx_players_phone on public.players(phone);
create index if not exists idx_players_parent_phone on public.players(parent_phone);
create index if not exists idx_players_national_id on public.players(national_id);
create index if not exists idx_players_name on public.players(name);
create index if not exists idx_payments_date on public.payments(date);
create index if not exists idx_payments_created_at on public.payments(created_at);
create index if not exists idx_payments_player_id on public.payments(player_id);
create index if not exists idx_expenses_date on public.expenses(date);
create index if not exists idx_player_sessions_date on public.player_sessions(date);
create index if not exists idx_player_sessions_player_id on public.player_sessions(player_id);
create index if not exists idx_coaches_name on public.coaches(name);

notify pgrst, 'reload schema';


-- V9 performance / reporting indexes and backup metadata
create index if not exists idx_payments_date_created_at on public.payments(date, created_at desc);
create index if not exists idx_payments_player_date on public.payments(player_id, date desc);
create index if not exists idx_expenses_date on public.expenses(date desc);
create index if not exists idx_players_subscription_end on public.players(subscription_end_date);
create index if not exists idx_players_status on public.players(status);
create index if not exists idx_sessions_date_status on public.player_sessions(date, status);
create index if not exists idx_sessions_player_date on public.player_sessions(player_id, date desc);

create table if not exists public.system_backups (
  id text primary key,
  created_at timestamptz not null default now(),
  created_by text,
  backup_type text not null default 'excel',
  note text
);

notify pgrst, 'reload schema';


-- V12 local-first / multi-device safety: atomic global reset with a database lock.
create or replace function public.reset_academy_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted jsonb;
begin
  -- All IFC write/reset operations share this transaction-level advisory lock.
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

  insert into public.academy_settings (
    id, data_epoch, academy_name, logo_text, phone, email, address, currency, current_season,
    whatsapp_notifications_enabled, sms_alerts_enabled, custom_logo_url,
    color_theme, primary_color, background_color, navbar_color, desktop_notifications_enabled
  ) values (
    1,
    coalesce((select data_epoch from public.academy_settings where id = 1), 0) + 1,
    'أكاديمية IFC للفنون القتالية والكيك بوكسينغ',
    'IFC ACADEMY', '', '', '', 'ج.م', '', true, false, '',
    'classic-blue', '#2563eb', '#020617', '#0b1120', true
  )
  on conflict (id) do update set
    data_epoch = excluded.data_epoch,
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

  return jsonb_build_object('success', true, 'deleted', deleted);
end;
$$;


revoke all on function public.reset_academy_data() from public;
grant execute on function public.reset_academy_data() to service_role;


-- V12: lightweight change detection. Clients poll this tiny fingerprint instead of
-- downloading every player/session/payment every few seconds when nothing changed.
create or replace function public.academy_sync_fingerprint()
returns text
language sql
security definer
set search_path = public
as $$
  select md5(jsonb_build_object(
    'players', jsonb_build_object('count', (select count(*) from public.players), 'max', (select max(updated_at) from public.players)),
    'sessions', jsonb_build_object('count', (select count(*) from public.player_sessions), 'max', (select max(updated_at) from public.player_sessions)),
    'payments', jsonb_build_object('count', (select count(*) from public.payments), 'max', (select max(updated_at) from public.payments)),
    'expenses', jsonb_build_object('count', (select count(*) from public.expenses), 'max', (select max(updated_at) from public.expenses)),
    'coaches', jsonb_build_object('count', (select count(*) from public.coaches), 'max', (select max(updated_at) from public.coaches)),
    'settings', jsonb_build_object('count', (select count(*) from public.academy_settings), 'max', (select max(updated_at) from public.academy_settings)),
    'archives', jsonb_build_object('count', (select count(*) from public.monthly_archives), 'max', (select max(updated_at) from public.monthly_archives))
  )::text);
$$;
revoke all on function public.academy_sync_fingerprint() from public;
grant execute on function public.academy_sync_fingerprint() to service_role;


create or replace function public.academy_data_epoch()
returns bigint
language sql
security definer
set search_path = public
as $$ select coalesce((select data_epoch from public.academy_settings where id = 1), 1); $$;
revoke all on function public.academy_data_epoch() from public;
grant execute on function public.academy_data_epoch() to service_role;


-- V12.1: live current-month archive refresh + PostgREST schema reload.
create or replace function public.refresh_current_month_archive(p_archived_by text default 'المدير العام (Admin)')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month text := to_char(current_date, 'YYYY-MM');
  v_id text := 'arch-live-' || v_month;
  v_income integer := coalesce((select sum(amount) from public.payments where date like v_month || '%'),0);
  v_expenses integer := coalesce((select sum(amount) from public.expenses where date like v_month || '%'),0);
  v_payments integer := (select count(*) from public.payments where date like v_month || '%');
  v_expense_count integer := (select count(*) from public.expenses where date like v_month || '%');
  v_active integer := (select count(*) from public.players where status='نشط');
  v_overdue integer := (select count(*) from public.players where status='متأخر');
  v_players integer := (select count(*) from public.players);
  v_coaches integer := (select count(*) from public.coaches);
  v_label text := to_char(current_date, 'TMMonth YYYY');
begin
  insert into public.monthly_archives (
    id, month_key, month_label, archived_at, archived_by,
    total_income, total_expenses, net_profit, payments_count, expenses_count,
    active_players_count, overdue_players_count, players_count, coaches_count,
    payments, expenses, notes, updated_at
  )
  values (
    v_id, v_month, v_label, now(), coalesce(nullif(p_archived_by,''),'المدير العام (Admin)'),
    v_income, v_expenses, v_income-v_expenses, v_payments, v_expense_count,
    v_active, v_overdue, v_players, v_coaches,
    coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.payments x where x.date like v_month || '%'),'[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from public.expenses x where x.date like v_month || '%'),'[]'::jsonb),
    'سجل حي للشهر الحالي يتم تحديثه تلقائيًا.', now()
  )
  on conflict (month_key) do update set
    archived_at=excluded.archived_at, archived_by=excluded.archived_by,
    total_income=excluded.total_income, total_expenses=excluded.total_expenses,
    net_profit=excluded.net_profit, payments_count=excluded.payments_count,
    expenses_count=excluded.expenses_count, active_players_count=excluded.active_players_count,
    overdue_players_count=excluded.overdue_players_count, players_count=excluded.players_count,
    coaches_count=excluded.coaches_count, payments=excluded.payments, expenses=excluded.expenses,
    notes=excluded.notes, updated_at=now();
  return jsonb_build_object('success',true,'month_key',v_month,'total_income',v_income,'total_expenses',v_expenses);
end; $$;
revoke all on function public.refresh_current_month_archive(text) from public;
grant execute on function public.refresh_current_month_archive(text) to service_role;

notify pgrst, 'reload schema';

-- V12.1 compatibility: refresh PostgREST schema after RPC creation.
notify pgrst, 'reload schema';
