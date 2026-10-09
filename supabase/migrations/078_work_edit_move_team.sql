-- ============================================================
-- LUMA — migration 078: Work comments can be edited (with history), tasks and projects can be moved, owners see their team's time.
--   • A comment's writer can edit it; every earlier wording is kept and can be looked at ("edited" → history). Up to 50 edits are kept.
--   • work_move_task(task, project): move a task to another project you can change (its checklist, comments, files and logged time come
--     along; assignees who aren't on the new project are dropped; the phase / folder is cleared). It can be in another company.
--   • work_move_project(project, company): the owner moves a project to another active company of theirs (their logged time follows).
--   • work_project_time(project, from, to): the project OWNER can see the hours everyone logged on that project. People are told this on
--     the Time tab. Everything else about time stays private to each person.
-- Depends on 071–077, 058. Safe to re-run.
-- ============================================================

-- ---------- editing comments, with history ----------
alter table luma.work_task_comments add column if not exists edited_at timestamptz;
create table if not exists luma.work_comment_edits (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references luma.work_task_comments (id) on delete cascade,
  old_body   text not null,
  edited_at  timestamptz not null default now()
);
create index if not exists work_comment_edits_idx on luma.work_comment_edits (comment_id, edited_at);
alter table luma.work_comment_edits enable row level security;
revoke all on luma.work_comment_edits from anon, authenticated;

drop policy if exists work_comments_update on luma.work_task_comments;
create policy work_comments_update on luma.work_task_comments for update to authenticated using (user_id = auth.uid() and luma.work_can_edit(project_id)) with check (user_id = auth.uid() and luma.work_can_edit(project_id));
grant update (body) on luma.work_task_comments to authenticated;

create or replace function luma.work_comment_edit_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.task_id <> old.task_id or new.user_id <> old.user_id or (new.project_id <> old.project_id and coalesce(current_setting('luma.moving', true), '') <> '1') then raise exception 'Only the wording can change'; end if;
  if new.body is not distinct from old.body then return new; end if;
  if (select count(*) from luma.work_comment_edits where comment_id = old.id) >= 50 then raise exception 'A comment can be edited up to 50 times'; end if;
  insert into luma.work_comment_edits (comment_id, old_body) values (old.id, old.body);
  new.edited_at := now();
  return new;
end;
$$;
drop trigger if exists work_comments_edit on luma.work_task_comments;
create trigger work_comments_edit before update on luma.work_task_comments for each row execute function luma.work_comment_edit_guard();

create or replace function luma.work_comment_history(p_comment uuid)
returns table (body text, edited_at timestamptz, is_current boolean)
language plpgsql
stable
security definer set search_path = ''
as $$
declare v_proj uuid;
begin
  select c.project_id into v_proj from luma.work_task_comments c where c.id = p_comment;
  if v_proj is null or luma.work_role(v_proj, auth.uid()) is null then raise exception 'Not allowed'; end if;
  return query
    select c.body, coalesce(c.edited_at, c.created_at), true from luma.work_task_comments c where c.id = p_comment
    union all select e.old_body, e.edited_at, false from luma.work_comment_edits e where e.comment_id = p_comment
    order by 2 desc;
end;
$$;
revoke execute on function luma.work_comment_history(uuid) from public, anon;
grant execute on function luma.work_comment_history(uuid) to authenticated;

-- the list of comments now says whether one was edited
drop function if exists luma.work_task_comments_of(uuid);
create or replace function luma.work_task_comments_of(p_task uuid)
returns table (id uuid, user_id uuid, name text, body text, created_at timestamptz, edited_at timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
declare v_proj uuid;
begin
  select t.project_id into v_proj from luma.work_tasks t where t.id = p_task;
  if v_proj is null or luma.work_role(v_proj, auth.uid()) is null then raise exception 'Not allowed'; end if;
  return query select c.id, c.user_id, luma.person_name(c.user_id), c.body, c.created_at, c.edited_at from luma.work_task_comments c where c.task_id = p_task order by c.created_at;
end;
$$;
revoke execute on function luma.work_task_comments_of(uuid) from public, anon;
grant execute on function luma.work_task_comments_of(uuid) to authenticated;

-- ---------- moving ----------
-- the guards let a move through only while a move function is running
create or replace function luma.work_task_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_a uuid; v_max integer;
begin
  if tg_op = 'INSERT' then
    v_max := coalesce(luma.limit_of((select owner_id from luma.work_projects where id = new.project_id), 'work_tasks'), 1500);
    if (select count(*) from luma.work_tasks where project_id = new.project_id) >= v_max then raise exception 'Your plan allows up to % tasks in a project', v_max; end if;
  end if;
  new.assignee_ids := coalesce((select array_agg(distinct x) from unnest(new.assignee_ids) x), '{}'::uuid[]);
  foreach v_a in array new.assignee_ids loop
    if luma.work_role(new.project_id, v_a) is null then raise exception 'That person is not on this project'; end if;
  end loop;
  if tg_op = 'UPDATE' and new.project_id <> old.project_id and coalesce(current_setting('luma.moving', true), '') <> '1' then raise exception 'Use Move to put a task in another project'; end if;
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.completed_at := now();
  elsif new.status <> 'done' then new.completed_at := null; end if;
  return new;
end;
$$;

create or replace function luma.work_project_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_arch timestamptz; v_owner uuid; v_max integer;
begin
  if tg_op = 'INSERT' then
    v_max := coalesce(luma.limit_of(new.owner_id, 'work_projects'), 60);
    if (select count(*) from luma.work_projects where owner_id = new.owner_id) >= v_max then raise exception 'Your plan allows up to % projects', v_max; end if;
    if new.company_id is null then
      select id into new.company_id from luma.work_companies where owner_id = new.owner_id and archived_at is null order by created_at limit 1;
      if new.company_id is null then insert into luma.work_companies (owner_id, name) values (new.owner_id, 'My company') returning id into new.company_id; end if;
    end if;
  elsif new.company_id is distinct from old.company_id and coalesce(current_setting('luma.moving', true), '') <> '1' then raise exception 'Use Move to put a project in another company';
  end if;
  select archived_at, owner_id into v_arch, v_owner from luma.work_companies where id = new.company_id;
  if v_owner is distinct from new.owner_id then raise exception 'That is not your company'; end if;
  if v_arch is not null then raise exception 'This company is archived: restore it to change its projects'; end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function luma.work_move_task(p_task uuid, p_project uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_t record; v_u uuid; v_doc uuid; v_max integer;
begin
  select * into v_t from luma.work_tasks where id = p_task;
  if not found then raise exception 'Task not found'; end if;
  if v_t.project_id = p_project then return; end if;
  if not luma.work_can_edit(v_t.project_id) or not luma.work_can_edit(p_project) then raise exception 'You can only move a task between projects you can change'; end if;
  v_max := coalesce(luma.limit_of((select owner_id from luma.work_projects where id = p_project), 'work_tasks'), 1500);
  if (select count(*) from luma.work_tasks where project_id = p_project) >= v_max then raise exception 'That project is full (up to % tasks on its owner''s plan)', v_max; end if;
  perform set_config('luma.moving', '1', true);
  update luma.work_tasks set project_id = p_project, folder_id = null,
    assignee_ids = coalesce((select array_agg(x) from unnest(v_t.assignee_ids) x where luma.work_role(p_project, x) is not null), '{}'::uuid[]) where id = p_task;
  update luma.work_task_comments set project_id = p_project where task_id = p_task;
  update luma.work_task_files set project_id = p_project where task_id = p_task;
  update luma.work_time_entries e set project_id = p_project where e.task_id = p_task;
  -- the files are now shared with the new project's people, and no longer with the old ones (unless something else still links them)
  for v_doc in select document_id from luma.work_task_files where task_id = p_task loop
    for v_u in select luma.work_people(v_t.project_id) loop perform luma.unshare_doc(v_doc, v_u, null, null); end loop;
    for v_u in select luma.work_people(p_project) loop perform luma.share_doc(v_doc, v_u); end loop;
  end loop;
  perform set_config('luma.moving', '', true);
  update luma.work_projects set updated_at = now() where id in (v_t.project_id, p_project);
end;
$$;
revoke execute on function luma.work_move_task(uuid, uuid) from public, anon;
grant execute on function luma.work_move_task(uuid, uuid) to authenticated;

create or replace function luma.work_move_project(p_project uuid, p_company uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_p record; v_c record;
begin
  select * into v_p from luma.work_projects where id = p_project and owner_id = auth.uid();
  if not found then raise exception 'Only the project owner can move it'; end if;
  if not luma.has_my_addon('work') then raise exception 'The Work add-on is needed'; end if;
  if v_p.company_id = p_company then return; end if;
  select * into v_c from luma.work_companies where id = p_company and owner_id = auth.uid();
  if not found then raise exception 'That is not your company'; end if;
  if v_c.archived_at is not null then raise exception 'That company is archived: restore it first'; end if;
  perform set_config('luma.moving', '1', true);
  update luma.work_projects set company_id = p_company where id = p_project;
  perform set_config('luma.moving', '', true);
  -- the owner's own logged time on this project follows it (other people's entries have no company of yours)
  update luma.work_time_entries set company_id = p_company where project_id = p_project and user_id = auth.uid();
end;
$$;
revoke execute on function luma.work_move_project(uuid, uuid) from public, anon;
grant execute on function luma.work_move_project(uuid, uuid) to authenticated;

-- ---------- the owner sees the team's hours on their project ----------
create or replace function luma.work_project_time(p_project uuid, p_from date, p_to date)
returns table (user_id uuid, name text, work_date date, minutes integer, task_title text, note text)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not exists (select 1 from luma.work_projects p where p.id = p_project and p.owner_id = auth.uid()) then raise exception 'Only the project owner can see the team''s time'; end if;
  return query select e.user_id, luma.person_name(e.user_id), e.work_date, e.minutes, e.task_title, e.note
    from luma.work_time_entries e where e.project_id = p_project and e.running_since is null and e.work_date between p_from and p_to order by e.work_date, e.created_at;
end;
$$;
revoke execute on function luma.work_project_time(uuid, date, date) from public, anon;
grant execute on function luma.work_project_time(uuid, date, date) to authenticated;
