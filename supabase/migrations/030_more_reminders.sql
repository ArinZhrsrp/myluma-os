-- ============================================================
-- LUMA — migration 030: more reminders (inbox + push), all in each user's own time zone.
--   • calendar events: 15 minutes before a timed event, 08:00 on the day for all-day events
--   • tasks: a 09:00 digest of tasks due today / overdue
--   • bills (not subscriptions): 3 days before, on the due date, and the day after if still unpaid
--   • goals: 3 days before the deadline and on the deadline day
--   • budget: once a month at 80 % and once when you go over the monthly budget
-- Depends on 008 (notifications), 014 (pg_cron), 019 (goals), 020–022 (bills), 023 (money), 027 (events), 028 (luma.user_tz).
-- Inserting into luma.notifications is what makes the send-push webhook deliver the push. Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- does something that first happens on p_first and repeats like p_repeat land on p_day?
create or replace function luma.day_matches(p_first date, p_repeat text, p_day date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_repeat in ('none', 'once') then p_day = p_first
    when p_day < p_first then false
    when p_repeat = 'daily' then true
    when p_repeat = 'weekly' then (p_day - p_first) % 7 = 0
    when p_repeat = 'monthly' then extract(day from p_day)::int = least(extract(day from p_first)::int, extract(day from (date_trunc('month', p_day) + interval '1 month - 1 day'))::int)
    when p_repeat = 'yearly' then extract(month from p_day) = extract(month from p_first)
                                  and extract(day from p_day)::int = least(extract(day from p_first)::int, extract(day from (date_trunc('month', p_day) + interval '1 month - 1 day'))::int)
    else false end;
$$;

create or replace function luma.rm_text(p_amount numeric)
returns text
language sql
immutable
set search_path = ''
as $$ select 'RM' || trim(trailing '.' from trim(trailing '0' from to_char(p_amount, 'FM999,999,999,990.00'))); $$;

-- ---------- calendar events (runs every minute) ----------
create or replace function luma.run_event_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  e record;
  v_now timestamp;
  v_today date;
  v_mins numeric;
  v_title text;
  v_body text;
  v_count int := 0;
begin
  for e in
    select ev.* from luma.events ev
    where ev.event_date <= current_date + 1
      and (ev.repeats <> 'none' or ev.event_date >= current_date - 1)
  loop
    v_now := timezone(luma.user_tz(e.user_id), now());
    v_today := v_now::date;
    continue when not luma.day_matches(e.event_date, e.repeats, v_today);

    if e.all_day or e.start_time is null then
      continue when extract(hour from v_now)::int <> 8;
      v_title := '📅 ' || e.title || ' is today';
      v_body := 'All day · ' || e.category;
    else
      v_mins := extract(epoch from ((v_today + e.start_time::time) - v_now)) / 60;
      continue when v_mins < 0 or v_mins > 15;
      v_title := '📅 ' || e.title || case when v_mins < 1 then ' starts now' else ' starts in ' || ceil(v_mins)::int || ' min' end;
      v_body := 'At ' || to_char(e.start_time::time, 'FMHH12:MI am') || ' · ' || e.category;
    end if;

    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = e.user_id and n.type = 'reminder_event' and n.ref = e.id and n.created_at > now() - interval '12 hours');

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (e.user_id, 'reminder_event', v_title, v_body, 'calendar', e.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_event_reminders() from public, anon, authenticated;

-- ---------- tasks, bills and goals (runs every hour, acts at 09:00 local time) ----------
create or replace function luma.run_morning_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_today date;
  v_due int;
  v_over int;
  v_title text;
  v_when text;
  v_count int := 0;
  v_off int;
begin
  -- tasks: one digest per user
  for r in select distinct t.user_id from luma.tasks t where t.status <> 'done' and t.due_date is not null and t.due_date <= current_date + 1 loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> 9;
    v_today := v_now::date;
    select count(*) filter (where due_date = v_today), count(*) filter (where due_date < v_today)
      into v_due, v_over
      from luma.tasks where user_id = r.user_id and status <> 'done' and due_date is not null;
    continue when v_due + v_over = 0;
    continue when exists (
      select 1 from luma.notifications n where n.user_id = r.user_id and n.type = 'reminder_task' and n.created_at > now() - interval '12 hours');
    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, 'reminder_task',
      '✅ ' || case when v_due > 0 then v_due || ' task' || case when v_due > 1 then 's' else '' end || ' due today' else v_over || ' overdue task' || case when v_over > 1 then 's' else '' end end,
      case when v_due > 0 and v_over > 0 then v_over || ' more overdue. ' else '' end || 'Open Tasks to tick them off.',
      'tasks');
    v_count := v_count + 1;
  end loop;

  -- bills (subscriptions have their own reminder in 025/028)
  for r in select b.* from luma.bills b where b.category <> 'Subscription' and b.active loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> 9;
    v_today := v_now::date;
    foreach v_off in array array[3, 0, -1] loop
      continue when not luma.day_matches(r.due_date, r.recurrence, v_today + v_off);
      continue when exists (select 1 from luma.bill_payments p where p.bill_id = r.id and p.due_date = v_today + v_off);
      v_when := case v_off when 3 then 'is due in 3 days' when 0 then 'is due today' else 'is overdue' end;
      v_title := '🧾 ' || r.name || ' ' || v_when;
      continue when exists (
        select 1 from luma.notifications n
        where n.user_id = r.user_id and n.type = 'reminder_bill' and n.ref = r.id and n.title = v_title and n.created_at > now() - interval '12 hours');
      insert into luma.notifications (user_id, type, title, body, link, ref)
      values (r.user_id, 'reminder_bill', v_title,
        luma.rm_text(r.amount) || ' · ' || to_char(v_today + v_off, 'DD Mon') || '. Tick it off in Bills once paid.', 'bills', r.id);
      v_count := v_count + 1;
    end loop;
  end loop;

  -- goals with a deadline
  for r in select g.* from luma.goals g where g.completed_at is null and g.deadline is not null and g.deadline <= current_date + 4 and g.deadline >= current_date - 1 loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> 9;
    v_today := v_now::date;
    continue when r.deadline not in (v_today + 3, v_today);
    v_title := '🎯 ' || r.title || case when r.deadline = v_today then ' is due today' else ' is due in 3 days' end;
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = r.user_id and n.type = 'reminder_goal' and n.ref = r.id and n.title = v_title and n.created_at > now() - interval '12 hours');
    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (r.user_id, 'reminder_goal', v_title,
      'You are at ' || least(100, round(r.current_value / r.target_value * 100))::int || '% of your goal.', 'goals', r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_morning_reminders() from public, anon, authenticated;

-- ---------- budget alerts (runs every hour) ----------
create or replace function luma.run_budget_alerts()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_tz text;
  v_first date;
  v_from timestamptz;
  v_to timestamptz;
  v_spent numeric;
  v_type text;
  v_count int := 0;
begin
  for r in select s.user_id, s.monthly_budget from luma.money_settings s where s.monthly_budget > 0 loop
    v_tz := luma.user_tz(r.user_id);
    v_first := date_trunc('month', timezone(v_tz, now()))::date;
    v_from := v_first::timestamp at time zone v_tz;
    v_to := (v_first + interval '1 month')::timestamp at time zone v_tz;
    select coalesce((select sum(amount) from luma.money_entries where user_id = r.user_id and kind = 'expense' and entry_date >= v_first and entry_date < (v_first + interval '1 month')::date), 0)
         + coalesce((select sum(amount) from luma.bill_payments where user_id = r.user_id and paid_at >= v_from and paid_at < v_to), 0)
      into v_spent;
    v_type := case when v_spent >= r.monthly_budget then 'budget_over' when v_spent >= r.monthly_budget * 0.8 then 'budget_warn' else null end;
    continue when v_type is null;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.type = v_type and n.created_at >= v_from);
    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, v_type,
      case v_type when 'budget_over' then '⚠️ You are over your monthly budget' else '💸 You have used 80% of your monthly budget' end,
      'Spent ' || luma.rm_text(v_spent) || ' of ' || luma.rm_text(r.monthly_budget) || ' this month.', 'money');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_budget_alerts() from public, anon, authenticated;

-- ---------- schedules ----------
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-event-reminders') then perform cron.unschedule('luma-event-reminders'); end if;
  if exists (select 1 from cron.job where jobname = 'luma-morning-reminders') then perform cron.unschedule('luma-morning-reminders'); end if;
  if exists (select 1 from cron.job where jobname = 'luma-budget-alerts') then perform cron.unschedule('luma-budget-alerts'); end if;
  perform cron.schedule('luma-event-reminders', '* * * * *', 'select luma.run_event_reminders()');
  perform cron.schedule('luma-morning-reminders', '0 * * * *', 'select luma.run_morning_reminders()');
  perform cron.schedule('luma-budget-alerts', '30 * * * *', 'select luma.run_budget_alerts()');
exception when others then
  raise notice 'Could not schedule the reminder jobs (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
