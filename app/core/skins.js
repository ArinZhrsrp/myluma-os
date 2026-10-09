// LUMA — core: skins
    bindSelectAll(docEl('shareList')); bindSelectAll(docEl('attachList'));

    // Number fields get small up/down buttons (click, or hold to repeat). The native spinner is hidden for a
    // cleaner look; the buttons use stepUp/stepDown, so min/max/step are respected, and fire a normal "input" event.
    function skinNumber(input, step) {
      if (input._luNum) return; input._luNum = true;
      if (step) input.step = step;
      const wrap = document.createElement('div'); wrap.className = 'num-wrap';
      input.before(wrap); wrap.appendChild(input);
      const btns = document.createElement('div'); btns.className = 'num-btns';
      btns.innerHTML = '<button type="button" tabindex="-1" data-d="1" title="Increase"><i class="fa-solid fa-chevron-up"></i></button><button type="button" tabindex="-1" data-d="-1" title="Decrease"><i class="fa-solid fa-chevron-down"></i></button>';
      wrap.appendChild(btns);
      const bump = d => { try { d > 0 ? input.stepUp() : input.stepDown(); } catch (e) { } input.dispatchEvent(new Event('input', { bubbles: true })); };
      let hold = null, rep = null;
      const stop = () => { clearTimeout(hold); clearInterval(rep); };
      btns.addEventListener('mousedown', e => {
        const b = e.target.closest('button'); if (!b) return; e.preventDefault(); // keep focus in the field
        const d = +b.dataset.d; bump(d); hold = setTimeout(() => { rep = setInterval(() => bump(d), 70); }, 400);
      });
      ['mouseup', 'mouseleave'].forEach(t => btns.addEventListener(t, stop)); document.addEventListener('mouseup', stop);
      input.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); bump(e.key === 'ArrowUp' ? 1 : -1); } });
    }
    [['qSleep', 0.5], ['qWater', 50], ['qSteps', 100], ['qActive', 5], ['hSleep', 0.5], ['hWater', 100], ['hSteps', 100], ['hActive', 5], ['gSleep', 0.5], ['gWater', 100], ['gSteps', 500], ['gActive', 5]].forEach(([id, st]) => skinNumber(document.getElementById(id), st));

    // Themed calendar date picker. The real <input type=date> stays in the DOM, hidden, as the source of
    // truth (value, min, max, "change" event); call input._luDateRefresh() after setting .value from code.
    // The same popup opens from anywhere with luDatePopup(anchor, { value, min, max, onPick(key) }): the month arrows,
    // a tap on the month name for a month and year (the year can be typed), and a box to type a whole date.
    function luDatePopup(anchor, o) {
      let pop = null, vy = 0, vm = 0, mode = 'days', err = '';
      const keyOf = d => d.toISOString().slice(0, 10), todayK = () => mytDayKey(Date.now());
      const ymin = o.min ? +o.min.slice(0, 4) : 1900, ymax = o.max ? +o.max.slice(0, 4) : 2100;
      const pad = n => String(n).padStart(2, '0');
      const close = () => { if (!pop) return; pop.remove(); pop = null; anchor.classList && anchor.classList.remove('open'); if (o.onClose) o.onClose(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', onKey, true); document.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', close); };
      const outside = e => { if (pop && !pop.contains(e.target) && !anchor.contains(e.target)) close(); };
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
      const onScroll = e => { if (pop && !pop.contains(e.target)) close(); };
      const pick = k => { close(); o.onPick(k); };
      // "25/12/2026", "25-12-2026", "25.12.26" or "2026-12-25"
      const parse = t => { t = String(t || '').trim(); let y, m, d, x;
        if ((x = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) { y = +x[1]; m = +x[2]; d = +x[3]; }
        else if ((x = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(t))) { d = +x[1]; m = +x[2]; y = x[3].length === 2 ? 2000 + +x[3] : +x[3]; }
        else return null;
        const dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? keyOf(dt) : null; };
      const ok = k => !((o.max && k > o.max) || (o.min && k < o.min));
      const draw = () => {
        const max = o.max || '', min = o.min || '', foot = `<div class="lu-cal-foot"><button type="button" data-today ${max && todayK() > max ? 'disabled' : ''}>Today</button><button type="button" data-close>Close</button></div>`;
        if (mode === 'ym') {
          const names = Array.from({ length: 12 }, (_, i) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'short' }).format(new Date(Date.UTC(2000, i, 1))));
          pop.innerHTML = `<div class="lu-cal-head"><button type="button" class="lu-cal-title" data-back title="Back to the days"><i class="fa-solid fa-chevron-left"></i> Month and year</button><div class="lu-cal-nav"><button type="button" data-yr="-1" ${vy <= ymin ? 'disabled' : ''} title="Previous year"><i class="fa-solid fa-angles-left"></i></button><button type="button" data-yr="1" ${vy >= ymax ? 'disabled' : ''} title="Next year"><i class="fa-solid fa-angles-right"></i></button></div></div>
            <div class="lu-cal-yr"><label>Year</label><input type="number" class="lu-cal-year" inputmode="numeric" min="${ymin}" max="${ymax}" value="${vy}" aria-label="Year"></div>
            <div class="lu-cal-months">${names.map((n, i) => { const f = `${vy}-${pad(i + 1)}-01`, l = keyOf(new Date(Date.UTC(vy, i + 1, 0))); return `<button type="button" class="${i === vm ? 'sel' : ''}" data-mo="${i}" ${(max && f > max) || (min && l < min) ? 'disabled' : ''}>${n}</button>`; }).join('')}</div>
            <div class="lu-cal-type"><label>Or type the date</label><div><input type="text" class="lu-cal-typed" placeholder="DD/MM/YYYY" inputmode="numeric" autocomplete="off" aria-label="Type a date"><button type="button" data-go>Go</button></div><div class="lu-cal-err">${err}</div></div>${foot}`;
          return;
        }
        const first = new Date(Date.UTC(vy, vm, 1)), offset = (first.getUTCDay() + 6) % 7; // weeks start on Monday
        const title = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(first);
        let cells = '';
        for (let i = 0; i < 42; i++) {
          const d = new Date(Date.UTC(vy, vm, 1 - offset + i)), k = keyOf(d), out = d.getUTCMonth() !== vm;
          cells += `<button type="button" class="lu-cal-day ${out ? 'out' : ''} ${k === todayK() ? 'today' : ''} ${k === o.value ? 'sel' : ''}" data-k="${k}" ${ok(k) ? '' : 'disabled'}>${d.getUTCDate()}</button>`;
        }
        const nextFirst = keyOf(new Date(Date.UTC(vy, vm + 1, 1))), prevLast = keyOf(new Date(Date.UTC(vy, vm, 0)));
        pop.innerHTML = `<div class="lu-cal-head"><button type="button" class="lu-cal-title" data-ym title="Choose a month and year">${title} <i class="fa-solid fa-caret-down"></i></button><div class="lu-cal-nav">
            <button type="button" data-nav="-1" ${min && prevLast < min ? 'disabled' : ''}><i class="fa-solid fa-chevron-left"></i></button>
            <button type="button" data-nav="1" ${max && nextFirst > max ? 'disabled' : ''}><i class="fa-solid fa-chevron-right"></i></button></div></div>
          <div class="lu-cal-grid">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(w => `<div class="lu-cal-wd">${w}</div>`).join('')}${cells}</div>${foot}`;
      };
      const place = () => { const r = anchor.getBoundingClientRect(), h = pop.offsetHeight; pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left)) + 'px'; pop.style.top = Math.max(8, window.innerHeight - r.bottom < h + 12 && r.top > h + 12 ? r.top - h - 8 : r.bottom + 8) + 'px'; };
      const yearNow = () => { const i = pop.querySelector('.lu-cal-year'); const y = i ? parseInt(i.value, 10) : vy; return y >= ymin && y <= ymax ? y : vy; };
      const base = o.value ? new Date(o.value + 'T00:00:00Z') : new Date(todayK() + 'T00:00:00Z');
      vy = base.getUTCFullYear(); vm = base.getUTCMonth();
      pop = document.createElement('div'); pop.className = 'lu-cal'; document.body.appendChild(pop); anchor.classList && anchor.classList.add('open'); draw(); place();
      pop.onclick = e => {
        const day = e.target.closest('.lu-cal-day'), nav = e.target.closest('[data-nav]');
        if (day && !day.disabled) return pick(day.dataset.k);
        if (nav) { const t = new Date(Date.UTC(vy, vm + (+nav.dataset.nav), 1)); vy = t.getUTCFullYear(); vm = t.getUTCMonth(); return draw(); }
        if (e.target.closest('[data-ym]')) { mode = 'ym'; err = ''; draw(); place(); const yi = pop.querySelector('.lu-cal-year'); if (yi) yi.select(); return; }
        if (e.target.closest('[data-back]')) { vy = yearNow(); mode = 'days'; draw(); place(); return; }
        const yr = e.target.closest('[data-yr]'); if (yr) { vy = Math.min(ymax, Math.max(ymin, yearNow() + (+yr.dataset.yr))); return draw(); }
        const mo = e.target.closest('[data-mo]'); if (mo && !mo.disabled) { vy = yearNow(); vm = +mo.dataset.mo; mode = 'days'; draw(); place(); return; }
        if (e.target.closest('[data-go]')) return go();
        if (e.target.closest('[data-today]')) { const t = todayK(); if (ok(t)) pick(t); }
        if (e.target.closest('[data-close]')) close();
      };
      const go = () => { const i = pop.querySelector('.lu-cal-typed'), k = parse(i && i.value); const set = m => { err = m; const el = pop.querySelector('.lu-cal-err'); if (el) el.textContent = m; };
        if (!k) return set(/^\s*\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s*$|^\s*\d{4}-\d{1,2}-\d{1,2}\s*$/.test(i && i.value) ? 'That date does not exist.' : 'Type it like 25/12/2026.'); if (!ok(k)) return set('That date is not allowed here.'); pick(k); };
      pop.addEventListener('keydown', e => { if (e.key !== 'Enter') return; if (e.target.classList.contains('lu-cal-typed')) { e.preventDefault(); go(); } else if (e.target.classList.contains('lu-cal-year')) { e.preventDefault(); vy = yearNow(); draw(); const yi = pop.querySelector('.lu-cal-year'); if (yi) yi.focus(); } });
      pop.addEventListener('change', e => { if (e.target.classList.contains('lu-cal-year')) { vy = yearNow(); draw(); const yi = pop.querySelector('.lu-cal-year'); if (yi) yi.focus(); } });
      document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', onKey, true); document.addEventListener('scroll', onScroll, true); window.addEventListener('resize', close);
      return { close };
    }
    function skinDate(input) {
      if (input._luDate) return; input._luDate = true;
      input.style.display = 'none';
      const wrap = document.createElement('div'); wrap.className = 'lu-date';
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'lu-date-btn';
      wrap.appendChild(btn); input.after(wrap);
      const fmt = k => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(k + 'T00:00:00Z'));
      const label = () => { btn.innerHTML = `<span>${input.value ? fmt(input.value) : 'Select date'}</span><i class="fa-regular fa-calendar"></i>`; };
      input._luDateRefresh = label; label();
      let h = null;
      btn.onclick = () => {
        if (h) { h.close(); return; }
        h = luDatePopup(wrap, { value: input.value, min: input.min, max: input.max, onClose: () => { h = null; },
          onPick: k => { const changed = input.value !== k; input.value = k; label(); if (changed) input.dispatchEvent(new Event('change', { bubbles: true })); } });
      };
    }
    skinDate(document.getElementById('hDate'));
    skinDate(document.getElementById('goalDeadline'));
    skinDate(document.getElementById('billDue'));
    skinDate(document.getElementById('spDate'));
    skinDate(document.getElementById('admBulkUntil'));
    skinDate(document.getElementById('mEntryDate'));
    skinDate(document.getElementById('tkDue'));
    skinDate(document.getElementById('calEvDate'));
    skinDate(document.getElementById('sdTaskDue'));
    skinDate(document.getElementById('sdTaskRemDate'));
    skinDate(document.getElementById('sdClassFrom'));
    skinDate(document.getElementById('sdSemStart'));
    skinDate(document.getElementById('sdProjNewDue'));
    skinDate(document.getElementById('sdProjDue'));
    skinDate(document.getElementById('admPlanUntil'));
    skinDate(document.getElementById('sdProjTaskDue'));
    skinDate(document.getElementById('wkTaskStart'));
    skinDate(document.getElementById('wkTaskDue'));
    skinDate(document.getElementById('wkProjDeadline'));
    skinDate(document.getElementById('wkCoStart'));
    skinDate(document.getElementById('wkCoEnd'));
    skinDate(document.getElementById('wkTimeDate'));
    skinDate(document.getElementById('sdClassSkipDate'));
    skinDate(document.getElementById('sdBreakFrom'));
    skinDate(document.getElementById('sdBreakTo'));
    skinDate(document.getElementById('sdSemEnd'));
    skinNumber(document.getElementById('sdClassCount'), 1);
    skinNumber(document.getElementById('sdCourseCredits'), 1);
    skinDate(document.getElementById('sdClassUntil'));

    // Themed time picker (hour / minute / AM-PM). The hidden input holds a 24-hour 'HH:MM' value and fires
    // "input" + "change" when it changes; opts.clear adds a Clear link for optional fields.
    const fmt12 = v => { if (!v) return ''; const [h, m] = v.split(':').map(Number); return ((h % 12) || 12) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };
    const timeToMin = v => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
    function skinTime(input, opts = {}) {
      if (input._luTime) return; input._luTime = true;
      input.style.display = 'none';
      const wrap = document.createElement('div'); wrap.className = 'lu-date';
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'lu-date-btn';
      wrap.appendChild(btn); input.after(wrap);
      const label = () => { btn.innerHTML = `<span style="${input.value ? '' : 'color:rgba(255,255,255,0.4)'}">${input.value ? fmt12(input.value) : 'Set time'}</span><i class="fa-regular fa-clock"></i>`; };
      input._luTimeRefresh = label; label();
      let pop = null;
      const close = () => { if (!pop) return; pop.remove(); pop = null; wrap.classList.remove('open'); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', onKey, true); document.removeEventListener('scroll', onScroll, true); };
      const outside = e => { if (pop && !pop.contains(e.target) && !wrap.contains(e.target)) close(); };
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
      const onScroll = e => { if (pop && !pop.contains(e.target)) close(); };
      const parts = () => { const [h, m] = (input.value || '').split(':').map(Number); return input.value ? { h12: (h % 12) || 12, m, pm: h >= 12 } : null; };
      const set = (h12, m, pm) => { input.value = String(((h12 % 12) + (pm ? 12 : 0))).padStart(2, '0') + ':' + String(m).padStart(2, '0'); label(); draw(); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
      const draw = () => {
        const cur = parts() || { h12: null, m: null, pm: null };
        const mins = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), ...(cur.m != null ? [cur.m] : [])])].sort((a, b) => a - b);
        const keepScroll = pop.querySelectorAll('.lu-time-col'); const st = [...keepScroll].map(c => c.scrollTop);
        pop.innerHTML = `<div class="lu-time-cols">
          <div class="lu-time-col">${Array.from({ length: 12 }, (_, i) => i + 1).map(h => `<button type="button" data-h="${h}" class="${h === cur.h12 ? 'sel' : ''}">${h}</button>`).join('')}</div>
          <div class="lu-time-col">${mins.map(m => `<button type="button" data-m="${m}" class="${m === cur.m ? 'sel' : ''}">${String(m).padStart(2, '0')}</button>`).join('')}</div>
          <div class="lu-time-col"><button type="button" data-ap="am" class="${cur.pm === false ? 'sel' : ''}">AM</button><button type="button" data-ap="pm" class="${cur.pm === true ? 'sel' : ''}">PM</button></div></div>
          <div class="lu-time-foot">${opts.clear ? '<button type="button" data-clear>Clear</button>' : '<span></span>'}<button type="button" data-done>Done</button></div>`;
        pop.querySelectorAll('.lu-time-col').forEach((c, i) => { c.scrollTop = st[i] || 0; if (!st[i]) { const sel = c.querySelector('.sel'); if (sel) c.scrollTop = sel.offsetTop - 70; } });
      };
      btn.onclick = () => {
        if (pop) return close();
        pop = document.createElement('div'); pop.className = 'lu-time'; document.body.appendChild(pop); wrap.classList.add('open'); draw();
        const r = btn.getBoundingClientRect(), h = pop.offsetHeight;
        pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
        pop.style.top = (window.innerHeight - r.bottom < h + 12 && r.top > h + 12 ? r.top - h - 8 : r.bottom + 8) + 'px';
        pop.onclick = e => {
          const c = parts() || { h12: 8, m: 0, pm: false }; // defaults when nothing is set yet
          const bh = e.target.closest('[data-h]'), bm = e.target.closest('[data-m]'), ba = e.target.closest('[data-ap]');
          if (bh) set(+bh.dataset.h, c.m, c.pm); else if (bm) set(c.h12, +bm.dataset.m, c.pm); else if (ba) set(c.h12, c.m, ba.dataset.ap === 'pm');
          else if (e.target.closest('[data-clear]')) { input.value = ''; label(); close(); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); }
          else if (e.target.closest('[data-done]')) close();
        };
        document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', onKey, true); document.addEventListener('scroll', onScroll, true);
      };
    }
    [['hBed', true], ['hWake', true], ['rWFrom'], ['rWTo'], ['rSFrom'], ['rSTo'], ['rAFrom'], ['rATo'], ['rBed'], ['rWake'], ['habitRemind', true], ['calEvStart'], ['calEvEnd', true], ['sdClassStart'], ['sdClassEnd'], ['sdTaskTime', true], ['sdTaskRemTime', true]].forEach(([id, clear]) => skinTime(document.getElementById(id), { clear: !!clear }));

    // Fixed-size modals: wrap every popup that has a header + action buttons so only its fields scroll; the header and
    // buttons never scroll away (messages stay pinned under the header too). New popups get this automatically.
    document.querySelectorAll('.modal-overlay .profile-edit-modal:not(.viewer-box)').forEach(m => {
      if (m.classList.contains('fixed-modal') || !m.querySelector(':scope > .pem-head') || !m.querySelector(':scope > .pem-actions')) return;
      m.classList.add('fixed-modal');
      const body = document.createElement('div'); body.className = 'pem-body';
      [...m.children].filter(c => !c.matches('.pem-head, .pem-actions, .pem-msg')).forEach(c => body.appendChild(c));
      const actions = m.querySelector(':scope > .pem-actions');
      m.insertBefore(body, actions);
    });
