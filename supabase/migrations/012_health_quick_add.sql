-- ============================================================
-- LUMA — migration 012: configurable quick-add amounts for the Health rings.
-- Depends on 011 (health_goals). Safe to re-run.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- How much each one-tap "+" button on the Health page adds. Stored with the
-- goals (one row per user); the app falls back to the defaults below until
-- this migration has been run.
alter table luma.health_goals add column if not exists quick_sleep_hours numeric(3,1) not null default 0.5;
alter table luma.health_goals add column if not exists quick_water_ml integer not null default 250;
alter table luma.health_goals add column if not exists quick_steps integer not null default 500;
alter table luma.health_goals add column if not exists quick_active_minutes integer not null default 10;

alter table luma.health_goals drop constraint if exists health_goals_quick_ranges;
alter table luma.health_goals add constraint health_goals_quick_ranges check (
  quick_sleep_hours > 0 and quick_sleep_hours <= 12
  and quick_water_ml > 0 and quick_water_ml <= 5000
  and quick_steps > 0 and quick_steps <= 20000
  and quick_active_minutes > 0 and quick_active_minutes <= 600
);
