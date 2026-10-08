-- ============================================================
-- LUMA — migration 035: Settings → Reminders gets Habits, Health and an adjustable budget warning.
--   • reminder_prefs.habit_on / health_on switch the habit and health reminders on or off for everyone's account
--     (the times are still set per habit and on the Health page).
--   • reminder_prefs.budget_pct: warn at 70 / 80 / 90 % of the monthly budget (default 80).
-- Depends on 031 (reminder_prefs), 030 (luma.rm_text), 008 (notifications). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.reminder_prefs add column if not exists habit_on boolean not null default true;
alter table luma.reminder_prefs add column if not exists health_on boolean not null default true;
alter table luma.reminder_prefs add column if not exists budget_pct integer not null default 80;
alter table luma.reminder_prefs drop constraint if exists reminder_prefs_budget_pct_check;
alter table luma.reminder_prefs add constraint reminder_prefs_budget_pct_check check (budget_pct between 50 and 100);

-- Muted reminders never reach the inbox (so no push either): this covers the health reminders the app creates itself
-- as well as the ones the server creates on a schedule.
create or replace function luma.skip_muted_reminders()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_habit boolean;
  v_health boolean;
begin
  if new.type = 'reminder_habit' or new.type in ('reminder_water', 'reminder_steps', 'reminder_active', 'reminder_sleep') then
    select coalesce(bool_and(p.habit_on), true), coalesce(bool_and(p.health_on), true) into v_habit, v_health
      from luma.reminder_prefs p where p.user_id = new.user_id;
    if (new.type = 'reminder_habit' and not v_habit) or (new.type <> 'reminder_habit' and not v_health) then
      return null;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists skip_muted_reminders on luma.notifications;
create trigger skip_muted_reminders before insert on luma.notifications
  for each row execute function luma.skip_muted_reminders();

-- budget alerts now use the user's own percentage
create or replace function luma.run_budget_alerts()
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  r record;
  v_tz text;
  v_first date;
  v_from timestamptz;
  v_to timestamptz;
  v_spent numeric;
  v_type text;
  v_on boolean;
  v_pct int;
  v_count int := 0;
begin
  for r in select s.user_id, s.monthly_budget from luma.money_settings s where s.monthly_budget > 0 loop
    select coalesce(bool_and(p.budget_on), true), coalesce(max(p.budget_pct), 80) into v_on, v_pct from luma.reminder_prefs p where p.user_id = r.user_id;
    continue when not v_on;
    v_tz := luma.user_tz(r.user_id);
    v_first := date_trunc('month', timezone(v_tz, now()))::date;
    v_from := v_first::timestamp at time zone v_tz;
    v_to := (v_first + interval '1 month')::timestamp at time zone v_tz;
    select coalesce((select sum(amount) from luma.money_entries where user_id = r.user_id and kind = 'expense' and entry_date >= v_first and entry_date < (v_first + interval '1 month')::date), 0)
         + coalesce((select sum(amount) from luma.bill_payments where user_id = r.user_id and paid_at >= v_from and paid_at < v_to), 0)
      into v_spent;
    v_type := case when v_spent >= r.monthly_budget then 'budget_over' when v_spent >= r.monthly_budget * v_pct / 100.0 then 'budget_warn' else null end;
    continue when v_type is null;
    continue when exists (select 1 from luma.notifications n where n.user_id = r.user_id and n.type = v_type and n.created_at >= v_from);
    insert into luma.notifications (user_id, type, title, body, link)
    values (r.user_id, v_type,
      case v_type when 'budget_over' then '⚠️ You are over your monthly budget' else '💸 You have used ' || v_pct || '% of your monthly budget' end,
      'Spent ' || luma.rm_text(v_spent) || ' of ' || luma.rm_text(r.monthly_budget) || ' this month.', 'money');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke execute on function luma.run_budget_alerts() from public, anon, authenticated;
