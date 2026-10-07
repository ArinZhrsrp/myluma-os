-- ============================================================
-- LUMA — migration 027: Calendar events.
-- Depends on 001 (luma schema, luma.set_updated_at(), API grants). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- one row per event (a repeating event is a single row; the app works out each occurrence).
-- event_date is the first day; start_time / end_time are 24-hour 'HH:MM' Malaysia time, null for an all-day event.
create table if not exists luma.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0 and length(title) <= 120),
  category text not null default 'Other' check (category in ('Work', 'Meeting', 'Personal', 'Health', 'Social', 'Other')),
  event_date date not null,
  all_day boolean not null default false,
  start_time text check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  repeats text not null default 'none' check (repeats in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  note text not null default '' check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_user_date on luma.events (user_id, event_date);

alter table luma.events enable row level security;

drop policy if exists "Users manage their own events" on luma.events;
create policy "Users manage their own events"
  on luma.events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_events_updated_at on luma.events;
create trigger set_luma_events_updated_at
  before update on luma.events
  for each row execute function luma.set_updated_at();

grant all on luma.events to anon, authenticated;
