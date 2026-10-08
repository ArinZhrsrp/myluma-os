-- ============================================================
-- LUMA — migration 051: Lumi can delete your things, but only after you say yes.
--   Lumi first PREVIEWS what it would delete (this table remembers that list for you), asks you, and only deletes when your next
--   message is an explicit yes. It can only ever touch the signed-in user's own rows (it runs as you).
--   One pending list per user; it is replaced by the next preview and removed once used.
-- Depends on 029. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.assistant_pending (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  table_name text not null check (table_name in ('tasks', 'events', 'reminders', 'notes', 'money_entries', 'habits', 'goals', 'bills', 'study_tasks', 'study_courses')),
  ids        uuid[] not null,
  summary    text not null default '',
  request_id text not null,
  created_at timestamptz not null default now()
);
alter table luma.assistant_pending enable row level security;
drop policy if exists assistant_pending_own on luma.assistant_pending;
create policy assistant_pending_own on luma.assistant_pending for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on luma.assistant_pending from anon;
grant select, insert, update, delete on luma.assistant_pending to authenticated;
