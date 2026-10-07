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
    if (wins.some((c) => c.visibilityState === "visible")) return;

    await self.registration.showNotification(d.title || "LUMA", {
      body: d.body || "",
      tag: d.id || undefined,
      icon: "assets/luma-mark.svg",
      data: { link: d.link || "" },
    });
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
