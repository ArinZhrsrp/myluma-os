-- ============================================================
-- LUMA — migration 056: one ACTIVE semester at a time.
--   • You can create many semesters, but only one is active. Everything new you make in Study mode — subjects, notes, group projects,
--     assignments, and the reminders / events / tasks / documents you add while in Study mode — is put into the active semester
--     automatically. With no active semester you can't add Study items (the app asks you to create or activate one).
--   • To work in another semester: archive the active one ("Done with this semester", with a remark), then activate the next.
--   • Archiving moves the semester and everything in it to Study → Archive, switches its reminders off, and keeps your GPA.
--   • Restoring brings it back (active again if no other semester is active, otherwise inactive).
-- Depends on 049, 050, 055, 054. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.study_semesters add column if not exists is_active boolean not null default false;
alter table luma.study_semesters add column if not exists remark text not null default '';
alter table luma.study_semesters drop constraint if exists study_semesters_remark_check;
alter table luma.study_semesters add constraint study_semesters_remark_check check (length(remark) <= 1000);
create unique index if not exists study_semesters_one_active on luma.study_semesters (user_id) where is_active;

-- people who already have semesters: the one that is running today (and not archived) becomes the active one
update luma.study_semesters s set is_active = true
where s.id in (
  select distinct on (x.user_id) x.id from luma.study_semesters x
  where x.archived_at is null and x.start_date <= current_date and x.end_date >= current_date
    and not exists (select 1 from luma.study_semesters y where y.user_id = x.user_id and y.is_active)
  order by x.user_id, x.start_date desc);

-- ---------- which semester each item belongs to ----------
do $$
declare t text;
begin
  foreach t in array array['study_notes', 'study_projects', 'study_tasks', 'tasks', 'events', 'reminders', 'notes', 'documents', 'habits', 'goals', 'bills', 'money_entries'] loop
    execute format('alter table luma.%I add column if not exists semester_id uuid references luma.study_semesters(id) on delete set null', t);
    execute format('create index if not exists %I on luma.%I (semester_id)', t || '_semester_idx', t);
  end loop;
end $$;

-- every new Study item goes into the active semester; no active semester = no new Study items
create or replace function luma.assign_semester()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_study boolean; v_user uuid; v_sem uuid;
begin
  v_study := tg_table_name like 'study\_%' or (to_jsonb(new) ->> 'space') = 'study';
  if not v_study then return new; end if;
  v_user := coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(new) ->> 'owner_id')::uuid);
  select id into v_sem from luma.study_semesters where user_id = v_user and is_active and archived_at is null;
  if v_sem is null then raise exception 'Activate a semester first: Study items are added to your active semester.'; end if;
  new.semester_id := v_sem;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['study_courses', 'study_notes', 'study_projects', 'study_tasks', 'tasks', 'events', 'reminders', 'notes', 'documents', 'habits', 'goals', 'bills', 'money_entries'] loop
    if t = 'study_courses' then execute 'alter table luma.study_courses add column if not exists semester_id uuid references luma.study_semesters(id) on delete set null'; end if;
    execute format('drop trigger if exists zz_assign_semester on luma.%I', t);
    execute format('create trigger zz_assign_semester before insert on luma.%I for each row execute function luma.assign_semester()', t);
  end loop;
end $$;

-- the flags that decide which semester is active / archived can only be changed by the functions below
create or replace function luma.protect_semester_flags()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('luma.semester_rpc', true), '') <> 'on' then
    new.is_active := old.is_active;
    new.archived_at := old.archived_at;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_semester_flags on luma.study_semesters;
create trigger protect_semester_flags before update on luma.study_semesters for each row execute function luma.protect_semester_flags();

create or replace function luma.activate_study_semester(p_id uuid)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
declare v_other text;
begin
  if not luma.has_my_addon('study') then raise exception 'The Study add-on is not active'; end if;
  if not exists (select 1 from luma.study_semesters where id = p_id and user_id = auth.uid() and archived_at is null) then raise exception 'That semester is not available'; end if;
  select name into v_other from luma.study_semesters where user_id = auth.uid() and is_active and id <> p_id;
  if found then raise exception 'Archive "%" first: only one semester can be active at a time', v_other; end if;
  perform set_config('luma.semester_rpc', 'on', true);
  update luma.study_semesters set is_active = true where id = p_id;
  return true;
end;
$$;
revoke execute on function luma.activate_study_semester(uuid) from public, anon;
grant execute on function luma.activate_study_semester(uuid) to authenticated;

create or replace function luma.archive_study_semester(p_id uuid, p_remark text)
returns boolean
language plpgsql
security definer set search_path = ''
as $$
begin
  if not luma.has_my_addon('study') then raise exception 'The Study add-on is not active'; end if;
  if not exists (select 1 from luma.study_semesters where id = p_id and user_id = auth.uid() and archived_at is null) then raise exception 'That semester is not available'; end if;
  perform set_config('luma.semester_rpc', 'on', true);
  update luma.study_semesters set archived_at = now(), is_active = false, remark = left(coalesce(p_remark, ''), 1000) where id = p_id;
  update luma.study_courses set archived = true where semester_id = p_id and user_id = auth.uid();
  update luma.reminders set active = false where semester_id = p_id and user_id = auth.uid();
  return true;
end;
$$;
revoke execute on function luma.archive_study_semester(uuid, text) from public, anon;
grant execute on function luma.archive_study_semester(uuid, text) to authenticated;

create or replace function luma.restore_study_semester(p_id uuid)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare v_active boolean;
begin
  if not luma.has_my_addon('study') then raise exception 'The Study add-on is not active'; end if;
  if not exists (select 1 from luma.study_semesters where id = p_id and user_id = auth.uid() and archived_at is not null) then raise exception 'That semester is not archived'; end if;
  v_active := not exists (select 1 from luma.study_semesters where user_id = auth.uid() and is_active);
  perform set_config('luma.semester_rpc', 'on', true);
  update luma.study_semesters set archived_at = null, is_active = v_active where id = p_id;
  update luma.study_courses set archived = false where semester_id = p_id and user_id = auth.uid();
  update luma.reminders set active = true where semester_id = p_id and user_id = auth.uid();
  return case when v_active then 'active' else 'inactive' end;
end;
$$;
revoke execute on function luma.restore_study_semester(uuid) from public, anon;
grant execute on function luma.restore_study_semester(uuid) to authenticated;

-- group projects also say which semester they were made in
drop function if exists luma.my_study_projects();
create or replace function luma.my_study_projects()
returns table (id uuid, title text, course_name text, due_date date, owner_id uuid, owner_name text, my_status text, members integer, tasks_total integer, tasks_done integer, updated_at timestamptz, semester_id uuid)
language sql
stable
security definer set search_path = ''
as $$
  select p.id, p.title, p.course_name, p.due_date, p.owner_id, luma.person_name(p.owner_id), m.status,
         (select count(*)::int from luma.study_project_members x where x.project_id = p.id and x.status = 'accepted'),
         (select count(*)::int from luma.study_project_tasks t where t.project_id = p.id and m.status = 'accepted'),
         (select count(*)::int from luma.study_project_tasks t where t.project_id = p.id and t.status = 'done' and m.status = 'accepted'),
         p.updated_at,
         case when p.owner_id = auth.uid() then p.semester_id else null end
  from luma.study_project_members m
  join luma.study_projects p on p.id = m.project_id
  where m.user_id = auth.uid() and m.status in ('pending', 'accepted')
  order by p.updated_at desc;
$$;
revoke execute on function luma.my_study_projects() from public, anon;
grant execute on function luma.my_study_projects() to authenticated;
