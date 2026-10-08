-- ============================================================
-- LUMA — ALL MIGRATIONS in one file, for a brand-new Supabase project.
-- Generated from supabase/migrations (in order). Turn on the pg_cron extension first
-- (Database → Extensions), then paste this whole file into the SQL Editor and run it.
-- Safe to run again. Regenerate with: python3 scripts/build-all-migrations.py
-- ============================================================


-- ################################################################
-- 001_profiles_contacts_chat.sql
-- ################################################################

-- ============================================================
-- LUMA — dedicated Postgres schema for this project.
--
-- Pattern: one Supabase project = one workspace. Each app/project
-- living in that workspace gets its own schema (this one is "luma")
-- so its tables stay separate from other projects' tables in the
-- same database. auth.users itself is NOT namespaced — it's shared
-- across every schema in this Supabase project.
--
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.
-- ============================================================

create schema if not exists luma;

-- ---------- profiles ----------
-- One row per user, keyed to Supabase's own auth.users. This is the
-- table every other LUMA table (tasks, bills, habits, ...) will
-- reference via a user_id/profile_id foreign key.
create table if not exists luma.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  email text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- App settings that used to live in localStorage — moved server-side so
-- they follow the account instead of the browser. Safe to re-run: adds
-- the columns if this migration already ran before they existed.
alter table luma.profiles add column if not exists theme text not null default 'midnight';
alter table luma.profiles add column if not exists background_url text;
alter table luma.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table luma.profiles enable row level security;

drop policy if exists "Users can view their own profile" on luma.profiles;
create policy "Users can view their own profile"
  on luma.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on luma.profiles;
create policy "Users can update their own profile"
  on luma.profiles for update
  using (auth.uid() = id);

-- keep updated_at current on every edit
create or replace function luma.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_luma_profiles_updated_at on luma.profiles;
create trigger set_luma_profiles_updated_at
  before update on luma.profiles
  for each row execute function luma.set_updated_at();

-- auto-create a luma.profiles row whenever someone signs up, using
-- the first_name/last_name already passed at signUp() time
create or replace function luma.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into luma.profiles (id, first_name, last_name, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function luma.handle_new_user();

-- ---------- contacts ----------
-- One row per (unordered) pair of users — the request/accept relationship
-- that must reach status = 'accepted' before two users can message each
-- other. requester_id/addressee_id record who asked whom most recently;
-- re-requesting after a decline flips these and resets status rather than
-- creating a second row for the same pair (see request_contact() below).
create table if not exists luma.contacts (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

-- one row per unordered pair, regardless of who is currently the requester
create unique index if not exists contacts_unique_pair
  on luma.contacts (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

alter table luma.contacts enable row level security;

drop policy if exists "Participants can view their contact rows" on luma.contacts;
create policy "Participants can view their contact rows"
  on luma.contacts for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- in practice all rows are created via request_contact() (security definer,
-- bypasses this) — kept for parity with the rest of this file's policies
drop policy if exists "Requester can create a contact row" on luma.contacts;
create policy "Requester can create a contact row"
  on luma.contacts for insert
  with check (auth.uid() = requester_id);

-- only the addressee can accept/decline a pending request; re-opening a
-- declined row back to pending happens only inside request_contact()
drop policy if exists "Addressee can accept or decline" on luma.contacts;
create policy "Addressee can accept or decline"
  on luma.contacts for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id and status in ('accepted', 'declined'));

-- either side can cancel a pending request or remove an accepted contact
drop policy if exists "Either participant can remove a contact" on luma.contacts;
create policy "Either participant can remove a contact"
  on luma.contacts for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

drop trigger if exists set_luma_contacts_updated_at on luma.contacts;
create trigger set_luma_contacts_updated_at
  before update on luma.contacts
  for each row execute function luma.set_updated_at();

-- Looks up a LUMA user by email, then creates/re-opens a pending contact
-- request, in one atomic call. Runs as security definer because the caller
-- can never read another user's luma.profiles row directly (RLS is
-- auth.uid() = id) — this is the one narrow, controlled way to resolve
-- "does a LUMA account with this email exist" without exposing the whole
-- profiles table, and doing the lookup + duplicate-check + insert as a
-- single statement avoids a race between two concurrent "Add" clicks.
create or replace function luma.request_contact(p_email text)
returns table (
  ok boolean,
  reason text,
  contact_id uuid,
  other_id uuid,
  other_first_name text,
  other_last_name text
)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_target luma.profiles%rowtype;
  v_existing luma.contacts%rowtype;
  v_new_id uuid;
begin
  select * into v_target
  from luma.profiles
  where lower(email) = lower(trim(p_email))
  limit 1;

  if v_target.id is null then
    return query select false, 'not_found', null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  if v_target.id = auth.uid() then
    return query select false, 'self', null::uuid, null::uuid, null::text, null::text;
    return;
  end if;

  select * into v_existing
  from luma.contacts c
  where least(c.requester_id, c.addressee_id) = least(auth.uid(), v_target.id)
    and greatest(c.requester_id, c.addressee_id) = greatest(auth.uid(), v_target.id)
  limit 1;

  if found then
    if v_existing.status = 'accepted' then
      return query select false, 'already_accepted', v_existing.id, v_target.id, v_target.first_name, v_target.last_name;
      return;
    elsif v_existing.status = 'pending' then
      return query select false, 'already_pending', v_existing.id, v_target.id, v_target.first_name, v_target.last_name;
      return;
    else -- declined — reopen as a fresh pending request from the caller
      update luma.contacts
      set requester_id = auth.uid(), addressee_id = v_target.id, status = 'pending'
      where id = v_existing.id;
      return query select true, 'sent', v_existing.id, v_target.id, v_target.first_name, v_target.last_name;
      return;
    end if;
  end if;

  begin
    insert into luma.contacts (requester_id, addressee_id)
    values (auth.uid(), v_target.id)
    returning id into v_new_id;
  exception when unique_violation then
    return query select false, 'already_pending', null::uuid, v_target.id, v_target.first_name, v_target.last_name;
    return;
  end;

  return query select true, 'sent', v_new_id, v_target.id, v_target.first_name, v_target.last_name;
end;
$$;

-- ---------- messages ----------
-- 1:1 chat, scoped to an accepted contacts row. contact_id doubles as the
-- conversation id — there's no separate conversations table since every
-- accepted contact is exactly one conversation between exactly two people.
create table if not exists luma.messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references luma.contacts(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists messages_contact_id_created_at
  on luma.messages (contact_id, created_at);

alter table luma.messages enable row level security;

drop policy if exists "Participants of an accepted contact can read messages" on luma.messages;
create policy "Participants of an accepted contact can read messages"
  on luma.messages for select
  using (exists (
    select 1 from luma.contacts c
    where c.id = messages.contact_id
      and c.status = 'accepted'
      and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
  ));

drop policy if exists "Participants of an accepted contact can send messages" on luma.messages;
create policy "Participants of an accepted contact can send messages"
  on luma.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from luma.contacts c
      where c.id = messages.contact_id
        and c.status = 'accepted'
        and (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
    )
  );

-- keep contacts.last_message_at current, for sorting and the follow-up
-- heuristic; security definer because the sender may not be the
-- addressee_id and so isn't covered by contacts' own update policy
create or replace function luma.touch_contact_last_message()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  update luma.contacts set last_message_at = new.created_at where id = new.contact_id;
  return new;
end;
$$;

drop trigger if exists touch_contact_last_message on luma.messages;
create trigger touch_contact_last_message
  after insert on luma.messages
  for each row execute function luma.touch_contact_last_message();

-- ---------- message_reads ----------
-- Per-user "last read" marker for each conversation. Lets the Contacts page
-- tell a merely-stale contact (last_message_at old, both sides quiet) apart
-- from a genuinely unread incoming message (the other person replied and
-- the caller hasn't opened the chat since) — the latter is what should
-- surface in Follow-ups as "new message", not just "haven't talked in a while".
create table if not exists luma.message_reads (
  contact_id uuid not null references luma.contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (contact_id, user_id)
);

alter table luma.message_reads enable row level security;

drop policy if exists "Users can view their own read marker" on luma.message_reads;
create policy "Users can view their own read marker"
  on luma.message_reads for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own read marker" on luma.message_reads;
create policy "Users can create their own read marker"
  on luma.message_reads for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own read marker" on luma.message_reads;
create policy "Users can update their own read marker"
  on luma.message_reads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Everything the Contacts page needs in one round trip: the other
-- participant's name/email joined in server-side (luma.contacts has no FK
-- to luma.profiles for PostgREST to embed, and it wouldn't disambiguate
-- requester_id vs addressee_id cleanly anyway). Defined here, after
-- messages and message_reads, because its body reads both of them —
-- LANGUAGE SQL functions are checked against the catalog at creation time,
-- so the referenced tables must already exist.
-- drop first, not "create or replace": has_unread is a new output column,
-- and Postgres refuses to change an existing function's return row type
-- in place (42P13, "cannot change return type of existing function").
drop function if exists luma.list_contacts();
create function luma.list_contacts()
returns table (
  contact_id uuid,
  status text,
  direction text,
  other_id uuid,
  other_first_name text,
  other_last_name text,
  other_email text,
  last_message_at timestamptz,
  created_at timestamptz,
  has_unread boolean
)
language sql
security definer set search_path = ''
stable
as $$
  select
    c.id,
    c.status,
    case when c.requester_id = auth.uid() then 'outgoing' else 'incoming' end,
    case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end,
    p.first_name,
    p.last_name,
    p.email,
    c.last_message_at,
    c.created_at,
    (lm.sender_id is not null and lm.sender_id <> auth.uid()
      and (mr.last_read_at is null or lm.created_at > mr.last_read_at))
  from luma.contacts c
  join luma.profiles p
    on p.id = case when c.requester_id = auth.uid() then c.addressee_id else c.requester_id end
  left join lateral (
    select m.sender_id, m.created_at
    from luma.messages m
    where m.contact_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join luma.message_reads mr
    on mr.contact_id = c.id and mr.user_id = auth.uid()
  where (c.requester_id = auth.uid() or c.addressee_id = auth.uid())
    and c.status in ('pending', 'accepted')
  order by c.last_message_at desc nulls last, c.created_at desc;
$$;

-- ---------- API access ----------
-- A schema you create yourself does NOT automatically get the grants
-- Supabase pre-configures on "public" — without these, the API roles
-- can't touch it even once it's added to Exposed Schemas below.
grant usage on schema luma to anon, authenticated;
grant all on all tables in schema luma to anon, authenticated;
grant all on all sequences in schema luma to anon, authenticated;
alter default privileges in schema luma grant all on tables to anon, authenticated;
alter default privileges in schema luma grant all on sequences to anon, authenticated;

-- functions aren't covered by "grant all on all tables" above
grant execute on function luma.request_contact(text) to authenticated;
grant execute on function luma.list_contacts() to authenticated;

-- ---------- Realtime ----------
-- Lets the chat UI subscribe to new messages via supabase-js
-- postgres_changes instead of polling on an interval. Requires "luma" to
-- already be in Project Settings → API → Exposed Schemas (see README) for
-- the REST/RPC calls above — Realtime itself doesn't need that; it reads
-- the replication stream directly, gated by the table grants above and by
-- messages' own RLS policies.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'luma' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table luma.messages;
  end if;
end $$;


-- ################################################################
-- 002_tasks.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 002: Tasks & Work module.
-- Depends on 001 (luma schema, luma.set_updated_at(), API grants).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'med' check (priority in ('low', 'med', 'high')),
  tag text not null default 'Personal',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_status on luma.tasks (user_id, status, due_date);

alter table luma.tasks enable row level security;

drop policy if exists "Users manage their own tasks" on luma.tasks;
create policy "Users manage their own tasks"
  on luma.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_tasks_updated_at on luma.tasks;
create trigger set_luma_tasks_updated_at
  before update on luma.tasks
  for each row execute function luma.set_updated_at();

-- stamp/clear completed_at whenever status moves in or out of 'done'
create or replace function luma.set_task_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at = now();
  elsif new.status <> 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_luma_tasks_completed_at on luma.tasks;
create trigger set_luma_tasks_completed_at
  before insert or update on luma.tasks
  for each row execute function luma.set_task_completed_at();

-- tables created after 001's "grant all on all tables" are covered by its
-- default privileges, but grant explicitly so this file stands alone
grant all on luma.tasks to anon, authenticated;


-- ################################################################
-- 003_documents.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 003: Documents module (files + categories).
-- Depends on 001 (luma schema, luma.set_updated_at(), luma.profiles).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- ---------- categories ----------
-- Per-user, fully editable (rename / add / delete). Seeded with defaults
-- for every user so the UI never has a special "built-in" case.
create table if not exists luma.document_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- Categories can nest (parent_id). Deleting a parent promotes its children
-- to top level rather than deleting them.
alter table luma.document_categories
  add column if not exists parent_id uuid references luma.document_categories(id) on delete set null;

-- names are unique among siblings, not globally ("Receipts" may exist under
-- both "Finance" and "Health")
drop index if exists luma.document_categories_user_name;
create unique index if not exists document_categories_user_parent_name
  on luma.document_categories (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- a parent must be the caller's own category and may not create a cycle
create or replace function luma.check_category_parent()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_cur uuid := new.parent_id;
  v_depth int := 0;
begin
  while v_cur is not null loop
    if v_cur = new.id then
      raise exception 'A category cannot be placed inside itself or its own subcategory.';
    end if;
    select parent_id into v_cur from luma.document_categories
      where id = v_cur and user_id = new.user_id;
    if not found and v_cur is not null then
      raise exception 'Invalid parent category.';
    end if;
    v_depth := v_depth + 1;
    if v_depth > 5 then raise exception 'Categories can be nested at most 5 levels deep.'; end if;
  end loop;
  if new.parent_id is not null and not exists (
    select 1 from luma.document_categories where id = new.parent_id and user_id = new.user_id
  ) then
    raise exception 'Invalid parent category.';
  end if;
  return new;
end;
$$;

drop trigger if exists check_document_category_parent on luma.document_categories;
create trigger check_document_category_parent
  before insert or update of parent_id on luma.document_categories
  for each row execute function luma.check_category_parent();

alter table luma.document_categories enable row level security;

drop policy if exists "Users manage their own document categories" on luma.document_categories;
create policy "Users manage their own document categories"
  on luma.document_categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function luma.seed_document_categories(p_user uuid)
returns void
language sql
security definer set search_path = ''
as $$
  insert into luma.document_categories (user_id, name)
  select p_user, n
  from unnest(array['Contracts','Receipts','Finance','ID','Health','Warranty','Other']) as n
  where not exists (select 1 from luma.document_categories c where c.user_id = p_user);
$$;

-- seed on signup (profiles row is created by 001's auth trigger)...
create or replace function luma.seed_categories_on_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform luma.seed_document_categories(new.id);
  return new;
end;
$$;

drop trigger if exists seed_document_categories_on_profile on luma.profiles;
create trigger seed_document_categories_on_profile
  after insert on luma.profiles
  for each row execute function luma.seed_categories_on_profile();

-- ...and backfill everyone who signed up before this migration
-- (skips users who already have any categories, so deleted defaults stay deleted)
insert into luma.document_categories (user_id, name)
select p.id, n
from luma.profiles p
cross join unnest(array['Contracts','Receipts','Finance','ID','Health','Warranty','Other']) as n
where not exists (select 1 from luma.document_categories c where c.user_id = p.id);

-- ---------- documents ----------
-- Metadata row per uploaded file; the bytes live in Storage at storage_path.
-- Deleting a category leaves its documents uncategorised (category_id null).
create table if not exists luma.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references luma.document_categories(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  mime_type text,
  size_bytes bigint not null default 0,
  storage_path text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_user_created on luma.documents (user_id, created_at desc);
create index if not exists documents_category on luma.documents (category_id);

alter table luma.documents enable row level security;

drop policy if exists "Users manage their own documents" on luma.documents;
create policy "Users manage their own documents"
  on luma.documents for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    -- a document can only be filed under one of the caller's own categories
    and (category_id is null or exists (
      select 1 from luma.document_categories c
      where c.id = category_id and c.user_id = auth.uid()
    ))
  );

drop trigger if exists set_luma_documents_updated_at on luma.documents;
create trigger set_luma_documents_updated_at
  before update on luma.documents
  for each row execute function luma.set_updated_at();

grant all on luma.document_categories, luma.documents to anon, authenticated;
grant execute on function luma.seed_document_categories(uuid) to postgres;
revoke execute on function luma.seed_document_categories(uuid) from public, anon, authenticated;

-- ---------- Storage ----------
-- Private bucket, 50 MB per file at most (each plan sets its own smaller limit, see 033_plans.sql). Objects live under "<user_id>/…" and
-- policies only let a user touch their own folder.
insert into storage.buckets (id, name, public, file_size_limit)
values ('luma-documents', 'luma-documents', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "Users read their own document files" on storage.objects;
create policy "Users read their own document files"
  on storage.objects for select to authenticated
  using (bucket_id = 'luma-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users upload to their own document folder" on storage.objects;
create policy "Users upload to their own document folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'luma-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users delete their own document files" on storage.objects;
create policy "Users delete their own document files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'luma-documents' and (storage.foldername(name))[1] = auth.uid()::text);


-- ################################################################
-- 004_document_sharing.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 004: share documents with accepted contacts.
-- Depends on 001 (contacts) and 003 (documents + storage bucket).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.document_shares (
  document_id uuid not null references luma.documents(id) on delete cascade,
  shared_with uuid not null references auth.users(id) on delete cascade,
  shared_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, shared_with),
  check (shared_with <> shared_by)
);

create index if not exists document_shares_shared_with on luma.document_shares (shared_with);

-- Helpers are security definer so the policies below never trigger each
-- other's RLS (documents ↔ document_shares would otherwise recurse).
create or replace function luma.owns_document(p_doc uuid)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (select 1 from luma.documents d where d.id = p_doc and d.user_id = auth.uid());
$$;

create or replace function luma.is_accepted_contact(p_other uuid)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from luma.contacts c
    where c.status = 'accepted'
      and ((c.requester_id = auth.uid() and c.addressee_id = p_other)
        or (c.addressee_id = auth.uid() and c.requester_id = p_other))
  );
$$;

-- true if a document shared with the caller lives at this Storage path
create or replace function luma.can_read_shared_file(p_path text)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from luma.documents d
    join luma.document_shares s on s.document_id = d.id
    where d.storage_path = p_path and s.shared_with = auth.uid()
  );
$$;

alter table luma.document_shares enable row level security;

drop policy if exists "Owner and recipient can view a share" on luma.document_shares;
create policy "Owner and recipient can view a share"
  on luma.document_shares for select
  using (auth.uid() = shared_by or auth.uid() = shared_with);

-- only your own documents, only with people you're connected to
drop policy if exists "Owner can share with an accepted contact" on luma.document_shares;
create policy "Owner can share with an accepted contact"
  on luma.document_shares for insert
  with check (
    shared_by = auth.uid()
    and luma.owns_document(document_id)
    and luma.is_accepted_contact(shared_with)
  );

-- owner can unshare; recipient can remove it from their own list
drop policy if exists "Owner or recipient can remove a share" on luma.document_shares;
create policy "Owner or recipient can remove a share"
  on luma.document_shares for delete
  using (auth.uid() = shared_by or auth.uid() = shared_with);

-- recipients can read the shared documents row (read-only)...
drop policy if exists "Recipients can view shared documents" on luma.documents;
create policy "Recipients can view shared documents"
  on luma.documents for select
  using (exists (
    select 1 from luma.document_shares s
    where s.document_id = documents.id and s.shared_with = auth.uid()
  ));

-- ...and download the file itself
drop policy if exists "Recipients can read shared document files" on storage.objects;
create policy "Recipients can read shared document files"
  on storage.objects for select to authenticated
  using (bucket_id = 'luma-documents' and luma.can_read_shared_file(name));

-- Documents others have shared with the caller, with the owner's name
-- joined in (profiles are not readable across users directly).
create or replace function luma.list_shared_documents()
returns table (
  id uuid,
  name text,
  mime_type text,
  size_bytes bigint,
  storage_path text,
  created_at timestamptz,
  shared_at timestamptz,
  owner_id uuid,
  owner_first_name text,
  owner_last_name text,
  owner_email text
)
language sql security definer stable set search_path = ''
as $$
  select d.id, d.name, d.mime_type, d.size_bytes, d.storage_path, d.created_at,
         s.created_at, d.user_id, p.first_name, p.last_name, p.email
  from luma.document_shares s
  join luma.documents d on d.id = s.document_id
  join luma.profiles p on p.id = d.user_id
  where s.shared_with = auth.uid()
  order by s.created_at desc;
$$;

grant all on luma.document_shares to anon, authenticated;
grant execute on function luma.list_shared_documents() to authenticated;
grant execute on function luma.owns_document(uuid), luma.is_accepted_contact(uuid), luma.can_read_shared_file(text) to authenticated;


-- ################################################################
-- 005_notes.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 005: Notes & Docs module.
-- Depends on 001 (luma schema, luma.set_updated_at()) and 003/004
-- (documents, which notes can reference). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  tag text not null default 'Personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_updated on luma.notes (user_id, updated_at desc);

alter table luma.notes enable row level security;

drop policy if exists "Users manage their own notes" on luma.notes;
create policy "Users manage their own notes"
  on luma.notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_notes_updated_at on luma.notes;
create trigger set_luma_notes_updated_at
  before update on luma.notes
  for each row execute function luma.set_updated_at();

-- ---------- note ↔ document links ----------
-- A note references documents from the Documents menu (own files, or files
-- shared with the user). Deleting either side removes the link only.
create table if not exists luma.note_documents (
  note_id uuid not null references luma.notes(id) on delete cascade,
  document_id uuid not null references luma.documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, document_id)
);

create index if not exists note_documents_document on luma.note_documents (document_id);

alter table luma.note_documents enable row level security;

drop policy if exists "Users manage links on their own notes" on luma.note_documents;
create policy "Users manage links on their own notes"
  on luma.note_documents for all
  using (exists (select 1 from luma.notes n where n.id = note_id and n.user_id = auth.uid()))
  with check (
    exists (select 1 from luma.notes n where n.id = note_id and n.user_id = auth.uid())
    -- and the document must be one the caller can already see
    and exists (select 1 from luma.documents d where d.id = document_id)
  );

grant all on luma.notes, luma.note_documents to anon, authenticated;


-- ################################################################
-- 006_colors.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 006: user-chosen colours for document categories
-- and note tags. Depends on 003 (document_categories) and 005 (notes).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- Category colour: a #rrggbb hex. NULL = not chosen yet (the app falls back
-- to a stable colour derived from the category's id).
alter table luma.document_categories
  add column if not exists color text;

alter table luma.document_categories
  drop constraint if exists document_categories_color_hex;
alter table luma.document_categories
  add constraint document_categories_color_hex check (color is null or color ~ '^#[0-9a-fA-F]{6}$');

-- Tags are plain text on notes, so their colours live in their own table:
-- one row per (user, tag name), case-insensitive.
create table if not exists luma.note_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create unique index if not exists note_tags_user_name
  on luma.note_tags (user_id, lower(name));

alter table luma.note_tags enable row level security;

drop policy if exists "Users manage their own tag colours" on luma.note_tags;
create policy "Users manage their own tag colours"
  on luma.note_tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on luma.note_tags to anon, authenticated;


-- ################################################################
-- 007_shared_document_categories.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 007: let a recipient file a shared document under
-- one of their OWN categories. Depends on 003 and 004.
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- The category lives on the share row (it is the recipient's private filing,
-- the owner's own category for the document is unaffected). Deleting the
-- category just un-files the shared document.
alter table luma.document_shares
  add column if not exists recipient_category_id uuid
  references luma.document_categories(id) on delete set null;

-- Recipients can't update share rows directly (no update policy), so filing
-- goes through this function, which checks the caller really is the recipient
-- and that the category is theirs. NULL un-files it.
create or replace function luma.set_shared_document_category(p_document uuid, p_category uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if p_category is not null and not exists (
    select 1 from luma.document_categories c where c.id = p_category and c.user_id = auth.uid()
  ) then
    raise exception 'Invalid category.';
  end if;

  update luma.document_shares
  set recipient_category_id = p_category
  where document_id = p_document and shared_with = auth.uid();

  if not found then
    raise exception 'That document is not shared with you.';
  end if;
end;
$$;

grant execute on function luma.set_shared_document_category(uuid, uuid) to authenticated;

-- list_shared_documents gains recipient_category_id; the return type
-- changes, so drop and recreate rather than "create or replace".
drop function if exists luma.list_shared_documents();
create function luma.list_shared_documents()
returns table (
  id uuid,
  name text,
  mime_type text,
  size_bytes bigint,
  storage_path text,
  created_at timestamptz,
  shared_at timestamptz,
  owner_id uuid,
  owner_first_name text,
  owner_last_name text,
  owner_email text,
  recipient_category_id uuid
)
language sql security definer stable set search_path = ''
as $$
  select d.id, d.name, d.mime_type, d.size_bytes, d.storage_path, d.created_at,
         s.created_at, d.user_id, p.first_name, p.last_name, p.email,
         s.recipient_category_id
  from luma.document_shares s
  join luma.documents d on d.id = s.document_id
  join luma.profiles p on p.id = d.user_id
  where s.shared_with = auth.uid()
  order by s.created_at desc;
$$;

grant execute on function luma.list_shared_documents() to authenticated;


-- ################################################################
-- 008_notifications.sql
-- ################################################################

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


-- ################################################################
-- 009_nudges.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 009: nudge a contact ("hey, read my message").
-- Depends on 001 (contacts) and 008 (notifications).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- who triggered the notification, and which contact/chat it refers to
-- (so clicking a nudge can open that exact chat)
alter table luma.notifications add column if not exists actor_id uuid references auth.users(id) on delete set null;
alter table luma.notifications add column if not exists ref uuid;

create index if not exists notifications_nudge_rate
  on luma.notifications (user_id, actor_id, created_at desc) where type = 'nudge';

-- Sends a 'nudge' notification to the other person in an accepted contact.
-- Only the two participants can use it, and the same sender can nudge the
-- same person at most once every 3 minutes (so it can't be used to spam).
-- The limit is per sender → receiver: being nudged by someone never stops you
-- from nudging them back.
-- Returns ok / reason ('sent' | 'not_found' | 'too_soon') / retry_after (seconds).
create or replace function luma.nudge_contact(p_contact uuid)
returns table (ok boolean, reason text, retry_after int)
language plpgsql
security definer set search_path = ''
as $$
declare
  v_contact luma.contacts%rowtype;
  v_target uuid;
  v_last timestamptz;
  v_wait int := 180; -- seconds between nudges to the same person
begin
  select * into v_contact
  from luma.contacts c
  where c.id = p_contact
    and c.status = 'accepted'
    and (c.requester_id = auth.uid() or c.addressee_id = auth.uid());

  if not found then
    return query select false, 'not_found', 0;
    return;
  end if;

  v_target := case when v_contact.requester_id = auth.uid() then v_contact.addressee_id else v_contact.requester_id end;

  select max(n.created_at) into v_last
  from luma.notifications n
  where n.user_id = v_target and n.actor_id = auth.uid() and n.type = 'nudge';

  if v_last is not null and v_last > now() - make_interval(secs => v_wait) then
    return query select false, 'too_soon',
      greatest(1, ceil(extract(epoch from (v_last + make_interval(secs => v_wait) - now())))::int);
    return;
  end if;

  insert into luma.notifications (user_id, type, title, body, link, actor_id, ref)
  values (
    v_target, 'nudge',
    luma.display_name(auth.uid()) || ' nudged you 👋',
    'You have a message waiting — open the chat to read it.',
    'contacts', auth.uid(), p_contact
  );

  return query select true, 'sent', 0;
end;
$$;

grant execute on function luma.nudge_contact(uuid) to authenticated;


-- ################################################################
-- 010_message_notifications.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 010: notify the receiver when a chat message arrives.
-- Depends on 001 (messages), 008 (notifications) and 009 (actor_id / ref).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- One notification per conversation while it's unread: a new message replaces
-- the previous unread "message" notification from the same sender, so a burst
-- of messages shows as a single, always-latest entry instead of flooding the
-- bell. (Each replacement is a fresh row, so the receiver still gets a live
-- pop-up for every message.)
create or replace function luma.notify_new_message()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_contact luma.contacts%rowtype;
  v_target uuid;
begin
  select * into v_contact from luma.contacts where id = new.contact_id;
  if not found then
    return new;
  end if;

  v_target := case when v_contact.requester_id = new.sender_id then v_contact.addressee_id else v_contact.requester_id end;

  delete from luma.notifications
  where user_id = v_target and type = 'message' and ref = new.contact_id
    and actor_id = new.sender_id and read_at is null;

  insert into luma.notifications (user_id, type, title, body, link, actor_id, ref)
  values (
    v_target, 'message',
    luma.display_name(new.sender_id) || ' sent you a message',
    left(new.body, 120),
    'contacts', new.sender_id, new.contact_id
  );

  return new;
end;
$$;

drop trigger if exists notify_on_new_message on luma.messages;
create trigger notify_on_new_message
  after insert on luma.messages
  for each row execute function luma.notify_new_message();


-- ################################################################
-- 011_health.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 011: Health module (daily logs + personal goals).
-- Depends on 001 (luma schema, luma.set_updated_at()).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- One row per user per day. Every metric is optional (NULL = not logged).
create table if not exists luma.health_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null,
  sleep_hours numeric(4,1) check (sleep_hours is null or (sleep_hours >= 0 and sleep_hours <= 24)),
  water_ml integer check (water_ml is null or (water_ml >= 0 and water_ml <= 20000)),
  steps integer check (steps is null or (steps >= 0 and steps <= 200000)),
  active_minutes integer check (active_minutes is null or (active_minutes >= 0 and active_minutes <= 1440)),
  mood smallint check (mood is null or (mood between 1 and 5)),  -- 1 = low … 5 = great
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index if not exists health_logs_user_date on luma.health_logs (user_id, log_date desc);

alter table luma.health_logs enable row level security;

drop policy if exists "Users manage their own health logs" on luma.health_logs;
create policy "Users manage their own health logs"
  on luma.health_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_health_logs_updated_at on luma.health_logs;
create trigger set_luma_health_logs_updated_at
  before update on luma.health_logs
  for each row execute function luma.set_updated_at();

-- Daily targets, one row per user (the rings on the Health page measure against these).
create table if not exists luma.health_goals (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  sleep_hours numeric(3,1) not null default 8 check (sleep_hours > 0 and sleep_hours <= 24),
  water_ml integer not null default 2500 check (water_ml > 0 and water_ml <= 20000),
  steps integer not null default 10000 check (steps > 0 and steps <= 200000),
  active_minutes integer not null default 45 check (active_minutes > 0 and active_minutes <= 1440),
  updated_at timestamptz not null default now()
);

alter table luma.health_goals enable row level security;

drop policy if exists "Users manage their own health goals" on luma.health_goals;
create policy "Users manage their own health goals"
  on luma.health_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_health_goals_updated_at on luma.health_goals;
create trigger set_luma_health_goals_updated_at
  before update on luma.health_goals
  for each row execute function luma.set_updated_at();

grant all on luma.health_logs, luma.health_goals to anon, authenticated;


-- ################################################################
-- 012_health_quick_add.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 012: configurable quick-add amounts for the Health rings.
-- Depends on 011 (health_goals). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- How much each one-tap "+" button on the Health page adds. Stored with the
-- goals (one row per user); the app falls back to the defaults below until
-- this migration has been run.
alter table luma.health_goals add column if not exists quick_sleep_hours numeric(3,1) not null default 0.5;
alter table luma.health_goals add column if not exists quick_water_ml integer not null default 250;
alter table luma.health_goals add column if not exists quick_steps integer not null default 500;
alter table luma.health_goals add column if not exists quick_active_minutes integer not null default 10;

alter table luma.health_goals drop constraint if exists health_goals_quick_ranges;
alter table luma.health_goals add constraint health_goals_quick_ranges check (
  quick_sleep_hours > 0 and quick_sleep_hours <= 12
  and quick_water_ml > 0 and quick_water_ml <= 5000
  and quick_steps > 0 and quick_steps <= 20000
  and quick_active_minutes > 0 and quick_active_minutes <= 600
);


-- ################################################################
-- 013_health_reminders.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 013: Health reminders (water / steps / sleep) and
-- bedtime + wake-up time on sleep logs.
-- Depends on 008 (notifications) and 011 (health). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- ---------- sleep logs: bedtime and wake-up time ----------
-- Stored as 24-hour 'HH:MM' text. When both are given the app works out
-- sleep_hours from them (wake-up may be after midnight).
alter table luma.health_logs add column if not exists bedtime text;
alter table luma.health_logs add column if not exists wake_time text;

alter table luma.health_logs drop constraint if exists health_logs_bedtime_fmt;
alter table luma.health_logs add constraint health_logs_bedtime_fmt
  check (bedtime is null or bedtime ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table luma.health_logs drop constraint if exists health_logs_wake_time_fmt;
alter table luma.health_logs add constraint health_logs_wake_time_fmt
  check (wake_time is null or wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- ---------- reminder settings (one row per user) ----------
create table if not exists luma.health_reminders (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  water_enabled boolean not null default false,
  water_every_min integer not null default 60 check (water_every_min between 15 and 480),
  water_from text not null default '08:00' check (water_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  water_to text not null default '22:00' check (water_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  steps_enabled boolean not null default false,
  steps_every_min integer not null default 180 check (steps_every_min between 30 and 720),
  steps_from text not null default '10:00' check (steps_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  steps_to text not null default '20:00' check (steps_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  sleep_enabled boolean not null default false,
  bedtime text not null default '23:00' check (bedtime ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  wake_time text not null default '07:00' check (wake_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  sleep_lead_min integer not null default 30 check (sleep_lead_min between 0 and 240),
  updated_at timestamptz not null default now()
);

alter table luma.health_reminders enable row level security;

drop policy if exists "Users manage their own reminder settings" on luma.health_reminders;
create policy "Users manage their own reminder settings"
  on luma.health_reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_health_reminders_updated_at on luma.health_reminders;
create trigger set_luma_health_reminders_updated_at
  before update on luma.health_reminders
  for each row execute function luma.set_updated_at();

grant all on luma.health_reminders to anon, authenticated;

-- ---------- delivering a reminder ----------
-- Clients can't insert notifications directly. The app calls this when a
-- reminder is due (it runs while LUMA is open); the function only ever writes
-- a reminder for the caller themselves, uses fixed titles, and refuses a
-- second reminder of the same kind within 10 minutes, so it can't be abused.
create or replace function luma.push_reminder(p_kind text, p_body text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_title text;
  v_type text := 'reminder_' || p_kind;
begin
  v_title := case p_kind
    when 'water' then '💧 Time to drink water'
    when 'steps' then '👟 Time to get some steps in'
    when 'sleep' then '🌙 Time to wind down'
    else null end;

  if v_title is null or auth.uid() is null then
    return false;
  end if;

  if exists (
    select 1 from luma.notifications n
    where n.user_id = auth.uid() and n.type = v_type and n.created_at > now() - interval '10 minutes'
  ) then
    return false;
  end if;

  insert into luma.notifications (user_id, type, title, body, link)
  values (auth.uid(), v_type, v_title, left(coalesce(p_body, ''), 160), 'health');
  return true;
end;
$$;

grant execute on function luma.push_reminder(text, text) to authenticated;


-- ################################################################
-- 014_server_reminders_and_push.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 014: reminders that run on the server, plus storage for
-- Web Push subscriptions.
-- Depends on 008 (notifications), 011 (health), 013 (health_reminders).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
--
-- Part A  creates the water / steps / sleep reminder notifications from the
--         database every minute (pg_cron), so they exist even if LUMA is closed.
-- Part B  stores each device's push subscription so the `send-push` Edge
--         Function can deliver notifications to a device that has LUMA closed.
--         (See README → "Background reminders & push".)
-- ============================================================

-- ---------- helpers ----------
create or replace function luma.fmt12(p_hhmm text)
returns text
language sql immutable
set search_path = ''
as $$
  select to_char(('2000-01-01 ' || p_hhmm)::timestamp, 'FMHH12:MI AM');
$$;

create or replace function luma.hhmm_to_min(p_hhmm text)
returns integer
language sql immutable
set search_path = ''
as $$
  select split_part(p_hhmm, ':', 1)::int * 60 + split_part(p_hhmm, ':', 2)::int;
$$;

-- true if this user already got a notification of this type in the last 10 minutes
-- (stops the in-app timer and this job from both sending the same reminder)
create or replace function luma.reminder_recent(p_user uuid, p_type text)
returns boolean
language sql stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from luma.notifications n
    where n.user_id = p_user and n.type = p_type and n.created_at > now() - interval '10 minutes'
  );
$$;
revoke execute on function luma.reminder_recent(uuid, text) from public, anon, authenticated;

-- ---------- A. the reminder job ----------
-- Mirrors the in-app scheduler: water / steps remind every N minutes inside a
-- From–Until window (skipped once the day's goal is reached); sleep reminds
-- `sleep_lead_min` before bedtime. All times are Malaysia time. Runs each minute,
-- so a reminder is due at its slot minute (or the minute after, if a run was late).
create or replace function luma.run_health_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp := timezone('Asia/Kuala_Lumpur', now());
  v_min int := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
  v_day date := v_now::date;
  v_from int; v_to int; v_slot int; v_mins int;
  v_have int; v_count int := 0;
begin
  for r in
    select hr.*, coalesce(g.water_ml, 2500) as goal_water, coalesce(g.steps, 10000) as goal_steps
    from luma.health_reminders hr
    left join luma.health_goals g on g.user_id = hr.user_id
    where hr.water_enabled or hr.steps_enabled or hr.sleep_enabled
  loop
    -- water
    if r.water_enabled then
      v_from := luma.hhmm_to_min(r.water_from); v_to := luma.hhmm_to_min(r.water_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.water_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_water') then
        v_have := 0;
        select coalesce(l.water_ml, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_water then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_water', '💧 Time to drink water',
            'You''ve had ' || round(coalesce(v_have, 0) / 1000.0, 2)::float8::text || ' L of your '
              || round(r.goal_water / 1000.0, 2)::float8::text || ' L goal — time for a glass.', 'health');
          v_count := v_count + 1;
        end if;
      end if;
    end if;

    -- steps
    if r.steps_enabled then
      v_from := luma.hhmm_to_min(r.steps_from); v_to := luma.hhmm_to_min(r.steps_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.steps_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_steps') then
        v_have := 0;
        select coalesce(l.steps, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_steps then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_steps', '👟 Time to get some steps in',
            to_char(coalesce(v_have, 0), 'FM999,999') || ' of ' || to_char(r.goal_steps, 'FM999,999')
              || ' steps so far — a short walk will help.', 'health');
          v_count := v_count + 1;
        end if;
      end if;
    end if;

    -- sleep
    if r.sleep_enabled then
      v_slot := (((luma.hhmm_to_min(r.bedtime) - r.sleep_lead_min) % 1440) + 1440) % 1440;
      if (v_min = v_slot or v_min = (v_slot + 1) % 1440) and not luma.reminder_recent(r.user_id, 'reminder_sleep') then
        v_mins := (((luma.hhmm_to_min(r.wake_time) - luma.hhmm_to_min(r.bedtime)) % 1440) + 1440) % 1440;
        insert into luma.notifications (user_id, type, title, body, link)
        values (r.user_id, 'reminder_sleep', '🌙 Time to wind down',
          'Bedtime is ' || luma.fmt12(r.bedtime) || ' — wind down now to get about '
            || round(v_mins / 60.0, 1)::float8::text || 'h before your ' || luma.fmt12(r.wake_time) || ' wake-up.', 'health');
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;
revoke execute on function luma.run_health_reminders() from public, anon, authenticated;

-- schedule it every minute (needs the pg_cron extension)
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-health-reminders') then
    perform cron.unschedule('luma-health-reminders');
  end if;
  perform cron.schedule('luma-health-reminders', '* * * * *', 'select luma.run_health_reminders()');
exception when others then
  raise notice 'Could not schedule the reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;

-- ---------- B. push subscriptions (one row per browser/device) ----------
create table if not exists luma.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user on luma.push_subscriptions (user_id);

alter table luma.push_subscriptions enable row level security;

drop policy if exists "Users manage their own push subscriptions" on luma.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on luma.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on luma.push_subscriptions to anon, authenticated;


-- ################################################################
-- 015_active_reminder.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 015: "Active minutes" reminder (like water / steps).
-- Depends on 011 (health), 013 (health_reminders) and 014 (server reminder job).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.health_reminders add column if not exists active_enabled boolean not null default false;
alter table luma.health_reminders add column if not exists active_every_min integer not null default 180;
alter table luma.health_reminders add column if not exists active_from text not null default '10:00';
alter table luma.health_reminders add column if not exists active_to text not null default '20:00';

alter table luma.health_reminders drop constraint if exists health_reminders_active_every_min_check;
alter table luma.health_reminders add constraint health_reminders_active_every_min_check check (active_every_min between 30 and 720);
alter table luma.health_reminders drop constraint if exists health_reminders_active_from_check;
alter table luma.health_reminders add constraint health_reminders_active_from_check check (active_from ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table luma.health_reminders drop constraint if exists health_reminders_active_to_check;
alter table luma.health_reminders add constraint health_reminders_active_to_check check (active_to ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- the in-app reminder delivery learns the new kind
create or replace function luma.push_reminder(p_kind text, p_body text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare
  v_title text;
  v_type text := 'reminder_' || p_kind;
begin
  v_title := case p_kind
    when 'water' then '💧 Time to drink water'
    when 'steps' then '👟 Time to get some steps in'
    when 'active' then '🔥 Time to get moving'
    when 'sleep' then '🌙 Time to wind down'
    else null end;

  if v_title is null or auth.uid() is null then
    return false;
  end if;

  if exists (
    select 1 from luma.notifications n
    where n.user_id = auth.uid() and n.type = v_type and n.created_at > now() - interval '10 minutes'
  ) then
    return false;
  end if;

  insert into luma.notifications (user_id, type, title, body, link)
  values (auth.uid(), v_type, v_title, left(coalesce(p_body, ''), 160), 'health');
  return true;
end;
$$;

grant execute on function luma.push_reminder(text, text) to authenticated;

-- the server-side job (every minute) learns it too
create or replace function luma.run_health_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp := timezone('Asia/Kuala_Lumpur', now());
  v_min int := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
  v_day date := v_now::date;
  v_from int; v_to int; v_slot int; v_mins int;
  v_have int; v_count int := 0;
begin
  for r in
    select hr.*, coalesce(g.water_ml, 2500) as goal_water, coalesce(g.steps, 10000) as goal_steps, coalesce(g.active_minutes, 45) as goal_active
    from luma.health_reminders hr
    left join luma.health_goals g on g.user_id = hr.user_id
    where hr.water_enabled or hr.steps_enabled or hr.active_enabled or hr.sleep_enabled
  loop
    -- water
    if r.water_enabled then
      v_from := luma.hhmm_to_min(r.water_from); v_to := luma.hhmm_to_min(r.water_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.water_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_water') then
        v_have := 0;
        select coalesce(l.water_ml, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_water then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_water', '💧 Time to drink water',
            'You''ve had ' || round(coalesce(v_have, 0) / 1000.0, 2)::float8::text || ' L of your '
              || round(r.goal_water / 1000.0, 2)::float8::text || ' L goal — time for a glass.', 'health');
          v_count := v_count + 1;
        end if;
      end if;
    end if;

    -- steps
    if r.steps_enabled then
      v_from := luma.hhmm_to_min(r.steps_from); v_to := luma.hhmm_to_min(r.steps_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.steps_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_steps') then
        v_have := 0;
        select coalesce(l.steps, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_steps then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_steps', '👟 Time to get some steps in',
            to_char(coalesce(v_have, 0), 'FM999,999') || ' of ' || to_char(r.goal_steps, 'FM999,999')
              || ' steps so far — a short walk will help.', 'health');
          v_count := v_count + 1;
        end if;
      end if;
    end if;

    -- active
    if r.active_enabled then
      v_from := luma.hhmm_to_min(r.active_from); v_to := luma.hhmm_to_min(r.active_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.active_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_active') then
        v_have := 0;
        select coalesce(l.active_minutes, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_active then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_active', '🔥 Time to get moving',
            coalesce(v_have, 0) || ' of ' || r.goal_active || ' active minutes so far — a quick workout will help.', 'health');
          v_count := v_count + 1;
        end if;
      end if;
    end if;

    -- sleep
    if r.sleep_enabled then
      v_slot := (((luma.hhmm_to_min(r.bedtime) - r.sleep_lead_min) % 1440) + 1440) % 1440;
      if (v_min = v_slot or v_min = (v_slot + 1) % 1440) and not luma.reminder_recent(r.user_id, 'reminder_sleep') then
        v_mins := (((luma.hhmm_to_min(r.wake_time) - luma.hhmm_to_min(r.bedtime)) % 1440) + 1440) % 1440;
        insert into luma.notifications (user_id, type, title, body, link)
        values (r.user_id, 'reminder_sleep', '🌙 Time to wind down',
          'Bedtime is ' || luma.fmt12(r.bedtime) || ' — wind down now to get about '
            || round(v_mins / 60.0, 1)::float8::text || 'h before your ' || luma.fmt12(r.wake_time) || ' wake-up.', 'health');
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;
revoke execute on function luma.run_health_reminders() from public, anon, authenticated;


-- ################################################################
-- 016_habits.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 016: Habits module.
-- Depends on 001 (luma schema, luma.set_updated_at(), API grants).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- one row per habit; `days` = the weekdays it applies to (0 = Sunday … 6 = Saturday)
create table if not exists luma.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0 and length(name) <= 80),
  icon text not null default 'fa-circle-check' check (icon ~ '^fa-[a-z0-9-]+$'),
  color text not null default '#3b82f6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  target text not null default '' check (length(target) <= 40),
  days smallint[] not null default '{0,1,2,3,4,5,6}'
    check (cardinality(days) between 1 and 7 and days <@ array[0,1,2,3,4,5,6]::smallint[]),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists habits_user on luma.habits (user_id, archived, created_at);

alter table luma.habits enable row level security;

drop policy if exists "Users manage their own habits" on luma.habits;
create policy "Users manage their own habits"
  on luma.habits for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_habits_updated_at on luma.habits;
create trigger set_luma_habits_updated_at
  before update on luma.habits
  for each row execute function luma.set_updated_at();

-- one row per habit per day it was done (no row = not done); log_date is Malaysia-time calendar day
create table if not exists luma.habit_logs (
  habit_id uuid not null references luma.habits(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, log_date)
);

create index if not exists habit_logs_user_date on luma.habit_logs (user_id, log_date desc);

alter table luma.habit_logs enable row level security;

drop policy if exists "Users manage their own habit logs" on luma.habit_logs;
create policy "Users manage their own habit logs"
  on luma.habit_logs for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from luma.habits h where h.id = habit_id and h.user_id = auth.uid())
  );

grant all on luma.habits to anon, authenticated;
grant all on luma.habit_logs to anon, authenticated;


-- ################################################################
-- 017_habit_periods.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 017: habits that repeat daily / weekly / monthly, measurable
-- habits (e.g. "5 pages", "30 min") and a sleep habit read from Health.
-- Depends on 016 (habits). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- daily = every day you pick (the `days` column); weekly / monthly = `per_period` times per week / month
alter table luma.habits add column if not exists period text not null default 'daily' check (period in ('daily', 'weekly', 'monthly'));
alter table luma.habits add column if not exists per_period smallint not null default 1 check (per_period between 1 and 31);
-- measurable habit: it counts as done on a day once the logged amount reaches goal_value (unit is just a label)
alter table luma.habits add column if not exists goal_value numeric check (goal_value > 0);
alter table luma.habits add column if not exists unit text not null default '' check (length(unit) <= 20);
-- 'sleep' = done automatically on days the Health sleep log reaches goal_value hours
alter table luma.habits add column if not exists source text not null default 'manual' check (source in ('manual', 'sleep'));

-- the amount done that day (only for measurable habits)
alter table luma.habit_logs add column if not exists value numeric check (value >= 0);


-- ################################################################
-- 018_habit_reminders.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 018: a reminder time per habit, delivered as a notification
-- (and as a push to your devices through the send-push webhook).
-- Depends on 008/009 (notifications), 014 (luma.hhmm_to_min, pg_cron) and 016/017 (habits).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- 24-hour 'HH:MM' in Malaysia time; null = no reminder
alter table luma.habits add column if not exists reminder_time text
  check (reminder_time is null or reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- Runs every minute. For each habit whose reminder time is now (or was a minute ago, if a run was late) it creates a
-- 'reminder_habit' notification — unless the habit is already done for today (daily) / this week / this month, isn't
-- scheduled today, or was already reminded in the last 10 minutes. Weekly / monthly habits remind each day at that
-- time until they are done for the period.
create or replace function luma.run_habit_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  h record;
  v_now timestamp := timezone('Asia/Kuala_Lumpur', now());
  v_min int := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
  v_day date := v_now::date;
  v_from date;
  v_slot int;
  v_done int;
  v_need int;
  v_hours numeric;
  v_count int := 0;
begin
  for h in
    select * from luma.habits where reminder_time is not null and not archived
  loop
    v_slot := luma.hhmm_to_min(h.reminder_time);
    continue when not (v_min = v_slot or v_min = (v_slot + 1) % 1440);
    continue when h.period = 'daily' and not (extract(dow from v_day)::smallint = any (h.days));
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = h.user_id and n.type = 'reminder_habit' and n.ref = h.id and n.created_at > now() - interval '10 minutes'
    );

    -- already done for this day / week / month?
    v_from := case h.period when 'weekly' then date_trunc('week', v_day)::date when 'monthly' then date_trunc('month', v_day)::date else v_day end;
    v_need := case when h.period = 'daily' then 1 else h.per_period end;
    if h.source = 'sleep' then
      select count(*) into v_done from luma.health_logs l
        where l.user_id = h.user_id and l.log_date between v_from and v_day and l.sleep_hours >= coalesce(h.goal_value, 6);
    else
      select count(*) into v_done from luma.habit_logs l
        where l.habit_id = h.id and l.log_date between v_from and v_day and (h.goal_value is null or coalesce(l.value, 0) >= h.goal_value);
    end if;
    continue when v_done >= v_need;

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (
      h.user_id, 'reminder_habit', '⏰ ' || h.name,
      case
        when h.source = 'sleep' then 'Log your sleep in Health to keep your streak going.'
        when h.goal_value is not null then 'Goal today: ' || h.goal_value::float8::text || ' ' || h.unit || '.'
        when h.period = 'weekly' then 'Still to do this week — tick it off when it''s done.'
        when h.period = 'monthly' then 'Still to do this month — tick it off when it''s done.'
        else 'Time for your habit — tick it off when it''s done.'
      end,
      'habits', h.id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_habit_reminders() from public, anon, authenticated;

-- schedule it every minute (needs the pg_cron extension, same as the health reminders)
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-habit-reminders') then
    perform cron.unschedule('luma-habit-reminders');
  end if;
  perform cron.schedule('luma-habit-reminders', '* * * * *', 'select luma.run_habit_reminders()');
exception when others then
  raise notice 'Could not schedule the habit reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;


-- ################################################################
-- 019_goals.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 019: Goals module.
-- Depends on 001 (luma schema, luma.set_updated_at(), API grants).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0 and length(title) <= 120),
  category text not null default 'Personal' check (category in ('Finance', 'Health', 'Learning', 'Career', 'Personal', 'Other')),
  unit text not null default '' check (length(unit) <= 20),                 -- e.g. RM, km, books, %
  target_value numeric not null default 100 check (target_value > 0),
  current_value numeric not null default 0 check (current_value >= 0),
  deadline date,
  note text not null default '' check (length(note) <= 200),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists goals_user on luma.goals (user_id, created_at);

alter table luma.goals enable row level security;

drop policy if exists "Users manage their own goals" on luma.goals;
create policy "Users manage their own goals"
  on luma.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_goals_updated_at on luma.goals;
create trigger set_luma_goals_updated_at
  before update on luma.goals
  for each row execute function luma.set_updated_at();

-- stamp / clear completed_at whenever progress reaches / drops below the target
create or replace function luma.set_goal_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.current_value >= new.target_value then
    if tg_op = 'INSERT' or old.completed_at is null then
      new.completed_at = now();
    else
      new.completed_at = old.completed_at;
    end if;
  else
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists set_luma_goals_completed_at on luma.goals;
create trigger set_luma_goals_completed_at
  before insert or update on luma.goals
  for each row execute function luma.set_goal_completed_at();

grant all on luma.goals to anon, authenticated;


-- ################################################################
-- 020_bills.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 020: Bills module.
-- Depends on 001 (luma schema, luma.set_updated_at(), API grants).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- one row per bill. `due_date` is the (first) due date: a "once" bill is due on it, a "monthly" bill on the same
-- day every month from it, a "yearly" bill on the same day every year.
create table if not exists luma.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0 and length(name) <= 80),
  amount numeric not null check (amount > 0),
  category text not null default 'Other' check (category in ('Internet', 'Electricity', 'Water', 'Phone', 'Insurance', 'Credit card', 'Rent', 'Subscription', 'Loan', 'Other')),
  recurrence text not null default 'monthly' check (recurrence in ('once', 'monthly', 'yearly')),
  due_date date not null,
  note text not null default '' check (length(note) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bills_user on luma.bills (user_id, due_date);

alter table luma.bills enable row level security;

drop policy if exists "Users manage their own bills" on luma.bills;
create policy "Users manage their own bills"
  on luma.bills for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_bills_updated_at on luma.bills;
create trigger set_luma_bills_updated_at
  before update on luma.bills
  for each row execute function luma.set_updated_at();

-- one row per bill per due date that was paid (no row = not paid)
create table if not exists luma.bill_payments (
  bill_id uuid not null references luma.bills(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  due_date date not null,
  amount numeric not null check (amount >= 0),
  paid_at timestamptz not null default now(),
  primary key (bill_id, due_date)
);

create index if not exists bill_payments_user on luma.bill_payments (user_id, due_date desc);

alter table luma.bill_payments enable row level security;

drop policy if exists "Users manage their own bill payments" on luma.bill_payments;
create policy "Users manage their own bill payments"
  on luma.bill_payments for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from luma.bills b where b.id = bill_id and b.user_id = auth.uid())
  );

grant all on luma.bills to anon, authenticated;
grant all on luma.bill_payments to anon, authenticated;


-- ################################################################
-- 021_bill_active.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 021: pause a bill / subscription.
-- Depends on 020 (bills). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- A subscription is a bill in the 'Subscription' category, so it shows on both the Bills and Subscriptions pages.
-- active = false pauses it: it stays on the Subscriptions page (greyed out) but no longer appears in Bills or its totals.
alter table luma.bills add column if not exists active boolean not null default true;


-- ################################################################
-- 022_bill_weekly.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 022: weekly bills / subscriptions.
-- Depends on 020 (bills). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- a weekly bill is due every 7 days starting from its (first) due date
alter table luma.bills drop constraint if exists bills_recurrence_check;
alter table luma.bills add constraint bills_recurrence_check check (recurrence in ('once', 'weekly', 'monthly', 'yearly'));


-- ################################################################
-- 023_money_country.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 023: Money module + country on profiles.
-- Depends on 001 (profiles), 020 (bills). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- ---------- country (chosen at sign-up / in Edit profile) ----------
-- Malaysian salary deductions (EPF, SOCSO, EIS, PCB …) are only worked out when this is 'Malaysia'.
alter table luma.profiles add column if not exists country text;

create or replace function luma.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into luma.profiles (id, first_name, last_name, email, country)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    nullif(new.raw_user_meta_data ->> 'country', '')
  );
  return new;
end;
$$;

-- ---------- income + budget settings (one row per user) ----------
-- gross_salary = monthly gross pay. For Malaysia the app works out EPF / SOCSO / EIS / LINDUNG 24 Jam / PCB from it;
-- for other countries it is simply the monthly income you receive.
create table if not exists luma.money_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  gross_salary numeric not null default 0 check (gross_salary >= 0),
  epf_rate numeric not null default 11 check (epf_rate >= 0 and epf_rate <= 11),
  marital text not null default 'single' check (marital in ('single', 'married')),
  children smallint not null default 0 check (children between 0 and 30),
  other_relief numeric not null default 0 check (other_relief >= 0),
  pay_day smallint not null default 25 check (pay_day between 1 and 31),
  monthly_budget numeric not null default 0 check (monthly_budget >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table luma.money_settings enable row level security;

drop policy if exists "Users manage their own money settings" on luma.money_settings;
create policy "Users manage their own money settings"
  on luma.money_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_money_settings_updated_at on luma.money_settings;
create trigger set_luma_money_settings_updated_at
  before update on luma.money_settings
  for each row execute function luma.set_updated_at();

-- ---------- income / expense entries you log by hand ----------
-- (Bills and subscriptions you mark as paid count as spending automatically — they come from luma.bill_payments.)
create table if not exists luma.money_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense', 'income')),
  amount numeric not null check (amount > 0),
  category text not null default 'Other' check (length(category) <= 40),
  name text not null default '' check (length(name) <= 80),
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists money_entries_user_date on luma.money_entries (user_id, entry_date desc);

alter table luma.money_entries enable row level security;

drop policy if exists "Users manage their own money entries" on luma.money_entries;
create policy "Users manage their own money entries"
  on luma.money_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on luma.money_settings to anon, authenticated;
grant all on luma.money_entries to anon, authenticated;


-- ################################################################
-- 024_money_pcb.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 024: use the PCB amount from your own payslip.
-- Depends on 023 (money_settings). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- null = let the app estimate PCB; a number (including 0) = use exactly what your payslip deducts
alter table luma.money_settings add column if not exists pcb_override numeric check (pcb_override is null or pcb_override >= 0);


-- ################################################################
-- 025_subscription_reminders.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 025: remind me 3 days before a subscription renews.
-- Depends on 008/009 (notifications), 020 (bills), 021 (bills.active), 022 (weekly) and pg_cron (see 014).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- Runs once a day at 09:00 Malaysia time. For every ACTIVE subscription (a bill in the 'Subscription' category) whose
-- renewal date is exactly 3 days away it creates a 'reminder_subscription' notification — which the send-push webhook
-- then delivers to your devices. Paused subscriptions, and renewals already ticked as paid, are skipped.
create or replace function luma.run_subscription_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  b record;
  v_target date := (timezone('Asia/Kuala_Lumpur', now()))::date + 3;
  v_last int := extract(day from (date_trunc('month', v_target) + interval '1 month - 1 day'))::int;
  v_count int := 0;
begin
  for b in
    select * from luma.bills s
    where s.category = 'Subscription'
      and s.active
      and (
        (s.recurrence = 'once' and s.due_date = v_target)
        or (s.recurrence = 'weekly' and v_target >= s.due_date and (v_target - s.due_date) % 7 = 0)
        or (s.recurrence = 'monthly' and v_target >= s.due_date
            and extract(day from v_target)::int = least(extract(day from s.due_date)::int, v_last))
        or (s.recurrence = 'yearly' and v_target >= s.due_date
            and extract(month from v_target) = extract(month from s.due_date)
            and extract(day from v_target)::int = least(extract(day from s.due_date)::int, v_last))
      )
      and not exists (select 1 from luma.bill_payments p where p.bill_id = s.id and p.due_date = v_target)
      and not exists (
        select 1 from luma.notifications n
        where n.user_id = s.user_id and n.type = 'reminder_subscription' and n.ref = s.id and n.created_at > now() - interval '12 hours'
      )
  loop
    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (
      b.user_id, 'reminder_subscription',
      '🔔 ' || b.name || ' renews in 3 days',
      'RM' || trim(trailing '.' from trim(trailing '0' from b.amount::numeric(12,2)::text)) || ' on ' || to_char(v_target, 'DD Mon') || '. Pause it in Subscriptions if you no longer need it.',
      'subscriptions', b.id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_subscription_reminders() from public, anon, authenticated;

-- schedule it daily at 01:00 UTC = 09:00 Malaysia time (needs the pg_cron extension, same as the other reminder jobs)
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-subscription-reminders') then
    perform cron.unschedule('luma-subscription-reminders');
  end if;
  perform cron.schedule('luma-subscription-reminders', '0 1 * * *', 'select luma.run_subscription_reminders()');
exception when others then
  raise notice 'Could not schedule the subscription reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;


-- ################################################################
-- 026_task_notes.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 026: notes on tasks (e.g. "waiting for director's approval").
-- Depends on 002 (tasks). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.tasks add column if not exists notes text not null default '' check (length(notes) <= 2000);


-- ################################################################
-- 027_events.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 027: Calendar events.
-- Depends on 001 (luma schema, luma.set_updated_at(), API grants). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- one row per event (a repeating event is a single row; the app works out each occurrence).
-- event_date is the first day; start_time / end_time are 24-hour 'HH:MM' Malaysia time, null for an all-day event.
create table if not exists luma.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0 and length(title) <= 120),
  category text not null default 'Other' check (category in ('Work', 'Meeting', 'Personal', 'Health', 'Social', 'Other')),
  event_date date not null,
  all_day boolean not null default false,
  start_time text check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time text check (end_time is null or end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  repeats text not null default 'none' check (repeats in ('none', 'daily', 'weekly', 'monthly', 'yearly')),
  note text not null default '' check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_user_date on luma.events (user_id, event_date);

alter table luma.events enable row level security;

drop policy if exists "Users manage their own events" on luma.events;
create policy "Users manage their own events"
  on luma.events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_events_updated_at on luma.events;
create trigger set_luma_events_updated_at
  before update on luma.events
  for each row execute function luma.set_updated_at();

grant all on luma.events to anon, authenticated;


-- ################################################################
-- 028_timezone.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 028: time zone (GMT) per user.
-- Depends on 001 (profiles), 014/015 (health reminders), 018 (habit reminders), 025 (subscription reminders).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- the time zone chosen at sign-up / in Edit profile, as an IANA name such as 'Asia/Kuala_Lumpur' or 'Europe/London'
alter table luma.profiles add column if not exists timezone text;

create or replace function luma.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into luma.profiles (id, first_name, last_name, email, country, timezone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    nullif(new.raw_user_meta_data ->> 'country', ''),
    nullif(new.raw_user_meta_data ->> 'timezone', '')
  );
  return new;
end;
$$;

-- a user's time zone; Malaysia when none is set (or the name isn't a real time zone, so one bad value can't break the jobs)
create or replace function luma.user_tz(p_user uuid)
returns text
language sql stable
security definer set search_path = ''
as $$
  select coalesce(
    (select p.timezone from luma.profiles p
      where p.id = p_user and p.timezone is not null
        and exists (select 1 from pg_catalog.pg_timezone_names n where n.name = p.timezone)),
    'Asia/Kuala_Lumpur');
$$;
revoke execute on function luma.user_tz(uuid) from public, anon, authenticated;

-- ---------- health reminders (every minute) — now on each user's own clock ----------
create or replace function luma.run_health_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_min int;
  v_day date;
  v_from int; v_to int; v_slot int; v_mins int;
  v_have int; v_count int := 0;
begin
  for r in
    select hr.*, coalesce(g.water_ml, 2500) as goal_water, coalesce(g.steps, 10000) as goal_steps, coalesce(g.active_minutes, 45) as goal_active
    from luma.health_reminders hr
    left join luma.health_goals g on g.user_id = hr.user_id
    where hr.water_enabled or hr.steps_enabled or hr.active_enabled or hr.sleep_enabled
  loop
    -- each user's own clock (their time zone from Edit profile; Malaysia if not set)
    v_now := timezone(luma.user_tz(r.user_id), now());
    v_min := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
    v_day := v_now::date;
    -- water
    if r.water_enabled then
      v_from := luma.hhmm_to_min(r.water_from); v_to := luma.hhmm_to_min(r.water_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.water_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_water') then
        v_have := 0;
        select coalesce(l.water_ml, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_water then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_water', '💧 Time to drink water',
            'You''ve had ' || round(coalesce(v_have, 0) / 1000.0, 2)::float8::text || ' L of your '
              || round(r.goal_water / 1000.0, 2)::float8::text || ' L goal — time for a glass.', 'health');
          v_count := v_count + 1;
        end if;
      end if;
    end if;

    -- steps
    if r.steps_enabled then
      v_from := luma.hhmm_to_min(r.steps_from); v_to := luma.hhmm_to_min(r.steps_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.steps_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_steps') then
        v_have := 0;
        select coalesce(l.steps, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_steps then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_steps', '👟 Time to get some steps in',
            to_char(coalesce(v_have, 0), 'FM999,999') || ' of ' || to_char(r.goal_steps, 'FM999,999')
              || ' steps so far — a short walk will help.', 'health');
          v_count := v_count + 1;
        end if;
      end if;
    end if;

    -- active
    if r.active_enabled then
      v_from := luma.hhmm_to_min(r.active_from); v_to := luma.hhmm_to_min(r.active_to);
      if v_to > v_from and v_min between v_from and v_to and ((v_min - v_from) % r.active_every_min) <= 1
         and not luma.reminder_recent(r.user_id, 'reminder_active') then
        v_have := 0;
        select coalesce(l.active_minutes, 0) into v_have from luma.health_logs l where l.user_id = r.user_id and l.log_date = v_day;
        if coalesce(v_have, 0) < r.goal_active then
          insert into luma.notifications (user_id, type, title, body, link)
          values (r.user_id, 'reminder_active', '🔥 Time to get moving',
            coalesce(v_have, 0) || ' of ' || r.goal_active || ' active minutes so far — a quick workout will help.', 'health');
          v_count := v_count + 1;
        end if;
      end if;
    end if;

    -- sleep
    if r.sleep_enabled then
      v_slot := (((luma.hhmm_to_min(r.bedtime) - r.sleep_lead_min) % 1440) + 1440) % 1440;
      if (v_min = v_slot or v_min = (v_slot + 1) % 1440) and not luma.reminder_recent(r.user_id, 'reminder_sleep') then
        v_mins := (((luma.hhmm_to_min(r.wake_time) - luma.hhmm_to_min(r.bedtime)) % 1440) + 1440) % 1440;
        insert into luma.notifications (user_id, type, title, body, link)
        values (r.user_id, 'reminder_sleep', '🌙 Time to wind down',
          'Bedtime is ' || luma.fmt12(r.bedtime) || ' — wind down now to get about '
            || round(v_mins / 60.0, 1)::float8::text || 'h before your ' || luma.fmt12(r.wake_time) || ' wake-up.', 'health');
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;
revoke execute on function luma.run_health_reminders() from public, anon, authenticated;

-- ---------- habit reminders (every minute) — now on each user's own clock ----------
create or replace function luma.run_habit_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  h record;
  v_now timestamp;
  v_min int;
  v_day date;
  v_from date;
  v_slot int;
  v_done int;
  v_need int;
  v_hours numeric;
  v_count int := 0;
begin
  for h in
    select * from luma.habits where reminder_time is not null and not archived
  loop
    -- each user's own clock (their time zone from Edit profile; Malaysia if not set)
    v_now := timezone(luma.user_tz(h.user_id), now());
    v_min := extract(hour from v_now)::int * 60 + extract(minute from v_now)::int;
    v_day := v_now::date;
    v_slot := luma.hhmm_to_min(h.reminder_time);
    continue when not (v_min = v_slot or v_min = (v_slot + 1) % 1440);
    continue when h.period = 'daily' and not (extract(dow from v_day)::smallint = any (h.days));
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = h.user_id and n.type = 'reminder_habit' and n.ref = h.id and n.created_at > now() - interval '10 minutes'
    );

    -- already done for this day / week / month?
    v_from := case h.period when 'weekly' then date_trunc('week', v_day)::date when 'monthly' then date_trunc('month', v_day)::date else v_day end;
    v_need := case when h.period = 'daily' then 1 else h.per_period end;
    if h.source = 'sleep' then
      select count(*) into v_done from luma.health_logs l
        where l.user_id = h.user_id and l.log_date between v_from and v_day and l.sleep_hours >= coalesce(h.goal_value, 6);
    else
      select count(*) into v_done from luma.habit_logs l
        where l.habit_id = h.id and l.log_date between v_from and v_day and (h.goal_value is null or coalesce(l.value, 0) >= h.goal_value);
    end if;
    continue when v_done >= v_need;

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (
      h.user_id, 'reminder_habit', '⏰ ' || h.name,
      case
        when h.source = 'sleep' then 'Log your sleep in Health to keep your streak going.'
        when h.goal_value is not null then 'Goal today: ' || h.goal_value::float8::text || ' ' || h.unit || '.'
        when h.period = 'weekly' then 'Still to do this week — tick it off when it''s done.'
        when h.period = 'monthly' then 'Still to do this month — tick it off when it''s done.'
        else 'Time for your habit — tick it off when it''s done.'
      end,
      'habits', h.id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_habit_reminders() from public, anon, authenticated;

-- ---------- subscription reminders: 3 days before renewal, at 09:00 in each user's own time zone ----------
-- the job now runs every hour and only handles users for whom it is currently 09:00
create or replace function luma.run_subscription_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  b record;
  v_now timestamp;
  v_target date;
  v_last int;
  v_count int := 0;
  v_hit boolean;
begin
  for b in
    select s.* from luma.bills s where s.category = 'Subscription' and s.active
  loop
    v_now := timezone(luma.user_tz(b.user_id), now());
    continue when extract(hour from v_now)::int <> 9;
    v_target := v_now::date + 3;
    v_last := extract(day from (date_trunc('month', v_target) + interval '1 month - 1 day'))::int;
    v_hit := case b.recurrence
      when 'once' then b.due_date = v_target
      when 'weekly' then v_target >= b.due_date and (v_target - b.due_date) % 7 = 0
      when 'monthly' then v_target >= b.due_date and extract(day from v_target)::int = least(extract(day from b.due_date)::int, v_last)
      when 'yearly' then v_target >= b.due_date and extract(month from v_target) = extract(month from b.due_date)
                         and extract(day from v_target)::int = least(extract(day from b.due_date)::int, v_last)
      else false end;
    continue when not v_hit;
    continue when exists (select 1 from luma.bill_payments p where p.bill_id = b.id and p.due_date = v_target);
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = b.user_id and n.type = 'reminder_subscription' and n.ref = b.id and n.created_at > now() - interval '12 hours');

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (
      b.user_id, 'reminder_subscription',
      '🔔 ' || b.name || ' renews in 3 days',
      'RM' || trim(trailing '.' from trim(trailing '0' from b.amount::numeric(12,2)::text)) || ' on ' || to_char(v_target, 'DD Mon') || '. Pause it in Subscriptions if you no longer need it.',
      'subscriptions', b.id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_subscription_reminders() from public, anon, authenticated;

-- run the subscription job every hour (it only acts when it is 09:00 for the user)
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-subscription-reminders') then
    perform cron.unschedule('luma-subscription-reminders');
  end if;
  perform cron.schedule('luma-subscription-reminders', '0 * * * *', 'select luma.run_subscription_reminders()');
exception when others then
  raise notice 'Could not schedule the subscription reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;


-- ################################################################
-- 029_assistant.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 029: Lumi assistant daily usage limit.
-- Depends on 001 and 028 (luma.user_tz). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- how many assistant requests each user has made per day, per kind ('chat' questions, 'insights' for Analytics)
create table if not exists luma.assistant_usage (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  kind text not null default 'chat',
  used integer not null default 0,
  primary key (user_id, day, kind)
);

alter table luma.assistant_usage enable row level security;

drop policy if exists "Users read their own assistant usage" on luma.assistant_usage;
create policy "Users read their own assistant usage"
  on luma.assistant_usage for select
  using (auth.uid() = user_id);

grant select on luma.assistant_usage to authenticated;

-- uses one request; returns how many are LEFT today, or -1 when the daily limit is already reached.
-- "Today" follows the user's own time zone.
create or replace function luma.use_assistant(p_kind text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = luma, public
as $$
declare
  v_day date := (timezone(luma.user_tz(auth.uid()), now()))::date;
  v_used integer;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into luma.assistant_usage (user_id, day, kind, used) values (auth.uid(), v_day, p_kind, 0)
    on conflict do nothing;
  update luma.assistant_usage set used = used + 1
    where user_id = auth.uid() and day = v_day and kind = p_kind and used < p_limit
    returning used into v_used;
  if v_used is null then return -1; end if;
  return p_limit - v_used;
end;
$$;

-- gives one request back (used when the AI provider failed, so a failed answer doesn't cost the user a question)
create or replace function luma.refund_assistant(p_kind text)
returns void
language plpgsql
security definer
set search_path = luma, public
as $$
begin
  update luma.assistant_usage set used = greatest(0, used - 1)
    where user_id = auth.uid() and day = (timezone(luma.user_tz(auth.uid()), now()))::date and kind = p_kind;
end;
$$;

-- how many are left today, without using one
create or replace function luma.assistant_left(p_kind text, p_limit integer)
returns integer
language sql
security definer
set search_path = luma, public
stable
as $$
  select p_limit - coalesce((select used from luma.assistant_usage
    where user_id = auth.uid() and day = (timezone(luma.user_tz(auth.uid()), now()))::date and kind = p_kind), 0);
$$;

revoke execute on function luma.use_assistant(text, integer) from public, anon;
revoke execute on function luma.refund_assistant(text) from public, anon;
revoke execute on function luma.assistant_left(text, integer) from public, anon;
grant execute on function luma.use_assistant(text, integer) to authenticated;
grant execute on function luma.refund_assistant(text) to authenticated;
grant execute on function luma.assistant_left(text, integer) to authenticated;


-- ################################################################
-- 030_more_reminders.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 030: more reminders (inbox + push), all in each user's own time zone.
--   • calendar events: 15 minutes before a timed event, 08:00 on the day for all-day events
--   • tasks: a 09:00 digest of tasks due today / overdue
--   • bills (not subscriptions): 3 days before, on the due date, and the day after if still unpaid
--   • goals: 3 days before the deadline and on the deadline day
--   • budget: once a month at 80 % and once when you go over the monthly budget
-- Depends on 008 (notifications), 014 (pg_cron), 019 (goals), 020–022 (bills), 023 (money), 027 (events), 028 (luma.user_tz).
-- Inserting into luma.notifications is what makes the send-push webhook deliver the push. Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- does something that first happens on p_first and repeats like p_repeat land on p_day?
create or replace function luma.day_matches(p_first date, p_repeat text, p_day date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_repeat in ('none', 'once') then p_day = p_first
    when p_day < p_first then false
    when p_repeat = 'daily' then true
    when p_repeat = 'weekly' then (p_day - p_first) % 7 = 0
    when p_repeat = 'monthly' then extract(day from p_day)::int = least(extract(day from p_first)::int, extract(day from (date_trunc('month', p_day) + interval '1 month - 1 day'))::int)
    when p_repeat = 'yearly' then extract(month from p_day) = extract(month from p_first)
                                  and extract(day from p_day)::int = least(extract(day from p_first)::int, extract(day from (date_trunc('month', p_day) + interval '1 month - 1 day'))::int)
    else false end;
$$;

create or replace function luma.rm_text(p_amount numeric)
returns text
language sql
immutable
set search_path = ''
as $$ select 'RM' || trim(trailing '.' from trim(trailing '0' from to_char(p_amount, 'FM999,999,999,990.00'))); $$;

-- ---------- calendar events (runs every minute) ----------
create or replace function luma.run_event_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  e record;
  v_now timestamp;
  v_today date;
  v_mins numeric;
  v_title text;
  v_body text;
  v_count int := 0;
begin
  for e in
    select ev.* from luma.events ev
    where ev.event_date <= current_date + 1
      and (ev.repeats <> 'none' or ev.event_date >= current_date - 1)
  loop
    v_now := timezone(luma.user_tz(e.user_id), now());
    v_today := v_now::date;
    continue when not luma.day_matches(e.event_date, e.repeats, v_today);

    if e.all_day or e.start_time is null then
      continue when extract(hour from v_now)::int <> 8;
      v_title := '📅 ' || e.title || ' is today';
      v_body := 'All day · ' || e.category;
    else
      v_mins := extract(epoch from ((v_today + e.start_time::time) - v_now)) / 60;
      continue when v_mins < 0 or v_mins > 15;
      v_title := '📅 ' || e.title || case when v_mins < 1 then ' starts now' else ' starts in ' || ceil(v_mins)::int || ' min' end;
      v_body := 'At ' || to_char(e.start_time::time, 'FMHH12:MI am') || ' · ' || e.category;
    end if;

    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = e.user_id and n.type = 'reminder_event' and n.ref = e.id and n.created_at > now() - interval '12 hours');

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (e.user_id, 'reminder_event', v_title, v_body, 'calendar', e.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_event_reminders() from public, anon, authenticated;

-- ---------- tasks, bills and goals (runs every hour, acts at 09:00 local time) ----------
create or replace function luma.run_morning_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_today date;
  v_due int;
  v_over int;
  v_title text;
  v_when text;
  v_count int := 0;
  v_off int;
begin
  -- tasks: one digest per user
  for r in select distinct t.user_id from luma.tasks t where t.status <> 'done' and t.due_date is not null and t.due_date <= current_date + 1 loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> 9;
    v_today := v_now::date;
    select count(*) filter (where due_date = v_today), count(*) filter (where due_date < v_today)
      into v_due, v_over
      from luma.tasks where user_id = r.user_id and status <> 'done' and due_date is not null;
    continue when v_due + v_over = 0;
    continue when exists (
      select 1 from luma.notifications n where n.user_id = r.user_id and n.type = 'reminder_task' and n.created_at > now() - interval '12 hours');
    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, 'reminder_task',
      '✅ ' || case when v_due > 0 then v_due || ' task' || case when v_due > 1 then 's' else '' end || ' due today' else v_over || ' overdue task' || case when v_over > 1 then 's' else '' end end,
      case when v_due > 0 and v_over > 0 then v_over || ' more overdue. ' else '' end || 'Open Tasks to tick them off.',
      'tasks');
    v_count := v_count + 1;
  end loop;

  -- bills (subscriptions have their own reminder in 025/028)
  for r in select b.* from luma.bills b where b.category <> 'Subscription' and b.active loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> 9;
    v_today := v_now::date;
    foreach v_off in array array[3, 0, -1] loop
      continue when not luma.day_matches(r.due_date, r.recurrence, v_today + v_off);
      continue when exists (select 1 from luma.bill_payments p where p.bill_id = r.id and p.due_date = v_today + v_off);
      v_when := case v_off when 3 then 'is due in 3 days' when 0 then 'is due today' else 'is overdue' end;
      v_title := '🧾 ' || r.name || ' ' || v_when;
      continue when exists (
        select 1 from luma.notifications n
        where n.user_id = r.user_id and n.type = 'reminder_bill' and n.ref = r.id and n.title = v_title and n.created_at > now() - interval '12 hours');
      insert into luma.notifications (user_id, type, title, body, link, ref)
      values (r.user_id, 'reminder_bill', v_title,
        luma.rm_text(r.amount) || ' · ' || to_char(v_today + v_off, 'DD Mon') || '. Tick it off in Bills once paid.', 'bills', r.id);
      v_count := v_count + 1;
    end loop;
  end loop;

  -- goals with a deadline
  for r in select g.* from luma.goals g where g.completed_at is null and g.deadline is not null and g.deadline <= current_date + 4 and g.deadline >= current_date - 1 loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> 9;
    v_today := v_now::date;
    continue when r.deadline not in (v_today + 3, v_today);
    v_title := '🎯 ' || r.title || case when r.deadline = v_today then ' is due today' else ' is due in 3 days' end;
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = r.user_id and n.type = 'reminder_goal' and n.ref = r.id and n.title = v_title and n.created_at > now() - interval '12 hours');
    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (r.user_id, 'reminder_goal', v_title,
      'You are at ' || least(100, round(r.current_value / r.target_value * 100))::int || '% of your goal.', 'goals', r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_morning_reminders() from public, anon, authenticated;

-- ---------- budget alerts (runs every hour) ----------
create or replace function luma.run_budget_alerts()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_tz text;
  v_first date;
  v_from timestamptz;
  v_to timestamptz;
  v_spent numeric;
  v_type text;
  v_count int := 0;
begin
  for r in select s.user_id, s.monthly_budget from luma.money_settings s where s.monthly_budget > 0 loop
    v_tz := luma.user_tz(r.user_id);
    v_first := date_trunc('month', timezone(v_tz, now()))::date;
    v_from := v_first::timestamp at time zone v_tz;
    v_to := (v_first + interval '1 month')::timestamp at time zone v_tz;
    select coalesce((select sum(amount) from luma.money_entries where user_id = r.user_id and kind = 'expense' and entry_date >= v_first and entry_date < (v_first + interval '1 month')::date), 0)
         + coalesce((select sum(amount) from luma.bill_payments where user_id = r.user_id and paid_at >= v_from and paid_at < v_to), 0)
      into v_spent;
    v_type := case when v_spent >= r.monthly_budget then 'budget_over' when v_spent >= r.monthly_budget * 0.8 then 'budget_warn' else null end;
    continue when v_type is null;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.type = v_type and n.created_at >= v_from);
    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, v_type,
      case v_type when 'budget_over' then '⚠️ You are over your monthly budget' else '💸 You have used 80% of your monthly budget' end,
      'Spent ' || luma.rm_text(v_spent) || ' of ' || luma.rm_text(r.monthly_budget) || ' this month.', 'money');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_budget_alerts() from public, anon, authenticated;

-- ---------- schedules ----------
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-event-reminders') then perform cron.unschedule('luma-event-reminders'); end if;
  if exists (select 1 from cron.job where jobname = 'luma-morning-reminders') then perform cron.unschedule('luma-morning-reminders'); end if;
  if exists (select 1 from cron.job where jobname = 'luma-budget-alerts') then perform cron.unschedule('luma-budget-alerts'); end if;
  perform cron.schedule('luma-event-reminders', '* * * * *', 'select luma.run_event_reminders()');
  perform cron.schedule('luma-morning-reminders', '0 * * * *', 'select luma.run_morning_reminders()');
  perform cron.schedule('luma-budget-alerts', '30 * * * *', 'select luma.run_budget_alerts()');
exception when others then
  raise notice 'Could not schedule the reminder jobs (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;


-- ################################################################
-- 031_reminder_prefs.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 031: per-user reminder settings (Settings → Reminders).
-- Lets each user switch the reminders from 028 / 030 on or off and choose their timing.
-- Depends on 028 (luma.user_tz, subscription reminders) and 030 (event / task / bill / goal / budget reminders).
-- Rewrites those jobs so they read these settings (no row = the defaults below). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.reminder_prefs (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  event_on boolean not null default true,
  event_lead_min integer not null default 15 check (event_lead_min between 1 and 1440),
  allday_hour integer not null default 8 check (allday_hour between 0 and 23),
  task_on boolean not null default true,
  task_hour integer not null default 9 check (task_hour between 0 and 23),
  bill_on boolean not null default true,
  bill_hour integer not null default 9 check (bill_hour between 0 and 23),
  bill_days integer not null default 3 check (bill_days between 1 and 14),
  sub_on boolean not null default true,
  sub_hour integer not null default 9 check (sub_hour between 0 and 23),
  sub_days integer not null default 3 check (sub_days between 1 and 14),
  goal_on boolean not null default true,
  goal_hour integer not null default 9 check (goal_hour between 0 and 23),
  goal_days integer not null default 3 check (goal_days between 1 and 14),
  budget_on boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table luma.reminder_prefs enable row level security;

drop policy if exists "Users manage their own reminder settings" on luma.reminder_prefs;
create policy "Users manage their own reminder settings"
  on luma.reminder_prefs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_reminder_prefs_updated_at on luma.reminder_prefs;
create trigger set_luma_reminder_prefs_updated_at
  before update on luma.reminder_prefs
  for each row execute function luma.set_updated_at();

grant all on luma.reminder_prefs to anon, authenticated;

create or replace function luma.days_text(p_n integer, p_prefix text)
returns text
language sql
immutable
set search_path = ''
as $$ select case when p_n = 1 then 'tomorrow' else p_prefix || ' ' || p_n || ' days' end; $$;

-- ---------- calendar events (every minute) ----------
create or replace function luma.run_event_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  e record;
  v_now timestamp;
  v_today date;
  v_mins numeric;
  v_title text;
  v_body text;
  v_on boolean;
  v_lead int;
  v_hour int;
  v_count int := 0;
begin
  for e in
    select ev.* from luma.events ev
    where ev.event_date <= current_date + 1
      and (ev.repeats <> 'none' or ev.event_date >= current_date - 1)
  loop
    select coalesce(bool_and(p.event_on), true), coalesce(max(p.event_lead_min), 15), coalesce(max(p.allday_hour), 8)
      into v_on, v_lead, v_hour from luma.reminder_prefs p where p.user_id = e.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(e.user_id), now());
    v_today := v_now::date;
    continue when not luma.day_matches(e.event_date, e.repeats, v_today);

    if e.all_day or e.start_time is null then
      continue when extract(hour from v_now)::int <> v_hour;
      v_title := '📅 ' || e.title || ' is today';
      v_body := 'All day · ' || e.category;
    else
      v_mins := extract(epoch from ((v_today + e.start_time::time) - v_now)) / 60;
      continue when v_mins < 0 or v_mins > v_lead;
      v_title := '📅 ' || e.title || case when v_mins < 1 then ' starts now' else ' starts in ' || ceil(v_mins)::int || ' min' end;
      v_body := 'At ' || to_char(e.start_time::time, 'FMHH12:MI am') || ' · ' || e.category;
    end if;

    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = e.user_id and n.type = 'reminder_event' and n.ref = e.id and n.created_at > now() - interval '12 hours');

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (e.user_id, 'reminder_event', v_title, v_body, 'calendar', e.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_event_reminders() from public, anon, authenticated;

-- ---------- tasks, bills, goals (hourly) ----------
create or replace function luma.run_morning_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_today date;
  v_due int;
  v_over int;
  v_title text;
  v_when text;
  v_on boolean;
  v_hour int;
  v_days int;
  v_count int := 0;
  v_off int;
begin
  -- tasks: one digest per user
  for r in select distinct t.user_id from luma.tasks t where t.status <> 'done' and t.due_date is not null and t.due_date <= current_date + 1 loop
    select coalesce(bool_and(p.task_on), true), coalesce(max(p.task_hour), 9) into v_on, v_hour from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
    v_today := v_now::date;
    select count(*) filter (where due_date = v_today), count(*) filter (where due_date < v_today)
      into v_due, v_over
      from luma.tasks where user_id = r.user_id and status <> 'done' and due_date is not null;
    continue when v_due + v_over = 0;
    continue when exists (
      select 1 from luma.notifications n where n.user_id = r.user_id and n.type = 'reminder_task' and n.created_at > now() - interval '12 hours');
    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, 'reminder_task',
      '✅ ' || case when v_due > 0 then v_due || ' task' || case when v_due > 1 then 's' else '' end || ' due today' else v_over || ' overdue task' || case when v_over > 1 then 's' else '' end end,
      case when v_due > 0 and v_over > 0 then v_over || ' more overdue. ' else '' end || 'Open Tasks to tick them off.',
      'tasks');
    v_count := v_count + 1;
  end loop;

  -- bills (subscriptions have their own reminder)
  for r in select b.* from luma.bills b where b.category <> 'Subscription' and b.active loop
    select coalesce(bool_and(p.bill_on), true), coalesce(max(p.bill_hour), 9), coalesce(max(p.bill_days), 3) into v_on, v_hour, v_days from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
    v_today := v_now::date;
    foreach v_off in array array[v_days, 0, -1] loop
      continue when not luma.day_matches(r.due_date, r.recurrence, v_today + v_off);
      continue when exists (select 1 from luma.bill_payments p where p.bill_id = r.id and p.due_date = v_today + v_off);
      v_when := case when v_off > 0 then 'is due ' || luma.days_text(v_off, 'in') when v_off = 0 then 'is due today' else 'is overdue' end;
      v_title := '🧾 ' || r.name || ' ' || v_when;
      continue when exists (
        select 1 from luma.notifications n
        where n.user_id = r.user_id and n.type = 'reminder_bill' and n.ref = r.id and n.title = v_title and n.created_at > now() - interval '12 hours');
      insert into luma.notifications (user_id, type, title, body, link, ref)
      values (r.user_id, 'reminder_bill', v_title,
        luma.rm_text(r.amount) || ' · ' || to_char(v_today + v_off, 'DD Mon') || '. Tick it off in Bills once paid.', 'bills', r.id);
      v_count := v_count + 1;
    end loop;
  end loop;

  -- goals with a deadline
  for r in select g.* from luma.goals g where g.completed_at is null and g.deadline is not null and g.deadline <= current_date + 15 and g.deadline >= current_date - 1 loop
    select coalesce(bool_and(p.goal_on), true), coalesce(max(p.goal_hour), 9), coalesce(max(p.goal_days), 3) into v_on, v_hour, v_days from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
    v_today := v_now::date;
    continue when r.deadline not in (v_today + v_days, v_today);
    v_title := '🎯 ' || r.title || case when r.deadline = v_today then ' is due today' else ' is due ' || luma.days_text(v_days, 'in') end;
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = r.user_id and n.type = 'reminder_goal' and n.ref = r.id and n.title = v_title and n.created_at > now() - interval '12 hours');
    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (r.user_id, 'reminder_goal', v_title,
      'You are at ' || least(100, round(r.current_value / r.target_value * 100))::int || '% of your goal.', 'goals', r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_morning_reminders() from public, anon, authenticated;

-- ---------- budget alerts (hourly) ----------
create or replace function luma.run_budget_alerts()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_tz text;
  v_first date;
  v_from timestamptz;
  v_to timestamptz;
  v_spent numeric;
  v_type text;
  v_on boolean;
  v_count int := 0;
begin
  for r in select s.user_id, s.monthly_budget from luma.money_settings s where s.monthly_budget > 0 loop
    select coalesce(bool_and(p.budget_on), true) into v_on from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_tz := luma.user_tz(r.user_id);
    v_first := date_trunc('month', timezone(v_tz, now()))::date;
    v_from := v_first::timestamp at time zone v_tz;
    v_to := (v_first + interval '1 month')::timestamp at time zone v_tz;
    select coalesce((select sum(amount) from luma.money_entries where user_id = r.user_id and kind = 'expense' and entry_date >= v_first and entry_date < (v_first + interval '1 month')::date), 0)
         + coalesce((select sum(amount) from luma.bill_payments where user_id = r.user_id and paid_at >= v_from and paid_at < v_to), 0)
      into v_spent;
    v_type := case when v_spent >= r.monthly_budget then 'budget_over' when v_spent >= r.monthly_budget * 0.8 then 'budget_warn' else null end;
    continue when v_type is null;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.type = v_type and n.created_at >= v_from);
    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, v_type,
      case v_type when 'budget_over' then '⚠️ You are over your monthly budget' else '💸 You have used 80% of your monthly budget' end,
      'Spent ' || luma.rm_text(v_spent) || ' of ' || luma.rm_text(r.monthly_budget) || ' this month.', 'money');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_budget_alerts() from public, anon, authenticated;

-- ---------- subscription reminders (hourly) ----------
create or replace function luma.run_subscription_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  b record;
  v_now timestamp;
  v_target date;
  v_last int;
  v_count int := 0;
  v_on boolean;
  v_hour int;
  v_days int;
begin
  for b in
    select s.* from luma.bills s where s.category = 'Subscription' and s.active
  loop
    select coalesce(bool_and(p.sub_on), true), coalesce(max(p.sub_hour), 9), coalesce(max(p.sub_days), 3) into v_on, v_hour, v_days from luma.reminder_prefs p where p.user_id = b.user_id;
    continue when not v_on;
    v_now := timezone(luma.user_tz(b.user_id), now());
    continue when extract(hour from v_now)::int <> v_hour;
    v_target := v_now::date + v_days;
    continue when not luma.day_matches(b.due_date, b.recurrence, v_target);
    continue when exists (select 1 from luma.bill_payments p where p.bill_id = b.id and p.due_date = v_target);
    continue when exists (
      select 1 from luma.notifications n
      where n.user_id = b.user_id and n.type = 'reminder_subscription' and n.ref = b.id and n.created_at > now() - interval '12 hours');

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (
      b.user_id, 'reminder_subscription',
      '🔔 ' || b.name || ' renews ' || luma.days_text(v_days, 'in'),
      luma.rm_text(b.amount) || ' on ' || to_char(v_target, 'DD Mon') || '. Pause it in Subscriptions if you no longer need it.',
      'subscriptions', b.id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_subscription_reminders() from public, anon, authenticated;


-- ################################################################
-- 032_reminders.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 032: custom reminders (the Reminders page).
-- Your own reminders, separate from tasks: e.g. "fill in the timesheet" on the last weekday of every month.
-- Delivered to the inbox and as a push notification at the chosen time, in each user's own time zone.
-- Depends on 008 (notifications), 014 (pg_cron), 028 (luma.user_tz), 030 (luma.day_matches). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) > 0 and length(title) <= 120),
  note text not null default '' check (length(note) <= 300),
  -- once | daily | weekdays (Mon–Fri) | weekends (Sat–Sun) | weekly | monthly | yearly | month_last_day | month_last_weekday
  kind text not null default 'once',
  start_date date not null,                                   -- the date (once), or the first date it can fire
  remind_time text not null check (remind_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  days smallint[] not null default '{}',                      -- weekly: weekdays 0 (Sun) … 6 (Sat); empty = the weekday of start_date
  active boolean not null default true,
  last_fired_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- (re-running this file also updates the list of allowed kinds)
alter table luma.reminders drop constraint if exists reminders_kind_check;
alter table luma.reminders add constraint reminders_kind_check check (kind in ('once', 'daily', 'weekdays', 'weekends', 'weekly', 'monthly', 'yearly', 'month_last_day', 'month_last_weekday'));

create index if not exists reminders_user on luma.reminders (user_id, active);

alter table luma.reminders enable row level security;

drop policy if exists "Users manage their own reminders" on luma.reminders;
create policy "Users manage their own reminders"
  on luma.reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists set_luma_reminders_updated_at on luma.reminders;
create trigger set_luma_reminders_updated_at
  before update on luma.reminders
  for each row execute function luma.set_updated_at();

grant all on luma.reminders to anon, authenticated;

-- does a reminder of this kind fall on p_day?
create or replace function luma.reminder_due(p_kind text, p_start date, p_days smallint[], p_day date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_day < p_start then false
    when p_kind = 'once' then p_day = p_start
    when p_kind = 'daily' then true
    when p_kind = 'weekdays' then extract(dow from p_day) between 1 and 5
    when p_kind = 'weekends' then extract(dow from p_day) in (0, 6)
    when p_kind = 'weekly' then extract(dow from p_day)::int = any (case when cardinality(p_days) = 0 then array[extract(dow from p_start)::smallint] else p_days end)
    when p_kind = 'monthly' then luma.day_matches(p_start, 'monthly', p_day)
    when p_kind = 'yearly' then luma.day_matches(p_start, 'yearly', p_day)
    when p_kind = 'month_last_day' then p_day = (date_trunc('month', p_day) + interval '1 month - 1 day')::date
    when p_kind = 'month_last_weekday' then p_day = (
      (date_trunc('month', p_day) + interval '1 month - 1 day')::date
      - case extract(dow from (date_trunc('month', p_day) + interval '1 month - 1 day')::date)::int when 0 then 2 when 6 then 1 else 0 end)
    else false end;
$$;

-- every minute: fire reminders whose time has come (within the last 10 minutes, once per day)
create or replace function luma.run_custom_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_today date;
  v_diff int;
  v_count int := 0;
begin
  for r in select x.* from luma.reminders x where x.active and x.start_date <= current_date + 1 loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    v_today := v_now::date;
    v_diff := (extract(hour from v_now)::int * 60 + extract(minute from v_now)::int) - (substr(r.remind_time, 1, 2)::int * 60 + substr(r.remind_time, 4, 2)::int);
    continue when v_diff < 0 or v_diff > 10;
    continue when r.last_fired_on = v_today;
    continue when not luma.reminder_due(r.kind, r.start_date, r.days, v_today);

    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (r.user_id, 'reminder_custom', '⏰ ' || r.title, nullif(r.note, ''), 'reminders', r.id);
    update luma.reminders set last_fired_on = v_today where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_custom_reminders() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-custom-reminders') then perform cron.unschedule('luma-custom-reminders'); end if;
  perform cron.schedule('luma-custom-reminders', '* * * * *', 'select luma.run_custom_reminders()');
exception when others then
  raise notice 'Could not schedule the custom reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;


-- ################################################################
-- 033_plans.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 033: plans (Dawn / Glow / Zenith) and their limits.
--   • luma.profiles.plan is now dawn | glow | zenith. NEW accounts start on Dawn; everyone who already
--     had an account is moved to Zenith (so nobody loses anything).
--   • luma.plan_limits holds every limit in one place (NULL = unlimited) — edit a row to change a limit.
--   • The database blocks adding more than the plan allows (habits, goals, bills & subscriptions, custom
--     reminders, contacts) and uploads over the plan's file size / total storage.
--   • Users can NOT change their own plan (only you, in the SQL Editor or from a server).
-- Depends on 001, 003, 016, 019, 020, 031, 032. Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- To move someone to another plan:  update luma.profiles set plan = 'glow' where email = 'them@example.com';
-- ============================================================

-- ---------- plan column ----------
alter table luma.profiles drop constraint if exists profiles_plan_check;
alter table luma.profiles alter column plan set default 'dawn';
update luma.profiles set plan = 'zenith' where plan not in ('dawn', 'glow', 'zenith');
alter table luma.profiles add constraint profiles_plan_check check (plan in ('dawn', 'glow', 'zenith'));

-- signed-in users can never set or change a plan themselves
create or replace function luma.protect_plan()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.plan := 'dawn'; else new.plan := old.plan; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_luma_profiles_plan on luma.profiles;
create trigger protect_luma_profiles_plan
  before insert or update on luma.profiles
  for each row execute function luma.protect_plan();

-- ---------- limits ----------
create table if not exists luma.plan_limits (
  plan text not null check (plan in ('dawn', 'glow', 'zenith')),
  key text not null,
  value integer,                      -- NULL = unlimited
  primary key (plan, key)
);
alter table luma.plan_limits enable row level security;
drop policy if exists "Anyone signed in can read plan limits" on luma.plan_limits;
create policy "Anyone signed in can read plan limits" on luma.plan_limits for select using (true);
grant select on luma.plan_limits to authenticated;

insert into luma.plan_limits (plan, key, value) values
  ('dawn',   'lumi_questions', 3),   ('glow',   'lumi_questions', 10),  ('zenith', 'lumi_questions', 15),
  ('dawn',   'lumi_actions', 0),     ('glow',   'lumi_actions', 1),     ('zenith', 'lumi_actions', 1),
  ('dawn',   'insights', 0),         ('glow',   'insights', 3),         ('zenith', 'insights', 10),
  ('dawn',   'storage_mb', 50),      ('glow',   'storage_mb', 300),     ('zenith', 'storage_mb', 1000),
  ('dawn',   'file_mb', 5),          ('glow',   'file_mb', 20),         ('zenith', 'file_mb', 50),
  ('dawn',   'reminders', 5),        ('glow',   'reminders', 25),       ('zenith', 'reminders', null),
  ('dawn',   'habits', 5),           ('glow',   'habits', 10),          ('zenith', 'habits', null),
  ('dawn',   'goals', 3),            ('glow',   'goals', 5),            ('zenith', 'goals', null),
  ('dawn',   'bills', 5),            ('glow',   'bills', 12),           ('zenith', 'bills', null),
  ('dawn',   'contacts', 3),         ('glow',   'contacts', 12),        ('zenith', 'contacts', null),
  ('dawn',   'timing', 0),           ('glow',   'timing', 1),           ('zenith', 'timing', 1),
  ('dawn',   'payroll', 0),          ('glow',   'payroll', 1),          ('zenith', 'payroll', 1),
  ('dawn',   'own_wallpaper', 0),    ('glow',   'own_wallpaper', 0),    ('zenith', 'own_wallpaper', 1),
  ('dawn',   'wallpapers', 2),       ('glow',   'wallpapers', 5),       ('zenith', 'wallpapers', 5),
  ('dawn',   'themes', 1),           ('glow',   'themes', 3),           ('zenith', 'themes', 3)
on conflict (plan, key) do update set value = excluded.value;

create or replace function luma.plan_of(p_user uuid)
returns text
language sql
stable
security definer set search_path = ''
as $$ select coalesce((select p.plan from luma.profiles p where p.id = p_user), 'dawn'); $$;

create or replace function luma.limit_of(p_user uuid, p_key text)
returns integer
language sql
stable
security definer set search_path = ''
as $$ select l.value from luma.plan_limits l where l.plan = luma.plan_of(p_user) and l.key = p_key; $$;

revoke execute on function luma.plan_of(uuid) from public, anon, authenticated;
revoke execute on function luma.limit_of(uuid, text) from public, anon, authenticated;

-- the app (and the Lumi function) ask for the caller's plan and limits in one call
create or replace function luma.my_limits()
returns jsonb
language sql
stable
security definer set search_path = ''
as $$
  select jsonb_build_object(
    'plan', luma.plan_of(auth.uid()),
    'limits', coalesce((select jsonb_object_agg(l.key, l.value) from luma.plan_limits l where l.plan = luma.plan_of(auth.uid())), '{}'::jsonb));
$$;
revoke execute on function luma.my_limits() from public, anon;
grant execute on function luma.my_limits() to authenticated;

-- ---------- count limits ----------
-- args: limit key, extra WHERE condition, label used in the message
create or replace function luma.enforce_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_user uuid := (to_jsonb(new) ->> 'user_id')::uuid;
  v_limit int := luma.limit_of((to_jsonb(new) ->> 'user_id')::uuid, tg_argv[0]);
  v_n int;
begin
  if v_limit is null then return new; end if;
  execute format('select count(*) from luma.%I where user_id = $1 and (%s)', tg_table_name, coalesce(tg_argv[1], 'true')) into v_n using v_user;
  if v_n >= v_limit then
    raise exception 'Plan limit: the % plan allows up to % %. Upgrade your plan in Settings to add more.', initcap(luma.plan_of(v_user)), v_limit, tg_argv[2];
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_plan_habits on luma.habits;
create trigger enforce_plan_habits before insert on luma.habits
  for each row execute function luma.enforce_limit('habits', 'not archived', 'habits');
drop trigger if exists enforce_plan_goals on luma.goals;
create trigger enforce_plan_goals before insert on luma.goals
  for each row execute function luma.enforce_limit('goals', 'completed_at is null', 'active goals');
drop trigger if exists enforce_plan_bills on luma.bills;
create trigger enforce_plan_bills before insert on luma.bills
  for each row execute function luma.enforce_limit('bills', 'true', 'bills and subscriptions');
drop trigger if exists enforce_plan_reminders on luma.reminders;
create trigger enforce_plan_reminders before insert on luma.reminders
  for each row execute function luma.enforce_limit('reminders', 'true', 'custom reminders');

-- contacts: your accepted contacts plus the requests you have sent; accepting a request counts too
create or replace function luma.enforce_contact_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_limit int;
  v_n int;
begin
  if tg_op = 'INSERT' then v_user := new.requester_id;
  elsif new.status = 'accepted' and old.status <> 'accepted' then v_user := new.addressee_id;
  else return new; end if;
  v_limit := luma.limit_of(v_user, 'contacts');
  if v_limit is null then return new; end if;
  select count(*) into v_n from luma.contacts c
    where c.id <> new.id
      and ((c.status = 'accepted' and (c.requester_id = v_user or c.addressee_id = v_user))
        or (c.status = 'pending' and c.requester_id = v_user));
  if v_n >= v_limit then
    raise exception 'Plan limit: the % plan allows up to % contacts. Upgrade your plan in Settings to add more.', initcap(luma.plan_of(v_user)), v_limit;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_plan_contacts on luma.contacts;
create trigger enforce_plan_contacts before insert or update on luma.contacts
  for each row execute function luma.enforce_contact_limit();

-- ---------- file size and total storage ----------
create or replace function luma.enforce_doc_limits()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_file int := luma.limit_of(new.user_id, 'file_mb');
  v_store int := luma.limit_of(new.user_id, 'storage_mb');
  v_used bigint;
begin
  if v_file is not null and new.size_bytes > v_file::bigint * 1048576 then
    raise exception 'Plan limit: the % plan allows files up to % MB. Upgrade your plan in Settings for bigger files.', initcap(luma.plan_of(new.user_id)), v_file;
  end if;
  if v_store is not null then
    select coalesce(sum(d.size_bytes), 0) into v_used from luma.documents d where d.user_id = new.user_id;
    if v_used + new.size_bytes > v_store::bigint * 1048576 then
      raise exception 'Plan limit: the % plan includes % MB of file storage and it is full. Delete files or upgrade your plan in Settings.', initcap(luma.plan_of(new.user_id)), v_store;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_plan_documents on luma.documents;
create trigger enforce_plan_documents before insert on luma.documents
  for each row execute function luma.enforce_doc_limits();

-- ---------- reminder timing is a Glow / Zenith feature ----------
create or replace function luma.enforce_reminder_timing()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(luma.limit_of(new.user_id, 'timing'), 1) = 0 and (
       new.event_lead_min <> 15 or new.allday_hour <> 8 or new.task_hour <> 9 or new.bill_hour <> 9 or new.bill_days <> 3
    or new.sub_hour <> 9 or new.sub_days <> 3 or new.goal_hour <> 9 or new.goal_days <> 3) then
    raise exception 'Plan limit: choosing reminder times is available on Glow and Zenith. You can still switch each reminder on or off.';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_plan_reminder_timing on luma.reminder_prefs;
create trigger enforce_plan_reminder_timing before insert or update on luma.reminder_prefs
  for each row execute function luma.enforce_reminder_timing();


-- ################################################################
-- 034_weekly_review.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 034: the weekly review (Settings → Preferences → Weekly review).
-- Every Sunday at 18:00 in each user's own time zone, a short summary of their week arrives in the inbox
-- (and as a push). Switched off per user by Settings → Preferences → Weekly review.
-- Depends on 008 (notifications), 014 (pg_cron), 028 (luma.user_tz), 030 (luma.rm_text). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.run_weekly_review()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_done int;
  v_over int;
  v_spent numeric;
  v_count int := 0;
begin
  for r in select p.id as user_id from luma.profiles p where coalesce(p.preferences ->> 'weekly', 'true') <> 'false' loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(dow from v_now)::int <> 0 or extract(hour from v_now)::int <> 18;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.type = 'weekly_review' and n.created_at > now() - interval '5 days');

    select count(*) into v_done from luma.tasks t where t.user_id = r.user_id and t.completed_at >= now() - interval '7 days';
    select count(*) into v_over from luma.tasks t where t.user_id = r.user_id and t.status <> 'done' and t.due_date < v_now::date;
    select coalesce((select sum(m.amount) from luma.money_entries m where m.user_id = r.user_id and m.kind = 'expense' and m.entry_date > v_now::date - 7), 0)
         + coalesce((select sum(b.amount) from luma.bill_payments b where b.user_id = r.user_id and b.paid_at >= now() - interval '7 days'), 0)
      into v_spent;

    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, 'weekly_review', '📊 Your week in review',
      'You finished ' || v_done || ' task' || case when v_done = 1 then '' else 's' end
      || case when v_over > 0 then ', with ' || v_over || ' still overdue' else '' end
      || ' and spent ' || luma.rm_text(v_spent) || '. Open Analytics for the full picture.',
      'analytics');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_weekly_review() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-weekly-review') then perform cron.unschedule('luma-weekly-review'); end if;
  perform cron.schedule('luma-weekly-review', '5 * * * *', 'select luma.run_weekly_review()');
exception when others then
  raise notice 'Could not schedule the weekly review job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;


-- ################################################################
-- 035_more_reminder_prefs.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 035: Settings → Reminders gets Habits, Health and an adjustable budget warning.
--   • reminder_prefs.habit_on / health_on switch the habit and health reminders on or off for everyone's account
--     (the times are still set per habit and on the Health page).
--   • reminder_prefs.budget_pct: warn at 70 / 80 / 90 % of the monthly budget (default 80).
-- Depends on 031 (reminder_prefs), 030 (luma.rm_text), 008 (notifications). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.reminder_prefs add column if not exists habit_on boolean not null default true;
alter table luma.reminder_prefs add column if not exists health_on boolean not null default true;
alter table luma.reminder_prefs add column if not exists budget_pct integer not null default 80;
alter table luma.reminder_prefs drop constraint if exists reminder_prefs_budget_pct_check;
alter table luma.reminder_prefs add constraint reminder_prefs_budget_pct_check check (budget_pct between 50 and 100);

-- Muted reminders never reach the inbox (so no push either): this covers the health reminders the app creates itself
-- as well as the ones the server creates on a schedule.
create or replace function luma.skip_muted_reminders()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_habit boolean;
  v_health boolean;
begin
  if new.type = 'reminder_habit' or new.type in ('reminder_water', 'reminder_steps', 'reminder_active', 'reminder_sleep') then
    select coalesce(bool_and(p.habit_on), true), coalesce(bool_and(p.health_on), true) into v_habit, v_health
      from luma.reminder_prefs p where p.user_id = new.user_id;
    if (new.type = 'reminder_habit' and not v_habit) or (new.type <> 'reminder_habit' and not v_health) then
      return null;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists skip_muted_reminders on luma.notifications;
create trigger skip_muted_reminders before insert on luma.notifications
  for each row execute function luma.skip_muted_reminders();

-- budget alerts now use the user's own percentage
create or replace function luma.run_budget_alerts()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_tz text;
  v_first date;
  v_from timestamptz;
  v_to timestamptz;
  v_spent numeric;
  v_type text;
  v_on boolean;
  v_pct int;
  v_count int := 0;
begin
  for r in select s.user_id, s.monthly_budget from luma.money_settings s where s.monthly_budget > 0 loop
    select coalesce(bool_and(p.budget_on), true), coalesce(max(p.budget_pct), 80) into v_on, v_pct from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_tz := luma.user_tz(r.user_id);
    v_first := date_trunc('month', timezone(v_tz, now()))::date;
    v_from := v_first::timestamp at time zone v_tz;
    v_to := (v_first + interval '1 month')::timestamp at time zone v_tz;
    select coalesce((select sum(amount) from luma.money_entries where user_id = r.user_id and kind = 'expense' and entry_date >= v_first and entry_date < (v_first + interval '1 month')::date), 0)
         + coalesce((select sum(amount) from luma.bill_payments where user_id = r.user_id and paid_at >= v_from and paid_at < v_to), 0)
      into v_spent;
    v_type := case when v_spent >= r.monthly_budget then 'budget_over' when v_spent >= r.monthly_budget * v_pct / 100.0 then 'budget_warn' else null end;
    continue when v_type is null;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.type = v_type and n.created_at >= v_from);
    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, v_type,
      case v_type when 'budget_over' then '⚠️ You are over your monthly budget' else '💸 You have used ' || v_pct || '% of your monthly budget' end,
      'Spent ' || luma.rm_text(v_spent) || ' of ' || luma.rm_text(r.monthly_budget) || ' this month.', 'money');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_budget_alerts() from public, anon, authenticated;


-- ################################################################
-- 036_admin.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 036: super admin (the Admin page).
-- An admin can see every account and change anyone's plan (including their own). Admins are listed in
-- luma.admin_users, which can only be edited here in the SQL Editor — never from the app.
-- Depends on 001 and 033 (plans). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
--
-- To make an account an admin (register it normally first, then run):
--   insert into luma.admin_users (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
--   update luma.profiles set plan = 'zenith' where email = 'you@example.com';
-- ============================================================

create table if not exists luma.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table luma.admin_users enable row level security;   -- no policies: nobody can read or write it from the app
revoke all on luma.admin_users from anon, authenticated;

-- every plan change made from the Admin page is recorded
create table if not exists luma.plan_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  old_plan text,
  new_plan text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
alter table luma.plan_changes enable row level security;
revoke all on luma.plan_changes from anon, authenticated;

create or replace function luma.is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$ select exists (select 1 from luma.admin_users a where a.user_id = auth.uid()); $$;
revoke execute on function luma.is_admin() from public, anon;
grant execute on function luma.is_admin() to authenticated;

-- plan changes by normal users stay blocked; the admin function below switches this on for its own statement only
create or replace function luma.protect_plan()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') and coalesce(current_setting('luma.allow_plan_change', true), '') <> 'on' then
    if tg_op = 'INSERT' then new.plan := 'dawn'; else new.plan := old.plan; end if;
  end if;
  return new;
end;
$$;

create or replace function luma.admin_list_users(p_search text default '', p_limit integer default 200)
returns table (
  id uuid, email text, first_name text, last_name text, plan text, country text,
  created_at timestamptz, last_sign_in_at timestamptz, email_confirmed_at timestamptz, is_admin boolean
)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  return query
    select p.id, p.email, p.first_name, p.last_name, p.plan, to_jsonb(p) ->> 'country',
           p.created_at, u.last_sign_in_at, u.email_confirmed_at,
           exists (select 1 from luma.admin_users a where a.user_id = p.id)
    from luma.profiles p
    join auth.users u on u.id = p.id
    where coalesce(p_search, '') = ''
       or p.email ilike '%' || p_search || '%'
       or (coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) ilike '%' || p_search || '%'
    order by p.created_at desc
    limit least(coalesce(p_limit, 200), 500);
end;
$$;
revoke execute on function luma.admin_list_users(text, integer) from public, anon;
grant execute on function luma.admin_list_users(text, integer) to authenticated;

create or replace function luma.admin_stats()
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare v jsonb;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  select jsonb_build_object(
    'total', count(*),
    'dawn', count(*) filter (where plan = 'dawn'),
    'glow', count(*) filter (where plan = 'glow'),
    'zenith', count(*) filter (where plan = 'zenith'),
    'new_7d', count(*) filter (where created_at > now() - interval '7 days'))
  into v from luma.profiles;
  return v;
end;
$$;
revoke execute on function luma.admin_stats() from public, anon;
grant execute on function luma.admin_stats() to authenticated;

create or replace function luma.admin_set_plan(p_user uuid, p_plan text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_old text;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_plan not in ('dawn', 'glow', 'zenith') then raise exception 'Unknown plan'; end if;
  select plan into v_old from luma.profiles where id = p_user;
  if not found then raise exception 'No such user'; end if;
  if v_old = p_plan then return p_plan; end if;
  perform set_config('luma.allow_plan_change', 'on', true);   -- only for this statement / transaction
  update luma.profiles set plan = p_plan where id = p_user;
  perform set_config('luma.allow_plan_change', 'off', true);
  insert into luma.plan_changes (user_id, old_plan, new_plan, changed_by) values (p_user, v_old, p_plan, auth.uid());
  if p_user <> auth.uid() then
    perform luma.notify(p_user, 'system', '🎉 Your plan is now ' || initcap(p_plan),
      case when p_plan = 'dawn' then 'You are on the free Dawn plan.' else 'Thank you! Your new limits are active. Open Settings to see everything included.' end, 'settings');
  end if;
  return p_plan;
end;
$$;
revoke execute on function luma.admin_set_plan(uuid, text) from public, anon;
grant execute on function luma.admin_set_plan(uuid, text) to authenticated;


-- ################################################################
-- 037_chat_limit.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 037: daily limit on chat messages to contacts (50 a day, every plan).
-- The day follows each sender's own time zone and resets at midnight. The number lives in luma.plan_limits
-- (key 'chat_messages'); change a row to change the limit for a plan, or set it to NULL for unlimited.
-- Depends on 001 (messages), 028 (luma.user_tz), 033 (plan limits). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

insert into luma.plan_limits (plan, key, value) values
  ('dawn', 'chat_messages', 50), ('glow', 'chat_messages', 50), ('zenith', 'chat_messages', 50)
on conflict (plan, key) do update set value = excluded.value;

-- messages this sender has sent since local midnight
create or replace function luma.messages_sent_today(p_user uuid)
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select count(*)::int from luma.messages m
  where m.sender_id = p_user
    and m.created_at >= (date_trunc('day', timezone(luma.user_tz(p_user), now())) at time zone luma.user_tz(p_user));
$$;
revoke execute on function luma.messages_sent_today(uuid) from public, anon, authenticated;

create or replace function luma.enforce_message_limit()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_limit int := luma.limit_of(new.sender_id, 'chat_messages');
begin
  if v_limit is not null and luma.messages_sent_today(new.sender_id) >= v_limit then
    raise exception 'Daily limit reached: you can send up to % chat messages a day. It resets at midnight.', v_limit;
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_chat_limit on luma.messages;
create trigger enforce_chat_limit before insert on luma.messages
  for each row execute function luma.enforce_message_limit();

-- how many are left today (NULL = unlimited); the chat shows it
create or replace function luma.chat_left_today()
returns integer
language sql
stable
security definer set search_path = ''
as $$
  select case when luma.limit_of(auth.uid(), 'chat_messages') is null then null
              else greatest(0, luma.limit_of(auth.uid(), 'chat_messages') - luma.messages_sent_today(auth.uid())) end;
$$;
revoke execute on function luma.chat_left_today() from public, anon;
grant execute on function luma.chat_left_today() to authenticated;


-- ################################################################
-- 038_lock_budget_pct.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 038: on the Dawn plan the budget warning level is fixed at 80 %, like the reminder times.
-- (Glow and Zenith can choose it.) Replaces the check from 033 so it also covers reminder_prefs.budget_pct (035).
-- Depends on 033 and 035. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.enforce_reminder_timing()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(luma.limit_of(new.user_id, 'timing'), 1) = 0 and (
       new.event_lead_min <> 15 or new.allday_hour <> 8 or new.task_hour <> 9 or new.bill_hour <> 9 or new.bill_days <> 3
    or new.sub_hour <> 9 or new.sub_days <> 3 or new.goal_hour <> 9 or new.goal_days <> 3 or new.budget_pct <> 80) then
    raise exception 'Plan limit: choosing reminder times and the budget warning level is available on Glow and Zenith. You can still switch each reminder on or off.';
  end if;
  return new;
end;
$$;


-- ################################################################
-- 039_lock_health_reminder_times.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 039: on the Dawn plan the Health reminder times are fixed (like the other reminder times).
-- Water every 60 min 08:00–22:00, steps and active every 180 min 10:00–20:00, bedtime 23:00, wake-up 07:00, wind-down 30 min before.
-- Glow and Zenith can choose them; the on/off switches work on every plan.
-- Depends on 013 (health_reminders), 015 (active_*), 033 (plans). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.enforce_health_reminder_timing()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(luma.limit_of(new.user_id, 'timing'), 1) = 0 and (
       new.water_every_min <> 60 or new.water_from <> '08:00' or new.water_to <> '22:00'
    or new.steps_every_min <> 180 or new.steps_from <> '10:00' or new.steps_to <> '20:00'
    or new.active_every_min <> 180 or new.active_from <> '10:00' or new.active_to <> '20:00'
    or new.bedtime <> '23:00' or new.wake_time <> '07:00' or new.sleep_lead_min <> 30) then
    raise exception 'Plan limit: choosing reminder times is available on Glow and Zenith. You can still switch each reminder on or off.';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_plan_health_reminder_timing on luma.health_reminders;
create trigger enforce_plan_health_reminder_timing before insert or update on luma.health_reminders
  for each row execute function luma.enforce_health_reminder_timing();


-- ################################################################
-- 040_admin_report.sql
-- ################################################################

-- ============================================================
-- LUMA — migration 040: monthly plan statistics for the Admin page.
--   • EVERY plan change is now recorded in luma.plan_changes — from the Admin page, from the SQL Editor, or anywhere else.
--   • luma.admin_monthly_stats(): per month — accounts at the end of the month, new sign-ups, how many were on Dawn / Glow / Zenith
--     at the end of that month, and how many upgrades and downgrades happened in it. (Months are cut at midnight UTC.)
-- Depends on 033 and 036. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.log_plan_change()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.plan is distinct from old.plan then
    insert into luma.plan_changes (user_id, old_plan, new_plan, changed_by) values (new.id, old.plan, new.plan, auth.uid());
  end if;
  return new;
end;
$$;
drop trigger if exists log_plan_change on luma.profiles;
create trigger log_plan_change after update of plan on luma.profiles
  for each row execute function luma.log_plan_change();

-- the Admin page's plan change no longer writes the log itself (the trigger above does)
create or replace function luma.admin_set_plan(p_user uuid, p_plan text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_old text;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_plan not in ('dawn', 'glow', 'zenith') then raise exception 'Unknown plan'; end if;
  select plan into v_old from luma.profiles where id = p_user;
  if not found then raise exception 'No such user'; end if;
  if v_old = p_plan then return p_plan; end if;
  perform set_config('luma.allow_plan_change', 'on', true);
  update luma.profiles set plan = p_plan where id = p_user;
  perform set_config('luma.allow_plan_change', 'off', true);
  if p_user <> auth.uid() then
    perform luma.notify(p_user, 'system', '🎉 Your plan is now ' || initcap(p_plan),
      case when p_plan = 'dawn' then 'You are on the free Dawn plan.' else 'Thank you! Your new limits are active. Open Settings to see everything included.' end, 'settings');
  end if;
  return p_plan;
end;
$$;
revoke execute on function luma.admin_set_plan(uuid, text) from public, anon;
grant execute on function luma.admin_set_plan(uuid, text) to authenticated;

-- one row per month, newest first. The plan someone was on at the end of a month is worked out from the change log.
create or replace function luma.admin_monthly_stats(p_months integer default 12)
returns table (
  period date, total_accounts integer, new_signups integer,
  on_dawn integer, on_glow integer, on_zenith integer, upgrades integer, downgrades integer
)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  return query
  with months as (
    select (date_trunc('month', now()) - make_interval(months => n))::date as m
    from generate_series(0, least(greatest(coalesce(p_months, 12), 1), 36) - 1) as n
  ),
  bounds as (select m, (m + interval '1 month')::timestamptz as m_end from months),
  snap as (
    select b.m, p.id,
      case
        when p.created_at >= b.m_end then null
        else coalesce(
          (select c.new_plan from luma.plan_changes c where c.user_id = p.id and c.changed_at < b.m_end order by c.changed_at desc limit 1),
          (select c.old_plan from luma.plan_changes c where c.user_id = p.id and c.changed_at >= b.m_end order by c.changed_at asc limit 1),
          p.plan)
      end as plan_at
    from bounds b cross join luma.profiles p
  )
  select b.m,
    count(s.plan_at)::int,
    (select count(*)::int from luma.profiles p where p.created_at >= b.m and p.created_at < b.m_end),
    (count(*) filter (where s.plan_at = 'dawn'))::int,
    (count(*) filter (where s.plan_at = 'glow'))::int,
    (count(*) filter (where s.plan_at = 'zenith'))::int,
    (select count(*)::int from luma.plan_changes c where c.changed_at >= b.m and c.changed_at < b.m_end
       and (case c.new_plan when 'dawn' then 0 when 'glow' then 1 else 2 end) > (case coalesce(c.old_plan, 'dawn') when 'dawn' then 0 when 'glow' then 1 else 2 end)),
    (select count(*)::int from luma.plan_changes c where c.changed_at >= b.m and c.changed_at < b.m_end
       and (case c.new_plan when 'dawn' then 0 when 'glow' then 1 else 2 end) < (case coalesce(c.old_plan, 'dawn') when 'dawn' then 0 when 'glow' then 1 else 2 end))
  from bounds b join snap s on s.m = b.m
  group by b.m, b.m_end
  order by b.m desc;
end;
$$;
revoke execute on function luma.admin_monthly_stats(integer) from public, anon;
grant execute on function luma.admin_monthly_stats(integer) to authenticated;
