-- IFC Academy V24: server-backed Supabase sync.
-- Run this once in Supabase SQL Editor.
create table if not exists public.players (
 id text primary key, member_number text not null unique, name text not null, national_id text default '',
 payment_method text default 'كاش', birth_date text default '', notes text default '', avatar_url text default '',
 team text not null, sport text default 'كيك بوكسينغ', training_schedule jsonb default '[]'::jsonb,
 subscription_start_date text not null, subscription_end_date text not null, total_sessions integer default 8,
 attended_sessions integer default 0, absent_sessions integer default 0, attendance_rate real default 0,
 phone text default '', parent_phone text default '', subscription_plan text default 'شهري (3 أيام/أسبوع)',
 monthly_fee integer default 500, subscription_expiry text not null, status text default 'نشط', join_date text not null,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.players add column if not exists birth_date text default '';
create table if not exists public.player_sessions (
 id text primary key, player_id text not null references public.players(id) on delete cascade, session_number integer not null,
 date text not null, day_name text not null, time text not null, status text default 'غائب', notes text default '',
 created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.payments (
 id text primary key, invoice_number text not null unique, type text default 'اشتراك لاعب', player_id text,
 player_name text not null, member_number text, team text default '', coach_id text, amount integer not null,
 method text not null, date text not null, period_month text not null, coverage_start text, coverage_end text,
 duration_months integer default 1, due_amount integer default 0, remaining_amount integer default 0, status text default 'مدفوع',
 notes text default '', collected_by text default 'مسؤول الخزينة', created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.expenses (
 id text primary key, title text not null, category text not null, amount integer not null, date text not null,
 paid_to text not null, coach_id text, method text not null, notes text default '', created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.coaches (
 id text primary key, name text not null, avatar_url text default '', role text not null, sport text default 'كيك بوكسينغ',
 teams jsonb default '[]'::jsonb, phone text default '', monthly_salary integer default 4000, join_date text not null,
 status text default 'نشط', sessions_count_this_month integer default 0, last_salary_paid_month text,
 created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.academy_settings (
 id integer primary key check(id=1), academy_name text default 'أكاديمية IFC للفنون القتالية والكيك بوكسينغ',
 logo_text text default 'IFC ACADEMY', phone text default '', email text default '', address text default '', currency text default 'ج.م',
 current_season text default '', whatsapp_notifications_enabled boolean default true, sms_alerts_enabled boolean default false,
 custom_logo_url text default '', color_theme text default 'classic-blue', primary_color text default '#2563eb',
 background_color text default '#020617', navbar_color text default '#0b1120', desktop_notifications_enabled boolean default true,
 updated_at timestamptz default now()
);
create table if not exists public.monthly_archives (
 id text primary key, month_key text not null unique, month_label text not null, archived_at text not null,
 archived_by text default 'المدير العام (Admin)', total_income integer not null default 0, total_expenses integer not null default 0,
 net_profit integer not null default 0, payments_count integer not null default 0, expenses_count integer not null default 0,
 active_players_count integer not null default 0, overdue_players_count integer not null default 0,
 payments jsonb not null default '[]'::jsonb, expenses jsonb not null default '[]'::jsonb,
 attendance jsonb not null default '[]'::jsonb, attendance_count integer default 0, present_count integer default 0,
 absent_count integer default 0, excused_count integer default 0, notes text default '',
 created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists public.recycle_bin (
 id text primary key, entity_type text not null, record_id text not null, label text not null, deleted_at text not null,
 payload jsonb not null default '{}'::jsonb, related jsonb default '{}'::jsonb, deleted_by text default '', updated_at timestamptz default now()
);
create table if not exists public.app_notifications (
 id text primary key, type text not null, title text not null, message text not null, timestamp text not null,
 read boolean default false, category text not null, meta jsonb default '{}'::jsonb, is_trash boolean default false, updated_at timestamptz default now()
);
create table if not exists public.sync_tombstones (
 table_name text not null, record_id text not null, deleted_at timestamptz not null, primary key(table_name,record_id)
);
create index if not exists idx_players_member_number on public.players(member_number);
create index if not exists idx_players_subscription_end_date on public.players(subscription_end_date);
create index if not exists idx_players_status on public.players(status);
create index if not exists idx_players_name on public.players(name);
create index if not exists idx_sessions_player_date on public.player_sessions(player_id,date desc);
create index if not exists idx_sessions_date_status on public.player_sessions(date,status);
create index if not exists idx_payments_date on public.payments(date);
create index if not exists idx_payments_created_at on public.payments(created_at);
create index if not exists idx_payments_player_date on public.payments(player_id,date desc);
create index if not exists idx_expenses_date on public.expenses(date);
create index if not exists idx_coaches_name on public.coaches(name);
create index if not exists idx_archives_month_key on public.monthly_archives(month_key);
