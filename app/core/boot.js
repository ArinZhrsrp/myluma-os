// LUMA — app boot. Assembles the page from the module folders, then loads their scripts in order.
//   1. every module's .html (shell, page and popups) is fetched and put in place
//   2. then the scripts run one after another, exactly in this order (shared look → core → modules → start)
// Add a module: create app/modules/<name>/<name>.html|css|js, then list its files in app/index.html (css) and below.
(function () {
  const FRAGMENTS = ["core/shell.html", "core/plans.html", "core/search.html", "modules/dashboard/dashboard.html", "modules/calendar/calendar.html", "modules/tasks/tasks.html", "modules/reminders/reminders.html", "modules/money/money.html", "modules/bills/bills.html", "modules/goals/goals.html", "modules/habits/habits.html", "modules/settings/settings.html", "modules/contacts/contacts.html", "modules/documents/documents.html", "modules/notes/notes.html", "modules/health/health.html", "modules/focus/focus.html", "modules/assistant/assistant.html", "modules/notifications/notifications.html"];   // markup files, in the order their popups are added to the page
  const PAGES = ["dashboard", "calendar", "tasks", "reminders", "admin", "adminreport", "money", "subscriptions", "bills", "goals", "habits", "health", "notes", "documents", "contacts", "assistant", "analytics", "settings", "support", "notifications"];           // the page containers, in menu order (the Dashboard is the one shown first)
  const SCRIPTS = ["core/time.js", "core/dialogs.js", "core/ui.js", "core/push.js", "core/session.js", "core/appearance.js", "core/shell.js", "core/router.js", "core/dirtywatch.js", "core/plans.js", "core/search.js", "modules/notifications/notifications.js", "modules/contacts/contacts.js", "modules/health/health.js", "modules/settings/settings.js", "modules/focus/focus.js", "modules/tasks/tasks.js", "modules/calendar/calendar.js", "modules/money/money.js", "modules/bills/bills.js", "modules/subscriptions/subscriptions.js", "modules/goals/goals.js", "modules/habits/habits.js", "modules/analytics/analytics.js", "modules/dashboard/dashboard.js", "modules/reminders/reminders.js", "modules/admin/admin.js", "modules/adminreport/adminreport.js", "modules/documents/documents.js", "modules/notes/notes.js", "modules/assistant/assistant.js", "modules/support/support.js", "core/skins.js", "core/start.js"];       // the scripts, in load order

  const parts = (text) => { // a file can hold <!--@shell-->, <!--@page--> and <!--@modals--> sections
    const out = { shell: "", page: "", modals: "" }; let cur = null;
    text.split("\n").forEach((l) => { const m = /^<!--@(shell|page|modals)-->\s*$/.exec(l); if (m) cur = m[1]; else if (cur) out[cur] += l + "\n"; });
    return out;
  };

  function fail(e) {
    console.error("LUMA could not start:", e);
    if (window.LumaLoader) window.LumaLoader.hold("boot-failed"); // keeps the loading cover up; its 3-minute message explains what to do
  }

  Promise.all(FRAGMENTS.map((f) => fetch(f).then((r) => { if (!r.ok) throw new Error(f + " " + r.status); return r.text(); }).then(parts)))
    .then((all) => {
      const byFile = {}; FRAGMENTS.forEach((f, i) => { byFile[f] = all[i]; });
      document.body.insertAdjacentHTML("afterbegin", byFile["core/shell.html"].shell);
      const wrap = document.querySelector(".content-wrapper");
      PAGES.forEach((key) => {
        const pg = document.createElement("div"); pg.className = "page" + (key === "dashboard" ? " active" : ""); pg.id = "page-" + key;
        const f = FRAGMENTS.find((x) => x === "modules/" + key + "/" + key + ".html");
        if (f && byFile[f].page) pg.innerHTML = byFile[f].page;
        wrap.appendChild(pg);
      });
      FRAGMENTS.forEach((f) => { if (byFile[f].modals) document.body.insertAdjacentHTML("beforeend", byFile[f].modals); });
      return SCRIPTS.reduce((p, src) => p.then(() => new Promise((res, rej) => {
        const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("could not load " + src)); document.body.appendChild(s);
      })), Promise.resolve());
    })
    .catch(fail);
})();
