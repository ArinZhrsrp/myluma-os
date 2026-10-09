// LUMA — Supabase helpers for the Tasks & Work module. Depends on
// luma-auth.js (reuses its client). Requires supabase/migrations/002_tasks.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const BASE_COLS = "id, title, status, priority, tag, due_date, completed_at, created_at";
  const COLS = BASE_COLS + ", notes"; // notes comes from migration 026 — fall back to the base columns until it has run
  const COLS_FULL = COLS + ", repeat, checklist"; // repeat and checklist come from migration 066
  const NO_NOTES = /notes|schema cache/i, NO_EXTRA = /repeat|checklist|schema cache/i;
  async function withCols(query) {
    let res = await query(COLS_FULL);
    if (res.error && NO_EXTRA.test(res.error.message)) res = await query(COLS);
    return res.error && NO_NOTES.test(res.error.message) ? query(BASE_COLS) : res;
  }
  const noExtra = (f) => { const g = { ...f }; delete g.repeat; delete g.checklist; return g; };

  window.LumaTasks = {
    STATUSES: ["todo", "in_progress", "done"],

    async list() {
      return withCols((cols) => db().from("tasks").select(cols).order("created_at", { ascending: true }));
    },

    // user_id defaults to auth.uid() in the database
    async add({ title, status = "todo", priority = "med", tag = "Personal", dueDate = null, notes = "", repeat = "none", checklist = [] }) {
      const row = { title, status, priority, tag, due_date: dueDate };
      if (notes) row.notes = notes; // an empty note is the column default, so tasks still save before 026 has run
      const extra = {}; if (repeat && repeat !== "none") extra.repeat = repeat; if (checklist && checklist.length) extra.checklist = checklist; // the defaults need nothing, so tasks still save before 066 has run
      return withCols((cols) => db().from("tasks").insert(NO_EXTRA.test(cols) && /repeat/.test(cols) ? { ...row, ...extra } : row).select(cols).single());
    },

    async update(id, fields) {
      const run = (f) => withCols((cols) => db().from("tasks").update(/repeat/.test(cols) ? f : noExtra(f)).eq("id", id).select(cols).single());
      const res = await run(fields);
      if (res.error && NO_NOTES.test(res.error.message) && "notes" in fields) { const f = { ...fields }; delete f.notes; return fields.notes ? res : run(f); } // 026 missing: keep saving everything else
      return res;
    },

    async remove(id) {
      return db().from("tasks").delete().eq("id", id);
    },

    // "Today" / "Tomorrow" / "Fri" / "12 Sep" / "" for a YYYY-MM-DD date
    dueLabel(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr + "T00:00:00");
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const diff = Math.round((d - today) / 86400000);
      if (diff === 0) return "Today";
      if (diff === 1) return "Tomorrow";
      if (diff < 0) return "Overdue";
      if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
      return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    },
  };
})();
