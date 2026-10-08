// LUMA — simple loading overlay for every page.
//  • Shows at once, stays at least 1 second, and keeps going until the page (and anything it asked to wait for) has loaded.
//  • Also covers each move between Dashboard pages while that page's data loads.
//  • Still loading after 3 minutes → "something went wrong" popup.
// A page can wait for its own data:  LumaLoader.hold("name") … LumaLoader.release("name").
(function () {
  var MIN_MS = 1000, MAX_MS = 3 * 60 * 1000, root = document.documentElement;
  var holds = { load: true }, start = Date.now(), gone = false, token = 0, failTimer = null;

  var css = document.createElement("style");
  css.textContent =
    "#lumaLoader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(10,14,26,.22);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);transition:opacity .3s ease}" +
    "#lumaLoader.out{opacity:0;pointer-events:none}" +
    "#lumaLoader .ll-box{display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px 34px;border-radius:20px;background:rgba(15,23,42,.8);border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 60px rgba(0,0,0,.45);color:rgba(255,255,255,.75);font:500 .82rem -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif}" +
    "#lumaLoader .ll-spin{width:32px;height:32px;border-radius:50%;border:3px solid rgba(255,255,255,.14);border-top-color:#3b82f6;animation:llspin .8s linear infinite}" +
    "@keyframes llspin{to{transform:rotate(360deg)}}" +
    "#lumaLoaderErr{position:fixed;inset:0;z-index:2147483001;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(5,8,18,.7);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif}" +
    "#lumaLoaderErr.on{display:flex}" +
    "#lumaLoaderErr .ll-err{max-width:340px;text-align:center;padding:26px;border-radius:18px;background:#1e293b;border:1px solid rgba(255,255,255,.1);color:#fff;line-height:1.5}" +
    "#lumaLoaderErr b{display:block;font-size:1rem;margin-bottom:6px}" +
    "#lumaLoaderErr span{display:block;color:rgba(255,255,255,.7);font-size:.82rem;margin-bottom:16px}" +
    "#lumaLoaderErr button{border:none;border-radius:12px;padding:10px 22px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font:600 .85rem inherit;font-family:inherit;cursor:pointer}";
  root.appendChild(css);

  var el = document.createElement("div");
  el.id = "lumaLoader"; el.setAttribute("role", "status");
  el.innerHTML = '<div class="ll-box"><div class="ll-spin"></div><div>Loading…</div></div>';
  root.appendChild(el);

  var errEl = document.createElement("div");
  errEl.id = "lumaLoaderErr";
  errEl.innerHTML = '<div class="ll-err"><b>Something went wrong</b><span>Please refresh the page or try again later.</span><button type="button">Refresh page</button></div>';
  errEl.querySelector("button").onclick = function () { location.reload(); };
  root.appendChild(errEl);

  function pending() { for (var k in holds) if (holds[k]) return true; return false; }
  function arm() { clearTimeout(failTimer); failTimer = setTimeout(function () { if (!gone) errEl.classList.add("on"); }, MAX_MS); }
  function show() {
    token++; gone = false; start = Date.now();
    el.classList.remove("out"); if (!el.parentNode) root.appendChild(el);
    arm();
  }
  function check() {
    if (gone || pending()) return;
    var wait = MIN_MS - (Date.now() - start);
    if (wait > 0) return setTimeout(check, wait);
    gone = true; clearTimeout(failTimer); el.classList.add("out");
    var t = token;
    setTimeout(function () { if (t === token && el.parentNode) el.parentNode.removeChild(el); }, 350);
  }

  arm();
  if (document.readyState === "complete") { holds.load = false; check(); }
  else window.addEventListener("load", function () { holds.load = false; check(); });

  window.LumaLoader = {
    hold: function (n) { holds[n] = true; },
    release: function (n) { holds[n] = false; check(); },
    // cover the screen while a Dashboard page loads its data (`work` is a promise, or nothing)
    page: function (pg, key, work) {
      if (!gone) return; // the first-load overlay is still up
      show(); var n = "page" + token; holds[n] = true;
      var done = function () { delete holds[n]; check(); };
      Promise.resolve(work).then(done, done);
    }
  };
})();
