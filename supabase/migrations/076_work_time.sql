-- ============================================================
-- LUMA — migration 076: Work time tracking.
--   • work_time_entries: your own hours. An entry is for a task, for a project, or "general" (not tied to a project: meetings, admin…),
--     always under a company. Projects other people shared with you can be logged too (those entries have no company of yours).
--   • A running timer is an entry with running_since set (one per person, works across devices). Stopping it saves the minutes.
--   • Rules: up to 24 hours per entry and per day; nothing can be logged for an archived company, for a viewer-only project, or without the Work add-on.
--   • work_time_summary(project): minutes per task for everyone on the project (totals only; each person's own entries stay private).
-- Depends on 071–075. Safe to re-run.
-- ============================================================

create table if not exists luma.work_time_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company_id    uuid references luma.work_companies (id) on delete cascade,
  project_id    uuid references luma.work_projects (id) on delete set null,
  task_id       uuid references luma.work_tasks (id) on delete set null,
  project_name  text,
  task_title    text,
  work_date     date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  minutes       integer not null default 0 check (minutes between 0 and 1440),
  note          text not null default '' check (length(note) <= 200),
  running_since timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists work_time_user_idx on luma.work_time_entries (user_id, work_date desc);
create index if not exists work_time_task_idx on luma.work_time_entries (task_id);
create index if not exists work_time_project_idx on luma.work_time_entries (project_id);
create unique index if not exists work_time_one_timer on luma.work_time_entries (user_id) where running_since is not null;

alter table luma.work_time_entries enable row level security;
drop policy if exists work_time_read on luma.work_time_entries;
drop policy if exists work_time_insert on luma.work_time_entries;
drop policy if exists work_time_update on luma.work_time_entries;
drop policy if exists work_time_delete on luma.work_time_entries;
create policy work_time_read on luma.work_time_entries for select to authenticated using (user_id = auth.uid());
create policy work_time_insert on luma.work_time_entries for insert to authenticated with check (user_id = auth.uid() and luma.has_my_addon('work'));
create policy work_time_update on luma.work_time_entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and luma.has_my_addon('work'));
create policy work_time_delete on luma.work_time_entries for delete to authenticated using (user_id = auth.uid());
revoke all on luma.work_time_entries from anon, authenticated;
grant select, insert, update, delete on luma.work_time_entries to authenticated;

create or replace function luma.work_time_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_proj record; v_task record; v_co record; v_other integer; v_stop boolean := tg_op = 'UPDATE' and ((old.running_since is not null and new.running_since is null)
    or (old.project_id is not null and new.project_id is null) or (old.task_id is not null and new.task_id is null and new.project_id is not distinct from old.project_id));   -- stopping a timer, or a task / project being deleted
begin
  if tg_op = 'INSERT' and (select count(*) from luma.work_time_entries where user_id = new.user_id) >= 20000 then raise exception 'You can keep up to 20,000 time entries'; end if;
  if not v_stop then
  if new.task_id is not null then
    select id, title, project_id into v_task from luma.work_tasks where id = new.task_id;
    if not found then raise exception 'Task not found'; end if;
    new.project_id := v_task.project_id; new.task_title := v_task.title;
  end if;
  if new.project_id is not null then
    select id, name, owner_id, company_id into v_proj from luma.work_projects where id = new.project_id;
    if not found then raise exception 'Project not found'; end if;
    if not luma.work_can_edit(new.project_id) then raise exception 'You can only log time on projects you can change (not as a viewer, and not in an archived company)'; end if;
    new.project_name := v_proj.name;
    new.company_id := case when v_proj.owner_id = new.user_id then v_proj.company_id else null end;
  else
    new.project_name := null; new.task_title := null;
    if new.company_id is null then raise exception 'Choose a company or a project'; end if;
    select owner_id, archived_at into v_co from luma.work_companies where id = new.company_id;
    if not found or v_co.owner_id <> new.user_id then raise exception 'That is not your company'; end if;
    if v_co.archived_at is not null then raise exception 'This company is archived: restore it to log time'; end if;
  end if;
  end if;   -- (stopping a timer, or a task / project being deleted, always works: nothing can get stuck)
  new.note := btrim(new.note);
  if new.running_since is not null then new.minutes := 0; end if;
  select coalesce(sum(minutes), 0) into v_other from luma.work_time_entries where user_id = new.user_id and work_date = new.work_date and id is distinct from new.id;
  if v_other + new.minutes > 1440 then raise exception 'A day can not have more than 24 hours logged'; end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists work_time_guard on luma.work_time_entries;
create trigger work_time_guard before insert or update on luma.work_time_entries for each row execute function luma.work_time_guard();

-- timer: starting one stops the one that was running
create or replace function luma.work_timer_stop()
returns luma.work_time_entries
language plpgsql
security definer set search_path = ''
as $$
declare v luma.work_time_entries; v_min integer; v_room integer;
begin
  select * into v from luma.work_time_entries where user_id = auth.uid() and running_since is not null;
  if not found then return null; end if;
  v_min := least(greatest(1, ceil(extract(epoch from now() - v.running_since) / 60)::integer), 720);   -- a forgotten timer counts at most 12 hours
  select 1440 - coalesce(sum(minutes), 0) into v_room from luma.work_time_entries where user_id = auth.uid() and work_date = v.work_date and id <> v.id;
  update luma.work_time_entries set minutes = greatest(least(v_min, v_room), 0), running_since = null where id = v.id returning * into v;
  return v;
end;
$$;
revoke execute on function luma.work_timer_stop() from public, anon;
grant execute on function luma.work_timer_stop() to authenticated;

create or replace function luma.work_timer_start(p_project uuid, p_task uuid, p_company uuid, p_note text)
returns luma.work_time_entries
language plpgsql
security definer set search_path = ''
as $$
declare v luma.work_time_entries;
begin
  if not luma.has_my_addon('work') then raise exception 'The Work add-on is needed to track time'; end if;
  perform luma.work_timer_stop();
  insert into luma.work_time_entries (project_id, task_id, company_id, note, running_since, minutes)
    values (p_project, p_task, p_company, coalesce(p_note, ''), now(), 0) returning * into v;
  return v;
end;
$$;
revoke execute on function luma.work_timer_start(uuid, uuid, uuid, text) from public, anon;
grant execute on function luma.work_timer_start(uuid, uuid, uuid, text) to authenticated;

-- minutes per task (everyone's time added up) for the people on a project
create or replace function luma.work_time_summary(p_project uuid)
returns table (task_id uuid, minutes bigint)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if luma.work_role(p_project, auth.uid()) is null then raise exception 'Not allowed'; end if;
  return query select e.task_id, sum(e.minutes)::bigint from luma.work_time_entries e where e.project_id = p_project group by e.task_id;
end;
$$;
revoke execute on function luma.work_time_summary(uuid) from public, anon;
grant execute on function luma.work_time_summary(uuid) to authenticated;
