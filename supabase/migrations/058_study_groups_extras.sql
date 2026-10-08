-- ============================================================
-- LUMA — migration 058: group projects, round two.
--   • Comments: a discussion thread on every project (teammates are notified, at most once per 10 minutes per person).
--   • Files: attach a document to a project; every teammate can open it (it is shared with them automatically, and the sharing is removed
--     again when the file is detached, the person leaves, or the project is deleted).
--   • Reminders for assigned group tasks (3 days before, 1 day before, on the day, and daily nudges up to a week once overdue).
--   • Anyone can start a group project, with or without the Study add-on (without it: up to 3 projects you own).
-- Depends on 054, 004 (documents + sharing), 056. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.study_project_comments (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references luma.study_projects(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists study_project_comments_project on luma.study_project_comments (project_id, created_at);
create table if not exists luma.study_project_files (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references luma.study_projects(id) on delete cascade,
  document_id uuid not null references luma.documents(id) on delete cascade,
  added_by    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (project_id, document_id)
);
create index if not exists study_project_files_doc on luma.study_project_files (document_id);
-- (note files belong to migration 059's feature but the table lives here so the sharing helpers below can look at both)
create table if not exists luma.study_note_files (
  id          uuid primary key default gen_random_uuid(),
  note_id     uuid not null references luma.study_notes(id) on delete cascade,
  document_id uuid not null references luma.documents(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (note_id, document_id)
);
create index if not exists study_note_files_doc on luma.study_note_files (document_id);
alter table luma.study_project_comments enable row level security;
alter table luma.study_project_files enable row level security;
alter table luma.study_note_files enable row level security;
revoke all on luma.study_project_comments, luma.study_project_files, luma.study_note_files from anon, authenticated;

-- ---------- sharing helpers (a document is shared with someone only while a project / note they are on still has it attached) ----------
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
                 where nf.document_id = p_doc and s.shared_with = p_user and nf.note_id is distinct from p_skip_note);
end;
$$;
revoke execute on function luma.doc_linked(uuid, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function luma.unshare_doc(p_doc uuid, p_user uuid, p_skip_project uuid, p_skip_note uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not luma.doc_linked(p_doc, p_user, p_skip_project, p_skip_note) then
    delete from luma.document_shares where document_id = p_doc and shared_with = p_user;
  end if;
end;
$$;
revoke execute on function luma.unshare_doc(uuid, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function luma.share_doc(p_doc uuid, p_user uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_owner uuid;
begin
  select user_id into v_owner from luma.documents where id = p_doc;
  if v_owner is null or v_owner = p_user then return; end if;
  insert into luma.document_shares (document_id, shared_with, shared_by) values (p_doc, p_user, v_owner) on conflict do nothing;
end;
$$;
revoke execute on function luma.share_doc(uuid, uuid) from public, anon, authenticated;

-- when a project (or a note) goes, the sharing of its files goes with it
create or replace function luma.project_cleanup_shares()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare f record; m record;
begin
  for f in select document_id from luma.study_project_files where project_id = old.id loop
    for m in select user_id from luma.study_project_members where project_id = old.id loop
      perform luma.unshare_doc(f.document_id, m.user_id, old.id, null);
    end loop;
  end loop;
  return old;
end;
$$;
drop trigger if exists project_cleanup_shares on luma.study_projects;
create trigger project_cleanup_shares before delete on luma.study_projects for each row execute function luma.project_cleanup_shares();

create or replace function luma.note_cleanup_shares()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare f record; s record;
begin
  for f in select document_id from luma.study_note_files where note_id = old.id loop
    for s in select shared_with from luma.study_note_shares where note_id = old.id loop
      perform luma.unshare_doc(f.document_id, s.shared_with, null, old.id);
    end loop;
  end loop;
  return old;
end;
$$;
drop trigger if exists note_cleanup_shares on luma.study_notes;
create trigger note_cleanup_shares before delete on luma.study_notes for each row execute function luma.note_cleanup_shares();

-- ---------- comments ----------
create or replace function luma.add_project_comment(p_project uuid, p_body text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare v_id uuid; v_title text; m record;
begin
  if not luma.in_project(p_project, auth.uid()) then raise exception 'Not allowed'; end if;
  if (select count(*) from luma.study_project_comments where project_id = p_project) >= 500 then raise exception 'This discussion is full (500 comments)'; end if;
  insert into luma.study_project_comments (project_id, user_id, body) values (p_project, auth.uid(), btrim(coalesce(p_body, ''))) returning id into v_id;
  update luma.study_projects set updated_at = now() where id = p_project;
  select title into v_title from luma.study_projects where id = p_project;
  for m in select user_id from luma.study_project_members where project_id = p_project and status = 'accepted' and user_id <> auth.uid() loop
    continue when exists (select 1 from luma.notifications n where n.user_id = m.user_id and n.type = 'project_comment' and n.ref = p_project and n.created_at > now() - interval '10 minutes');
    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (m.user_id, 'project_comment', '💬 ' || luma.person_name(auth.uid()) || ' commented on ' || v_title, left(btrim(p_body), 120), 'study', p_project);
  end loop;
  return v_id;
end;
$$;
revoke execute on function luma.add_project_comment(uuid, text) from public, anon;
grant execute on function luma.add_project_comment(uuid, text) to authenticated;

create or replace function luma.project_comments(p_project uuid)
returns table (id uuid, user_id uuid, name text, body text, created_at timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not luma.in_project(p_project, auth.uid()) then raise exception 'Not allowed'; end if;
  return query select c.id, c.user_id, luma.person_name(c.user_id), c.body, c.created_at
    from luma.study_project_comments c where c.project_id = p_project order by c.created_at desc limit 200;
end;
$$;
revoke execute on function luma.project_comments(uuid) from public, anon;
grant execute on function luma.project_comments(uuid) to authenticated;

create or replace function luma.delete_project_comment(p_comment uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare v_c record;
begin
  select * into v_c from luma.study_project_comments where id = p_comment;
  if not found then return true; end if;
  if v_c.user_id <> auth.uid() and not exists (select 1 from luma.study_projects where id = v_c.project_id and owner_id = auth.uid()) then raise exception 'Not allowed'; end if;
  delete from luma.study_project_comments where id = p_comment;
  return true;
end;
$$;
revoke execute on function luma.delete_project_comment(uuid) from public, anon;
grant execute on function luma.delete_project_comment(uuid) to authenticated;

-- ---------- files ----------
create or replace function luma.attach_project_file(p_project uuid, p_document uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare v_id uuid; m record;
begin
  if not luma.in_project(p_project, auth.uid()) then raise exception 'Not allowed'; end if;
  if not exists (select 1 from luma.documents where id = p_document and user_id = auth.uid()) then raise exception 'You can only attach your own documents'; end if;
  if (select count(*) from luma.study_project_files where project_id = p_project) >= 30 then raise exception 'A project can have up to 30 files'; end if;
  insert into luma.study_project_files (project_id, document_id, added_by) values (p_project, p_document, auth.uid())
    on conflict (project_id, document_id) do update set added_by = excluded.added_by returning id into v_id;
  for m in select user_id from luma.study_project_members where project_id = p_project and status = 'accepted' loop
    perform luma.share_doc(p_document, m.user_id);
  end loop;
  update luma.study_projects set updated_at = now() where id = p_project;
  return v_id;
end;
$$;
revoke execute on function luma.attach_project_file(uuid, uuid) from public, anon;
grant execute on function luma.attach_project_file(uuid, uuid) to authenticated;

create or replace function luma.detach_project_file(p_file uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare v_f record; m record;
begin
  select * into v_f from luma.study_project_files where id = p_file;
  if not found then return true; end if;
  if v_f.added_by <> auth.uid() and not exists (select 1 from luma.study_projects where id = v_f.project_id and owner_id = auth.uid()) then raise exception 'Only the person who attached it, or the owner, can remove it'; end if;
  delete from luma.study_project_files where id = p_file;
  for m in select user_id from luma.study_project_members where project_id = v_f.project_id loop
    perform luma.unshare_doc(v_f.document_id, m.user_id, null, null);
  end loop;
  return true;
end;
$$;
revoke execute on function luma.detach_project_file(uuid) from public, anon;
grant execute on function luma.detach_project_file(uuid) to authenticated;

create or replace function luma.project_files(p_project uuid)
returns table (id uuid, document_id uuid, name text, size_bytes bigint, mime_type text, storage_path text, added_by uuid, added_by_name text, created_at timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not luma.in_project(p_project, auth.uid()) then raise exception 'Not allowed'; end if;
  return query select f.id, d.id, d.name, d.size_bytes::bigint, d.mime_type, d.storage_path, f.added_by, luma.person_name(f.added_by), f.created_at
    from luma.study_project_files f join luma.documents d on d.id = f.document_id where f.project_id = p_project order by f.created_at desc;
end;
$$;
revoke execute on function luma.project_files(uuid) from public, anon;
grant execute on function luma.project_files(uuid) to authenticated;

-- joining shares the project's files with you; leaving (or being removed) takes that sharing away again
create or replace function luma.respond_study_project(p_project uuid, p_accept boolean)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_owner uuid; v_title text; f record;
begin
  update luma.study_project_members set status = case when p_accept then 'accepted' else 'declined' end
    where project_id = p_project and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'No invitation found'; end if;
  select owner_id, title into v_owner, v_title from luma.study_projects where id = p_project;
  if p_accept then
    for f in select document_id from luma.study_project_files where project_id = p_project loop perform luma.share_doc(f.document_id, auth.uid()); end loop;
  end if;
  perform luma.notify(v_owner, 'project_reply', (case when p_accept then '✅ ' else '❌ ' end) || luma.person_name(auth.uid()) || (case when p_accept then ' joined ' else ' declined ' end) || v_title, 'Open Study → Groups.', 'study');
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;
revoke execute on function luma.respond_study_project(uuid, boolean) from public, anon;
grant execute on function luma.respond_study_project(uuid, boolean) to authenticated;

create or replace function luma.leave_study_project(p_project uuid, p_user uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare f record;
begin
  if exists (select 1 from luma.study_projects where id = p_project and owner_id = p_user) then raise exception 'The owner cannot leave; delete the project instead'; end if;
  if p_user <> auth.uid() and not exists (select 1 from luma.study_projects where id = p_project and owner_id = auth.uid()) then raise exception 'Not allowed'; end if;
  delete from luma.study_project_members where project_id = p_project and user_id = p_user;
  update luma.study_project_tasks set assignee_id = null where project_id = p_project and assignee_id = p_user;
  for f in select document_id from luma.study_project_files where project_id = p_project loop perform luma.unshare_doc(f.document_id, p_user, null, null); end loop;
  return true;
end;
$$;
revoke execute on function luma.leave_study_project(uuid, uuid) from public, anon;
grant execute on function luma.leave_study_project(uuid, uuid) to authenticated;

-- ---------- anyone can start a group project ----------
create or replace function luma.assign_semester()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_study boolean; v_user uuid; v_sem uuid;
begin
  v_study := tg_table_name like 'study\_%' or (to_jsonb(new) ->> 'space') = 'study';
  if not v_study then return new; end if;
  v_user := coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(new) ->> 'owner_id')::uuid);
  select id into v_sem from luma.study_semesters where user_id = v_user and is_active and archived_at is null;
  if v_sem is null then
    if tg_table_name = 'study_projects' and not luma.has_addon(v_user, 'study') then new.semester_id := null; return new; end if;   -- a classmate without the add-on
    raise exception 'Activate a semester first: Study items are added to your active semester.';
  end if;
  new.semester_id := v_sem;
  return new;
end;
$$;

create or replace function luma.create_study_project(p_title text, p_course text, p_due date, p_notes text)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare v_id uuid; v_cap int;
begin
  v_cap := case when luma.has_my_addon('study') then 20 else 3 end;
  if (select count(*) from luma.study_projects where owner_id = auth.uid()) >= v_cap then
    if v_cap = 3 then raise exception 'Without the Study add-on you can own up to 3 group projects'; end if;
    raise exception 'You can own up to 20 group projects';
  end if;
  insert into luma.study_projects (owner_id, title, course_name, due_date, notes)
    values (auth.uid(), btrim(coalesce(p_title, '')), left(coalesce(p_course, ''), 80), p_due, left(coalesce(p_notes, ''), 5000)) returning id into v_id;
  insert into luma.study_project_members (project_id, user_id, status, invited_by) values (v_id, auth.uid(), 'accepted', auth.uid());
  return v_id;
end;
$$;
revoke execute on function luma.create_study_project(text, text, date, text) from public, anon;
grant execute on function luma.create_study_project(text, text, date, text) to authenticated;

-- ---------- reminders for assigned group tasks ----------
create or replace function luma.run_group_task_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp; v_today date; v_on boolean; v_hour int; v_days int; v_off int; v_late int; v_title text; v_count int := 0;
begin
  for r in
    select t.id, t.title, t.assignee_id, t.due_date, p.title as project_title
    from luma.study_project_tasks t join luma.study_projects p on p.id = t.project_id
    where t.status <> 'done' and t.assignee_id is not null and t.due_date between current_date - 8 and current_date + 15
  loop
    select coalesce(bool_and(x.study_on), true), coalesce(max(x.study_hour), 9), coalesce(max(x.study_days), 3) into v_on, v_hour, v_days
      from luma.reminder_prefs x where x.user_id = r.assignee_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(r.assignee_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
    v_today := v_now::date;
    v_late := v_today - r.due_date;
    v_title := null;
    if v_late > 0 and v_late <= 7 then
      v_title := '⚠️ ' || r.title || ' is overdue by ' || v_late || ' day' || case when v_late = 1 then '' else 's' end;
    else
      foreach v_off in array array[v_days, 1, 0] loop
        if r.due_date = v_today + v_off then
          v_title := '🤝 ' || r.title || case when v_off = 0 then ' is due today' else ' is due ' || luma.days_text(v_off, 'in') end;
          exit;
        end if;
      end loop;
    end if;
    continue when v_title is null;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.assignee_id and n.type = 'reminder_project' and n.ref = r.id and n.title = v_title and n.created_at > now() - interval '12 hours');
    insert into luma.notifications (user_id, type, title, body, link, ref) values (r.assignee_id, 'reminder_project', v_title, 'Group project · ' || r.project_title, 'study', r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_group_task_reminders() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-group-task-reminders') then perform cron.unschedule('luma-group-task-reminders'); end if;
  perform cron.schedule('luma-group-task-reminders', '0 * * * *', 'select luma.run_group_task_reminders()');
exception when others then
  raise notice 'Could not schedule the group task reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
