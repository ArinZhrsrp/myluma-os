// LUMA service worker — shows Web Push notifications when LUMA isn't in front.
// Served from the same folder as the HTML pages (needs http://localhost or https).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Lets browsers treat LUMA as an installable app. It does nothing to requests: no caching, so you always get the latest files.
self.addEventListener("fetch", () => {});

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
      icon: "/shared/luma-mark.svg",
      silent: visible,
      data: { link: d.link || "", ref: d.ref || "", ntype: d.type || "", ntitle: d.title || "", nbody: d.body || "" },
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
  const nd = event.notification.data || {}, link = nd.link || "", ref = nd.ref || "", ntype = nd.ntype || "", ntitle = nd.ntitle || "", nbody = nd.nbody || "";

  event.waitUntil((async () => {
    const base = new URL("app/", self.registration.scope).href;
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.startsWith(base)) {
        await c.focus();
        c.postMessage({ type: "open-page", link, ref, ntype, ntitle, nbody });
        return;
      }
    }
    await self.clients.openWindow(link ? base + "?from=push" + (ref || ntitle ? "&ref=" + encodeURIComponent(ref) + "&nt=" + encodeURIComponent(ntype) + "&tt=" + encodeURIComponent((ntitle + "|" + nbody).slice(0, 300)) : "") + "#" + link : base);
  })());
});
