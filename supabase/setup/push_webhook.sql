-- ============================================================
-- LUMA — connect notifications to push delivery WITHOUT the dashboard's Webhooks screen.
-- Run this ONCE PER SUPABASE PROJECT (staging and production each) in Supabase → SQL Editor, after:
--   • the send-push function is deployed:  ./scripts/deploy-functions.sh staging   (or prod)
--   • the secret is set:  npx supabase secrets set WEBHOOK_SECRET=<the same text you put below> --project-ref <REF>
--
-- Fill in the two values marked  <<< CHANGE ME >>>  then run the whole file.
-- It does the same thing as a "Database Webhook": every new row in luma.notifications is sent to the send-push function,
-- which pushes it to the person's devices.
-- ============================================================

create extension if not exists pg_net;

create or replace function luma.send_push_webhook()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  -- <<< CHANGE ME >>> your project's reference (the code in https://<REF>.supabase.co)
  v_ref text := 'YOUR-PROJECT-REF';
  -- <<< CHANGE ME >>> exactly the same text as the WEBHOOK_SECRET you set for the functions
  v_secret text := 'YOUR-WEBHOOK-SECRET';
begin
  perform net.http_post(
    url := 'https://' || v_ref || '.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('type', 'INSERT', 'table', 'notifications', 'schema', 'luma', 'record', to_jsonb(new))
  );
  return new;
exception when others then
  return new;   -- a push problem must never stop a notification from being saved
end;
$$;
revoke execute on function luma.send_push_webhook() from public, anon, authenticated;

drop trigger if exists send_push_on_notification on luma.notifications;
create trigger send_push_on_notification
  after insert on luma.notifications
  for each row execute function luma.send_push_webhook();

-- test: after running this file, create a test notification for yourself and check the function's logs
-- (Supabase → Edge Functions → send-push → Logs). Example (replace the email):
--   select luma.notify((select id from auth.users where email = 'you@example.com'), 'system', 'Test push', 'It works', 'dashboard');
