-- ============================================================
-- LUMA — migration 090: saving a feedback twice at the same moment told the person twice.
--   The row is now locked while it is saved, so only the first save sees the status change and sends the notification.
-- Depends on 081. Safe to re-run.
-- ============================================================
create or replace function luma.admin_feedback_update(p_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare v_f record;
begin
  if not luma.is_admin() then raise exception 'Not allowed'; end if;
  if p_status not in ('new', 'seen', 'planned', 'done', 'wontfix') then raise exception 'Unknown status'; end if;
  select * into v_f from luma.feedback where id = p_id for update;
  if not found then raise exception 'Not found'; end if;
  update luma.feedback set status = p_status, admin_note = left(coalesce(p_note, ''), 1000), handled_by = auth.uid(), updated_at = now() where id = p_id;
  if v_f.user_id is not null and p_status in ('planned', 'done') and p_status <> v_f.status then
    perform luma.notify(v_f.user_id, 'feedback_reply', case when p_status = 'done' then '✅ Your feedback was done: ' else '🗓 Your feedback is planned: ' end || v_f.module, coalesce(nullif(btrim(p_note), ''), left(v_f.message, 100)), 'feedback', p_id);
  end if;
end;
$$;
revoke execute on function luma.admin_feedback_update(uuid, text, text) from public, anon;
grant execute on function luma.admin_feedback_update(uuid, text, text) to authenticated;
