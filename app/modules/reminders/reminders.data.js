// LUMA — Supabase helpers for the Reminders page (luma.reminders). Depends on luma-auth.js.
// Requires supabase/migrations/032_reminders.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COLS = "id, title, note, kind, start_date, remind_time, days, active, last_fired_on, created_at";

  window.LumaReminders = {
    async list() {
      return db().from("reminders").select(COLS).order("created_at", { ascending: true }).limit(500);
    },
    // user_id defaults to auth.uid() in the database
    async add(fields) {
      return db().from("reminders").insert(fields).select(COLS).single();
    },
    async update(id, fields) {
      return db().from("reminders").update(fields).eq("id", id).select(COLS).single();
    },
    async remove(id) {
      return db().from("reminders").delete().eq("id", id);
    },
  };
})();
