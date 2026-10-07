// LUMA — skeleton loading screens.
//  • First load of any page: a skeleton of the page shape (form on Login/Register/Reset, app layout on the Dashboard).
//    It stays at least 1 second and keeps going until the page (and anything it asked to wait for) has loaded.
//  • Moving between Dashboard pages: shimmering skeleton blocks sit exactly where that page's data goes
//    (header, sidebar and top bar stay usable).
//  • Anything still loading after 3 minutes → "something went wrong" popup.
// A page can wait for its own data:  LumaLoader.hold("name") … LumaLoader.release("name").
(function () {
  var MIN_MS = 1000, MAX_MS = 3 * 60 * 1000, root = document.documentElement;
  var holds = { load: true }, first = { start: Date.now(), gone: false }, el = null;

  var css = document.createElement("style");
  css.textContent =
    ".ll-sk{border-radius:14px;background:linear-gradient(100deg,rgba(255,255,255,.07) 30%,rgba(255,255,255,.17) 50%,rgba(255,255,255,.07) 70%);background-size:300% 100%;animation:llshine 1.4s ease-in-out infinite}" +
    "@keyframes llshine{from{background-position:100% 0}to{background-position:0 0}}" +
    ".ll-c{border-radius:18px;padding:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:12px;min-width:0}" +
    ".ll-r{display:grid;gap:14px}.ll-fl{display:flex;gap:12px;align-items:center}" +
    "#lumaLoader{position:fixed;inset:0;z-index:2147483000;background:#0a0e1a;transition:opacity .35s ease;overflow:hidden}" +
    "#lumaLoader.out{opacity:0;pointer-events:none}" +
    "#lumaLoader .ll-form{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:20px}" +
    "#lumaLoader .ll-form .ll-c{width:min(400px,100%);padding:26px;gap:14px}" +
    "#lumaLoader .ll-app{position:absolute;inset:0;display:flex;gap:16px;padding:16px}" +
    "#lumaLoader .ll-side{width:210px;flex:none;display:flex;flex-direction:column;gap:12px}" +
    "#lumaLoader .ll-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:16px}" +
    "@media(max-width:768px){#lumaLoader .ll-side{display:none}}" +
    ".ll-layer{position:absolute;left:0;right:0;bottom:0;z-index:20;overflow:hidden;padding:2px 6px 0 0;border-radius:18px;background:rgba(15,23,42,.5);-webkit-backdrop-filter:blur(26px);backdrop-filter:blur(26px);display:flex;flex-direction:column;gap:14px;transition:opacity .3s ease}" +
    ".ll-layer.out{opacity:0;pointer-events:none}" +
    "#lumaLoaderErr{position:fixed;inset:0;z-index:2147483001;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(5,8,18,.7);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif}" +
    "#lumaLoaderErr.on{display:flex}" +
    "#lumaLoaderErr .ll-err{max-width:340px;text-align:center;padding:26px;border-radius:18px;background:#1e293b;border:1px solid rgba(255,255,255,.1);color:#fff;line-height:1.5}" +
    "#lumaLoaderErr b{display:block;font-size:1rem;margin-bottom:6px}" +
    "#lumaLoaderErr span{display:block;color:rgba(255,255,255,.7);font-size:.82rem;margin-bottom:16px}" +
    "#lumaLoaderErr button{border:none;border-radius:12px;padding:10px 22px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font:600 .85rem inherit;font-family:inherit;cursor:pointer}";
  root.appendChild(css);

  // ---- skeleton shapes ----
  var B = function (h, w, x) { return '<div class="ll-sk" style="height:' + h + 'px;' + (w ? 'width:' + w + ';' : '') + (x || '') + '"></div>'; };
  var rep = function (n, f) { var s = ""; for (var i = 0; i < n; i++) s += f(i); return s; };
  var card = function (h) { return '<div class="ll-c" style="height:' + h + 'px">' + B(16, "45%") + B(10, "80%") + B(10, "65%") + '</div>'; };
  var rowItem = function () { return '<div class="ll-c" style="flex-direction:row;align-items:center;padding:14px">' + B(38, "38px", "border-radius:50%;flex:none") + '<div style="flex:1;display:flex;flex-direction:column;gap:8px">' + B(12, "40%") + B(9, "70%") + '</div>' + B(26, "60px") + '</div>'; };
  var SHAPES = {
    stats: function () { return '<div class="ll-r" style="grid-template-columns:repeat(3,1fr)">' + rep(3, function () { return card(110); }) + '</div><div class="ll-r" style="grid-template-columns:repeat(2,1fr)">' + card(220) + card(220) + '</div>' + card(110); },
    cols: function () { return '<div class="ll-r" style="grid-template-columns:repeat(3,1fr);flex:1">' + rep(3, function () { return '<div class="ll-c" style="gap:12px">' + B(18, "40%") + rep(3, function () { return '<div class="ll-c" style="padding:14px">' + B(12, "70%") + B(9, "50%") + '</div>'; }) + '</div>'; }) + '</div>'; },
    grid: function () { return '<div class="ll-r" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">' + rep(6, function () { return card(150); }) + '</div>'; },
    list: function () { return rep(6, rowItem); },
    split: function () { return '<div class="ll-r" style="grid-template-columns:1fr 320px;flex:1"><div style="display:flex;flex-direction:column;gap:12px">' + rep(5, rowItem) + '</div>' + card(300) + '</div>'; },
    calendar: function () { return '<div class="ll-c" style="flex:1">' + '<div class="ll-fl">' + B(28, "200px") + '<div style="flex:1"></div>' + B(28, "260px") + '</div><div class="ll-r" style="grid-template-columns:repeat(7,1fr);flex:1;grid-auto-rows:1fr">' + rep(35, function () { return B(0, null, "height:auto;min-height:48px;border-radius:10px"); }) + '</div></div>'; }
  };
  var KIND = { dashboard: "stats", analytics: "stats", money: "stats", health: "stats", tasks: "cols", calendar: "calendar", documents: "grid", notes: "grid", goals: "grid", habits: "split", bills: "list", subscriptions: "list", contacts: "split", notifications: "list", planner: "list" };

  // ---- first-load cover ----
  var isApp = /Dashboard/i.test(decodeURIComponent(location.pathname));
  function buildFirst() {
    el = document.createElement("div"); el.id = "lumaLoader"; el.setAttribute("aria-label", "Loading");
    el.innerHTML = isApp
      ? '<div class="ll-app"><div class="ll-side">' + B(40, "60%") + rep(8, function () { return B(34); }) + '</div><div class="ll-main">' + B(56) + B(28, "220px") + SHAPES.stats() + '</div></div>'
      : '<div class="ll-form"><div class="ll-c">' + B(30, "40%") + B(12, "70%") + B(44) + B(44) + B(46, null, "margin-top:6px") + B(12, "50%", "align-self:center") + '</div></div>';
    root.appendChild(el);
  }
  buildFirst();

  var errEl = document.createElement("div");
  errEl.id = "lumaLoaderErr";
  errEl.innerHTML = '<div class="ll-err"><b>Something went wrong</b><span>Please refresh the page or try again later.</span><button type="button">Refresh page</button></div>';
  errEl.querySelector("button").onclick = function () { location.reload(); };
  root.appendChild(errEl);
  var fail = function () { errEl.classList.add("on"); };

  function pending() { for (var k in holds) if (holds[k]) return true; return false; }
  var firstFail = setTimeout(function () { if (!first.gone) fail(); }, MAX_MS);
  function check() {
    if (first.gone || pending()) return;
    var wait = MIN_MS - (Date.now() - first.start);
    if (wait > 0) return setTimeout(check, wait);
    first.gone = true; clearTimeout(firstFail); el.classList.add("out");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
  }
  if (document.readyState === "complete") { holds.load = false; check(); }
  else window.addEventListener("load", function () { holds.load = false; check(); });

  window.LumaLoader = {
    hold: function (n) { holds[n] = true; },
    release: function (n) { holds[n] = false; check(); },
    // skeleton blocks over a Dashboard page's data area (below its heading) while `work` loads; at least 1 second
    page: function (pg, key, work) {
      if (!pg || !first.gone) return; // the first-load skeleton is still up
      var old = pg.querySelector(":scope > .ll-layer"); if (old) old.remove();
      var head = pg.querySelector(":scope > .page-head");
      var top = head ? head.offsetTop + head.offsetHeight + parseFloat(getComputedStyle(head).marginBottom || 0) : 0;
      if (getComputedStyle(pg).position === "static") pg.style.position = "relative";
      var layer = document.createElement("div"); layer.className = "ll-layer"; layer.style.top = top + "px";
      layer.innerHTML = (SHAPES[KIND[key] || "grid"])();
      pg.appendChild(layer);
      var start = Date.now(), over = false;
      var timer = setTimeout(function () { if (!over) fail(); }, MAX_MS);
      var done = function () {
        var wait = Math.max(0, MIN_MS - (Date.now() - start));
        setTimeout(function () { over = true; clearTimeout(timer); layer.classList.add("out"); setTimeout(function () { layer.remove(); }, 350); }, wait);
      };
      Promise.resolve(work).then(done, done);
    }
  };
})();
