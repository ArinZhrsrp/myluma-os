-- ============================================================
-- LUMA — migration 066: repeating tasks and task checklists.
--   • tasks.repeat: none | daily | weekdays | weekly | monthly | yearly. When a repeating task is finished, the next one
--     is created automatically (same title, priority, tag, notes, checklist unticked), due on the next date AFTER today.
--   • tasks.checklist: a list of small steps, each { "t": text, "d": done } (up to 30).
-- Depends on 002, 026, 050, 056. Safe to re-run.
-- ============================================================

alter table luma.tasks add column if not exists repeat text not null default 'none';
alter table luma.tasks drop constraint if exists tasks_repeat_check;
alter table luma.tasks add constraint tasks_repeat_check check (repeat in ('none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'));
alter table luma.tasks add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table luma.tasks drop constraint if exists tasks_checklist_check;
alter table luma.tasks add constraint tasks_checklist_check check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 30);
alter table luma.tasks add column if not exists next_spawned_at timestamptz;   -- set once the next repeat was made, so reopening and finishing again does not make a second one

-- the date of the next repeat: the first date after both the old due date and today
create or replace function luma.next_task_date(p_due date, p_repeat text, p_today date)
returns date
language plpgsql
immutable
as $$
declare d date := coalesce(p_due, p_today); n int := 0;
begin
  loop
    n := n + 1;
    d := case p_repeat
      when 'daily' then d + 1
      when 'weekdays' then case extract(dow from d)::int when 5 then d + 3 when 6 then d + 2 else d + 1 end
      when 'weekly' then d + 7
      when 'monthly' then (d + interval '1 month')::date
      when 'yearly' then (d + interval '1 year')::date
      else null end;
    exit when d is null or d > p_today or n > 400;
  end loop;
  return d;
end;
$$;

create or replace function luma.spawn_next_task()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_next date; v_today date;
begin
  if new.status = 'done' and old.status <> 'done' and new.repeat <> 'none' and new.next_spawned_at is null then
    v_today := (now() at time zone luma.user_tz(new.user_id))::date;
    v_next := luma.next_task_date(new.due_date, new.repeat, v_today);
    if v_next is not null then
     begin
      insert into luma.tasks (user_id, title, status, priority, tag, due_date, notes, repeat, checklist, space, semester_id)
        values (new.user_id, new.title, 'todo', new.priority, new.tag, v_next, new.notes, new.repeat,
                coalesce((select jsonb_agg(jsonb_set(x, '{d}', 'false'::jsonb)) from jsonb_array_elements(new.checklist) x), '[]'::jsonb), new.space, new.semester_id);
      update luma.tasks set next_spawned_at = now() where id = new.id;
     exception when others then
      raise notice 'Could not make the next repeat of a task (%)', sqlerrm;   -- e.g. a Study task while no semester is active: finishing the task must still work
     end;
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists spawn_next_task on luma.tasks;
create trigger spawn_next_task after update of status on luma.tasks
  for each row execute function luma.spawn_next_task();
