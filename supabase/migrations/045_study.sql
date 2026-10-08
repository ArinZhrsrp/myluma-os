-- ============================================================
-- LUMA — migration 045: Study add-on, version 1.
--   • luma.study_courses  — your subjects (name, code, colour, lecturer, credit hours)
--   • luma.study_classes  — your weekly timetable (a course on a weekday at a time, with room)
--   • luma.study_tasks    — assignments, quizzes, tests, exams and projects (due date, weight, score, status)
--   • luma.focus_sessions.course_id — a Focus session can be tagged with a subject (study hours per subject)
--   • Study reminders: 3 days before (adjustable), 1 day before, and on the day an item is due (Settings → Reminders)
-- Only accounts with the Study add-on (044) can ADD or CHANGE rows; reading and deleting your own rows always works,
-- so nothing is lost if an add-on or trial ends.
-- Depends on 008, 028, 031, 041, 044. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.study_courses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 80),
  code         text not null default '' check (length(code) <= 20),
  color        text not null default '#34d399' check (color ~ '^#[0-9a-fA-F]{6}$'),
  lecturer     text not null default '' check (length(lecturer) <= 80),
  credit_hours integer check (credit_hours is null or credit_hours between 0 and 30),
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists study_courses_user on luma.study_courses (user_id);

create table if not exists luma.study_classes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id  uuid not null references luma.study_courses(id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),   -- 0 = Sunday … 6 = Saturday
  start_time time not null,
  end_time   time not null,
  room       text not null default '' check (length(room) <= 60),
  kind       text not null default 'lecture' check (kind in ('lecture', 'tutorial', 'lab', 'other')),
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index if not exists study_classes_user on luma.study_classes (user_id, weekday);

create table if not exists luma.study_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id    uuid references luma.study_courses(id) on delete set null,
  title        text not null check (length(btrim(title)) between 1 and 140),
  kind         text not null default 'assignment' check (kind in ('assignment', 'quiz', 'test', 'exam', 'project', 'other')),
  due_date     date,
  due_time     time,
  weight       numeric(5,2) check (weight is null or weight between 0 and 100),   -- % of the course grade
  score        numeric(7,2) check (score is null or score >= 0),
  max_score    numeric(7,2) check (max_score is null or max_score > 0),
  status       text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  notes        text not null default '' check (length(notes) <= 1000),
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists study_tasks_user on luma.study_tasks (user_id, due_date);

-- ---------- security: your own rows only; changes need the Study add-on ----------
do $$
declare t text;
begin
  foreach t in array array['study_courses', 'study_classes', 'study_tasks'] loop
    execute format('alter table luma.%I enable row level security', t);
    execute format('drop policy if exists %I on luma.%I', t || '_read', t);
    execute format('drop policy if exists %I on luma.%I', t || '_insert', t);
    execute format('drop policy if exists %I on luma.%I', t || '_update', t);
    execute format('drop policy if exists %I on luma.%I', t || '_delete', t);
    execute format('create policy %I on luma.%I for select to authenticated using (user_id = auth.uid())', t || '_read', t);
    execute format('create policy %I on luma.%I for insert to authenticated with check (user_id = auth.uid() and luma.has_addon(auth.uid(), ''study''))', t || '_insert', t);
    execute format('create policy %I on luma.%I for update to authenticated using (user_id = auth.uid() and luma.has_addon(auth.uid(), ''study'')) with check (user_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on luma.%I for delete to authenticated using (user_id = auth.uid())', t || '_delete', t);
    execute format('revoke all on luma.%I from anon', t);
    execute format('grant select, insert, update, delete on luma.%I to authenticated', t);
  end loop;
end $$;

-- a course, class or task must belong to the same person as its course
create or replace function luma.study_check_owner()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.course_id is not null and not exists (select 1 from luma.study_courses c where c.id = new.course_id and c.user_id = new.user_id) then
    raise exception 'That subject is not yours';
  end if;
  return new;
end;
$$;
drop trigger if exists study_classes_owner on luma.study_classes;
create trigger study_classes_owner before insert or update on luma.study_classes for each row execute function luma.study_check_owner();
drop trigger if exists study_tasks_owner on luma.study_tasks;
create trigger study_tasks_owner before insert or update on luma.study_tasks for each row execute function luma.study_check_owner();

-- sensible caps so one account can't fill the database (args: cap, label)
create or replace function luma.study_cap()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_n int;
begin
  execute format('select count(*) from luma.%I where user_id = $1', tg_table_name) into v_n using new.user_id;
  if v_n >= tg_argv[0]::int then raise exception 'You have reached the limit of % %', tg_argv[0], tg_argv[1]; end if;
  return new;
end;
$$;
drop trigger if exists study_courses_cap on luma.study_courses;
create trigger study_courses_cap before insert on luma.study_courses for each row execute function luma.study_cap('40', 'subjects');
drop trigger if exists study_classes_cap on luma.study_classes;
create trigger study_classes_cap before insert on luma.study_classes for each row execute function luma.study_cap('200', 'classes');
drop trigger if exists study_tasks_cap on luma.study_tasks;
create trigger study_tasks_cap before insert on luma.study_tasks for each row execute function luma.study_cap('1500', 'assignments');

-- keep completed_at in step with the status
create or replace function luma.study_task_done()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.completed_at := now();
  elsif new.status <> 'done' then new.completed_at := null; end if;
  return new;
end;
$$;
drop trigger if exists study_tasks_done on luma.study_tasks;
create trigger study_tasks_done before insert or update on luma.study_tasks for each row execute function luma.study_task_done();

-- ---------- Focus sessions can be tagged with a subject ----------
alter table luma.focus_sessions add column if not exists course_id uuid references luma.study_courses(id) on delete set null;
create index if not exists focus_sessions_course on luma.focus_sessions (course_id);

-- ---------- reminders ----------
-- (on Dawn the study reminder time and lead are fixed, like every other reminder time — see 038)
alter table luma.reminder_prefs add column if not exists study_on boolean not null default true;
alter table luma.reminder_prefs add column if not exists study_hour integer not null default 9;
alter table luma.reminder_prefs add column if not exists study_days integer not null default 3;
alter table luma.reminder_prefs drop constraint if exists reminder_prefs_study_hour_check;
alter table luma.reminder_prefs add constraint reminder_prefs_study_hour_check check (study_hour between 0 and 23);
alter table luma.reminder_prefs drop constraint if exists reminder_prefs_study_days_check;
alter table luma.reminder_prefs add constraint reminder_prefs_study_days_check check (study_days between 1 and 14);

create or replace function luma.run_study_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_today date;
  v_on boolean;
  v_hour int;
  v_days int;
  v_off int;
  v_title text;
  v_count int := 0;
begin
  for r in
    select s.*, c.name as course_name
    from luma.study_tasks s
    left join luma.study_courses c on c.id = s.course_id
    where s.status <> 'done' and s.due_date is not null and s.due_date between current_date - 1 and current_date + 15
  loop
    continue when not luma.has_addon(r.user_id, 'study');
    select coalesce(bool_and(p.study_on), true), coalesce(max(p.study_hour), 9), coalesce(max(p.study_days), 3) into v_on, v_hour, v_days
      from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
    v_today := v_now::date;
    foreach v_off in array array[v_days, 1, 0] loop
      continue when r.due_date <> v_today + v_off;
      v_title := '🎓 ' || r.title || case when v_off = 0 then ' is due today' else ' is due ' || luma.days_text(v_off, 'in') end;
      continue when exists (
        select 1 from luma.notifications n
        where n.user_id = r.user_id and n.type = 'reminder_study' and n.ref = r.id and n.title = v_title and n.created_at > now() - interval '12 hours');
      insert into luma.notifications (user_id, type, title, body, link, ref)
      values (r.user_id, 'reminder_study', v_title,
        initcap(r.kind) || coalesce(' · ' || r.course_name, '') || case when r.due_time is not null then ' · ' || to_char(r.due_time, 'FMHH12:MI am') else '' end,
        'study', r.id);
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_study_reminders() from public, anon, authenticated;

create or replace function luma.enforce_reminder_timing()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(luma.limit_of(new.user_id, 'timing'), 1) = 0 and (
       new.event_lead_min <> 15 or new.allday_hour <> 8 or new.task_hour <> 9 or new.bill_hour <> 9 or new.bill_days <> 3
    or new.sub_hour <> 9 or new.sub_days <> 3 or new.goal_hour <> 9 or new.goal_days <> 3 or new.budget_pct <> 80
    or new.study_hour <> 9 or new.study_days <> 3) then
    raise exception 'Plan limit: choosing reminder times and the budget warning level is available on Glow and Zenith. You can still switch each reminder on or off.';
  end if;
  return new;
end;
$$;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-study-reminders') then perform cron.unschedule('luma-study-reminders'); end if;
  perform cron.schedule('luma-study-reminders', '0 * * * *', 'select luma.run_study_reminders()');
exception when others then
  raise notice 'Could not schedule the study reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
