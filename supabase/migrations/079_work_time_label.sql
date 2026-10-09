-- ============================================================
-- LUMA — migration 079: a name you type for general Work time ("Client call", "Team meeting"…).
--   • work_time_entries.label (up to 100 characters). Only used for general time (not tied to a project); it shows instead of "General"
--     in the Time tab and the timesheet. Time on a project or task keeps using that project / task, plus the note.
--   • work_timer_start gets an optional label.
-- Depends on 076. Safe to re-run.
-- ============================================================

alter table luma.work_time_entries add column if not exists label text not null default '';
alter table luma.work_time_entries drop constraint if exists work_time_label_check;
alter table luma.work_time_entries add constraint work_time_label_check check (length(label) <= 100);

create or replace function luma.work_time_guard()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_proj record; v_task record; v_co record; v_other integer; v_stop boolean := tg_op = 'UPDATE' and ((old.running_since is not null and new.running_since is null)
    or (old.project_id is not null and new.project_id is null) or (old.task_id is not null and new.task_id is null and new.project_id is not distinct from old.project_id));   -- stopping a timer, or a task / project being deleted
begin
  if tg_op = 'INSERT' and (select count(*) from luma.work_time_entries where user_id = new.user_id) >= 20000 then raise exception 'You can keep up to 20,000 time entries'; end if;
  if not v_stop then
  if new.task_id is not null then
    select id, title, project_id into v_task from luma.work_tasks where id = new.task_id;
    if not found then raise exception 'Task not found'; end if;
    new.project_id := v_task.project_id; new.task_title := v_task.title;
  end if;
  if new.project_id is not null then
    select id, name, owner_id, company_id into v_proj from luma.work_projects where id = new.project_id;
    if not found then raise exception 'Project not found'; end if;
    if not luma.work_can_edit(new.project_id) then raise exception 'You can only log time on projects you can change (not as a viewer, and not in an archived company)'; end if;
    new.project_name := v_proj.name; new.label := '';
    new.company_id := case when v_proj.owner_id = new.user_id then v_proj.company_id else null end;
  else
    new.project_name := null; new.task_title := null;
    if new.company_id is null then raise exception 'Choose a company or a project'; end if;
    select owner_id, archived_at into v_co from luma.work_companies where id = new.company_id;
    if not found or v_co.owner_id <> new.user_id then raise exception 'That is not your company'; end if;
    if v_co.archived_at is not null then raise exception 'This company is archived: restore it to log time'; end if;
  end if;
  end if;   -- (stopping a timer, or a task / project being deleted, always works: nothing can get stuck)
  new.note := btrim(new.note); new.label := btrim(coalesce(new.label, ''));
  if new.running_since is not null then new.minutes := 0; end if;
  select coalesce(sum(minutes), 0) into v_other from luma.work_time_entries where user_id = new.user_id and work_date = new.work_date and id is distinct from new.id;
  if v_other + new.minutes > 1440 then raise exception 'A day can not have more than 24 hours logged'; end if;
  new.updated_at := now();
  return new;
end;
$$;

drop function if exists luma.work_timer_start(uuid, uuid, uuid, text);
create or replace function luma.work_timer_start(p_project uuid, p_task uuid, p_company uuid, p_note text, p_label text default '')
returns luma.work_time_entries
language plpgsql
security definer set search_path = ''
as $$
declare v luma.work_time_entries;
begin
  if not luma.has_my_addon('work') then raise exception 'The Work add-on is needed to track time'; end if;
  perform luma.work_timer_stop();
  insert into luma.work_time_entries (project_id, task_id, company_id, note, label, running_since, minutes)
    values (p_project, p_task, p_company, coalesce(p_note, ''), left(coalesce(p_label, ''), 100), now(), 0) returning * into v;
  return v;
end;
$$;
revoke execute on function luma.work_timer_start(uuid, uuid, uuid, text, text) from public, anon;
grant execute on function luma.work_timer_start(uuid, uuid, uuid, text, text) to authenticated;
