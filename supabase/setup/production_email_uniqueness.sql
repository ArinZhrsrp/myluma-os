-- PRODUCTION ONLY. Run in the dedicated production project's SQL Editor after
-- the normal migrations. Never run in staging or a project shared with staging.
-- Kept out of ALL_MIGRATIONS.sql so staging can keep using test aliases.
-- Existing duplicate mailboxes cause the transaction to fail without changing
-- accounts. Resolve those accounts manually before trying again.
begin;

create or replace function luma.registration_mailbox(email text)
returns text
language sql immutable strict
set search_path = ''
as $$
  select case
    when split_part(lower(trim(email)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(trim(email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else lower(trim(email))
  end
$$;

-- Enforces uniqueness atomically, including concurrent registrations and email
-- changes. Keep the original delivery/login address in auth.users untouched.
create unique index if not exists users_registration_mailbox_unique
  on auth.users (luma.registration_mailbox(email))
  where email is not null and trim(email) <> '';

commit;
