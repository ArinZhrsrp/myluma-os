// LUMA — Supabase helpers for the Habits module. Depends on luma-auth.js
// (reuses its client). Requires supabase/migrations/016_habits.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const BASE_COLS = "id, name, icon, color, target, days, created_at";
  // period / per_period / goal_value / unit / source come from migration 017
  const NEW_COLS = "period, per_period, goal_value, unit, source";
  const COLS = BASE_COLS + ", " + NEW_COLS;
  const NEW_DEFAULTS = { period: "daily", per_period: 1, goal_value: null, unit: "", source: "manual" };
  // until 017 has run, plain daily habits still save: leave out the new fields when they hold their defaults
  const trimDefaults = (f) => Object.fromEntries(Object.entries(f).filter(([k, v]) => !(k in NEW_DEFAULTS) || v !== NEW_DEFAULTS[k]));
  const MISSING = /period|per_period|goal_value|unit|source|value|schema cache/i;
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

  window.LumaHabits = {
    ALL_DAYS,

    async list() {
      const q = (cols) => db().from("habits").select(cols).eq("archived", false).order("created_at", { ascending: true });
      const res = await q(COLS);
      return res.error && MISSING.test(res.error.message) ? q(BASE_COLS) : res; // 017 not run yet
    },

    // every "done" day on or after sinceKey (YYYY-MM-DD) → [{ habit_id, log_date }]
    async logsSince(sinceKey) {
      const q = (cols) => db().from("habit_logs").select(cols).gte("log_date", sinceKey).limit(10000);
      const res = await q("habit_id, log_date, value");
      return res.error && MISSING.test(res.error.message) ? q("habit_id, log_date") : res;
    },

    async add(fields) {
      const res = await db().from("habits").insert(trimDefaults(fields)).select(COLS).single();
      return res.error && MISSING.test(res.error.message) ? db().from("habits").insert(trimDefaults(fields)).select(BASE_COLS).single() : res;
    },

    // several at once (e.g. the five prayers)
    async addMany(rows) {
      const res = await db().from("habits").insert(rows.map(trimDefaults)).select(COLS);
      return res.error && MISSING.test(res.error.message) ? db().from("habits").insert(rows.map(trimDefaults)).select(BASE_COLS) : res;
    },

    async update(id, fields) {
      const res = await db().from("habits").update(trimDefaults(fields)).eq("id", id).select(COLS).single();
      return res.error && MISSING.test(res.error.message) ? db().from("habits").update(trimDefaults(fields)).eq("id", id).select(BASE_COLS).single() : res;
    },

    async remove(id) {
      return db().from("habits").delete().eq("id", id);
    },

    // delete several habits (and, via cascade, their check-ins)
    async removeMany(ids) {
      return db().from("habits").delete().in("id", ids);
    },

    // mark a habit done (or not done) on a calendar day; `value` = the amount for measurable habits
    async setDone(habitId, dayKey, done, value) {
      if (done) {
        const row = { habit_id: habitId, log_date: dayKey };
        if (value != null) row.value = value;
        return db().from("habit_logs").upsert(row, { onConflict: "habit_id,log_date" });
      }
      return db().from("habit_logs").delete().eq("habit_id", habitId).eq("log_date", dayKey);
    },

    // remove every check-in in a date range (undo a weekly / monthly habit)
    async clearRange(habitId, fromKey, toKey) {
      return db().from("habit_logs").delete().eq("habit_id", habitId).gte("log_date", fromKey).lte("log_date", toKey);
    },
  };
})();
