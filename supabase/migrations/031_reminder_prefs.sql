-- ============================================================
-- LUMA — migration 031: per-user reminder settings (Settings → Reminders).
-- Lets each user switch the reminders from 028 / 030 on or off and choose their timing.
-- Depends on 028 (luma.user_tz, subscription reminders) and 030 (event / task / bill / goal / budget reminders).
-- Rewrites those jobs so they read these settings (no row = the defaults below). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.reminder_prefs (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  event_on boolean not null default true,
  event_lead_min integer not null default 15 check (event_lead_min between 1 and 1440),
  allday_hour integer not null default 8 check (allday_hour between 0 and 23),
  task_on boolean not null default true,
  task_hour integer not null default 9 check (task_hour between 0 and 23),
  bill_on boolean not null default true,
  bill_hour integer not null default 9 check (bill_hour between 0 and 23),
  bill_days integer not null default 3 check (bill_days between 1 and 14),
  sub_on boolean not null default true,
  sub_hour integer not null default 9 check (sub_hour between 0 and 23),
  sub_days integer not null default 3 check (sub_days between 1 and 14),
  goal_on boolean not null default true,
  goal_hour integer not null default 9 check (goal_hour between 0 and 23),
  goal_days integer not null default 3 check (goal_days between 1 and 14),
  budget_on boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table luma.reminder_prefs enable row level security;

drop policy if exists "Users manage their own reminder settings" on luma.reminder_prefs;
create policy "Users manage their own reminder settings"
  on luma.reminder_prefs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_reminder_prefs_updated_at on luma.reminder_prefs;
create trigger set_luma_reminder_prefs_updated_at
  before update on luma.reminder_prefs
  for each row execute function luma.set_updated_at();

grant all on luma.reminder_prefs to anon, authenticated;

create or replace function luma.days_text(p_n integer, p_prefix text)
returns text
language sql
immutable
set search_path = ''
as $$ select case when p_n = 1 then 'tomorrow' else p_prefix || ' ' || p_n || ' days' end; $$;

-- ---------- calendar events (every minute) ----------
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
  v_on boolean;
  v_lead int;
  v_hour int;
  v_count int := 0;
begin
  for e in
    select ev.* from luma.events ev
    where ev.event_date <= current_date + 1
      and (ev.repeats <> 'none' or ev.event_date >= current_date - 1)
  loop
    select coalesce(bool_and(p.event_on), true), coalesce(max(p.event_lead_min), 15), coalesce(max(p.allday_hour), 8)
      into v_on, v_lead, v_hour from luma.reminder_prefs p where p.user_id = e.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(e.user_id), now());
    v_today := v_now::date;
    continue when not luma.day_matches(e.event_date, e.repeats, v_today);

    if e.all_day or e.start_time is null then
      continue when extract(hour from v_now)::int <> v_hour;
      v_title := '📅 ' || e.title || ' is today';
      v_body := 'All day · ' || e.category;
    else
      v_mins := extract(epoch from ((v_today + e.start_time::time) - v_now)) / 60;
      continue when v_mins < 0 or v_mins > v_lead;
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

-- ---------- tasks, bills, goals (hourly) ----------
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
  v_on boolean;
  v_hour int;
  v_days int;
  v_count int := 0;
  v_off int;
begin
  -- tasks: one digest per user
  for r in select distinct t.user_id from luma.tasks t where t.status <> 'done' and t.due_date is not null and t.due_date <= current_date + 1 loop
    select coalesce(bool_and(p.task_on), true), coalesce(max(p.task_hour), 9) into v_on, v_hour from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
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

  -- bills (subscriptions have their own reminder)
  for r in select b.* from luma.bills b where b.category <> 'Subscription' and b.active loop
    select coalesce(bool_and(p.bill_on), true), coalesce(max(p.bill_hour), 9), coalesce(max(p.bill_days), 3) into v_on, v_hour, v_days from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
    v_today := v_now::date;
    foreach v_off in array array[v_days, 0, -1] loop
      continue when not luma.day_matches(r.due_date, r.recurrence, v_today + v_off);
      continue when exists (select 1 from luma.bill_payments p where p.bill_id = r.id and p.due_date = v_today + v_off);
      v_when := case when v_off > 0 then 'is due ' || luma.days_text(v_off, 'in') when v_off = 0 then 'is due today' else 'is overdue' end;
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
  for r in select g.* from luma.goals g where g.completed_at is null and g.deadline is not null and g.deadline <= current_date + 15 and g.deadline >= current_date - 1 loop
    select coalesce(bool_and(p.goal_on), true), coalesce(max(p.goal_hour), 9), coalesce(max(p.goal_days), 3) into v_on, v_hour, v_days from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
    v_today := v_now::date;
    continue when r.deadline not in (v_today + v_days, v_today);
    v_title := '🎯 ' || r.title || case when r.deadline = v_today then ' is due today' else ' is due ' || luma.days_text(v_days, 'in') end;
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

-- ---------- budget alerts (hourly) ----------
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
  v_on boolean;
  v_count int := 0;
begin
  for r in select s.user_id, s.monthly_budget from luma.money_settings s where s.monthly_budget > 0 loop
    select coalesce(bool_and(p.budget_on), true) into v_on from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
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

-- ---------- subscription reminders (hourly) ----------
create or replace function luma.run_subscription_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  b record;
  v_now timestamp;
  v_target date;
  v_last int;
  v_count int := 0;
  v_on boolean;
  v_hour int;
  v_days int;
begin
  for b in
    select s.* from luma.bills s where s.category = 'Subscription' and s.active
  loop
    select coalesce(bool_and(p.sub_on), true), coalesce(max(p.sub_hour), 9), coalesce(max(p.sub_days), 3) into v_on, v_hour, v_days from luma.reminder_prefs p where p.user_id = b.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(b.user_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
    v_target := v_now::date + v_days;
    continue when not luma.day_matches(b.due_date, b.recurrence, v_target);
    continue when exists (select 1 from luma.bill_payments p where p.bill_id = b.id and p.due_date = v_target);
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = b.user_id and n.type = 'reminder_subscription' and n.ref = b.id and n.created_at > now() - interval '12 hours');

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (
      b.user_id, 'reminder_subscription',
      '🔔 ' || b.name || ' renews ' || luma.days_text(v_days, 'in'),
      luma.rm_text(b.amount) || ' on ' || to_char(v_target, 'DD Mon') || '. Pause it in Subscriptions if you no longer need it.',
      'subscriptions', b.id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_subscription_reminders() from public, anon, authenticated;
