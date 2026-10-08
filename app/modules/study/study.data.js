// LUMA — Supabase helpers for the Study add-on. Depends on luma-auth.js (reuses its client).
// Requires supabase/migrations/044_addons.sql and 045_study.sql (+ 047 class dates, 049 semesters / marks).
// Columns added by a later migration are optional: until that migration has run the app falls back to the older columns.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COURSE_BASE = "id, name, code, color, lecturer, credit_hours, archived, created_at";
  const CLASS_BASE = "id, course_id, weekday, start_time, end_time, room, kind, created_at";
  const TASK = "id, course_id, title, kind, due_date, due_time, weight, score, max_score, status, notes, completed_at, created_at";
  const SEMESTER = "id, name, start_date, end_date, created_at";

  // the same calls for each table; user_id defaults to auth.uid() in the database.
  // `extra` = columns a later migration added: tried first, left out again if the database doesn't have them yet.
  const table = (name, base, order, extra = []) => {
    const cols = extra.length ? base + ", " + extra.join(", ") : base;
    const missing = new RegExp(extra.concat(["schema cache"]).join("|"), "i");
    const strip = (f) => { const g = Array.isArray(f) ? f.map(strip) : { ...f }; if (!Array.isArray(g)) extra.forEach((c) => delete g[c]); return g; };
    const retry = (r, again) => (r.error && extra.length && missing.test(r.error.message) ? again() : r);
    return {
      async list() { return retry(await db().from(name).select(cols).order(order, { ascending: true }), () => db().from(name).select(base).order(order, { ascending: true })); },
      async add(f) { return retry(await db().from(name).insert(f).select(cols).single(), () => db().from(name).insert(strip(f)).select(base).single()); },
      async addMany(rows) { return retry(await db().from(name).insert(rows).select(cols), () => db().from(name).insert(strip(rows)).select(base)); },
      async update(id, f) { return retry(await db().from(name).update(f).eq("id", id).select(cols).single(), () => db().from(name).update(strip(f)).eq("id", id).select(base).single()); },
      remove: (id) => db().from(name).delete().eq("id", id),
    };
  };

  window.LumaStudy = {
    courses: table("study_courses", COURSE_BASE, "created_at", ["semester_id", "target_percent", "final_percent"]),
    classes: table("study_classes", CLASS_BASE, "start_time", ["start_date", "end_date"]),
    tasks: table("study_tasks", TASK, "due_date"),
    semesters: table("study_semesters", SEMESTER, "start_date"),
    // focus sessions tagged with a subject since a moment (for "study time")
    focusSince: (iso) => db().from("focus_sessions").select("minutes, course_id, started_at").gte("started_at", iso),
  };
})();
