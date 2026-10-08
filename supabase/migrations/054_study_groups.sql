-- ============================================================
-- LUMA — migration 054: group projects for Study.
--   • Create a project, invite your ACCEPTED CONTACTS (classmates), split the work into tasks and assign them, keep shared notes,
--     and give a teammate a nudge.
--   • Members only ever see the projects they are in. Everything goes through the functions below (the tables themselves can't be
--     read or written directly), and each function checks who is asking.
--   • The organiser pays: invited classmates can use the group even without their own Study add-on.
--   • Limits: 20 projects you own, 12 members and 200 tasks per project, a nudge to the same person at most once every 6 hours.
-- Depends on 044, 046, 008 (notifications), 048 (luma.person_name). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.study_projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 120),
  course_name text not null default '' check (length(course_name) <= 80),
  due_date    date,
  notes       text not null default '' check (length(notes) <= 5000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists luma.study_project_members (
  project_id uuid not null references luma.study_projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists study_project_members_user on luma.study_project_members (user_id, status);
create table if not exists luma.study_project_tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references luma.study_projects(id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 140),
  assignee_id uuid references auth.users(id) on delete set null,
  status      text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  due_date    date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists study_project_tasks_project on luma.study_project_tasks (project_id);
create table if not exists luma.study_nudges (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references luma.study_projects(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists study_nudges_pair on luma.study_nudges (from_user, to_user, project_id, created_at desc);

alter table luma.study_projects enable row level security;
alter table luma.study_project_members enable row level security;
alter table luma.study_project_tasks enable row level security;
alter table luma.study_nudges enable row level security;
revoke all on luma.study_projects, luma.study_project_members, luma.study_project_tasks, luma.study_nudges from anon, authenticated;

-- is p_user an accepted member (or the owner) of the project?
create or replace function luma.in_project(p_project uuid, p_user uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from luma.study_project_members m where m.project_id = p_project and m.user_id = p_user and m.status = 'accepted');
$$;
revoke execute on function luma.in_project(uuid, uuid) from public, anon, authenticated;

create or replace function luma.is_contact(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (select 1 from luma.contacts c where c.status = 'accepted'
                 and ((c.requester_id = p_a and c.addressee_id = p_b) or (c.addressee_id = p_a and c.requester_id = p_b)));
$$;
revoke execute on function luma.is_contact(uuid, uuid) from public, anon, authenticated;

-- create a project (needs the Study add-on); you become its first member
create or replace function luma.create_study_project(p_title text, p_course text, p_due date, p_notes text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not luma.has_my_addon('study') then raise exception 'Creating a group project needs the Study add-on'; end if;
  if (select count(*) from luma.study_projects where owner_id = auth.uid()) >= 20 then raise exception 'You can own up to 20 group projects'; end if;
  insert into luma.study_projects (owner_id, title, course_name, due_date, notes)
    values (auth.uid(), btrim(coalesce(p_title, '')), left(coalesce(p_course, ''), 80), p_due, left(coalesce(p_notes, ''), 5000)) returning id into v_id;
  insert into luma.study_project_members (project_id, user_id, status, invited_by) values (v_id, auth.uid(), 'accepted', auth.uid());
  return v_id;
end;
$$;
revoke execute on function luma.create_study_project(text, text, date, text) from public, anon;
grant execute on function luma.create_study_project(text, text, date, text) to authenticated;

-- owner invites accepted contacts
create or replace function luma.invite_to_study_project(p_project uuid, p_users uuid[])
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare v_title text; v_user uuid; v_count int := 0; v_total int; v_old text;
begin
  select title into v_title from luma.study_projects where id = p_project and owner_id = auth.uid();
  if not found then raise exception 'Only the project owner can invite people'; end if;
  select count(*) into v_total from luma.study_project_members where project_id = p_project and status <> 'declined';
  foreach v_user in array coalesce(p_users, '{}'::uuid[]) loop
    continue when v_user = auth.uid();
    if not luma.is_contact(auth.uid(), v_user) then raise exception 'You can only invite people in your contacts'; end if;
    select status into v_old from luma.study_project_members where project_id = p_project and user_id = v_user;
    continue when found and v_old <> 'declined';
    if v_total >= 12 then raise exception 'A group project can have up to 12 members'; end if;
    insert into luma.study_project_members (project_id, user_id, status, invited_by) values (p_project, v_user, 'pending', auth.uid())
      on conflict (project_id, user_id) do update set status = 'pending', invited_by = auth.uid(), created_at = now();
    v_total := v_total + 1; v_count := v_count + 1;
    perform luma.notify(v_user, 'project_invite', '🤝 ' || luma.person_name(auth.uid()) || ' invited you to a group project', v_title || '. Open Study → Groups to join.', 'study');
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.invite_to_study_project(uuid, uuid[]) from public, anon;
grant execute on function luma.invite_to_study_project(uuid, uuid[]) to authenticated;

-- the invited person joins or declines
create or replace function luma.respond_study_project(p_project uuid, p_accept boolean)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_owner uuid; v_title text;
begin
  update luma.study_project_members set status = case when p_accept then 'accepted' else 'declined' end
    where project_id = p_project and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'No invitation found'; end if;
  select owner_id, title into v_owner, v_title from luma.study_projects where id = p_project;
  perform luma.notify(v_owner, 'project_reply', (case when p_accept then '✅ ' else '❌ ' end) || luma.person_name(auth.uid()) || (case when p_accept then ' joined ' else ' declined ' end) || v_title, 'Open Study → Groups.', 'study');
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;
revoke execute on function luma.respond_study_project(uuid, boolean) from public, anon;
grant execute on function luma.respond_study_project(uuid, boolean) to authenticated;

-- a member leaves; or the owner removes someone (their tasks become unassigned)
create or replace function luma.leave_study_project(p_project uuid, p_user uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (select 1 from luma.study_projects where id = p_project and owner_id = p_user) then raise exception 'The owner cannot leave; delete the project instead'; end if;
  if p_user <> auth.uid() and not exists (select 1 from luma.study_projects where id = p_project and owner_id = auth.uid()) then raise exception 'Not allowed'; end if;
  delete from luma.study_project_members where project_id = p_project and user_id = p_user;
  update luma.study_project_tasks set assignee_id = null where project_id = p_project and assignee_id = p_user;
  return true;
end;
$$;
revoke execute on function luma.leave_study_project(uuid, uuid) from public, anon;
grant execute on function luma.leave_study_project(uuid, uuid) to authenticated;

-- my projects (accepted, and invitations waiting for me)
create or replace function luma.my_study_projects()
returns table (id uuid, title text, course_name text, due_date date, owner_id uuid, owner_name text, my_status text, members integer, tasks_total integer, tasks_done integer, updated_at timestamptz)
language sql
stable
security definer set search_path = ''
as $$
  select p.id, p.title, p.course_name, p.due_date, p.owner_id, luma.person_name(p.owner_id), m.status,
         (select count(*)::int from luma.study_project_members x where x.project_id = p.id and x.status = 'accepted'),
         (select count(*)::int from luma.study_project_tasks t where t.project_id = p.id and m.status = 'accepted'),
         (select count(*)::int from luma.study_project_tasks t where t.project_id = p.id and t.status = 'done' and m.status = 'accepted'),
         p.updated_at
  from luma.study_project_members m
  join luma.study_projects p on p.id = m.project_id
  where m.user_id = auth.uid() and m.status in ('pending', 'accepted')
  order by p.updated_at desc;
$$;
revoke execute on function luma.my_study_projects() from public, anon;
grant execute on function luma.my_study_projects() to authenticated;

-- one project with its members and tasks (invited people see only the basics until they join)
create or replace function luma.study_project_detail(p_project uuid)
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare v_status text; v_p record;
begin
  select status into v_status from luma.study_project_members where project_id = p_project and user_id = auth.uid();
  if v_status is null or v_status = 'declined' then raise exception 'Not allowed'; end if;
  select * into v_p from luma.study_projects where id = p_project;
  return jsonb_build_object(
    'project', jsonb_build_object('id', v_p.id, 'title', v_p.title, 'course_name', v_p.course_name, 'due_date', v_p.due_date, 'owner_id', v_p.owner_id,
                                  'notes', case when v_status = 'accepted' then v_p.notes else '' end),
    'me', jsonb_build_object('user_id', auth.uid(), 'status', v_status),
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', luma.person_name(m.user_id), 'status', m.status) order by (m.user_id = v_p.owner_id) desc, luma.person_name(m.user_id))
                         from luma.study_project_members m where m.project_id = p_project and m.status <> 'declined'), '[]'::jsonb),
    'tasks', case when v_status = 'accepted' then coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'assignee_id', t.assignee_id, 'status', t.status, 'due_date', t.due_date, 'created_by', t.created_by) order by t.created_at)
                         from luma.study_project_tasks t where t.project_id = p_project), '[]'::jsonb) else '[]'::jsonb end);
end;
$$;
revoke execute on function luma.study_project_detail(uuid) from public, anon;
grant execute on function luma.study_project_detail(uuid) to authenticated;

-- owner edits the project; any member can edit the shared notes (p_fields: title, course_name, due_date, notes)
create or replace function luma.update_study_project(p_project uuid, p_fields jsonb)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare v_owner boolean;
begin
  if not luma.in_project(p_project, auth.uid()) then raise exception 'Not allowed'; end if;
  v_owner := exists (select 1 from luma.study_projects where id = p_project and owner_id = auth.uid());
  if not v_owner and (p_fields ? 'title' or p_fields ? 'course_name' or p_fields ? 'due_date') then raise exception 'Only the owner can change the title, subject and due date'; end if;
  update luma.study_projects set
    title = case when p_fields ? 'title' then btrim(p_fields ->> 'title') else title end,
    course_name = case when p_fields ? 'course_name' then left(coalesce(p_fields ->> 'course_name', ''), 80) else course_name end,
    due_date = case when p_fields ? 'due_date' then nullif(p_fields ->> 'due_date', '')::date else due_date end,
    notes = case when p_fields ? 'notes' then left(coalesce(p_fields ->> 'notes', ''), 5000) else notes end,
    updated_at = now()
  where id = p_project;
  return true;
end;
$$;
revoke execute on function luma.update_study_project(uuid, jsonb) from public, anon;
grant execute on function luma.update_study_project(uuid, jsonb) to authenticated;

create or replace function luma.delete_study_project(p_project uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  delete from luma.study_projects where id = p_project and owner_id = auth.uid();
  if not found then raise exception 'Only the owner can delete the project'; end if;
  return true;
end;
$$;
revoke execute on function luma.delete_study_project(uuid) from public, anon;
grant execute on function luma.delete_study_project(uuid) to authenticated;

-- tasks: any member can add, assign and update; the creator or the owner can delete
create or replace function luma.add_study_project_task(p_project uuid, p_title text, p_assignee uuid, p_due date)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare v_id uuid; v_title text;
begin
  if not luma.in_project(p_project, auth.uid()) then raise exception 'Not allowed'; end if;
  if (select count(*) from luma.study_project_tasks where project_id = p_project) >= 200 then raise exception 'A project can have up to 200 tasks'; end if;
  if p_assignee is not null and not luma.in_project(p_project, p_assignee) then raise exception 'That person is not on this project'; end if;
  insert into luma.study_project_tasks (project_id, title, assignee_id, due_date, created_by) values (p_project, btrim(coalesce(p_title, '')), p_assignee, p_due, auth.uid()) returning id into v_id;
  update luma.study_projects set updated_at = now() where id = p_project;
  if p_assignee is not null and p_assignee <> auth.uid() then
    select title into v_title from luma.study_projects where id = p_project;
    perform luma.notify(p_assignee, 'project_task', '📌 ' || luma.person_name(auth.uid()) || ' gave you a task', btrim(p_title) || ' · ' || v_title, 'study');
  end if;
  return v_id;
end;
$$;
revoke execute on function luma.add_study_project_task(uuid, text, uuid, date) from public, anon;
grant execute on function luma.add_study_project_task(uuid, text, uuid, date) to authenticated;

-- p_fields: any of title, assignee_id (null = unassign), status, due_date (null = clear)
create or replace function luma.update_study_project_task(p_task uuid, p_fields jsonb)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare v_t record; v_new uuid; v_title text;
begin
  select * into v_t from luma.study_project_tasks where id = p_task;
  if not found or not luma.in_project(v_t.project_id, auth.uid()) then raise exception 'Not allowed'; end if;
  if p_fields ? 'assignee_id' then
    v_new := nullif(p_fields ->> 'assignee_id', '')::uuid;
    if v_new is not null and not luma.in_project(v_t.project_id, v_new) then raise exception 'That person is not on this project'; end if;
  else
    v_new := v_t.assignee_id;
  end if;
  update luma.study_project_tasks set
    title = case when p_fields ? 'title' then btrim(p_fields ->> 'title') else title end,
    assignee_id = v_new,
    status = case when p_fields ? 'status' then p_fields ->> 'status' else status end,
    due_date = case when p_fields ? 'due_date' then nullif(p_fields ->> 'due_date', '')::date else due_date end,
    updated_at = now()
  where id = p_task;
  update luma.study_projects set updated_at = now() where id = v_t.project_id;
  if p_fields ? 'assignee_id' and v_new is not null and v_new is distinct from v_t.assignee_id and v_new <> auth.uid() then
    select title into v_title from luma.study_projects where id = v_t.project_id;
    perform luma.notify(v_new, 'project_task', '📌 ' || luma.person_name(auth.uid()) || ' gave you a task', v_t.title || ' · ' || v_title, 'study');
  end if;
  return true;
end;
$$;
revoke execute on function luma.update_study_project_task(uuid, jsonb) from public, anon;
grant execute on function luma.update_study_project_task(uuid, jsonb) to authenticated;

create or replace function luma.delete_study_project_task(p_task uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare v_t record;
begin
  select * into v_t from luma.study_project_tasks where id = p_task;
  if not found then return true; end if;
  if not luma.in_project(v_t.project_id, auth.uid()) then raise exception 'Not allowed'; end if;
  if v_t.created_by is distinct from auth.uid() and not exists (select 1 from luma.study_projects where id = v_t.project_id and owner_id = auth.uid()) then
    raise exception 'Only the person who added a task, or the owner, can delete it';
  end if;
  delete from luma.study_project_tasks where id = p_task;
  return true;
end;
$$;
revoke execute on function luma.delete_study_project_task(uuid) from public, anon;
grant execute on function luma.delete_study_project_task(uuid) to authenticated;

-- give a teammate a nudge (about the project, or one task); once every 6 hours per person
create or replace function luma.nudge_study_project_member(p_project uuid, p_user uuid, p_task uuid default null)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_title text; v_task text;
begin
  if not luma.in_project(p_project, auth.uid()) or not luma.in_project(p_project, p_user) or p_user = auth.uid() then raise exception 'Not allowed'; end if;
  if exists (select 1 from luma.study_nudges n where n.from_user = auth.uid() and n.to_user = p_user and n.project_id = p_project and n.created_at > now() - interval '6 hours') then
    return 'too_soon';
  end if;
  select title into v_title from luma.study_projects where id = p_project;
  if p_task is not null then select title into v_task from luma.study_project_tasks where id = p_task and project_id = p_project; end if;
  insert into luma.study_nudges (from_user, to_user, project_id) values (auth.uid(), p_user, p_project);
  perform luma.notify(p_user, 'nudge', '👋 ' || luma.person_name(auth.uid()) || ' nudged you', coalesce('About "' || v_task || '" in ', 'About ') || v_title || '. Any update?', 'study');
  return 'sent';
end;
$$;
revoke execute on function luma.nudge_study_project_member(uuid, uuid, uuid) from public, anon;
grant execute on function luma.nudge_study_project_member(uuid, uuid, uuid) to authenticated;
