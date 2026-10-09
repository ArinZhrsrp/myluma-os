-- ============================================================
-- LUMA — migration 070: notifications that know what they are about.
--   When you tap one of these notifications the app now scrolls to and highlights the thing it is about:
--   a file someone shared, a contact request, a calendar invitation (and its reply), a shared Study note,
--   a group project invitation / reply / new task.
--   (Only a reference is added to each notification; the functions are otherwise exactly as before.)
-- Depends on 008, 048, 053, 054, 058, 059, 064 (notify with a reference). Safe to re-run.
-- ============================================================

-- notify_document_share: the notification now carries new.document_id (from 008_notifications.sql)
create or replace function luma.notify_document_share()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_doc text;
begin
  select name into v_doc from luma.documents where id = new.document_id;
  perform luma.notify(
    new.shared_with, 'share',
    luma.display_name(new.shared_by) || ' shared a document with you',
    '“' || coalesce(v_doc, 'A document') || '” is in Documents → Shared with me.',
    'documents'
  , new.document_id);
  return new;
end;
$$;

-- notify_contact_change: the notification now carries new.id (from 008_notifications.sql)
create or replace function luma.notify_contact_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform luma.notify(new.addressee_id, 'contact_request',
      luma.display_name(new.requester_id) || ' sent you a contact request',
      'Open Contacts to accept or decline.', 'contacts', new.id);
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'accepted' then
      perform luma.notify(new.requester_id, 'contact_accepted',
        luma.display_name(new.addressee_id) || ' accepted your contact request',
        'You can now chat and share documents with each other.', 'contacts', new.id);
    elsif new.status = 'pending' then -- a declined request re-opened by request_contact()
      perform luma.notify(new.addressee_id, 'contact_request',
        luma.display_name(new.requester_id) || ' sent you a contact request',
        'Open Contacts to accept or decline.', 'contacts', new.id);
    end if;
  end if;
  return new;
end;
$$;

-- invite_to_event: the notification now carries p_event (from 048_event_invites.sql)
create or replace function luma.invite_to_event(p_event uuid, p_users uuid[])
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ev record;
  v_user uuid;
  v_count int := 0;
  v_total int;
  v_row luma.event_invites;
begin
  select * into v_ev from luma.events where id = p_event and user_id = auth.uid();
  if not found then raise exception 'You can only invite people to your own events'; end if;
  select count(*) into v_total from luma.event_invites where event_id = p_event and status <> 'declined';
  foreach v_user in array coalesce(p_users, '{}'::uuid[]) loop
    continue when v_user = auth.uid();
    if not exists (select 1 from luma.contacts c where c.status = 'accepted'
                   and ((c.requester_id = auth.uid() and c.addressee_id = v_user) or (c.addressee_id = auth.uid() and c.requester_id = v_user))) then
      raise exception 'You can only invite people who are in your contacts';
    end if;
    select * into v_row from luma.event_invites where event_id = p_event and invitee_id = v_user;
    if found and v_row.status <> 'declined' then continue; end if;   -- already invited
    if v_total >= 30 then raise exception 'An event can have up to 30 guests'; end if;
    insert into luma.event_invites (event_id, inviter_id, invitee_id) values (p_event, auth.uid(), v_user)
      on conflict (event_id, invitee_id) do update set status = 'pending', responded_at = null, created_at = now();
    v_total := v_total + 1; v_count := v_count + 1;
    perform luma.notify(v_user, 'event_invite', '📅 ' || luma.person_name(auth.uid()) || ' invited you to ' || v_ev.title,
      to_char(v_ev.event_date, 'FMDay, FMDD Mon') || case when v_ev.all_day then ' · all day' else ' · ' || to_char(v_ev.start_time::time, 'FMHH12:MI am') end || '. Open your calendar to accept or decline.', 'calendar', p_event);
  end loop;
  return v_count;
end;
$$;

-- respond_event_invite: the notification now carries p_event (from 048_event_invites.sql)
create or replace function luma.respond_event_invite(p_event uuid, p_accept boolean)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_inv luma.event_invites; v_title text;
begin
  select * into v_inv from luma.event_invites where event_id = p_event and invitee_id = auth.uid();
  if not found then raise exception 'No invitation found'; end if;
  update luma.event_invites set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = v_inv.id;
  select title into v_title from luma.events where id = p_event;
  perform luma.notify(v_inv.inviter_id, 'event_invite_reply',
    (case when p_accept then '✅ ' else '❌ ' end) || luma.person_name(auth.uid()) || (case when p_accept then ' is coming to ' else ' can''t make ' end) || coalesce(v_title, 'your event'),
    'Open your calendar to see who is on the guest list.', 'calendar', p_event);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;

-- share_study_note: the notification now carries p_note (from 059_study_notes_extras.sql)
create or replace function luma.share_study_note(p_note uuid, p_users uuid[], p_can_edit boolean default false)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare v_title text; v_user uuid; v_count int := 0; v_total int; f record;
begin
  select title into v_title from luma.study_notes where id = p_note and user_id = auth.uid();
  if not found then raise exception 'You can only share your own notes'; end if;
  select count(*) into v_total from luma.study_note_shares where note_id = p_note;
  foreach v_user in array coalesce(p_users, '{}'::uuid[]) loop
    continue when v_user = auth.uid();
    if not luma.is_contact(auth.uid(), v_user) then raise exception 'You can only share with people in your contacts'; end if;
    if exists (select 1 from luma.study_note_shares where note_id = p_note and shared_with = v_user) then
      update luma.study_note_shares set can_edit = coalesce(p_can_edit, false) where note_id = p_note and shared_with = v_user;
      continue;
    end if;
    if v_total >= 30 then raise exception 'A note can be shared with up to 30 people'; end if;
    insert into luma.study_note_shares (note_id, shared_with, can_edit) values (p_note, v_user, coalesce(p_can_edit, false));
    for f in select document_id from luma.study_note_files where note_id = p_note loop perform luma.share_doc(f.document_id, v_user); end loop;
    v_total := v_total + 1; v_count := v_count + 1;
    perform luma.notify(v_user, 'note_share', '📝 ' || luma.person_name(auth.uid()) || ' shared a note with you' || case when p_can_edit then ' (you can edit it)' else '' end, v_title, 'study', p_note);
  end loop;
  return v_count;
end;
$$;

-- invite_to_study_project: the notification now carries p_project (from 054_study_groups.sql)
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
    perform luma.notify(v_user, 'project_invite', '🤝 ' || luma.person_name(auth.uid()) || ' invited you to a group project', v_title || '. Open Study → Groups to join.', 'study', p_project);
  end loop;
  return v_count;
end;
$$;

-- respond_study_project: the notification now carries p_project (from 058_study_groups_extras.sql)
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
  perform luma.notify(v_owner, 'project_reply', (case when p_accept then '✅ ' else '❌ ' end) || luma.person_name(auth.uid()) || (case when p_accept then ' joined ' else ' declined ' end) || v_title, 'Open Study → Groups.', 'study', p_project);
  return case when p_accept then 'accepted' else 'declined' end;
end;
$$;

-- add_study_project_task: the notification now carries p_project (from 054_study_groups.sql)
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
    perform luma.notify(p_assignee, 'project_task', '📌 ' || luma.person_name(auth.uid()) || ' gave you a task', btrim(p_title) || ' · ' || v_title, 'study', p_project);
  end if;
  return v_id;
end;
$$;

-- update_study_project_task: the notification now carries v_t.project_id (from 054_study_groups.sql)
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
    perform luma.notify(v_new, 'project_task', '📌 ' || luma.person_name(auth.uid()) || ' gave you a task', v_t.title || ' · ' || v_title, 'study', v_t.project_id);
  end if;
  return true;
end;
$$;
