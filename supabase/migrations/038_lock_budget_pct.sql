-- ============================================================
-- LUMA — migration 038: on the Dawn plan the budget warning level is fixed at 80 %, like the reminder times.
-- (Glow and Zenith can choose it.) Replaces the check from 033 so it also covers reminder_prefs.budget_pct (035).
-- Depends on 033 and 035. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.enforce_reminder_timing()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(luma.limit_of(new.user_id, 'timing'), 1) = 0 and (
       new.event_lead_min <> 15 or new.allday_hour <> 8 or new.task_hour <> 9 or new.bill_hour <> 9 or new.bill_days <> 3
    or new.sub_hour <> 9 or new.sub_days <> 3 or new.goal_hour <> 9 or new.goal_days <> 3 or new.budget_pct <> 80) then
    raise exception 'Plan limit: choosing reminder times and the budget warning level is available on Glow and Zenith. You can still switch each reminder on or off.';
  end if;
  return new;
end;
$$;
