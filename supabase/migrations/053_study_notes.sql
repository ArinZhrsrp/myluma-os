-- ============================================================
-- LUMA — migration 053: notes per subject, shareable with your contacts.
--   • study_notes: your notes for a subject (private by default).
--   • Share a note with accepted contacts: they can READ it under "Shared with me" (only you can edit it); you can stop sharing
--     at any time, and a person can remove a note shared with them.
-- Same rules as the other Study tables. Depends on 045, 046, 048 (luma.person_name). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.study_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id  uuid references luma.study_courses(id) on delete set null,
  title      text not null check (length(btrim(title)) between 1 and 120),
  body       text not null default '' check (length(body) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists study_notes_user on luma.study_notes (user_id, course_id);
alter table luma.study_notes enable row level security;
drop policy if exists study_notes_read on luma.study_notes;
drop policy if exists study_notes_insert on luma.study_notes;
drop policy if exists study_notes_update on luma.study_notes;
drop policy if exists study_notes_delete on luma.study_notes;
create policy study_notes_read on luma.study_notes for select to authenticated using (user_id = auth.uid());
create policy study_notes_insert on luma.study_notes for insert to authenticated with check (user_id = auth.uid() and luma.has_my_addon('study'));
create policy study_notes_update on luma.study_notes for update to authenticated using (user_id = auth.uid() and luma.has_my_addon('study')) with check (user_id = auth.uid());
create policy study_notes_delete on luma.study_notes for delete to authenticated using (user_id = auth.uid());
revoke all on luma.study_notes from anon;
grant select, insert, update, delete on luma.study_notes to authenticated;

drop trigger if exists study_notes_owner on luma.study_notes;
create trigger study_notes_owner before insert or update on luma.study_notes for each row execute function luma.study_check_owner();
drop trigger if exists study_notes_cap on luma.study_notes;
create trigger study_notes_cap before insert on luma.study_notes for each row execute function luma.study_cap('300', 'notes');
drop trigger if exists set_study_notes_updated_at on luma.study_notes;
create trigger set_study_notes_updated_at before update on luma.study_notes for each row execute function luma.set_updated_at();

create table if not exists luma.study_note_shares (
  note_id     uuid not null references luma.study_notes(id) on delete cascade,
  shared_with uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (note_id, shared_with)
);
alter table luma.study_note_shares enable row level security;
revoke all on luma.study_note_shares from anon, authenticated;

-- share one of your notes with accepted contacts
create or replace function luma.share_study_note(p_note uuid, p_users uuid[])
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare v_title text; v_user uuid; v_count int := 0; v_total int;
begin
  select title into v_title from luma.study_notes where id = p_note and user_id = auth.uid();
  if not found then raise exception 'You can only share your own notes'; end if;
  select count(*) into v_total from luma.study_note_shares where note_id = p_note;
  foreach v_user in array coalesce(p_users, '{}'::uuid[]) loop
    continue when v_user = auth.uid();
    if not exists (select 1 from luma.contacts c where c.status = 'accepted'
                   and ((c.requester_id = auth.uid() and c.addressee_id = v_user) or (c.addressee_id = auth.uid() and c.requester_id = v_user))) then
      raise exception 'You can only share with people in your contacts';
    end if;
    continue when exists (select 1 from luma.study_note_shares where note_id = p_note and shared_with = v_user);
    if v_total >= 30 then raise exception 'A note can be shared with up to 30 people'; end if;
    insert into luma.study_note_shares (note_id, shared_with) values (p_note, v_user);
    v_total := v_total + 1; v_count := v_count + 1;
    perform luma.notify(v_user, 'note_share', '📝 ' || luma.person_name(auth.uid()) || ' shared a note with you', v_title, 'study');
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.share_study_note(uuid, uuid[]) from public, anon;
grant execute on function luma.share_study_note(uuid, uuid[]) to authenticated;

-- the owner stops sharing with someone, or a person removes a note shared with them (p_user = themselves)
create or replace function luma.unshare_study_note(p_note uuid, p_user uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_user <> auth.uid() and not exists (select 1 from luma.study_notes where id = p_note and user_id = auth.uid()) then
    raise exception 'Not allowed';
  end if;
  delete from luma.study_note_shares where note_id = p_note and shared_with = p_user;
  return true;
end;
$$;
revoke execute on function luma.unshare_study_note(uuid, uuid) from public, anon;
grant execute on function luma.unshare_study_note(uuid, uuid) to authenticated;

-- who one of my notes is shared with
create or replace function luma.study_note_shared_with(p_note uuid)
returns table (user_id uuid, name text)
language sql
stable
security definer set search_path = ''
as $$
  select s.shared_with, luma.person_name(s.shared_with)
  from luma.study_note_shares s
  join luma.study_notes n on n.id = s.note_id
  where s.note_id = p_note and n.user_id = auth.uid()
  order by 2;
$$;
revoke execute on function luma.study_note_shared_with(uuid) from public, anon;
grant execute on function luma.study_note_shared_with(uuid) to authenticated;

-- notes other people shared with me
create or replace function luma.shared_study_notes()
returns table (id uuid, title text, body text, course_name text, owner_name text, updated_at timestamptz)
language sql
stable
security definer set search_path = ''
as $$
  select n.id, n.title, n.body, coalesce(c.name, ''), luma.person_name(n.user_id), n.updated_at
  from luma.study_note_shares s
  join luma.study_notes n on n.id = s.note_id
  left join luma.study_courses c on c.id = n.course_id
  where s.shared_with = auth.uid()
  order by n.updated_at desc;
$$;
revoke execute on function luma.shared_study_notes() from public, anon;
grant execute on function luma.shared_study_notes() to authenticated;
