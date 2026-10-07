-- ============================================================
-- LUMA — migration 021: pause a bill / subscription.
-- Depends on 020 (bills). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- A subscription is a bill in the 'Subscription' category, so it shows on both the Bills and Subscriptions pages.
-- active = false pauses it: it stays on the Subscriptions page (greyed out) but no longer appears in Bills or its totals.
alter table luma.bills add column if not exists active boolean not null default true;
