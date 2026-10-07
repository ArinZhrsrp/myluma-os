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
