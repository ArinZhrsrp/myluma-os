-- ============================================================
-- LUMA — migration 043: six more built-in wallpapers (11 in total). Glow and Zenith can use all of them; Dawn keeps 2.
-- Depends on 033. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

update luma.plan_limits set value = 11 where key = 'wallpapers' and plan in ('glow', 'zenith');
