// LUMA — the signed-in user's plan (Dawn / Glow / Zenith) and its limits. Depends on luma-auth.js.
// Requires supabase/migrations/033_plans.sql. Until that migration has run (or if loading fails) nothing is limited.
// The database enforces the limits; this file lets the app show them and explain them before you hit them.

(function () {
  window.LumaPlan = {
    plan: "zenith",
    lim: {},
    ready: false,
    admin: false, // true for super-admin accounts (see supabase/migrations/036_admin.sql)
    NAMES: { dawn: "Dawn", glow: "Glow", zenith: "Zenith" },
    name() { return this.NAMES[this.plan] || "Zenith"; },
    // a numeric limit, or null when there is none (unlimited, or plans are not set up yet)
    get(key) {
      if (!this.ready) return null;
      const v = this.lim[key];
      return v === undefined ? null : v;
    },
    // for on/off features: true unless the plan explicitly has 0
    has(key) { const v = this.get(key); return v === null || v > 0; },
    async load() {
      if (!window.LumaAuth || !window.LumaAuth.client) return;
      try {
        const { data, error } = await window.LumaAuth.client.schema("luma").rpc("my_limits");
        if (!error && data && data.plan) { this.plan = data.plan; this.lim = data.limits || {}; this.ready = true; }
        const a = await window.LumaAuth.client.schema("luma").rpc("is_admin");
        this.admin = !a.error && a.data === true;
      } catch (e) { /* plans not set up yet */ }
    },
  };
})();
