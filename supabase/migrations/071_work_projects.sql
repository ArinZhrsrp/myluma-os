-- ============================================================
-- LUMA — migration 071: Work add-on, step 1: projects, tasks and the people on them.
--   • luma.work_projects: a project (name, client, colour, status, deadline). Only someone with the Work add-on can create one.
--   • luma.work_tasks: its tasks (Board columns To do / Doing / Review / Done, assignee, due date, checklist).
--   • luma.work_project_members: people the owner invited from their CONTACTS (people who already have a LUMA account).
--   • Who can do what:
--       owner  — everything in their projects (needs the Work add-on to create or change things);
--       member — sees the project and can add and change tasks, but ONLY while they have the Work add-on themselves;
--       viewer — can only look.
--     A person WITHOUT the Work add-on who was added to a project can only LOOK at what they were added to (read-only), however they were invited.
--   • Limits: 60 projects per person, 15 people per project, 1,500 tasks per project, 30 checklist steps per task.
--   • The tables are protected by row-level rules; inviting and answering invitations go through functions that check who is asking.
-- Depends on 046 (luma.has_my_addon), 048 (person_name), 054 (is_contact), 064 (notify with a reference). Safe to re-run.
-- ============================================================

create table if not exists luma.work_projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 80),
  client      text not null default '' check (length(client) <= 80),
  color       text not null default '#fb923c' check (color ~ '^#[0-9a-fA-F]{6}$'),
  status      text not null default 'active' check (status in ('active', 'on_hold', 'done', 'archived')),
  deadline    date,
  description text not null default '' check (length(description) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists work_projects_owner_idx on luma.work_projects (owner_id, created_at desc);

create table if not exists luma.work_project_members (
  project_id uuid not null references luma.work_projects (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('member', 'viewer')),
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists work_project_members_user_idx on luma.work_project_members (user_id, status);

create table if not exists luma.work_tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references luma.work_projects (id) on delete cascade,
  title        text not null check (length(btrim(title)) between 1 and 140),
  description  text not null default '' check (length(description) <= 4000),
  status       text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  priority     text not null default 'med' check (priority in ('low', 'med', 'high')),
  assignee_id  uuid references auth.users (id) on delete set null,
  due_date     date,
  position     integer not null default 0,
  checklist    jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 30),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists work_tasks_project_idx on luma.work_tasks (project_id, status, position);
create index if not exists work_tasks_assignee_idx on luma.work_tasks (assignee_id, status);

-- ---------- who is who ----------
-- 'owner', 'member', 'viewer' (accepted only), or null
create or replace function luma.work_role(p_project uuid, p_user uuid)
returns text
language sql
stable
security definer set search_path = ''
as $$
  select case when p.owner_id = p_user then 'owner'
              else (select m.role from luma.work_project_members m where m.project_id = p.id and m.user_id = p_user and m.status = 'accepted') end
  from luma.work_projects p where p.id = p_project;
$$;
revoke execute on function luma.work_role(uuid, uuid) from public, anon;
grant execute on function luma.work_role(uuid, uuid) to authenticated;

-- may the signed-in person change things in this project? (owner or member, and only while they have the Work add-on)
create or replace function luma.work_can_edit(p_project uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$ select coalesce(luma.work_role(p_project, auth.uid()) in ('owner', 'member'), false) and luma.has_my_addon('work'); $$;
revoke execute on function luma.work_can_edit(uuid) from public, anon;
grant execute on function luma.work_can_edit(uuid) to authenticated;

-- ---------- row-level rules ----------
alter table luma.work_projects enable row level security;
alter table luma.work_project_members enable row level security;
alter table luma.work_tasks enable row level security;
drop policy if exists work_projects_read on luma.work_projects;
drop policy if exists work_projects_insert on luma.work_projects;
drop policy if exists work_projects_update on luma.work_projects;
drop policy if exists work_projects_delete on luma.work_projects;
create policy work_projects_read on luma.work_projects for select to authenticated using (owner_id = auth.uid() or luma.work_role(id, auth.uid()) is not null);   -- (the owner is checked directly so a brand-new row can be read back)
create policy work_projects_insert on luma.work_projects for insert to authenticated with check (owner_id = auth.uid() and luma.has_my_addon('work'));
create policy work_projects_update on luma.work_projects for update to authenticated using (owner_id = auth.uid() and luma.has_my_addon('work')) with check (owner_id = auth.uid());
create policy work_projects_delete on luma.work_projects for delete to authenticated using (owner_id = auth.uid());
drop policy if exists work_members_read on luma.work_project_members;
create policy work_members_read on luma.work_project_members for select to authenticated using (user_id = auth.uid() or luma.work_role(project_id, auth.uid()) is not null);
drop policy if exists work_tasks_read on luma.work_tasks;
drop policy if exists work_tasks_insert on luma.work_tasks;
drop policy if exists work_tasks_update on luma.work_tasks;
drop policy if exists work_tasks_delete on luma.work_tasks;
create policy work_tasks_read on luma.work_tasks for select to authenticated using (luma.work_role(project_id, auth.uid()) is not null);
create policy work_tasks_insert on luma.work_tasks for insert to authenticated with check (luma.work_can_edit(project_id));
create policy work_tasks_update on luma.work_tasks for update to authenticated using (luma.work_can_edit(project_id)) with check (luma.work_can_edit(project_id));
create policy work_tasks_delete on luma.work_tasks for delete to authenticated using (luma.work_role(project_id, auth.uid()) = 'owner' or (created_by = auth.uid() and luma.work_can_edit(project_id)));
revoke all on luma.work_projects, luma.work_project_members, luma.work_tasks from anon, authenticated;
grant select, insert, update, delete on luma.work_projects, luma.work_tasks to authenticated;
grant select on luma.work_project_members to authenticated;

-- ---------- limits and tidy-ups ----------
create or replace function luma.work_project_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from luma.work_projects where owner_id = new.owner_id) >= 60 then raise exception 'You can have up to 60 projects'; end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists work_projects_guard on luma.work_projects;
create trigger work_projects_guard before insert or update on luma.work_projects for each row execute function luma.work_project_guard();

create or replace function luma.work_task_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from luma.work_tasks where project_id = new.project_id) >= 1500 then raise exception 'A project can have up to 1,500 tasks'; end if;
  if new.assignee_id is not null and luma.work_role(new.project_id, new.assignee_id) is null then raise exception 'That person is not on this project'; end if;
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then raise exception 'A task can not move to another project'; end if;
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.completed_at := now();
  elsif new.status <> 'done' then new.completed_at := null; end if;
  return new;
end;
$$;
drop trigger if exists work_tasks_guard on luma.work_tasks;
create trigger work_tasks_guard before insert or update on luma.work_tasks for each row execute function luma.work_task_guard();

-- the person a task was given to hears about it (the notification opens that task)
create or replace function luma.work_task_assigned()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.assignee_id is not null and new.assignee_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform luma.notify(new.assignee_id, 'work_task', '📌 ' || luma.person_name(auth.uid()) || ' gave you a task',
      new.title || ' · ' || (select name from luma.work_projects where id = new.project_id), 'work', new.id);
  end if;
  update luma.work_projects set updated_at = now() where id = new.project_id;
  return null;
end;
$$;
drop trigger if exists work_tasks_assigned on luma.work_tasks;
create trigger work_tasks_assigned after insert or update on luma.work_tasks for each row execute function luma.work_task_assigned();

-- ---------- people on a project ----------
-- the owner invites people from their contacts (they need a LUMA account; they do not need the Work add-on to be added)
create or replace function luma.work_invite(p_project uuid, p_users uuid[], p_role text default 'member')
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare v_name text; v_user uuid; v_count int := 0; v_total int; v_old text;
begin
  if p_role not in ('member', 'viewer') then raise exception 'Unknown role'; end if;
  select name into v_name from luma.work_projects where id = p_project and owner_id = auth.uid();
  if not found then raise exception 'Only the project owner can invite people'; end if;
  if not luma.has_my_addon('work') then raise exception 'The Work add-on is needed to invite people'; end if;
  select count(*) into v_total from luma.work_project_members where project_id = p_project and status <> 'declined';
  foreach v_user in array coalesce(p_users, '{}'::uuid[]) loop
    continue when v_user = auth.uid();
    if not luma.is_contact(auth.uid(), v_user) then raise exception 'You can only invite people in your contacts'; end if;
    select status into v_old from luma.work_project_members where project_id = p_project and user_id = v_user;
    continue when found and v_old <> 'declined';
    if v_total >= 15 then raise exception 'A project can have up to 15 people'; end if;
    insert into luma.work_project_members (project_id, user_id, role, status, invited_by) values (p_project, v_user, p_role, 'pending', auth.uid())
      on conflict (project_id, user_id) do update set role = p_role, status = 'pending', invited_by = auth.uid(), created_at = now();
    v_total := v_total + 1; v_count := v_count + 1;
    perform luma.notify(v_user, 'work_invite', '💼 ' || luma.person_name(auth.uid()) || ' added you to a project', v_name || '. Open Work to accept.', 'work', p_project);
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.work_invite(uuid, uuid[], text) from public, anon;
grant execute on function luma.work_invite(uuid, uuid[], text) to authenticated;

create or replace function luma.work_respond(p_project uuid, p_accept boolean)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_owner uuid; v_name text;
begin
  update luma.work_project_members set status = case when p_accept then 'accepted' else 'declined' end where project_id = p_project and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'No invitation found'; end if;
  select owner_id, name into v_owner, v_name from luma.work_projects where id = p_project;
  perform luma.notify(v_owner, 'work_reply', (case when p_accept then '✅ ' else '❌ ' end) || luma.person_name(auth.uid()) || (case when p_accept then ' joined ' else ' declined ' end) || v_name, 'Open Work → Projects.', 'work', p_project);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;
revoke execute on function luma.work_respond(uuid, boolean) from public, anon;
grant execute on function luma.work_respond(uuid, boolean) to authenticated;

-- the owner removes anyone; anyone can remove themselves (their tasks become unassigned)
create or replace function luma.work_remove_member(p_project uuid, p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not (p_user = auth.uid() or exists (select 1 from luma.work_projects where id = p_project and owner_id = auth.uid())) then raise exception 'Not allowed'; end if;
  delete from luma.work_project_members where project_id = p_project and user_id = p_user;
  update luma.work_tasks set assignee_id = null where project_id = p_project and assignee_id = p_user;
end;
$$;
revoke execute on function luma.work_remove_member(uuid, uuid) from public, anon;
grant execute on function luma.work_remove_member(uuid, uuid) to authenticated;

create or replace function luma.work_set_role(p_project uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_role not in ('member', 'viewer') then raise exception 'Unknown role'; end if;
  if not exists (select 1 from luma.work_projects where id = p_project and owner_id = auth.uid()) then raise exception 'Only the project owner can change roles'; end if;
  update luma.work_project_members set role = p_role where project_id = p_project and user_id = p_user;
end;
$$;
revoke execute on function luma.work_set_role(uuid, uuid, text) from public, anon;
grant execute on function luma.work_set_role(uuid, uuid, text) to authenticated;

-- the people on a project, with names (only people on it can ask)
create or replace function luma.work_project_members(p_project uuid)
returns table (user_id uuid, name text, role text, status text, is_owner boolean)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if luma.work_role(p_project, auth.uid()) is null then raise exception 'Not allowed'; end if;
  return query
    select p.owner_id, luma.person_name(p.owner_id), 'owner'::text, 'accepted'::text, true from luma.work_projects p where p.id = p_project
    union all
    select m.user_id, luma.person_name(m.user_id), m.role, m.status, false from luma.work_project_members m
      where m.project_id = p_project and m.status <> 'declined' and (m.status = 'accepted' or luma.work_role(p_project, auth.uid()) = 'owner');
end;
$$;
revoke execute on function luma.work_project_members(uuid) from public, anon;
grant execute on function luma.work_project_members(uuid) to authenticated;

-- projects other people added me to (and invitations waiting for my answer), with their counts
create or replace function luma.my_work_shared()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', p.name, 'client', p.client, 'color', p.color, 'status', p.status, 'deadline', p.deadline,
    'owner_id', p.owner_id, 'owner_name', luma.person_name(p.owner_id), 'my_role', m.role, 'my_status', m.status,
    'tasks', (select count(*) from luma.work_tasks t where t.project_id = p.id and m.status = 'accepted'),
    'done', (select count(*) from luma.work_tasks t where t.project_id = p.id and t.status = 'done' and m.status = 'accepted')) order by p.updated_at desc), '[]'::jsonb)
  from luma.work_project_members m join luma.work_projects p on p.id = m.project_id
  where m.user_id = auth.uid() and m.status in ('pending', 'accepted');
$$;
revoke execute on function luma.my_work_shared() from public, anon;
grant execute on function luma.my_work_shared() to authenticated;

-- everyone on every project I am on (for avatars and the "assigned to" list), in one call
create or replace function luma.my_work_people()
returns table (project_id uuid, user_id uuid, name text, role text, status text)
language sql
stable
security definer set search_path = ''
as $$
  select p.id, p.owner_id, luma.person_name(p.owner_id), 'owner'::text, 'accepted'::text
    from luma.work_projects p where luma.work_role(p.id, auth.uid()) is not null
  union all
  select m.project_id, m.user_id, luma.person_name(m.user_id), m.role, m.status
    from luma.work_project_members m
    where m.status <> 'declined' and luma.work_role(m.project_id, auth.uid()) is not null
      and (m.status = 'accepted' or luma.work_role(m.project_id, auth.uid()) = 'owner');
$$;
revoke execute on function luma.my_work_people() from public, anon;
grant execute on function luma.my_work_people() to authenticated;
