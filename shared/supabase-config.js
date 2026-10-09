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
    url: "https://yzinmyjmhmacnyjsgyfu.supabase.co",
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
  // The app version. Bump it when something is pushed to staging:
  //   patch (0.9.1) = fixes and small tweaks · minor (0.10.0) = a new feature or module · 1.0.0 = the first production release.
  window.LUMA_VERSION = "0.10.6";

  // the version (and "staging") under "Your Personal OS": any element with data-luma-version gets filled in
  window.lumaPaintVersion = function () {
    var t = "Version " + window.LUMA_VERSION + (useProd ? "" : ' \u00b7 <span style="color:#fbbf24;font-weight:700">STAGING</span>');
    var els = document.querySelectorAll("[data-luma-version]");
    for (var i = 0; i < els.length; i++) els[i].innerHTML = t;
  };
  document.addEventListener("DOMContentLoaded", window.lumaPaintVersion);
})();
