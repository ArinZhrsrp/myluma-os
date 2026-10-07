-- ============================================================
-- LUMA — migration 008: in-app notifications.
-- Depends on 001 (profiles, contacts) and 004 (document_shares).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
--
-- Notifications are created by the database itself (triggers below), never
-- by the client, so nobody can send another user a fake one. Each user can
-- only read, mark-read and delete their own.
-- ============================================================

create table if not exists luma.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'system',          -- welcome | share | contact_request | contact_accepted | system
  title text not null,
  body text,
  link text,                                    -- dashboard page to open on click, e.g. 'documents'
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created on luma.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread on luma.notifications (user_id) where read_at is null;

alter table luma.notifications enable row level security;

drop policy if exists "Users read their own notifications" on luma.notifications;
create policy "Users read their own notifications"
  on luma.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users update their own notifications" on luma.notifications;
create policy "Users update their own notifications"
  on luma.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete their own notifications" on luma.notifications;
create policy "Users delete their own notifications"
  on luma.notifications for delete
  using (auth.uid() = user_id);

-- no insert policy on purpose: only the security-definer helpers below create rows
grant select, update, delete on luma.notifications to authenticated;
revoke insert on luma.notifications from anon, authenticated;

-- ---------- helpers ----------
create or replace function luma.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void
language sql
security definer set search_path = ''
as $$
  insert into luma.notifications (user_id, type, title, body, link)
  values (p_user, p_type, p_title, p_body, p_link);
$$;
revoke execute on function luma.notify(uuid, text, text, text, text) from public, anon, authenticated;

create or replace function luma.display_name(p_user uuid)
returns text
language sql stable
security definer set search_path = ''
as $$
  select coalesce(nullif(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'Someone')
  from luma.profiles p where p.id = p_user;
$$;
revoke execute on function luma.display_name(uuid) from public, anon, authenticated;

-- ---------- 1. welcome, right after registration ----------
create or replace function luma.notify_welcome()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform luma.notify(
    new.id, 'welcome',
    'Welcome to LUMA 🎉',
    'Your account has been successfully registered. Your dashboard is ready — have a look around.',
    'dashboard'
  );
  return new;
end;
$$;

drop trigger if exists notify_welcome_on_profile on luma.profiles;
create trigger notify_welcome_on_profile
  after insert on luma.profiles
  for each row execute function luma.notify_welcome();

-- ---------- 2. someone shared a document with you ----------
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
  );
  return new;
end;
$$;

drop trigger if exists notify_on_document_share on luma.document_shares;
create trigger notify_on_document_share
  after insert on luma.document_shares
  for each row execute function luma.notify_document_share();

-- ---------- 3. contact requests and acceptances ----------
create or replace function luma.notify_contact_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform luma.notify(new.addressee_id, 'contact_request',
      luma.display_name(new.requester_id) || ' sent you a contact request',
      'Open Contacts to accept or decline.', 'contacts');
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'accepted' then
      perform luma.notify(new.requester_id, 'contact_accepted',
        luma.display_name(new.addressee_id) || ' accepted your contact request',
        'You can now chat and share documents with each other.', 'contacts');
    elsif new.status = 'pending' then -- a declined request re-opened by request_contact()
      perform luma.notify(new.addressee_id, 'contact_request',
        luma.display_name(new.requester_id) || ' sent you a contact request',
        'Open Contacts to accept or decline.', 'contacts');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_on_contact_change on luma.contacts;
create trigger notify_on_contact_change
  after insert or update on luma.contacts
  for each row execute function luma.notify_contact_change();

-- ---------- Realtime: lets the bell update the moment something arrives ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'luma' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table luma.notifications;
  end if;
end $$;
