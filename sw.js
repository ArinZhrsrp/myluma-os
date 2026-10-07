// LUMA service worker — shows Web Push notifications when LUMA isn't in front.
// Served from the same folder as the HTML pages (needs http://localhost or https).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) {}

  event.waitUntil((async () => {
    // If a LUMA window is open and visible the in-app toast already covers it.
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visible = wins.some((c) => c.visibilityState === "visible");

    // iOS requires every push to show a notification — a push that shows nothing counts
    // as "silent" and, after a few, iOS cancels the subscription (no more push once the
    // app is closed). So when LUMA is on screen (the in-app toast already covers it) we
    // still show one, silently, and dismiss it straight away.
    await self.registration.showNotification(d.title || "LUMA", {
      body: d.body || "",
      tag: d.id || undefined,
      icon: "assets/luma-mark.svg",
      silent: visible,
      data: { link: d.link || "" },
    });
    if (visible) {
      await new Promise((r) => setTimeout(r, 400));
      const shown = await self.registration.getNotifications({ tag: d.id || undefined });
      shown.forEach((x) => x.close());
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "";

  event.waitUntil((async () => {
    const base = new URL("LUMA%20Glass%20Dashboard.html", self.registration.scope).href;
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.startsWith(base)) {
        await c.focus();
        c.postMessage({ type: "open-page", link });
        return;
      }
    }
    await self.clients.openWindow(base + (link ? "#" + link : ""));
  })());
});
