-- ============================================================
-- LUMA — migration 043: six more built-in wallpapers (11 in total). Dawn can use 4, Glow 8, Zenith all 11 (and upload its own).
-- Depends on 033. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

update luma.plan_limits set value = 4 where key = 'wallpapers' and plan = 'dawn';
update luma.plan_limits set value = 8 where key = 'wallpapers' and plan = 'glow';
update luma.plan_limits set value = 11 where key = 'wallpapers' and plan = 'zenith';
