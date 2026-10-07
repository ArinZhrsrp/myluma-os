-- ============================================================
-- LUMA — migration 018: a reminder time per habit, delivered as a notification
-- (and as a push to your devices through the send-push webhook).
-- Depends on 008/009 (notifications), 014 (luma.hhmm_to_min, pg_cron) and 016/017 (habits).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- 24-hour 'HH:MM' in Malaysia time; null = no reminder
alter table luma.habits add column if not exists reminder_time text
  check (reminder_time is null or reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Runs every minute. For each habit whose reminder time is now (or was a minute ago, if a run was late) it creates a
-- 'reminder_habit' notification — unless the habit is already done for today (daily) / this week / this month, isn't
-- scheduled today, or was already reminded in the last 10 minutes. Weekly / monthly habits remind each day at that
-- time until they are done for the period.
create or replace function luma.run_habit_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  h record;
  v_now timestamp := timezone('Asia/Kuala_Lumpur', now());
  v_min int := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
  v_day date := v_now::date;
  v_from date;
  v_slot int;
  v_done int;
  v_need int;
  v_hours numeric;
  v_count int := 0;
begin
  for h in
    select * from luma.habits where reminder_time is not null and not archived
  loop
    v_slot := luma.hhmm_to_min(h.reminder_time);
    continue when not (v_min = v_slot or v_min = (v_slot + 1) % 1440);
    continue when h.period = 'daily' and not (extract(dow from v_day)::smallint = any (h.days));
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = h.user_id and n.type = 'reminder_habit' and n.ref = h.id and n.created_at > now() - interval '10 minutes'
    );

    -- already done for this day / week / month?
    v_from := case h.period when 'weekly' then date_trunc('week', v_day)::date when 'monthly' then date_trunc('month', v_day)::date else v_day end;
    v_need := case when h.period = 'daily' then 1 else h.per_period end;
    if h.source = 'sleep' then
      select count(*) into v_done from luma.health_logs l
        where l.user_id = h.user_id and l.log_date between v_from and v_day and l.sleep_hours >= coalesce(h.goal_value, 6);
    else
      select count(*) into v_done from luma.habit_logs l
        where l.habit_id = h.id and l.log_date between v_from and v_day and (h.goal_value is null or coalesce(l.value, 0) >= h.goal_value);
    end if;
    continue when v_done >= v_need;

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (
      h.user_id, 'reminder_habit', '⏰ ' || h.name,
      case
        when h.source = 'sleep' then 'Log your sleep in Health to keep your streak going.'
        when h.goal_value is not null then 'Goal today: ' || h.goal_value::float8::text || ' ' || h.unit || '.'
        when h.period = 'weekly' then 'Still to do this week — tick it off when it''s done.'
        when h.period = 'monthly' then 'Still to do this month — tick it off when it''s done.'
        else 'Time for your habit — tick it off when it''s done.'
      end,
      'habits', h.id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_habit_reminders() from public, anon, authenticated;

-- schedule it every minute (needs the pg_cron extension, same as the health reminders)
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-habit-reminders') then
    perform cron.unschedule('luma-habit-reminders');
  end if;
  perform cron.schedule('luma-habit-reminders', '* * * * *', 'select luma.run_habit_reminders()');
exception when others then
  raise notice 'Could not schedule the habit reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
