-- ============================================================
-- LUMA — migration 098: the storage split follows the space a file was added in (Personal / Study / Work).
--   Files added while in Study mode (or Work mode) are kept apart from the personal Documents page, but they all share ONE storage
--   allowance. 097 only recognised files attached to Study notes / group projects / Work tasks; this version also counts every file whose
--   space is 'study' or 'work' (the Personal / Study / Work separator from migration 050).
-- Replaces luma.my_usage() from 096 / 097. Depends on 050, 058, 075. Safe to re-run.
-- ============================================================
create or replace function luma.my_usage()
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare v uuid := auth.uid(); v_day date; v_total bigint; v_work bigint; v_study bigint;
begin
  if v is null then raise exception 'not signed in'; end if;
  v_day := (timezone(luma.user_tz(v), now()))::date;
  select coalesce(sum(d.size_bytes), 0) into v_total from luma.documents d where d.user_id = v;
  select coalesce(sum(d.size_bytes), 0) into v_work from luma.documents d
    where d.user_id = v and (d.space = 'work' or exists (select 1 from luma.work_task_files f where f.document_id = d.id));
  select coalesce(sum(d.size_bytes), 0) into v_study from luma.documents d
    where d.user_id = v and d.space <> 'work' and not exists (select 1 from luma.work_task_files f where f.document_id = d.id)
      and (d.space = 'study' or exists (select 1 from luma.study_project_files f where f.document_id = d.id) or exists (select 1 from luma.study_note_files f where f.document_id = d.id));
  return jsonb_build_object(
    'storage_bytes', v_total, 'storage_work', v_work, 'storage_study', v_study, 'storage_docs', v_total - v_work - v_study,
    'reminders', (select count(*) from luma.reminders r where r.user_id = v),
    'habits', (select count(*) from luma.habits h where h.user_id = v and not h.archived),
    'goals', (select count(*) from luma.goals g where g.user_id = v and g.completed_at is null),
    'bills', (select count(*) from luma.bills b where b.user_id = v),
    'contacts', (select count(*) from luma.contacts c where not c.admin_chat
                   and ((c.status = 'accepted' and (c.requester_id = v or c.addressee_id = v)) or (c.status = 'pending' and c.requester_id = v))),
    'chat_today', luma.messages_sent_today(v),
    'lumi_used', coalesce((select u.used from luma.assistant_usage u where u.user_id = v and u.day = v_day and u.kind = 'chat'), 0),
    'insights_used', coalesce((select u.used from luma.assistant_usage u where u.user_id = v and u.day = v_day and u.kind = 'insights'), 0));
end;
$$;
revoke execute on function luma.my_usage() from public, anon;
grant execute on function luma.my_usage() to authenticated;
