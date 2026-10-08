// LUMA — "spaces": what you create in Work or Study mode stays in that mode (see supabase/migrations/050_spaces.sql).
// This wraps the database client once, so EVERY module follows the rule without its own code:
//   • reading tasks / events / reminders / notes / documents / habits / goals / bills / money entries returns only the
//     items of the current mode — in Personal mode that is Personal plus Work and/or Study when "Show … in Personal"
//     (Settings → Preferences) is on;
//   • a new item is filed under the mode you are in.
// Until the migration has run (init() finds no "space" column) nothing is filtered and nothing is tagged.
// Depends on luma-auth.js. Reads LUMA_MODE (core/modes.js) and prefOn() (core/appearance.js) when it is used.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) return;
  const SCOPED = new Set(["tasks", "events", "reminders", "notes", "documents", "habits", "goals", "bills", "money_entries"]);
  const client = window.LumaAuth.client;
  const original = client.schema.bind(client);

  const Space = (window.LumaSpace = {
    ready: false,
    SCOPED,
    // the mode the person is in right now
    mode() {
      try { return typeof LUMA_MODE !== "undefined" && LUMA_MODE ? LUMA_MODE : "personal"; } catch (e) { return "personal"; }
    },
    // which spaces are visible right now
    allowed() {
      const m = this.mode();
      if (m !== "personal") return [m];
      const on = (k) => { try { return typeof prefOn === "function" && prefOn(k, false); } catch (e) { return false; } };
      const out = ["personal"];
      if (on("show_work_personal")) out.push("work");
      if (on("show_study_personal")) out.push("study");
      return out;
    },
    // is a row (already loaded) visible right now?
    visible(row) { return !this.ready || !row || !row.space || this.allowed().indexOf(row.space) !== -1; },
    // finds out whether the database has the "space" column; call once after sign-in, before data is loaded
    async init() {
      try {
        const { error } = await original("luma").from("tasks").select("space").limit(1);
        this.ready = !error;
      } catch (e) { this.ready = false; }
      return this.ready;
    },
  });

  const stamp = (rows) => {
    const space = Space.mode();
    return Array.isArray(rows) ? rows.map((r) => ({ space, ...r })) : { space, ...rows };
  };
  const scoped = (builder) => new Proxy(builder, {
    get(target, prop) {
      if (prop === "select") return (...a) => target.select(...a).in("space", Space.allowed()); // a read (an insert/update's .select() is not on this object)
      if (prop === "insert") return (rows, opts) => target.insert(stamp(rows), opts);
      const v = target[prop];
      return typeof v === "function" ? v.bind(target) : v;
    },
  });

  client.schema = function (name) {
    const sc = original(name);
    if (name !== "luma") return sc;
    const from = sc.from.bind(sc);
    sc.from = (table) => (Space.ready && SCOPED.has(table) ? scoped(from(table)) : from(table));
    return sc;
  };
})();
