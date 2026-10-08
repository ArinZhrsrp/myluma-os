// LUMA — Supabase helpers for the Study add-on. Depends on luma-auth.js (reuses its client).
// Requires supabase/migrations/044_addons.sql and 045_study.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COURSE = "id, name, code, color, lecturer, credit_hours, archived, created_at";
  const CLASS_BASE = "id, course_id, weekday, start_time, end_time, room, kind, created_at";
  const CLASS = CLASS_BASE + ", start_date, end_date"; // the dates come from migration 047 — fall back to the base columns until it has run
  const NO_DATES = /start_date|end_date|schema cache/i;
  const noDates = (f) => { const g = { ...f }; delete g.start_date; delete g.end_date; return g; };
  const classes = {
    async list() { const r = await db().from("study_classes").select(CLASS).order("start_time", { ascending: true }); return r.error && NO_DATES.test(r.error.message) ? db().from("study_classes").select(CLASS_BASE).order("start_time", { ascending: true }) : r; },
    async addMany(rows) { const r = await db().from("study_classes").insert(rows).select(CLASS); return r.error && NO_DATES.test(r.error.message) ? db().from("study_classes").insert(rows.map(noDates)).select(CLASS_BASE) : r; },
    async update(id, f) { const r = await db().from("study_classes").update(f).eq("id", id).select(CLASS).single(); return r.error && NO_DATES.test(r.error.message) ? db().from("study_classes").update(noDates(f)).eq("id", id).select(CLASS_BASE).single() : r; },
    remove: (id) => db().from("study_classes").delete().eq("id", id),
  };
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
    classes,
    tasks: table("study_tasks", TASK, "due_date"),
    // focus sessions tagged with a subject since a moment (for "study time")
    focusSince: (iso) => db().from("focus_sessions").select("minutes, course_id, started_at").gte("started_at", iso),
  };
})();
