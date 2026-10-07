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
