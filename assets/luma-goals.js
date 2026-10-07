// LUMA — Supabase helpers for the Goals module. Depends on luma-auth.js
// (reuses its client). Requires supabase/migrations/019_goals.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COLS = "id, title, category, unit, target_value, current_value, deadline, note, completed_at, created_at";

  window.LumaGoals = {
    async list() {
      return db().from("goals").select(COLS).order("created_at", { ascending: true });
    },

    // user_id defaults to auth.uid() in the database
    async add(fields) {
      return db().from("goals").insert(fields).select(COLS).single();
    },

    async update(id, fields) {
      return db().from("goals").update(fields).eq("id", id).select(COLS).single();
    },

    async remove(id) {
      return db().from("goals").delete().eq("id", id);
    },
  };
})();
