-- ============================================================
-- LUMA — FRESH START. DELETES EVERYTHING.
--
-- This removes ALL user accounts and ALL data in your Supabase project: profiles, tasks, events, notes, habits,
-- goals, bills, money, reminders, chat, notifications, push subscriptions, plans, admins — all of it.
-- It cannot be undone. Your tables, functions, plan limits and scheduled jobs are kept.
--
-- Uploaded FILES are stored separately: empty them yourself in Supabase → Storage → luma-documents
-- (open the bucket, select all, delete). Deleting rows here does not remove the files.
--
-- After running it: register your admin account on the site, then make it admin (see 036_admin.sql).
--
-- HOW TO RUN: Supabase → SQL Editor. Delete the guard block below first (this is on purpose: the script
-- will not run until you remove it).
-- ============================================================

do $$ begin raise exception 'SAFETY GUARD: delete this block (from "do" to "end $$;") if you really want to erase everything.'; end $$;

begin;

-- empty every table in the luma schema except the plan limits (and keep their structure)
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'luma' and tablename <> 'plan_limits' loop
    execute format('truncate table luma.%I restart identity cascade', t.tablename);
  end loop;
end $$;

-- remove every account (their sessions and sign-in records go with them)
delete from auth.users;

commit;

-- check: both should say 0
select (select count(*) from auth.users) as accounts, (select count(*) from luma.profiles) as profiles;
