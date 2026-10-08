// LUMA — core: ui
    function flashToast(title, body, icon, col) {
      const t = document.createElement('div'); t.className = 'notif-toast';
      t.innerHTML = `<div class="ni-ico" style="background:${col}22;color:${col}"><i class="fa-solid ${icon}"></i></div><div class="ni-main"><div class="ni-title" style="color:#fff">${escapeHtml(title)}</div>${body ? `<div class="ni-body">${escapeHtml(body)}</div>` : ''}</div>`;
      const dismiss = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
      t.onclick = dismiss; document.getElementById('notifToasts').appendChild(t); setTimeout(dismiss, 3500);
    }

    // ---------- Date filter (used by Documents and Notes) ----------
    // state = { preset: 'any'|'today'|'7d'|'30d'|'month'|'custom', from, to } with YYYY-MM-DD keys in the app time zone
    const DATE_PRESETS = [['any', 'Any time'], ['today', 'Today'], ['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['month', 'This month'], ['custom', 'Custom range']];
    const newDateFilter = () => ({ preset: 'any', from: '', to: '' });
    function dateFilterRange(st) {
      const T = mytDayKey(Date.now()), ago = n => mytDayKey(Date.now() - n * 86400000);
      switch (st.preset) {
        case 'today': return { from: T, to: T };
        case '7d': return { from: ago(6), to: T };
        case '30d': return { from: ago(29), to: T };
        case 'month': return { from: T.slice(0, 8) + '01', to: T };
        case 'custom': return (st.from || st.to) ? { from: st.from, to: st.to } : null;
        default: return null;
      }
    }
    const inDateRange = (iso, st) => { const r = dateFilterRange(st); if (!r) return true; const k = mytDayKey(iso); return (!r.from || k >= r.from) && (!r.to || k <= r.to); };
    const dfShort = k => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(k + 'T00:00:00Z'));
    function dateFilterLabel(st) {
      if (st.preset === 'custom') return st.from && st.to ? (st.from === st.to ? dfShort(st.from) : dfShort(st.from) + ' – ' + dfShort(st.to)) : st.from ? 'From ' + dfShort(st.from) : st.to ? 'Until ' + dfShort(st.to) : 'Custom range';
      return (DATE_PRESETS.find(p => p[0] === st.preset) || DATE_PRESETS[0])[1];
    }
    function paintDateFilterBtn(btn, st) {
      btn.innerHTML = `<i class="fa-regular fa-calendar"></i> ${dateFilterLabel(st)}`;
      btn.classList.toggle('on', st.preset !== 'any' && !(st.preset === 'custom' && !st.from && !st.to));
    }
    let dfPanel = null;
    function closeDateFilter() {
      if (!dfPanel) return; dfPanel.remove(); dfPanel = null;
      document.removeEventListener('mousedown', dfOutside, true); document.removeEventListener('keydown', dfKey, true); document.removeEventListener('scroll', dfScroll, true);
    }
    const dfOutside = e => { if (dfPanel && !dfPanel.contains(e.target) && !e.target.closest('.lu-cal') && !e.target.closest('.date-filter-btn')) closeDateFilter(); };
    const dfKey = e => { if (e.key === 'Escape' && !document.querySelector('.lu-cal')) closeDateFilter(); };
    const dfScroll = e => { if (dfPanel && !dfPanel.contains(e.target) && !(e.target.closest && e.target.closest('.lu-cal'))) closeDateFilter(); };
    // opens the picker under `anchor`; onChange(newState) fires on every change
    function openDateFilter(anchor, st, onChange) {
      if (dfPanel) return closeDateFilter();
      let cur = { ...st };
      const T = mytDayKey(Date.now());
      dfPanel = document.createElement('div'); dfPanel.className = 'lu-datefilter';
      const draw = () => {
        dfPanel.innerHTML = DATE_PRESETS.map(([k, l]) => `<div class="df-opt ${k === cur.preset ? 'sel' : ''}" data-p="${k}">${l}${k === cur.preset ? '<i class="fa-solid fa-check"></i>' : ''}</div>`).join('') +
          (cur.preset === 'custom' ? '<div class="df-custom"><label>From</label><input type="date" data-f="from"><label>To</label><input type="date" data-f="to"></div>' : '');
        dfPanel.querySelectorAll('input[data-f]').forEach(inp => {
          inp.max = T; inp.value = cur[inp.dataset.f] || ''; skinDate(inp);
          inp.addEventListener('change', () => {
            cur[inp.dataset.f] = inp.value;
            if (cur.from && cur.to && cur.from > cur.to) [cur.from, cur.to] = [cur.to, cur.from]; // keep the range the right way round
            onChange({ ...cur }); draw();
          });
        });
      };
      draw(); document.body.appendChild(dfPanel);
      const r = anchor.getBoundingClientRect(), w = dfPanel.offsetWidth;
      dfPanel.style.left = Math.max(10, Math.min(window.innerWidth - w - 10, r.right - w)) + 'px';
      dfPanel.style.top = (r.bottom + 8) + 'px';
      dfPanel.onclick = e => {
        const o = e.target.closest('.df-opt'); if (!o) return;
        cur.preset = o.dataset.p;
        if (cur.preset !== 'custom') { cur.from = cur.to = ''; onChange({ ...cur }); closeDateFilter(); } else { onChange({ ...cur }); draw(); }
      };
      document.addEventListener('mousedown', dfOutside, true); document.addEventListener('keydown', dfKey, true); document.addEventListener('scroll', dfScroll, true);
    }


    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    const ring = (pct, color, rv, rs, size = 64) => {
      const r = (size - 8) / 2, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
      return `<div class="ring-wrap" style="width:${size}px;height:${size}px">
        <svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(255,255,255,0.08)" stroke-width="7" fill="none"/>
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
        </svg>
        <div class="ring-label"><div class="rv">${rv}</div>${rs ? `<div class="rs">${rs}</div>` : ''}</div>
      </div>`;
    };
    const card = (inner, cls = '') => `<div class="card ${cls}">${inner}</div>`;
    const head = (title, sub, actions = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="head-actions">${actions}</div></div>`;
    const btn = (label, icon) => `<button class="create-btn">${icon ? `<i class="fa-solid ${icon}"></i>` : ''} ${label}</button>`;


    // ---------- Documents (Supabase Storage + luma.documents) ----------
    // 10 selectable colours for categories and tags
    const COLOR_PALETTE = [
      ['#3b82f6', 'Blue'], ['#38bdf8', 'Sky'], ['#14b8a6', 'Teal'], ['#22c55e', 'Green'], ['#eab308', 'Yellow'],
      ['#f97316', 'Orange'], ['#ef4444', 'Red'], ['#ec4899', 'Pink'], ['#8b5cf6', 'Purple'], ['#94a3b8', 'Grey'],
    ];
    const CAT_COLORS = COLOR_PALETTE.map(c => c[0]);
    // random colour, preferring ones not already in use so new items look distinct
    const randomColor = (used = []) => {
      const taken = new Set(used.map(c => String(c).toLowerCase()));
      const free = CAT_COLORS.filter(c => !taken.has(c));
      const pool = free.length ? free : CAT_COLORS;
      return pool[Math.floor(Math.random() * pool.length)];
    };
    // small floating palette; onPick(color) is called with the chosen hex
    let swatchPop = null;
    function closeSwatches() {
      if (!swatchPop) return;
      swatchPop.remove(); swatchPop = null;
      document.removeEventListener('mousedown', swatchOutside, true); document.removeEventListener('keydown', swatchKey, true); document.removeEventListener('scroll', closeSwatches, true);
    }
    const swatchOutside = e => { if (swatchPop && !swatchPop.contains(e.target)) closeSwatches(); };
    const swatchKey = e => { if (e.key === 'Escape') { e.stopPropagation(); closeSwatches(); } };
    function openSwatches(anchor, current, onPick) {
      closeSwatches();
      const pop = document.createElement('div'); pop.className = 'lu-swatches';
      pop.innerHTML = COLOR_PALETTE.map(([c, name]) => `<button type="button" class="sw ${c === String(current).toLowerCase() ? 'on' : ''}" data-c="${c}" title="${name}" style="background:${c}"><i class="fa-solid fa-check"></i></button>`).join('');
      document.body.appendChild(pop); swatchPop = pop;
      const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
      pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
      pop.style.top = (window.innerHeight - r.bottom < h + 12 && r.top > h + 12 ? r.top - h - 8 : r.bottom + 8) + 'px';
      pop.onclick = e => { const b = e.target.closest('.sw'); if (b) { closeSwatches(); onPick(b.dataset.c); } };
      document.addEventListener('mousedown', swatchOutside, true); document.addEventListener('keydown', swatchKey, true); document.addEventListener('scroll', closeSwatches, true);
    }
    const catColor = id => { let h = 0; for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CAT_COLORS[h % CAT_COLORS.length]; };
    const docEl = id => document.getElementById(id);

    // "Select all" for checkbox lists (.chk-list). selectAllRow() goes first in the list's
    // markup; bindSelectAll(list) once per list keeps it in sync with the items below it.
    const selectAllRow = n => n > 1 ? '<label class="cat-row sel-all" style="cursor:pointer"><input type="checkbox" data-all><span>Select all</span></label>' : '';
    function syncSelectAll(list) {
      const all = list.querySelector('[data-all]'); if (!all) return;
      const items = [...list.querySelectorAll('input[type=checkbox]:not([data-all])')];
      const on = items.filter(i => i.checked).length;
      all.checked = items.length > 0 && on === items.length;
      all.indeterminate = on > 0 && on < items.length;
      all.nextElementSibling.textContent = all.checked ? 'Deselect all' : 'Select all';
    }
    function bindSelectAll(list) {
      list.addEventListener('change', e => {
        const cb = e.target.closest('input[type=checkbox]'); if (!cb) return;
        if (cb.hasAttribute('data-all')) {
          const state = cb.checked; // read once: each item's change re-syncs (and resets) this box
          list.querySelectorAll('input[type=checkbox]:not([data-all])').forEach(i => {
            if (i.checked !== state) { i.checked = state; i.dispatchEvent(new Event('change', { bubbles: true })); }
          });
        }
        syncSelectAll(list);
      });
    }


    // Replaces a native <select> (whose popup is drawn by the OS) with a themed dropdown.
    // The real select stays in the DOM, hidden, as the source of truth: .value keeps
    // working and "change" still fires. Call again after repopulating its options.
    function skinSelect(sel) {
      if (sel._luWrap) sel._luWrap.remove();
      const wrap = document.createElement('div'); wrap.className = 'lu-select';
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'lu-sel-btn';
      if (sel.title) btn.title = sel.title;
      wrap.appendChild(btn); sel.style.display = 'none'; sel.after(wrap); sel._luWrap = wrap;
      const label = () => { const o = sel.options[sel.selectedIndex]; btn.textContent = o ? o.textContent.replace(/\u00a0/g, '') : ''; };
      label();
      let menu = null, hl = -1;
      const items = () => [...menu.querySelectorAll('.lu-opt')];
      const mark = i => { items().forEach((el, j) => el.classList.toggle('hl', j === i)); hl = i; const el = items()[i]; if (el) el.scrollIntoView({ block: 'nearest' }); };
      const close = () => {
        if (!menu) return; menu.remove(); menu = null; wrap.classList.remove('open');
        document.removeEventListener('mousedown', outside, true); window.removeEventListener('resize', close); document.removeEventListener('scroll', onScroll, true);
      };
      const onScroll = e => { if (menu && !menu.contains(e.target)) close(); };
      const outside = e => { if (!wrap.contains(e.target) && !(menu && menu.contains(e.target))) close(); };
      const pick = i => {
        const o = sel.options[i]; if (!o) return;
        const changed = sel.selectedIndex !== i; sel.selectedIndex = i; label(); close();
        if (changed) sel.dispatchEvent(new Event('change', { bubbles: true }));
      };
      const open = () => {
        if (menu) return close();
        menu = document.createElement('div'); menu.className = 'lu-sel-menu';
        menu.innerHTML = [...sel.options].map((o, i) => {
          const depth = Math.floor((o.textContent.match(/^\u00a0*/)[0].length) / 2);
          return `<div class="lu-opt ${depth ? 'sub' : ''} ${i === sel.selectedIndex ? 'sel' : ''}" data-i="${i}" style="padding-left:${10 + depth * 16}px">${escapeHtml(o.textContent.replace(/\u00a0/g, ''))}${i === sel.selectedIndex ? '<i class="fa-solid fa-check ck"></i>' : ''}</div>`;
        }).join('');
        document.body.appendChild(menu); wrap.classList.add('open');
        const r = btn.getBoundingClientRect(), mh = Math.min(menu.scrollHeight, 260);
        menu.style.minWidth = r.width + 'px'; menu.style.left = r.left + 'px';
        const below = window.innerHeight - r.bottom, up = below < mh + 16 && r.top > below;
        menu.style.top = (up ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + 'px';
        if (up) menu.style.maxHeight = Math.min(260, r.top - 14) + 'px'; else menu.style.maxHeight = Math.min(260, below - 14) + 'px';
        menu.onclick = e => { const el = e.target.closest('.lu-opt'); if (el) pick(+el.dataset.i); };
        menu.onmousemove = e => { const el = e.target.closest('.lu-opt'); if (el) mark(+el.dataset.i); };
        mark(sel.selectedIndex);
        document.addEventListener('mousedown', outside, true); window.addEventListener('resize', close);
        document.addEventListener('scroll', onScroll, true);
      };
      btn.onclick = open;
      btn.onkeydown = e => {
        if (e.key === 'Escape') { if (menu) { e.stopPropagation(); close(); } return; }
        if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) return;
        e.preventDefault();
        if (!menu) return open();
        if (e.key === 'ArrowDown') mark(Math.min(items().length - 1, hl + 1));
        else if (e.key === 'ArrowUp') mark(Math.max(0, hl - 1));
        else pick(hl);
      };
    }


    // In-app document viewer: images, PDFs, video/audio and plain text render
    // inline; anything else (Word, Excel, …) offers a download instead.
