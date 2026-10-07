-- ============================================================
-- LUMA — migration 014: reminders that run on the server, plus storage for
-- Web Push subscriptions.
-- Depends on 008 (notifications), 011 (health), 013 (health_reminders).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
--
-- Part A  creates the water / steps / sleep reminder notifications from the
--         database every minute (pg_cron), so they exist even if LUMA is closed.
-- Part B  stores each device's push subscription so the `send-push` Edge
--         Function can deliver notifications to a device that has LUMA closed.
--         (See README → "Background reminders & push".)
-- ============================================================

-- ---------- helpers ----------
create or replace function luma.fmt12(p_hhmm text)
returns text
language sql immutable
set search_path = ''
as $$
  select to_char(('2000-01-01 ' || p_hhmm)::timestamp, 'FMHH12:MI AM');
$$;

create or replace function luma.hhmm_to_min(p_hhmm text)
returns integer
language sql immutable
set search_path = ''
as $$
  select split_part(p_hhmm, ':', 1)::int * 60 + split_part(p_hhmm, ':', 2)::int;
$$;

-- true if this user already got a notification of this type in the last 10 minutes
-- (stops the in-app timer and this job from both sending the same reminder)
create or replace function luma.reminder_recent(p_user uuid, p_type text)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from luma.notifications n
    where n.user_id = p_user and n.type = p_type and n.created_at > now() - interval '10 minutes'
  );
$$;
revoke execute on function luma.reminder_recent(uuid, text) from public, anon, authenticated;

-- ---------- A. the reminder job ----------
-- Mirrors the in-app scheduler: water / steps remind every N minutes inside a
-- From–Until window (skipped once the day's goal is reached); sleep reminds
-- `sleep_lead_min` before bedtime. All times are Malaysia time. Runs each minute,
-- so a reminder is due at its slot minute (or the minute after, if a run was late).
create or replace function luma.run_health_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp := timezone('Asia/Kuala_Lumpur', now());
  v_min int := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
  v_day date := v_now::date;
  v_from int; v_to int; v_slot int; v_mins int;
  v_have int; v_count int := 0;
begin
  for r in
    select hr.*, coalesce(g.water_ml, 2500) as goal_water, coalesce(g.steps, 10000) as goal_steps
    from luma.health_reminders hr
    left join luma.health_goals g on g.user_id = hr.user_id
    where hr.water_enabled or hr.steps_enabled or hr.sleep_enabled
  loop
    -- water
    if r.water_enabled then
      v_from := luma.hhmm_to_min(r.water_from); v_to := luma.hhmm_to_min(r.water_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.water_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_water') then
        v_have := 0;
        select coalesce(l.water_ml, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_water then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_water', '💧 Time to drink water',
            'You''ve had ' || round(coalesce(v_have, 0) / 1000.0, 2)::float8::text || ' L of your '
              || round(r.goal_water / 1000.0, 2)::float8::text || ' L goal — time for a glass.', 'health');
          v_count := v_count + 1;
        end if;
      end if;
    end if;

    -- steps
    if r.steps_enabled then
      v_from := luma.hhmm_to_min(r.steps_from); v_to := luma.hhmm_to_min(r.steps_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.steps_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_steps') then
        v_have := 0;
        select coalesce(l.steps, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_steps then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_steps', '👟 Time to get some steps in',
            to_char(coalesce(v_have, 0), 'FM999,999') || ' of ' || to_char(r.goal_steps, 'FM999,999')
              || ' steps so far — a short walk will help.', 'health');
          v_count := v_count + 1;
        end if;
      end if;
    end if;

    -- sleep
    if r.sleep_enabled then
      v_slot := (((luma.hhmm_to_min(r.bedtime) - r.sleep_lead_min) % 1440) + 1440) % 1440;
      if (v_min = v_slot or v_min = (v_slot + 1) % 1440) and not luma.reminder_recent(r.user_id, 'reminder_sleep') then
        v_mins := (((luma.hhmm_to_min(r.wake_time) - luma.hhmm_to_min(r.bedtime)) % 1440) + 1440) % 1440;
        insert into luma.notifications (user_id, type, title, body, link)
        values (r.user_id, 'reminder_sleep', '🌙 Time to wind down',
          'Bedtime is ' || luma.fmt12(r.bedtime) || ' — wind down now to get about '
            || round(v_mins / 60.0, 1)::float8::text || 'h before your ' || luma.fmt12(r.wake_time) || ' wake-up.', 'health');
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;
revoke execute on function luma.run_health_reminders() from public, anon, authenticated;

-- schedule it every minute (needs the pg_cron extension)
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-health-reminders') then
    perform cron.unschedule('luma-health-reminders');
  end if;
  perform cron.schedule('luma-health-reminders', '* * * * *', 'select luma.run_health_reminders()');
exception when others then
  raise notice 'Could not schedule the reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;

-- ---------- B. push subscriptions (one row per browser/device) ----------
create table if not exists luma.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user on luma.push_subscriptions (user_id);

alter table luma.push_subscriptions enable row level security;

drop policy if exists "Users manage their own push subscriptions" on luma.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on luma.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on luma.push_subscriptions to anon, authenticated;
