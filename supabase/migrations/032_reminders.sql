-- ============================================================
-- LUMA — migration 032: custom reminders (the Reminders page).
-- Your own reminders, separate from tasks: e.g. "fill in the timesheet" on the last weekday of every month.
-- Delivered to the inbox and as a push notification at the chosen time, in each user's own time zone.
-- Depends on 008 (notifications), 014 (pg_cron), 028 (luma.user_tz), 030 (luma.day_matches). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0 and length(title) <= 120),
  note text not null default '' check (length(note) <= 300),
  -- once | daily | weekdays (Mon–Fri) | weekly | monthly | yearly | month_last_day | month_last_weekday
  kind text not null default 'once' check (kind in ('once', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly', 'month_last_day', 'month_last_weekday')),
  start_date date not null,                                   -- the date (once), or the first date it can fire
  remind_time text not null check (remind_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  days smallint[] not null default '{}',                      -- weekly: weekdays 0 (Sun) … 6 (Sat); empty = the weekday of start_date
  active boolean not null default true,
  last_fired_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reminders_user on luma.reminders (user_id, active);

alter table luma.reminders enable row level security;

drop policy if exists "Users manage their own reminders" on luma.reminders;
create policy "Users manage their own reminders"
  on luma.reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_reminders_updated_at on luma.reminders;
create trigger set_luma_reminders_updated_at
  before update on luma.reminders
  for each row execute function luma.set_updated_at();

grant all on luma.reminders to anon, authenticated;

-- does a reminder of this kind fall on p_day?
create or replace function luma.reminder_due(p_kind text, p_start date, p_days smallint[], p_day date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_day < p_start then false
    when p_kind = 'once' then p_day = p_start
    when p_kind = 'daily' then true
    when p_kind = 'weekdays' then extract(dow from p_day) between 1 and 5
    when p_kind = 'weekly' then extract(dow from p_day)::int = any (case when cardinality(p_days) = 0 then array[extract(dow from p_start)::smallint] else p_days end)
    when p_kind = 'monthly' then luma.day_matches(p_start, 'monthly', p_day)
    when p_kind = 'yearly' then luma.day_matches(p_start, 'yearly', p_day)
    when p_kind = 'month_last_day' then p_day = (date_trunc('month', p_day) + interval '1 month - 1 day')::date
    when p_kind = 'month_last_weekday' then p_day = (
      (date_trunc('month', p_day) + interval '1 month - 1 day')::date
      - case extract(dow from (date_trunc('month', p_day) + interval '1 month - 1 day')::date)::int when 0 then 2 when 6 then 1 else 0 end)
    else false end;
$$;

-- every minute: fire reminders whose time has come (within the last 10 minutes, once per day)
create or replace function luma.run_custom_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_today date;
  v_diff int;
  v_count int := 0;
begin
  for r in select x.* from luma.reminders x where x.active and x.start_date <= current_date + 1 loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    v_today := v_now::date;
    v_diff := (extract(hour from v_now)::int * 60 + extract(minute from v_now)::int) - (substr(r.remind_time, 1, 2)::int * 60 + substr(r.remind_time, 4, 2)::int);
    continue when v_diff < 0 or v_diff > 10;
    continue when r.last_fired_on = v_today;
    continue when not luma.reminder_due(r.kind, r.start_date, r.days, v_today);

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (r.user_id, 'reminder_custom', '⏰ ' || r.title, nullif(r.note, ''), 'reminders', r.id);
    update luma.reminders set last_fired_on = v_today where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_custom_reminders() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-custom-reminders') then perform cron.unschedule('luma-custom-reminders'); end if;
  perform cron.schedule('luma-custom-reminders', '* * * * *', 'select luma.run_custom_reminders()');
exception when others then
  raise notice 'Could not schedule the custom reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
