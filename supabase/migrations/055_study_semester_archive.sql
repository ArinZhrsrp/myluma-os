-- ============================================================
-- LUMA — migration 055: archive a whole semester.
--   • study_semesters.archived_at — set when you tick "Done with this semester": the semester, its subjects (already archived by the
--     app), classes and assignments move to the Study → Archive page, where you can open each archived semester and see everything.
--   • Nothing is deleted. Restoring a semester clears archived_at (and the app un-archives its subjects).
-- Depends on 049. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.study_semesters add column if not exists archived_at timestamptz;
