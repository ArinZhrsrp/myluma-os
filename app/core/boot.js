// LUMA — app boot. Assembles the page from the module folders, then loads their scripts in order.
//   1. every module's .html (shell, page and popups) is fetched and put in place
//   2. then the scripts run one after another, exactly in this order (shared look → core → modules → start)
// Add a module: create app/modules/<name>/<name>.html|css|js, then list its files in app/index.html (css) and below.
(function () {
  const FRAGMENTS = ["core/shell.html", "core/plans.html", "core/modes.html", "core/search.html", "modules/dashboard/dashboard.html", "modules/calendar/calendar.html", "modules/tasks/tasks.html", "modules/reminders/reminders.html", "modules/money/money.html", "modules/split/split.html", "modules/bills/bills.html", "modules/goals/goals.html", "modules/habits/habits.html", "modules/settings/settings.html", "modules/contacts/contacts.html", "modules/documents/documents.html", "modules/notes/notes.html", "modules/health/health.html", "modules/focus/focus.html", "modules/study/study.html", "modules/admin/admin.html", "modules/assistant/assistant.html", "modules/notifications/notifications.html"];   // markup files, in the order their popups are added to the page
  const PAGES = ["dashboard", "calendar", "tasks", "reminders", "work", "study", "studyarchive", "admin", "adminreport", "money", "split", "subscriptions", "bills", "goals", "habits", "health", "notes", "documents", "contacts", "assistant", "analytics", "settings", "purchases", "support", "notifications"];           // the page containers, in menu order (the Dashboard is the one shown first)
  const SCRIPTS = ["core/time.js", "core/dialogs.js", "core/ui.js", "core/push.js", "core/session.js", "core/appearance.js", "core/shell.js", "core/router.js", "core/dirtywatch.js", "core/plans.js", "core/modes.js", "core/search.js", "modules/notifications/notifications.js", "modules/contacts/contacts.js", "modules/health/health.js", "modules/settings/settings.js", "modules/purchases/purchases.js", "modules/split/split.js", "modules/focus/focus.js", "modules/tasks/tasks.js", "modules/calendar/calendar.js", "modules/money/money.js", "modules/bills/bills.js", "modules/subscriptions/subscriptions.js", "modules/goals/goals.js", "modules/habits/habits.js", "modules/analytics/insights.js", "modules/dashboard/dashboard.js", "modules/reminders/reminders.js", "modules/work/work.js", "modules/study/study.js", "modules/study/study.notes.js", "modules/study/study.groups.js", "modules/study/study.archive.js", "modules/admin/admin.js", "modules/adminreport/adminreport.js", "modules/documents/documents.js", "modules/notes/notes.js", "modules/assistant/assistant.js", "modules/support/support.js", "core/skins.js", "core/start.js"];       // the scripts, in load order

  // scripts are fetched fresh on staging / localhost (so a changed file is never served from an old browser copy); on production they are cached per version
  const bust = (window.LUMA_VERSION || "0") + (window.LUMA_ENV === "production" ? "" : "." + Date.now());

  const parts = (text) => { // a file can hold <!--@shell-->, <!--@page--> and <!--@modals--> sections
    const out = { shell: "", page: "", modals: "" }; let cur = null;
    text.split("\n").forEach((l) => { const m = /^<!--@(shell|page|modals)-->\s*$/.exec(l); if (m) cur = m[1]; else if (cur) out[cur] += l + "\n"; });
    return out;
  };

  function fail(e) {
    console.error("LUMA could not start:", e);
    if (window.LumaLoader) window.LumaLoader.hold("boot-failed"); // keeps the loading cover up; its 3-minute message explains what to do
  }

  Promise.all(FRAGMENTS.map((f) => fetch(f, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r.text(); }).then(parts)))
    .then((all) => {
      const byFile = {}; FRAGMENTS.forEach((f, i) => { byFile[f] = all[i]; });
      document.body.insertAdjacentHTML("afterbegin", byFile["core/shell.html"].shell); if (window.lumaPaintVersion) window.lumaPaintVersion();
      const wrap = document.querySelector(".content-wrapper");
      PAGES.forEach((key) => {
        const pg = document.createElement("div"); pg.className = "page" + (key === "dashboard" ? " active" : ""); pg.id = "page-" + key;
        const f = FRAGMENTS.find((x) => x === "modules/" + key + "/" + key + ".html");
        if (f && byFile[f].page) pg.innerHTML = byFile[f].page;
        wrap.appendChild(pg);
      });
      FRAGMENTS.forEach((f) => { if (byFile[f].modals) document.body.insertAdjacentHTML("beforeend", byFile[f].modals); });
      return SCRIPTS.reduce((p, src) => p.then(() => new Promise((res, rej) => {
        const s = document.createElement("script"); s.src = src + "?v=" + bust; s.onload = res; s.onerror = () => { console.error("LUMA: could not load " + src + " (a browser extension / ad blocker may be blocking it)"); res(); }; /* one blocked file must not stop the rest */ document.body.appendChild(s);
      })), Promise.resolve());
    })
    .catch(fail);
})();
