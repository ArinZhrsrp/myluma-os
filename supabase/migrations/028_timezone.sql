-- ============================================================
-- LUMA — migration 028: time zone (GMT) per user.
-- Depends on 001 (profiles), 014/015 (health reminders), 018 (habit reminders), 025 (subscription reminders).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- the time zone chosen at sign-up / in Edit profile, as an IANA name such as 'Asia/Kuala_Lumpur' or 'Europe/London'
alter table luma.profiles add column if not exists timezone text;

create or replace function luma.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into luma.profiles (id, first_name, last_name, email, country, timezone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    nullif(new.raw_user_meta_data ->> 'country', ''),
    nullif(new.raw_user_meta_data ->> 'timezone', '')
  );
  return new;
end;
$$;

-- a user's time zone; Malaysia when none is set (or the name isn't a real time zone, so one bad value can't break the jobs)
create or replace function luma.user_tz(p_user uuid)
returns text
language sql stable
security definer set search_path = ''
as $$
  select coalesce(
    (select p.timezone from luma.profiles p
      where p.id = p_user and p.timezone is not null
        and exists (select 1 from pg_catalog.pg_timezone_names n where n.name = p.timezone)),
    'Asia/Kuala_Lumpur');
$$;
revoke execute on function luma.user_tz(uuid) from public, anon, authenticated;

-- ---------- health reminders (every minute) — now on each user's own clock ----------
create or replace function luma.run_health_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_min int;
  v_day date;
  v_from int; v_to int; v_slot int; v_mins int;
  v_have int; v_count int := 0;
begin
  for r in
    select hr.*, coalesce(g.water_ml, 2500) as goal_water, coalesce(g.steps, 10000) as goal_steps, coalesce(g.active_minutes, 45) as goal_active
    from luma.health_reminders hr
    left join luma.health_goals g on g.user_id = hr.user_id
    where hr.water_enabled or hr.steps_enabled or hr.active_enabled or hr.sleep_enabled
  loop
    -- each user's own clock (their time zone from Edit profile; Malaysia if not set)
    v_now := timezone(luma.user_tz(r.user_id), now());
    v_min := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
    v_day := v_now::date;
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

    -- active
    if r.active_enabled then
      v_from := luma.hhmm_to_min(r.active_from); v_to := luma.hhmm_to_min(r.active_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.active_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_active') then
        v_have := 0;
        select coalesce(l.active_minutes, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_active then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_active', '🔥 Time to get moving',
            coalesce(v_have, 0) || ' of ' || r.goal_active || ' active minutes so far — a quick workout will help.', 'health');
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

-- ---------- habit reminders (every minute) — now on each user's own clock ----------
create or replace function luma.run_habit_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  h record;
  v_now timestamp;
  v_min int;
  v_day date;
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
    -- each user's own clock (their time zone from Edit profile; Malaysia if not set)
    v_now := timezone(luma.user_tz(h.user_id), now());
    v_min := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
    v_day := v_now::date;
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

-- ---------- subscription reminders: 3 days before renewal, at 09:00 in each user's own time zone ----------
-- the job now runs every hour and only handles users for whom it is currently 09:00
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
  v_hit boolean;
begin
  for b in
    select s.* from luma.bills s where s.category = 'Subscription' and s.active
  loop
    v_now := timezone(luma.user_tz(b.user_id), now());
    continue when extract(hour from v_now)::int <> 9;
    v_target := v_now::date + 3;
    v_last := extract(day from (date_trunc('month', v_target) + interval '1 month - 1 day'))::int;
    v_hit := case b.recurrence
      when 'once' then b.due_date = v_target
      when 'weekly' then v_target >= b.due_date and (v_target - b.due_date) % 7 = 0
      when 'monthly' then v_target >= b.due_date and extract(day from v_target)::int = least(extract(day from b.due_date)::int, v_last)
      when 'yearly' then v_target >= b.due_date and extract(month from v_target) = extract(month from b.due_date)
                         and extract(day from v_target)::int = least(extract(day from b.due_date)::int, v_last)
      else false end;
    continue when not v_hit;
    continue when exists (select 1 from luma.bill_payments p where p.bill_id = b.id and p.due_date = v_target);
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = b.user_id and n.type = 'reminder_subscription' and n.ref = b.id and n.created_at > now() - interval '12 hours');

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (
      b.user_id, 'reminder_subscription',
      '🔔 ' || b.name || ' renews in 3 days',
      'RM' || trim(trailing '.' from trim(trailing '0' from b.amount::numeric(12,2)::text)) || ' on ' || to_char(v_target, 'DD Mon') || '. Pause it in Subscriptions if you no longer need it.',
      'subscriptions', b.id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_subscription_reminders() from public, anon, authenticated;

-- run the subscription job every hour (it only acts when it is 09:00 for the user)
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-subscription-reminders') then
    perform cron.unschedule('luma-subscription-reminders');
  end if;
  perform cron.schedule('luma-subscription-reminders', '0 * * * *', 'select luma.run_subscription_reminders()');
exception when others then
  raise notice 'Could not schedule the subscription reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
