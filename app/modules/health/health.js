// LUMA — module: health
      // ---------------- HEALTH ----------------
    MODULES.health = function () {
        return head('Health', '<span id="healthSub">Loading…</span>',
          '<button class="create-btn" id="healthRemBtn" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-regular fa-bell"></i> Reminders</button><button class="create-btn" id="healthGoalsBtn" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-bullseye"></i> Goals</button><button class="create-btn" id="healthLogBtn"><i class="fa-solid fa-plus"></i> Log entry</button>') +
          '<div id="healthTabs" style="display:flex;gap:10px;margin-bottom:1rem"></div>' +
          '<div id="healthOverview"><div class="grid-4" id="healthRings" style="margin-bottom:0.9rem"></div><div class="grid-3" id="healthCharts" style="margin-bottom:0.9rem"></div><div id="healthHistory"></div></div>' +
          '<div id="healthDiary" style="display:none"><div style="margin-bottom:0.9rem"><input id="diarySearch" placeholder="Search your notes…" autocomplete="off" style="height:40px;width:100%;max-width:360px;border-radius:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;padding:0 14px;font-size:0.8rem;outline:none;font-family:inherit"></div><div id="diaryList"></div></div>';
    };

    // =====================================================
    //  HEALTH REMINDERS — water / steps / sleep. A timer checks every 30 s while LUMA is open; when a slot is due it
    //  asks the database to create the notification (rate-limited server-side), which then reaches the bell, the
    //  toast and (if allowed) a browser notification through the normal realtime path.
    // =====================================================
    let REMINDERS = null, remTimer = null;
    const REM_GRACE_MIN = 10; // a slot older than this is skipped (e.g. the tab was asleep)
    const mytNowMin = () => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: MYT, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()); return +p.find(x => x.type === 'hour').value * 60 + +p.find(x => x.type === 'minute').value; };
    function remDueSlot(kind, now) {
      const R = REMINDERS;
      if (kind === 'sleep') {
        const slot = (((timeToMin(R.bedtime) - R.sleep_lead_min) % 1440) + 1440) % 1440;
        return now >= slot && now - slot <= REM_GRACE_MIN ? slot : null;
      }
      const from = timeToMin(R[kind + '_from']), to = timeToMin(R[kind + '_to']), every = R[kind + '_every_min'];
      if (to <= from || now < from) return null;
      const slot = from + Math.floor((now - from) / every) * every;
      return slot <= to && now - slot <= REM_GRACE_MIN ? slot : null;
    }
    async function remBody(kind, day) {
      if (kind === 'sleep') {
        const mins = (timeToMin(REMINDERS.wake_time) - timeToMin(REMINDERS.bedtime) + 1440) % 1440;
        return `Bedtime is ${fmt12(REMINDERS.bedtime)} — wind down now to get about ${Math.round(mins / 6) / 10}h before your ${fmt12(REMINDERS.wake_time)} wake-up.`;
      }
      const [logs, goals] = await Promise.all([LumaHealth.listLogs(day), LumaHealth.getGoals()]);
      const t = (logs.data || []).find(l => l.log_date === day) || {};
      if (kind === 'water') {
        const have = t.water_ml || 0, goal = goals.data.water_ml;
        return have >= goal ? null : `You've had ${fmtLitres(have)} of your ${fmtLitres(goal)} goal — time for a glass.`;
      }
      if (kind === 'active') {
        const have = t.active_minutes || 0, goal = goals.data.active_minutes;
        return have >= goal ? null : `${have} of ${goal} active minutes so far — a quick workout will help.`;
      }
      const have = t.steps || 0, goal = goals.data.steps;
      return have >= goal ? null : `${fmtNum(have)} of ${fmtNum(goal)} steps so far — a short walk will help.`;
    }
    async function checkReminders() {
      if (!REMINDERS || !LUMA_USER) return;
      const now = mytNowMin(), day = mytDayKey(Date.now());
      for (const kind of ['water', 'steps', 'active', 'sleep']) {
        if (!REMINDERS[kind + '_enabled']) continue;
        const slot = remDueSlot(kind, now); if (slot == null) continue;
        const key = `luma.rem.${LUMA_USER.id}.${kind}`, mark = day + '|' + slot;
        try { if (localStorage.getItem(key) === mark) continue; localStorage.setItem(key, mark); } catch (e) { } // mark first so it can't fire twice
        try { const body = await remBody(kind, day); if (body) await LumaHealth.pushReminder(kind, body); } catch (e) { console.info('LUMA: reminder failed', e); }
      }
    }
    function applyReminders(r) { REMINDERS = r; clearInterval(remTimer); remTimer = setInterval(checkReminders, 30000); checkReminders(); }
    async function initReminders() { const { data, error } = await LumaHealth.getReminders(); if (!error) applyReminders(data); } // error = migration 013 not run yet: reminders stay off


    // =====================================================
    //  HEALTH — daily logs + goals (migration 011)
    // =====================================================
    const MOOD_ICO = ['fa-face-frown', 'fa-face-meh', 'fa-face-smile', 'fa-face-grin', 'fa-face-laugh'];
    const MOOD_COL = ['#fca5a5', '#fcd34d', '#93c5fd', '#6ee7b7', '#34d399'];
    const MOOD_NAME = ['Low', 'Meh', 'Okay', 'Good', 'Great'];
    const dayKeyAgo = n => mytDayKey(Date.now() - n * 86400000);
    const keyDate = k => new Date(k + 'T12:00:00+08:00');
    const fmtKey = (k, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: MYT, ...opts }).format(keyDate(k));
    const fmtWater = ml => fmtNum(ml) + ' ml';
    const fmtLitres = ml => (ml / 1000).toFixed(2).replace(/\.?0+$/, '') + ' L';
    const fmtNum = n => Number(n).toLocaleString('en-US');

    async function loadHealth(pg) {
      const sub = pg.querySelector('#healthSub');
      let logs = [], goals = { ...LumaHealth.DEFAULT_GOALS };
      const today = () => mytDayKey(Date.now());
      const logOf = k => logs.find(l => l.log_date === k);
      const showErr = (id, m) => { const el = docEl(id); el.textContent = m; el.style.display = m ? 'flex' : 'none'; };
      const setupHint = e => /health_|schema cache|does not exist/i.test(e.message || '') ? 'Health isn\'t set up yet — run supabase/migrations/011_health.sql in the SQL Editor.' : e.message;

      let view = 'overview', diaryQuery = '';
      const renderDiary = () => {
        const q = diaryQuery.trim().toLowerCase();
        const notes = logs.filter(l => l.note && l.note.trim() && (!q || l.note.toLowerCase().includes(q)));
        let html = '', last = '';
        notes.forEach(l => {
          const g = fmtKey(l.log_date, { month: 'long', year: 'numeric' });
          if (g !== last) { html += `<div class="notif-group">${g}</div>`; last = g; }
          const chips = [l.sleep_hours != null && `<i class="fa-solid fa-moon"></i> ${l.sleep_hours}h${l.bedtime && l.wake_time ? ` · ${fmt12(l.bedtime)} → ${fmt12(l.wake_time)}` : ''}`, l.water_ml != null && `<i class="fa-solid fa-droplet"></i> ${fmtNum(l.water_ml)} ml`, l.steps != null && `<i class="fa-solid fa-shoe-prints"></i> ${fmtNum(l.steps)}`, l.active_minutes != null && `<i class="fa-solid fa-fire"></i> ${l.active_minutes}m`].filter(Boolean);
          html += card(`<div class="de-date"><div class="de-day">${fmtKey(l.log_date, { day: 'numeric' })}</div><div class="de-mon">${fmtKey(l.log_date, { month: 'short' })}</div><div class="de-wd">${fmtKey(l.log_date, { weekday: 'short' })}</div></div>
            <div class="de-main"><div class="de-top">${l.mood ? `<span class="de-mood" style="color:${MOOD_COL[l.mood - 1]}"><i class="fa-solid ${MOOD_ICO[l.mood - 1]}"></i> ${MOOD_NAME[l.mood - 1]}</span>` : ''}${chips.map(c => `<span class="de-chip">${c}</span>`).join('')}</div>
            <div class="de-note">${escapeHtml(l.note)}</div><div class="ls" style="margin-top:8px;opacity:.7"><i class="fa-regular fa-clock"></i> Last updated ${mytDateTime(l.updated_at)}</div></div>
            <div class="h-act"><i class="fa-solid fa-pen h-edit" title="Edit"></i><i class="fa-regular fa-trash-can h-del" title="Remove note"></i></div>`, 'diary-entry h-row').replace('class="card diary-entry h-row"', `class="card diary-entry h-row" data-date="${l.log_date}"`);
        });
        pg.querySelector('#diaryList').innerHTML = html || `<div class="ls" style="padding:10px 2px">${logs.some(l => l.note && l.note.trim()) ? 'No notes match your search.' : 'No notes yet — add a note when you log an entry and it will appear here.'}</div>`;
      };
      const render = () => {
        const noteCount = logs.filter(l => l.note && l.note.trim()).length;
        pg.querySelector('#healthTabs').innerHTML = [['overview', 'Overview'], ['diary', `Diary${noteCount ? ' (' + noteCount + ')' : ''}`]].map(([k, l]) =>
          `<span class="suggestion-badge health-tab" data-k="${k}" style="${k === view ? 'background:rgba(59,130,246,0.14);color:#93c5fd;border-color:rgba(59,130,246,0.3)' : ''};font-size:0.74rem;padding:0.4rem 1.1rem;cursor:pointer">${l}</span>`).join('');
        pg.querySelector('#healthOverview').style.display = view === 'overview' ? '' : 'none';
        pg.querySelector('#healthDiary').style.display = view === 'diary' ? '' : 'none';
        if (view === 'diary') renderDiary();
        const t = logOf(today()) || {};
        sub.textContent = fmtKey(today(), { weekday: 'long', day: 'numeric', month: 'long' }) + (logOf(today()) ? ' · last updated ' + mytDateTime(logOf(today()).updated_at) : ' · nothing logged yet');

        // --- today's rings vs goals ---
        // [name, today's value, goal, formatter, goal formatter, colour, icon, DB column, quick amount, quick label]
        const hLabel = h => h < 1 ? Math.round(h * 60) + ' min' : h + ' h';
        const rings = [
          ['Sleep', t.sleep_hours, goals.sleep_hours, v => v + 'h', g => g + 'h', '#a78bfa', 'fa-moon', 'sleep_hours', goals.quick_sleep_hours, hLabel(goals.quick_sleep_hours)],
          ['Water', t.water_ml, goals.water_ml, fmtLitres, fmtLitres, '#38bdf8', 'fa-droplet', 'water_ml', goals.quick_water_ml, fmtNum(goals.quick_water_ml) + ' ml'], // the ring reads in litres; logging and history stay in ml
          ['Steps', t.steps, goals.steps, fmtNum, fmtNum, '#34d399', 'fa-shoe-prints', 'steps', goals.quick_steps, fmtNum(goals.quick_steps)],
          ['Active', t.active_minutes, goals.active_minutes, v => v + 'm', g => g + 'm', '#fb923c', 'fa-fire', 'active_minutes', goals.quick_active_minutes, goals.quick_active_minutes + ' min'],
        ];
        pg.querySelector('#healthRings').innerHTML = rings.map(([name, val, goal, f, fg, col, icon, colName, qty, qLabel]) => {
          const v = Number(val) || 0, pct = Math.min(100, Math.round(v / goal * 100));
          return card(`<div style="text-align:center">${ring(pct, col, '', '', 90).replace('<div class="ring-label">', '<div class="ring-label"><i class="fa-solid ' + icon + '" style="color:' + col + ';font-size:1.1rem"></i>')}
            <div class="lt" style="margin-top:10px">${val == null ? '—' : f(v)}</div><div class="ls">${name} · goal ${fg(goal)} · ${pct}%</div>
            <div class="quick-row"><button type="button" class="quick-btn minus" data-quick="${colName}" data-dir="-1" title="Take away ${qLabel}" style="--c:${col}"><i class="fa-solid fa-minus"></i></button><button type="button" class="quick-btn" data-quick="${colName}" data-dir="1" title="Add ${qLabel} to today" style="--c:${col}"><i class="fa-solid fa-plus"></i> ${qLabel}</button></div></div>`, 'h-card').replace('class="card h-card"', 'class="card h-card" data-log-today="1" data-focus="' + ({ Sleep: 'hSleep', Water: 'hWater', Steps: 'hSteps', Active: 'hActive' }[name]) + '"');
        }).join('');

        // --- 7-day charts ---
        const days = [6, 5, 4, 3, 2, 1, 0].map(dayKeyAgo);
        const bars = (vals, max, cls, fmt) => `<div class="barchart" style="flex:1;height:90px">${days.map((k, i) => `<div class="bcol" title="${fmtKey(k, { weekday: 'short', day: 'numeric', month: 'short' })}${vals[i] != null ? ' · ' + fmt(vals[i]) : ' · no data'}"><div class="bbar ${cls}" style="height:${vals[i] != null ? Math.max(6, vals[i] / max * 100) : 6}%;${vals[i] == null ? 'opacity:0.18' : ''}"></div><div class="blbl">${fmtKey(k, { weekday: 'narrow' })}</div></div>`).join('')}</div>`;
        const vals = f => days.map(k => { const l = logOf(k); return l && l[f] != null ? Number(l[f]) : null; });
        const avg = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
        const sl = vals('sleep_hours'), st = vals('steps');
        // mood is shown for the current calendar week, Monday → Sunday (days still to come are dimmed)
        const dow = (new Date(today() + 'T12:00:00+08:00').getUTCDay() + 6) % 7; // 0 = Monday
        const week = [0, 1, 2, 3, 4, 5, 6].map(i => dayKeyAgo(dow - i));
        const mo = week.map(k => { const l = logOf(k); return l && l.mood ? l.mood : null; });
        const slAvg = avg(sl), stAvg = avg(st);
        pg.querySelector('#healthCharts').innerHTML =
          card(`<div class="section-title"><i class="fa-solid fa-heart"></i> Mood this week</div><div style="display:flex;justify-content:space-between;align-items:flex-end;padding:8px 0">${week.map((k, i) => `<div style="text-align:center;${k > today() ? 'opacity:0.45' : ''}" title="${fmtKey(k, { weekday: 'long', day: 'numeric', month: 'short' })} · ${mo[i] ? MOOD_NAME[mo[i] - 1] : k > today() ? 'upcoming' : 'No mood logged'}"><i class="fa-solid ${mo[i] ? MOOD_ICO[mo[i] - 1] : 'fa-face-meh-blank'}" style="font-size:1.5rem;color:${mo[i] ? MOOD_COL[mo[i] - 1] : 'rgba(255,255,255,0.15)'}"></i><div class="ls" style="margin-top:8px;${k === today() ? 'color:#93c5fd;font-weight:600' : ''}">${fmtKey(k, { weekday: 'narrow' })}</div></div>`).join('')}</div>`) +
          card(`<div class="section-title"><i class="fa-solid fa-moon"></i> Sleep · last 7 days</div><div style="display:flex;align-items:center;gap:18px"><div><div class="m-value">${slAvg == null ? '—' : slAvg.toFixed(1) + 'h'}</div><div class="ls">avg / night</div></div>${bars(sl, Math.max(goals.sleep_hours, ...sl.filter(Boolean)), 'alt', v => v + 'h')}</div>`) +
          card(`<div class="section-title"><i class="fa-solid fa-shoe-prints"></i> Steps · last 7 days</div><div style="display:flex;align-items:center;gap:18px"><div><div class="m-value">${stAvg == null ? '—' : fmtNum(Math.round(stAvg))}</div><div class="ls">avg / day</div></div>${bars(st, Math.max(goals.steps, ...st.filter(Boolean)), '', fmtNum)}</div>`);

        // --- recent entries ---
        pg.querySelector('#healthHistory').innerHTML = card(`<div class="section-title"><i class="fa-solid fa-clock-rotate-left"></i> Recent entries</div>` + (logs.length ? logs.slice(0, 3).map(l => {
          const bits = [l.sleep_hours != null && `Sleep ${l.sleep_hours}h${l.bedtime && l.wake_time ? ` (${fmt12(l.bedtime)} → ${fmt12(l.wake_time)})` : ''}`, l.water_ml != null && `Water ${fmtWater(l.water_ml)}`, l.steps != null && `${fmtNum(l.steps)} steps`, l.active_minutes != null && `Active ${l.active_minutes}m`].filter(Boolean);
          return `<div class="lrow h-row" data-date="${l.log_date}"><div class="licon" style="color:${l.mood ? MOOD_COL[l.mood - 1] : 'rgba(255,255,255,0.4)'}"><i class="fa-solid ${l.mood ? MOOD_ICO[l.mood - 1] : 'fa-notes-medical'}"></i></div>
            <div class="lmain"><div class="lt">${fmtKey(l.log_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${l.log_date === today() ? ' · Today' : ''}</div><div class="ls">${escapeHtml(bits.join(' · ') || 'Mood only')}${l.note ? ' — ' + escapeHtml(l.note.length > 70 ? l.note.slice(0, 70) + '…' : l.note) : ''}</div><div class="ls" style="opacity:.75"><i class="fa-regular fa-clock"></i> Last updated ${mytDateTime(l.updated_at)}</div></div>
            <div class="h-act"><i class="fa-solid fa-pen h-edit" title="Edit"></i><i class="fa-regular fa-trash-can h-del" title="Delete"></i></div></div>`;
        }).join('') : '<div class="lu-empty">No entries yet — hit Log entry to add your first day.</div>'));
      };

      // live range checking: a wrong value gets a red border and a short reason, and blocks Save
      const RANGES = {
        hSleep: [0, 24, 'hours'], hWater: [0, 20000, 'ml', true], hSteps: [0, 200000, 'steps', true], hActive: [0, 1440, 'minutes', true],
        qSleep: [0.5, 12, 'hours'], qWater: [10, 5000, 'ml', true], qSteps: [10, 20000, 'steps', true], qActive: [1, 600, 'minutes', true],
        gSleep: [1, 24, 'hours'], gWater: [500, 20000, 'ml', true], gSteps: [100, 200000, 'steps', true], gActive: [5, 1440, 'minutes', true]
      };
      const checkField = id => {
        const el = docEl(id), [min, max, unit, whole] = RANGES[id], raw = el.value;
        let msg = '';
        if (raw !== '') {
          const v = Number(raw);
          if (!Number.isFinite(v)) msg = 'Enter a number.';
          else if (v < min || v > max) msg = `Must be between ${fmtNum(min)} and ${fmtNum(max)} ${unit}.`;
          else if (whole && !Number.isInteger(v)) msg = 'Whole numbers only.';
        }
        el.classList.toggle('invalid', !!msg);
        const box = el.closest('.pem-field'); let err = box.querySelector('.field-err');
        if (msg) { if (!err) { err = document.createElement('div'); err.className = 'field-err'; box.appendChild(err); } err.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + msg; }
        else if (err) err.remove();
        return !msg;
      };
      const anyInvalid = ids => ids.some(id => docEl(id).classList.contains('invalid'));
      const LOG_IDS = ['hSleep', 'hWater', 'hSteps', 'hActive'], GOAL_IDS = ['gSleep', 'gWater', 'gSteps', 'gActive', 'qSleep', 'qWater', 'qSteps', 'qActive'];

      // ----- log modal -----
      let moodVal = null;
      const dirty = new Set(); // fields the user changed — only these are saved, so one metric can be logged at a time
      const moodBtns = () => { docEl('hMood').innerHTML = MOOD_ICO.map((ic, i) => `<button type="button" data-m="${i + 1}" class="${moodVal === i + 1 ? 'on' : ''}" title="${MOOD_NAME[i]}"><i class="fa-solid ${ic}" style="color:${MOOD_COL[i]}"></i></button>`).join(''); };
      const fill = k => { // load that day's entry (or blank) into the form
        const l = logOf(k) || {};
        docEl('hSleep').value = l.sleep_hours ?? ''; docEl('hWater').value = l.water_ml ?? '';
        docEl('hSteps').value = l.steps ?? ''; docEl('hActive').value = l.active_minutes ?? '';
        docEl('hNote').value = l.note || ''; docEl('hBed').value = l.bedtime || ''; docEl('hWake').value = l.wake_time || ''; docEl('hBed')._luTimeRefresh(); docEl('hWake')._luTimeRefresh(); moodVal = l.mood || null; dirty.clear(); LOG_IDS.forEach(checkField); moodBtns(); syncSave();
        docEl('healthTitle').textContent = logOf(k) ? 'Edit entry' : 'Log health entry';
      };
      const syncSave = () => { docEl('healthSave').disabled = !dirty.size || !docEl('hDate').value || anyInvalid(LOG_IDS); };
      const openLog = (k, focusId) => {
        docEl('hDate').max = today(); docEl('hDate').value = k || today(); docEl('hDate')._luDateRefresh();
        showErr('healthError', ''); fill(docEl('hDate').value);
        docEl('healthOverlay').classList.add('open');
        if (focusId) setTimeout(() => docEl(focusId).focus(), 50); // clicked a ring: jump straight to that metric
      };
      const closeLog = () => docEl('healthOverlay').classList.remove('open');
      docEl('healthClose').onclick = closeLog;
      docEl('healthOverlay').onclick = e => { if (e.target === docEl('healthOverlay')) closeLog(); };
      docEl('hDate').onchange = () => fill(docEl('hDate').value);
      ['hSleep', 'hWater', 'hSteps', 'hActive', 'hNote'].forEach(id => docEl(id).oninput = () => { dirty.add(id); if (RANGES[id]) checkField(id); syncSave(); });
      // bedtime + wake-up time → sleep hours (wake-up may be after midnight)
      const autoSleep = () => {
        const b = docEl('hBed').value, w = docEl('hWake').value; if (!b || !w) return;
        const mins = (timeToMin(w) - timeToMin(b) + 1440) % 1440;
        if (!mins) return;
        docEl('hSleep').value = Math.round(mins / 6) / 10; dirty.add('hSleep'); checkField('hSleep');
      };
      ['hBed', 'hWake'].forEach(id => docEl(id).oninput = () => { dirty.add(id); autoSleep(); syncSave(); });
      docEl('hMood').onclick = e => { const b = e.target.closest('button[data-m]'); if (!b) return; const v = +b.dataset.m; moodVal = moodVal === v ? null : v; dirty.add('hMood'); moodBtns(); syncSave(); };
      const num = (id, conv = x => x) => { const v = docEl(id).value; return v === '' ? null : conv(Number(v)); };
      docEl('healthSave').onclick = async () => {
        const date = docEl('hDate').value, btn = docEl('healthSave');
        const all = {
          hSleep: ['sleep_hours', () => num('hSleep')], hWater: ['water_ml', () => num('hWater', Math.round)],
          hSteps: ['steps', () => num('hSteps', Math.round)], hActive: ['active_minutes', () => num('hActive', Math.round)],
          hBed: ['bedtime', () => docEl('hBed').value || null], hWake: ['wake_time', () => docEl('hWake').value || null],
          hMood: ['mood', () => moodVal], hNote: ['note', () => docEl('hNote').value.trim() || null],
        };
        const fields = {}; dirty.forEach(id => { const [col, get] = all[id]; fields[col] = get(); }); // untouched metrics stay as they are
        btn.disabled = true; btn.textContent = 'Saving…';
        const { data, error } = await LumaHealth.saveLog(date, fields);
        btn.textContent = 'Save entry'; syncSave();
        if (error) return showErr('healthError', /check constraint|violates/i.test(error.message) ? 'One of the values is out of range — please check the numbers.' : setupHint(error));
        logs = [data, ...logs.filter(l => l.log_date !== date)].sort((a, b) => b.log_date.localeCompare(a.log_date));
        closeLog(); render();
      };

      // ----- goals modal -----
      const closeGoals = () => docEl('goalsOverlay').classList.remove('open');
      const openGoals = () => {
        docEl('gSleep').value = goals.sleep_hours; docEl('gWater').value = goals.water_ml; docEl('gSteps').value = goals.steps; docEl('gActive').value = goals.active_minutes;
        docEl('qSleep').value = goals.quick_sleep_hours; docEl('qWater').value = goals.quick_water_ml; docEl('qSteps').value = goals.quick_steps; docEl('qActive').value = goals.quick_active_minutes;
        showErr('goalsError', ''); GOAL_IDS.forEach(checkField); docEl('goalsSave').disabled = false; docEl('goalsOverlay').classList.add('open');
      };
      docEl('goalsClose').onclick = closeGoals;
      docEl('goalsOverlay').onclick = e => { if (e.target === docEl('goalsOverlay')) closeGoals(); };
      const syncGoals = () => { docEl('goalsSave').disabled = anyInvalid(GOAL_IDS) || GOAL_IDS.some(id => docEl(id).value === ''); };
      GOAL_IDS.forEach(id => docEl(id).oninput = () => { checkField(id); syncGoals(); });
      docEl('goalsSave').onclick = async () => {
        const g = {
          sleep_hours: Number(docEl('gSleep').value), water_ml: Math.round(Number(docEl('gWater').value)), steps: Math.round(Number(docEl('gSteps').value)), active_minutes: Math.round(Number(docEl('gActive').value)),
          quick_sleep_hours: Number(docEl('qSleep').value), quick_water_ml: Math.round(Number(docEl('qWater').value)), quick_steps: Math.round(Number(docEl('qSteps').value)), quick_active_minutes: Math.round(Number(docEl('qActive').value))
        };
        if (![g.sleep_hours, g.water_ml, g.steps, g.active_minutes, g.quick_sleep_hours, g.quick_water_ml, g.quick_steps, g.quick_active_minutes].every(v => v > 0)) return showErr('goalsError', 'Every goal and quick-add amount needs a number above zero.');
        const btn = docEl('goalsSave'); btn.disabled = true; btn.textContent = 'Saving…';
        const { data, error } = await LumaHealth.saveGoals(g);
        btn.disabled = false; btn.textContent = 'Save goals';
        if (error) return showErr('goalsError', /check constraint|violates/i.test(error.message) ? 'One of the goals is out of range.' : setupHint(error));
        goals = { ...goals, ...data }; closeGoals(); render();
      };

      // ----- reminders modal -----
      let rem = { ...LumaHealth.DEFAULT_REMINDERS };
      const REM_SECS = [['remWater', 'remWaterSw', 'water_enabled'], ['remSteps', 'remStepsSw', 'steps_enabled'], ['remActive', 'remActiveSw', 'active_enabled'], ['remSleep', 'remSleepSw', 'sleep_enabled']];
      const paintRem = () => REM_SECS.forEach(([sec, sw, key]) => { docEl(sec).classList.toggle('on', !!rem[key]); docEl(sw).classList.toggle('on', !!rem[key]); });
      const paintBrowserState = paintPushControls;
      const openRem = () => {
        docEl('rWEvery').value = rem.water_every_min; docEl('rSEvery').value = rem.steps_every_min; docEl('rAEvery').value = rem.active_every_min; docEl('rLead').value = rem.sleep_lead_min;
        [['rWFrom', rem.water_from], ['rWTo', rem.water_to], ['rSFrom', rem.steps_from], ['rSTo', rem.steps_to], ['rAFrom', rem.active_from], ['rATo', rem.active_to], ['rBed', rem.bedtime], ['rWake', rem.wake_time]].forEach(([id, v]) => { docEl(id).value = v; docEl(id)._luTimeRefresh(); });
        ['rWEvery', 'rSEvery', 'rAEvery', 'rLead'].forEach(id => skinSelect(docEl(id)));
        lockRemTimes();
        paintRem(); paintBrowserState(); showErr('remError', ''); docEl('remindersOverlay').classList.add('open');
      };
      // choosing the times is a Glow / Zenith feature: on Dawn the times show the standard values and can't be changed (the switches still work)
      const REM_TIME_IDS = ['rWEvery', 'rWFrom', 'rWTo', 'rSEvery', 'rSFrom', 'rSTo', 'rAEvery', 'rAFrom', 'rATo', 'rBed', 'rWake', 'rLead'];
      function lockRemTimes() {
        const locked = !LumaPlan.has('timing'), D = LumaHealth.DEFAULT_REMINDERS;
        let note = docEl('remLockNote');
        if (!note) { note = document.createElement('div'); note.id = 'remLockNote'; note.className = 'ls'; note.style.cssText = 'margin:0 0 10px;color:#fcd34d'; note.innerHTML = '<i class="fa-solid fa-lock"></i> These are the standard times, and they are what is used when a reminder is on. Choosing your own is available on Glow and Zenith.'; docEl('remError').after(note); }
        note.style.display = locked ? '' : 'none';
        if (locked) {
          const vals = { rWEvery: D.water_every_min, rWFrom: D.water_from, rWTo: D.water_to, rSEvery: D.steps_every_min, rSFrom: D.steps_from, rSTo: D.steps_to, rAEvery: D.active_every_min, rAFrom: D.active_from, rATo: D.active_to, rBed: D.bedtime, rWake: D.wake_time, rLead: D.sleep_lead_min };
          REM_TIME_IDS.forEach(id => { const el = docEl(id); el.value = vals[id]; if (el._luTimeRefresh) el._luTimeRefresh(); if (el.tagName === 'SELECT') skinSelect(el); });
        }
        REM_TIME_IDS.forEach(id => { const el = docEl(id), w = el._luWrap || el.nextElementSibling; if (w && /lu-(select|date)/.test(w.className)) { w.classList.toggle('plan-locked', locked); const b = w.querySelector('button'); if (b) b.disabled = locked; } });
      }
      const closeRem = () => docEl('remindersOverlay').classList.remove('open');
      docEl('remClose').onclick = closeRem;
      docEl('remindersOverlay').onclick = e => { if (e.target === docEl('remindersOverlay')) closeRem(); };
      REM_SECS.forEach(([sec, sw, key]) => docEl(sw).onclick = () => { rem[key] = !rem[key]; paintRem(); });
      docEl('remBrowserBtn').onclick = () => togglePush(docEl('remBrowserBtn'), 'remError');
      docEl('remSave').onclick = async () => {
        const r = {
          ...rem,
          water_every_min: +docEl('rWEvery').value, water_from: docEl('rWFrom').value, water_to: docEl('rWTo').value,
          steps_every_min: +docEl('rSEvery').value, steps_from: docEl('rSFrom').value, steps_to: docEl('rSTo').value,
          active_every_min: +docEl('rAEvery').value, active_from: docEl('rAFrom').value, active_to: docEl('rATo').value,
          bedtime: docEl('rBed').value, wake_time: docEl('rWake').value, sleep_lead_min: +docEl('rLead').value
        };
        if (r.water_enabled && timeToMin(r.water_to) <= timeToMin(r.water_from)) return showErr('remError', 'Water: "Until" must be later than "From".');
        if (r.steps_enabled && timeToMin(r.steps_to) <= timeToMin(r.steps_from)) return showErr('remError', 'Steps: "Until" must be later than "From".');
        if (r.active_enabled && timeToMin(r.active_to) <= timeToMin(r.active_from)) return showErr('remError', 'Active: "Until" must be later than "From".');
        if (r.sleep_enabled && r.bedtime === r.wake_time) return showErr('remError', 'Sleep: bedtime and wake-up time can\'t be the same.');
        const btn = docEl('remSave'); btn.disabled = true; btn.textContent = 'Saving…';
        const { data, error } = await LumaHealth.saveReminders(r);
        btn.disabled = false; btn.textContent = 'Save reminders';
        if (error) return showErr('remError', /health_reminders|schema cache|does not exist/i.test(error.message) ? 'Reminders aren\'t set up yet — run supabase/migrations/013_health_reminders.sql in the SQL Editor.' : error.message);
        rem = { ...rem, ...data }; applyReminders(rem); closeRem();
        flashToast('Reminders saved', [rem.water_enabled && 'water', rem.steps_enabled && 'steps', rem.active_enabled && 'active', rem.sleep_enabled && 'sleep'].filter(Boolean).join(' · ') || 'All reminders are off', 'fa-bell', '#f59e0b');
      };
      pg.querySelector('#healthRemBtn').onclick = openRem;
      LumaHealth.getReminders().then(r => { if (!r.error) rem = r.data; }); // pre-load so the modal opens instantly

      // ----- page actions -----
      pg.querySelector('#healthLogBtn').onclick = () => openLog(null);
      pg.querySelector('#healthTabs').onclick = e => { const t = e.target.closest('.health-tab'); if (t) { view = t.dataset.k; render(); } };
      pg.querySelector('#diarySearch').oninput = e => { diaryQuery = e.target.value; renderDiary(); };
      pg.querySelector('#diaryList').onclick = async e => {
        const row = e.target.closest('.h-row'); if (!row) return;
        const date = row.dataset.date;
        if (e.target.closest('.h-del')) { // removes just the note; the day's numbers stay
          if (!await luConfirm({ title: 'Remove this note?', message: `Your note for ${fmtKey(date, { weekday: 'long', day: 'numeric', month: 'long' })} will be removed. The rest of that day's entry stays.`, ok: 'Remove note' })) return;
          const { data, error } = await LumaHealth.saveLog(date, { note: null });
          if (error) return luAlert('Could not remove: ' + error.message);
          logs = logs.map(l => l.log_date === date ? data : l); return render();
        }
        openLog(date, 'hNote');
      };
      pg.querySelector('#healthGoalsBtn').onclick = openGoals;
      pg.querySelector('#healthRings').onclick = async e => {
        const q = e.target.closest('[data-quick]');
        if (q) { // one-tap add (or take away) of the quick amount from Goals, applied to today's total
          e.stopPropagation(); if (q.disabled) return;
          const col = q.dataset.quick, dir = +q.dataset.dir;
          const amount = { sleep_hours: goals.quick_sleep_hours, water_ml: goals.quick_water_ml, steps: goals.quick_steps, active_minutes: goals.quick_active_minutes }[col];
          const limit = { sleep_hours: 24, water_ml: 20000, steps: 200000, active_minutes: 1440 }[col];
          const t = logOf(today()) || {};
          const next = Math.round(((Number(t[col]) || 0) + dir * amount) * 10) / 10;
          if (next > limit) return luAlert('That would go over the daily limit for this metric.', 'Too much');
          if (dir < 0 && !(Number(t[col]) > 0)) return; // nothing to take away
          q.disabled = true;
          const { data, error } = await LumaHealth.saveLog(today(), { [col]: Math.max(0, next) }); // only this metric is written
          if (error) { q.disabled = false; return luAlert(setupHint(error)); }
          logs = [data, ...logs.filter(l => l.log_date !== today())]; return render();
        }
        const c = e.target.closest('[data-log-today]'); if (c) openLog(null, c.dataset.focus);
      };
      pg.querySelector('#healthHistory').onclick = async e => {
        const row = e.target.closest('.h-row'); if (!row) return;
        if (e.target.closest('.h-del')) {
          if (!await luConfirm({ title: 'Delete this entry?', message: `Your ${fmtKey(row.dataset.date, { weekday: 'long', day: 'numeric', month: 'long' })} entry will be removed.`, ok: 'Delete entry' })) return;
          const { error } = await LumaHealth.deleteLog(row.dataset.date);
          if (error) return luAlert('Could not delete: ' + error.message);
          logs = logs.filter(l => l.log_date !== row.dataset.date); return render();
        }
        openLog(row.dataset.date);
      };

      // load: every log (one row per day, so this stays small) + goals
      render(); // shows empty state immediately
      const [l, g] = await Promise.all([LumaHealth.listLogs('2000-01-01'), LumaHealth.getGoals()]);
      if (l.error) { sub.textContent = setupHint(l.error); return; }
      logs = l.data; if (!g.error) goals = g.data;
      render();
    }


    WIRE.health = function (pg) { return loadHealth(pg); };
