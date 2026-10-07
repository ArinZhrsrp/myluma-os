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
