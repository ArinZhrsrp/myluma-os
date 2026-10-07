-- ============================================================
-- LUMA — migration 026: notes on tasks (e.g. "waiting for director's approval").
-- Depends on 002 (tasks). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.tasks add column if not exists notes text not null default '' check (length(notes) <= 2000);
