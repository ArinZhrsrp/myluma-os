// LUMA — Supabase helpers for the Money module. Depends on luma-auth.js
// (reuses its client). Requires supabase/migrations/023_money_country.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const ENTRY_COLS = "id, kind, amount, category, name, entry_date, created_at";
  const SET_COLS = "gross_salary, epf_rate, marital, children, other_relief, pay_day, monthly_budget, created_at";

  window.LumaMoney = {
    DEFAULT_SETTINGS: { gross_salary: 0, epf_rate: 11, marital: "single", children: 0, other_relief: 0, pay_day: 25, monthly_budget: 0, created_at: null },

    async getSettings() {
      const { data, error } = await db().from("money_settings").select(SET_COLS).maybeSingle();
      return { data: { ...this.DEFAULT_SETTINGS, ...(data || {}) }, error, exists: !!data };
    },

    // only the fields you pass are written
    async saveSettings(fields) {
      const s = await window.LumaAuth.getSession();
      if (!s) return { data: null, error: { message: "Not signed in" } };
      return db().from("money_settings").upsert({ user_id: s.user.id, ...fields }, { onConflict: "user_id" }).select(SET_COLS).single();
    },

    async listEntries(sinceKey) {
      return db().from("money_entries").select(ENTRY_COLS).gte("entry_date", sinceKey).order("entry_date", { ascending: false }).limit(5000);
    },
    async addEntry(fields) {
      return db().from("money_entries").insert(fields).select(ENTRY_COLS).single();
    },
    async updateEntry(id, fields) {
      return db().from("money_entries").update(fields).eq("id", id).select(ENTRY_COLS).single();
    },
    async removeEntry(id) {
      return db().from("money_entries").delete().eq("id", id);
    },
  };
})();
