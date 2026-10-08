-- ============================================================
-- LUMA — migration 061: a grade scale per semester or per subject.
--   • study_semesters.grade_scale / study_courses.grade_scale: optional JSON list of [minimum %, letter, GPA points] rows.
--     A subject uses its own scale, else its semester's, else your account-wide scale (Settings kept in your profile), else the standard one.
-- Depends on 049. Safe to re-run. Run in Supabase Dashboard → SQL Editor.
-- ============================================================

alter table luma.study_semesters add column if not exists grade_scale jsonb;
alter table luma.study_courses add column if not exists grade_scale jsonb;
alter table luma.study_semesters drop constraint if exists study_semesters_grade_scale_check;
alter table luma.study_semesters add constraint study_semesters_grade_scale_check check (grade_scale is null or (jsonb_typeof(grade_scale) = 'array' and jsonb_array_length(grade_scale) between 2 and 20));
alter table luma.study_courses drop constraint if exists study_courses_grade_scale_check;
alter table luma.study_courses add constraint study_courses_grade_scale_check check (grade_scale is null or (jsonb_typeof(grade_scale) = 'array' and jsonb_array_length(grade_scale) between 2 and 20));
