-- ============================================================
-- LUMA — migration 063: purchase history.
--   • luma.purchase_history records every plan and add-on change for a person: free trial started, plan or add-on
--     switched on, time added, switched off, plan ended. It is written by triggers, so it covers the Admin page,
--     trials and the daily expiry job. People can read their own rows and nothing else.
--   • Rows for what people already have are added once, so the list does not start empty.
-- Depends on 044 and 062. Safe to re-run.
-- ============================================================

create table if not exists luma.purchase_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('plan', 'addon')),
  item       text not null,                       -- glow / zenith / dawn, or work / study
  action     text not null check (action in ('trial', 'started', 'extended', 'ended', 'removed')),
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists purchase_history_user_idx on luma.purchase_history (user_id, created_at desc);
alter table luma.purchase_history enable row level security;
drop policy if exists "Read own purchase history" on luma.purchase_history;
create policy "Read own purchase history" on luma.purchase_history for select using (user_id = auth.uid());
grant select on luma.purchase_history to authenticated;

-- add-ons
create or replace function luma.log_addon_history()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_action text; v_was_on boolean;
begin
  if tg_op = 'UPDATE' and new.expires_at is not distinct from old.expires_at and new.started_at is not distinct from old.started_at
     and new.trial_started_at is not distinct from old.trial_started_at then
    return new;
  end if;
  v_was_on := tg_op = 'UPDATE' and (old.expires_at is null or old.expires_at > now());
  if new.expires_at is not null and new.expires_at <= now() then v_action := 'removed';
  elsif new.source = 'trial' and (tg_op = 'INSERT' or new.trial_started_at is distinct from old.trial_started_at) then v_action := 'trial';
  elsif v_was_on then v_action := 'extended';
  else v_action := 'started'; end if;
  insert into luma.purchase_history (user_id, kind, item, action, ends_at) values (new.user_id, 'addon', new.addon, v_action, new.expires_at);
  return new;
end;
$$;
drop trigger if exists log_addon_history on luma.user_addons;
create trigger log_addon_history after insert or update on luma.user_addons
  for each row execute function luma.log_addon_history();

-- plans
create or replace function luma.log_plan_history()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_action text;
begin
  if new.plan is distinct from old.plan then
    if new.plan = 'dawn' then v_action := case when old.plan_expires_at is not null and old.plan_expires_at <= now() then 'ended' else 'removed' end;
    else v_action := 'started'; end if;
  elsif new.plan <> 'dawn' and new.plan_expires_at is distinct from old.plan_expires_at then v_action := 'extended';
  else return new; end if;
  insert into luma.purchase_history (user_id, kind, item, action, ends_at) values (new.id, 'plan', case when new.plan = 'dawn' then old.plan else new.plan end, v_action, new.plan_expires_at);
  return new;
end;
$$;
drop trigger if exists log_plan_history on luma.profiles;
create trigger log_plan_history after update of plan, plan_expires_at on luma.profiles
  for each row execute function luma.log_plan_history();

-- what people already have, once
insert into luma.purchase_history (user_id, kind, item, action, ends_at, created_at)
select a.user_id, 'addon', a.addon, case when a.source = 'trial' then 'trial' else 'started' end, a.expires_at, coalesce(a.started_at, now())
from luma.user_addons a
where not exists (select 1 from luma.purchase_history h where h.user_id = a.user_id and h.kind = 'addon' and h.item = a.addon);
insert into luma.purchase_history (user_id, kind, item, action, ends_at)
select p.id, 'plan', p.plan, 'started', p.plan_expires_at
from luma.profiles p
where p.plan <> 'dawn' and not exists (select 1 from luma.purchase_history h where h.user_id = p.id and h.kind = 'plan');
