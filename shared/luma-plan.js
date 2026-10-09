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
    planExpires: cached && cached.planExpires ? cached.planExpires : null, // when a paid plan ends (empty = no end date)
    addons: cached && cached.addons ? cached.addons : [], // active add-ons: "work", "study" (migration 044)
    addonInfo: cached && cached.addonInfo ? cached.addonInfo : {}, // { work: { source: "trial"|"admin", expires_at } }
    trialsUsed: cached && cached.trialsUsed ? cached.trialsUsed : [],
    gifts: [], // free access an administrator sent that is waiting to be used (migration 069): [{ id, addon, days, months, message, claim_by, state }]
    ready: !!cached,
    admin: false, // true for super-admin accounts (see supabase/migrations/036_admin.sql)
    // resolves once the plan has been fetched (or given up on) — pages that depend on it wait for this
    loaded: new Promise((r) => { resolveLoaded = r; }),
    NAMES: { dawn: "Dawn", glow: "Glow", zenith: "Zenith" },
    ADDON_NAMES: { work: "Work", study: "Study" },
    // true while the add-on is active (bought, granted, or a running trial)
    // days until a date (negative = past); null when there is no date
    daysTo(iso) { return iso ? Math.ceil((Date.parse(iso) - Date.now()) / 864e5) : null; },
    hasAddon(k) { return this.addons.indexOf(k) !== -1; },
    // Work comes in two sizes (migration 083): "Work" and "Work Pro"; the size is in addonInfo.work.tier
    workTier() { return (this.addonInfo.work && this.addonInfo.work.tier) === 'pro' ? 'pro' : 'standard'; },
    addonName(k) { return k === 'work' && this.hasAddon('work') && this.workTier() === 'pro' ? 'Work Pro' : this.ADDON_NAMES[k]; },
    canTrial(k) { return !this.hasAddon(k) && this.trialsUsed.indexOf(k) === -1; },
    name() { return this.NAMES[this.plan] || "Dawn"; },
    // a numeric limit, or null when there is none (unlimited, or plans are not set up yet)
    get(key) {
      if (!this.ready) return null;
      const v = this.lim[key];
      return v === undefined ? null : v;
    },
    // for on/off features: true unless the plan explicitly has 0
    has(key) { const v = this.get(key); return v === null || v > 0; },
    waitingGifts() { return this.gifts.filter((g) => g.state === "waiting"); },
    // the gifts waiting for this person (and recent used / expired ones); the Settings menu gets a small dot while one is waiting
    async loadGifts() {
      const client = window.LumaAuth && window.LumaAuth.client; if (!client) return;
      try { const { data, error } = await client.schema("luma").rpc("my_gifts"); this.gifts = !error && Array.isArray(data) ? data : []; } catch (e) { this.gifts = []; }
      try { document.dispatchEvent(new Event("luma-gifts")); } catch (e) { /* nothing is listening yet */ }
      try { const m = document.querySelector('.menu[data-page="settings"]'); if (m) m.classList.toggle("has-gift", this.waitingGifts().length > 0); } catch (e) { /* the menu is not drawn yet */ }
    },
    async load() {
      const client = window.LumaAuth && window.LumaAuth.client;
      if (!client) { resolveLoaded(); return; }
      let legacy = false;
      for (let i = 0; i < 3; i++) {
        try {
          const { data, error } = await client.schema("luma").rpc("my_limits");
          if (!error && data && data.plan) {
            this.plan = data.plan; this.lim = data.limits || {}; this.ready = true;
            this.planExpires = data.plan_expires_at || null; this.addons = Array.isArray(data.addons) ? data.addons : []; this.addonInfo = data.addon_info || {}; this.trialsUsed = Array.isArray(data.trials_used) ? data.trials_used : [];
            try { localStorage.setItem(CACHE, JSON.stringify({ plan: this.plan, lim: this.lim, planExpires: this.planExpires, addons: this.addons, addonInfo: this.addonInfo, trialsUsed: this.trialsUsed })); } catch (e) {}
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
      this.loadedAt = Date.now();
      resolveLoaded();
      this.loadGifts(); // after the plan is known; does not hold anything up
    },
  };
})();
