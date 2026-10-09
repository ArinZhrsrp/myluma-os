-- ============================================================
-- LUMA — migration 072: Work tasks get a start date and an end date, and can be given to several people.
--   • work_tasks.start_date (new) and due_date (now called the end date in the app; start must not be after end).
--   • work_tasks.assignee_ids: a list of people (all must be on the project, up to 10) instead of a single assignee_id.
--     Existing single assignees are carried over. Each person added to a task is told, and the notification opens the task.
-- Depends on 071. Safe to re-run.
-- ============================================================

alter table luma.work_tasks add column if not exists start_date date;
alter table luma.work_tasks drop constraint if exists work_tasks_dates_check;
alter table luma.work_tasks add constraint work_tasks_dates_check check (start_date is null or due_date is null or start_date <= due_date);

alter table luma.work_tasks add column if not exists assignee_ids uuid[] not null default '{}';
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'luma' and table_name = 'work_tasks' and column_name = 'assignee_id') then
    update luma.work_tasks set assignee_ids = array[assignee_id] where assignee_id is not null and cardinality(assignee_ids) = 0;
    drop index if exists luma.work_tasks_assignee_idx;
    alter table luma.work_tasks drop column assignee_id;
  end if;
end $$;
alter table luma.work_tasks drop constraint if exists work_tasks_assignees_check;
alter table luma.work_tasks add constraint work_tasks_assignees_check check (cardinality(assignee_ids) <= 10);
create index if not exists work_tasks_assignees_idx on luma.work_tasks using gin (assignee_ids);

create or replace function luma.work_task_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_a uuid;
begin
  if tg_op = 'INSERT' and (select count(*) from luma.work_tasks where project_id = new.project_id) >= 1500 then raise exception 'A project can have up to 1,500 tasks'; end if;
  new.assignee_ids := coalesce((select array_agg(distinct x) from unnest(new.assignee_ids) x), '{}'::uuid[]);
  foreach v_a in array new.assignee_ids loop
    if luma.work_role(new.project_id, v_a) is null then raise exception 'That person is not on this project'; end if;
  end loop;
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then raise exception 'A task can not move to another project'; end if;
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.completed_at := now();
  elsif new.status <> 'done' then new.completed_at := null; end if;
  return new;
end;
$$;

create or replace function luma.work_task_assigned()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_a uuid; v_proj text;
begin
  select name into v_proj from luma.work_projects where id = new.project_id;
  foreach v_a in array new.assignee_ids loop
    continue when v_a = coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
    continue when tg_op = 'UPDATE' and v_a = any (old.assignee_ids);
    perform luma.notify(v_a, 'work_task', '📌 ' || luma.person_name(auth.uid()) || ' gave you a task', new.title || ' · ' || v_proj, 'work', new.id);
  end loop;
  update luma.work_projects set updated_at = now() where id = new.project_id;
  return null;
end;
$$;

create or replace function luma.work_remove_member(p_project uuid, p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not (p_user = auth.uid() or exists (select 1 from luma.work_projects where id = p_project and owner_id = auth.uid())) then raise exception 'Not allowed'; end if;
  delete from luma.work_project_members where project_id = p_project and user_id = p_user;
  update luma.work_tasks set assignee_ids = array_remove(assignee_ids, p_user) where project_id = p_project and p_user = any (assignee_ids);
end;
$$;
