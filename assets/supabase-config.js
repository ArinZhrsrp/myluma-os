// LUMA — Supabase project credentials, one set per environment.
//
//   STAGING     = the sandbox project: where every new feature is tried first (also used on your computer,
//                 on Vercel preview links and on the "staging" branch's link).
//   PRODUCTION  = the live project real users use. Used ONLY when the site is opened on one of PROD_HOSTS.
//
// Get the values from each Supabase project: Project Settings → API ("Project URL" and the publishable / anon key).
// The key is safe to expose client-side by design (Supabase enforces access with Row Level Security).
(function () {
  // The addresses that count as production. Add your own domain here when you get one, e.g. "app.luma.com".
  var PROD_HOSTS = ["myluma-os.vercel.app"];

  var STAGING = {
    url: "https://rbrpgjcwiptuvuluqrxs.supabase.co",
    key: "sb_publishable_7MlbvuMMZWJkt_KIcqkFvA_bHe7gzHZ",
  };

  // Fill these in after creating the production project. Until you do, production keeps using STAGING (nothing breaks).
  var PROD = {
    url: "",
    key: "",
  };

  var onProdHost = PROD_HOSTS.indexOf(location.hostname) !== -1;
  var useProd = onProdHost && !!PROD.url && !!PROD.key;
  var c = useProd ? PROD : STAGING;

  window.LUMA_SUPABASE_URL = c.url;
  window.LUMA_SUPABASE_ANON_KEY = c.key;
  window.LUMA_ENV = useProd ? "production" : "staging";

  // a small corner tag so you never mistake staging for the real thing
  if (!useProd) {
    document.addEventListener("DOMContentLoaded", function () {
      var t = document.createElement("div");
      t.textContent = "STAGING";
      t.title = "You are on the staging environment (test data, not production).";
      t.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483600;padding:3px 9px;border-radius:999px;font:700 10px/1.4 -apple-system,Segoe UI,Inter,sans-serif;letter-spacing:.1em;color:#1a1204;background:#fbbf24;opacity:.9;pointer-events:none";
      document.body.appendChild(t);
    });
  }
})();
