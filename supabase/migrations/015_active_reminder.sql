-- ============================================================
-- LUMA — migration 015: "Active minutes" reminder (like water / steps).
-- Depends on 011 (health), 013 (health_reminders) and 014 (server reminder job).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.health_reminders add column if not exists active_enabled boolean not null default false;
alter table luma.health_reminders add column if not exists active_every_min integer not null default 180;
alter table luma.health_reminders add column if not exists active_from text not null default '10:00';
alter table luma.health_reminders add column if not exists active_to text not null default '20:00';

alter table luma.health_reminders drop constraint if exists health_reminders_active_every_min_check;
alter table luma.health_reminders add constraint health_reminders_active_every_min_check check (active_every_min between 30 and 720);
alter table luma.health_reminders drop constraint if exists health_reminders_active_from_check;
alter table luma.health_reminders add constraint health_reminders_active_from_check check (active_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table luma.health_reminders drop constraint if exists health_reminders_active_to_check;
alter table luma.health_reminders add constraint health_reminders_active_to_check check (active_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- the in-app reminder delivery learns the new kind
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
    when 'active' then '🔥 Time to get moving'
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

-- the server-side job (every minute) learns it too
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
    select hr.*, coalesce(g.water_ml, 2500) as goal_water, coalesce(g.steps, 10000) as goal_steps, coalesce(g.active_minutes, 45) as goal_active
    from luma.health_reminders hr
    left join luma.health_goals g on g.user_id = hr.user_id
    where hr.water_enabled or hr.steps_enabled or hr.active_enabled or hr.sleep_enabled
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
