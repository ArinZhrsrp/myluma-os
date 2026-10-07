-- ============================================================
-- LUMA — migration 016: Habits module.
-- Depends on 001 (luma schema, luma.set_updated_at(), API grants).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- one row per habit; `days` = the weekdays it applies to (0 = Sunday … 6 = Saturday)
create table if not exists luma.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0 and length(name) <= 80),
  icon text not null default 'fa-circle-check' check (icon ~ '^fa-[a-z0-9-]+$'),
  color text not null default '#3b82f6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  target text not null default '' check (length(target) <= 40),
  days smallint[] not null default '{0,1,2,3,4,5,6}'
    check (cardinality(days) between 1 and 7 and days <@ array[0,1,2,3,4,5,6]::smallint[]),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists habits_user on luma.habits (user_id, archived, created_at);

alter table luma.habits enable row level security;

drop policy if exists "Users manage their own habits" on luma.habits;
create policy "Users manage their own habits"
  on luma.habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_habits_updated_at on luma.habits;
create trigger set_luma_habits_updated_at
  before update on luma.habits
  for each row execute function luma.set_updated_at();

-- one row per habit per day it was done (no row = not done); log_date is Malaysia-time calendar day
create table if not exists luma.habit_logs (
  habit_id uuid not null references luma.habits(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, log_date)
);

create index if not exists habit_logs_user_date on luma.habit_logs (user_id, log_date desc);

alter table luma.habit_logs enable row level security;

drop policy if exists "Users manage their own habit logs" on luma.habit_logs;
create policy "Users manage their own habit logs"
  on luma.habit_logs for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from luma.habits h where h.id = habit_id and h.user_id = auth.uid())
  );

grant all on luma.habits to anon, authenticated;
grant all on luma.habit_logs to anon, authenticated;
