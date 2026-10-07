// LUMA — full-screen loading cover for every page. Shows at once, stays for at least 1 second,
// and keeps going until the page (and anything it asked to wait for) has loaded.
// After 3 minutes it swaps the spinner for a "something went wrong" message.
// A page can wait for its own data:  LumaLoader.hold("name") … LumaLoader.release("name").
(function () {
  var MIN_MS = 1000, MAX_MS = 3 * 60 * 1000, start = Date.now(), holds = { load: true }, gone = false, failed = false;
  var root = document.documentElement;

  var css = document.createElement("style");
  css.textContent =
    "#lumaLoader{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:#0a0e1a;transition:opacity .35s ease}" +
    "#lumaLoader.out{opacity:0;pointer-events:none}" +
    "#lumaLoader .ll-box{display:flex;flex-direction:column;align-items:center;gap:18px;color:rgba(255,255,255,.7);font:500 .85rem -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif}" +
    "#lumaLoader .ll-logo{font:700 1.7rem -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;letter-spacing:.18em;color:#fff}" +
    "#lumaLoader .ll-spin{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.12);border-top-color:#3b82f6;animation:llspin .8s linear infinite}" +
    "@keyframes llspin{to{transform:rotate(360deg)}}" +
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
    '<div class="ll-box"><div class="ll-logo">LUMA</div><div class="ll-spin"></div><div>Loading…</div></div>' +
    '<div class="ll-err"><b>Something went wrong</b><span>Please refresh the page or try again later.</span><button type="button">Refresh page</button></div>';
  el.querySelector("button").onclick = function () { location.reload(); };
  root.appendChild(el);

  function pending() { for (var k in holds) if (holds[k]) return true; return false; }
  function check() {
    if (gone || failed || pending()) return;
    var wait = MIN_MS - (Date.now() - start);
    if (wait > 0) return setTimeout(check, wait);
    gone = true; el.classList.add("out");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 450);
  }

  setTimeout(function () { if (gone) return; failed = true; el.classList.add("fail"); }, MAX_MS);
  if (document.readyState === "complete") { holds.load = false; check(); }
  else window.addEventListener("load", function () { holds.load = false; check(); });

  window.LumaLoader = {
    hold: function (n) { holds[n] = true; },
    release: function (n) { holds[n] = false; check(); }
  };
})();
