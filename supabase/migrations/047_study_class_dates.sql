-- ============================================================
-- LUMA — migration 047: a timetable class can run for a set period (a semester, a few months) instead of every week forever.
--   • study_classes.start_date / end_date: the class happens on its weekday only between these dates (inclusive).
--     Both empty (older classes) = every week, no end.
-- Depends on 045. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.study_classes add column if not exists start_date date;
alter table luma.study_classes add column if not exists end_date date;
alter table luma.study_classes drop constraint if exists study_classes_dates_check;
alter table luma.study_classes add constraint study_classes_dates_check check (end_date is null or start_date is null or end_date >= start_date);
