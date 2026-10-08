-- ============================================================
-- LUMA — migration 057: delete an archived semester for good.
--   Study → Archive → open a semester → "Delete permanently" removes the semester and everything that belongs to it: its subjects (with
--   their classes and cancelled dates), assignments, notes, the group projects you own in it, and the reminders, events, tasks, notes,
--   habits, goals, bills and money entries you added to it. This cannot be undone. Only an ARCHIVED semester can be deleted.
--   (Uploaded documents are removed by the app first, so their files are deleted too.) Your GPA no longer counts what you delete.
-- Depends on 055, 056. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.delete_study_semester(p_id uuid)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ids uuid[];
  v_counts jsonb := '{}'::jsonb;
  v_n int;
  t text;
begin
  if not exists (select 1 from luma.study_semesters where id = p_id and user_id = auth.uid() and archived_at is not null) then
    raise exception 'Only an archived semester can be deleted';
  end if;
  select coalesce(array_agg(id), '{}') into v_ids from luma.study_courses where semester_id = p_id and user_id = auth.uid();

  delete from luma.study_tasks where user_id = auth.uid() and (semester_id = p_id or course_id = any(v_ids));
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('assignments', v_n);
  delete from luma.study_notes where user_id = auth.uid() and (semester_id = p_id or course_id = any(v_ids));
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('notes', v_n);
  delete from luma.study_projects where owner_id = auth.uid() and semester_id = p_id;
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('group_projects', v_n);

  foreach t in array array['events', 'reminders', 'tasks', 'notes', 'habits', 'goals', 'bills', 'money_entries'] loop
    execute format('delete from luma.%I where user_id = auth.uid() and semester_id = $1', t) using p_id;
    get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object(t, v_n);
  end loop;
  update luma.documents set semester_id = null where user_id = auth.uid() and semester_id = p_id;   -- any file the app did not remove stays, unlinked

  delete from luma.study_courses where semester_id = p_id and user_id = auth.uid();   -- also removes their classes and cancelled dates
  get diagnostics v_n = row_count; v_counts := v_counts || jsonb_build_object('subjects', v_n);
  delete from luma.study_semesters where id = p_id and user_id = auth.uid();
  return v_counts;
end;
$$;
revoke execute on function luma.delete_study_semester(uuid) from public, anon;
grant execute on function luma.delete_study_semester(uuid) to authenticated;
