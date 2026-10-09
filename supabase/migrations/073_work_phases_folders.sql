-- LUMA — Work: project phases and folders.
--   • A project is either 'project' (six fixed phases: Planning, Requirement study, Design, Development, Testing, Deployment)
--     or 'general' (documentation, approvals, memos…: the owner makes their own folders instead of phases).
--   • Each phase / folder has a notes area; tasks can be put in one (work_tasks.folder_id).
-- Run after 072.

alter table luma.work_projects add column if not exists kind text not null default 'project';
alter table luma.work_projects drop constraint if exists work_projects_kind_check;
alter table luma.work_projects add constraint work_projects_kind_check check (kind in ('project', 'general'));

create table if not exists luma.work_folders (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references luma.work_projects (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 80),
  notes      text not null default '' check (length(notes) <= 8000),
  position   integer not null default 0,
  is_phase   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists work_folders_project_idx on luma.work_folders (project_id, position);

alter table luma.work_tasks add column if not exists folder_id uuid references luma.work_folders (id) on delete set null;
create index if not exists work_tasks_folder_idx on luma.work_tasks (folder_id);

alter table luma.work_folders enable row level security;
drop policy if exists work_folders_read on luma.work_folders;
drop policy if exists work_folders_insert on luma.work_folders;
drop policy if exists work_folders_update on luma.work_folders;
drop policy if exists work_folders_delete on luma.work_folders;
create policy work_folders_read on luma.work_folders for select to authenticated using (luma.work_role(project_id, auth.uid()) is not null);
create policy work_folders_insert on luma.work_folders for insert to authenticated with check (luma.work_can_edit(project_id) and not is_phase);
create policy work_folders_update on luma.work_folders for update to authenticated using (luma.work_can_edit(project_id)) with check (luma.work_can_edit(project_id));
create policy work_folders_delete on luma.work_folders for delete to authenticated using (luma.work_can_edit(project_id) and not is_phase);
revoke all on luma.work_folders from anon, authenticated;
grant select, insert, update, delete on luma.work_folders to authenticated;

-- guard: limits, phases keep their name, nothing moves between projects
create or replace function luma.work_folder_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select kind from luma.work_projects where id = new.project_id) <> 'general' and not new.is_phase then raise exception 'Phases are fixed; folders are only for general projects'; end if;
    if (select count(*) from luma.work_folders where project_id = new.project_id) >= 40 then raise exception 'A project can have up to 40 folders'; end if;
  else
    if new.project_id <> old.project_id then raise exception 'A folder can not move to another project'; end if;
    if old.is_phase then new.name := old.name; new.is_phase := true; new.position := old.position; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists work_folders_guard on luma.work_folders;
create trigger work_folders_guard before insert or update on luma.work_folders for each row execute function luma.work_folder_guard();

-- a task's folder must belong to the same project
create or replace function luma.work_task_folder_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.folder_id is not null and not exists (select 1 from luma.work_folders where id = new.folder_id and project_id = new.project_id) then
    raise exception 'That phase or folder is not in this project';
  end if;
  return new;
end;
$$;
drop trigger if exists work_tasks_folder_guard on luma.work_tasks;
create trigger work_tasks_folder_guard before insert or update on luma.work_tasks for each row execute function luma.work_task_folder_guard();

-- a new 'project' gets its six phases
create or replace function luma.work_project_phases()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.kind = 'project' then
    insert into luma.work_folders (project_id, name, position, is_phase)
    select new.id, n, i, true from unnest(array['Planning', 'Requirement study', 'Design', 'Development', 'Testing', 'Deployment']) with ordinality as x(n, i);
  end if;
  return null;
end;
$$;
drop trigger if exists work_projects_phases on luma.work_projects;
create trigger work_projects_phases after insert on luma.work_projects for each row execute function luma.work_project_phases();

-- projects that already exist get the phases too
insert into luma.work_folders (project_id, name, position, is_phase)
select p.id, x.n, x.i, true from luma.work_projects p
cross join unnest(array['Planning', 'Requirement study', 'Design', 'Development', 'Testing', 'Deployment']) with ordinality as x(n, i)
where p.kind = 'project' and not exists (select 1 from luma.work_folders f where f.project_id = p.id);

-- shared projects also say what kind they are
create or replace function luma.my_work_shared()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'client', p.client, 'color', p.color, 'status', p.status, 'deadline', p.deadline, 'kind', p.kind,
    'owner_id', p.owner_id, 'owner_name', luma.person_name(p.owner_id), 'my_role', m.role, 'my_status', m.status,
    'tasks', (select count(*) from luma.work_tasks t where t.project_id = p.id and m.status = 'accepted'),
    'done', (select count(*) from luma.work_tasks t where t.project_id = p.id and t.status = 'done' and m.status = 'accepted')) order by p.updated_at desc), '[]'::jsonb)
  from luma.work_project_members m join luma.work_projects p on p.id = m.project_id
  where m.user_id = auth.uid() and m.status in ('pending', 'accepted');
$$;
revoke execute on function luma.my_work_shared() from public, anon;
grant execute on function luma.my_work_shared() to authenticated;
