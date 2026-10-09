// LUMA — "add to home screen". Loaded early on every app page so it can catch the browser's install offer.
//   LumaInstall.installed()   → LUMA is already running as an installed app on this device
//   LumaInstall.canPrompt()   → the browser offered to install it (Chrome / Edge / Android): LumaInstall.prompt() shows the browser's own install box
//   LumaInstall.ios()         → iPhone / iPad (no install box exists there: the person adds it from the Share menu)
//   LumaInstall.steps()       → the words that explain how to add it on this kind of device
(function () {
  var offer = null;
  var ua = navigator.userAgent || "";
  var isIos = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); offer = e; try { document.dispatchEvent(new Event("luma-install")); } catch (x) { } });
  window.addEventListener("appinstalled", function () { offer = null; try { localStorage.setItem("luma_installed", "1"); document.dispatchEvent(new Event("luma-install")); } catch (x) { } });
  window.LumaInstall = {
    ios: function () { return isIos; },
    installed: function () {
      try { if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true) return true; } catch (x) { }
      return false;
    },
    canPrompt: function () { return !!offer; },
    // on a phone or tablet (where an app icon makes sense)
    isMobile: function () { return isIos || /android/i.test(ua) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900); },
    prompt: async function () {
      if (!offer) return "none";
      offer.prompt();
      var r = null; try { r = await offer.userChoice; } catch (x) { }
      offer = null; try { document.dispatchEvent(new Event("luma-install")); } catch (x) { }
      return r && r.outcome === "accepted" ? "accepted" : "dismissed";
    },
    steps: function () {
      if (isIos) return "1. In Safari, tap the Share button (the square with an arrow pointing up).\n2. Scroll down and tap “Add to Home Screen”.\n3. Tap “Add”. LUMA now opens full screen from your Home Screen, and on iPhone this is also what lets it send you notifications.";
      if (/android/i.test(ua)) return "1. In Chrome, tap the ⋮ menu at the top right.\n2. Tap “Install app” (or “Add to Home screen”).\n3. Tap “Install”. LUMA now opens full screen from your home screen.";
      return "1. In Chrome or Edge, click the install icon at the right end of the address bar (or open the ⋮ menu and choose “Install LUMA”).\n2. Click “Install”. LUMA now opens in its own window, like an app.";
    },
  };
})();
