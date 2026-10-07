-- ============================================================
-- LUMA — migration 011: Health module (daily logs + personal goals).
-- Depends on 001 (luma schema, luma.set_updated_at()).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- One row per user per day. Every metric is optional (NULL = not logged).
create table if not exists luma.health_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null,
  sleep_hours numeric(4,1) check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24)),
  water_ml integer check (water_ml is null or (water_ml >= 0 and water_ml <= 20000)),
  steps integer check (steps is null or (steps >= 0 and steps <= 200000)),
  active_minutes integer check (active_minutes is null or (active_minutes >= 0 and active_minutes <= 1440)),
  mood smallint check (mood is null or (mood between 1 and 5)),  -- 1 = low … 5 = great
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists health_logs_user_date on luma.health_logs (user_id, log_date desc);

alter table luma.health_logs enable row level security;

drop policy if exists "Users manage their own health logs" on luma.health_logs;
create policy "Users manage their own health logs"
  on luma.health_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_health_logs_updated_at on luma.health_logs;
create trigger set_luma_health_logs_updated_at
  before update on luma.health_logs
  for each row execute function luma.set_updated_at();

-- Daily targets, one row per user (the rings on the Health page measure against these).
create table if not exists luma.health_goals (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  sleep_hours numeric(3,1) not null default 8 check (sleep_hours > 0 and sleep_hours <= 24),
  water_ml integer not null default 2500 check (water_ml > 0 and water_ml <= 20000),
  steps integer not null default 10000 check (steps > 0 and steps <= 200000),
  active_minutes integer not null default 45 check (active_minutes > 0 and active_minutes <= 1440),
  updated_at timestamptz not null default now()
);

alter table luma.health_goals enable row level security;

drop policy if exists "Users manage their own health goals" on luma.health_goals;
create policy "Users manage their own health goals"
  on luma.health_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_health_goals_updated_at on luma.health_goals;
create trigger set_luma_health_goals_updated_at
  before update on luma.health_goals
  for each row execute function luma.set_updated_at();

grant all on luma.health_logs, luma.health_goals to anon, authenticated;
