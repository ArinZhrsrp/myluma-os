// LUMA — module: study
    // The Study add-on, version 1: subjects, a weekly timetable, and assignments / tests / exams with due dates, weights and scores.
    // Data helpers: study.data.js (LumaStudy). Tables: supabase/migrations/045_study.sql. Reminders come from the server.
    const SD_COLORS = ['#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#f87171', '#2dd4bf'];
    const SD_KINDS = [['assignment', 'Assignment', 'fa-file-pen'], ['quiz', 'Quiz', 'fa-circle-question'], ['test', 'Test', 'fa-pen-to-square'], ['exam', 'Exam', 'fa-graduation-cap'], ['project', 'Project', 'fa-diagram-project'], ['other', 'Other', 'fa-ellipsis']];
    const SD_CLASS_KINDS = [['lecture', 'Lecture'], ['tutorial', 'Tutorial'], ['lab', 'Lab'], ['other', 'Other']];
    const SD_STATUS = [['todo', 'To do'], ['in_progress', 'In progress'], ['done', 'Done']];
    const SD_DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']]; // weekday numbers: 0 = Sunday (same as the database)
    const SD_TABS = [['overview', 'Overview', 'fa-table-columns'], ['timetable', 'Timetable', 'fa-calendar-week'], ['assignments', 'Assignments', 'fa-list-check'], ['subjects', 'Subjects', 'fa-book'], ['semesters', 'Semesters', 'fa-calendar-days']];
    // grade scale used for letters and GPA points (Malaysian 4.0 scale; marks below the lowest row are F)
    const SD_SCALE = [[80, 'A', 4.0], [75, 'A-', 3.67], [70, 'B+', 3.33], [65, 'B', 3.0], [60, 'B-', 2.67], [55, 'C+', 2.33], [50, 'C', 2.0], [47, 'C-', 1.67], [44, 'D+', 1.33], [40, 'D', 1.0], [0, 'F', 0]];
    const SD = { semesters: [], courses: [], classes: [], tasks: [], focus: [], tab: 'overview', filter: 'open', fCourse: '', showEnded: false, err: null, loadedAt: 0 };

    MODULES.study = function () {
      const info = (LumaPlan.addonInfo && LumaPlan.addonInfo.study) || {}, ends = info.expires_at ? new Date(info.expires_at) : null;
      const note = ends && info.source === 'trial' ? ` · trial ends ${ends.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}` : '';
      return head('Study', `<span id="sdSub">Loading…</span>${note}`,
        `<div class="sd-tabs" id="sdTabs">${SD_TABS.map(([k, n, i]) => `<button type="button" data-sdtab="${k}" class="${SD.tab === k ? 'on' : ''}"><i class="fa-solid ${i}"></i><span>${n}</span></button>`).join('')}</div><button class="create-btn" id="sdAdd"><i class="fa-solid fa-plus"></i> <span id="sdAddT">Add assignment</span></button>`) +
        '<div id="sdRoot"><div class="ls" style="padding:10px 2px">Loading…</div></div>';
    };

    // ---------- small helpers ----------
    const sdKey = () => mytDayKey(Date.now());
    const sdDow = k => new Date(k + 'T00:00:00Z').getUTCDay();
    const sdDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5); // days from a to b
    const sdAdd = (k, n) => new Date(Date.parse(k + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
    const sdFmtDate = (k, o) => new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });
    const sdCourse = id => SD.courses.find(c => c.id === id);
    const sdHM = t => String(t || '').slice(0, 5);
    const sdT12 = t => fmt12(sdHM(t));
    const sdMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
    const sdNowMin = (ts = Date.now()) => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: MYT, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts)); return +p.find(x => x.type === 'hour').value * 60 + +p.find(x => x.type === 'minute').value; };
    const sdWeekStart = () => { const k = sdKey(); return sdAdd(k, -((sdDow(k) + 6) % 7)); }; // this week's Monday
    const sdMinText = m => m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '') : m + ' min';
    const sdAddMonths = (k, n) => { const d = new Date(k + 'T00:00:00Z'), day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); return d.toISOString().slice(0, 10); };
    const sdShort = k => sdFmtDate(k, { day: 'numeric', month: 'short' });
    // a class runs on its weekday between its start and end dates (no dates = every week)
    const sdClassOn = (c, k) => c.weekday === sdDow(k) && (!c.start_date || k >= c.start_date) && (!c.end_date || k <= c.end_date);
    const sdClassEnded = c => !!c.end_date && c.end_date < sdKey();
    const sdSem = id => SD.semesters.find(x => x.id === id);
    const sdLetter = p => SD_SCALE.find(x => p >= x[0]) || SD_SCALE[SD_SCALE.length - 1];
    // a subject's mark: the final mark you entered, otherwise worked out from the scores you have so far
    const sdMark = c => c.final_percent != null ? Number(c.final_percent) : sdGrade(c.id);
    // the semester we are in now (or the next one coming, or the latest that ended)
    function sdCurrentSem() {
      const t = sdKey(), s = SD.semesters;
      return s.find(x => x.start_date <= t && t <= x.end_date) || s.filter(x => x.start_date > t).sort((a, b) => a.start_date.localeCompare(b.start_date))[0] || s.slice().sort((a, b) => b.end_date.localeCompare(a.end_date))[0] || null;
    }
    // GPA over a list of subjects: credit-hour weighted; subjects without a mark are left out
    function sdGpa(list) {
      const g = list.map(c => ({ c, m: sdMark(c) })).filter(x => x.m != null);
      if (!g.length) return null;
      const cr = g.filter(x => Number(x.c.credit_hours) > 0), pts = x => sdLetter(x.m)[2];
      const credits = cr.reduce((a, x) => a + Number(x.c.credit_hours), 0);
      return { gpa: credits ? cr.reduce((a, x) => a + pts(x) * Number(x.c.credit_hours), 0) / credits : g.reduce((a, x) => a + pts(x), 0) / g.length, n: g.length, credits };
    }
    // "what do I still need?": the mark needed on the remaining weight to reach the target (default: pass at 50%)
    function sdNeeded(c) {
      const items = SD.tasks.filter(t => t.course_id === c.id && Number(t.weight) > 0); if (!items.length) return null;
      const done = items.filter(t => t.score != null && Number(t.max_score) > 0);
      const wDone = done.reduce((a, t) => a + Number(t.weight), 0), earned = done.reduce((a, t) => a + Number(t.score) / Number(t.max_score) * Number(t.weight), 0);
      const target = c.target_percent != null ? Number(c.target_percent) : 50, left = 100 - wDone;
      if (left <= 0.01) return { cls: '', text: `All marked: ${sdPct(earned)}% overall` };
      const need = (target - earned) / left * 100;
      if (need <= 0) return { cls: 'ok', text: `${target}% is already secured` };
      if (need > 100) return { cls: 'bad', text: `${target}% is out of reach: you would need ${sdPct(need)}% on the remaining ${sdPct(left)}%` };
      return { cls: need > 85 ? 'warn' : '', text: `To reach ${target}% you need ${sdPct(need)}% on the remaining ${sdPct(left)}%` };
    }
    const sdPct = g => String(Math.round(g * 10) / 10);
    const sdKind = k => SD_KINDS.find(x => x[0] === k) || SD_KINDS[5];
    const sdCC = c => c ? `<span class="sd-cc" style="--c:${c.color}"><i></i>${escapeHtml(c.name)}</span>` : '';
    const sdErr = (id, m) => { const e = docEl(id); e.textContent = m; e.style.display = m ? 'flex' : 'none'; };
    const sdNum = v => { const s = String(v == null ? '' : v).trim(); if (s === '') return null; const n = Number(s.replace(',', '.')); return isFinite(n) ? n : NaN; };

    // the grade for a subject: weighted by each item's weight when weights are given, otherwise a plain average
    function sdGrade(courseId) {
      const g = SD.tasks.filter(t => t.course_id === courseId && t.score != null && Number(t.max_score) > 0);
      if (!g.length) return null;
      const w = g.filter(t => Number(t.weight) > 0);
      if (w.length) { const ws = w.reduce((s, t) => s + Number(t.weight), 0); return w.reduce((s, t) => s + Number(t.score) / Number(t.max_score) * Number(t.weight), 0) / ws * 100; }
      return g.reduce((s, t) => s + Number(t.score) / Number(t.max_score), 0) / g.length * 100;
    }
    function sdDue(t) {
      if (!t.due_date) return { text: 'No due date', cls: '' };
      const d = sdDiff(sdKey(), t.due_date), tm = t.due_time ? ' · ' + sdT12(t.due_time) : '', open = t.status !== 'done';
      if (open && d < 0) return { text: `${-d} day${d === -1 ? '' : 's'} overdue`, cls: 'over' };
      if (d === 0) return { text: 'Today' + tm, cls: open ? 'soon' : '' };
      if (d === 1) return { text: 'Tomorrow' + tm, cls: open ? 'soon' : '' };
      if (d > 1 && d < 7) return { text: sdFmtDate(t.due_date, { weekday: 'long' }) + tm, cls: '' };
      return { text: sdFmtDate(t.due_date, { day: 'numeric', month: 'short' }) + tm, cls: '' };
    }

    // the subject whose class is on at a moment (used to tag Focus sessions); '' when no class is on
    function sdCurrentCourse(ts = Date.now()) {
      const k = mytDayKey(ts), m = sdNowMin(ts), c = SD.classes.find(x => sdClassOn(x, k) && sdMin(x.start_time) <= m && m < sdMin(x.end_time));
      return c ? c.course_id : '';
    }

    // ---------- loading ----------
    async function sdLoad() {
      try {
        const [c, k, t, f, sm] = await Promise.all([LumaStudy.courses.list(), LumaStudy.classes.list(), LumaStudy.tasks.list(), LumaStudy.focusSince(new Date(sdWeekStart() + 'T00:00:00').toISOString()), LumaStudy.semesters.list()]);
        const bad = c.error || k.error || t.error;
        SD.err = bad ? bad.message : null;
        if (!bad) { SD.courses = c.data || []; SD.classes = k.data || []; SD.tasks = t.data || []; SD.focus = f.error ? [] : (f.data || []); SD.semesters = sm.error ? [] : (sm.data || []); } // semesters need migration 049: without it the rest still works
      } catch (e) { SD.err = e.message || 'Could not load'; }
      SD.loadedAt = Date.now();
    }
    // other pages (the calendar, Focus Mode) borrow the data: reuse it for a minute
    const sdEnsureLoaded = () => (SD.loadedAt && Date.now() - SD.loadedAt < 60000 && !SD.err) ? Promise.resolve() : sdLoad();

    // ---------- painting ----------
    function sdPaint() {
      const root = docEl('sdRoot'), sub = docEl('sdSub'); if (!root) return;
      document.querySelectorAll('#sdTabs button').forEach(b => b.classList.toggle('on', b.dataset.sdtab === SD.tab));
      docEl('sdAddT').textContent = SD.tab === 'timetable' ? 'Add class' : SD.tab === 'subjects' ? 'Add subject' : SD.tab === 'semesters' ? 'Add semester' : 'Add assignment';
      if (SD.err) {
        sub.textContent = 'Could not load';
        root.innerHTML = card(`<div class="ls">Could not load your study data: ${escapeHtml(SD.err)}. ${/study_|schema cache|does not exist/i.test(SD.err) ? 'Has <b>supabase/migrations/045_study.sql</b> been run in the Supabase SQL Editor?' : ''}</div>`);
        return;
      }
      const open = SD.tasks.filter(t => t.status !== 'done');
      sub.textContent = SD.courses.length ? `${SD.courses.length} subject${SD.courses.length === 1 ? '' : 's'} · ${open.length} to do` : 'Classes, assignments and exams in one place';
      if (!SD.courses.length && !SD.tasks.length && !SD.semesters.length && SD.tab !== 'semesters') {
        root.innerHTML = card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-graduation-cap"></i></div><div class="h-empty-t">Set up your semester</div>
          <div class="h-empty-s">Start with your subjects, then add your weekly classes and the assignments, tests and exams that are coming. LUMA reminds you before each one is due.</div>
          <div class="h-empty-chips"><button type="button" class="h-chip" data-add="course"><i class="fa-solid fa-plus" style="color:#34d399"></i>Add your first subject</button></div></div>`);
        return;
      }
      root.innerHTML = SD.tab === 'timetable' ? sdTimetable() : SD.tab === 'assignments' ? sdAssignments() : SD.tab === 'subjects' ? sdSubjects() : SD.tab === 'semesters' ? sdSemesters() : sdOverview();
    }

    function sdRow(t) {
      const c = sdCourse(t.course_id), du = sdDue(t), k = sdKind(t.kind), done = t.status === 'done';
      const graded = t.score != null && Number(t.max_score) > 0 ? `${+t.score}/${+t.max_score}` : t.weight != null ? `${+t.weight}%` : '';
      return `<div class="sd-row ${done ? 'done' : ''}" data-task="${t.id}"><button type="button" class="sd-check ${done ? 'on' : ''}" data-check="${t.id}" title="${done ? 'Mark as not done' : 'Mark as done'}"><i class="fa-solid fa-check"></i></button>
        <div class="sd-rb"><div class="sd-rt">${escapeHtml(t.title)}</div><div class="sd-rm"><span class="sd-kind"><i class="fa-solid ${k[2]}"></i>${k[1]}</span>${sdCC(c)}<span class="sd-due ${du.cls}">${du.text}</span></div></div>
        ${graded ? `<span class="sd-pill" title="${t.score != null ? 'Score' : 'Weight'}">${graded}</span>` : ''}</div>`;
    }
    function sdClassCard(c) {
      const co = sdCourse(c.course_id), kind = (SD_CLASS_KINDS.find(x => x[0] === c.kind) || SD_CLASS_KINDS[0])[1];
      const when = sdClassEnded(c) ? 'Ended ' + sdShort(c.end_date) : c.start_date && c.start_date > sdKey() ? 'From ' + sdShort(c.start_date) + (c.end_date ? ' to ' + sdShort(c.end_date) : '') : c.end_date ? 'Until ' + sdShort(c.end_date) : '';
      return `<button type="button" class="sd-cls ${sdClassEnded(c) ? 'ended' : ''}" data-cls="${c.id}" style="--c:${co ? co.color : '#34d399'}"><b>${sdT12(c.start_time)} – ${sdT12(c.end_time)}</b><span class="sd-cn">${escapeHtml(co ? co.name : 'Class')}</span><small>${[c.room, kind].filter(Boolean).map(escapeHtml).join(' · ')}</small>${when ? `<small class="sd-when">${when}</small>` : ''}</button>`;
    }

    function sdOverview() {
      const today = sdKey(), dow = sdDow(today), nowM = sdNowMin();
      const open = SD.tasks.filter(t => t.status !== 'done');
      const overdue = open.filter(t => t.due_date && t.due_date < today), week = open.filter(t => t.due_date && t.due_date >= today && sdDiff(today, t.due_date) <= 7);
      const todays = SD.classes.filter(c => sdClassOn(c, today)).sort((a, b) => sdHM(a.start_time).localeCompare(sdHM(b.start_time)));
      const mins = SD.focus.reduce((s, r) => s + r.minutes, 0);
      const tiles = [['fa-list-check', '#60a5fa', week.length, 'Due this week'], ['fa-triangle-exclamation', overdue.length ? '#f87171' : '#94a3b8', overdue.length, 'Overdue'], ['fa-chalkboard-user', '#34d399', todays.length, 'Classes today'], ['fa-hourglass-half', '#a78bfa', sdMinText(mins), 'Studied this week']]
        .map(([i, c, v, l]) => `<div class="sd-tile" style="--c:${c}"><i class="fa-solid ${i}"></i><div><b>${v}</b><span>${l}</span></div></div>`).join('');
      let marked = false;
      const todayHtml = todays.length ? todays.map(c => {
        const s = sdMin(c.start_time), e = sdMin(c.end_time), isNow = nowM >= s && nowM < e, isNext = !isNow && !marked && s > nowM;
        if (isNext) marked = true;
        return `<div class="sd-today ${isNow ? 'now' : ''}" data-cls="${c.id}" style="--c:${(sdCourse(c.course_id) || {}).color || '#34d399'}"><div class="tm">${sdT12(c.start_time)}<small>${sdT12(c.end_time)}</small></div><div class="bd"><b>${escapeHtml((sdCourse(c.course_id) || {}).name || 'Class')}</b><small>${[c.room, (SD_CLASS_KINDS.find(x => x[0] === c.kind) || [])[1]].filter(Boolean).map(escapeHtml).join(' · ')}</small></div>${isNow ? '<span class="sd-badge">Now</span>' : isNext ? '<span class="sd-badge next">Next</span>' : e <= nowM ? '<span class="sd-badge off">Done</span>' : ''}</div>`;
      }).join('') : '<div class="ls" style="padding:6px 2px">No classes today. Enjoy!</div>';
      const soon = [...overdue, ...open.filter(t => t.due_date && t.due_date >= today)].sort((a, b) => a.due_date.localeCompare(b.due_date) || sdHM(a.due_time).localeCompare(sdHM(b.due_time))).slice(0, 8);
      const dueHtml = soon.length ? soon.map(sdRow).join('') : '<div class="ls" style="padding:6px 2px">Nothing is due. Add an assignment, test or exam to track it.</div>';
      const by = {}; SD.focus.forEach(r => { by[r.course_id || ''] = (by[r.course_id || ''] || 0) + r.minutes; });
      const rows = Object.keys(by).sort((a, b) => by[b] - by[a]);
      const top = rows.length ? by[rows[0]] : 1;
      const timeHtml = rows.length ? rows.map(id => { const c = sdCourse(id); return `<div class="sd-bar" style="--c:${c ? c.color : '#94a3b8'}"><div class="sb-h"><span>${escapeHtml(c ? c.name : 'No subject')}</span><b>${sdMinText(by[id])}</b></div><div class="sb-t"><i style="width:${Math.max(4, Math.round(by[id] / top * 100))}%"></i></div></div>`; }).join('')
        : '<div class="ls" style="padding:6px 2px">Start <b>Focus Mode</b> and pick a subject. Your study time shows up here.</div>';
      const graded = SD.courses.map(c => ({ c, g: sdGrade(c.id) })).filter(x => x.g != null);
      const gradeHtml = graded.length ? graded.map(({ c, g }) => `<div class="sd-bar" style="--c:${c.color}"><div class="sb-h"><span>${escapeHtml(c.name)}</span><b>${sdPct(g)}%</b></div><div class="sb-t"><i style="width:${Math.max(3, Math.min(100, g))}%"></i></div></div>`).join('')
        : '<div class="ls" style="padding:6px 2px">Add a score and weight to your assignments to see your grade for each subject.</div>';
      const exams = open.filter(t => (t.kind === 'exam' || t.kind === 'test') && t.due_date && t.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 5);
      const examHtml = exams.length ? exams.map(t => { const d = sdDiff(today, t.due_date), c = sdCourse(t.course_id); return `<div class="sd-exam ${d <= 3 ? 'hot' : ''}" data-task="${t.id}" style="--c:${c ? c.color : '#a78bfa'}"><div class="dd"><b>${d}</b><span>${d === 1 ? 'day' : 'days'}</span></div><div class="bd"><b>${escapeHtml(t.title)}</b><small>${escapeHtml(c ? c.name : sdKind(t.kind)[1])} · ${sdFmtDate(t.due_date, { weekday: 'short', day: 'numeric', month: 'short' })}${t.due_time ? ' · ' + sdT12(t.due_time) : ''}</small></div></div>`; }).join('') : '<div class="ls" style="padding:6px 2px">No tests or exams coming up. Add one as an assignment of type Exam or Test.</div>';
      return `${sdSemStrip()}<div class="sd-tiles">${tiles}</div><div class="grid-2">
        ${card(`<div class="section-title"><i class="fa-solid fa-chalkboard-user"></i> Today's classes</div>${todayHtml}`)}
        ${card(`<div class="section-title"><i class="fa-solid fa-hourglass-half"></i> Due soon</div>${dueHtml}`)}
        ${card(`<div class="section-title"><i class="fa-solid fa-stopwatch"></i> Study time this week</div>${timeHtml}`)}
        ${card(`<div class="section-title"><i class="fa-solid fa-chart-simple"></i> Grades</div>${gradeHtml}`)}
        ${card(`<div class="section-title"><i class="fa-solid fa-flag-checkered"></i> Exam countdown</div>${examHtml}`)}</div>`;
    }

    // slim "Semester 2 · week 5 of 14" bar on the overview
    function sdSemStrip() {
      const sem = sdCurrentSem(); if (!sem) return '';
      const t = sdKey(), total = Math.ceil((sdDiff(sem.start_date, sem.end_date) + 1) / 7), started = t >= sem.start_date, over = t > sem.end_date;
      const wk = Math.min(total, Math.max(1, Math.floor(sdDiff(sem.start_date, t) / 7) + 1)), pct = over ? 100 : started ? Math.round((sdDiff(sem.start_date, t) + 1) / (sdDiff(sem.start_date, sem.end_date) + 1) * 100) : 0;
      const label = over ? 'Ended ' + sdShort(sem.end_date) : !started ? `Starts ${sdShort(sem.start_date)} (in ${sdDiff(t, sem.start_date)} days)` : `Week ${wk} of ${total} · ${Math.max(0, total - wk)} week${total - wk === 1 ? '' : 's'} left`;
      return `<div class="sd-semstrip" data-sem="${sem.id}"><div class="ss-h"><b><i class="fa-solid fa-calendar-days"></i> ${escapeHtml(sem.name)}</b><span>${label}</span></div><div class="sb-t"><i style="width:${pct}%"></i></div></div>`;
    }

    function sdTimetable() {
      const today = sdDow(sdKey()), ended = SD.classes.filter(sdClassEnded), shown = SD.classes.filter(c => SD.showEnded || !sdClassEnded(c));
      if (!SD.classes.length) {
        return card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-calendar-week"></i></div><div class="h-empty-t">Build your weekly timetable</div>
          <div class="h-empty-s">${SD.courses.length ? 'Add each class once: pick the subject, the days and the time. It repeats every week and shows on your Calendar too.' : 'Add your subjects first, then put each class on the timetable.'}</div>
          <div class="h-empty-chips"><button type="button" class="h-chip" data-add="${SD.courses.length ? 'class' : 'course'}"><i class="fa-solid fa-plus" style="color:#34d399"></i>${SD.courses.length ? 'Add a class' : 'Add a subject'}</button></div></div>`);
      }
      return `<div class="sd-week">${SD_DAYS.map(([d, n]) => {
        const list = shown.filter(c => c.weekday === d).sort((a, b) => sdHM(a.start_time).localeCompare(sdHM(b.start_time)));
        return `<div class="sd-day ${d === today ? 'today' : ''}"><div class="sd-dh"><span>${n}</span><button type="button" data-add="class" data-day="${d}" title="Add a class on ${n}"><i class="fa-solid fa-plus"></i></button></div>${list.length ? list.map(sdClassCard).join('') : '<div class="sd-free">Free</div>'}</div>`;
      }).join('')}</div>${ended.length ? `<div class="sd-endednote"><button type="button" data-ended>${SD.showEnded ? 'Hide' : 'Show'} ended classes (${ended.length})</button></div>` : ''}`;
    }

    function sdAssignments() {
      const today = sdKey();
      const chips = `<div class="sd-filters"><div class="sd-seg">${[['open', 'To do'], ['done', 'Done'], ['all', 'All']].map(([k, n]) => `<button type="button" data-f="${k}" class="${SD.filter === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="sd-subj"><button type="button" data-fc="" class="${SD.fCourse === '' ? 'on' : ''}">All subjects</button>${SD.courses.map(c => `<button type="button" data-fc="${c.id}" class="${SD.fCourse === c.id ? 'on' : ''}" style="--c:${c.color}"><i></i>${escapeHtml(c.name)}</button>`).join('')}</div></div>`;
      let list = SD.tasks.filter(t => (!SD.fCourse || t.course_id === SD.fCourse) && (SD.filter === 'all' || (SD.filter === 'done') === (t.status === 'done')));
      if (!list.length) return chips + card(`<div class="ls" style="padding:10px 2px">${SD.tasks.length ? 'Nothing here with these filters.' : 'No assignments yet. Tap <b>Add assignment</b> to track your first one.'}</div>`);
      const byDue = (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || sdHM(a.due_time).localeCompare(sdHM(b.due_time));
      if (SD.filter !== 'open') return chips + card(list.sort((a, b) => byDue(b, a)).map(sdRow).join(''));
      const groups = [['Overdue', t => t.due_date && t.due_date < today], ['Next 7 days', t => t.due_date && t.due_date >= today && sdDiff(today, t.due_date) <= 7], ['Later', t => t.due_date && sdDiff(today, t.due_date) > 7], ['No due date', t => !t.due_date]];
      return chips + groups.map(([n, f]) => { const g = list.filter(f).sort(byDue); return g.length ? card(`<div class="section-title">${n} <span class="sd-count">${g.length}</span></div>${g.map(sdRow).join('')}`) : ''; }).join('');
    }

    function sdCourseCard(c) {
      const m = sdMark(c), open = SD.tasks.filter(t => t.course_id === c.id && t.status !== 'done').length, n = SD.classes.filter(x => x.course_id === c.id && !sdClassEnded(x)).length;
      const mins = SD.focus.filter(r => r.course_id === c.id).reduce((a, r) => a + r.minutes, 0), L = m != null ? sdLetter(m) : null, need = sdNeeded(c);
      return `<div class="card sd-course" data-course="${c.id}" style="--c:${c.color}"><div class="sc-top"><span class="sc-dot"></span><div class="sc-main"><div class="sc-t">${escapeHtml(c.name)}</div><div class="sc-s">${[c.code, c.lecturer, c.credit_hours != null ? c.credit_hours + ' credit hour' + (c.credit_hours === 1 ? '' : 's') : ''].filter(Boolean).map(escapeHtml).join(' · ') || 'Tap to add details'}</div></div><button type="button" class="hedit" title="Edit"><i class="fa-solid fa-pen"></i></button></div>
        <div class="sc-stats"><div><b>${m == null ? '—' : sdPct(m) + '%'}${L ? `<em>${L[1]}</em>` : ''}</b><span>${c.final_percent != null ? 'Final mark' : 'Grade so far'}</span></div><div><b>${open}</b><span>To do</span></div><div><b>${n}</b><span>Classes / week</span></div><div><b>${mins ? sdMinText(mins) : '—'}</b><span>This week</span></div></div>
        ${need ? `<div class="sc-need ${need.cls}"><i class="fa-solid fa-bullseye"></i>${need.text}</div>` : ''}</div>`;
    }
    function sdSubjects() {
      if (!SD.courses.length) return card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-book"></i></div><div class="h-empty-t">No subjects yet</div><div class="h-empty-s">A subject groups its classes, assignments, grades and study time.</div><div class="h-empty-chips"><button type="button" class="h-chip" data-add="course"><i class="fa-solid fa-plus" style="color:#34d399"></i>Add a subject</button></div></div>`);
      if (!SD.semesters.length) return `<div class="grid-2">${SD.courses.map(sdCourseCard).join('')}</div>`;
      const cur = sdCurrentSem(), order = [...SD.semesters].sort((a, b) => (a === cur ? -1 : b === cur ? 1 : b.start_date.localeCompare(a.start_date)));
      const groups = order.map(sem => [sem, SD.courses.filter(c => c.semester_id === sem.id)]).filter(([, l]) => l.length);
      const none = SD.courses.filter(c => !c.semester_id || !sdSem(c.semester_id)); if (none.length) groups.push([null, none]);
      return groups.map(([sem, list]) => { const g = sdGpa(list); return `<div class="sd-gh"><b>${sem ? escapeHtml(sem.name) : 'No semester'}</b>${sem && sem === cur ? '<em>Current</em>' : ''}${g ? `<span>GPA ${g.gpa.toFixed(2)}</span>` : ''}</div><div class="grid-2" style="margin-bottom:16px">${list.map(sdCourseCard).join('')}</div>`; }).join('');
    }

    // ---------- semesters: the planner, GPA and CGPA ----------
    function sdSemesters() {
      if (!SD.semesters.length) return card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-calendar-days"></i></div><div class="h-empty-t">Plan your semesters</div>
        <div class="h-empty-s">Add a semester with its first and last day. LUMA shows which week you are in, fills in the end date of your timetable classes, and works out your GPA when you put your subjects in it.</div>
        <div class="h-empty-chips"><button type="button" class="h-chip" data-add="semester"><i class="fa-solid fa-plus" style="color:#34d399"></i>Add a semester</button></div></div>`);
      const cur = sdCurrentSem(), all = sdGpa(SD.courses), t = sdKey();
      const order = [...SD.semesters].sort((a, b) => b.start_date.localeCompare(a.start_date));
      const head = `<div class="sd-tiles" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="sd-tile" style="--c:#34d399"><i class="fa-solid fa-award"></i><div><b>${all ? all.gpa.toFixed(2) : '—'}</b><span>CGPA (all semesters)</span></div></div>
        <div class="sd-tile" style="--c:#60a5fa"><i class="fa-solid fa-book"></i><div><b>${SD.courses.length}</b><span>Subjects</span></div></div>
        <div class="sd-tile" style="--c:#a78bfa"><i class="fa-solid fa-layer-group"></i><div><b>${all ? all.credits : 0}</b><span>Credit hours graded</span></div></div></div>`;
      const cards = order.map(sem => {
        const list = SD.courses.filter(c => c.semester_id === sem.id), g = sdGpa(list), total = Math.ceil((sdDiff(sem.start_date, sem.end_date) + 1) / 7);
        const state = t > sem.end_date ? 'Ended' : t < sem.start_date ? `Starts in ${sdDiff(t, sem.start_date)} days` : `Week ${Math.min(total, Math.floor(sdDiff(sem.start_date, t) / 7) + 1)} of ${total}`;
        return `<div class="card sd-sem ${sem === cur ? 'cur' : ''}" data-sem="${sem.id}"><div class="sm-top"><div class="sm-main"><div class="sm-t">${escapeHtml(sem.name)}${sem === cur ? '<em>Current</em>' : ''}</div><div class="sm-s">${sdShort(sem.start_date)} to ${sdShort(sem.end_date)} · ${total} weeks · ${state}</div></div><div class="sm-gpa"><b>${g ? g.gpa.toFixed(2) : '—'}</b><span>GPA</span></div><button type="button" class="hedit" title="Edit"><i class="fa-solid fa-pen"></i></button></div>
          <div class="sm-subj">${list.length ? list.map(c => { const m = sdMark(c); return `<span class="sd-cc" style="--c:${c.color}"><i></i>${escapeHtml(c.name)}${m != null ? ` <b>${sdLetter(m)[1]}</b>` : ''}</span>`; }).join('') : '<span class="ls">No subjects in this semester yet. Pick it when you add or edit a subject.</span>'}</div></div>`;
      }).join('');
      return head + cards;
    }

    // ---------- the three popups ----------
    const SDF = { courseId: null, color: SD_COLORS[0], classId: null, days: new Set(), classKind: 'lecture', endMode: 'weeks', taskId: null, taskKind: 'assignment', taskStatus: 'todo' };
    const sdOpen = id => { const o = docEl(id); o.classList.add('open'); o.querySelectorAll('.pem-body').forEach(el => { el.scrollTop = 0; }); };
    const sdClose = id => docEl(id).classList.remove('open');
    const sdChips = (id, list, cur, attr) => { docEl(id).innerHTML = list.map(([k, n, i]) => `<button type="button" class="h-chip sm ${k === cur ? 'on' : ''}" data-${attr}="${k}">${i ? `<i class="fa-solid ${i}"></i>` : ''}${n}</button>`).join(''); };
    const sdAfterSave = () => { sdPaint(); const cal = document.getElementById('page-calendar'); if (cal && cal.classList.contains('active') && typeof paintCalendar === 'function') paintCalendar(); };
    const sdBtn = (id, busy, label) => { const b = docEl(id); b.disabled = busy; b.textContent = busy ? 'Saving…' : label; };
    const sdHint = m => /study_|schema cache|does not exist/i.test(m) ? 'Study isn\'t set up yet — run supabase/migrations/045_study.sql in the SQL Editor.' : /row-level security|violates/i.test(m) ? 'Your Study add-on isn\'t active, so changes can\'t be saved.' : m;
    function sdCourseOptions(selId, cur, none) {
      const sel = docEl(selId);
      sel.innerHTML = (none ? '<option value="">No subject</option>' : '') + SD.courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.code ? ' (' + escapeHtml(c.code) + ')' : ''}</option>`).join('');
      sel.value = cur && sdCourse(cur) ? cur : (none ? '' : (SD.courses[0] || {}).id || '');
      skinSelect(sel);
    }

    // --- subject ---
    function sdPaintColors() { docEl('sdCourseColors').innerHTML = SD_COLORS.map(c => `<button type="button" class="sd-sw ${c === SDF.color ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join(''); }
    function openCourseModal(c) {
      SDF.courseId = c ? c.id : null; SDF.color = c ? c.color : SD_COLORS[SD.courses.length % SD_COLORS.length];
      docEl('sdCourseTitle').textContent = c ? 'Edit subject' : 'New subject';
      docEl('sdCourseName').value = c ? c.name : ''; docEl('sdCourseCode').value = c ? c.code || '' : ''; docEl('sdCourseLecturer').value = c ? c.lecturer || '' : ''; docEl('sdCourseCredits').value = c && c.credit_hours != null ? c.credit_hours : '';
      const sem = docEl('sdCourseSem'); sem.innerHTML = '<option value="">No semester</option>' + [...SD.semesters].sort((a, b) => b.start_date.localeCompare(a.start_date)).map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join('');
      sem.value = c ? (c.semester_id && sdSem(c.semester_id) ? c.semester_id : '') : ((sdCurrentSem() || {}).id || ''); skinSelect(sem);
      docEl('sdCourseTarget').value = c && c.target_percent != null ? +c.target_percent : ''; docEl('sdCourseFinal').value = c && c.final_percent != null ? +c.final_percent : '';
      docEl('sdCourseDelete').style.display = c ? '' : 'none'; sdErr('sdCourseError', ''); sdPaintColors();
      sdOpen('sdCourseOverlay'); setTimeout(() => docEl('sdCourseName').focus(), 50);
    }
    docEl('sdCourseClose').onclick = () => sdClose('sdCourseOverlay');
    docEl('sdCourseOverlay').onclick = e => { if (e.target === docEl('sdCourseOverlay')) return sdClose('sdCourseOverlay'); const b = e.target.closest('[data-color]'); if (b) { SDF.color = b.dataset.color; sdPaintColors(); } };
    ['sdCourseTarget', 'sdCourseFinal'].forEach(id => docEl(id).addEventListener('input', () => { const v = cleanDecimal(docEl(id).value); if (v !== docEl(id).value) docEl(id).value = v; }));
    docEl('sdCourseCredits').addEventListener('input', () => { docEl('sdCourseCredits').value = docEl('sdCourseCredits').value.replace(/\D/g, ''); });
    docEl('sdCourseName').addEventListener('keydown', e => { if (e.key === 'Enter') docEl('sdCourseSave').click(); });
    docEl('sdCourseSave').onclick = async () => {
      const name = docEl('sdCourseName').value.trim(), cr = docEl('sdCourseCredits').value.trim();
      if (!name) return sdErr('sdCourseError', 'Give the subject a name.');
      if (cr !== '' && +cr > 30) return sdErr('sdCourseError', 'Credit hours should be between 0 and 30.');
      const target = sdNum(docEl('sdCourseTarget').value), fin = sdNum(docEl('sdCourseFinal').value);
      if (Number.isNaN(target) || (target != null && (target < 0 || target > 100)) || Number.isNaN(fin) || (fin != null && (fin < 0 || fin > 100))) return sdErr('sdCourseError', 'Marks are percentages between 0 and 100.');
      const fields = { name, code: docEl('sdCourseCode').value.trim(), lecturer: docEl('sdCourseLecturer').value.trim(), credit_hours: cr === '' ? null : +cr, color: SDF.color, semester_id: docEl('sdCourseSem').value || null, target_percent: target, final_percent: fin };
      sdErr('sdCourseError', ''); sdBtn('sdCourseSave', true);
      const { data, error } = SDF.courseId ? await LumaStudy.courses.update(SDF.courseId, fields) : await LumaStudy.courses.add(fields);
      sdBtn('sdCourseSave', false, 'Save subject');
      if (error) return sdErr('sdCourseError', sdHint(error.message));
      const i = SD.courses.findIndex(x => x.id === data.id); if (i >= 0) SD.courses[i] = data; else SD.courses.push(data);
      sdClose('sdCourseOverlay'); sdAfterSave();
    };
    docEl('sdCourseDelete').onclick = async () => {
      const c = sdCourse(SDF.courseId); if (!c) return;
      if (!await luConfirm({ title: `Delete “${c.name}”?`, message: 'Its classes are removed from your timetable. Its assignments stay, but without a subject. This can\'t be undone.' })) return;
      const { error } = await LumaStudy.courses.remove(c.id);
      if (error) return sdErr('sdCourseError', error.message);
      SD.courses = SD.courses.filter(x => x !== c); SD.classes = SD.classes.filter(x => x.course_id !== c.id); SD.tasks.forEach(t => { if (t.course_id === c.id) t.course_id = null; });
      sdClose('sdCourseOverlay'); sdAfterSave();
    };

    // --- semester ---
    SDF.semId = null;
    function sdSemHint() {
      const a = docEl('sdSemStart').value, b = docEl('sdSemEnd').value;
      docEl('sdSemHint').textContent = a && b && b > a ? `${Math.ceil((sdDiff(a, b) + 1) / 7)} weeks · ${sdShort(a)} to ${sdShort(b)}` : '';
    }
    function openSemModal(m) {
      SDF.semId = m ? m.id : null; docEl('sdSemTitle').textContent = m ? 'Edit semester' : 'New semester';
      docEl('sdSemName').value = m ? m.name : ''; docEl('sdSemStart').value = m ? m.start_date : sdKey(); docEl('sdSemEnd').value = m ? m.end_date : sdAdd(sdKey(), 14 * 7 - 1);
      ['sdSemStart', 'sdSemEnd'].forEach(id => docEl(id)._luDateRefresh && docEl(id)._luDateRefresh());
      docEl('sdSemDelete').style.display = m ? '' : 'none'; sdErr('sdSemError', ''); sdSemHint(); sdOpen('sdSemOverlay'); setTimeout(() => docEl('sdSemName').focus(), 50);
    }
    docEl('sdSemClose').onclick = () => sdClose('sdSemOverlay');
    docEl('sdSemOverlay').onclick = e => { if (e.target === docEl('sdSemOverlay')) sdClose('sdSemOverlay'); };
    ['sdSemStart', 'sdSemEnd'].forEach(id => docEl(id).addEventListener('change', sdSemHint));
    docEl('sdSemName').addEventListener('keydown', e => { if (e.key === 'Enter') docEl('sdSemSave').click(); });
    docEl('sdSemSave').onclick = async () => {
      const name = docEl('sdSemName').value.trim(), a = docEl('sdSemStart').value, b = docEl('sdSemEnd').value;
      if (!name) return sdErr('sdSemError', 'Give the semester a name.');
      if (!a || !b) return sdErr('sdSemError', 'Pick the first and last day.');
      if (b <= a) return sdErr('sdSemError', 'The last day must be after the first day.');
      sdErr('sdSemError', ''); sdBtn('sdSemSave', true);
      const fields = { name, start_date: a, end_date: b };
      const { data, error } = SDF.semId ? await LumaStudy.semesters.update(SDF.semId, fields) : await LumaStudy.semesters.add(fields);
      sdBtn('sdSemSave', false, 'Save semester');
      if (error) return sdErr('sdSemError', /study_semesters|schema cache|does not exist/i.test(error.message) ? 'Semesters aren\'t set up yet — run supabase/migrations/049_study_v2.sql in the SQL Editor.' : sdHint(error.message));
      const i = SD.semesters.findIndex(x => x.id === data.id); if (i >= 0) SD.semesters[i] = data; else SD.semesters.push(data);
      sdClose('sdSemOverlay'); sdAfterSave();
    };
    docEl('sdSemDelete').onclick = async () => {
      const m = sdSem(SDF.semId); if (!m) return;
      if (!await luConfirm({ title: `Delete “${m.name}”?`, message: 'Its subjects stay, but they are no longer in a semester. This can\'t be undone.' })) return;
      const { error } = await LumaStudy.semesters.remove(m.id);
      if (error) return sdErr('sdSemError', error.message);
      SD.semesters = SD.semesters.filter(x => x !== m); SD.courses.forEach(c => { if (c.semester_id === m.id) c.semester_id = null; });
      sdClose('sdSemOverlay'); sdAfterSave();
    };

    // --- class ---
    function sdPaintDays() { docEl('sdClassDays').innerHTML = SD_DAYS.map(([d, n]) => `<button type="button" class="h-chip sm ${SDF.days.has(d) ? 'on' : ''}" data-day="${d}">${n}</button>`).join(''); }
    function openClassModal(c, day) {
      if (!SD.courses.length) { openCourseModal(null); return flashToast('Add a subject first', 'Then you can put its classes on the timetable', 'fa-book', '#34d399'); }
      SDF.classId = c ? c.id : null; SDF.days = new Set(c ? [c.weekday] : [day != null ? day : (sdDow(sdKey()) || 1)]); SDF.classKind = c ? c.kind : 'lecture';
      docEl('sdClassTitle').textContent = c ? 'Edit class' : 'New class'; docEl('sdClassDaysLbl').textContent = c ? 'Day' : 'Days (pick every day it happens)';
      sdCourseOptions('sdClassCourse', c ? c.course_id : null, false);
      docEl('sdClassStart').value = c ? sdHM(c.start_time) : '09:00'; docEl('sdClassEnd').value = c ? sdHM(c.end_time) : '10:00';
      ['sdClassStart', 'sdClassEnd'].forEach(id => docEl(id)._luTimeRefresh && docEl(id)._luTimeRefresh());
      docEl('sdClassRoom').value = c ? c.room || '' : '';
      docEl('sdClassFrom').value = c && c.start_date ? c.start_date : sdKey(); docEl('sdClassUntil').value = c && c.end_date ? c.end_date : '';
      SDF.endMode = c ? (c.end_date ? 'date' : 'none') : 'weeks'; docEl('sdClassCount').value = c ? '' : '14';
      ['sdClassFrom', 'sdClassUntil'].forEach(id => docEl(id)._luDateRefresh && docEl(id)._luDateRefresh());
      sdPaintEnd();
      docEl('sdClassDelete').style.display = c ? '' : 'none'; sdErr('sdClassError', '');
      if (!c) sdApplySemToClass();
      sdPaintDays(); sdChips('sdClassKinds', SD_CLASS_KINDS.map(([k, n]) => [k, n, '']), SDF.classKind, 'ck');
      sdOpen('sdClassOverlay');
    }
    // a new class in a subject that belongs to a semester runs until that semester ends
    function sdApplySemToClass() {
      const co = sdCourse(docEl('sdClassCourse').value), sem = co && sdSem(co.semester_id); if (!sem) return;
      const today = sdKey(); if (sem.end_date < today) return;
      docEl('sdClassFrom').value = sem.start_date > today ? sem.start_date : today; docEl('sdClassUntil').value = sem.end_date; SDF.endMode = 'date';
      ['sdClassFrom', 'sdClassUntil'].forEach(id => docEl(id)._luDateRefresh && docEl(id)._luDateRefresh()); sdPaintEnd();
    }
    docEl('sdClassCourse').addEventListener('change', () => { if (!SDF.classId) sdApplySemToClass(); });
    const SD_END_MODES = [['weeks', 'Weeks'], ['months', 'Months'], ['date', 'On a date'], ['none', 'No end']];
    // when a class stops: after N weeks, after N months, on a date, or never (every week)
    function sdClassRange() {
      const from = docEl('sdClassFrom').value, n = +docEl('sdClassCount').value;
      if (!from) return { text: 'Pick the date the class starts.', end: null };
      let end = null;
      if (SDF.endMode === 'weeks' && n > 0) end = sdAdd(from, n * 7 - 1);
      else if (SDF.endMode === 'months' && n > 0) end = sdAdd(sdAddMonths(from, n), -1);
      else if (SDF.endMode === 'date') end = docEl('sdClassUntil').value || null;
      const text = end ? `Runs ${sdShort(from)} to ${sdShort(end)}${SDF.endMode === 'weeks' || SDF.endMode === 'months' ? ` (${n} ${SDF.endMode === 'weeks' ? 'week' : 'month'}${n === 1 ? '' : 's'})` : ''}` : SDF.endMode === 'none' ? `Every week from ${sdShort(from)}, with no end date.` : SDF.endMode === 'date' ? 'Pick the date it ends.' : 'Enter how long it runs.';
      return { text, end };
    }
    function sdPaintEndInfo() { docEl('sdClassRange').textContent = sdClassRange().text; }
    function sdPaintEnd() {
      sdChips('sdClassEndMode', SD_END_MODES.map(([k, n]) => [k, n, '']), SDF.endMode, 'em');
      const counted = SDF.endMode === 'weeks' || SDF.endMode === 'months';
      docEl('sdClassCountWrap').style.display = counted ? '' : 'none'; docEl('sdClassUntilWrap').style.display = SDF.endMode === 'date' ? '' : 'none';
      docEl('sdClassCountUnit').textContent = SDF.endMode === 'months' ? 'months' : 'weeks'; docEl('sdClassCount').max = SDF.endMode === 'months' ? 24 : 60;
      sdPaintEndInfo();
    }
    docEl('sdClassCount').addEventListener('input', () => { docEl('sdClassCount').value = docEl('sdClassCount').value.replace(/\D/g, ''); sdPaintEndInfo(); });
    ['sdClassFrom', 'sdClassUntil'].forEach(id => docEl(id).addEventListener('change', sdPaintEndInfo));
    docEl('sdClassClose').onclick = () => sdClose('sdClassOverlay');
    docEl('sdClassOverlay').onclick = e => {
      if (e.target === docEl('sdClassOverlay')) return sdClose('sdClassOverlay');
      const d = e.target.closest('[data-day]'); if (d) { const n = +d.dataset.day; if (SDF.classId) SDF.days = new Set([n]); else if (SDF.days.has(n)) { if (SDF.days.size > 1) SDF.days.delete(n); } else SDF.days.add(n); return sdPaintDays(); }
      const em = e.target.closest('[data-em]'); if (em) { const was = SDF.endMode; SDF.endMode = em.dataset.em; if ((SDF.endMode === 'weeks' || SDF.endMode === 'months') && was !== SDF.endMode) docEl('sdClassCount').value = SDF.endMode === 'weeks' ? '14' : '4'; return sdPaintEnd(); }
      const k = e.target.closest('[data-ck]'); if (k) { SDF.classKind = k.dataset.ck; sdChips('sdClassKinds', SD_CLASS_KINDS.map(([a, n]) => [a, n, '']), SDF.classKind, 'ck'); }
    };
    docEl('sdClassSave').onclick = async () => {
      const course = docEl('sdClassCourse').value, start = docEl('sdClassStart').value, end = docEl('sdClassEnd').value;
      if (!course) return sdErr('sdClassError', 'Pick a subject.');
      if (!start || !end) return sdErr('sdClassError', 'Set the start and end time.');
      if (end <= start) return sdErr('sdClassError', 'The class must end after it starts.');
      const from = docEl('sdClassFrom').value, until = sdClassRange().end, n = +docEl('sdClassCount').value;
      if (!from) return sdErr('sdClassError', 'Pick the date the class starts.');
      if ((SDF.endMode === 'weeks' && !(n >= 1 && n <= 60)) || (SDF.endMode === 'months' && !(n >= 1 && n <= 24))) return sdErr('sdClassError', SDF.endMode === 'weeks' ? 'Enter 1 to 60 weeks.' : 'Enter 1 to 24 months.');
      if (SDF.endMode === 'date' && !until) return sdErr('sdClassError', 'Pick the date the class ends.');
      if (until && until < from) return sdErr('sdClassError', 'The end date must be after the start date.');
      const base = { course_id: course, start_time: start, end_time: end, room: docEl('sdClassRoom').value.trim(), kind: SDF.classKind, start_date: from, end_date: until };
      sdErr('sdClassError', ''); sdBtn('sdClassSave', true);
      let res;
      if (SDF.classId) res = await LumaStudy.classes.update(SDF.classId, { ...base, weekday: [...SDF.days][0] });
      else res = await LumaStudy.classes.addMany([...SDF.days].map(weekday => ({ ...base, weekday })));
      sdBtn('sdClassSave', false, 'Save class');
      if (res.error) return sdErr('sdClassError', sdHint(res.error.message));
      (Array.isArray(res.data) ? res.data : [res.data]).forEach(row => { const i = SD.classes.findIndex(x => x.id === row.id); if (i >= 0) SD.classes[i] = row; else SD.classes.push(row); });
      sdClose('sdClassOverlay'); sdAfterSave();
    };
    docEl('sdClassDelete').onclick = async () => {
      const c = SD.classes.find(x => x.id === SDF.classId); if (!c) return;
      if (!await luConfirm({ title: 'Delete this class?', message: 'It is removed from your timetable every week. This can\'t be undone.' })) return;
      const { error } = await LumaStudy.classes.remove(c.id);
      if (error) return sdErr('sdClassError', error.message);
      SD.classes = SD.classes.filter(x => x !== c); sdClose('sdClassOverlay'); sdAfterSave();
    };

    // --- assignment / test / exam ---
    function openTaskModal(t, pre) {
      const src = t || pre || {};
      SDF.taskId = t ? t.id : null; SDF.taskKind = src.kind || 'assignment'; SDF.taskStatus = t ? t.status : 'todo';
      docEl('sdTaskTitleHd').textContent = t ? 'Edit ' + sdKind(t.kind)[1].toLowerCase() : 'New assignment';
      docEl('sdTaskTitle').value = t ? t.title : ''; sdCourseOptions('sdTaskCourse', src.course_id || (SD.fCourse || null), true);
      docEl('sdTaskDue').value = t && t.due_date ? t.due_date : ''; docEl('sdTaskTime').value = t && t.due_time ? sdHM(t.due_time) : '';
      docEl('sdTaskDue')._luDateRefresh && docEl('sdTaskDue')._luDateRefresh(); docEl('sdTaskTime')._luTimeRefresh && docEl('sdTaskTime')._luTimeRefresh();
      docEl('sdTaskWeight').value = t && t.weight != null ? +t.weight : ''; docEl('sdTaskScore').value = t && t.score != null ? +t.score : ''; docEl('sdTaskMax').value = t && t.max_score != null ? +t.max_score : '';
      docEl('sdTaskNotes').value = t ? t.notes || '' : '';
      docEl('sdTaskDelete').style.display = t ? '' : 'none'; sdErr('sdTaskError', '');
      sdChips('sdTaskKinds', SD_KINDS, SDF.taskKind, 'tk'); sdChips('sdTaskStatus', SD_STATUS.map(([k, n]) => [k, n, '']), SDF.taskStatus, 'ts');
      sdOpen('sdTaskOverlay'); setTimeout(() => docEl('sdTaskTitle').focus(), 50);
    }
    docEl('sdTaskClose').onclick = () => sdClose('sdTaskOverlay');
    docEl('sdTaskOverlay').onclick = e => {
      if (e.target === docEl('sdTaskOverlay')) return sdClose('sdTaskOverlay');
      const k = e.target.closest('[data-tk]'); if (k) { SDF.taskKind = k.dataset.tk; return sdChips('sdTaskKinds', SD_KINDS, SDF.taskKind, 'tk'); }
      const s = e.target.closest('[data-ts]'); if (s) { SDF.taskStatus = s.dataset.ts; sdChips('sdTaskStatus', SD_STATUS.map(([a, n]) => [a, n, '']), SDF.taskStatus, 'ts'); }
    };
    ['sdTaskWeight', 'sdTaskScore', 'sdTaskMax'].forEach(id => docEl(id).addEventListener('input', () => { const c = cleanDecimal(docEl(id).value); if (c !== docEl(id).value) docEl(id).value = c; }));
    docEl('sdTaskTitle').addEventListener('keydown', e => { if (e.key === 'Enter') docEl('sdTaskSave').click(); });
    docEl('sdTaskSave').onclick = async () => {
      const title = docEl('sdTaskTitle').value.trim(), weight = sdNum(docEl('sdTaskWeight').value), score = sdNum(docEl('sdTaskScore').value), max = sdNum(docEl('sdTaskMax').value);
      if (!title) return sdErr('sdTaskError', 'Give it a title.');
      if (Number.isNaN(weight) || (weight != null && (weight < 0 || weight > 100))) return sdErr('sdTaskError', 'Weight is a percentage between 0 and 100.');
      if (Number.isNaN(score) || Number.isNaN(max) || (score != null && score < 0) || (max != null && max <= 0)) return sdErr('sdTaskError', 'Score must be 0 or more, and "Out of" above 0.');
      if (score != null && max == null) return sdErr('sdTaskError', 'Add what the score is out of, e.g. 50.');
      const fields = { title, kind: SDF.taskKind, course_id: docEl('sdTaskCourse').value || null, due_date: docEl('sdTaskDue').value || null, due_time: docEl('sdTaskDue').value ? (docEl('sdTaskTime').value || null) : null, weight, score, max_score: max, status: SDF.taskStatus, notes: docEl('sdTaskNotes').value.trim() };
      sdErr('sdTaskError', ''); sdBtn('sdTaskSave', true);
      const { data, error } = SDF.taskId ? await LumaStudy.tasks.update(SDF.taskId, fields) : await LumaStudy.tasks.add(fields);
      sdBtn('sdTaskSave', false, 'Save');
      if (error) return sdErr('sdTaskError', sdHint(error.message));
      const i = SD.tasks.findIndex(x => x.id === data.id); if (i >= 0) SD.tasks[i] = data; else SD.tasks.push(data);
      sdClose('sdTaskOverlay'); sdAfterSave();
    };
    docEl('sdTaskDelete').onclick = async () => {
      const t = SD.tasks.find(x => x.id === SDF.taskId); if (!t) return;
      if (!await luConfirm({ title: `Delete “${t.title}”?`, message: 'This can\'t be undone.' })) return;
      const { error } = await LumaStudy.tasks.remove(t.id);
      if (error) return sdErr('sdTaskError', error.message);
      SD.tasks = SD.tasks.filter(x => x !== t); sdClose('sdTaskOverlay'); sdAfterSave();
    };

    async function sdToggleDone(id) {
      const t = SD.tasks.find(x => x.id === id); if (!t) return;
      const old = { status: t.status, completed_at: t.completed_at }, status = t.status === 'done' ? 'todo' : 'done';
      t.status = status; sdAfterSave();
      const { data, error } = await LumaStudy.tasks.update(id, { status });
      if (error) { Object.assign(t, old); sdAfterSave(); return luAlert('Could not update: ' + sdHint(error.message)); }
      Object.assign(t, data); sdAfterSave();
      if (status === 'done') flashToast('Done', t.title, 'fa-check', '#22c55e');
    }

    // ---------- calendar: classes repeat every week, assignments show on their due date ----------
    // in Personal mode the person chooses whether Study shows on the Calendar (Settings → Preferences); in Study mode it always does
    const studyVisibleOnCalendar = () => LumaPlan.hasAddon('study') && (LUMA_MODE === 'study' || prefOn('show_study_personal', false));
    function studyCalItems(k) {
      if (!studyVisibleOnCalendar()) return [];
      const out = [];
      if (!cHidden.has('Classes')) SD.classes.filter(c => sdClassOn(c, k)).forEach(c => { const co = sdCourse(c.course_id); out.push({ type: 'sdclass', id: c.id, title: co ? co.name : 'Class', time: sdHM(c.start_time), end: sdHM(c.end_time), color: co ? co.color : '#34d399', cat: 'Classes', label: 'Class' }); });
      if (!cHidden.has('Study')) SD.tasks.filter(t => t.due_date === k && t.status !== 'done').forEach(t => { const co = sdCourse(t.course_id); out.push({ type: 'sdtask', id: t.id, title: t.title, color: co ? co.color : '#a78bfa', cat: 'Study', label: sdKind(t.kind)[1] + ' due' }); });
      return out;
    }
    function sdOpenFromCal(type, id) {
      if (type === 'sdclass') { const c = SD.classes.find(x => x.id === id); if (c) openClassModal(c); }
      else { const t = SD.tasks.find(x => x.id === id); if (t) openTaskModal(t); }
    }

    // ---------- wiring ----------
    WIRE.study = async function (pg) {
      pg.querySelector('#sdTabs').addEventListener('click', e => { const b = e.target.closest('[data-sdtab]'); if (b) { SD.tab = b.dataset.sdtab; sdPaint(); const r = docEl('sdRoot'); if (r) r.scrollTop = 0; } });
      pg.querySelector('#sdAdd').addEventListener('click', () => { if (SD.tab === 'timetable') openClassModal(null); else if (SD.tab === 'subjects') openCourseModal(null); else if (SD.tab === 'semesters') openSemModal(null); else openTaskModal(null); });
      pg.querySelector('#sdRoot').addEventListener('click', e => {
        const chk = e.target.closest('[data-check]'); if (chk) return sdToggleDone(chk.dataset.check);
        const sm = e.target.closest('[data-sem]'); if (sm) return openSemModal(sdSem(sm.dataset.sem));
        const add = e.target.closest('[data-add]'); if (add) return add.dataset.add === 'course' ? openCourseModal(null) : add.dataset.add === 'semester' ? openSemModal(null) : openClassModal(null, add.dataset.day != null ? +add.dataset.day : undefined);
        if (e.target.closest('[data-ended]')) { SD.showEnded = !SD.showEnded; return sdPaint(); }
        const f = e.target.closest('[data-f]'); if (f) { SD.filter = f.dataset.f; return sdPaint(); }
        const fc = e.target.closest('[data-fc]'); if (fc) { SD.fCourse = fc.dataset.fc; return sdPaint(); }
        const cls = e.target.closest('[data-cls]'); if (cls) return openClassModal(SD.classes.find(x => x.id === cls.dataset.cls));
        const row = e.target.closest('[data-task]'); if (row) return openTaskModal(SD.tasks.find(x => x.id === row.dataset.task));
        const co = e.target.closest('[data-course]'); if (co) return openCourseModal(sdCourse(co.dataset.course));
      });
      await sdLoad(); sdPaint();
    };
