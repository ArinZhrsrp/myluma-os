-- ============================================================
-- LUMA — migration 059: shared notes you can edit together, and files on notes.
--   • When you share a note you choose: can READ it, or can EDIT it too (title and text). You can switch a person between the two any time.
--   • Attach documents to a note: the people the note is shared with can open them (shared automatically, removed when you detach the file,
--     stop sharing, or delete the note).
-- Depends on 053, 058. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.study_note_shares add column if not exists can_edit boolean not null default false;

drop function if exists luma.share_study_note(uuid, uuid[]);
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
    perform luma.notify(v_user, 'note_share', '📝 ' || luma.person_name(auth.uid()) || ' shared a note with you' || case when p_can_edit then ' (you can edit it)' else '' end, v_title, 'study');
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.share_study_note(uuid, uuid[], boolean) from public, anon;
grant execute on function luma.share_study_note(uuid, uuid[], boolean) to authenticated;

create or replace function luma.set_study_note_edit(p_note uuid, p_user uuid, p_can_edit boolean)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  if not exists (select 1 from luma.study_notes where id = p_note and user_id = auth.uid()) then raise exception 'Not allowed'; end if;
  update luma.study_note_shares set can_edit = coalesce(p_can_edit, false) where note_id = p_note and shared_with = p_user;
  return true;
end;
$$;
revoke execute on function luma.set_study_note_edit(uuid, uuid, boolean) from public, anon;
grant execute on function luma.set_study_note_edit(uuid, uuid, boolean) to authenticated;

create or replace function luma.unshare_study_note(p_note uuid, p_user uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare f record;
begin
  if p_user <> auth.uid() and not exists (select 1 from luma.study_notes where id = p_note and user_id = auth.uid()) then raise exception 'Not allowed'; end if;
  delete from luma.study_note_shares where note_id = p_note and shared_with = p_user;
  for f in select document_id from luma.study_note_files where note_id = p_note loop perform luma.unshare_doc(f.document_id, p_user, null, null); end loop;
  return true;
end;
$$;
revoke execute on function luma.unshare_study_note(uuid, uuid) from public, anon;
grant execute on function luma.unshare_study_note(uuid, uuid) to authenticated;

drop function if exists luma.study_note_shared_with(uuid);
create or replace function luma.study_note_shared_with(p_note uuid)
returns table (user_id uuid, name text, can_edit boolean)
language sql
stable
security definer set search_path = ''
as $$
  select s.shared_with, luma.person_name(s.shared_with), s.can_edit
  from luma.study_note_shares s join luma.study_notes n on n.id = s.note_id
  where s.note_id = p_note and n.user_id = auth.uid() order by 2;
$$;
revoke execute on function luma.study_note_shared_with(uuid) from public, anon;
grant execute on function luma.study_note_shared_with(uuid) to authenticated;

drop function if exists luma.shared_study_notes();
create or replace function luma.shared_study_notes()
returns table (id uuid, title text, body text, course_name text, owner_name text, updated_at timestamptz, can_edit boolean)
language sql
stable
security definer set search_path = ''
as $$
  select n.id, n.title, n.body, coalesce(c.name, ''), luma.person_name(n.user_id), n.updated_at, s.can_edit
  from luma.study_note_shares s
  join luma.study_notes n on n.id = s.note_id
  left join luma.study_courses c on c.id = n.course_id
  where s.shared_with = auth.uid()
  order by n.updated_at desc;
$$;
revoke execute on function luma.shared_study_notes() from public, anon;
grant execute on function luma.shared_study_notes() to authenticated;

-- someone you gave edit rights changes the title / text
create or replace function luma.update_shared_study_note(p_note uuid, p_title text, p_body text)
returns timestamptz
language plpgsql
security definer set search_path = ''
as $$
declare v_at timestamptz;
begin
  if not exists (select 1 from luma.study_note_shares where note_id = p_note and shared_with = auth.uid() and can_edit) then raise exception 'You can only read this note'; end if;
  update luma.study_notes set title = btrim(coalesce(p_title, '')), body = coalesce(p_body, ''), updated_at = now() where id = p_note returning updated_at into v_at;
  return v_at;
end;
$$;
revoke execute on function luma.update_shared_study_note(uuid, text, text) from public, anon;
grant execute on function luma.update_shared_study_note(uuid, text, text) to authenticated;

-- ---------- files on notes ----------
create or replace function luma.attach_note_file(p_note uuid, p_document uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare v_id uuid; s record;
begin
  if not exists (select 1 from luma.study_notes where id = p_note and user_id = auth.uid()) then raise exception 'Only the note owner can attach files'; end if;
  if not exists (select 1 from luma.documents where id = p_document and user_id = auth.uid()) then raise exception 'You can only attach your own documents'; end if;
  if (select count(*) from luma.study_note_files where note_id = p_note) >= 10 then raise exception 'A note can have up to 10 files'; end if;
  insert into luma.study_note_files as nf (note_id, document_id) values (p_note, p_document) on conflict (note_id, document_id) do update set created_at = nf.created_at returning id into v_id;
  for s in select shared_with from luma.study_note_shares where note_id = p_note loop perform luma.share_doc(p_document, s.shared_with); end loop;
  return v_id;
end;
$$;
revoke execute on function luma.attach_note_file(uuid, uuid) from public, anon;
grant execute on function luma.attach_note_file(uuid, uuid) to authenticated;

create or replace function luma.detach_note_file(p_file uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare v_f record; s record;
begin
  select nf.* into v_f from luma.study_note_files nf join luma.study_notes n on n.id = nf.note_id where nf.id = p_file and n.user_id = auth.uid();
  if not found then return true; end if;
  delete from luma.study_note_files where id = p_file;
  for s in select shared_with from luma.study_note_shares where note_id = v_f.note_id loop perform luma.unshare_doc(v_f.document_id, s.shared_with, null, null); end loop;
  return true;
end;
$$;
revoke execute on function luma.detach_note_file(uuid) from public, anon;
grant execute on function luma.detach_note_file(uuid) to authenticated;

create or replace function luma.note_files(p_note uuid)
returns table (id uuid, document_id uuid, name text, size_bytes bigint, mime_type text, storage_path text, created_at timestamptz)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not exists (select 1 from luma.study_notes where id = p_note and user_id = auth.uid())
     and not exists (select 1 from luma.study_note_shares where note_id = p_note and shared_with = auth.uid()) then raise exception 'Not allowed'; end if;
  return query select f.id, d.id, d.name, d.size_bytes::bigint, d.mime_type, d.storage_path, f.created_at
    from luma.study_note_files f join luma.documents d on d.id = f.document_id where f.note_id = p_note order by f.created_at desc;
end;
$$;
revoke execute on function luma.note_files(uuid) from public, anon;
grant execute on function luma.note_files(uuid) to authenticated;
