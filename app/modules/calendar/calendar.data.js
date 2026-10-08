// LUMA — Supabase helpers for the Calendar. Depends on luma-auth.js
// (reuses its client). Requires supabase/migrations/027_events.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COLS = "id, title, category, event_date, all_day, start_time, end_time, repeats, note, created_at";

  window.LumaEvents = {
    async list() {
      return db().from("events").select(COLS).order("event_date", { ascending: true }).limit(5000);
    },
    // user_id defaults to auth.uid() in the database
    async add(fields) {
      return db().from("events").insert(fields).select(COLS).single();
    },
    async update(id, fields) {
      return db().from("events").update(fields).eq("id", id).select(COLS).single();
    },
    async remove(id) {
      return db().from("events").delete().eq("id", id);
    },
  };
})();
