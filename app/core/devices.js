// LUMA — core: your devices
    // Every phone or computer signed in to the account registers itself in luma.user_devices (migration 100) when LUMA opens, and
    // again every few hours while it stays open. Settings → Your devices lists them. Signing out (here or "Sign out other devices")
    // removes the rows, so the list only holds devices that are still signed in.
    window.LumaDevices = (function () {
      const KEY = 'luma_device_id', TOUCH = 'luma_device_touch', EVERY = 6 * 3600 * 1000;
      const db = () => LumaAuth.client.schema('luma');
      function id() {
        let v = null; try { v = localStorage.getItem(KEY); } catch (e) { }
        if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)); try { localStorage.setItem(KEY, v); } catch (e) { } }
        return v;
      }
      function describe() {
        const ua = navigator.userAgent || '';
        const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : 'Device';
        const br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
        const app = (matchMedia('(display-mode: standalone)').matches || navigator.standalone) ? 'LUMA app' : br;
        const kind = /iPhone|Android.*Mobile/.test(ua) ? 'phone' : /iPad|Android/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'tablet' : 'computer';
        return { label: os + ' · ' + app, kind };
      }
      async function touch(force) {
        try {
          if (!force) { const last = +localStorage.getItem(TOUCH) || 0; if (Date.now() - last < EVERY) return; }
          const d = describe(); await db().rpc('touch_device', { p_device: id(), p_label: d.label, p_kind: d.kind });
          localStorage.setItem(TOUCH, String(Date.now()));
        } catch (e) { /* the list is a convenience; never block the app */ }
      }
      async function list() { const r = await db().from('user_devices').select('device_id,label,kind,last_seen,created_at').order('last_seen', { ascending: false }); return r.error ? [] : r.data; }
      async function forgetThis() { try { await db().from('user_devices').delete().eq('device_id', id()); } catch (e) { } }
      async function forgetOthers() { try { await db().from('user_devices').delete().neq('device_id', id()); } catch (e) { } }
      function ago(iso) {
        const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
        if (m < 5) return 'Active now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
        return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      }
      const ICON = { phone: 'fa-mobile-screen-button', tablet: 'fa-tablet-screen-button', computer: 'fa-laptop' };
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      async function paint(box) {
        box.innerHTML = '<div class="ls">Loading…</div>';
        const rows = await list(), me = id();
        box.innerHTML = rows.length ? rows.map(r => `<div class="dev-row"><div class="dev-ico"><i class="fa-solid ${ICON[r.kind] || ICON.computer}"></i></div><div class="dev-main"><div class="dev-t">${esc(r.label)}${r.device_id === me ? ' <span class="dev-this">This device</span>' : ''}</div><div class="dev-s">${r.device_id === me ? 'Active now' : ago(r.last_seen)} · first signed in ${new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div></div></div>`).join('')
          : '<div class="ls">No devices to show yet.</div>';
      }
      const css = document.createElement('style');
      css.textContent = `.dev-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid rgba(255,255,255,0.08)}.dev-row:first-child{border-top:none}
.dev-ico{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:none;background:rgba(255,255,255,0.07);color:#fff}.dev-main{min-width:0;flex:1}
.dev-t{color:#fff;font-size:0.88rem;font-weight:600;overflow-wrap:anywhere}.dev-s{color:rgba(255,255,255,0.7);font-size:0.74rem;margin-top:2px}
.dev-this{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:99px;font-size:0.66rem;font-weight:600;color:#6ee7b7;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.35);white-space:nowrap}`;
      document.head.appendChild(css);
      return { id, touch, list, paint, forgetThis, forgetOthers };
    })();
