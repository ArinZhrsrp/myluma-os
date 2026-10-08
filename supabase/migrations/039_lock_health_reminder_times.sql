-- ============================================================
-- LUMA — migration 039: on the Dawn plan the Health reminder times are fixed (like the other reminder times).
-- Water every 60 min 08:00–22:00, steps and active every 180 min 10:00–20:00, bedtime 23:00, wake-up 07:00, wind-down 30 min before.
-- Glow and Zenith can choose them; the on/off switches work on every plan.
-- Depends on 013 (health_reminders), 015 (active_*), 033 (plans). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function luma.enforce_health_reminder_timing()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if coalesce(luma.limit_of(new.user_id, 'timing'), 1) = 0 and (
       new.water_every_min <> 60 or new.water_from <> '08:00' or new.water_to <> '22:00'
    or new.steps_every_min <> 180 or new.steps_from <> '10:00' or new.steps_to <> '20:00'
    or new.active_every_min <> 180 or new.active_from <> '10:00' or new.active_to <> '20:00'
    or new.bedtime <> '23:00' or new.wake_time <> '07:00' or new.sleep_lead_min <> 30) then
    raise exception 'Plan limit: choosing reminder times is available on Glow and Zenith. You can still switch each reminder on or off.';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_plan_health_reminder_timing on luma.health_reminders;
create trigger enforce_plan_health_reminder_timing before insert or update on luma.health_reminders
  for each row execute function luma.enforce_health_reminder_timing();
