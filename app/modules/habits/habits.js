// LUMA — module: habits
      // ---------------- HABITS ----------------
    MODULES.habits = function () {
        return head('Habits', '<span id="habitsSub">Loading…</span>', '<button class="create-btn" id="goneHabitBtn" style="display:none;background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-box-archive"></i> <span>Deleted</span></button><button class="create-btn" id="selectHabitBtn" style="display:none;background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-regular fa-square-check"></i> Select</button><button class="create-btn" id="addHabitBtn"><i class="fa-solid fa-plus"></i> New habit</button>') +
          '<div id="habitsRoot"></div>';
    };

    // ---------- Habits (luma.habits + luma.habit_logs) ----------
    // A habit repeats daily (on chosen weekdays), weekly or monthly (N times per period). It is either ticked off, measured
    // (done once the logged amount reaches goal_value, e.g. 5 pages) or read from the Health sleep log (source 'sleep').
    const H_ICONS = ['fa-brain', 'fa-book-open', 'fa-dumbbell', 'fa-moon', 'fa-pen-nib', 'fa-droplet', 'fa-person-running', 'fa-apple-whole', 'fa-bed', 'fa-guitar', 'fa-code', 'fa-leaf', 'fa-heart', 'fa-sun', 'fa-language', 'fa-broom', 'fa-pills', 'fa-bicycle', 'fa-mug-hot', 'fa-spa', 'fa-mosque', 'fa-book-quran', 'fa-shirt', 'fa-toilet'];
    // one-tap templates (a template with `pack` creates several habits at once)
    const H_PRESETS = [
      { name: 'Solat 5 waktu', icon: 'fa-mosque', color: '#22c55e', pack: ['Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak'] },
      { name: 'Baca Al-Quran', icon: 'fa-book-quran', color: '#14b8a6', goal_value: 5, unit: 'pages' },
      { name: 'Exercise', icon: 'fa-dumbbell', color: '#f97316', goal_value: 30, unit: 'min' },
      { name: 'Tidur 6 jam', icon: 'fa-moon', color: '#a78bfa', source: 'sleep', goal_value: 6, unit: 'h' },
    ];
    const H_DAY_ORDER = [[1, 'M'], [2, 'T'], [3, 'W'], [4, 'T'], [5, 'F'], [6, 'S'], [0, 'S']]; // Monday first; value = weekday (0 = Sunday)
    const H_GROUPS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']];
    const H_PUNIT = { daily: 'day', weekly: 'week', monthly: 'month' };
    const H_WINDOW = 365; // days of history loaded (for streaks)
    let hResetScroll = false; // set when you change day, so the habit list starts at the top again
    let hMonth = null; // first day of the month shown in Consistency (null = this month)
    let hDay = null; // the day the check buttons apply to (null = today); you can go back up to 14 days to tick something you forgot
    const H_BACK = 14;
    let hSelecting = false; const hSel = new Set(); // multi-select mode (to delete several habits at once)
    let HABITS = [], HGONE = [], HLOGS = new Map(), HSLEEP = new Map(), HABITS_ERR = null; // HGONE: deleted habits — kept only so their completed days still count in the charts // HLOGS: habit id → Map(day → amount | null); HSLEEP: day → hours slept

    const hToday = () => mytDayKey(Date.now());
    const hKeyAdd = (key, n) => new Date(Date.parse(key + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
    const hDow = key => new Date(key + 'T00:00:00Z').getUTCDay();
    const hSched = (h, key) => h.period !== 'daily' || h.days.includes(hDow(key));
    const hBorn = h => mytDayKey(h.created_at); // habits don't count against days before they existed
    const hKeyLabel = key => new Date(key + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    const hFirstOfMonth = key => key.slice(0, 8) + '01';
    // a "period" is identified by its first day: the day itself, that week's Monday, or the 1st of the month
    const hPeriodKey = (h, key) => h.period === 'weekly' ? hKeyAdd(key, -((hDow(key) + 6) % 7)) : h.period === 'monthly' ? hFirstOfMonth(key) : key;
    const hPrevPeriod = (h, pk) => h.period === 'weekly' ? hKeyAdd(pk, -7) : h.period === 'monthly' ? hFirstOfMonth(hKeyAdd(pk, -1)) : hKeyAdd(pk, -1);
    const hPeriodEnd = (h, pk) => h.period === 'weekly' ? hKeyAdd(pk, 6) : h.period === 'monthly' ? hKeyAdd(hFirstOfMonth(hKeyAdd(pk, 31)), -1) : pk;
    const hPeriods = (h, today, n) => { const out = []; let pk = hPeriodKey(h, today); for (let i = 0; i < n; i++) { out.unshift(pk); pk = hPrevPeriod(h, pk); } return out; }; // oldest → newest
    const hPeriodLabel = (h, pk) => h.period === 'weekly' ? 'Week of ' + hKeyLabel(pk) : h.period === 'monthly' ? new Date(pk + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : hKeyLabel(pk);

    // was the habit done on this day? (measurable: amount reached; sleep: Health sleep reached)
    function hLogged(h, key) {
      if (h.source === 'sleep') { const v = HSLEEP.get(key); return v != null && v >= (h.goal_value || 6); }
      const m = HLOGS.get(h.id); if (!m || !m.has(key)) return false;
      return !h.goal_value || (m.get(key) || 0) >= h.goal_value;
    }
    const hValue = (h, key) => h.source === 'sleep' ? HSLEEP.get(key) : (HLOGS.get(h.id) || new Map()).get(key);
    function hCount(h, pk, today) { // days done inside the period so far
      const pe = hPeriodEnd(h, pk), end = pe < today ? pe : today; let n = 0;
      for (let k = pk; k <= end; k = hKeyAdd(k, 1)) if (hLogged(h, k)) n++;
      return n;
    }
    const hNeed = h => h.period === 'daily' ? 1 : h.per_period;
    const hPeriodDone = (h, pk, today) => hCount(h, pk, today) >= hNeed(h);

    // streak = consecutive periods done (current period only counts once done — it never breaks a streak while pending)
    function hRuns(h, today) {
      const ps = hPeriods(h, today, h.period === 'daily' ? H_WINDOW : h.period === 'weekly' ? 53 : 13);
      let run = 0, best = 0;
      ps.slice(0, -1).forEach(pk => {
        if (hPeriodDone(h, pk, today)) { run++; best = Math.max(best, run); }
        else if (h.period !== 'daily' || hSched(h, pk)) run = 0;
      });
      if (hPeriodDone(h, ps[ps.length - 1], today)) { run++; best = Math.max(best, run); }
      return { cur: run, best };
    }
    // share of your daily habits due on `key` that were done (null when none were due)
    function hDayRatio(key) {
      const due = HABITS.filter(h => h.period === 'daily' && hSched(h, key)); // every daily habit you have counts for every day, so ticking a past day behaves exactly like today
      return due.length ? due.filter(h => hLogged(h, key)).length / due.length : null;
    }

    async function loadSleep() {
      HSLEEP = new Map();
      if (![...HABITS, ...HGONE].some(h => h.source === 'sleep')) return;
      const { data } = await LumaHealth.listLogs(hKeyAdd(hToday(), -H_WINDOW));
      (data || []).forEach(r => { if (r.sleep_hours != null) HSLEEP.set(r.log_date, Number(r.sleep_hours)); });
    }
    const hRow = h => ({ ...h, period: h.period || 'daily', per_period: h.per_period || 1, goal_value: h.goal_value == null ? null : Number(h.goal_value), unit: h.unit || '', source: h.source || 'manual', reminder_time: h.reminder_time || null, days: (h.days || []).map(Number) });
    async function refreshHabits() {
      const [l, g] = await Promise.all([LumaHabits.list(), LumaHabits.logsSince(hKeyAdd(hToday(), -H_WINDOW))]);
      HABITS_ERR = l.error || g.error || null;
      if (HABITS_ERR) return;
      const all = l.data.map(hRow);
      HABITS = all.filter(h => !h.archived); HGONE = all.filter(h => h.archived);
      HLOGS = new Map();
      (g.data || []).forEach(r => { if (!HLOGS.has(r.habit_id)) HLOGS.set(r.habit_id, new Map()); HLOGS.get(r.habit_id).set(r.log_date, r.value == null ? null : Number(r.value)); });
      await loadSleep();
    }


    function paintHabits() { paintHabitsPage(); paintDashHabits(); if (document.getElementById('dashChips') && dashTasks) paintDashboard(); }

    function paintDashHabits() {
      const box = document.getElementById('dashHabits'); if (!box) return;
      if (HABITS_ERR) { box.innerHTML = '<div class="wgt-sub lu-empty">Habits aren\'t set up yet.</div>'; return; }
      const today = hToday();
      const top = HABITS.map(h => ({ h, n: hRuns(h, today).cur })).sort((a, b) => b.n - a.n).slice(0, 12);
      if (!top.length) { box.innerHTML = '<div class="wgt-sub lu-empty">No habits yet — add one on the Habits page.</div>'; return; }
      box.innerHTML = top.map(({ h, n }) => `<div style="display:flex;align-items:center;gap:12px;"><div class="licon" style="width:36px;height:36px;flex:none;display:grid;place-items:center;border-radius:11px;font-size:0.95rem;color:${h.color};background:${h.color}22;"><i class="fa-solid ${h.icon}"></i></div><div style="flex:1;min-width:0;"><div class="wgt-it">${escapeHtml(h.name)}</div><div style="display:flex;gap:4px;margin-top:5px;">${hPeriods(h, today, 7).map(pk => `<span title="${hPeriodLabel(h, pk)}" style="width:11px;height:11px;border-radius:3px;background:${hPeriodDone(h, pk, today) ? h.color : 'rgba(255,255,255,0.08)'};"></span>`).join('')
        }</div></div><span style="color:#fb923c;font-size:0.82rem;font-weight:600;font-variant-numeric:tabular-nums;"><i class="fa-solid fa-fire" style="font-size:0.72rem;"></i> ${n}</span></div>`).join('');
      if (typeof dashFade === 'function') dashFade(box);
    }

    function paintHabitsPage() {
      const root = document.getElementById('habitsRoot'), sub = document.getElementById('habitsSub'); if (!root) return;
      if (HABITS_ERR) {
        sub.textContent = 'Could not load habits';
        root.innerHTML = card('<div class="ls">Has <b>supabase/migrations/016_habits.sql</b> been run in the Supabase SQL Editor?</div>');
        return;
      }
      if (!HABITS.length) { hSelecting = false; hSel.clear(); }
      [...hSel].forEach(id => { if (!HABITS.some(h => h.id === id)) hSel.delete(id); });
      const selBtn = document.getElementById('selectHabitBtn');
      const goneBtn = document.getElementById('goneHabitBtn'); if (goneBtn) { goneBtn.style.display = HGONE.length && !hSelecting ? '' : 'none'; goneBtn.querySelector('span').textContent = `Deleted (${HGONE.length})`; }
      if (docEl('goneOverlay').classList.contains('open')) paintGone();
      if (selBtn) { selBtn.style.display = HABITS.length ? '' : 'none'; selBtn.innerHTML = hSelecting ? '<i class="fa-solid fa-xmark"></i> Cancel' : '<i class="fa-regular fa-square-check"></i> Select'; }
      const today = hToday();
      if (hDay && (hDay > today || hDay < hKeyAdd(today, -H_BACK))) hDay = null;
      const day = hDay || today, isToday = day === today;
      const dayWord = isToday ? 'today' : day === hKeyAdd(today, -1) ? 'yesterday' : 'on ' + hKeyLabel(day);
      const dayHabits = HABITS;
      const daily = dayHabits.filter(h => h.period === 'daily' && hSched(h, day)), longer = HABITS.filter(h => h.period !== 'daily');
      sub.textContent = HABITS.length
        ? `${daily.filter(h => hLogged(h, day)).length} of ${daily.length} done ${dayWord}` + (longer.length ? ` · ${longer.filter(h => hPeriodDone(h, hPeriodKey(h, day), today)).length} of ${longer.length} weekly & monthly` : '')
        : 'Build routines that stick';
      if (!HABITS.length) {
        root.innerHTML = card(`<div class="h-empty">
          <div class="h-empty-ico"><i class="fa-solid fa-seedling"></i></div>
          <div class="h-empty-t">Start your first habit</div>
          <div class="h-empty-s">Small things you do regularly add up. Pick a starter or tap <b>New habit</b> to make your own — we'll track your streak.</div>
          <div class="h-empty-chips">${H_PRESETS.map((p, i) => `<button type="button" class="h-chip" data-preset="${i}"><i class="fa-solid ${p.icon}" style="color:${p.color}"></i>${p.name}</button>`).join('')}</div>
        </div>`);
        return;
      }
      const showGroups = HABITS.some(h => h.period !== 'daily');
      const rowHtml = h => {
        const pk = hPeriodKey(h, day), curPk = hPeriodKey(h, today), cnt = hCount(h, pk, today), done = cnt >= hNeed(h), { cur } = hRuns(h, today), sleep = h.source === 'sleep';
        let detail = '';
        if (sleep) { const v = HSLEEP.get(day); detail = (v != null ? `slept ${v}h` : 'no sleep logged') + ` · goal ${h.goal_value || 6}h+`; }
        else if (h.goal_value && h.period === 'daily') detail = `${hValue(h, day) ?? 0}/${h.goal_value} ${h.unit}`.trim();
        else if (h.period !== 'daily') detail = `${cnt}/${h.per_period} ${pk === curPk ? 'this' : 'that'} ${H_PUNIT[h.period]}`;
        else if (h.target) detail = h.target;
        if (h.period === 'daily' && !hSched(h, day)) detail += (detail ? ' · ' : '') + 'rest day';
        if (h.reminder_time) detail += (detail ? ' · ' : '') + '⏰ ' + fmt12(h.reminder_time);
        const dots = hPeriods(h, today, 7).map(k => {
          const d = hPeriodDone(h, k, today);
          return `<button type="button" class="hdot ${hSched(h, k) ? '' : 'rest'} ${k === pk ? 'today' : ''}" data-day="${k === curPk ? today : k}" title="${hPeriodLabel(h, k)}${d ? ' · done' : ''}" style="${d ? `background:${h.color};border-color:${h.color}` : ''}"></button>`;
        }).join('');
        const picked = hSel.has(h.id);
        return `<div class="hrow ${hSelecting ? 'selecting' : ''} ${hSelecting && picked ? 'selected' : ''}" data-id="${h.id}">${hSelecting ? '<span class="hsel"><i class="fa-solid fa-check"></i></span>' : ''}<div class="licon" style="color:${h.color};background:${h.color}22"><i class="fa-solid ${h.icon}"></i></div>
          <div style="flex:1;min-width:0"><div class="lt">${escapeHtml(h.name)}</div>
            <div class="ls" style="color:${cur ? '#fb923c' : 'rgba(255,255,255,0.4)'}"><i class="fa-solid fa-fire"></i> ${cur} ${H_PUNIT[h.period]} streak${detail ? ' · ' + escapeHtml(detail) : ''}</div>
            <div class="hdots">${dots}</div></div>
          ${hSelecting ? '' : `<button type="button" class="hedit" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button type="button" class="hbtn ${done ? 'on' : ''}" data-day="${day}" title="${sleep ? 'Counted from your sleep log in Health' : done ? 'Done — tap to undo' : h.goal_value ? 'Log amount' : 'Mark done'}" style="${done ? `background:${h.color}` : ''}"><i class="fa-solid fa-check"></i></button>`}</div>`;
      };
      const rows = H_GROUPS.map(([per, label]) => {
        const hs = dayHabits.filter(h => h.period === per); if (!hs.length) return '';
        return (showGroups ? `<div class="h-group">${label}</div>` : '') + hs.map(rowHtml).join('');
      }).join('');
      // Consistency: a calendar of the chosen month — one small box per day, one blue whose opacity grows with the share of habits ticked
      const thisMonth = hFirstOfMonth(today), earliest = hFirstOfMonth(hKeyAdd(today, -334));
      if (hMonth && (hMonth > thisMonth || hMonth < earliest)) hMonth = null;
      const mFirst = hMonth || thisMonth, mLast = hKeyAdd(hFirstOfMonth(hKeyAdd(mFirst, 31)), -1), lead = (hDow(mFirst) + 6) % 7;
      const mLabel = new Date(mFirst + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      const heat = Array.from({ length: lead }, () => '<span class="blank"></span>').join('') + Array.from({ length: +mLast.slice(8) }, (_, i) => {
        const k = hKeyAdd(mFirst, i), r = k > today ? null : hDayRatio(k);
        const bg = r == null ? 'rgba(255,255,255,0.03)' : r > 0 ? `rgba(59,130,246,${(0.18 + 0.82 * r).toFixed(2)})` : 'rgba(255,255,255,0.06)';
        return `<span class="${k === today ? 'now' : ''}" title="${hKeyLabel(k)}${r == null ? '' : ' · ' + Math.round(r * 100) + '%'}" style="background:${bg}">${i + 1}</span>`;
      }).join('');
      const best = Math.max(0, ...HABITS.map(h => hRuns(h, today).best));
      const mon = hKeyAdd(today, -((hDow(today) + 6) % 7)); // this week's Monday
      const bars = Array.from({ length: 7 }, (_, i) => { const k = hKeyAdd(mon, i), r = k > today ? null : hDayRatio(k); return `<div class="bcol" title="${hKeyLabel(k)}${r == null ? '' : ' · ' + Math.round(r * 100) + '%'}"><div class="bbar" style="height:${Math.max(r || 0, 0.04) * 100}%;${k > today ? 'opacity:.25' : ''}"></div><div class="blbl">${'MTWTFSS'[i]}</div></div>`; }).join('');
      const oldTop = hResetScroll ? 0 : (root.querySelector('.h-list') || {}).scrollTop || 0;
      if (hResetScroll) { root.scrollTop = 0; hResetScroll = false; }
      root.innerHTML = `<div class="habit-grid">
        ${card(`<div class="section-title"><i class="fa-solid fa-circle-check"></i> ${showGroups ? 'Habits' : isToday ? 'Today' : day === hKeyAdd(today, -1) ? 'Yesterday' : hKeyLabel(day)}</div>` + `<div class="h-daynav"><button type="button" class="h-dprev" ${day <= hKeyAdd(today, -H_BACK) ? 'disabled' : ''} title="Previous day"><i class="fa-solid fa-chevron-left"></i></button><span class="lbl">${isToday ? 'Today' : day === hKeyAdd(today, -1) ? 'Yesterday' : hKeyLabel(day)}${isToday ? '' : ' · editing past day'}</span><button type="button" class="h-dnext" ${isToday ? 'disabled' : ''} title="Next day"><i class="fa-solid fa-chevron-right"></i></button>${isToday ? '' : '<button type="button" class="h-dtoday">Back to today</button>'}</div>` + (hSelecting ? `<div class="h-selbar"><button type="button" class="h-selall">${hSel.size === HABITS.length ? 'Deselect all' : 'Select all'}</button><span class="cnt">${hSel.size} selected</span><button type="button" class="del h-seldel" ${hSel.size ? '' : 'disabled'}><i class="fa-regular fa-trash-can"></i> Delete${hSel.size ? ' (' + hSel.size + ')' : ''}</button></div>` : '') + `<div class="h-list">${rows}</div>`, 'h-main')}
        <div class="h-side" style="display:flex;flex-direction:column;gap:0.9rem">
          ${card(`<div class="section-title"><i class="fa-solid fa-table-cells"></i> Consistency</div><div class="h-mnav"><button type="button" class="h-mprev" ${mFirst <= earliest ? 'disabled' : ''} title="Previous month"><i class="fa-solid fa-chevron-left"></i></button><span>${mLabel}</span><button type="button" class="h-mnext" ${mFirst >= thisMonth ? 'disabled' : ''} title="Next month"><i class="fa-solid fa-chevron-right"></i></button></div><div class="heat cal"><b>M</b><b>T</b><b>W</b><b>T</b><b>F</b><b>S</b><b>S</b>${heat}</div><div style="display:flex;justify-content:space-between;margin-top:12px;font-size:0.72rem"><span style="color:rgba(255,255,255,0.4)">Best streak</span><span style="color:#fff;font-weight:600">${best}</span></div>`)}
          ${card(`<div class="section-title"><i class="fa-solid fa-arrow-trend-up"></i> This week</div><div class="barchart" style="height:90px">${bars}</div>`)}
        </div></div>`;
      const list = root.querySelector('.h-list');
      if (list) {
        list.scrollTop = oldTop;
        const fade = () => list.classList.toggle('more', list.scrollTop + list.clientHeight < list.scrollHeight - 4);
        list.addEventListener('scroll', fade); requestAnimationFrame(fade);
      }
    }

    // tap on a habit's check button (day = today) or on one of its small squares (day = that period's first day)
    async function toggleHabitDay(id, day) {
      const h = HABITS.find(x => x.id === id), today = hToday(); if (!h || day > today) return;
      if (h.source === 'sleep') return goTo('health'); // sleep habits are worked out from the Health sleep log
      const pk = hPeriodKey(h, day), curPk = hPeriodKey(h, today);
      const logDay = h.period === 'daily' || pk === curPk ? day : pk;
      if (!HLOGS.has(id)) HLOGS.set(id, new Map());
      const m = HLOGS.get(id), before = new Map(m);
      let write;
      if (h.goal_value) { // measurable: ask how much (0 clears it)
        const raw = await luPrompt({ title: h.name, message: `How many ${h.unit || 'units'} ${logDay === today ? 'today' : 'on ' + hKeyLabel(logDay)}? Goal: ${h.goal_value}. Enter 0 to clear.`, placeholder: String(h.goal_value), value: String(m.has(logDay) ? m.get(logDay) : h.goal_value), ok: 'Save', numeric: true });
        if (raw == null) return;
        const v = Number(String(raw).replace(',', '.'));
        if (!isFinite(v) || v < 0) return luAlert('Please enter a number.', 'Invalid amount');
        if (v === 0) { m.delete(logDay); write = () => LumaHabits.setDone(id, logDay, false); }
        else { m.set(logDay, v); write = () => LumaHabits.setDone(id, logDay, true, v); }
      } else if (m.has(logDay)) {
        m.delete(logDay); write = () => LumaHabits.setDone(id, logDay, false);
      } else if (h.period !== 'daily' && h.per_period === 1 && hPeriodDone(h, pk, today)) { // done earlier in this week/month → undo that
        const end = hPeriodEnd(h, pk);
        for (let k = pk; k <= end; k = hKeyAdd(k, 1)) m.delete(k);
        write = () => LumaHabits.clearRange(id, pk, end);
      } else {
        m.set(logDay, null); write = () => LumaHabits.setDone(id, logDay, true);
      }
      paintHabits(); // optimistic
      const { error } = await write();
      if (error) { HLOGS.set(id, before); paintHabits(); luAlert('Could not save: ' + error.message); }
    }

    // ----- add / edit modal -----
    const habitForm = { id: null, icon: H_ICONS[0], color: '#3b82f6', days: new Set(LumaHabits.ALL_DAYS), period: 'daily', mode: 'tick' };
    const habitErr = m => { docEl('habitError').textContent = m; docEl('habitError').style.display = m ? 'flex' : 'none'; };
    const show = (id, on) => { docEl(id).style.display = on ? '' : 'none'; };
    function paintHabitForm() {
      const f = habitForm, daily = f.period === 'daily';
      docEl('habitIcons').style.setProperty('--hc', f.color);
      docEl('habitIcons').innerHTML = H_ICONS.map(i => `<button type="button" data-i="${i}" class="${i === f.icon ? 'on' : ''}"><i class="fa-solid ${i}"></i></button>`).join('');
      docEl('habitColors').innerHTML = COLOR_PALETTE.map(([c, n]) => `<button type="button" data-c="${c}" title="${n}" class="${c === f.color ? 'on' : ''}" style="background:${c}"></button>`).join('');
      docEl('habitDays').innerHTML = H_DAY_ORDER.map(([d, l]) => `<button type="button" data-d="${d}" class="${f.days.has(d) ? 'on' : ''}">${l}</button>`).join('');
      docEl('habitPeriod').innerHTML = H_GROUPS.map(([p, l]) => `<button type="button" data-p="${p}" class="${p === f.period ? 'on' : ''}">${l}</button>`).join('');
      docEl('habitMode').innerHTML = [['tick', 'Tick off'], ['amount', 'Amount'], ['sleep', 'Sleep (Health)']].map(([m, l]) => `<button type="button" data-m="${m}" class="${m === f.mode ? 'on' : ''}">${l}</button>`).join('');
      docEl('habitTpls').innerHTML = H_PRESETS.map((p, i) => `<button type="button" class="h-chip sm" data-preset="${i}"><i class="fa-solid ${p.icon}" style="color:${p.color}"></i>${p.name}</button>`).join('');
      show('habitDaysWrap', daily); show('habitModeWrap', daily); show('habitTimesWrap', !daily);
      show('habitAmtWrap', daily && f.mode !== 'tick'); show('habitUnitWrap', f.mode === 'amount'); show('habitTargetWrap', !daily || f.mode === 'tick');
      docEl('habitTimesLbl').textContent = 'Times per ' + H_PUNIT[f.period];
      docEl('habitTimes').max = f.period === 'weekly' ? 7 : 31;
      docEl('habitAmtLbl').textContent = f.mode === 'sleep' ? 'Hours of sleep needed' : 'Daily amount';
    }
    function openHabitModal(h, preset) {
      if (!h && planBlocked('habits', HABITS.length, 'habits')) return;
      const src = h || preset || {};
      habitForm.id = h ? h.id : null;
      habitForm.icon = src.icon || H_ICONS[Math.floor(Math.random() * H_ICONS.length)];
      habitForm.color = src.color || randomColor(HABITS.map(x => x.color));
      habitForm.days = new Set(src.days || LumaHabits.ALL_DAYS);
      habitForm.period = src.period || 'daily';
      habitForm.mode = src.source === 'sleep' ? 'sleep' : src.goal_value ? 'amount' : 'tick';
      docEl('habitModalTitle').textContent = h ? 'Edit habit' : 'New habit';
      docEl('habitName').value = src.name || ''; docEl('habitTarget').value = src.target || '';
      docEl('habitTimes').value = src.per_period || 1;
      docEl('habitGoal').value = src.goal_value || ''; docEl('habitUnit').value = src.unit && src.source !== 'sleep' ? src.unit : '';
      docEl('habitRemind').value = h ? h.reminder_time || '' : ''; if (docEl('habitRemind')._luTimeRefresh) docEl('habitRemind')._luTimeRefresh();
      docEl('habitDelete').style.display = h ? '' : 'none';
      show('habitTplWrap', !h);
      habitErr(''); paintHabitForm();
      docEl('habitOverlay').classList.add('open'); setTimeout(() => docEl('habitName').focus(), 50);
    }
    const closeHabitModal = () => docEl('habitOverlay').classList.remove('open');
    const setHabitErrFrom = e => habitErr(/habits|period|per_period|goal_value|source|unit|value|reminder_time|schema cache|does not exist/i.test(e.message) ? 'Habits aren\'t fully set up — run supabase/migrations/016, 017 and 018 (habit_reminders) in the SQL Editor.' : e.message);
    // ----- templates: show what will be added, ask first, and skip habits you already have -----
    const H_DAYNAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const habitRowsFromPreset = p => (p.pack || [null]).map(n => ({
      name: n ? (p.name.startsWith('Solat') ? 'Solat ' + n : n) : p.name,
      icon: p.icon, color: p.color, target: '', days: LumaHabits.ALL_DAYS,
      period: p.period || 'daily', per_period: p.per_period || 1, goal_value: p.goal_value || null, unit: p.unit || '', source: p.source || 'manual',
    }));
    function habitSummary(r) {
      const when = r.period === 'weekly' ? `${r.per_period}× a week` : r.period === 'monthly' ? `${r.per_period}× a month`
        : r.days.length === 7 ? 'every day' : H_DAY_ORDER.filter(([d]) => r.days.includes(d)).map(([d]) => H_DAYNAMES[d]).join(', ');
      const how = r.source === 'sleep' ? `counted from your Health sleep log (${r.goal_value}h or more)` : r.goal_value ? `goal ${r.goal_value} ${r.unit}`.trim() : 'tick off';
      return `${when} · ${how}`;
    }
    const habitExists = name => HABITS.some(h => h.name.trim().toLowerCase() === name.trim().toLowerCase());
    async function useHabitPreset(i) {
      const p = H_PRESETS[i]; if (!p) return;
      const all = habitRowsFromPreset(p), fresh = all.filter(r => !habitExists(r.name)), skipped = all.length - fresh.length;
      if (!fresh.length) return luAlert(all.length > 1 ? `You already have all ${all.length} of these habits.` : `You already have “${all[0].name}”.`, 'Already added');
      const ok = await luConfirm({
        title: fresh.length > 1 ? `Add ${fresh.length} habits?` : `Add “${fresh[0].name}”?`,
        message: fresh.map(r => `• ${r.name} — ${habitSummary(r)}`).join('\n') + (skipped ? `\n\n${skipped} you already have ${skipped === 1 ? 'is' : 'are'} skipped.` : ''),
        icon: 'fa-plus', tone: 'info', ok: 'Add',
      });
      if (!ok) return;
      const { data, error } = await LumaHabits.addMany(fresh);
      if (error) return luAlert(/habits|period|per_period|goal_value|source|unit|reminder_time|schema cache|does not exist/i.test(error.message) ? 'Habits aren\'t fully set up — run supabase/migrations/016, 017 and 018 (habit_reminders) in the SQL Editor.' : error.message);
      data.forEach(r => HABITS.push(hRow(r)));
      if (data.some(r => r.source === 'sleep')) await loadSleep();
      closeHabitModal(); paintHabits();
    }
    docEl('habitClose').onclick = closeHabitModal;
    docEl('habitOverlay').onclick = e => { if (e.target === docEl('habitOverlay')) closeHabitModal(); };
    docEl('habitIcons').onclick = e => { const b = e.target.closest('button'); if (b) { habitForm.icon = b.dataset.i; paintHabitForm(); } };
    docEl('habitColors').onclick = e => { const b = e.target.closest('button'); if (b) { habitForm.color = b.dataset.c; paintHabitForm(); } };
    docEl('habitDays').onclick = e => { const b = e.target.closest('button'); if (!b) return; const d = +b.dataset.d; habitForm.days.has(d) ? habitForm.days.delete(d) : habitForm.days.add(d); paintHabitForm(); };
    docEl('habitPeriod').onclick = e => { const b = e.target.closest('button'); if (b) { habitForm.period = b.dataset.p; if (b.dataset.p !== 'daily') habitForm.mode = 'tick'; paintHabitForm(); } };
    docEl('habitMode').onclick = e => { const b = e.target.closest('button'); if (b) { habitForm.mode = b.dataset.m; if (b.dataset.m === 'sleep' && !docEl('habitGoal').value) docEl('habitGoal').value = 6; paintHabitForm(); } };
    docEl('habitTpls').onclick = e => { const b = e.target.closest('button'); if (b) useHabitPreset(+b.dataset.preset); };
    docEl('habitName').addEventListener('keydown', e => { if (e.key === 'Enter') docEl('habitSave').click(); });
    docEl('habitSave').onclick = async () => {
      const f = habitForm, daily = f.period === 'daily', name = docEl('habitName').value.trim();
      if (!name) return habitErr('Give your habit a name.');
      if (daily && !f.days.size) return habitErr('Pick at least one day.');
      const times = Math.round(+docEl('habitTimes').value), goal = +docEl('habitGoal').value;
      if (!daily && !(times >= 1 && times <= (f.period === 'weekly' ? 7 : 31))) return habitErr(`Times per ${H_PUNIT[f.period]} must be between 1 and ${f.period === 'weekly' ? 7 : 31}.`);
      const measured = daily && f.mode !== 'tick';
      if (measured && !(goal > 0)) return habitErr(f.mode === 'sleep' ? 'Enter how many hours of sleep you need.' : 'Enter the daily amount (a number above 0).');
      const fields = {
        name, icon: f.icon, color: f.color,
        target: !daily || f.mode === 'tick' ? docEl('habitTarget').value.trim() : '',
        days: daily ? [...f.days].sort((a, b) => a - b) : LumaHabits.ALL_DAYS,
        period: f.period, per_period: daily ? 1 : times,
        goal_value: measured ? goal : null,
        unit: f.mode === 'amount' && daily ? docEl('habitUnit').value.trim() : f.mode === 'sleep' && daily ? 'h' : '',
        source: f.mode === 'sleep' && daily ? 'sleep' : 'manual',
        reminder_time: docEl('habitRemind').value || null,
      };
      if (HABITS.some(h => h.id !== f.id && h.name.trim().toLowerCase() === name.toLowerCase()) && !await luConfirm({ title: `You already have “${name}”`, message: 'Add another habit with the same name?', icon: 'fa-clone', tone: 'info', ok: 'Add anyway' })) return;
      const btn = docEl('habitSave'); btn.disabled = true; btn.textContent = 'Saving…';
      const { data, error } = f.id ? await LumaHabits.update(f.id, fields) : await LumaHabits.add(fields);
      btn.disabled = false; btn.textContent = 'Save habit';
      if (error) return setHabitErrFrom(error);
      const row = hRow(data), i = HABITS.findIndex(x => x.id === row.id);
      if (i >= 0) HABITS[i] = row; else HABITS.push(row);
      if (row.source === 'sleep') await loadSleep();
      closeHabitModal(); paintHabits();
    };
    docEl('habitDelete').onclick = async () => {
      const h = HABITS.find(x => x.id === habitForm.id); if (!h) return;
      if (!await luConfirm({ title: `Delete “${h.name}”?`, message: 'It moves to your Deleted list (button at the top), stops reminding you and no longer counts in Consistency or best streak. You can restore it from there.' })) return;
      const { error } = await LumaHabits.remove(h.id);
      if (error) return habitErr(error.message);
      HGONE.push({ ...h, archived: true, updated_at: new Date().toISOString() }); HABITS = HABITS.filter(x => x !== h); closeHabitModal(); paintHabits();
    };


    // ----- list of deleted habits -----
    const goneErr = m => { docEl('goneError').textContent = m; docEl('goneError').style.display = m ? 'flex' : 'none'; };
    function paintGone() {
      const list = [...HGONE].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
      docEl('goneClear').style.display = list.length ? '' : 'none';
      docEl('goneList').innerHTML = list.length ? list.map(h => {
        const n = [...(HLOGS.get(h.id) || new Map()).keys()].filter(k => hLogged(h, k)).length;
        return `<div class="hrow" data-id="${h.id}"><div class="licon" style="color:${h.color};background:${h.color}22"><i class="fa-solid ${h.icon}"></i></div><div style="flex:1;min-width:0"><div class="lt">${escapeHtml(h.name)}</div><div class="ls">Deleted ${hKeyLabel(mytDayKey(h.updated_at))} · done ${n} day${n === 1 ? '' : 's'}</div></div><button type="button" class="np-btn gone-restore">Restore</button></div>`;
      }).join('') : '<div class="lu-empty">No deleted habits.</div>';
    }
    function openGone() { goneErr(''); paintGone(); docEl('goneOverlay').classList.add('open'); }
    const closeGone = () => docEl('goneOverlay').classList.remove('open');
    docEl('goneClose').onclick = closeGone;
    docEl('goneOverlay').onclick = e => { if (e.target === docEl('goneOverlay')) closeGone(); };
    docEl('goneList').onclick = async e => {
      const b = e.target.closest('.gone-restore'), row = e.target.closest('.hrow'); if (!b || !row) return;
      const h = HGONE.find(x => x.id === row.dataset.id); if (!h) return;
      b.disabled = true; goneErr('');
      const { data, error } = await LumaHabits.update(h.id, { archived: false });
      if (error) { b.disabled = false; return goneErr(error.message); }
      HGONE = HGONE.filter(x => x !== h); HABITS.push(hRow(data)); HABITS.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
      if (!HGONE.length) closeGone();
      paintHabits();
    };
    docEl('goneClear').onclick = async () => {
      const ids = HGONE.map(h => h.id); if (!ids.length) return;
      if (!await luConfirm({ title: `Clear ${ids.length} deleted habit${ids.length === 1 ? '' : 's'}?`, message: 'They are erased for good, together with their saved ticks. This can\'t be undone. Your current habits aren\'t touched.', icon: 'fa-box-archive', ok: 'Clear' })) return;
      const { error } = await LumaHabits.purgeDeleted(ids);
      if (error) return goneErr(error.message);
      HGONE = []; ids.forEach(id => HLOGS.delete(id)); closeGone(); paintHabits();
    };

    async function loadHabits(pg) {
      pg.querySelector('#addHabitBtn').addEventListener('click', () => openHabitModal(null));
      hSelecting = false; hSel.clear(); hDay = null; hMonth = null;
      pg.querySelector('#goneHabitBtn').addEventListener('click', openGone);
      pg.querySelector('#selectHabitBtn').addEventListener('click', () => { hSelecting = !hSelecting; hSel.clear(); paintHabits(); });
      pg.querySelector('#habitsRoot').addEventListener('click', async e => {
        const hj = e.target.closest('.h-daynav .lbl'); if (hj) { const t0 = hToday(); return void luDatePopup(hj, { value: hDay || t0, min: hKeyAdd(t0, -H_BACK), max: t0, onPick: k => { hDay = k === t0 ? null : k; hResetScroll = true; paintHabits(); } }); }
        const hm = e.target.closest('.h-mnav > span'); if (hm && hm.previousElementSibling && hm.previousElementSibling.classList.contains('h-mprev')) { const t0 = hToday(); return void luDatePopup(hm, { value: hMonth || hFirstOfMonth(t0), max: t0, onPick: k => { hMonth = hFirstOfMonth(k); if (hMonth === hFirstOfMonth(t0)) hMonth = null; paintHabits(); } }); }
        if (e.target.closest('.h-dprev') || e.target.closest('.h-dnext') || e.target.closest('.h-dtoday')) {
          const t0 = hToday(), cur = hDay || t0;
          hDay = e.target.closest('.h-dtoday') ? null : (e.target.closest('.h-dprev') ? hKeyAdd(cur, -1) : hKeyAdd(cur, 1));
          if (hDay === t0) hDay = null;
          hResetScroll = true;
          return paintHabits();
        }
        if (e.target.closest('.h-mprev') || e.target.closest('.h-mnext')) {
          const cur = hMonth || hFirstOfMonth(hToday());
          hMonth = e.target.closest('.h-mprev') ? hFirstOfMonth(hKeyAdd(cur, -1)) : hFirstOfMonth(hKeyAdd(cur, 32));
          if (hMonth === hFirstOfMonth(hToday())) hMonth = null;
          return paintHabits();
        }
        if (e.target.closest('.h-selall')) { hSel.size === HABITS.length ? hSel.clear() : HABITS.forEach(h => hSel.add(h.id)); return paintHabits(); }
        if (e.target.closest('.h-seldel')) {
          const ids = [...hSel]; if (!ids.length) return;
          if (!await luConfirm({ title: `Delete ${ids.length} habit${ids.length === 1 ? '' : 's'}?`, message: 'They move to your Deleted list (button at the top), stop reminding you and no longer count in Consistency or best streak. You can restore them from there.', ok: 'Delete' })) return;
          const { error } = await LumaHabits.removeMany(ids);
          if (error) return luAlert('Could not delete: ' + error.message);
          const now = new Date().toISOString();
          HABITS.filter(h => hSel.has(h.id)).forEach(h => HGONE.push({ ...h, archived: true, updated_at: now }));
          HABITS = HABITS.filter(h => !hSel.has(h.id)); hSel.clear(); hSelecting = false;
          return paintHabits();
        }
        const selRow = hSelecting && e.target.closest('.hrow');
        if (selRow) { const id = selRow.dataset.id; hSel.has(id) ? hSel.delete(id) : hSel.add(id); return paintHabits(); }
        const chip = e.target.closest('.h-chip'); if (chip) return useHabitPreset(+chip.dataset.preset);
        const row = e.target.closest('.hrow'); if (!row) return;
        if (e.target.closest('.hedit')) return openHabitModal(HABITS.find(x => x.id === row.dataset.id));
        const t = e.target.closest('.hbtn, .hdot'); if (t) toggleHabitDay(row.dataset.id, t.dataset.day);
      });
      paintHabits(); // instant, from what's already loaded
      await refreshHabits(); paintHabits();
    }



    WIRE.habits = function (pg) { return loadHabits(pg); };
