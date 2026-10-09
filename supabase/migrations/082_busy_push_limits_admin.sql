-- LUMA — 082: "tomorrow is packed" notification, and an admin screen for plan limits.
--
--   • luma.run_busy_alerts() runs every hour. At 6 pm in each person's own time zone it looks at tomorrow (events, tasks and bills due,
--     Work tasks they are on, Study deadlines and classes) and, if the day is busy or packed, adds a notification (which also sends a push).
--     It uses the same numbers as the app (Settings → Preferences → "How easily a day counts as busy": sensitive / normal / relaxed) and
--     respects the "Busy-day alerts" and "Tell me the evening before" switches (profile preferences busy_alerts / busy_push / busy_level).
--   • luma.admin_plan_limits() / luma.admin_set_plan_limit() let an administrator read and change the numbers in luma.plan_limits
--     (value NULL = unlimited) without writing SQL. Only rows that already exist can be changed.
--
-- Depends on 001 (profiles.preferences), 028 (user_tz), 033 (plan_limits), 045 (study), 071–077 (Work), has_addon. Safe to re-run.

create or replace function luma.busy_day_stats(p_user uuid, p_day date)
returns table (n numeric, hours numeric, clashes integer)
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  v_n numeric := 0; v_h numeric := 0; v_c int := 0; v_x numeric;
begin
  -- events that fall on the day (repeats handled)
  select count(*) into v_x from luma.events e
  where e.user_id = p_user and e.event_date <= p_day and (
    e.event_date = p_day
    or e.repeats = 'daily'
    or (e.repeats = 'weekly' and extract(dow from e.event_date) = extract(dow from p_day))
    or (e.repeats = 'monthly' and extract(day from e.event_date) = extract(day from p_day))
    or (e.repeats = 'yearly' and to_char(e.event_date, 'MM-DD') = to_char(p_day, 'MM-DD')));
  v_n := v_n + v_x;
  -- timed events: hours booked and overlaps
  select coalesce(sum(t.e - t.s), 0) / 60.0, coalesce(sum(case when t.s < t.prev_end then 1 else 0 end), 0)
    into v_h, v_c
  from (
    select q.s, q.e, max(q.e) over (order by q.s, q.e rows between unbounded preceding and 1 preceding) as prev_end
    from (
      select (substr(e.start_time, 1, 2)::int * 60 + substr(e.start_time, 4, 2)::int) as s,
             greatest(substr(e.start_time, 1, 2)::int * 60 + substr(e.start_time, 4, 2)::int + 15,
                      coalesce(substr(e.end_time, 1, 2)::int * 60 + substr(e.end_time, 4, 2)::int, substr(e.start_time, 1, 2)::int * 60 + substr(e.start_time, 4, 2)::int + 60)) as e
      from luma.events e
      where e.user_id = p_user and e.start_time is not null and e.event_date <= p_day and not e.all_day and (
        e.event_date = p_day or e.repeats = 'daily'
        or (e.repeats = 'weekly' and extract(dow from e.event_date) = extract(dow from p_day))
        or (e.repeats = 'monthly' and extract(day from e.event_date) = extract(day from p_day))
        or (e.repeats = 'yearly' and to_char(e.event_date, 'MM-DD') = to_char(p_day, 'MM-DD')))
    ) q
  ) t;
  -- tasks and bills due
  select count(*) into v_x from luma.tasks t where t.user_id = p_user and t.status <> 'done' and t.due_date = p_day and luma.live_item(t.semester_id);
  v_n := v_n + v_x;
  select count(*) into v_x from luma.bills b where b.user_id = p_user and b.due_date = p_day;
  v_n := v_n + v_x;
  -- Work tasks on the day (spanning tasks count on every day), only for people with the add-on
  if luma.has_addon(p_user, 'work') then
    select count(*) into v_x from luma.work_tasks t join luma.work_projects p on p.id = t.project_id left join luma.work_companies c on c.id = p.company_id
    where t.status <> 'done' and c.archived_at is null and (p.owner_id = p_user or p_user = any (t.assignee_ids))
      and coalesce(t.start_date, t.due_date) <= p_day and coalesce(t.due_date, t.start_date) >= p_day;
    v_n := v_n + v_x;
  end if;
  -- Study deadlines (1 each) and classes (half each)
  if luma.has_addon(p_user, 'study') then
    select count(*) into v_x from luma.study_tasks t where t.user_id = p_user and t.status <> 'done' and t.due_date = p_day;
    v_n := v_n + v_x;
    select count(*) * 0.5 into v_x from luma.study_classes k where k.user_id = p_user and k.weekday = extract(dow from p_day)::int;
    v_n := v_n + v_x;
  end if;
  return query select v_n, round(v_h, 1), v_c;
end;
$$;
revoke execute on function luma.busy_day_stats(uuid, date) from public, anon, authenticated;

create or replace function luma.run_busy_alerts()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record; s record; v_now timestamp; v_day date; v_lv text; v_n numeric[]; v_h numeric[]; v_c int[]; v_level int; v_title text; v_body text;
  v_count int := 0;
begin
  for r in select p.id as user_id, p.preferences as pr from luma.profiles p
           where coalesce(p.preferences ->> 'busy_alerts', 'true') <> 'false' and coalesce(p.preferences ->> 'busy_push', 'true') <> 'false' loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(hour from v_now)::int <> 18;
    continue when exists (select 1 from luma.notifications x where x.user_id = r.user_id and x.type = 'busy_day' and x.created_at > now() - interval '20 hours');
    v_day := v_now::date + 1;
    select * into s from luma.busy_day_stats(r.user_id, v_day);
    v_lv := coalesce(r.pr ->> 'busy_level', 'normal');
    if v_lv = 'sensitive' then v_n := array[4, 6]; v_h := array[4, 6]; v_c := array[1, 2];
    elsif v_lv = 'relaxed' then v_n := array[8, 12]; v_h := array[8, 12]; v_c := array[2, 4];
    else v_n := array[6, 9]; v_h := array[6, 9]; v_c := array[1, 3]; end if;
    v_level := case when s.n >= v_n[2] or s.hours >= v_h[2] or s.clashes >= v_c[2] then 2
                    when s.n >= v_n[1] or s.hours >= v_h[1] or s.clashes >= v_c[1] then 1 else 0 end;
    continue when v_level = 0;
    v_title := case when v_level = 2 then '🔥 Tomorrow is packed' else '⚠️ Tomorrow is busy' end;
    v_body := trim(trailing '.' from s.n::numeric(6,1)::text) || ' things'
      || case when s.hours >= 3 then ' · ' || s.hours || ' h booked' else '' end
      || case when s.clashes > 0 then ' · ' || s.clashes || ' clash' || case when s.clashes = 1 then '' else 'es' end else '' end
      || case when v_level = 2 then '. Think about moving something.' else '. Open your calendar to plan it.' end;
    v_body := replace(v_body, '.0 things', ' things');
    insert into luma.notifications (user_id, type, title, body, link) values (r.user_id, 'busy_day', v_title, v_body, 'calendar');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_busy_alerts() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-busy-alerts') then perform cron.unschedule('luma-busy-alerts'); end if;
  perform cron.schedule('luma-busy-alerts', '5 * * * *', 'select luma.run_busy_alerts()');
exception when others then
  raise notice 'Could not schedule the busy-day job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;

-- ---------- plan limits editor (admins only) ----------
create or replace function luma.admin_plan_limits()
returns table (plan text, key text, value integer)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  return query select l.plan, l.key, l.value from luma.plan_limits l order by l.key, case l.plan when 'dawn' then 1 when 'glow' then 2 else 3 end;
end;
$$;
revoke execute on function luma.admin_plan_limits() from public, anon;
grant execute on function luma.admin_plan_limits() to authenticated;

create or replace function luma.admin_set_plan_limit(p_plan text, p_key text, p_value integer)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_value is not null and p_value < 0 then raise exception 'A limit can not be negative'; end if;
  update luma.plan_limits set value = p_value where plan = p_plan and key = p_key;
  if not found then raise exception 'There is no limit called % for the % plan', p_key, p_plan; end if;
end;
$$;
revoke execute on function luma.admin_set_plan_limit(text, text, integer) from public, anon;
grant execute on function luma.admin_set_plan_limit(text, text, integer) to authenticated;
