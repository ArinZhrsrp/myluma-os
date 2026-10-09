-- ============================================================
-- LUMA — migration 077: Work due-date reminders and limits per plan.
--   • People given a Work task are reminded before it is due (the day before and on the day, at the hour they chose in Settings → Reminders),
--     and get a daily nudge for a week once it is overdue. Tasks that are done, or in an archived company, are left alone.
--   • The Work limits depend on the plan of the person who owns the project / company (the Work add-on works on every plan):
--       Dawn:   2 companies · 5 projects · 3 people per project · 200 tasks per project
--       Glow:   5 companies · 20 projects · 8 people per project · 600 tasks per project
--       Zenith: 20 companies · 60 projects · 15 people per project · 1,500 tasks per project
--     (change the numbers in luma.plan_limits keys work_companies / work_projects / work_people / work_tasks). Going over after a downgrade
--     keeps what exists; it only stops adding more.
-- Depends on 071–076, 033 (plan_limits), 031 (reminder_prefs). Safe to re-run.
-- ============================================================

insert into luma.plan_limits (plan, key, value) values
  ('dawn', 'work_companies', 2), ('glow', 'work_companies', 5), ('zenith', 'work_companies', 20),
  ('dawn', 'work_projects', 5), ('glow', 'work_projects', 20), ('zenith', 'work_projects', 60),
  ('dawn', 'work_people', 3), ('glow', 'work_people', 8), ('zenith', 'work_people', 15),
  ('dawn', 'work_tasks', 200), ('glow', 'work_tasks', 600), ('zenith', 'work_tasks', 1500)
on conflict (plan, key) do update set value = excluded.value;

alter table luma.reminder_prefs add column if not exists work_on boolean not null default true;
alter table luma.reminder_prefs add column if not exists work_hour integer not null default 9 check (work_hour between 0 and 23);
alter table luma.reminder_prefs add column if not exists work_days integer not null default 1 check (work_days between 1 and 14);

create or replace function luma.work_company_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_max integer;
begin
  if tg_op = 'INSERT' then
    v_max := coalesce(luma.limit_of(new.owner_id, 'work_companies'), 20);
    if (select count(*) from luma.work_companies where owner_id = new.owner_id) >= v_max then raise exception 'Your plan allows up to % companies in total (active and archived both count)', v_max; end if;
  end if;
  if tg_op = 'UPDATE' and new.owner_id <> old.owner_id then raise exception 'A company can not change owner'; end if;
  new.name := btrim(new.name); new.position := btrim(new.position);
  -- archiving stamps the end date; restoring clears it
  if new.archived_at is not null and (tg_op = 'INSERT' or old.archived_at is null) and new.end_date is null then new.end_date := (new.archived_at at time zone 'Asia/Kuala_Lumpur')::date; end if;
  if new.archived_at is null and tg_op = 'UPDATE' and old.archived_at is not null then new.end_date := null; end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function luma.work_project_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_arch timestamptz; v_owner uuid; v_max integer;
begin
  if tg_op = 'INSERT' then
    v_max := coalesce(luma.limit_of(new.owner_id, 'work_projects'), 60);
    if (select count(*) from luma.work_projects where owner_id = new.owner_id) >= v_max then raise exception 'Your plan allows up to % projects', v_max; end if;
    if new.company_id is null then
      select id into new.company_id from luma.work_companies where owner_id = new.owner_id and archived_at is null order by created_at limit 1;
      if new.company_id is null then insert into luma.work_companies (owner_id, name) values (new.owner_id, 'My company') returning id into new.company_id; end if;
    end if;
  elsif new.company_id is distinct from old.company_id then raise exception 'A project can not move to another company';
  end if;
  select archived_at, owner_id into v_arch, v_owner from luma.work_companies where id = new.company_id;
  if v_owner is distinct from new.owner_id then raise exception 'That is not your company'; end if;
  if v_arch is not null then raise exception 'This company is archived: restore it to change its projects'; end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function luma.work_task_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_a uuid; v_max integer;
begin
  if tg_op = 'INSERT' then
    v_max := coalesce(luma.limit_of((select owner_id from luma.work_projects where id = new.project_id), 'work_tasks'), 1500);
    if (select count(*) from luma.work_tasks where project_id = new.project_id) >= v_max then raise exception 'Your plan allows up to % tasks in a project', v_max; end if;
  end if;
  new.assignee_ids := coalesce((select array_agg(distinct x) from unnest(new.assignee_ids) x), '{}'::uuid[]);
  foreach v_a in array new.assignee_ids loop
    if luma.work_role(new.project_id, v_a) is null then raise exception 'That person is not on this project'; end if;
  end loop;
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then raise exception 'A task can not move to another project'; end if;
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.completed_at := now();
  elsif new.status <> 'done' then new.completed_at := null; end if;
  return new;
end;
$$;

create or replace function luma.work_invite(p_project uuid, p_users uuid[], p_role text default 'member')
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare v_name text; v_user uuid; v_count int := 0; v_total int; v_old text; v_max int;
begin
  if p_role not in ('member', 'viewer') then raise exception 'Unknown role'; end if;
  select name into v_name from luma.work_projects where id = p_project and owner_id = auth.uid();
  if not found then raise exception 'Only the project owner can invite people'; end if;
  if not luma.has_my_addon('work') then raise exception 'The Work add-on is needed to invite people'; end if;
  v_max := coalesce(luma.limit_of(auth.uid(), 'work_people'), 15);
  select count(*) into v_total from luma.work_project_members where project_id = p_project and status <> 'declined';
  foreach v_user in array coalesce(p_users, '{}'::uuid[]) loop
    continue when v_user = auth.uid();
    if not luma.is_contact(auth.uid(), v_user) then raise exception 'You can only invite people in your contacts'; end if;
    select status into v_old from luma.work_project_members where project_id = p_project and user_id = v_user;
    continue when found and v_old <> 'declined';
    if v_total >= v_max then raise exception 'Your plan allows up to % people on a project', v_max; end if;
    insert into luma.work_project_members (project_id, user_id, role, status, invited_by) values (p_project, v_user, p_role, 'pending', auth.uid())
      on conflict (project_id, user_id) do update set role = p_role, status = 'pending', invited_by = auth.uid(), created_at = now();
    v_total := v_total + 1; v_count := v_count + 1;
    perform luma.notify(v_user, 'work_invite', '💼 ' || luma.person_name(auth.uid()) || ' added you to a project', v_name || '. Open Work to accept.', 'work', p_project);
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.work_invite(uuid, uuid[], text) from public, anon;
grant execute on function luma.work_invite(uuid, uuid[], text) to authenticated;

-- ---------- due-date reminders ----------
create or replace function luma.run_work_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record; u uuid;
  v_now timestamp; v_today date; v_on boolean; v_hour int; v_days int; v_off int; v_late int; v_title text; v_send boolean;
  v_count int := 0;
begin
  for r in
    select t.id, t.title, t.due_date, t.assignee_ids, p.name as pname
    from luma.work_tasks t
    join luma.work_projects p on p.id = t.project_id
    left join luma.work_companies c on c.id = p.company_id
    where t.status <> 'done' and t.due_date is not null and cardinality(t.assignee_ids) > 0
      and t.due_date between current_date - 8 and current_date + 16
      and c.archived_at is null
  loop
    foreach u in array r.assignee_ids loop
      continue when not luma.has_addon(u, 'work');
      select coalesce(bool_and(x.work_on), true), coalesce(max(x.work_hour), 9), coalesce(max(x.work_days), 1) into v_on, v_hour, v_days from luma.reminder_prefs x where x.user_id = u;
      continue when not v_on;
      v_now := timezone(luma.user_tz(u), now()); v_today := v_now::date; v_late := v_today - r.due_date;
      v_title := null; v_send := false;
      if v_late > 0 then
        if v_late <= 7 and extract(hour from v_now)::int = v_hour then
          v_title := '⚠️ ' || r.title || ' is overdue by ' || v_late || ' day' || case when v_late = 1 then '' else 's' end; v_send := true;
        end if;
      else
        foreach v_off in array array[v_days, 1, 0] loop
          continue when r.due_date <> v_today + v_off;
          v_send := extract(hour from v_now)::int = v_hour;
          v_title := '📌 ' || r.title || case when v_off = 0 then ' is due today' else ' is due ' || luma.days_text(v_off, 'in') end;
          exit;
        end loop;
      end if;
      continue when not v_send or v_title is null;
      continue when exists (select 1 from luma.notifications n where n.user_id = u and n.type = 'reminder_work' and n.ref = r.id and n.title = v_title and n.created_at > now() - interval '12 hours');
      insert into luma.notifications (user_id, type, title, body, link, ref) values (u, 'reminder_work', v_title, r.pname, 'work', r.id);
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_work_reminders() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-work-reminders') then perform cron.unschedule('luma-work-reminders'); end if;
  perform cron.schedule('luma-work-reminders', '0 * * * *', 'select luma.run_work_reminders()');
exception when others then
  raise notice 'Could not schedule the Work reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
