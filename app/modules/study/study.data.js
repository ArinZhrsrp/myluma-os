// LUMA — Supabase helpers for the Study add-on. Depends on luma-auth.js (reuses its client).
// Requires supabase/migrations/044_addons.sql and 045_study.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COURSE = "id, name, code, color, lecturer, credit_hours, archived, created_at";
  const CLASS = "id, course_id, weekday, start_time, end_time, room, kind, created_at";
  const TASK = "id, course_id, title, kind, due_date, due_time, weight, score, max_score, status, notes, completed_at, created_at";

  // the same four calls for each table; user_id defaults to auth.uid() in the database
  const table = (name, cols, order) => ({
    list: () => db().from(name).select(cols).order(order, { ascending: true }),
    add: (fields) => db().from(name).insert(fields).select(cols).single(),
    addMany: (rows) => db().from(name).insert(rows).select(cols),
    update: (id, fields) => db().from(name).update(fields).eq("id", id).select(cols).single(),
    remove: (id) => db().from(name).delete().eq("id", id),
  });

  window.LumaStudy = {
    courses: table("study_courses", COURSE, "created_at"),
    classes: table("study_classes", CLASS, "start_time"),
    tasks: table("study_tasks", TASK, "due_date"),
    // focus sessions tagged with a subject since a moment (for "study time")
    focusSince: (iso) => db().from("focus_sessions").select("minutes, course_id, started_at").gte("started_at", iso),
  };
})();
