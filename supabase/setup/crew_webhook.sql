-- ============================================================
-- LUMA — start the AI crew for every new feedback or support message.
-- Run this ONCE PER SUPABASE PROJECT (staging and production each) in Supabase → SQL Editor, after:
--   • migration 101_feedback_crew.sql has run
--   • the function is deployed:  ./scripts/deploy-functions.sh staging   (or prod)
--   • its secrets are set (see the top of supabase/functions/feedback-crew/index.ts)
--
-- It uses the SAME WEBHOOK_SECRET as push (supabase/setup/push_webhook.sql), so fill in the same two values.
-- Fill in the two values marked  <<< CHANGE ME >>>  (keep the 'single quotes' around them), then run the whole file.
-- To stop the crew at any time:  drop trigger if exists crew_on_feedback on luma.feedback;
-- ============================================================

create extension if not exists pg_net;

create or replace function luma.crew_webhook()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_ref text;
  v_secret text;
begin
  -- the two values are set INSIDE begin … exception, so a typo here (for example "double quotes" instead of
  -- 'single quotes') can never stop a feedback from being saved: the crew just doesn't start
  -- <<< CHANGE ME >>> your project's reference (the code in https://<REF>.supabase.co), in 'single quotes'
  v_ref := 'YOUR-PROJECT-REF';
  -- <<< CHANGE ME >>> exactly the same text as the WEBHOOK_SECRET you set for the functions, in 'single quotes'
  v_secret := 'YOUR-WEBHOOK-SECRET';
  perform net.http_post(
    url := 'https://' || v_ref || '.supabase.co/functions/v1/feedback-crew',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('type', 'INSERT', 'table', 'feedback', 'schema', 'luma', 'record', jsonb_build_object('id', new.id))
  );
  return new;
exception when others then
  raise warning 'feedback crew webhook skipped: %', sqlerrm;   -- shows in the database logs
  return new;   -- the crew must never stop feedback from being saved
end;
$$;
revoke execute on function luma.crew_webhook() from public, anon, authenticated;

drop trigger if exists crew_on_feedback on luma.feedback;
create trigger crew_on_feedback
  after insert on luma.feedback
  for each row execute function luma.crew_webhook();

-- test: send a feedback from the app (or Support → Send us a message), then watch
--   Supabase → Edge Functions → feedback-crew → Logs, and:  select status, category, severity, summary from luma.crew_runs order by created_at desc limit 5;
