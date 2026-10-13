// LUMA — core: plan usage ("3 / 5 habits")
    // Shows how much of a plan limit has been used, in the header of every page that has one, and all of them together in the Plans popup.
    // The counts come from luma.my_usage() (migration 096); the limits come from the person's plan (LumaPlan.get), so an edit in
    // Admin → Plan limits shows up here too. Click a chip to see the plans.
    window.LumaUsage = (function () {
      const MB = 1048576;
      // key → how it is counted and written. `lim` is the plan limit key; `use` reads the number from luma.my_usage()
      const METERS = {
        storage: { lim: 'storage_mb', use: u => u.storage_bytes / MB, label: 'total file storage', unit: 'MB', dec: 1, icon: 'fa-hard-drive', note: () => {
          const f = LumaPlan.get('file_mb'), u = data || {}, mb = b => Math.round((b || 0) / MB * 10) / 10 + ' MB';
          // Documents, Study files and Work task files all draw from the same allowance, so say where it went
          const parts = [['Personal', u.storage_docs], ['Study', u.storage_study], ['Work', u.storage_work]].filter(x => x[1] > 0).map(x => x[0] + ' ' + mb(x[1]));
          return [f == null ? '' : `up to ${f} MB per file`, parts.length > 1 || (parts.length === 1 && !parts[0].startsWith('Personal')) ? 'in ' + parts.join(' · ') : ''].filter(Boolean).join(' · ');
        } },
        reminders: { lim: 'reminders', use: u => u.reminders, label: 'custom reminders', icon: 'fa-bell' },
        habits: { lim: 'habits', use: u => u.habits, label: 'habits', icon: 'fa-repeat' },
        goals: { lim: 'goals', use: u => u.goals, label: 'active goals', icon: 'fa-bullseye' },
        bills: { lim: 'bills', use: u => u.bills, label: 'bills & subscriptions', icon: 'fa-file-invoice-dollar' },
        contacts: { lim: 'contacts', use: u => u.contacts, label: 'contacts', icon: 'fa-user-group' },
        chat: { lim: 'chat_messages', use: u => u.chat_today, label: 'chat messages today', icon: 'fa-comment' },
        lumi: { lim: 'lumi_questions', use: u => u.lumi_used, label: 'Lumi questions today', icon: 'fa-wand-magic-sparkles' },
        insights: { lim: 'insights', use: u => u.insights_used, label: 'AI insights today', icon: 'fa-chart-line' },
      };
      // which meters each page shows in its header (Lumi and Analytics already show their own "left today")
      const PAGES = { reminders: ['reminders'], habits: ['habits'], goals: ['goals'], bills: ['bills'], subscriptions: ['bills'], contacts: ['contacts', 'chat'], documents: ['storage'], study: ['storage'], work: ['storage'] };

      let data = null, at = 0, inflight = null, current = null, observer = null, tick = null;
      const css = document.createElement('style');
      css.textContent = `.usage-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.usage-chip{display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:99px;font:600 0.72rem inherit;font-family:inherit;color:rgba(255,255,255,0.85);background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);cursor:pointer;white-space:nowrap;max-width:100%}
.usage-chip .uc-bar{width:44px;height:5px;border-radius:9px;background:rgba(255,255,255,0.14);overflow:hidden;flex:none}.usage-chip .uc-bar i{display:block;height:100%;border-radius:9px;background:#34d399}
.usage-chip.warn{color:#fcd34d;border-color:rgba(251,191,36,0.4)}.usage-chip.warn .uc-bar i{background:#fbbf24}
.usage-chip.full{color:#fca5a5;border-color:rgba(248,113,113,0.45)}.usage-chip.full .uc-bar i{background:#f87171}
.usage-chip.unl{color:rgba(255,255,255,0.7)}
.usage-split{margin:2px 0 12px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.8rem}.usage-split .us-h{font-weight:600;margin-bottom:8px}.usage-split .us-r{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px solid rgba(255,255,255,0.08)}.usage-split .us-r:first-of-type{border-top:none}.usage-split .us-r b{color:#fff}.usage-split .us-r.hot{color:#fcd34d}.usage-split small{display:block;margin-top:8px;color:rgba(255,255,255,0.7);line-height:1.5}
.usage-chip small{font-weight:400;opacity:0.7;white-space:normal}
.usage-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:10px}
.usage-item{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);font-size:0.78rem;color:#fff}.usage-item i.fa-solid{margin-right:4px;opacity:0.85}
.usage-item b{display:block;font-size:0.9rem;margin:2px 0 6px;color:#fff}.usage-item .uc-bar{display:block;height:5px;border-radius:9px;background:rgba(255,255,255,0.14);overflow:hidden}.usage-item .uc-bar i{display:block;height:100%;background:#34d399}
.usage-item.warn .uc-bar i{background:#fbbf24}.usage-item.full .uc-bar i{background:#f87171}.usage-item small{display:block;margin-top:6px;color:rgba(255,255,255,0.75)}`;
      document.head.appendChild(css);

      const num = (v, dec) => dec ? (Math.round(v * 10 ** dec) / 10 ** dec).toLocaleString('en-US', { maximumFractionDigits: dec }) : Math.round(v).toLocaleString('en-US');
      // what one meter looks like right now: { text, pct, lvl, unlimited, note }
      function figure(k) {
        const m = METERS[k], u = data; if (!m || !u) return null;
        const used = m.use(u), lim = LumaPlan.get(m.lim), unit = m.unit ? ' ' + m.unit : '';
        if (lim === null || lim === undefined) return { text: m.unit ? `${num(used, m.dec)}${unit} used · unlimited` : `${num(used)} ${m.label} · unlimited`, unlimited: true, pct: 0, lvl: '', note: m.note ? m.note() : '' };
        if (lim === 0) return null; // not part of the plan at all (e.g. insights on Dawn): the page says so itself
        const pct = Math.min(100, used / lim * 100);
        return { text: `${num(used, m.dec)} / ${num(lim)}${unit} ${m.label}`, pct, lvl: used >= lim ? 'full' : pct >= 80 ? 'warn' : '', unlimited: false, note: m.note ? m.note() : '' };
      }
// where the shared file storage went: Documents, Study files and Work task files all count toward the same allowance
      function splitHtml() {
        const u = data; if (!u || u.storage_docs === undefined) return '';
        const mb = b => (Math.round((b || 0) / MB * 10) / 10).toLocaleString('en-US') + ' MB';
        const rows = [['Personal documents', u.storage_docs, true], ['Study', u.storage_study, LumaPlan.hasAddon('study') || u.storage_study > 0], ['Work', u.storage_work, LumaPlan.hasAddon('work') || u.storage_work > 0]].filter(x => x[2]);
        if (rows.length < 2) return '';
        return `<div class="usage-split"><div class="us-h"><i class="fa-solid fa-hard-drive"></i> Where your file storage is used</div>${rows.map(x => `<div class="us-r ${x[0] !== 'Personal documents' && x[1] > 0 ? 'hot' : ''}"><span>${x[0]}${x[0] === 'Personal documents' ? '' : ' documents'}</span><b>${mb(x[1])}</b></div>`).join('')}<small>Personal documents, Study documents and Work documents share one storage allowance. Study and Work files are kept in their own mode, so they are not listed on the personal Documents page.</small></div>`;
      }
      const chipHtml = k => { const f = figure(k); if (!f) return ''; return `<button type="button" class="usage-chip ${f.unlimited ? 'unl' : f.lvl}" data-usage="${k}" title="Tap to see all your usage"><span>${f.text}</span>${f.unlimited ? '' : `<span class="uc-bar"><i style="width:${f.pct}%"></i></span>`}${f.note ? `<small>· ${f.note}</small>` : ''}</button>`; };

      async function load(force) {
        if (!force && data && Date.now() - at < 15000) return data;
        if (inflight) return inflight;
        inflight = (async () => {
          try { const r = await LumaAuth.client.schema('luma').rpc('my_usage'); if (!r.error && r.data) { data = r.data; at = Date.now(); } } catch (e) { /* keep the last numbers */ }
          inflight = null; return data;
        })();
        return inflight;
      }

      function paintPage(key) {
        const pg = document.getElementById('page-' + key), ks = PAGES[key]; if (!pg || !ks || !data) return;
        const head = pg.querySelector('.page-head'); if (!head) return;
        let row = pg.querySelector('.usage-row');
        if (!row) { row = document.createElement('div'); row.className = 'usage-row'; (head.firstElementChild || head).appendChild(row); }
        const html = ks.map(chipHtml).join(''); if (row.innerHTML !== html) row.innerHTML = html;
      }
      function stop() { if (observer) { observer.disconnect(); observer = null; } clearTimeout(tick); current = null; }
      async function show(key) {
        stop(); if (!PAGES[key]) return;
        current = key; await load(); if (current !== key) return; paintPage(key);
        // when the page changes (an item is added or deleted) the numbers are asked for again, a moment later
        const pg = document.getElementById('page-' + key); if (!pg || !('MutationObserver' in window)) return;
        observer = new MutationObserver(ms => {
          if (ms.every(m => m.target.closest && m.target.closest('.usage-row'))) return;
          clearTimeout(tick); tick = setTimeout(async () => { if (current !== key) return; await load(true); if (current === key) paintPage(key); }, 1200);
        });
        observer.observe(pg, { childList: true, subtree: true });
      }
      // every meter at once, for the Settings page
      async function paintList(boxId) {
        const box = document.getElementById(boxId); if (!box) return;
        await load(true);
        const items = Object.keys(METERS).map(k => { const f = figure(k), m = METERS[k]; return f ? `<div class="usage-item ${f.unlimited ? '' : f.lvl}"><i class="fa-solid ${m.icon}"></i> ${m.label[0].toUpperCase() + m.label.slice(1)}<b>${f.text.replace(' ' + m.label, '')}</b>${f.unlimited ? '' : `<span class="uc-bar"><i style="width:${f.pct}%"></i></span>`}${f.note ? `<small>${f.note}</small>` : ''}</div>` : ''; }).join('');
        box.innerHTML = items ? `<div class="usage-list">${items}</div>${splitHtml()}` : '';
      }
// the popup opened by tapping a chip
      function openPopup() {
        let ov = document.getElementById('usageOverlay');
        if (!ov) {
          ov = document.createElement('div'); ov.className = 'modal-overlay confirm-overlay'; ov.id = 'usageOverlay';
          ov.innerHTML = `<div class="profile-edit-modal fixed-modal" style="width:640px;max-width:100%"><div class="pem-head"><div class="pem-title">Your usage</div><button class="x" id="usageClose" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div><div class="pem-body"><div class="ls" id="usageSub" style="margin-bottom:12px"></div><div id="usagePopList"></div><button type="button" class="np-btn" id="usagePlans" style="margin-top:4px"><i class="fa-solid fa-layer-group"></i> See plans</button></div></div>`;
          document.body.appendChild(ov);
          const close = () => ov.classList.remove('open');
          ov.addEventListener('click', e => { if (e.target === ov) close(); });
          ov.querySelector('#usageClose').onclick = close;
          ov.querySelector('#usagePlans').onclick = () => { close(); if (typeof openPlans === 'function') openPlans(); };
          document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
        }
        ov.querySelector('#usageSub').textContent = `Your ${LumaPlan.name()} plan. Daily counts start again at midnight.`;
        ov.classList.add('open'); paintList('usagePopList');
      }
      document.addEventListener('click', e => { const c = e.target.closest('.usage-chip[data-usage]'); if (c) openPopup(); });
      return { show, stop, load, paintList, refresh: () => load(true).then(() => current && paintPage(current)) };
    })();
