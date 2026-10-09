-- ============================================================
-- LUMA — migration 080: Work task links, time budgets, @mentions, and Work figures for the admin report.
--   • work_task_links: "this task can start once that one is done". Set with work_set_dependencies (same project, up to 10 per task,
--     no loops). They are drawn as arrows on the Gantt chart and warned about in the task window.
--   • work_tasks.budget_minutes: the time a task is expected to take. work_time_totals() gives the minutes logged per task; the people on the
--     project are told once when a task goes over its budget.
--   • work_task_comments.mentions: people tagged with @ in a comment. They get their own notification (and not the general one).
--   • admin_work_stats(): figures for the Work add-on (admins only).
-- Depends on 071–079. Safe to re-run.
-- ============================================================

-- ---------- links between tasks ----------
create table if not exists luma.work_task_links (
  task_id    uuid not null references luma.work_tasks (id) on delete cascade,
  depends_on uuid not null references luma.work_tasks (id) on delete cascade,
  project_id uuid not null references luma.work_projects (id) on delete cascade,
  primary key (task_id, depends_on),
  check (task_id <> depends_on)
);
create index if not exists work_task_links_dep_idx on luma.work_task_links (depends_on);
create index if not exists work_task_links_project_idx on luma.work_task_links (project_id);
alter table luma.work_task_links enable row level security;
drop policy if exists work_links_read on luma.work_task_links;
create policy work_links_read on luma.work_task_links for select to authenticated using (luma.work_role(project_id, auth.uid()) is not null);
revoke all on luma.work_task_links from anon, authenticated;
grant select on luma.work_task_links to authenticated;

create or replace function luma.work_set_dependencies(p_task uuid, p_depends uuid[])
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_proj uuid; v_d uuid; v_list uuid[];
begin
  select project_id into v_proj from luma.work_tasks where id = p_task;
  if v_proj is null or not luma.work_can_edit(v_proj) then raise exception 'You can not change this task'; end if;
  v_list := coalesce((select array_agg(distinct x) from unnest(coalesce(p_depends, '{}'::uuid[])) x where x <> p_task), '{}'::uuid[]);
  if cardinality(v_list) > 10 then raise exception 'A task can wait for up to 10 other tasks'; end if;
  foreach v_d in array v_list loop
    if not exists (select 1 from luma.work_tasks where id = v_d and project_id = v_proj) then raise exception 'A task can only wait for a task in the same project'; end if;
    -- no loops: p_task must not already be (indirectly) waiting for v_d's... i.e. v_d must not depend on p_task
    if exists (with recursive up as (select depends_on from luma.work_task_links where task_id = v_d union select l.depends_on from luma.work_task_links l join up on l.task_id = up.depends_on)
               select 1 from up where depends_on = p_task) then raise exception 'That would make a loop: the other task already waits for this one'; end if;
  end loop;
  delete from luma.work_task_links where task_id = p_task;
  insert into luma.work_task_links (task_id, depends_on, project_id) select p_task, x, v_proj from unnest(v_list) x;
end;
$$;
revoke execute on function luma.work_set_dependencies(uuid, uuid[]) from public, anon;
grant execute on function luma.work_set_dependencies(uuid, uuid[]) to authenticated;

-- moving a task to another project drops its links (they only make sense inside one project)
create or replace function luma.work_move_task(p_task uuid, p_project uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_t record; v_u uuid; v_doc uuid; v_max integer;
begin
  select * into v_t from luma.work_tasks where id = p_task;
  if not found then raise exception 'Task not found'; end if;
  if v_t.project_id = p_project then return; end if;
  if not luma.work_can_edit(v_t.project_id) or not luma.work_can_edit(p_project) then raise exception 'You can only move a task between projects you can change'; end if;
  v_max := coalesce(luma.limit_of((select owner_id from luma.work_projects where id = p_project), 'work_tasks'), 1500);
  if (select count(*) from luma.work_tasks where project_id = p_project) >= v_max then raise exception 'That project is full (up to % tasks on its owner''s plan)', v_max; end if;
  perform set_config('luma.moving', '1', true);
  delete from luma.work_task_links where task_id = p_task or depends_on = p_task;
  update luma.work_tasks set project_id = p_project, folder_id = null,
    assignee_ids = coalesce((select array_agg(x) from unnest(v_t.assignee_ids) x where luma.work_role(p_project, x) is not null), '{}'::uuid[]) where id = p_task;
  update luma.work_task_comments set project_id = p_project where task_id = p_task;
  update luma.work_task_files set project_id = p_project where task_id = p_task;
  update luma.work_time_entries e set project_id = p_project where e.task_id = p_task;
  for v_doc in select document_id from luma.work_task_files where task_id = p_task loop
    for v_u in select luma.work_people(v_t.project_id) loop perform luma.unshare_doc(v_doc, v_u, null, null); end loop;
    for v_u in select luma.work_people(p_project) loop perform luma.share_doc(v_doc, v_u); end loop;
  end loop;
  perform set_config('luma.moving', '', true);
  update luma.work_projects set updated_at = now() where id in (v_t.project_id, p_project);
end;
$$;
revoke execute on function luma.work_move_task(uuid, uuid) from public, anon;
grant execute on function luma.work_move_task(uuid, uuid) to authenticated;

-- ---------- time budget ----------
alter table luma.work_tasks add column if not exists budget_minutes integer;
alter table luma.work_tasks drop constraint if exists work_tasks_budget_check;
alter table luma.work_tasks add constraint work_tasks_budget_check check (budget_minutes is null or budget_minutes between 1 and 60000);

-- minutes logged per task (everyone's time) across every project the person is on
create or replace function luma.work_time_totals()
returns table (task_id uuid, project_id uuid, minutes bigint)
language sql
stable
security definer set search_path = ''
as $$
  select e.task_id, e.project_id, sum(e.minutes)::bigint from luma.work_time_entries e
  where e.task_id is not null and e.running_since is null and luma.work_role(e.project_id, auth.uid()) is not null
  group by e.task_id, e.project_id;
$$;
revoke execute on function luma.work_time_totals() from public, anon;
grant execute on function luma.work_time_totals() to authenticated;

-- told once when the logged time crosses the budget
create or replace function luma.work_budget_watch()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_t record; v_total bigint; v_before bigint; v_u uuid;
begin
  if new.task_id is null or new.running_since is not null then return null; end if;
  if tg_op = 'UPDATE' and new.minutes = old.minutes and old.running_since is null then return null; end if;
  select id, title, project_id, budget_minutes, assignee_ids, created_by into v_t from luma.work_tasks where id = new.task_id;
  if v_t.budget_minutes is null then return null; end if;
  select coalesce(sum(minutes), 0) into v_total from luma.work_time_entries where task_id = new.task_id and running_since is null;
  v_before := v_total - new.minutes + case when tg_op = 'UPDATE' and old.running_since is null then old.minutes else 0 end;
  if v_before <= v_t.budget_minutes and v_total > v_t.budget_minutes then
    for v_u in select distinct x from unnest(v_t.assignee_ids || array[(select owner_id from luma.work_projects where id = v_t.project_id), v_t.created_by]) x where x is not null and x <> new.user_id loop
      if luma.work_role(v_t.project_id, v_u) is not null then
        perform luma.notify(v_u, 'work_budget', '⏱ ' || v_t.title || ' is over its time budget', round(v_total / 60.0, 1) || ' h logged of ' || round(v_t.budget_minutes / 60.0, 1) || ' h', 'work', v_t.id);
      end if;
    end loop;
  end if;
  return null;
end;
$$;
drop trigger if exists work_time_budget on luma.work_time_entries;
create trigger work_time_budget after insert or update on luma.work_time_entries for each row execute function luma.work_budget_watch();

-- ---------- @mentions ----------
alter table luma.work_task_comments add column if not exists mentions uuid[] not null default '{}';
grant update (body, mentions) on luma.work_task_comments to authenticated;

create or replace function luma.work_comment_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  select project_id into new.project_id from luma.work_tasks where id = new.task_id;
  if new.project_id is null then raise exception 'Task not found'; end if;
  if (select count(*) from luma.work_task_comments where task_id = new.task_id) >= 500 then raise exception 'A task can have up to 500 comments'; end if;
  new.mentions := coalesce((select array_agg(distinct x) from unnest(new.mentions) x where x <> new.user_id and luma.work_role(new.project_id, x) is not null), '{}'::uuid[]);
  if cardinality(new.mentions) > 10 then new.mentions := new.mentions[1:10]; end if;
  return new;
end;
$$;

create or replace function luma.work_comment_edit_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.task_id <> old.task_id or new.user_id <> old.user_id or (new.project_id <> old.project_id and coalesce(current_setting('luma.moving', true), '') <> '1') then raise exception 'Only the wording can change'; end if;
  new.mentions := coalesce((select array_agg(distinct x) from unnest(new.mentions) x where x <> new.user_id and luma.work_role(new.project_id, x) is not null), '{}'::uuid[]);
  if new.body is not distinct from old.body then new.mentions := old.mentions; return new; end if;
  if (select count(*) from luma.work_comment_edits where comment_id = old.id) >= 50 then raise exception 'A comment can be edited up to 50 times'; end if;
  insert into luma.work_comment_edits (comment_id, old_body) values (old.id, old.body);
  new.edited_at := now();
  return new;
end;
$$;

create or replace function luma.work_comment_notify()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_t record; v_u uuid; v_new uuid[];
begin
  select title, assignee_ids, created_by into v_t from luma.work_tasks where id = new.task_id;
  -- people tagged with @ (only the ones not tagged before, when a comment was edited)
  v_new := case when tg_op = 'UPDATE' then coalesce((select array_agg(x) from unnest(new.mentions) x where x <> all (old.mentions)), '{}'::uuid[]) else new.mentions end;
  foreach v_u in array v_new loop
    perform luma.notify(v_u, 'work_mention', '@ ' || luma.person_name(new.user_id) || ' mentioned you on ' || v_t.title, left(new.body, 120), 'work', new.task_id);
  end loop;
  if tg_op = 'UPDATE' then return null; end if;
  for v_u in select distinct x from unnest(v_t.assignee_ids || coalesce(array[v_t.created_by], '{}'::uuid[])) x where x is not null and x <> new.user_id and x <> all (new.mentions) loop
    if luma.work_role(new.project_id, v_u) is not null then
      perform luma.notify(v_u, 'work_comment', '💬 ' || luma.person_name(new.user_id) || ' commented on ' || v_t.title, left(new.body, 120), 'work', new.task_id);
    end if;
  end loop;
  return null;
end;
$$;
drop trigger if exists work_comments_notify on luma.work_task_comments;
create trigger work_comments_notify after insert on luma.work_task_comments for each row execute function luma.work_comment_notify();
drop trigger if exists work_comments_notify_edit on luma.work_task_comments;
create trigger work_comments_notify_edit after update of mentions on luma.work_task_comments for each row when (new.mentions is distinct from old.mentions) execute function luma.work_comment_notify();

drop function if exists luma.work_task_comments_of(uuid);
create or replace function luma.work_task_comments_of(p_task uuid)
returns table (id uuid, user_id uuid, name text, body text, created_at timestamptz, edited_at timestamptz, mentions uuid[])
language plpgsql
stable
security definer set search_path = ''
as $$
declare v_proj uuid;
begin
  select t.project_id into v_proj from luma.work_tasks t where t.id = p_task;
  if v_proj is null or luma.work_role(v_proj, auth.uid()) is null then raise exception 'Not allowed'; end if;
  return query select c.id, c.user_id, luma.person_name(c.user_id), c.body, c.created_at, c.edited_at, c.mentions from luma.work_task_comments c where c.task_id = p_task order by c.created_at;
end;
$$;
revoke execute on function luma.work_task_comments_of(uuid) from public, anon;
grant execute on function luma.work_task_comments_of(uuid) to authenticated;

-- ---------- figures for the admin report ----------
create or replace function luma.admin_work_stats()
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare v_now jsonb; v_months jsonb;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  select jsonb_build_object(
    'users_with_work', (select count(*) from luma.user_addons a where a.addon = 'work' and (a.expires_at is null or a.expires_at > now())),
    'on_trial', (select count(*) from luma.user_addons a where a.addon = 'work' and a.source = 'trial' and a.expires_at > now()),
    'paid_or_granted', (select count(*) from luma.user_addons a where a.addon = 'work' and a.source <> 'trial' and (a.expires_at is null or a.expires_at > now())),
    'trials_started', (select count(*) from luma.user_addons a where a.addon = 'work' and a.trial_started_at is not null),
    'companies', (select count(*) from luma.work_companies), 'archived_companies', (select count(*) from luma.work_companies where archived_at is not null),
    'projects', (select count(*) from luma.work_projects), 'shared_projects', (select count(distinct project_id) from luma.work_project_members where status = 'accepted'),
    'tasks', (select count(*) from luma.work_tasks), 'tasks_done', (select count(*) from luma.work_tasks where status = 'done'),
    'people_invited', (select count(*) from luma.work_project_members where status = 'accepted'),
    'hours_logged', (select coalesce(round(sum(minutes) / 60.0, 1), 0) from luma.work_time_entries),
    'active_30d', (select count(distinct u) from (select created_by u from luma.work_tasks where created_at > now() - interval '30 days' union select user_id from luma.work_time_entries where created_at > now() - interval '30 days' union select user_id from luma.work_task_comments where created_at > now() - interval '30 days') x where u is not null)
  ) into v_now;
  select coalesce(jsonb_agg(jsonb_build_object('period', m.d, 'projects', (select count(*) from luma.work_projects p where date_trunc('month', p.created_at) = m.d),
      'tasks', (select count(*) from luma.work_tasks t where date_trunc('month', t.created_at) = m.d),
      'hours', (select coalesce(round(sum(e.minutes) / 60.0, 1), 0) from luma.work_time_entries e where date_trunc('month', e.created_at) = m.d),
      'new_users', (select count(*) from luma.user_addons a where a.addon = 'work' and date_trunc('month', a.started_at) = m.d)) order by m.d), '[]'::jsonb)
    into v_months from (select generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') d) m;
  return v_now || jsonb_build_object('months', v_months);
end;
$$;
revoke execute on function luma.admin_work_stats() from public, anon;
grant execute on function luma.admin_work_stats() to authenticated;
