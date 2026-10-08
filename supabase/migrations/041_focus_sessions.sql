-- ============================================================
-- LUMA — migration 041: Focus mode history. Every completed focus session is saved (when, and for how many minutes),
-- so the Focus window can show "today: 3 sessions, 75 min" and Analytics can use it later.
-- (Your timer lengths and ambience sound are saved in your profile preferences — no table needed.)
-- Depends on 001. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  minutes integer not null check (minutes between 1 and 240),
  sound text not null default 'none' check (length(sound) <= 20),
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists focus_sessions_user on luma.focus_sessions (user_id, started_at desc);

alter table luma.focus_sessions enable row level security;

drop policy if exists "Users manage their own focus sessions" on luma.focus_sessions;
create policy "Users manage their own focus sessions"
  on luma.focus_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant all on luma.focus_sessions to anon, authenticated;
