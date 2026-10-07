// LUMA — Supabase helpers for the Tasks & Work module. Depends on
// luma-auth.js (reuses its client). Requires supabase/migrations/002_tasks.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COLS = "id, title, status, priority, tag, due_date, completed_at, created_at";

  window.LumaTasks = {
    STATUSES: ["todo", "in_progress", "done"],

    async list() {
      return db().from("tasks").select(COLS).order("created_at", { ascending: true });
    },

    // user_id defaults to auth.uid() in the database
    async add({ title, status = "todo", priority = "med", tag = "Personal", dueDate = null }) {
      return db().from("tasks").insert({ title, status, priority, tag, due_date: dueDate }).select(COLS).single();
    },

    async update(id, fields) {
      return db().from("tasks").update(fields).eq("id", id).select(COLS).single();
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
