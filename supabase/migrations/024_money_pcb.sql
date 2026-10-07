-- ============================================================
-- LUMA — migration 024: use the PCB amount from your own payslip.
-- Depends on 023 (money_settings). Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

-- null = let the app estimate PCB; a number (including 0) = use exactly what your payslip deducts
alter table luma.money_settings add column if not exists pcb_override numeric check (pcb_override is null or pcb_override >= 0);
