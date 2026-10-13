-- ============================================================
-- LUMA — migration 096: luma.my_usage() tells the app how much of each plan limit the signed-in person has used,
--   so every page can show "3 / 5 habits", "20.4 / 50 MB" and so on. The counts follow the same rules as the limits themselves (033, 037, 029).
-- Depends on 029, 033, 037. Safe to re-run.
-- ============================================================
create or replace function luma.my_usage()
returns jsonb
language plpgsql
stable
security definer set search_path = ''
as $$
declare v uuid := auth.uid(); v_day date;
begin
  if v is null then raise exception 'not signed in'; end if;
  v_day := (timezone(luma.user_tz(v), now()))::date;
  return jsonb_build_object(
    'storage_bytes', coalesce((select sum(d.size_bytes) from luma.documents d where d.user_id = v), 0),
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
