-- ============================================================
-- LUMA — migration 075: Work tasks get comments and files.
--   • work_task_comments: a conversation on a task. Owners and members (with the Work add-on) can write; everyone on the project can read.
--     The people on the task (and whoever made it) are told about a new comment, and the notification opens the task.
--   • work_task_files: documents from the Documents page attached to a task. Attaching shares the document with the people on the project;
--     it is un-shared again when the file is removed, the person leaves, or the task / project is deleted (unless something else still links it).
-- Depends on 071–074, 058 (the sharing helpers). Safe to re-run.
-- ============================================================

create table if not exists luma.work_task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references luma.work_tasks (id) on delete cascade,
  project_id uuid not null references luma.work_projects (id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists work_task_comments_task_idx on luma.work_task_comments (task_id, created_at);

create table if not exists luma.work_task_files (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references luma.work_tasks (id) on delete cascade,
  project_id  uuid not null references luma.work_projects (id) on delete cascade,
  document_id uuid not null references luma.documents (id) on delete cascade,
  added_by    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (task_id, document_id)
);
create index if not exists work_task_files_doc_idx on luma.work_task_files (document_id);
create index if not exists work_task_files_project_idx on luma.work_task_files (project_id);

alter table luma.work_task_comments enable row level security;
alter table luma.work_task_files enable row level security;
drop policy if exists work_comments_read on luma.work_task_comments;
drop policy if exists work_comments_insert on luma.work_task_comments;
drop policy if exists work_comments_delete on luma.work_task_comments;
create policy work_comments_read on luma.work_task_comments for select to authenticated using (luma.work_role(project_id, auth.uid()) is not null);
create policy work_comments_insert on luma.work_task_comments for insert to authenticated with check (user_id = auth.uid() and luma.work_can_edit(project_id));
create policy work_comments_delete on luma.work_task_comments for delete to authenticated using (user_id = auth.uid() or luma.work_role(project_id, auth.uid()) = 'owner');
revoke all on luma.work_task_comments, luma.work_task_files from anon, authenticated;
grant select, insert, delete on luma.work_task_comments to authenticated;
-- files go through the functions below (they do the sharing)

create or replace function luma.work_comment_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  select project_id into new.project_id from luma.work_tasks where id = new.task_id;
  if new.project_id is null then raise exception 'Task not found'; end if;
  if (select count(*) from luma.work_task_comments where task_id = new.task_id) >= 500 then raise exception 'A task can have up to 500 comments'; end if;
  return new;
end;
$$;
drop trigger if exists work_comments_guard on luma.work_task_comments;
create trigger work_comments_guard before insert on luma.work_task_comments for each row execute function luma.work_comment_guard();

create or replace function luma.work_comment_notify()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_t record; v_u uuid;
begin
  select title, assignee_ids, created_by into v_t from luma.work_tasks where id = new.task_id;
  for v_u in select distinct x from unnest(v_t.assignee_ids || coalesce(array[v_t.created_by], '{}'::uuid[])) x where x is not null and x <> new.user_id loop
    if luma.work_role(new.project_id, v_u) is not null then
      perform luma.notify(v_u, 'work_comment', '💬 ' || luma.person_name(new.user_id) || ' commented on ' || v_t.title, left(new.body, 120), 'work', new.task_id);
    end if;
  end loop;
  return null;
end;
$$;
drop trigger if exists work_comments_notify on luma.work_task_comments;
create trigger work_comments_notify after insert on luma.work_task_comments for each row execute function luma.work_comment_notify();

-- who is on a project (owner + accepted people)
create or replace function luma.work_people(p_project uuid)
returns setof uuid
language sql
stable
security definer set search_path = ''
as $$
  select owner_id from luma.work_projects where id = p_project
  union select user_id from luma.work_project_members where project_id = p_project and status = 'accepted';
$$;
revoke execute on function luma.work_people(uuid) from public, anon, authenticated;

-- a document stays shared while a Work task they can reach still has it attached (Study links still count too)
create or replace function luma.doc_linked(p_doc uuid, p_user uuid, p_skip_project uuid, p_skip_note uuid)
returns boolean
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  return exists (select 1 from luma.study_project_files f join luma.study_project_members m on m.project_id = f.project_id
                 where f.document_id = p_doc and m.user_id = p_user and m.status = 'accepted' and f.project_id is distinct from p_skip_project)
      or exists (select 1 from luma.study_note_files nf join luma.study_note_shares s on s.note_id = nf.note_id
                 where nf.document_id = p_doc and s.shared_with = p_user and nf.note_id is distinct from p_skip_note)
      or exists (select 1 from luma.work_task_files wf where wf.document_id = p_doc and p_user in (select luma.work_people(wf.project_id)));
end;
$$;
revoke execute on function luma.doc_linked(uuid, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function luma.work_attach_file(p_task uuid, p_document uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare v_proj uuid; v_id uuid; v_u uuid;
begin
  select project_id into v_proj from luma.work_tasks where id = p_task;
  if v_proj is null or not luma.work_can_edit(v_proj) then raise exception 'Not allowed'; end if;
  if not exists (select 1 from luma.documents where id = p_document and user_id = auth.uid()) then raise exception 'You can only attach your own documents'; end if;
  if (select count(*) from luma.work_task_files where task_id = p_task) >= 20 then raise exception 'A task can have up to 20 files'; end if;
  insert into luma.work_task_files (task_id, project_id, document_id, added_by) values (p_task, v_proj, p_document, auth.uid())
    on conflict (task_id, document_id) do update set added_by = excluded.added_by returning id into v_id;
  for v_u in select luma.work_people(v_proj) loop perform luma.share_doc(p_document, v_u); end loop;
  update luma.work_projects set updated_at = now() where id = v_proj;
  return v_id;
end;
$$;
revoke execute on function luma.work_attach_file(uuid, uuid) from public, anon;
grant execute on function luma.work_attach_file(uuid, uuid) to authenticated;

create or replace function luma.work_detach_file(p_file uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare v_f record; v_u uuid;
begin
  select * into v_f from luma.work_task_files where id = p_file;
  if not found then return true; end if;
  if not luma.work_can_edit(v_f.project_id) or (v_f.added_by <> auth.uid() and luma.work_role(v_f.project_id, auth.uid()) <> 'owner') then raise exception 'Only the person who attached it, or the project owner, can remove it'; end if;
  delete from luma.work_task_files where id = p_file;
  for v_u in select luma.work_people(v_f.project_id) loop perform luma.unshare_doc(v_f.document_id, v_u, null, null); end loop;
  return true;
end;
$$;
revoke execute on function luma.work_detach_file(uuid) from public, anon;
grant execute on function luma.work_detach_file(uuid) to authenticated;

create or replace function luma.work_task_files_of(p_task uuid)
returns table (id uuid, document_id uuid, name text, size_bytes bigint, mime_type text, storage_path text, added_by uuid, added_by_name text, created_at timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
declare v_proj uuid;
begin
  select t.project_id into v_proj from luma.work_tasks t where t.id = p_task;
  if v_proj is null or luma.work_role(v_proj, auth.uid()) is null then raise exception 'Not allowed'; end if;
  return query select f.id, d.id, d.name, d.size_bytes::bigint, d.mime_type, d.storage_path, f.added_by, luma.person_name(f.added_by), f.created_at
    from luma.work_task_files f join luma.documents d on d.id = f.document_id where f.task_id = p_task order by f.created_at desc;
end;
$$;
revoke execute on function luma.work_task_files_of(uuid) from public, anon;
grant execute on function luma.work_task_files_of(uuid) to authenticated;

-- comments with the writer's name
create or replace function luma.work_task_comments_of(p_task uuid)
returns table (id uuid, user_id uuid, name text, body text, created_at timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
declare v_proj uuid;
begin
  select t.project_id into v_proj from luma.work_tasks t where t.id = p_task;
  if v_proj is null or luma.work_role(v_proj, auth.uid()) is null then raise exception 'Not allowed'; end if;
  return query select c.id, c.user_id, luma.person_name(c.user_id), c.body, c.created_at from luma.work_task_comments c where c.task_id = p_task order by c.created_at;
end;
$$;
revoke execute on function luma.work_task_comments_of(uuid) from public, anon;
grant execute on function luma.work_task_comments_of(uuid) to authenticated;

-- when a task or a project goes, the sharing of its files goes with it
create or replace function luma.work_task_cleanup_files()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_doc uuid; v_u uuid;
begin
  for v_doc in delete from luma.work_task_files where task_id = old.id returning document_id loop
    for v_u in select luma.work_people(old.project_id) loop perform luma.unshare_doc(v_doc, v_u, null, null); end loop;
  end loop;
  return old;
end;
$$;
drop trigger if exists work_tasks_cleanup_files on luma.work_tasks;
create trigger work_tasks_cleanup_files before delete on luma.work_tasks for each row execute function luma.work_task_cleanup_files();

create or replace function luma.work_project_cleanup_files()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_doc uuid; v_u uuid;
begin
  for v_doc in delete from luma.work_task_files where project_id = old.id returning document_id loop
    for v_u in select luma.work_people(old.id) loop perform luma.unshare_doc(v_doc, v_u, null, null); end loop;
  end loop;
  return old;
end;
$$;
drop trigger if exists work_projects_cleanup_files on luma.work_projects;
create trigger work_projects_cleanup_files before delete on luma.work_projects for each row execute function luma.work_project_cleanup_files();

-- joining shares the project's files with you; leaving or being removed takes that away again
create or replace function luma.work_respond(p_project uuid, p_accept boolean)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_owner uuid; v_name text; v_doc uuid;
begin
  update luma.work_project_members set status = case when p_accept then 'accepted' else 'declined' end where project_id = p_project and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'No invitation found'; end if;
  select owner_id, name into v_owner, v_name from luma.work_projects where id = p_project;
  if p_accept then for v_doc in select document_id from luma.work_task_files where project_id = p_project loop perform luma.share_doc(v_doc, auth.uid()); end loop; end if;
  perform luma.notify(v_owner, 'work_reply', (case when p_accept then '✅ ' else '❌ ' end) || luma.person_name(auth.uid()) || (case when p_accept then ' joined ' else ' declined ' end) || v_name, 'Open Work → Projects.', 'work', p_project);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;
revoke execute on function luma.work_respond(uuid, boolean) from public, anon;
grant execute on function luma.work_respond(uuid, boolean) to authenticated;

create or replace function luma.work_remove_member(p_project uuid, p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_doc uuid;
begin
  if not (p_user = auth.uid() or exists (select 1 from luma.work_projects where id = p_project and owner_id = auth.uid())) then raise exception 'Not allowed'; end if;
  delete from luma.work_project_members where project_id = p_project and user_id = p_user;
  update luma.work_tasks set assignee_ids = array_remove(assignee_ids, p_user) where project_id = p_project and p_user = any (assignee_ids);
  for v_doc in select document_id from luma.work_task_files where project_id = p_project loop perform luma.unshare_doc(v_doc, p_user, null, null); end loop;
end;
$$;
revoke execute on function luma.work_remove_member(uuid, uuid) from public, anon;
grant execute on function luma.work_remove_member(uuid, uuid) to authenticated;
