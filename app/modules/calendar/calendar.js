// LUMA — module: calendar
    // ---------- Calendar ----------
    // Your own events (with category, time and repeats) plus — read-only — tasks that are due and bills that are due.
    const C_CATS = [['Work', '#3b82f6'], ['Meeting', '#8b5cf6'], ['Personal', '#22c55e'], ['Health', '#f59e0b'], ['Social', '#ec4899'], ['Other', '#14b8a6']];
    const C_EXTRA = [['Tasks', '#38bdf8'], ['Bills', '#fb923c'], ['Classes', '#34d399'], ['Study', '#a78bfa'], ['Work tasks', '#fb923c']]; // Classes / Study only show with the Study add-on, Work tasks with the Work add-on
    const C_HOUR_H = 52; // pixels per hour in the week view
    const C_UP_DAYS = 14; // the upcoming list only looks 2 weeks ahead
    const C_REPEAT = [['none', 'Never'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']];
    let CEV = [], CINV = [], CTASKS = [], CERR = null, cView = 'month', cDate = null, cBound = false, cAllUp = false;
    const cHidden = new Set();
    const cForm = { id: null, category: 'Work', allDay: false, repeats: 'none', guests: [], invite: new Map(), remove: new Set() };
    const cColor = n => ([...C_CATS, ...C_EXTRA].find(c => c[0] === n) || C_CATS[C_CATS.length - 1])[1];
    const cDow = k => new Date(k + 'T00:00:00Z').getUTCDay();
    const cLast = k => new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0)).getUTCDate();
    const cFmt = (k, o) => new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });

    // does event e happen on day k?
    function cOccurs(e, k) {
      const s = e.event_date; if (k < s) return false;
      if (e.repeats === 'daily') return true;
      if (e.repeats === 'weekly') return bDays(k, s) % 7 === 0;
      if (e.repeats === 'monthly') return +k.slice(8) === Math.min(+s.slice(8), cLast(k));
      if (e.repeats === 'yearly') return k.slice(5, 7) === s.slice(5, 7) && +k.slice(8) === Math.min(+s.slice(8), cLast(k));
      return k === s;
    }
    function cItemsOn(k) {
      const out = [];
      CINV.forEach(e => { if (e.my_status !== 'declined' && !cHidden.has(e.category) && cOccurs(e, k)) out.push({ type: 'event', e, id: e.id, title: e.title, time: e.all_day ? null : e.start_time, end: e.all_day ? null : e.end_time, color: cColor(e.category), cat: e.category, invited: true, pending: e.my_status === 'pending' }); }); // events other people invited me to
      CEV.forEach(e => { if (!cHidden.has(e.category) && cOccurs(e, k)) out.push({ type: 'event', e, id: e.id, title: e.title, time: e.all_day ? null : e.start_time, end: e.all_day ? null : e.end_time, color: cColor(e.category), cat: e.category }); });
      if (!cHidden.has('Tasks')) CTASKS.forEach(t => { if (t.due_date === k && t.status !== 'done') out.push({ type: 'task', id: t.id, title: t.title, color: cColor('Tasks'), cat: 'Tasks', label: 'Task due' }); });
      if (!cHidden.has('Bills')) BILLS.filter(b => b.active !== false).forEach(b => { if (bCycles(b, bFirst(k)).includes(k)) out.push({ type: 'bill', id: b.id, title: `${b.name} · ${bRM(b.amount)}`, color: cColor('Bills'), cat: 'Bills', label: bPaidAmt(b, k) != null ? 'Bill · paid' : 'Bill due', done: bPaidAmt(b, k) != null }); });
      if (typeof studyCalItems === 'function') out.push(...studyCalItems(k)); // the Study add-on's classes and due dates
      if (typeof workCalItems === 'function') out.push(...workCalItems(k)); // the Work add-on's task deadlines
      return out.sort((a, c) => (a.time ? 1 : 0) - (c.time ? 1 : 0) || (a.time || '').localeCompare(c.time || '') || a.title.localeCompare(c.title));
    }
    const cTimeLabel = it => it.type === 'sdclass' ? fmt12(it.time) + ' – ' + fmt12(it.end) : it.type === 'event' ? (it.time ? fmt12(it.time) + (it.end ? ' – ' + fmt12(it.end) : '') : 'All day') : it.label;
    const t12 = t => { const [h, m] = t.split(':').map(Number); return `${String(((h + 11) % 12) + 1).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; }; // 03:00 pm
    const cChip = (it, k) => `<div class="cchip ${it.done ? 'done' : ''} ${it.pending ? 'pend' : ''}" data-type="${it.type}" data-id="${it.id}" data-d="${k}" title="${escapeHtml(it.title)} · ${cTimeLabel(it)}"><span class="dot" style="background:${it.color}"></span>${it.invited ? '<i class="fa-solid fa-user-group inv"></i>' : ''}${it.time ? `<span class="tm">${t12(it.time)}</span>` : ''}${it.done ? '<i class="fa-solid fa-check ck"></i>' : ''}<span class="tt">${escapeHtml(it.title)}</span></div>`;
    const cRow = (it, k) => `<div class="cal-it ${it.done ? 'done' : ''}" style="--ic:${it.color}" data-type="${it.type}" data-id="${it.id}" data-d="${k}"><div><div class="t">${escapeHtml(it.title)}</div><div class="m">${cTimeLabel(it)}${it.type === 'event' ? ' · ' + it.cat : ''}</div></div></div>`;

    // Week (7 columns) and Day (1 wide column) share one time grid: hours down the left, each timed item placed at its time
    // and sized by its length; all-day items / tasks / bills are the first row of the list.
    function cTimeGrid(ds, today) {
      const nowMin = (() => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: MYT, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()); return +p.find(x => x.type === 'hour').value * 60 + +p.find(x => x.type === 'minute').value; })();
      const single = ds.length === 1, hourH = C_HOUR_H;
      const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5), hr12 = h => h === 0 ? '12 am' : h < 12 ? h + ' am' : h === 12 ? '12 pm' : (h - 12) + ' pm';
      const cols = ds.map(k => {
        const items = cItemsOn(k), timed = items.filter(it => it.time), loose = items.filter(it => !it.time);
        // side-by-side lanes for overlapping items
        const evs = timed.map(it => { const sMin = toMin(it.time); return { it, s: sMin, e: Math.min(1440, Math.max(sMin + 25, it.end ? toMin(it.end) : sMin + 60)) }; }).sort((a, c) => a.s - c.s || c.e - a.e);
        let cluster = [], clusterEnd = 0; const laid = [];
        const flush = () => { const lanes = []; cluster.forEach(ev => { let l = lanes.findIndex(end => end <= ev.s); if (l < 0) { l = lanes.length; lanes.push(0); } lanes[l] = ev.e; ev.lane = l; }); cluster.forEach(ev => { ev.lanes = lanes.length; laid.push(ev); }); cluster = []; };
        evs.forEach(ev => { if (cluster.length && ev.s >= clusterEnd) { flush(); clusterEnd = 0; } cluster.push(ev); clusterEnd = Math.max(clusterEnd, ev.e); }); if (cluster.length) flush();
        return { k, loose, laid };
      });
      const headCells = ds.map(k => { const ld = luBusyOn() ? luLoad(k) : { level: 0 }; return `<div class="tg-dh ${k === today ? 'today' : ''} ${ld.level ? 'load' + ld.level : ''}"${ld.level ? ` title="${ld.level === 2 ? 'Packed' : 'Busy'}: ${ld.why}"` : ''}><span class="dn">${+k.slice(8)}</span><span class="dw">${cFmt(k, { weekday: 'short' })}</span>${ld.level ? `<i class="cal-ld fa-solid ${ld.level === 2 ? 'fa-fire' : 'fa-triangle-exclamation'}"></i>` : ''}</div>`; }).join('');
      const adCells = cols.map(c => `<div class="tg-ad" data-d="${c.k}">${c.loose.map(it => cChip(it, c.k)).join('')}</div>`).join('');
      const dayCols = cols.map(c => `<div class="tg-col" data-d="${c.k}">${c.laid.map(ev => {
        const top = ev.s / 60 * hourH, h = Math.max(20, (ev.e - ev.s) / 60 * hourH - 2), w = 100 / ev.lanes, it = ev.it;
        return `<div class="tg-ev ${h < 36 ? 'tiny' : ''} ${it.pending ? 'pend' : ''}" data-type="${it.type}" data-id="${it.id}" data-d="${c.k}" title="${escapeHtml(it.title)} · ${cTimeLabel(it)}" style="top:${top}px;height:${h}px;left:calc(${ev.lane * w}% + 2px);width:calc(${w}% - 4px);--ic:${it.color}"><div class="t">${escapeHtml(it.title)}</div><div class="m">${t12(it.time)}${it.end ? ' – ' + t12(it.end) : ''}${single ? ' · ' + it.cat : ''}</div></div>`;
      }).join('')}${c.k === today ? `<div class="tg-now" style="top:${nowMin / 60 * hourH}px"></div>` : ''}</div>`).join('');
      const labels = Array.from({ length: 24 }, (_, h) => `<div class="tg-hl" style="top:${h * hourH}px">${hr12(h)}</div>`).join('');
      const html = `<div class="cal-tg" style="--n:${ds.length}"><div class="tg-top"><div class="tg-row"><div class="tg-corner"><b>GMT</b><span>${tzOffsetLabel().replace('GMT', '')}</span></div>${headCells}</div></div>`
        + `<div class="tg-scroll"><div class="tg-row tg-adrow"><div class="tg-corner"><span>all-day</span></div>${adCells}</div><div class="tg-row tg-body" style="height:${24 * hourH}px"><div class="tg-hours">${labels}</div>${dayCols}</div></div></div>`;
      return { html, wkTop: cols.some(c => c.loose.length) ? 0 : 7 * hourH }; // with all-day items the list opens at the top (where they are); otherwise around 7 am
    }

    // Day view: an agenda — time on the left, a card per item (coloured edge, icon tile, title, detail)
    const C_ICON = { Work: 'fa-briefcase', Meeting: 'fa-users', Personal: 'fa-user', Health: 'fa-heart-pulse', Social: 'fa-champagne-glasses', Other: 'fa-calendar-day', Tasks: 'fa-square-check', Bills: 'fa-file-invoice-dollar' };
    function cDayAgenda(k) {
      const items = cItemsOn(k), card = it => {
        const when = it.type === 'event' || it.type === 'sdclass' ? (it.time ? it.time + (it.end ? ' – ' + it.end : '') : 'All day') : it.type === 'task' ? 'Task due' : it.type === 'sdtask' || it.type === 'wktask' ? it.label : 'Bill';
        const detail = it.type === 'event' ? ((it.e.note || '').split('\n')[0] || it.cat) : it.label;
        return `<div class="cd-card ${it.done ? 'done' : ''}" style="--ic:${it.color}" data-type="${it.type}" data-id="${it.id}" data-d="${k}"><div class="cd-ico"><i class="fa-solid ${C_ICON[it.cat] || 'fa-calendar-day'}"></i></div><div class="cd-main"><div class="cd-t">${escapeHtml(it.title)}</div><div class="cd-s">${escapeHtml(when === 'All day' || it.type !== 'event' ? detail : when + ' · ' + detail)}</div></div></div>`;
      };
      const loose = items.filter(i => !i.time), timed = items.filter(i => i.time), nowH = k === mytDayKey(Date.now()) ? mytNowMin() / 60 | 0 : -1;
      const ld = luBusyOn() ? luLoad(k) : { level: 0 };
      let html = (ld.level ? `<div class="lu-busy inline ${ld.level === 2 ? 'packed' : ''}"><i class="fa-solid ${ld.level === 2 ? 'fa-fire' : 'fa-triangle-exclamation'}"></i><div class="bt"><b>${ld.level === 2 ? 'This day is packed' : 'This day is busy'}</b><span>${ld.why}${ld.clashes ? '. Some things are at the same time.' : ''}</span></div></div>` : '') + `<div class="cd-list" data-d="${k}">`;
      if (loose.length) html += `<div class="cd-row"><div class="cd-time">All day</div><div class="cd-cards">${loose.map(card).join('')}</div></div>`;
      for (let h = 0; h < 24; h++) {
        const hh = String(h).padStart(2, '0'), here = timed.filter(i => +i.time.slice(0, 2) === h);
        html += `<div class="cd-row cd-hour ${here.length ? '' : 'empty'} ${h === nowH ? 'now' : ''}" data-hh="${hh}"><div class="cd-time">${hh}:00</div><div class="cd-cards">${here.map(card).join('')}</div></div>`;
      }
      return html + '</div>';
    }

    // On a small window (a laptop) a month cell is short: whatever does not fit is folded into "+N more", so nothing spills over the line below.
    function calFitCells(root) {
      root.querySelectorAll('.cal-cell').forEach(cell => {
        if (cell.scrollHeight <= cell.clientHeight + 1) return;
        const chips = [...cell.querySelectorAll('.cchip')]; let more = cell.querySelector('.cal-more'), hidden = more ? +(more.textContent.match(/\d+/) || [0])[0] : 0;
        while (chips.length && cell.scrollHeight > cell.clientHeight + 1) {
          chips.pop().remove(); hidden++;
          if (!more) { more = document.createElement('div'); more.className = 'cal-more'; more.dataset.d = cell.dataset.d; cell.appendChild(more); }
          more.textContent = `+${hidden} more`;
        }
      });
    }
    // the Calendar's data without drawing it (the Dashboard, Work and Study use it for the busy-day notice)
    let calDataAt = 0;
    async function calEnsureData(force) {
      if (!force && Date.now() - calDataAt < 60000) return; calDataAt = Date.now();
      const [ev, tk] = await Promise.all([LumaEvents.list(), LumaTasks.list(), loadBillsData(), LumaPlan.hasAddon('study') ? sdEnsureLoaded() : null, LumaPlan.hasAddon('work') && typeof wkEnsureLoaded === 'function' ? wkEnsureLoaded() : null]);
      if (!ev.error) CEV = ev.data || []; if (!tk.error) CTASKS = tk.data || [];
      try { const inv = await LumaEvents.invited(); CINV = inv.error ? [] : (inv.data || []); } catch (e) { }
    }
    function paintCalendar() {
      const body = docEl('calBody'); if (!body) return;
      const today = mytDayKey(Date.now()); if (!cDate) cDate = today;
      document.querySelectorAll('#calViews span').forEach(sp => sp.classList.toggle('active', sp.dataset.v === cView));
      docEl('calWd').style.display = cView === 'month' ? '' : 'none'; body.classList.remove('cal-nosc', 'cal-wk');
      if (CERR) { docEl('calTitle').textContent = 'Calendar'; body.innerHTML = '<div class="cal-empty">Could not load events — has <b>supabase/migrations/027_events.sql</b> been run in the Supabase SQL Editor?</div>'; paintCalSide(); return; }
      const keepScroll = body.dataset.v === cView && cView === 'week' ? (body.querySelector('.tg-scroll') || {}).scrollTop : null; // stay where you were when changing week / day
      let title = '', html = '', wkTop = 7 * C_HOUR_H;
      if (cView === 'month') {
        const first = bFirst(cDate), lead = cDow(first), n = cLast(first), weeks = Math.ceil((lead + n) / 7), start = bAddDays(first, -lead);
        title = cFmt(first, { month: 'long', year: 'numeric' });
        // same look as always (one table with thin lines); the rows split the card's height evenly so the month never scrolls
        const gridH = Math.max(weeks * 64, body.clientHeight - 4), cellH = gridH / weeks, cap = Math.max(2, Math.floor((cellH - 38) / 21)); // rows shrink to fit (min 64px); one line per item
        html = `<div class="cal-grid" style="grid-template-rows:repeat(${weeks},minmax(0,1fr));min-height:${weeks * 64}px">` + Array.from({ length: weeks * 7 }, (_, i) => {
          const k = bAddDays(start, i), items = cItemsOn(k), muted = k.slice(0, 7) !== first.slice(0, 7), shown = items.length > cap ? cap - 1 : items.length; // when it doesn't all fit, the last line becomes "+N more"
          const ld = luBusyOn() ? luLoad(k) : { level: 0 };
          return `<div class="cal-cell ${muted ? 'muted' : ''} ${k === today ? 'today' : ''} ${ld.level ? 'load' + ld.level : ''}" data-d="${k}"${ld.level ? ` title="${ld.level === 2 ? 'Packed' : 'Busy'}: ${ld.why}"` : ''}><div class="num"><span class="dn">${+k.slice(8)}</span>${ld.level ? `<i class="cal-ld fa-solid ${ld.level === 2 ? 'fa-fire' : 'fa-triangle-exclamation'}"></i>` : ''}</div>${items.slice(0, shown).map(it => cChip(it, k)).join('')}${items.length > shown ? `<div class="cal-more" data-d="${k}">+${items.length - shown} more</div>` : ''}</div>`;
        }).join('') + '</div>';
        body.classList.add('cal-nosc');
      } else if (cView === 'week') {
        const sun = bAddDays(cDate, -cDow(cDate)), ds = Array.from({ length: 7 }, (_, i) => bAddDays(sun, i));
        title = `${cFmt(sun, { day: 'numeric', month: sun.slice(0, 7) === ds[6].slice(0, 7) ? undefined : 'short' })} – ${cFmt(ds[6], { day: 'numeric', month: 'short', year: 'numeric' })}`;
        ({ html, wkTop } = cTimeGrid(ds, today)); body.classList.add('cal-wk');
      } else if (cView === 'day') {
        title = cFmt(cDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        html = cDayAgenda(cDate);
      } else {
        const y = +cDate.slice(0, 4); title = String(y);
        html = '<div class="cal-year">' + Array.from({ length: 12 }, (_, m) => {
          const first = `${y}-${String(m + 1).padStart(2, '0')}-01`, lead = cDow(first), n = cLast(first);
          const cells = Array.from({ length: lead }, () => '<span></span>').join('') + Array.from({ length: n }, (_, d) => { const k = bAddDays(first, d); return `<span class="${k === today ? 'now' : ''} ${cItemsOn(k).length ? 'has' : ''}" data-d="${k}">${d + 1}</span>`; }).join('');
          return `<div class="cal-ym"><div class="mn" data-m="${first}">${cFmt(first, { month: 'long' })}</div><div class="g">${'SMTWTFS'.split('').map(w => `<b>${w}</b>`).join('')}${cells}</div></div>`;
        }).join('') + '</div>';
      }
      const sun = k => bAddDays(k, -cDow(k)), here = cView === 'month' ? bFirst(cDate) === bFirst(today) : cView === 'week' ? sun(cDate) === sun(today) : cView === 'day' ? cDate === today : cDate.slice(0, 4) === today.slice(0, 4);
      docEl('calToday').style.display = here ? 'none' : ''; // already looking at today: no need for the Today button
      docEl('calTitle').textContent = title; body.innerHTML = html; body.dataset.v = cView;
      { const bb = docEl('calBusy'); if (bb) { const b = luBusyBanner(); bb.innerHTML = b; bb.style.display = b ? '' : 'none'; } }
      if (cView === 'month') calFitCells(body);   // after the notice above the grid is in, because it changes how tall the cells are
      if (cView === 'week' || cView === 'day') {
        const sc = body.querySelector('.tg-scroll');
        if (sc) {
          body.style.setProperty('--sbw', (sc.offsetWidth - sc.clientWidth) + 'px'); // width of the scrollbar: it goes into the card's right padding so the columns stay as wide as the header's
          sc.scrollTop = keepScroll != null ? keepScroll : wkTop;
        }
      }
      if (cView === 'day') { const r = body.querySelector('.cd-hour.now') || body.querySelector('.cd-hour[data-hh="07"]'); if (r && body.dataset.dayk !== cDate) body.scrollTop += r.getBoundingClientRect().top - body.getBoundingClientRect().top - 60; body.dataset.dayk = cDate; } else delete body.dataset.dayk;
      paintCalSide();
    }

    // right column: what's coming up + category toggles
    function paintCalSide() {
      const today = mytDayKey(Date.now()), rows = [];
      for (let i = 0; i < C_UP_DAYS; i++) { const k = bAddDays(today, i); cItemsOn(k).forEach(it => rows.push({ it, k })); }
      docEl('calUpRemark').textContent = `Only the next 2 weeks are listed (until ${cFmt(bAddDays(today, C_UP_DAYS - 1), { day: 'numeric', month: 'short' })}).`;
      const shown = rows.slice(0, 5);
      docEl('calViewAll').textContent = 'View all'; docEl('calViewAll').style.display = rows.length ? '' : 'none';
      docEl('calUpcoming').innerHTML = shown.length ? shown.map(({ it, k }) => {
        const d = bDays(k, today), when = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : cFmt(k, { weekday: 'short', day: 'numeric', month: 'short' });
        return `<div class="upcoming-item" data-d="${k}" data-type="${it.type}" data-id="${it.id}"><div class="dot" style="background:${it.color}"></div><div><div class="up-title">${escapeHtml(it.title)}</div><div class="up-time">${when} · ${cTimeLabel(it)}</div></div></div>`;
      }).join('') : '<div class="ls" style="padding:6px 0">Nothing in the next 2 weeks.</div>';
      // counts for the month being looked at (hidden categories still show their count, just dimmed)
      const first = bFirst(cDate || today), n = cLast(first), cnt = {};
      const hiddenNow = new Set(cHidden); cHidden.clear();
      for (let i = 0; i < n; i++) cItemsOn(bAddDays(first, i)).forEach(it => { cnt[it.cat] = (cnt[it.cat] || 0) + 1; });
      hiddenNow.forEach(h => cHidden.add(h));
      docEl('calCats').innerHTML = [...C_CATS, ...C_EXTRA].filter(([n2]) => (n2 !== 'Classes' && n2 !== 'Study' && n2 !== 'Work tasks') || (n2 === 'Work tasks' ? (typeof workVisibleOnCalendar === 'function' && workVisibleOnCalendar()) : (typeof studyVisibleOnCalendar === 'function' && studyVisibleOnCalendar()))).map(([n2, c]) => `<div class="cat-item ${cHidden.has(n2) ? 'off' : ''}" data-cat="${n2}" title="${cHidden.has(n2) ? 'Show' : 'Hide'} ${n2}"><div class="cat-left"><div class="dot" style="background:${c}"></div>${n2}</div><div class="count">${cnt[n2] || 0}</div></div>`).join('');
    }

    // ----- create / edit popup -----
    const cErr = m => { docEl('calError').textContent = m; docEl('calError').style.display = m ? 'flex' : 'none'; };
    function paintCalForm() {
      docEl('calEvCats').innerHTML = C_CATS.map(([n, c]) => `<button type="button" data-c="${n}" class="${n === cForm.category ? 'on' : ''}" style="--gc:${c}"><i class="fa-solid fa-circle" style="color:${c};font-size:0.55rem"></i>${n}</button>`).join('');
      docEl('calEvAllDay').innerHTML = [[false, 'At a time'], [true, 'All day']].map(([v, l]) => `<button type="button" data-a="${v}" class="${v === cForm.allDay ? 'on' : ''}">${l}</button>`).join('');
      docEl('calEvRepeat').innerHTML = C_REPEAT.map(([v, l]) => `<button type="button" data-r="${v}" class="${v === cForm.repeats ? 'on' : ''}">${l}</button>`).join('');
      docEl('calEvTimes').style.display = cForm.allDay ? 'none' : '';
    }
    function openCalModal(e, dateKey, startTime) {
      cForm.id = e ? e.id : null; cForm.category = e ? e.category : 'Work'; cForm.allDay = e ? e.all_day : false; cForm.repeats = e ? e.repeats : 'none';
      docEl('calModalTitle').textContent = e ? 'Edit event' : 'New event';
      docEl('calEvTitle').value = e ? e.title : ''; docEl('calEvNote').value = e ? e.note || '' : '';
      docEl('calEvDate').value = e ? e.event_date : dateKey || cDate || mytDayKey(Date.now()); docEl('calEvDate')._luDateRefresh();
      docEl('calEvStart').value = e && e.start_time ? e.start_time : !e && startTime ? startTime : ''; docEl('calEvStart')._luTimeRefresh();
      docEl('calEvEnd').value = e && e.end_time ? e.end_time : ''; docEl('calEvEnd')._luTimeRefresh();
      docEl('calEvDelete').style.display = e ? '' : 'none'; docEl('calEvRepeatHint').style.display = e && e.repeats !== 'none' ? '' : 'none';
      cForm.guests = []; cForm.invite = new Map(); cForm.remove = new Set(); paintCalGuests();
      if (e) LumaEvents.attendees(e.id).then(r => { if (!r.error && r.data && cForm.id === e.id) { cForm.guests = r.data.filter(a => !a.is_owner); paintCalGuests(); } });
      cErr(''); paintCalForm(); docEl('calEventOverlay').classList.add('open'); docEl('calEventOverlay').querySelectorAll('.pem-body').forEach(el => { el.scrollTop = 0; }); setTimeout(() => docEl('calEvTitle').focus(), 50);
    }
    // guests on the event being edited, plus the people about to be invited
    function paintCalGuests() {
      const dot = s => s === 'accepted' ? '#22c55e' : s === 'pending' ? '#fbbf24' : '#f87171';
      docEl('calGuestSig').value = JSON.stringify([[...cForm.invite.keys()], [...cForm.remove]]); docEl('calGuestSig').dispatchEvent(new Event('input', { bubbles: true })); // so the Save button notices a changed guest list
      docEl('calGuests').innerHTML = cForm.guests.filter(g => !cForm.remove.has(g.user_id)).map(g => `<span class="cal-gchip" title="${g.status === 'accepted' ? 'Going' : g.status === 'pending' ? 'Invited, no reply yet' : 'Declined'}"><i class="dot" style="background:${dot(g.status)}"></i>${escapeHtml(g.name)}<button type="button" data-rm="${g.user_id}" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></span>`).join('')
        + [...cForm.invite].map(([id, n]) => `<span class="cal-gchip new"><i class="fa-solid fa-paper-plane"></i>${escapeHtml(n)}<button type="button" data-un="${id}" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
    }
    docEl('calGuests').onclick = e => {
      const rm = e.target.closest('[data-rm]'); if (rm) { cForm.remove.add(rm.dataset.rm); return paintCalGuests(); }
      const un = e.target.closest('[data-un]'); if (un) { cForm.invite.delete(un.dataset.un); paintCalGuests(); }
    };
    // pick contacts to invite
    let CAL_CONTACTS = null;
    async function openInvitePicker() {
      const box = docEl('calInvList'); box.innerHTML = '<div class="ls" style="padding:8px 2px">Loading…</div>'; docEl('calInviteOverlay').classList.add('open');
      if (!CAL_CONTACTS) { const r = await LumaContacts.listContacts(); CAL_CONTACTS = r.error ? null : (r.data || []).filter(c => c.status === 'accepted'); if (r.error) { box.innerHTML = `<div class="ls" style="padding:8px 2px">Could not load your contacts: ${escapeHtml(r.error.message)}</div>`; return; } }
      const already = new Set(cForm.guests.filter(g => !cForm.remove.has(g.user_id)).map(g => g.user_id));
      box.innerHTML = CAL_CONTACTS.length ? CAL_CONTACTS.map(c => { const nm = [c.other_first_name, c.other_last_name].filter(Boolean).join(' ') || c.other_email; return `<label class="cal-pick ${already.has(c.other_id) ? 'dis' : ''}"><input type="checkbox" data-id="${c.other_id}" data-name="${escapeHtml(nm)}" ${already.has(c.other_id) || cForm.invite.has(c.other_id) ? 'checked' : ''} ${already.has(c.other_id) ? 'disabled' : ''}><span class="av">${escapeHtml((nm[0] || '?').toUpperCase())}</span><span class="nm">${escapeHtml(nm)}<small>${already.has(c.other_id) ? 'Already invited' : escapeHtml(c.other_email || '')}</small></span></label>`; }).join('') : '<div class="ls" style="padding:8px 2px">You have no contacts yet. Add people on the Contacts page first, then invite them here.</div>';
    }
    docEl('calInviteBtn').onclick = openInvitePicker;
    docEl('calInvClose').onclick = () => docEl('calInviteOverlay').classList.remove('open');
    docEl('calInvDone').onclick = () => {
      cForm.invite = new Map([...docEl('calInvList').querySelectorAll('input[type=checkbox]:checked:not(:disabled)')].map(i => [i.dataset.id, i.dataset.name]));
      docEl('calInviteOverlay').classList.remove('open'); paintCalGuests();
    };
    const closeCalModal = () => docEl('calEventOverlay').classList.remove('open');
    docEl('calClose').onclick = closeCalModal;
    docEl('calEventOverlay').onclick = e => { if (e.target === docEl('calEventOverlay')) closeCalModal(); };
    docEl('calEvCats').onclick = e => { const b = e.target.closest('button'); if (b) { cForm.category = b.dataset.c; paintCalForm(); } };
    docEl('calEvAllDay').onclick = e => { const b = e.target.closest('button'); if (b) { cForm.allDay = b.dataset.a === 'true'; paintCalForm(); } };
    docEl('calEvRepeat').onclick = e => { const b = e.target.closest('button'); if (b) { cForm.repeats = b.dataset.r; paintCalForm(); } };
    docEl('calEvTitle').addEventListener('keydown', e => { if (e.key === 'Enter') docEl('calEvSave').click(); });
    docEl('calEvSave').onclick = async () => {
      const title = docEl('calEvTitle').value.trim(), date = docEl('calEvDate').value, st = docEl('calEvStart').value, en = docEl('calEvEnd').value;
      if (!title) return cErr('Give the event a name.');
      if (!date) return cErr('Pick the date.');
      if (!cForm.allDay && !st) return cErr('Pick a start time, or choose All day.');
      if (!cForm.allDay && en && en <= st) return cErr('The end time must be after the start time.');
      const fields = { title, category: cForm.category, event_date: date, all_day: cForm.allDay, start_time: cForm.allDay ? null : st, end_time: cForm.allDay || !en ? null : en, repeats: cForm.repeats, note: docEl('calEvNote').value.trim() };
      const btn = docEl('calEvSave'); btn.disabled = true; btn.textContent = 'Saving…';
      const { data, error } = cForm.id ? await LumaEvents.update(cForm.id, fields) : await LumaEvents.add(fields);
      btn.disabled = false; btn.textContent = 'Save event';
      if (error) return cErr(/events|schema cache|does not exist/i.test(error.message) ? 'The calendar isn\'t set up yet — run supabase/migrations/027_events.sql in the SQL Editor.' : error.message);
      const i = CEV.findIndex(x => x.id === data.id); if (i >= 0) CEV[i] = data; else CEV.push(data);
      // guests: remove the ones taken off, invite the new ones (the event is already saved either way)
      let inviteErr = '';
      for (const uid of cForm.remove) { const r = await LumaEvents.uninvite(data.id, uid); if (r.error) inviteErr = r.error.message; }
      if (cForm.invite.size) { const r = await LumaEvents.invite(data.id, [...cForm.invite.keys()]); if (r.error) inviteErr = /could not find the function|does not exist/i.test(r.error.message) ? 'Invitations aren\'t set up yet — run supabase/migrations/048_event_invites.sql.' : r.error.message; else flashToast('Invitations sent', [...cForm.invite.values()].join(', '), 'fa-paper-plane', '#22c55e'); }
      closeCalModal(); cDate = data.event_date; paintCalendar();
      if (inviteErr) luAlert('The event was saved, but the invitations could not be updated: ' + inviteErr);
    };
    docEl('calEvDelete').onclick = async () => {
      const e = CEV.find(x => x.id === cForm.id); if (!e) return;
      if (!await luConfirm({ title: `Delete “${e.title}”?`, message: e.repeats !== 'none' ? 'Every occurrence of this repeating event is removed.' : 'This event is removed. This can\'t be undone.' })) return;
      const { error } = await LumaEvents.remove(e.id);
      if (error) return cErr(error.message);
      CEV = CEV.filter(x => x !== e); closeCalModal(); paintCalendar(); calUndo(e);
    };

    // small list of everything on a day (opened from "+N more")
    function calDayPopup(k, anchor) {
      document.querySelectorAll('.cal-pop').forEach(x => x.remove());
      const items = cItemsOn(k), pop = document.createElement('div'); pop.className = 'cal-pop';
      pop.innerHTML = `<div class="ph">${cFmt(k, { weekday: 'long', day: 'numeric', month: 'long' })}</div><div class="pl">${items.map(it => cRow(it, k)).join('')}</div><button type="button" class="po">Open day view</button>`;
      document.body.appendChild(pop);
      const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
      pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
      pop.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, r.top - 4)) + 'px';
      const close = () => { pop.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', onKey, true); };
      const outside = e => { if (!pop.contains(e.target)) close(); };
      const onKey = e => { if (e.key === 'Escape') close(); };
      pop.onclick = e => {
        if (e.target.closest('.po')) { close(); cDate = k; cView = 'day'; return paintCalendar(); }
        const it = e.target.closest('[data-type]'); if (it) { close(); calOpenItem(it.dataset.type, it.dataset.id, it.dataset.d); }
      };
      document.addEventListener('mousedown', outside, true); document.addEventListener('keydown', onKey, true);
    }

    // ----- page wiring -----
    const C_REP = { none: 'Does not repeat', daily: 'Repeats every day', weekly: 'Repeats every week', monthly: 'Repeats every month', yearly: 'Repeats every year' };
    const cPill = (name, col) => `<span class="cal-tagpill"><i class="fa-solid fa-circle" style="color:${col}"></i>${name}</span>`;

    // details popup for an event, a task that is due or a bill (clicking an item opens this instead of leaving the page)
    function calShowDetail(type, id, k) {
      let title = '', sub = '', rows = [], actions = '';
      if (type === 'event') {
        const own = CEV.find(x => x.id === id), e = own || CINV.find(x => x.id === id); if (!e) return;
        title = e.title; sub = cPill(e.category, cColor(e.category)) + (own ? '' : ' <span class="cal-tagpill"><i class="fa-solid fa-user-group" style="color:#a78bfa"></i>Invitation</span>');
        rows = [['Date', cFmt(k || e.event_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })], ['Time', e.all_day ? 'All day' : t12(e.start_time) + (e.end_time ? ' – ' + t12(e.end_time) : '')], ['Repeats', e.repeats === 'none' ? 'Does not repeat' : C_REP[e.repeats].replace('Repeats ', '')]];
        if (!own) rows.push(['Organiser', escapeHtml(e.owner_name || 'Someone')], ['Your reply', e.my_status === 'pending' ? 'Waiting for you' : 'Going']);
        if (e.note) rows.push(['Note', escapeHtml(e.note)]);
        if (!own) actions = e.my_status === 'pending' ? '<button type="button" class="confirm-btn cancel" data-a="decline" style="flex:1">Decline</button><button type="button" class="confirm-btn save" data-a="accept" style="flex:1">Accept</button>' : '<button type="button" class="confirm-btn danger" data-a="decline" style="flex:1">Leave event</button>';
        else actions = '<button type="button" class="h-del" data-a="del" title="Delete event" aria-label="Delete event"><i class="fa-regular fa-trash-can"></i></button><button type="button" class="confirm-btn save" data-a="edit" style="flex:1">Edit event</button>';
      } else if (type === 'task') {
        const t = CTASKS.find(x => x.id === id); if (!t) return;
        const st = taskStatusInfo(t.status), over = t.status !== 'done' && t.due_date < mytDayKey(Date.now());
        title = t.title; sub = cPill('Task due', cColor('Tasks'));
        rows = [['Due', cFmt(t.due_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (over ? ' — overdue' : '')], ['Status', `<span class="cal-tagpill"><i class="fa-solid fa-circle" style="color:${st.dot}"></i>${st.name}</span>`], ['Priority', t.priority === 'high' ? 'High' : t.priority === 'med' ? 'Medium' : 'Low'], ['Tag', escapeHtml(t.tag)]];
        if (t.notes) rows.push(['Notes', escapeHtml(t.notes)]);
        actions = '<button type="button" class="confirm-btn cancel" data-a="close" style="flex:1">Close</button><button type="button" class="confirm-btn save" data-a="gotask" style="flex:1">Open in Tasks</button>';
      } else {
        const b = BILLS.find(x => x.id === id); if (!b) return;
        const paid = bPaidAmt(b, k) != null;
        title = b.name; sub = cPill(b.category === 'Subscription' ? 'Subscription' : 'Bill', cColor('Bills'));
        rows = [['Amount', bRM(paid ? bPaidAmt(b, k) : b.amount)], ['Due', cFmt(k, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })], ['Status', paid ? 'Paid' : k < mytDayKey(Date.now()) ? 'Overdue' : 'Not paid yet'], ['Repeats', b.recurrence === 'once' ? 'One-off' : b.recurrence.charAt(0).toUpperCase() + b.recurrence.slice(1)], ['Category', b.category]];
        if (b.note) rows.push(['Note', escapeHtml(b.note)]);
        actions = `<button type="button" class="confirm-btn ${paid ? 'cancel' : 'save'}" data-a="pay" style="flex:1">${paid ? 'Undo paid' : 'Mark as paid'}</button><button type="button" class="confirm-btn cancel" data-a="gobill" style="flex:1">Open in Bills</button>`;
      }
      docEl('calDetTitle').textContent = title; docEl('calDetSub').innerHTML = sub;
      docEl('calDetBody').innerHTML = `<div class="cal-det">${rows.map(([key, v]) => `<div class="r"><div class="k">${key}</div><div class="v">${v}</div></div>`).join('')}</div>`;
      docEl('calDetActions').innerHTML = actions; docEl('calDetActions').dataset.type = type; docEl('calDetActions').dataset.id = id; docEl('calDetActions').dataset.d = k || '';
      docEl('calDetailOverlay').classList.add('open');
      if (type === 'event') calLoadGuests(id, !!CEV.find(x => x.id === id));
    }
    // who is on an event (the organiser and the guests), added under the details once it arrives
    async function calLoadGuests(id, own) {
      const r = await LumaEvents.attendees(id); if (r.error || !r.data || docEl('calDetActions').dataset.id !== id) return;
      if (own && r.data.length < 2) return;
      const ico = s => s === 'accepted' ? '<i class="fa-solid fa-circle-check" style="color:#22c55e"></i>' : s === 'pending' ? '<i class="fa-solid fa-clock" style="color:#fbbf24"></i>' : '<i class="fa-solid fa-circle-xmark" style="color:#f87171"></i>';
      const html = r.data.map(a => `<div class="cal-guest">${ico(a.status)} ${escapeHtml(a.name)}${a.is_owner ? ' <span class="ls">organiser</span>' : a.status === 'pending' ? ' <span class="ls">invited</span>' : a.status === 'declined' ? ' <span class="ls">declined</span>' : ''}${LUMA_USER && a.user_id === LUMA_USER.id ? ' <span class="ls">(you)</span>' : ''}</div>`).join('');
      const det = docEl('calDetBody').querySelector('.cal-det'); if (det) det.insertAdjacentHTML('beforeend', `<div class="r"><div class="k">Guests</div><div class="v">${html}</div></div>`);
    }
    const closeCalDetail = () => docEl('calDetailOverlay').classList.remove('open');
    docEl('calDetClose').onclick = closeCalDetail;
    docEl('calDetailOverlay').onclick = e => { if (e.target === docEl('calDetailOverlay')) closeCalDetail(); };
    docEl('calDetActions').onclick = async e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const { type, id, d } = docEl('calDetActions').dataset;
      if (b.dataset.a === 'close') return closeCalDetail();
      if (b.dataset.a === 'edit') { closeCalDetail(); return openCalModal(CEV.find(x => x.id === id), d); }
      if (b.dataset.a === 'del') { // delete from here (asks first)
        const ev = CEV.find(x => x.id === id); if (!ev) return;
        if (!await luConfirm({ title: `Delete “${ev.title}”?`, message: ev.repeats !== 'none' ? 'Every occurrence of this repeating event is removed.' : 'This event is removed. This can\'t be undone.' })) return;
        const { error } = await LumaEvents.remove(ev.id); if (error) return luAlert('Could not delete: ' + error.message);
        CEV = CEV.filter(x => x !== ev); closeCalDetail(); paintCalendar(); return calUndo(ev);
      }
      if (b.dataset.a === 'accept' || b.dataset.a === 'decline') {
        const ev = CINV.find(x => x.id === id); if (!ev) return; const accept = b.dataset.a === 'accept';
        if (!accept && ev.my_status === 'accepted' && !await luConfirm({ title: `Leave “${ev.title}”?`, message: 'It is removed from your calendar. The organiser is told.', ok: 'Leave event', icon: 'fa-user-group', tone: 'info' })) return;
        const { error } = await LumaEvents.respond(id, accept); if (error) return luAlert('Could not send your reply: ' + error.message);
        if (accept) ev.my_status = 'accepted'; else CINV = CINV.filter(x => x !== ev);
        closeCalDetail(); paintCalendar(); return flashToast(accept ? 'You are going' : 'Invitation declined', ev.title, accept ? 'fa-check' : 'fa-xmark', accept ? '#22c55e' : '#94a3b8');
      }
      if (b.dataset.a === 'gotask') { closeCalDetail(); closeCalList(); return goTo('tasks'); }
      if (b.dataset.a === 'gobill') { closeCalDetail(); closeCalList(); return goTo('bills'); }
      if (b.dataset.a === 'pay') { const bill = BILLS.find(x => x.id === id); if (bill) { await toggleBillPaid(bill, d); calShowDetail('bill', id, d); paintCalendar(); } }
    };
    function calOpenItem(type, id, dateKey) { if (type === 'sdclass' || type === 'sdtask') return sdOpenFromCal(type, id); if (type === 'wktask') return wkOpenFromSearch({ kind: 'task', id }); calShowDetail(type, id, dateKey); }

    // "View all": a popup with the whole list of what's coming up
    function openCalList() {
      const today = mytDayKey(Date.now()), groups = []; let total = 0;
      for (let i = 0; i < C_UP_DAYS && total < 300; i++) { const k = bAddDays(today, i), items = cItemsOn(k); if (items.length) { groups.push([k, items]); total += items.length; } }
      docEl('calListBody').innerHTML = groups.length ? groups.map(([k, items]) => {
        const d = bDays(k, today), label = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : cFmt(k, { weekday: 'long' });
        return `<div class="cal-lhead">${label} · ${cFmt(k, { day: 'numeric', month: 'short', year: 'numeric' })}</div>${items.map(it => cRow(it, k)).join('')}`;
      }).join('') : '<div class="cal-empty">Nothing coming up in the next 2 weeks.</div>';
      docEl('calListOverlay').classList.add('open');
      docEl('calListOverlay').querySelectorAll('.pem-body, .profile-edit-modal').forEach(el => { el.scrollTop = 0; }); // always start at the top
    }
    const closeCalList = () => docEl('calListOverlay').classList.remove('open');
    docEl('calListDone').onclick = closeCalList;
    docEl('calListOverlay').onclick = e => {
      if (e.target === docEl('calListOverlay')) return closeCalList();
      const it = e.target.closest('[data-type]'); if (it) calShowDetail(it.dataset.type, it.dataset.id, it.dataset.d);
    };

    function calMove(dir) {
      const d = cDate || mytDayKey(Date.now());
      cDate = cView === 'month' ? bAddMonths(bFirst(d), dir) : cView === 'week' ? bAddDays(d, 7 * dir) : cView === 'day' ? bAddDays(d, dir) : bAddMonths(bFirst(d), 12 * dir);
      paintCalendar();
    }
    // "Event deleted · Undo": add it back as it was (guest invitations are not restored)
    const calUndo = e => luUndo('Event deleted', async () => {
      const { data, error } = await LumaEvents.add({ title: e.title, category: e.category, event_date: e.event_date, all_day: e.all_day, start_time: e.start_time, end_time: e.end_time, repeats: e.repeats, note: e.note || '' });
      if (error) throw error; CEV.push(data); paintCalendar();
    });
    // save events (and open tasks and bills with a due date) as an .ics file
    async function calExportIcs() {
      const rep = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' };
      const mine = [...CEV, ...CINV.filter(e => e.my_status === 'accepted')];
      const evs = mine.map(e => ({ uid: 'event-' + e.id, title: e.title, date: e.event_date, time: e.all_day ? null : e.start_time, endTime: e.all_day ? null : e.end_time, allDay: !!e.all_day, rrule: rep[e.repeats] || '', desc: [e.category, e.note].filter(Boolean).join(' · '), alarm: e.all_day ? null : 15 }));
      const tasks = (typeof CTASKS !== 'undefined' ? CTASKS : []).filter(t => t.due_date && t.status !== 'done').map(t => ({ uid: 'task-' + t.id, title: 'Task: ' + t.title, date: t.due_date, allDay: true }));
      const bills = (typeof BILLS !== 'undefined' ? BILLS : []).filter(b => b.active !== false && b.due_date).map(b => ({ uid: 'bill-' + b.id, title: `Bill: ${b.name} (${bRM(b.amount)})`, date: b.due_date, allDay: true, rrule: rep[b.recurrence] || '' }));
      if (!evs.length && !tasks.length && !bills.length) return luAlert('There is nothing to export yet.');
      if (!await luConfirm({ title: 'Export your calendar', message: `${evs.length} event${evs.length === 1 ? '' : 's'}, ${tasks.length} open task${tasks.length === 1 ? '' : 's'} and ${bills.length} bill${bills.length === 1 ? '' : 's'} are saved in one .ics file. Open it on your phone or computer to add them to Google, Apple or Outlook Calendar. It is a copy: later changes in LUMA are not sent to it.`, ok: 'Download', icon: 'fa-file-export', tone: 'info' })) return;
      luIcs.download('LUMA-calendar.ics', luIcs.build([...evs, ...tasks, ...bills], 'LUMA'));
      flashToast('Calendar saved', 'LUMA-calendar.ics', 'fa-file-export', '#60a5fa');
    }
    function calBind() {
      if (cBound) return; cBound = true;
      let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (cView === 'month' && document.getElementById('page-calendar').classList.contains('active')) paintCalendar(); }, 120); }); // squares are re-sized with the window
      docEl('calExport').onclick = calExportIcs;
      docEl('calTitle').title = 'Choose a date'; docEl('calTitle').onclick = () => luDatePopup(docEl('calTitle'), { value: cDate || mytDayKey(Date.now()), onPick: k => { cDate = k; paintCalendar(); } });
      docEl('calPrev').onclick = () => calMove(-1); docEl('calNext').onclick = () => calMove(1);
      docEl('calToday').onclick = () => { cDate = mytDayKey(Date.now()); paintCalendar(); };
      docEl('calCreate').onclick = () => openCalModal(null, cView === 'month' || cView === 'year' ? mytDayKey(Date.now()) : cDate);
      docEl('calViews').onclick = e => { const sp = e.target.closest('span[data-v]'); if (sp) { cView = sp.dataset.v; cDate = mytDayKey(Date.now()); paintCalendar(); } }; // each tab opens on today
      docEl('calViewAll').onclick = e => { e.preventDefault(); openCalList(); };
      docEl('calCats').onclick = e => { const c = e.target.closest('[data-cat]'); if (!c) return; cHidden.has(c.dataset.cat) ? cHidden.delete(c.dataset.cat) : cHidden.add(c.dataset.cat); paintCalendar(); };
      docEl('calUpcoming').onclick = e => { const u = e.target.closest('.upcoming-item'); if (u) calOpenItem(u.dataset.type, u.dataset.id, u.dataset.d); };
      docEl('calBody').onclick = e => {
        if (e.target.closest('#calEmptyAdd')) return openCalModal(null, cDate);
        const mn = e.target.closest('.mn[data-m]'); if (mn) { cDate = mn.dataset.m; cView = 'month'; return paintCalendar(); }
        const more = e.target.closest('.cal-more'); if (more) return calDayPopup(more.dataset.d, more.closest('.cal-cell') || more);
        const it = e.target.closest('[data-type]'); if (it) return calOpenItem(it.dataset.type, it.dataset.id, it.dataset.d);
        const yd = e.target.closest('.cal-ym span[data-d]'); if (yd) { cDate = yd.dataset.d; cView = 'day'; return paintCalendar(); }
        const hr = e.target.closest('.cd-hour'); if (hr) return openCalModal(null, hr.closest('.cd-list').dataset.d, hr.dataset.hh + ':00'); // click an empty hour: new event at that hour
        const slot = e.target.closest('.tg-col'); if (slot) { const hh = Math.max(0, Math.min(23, Math.floor((e.clientY - slot.getBoundingClientRect().top) / C_HOUR_H))); return openCalModal(null, slot.dataset.d, String(hh).padStart(2, '0') + ':00'); } // click an empty hour: new event at that hour
        const cell = e.target.closest('[data-d]'); if (cell) openCalModal(null, cell.dataset.d); // empty space in a day: create an event on that day
      };
    }
    async function calOnShow() {
      calBind(); if (!cDate) cDate = mytDayKey(Date.now());
      paintCalendar();
      const [ev, tk] = await Promise.all([LumaEvents.list(), LumaTasks.list(), loadBillsData(), LumaPlan.hasAddon('study') ? sdEnsureLoaded() : null, LumaPlan.hasAddon('work') && typeof wkEnsureLoaded === 'function' ? wkEnsureLoaded() : null]);
      LumaEvents.invited().then(r => { CINV = r.error ? [] : (r.data || []); paintCalendar(); }); // invitations (migration 048); shown as soon as they arrive
      CERR = ev.error || null; if (!ev.error) CEV = ev.data || []; if (!tk.error) CTASKS = tk.data || [];
      paintCalendar();
    }


    // opening a notification about an event: show the month (or, if it is crowded, the day) it is on
    LU_FOCUS_HOOKS.calendar = (ref, type, tries) => {
      const e = [...CEV, ...CINV].find(x => x.id === ref); if (!e) return;
      const today = mytDayKey(Date.now());
      const d = e.repeats !== 'none' && (cOccurs(e, today) || e.event_date < today) ? today : e.event_date, want = tries >= 8 ? 'day' : 'month';
      if (cView !== want || cDate !== d) { cDate = d; cView = want; paintCalendar(); }
    };
