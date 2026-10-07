// LUMA — Supabase helpers for the Habits module. Depends on luma-auth.js
// (reuses its client). Requires supabase/migrations/016_habits.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COLS = "id, name, icon, color, target, days, created_at";
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

  window.LumaHabits = {
    ALL_DAYS,

    async list() {
      return db().from("habits").select(COLS).eq("archived", false).order("created_at", { ascending: true });
    },

    // every "done" day on or after sinceKey (YYYY-MM-DD) → [{ habit_id, log_date }]
    async logsSince(sinceKey) {
      return db().from("habit_logs").select("habit_id, log_date").gte("log_date", sinceKey).limit(10000);
    },

    async add({ name, icon, color, target, days }) {
      return db().from("habits").insert({ name, icon, color, target, days }).select(COLS).single();
    },

    async update(id, fields) {
      return db().from("habits").update(fields).eq("id", id).select(COLS).single();
    },

    async remove(id) {
      return db().from("habits").delete().eq("id", id);
    },

    // mark a habit done (or not done) on a calendar day
    async setDone(habitId, dayKey, done) {
      if (done) return db().from("habit_logs").upsert({ habit_id: habitId, log_date: dayKey }, { onConflict: "habit_id,log_date" });
      return db().from("habit_logs").delete().eq("habit_id", habitId).eq("log_date", dayKey);
    },
  };
})();
