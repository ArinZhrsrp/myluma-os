// LUMA — Supabase helpers for the Habits module. Depends on luma-auth.js
// (reuses its client). Requires supabase/migrations/016_habits.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const BASE_COLS = "id, name, icon, color, target, days, archived, created_at, updated_at";
  // period / per_period / goal_value / unit / source come from migration 017, reminder_time from 018
  const COLS_017 = BASE_COLS + ", period, per_period, goal_value, unit, source";
  const COLS = COLS_017 + ", reminder_time";
  const COL_SETS = [COLS, COLS_017, BASE_COLS]; // newest first; fall back while a migration hasn't been run
  const NEW_DEFAULTS = { period: "daily", per_period: 1, goal_value: null, unit: "", source: "manual", reminder_time: null };
  // until the migrations have run, plain habits still save: leave out the new fields when they hold their defaults
  const trimDefaults = (f) => Object.fromEntries(Object.entries(f).filter(([k, v]) => !(k in NEW_DEFAULTS) || v !== NEW_DEFAULTS[k]));
  const MISSING = /period|per_period|goal_value|unit|source|value|reminder_time|schema cache/i;
  // run query(cols) with the newest column set, then older ones, as long as the error is about a missing column
  async function withCols(query) {
    let res;
    for (const cols of COL_SETS) {
      res = await query(cols);
      if (!res.error || !MISSING.test(res.error.message)) return res;
    }
    return res;
  }
  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

  window.LumaHabits = {
    ALL_DAYS,

    async list() {
      // includes deleted habits (archived = true): they're hidden from the list but their completed days still count in the charts
      return withCols((cols) => db().from("habits").select(cols).order("created_at", { ascending: true }));
    },

    // every "done" day on or after sinceKey (YYYY-MM-DD) → [{ habit_id, log_date }]
    async logsSince(sinceKey) {
      const q = (cols) => db().from("habit_logs").select(cols).gte("log_date", sinceKey).limit(10000);
      const res = await q("habit_id, log_date, value");
      return res.error && MISSING.test(res.error.message) ? q("habit_id, log_date") : res;
    },

    async add(fields) {
      return withCols((cols) => db().from("habits").insert(trimDefaults(fields)).select(cols).single());
    },

    // several at once (e.g. the five prayers)
    async addMany(rows) {
      return withCols((cols) => db().from("habits").insert(rows.map(trimDefaults)).select(cols));
    },

    async update(id, fields) {
      // a cleared field must still be written (e.g. removing a reminder), so send everything first and only
      // drop default-valued new fields if the database is missing those columns
      const run = (f) => withCols((cols) => db().from("habits").update(f).eq("id", id).select(cols).single());
      const res = await run(fields);
      return res.error && MISSING.test(res.error.message) ? run(trimDefaults(fields)) : res;
    },

    // "Delete" hides the habit and keeps its check-ins (so past charts and best streak don't change). Reminders stop
    // because the reminder job skips archived habits.
    async remove(id) {
      return db().from("habits").update({ archived: true }).eq("id", id);
    },

    // delete several habits at once (same soft delete as remove)
    async removeMany(ids) {
      return db().from("habits").update({ archived: true }).in("id", ids);
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
