-- ============================================================
-- LUMA — migration 013: Health reminders (water / steps / sleep) and
-- bedtime + wake-up time on sleep logs.
-- Depends on 008 (notifications) and 011 (health). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- ---------- sleep logs: bedtime and wake-up time ----------
-- Stored as 24-hour 'HH:MM' text. When both are given the app works out
-- sleep_hours from them (wake-up may be after midnight).
alter table luma.health_logs add column if not exists bedtime text;
alter table luma.health_logs add column if not exists wake_time text;

alter table luma.health_logs drop constraint if exists health_logs_bedtime_fmt;
alter table luma.health_logs add constraint health_logs_bedtime_fmt
  check (bedtime is null or bedtime ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table luma.health_logs drop constraint if exists health_logs_wake_time_fmt;
alter table luma.health_logs add constraint health_logs_wake_time_fmt
  check (wake_time is null or wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ---------- reminder settings (one row per user) ----------
create table if not exists luma.health_reminders (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  water_enabled boolean not null default false,
  water_every_min integer not null default 60 check (water_every_min between 15 and 480),
  water_from text not null default '08:00' check (water_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  water_to text not null default '22:00' check (water_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  steps_enabled boolean not null default false,
  steps_every_min integer not null default 180 check (steps_every_min between 30 and 720),
  steps_from text not null default '10:00' check (steps_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  steps_to text not null default '20:00' check (steps_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  sleep_enabled boolean not null default false,
  bedtime text not null default '23:00' check (bedtime ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  wake_time text not null default '07:00' check (wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  sleep_lead_min integer not null default 30 check (sleep_lead_min between 0 and 240),
  updated_at timestamptz not null default now()
);

alter table luma.health_reminders enable row level security;

drop policy if exists "Users manage their own reminder settings" on luma.health_reminders;
create policy "Users manage their own reminder settings"
  on luma.health_reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_health_reminders_updated_at on luma.health_reminders;
create trigger set_luma_health_reminders_updated_at
  before update on luma.health_reminders
  for each row execute function luma.set_updated_at();

grant all on luma.health_reminders to anon, authenticated;

-- ---------- delivering a reminder ----------
-- Clients can't insert notifications directly. The app calls this when a
-- reminder is due (it runs while LUMA is open); the function only ever writes
-- a reminder for the caller themselves, uses fixed titles, and refuses a
-- second reminder of the same kind within 10 minutes, so it can't be abused.
create or replace function luma.push_reminder(p_kind text, p_body text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_title text;
  v_type text := 'reminder_' || p_kind;
begin
  v_title := case p_kind
    when 'water' then '💧 Time to drink water'
    when 'steps' then '👟 Time to get some steps in'
    when 'sleep' then '🌙 Time to wind down'
    else null end;

  if v_title is null or auth.uid() is null then
    return false;
  end if;

  if exists (
    select 1 from luma.notifications n
    where n.user_id = auth.uid() and n.type = v_type and n.created_at > now() - interval '10 minutes'
  ) then
    return false;
  end if;

  insert into luma.notifications (user_id, type, title, body, link)
  values (auth.uid(), v_type, v_title, left(coalesce(p_body, ''), 160), 'health');
  return true;
end;
$$;

grant execute on function luma.push_reminder(text, text) to authenticated;
