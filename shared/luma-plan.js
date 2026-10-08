// LUMA — the signed-in user's plan (Dawn / Glow / Zenith) and its limits. Depends on luma-auth.js.
// Requires supabase/migrations/033_plans.sql. The database enforces the limits; this file lets the app show and
// explain them. Until the answer arrives the app uses the last answer it saw (remembered in this browser), and if the
// answer can't be fetched it falls back to the strictest plan (Dawn), never to a bigger one.

(function () {
  const CACHE = "luma_plan_cache";
  // the Dawn limits (same numbers as migration 033), used only when nothing better is known
  const DAWN = { lumi_questions: 3, lumi_actions: 0, insights: 0, storage_mb: 50, file_mb: 5, reminders: 5, habits: 5, goals: 3, bills: 5, contacts: 3, timing: 0, payroll: 0, own_wallpaper: 0, wallpapers: 2, themes: 1, chat_messages: 50 };

  function readCache() {
    try { const c = JSON.parse(localStorage.getItem(CACHE) || "null"); return c && c.plan && c.lim ? c : null; } catch (e) { return null; }
  }
  const cached = readCache();
  let resolveLoaded;

  window.LumaPlan = {
    plan: cached ? cached.plan : "dawn",
    lim: cached ? cached.lim : {},
    ready: !!cached,
    admin: false, // true for super-admin accounts (see supabase/migrations/036_admin.sql)
    // resolves once the plan has been fetched (or given up on) — pages that depend on it wait for this
    loaded: new Promise((r) => { resolveLoaded = r; }),
    NAMES: { dawn: "Dawn", glow: "Glow", zenith: "Zenith" },
    name() { return this.NAMES[this.plan] || "Dawn"; },
    // a numeric limit, or null when there is none (unlimited, or plans are not set up yet)
    get(key) {
      if (!this.ready) return null;
      const v = this.lim[key];
      return v === undefined ? null : v;
    },
    // for on/off features: true unless the plan explicitly has 0
    has(key) { const v = this.get(key); return v === null || v > 0; },
    async load() {
      const client = window.LumaAuth && window.LumaAuth.client;
      if (!client) { resolveLoaded(); return; }
      let legacy = false;
      for (let i = 0; i < 3; i++) {
        try {
          const { data, error } = await client.schema("luma").rpc("my_limits");
          if (!error && data && data.plan) {
            this.plan = data.plan; this.lim = data.limits || {}; this.ready = true;
            try { localStorage.setItem(CACHE, JSON.stringify({ plan: this.plan, lim: this.lim })); } catch (e) {}
            break;
          }
          // plans were never set up in this database (migration 033 not run): behave as before, with no limits
          if (error && /could not find the function|does not exist/i.test(error.message || "")) { legacy = true; break; }
        } catch (e) { /* network hiccup: try again */ }
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
      if (legacy) { this.plan = "zenith"; this.lim = {}; this.ready = false; }
      else if (!this.ready) { this.plan = "dawn"; this.lim = DAWN; this.ready = true; } // could not find out: strictest plan, never a bigger one
      try {
        const a = await client.schema("luma").rpc("is_admin");
        this.admin = !a.error && a.data === true;
      } catch (e) { this.admin = false; }
      resolveLoaded();
    },
  };
})();
