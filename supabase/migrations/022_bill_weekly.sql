-- ============================================================
-- LUMA — migration 022: weekly bills / subscriptions.
-- Depends on 020 (bills). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- a weekly bill is due every 7 days starting from its (first) due date
alter table luma.bills drop constraint if exists bills_recurrence_check;
alter table luma.bills add constraint bills_recurrence_check check (recurrence in ('once', 'weekly', 'monthly', 'yearly'));
