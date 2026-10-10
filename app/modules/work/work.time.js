// LUMA — module: Work time tracking (the Time tab, the timer, and the monthly timesheet as CSV / PDF)
    // Hours are yours alone: per task, per project, or "general" (not tied to a project), always under a company. Tables: migration 076.
    const WKTM = { month: '', co: null, entries: [], running: null, loaded: false, err: null, tick: null, id: null, sums: {} };

    const wkDur = m => { m = Math.max(0, Math.round(m || 0)); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${String(r).padStart(2, '0')}m` : `${h}h`) : `${r}m`; };
    const wkHrs = m => (m / 60).toFixed(2);
    const wkMonthLabel = k => new Date(k + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const wkMonthShift = (k, d) => { const [y, m] = k.split('-').map(Number), x = new Date(Date.UTC(y, m - 1 + d, 1)); return x.toISOString().slice(0, 7); };
    const wkMonthRange = k => { const [y, m] = k.split('-').map(Number); return [k + '-01', k + '-' + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')]; };
    const wkDayLabel = k => new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    const wkWhat = e => e.task_title ? `${e.project_name || 'Project'} › ${e.task_title}` : e.project_name ? e.project_name : e.label || 'General';
    const wkCoName = id => { const c = wkCoOf(id); return c ? c.name : 'Shared projects'; };
    const wkTimeHint = m => /work_time|work_timer|schema cache|does not exist/i.test(m || '') ? 'Time tracking isn\'t set up yet: run supabase/migrations/076_work_time.sql in the Supabase SQL Editor.' : m;

    async function wkTimeLoad() {
      WKTM.month = WKTM.month || wkToday().slice(0, 7); if (WKTM.co === null) WKTM.co = WK.company || '';
      try {
        const [from, to] = wkMonthRange(WKTM.month), [l, r] = await Promise.all([LumaWork.time.list(from, to), LumaWork.time.running()]);
        WKTM.err = l.error ? l.error.message : null; if (!l.error) WKTM.entries = l.data || []; WKTM.running = !r.error && r.data && r.data.running_since ? r.data : null;
      } catch (e) { WKTM.err = e.message || 'Could not load'; }
      WKTM.loaded = true;
    }
    // everything you can log time on: tasks and projects you can change, and "general" under each active company
    function wkTimeTargets() {
      const out = [];
      WK.projects.filter(wkCanEdit).forEach(p => { out.push([`p:${p.id}`, `${p.name} · whole project`]); WK.tasks.filter(t => t.project_id === p.id && t.status !== 'done').forEach(t => out.push([`t:${t.id}`, `${p.name} › ${t.title}`])); });
      wkCoActive().forEach(c => out.push([`c:${c.id}`, `General · ${c.name} (not on a project)`]));
      return out;
    }
    const wkTargetFields = v => { const [k, id] = String(v).split(':'); return k === 't' ? { task_id: id } : k === 'p' ? { project_id: id } : { company_id: id }; };
    function wkFillTargets(sel, cur) {
      const t = wkTimeTargets(); sel.innerHTML = t.map(([v, n]) => `<option value="${v}">${escapeHtml(n)}</option>`).join('');
      if (cur && t.some(x => x[0] === cur)) sel.value = cur; else { const g = t.find(x => x[0] === 'c:' + WK.company); sel.value = g ? g[0] : t.length ? t[0][0] : ''; } skinSelect(sel); return t.length;
    }
    const wkTargetOf = e => e.task_id ? 't:' + e.task_id : e.project_id ? 'p:' + e.project_id : e.company_id ? 'c:' + e.company_id : '';

    // ---------- the tab ----------
    function wkEntriesShown() { return WKTM.entries.filter(e => !WKTM.co || e.company_id === WKTM.co); }
    function wkTimeView() {
      if (!WKTM.loaded) return '<div class="lu-empty">Loading…</div>';
      if (WKTM.err) return card(`<div class="ls">${escapeHtml(wkTimeHint(WKTM.err))}</div>`);
      const es = wkEntriesShown(), total = es.reduce((a, e) => a + e.minutes, 0), days = [...new Set(es.map(e => e.work_date))].sort().reverse(), run = WKTM.running;
      const byProj = {}; es.forEach(e => { const k = e.project_name || e.label || 'General'; byProj[k] = (byProj[k] || 0) + e.minutes; });
      const top = Object.entries(byProj).sort((a, b) => b[1] - a[1]), max = top.length ? top[0][1] : 1;
      const coOpts = `<option value="">All companies</option>${WK.companies.map(c => `<option value="${c.id}" ${c.id === WKTM.co ? 'selected' : ''}>${escapeHtml(c.name)}${c.archived_at ? ' (archived)' : ''}</option>`).join('')}`;
      const timer = run ? `<div class="card wk-timer on"><div class="wk-tm-l"><span class="wk-tm-dot"></span><div><small>Timer running</small><b>${escapeHtml(wkWhat(run))}</b>${run.note ? `<em>${escapeHtml(run.note)}</em>` : ''}</div></div><div class="wk-tm-clock" id="wkTimerClock">00:00:00</div><button type="button" class="create-btn wk-tm-stop" data-wktm-stop><i class="fa-solid fa-stop"></i> Stop</button></div>`
        : wkHas() ? `<div class="card wk-timer"><div class="wk-tm-form"><select id="wkTimerFor"></select><input id="wkTimerNote" type="text" maxlength="200" placeholder="Note (optional)" autocomplete="off"><button type="button" class="create-btn" data-wktm-start><i class="fa-solid fa-play"></i> Start timer</button></div><div class="pem-msg error" id="wkTimerErr" style="margin:8px 0 0"></div></div>` : '';
      return `${timer}
        <div class="wk-bar wk-tbar"><span class="wk-mon"><button type="button" data-wktm-mon="-1" aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button><b data-wktm-pick title="Choose a month and year">${wkMonthLabel(WKTM.month)}</b><button type="button" data-wktm-mon="1" aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button></span>
          <select id="wkTimeCo">${coOpts}</select>
          <span class="wk-seg"><button type="button" data-wktm-csv title="Download as a spreadsheet (CSV)"><i class="fa-solid fa-file-csv"></i> CSV</button><button type="button" data-wktm-pdf title="Open a printable page: choose Save as PDF"><i class="fa-solid fa-file-pdf"></i> PDF</button></span></div>
        <div class="sd-tiles wk-tiles wk-tiles3">${[['fa-clock', '#fb923c', wkDur(total), 'This month' + (WKTM.co ? ' · ' + escapeHtml(wkCoName(WKTM.co)) : '')], ['fa-calendar-check', '#60a5fa', days.length, 'Days with time'], ['fa-gauge', '#34d399', days.length ? wkDur(total / days.length) : '0m', 'Average per day']].map(([i, c, v, l]) => `<div class="sd-tile" style="--c:${c}"><i class="fa-solid ${i}"></i><div><b>${v}</b><span>${l}</span></div></div>`).join('')}</div>
        ${top.length ? card(`<div class="section-title"><i class="fa-solid fa-chart-simple"></i> Where the time went</div>${top.slice(0, 6).map(([n, m]) => `<div class="wk-prog" style="--c:#fb923c"><div class="sb-h"><span>${escapeHtml(n)}</span><b>${wkDur(m)}</b></div><div class="sb-t"><i style="width:${Math.max(4, Math.round(m / max * 100))}%"></i></div></div>`).join('')}`) : ''}
        ${days.length ? days.map(k => { const ds = es.filter(e => e.work_date === k); return `<div class="card wk-day"><div class="wk-dayh"><b>${wkDayLabel(k)}</b><em>${wkDur(ds.reduce((a, e) => a + e.minutes, 0))}</em></div>${ds.map(e => `<div class="wk-te" data-wkte="${e.id}"><span class="wk-te-d">${wkDur(e.minutes)}</span><div class="wk-te-t"><b>${escapeHtml(wkWhat(e))}</b>${e.note ? `<small>${escapeHtml(e.note)}</small>` : ''}${!WKTM.co && e.company_id ? `<small>${escapeHtml(wkCoName(e.company_id))}</small>` : ''}</div></div>`).join('')}</div>`; }).join('')
          : card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-regular fa-clock"></i></div><div class="h-empty-t">No time logged in ${wkMonthLabel(WKTM.month)}</div><div class="h-empty-s">Start the timer when you begin working, or add the hours by hand. Your timesheet is made from these.</div></div>`)}
        <div class="ls" style="font-size:0.72rem;line-height:1.5;margin-top:12px"><i class="fa-regular fa-eye"></i> Your hours are private, except that the owner of a project can see the hours people log on it. Time you log on your own projects is only yours.</div>`;
    }
    function wkTimePaint() {
      const root = docEl('wkRoot'); if (!root || WK.tab !== 'time') return; root.classList.add('wk-timeview'); root.innerHTML = wkTimeView();
      const s = docEl('wkTimerFor'); if (s) { if (!wkFillTargets(s)) { s.parentElement.innerHTML = '<div class="lu-empty">Add a company or a project first.</div>'; } }
      const c = docEl('wkTimeCo'); if (c) skinSelect(c); wkTimerTick();
      const tf = docEl('wkTimerFor'); if (tf) { const fix = () => { docEl('wkTimerNote').placeholder = tf.value.startsWith('c:') ? 'Name it, e.g. Client call (optional)' : 'Note (optional)'; }; tf.addEventListener('change', fix); fix(); }
    }
    function wkTimerTick() {
      clearInterval(WKTM.tick); const run = WKTM.running; if (!run) return;
      const upd = () => { const el = docEl('wkTimerClock'); if (!el || WK.tab !== 'time') { clearInterval(WKTM.tick); return; } const s = Math.max(0, Math.floor((Date.now() - Date.parse(run.running_since)) / 1000)); el.textContent = [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(x => String(x).padStart(2, '0')).join(':'); };
      upd(); WKTM.tick = setInterval(upd, 1000);
    }
    async function wkTimeRefresh() { await wkTimeLoad(); wkTimePaint(); }

    // ---------- an entry ----------
    function wkTimeOpen(e, pre) {
      if (!wkHas()) return openAddon('work');
      const sel = docEl('wkTimeFor'); if (!wkFillTargets(sel, e ? wkTargetOf(e) : pre || '')) return luAlert('Add a company or a project first: time is logged under one of them.', 'Nothing to log time on');
      WKTM.id = e ? e.id : null; docEl('wkTimeHead').textContent = e ? 'Edit time' : 'Log time';
      docEl('wkTimeDate').value = e ? e.work_date : wkToday(); docEl('wkTimeDate')._luDateRefresh && docEl('wkTimeDate')._luDateRefresh();
      docEl('wkTimeH').value = e ? Math.floor(e.minutes / 60) || '' : ''; docEl('wkTimeM').value = e ? e.minutes % 60 || '' : ''; docEl('wkTimeNote').value = e ? e.note : '';
      docEl('wkTimeName').value = e ? e.label || '' : ''; docEl('wkTimeDelete').style.display = e ? '' : 'none'; wkErr('wkTimeError', ''); wkTimeHintFor(); sdOpen('wkTimeOverlay'); if (!e) setTimeout(() => docEl('wkTimeH').focus(), 50);
    }
    // time logged on somebody else's project can be seen by its owner: say so before it is saved
    function wkTimeHintFor() {
      const v = docEl('wkTimeFor').value, f = wkTargetFields(v), t = f.task_id ? WK.tasks.find(x => x.id === f.task_id) : null, p = wkProj(t ? t.project_id : f.project_id), n = docEl('wkTimeShare');
      docEl('wkTimeNameBox').style.display = v.startsWith('c:') ? '' : 'none';
      n.style.display = p && p.owner_id !== wkMe() ? '' : 'none'; if (p && p.owner_id !== wkMe()) n.textContent = `${(WK.shared.find(s => s.id === p.id) || {}).owner_name || 'The owner'} owns this project and can see the hours you log on it.`;
    }
    docEl('wkTimeFor').addEventListener('change', wkTimeHintFor);
    docEl('wkTimeClose').onclick = () => sdClose('wkTimeOverlay'); docEl('wkTimeOverlay').onclick = e => { if (e.target === docEl('wkTimeOverlay')) sdClose('wkTimeOverlay'); };
    docEl('wkTimeSave').onclick = async () => {
      const mins = (+docEl('wkTimeH').value || 0) * 60 + (+docEl('wkTimeM').value || 0), date = docEl('wkTimeDate').value;
      if (!docEl('wkTimeFor').value) return wkErr('wkTimeError', 'Choose what you worked on.');
      if (!date) return wkErr('wkTimeError', 'Choose the date.');
      if (mins < 1) return wkErr('wkTimeError', 'Enter the time you spent (hours and / or minutes).'); if (mins > 1440) return wkErr('wkTimeError', 'An entry can not be more than 24 hours.');
      const f = { ...(WKTM.id ? { project_id: null, task_id: null, company_id: null } : {}), ...wkTargetFields(docEl('wkTimeFor').value), work_date: date, minutes: mins, note: docEl('wkTimeNote').value.trim(), label: docEl('wkTimeFor').value.startsWith('c:') ? docEl('wkTimeName').value.trim() : '' };
      sdBtn('wkTimeSave', true); wkErr('wkTimeError', ''); const r = WKTM.id ? await LumaWork.time.update(WKTM.id, f) : await LumaWork.time.add(f); sdBtn('wkTimeSave', false, 'Save');
      if (r.error) return wkErr('wkTimeError', /24 hours/.test(r.error.message) ? 'That day would have more than 24 hours logged.' : /row-level security/i.test(r.error.message) ? 'The Work add-on is needed to log time.' : wkTimeHint(r.error.message));
      sdClose('wkTimeOverlay'); const m = r.data.work_date.slice(0, 7); if (m !== WKTM.month) WKTM.month = m; await wkTimeRefresh(); flashToast(WKTM.id ? 'Time saved' : 'Time logged', wkDur(mins) + ' · ' + wkWhat(r.data), 'fa-clock', '#fb923c');
    };
    docEl('wkTimeDelete').onclick = async () => {
      if (!await luConfirm({ title: 'Delete this time entry?', message: 'It is removed from your timesheet.' })) return;
      const r = await LumaWork.time.remove(WKTM.id); if (r.error) return wkErr('wkTimeError', r.error.message); sdClose('wkTimeOverlay'); wkTimeRefresh();
    };

    // ---------- the timer ----------
    async function wkTimerStart(target, note, errId) {
      const f = wkTargetFields(target), general = !f.project_id && !f.task_id;   // for general time the typed words are its name
      const r = await LumaWork.time.start(f.project_id, f.task_id, f.company_id, general ? '' : note, general ? note : '');
      if (r.error) { const m = /archived/.test(r.error.message) ? 'This company is archived: restore it to track time.' : wkTimeHint(r.error.message); if (errId && docEl(errId)) docEl(errId).textContent = m; else luAlert(m); return false; }
      WKTM.running = r.data; return true;
    }
    async function wkTimerStop() {
      const r = await LumaWork.time.stop(); if (r.error) return luAlert(wkTimeHint(r.error.message)); WKTM.running = null; clearInterval(WKTM.tick);
      if (r.data) flashToast('Timer stopped', wkDur(r.data.minutes) + ' · ' + wkWhat(r.data), 'fa-clock', '#fb923c'); await wkTimeRefresh(); if (docEl('wkTaskOverlay').classList.contains('open')) wkPaintTaskTime();
    }

    // ---------- time on a task (in its popup) ----------
    async function wkPaintTaskTime() {
      const box = docEl('wkTaskTime'), t = WK.tasks.find(x => x.id === WKT.id); if (!box || !t) return;
      const [s, r] = await Promise.all([LumaWork.time.summary(t.project_id), WKTM.loaded ? Promise.resolve(null) : LumaWork.time.running()]); if (r && !r.error) WKTM.running = r.data && r.data.running_since ? r.data : null;
      const row = (s.data || []).find(x => x.task_id === t.id), mins = row ? Number(row.minutes) : 0, can = wkCanEdit(wkProj(t.project_id)) && wkHas(), run = WKTM.running, mine = run && run.task_id === t.id;
      box.innerHTML = `<div class="wk-tt"><b>${wkDur(mins)}</b><span>logged by everyone on this task</span></div>` + (can ? `<div class="wk-tt-b">${mine ? '<button type="button" class="np-btn" data-wktt-stop><i class="fa-solid fa-stop"></i> Stop timer</button>' : '<button type="button" class="np-btn" data-wktt-start><i class="fa-solid fa-play"></i> Start timer</button>'}<button type="button" class="np-btn" data-wktt-log><i class="fa-regular fa-clock"></i> Log time</button></div>` : '');
    }
    document.addEventListener('click', async e => {
      const b = e.target.closest('[data-wktt-start],[data-wktt-stop],[data-wktt-log]'); if (!b || !docEl('wkTaskOverlay') || !docEl('wkTaskOverlay').contains(b) || !WKT.id) return;
      if (b.dataset.wkttStop !== undefined) return wkTimerStop();
      if (b.dataset.wkttLog !== undefined) { sdClose('wkTaskOverlay'); return wkTimeOpen(null, 't:' + WKT.id); }
      if (await wkTimerStart('t:' + WKT.id, '', null)) { flashToast('Timer started', (WK.tasks.find(x => x.id === WKT.id) || {}).title || '', 'fa-play', '#fb923c'); wkPaintTaskTime(); }
    });

    // ---------- timesheet: CSV and a printable page ----------
    function wkSheet() {
      const es = wkEntriesShown().slice().sort((a, b) => a.work_date.localeCompare(b.work_date) || a.created_at.localeCompare(b.created_at)), name = (lumaFullName() || 'MY').toUpperCase(), month = new Date(WKTM.month + '-01T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }).toUpperCase();
      return { es, name, month, title: `${name} ${month} TIMESHEET`, label: wkMonthLabel(WKTM.month), company: WKTM.co ? wkCoName(WKTM.co) : 'All companies', total: es.reduce((a, e) => a + e.minutes, 0) };
    }
    function wkTimesheetCsv() {
      const s = wkSheet(); if (!s.es.length) return luAlert('There is no time logged for this month and company yet.', 'Nothing to export');
      const q = v => { let x = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
      const L = [[s.title], ['Company', s.company], ['Month', s.label], [], ['Date', 'Day', 'Company', 'Project', 'Task', 'Notes', 'Hours']];
      s.es.forEach(e => L.push([e.work_date, new Date(e.work_date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }), e.company_id ? wkCoName(e.company_id) : 'Shared projects', e.project_name || 'General', e.task_title || e.label || '', e.note, wkHrs(e.minutes)]));
      L.push([], ['Total', '', '', '', '', '', wkHrs(s.total)]);
      const blob = new Blob(['﻿' + L.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = s.title + '.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      flashToast('Timesheet saved', s.title + '.csv', 'fa-file-csv', '#fb923c');
    }
    function wkTimesheetPdf() {
      const s = wkSheet(); if (!s.es.length) return luAlert('There is no time logged for this month and company yet.', 'Nothing to export');
      const w = window.open('', '_blank'); if (!w) return luAlert('Your browser blocked the new window. Allow pop-ups for LUMA and try again.', 'Could not open the timesheet');
      const x = escapeHtml, byProj = {}; s.es.forEach(e => { const k = e.project_name || 'General'; byProj[k] = (byProj[k] || 0) + e.minutes; });
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${x(s.title)}</title><style>
        body{font:13px/1.45 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:32px}h1{font-size:20px;margin:0 0 4px;letter-spacing:.02em}.m{color:#555;margin:0 0 18px}
        table{border-collapse:collapse;width:100%;margin-bottom:18px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f1f1f1}td.n,th.n{text-align:right;white-space:nowrap}
        tfoot td{font-weight:700;background:#fafafa}h2{font-size:14px;margin:18px 0 6px}.sig{display:flex;gap:48px;margin-top:48px}.sig div{flex:1;border-top:1px solid #333;padding-top:6px;color:#555}
        @media print{body{margin:14mm}.np{display:none}}</style></head><body>
        <h1>${x(s.title)}</h1><p class="m">${x(s.label)} · ${x(s.company)}</p>
        <table><thead><tr><th>Date</th><th>Project</th><th>Task</th><th>Notes</th><th class="n">Hours</th></tr></thead><tbody>
        ${s.es.map(e => `<tr><td>${x(wkDayLabel(e.work_date))}</td><td>${x(e.project_name || 'General')}${!WKTM.co && e.company_id ? '<br><small>' + x(wkCoName(e.company_id)) + '</small>' : ''}</td><td>${x(e.task_title || e.label || '')}</td><td>${x(e.note)}</td><td class="n">${wkHrs(e.minutes)}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="4">Total (${wkDur(s.total)})</td><td class="n">${wkHrs(s.total)}</td></tr></tfoot></table>
        <h2>By project</h2><table><tbody>${Object.entries(byProj).sort((a, b) => b[1] - a[1]).map(([n, m]) => `<tr><td>${x(n)}</td><td class="n">${wkHrs(m)}</td></tr>`).join('')}</tbody></table>
        <div class="sig"><div>Employee: ${x(s.name)}</div><div>Approved by</div><div>Date</div></div>
        <p class="np" style="margin-top:24px;color:#777">Choose <b>Save as PDF</b> in the print window.</p></body></html>`);
      w.document.close(); w.focus(); setTimeout(() => { try { w.print(); } catch (e) { } }, 400);
    }

    // ---------- the owner sees what the team logged on a project ----------
    const WKTT = { project: '', month: '', rows: [] };
    function wkTeamPaint() {
      const p = wkProj(WKTT.project), rows = WKTT.rows, total = rows.reduce((a, r) => a + r.minutes, 0), by = {};
      rows.forEach(r => { (by[r.user_id] = by[r.user_id] || { name: r.name, m: 0, days: new Set() }); by[r.user_id].m += r.minutes; by[r.user_id].days.add(r.work_date); });
      docEl('wkTeamHead').textContent = `Team time · ${p ? p.name : ''}`;
      docEl('wkTeamBody').innerHTML = `<div class="wk-bar"><span class="wk-mon"><button type="button" data-wktt-mon="-1" aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button><b data-wktt-pick title="Choose a month and year">${wkMonthLabel(WKTT.month)}</b><button type="button" data-wktt-mon="1" aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button></span><span class="wk-seg"><button type="button" data-wktt-csv ${rows.length ? '' : 'disabled'}><i class="fa-solid fa-file-csv"></i> CSV</button></span></div>`
        + (rows.length ? `<div class="wk-tt"><b>${wkDur(total)}</b><span>in total on this project this month</span></div>`
          + Object.values(by).sort((a, b) => b.m - a.m).map(x => `<div class="wk-prog" style="--c:#fb923c"><div class="sb-h"><span>${escapeHtml(x.name)} <small>${x.days.size} day${x.days.size === 1 ? '' : 's'}</small></span><b>${wkDur(x.m)}</b></div><div class="sb-t"><i style="width:${Math.max(4, Math.round(x.m / Math.max(...Object.values(by).map(y => y.m)) * 100))}%"></i></div></div>`).join('')
          + `<div class="wk-teamrows">${rows.map(r => `<div class="wk-te"><span class="wk-te-d">${wkDur(r.minutes)}</span><div class="wk-te-t"><b>${escapeHtml(r.name)} · ${wkDayLabel(r.work_date)}</b><small>${escapeHtml([r.task_title, r.note].filter(Boolean).join(' · ') || 'No note')}</small></div></div>`).join('')}</div>`
          : '<div class="lu-empty">Nobody logged time on this project in this month.</div>')
        + '<div class="ls" style="font-size:0.72rem;margin-top:10px">People are told on their Time tab that the owner of a project can see the hours they log on it.</div>';
    }
    async function wkTeamLoad() {
      const [from, to] = wkMonthRange(WKTT.month), r = await LumaWork.teamTime(WKTT.project, from, to);
      if (r.error) { wkErr('wkTeamError', /schema cache|does not exist|work_project_time/i.test(r.error.message) ? 'Run supabase/migrations/078_work_edit_move_team.sql first.' : r.error.message); WKTT.rows = []; } else { wkErr('wkTeamError', ''); WKTT.rows = r.data || []; }
      wkTeamPaint();
    }
    function wkTeamOpen(pid) { WKTT.project = pid; WKTT.month = WKTM.month || wkToday().slice(0, 7); WKTT.rows = []; wkErr('wkTeamError', ''); wkTeamPaint(); sdOpen('wkTeamOverlay'); wkTeamLoad(); }
    docEl('wkTeamClose').onclick = () => sdClose('wkTeamOverlay');
    docEl('wkTeamOverlay').onclick = e => {
      if (e.target === docEl('wkTeamOverlay')) return sdClose('wkTeamOverlay');
      const tp = e.target.closest('[data-wktt-pick]'); if (tp) return void luDatePopup(tp, { value: WKTT.month + '-01', onPick: k => { WKTT.month = k.slice(0, 7); wkTeamLoad(); } });
      const mo = e.target.closest('[data-wktt-mon]'); if (mo) { WKTT.month = wkMonthShift(WKTT.month, +mo.dataset.wkttMon); return wkTeamLoad(); }
      if (e.target.closest('[data-wktt-csv]')) {
        const p = wkProj(WKTT.project), q = v => { let x = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return '"' + x.replace(/"/g, '""') + '"'; };
        const L = [[`${p ? p.name : 'Project'} · team time · ${wkMonthLabel(WKTT.month)}`], [], ['Date', 'Person', 'Task', 'Notes', 'Hours']];
        WKTT.rows.forEach(r => L.push([r.work_date, r.name, r.task_title || '', r.note, wkHrs(r.minutes)])); L.push([], ['Total', '', '', '', wkHrs(WKTT.rows.reduce((a, r) => a + r.minutes, 0))]);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + L.map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `${(p ? p.name : 'PROJECT').toUpperCase()} ${wkMonthLabel(WKTT.month).toUpperCase()} TEAM TIME.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }
    };
