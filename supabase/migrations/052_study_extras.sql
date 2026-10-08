-- ============================================================
-- LUMA — migration 052: Study extras.
--   • study_class_skips — cancel ONE session of a class (a holiday, a lecturer away) without deleting the class.
--   • study_breaks      — break weeks / public holidays: no classes between these dates.
--   • Class reminders   — "Calculus starts in 15 min" (Settings → Reminders → Classes). Skips, breaks, archived subjects and
--                         classes outside their start / end dates are all respected.
-- Same rules as the other Study tables (own rows only; adding or changing needs the Study add-on).
-- Depends on 045, 046, 047, 031. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.study_class_skips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id   uuid not null references luma.study_classes(id) on delete cascade,
  skip_date  date not null,
  created_at timestamptz not null default now(),
  unique (class_id, skip_date)
);
create index if not exists study_class_skips_user on luma.study_class_skips (user_id, skip_date);

create table if not exists luma.study_breaks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 60),
  start_date date not null,
  end_date   date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists study_breaks_user on luma.study_breaks (user_id, start_date);

alter table luma.study_class_skips enable row level security;
alter table luma.study_breaks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['study_class_skips', 'study_breaks'] loop
    execute format('drop policy if exists %I on luma.%I', t || '_read', t);
    execute format('drop policy if exists %I on luma.%I', t || '_insert', t);
    execute format('drop policy if exists %I on luma.%I', t || '_update', t);
    execute format('drop policy if exists %I on luma.%I', t || '_delete', t);
    execute format('create policy %I on luma.%I for select to authenticated using (user_id = auth.uid())', t || '_read', t);
    execute format('create policy %I on luma.%I for insert to authenticated with check (user_id = auth.uid() and luma.has_my_addon(''study''))', t || '_insert', t);
    execute format('create policy %I on luma.%I for update to authenticated using (user_id = auth.uid() and luma.has_my_addon(''study'')) with check (user_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on luma.%I for delete to authenticated using (user_id = auth.uid())', t || '_delete', t);
    execute format('revoke all on luma.%I from anon', t);
    execute format('grant select, insert, update, delete on luma.%I to authenticated', t);
  end loop;
end $$;

-- a skipped date must belong to one of your own classes
create or replace function luma.study_check_class_owner()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if not exists (select 1 from luma.study_classes k where k.id = new.class_id and k.user_id = new.user_id) then
    raise exception 'That class is not yours';
  end if;
  return new;
end;
$$;
drop trigger if exists study_class_skips_owner on luma.study_class_skips;
create trigger study_class_skips_owner before insert or update on luma.study_class_skips for each row execute function luma.study_check_class_owner();

drop trigger if exists study_class_skips_cap on luma.study_class_skips;
create trigger study_class_skips_cap before insert on luma.study_class_skips for each row execute function luma.study_cap('1000', 'cancelled dates');
drop trigger if exists study_breaks_cap on luma.study_breaks;
create trigger study_breaks_cap before insert on luma.study_breaks for each row execute function luma.study_cap('100', 'breaks');

-- ---------- class reminders ----------
alter table luma.reminder_prefs add column if not exists class_on boolean not null default true;
alter table luma.reminder_prefs add column if not exists class_lead_min integer not null default 15;
alter table luma.reminder_prefs drop constraint if exists reminder_prefs_class_lead_check;
alter table luma.reminder_prefs add constraint reminder_prefs_class_lead_check check (class_lead_min between 5 and 60);

-- on Dawn the lead time is fixed like every other reminder time (see 038 / 045)
create or replace function luma.enforce_reminder_timing()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(luma.limit_of(new.user_id, 'timing'), 1) = 0 and (
       new.event_lead_min <> 15 or new.allday_hour <> 8 or new.task_hour <> 9 or new.bill_hour <> 9 or new.bill_days <> 3
    or new.sub_hour <> 9 or new.sub_days <> 3 or new.goal_hour <> 9 or new.goal_days <> 3 or new.budget_pct <> 80
    or new.study_hour <> 9 or new.study_days <> 3 or new.class_lead_min <> 15) then
    raise exception 'Plan limit: choosing reminder times and the budget warning level is available on Glow and Zenith. You can still switch each reminder on or off.';
  end if;
  return new;
end;
$$;

create or replace function luma.run_class_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_today date;
  v_on boolean;
  v_lead int;
  v_left int;
  v_count int := 0;
begin
  for r in
    select k.id, k.user_id, k.weekday, k.start_time, k.room, k.start_date, k.end_date, c.name as course_name
    from luma.study_classes k
    join luma.study_courses c on c.id = k.course_id
    where not c.archived and (k.end_date is null or k.end_date >= current_date - 1)
  loop
    continue when not luma.has_addon(r.user_id, 'study');
    select coalesce(bool_and(p.class_on), true), coalesce(max(p.class_lead_min), 15) into v_on, v_lead
      from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(r.user_id), now());
    v_today := v_now::date;
    continue when extract(dow from v_today)::int <> r.weekday;
    continue when r.start_date is not null and v_today < r.start_date;
    continue when r.end_date is not null and v_today > r.end_date;
    continue when exists (select 1 from luma.study_class_skips s where s.class_id = r.id and s.skip_date = v_today);
    continue when exists (select 1 from luma.study_breaks b where b.user_id = r.user_id and v_today between b.start_date and b.end_date);
    v_left := (extract(hour from r.start_time)::int * 60 + extract(minute from r.start_time)::int) - (extract(hour from v_now)::int * 60 + extract(minute from v_now)::int);
    continue when v_left < 0 or v_left > v_lead;
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = r.user_id and n.type = 'reminder_class' and n.ref = r.id and n.created_at > now() - interval '6 hours');
    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (r.user_id, 'reminder_class',
      '🎓 ' || r.course_name || case when v_left = 0 then ' starts now' else ' starts in ' || v_left || ' min' end,
      to_char(r.start_time, 'FMHH12:MI am') || coalesce(' · ' || nullif(r.room, ''), ''),
      'study', r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_class_reminders() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-class-reminders') then perform cron.unschedule('luma-class-reminders'); end if;
  perform cron.schedule('luma-class-reminders', '* * * * *', 'select luma.run_class_reminders()');
exception when others then
  raise notice 'Could not schedule the class reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
