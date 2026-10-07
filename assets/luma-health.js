// LUMA — Supabase helpers for the Health module (luma.health_logs: one row per
// day, luma.health_goals: personal daily targets). Depends on luma-auth.js.
// Requires supabase/migrations/011_health.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const LOG_COLS = "log_date, sleep_hours, water_ml, steps, active_minutes, mood, note, updated_at";
  const LOG_COLS_FULL = LOG_COLS + ", bedtime, wake_time"; // bedtime / wake-up time arrive with migration 013
  const REMINDER_COLS = "water_enabled, water_every_min, water_from, water_to, steps_enabled, steps_every_min, steps_from, steps_to, sleep_enabled, bedtime, wake_time, sleep_lead_min";
  const DEFAULT_REMINDERS = {
    water_enabled: false, water_every_min: 60, water_from: "08:00", water_to: "22:00",
    steps_enabled: false, steps_every_min: 180, steps_from: "10:00", steps_to: "20:00",
    sleep_enabled: false, bedtime: "23:00", wake_time: "07:00", sleep_lead_min: 30,
  };
  const GOAL_COLS = "sleep_hours, water_ml, steps, active_minutes";
  // quick-add amounts (migration 012) travel with the goals; older databases just use the defaults
  const QUICK_COLS = ", quick_sleep_hours, quick_water_ml, quick_steps, quick_active_minutes";
  const DEFAULT_GOALS = {
    sleep_hours: 8, water_ml: 2500, steps: 10000, active_minutes: 45,
    quick_sleep_hours: 0.5, quick_water_ml: 250, quick_steps: 500, quick_active_minutes: 10,
  };
  const QUICK_KEYS = ["quick_sleep_hours", "quick_water_ml", "quick_steps", "quick_active_minutes"];

  async function uid() {
    const s = await window.LumaAuth.getSession();
    return s ? s.user.id : null;
  }

  window.LumaHealth = {
    DEFAULT_GOALS,
    DEFAULT_REMINDERS,

    // newest day first; `since` is a YYYY-MM-DD lower bound
    async listLogs(since) {
      const q = (cols) => db().from("health_logs").select(cols).gte("log_date", since).order("log_date", { ascending: false });
      const res = await q(LOG_COLS_FULL);
      return res.error ? q(LOG_COLS) : res; // fall back when 013 hasn't been run yet
    },

    // Creates or updates the entry for one day. Only the columns you pass in
    // `fields` are written; any metric you leave out keeps its current value
    // (pass null to clear one).
    async saveLog(date, fields) {
      const user_id = await uid();
      if (!user_id) return { data: null, error: { message: "Not signed in" } };
      const save = (f, cols) => db().from("health_logs").upsert({ user_id, log_date: date, ...f }, { onConflict: "user_id,log_date" }).select(cols).single();
      const res = await save(fields, LOG_COLS_FULL);
      if (res.error && /bedtime|wake_time/i.test(res.error.message)) { // 013 not run: save everything except the times
        const base = { ...fields }; delete base.bedtime; delete base.wake_time;
        return save(base, LOG_COLS);
      }
      return res;
    },

    // ----- reminders (needs migration 013) -----
    async getReminders() {
      const { data, error } = await db().from("health_reminders").select(REMINDER_COLS).maybeSingle();
      return { data: { ...DEFAULT_REMINDERS, ...(data || {}) }, error };
    },
    async saveReminders(r) {
      const user_id = await uid();
      if (!user_id) return { data: null, error: { message: "Not signed in" } };
      return db().from("health_reminders").upsert({ user_id, ...r }, { onConflict: "user_id" }).select(REMINDER_COLS).single();
    },
    // writes a notification for the caller (rate-limited server-side); resolves true if one was created
    async pushReminder(kind, body) {
      const { data, error } = await db().rpc("push_reminder", { p_kind: kind, p_body: body });
      return { data: !!data, error };
    },

    async deleteLog(date) {
      return db().from("health_logs").delete().eq("log_date", date);
    },

    // falls back to the defaults when the user hasn't set goals yet
    async getGoals() {
      let res = await db().from("health_goals").select(GOAL_COLS + QUICK_COLS).maybeSingle();
      if (res.error) res = await db().from("health_goals").select(GOAL_COLS).maybeSingle(); // 012 not run yet
      return { data: { ...DEFAULT_GOALS, ...(res.data || {}) }, error: res.error };
    },

    async saveGoals(goals) {
      const user_id = await uid();
      if (!user_id) return { data: null, error: { message: "Not signed in" } };
      const save = (g, cols) => db().from("health_goals").upsert({ user_id, ...g }, { onConflict: "user_id" }).select(cols).single();
      let res = await save(goals, GOAL_COLS + QUICK_COLS);
      if (res.error && /quick_/i.test(res.error.message)) { // 012 not run: save the goals themselves, keep quick amounts local
        const base = { ...goals }; QUICK_KEYS.forEach((k) => delete base[k]);
        res = await save(base, GOAL_COLS);
        if (!res.error) res.data = { ...goals, ...res.data };
      }
      return res;
    },
  };
})();
