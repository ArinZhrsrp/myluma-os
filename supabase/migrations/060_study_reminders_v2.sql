-- ============================================================
-- LUMA — migration 060: study reminders, version 2, and archived semesters stay quiet.
--   • Each assignment can have its own extra reminder at a date and time you choose ("remind me on …").
--   • Items with a due TIME (an exam at 8:30) are reminded shortly before that time on the day (Settings → Reminders → Study: "Timed items"),
--     instead of at a fixed hour that might already be too late.
--   • Overdue items get a daily nudge for up to 7 days.
--   • Everything that belongs to an ARCHIVED semester (or an archived subject) is left out of the server's reminders and daily / weekly
--     summaries: tasks, events, assignments and group tasks.
-- Depends on 045, 052, 056, 031, 034. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.study_tasks add column if not exists remind_at timestamptz;
alter table luma.study_tasks add column if not exists reminded_at timestamptz;
alter table luma.reminder_prefs add column if not exists study_due_lead_min integer not null default 60;
alter table luma.reminder_prefs drop constraint if exists reminder_prefs_study_due_lead_check;
alter table luma.reminder_prefs add constraint reminder_prefs_study_due_lead_check check (study_due_lead_min between 15 and 240);

create or replace function luma.enforce_reminder_timing()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(luma.limit_of(new.user_id, 'timing'), 1) = 0 and (
       new.event_lead_min <> 15 or new.allday_hour <> 8 or new.task_hour <> 9 or new.bill_hour <> 9 or new.bill_days <> 3
    or new.sub_hour <> 9 or new.sub_days <> 3 or new.goal_hour <> 9 or new.goal_days <> 3 or new.budget_pct <> 80
    or new.study_hour <> 9 or new.study_days <> 3 or new.class_lead_min <> 15 or new.study_due_lead_min <> 60) then
    raise exception 'Plan limit: choosing reminder times and the budget warning level is available on Glow and Zenith. You can still switch each reminder on or off.';
  end if;
  return new;
end;
$$;

-- is this item still "live"? (not part of an archived semester)
create or replace function luma.live_item(p_sem uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select p_sem is null or not exists (select 1 from luma.study_semesters s where s.id = p_sem and s.archived_at is not null);
$$;
revoke execute on function luma.live_item(uuid) from public, anon, authenticated;

create or replace function luma.run_study_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp; v_today date;
  v_on boolean; v_hour int; v_days int; v_lead int;
  v_off int; v_late int; v_title text; v_send boolean; v_timed boolean;
  v_nowm int; v_duem int;
  v_count int := 0;
begin
  for r in
    select s.*, c.name as course_name
    from luma.study_tasks s
    left join luma.study_courses c on c.id = s.course_id
    where s.status <> 'done'
      and ((s.due_date is not null and s.due_date between current_date - 8 and current_date + 15)
           or (s.remind_at is not null and s.reminded_at is null and s.remind_at <= now() and s.remind_at > now() - interval '1 day'))
      and luma.live_item(s.semester_id) and coalesce(c.archived, false) = false
  loop
    continue when not luma.has_addon(r.user_id, 'study');
    select coalesce(bool_and(p.study_on), true), coalesce(max(p.study_hour), 9), coalesce(max(p.study_days), 3), coalesce(max(p.study_due_lead_min), 60)
      into v_on, v_hour, v_days, v_lead from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;

    -- the extra reminder you set on this item
    if r.remind_at is not null and r.reminded_at is null and r.remind_at <= now() and r.remind_at > now() - interval '1 day' then
      insert into luma.notifications (user_id, type, title, body, link, ref)
      values (r.user_id, 'reminder_study', '🎓 Reminder: ' || r.title, initcap(r.kind) || coalesce(' · ' || r.course_name, ''), 'study', r.id);
      update luma.study_tasks set reminded_at = now() where id = r.id;
      v_count := v_count + 1;
    end if;

    continue when r.due_date is null;
    v_now := timezone(luma.user_tz(r.user_id), now());
    v_today := v_now::date;
    v_late := v_today - r.due_date;
    v_title := null; v_send := false; v_timed := false;
    if v_late > 0 then
      if v_late <= 7 and extract(hour from v_now)::int = v_hour then
        v_title := '⚠️ ' || r.title || ' is overdue by ' || v_late || ' day' || case when v_late = 1 then '' else 's' end; v_send := true;
      end if;
    else
      foreach v_off in array array[v_days, 1, 0] loop
        continue when r.due_date <> v_today + v_off;
        if v_off = 0 and r.due_time is not null then
          v_nowm := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
          v_duem := extract(hour from r.due_time)::int * 60 + extract(minute from r.due_time)::int;
          v_send := v_nowm >= v_duem - v_lead and v_nowm < v_duem; v_timed := true;
          v_title := '🎓 ' || r.title || ' is due ' || case when v_duem - v_nowm <= 1 then 'now' else 'in ' || (v_duem - v_nowm) || ' min' end;
        else
          v_send := extract(hour from v_now)::int = v_hour;
          v_title := '🎓 ' || r.title || case when v_off = 0 then ' is due today' else ' is due ' || luma.days_text(v_off, 'in') end;
        end if;
        exit;
      end loop;
    end if;
    continue when not v_send or v_title is null;
    if v_timed then
      continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.type = 'reminder_study' and n.ref = r.id and n.created_at > now() - interval '3 hours');
    else
      continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.type = 'reminder_study' and n.ref = r.id and n.title = v_title and n.created_at > now() - interval '12 hours');
    end if;
    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (r.user_id, 'reminder_study', v_title,
      initcap(r.kind) || coalesce(' · ' || r.course_name, '') || case when r.due_time is not null then ' · ' || to_char(r.due_time, 'FMHH12:MI am') else '' end, 'study', r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_study_reminders() from public, anon, authenticated;

-- ---------- archived semesters stay out of the old reminders and summaries ----------
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
    where ev.event_date <= current_date + 1 and luma.live_item(ev.semester_id)
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
  for r in select distinct t.user_id from luma.tasks t where luma.live_item(t.semester_id) and t.status <> 'done' and t.due_date is not null and t.due_date <= current_date + 1 loop
    select coalesce(bool_and(p.task_on), true), coalesce(max(p.task_hour), 9) into v_on, v_hour from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
    v_today := v_now::date;
    select count(*) filter (where due_date = v_today), count(*) filter (where due_date < v_today)
      into v_due, v_over
      from luma.tasks where user_id = r.user_id and luma.live_item(semester_id) and status <> 'done' and due_date is not null;
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

create or replace function luma.run_weekly_review()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_done int;
  v_over int;
  v_spent numeric;
  v_count int := 0;
begin
  for r in select p.id as user_id from luma.profiles p where coalesce(p.preferences ->> 'weekly', 'true') <> 'false' loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(dow from v_now)::int <> 0 or extract(hour from v_now)::int <> 18;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.type = 'weekly_review' and n.created_at > now() - interval '5 days');

    select count(*) into v_done from luma.tasks t where t.user_id = r.user_id and luma.live_item(t.semester_id) and t.completed_at >= now() - interval '7 days';
    select count(*) into v_over from luma.tasks t where t.user_id = r.user_id and luma.live_item(t.semester_id) and t.status <> 'done' and t.due_date < v_now::date;
    select coalesce((select sum(m.amount) from luma.money_entries m where m.user_id = r.user_id and m.kind = 'expense' and m.entry_date > v_now::date - 7), 0)
         + coalesce((select sum(b.amount) from luma.bill_payments b where b.user_id = r.user_id and b.paid_at >= now() - interval '7 days'), 0)
      into v_spent;

    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, 'weekly_review', '📊 Your week in review',
      'You finished ' || v_done || ' task' || case when v_done = 1 then '' else 's' end
      || case when v_over > 0 then ', with ' || v_over || ' still overdue' else '' end
      || ' and spent ' || luma.rm_text(v_spent) || '. Open Analytics for the full picture.',
      'analytics');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_weekly_review() from public, anon, authenticated;
