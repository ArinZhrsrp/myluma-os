-- ============================================================
-- LUMA — migration 017: habits that repeat daily / weekly / monthly, measurable
-- habits (e.g. "5 pages", "30 min") and a sleep habit read from Health.
-- Depends on 016 (habits). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- daily = every day you pick (the `days` column); weekly / monthly = `per_period` times per week / month
alter table luma.habits add column if not exists period text not null default 'daily' check (period in ('daily', 'weekly', 'monthly'));
alter table luma.habits add column if not exists per_period smallint not null default 1 check (per_period between 1 and 31);
-- measurable habit: it counts as done on a day once the logged amount reaches goal_value (unit is just a label)
alter table luma.habits add column if not exists goal_value numeric check (goal_value > 0);
alter table luma.habits add column if not exists unit text not null default '' check (length(unit) <= 20);
-- 'sleep' = done automatically on days the Health sleep log reaches goal_value hours
alter table luma.habits add column if not exists source text not null default 'manual' check (source in ('manual', 'sleep'));

-- the amount done that day (only for measurable habits)
alter table luma.habit_logs add column if not exists value numeric check (value >= 0);
