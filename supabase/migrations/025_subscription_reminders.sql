-- ============================================================
-- LUMA — migration 025: remind me 3 days before a subscription renews.
-- Depends on 008/009 (notifications), 020 (bills), 021 (bills.active), 022 (weekly) and pg_cron (see 014).
-- Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- Runs once a day at 09:00 Malaysia time. For every ACTIVE subscription (a bill in the 'Subscription' category) whose
-- renewal date is exactly 3 days away it creates a 'reminder_subscription' notification — which the send-push webhook
-- then delivers to your devices. Paused subscriptions, and renewals already ticked as paid, are skipped.
create or replace function luma.run_subscription_reminders()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  b record;
  v_target date := (timezone('Asia/Kuala_Lumpur', now()))::date + 3;
  v_last int := extract(day from (date_trunc('month', v_target) + interval '1 month - 1 day'))::int;
  v_count int := 0;
begin
  for b in
    select * from luma.bills s
    where s.category = 'Subscription'
      and s.active
      and (
        (s.recurrence = 'once' and s.due_date = v_target)
        or (s.recurrence = 'weekly' and v_target >= s.due_date and (v_target - s.due_date) % 7 = 0)
        or (s.recurrence = 'monthly' and v_target >= s.due_date
            and extract(day from v_target)::int = least(extract(day from s.due_date)::int, v_last))
        or (s.recurrence = 'yearly' and v_target >= s.due_date
            and extract(month from v_target) = extract(month from s.due_date)
            and extract(day from v_target)::int = least(extract(day from s.due_date)::int, v_last))
      )
      and not exists (select 1 from luma.bill_payments p where p.bill_id = s.id and p.due_date = v_target)
      and not exists (
        select 1 from luma.notifications n
        where n.user_id = s.user_id and n.type = 'reminder_subscription' and n.ref = s.id and n.created_at > now() - interval '12 hours'
      )
  loop
    insert into luma.notifications (user_id, type, title, body, link, ref)
    values (
      b.user_id, 'reminder_subscription',
      '🔔 ' || b.name || ' renews in 3 days',
      'RM' || trim(trailing '.' from trim(trailing '0' from b.amount::numeric(12,2)::text)) || ' on ' || to_char(v_target, 'DD Mon') || '. Pause it in Subscriptions if you no longer need it.',
      'subscriptions', b.id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_subscription_reminders() from public, anon, authenticated;

-- schedule it daily at 01:00 UTC = 09:00 Malaysia time (needs the pg_cron extension, same as the other reminder jobs)
do $$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'luma-subscription-reminders') then
    perform cron.unschedule('luma-subscription-reminders');
  end if;
  perform cron.schedule('luma-subscription-reminders', '0 1 * * *', 'select luma.run_subscription_reminders()');
exception when others then
  raise notice 'Could not schedule the subscription reminder job (%). Enable pg_cron under Database → Extensions, then re-run this file.', sqlerrm;
end $$;
