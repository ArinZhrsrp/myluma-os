-- ============================================================
-- LUMA — migration 101: an AI crew takes the first look at every new feedback and support message.
--   • luma.crew_runs: one row per look at a feedback. The lead agent sorts it (bug / idea / question / praise / complaint),
--     says how urgent it is, spots a duplicate, and at the end leaves a summary, the likely cause and a fix (for bugs),
--     a suggested status and a draft reply for the person. Nothing is sent to the person and the feedback's own status
--     is never changed: an administrator reads it in the Feedback inbox and decides.
--   • luma.crew_steps: one row per teammate's piece of work in a run (Engineer, Support, Product), with what it wrote.
--   • Only administrators can read either table. Only the feedback-crew Edge Function writes them (service role).
--   • When a run finishes, every administrator gets a notification that opens the Feedback inbox.
--   • Both tables are in Supabase Realtime so the inbox updates while the crew works.
-- The trigger that starts the crew for each new feedback lives in supabase/setup/crew_webhook.sql (it holds a secret).
-- Depends on 081 (feedback), 036 (admin), 064 (notify with a ref). Safe to re-run.
-- ============================================================

create table if not exists luma.crew_runs (
  id               uuid primary key default gen_random_uuid(),
  feedback_id      uuid not null references luma.feedback (id) on delete cascade,
  status           text not null default 'queued' check (status in ('queued', 'triaging', 'working', 'merging', 'done', 'failed')),
  started_by       text not null default 'webhook' check (started_by in ('webhook', 'admin')),
  category         text check (category is null or category in ('bug', 'idea', 'question', 'praise', 'complaint')),
  severity         text check (severity is null or severity in ('low', 'medium', 'high', 'urgent')),
  summary          text not null default '' check (length(summary) <= 2000),
  likely_cause     text not null default '' check (length(likely_cause) <= 4000),
  suggested_fix    text not null default '' check (length(suggested_fix) <= 6000),
  draft_reply      text not null default '' check (length(draft_reply) <= 1000),
  suggested_status text check (suggested_status is null or suggested_status in ('new', 'seen', 'planned', 'done', 'wontfix')),
  duplicate_of     uuid references luma.feedback (id) on delete set null,
  model            text not null default '',
  error            text not null default '' check (length(error) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  finished_at      timestamptz
);
create index if not exists crew_runs_feedback_idx on luma.crew_runs (feedback_id, created_at desc);

create table if not exists luma.crew_steps (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references luma.crew_runs (id) on delete cascade,
  agent       text not null check (agent in ('engineer', 'support', 'product')),
  task        text not null default '' check (length(task) <= 2000),
  status      text not null default 'working' check (status in ('working', 'done', 'failed')),
  output      text not null default '' check (length(output) <= 12000),
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists crew_steps_run_idx on luma.crew_steps (run_id, started_at);

alter table luma.crew_runs enable row level security;
alter table luma.crew_steps enable row level security;
drop policy if exists crew_runs_read on luma.crew_runs;
drop policy if exists crew_steps_read on luma.crew_steps;
create policy crew_runs_read on luma.crew_runs for select to authenticated using (luma.is_admin());
create policy crew_steps_read on luma.crew_steps for select to authenticated using (luma.is_admin());
revoke all on luma.crew_runs, luma.crew_steps from anon, authenticated;
grant select on luma.crew_runs, luma.crew_steps to authenticated;
-- the Edge Function works as the service role
grant usage on schema luma to service_role;
grant select, insert, update on luma.crew_runs, luma.crew_steps to service_role;
grant select on luma.feedback, luma.feedback_replies to service_role;

-- keep updated_at honest, and stamp finished_at once
create or replace function luma.crew_runs_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status in ('done', 'failed') and new.finished_at is null then new.finished_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists crew_runs_touch on luma.crew_runs;
create trigger crew_runs_touch before update on luma.crew_runs for each row execute function luma.crew_runs_touch();

-- every administrator is told when the crew finishes (up to 20), and it opens the Feedback inbox at that feedback
create or replace function luma.crew_runs_notify()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_a uuid; v_f record; v_title text;
begin
  if new.status <> 'done' or old.status = 'done' then return null; end if;
  select module, part into v_f from luma.feedback where id = new.feedback_id;
  if not found then return null; end if;
  v_title := '🤖 Crew looked at: ' || v_f.module || case when v_f.part <> '' then ' › ' || v_f.part else '' end
          || case when new.severity in ('high', 'urgent') then ' (' || new.severity || ')' else '' end;
  for v_a in select a.user_id from luma.admin_users a limit 20 loop
    perform luma.notify(v_a, 'feedback', v_title, left(coalesce(nullif(new.summary, ''), 'Open the inbox to see what the crew found.'), 160), 'adminfeedback', new.feedback_id);
  end loop;
  return null;
end;
$$;
drop trigger if exists crew_runs_notify on luma.crew_runs;
create trigger crew_runs_notify after update on luma.crew_runs for each row execute function luma.crew_runs_notify();

-- live updates in the inbox (row-level security still limits them to administrators)
do $$
declare t text;
begin
  foreach t in array array['crew_runs', 'crew_steps'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'luma' and tablename = t) then
      execute format('alter publication supabase_realtime add table luma.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
