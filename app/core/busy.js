// LUMA — core: busy days
    // How loaded is a day? Counted from everything the Calendar shows for the mode you are in (events, tasks and bills due, classes and
    // study deadlines in Study mode, Work tasks in Work mode):
    //   busy   (amber): 6 or more things, or 6 hours booked, or two things at the same time   (the "Normal" setting)
    //   packed (red):   9 or more things, or 9 hours booked, or three clashes
    // Classes count as half a thing, so a normal timetable does not make every day look packed. People can switch the alerts off in
    // Settings → Preferences → "Busy-day alerts".
    // three sensitivities (Settings → Preferences → "How easily a day counts as busy"); the evening-before push in migration 082 uses the same numbers
    const LU_BUSY_LEVELS = { sensitive: { n: [4, 6], h: [4, 6], clash: [1, 2] }, normal: { n: [6, 9], h: [6, 9], clash: [1, 3] }, relaxed: { n: [8, 12], h: [8, 12], clash: [2, 4] } };
    const luBusyT = () => { const v = ((typeof LUMA_PROFILE !== 'undefined' && LUMA_PROFILE && LUMA_PROFILE.preferences) || {}).busy_level; return LU_BUSY_LEVELS[v] || LU_BUSY_LEVELS.normal; };
    const luBusyOn = () => typeof prefOn === 'function' ? prefOn('busy_alerts', true) : true;
    const luMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
    const luDayName = k => new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

    // the load of one day: { k, n, hours, clashes, level (0 / 1 busy / 2 packed), why }
    function luLoad(k) {
      let items = []; const hid = typeof cHidden !== 'undefined' ? [...cHidden] : [];
      try { if (typeof cHidden !== 'undefined') cHidden.clear(); items = cItemsOn(k); } catch (e) { items = []; } finally { hid.forEach(c => cHidden.add(c)); }   // the Calendar's filters don't hide a busy day
      const score = items.reduce((s, it) => s + (it.type === 'sdclass' ? 0.5 : 1), 0);
      const timed = items.filter(it => it.time).map(it => { const s = luMin(it.time); return { s, e: Math.max(s + 15, it.end ? luMin(it.end) : s + 60) }; }).sort((a, b) => a.s - b.s);
      let mins = 0, clashes = 0, endMax = -1; timed.forEach(x => { if (x.s < endMax) clashes++; mins += x.e - x.s; endMax = Math.max(endMax, x.e); });
      const hours = Math.round(mins / 6) / 10;
      const LU_BUSY = luBusyT(); const level = score >= LU_BUSY.n[1] || hours >= LU_BUSY.h[1] || clashes >= LU_BUSY.clash[1] ? 2 : score >= LU_BUSY.n[0] || hours >= LU_BUSY.h[0] || clashes >= LU_BUSY.clash[0] ? 1 : 0;
      const why = [`${items.length} thing${items.length === 1 ? '' : 's'}`, hours >= 3 ? `${hours} h booked` : '', clashes ? `${clashes} clash${clashes === 1 ? '' : 'es'}` : ''].filter(Boolean).join(' · ');
      return { k, n: items.length, hours, clashes, level, why };
    }
    const luLoads = (from, count) => Array.from({ length: count }, (_, i) => luLoad(bAddDays(from, i)));

    // a notice for today, tomorrow and the days after: only shown when something is busy or packed
    function luBusyBanner() {
      if (!luBusyOn()) return '';
      const today = mytDayKey(Date.now()); try { if (sessionStorage.getItem('luma_busy_x') === today) return ''; } catch (e) { }
      const days = luLoads(today, 7).filter(d => d.level > 0); if (!days.length) return '';
      const first = days[0], tomorrow = bAddDays(today, 1), when = first.k === today ? 'Today' : first.k === tomorrow ? 'Tomorrow' : luDayName(first.k), worst = days.some(d => d.level === 2 && d.k <= bAddDays(today, 2)) ? 2 : first.level;
      const rest = days.filter(d => d !== first).slice(0, 4);
      return `<div class="lu-busy ${worst === 2 ? 'packed' : ''}" data-busy><i class="fa-solid ${worst === 2 ? 'fa-fire' : 'fa-triangle-exclamation'}"></i><div class="bt"><b>${when} ${first.level === 2 ? 'is packed' : 'is busy'}</b><span>${first.why}${first.level === 2 ? '. Think about moving something.' : ''}</span>
        <div class="bd"><button type="button" data-busy-day="${first.k}">Open ${first.k === today ? 'today' : luDayName(first.k)}</button>${rest.length ? '<em>Also:</em>' + rest.map(d => `<button type="button" class="${d.level === 2 ? 'p' : ''}" data-busy-day="${d.k}" title="${d.why}">${luDayName(d.k)}</button>`).join('') : ''}</div></div><button type="button" class="bx" data-busy-x title="Hide for today" aria-label="Hide for today"><i class="fa-solid fa-xmark"></i></button></div>`;
    }
    // the next 7 days as small squares, coloured by how full they are
    function luBusyStrip(from, count = 7) {
      if (!luBusyOn()) return '';
      return `<div class="lu-strip">${luLoads(from || mytDayKey(Date.now()), count).map(d => `<button type="button" class="s${d.level} ${d.k === mytDayKey(Date.now()) ? 'now' : ''}" data-busy-day="${d.k}" title="${luDayName(d.k)} · ${d.n ? d.why : 'nothing planned'}"><small>${new Date(d.k + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' })}</small><b>${+d.k.slice(8)}</b></button>`).join('')}</div>
        <div class="lu-strip-key"><span><i class="s0"></i>Light</span><span><i class="s1"></i>Busy</span><span><i class="s2"></i>Packed</span><em>Tap a day to open it</em></div>`;
    }
    function luBusyOpen(k) { cView = 'day'; cDate = k; goTo('calendar'); setTimeout(() => { if (typeof paintCalendar === 'function') paintCalendar(); }, 400); }
    document.addEventListener('click', e => {
      const d = e.target.closest('[data-busy-day]'); if (d) return luBusyOpen(d.dataset.busyDay);
      if (e.target.closest('[data-busy-x]')) { try { sessionStorage.setItem('luma_busy_x', mytDayKey(Date.now())); } catch (x) { } document.querySelectorAll('.lu-busy[data-busy]').forEach(b => b.remove()); }
    });
    // each page that shows the notice calls this with the id of its box (the Calendar's data is loaded first if it isn't yet)
    async function luPaintBusy(id, opts = {}) {
      const box = document.getElementById(id); if (!box) return;
      if (!luBusyOn()) { box.innerHTML = ''; box.style.display = 'none'; return; }
      if (typeof calEnsureData === 'function') { try { await calEnsureData(); } catch (e) { } }
      const b = luBusyBanner(), s = opts.strip ? luBusyStrip() : '';
      box.innerHTML = (b || '') + s; box.style.display = b || s ? '' : 'none';
    }
