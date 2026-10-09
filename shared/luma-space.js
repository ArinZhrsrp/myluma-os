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
    semReady: false, // does the database know about semesters on these tables? (migration 056)
    archivedSems: [], // semesters you archived: what belongs to them is hidden everywhere except the Study archive
    bypass: false, // the archive page switches this on while it reads archived items
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
    setArchived(ids) { this.archivedSems = ids.slice(); },
    // which space (personal / work / study) one item belongs to, whatever mode you are in now; null when unknown
    async spaceOf(table, id) {
      if (!this.ready || !id) return null;
      try { const r = await original("luma").from(table).select("space").eq("id", id).maybeSingle(); return r.error || !r.data ? null : r.data.space || null; } catch (e) { return null; }
    },
    // finds out whether the database has the "space" column; call once after sign-in, before data is loaded
    async init() {
      try {
        const { error } = await original("luma").from("tasks").select("space").limit(1);
        this.ready = !error;
        if (this.ready) {
          const sem = await original("luma").from("tasks").select("semester_id").limit(1);
          this.semReady = !sem.error;
          if (this.semReady) { const a = await original("luma").from("study_semesters").select("id").not("archived_at", "is", null); this.archivedSems = a.error ? [] : (a.data || []).map((x) => x.id); }
        }
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
      if (prop === "select") return (...a) => { // a read (an insert/update's .select() is not on this object)
        let q = target.select(...a).in("space", Space.allowed());
        if (Space.semReady && !Space.bypass && Space.archivedSems.length) q = q.or("semester_id.is.null,semester_id.not.in.(" + Space.archivedSems.join(",") + ")"); // items of an archived semester stay in the archive
        return q;
      }
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
