-- STAGING ONLY: three accounts total per Gmail mailbox, including untagged mail.
-- Run after normal migrations in the staging project's SQL Editor.
-- Do not run alongside production_email_uniqueness.sql or on production.
-- Existing mailboxes over the limit make setup fail atomically; no users are deleted.
begin;
lock table auth.users in share row exclusive mode;

do $$
begin
  if to_regclass('auth.users_registration_mailbox_unique') is not null then
    raise exception 'Production mailbox uniqueness is installed; staging setup refused';
  end if;
end
$$;

create or replace function luma.registration_mailbox(email text)
returns text language sql immutable strict
set search_path = ''
as $$
  select case
    when split_part(lower(trim(email)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(trim(email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else lower(trim(email))
  end
$$;

-- Fixed slots enforce the cap even when registrations happen concurrently.
create table if not exists luma.staging_email_slots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mailbox text not null,
  slot smallint not null check (slot between 1 and 3),
  unique (mailbox, slot)
);
alter table luma.staging_email_slots enable row level security;
revoke all on luma.staging_email_slots from public, anon, authenticated, service_role;

-- Rebuild under the auth.users lock, making reruns and existing-account checks safe.
truncate luma.staging_email_slots;
insert into luma.staging_email_slots (user_id, mailbox, slot)
select id, luma.registration_mailbox(email),
       (row_number() over (partition by luma.registration_mailbox(email) order by id))::smallint
from auth.users
where split_part(lower(trim(email)), '@', 2) in ('gmail.com', 'googlemail.com');

create or replace function luma.enforce_staging_email_limit()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  mailbox_key text;
  candidate smallint;
begin
  if tg_op = 'UPDATE' then
    if luma.registration_mailbox(old.email) is not distinct from luma.registration_mailbox(new.email) then
      return new;
    end if;
  end if;
  delete from luma.staging_email_slots where user_id = new.id;
  if split_part(lower(trim(new.email)), '@', 2) in ('gmail.com', 'googlemail.com') then
    mailbox_key := luma.registration_mailbox(new.email);
    for candidate in 1..3 loop
      insert into luma.staging_email_slots (user_id, mailbox, slot)
        values (new.id, mailbox_key, candidate)
        on conflict (mailbox, slot) do nothing;
      if found then return new; end if;
    end loop;
    raise exception using errcode = '23505', message = 'Staging allows at most three accounts per Gmail mailbox.';
  end if;
  return new;
end
$$;
revoke all on function luma.enforce_staging_email_limit() from public, anon, authenticated, service_role;
drop trigger if exists enforce_staging_email_limit on auth.users;
create trigger enforce_staging_email_limit
  after insert or update of email on auth.users
  for each row execute function luma.enforce_staging_email_limit();
commit;
