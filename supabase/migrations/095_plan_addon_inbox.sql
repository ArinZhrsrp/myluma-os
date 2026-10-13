-- ============================================================
-- LUMA — migration 095: every plan and add-on change reaches the person's notification inbox.
--   Before: an administrator got no inbox message when changing their OWN plan or add-ons, and switching an add-on OFF
--   sent no message until the daily check ran (the live toast and the push were all the person got).
--   Now, whoever makes the change:
--     • an add-on switched ON for yourself            → "🎉 Study mode is on"            (for other people the admin tool already sends it)
--     • an add-on switched OFF                        → "Your Study add-on has ended"    (same title the daily check uses, so it is not sent twice)
--     • your own plan changed by an administrator     → "🎉 Your plan is now Glow"       (for other people the admin tool already sends it)
--   Every notification row is also what sends the push, so the push and the inbox always match.
-- Depends on 044, 062, 083. Safe to re-run.
-- ============================================================

create or replace function luma.addon_change_inbox()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare v_name text := initcap(new.addon) || case when new.addon = 'work' and new.tier = 'pro' then ' Pro' else '' end; v_was_on boolean; v_on boolean;
begin
  v_on := new.expires_at is null or new.expires_at > now();
  if tg_op = 'UPDATE' then v_was_on := old.expires_at is null or old.expires_at > now(); else v_was_on := false; end if;

  if not v_on and v_was_on then -- switched off (or ended)
    perform luma.notify(new.user_id, 'system', 'Your ' || initcap(new.addon) || ' add-on has ended',
      'Everything you made is kept, but you can not add new ' || initcap(new.addon) || ' items until it is switched on again.', 'settings');
  elsif v_on and not v_was_on and new.source = 'admin' and auth.uid() is not distinct from new.user_id and luma.is_admin() then -- an administrator switched it on for themselves
    perform luma.notify(new.user_id, 'system', '🎉 ' || v_name || ' mode is on',
      'The ' || v_name || ' add-on is active' || case when new.expires_at is null then '.' else ' until ' || to_char(new.expires_at at time zone luma.user_tz(new.user_id), 'FMDD Mon YYYY') || '.' end || ' Switch to it at the top of the menu.', 'dashboard');
  end if;
  return null;
end;
$$;
drop trigger if exists addon_change_inbox on luma.user_addons;
create trigger addon_change_inbox after insert or update of expires_at on luma.user_addons for each row execute function luma.addon_change_inbox();

create or replace function luma.plan_change_inbox()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- only when an administrator changes their own plan (for everyone else the admin tool sends this message itself)
  if new.id is not distinct from auth.uid() and current_setting('luma.allow_plan_change', true) = 'on'
     and (old.plan is distinct from new.plan or old.plan_expires_at is distinct from new.plan_expires_at) and luma.is_admin() then
    perform luma.notify(new.id, 'system', '🎉 Your plan is now ' || initcap(new.plan),
      case when new.plan = 'dawn' then 'You are on the free Dawn plan.'
           else 'Your new limits are active' || case when new.plan_expires_at is null then '.' else ' until ' || to_char(new.plan_expires_at at time zone luma.user_tz(new.id), 'FMDD Mon YYYY') || '.' end end, 'settings');
  end if;
  return null;
end;
$$;
drop trigger if exists plan_change_inbox on luma.profiles;
create trigger plan_change_inbox after update of plan, plan_expires_at on luma.profiles for each row execute function luma.plan_change_inbox();
