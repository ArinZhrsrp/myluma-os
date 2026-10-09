-- ============================================================
-- LUMA — migration 067: Study attendance and flashcards.
--   • luma.study_attendance: whether you were there (present / late / absent / excused) for each class on each date.
--     luma.study_courses.attendance_target: the % of classes you want to attend (default 80).
--   • luma.study_decks and luma.study_cards: flashcards with spaced repetition (each card remembers when it is due again).
-- Same rules as the rest of Study: your own rows only, adding needs the Study add-on, decks go into the active semester.
-- Depends on 045, 056. Safe to re-run.
-- ============================================================

-- ---------- attendance ----------
alter table luma.study_courses add column if not exists attendance_target integer not null default 80;
alter table luma.study_courses drop constraint if exists study_courses_attendance_target_check;
alter table luma.study_courses add constraint study_courses_attendance_target_check check (attendance_target between 0 and 100);

create table if not exists luma.study_attendance (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  class_id    uuid not null references luma.study_classes (id) on delete cascade,
  course_id   uuid not null references luma.study_courses (id) on delete cascade,
  att_date    date not null,
  status      text not null check (status in ('present', 'late', 'absent', 'excused')),
  semester_id uuid references luma.study_semesters (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (class_id, att_date)
);
create index if not exists study_attendance_user_idx on luma.study_attendance (user_id, att_date desc);

-- the class must be yours and belong to that subject
create or replace function luma.study_attendance_check()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if not exists (select 1 from luma.study_classes c where c.id = new.class_id and c.course_id = new.course_id and c.user_id = new.user_id) then
    raise exception 'That class is not yours';
  end if;
  return new;
end;
$$;
drop trigger if exists study_attendance_owner on luma.study_attendance;
create trigger study_attendance_owner before insert or update on luma.study_attendance for each row execute function luma.study_attendance_check();
drop trigger if exists zz_assign_semester on luma.study_attendance;
create trigger zz_assign_semester before insert on luma.study_attendance for each row execute function luma.assign_semester();
drop trigger if exists study_attendance_cap on luma.study_attendance;
create trigger study_attendance_cap before insert on luma.study_attendance for each row execute function luma.study_cap('6000', 'attendance records');

-- ---------- flashcards ----------
create table if not exists luma.study_decks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id   uuid references luma.study_courses (id) on delete set null,
  title       text not null check (length(btrim(title)) between 1 and 80),
  semester_id uuid references luma.study_semesters (id) on delete cascade,   -- deleting an archived semester removes its decks too
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists study_decks_user_idx on luma.study_decks (user_id, created_at);
create table if not exists luma.study_cards (
  id               uuid primary key default gen_random_uuid(),
  deck_id          uuid not null references luma.study_decks (id) on delete cascade,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  front            text not null check (length(btrim(front)) between 1 and 500),
  back             text not null check (length(btrim(back)) between 1 and 1000),
  ease             numeric(4,2) not null default 2.5,
  interval_days    integer not null default 0,
  reps             integer not null default 0,
  lapses           integer not null default 0,
  due_on           date not null default current_date,
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists study_cards_deck_idx on luma.study_cards (deck_id, due_on);
create index if not exists study_cards_user_idx on luma.study_cards (user_id, due_on);

create or replace function luma.study_deck_check()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_n int;
begin
  if tg_table_name = 'study_cards' then
    if not exists (select 1 from luma.study_decks d where d.id = new.deck_id and d.user_id = new.user_id) then raise exception 'That deck is not yours'; end if;
    if tg_op = 'INSERT' then
      select count(*) into v_n from luma.study_cards where deck_id = new.deck_id;
      if v_n >= 500 then raise exception 'A deck can have up to 500 cards'; end if;
    end if;
  elsif new.course_id is not null and not exists (select 1 from luma.study_courses c where c.id = new.course_id and c.user_id = new.user_id) then
    raise exception 'That subject is not yours';
  end if;
  return new;
end;
$$;
drop trigger if exists study_cards_owner on luma.study_cards;
create trigger study_cards_owner before insert or update on luma.study_cards for each row execute function luma.study_deck_check();
drop trigger if exists study_decks_owner on luma.study_decks;
create trigger study_decks_owner before insert or update on luma.study_decks for each row execute function luma.study_deck_check();
drop trigger if exists zz_assign_semester on luma.study_decks;
create trigger zz_assign_semester before insert on luma.study_decks for each row execute function luma.assign_semester();
drop trigger if exists study_decks_cap on luma.study_decks;
create trigger study_decks_cap before insert on luma.study_decks for each row execute function luma.study_cap('200', 'decks');
drop trigger if exists study_cards_cap on luma.study_cards;
create trigger study_cards_cap before insert on luma.study_cards for each row execute function luma.study_cap('20000', 'flashcards');

-- ---------- access: your own rows; adding and changing needs the Study add-on ----------
do $$
declare t text;
begin
  foreach t in array array['study_attendance', 'study_decks', 'study_cards'] loop
    execute format('alter table luma.%I enable row level security', t);
    execute format('drop policy if exists %I on luma.%I', t || '_read', t);
    execute format('drop policy if exists %I on luma.%I', t || '_insert', t);
    execute format('drop policy if exists %I on luma.%I', t || '_update', t);
    execute format('drop policy if exists %I on luma.%I', t || '_delete', t);
    execute format('create policy %I on luma.%I for select to authenticated using (user_id = auth.uid())', t || '_read', t);
    execute format('create policy %I on luma.%I for insert to authenticated with check (user_id = auth.uid() and luma.has_my_addon(''study''))', t || '_insert', t);
    execute format('create policy %I on luma.%I for update to authenticated using (user_id = auth.uid() and luma.has_my_addon(''study'')) with check (user_id = auth.uid())', t || '_update', t);
    execute format('create policy %I on luma.%I for delete to authenticated using (user_id = auth.uid())', t || '_delete', t);
    execute format('grant select, insert, update, delete on luma.%I to authenticated', t);
  end loop;
end $$;

-- how many cards each deck has, and how many are due (p_today = your today)
create or replace function luma.my_deck_stats(p_today date)
returns table (deck_id uuid, total integer, due integer)
language sql
stable
set search_path = ''
as $$
  select c.deck_id, count(*)::int, (count(*) filter (where c.due_on <= p_today))::int
  from luma.study_cards c where c.user_id = auth.uid() group by c.deck_id;
$$;
revoke execute on function luma.my_deck_stats(date) from public, anon;
grant execute on function luma.my_deck_stats(date) to authenticated;
