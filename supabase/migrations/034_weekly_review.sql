-- ============================================================
-- LUMA — migration 034: the weekly review (Settings → Preferences → Weekly review).
-- Every Sunday at 18:00 in each user's own time zone, a short summary of their week arrives in the inbox
-- (and as a push). Switched off per user by Settings → Preferences → Weekly review.
-- Depends on 008 (notifications), 014 (pg_cron), 028 (luma.user_tz), 030 (luma.rm_text). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.run_weekly_review()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_now timestamp;
  v_done int;
  v_over int;
  v_spent numeric;
  v_count int := 0;
begin
  for r in select p.id as user_id from luma.profiles p where coalesce(p.preferences ->> 'weekly', 'true') <> 'false' loop
    v_now := timezone(luma.user_tz(r.user_id), now());
    continue when extract(dow from v_now)::int <> 0 or extract(hour from v_now)::int <> 18;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.type = 'weekly_review' and n.created_at > now() - interval '5 days');

    select count(*) into v_done from luma.tasks t where t.user_id = r.user_id and t.completed_at >= now() - interval '7 days';
    select count(*) into v_over from luma.tasks t where t.user_id = r.user_id and t.status <> 'done' and t.due_date < v_now::date;
    select coalesce((select sum(m.amount) from luma.money_entries m where m.user_id = r.user_id and m.kind = 'expense' and m.entry_date > v_now::date - 7), 0)
         + coalesce((select sum(b.amount) from luma.bill_payments b where b.user_id = r.user_id and b.paid_at >= now() - interval '7 days'), 0)
      into v_spent;

    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, 'weekly_review', '📊 Your week in review',
      'You finished ' || v_done || ' task' || case when v_done = 1 then '' else 's' end
      || case when v_over > 0 then ', with ' || v_over || ' still overdue' else '' end
      || ' and spent ' || luma.rm_text(v_spent) || '. Open Analytics for the full picture.',
      'analytics');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_weekly_review() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-weekly-review') then perform cron.unschedule('luma-weekly-review'); end if;
  perform cron.schedule('luma-weekly-review', '5 * * * *', 'select luma.run_weekly_review()');
exception when others then
  raise notice 'Could not schedule the weekly review job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
