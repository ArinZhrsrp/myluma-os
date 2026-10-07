// LUMA — full-screen loading cover for every page. Shows at once, stays for at least 1 second,
// and keeps going until the page (and anything it asked to wait for) has loaded.
// After 3 minutes it swaps the spinner for a "something went wrong" message.
// A page can wait for its own data:  LumaLoader.hold("name") … LumaLoader.release("name").
(function () {
  var MIN_MS = 1000, MAX_MS = 3 * 60 * 1000, start = Date.now(), holds = { load: true }, gone = false, failed = false;
  var root = document.documentElement;

  var css = document.createElement("style");
  css.textContent =
    "#lumaLoader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(10,14,26,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:opacity .35s ease}" +
    "#lumaLoader.out{opacity:0;pointer-events:none}" +
    "#lumaLoader .ll-box{width:min(1100px,92vw);max-height:92vh;overflow:hidden;display:flex;flex-direction:column;gap:16px}" +
    "#lumaLoader .ll-row{display:grid;gap:16px}" +
    "#lumaLoader .ll-sk{border-radius:18px;background:linear-gradient(100deg,rgba(255,255,255,.07) 30%,rgba(255,255,255,.16) 50%,rgba(255,255,255,.07) 70%);background-size:300% 100%;animation:llshine 1.4s ease-in-out infinite}" +
    "@keyframes llshine{from{background-position:100% 0}to{background-position:0 0}}" +
    "#lumaLoader .ll-err{display:none;max-width:340px;text-align:center;padding:24px;border-radius:18px;background:rgba(30,41,59,.9);border:1px solid rgba(255,255,255,.1);color:#fff;line-height:1.5}" +
    "#lumaLoader .ll-err b{display:block;font-size:1rem;margin-bottom:6px}" +
    "#lumaLoader .ll-err span{display:block;color:rgba(255,255,255,.7);font-size:.82rem;margin-bottom:16px}" +
    "#lumaLoader .ll-err button{border:none;border-radius:12px;padding:10px 22px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font:600 .85rem inherit;font-family:inherit;cursor:pointer}" +
    "#lumaLoader.fail .ll-box{display:none}#lumaLoader.fail .ll-err{display:block}";
  root.appendChild(css);

  var el = document.createElement("div");
  el.id = "lumaLoader";
  el.setAttribute("role", "status");
  el.innerHTML =
    '<div class="ll-box" aria-label="Loading">' +
    '<div class="ll-sk" style="height:26px;width:220px;border-radius:10px"></div><div class="ll-sk" style="height:14px;width:340px;border-radius:8px;margin-top:-6px"></div>' +
    '<div class="ll-row" style="grid-template-columns:repeat(3,1fr)"><div class="ll-sk" style="height:110px"></div><div class="ll-sk" style="height:110px"></div><div class="ll-sk" style="height:110px"></div></div>' +
    '<div class="ll-row" style="grid-template-columns:repeat(2,1fr)"><div class="ll-sk" style="height:200px"></div><div class="ll-sk" style="height:200px"></div></div>' +
    '<div class="ll-sk" style="height:90px"></div></div>' +
    '<div class="ll-err"><b>Something went wrong</b><span>Please refresh the page or try again later.</span><button type="button">Refresh page</button></div>';
  el.querySelector("button").onclick = function () { location.reload(); };
  root.appendChild(el);

  // one cover at a time; every show() restarts the 1-second minimum and the 3-minute limit
  var token = 0, failTimer = null;
  function show() {
    token++; gone = false; failed = false; start = Date.now();
    el.classList.remove("out", "fail");
    if (!el.parentNode) root.appendChild(el);
    clearTimeout(failTimer);
    var t = token;
    failTimer = setTimeout(function () { if (!gone && t === token) { failed = true; el.classList.add("fail"); } }, MAX_MS);
  }
  function pending() { for (var k in holds) if (holds[k]) return true; return false; }
  function check() {
    if (gone || failed || pending()) return;
    var wait = MIN_MS - (Date.now() - start);
    if (wait > 0) return setTimeout(check, wait);
    gone = true; clearTimeout(failTimer); el.classList.add("out");
    var t = token;
    setTimeout(function () { if (t === token && el.parentNode) el.parentNode.removeChild(el); }, 450);
  }

  failTimer = setTimeout(function () { if (!gone) { failed = true; el.classList.add("fail"); } }, MAX_MS);
  if (document.readyState === "complete") { holds.load = false; check(); }
  else window.addEventListener("load", function () { holds.load = false; check(); });

  window.LumaLoader = {
    hold: function (n) { holds[n] = true; },
    release: function (n) { holds[n] = false; check(); },
    // cover the screen while `work` (a promise) is loading, for at least 1 second
    run: function (work) {
      if (pending()) return; // the first-load cover is still up
      show(); var n = "run" + token; holds[n] = true;
      var done = function () { delete holds[n]; check(); };
      Promise.resolve(work).then(done, done);
    }
  };
})();
