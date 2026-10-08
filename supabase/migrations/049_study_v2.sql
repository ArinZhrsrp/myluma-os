-- ============================================================
-- LUMA — migration 049: Study v2.
--   • luma.study_semesters — your semesters (name, start and end date): the semester planner and the "week 5 of 14" line.
--   • study_courses gets a semester, an optional target mark (%) and an optional final mark (%) for finished subjects.
--     (GPA / CGPA are worked out in the app from these marks and the credit hours.)
-- Same rules as the other Study tables: your own rows only; adding or changing needs the Study add-on (046).
-- Depends on 045, 046. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create table if not exists luma.study_semesters (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 60),
  start_date date not null,
  end_date   date not null,
  created_at timestamptz not null default now(),
  check (end_date > start_date)
);
create index if not exists study_semesters_user on luma.study_semesters (user_id, start_date);
alter table luma.study_semesters enable row level security;

drop policy if exists study_semesters_read on luma.study_semesters;
drop policy if exists study_semesters_insert on luma.study_semesters;
drop policy if exists study_semesters_update on luma.study_semesters;
drop policy if exists study_semesters_delete on luma.study_semesters;
create policy study_semesters_read on luma.study_semesters for select to authenticated using (user_id = auth.uid());
create policy study_semesters_insert on luma.study_semesters for insert to authenticated with check (user_id = auth.uid() and luma.has_my_addon('study'));
create policy study_semesters_update on luma.study_semesters for update to authenticated using (user_id = auth.uid() and luma.has_my_addon('study')) with check (user_id = auth.uid());
create policy study_semesters_delete on luma.study_semesters for delete to authenticated using (user_id = auth.uid());
revoke all on luma.study_semesters from anon;
grant select, insert, update, delete on luma.study_semesters to authenticated;

drop trigger if exists study_semesters_cap on luma.study_semesters;
create trigger study_semesters_cap before insert on luma.study_semesters for each row execute function luma.study_cap('30', 'semesters');

alter table luma.study_courses add column if not exists semester_id uuid references luma.study_semesters(id) on delete set null;
alter table luma.study_courses add column if not exists target_percent numeric(5,2) check (target_percent is null or target_percent between 0 and 100);
alter table luma.study_courses add column if not exists final_percent numeric(5,2) check (final_percent is null or final_percent between 0 and 100);
create index if not exists study_courses_semester on luma.study_courses (semester_id);

-- a subject can only be put in one of your own semesters
create or replace function luma.study_check_semester()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.semester_id is not null and not exists (select 1 from luma.study_semesters s where s.id = new.semester_id and s.user_id = new.user_id) then
    raise exception 'That semester is not yours';
  end if;
  return new;
end;
$$;
drop trigger if exists study_courses_semester_owner on luma.study_courses;
create trigger study_courses_semester_owner before insert or update on luma.study_courses for each row execute function luma.study_check_semester();
