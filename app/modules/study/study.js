// LUMA — module: study
    // The Study add-on, version 1: subjects, a weekly timetable, and assignments / tests / exams with due dates, weights and scores.
    // Data helpers: study.data.js (LumaStudy). Tables: supabase/migrations/045_study.sql. Reminders come from the server.
    const SD_COLORS = ['#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#fb923c', '#f87171', '#2dd4bf'];
    const SD_KINDS = [['assignment', 'Assignment', 'fa-file-pen'], ['quiz', 'Quiz', 'fa-circle-question'], ['test', 'Test', 'fa-pen-to-square'], ['exam', 'Exam', 'fa-graduation-cap'], ['project', 'Project', 'fa-diagram-project'], ['other', 'Other', 'fa-ellipsis']];
    const SD_CLASS_KINDS = [['lecture', 'Lecture'], ['tutorial', 'Tutorial'], ['lab', 'Lab'], ['other', 'Other']];
    const SD_STATUS = [['todo', 'To do'], ['in_progress', 'In progress'], ['done', 'Done']];
    const SD_DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']]; // weekday numbers: 0 = Sunday (same as the database)
    const SD_TABS = [['overview', 'Overview', 'fa-table-columns'], ['timetable', 'Timetable', 'fa-calendar-week'], ['assignments', 'Assignments', 'fa-list-check'], ['subjects', 'Subjects', 'fa-book'], ['semesters', 'Semesters', 'fa-calendar-days'], ['notes', 'Notes', 'fa-note-sticky'], ['groups', 'Groups', 'fa-user-group']];
    // grade scale used for letters and GPA points (Malaysian 4.0 scale; marks below the lowest row are F)
    const SD_SCALE_DEFAULT = [[80, 'A', 4.0], [75, 'A-', 3.67], [70, 'B+', 3.33], [65, 'B', 3.0], [60, 'B-', 2.67], [55, 'C+', 2.33], [50, 'C', 2.0], [47, 'C-', 1.67], [44, 'D+', 1.33], [40, 'D', 1.0], [0, 'F', 0]];
    const SD = { semesters: [], courses: [], classes: [], tasks: [], skips: [], breaks: [], focus: [], tab: 'overview', showArchived: false, sel: null, filter: 'open', fCourse: '', showEnded: false, err: null, loadedAt: 0 };

    // what each tab shows and what its Add button does; the Notes and Groups files add their own entries
    const SD_VIEW = {}, SD_CLICK = [], SD_ONSHOW = {}; // SD_ONSHOW: a tab's own loader, run when it is opened
    const SD_ADD = { overview: ['Add assignment', () => sdOpenTaskModal(null)], timetable: ['Add class', () => openClassModal(null)], assignments: ['Add assignment', () => sdOpenTaskModal(null)], subjects: ['Add subject', () => openCourseModal(null)], semesters: ['Add semester', () => openSemModal(null)] };
    // a classmate invited to a group project can use the Groups tab even without the Study add-on of their own
    const sdGuest = () => !LumaPlan.hasAddon('study');

    MODULES.study = function () {
      if (SD.keepTab) SD.keepTab = false; else SD.tab = 'overview'; // opening Study from the menu starts on its first page (Overview); a flow that needs another tab sets keepTab
      if (sdGuest()) SD.tab = 'groups';
      const info = (LumaPlan.addonInfo && LumaPlan.addonInfo.study) || {}, ends = info.expires_at ? new Date(info.expires_at) : null;
      const left = ends ? Math.ceil((ends - Date.now()) / 864e5) : null, note = ends ? ` · ${info.source === 'trial' ? 'free trial' : 'add-on'} until ${new Date(ends - 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} (${left} day${left === 1 ? '' : 's'} left)` : '';
      return head('Study', `<span id="sdSub">Loading…</span>${note}`,
        `<div class="sd-tabs" id="sdTabs">${SD_TABS.filter(t => !sdGuest() || t[0] === 'groups').map(([k, n, i]) => `<button type="button" data-sdtab="${k}" title="${n}" aria-label="${n}" class="${SD.tab === k ? 'on' : ''}"><i class="fa-solid ${i}"></i><span>${n}</span></button>`).join('')}</div><button class="create-btn" id="sdAdd"><i class="fa-solid fa-plus"></i> <span id="sdAddT">Add assignment</span></button>`) +
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
    const sdWeekStartOf = k => sdAdd(k, -((sdDow(k) + 6) % 7)); // the Monday of the week that has day k
    const sdWeekStart = () => sdWeekStartOf(sdKey()); // this week's Monday
    const sdMinText = m => m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '') : m + ' min';
    const sdAddMonths = (k, n) => { const d = new Date(k + 'T00:00:00Z'), day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); return d.toISOString().slice(0, 10); };
    const sdShort = k => sdFmtDate(k, { day: 'numeric', month: 'short' });
    // a class runs on its weekday between its start and end dates (no dates = every week)
    const sdArchived = id => { const co = sdCourse(id); return !!(co && co.archived); };
    const sdSkipped = (c, k) => SD.skips.some(x => x.class_id === c.id && x.skip_date === k);
    const sdInBreak = k => SD.breaks.find(b => k >= b.start_date && k <= b.end_date);
    // does the class happen on day k? (right weekday, inside its dates, not cancelled, not in a break, subject not archived)
    const sdClassOn = (c, k) => c.weekday === sdDow(k) && (!c.start_date || k >= c.start_date) && (!c.end_date || k <= c.end_date) && !sdSkipped(c, k) && !sdInBreak(k) && !sdArchived(c.course_id);
    const sdClassEnded = c => !!c.end_date && c.end_date < sdKey();
    const sdSem = id => SD.semesters.find(x => x.id === id);
    // the grade scale: yours (Semesters → Grade scale) or the common Malaysian 4.0 scale
    const sdValidScale = g => Array.isArray(g) && g.length >= 2 && g.every(r => Array.isArray(r) && r.length === 3);
    const sdAccountScale = () => { const g = LUMA_PROFILE && LUMA_PROFILE.preferences && LUMA_PROFILE.preferences.grade_scale; return sdValidScale(g) ? g : null; };
    // a subject uses its own scale, else its semester's, else yours (Semesters → Grade scale), else the standard one
    const sdScale = c => (c && sdValidScale(c.grade_scale) && c.grade_scale) || (c && c.semester_id && sdSem(c.semester_id) && sdValidScale(sdSem(c.semester_id).grade_scale) && sdSem(c.semester_id).grade_scale) || sdAccountScale() || SD_SCALE_DEFAULT;
    const sdLetter = (p, c) => { const sc = sdScale(c); return sc.find(x => p >= x[0]) || sc[sc.length - 1]; };
    // a subject's mark: the final mark you entered, otherwise worked out from the scores you have so far
    const sdMark = c => c.final_percent != null ? Number(c.final_percent) : sdGrade(c.id);
    // only one semester is active at a time; new Study items go into it (the database does that), and without one nothing new can be added
    const sdActiveSem = () => SD.semesters.find(x => x.is_active && !x.archived_at) || null;
    const sdCurrentSem = sdActiveSem;
    // what belongs to an archived semester or an archived subject stays in the archive, out of the live views
    const sdLiveTask = t => { const c = sdCourse(t.course_id), sem = sdSem(t.semester_id || (c && c.semester_id)); return !(c && c.archived) && !(sem && sem.archived_at); };
    const sdLiveTasks = () => SD.tasks.filter(sdLiveTask);
    async function sdNeedSem() { // true (after offering to open Semesters) when there is no active semester
      if (sdActiveSem()) return false;
      if (await luConfirm({ title: 'No active semester', message: 'Everything you add in Study goes into your active semester. Create one, or activate an existing one, first.', ok: 'Open Semesters', icon: 'fa-calendar-days', tone: 'info' })) { SD.tab = 'semesters'; SD.keepTab = true; goTo('study'); sdPaint(); }
      return true;
    }
    // GPA over a list of subjects: credit-hour weighted; subjects without a mark are left out
    function sdGpa(list) {
      const g = list.map(c => ({ c, m: sdMark(c) })).filter(x => x.m != null);
      if (!g.length) return null;
      const cr = g.filter(x => Number(x.c.credit_hours) > 0), pts = x => sdLetter(x.m, x.c)[2];
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
        const [c, k, t, f, sm, sk, br] = await Promise.all([LumaStudy.courses.list(), LumaStudy.classes.list(), LumaStudy.tasks.list(), LumaStudy.focusSince(new Date(sdWeekStart() + 'T00:00:00').toISOString()), LumaStudy.semesters.list(), LumaStudy.skips.list(), LumaStudy.breaks.list()]);
        const bad = c.error || k.error || t.error;
        SD.err = bad ? bad.message : null;
        if (!bad) { SD.courses = c.data || []; SD.classes = k.data || []; SD.tasks = t.data || []; SD.focus = f.error ? [] : (f.data || []); SD.semesters = sm.error ? [] : (sm.data || []); SD.skips = sk.error ? [] : (sk.data || []); SD.breaks = br.error ? [] : (br.data || []); } // semesters need migration 049: without it the rest still works
      } catch (e) { SD.err = e.message || 'Could not load'; }
      if (typeof LumaSpace !== 'undefined') LumaSpace.setArchived(SD.semesters.filter(x => x.archived_at).map(x => x.id));
      SD.loadedAt = Date.now();
    }
    // other pages (the calendar, Focus Mode) borrow the data: reuse it for a minute
    const sdEnsureLoaded = () => (SD.loadedAt && Date.now() - SD.loadedAt < 60000 && !SD.err) ? Promise.resolve() : sdLoad();

    // ---------- painting ----------
    function sdPaint() {
      const root = docEl('sdRoot'), sub = docEl('sdSub'); if (!root) return;
      document.querySelectorAll('#sdTabs button').forEach(b => b.classList.toggle('on', b.dataset.sdtab === SD.tab));
      const add = SD_ADD[SD.tab]; docEl('sdAdd').style.display = add && (!sdGuest() || SD.tab === 'groups') ? '' : 'none'; if (add) docEl('sdAddT').textContent = add[0];
      if (SD.err && !SD_VIEW[SD.tab]) {
        sub.textContent = 'Could not load';
        root.innerHTML = card(`<div class="ls">Could not load your study data: ${escapeHtml(SD.err)}. ${/study_|schema cache|does not exist/i.test(SD.err) ? 'Has <b>supabase/migrations/045_study.sql</b> been run in the Supabase SQL Editor?' : ''}</div>`);
        return;
      }
      const open = sdLiveTasks().filter(t => t.status !== 'done');
      sub.textContent = SD.courses.length ? `${SD.courses.length} subject${SD.courses.length === 1 ? '' : 's'} · ${open.length} to do` : 'Classes, assignments and exams in one place';
      if (!SD_VIEW[SD.tab] && !SD.courses.length && !sdLiveTasks().length && !SD.semesters.length && SD.tab !== 'semesters') {
        root.innerHTML = card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-graduation-cap"></i></div><div class="h-empty-t">Set up your semester</div>
          <div class="h-empty-s">Start with your subjects, then add your weekly classes and the assignments, tests and exams that are coming. LUMA reminds you before each one is due.</div>
          <div class="h-empty-chips"><button type="button" class="h-chip" data-add="course"><i class="fa-solid fa-plus" style="color:#34d399"></i>Add your first subject</button></div></div>`);
        return;
      }
      const prevScroll = root.querySelector('.tg-scroll'), keepTop = prevScroll && SD.tab === 'timetable' ? prevScroll.scrollTop : null;
      root.innerHTML = (SD_VIEW[SD.tab] || { timetable: sdTimetable, assignments: sdAssignments, subjects: sdSubjects, semesters: sdSemesters }[SD.tab] || sdOverview)();
      if (!sdGuest() && SD.loadedAt && !SD.err && !sdActiveSem() && SD.tab !== 'semesters' && SD.tab !== 'groups') root.insertAdjacentHTML('afterbegin', `<div class="sd-nosem"><i class="fa-solid fa-circle-info"></i><div><b>No active semester</b><span>Everything new you add in Study goes into your active semester. Create one, or activate an existing one, to start adding.</span></div><button type="button" class="confirm-btn save" data-goto-sem>Open Semesters</button></div>`);
      const ttw = root.querySelector('.sd-ttwrap'); if (ttw) { const bar = ttw.querySelector('.tg-scroll'); ttw.style.setProperty('--sbw', (bar.offsetWidth - bar.clientWidth) + 'px'); } // the day names get the scrollbar's width on their right, so their columns line up with the hours below
      const sc = root.querySelector('.tg-scroll'); if (sc) sc.scrollTop = keepTop != null ? keepTop : (SD.ttTop || 7 * SD_H); // the timetable keeps its place when you change week
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
      const open = sdLiveTasks().filter(t => t.status !== 'done');
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
      setTimeout(() => luPaintBusy('sdBusy'), 0);
      return `${sdSemStrip()}<div id="sdBusy" class="wk-busybox" style="display:none"></div><div class="sd-tiles">${tiles}</div><div class="grid-2">
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
      const today = sdDow(sdKey()), live = SD.classes.filter(c => !sdArchived(c.course_id)), ended = live.filter(sdClassEnded), shown = live.filter(c => SD.showEnded || !sdClassEnded(c));
      if (!SD.classes.length) {
        return card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-calendar-week"></i></div><div class="h-empty-t">Build your weekly timetable</div>
          <div class="h-empty-s">${SD.courses.length ? 'Add each class once: pick the subject, the days and the time. It repeats every week and shows on your Calendar too.' : 'Add your subjects first, then put each class on the timetable.'}</div>
          <div class="h-empty-chips"><button type="button" class="h-chip" data-add="${SD.courses.length ? 'class' : 'course'}"><i class="fa-solid fa-plus" style="color:#34d399"></i>${SD.courses.length ? 'Add a class' : 'Add a subject'}</button></div></div>`);
      }
      const listHtml = `<div class="sd-week">${SD_DAYS.map(([d, n]) => {
        const list = shown.filter(c => c.weekday === d).sort((a, b) => sdHM(a.start_time).localeCompare(sdHM(b.start_time)));
        return `<div class="sd-day ${d === today ? 'today' : ''}"><div class="sd-dh"><span>${n}</span><button type="button" data-add="class" data-day="${d}" title="Add a class on ${n}"><i class="fa-solid fa-plus"></i></button></div>${list.length ? list.map(sdClassCard).join('') : '<div class="sd-free">Free</div>'}</div>`;
      }).join('')}</div>`;
      const endedNote = ended.length ? `<div class="sd-endednote"><button type="button" data-ended>${SD.showEnded ? 'Hide' : 'Show'} ended classes (${ended.length})</button></div>` : '';
      const view = sdTtView(), mon = SD.ttWeek || (SD.ttWeek = sdWeekStart()), sem = sdCurrentSem();
      const wkNo = sem && mon >= sdWeekStartOf(sem.start_date) && mon <= sem.end_date ? ` · ${sem.name}, week ${Math.floor(sdDiff(sdWeekStartOf(sem.start_date), mon) / 7) + 1} of ${Math.ceil((sdDiff(sem.start_date, sem.end_date) + 1) / 7)}` : '';
      const nav = view === 'grid' ? `<div class="sd-ttnav"><button type="button" data-ttw="prev" title="Previous week"><i class="fa-solid fa-chevron-left"></i></button><button type="button" data-ttw="today" class="td">Today</button><button type="button" data-ttw="next" title="Next week"><i class="fa-solid fa-chevron-right"></i></button><span class="lb">${sdShort(mon)} to ${sdFmtDate(sdAdd(mon, 6), { day: 'numeric', month: 'short', year: 'numeric' })}${wkNo}</span></div>` : '<span></span>';
      const toggle = `<div class="sd-tt-top">${nav}${window.innerWidth < 900 ? '' : `<div class="sd-seg"><button type="button" data-tt="grid" class="${view === 'grid' ? 'on' : ''}"><i class="fa-solid fa-table-cells"></i> Week</button><button type="button" data-tt="list" class="${view === 'list' ? 'on' : ''}"><i class="fa-solid fa-list"></i> List</button></div>`}</div>`;
      return toggle + (view === 'grid' ? sdGrid() : listHtml + endedNote);
    }

    // the timetable as a calendar-style week: real dates, a full 24-hour day you scroll (classes can run into the night), blocks sized by class length.
    // It shows what actually happens on each date: classes outside their start / end dates, in a break or in an archived subject are left out, cancelled sessions are marked.
    const SD_H = 52; // pixels per hour (same as the Calendar)
    function sdLayout(arr) { // classes that overlap in time share the column side by side
      const out = []; let cluster = [], end = -1;
      const flush = () => { const lanes = []; cluster.forEach(it => { let l = lanes.findIndex(e => e <= it.s); if (l < 0) { l = lanes.length; lanes.push(0); } lanes[l] = it.e; it.lane = l; }); cluster.forEach(it => { it.lanes = lanes.length; }); out.push(...cluster); cluster = []; end = -1; };
      arr.forEach(it => { if (cluster.length && it.s >= end) flush(); cluster.push(it); end = Math.max(end, it.e); }); if (cluster.length) flush(); return out;
    }
    function sdGrid() {
      const H = SD_H, today = sdKey(), mon = SD.ttWeek || (SD.ttWeek = sdWeekStart()), ds = Array.from({ length: 7 }, (_, i) => sdAdd(mon, i)), nowM = sdNowMin();
      const live = SD.classes.filter(c => !sdArchived(c.course_id)); let first = 1440;
      const hr12 = h => h === 0 ? '12 am' : h < 12 ? h + ' am' : h === 12 ? '12 pm' : (h - 12) + ' pm';
      const cols = ds.map(k => {
        const brk = sdInBreak(k);
        const items = live.filter(c => c.weekday === sdDow(k) && (!c.start_date || k >= c.start_date) && (!c.end_date || k <= c.end_date) && !brk).map(c => ({ c, cancelled: sdSkipped(c, k), s: sdMin(c.start_time), e: Math.max(sdMin(c.end_time), sdMin(c.start_time) + 25) })).sort((a, b) => a.s - b.s || b.e - a.e);
        items.forEach(it => { first = Math.min(first, it.s); });
        const blocks = sdLayout(items).map(({ c, cancelled, s: a, e: z, lane, lanes }) => { const co = sdCourse(c.course_id), h = Math.max(20, (z - a) / 60 * H - 2), w = 100 / lanes;
          return `<div class="tg-ev ${h < 36 ? 'tiny' : ''} ${cancelled ? 'cancelled' : ''}" data-cls="${c.id}" data-d="${k}" title="${escapeHtml(co ? co.name : 'Class')} · ${sdT12(c.start_time)} – ${sdT12(c.end_time)}${c.room ? ' · ' + escapeHtml(c.room) : ''}${cancelled ? ' · cancelled' : ''}" style="top:${a / 60 * H}px;height:${h}px;left:calc(${lane * w}% + 2px);width:calc(${w}% - 4px);--ic:${co ? co.color : '#34d399'}"><div class="t">${escapeHtml(co ? co.name : 'Class')}</div><div class="m">${sdT12(c.start_time)} – ${sdT12(c.end_time)}${c.room ? ' · ' + escapeHtml(c.room) : ''}${cancelled ? ' · cancelled' : ''}</div></div>`; }).join('');
        return `<div class="tg-col ${brk ? 'sd-brkcol' : ''}" data-d="${k}" data-wd="${sdDow(k)}" ${brk ? `title="${escapeHtml(brk.name)}"` : ''}>${blocks}${k === today ? `<div class="tg-now" style="top:${nowM / 60 * H}px"></div>` : ''}</div>`;
      }).join('');
      const head = ds.map(k => `<div class="tg-dh ${k === today ? 'today' : ''}"><span class="dn">${+k.slice(8)}</span><span class="dw">${sdFmtDate(k, { weekday: 'short' })}</span>${sdInBreak(k) ? `<span class="sd-brk-tag" title="${escapeHtml(sdInBreak(k).name)}">Break</span>` : ''}</div>`).join('');
      const labels = Array.from({ length: 24 }, (_, h) => `<div class="tg-hl" style="top:${h * H}px">${hr12(h)}</div>`).join('');
      SD.ttTop = first < 1440 ? Math.max(0, first / 60 * H - 24) : 7 * H; // open near the first class of the week, otherwise around 7 am
      return `<div class="sd-ttwrap"><div class="cal-tg" style="--n:7"><div class="tg-top"><div class="tg-row"><div class="tg-corner"><b>GMT</b><span>${tzOffsetLabel().replace('GMT', '')}</span></div>${head}</div></div>`
        + `<div class="tg-scroll"><div class="tg-row tg-body" style="height:${24 * H}px"><div class="tg-hours">${labels}</div>${cols}</div></div></div></div>`;
    }
    const sdTtView = () => { if (window.innerWidth < 900) return 'list'; try { return localStorage.getItem('luma_tt_view') || 'grid'; } catch (e) { return 'grid'; } };

    function sdAssignments() {
      const today = sdKey();
      const chips = `<div class="sd-filters"><div class="sd-seg">${[['open', 'To do'], ['done', 'Done'], ['all', 'All']].map(([k, n]) => `<button type="button" data-f="${k}" class="${SD.filter === k ? 'on' : ''}">${n}</button>`).join('')}</div>
        <div class="sd-subj"><button type="button" data-fc="" class="${SD.fCourse === '' ? 'on' : ''}">All subjects</button>${SD.courses.map(c => `<button type="button" data-fc="${c.id}" class="${SD.fCourse === c.id ? 'on' : ''}" style="--c:${c.color}"><i></i>${escapeHtml(c.name)}</button>`).join('')}</div></div>`;
      let list = sdLiveTasks().filter(t => (!SD.fCourse || t.course_id === SD.fCourse) && (SD.filter === 'all' || (SD.filter === 'done') === (t.status === 'done')));
      if (!list.length) return chips + card(`<div class="ls" style="padding:10px 2px">${sdLiveTasks().length ? 'Nothing here with these filters.' : 'No assignments yet. Tap <b>Add assignment</b> to track your first one.'}</div>`);
      const byDue = (a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || sdHM(a.due_time).localeCompare(sdHM(b.due_time));
      if (SD.filter !== 'open') return chips + card(list.sort((a, b) => byDue(b, a)).map(sdRow).join(''));
      const groups = [['Overdue', t => t.due_date && t.due_date < today], ['Next 7 days', t => t.due_date && t.due_date >= today && sdDiff(today, t.due_date) <= 7], ['Later', t => t.due_date && sdDiff(today, t.due_date) > 7], ['No due date', t => !t.due_date]];
      return chips + groups.map(([n, f]) => { const g = list.filter(f).sort(byDue); return g.length ? card(`<div class="section-title">${n} <span class="sd-count">${g.length}</span></div>${g.map(sdRow).join('')}`) : ''; }).join('');
    }

    function sdCourseCard(c) {
      const m = sdMark(c), open = SD.tasks.filter(t => t.course_id === c.id && t.status !== 'done').length, n = SD.classes.filter(x => x.course_id === c.id && !sdClassEnded(x)).length;
      const mins = SD.focus.filter(r => r.course_id === c.id).reduce((a, r) => a + r.minutes, 0), L = m != null ? sdLetter(m, c) : null, need = c.final_percent != null || c.archived ? null : sdNeeded(c);
      return `<div class="card sd-course ${c.archived ? 'arch' : ''} ${SD.sel && SD.sel.has(c.id) ? 'picked' : ''}" data-course="${c.id}" style="--c:${c.color}"><div class="sc-top">${SD.sel ? `<span class="sc-pick"><i class="fa-solid fa-check"></i></span>` : ''}<span class="sc-dot"></span><div class="sc-main"><div class="sc-t">${escapeHtml(c.name)}${c.archived ? '<em class="sc-arch">Archived</em>' : ''}</div><div class="sc-s">${[c.code, c.lecturer, c.credit_hours != null ? c.credit_hours + ' credit hour' + (c.credit_hours === 1 ? '' : 's') : ''].filter(Boolean).map(escapeHtml).join(' · ') || 'Tap to add details'}</div></div><button type="button" class="hedit" title="Edit"><i class="fa-solid fa-pen"></i></button></div>
        <div class="sc-stats"><div><b>${m == null ? '—' : sdPct(m) + '%'}${L ? `<em>${L[1]}</em>` : ''}</b><span>${c.final_percent != null ? 'Final mark' : 'Grade so far'}</span></div><div><b>${open}</b><span>To do</span></div><div><b>${n}</b><span>Classes / week</span></div><div><b>${mins ? sdMinText(mins) : '—'}</b><span>This week</span></div></div>
        ${need ? `<div class="sc-need ${need.cls}"><i class="fa-solid fa-bullseye"></i>${need.text}</div>` : ''}</div>`;
    }
    function sdSubjects() {
      const archived = SD.courses.filter(c => c.archived), list = SD.courses.filter(c => SD.showArchived || !c.archived);
      const nA = SD.sel ? [...SD.sel].filter(id => sdCourse(id) && !sdCourse(id).archived).length : 0, nR = SD.sel ? [...SD.sel].filter(id => sdCourse(id) && sdCourse(id).archived).length : 0;
      const bar = !SD.courses.length ? '' : `<div class="sd-toolbar">${SD.sel ? `<span class="lb">${SD.sel.size} selected</span><button type="button" class="np-btn" data-sel-all>Select all</button><button type="button" class="np-btn" data-sel-archive ${nA ? '' : 'disabled'}><i class="fa-solid fa-box-archive"></i> Archive (${nA})</button>${SD.showArchived || nR ? `<button type="button" class="np-btn" data-sel-restore ${nR ? '' : 'disabled'}><i class="fa-solid fa-rotate-left"></i> Restore (${nR})</button>` : ''}<button type="button" class="np-btn" data-sel-cancel>Done</button>` : '<button type="button" class="np-btn" data-sel-start><i class="fa-regular fa-square-check"></i> Select</button>'}</div>`;
      const tail = archived.length ? `<div class="sd-endednote"><button type="button" data-archived>${SD.showArchived ? 'Hide' : 'Show'} archived subjects (${archived.length})</button></div>` : '';
      return bar + sdSubjectsList(list) + tail;
    }
    function sdSubjectsList(courses) {
      if (!courses.length) return card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-book"></i></div><div class="h-empty-t">No subjects yet</div><div class="h-empty-s">A subject groups its classes, assignments, grades and study time.</div><div class="h-empty-chips"><button type="button" class="h-chip" data-add="course"><i class="fa-solid fa-plus" style="color:#34d399"></i>Add a subject</button></div></div>`);
      if (!SD.semesters.length) return `<div class="grid-2">${courses.map(sdCourseCard).join('')}</div>`;
      const cur = sdCurrentSem(), order = [...SD.semesters].sort((a, b) => (a === cur ? -1 : b === cur ? 1 : b.start_date.localeCompare(a.start_date)));
      const groups = order.map(sem => [sem, courses.filter(c => c.semester_id === sem.id)]).filter(([, l]) => l.length);
      const none = courses.filter(c => !c.semester_id || !sdSem(c.semester_id)); if (none.length) groups.push([null, none]);
      return groups.map(([sem, list]) => { const g = sdGpa(list); return `<div class="sd-gh"><b>${sem ? escapeHtml(sem.name) : 'No semester'}</b>${sem && sem === cur ? '<em>Current</em>' : ''}${g ? `<span>GPA ${g.gpa.toFixed(2)}</span>` : ''}</div><div class="grid-2" style="margin-bottom:16px">${list.map(sdCourseCard).join('')}</div>`; }).join('');
    }

    // ---------- semesters: the planner, GPA and CGPA ----------
    function sdSemesters() {
      const toolbar = `<div class="sd-toolbar"><button type="button" class="np-btn" data-scale><i class="fa-solid fa-sliders"></i> Grade scale</button><button type="button" class="np-btn" data-breaks><i class="fa-solid fa-umbrella-beach"></i> Breaks &amp; holidays${SD.breaks.length ? ' (' + SD.breaks.length + ')' : ''}</button></div>`;
      return toolbar + sdSemestersBody();
    }
    function sdSemestersBody() {
      if (!SD.semesters.length) return card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-calendar-days"></i></div><div class="h-empty-t">Plan your semesters</div>
        <div class="h-empty-s">Add a semester with its first and last day. LUMA shows which week you are in, fills in the end date of your timetable classes, and works out your GPA when you put your subjects in it.</div>
        <div class="h-empty-chips"><button type="button" class="h-chip" data-add="semester"><i class="fa-solid fa-plus" style="color:#34d399"></i>Add a semester</button></div></div>`);
      const cur = sdCurrentSem(), all = sdGpa(SD.courses), t = sdKey();
      const explain = `<div class="sd-nosem info"><i class="fa-solid fa-circle-info"></i><div><b>${cur ? 'Active: ' + escapeHtml(cur.name) : 'No active semester'}</b><span>Only one semester is active at a time. New subjects, notes, group projects, classes and reminders go into the active one. To work in another, archive the active semester first (Done with this semester).</span></div></div>`;
      const archivedSems = SD.semesters.filter(x => x.archived_at), order = SD.semesters.filter(x => !x.archived_at).sort((a, b) => b.start_date.localeCompare(a.start_date));
      const head = `<div class="sd-tiles" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="sd-tile" style="--c:#34d399"><i class="fa-solid fa-award"></i><div><b>${all ? all.gpa.toFixed(2) : '—'}</b><span>CGPA (all semesters)</span></div></div>
        <div class="sd-tile" style="--c:#60a5fa"><i class="fa-solid fa-book"></i><div><b>${SD.courses.length}</b><span>Subjects</span></div></div>
        <div class="sd-tile" style="--c:#a78bfa"><i class="fa-solid fa-layer-group"></i><div><b>${all ? all.credits : 0}</b><span>Credit hours graded</span></div></div></div>`;
      const cards = order.map(sem => {
        const list = SD.courses.filter(c => c.semester_id === sem.id), g = sdGpa(list), total = Math.ceil((sdDiff(sem.start_date, sem.end_date) + 1) / 7);
        const state = t > sem.end_date ? 'Ended' : t < sem.start_date ? `Starts in ${sdDiff(t, sem.start_date)} days` : `Week ${Math.min(total, Math.floor(sdDiff(sem.start_date, t) / 7) + 1)} of ${total}`;
        return `<div class="card sd-sem ${sem.is_active ? 'cur' : ''}" data-sem="${sem.id}"><div class="sm-top"><div class="sm-main"><div class="sm-t">${escapeHtml(sem.name)}${sem.is_active ? '<em>Active</em>' : '<em class="off">Inactive</em>'}</div><div class="sm-s">${sdShort(sem.start_date)} to ${sdShort(sem.end_date)} · ${total} weeks · ${state}</div></div><div class="sm-gpa"><b>${g ? g.gpa.toFixed(2) : '—'}</b><span>GPA</span></div><button type="button" class="hedit" title="Edit"><i class="fa-solid fa-pen"></i></button></div>
          <div class="sm-done">${sem.is_active ? `<button type="button" class="np-btn" data-copy-sem="${sem.id}"><i class="fa-regular fa-copy"></i> Start from a previous semester</button><button type="button" class="np-btn" data-finish-sem="${sem.id}"><i class="fa-solid fa-box-archive"></i> Done with this semester</button>` : cur ? `<button type="button" class="np-btn" disabled title="Archive ${escapeHtml(cur.name)} first: only one semester can be active"><i class="fa-solid fa-lock"></i> Activate (archive ${escapeHtml(cur.name)} first)</button>` : `<button type="button" class="np-btn act" data-activate-sem="${sem.id}"><i class="fa-solid fa-bolt"></i> Make this the active semester</button>`}</div>
          <div class="sm-subj">${list.length ? list.map(c => { const m = sdMark(c); return `<span class="sd-cc" style="--c:${c.color}"><i></i>${escapeHtml(c.name)}${m != null ? ` <b>${sdLetter(m, c)[1]}</b>` : ''}</span>`; }).join('') : '<span class="ls">No subjects in this semester yet. New subjects you add go into the active semester.</span>'}</div></div>`;
      }).join('');
      const tail = archivedSems.length ? `<div class="sd-endednote"><button type="button" data-open-archive>Archived semesters (${archivedSems.length}) · open the archive</button></div>` : '';
      return explain + head + (cards || card('<div class="ls" style="padding:6px 2px">All your semesters are archived. Add a new one to plan the next.</div>')) + tail;
    }

    // ---------- the three popups ----------
    const SDF = { courseId: null, color: SD_COLORS[0], classId: null, days: new Set(), classKind: 'lecture', endMode: 'weeks', taskId: null, taskKind: 'assignment', taskStatus: 'todo' };
    const sdOpen = id => { const o = docEl(id); o.classList.add('open'); o.querySelectorAll('.pem-body').forEach(el => { el.scrollTop = 0; }); };
    const sdClose = id => docEl(id).classList.remove('open');
    const sdChips = (id, list, cur, attr) => { docEl(id).innerHTML = list.map(([k, n, i]) => `<button type="button" class="h-chip sm ${k === cur ? 'on' : ''}" data-${attr}="${k}">${i ? `<i class="fa-solid ${i}"></i>` : ''}${n}</button>`).join(''); };
    const sdAfterSave = () => { sdPaint(); if (typeof saPaint === 'function') saPaint(); const cal = document.getElementById('page-calendar'); if (cal && cal.classList.contains('active') && typeof paintCalendar === 'function') paintCalendar(); };
    const sdBtn = (id, busy, label) => { const b = docEl(id); b.disabled = busy; b.textContent = busy ? 'Saving…' : label; };
    const sdHint = m => /study_|schema cache|does not exist/i.test(m) ? 'Study isn\'t set up yet — run supabase/migrations/045_study.sql in the SQL Editor.' : /row-level security|violates/i.test(m) ? 'Your Study add-on isn\'t active, so changes can\'t be saved.' : m;
    function sdCourseOptions(selId, cur, none) {
      const sel = docEl(selId);
      sel.innerHTML = (none ? '<option value="">No subject</option>' : '') + SD.courses.filter(c => !c.archived || c.id === cur).map(c => `<option value="${c.id}">${escapeHtml(c.name)}${c.code ? ' (' + escapeHtml(c.code) + ')' : ''}</option>`).join('');
      sel.value = cur && sdCourse(cur) ? cur : (none ? '' : (SD.courses.find(c => !c.archived) || {}).id || '');
      skinSelect(sel);
    }

    // --- subject ---
    function sdPaintColors() { docEl('sdCourseColors').innerHTML = SD_COLORS.map(c => `<button type="button" class="sd-sw ${c === SDF.color ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join(''); }
    function sdPaintCourseStatus() { sdChips('sdCourseStatus', [['active', 'Active', 'fa-circle-check'], ['archived', 'Archived', 'fa-box-archive']], SDF.archived ? 'archived' : 'active', 'cs'); }
    function openCourseModal(c) {
      if (!c && !sdActiveSem()) { sdNeedSem(); return; }
      SDF.courseId = c ? c.id : null; SDF.color = c ? c.color : SD_COLORS[SD.courses.length % SD_COLORS.length]; SDF.archived = !!(c && c.archived);
      docEl('sdCourseTitle').textContent = c ? 'Edit subject' : 'New subject';
      docEl('sdCourseName').value = c ? c.name : ''; docEl('sdCourseCode').value = c ? c.code || '' : ''; docEl('sdCourseLecturer').value = c ? c.lecturer || '' : ''; docEl('sdCourseCredits').value = c && c.credit_hours != null ? c.credit_hours : '';
      const own = c && c.semester_id ? sdSem(c.semester_id) : null, semTxt = c ? (own ? own.name + (own.archived_at ? ' (archived)' : '') : 'No semester') : ((sdActiveSem() || {}).name || 'No active semester');
      const sc = docEl('sdCourseSemTxt'), semObj = c ? own : sdActiveSem();
      sc.classList.toggle('none', !semObj);
      sc.innerHTML = `<i class="fa-solid fa-calendar-days"></i><span class="nm">${escapeHtml(semObj ? semObj.name : semTxt)}</span>${semObj ? `<span class="tg ${semObj.archived_at ? 'off' : semObj.is_active ? '' : 'idle'}">${semObj.archived_at ? 'Archived' : semObj.is_active ? 'Active' : 'Inactive'}</span>` : ''}${!c && semObj ? '<small>New subjects go into your active semester.</small>' : ''}`;
      docEl('sdCourseTarget').value = c && c.target_percent != null ? +c.target_percent : ''; docEl('sdCourseFinal').value = c && c.final_percent != null ? +c.final_percent : '';
      docEl('sdCourseDelete').style.display = c ? '' : 'none'; sdErr('sdCourseError', ''); sdPaintColors(); sdPaintCourseStatus();
      sdOpen('sdCourseOverlay'); setTimeout(() => docEl('sdCourseName').focus(), 50);
    }
    docEl('sdCourseClose').onclick = () => sdClose('sdCourseOverlay');
    docEl('sdCourseOverlay').onclick = e => { if (e.target === docEl('sdCourseOverlay')) return sdClose('sdCourseOverlay'); const b = e.target.closest('[data-color]'); if (b) { SDF.color = b.dataset.color; sdPaintColors(); } const st = e.target.closest('[data-cs]'); if (st) { SDF.archived = st.dataset.cs === 'archived'; sdPaintCourseStatus(); } };
    ['sdCourseTarget', 'sdCourseFinal'].forEach(id => docEl(id).addEventListener('input', () => { const v = cleanDecimal(docEl(id).value); if (v !== docEl(id).value) docEl(id).value = v; }));
    docEl('sdCourseCredits').addEventListener('input', () => { docEl('sdCourseCredits').value = docEl('sdCourseCredits').value.replace(/\D/g, ''); });
    docEl('sdCourseName').addEventListener('keydown', e => { if (e.key === 'Enter') docEl('sdCourseSave').click(); });
    docEl('sdCourseSave').onclick = async () => {
      const name = docEl('sdCourseName').value.trim(), cr = docEl('sdCourseCredits').value.trim();
      if (!name) return sdErr('sdCourseError', 'Give the subject a name.');
      if (cr !== '' && +cr > 30) return sdErr('sdCourseError', 'Credit hours should be between 0 and 30.');
      const target = sdNum(docEl('sdCourseTarget').value), fin = sdNum(docEl('sdCourseFinal').value);
      if (Number.isNaN(target) || (target != null && (target < 0 || target > 100)) || Number.isNaN(fin) || (fin != null && (fin < 0 || fin > 100))) return sdErr('sdCourseError', 'Marks are percentages between 0 and 100.');
      const fields = { name, code: docEl('sdCourseCode').value.trim(), lecturer: docEl('sdCourseLecturer').value.trim(), credit_hours: cr === '' ? null : +cr, color: SDF.color, target_percent: target, final_percent: fin, archived: SDF.archived };
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
    function sdPaintSemActive() {
      const other = sdActiveSem();
      sdChips('sdSemActive', [['yes', 'Yes, make it active', 'fa-bolt'], ['no', 'Not yet', 'fa-clock']], SDF.semActive ? 'yes' : 'no', 'sa');
      docEl('sdSemActiveHint').textContent = other ? `“${other.name}” is the active semester now. Archive it first, then you can activate another.` : 'The active semester receives everything you add in Study.';
      docEl('sdSemActive').querySelectorAll('button').forEach(b => { if (other && b.dataset.sa === 'yes') { b.disabled = true; b.style.opacity = 0.45; } });
    }
    function openSemModal(m) {
      SDF.semId = m ? m.id : null; docEl('sdSemTitle').textContent = m ? 'Edit semester' : 'New semester';
      docEl('sdSemName').value = m ? m.name : ''; docEl('sdSemStart').value = m ? m.start_date : sdKey(); docEl('sdSemEnd').value = m ? m.end_date : sdAdd(sdKey(), 14 * 7 - 1);
      ['sdSemStart', 'sdSemEnd'].forEach(id => docEl(id)._luDateRefresh && docEl(id)._luDateRefresh());
      SDF.semActive = !m && !sdActiveSem(); docEl('sdSemActiveField').style.display = m ? 'none' : ''; sdPaintSemActive();
      docEl('sdSemDelete').style.display = m ? '' : 'none'; sdErr('sdSemError', ''); sdSemHint(); sdOpen('sdSemOverlay'); setTimeout(() => docEl('sdSemName').focus(), 50);
    }
    docEl('sdSemClose').onclick = () => sdClose('sdSemOverlay');
    docEl('sdSemOverlay').onclick = e => { if (e.target === docEl('sdSemOverlay')) sdClose('sdSemOverlay'); const a = e.target.closest('[data-sa]'); if (a && !a.disabled) { SDF.semActive = a.dataset.sa === 'yes'; sdPaintSemActive(); } };
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
      if (!SDF.semId && SDF.semActive) { const a = await LumaStudy.semesters.activate(data.id); if (a.error) { sdClose('sdSemOverlay'); sdAfterSave(); return luAlert('The semester was created, but it could not be activated: ' + a.error.message); } await sdLoad(); }
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
    function openClassModal(c, day, startTime) {
      if (!c && !sdActiveSem()) { sdNeedSem(); return; }
      if (!SD.courses.length) { openCourseModal(null); return flashToast('Add a subject first', 'Then you can put its classes on the timetable', 'fa-book', '#34d399'); }
      SDF.classId = c ? c.id : null; SDF.days = new Set(c ? [c.weekday] : [day != null ? day : (sdDow(sdKey()) || 1)]); SDF.classKind = c ? c.kind : 'lecture';
      docEl('sdClassTitle').textContent = c ? 'Edit class' : 'New class'; docEl('sdClassDaysLbl').textContent = c ? 'Day' : 'Days (pick every day it happens)';
      sdCourseOptions('sdClassCourse', c ? c.course_id : null, false);
      const hh = startTime ? +startTime.slice(0, 2) : 9;
      docEl('sdClassStart').value = c ? sdHM(c.start_time) : startTime || '09:00'; docEl('sdClassEnd').value = c ? sdHM(c.end_time) : String(Math.min(23, hh + 1)).padStart(2, '0') + ':' + (startTime ? startTime.slice(3, 5) : '00');
      ['sdClassStart', 'sdClassEnd'].forEach(id => docEl(id)._luTimeRefresh && docEl(id)._luTimeRefresh());
      docEl('sdClassRoom').value = c ? c.room || '' : '';
      docEl('sdClassFrom').value = c && c.start_date ? c.start_date : sdKey(); docEl('sdClassUntil').value = c && c.end_date ? c.end_date : '';
      SDF.endMode = c ? (c.end_date ? 'date' : 'none') : 'weeks'; docEl('sdClassCount').value = c ? '' : '14';
      ['sdClassFrom', 'sdClassUntil'].forEach(id => docEl(id)._luDateRefresh && docEl(id)._luDateRefresh());
      sdPaintEnd();
      docEl('sdClassDelete').style.display = c ? '' : 'none'; sdErr('sdClassError', '');
      docEl('sdClassSkipsField').style.display = c ? '' : 'none';
      if (c) { let k = sdKey(); for (let i = 0; i < 7 && sdDow(k) !== c.weekday; i++) k = sdAdd(k, 1); docEl('sdClassSkipDate').value = k; docEl('sdClassSkipDate')._luDateRefresh && docEl('sdClassSkipDate')._luDateRefresh(); sdPaintClassSkips(); }
      if (!c) sdApplySemToClass();
      sdPaintDays(); sdChips('sdClassKinds', SD_CLASS_KINDS.map(([k, n]) => [k, n, '']), SDF.classKind, 'ck');
      sdOpen('sdClassOverlay');
    }
    // single sessions you cancelled (holiday, lecturer away): the class stays, only that date is skipped
    function sdPaintClassSkips() {
      docEl('sdClassSkips').innerHTML = SD.skips.filter(x => x.class_id === SDF.classId).sort((a, b) => a.skip_date.localeCompare(b.skip_date)).map(x => `<span class="cal-gchip"><i class="fa-solid fa-ban" style="font-size:0.6rem;color:#fca5a5"></i>${sdFmtDate(x.skip_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}<button type="button" data-skip-del="${x.id}" aria-label="Bring this class back"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
    }
    docEl('sdClassSkips').onclick = async e => {
      const b = e.target.closest('[data-skip-del]'); if (!b) return;
      const { error } = await LumaStudy.skips.remove(b.dataset.skipDel); if (error) return sdErr('sdClassError', error.message);
      SD.skips = SD.skips.filter(x => x.id !== b.dataset.skipDel); sdPaintClassSkips(); sdAfterSave();
    };
    docEl('sdClassSkipAdd').onclick = async () => {
      const c = SD.classes.find(x => x.id === SDF.classId), d = docEl('sdClassSkipDate').value; if (!c) return;
      if (!d) return sdErr('sdClassError', 'Pick the date to cancel.');
      if (sdDow(d) !== c.weekday) return sdErr('sdClassError', `That date is a ${sdFmtDate(d, { weekday: 'long' })}; this class is on ${(SD_DAYS.find(x => x[0] === c.weekday) || [])[1]}.`);
      if (SD.skips.some(x => x.class_id === c.id && x.skip_date === d)) return sdErr('sdClassError', 'That date is already cancelled.');
      sdErr('sdClassError', '');
      const { data, error } = await LumaStudy.skips.add({ class_id: c.id, skip_date: d });
      if (error) return sdErr('sdClassError', /study_class_skips|schema cache|does not exist/i.test(error.message) ? 'Cancelled dates aren\'t set up yet — run supabase/migrations/052_study_extras.sql.' : sdHint(error.message));
      SD.skips.push(data); sdPaintClassSkips(); sdAfterSave();
    };
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
    const sdTimeOf = iso => new Intl.DateTimeFormat('en-GB', { timeZone: MYT, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
    // a date and time on your clock (your time zone) → the exact moment, as the database wants it
    function sdLocalToIso(k, hm) {
      const [h, m] = hm.split(':').map(Number), t = Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10), h, m);
      const off = ts => { const p = new Intl.DateTimeFormat('en-US', { timeZone: MYT, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ts)), g = x => +p.find(y => y.type === x).value; return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - ts; };
      let guess = t - off(t); guess = t - off(guess); return new Date(guess).toISOString();
    }
    function sdOpenTaskModal(t, pre) {
      if (!t && !sdActiveSem()) { sdNeedSem(); return; }
      const src = t || pre || {};
      SDF.taskId = t ? t.id : null; SDF.taskKind = src.kind || 'assignment'; SDF.taskStatus = t ? t.status : 'todo';
      docEl('sdTaskTitleHd').textContent = t ? 'Edit ' + sdKind(t.kind)[1].toLowerCase() : 'New assignment';
      docEl('sdTaskTitle').value = t ? t.title : ''; sdCourseOptions('sdTaskCourse', src.course_id || (SD.fCourse || null), true);
      docEl('sdTaskDue').value = t && t.due_date ? t.due_date : ''; docEl('sdTaskTime').value = t && t.due_time ? sdHM(t.due_time) : '';
      docEl('sdTaskDue')._luDateRefresh && docEl('sdTaskDue')._luDateRefresh(); docEl('sdTaskTime')._luTimeRefresh && docEl('sdTaskTime')._luTimeRefresh();
      docEl('sdTaskWeight').value = t && t.weight != null ? +t.weight : ''; docEl('sdTaskScore').value = t && t.score != null ? +t.score : ''; docEl('sdTaskMax').value = t && t.max_score != null ? +t.max_score : '';
      docEl('sdTaskNotes').value = t ? t.notes || '' : '';
      SDF.remindWas = t && t.remind_at ? t.remind_at : null;
      docEl('sdTaskRemDate').value = t && t.remind_at ? mytDayKey(t.remind_at) : ''; docEl('sdTaskRemTime').value = t && t.remind_at ? sdTimeOf(t.remind_at) : '';
      ['sdTaskRemDate'].forEach(id => docEl(id)._luDateRefresh && docEl(id)._luDateRefresh()); docEl('sdTaskRemTime')._luTimeRefresh && docEl('sdTaskRemTime')._luTimeRefresh();
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
      const rd = docEl('sdTaskRemDate').value, rt = docEl('sdTaskRemTime').value || '09:00';
      let remindAt = null; if (rd) { remindAt = sdLocalToIso(rd, rt); if (remindAt !== SDF.remindWas && Date.parse(remindAt) <= Date.now()) return sdErr('sdTaskError', 'Pick a reminder time in the future.'); }
      else if (docEl('sdTaskRemTime').value) return sdErr('sdTaskError', 'Pick the date of the extra reminder too.');
      const fields = { title, kind: SDF.taskKind, course_id: docEl('sdTaskCourse').value || null, due_date: docEl('sdTaskDue').value || null, due_time: docEl('sdTaskDue').value ? (docEl('sdTaskTime').value || null) : null, weight, score, max_score: max, status: SDF.taskStatus, notes: docEl('sdTaskNotes').value.trim(), remind_at: remindAt, ...(remindAt !== SDF.remindWas ? { reminded_at: null } : {}) };
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

    // --- grade scale ---
    let SC_ROWS = [];
    function paintScaleRows() { docEl('sdScaleRows').innerHTML = SC_ROWS.map((r, i) => `<div class="sd-scale-r" data-i="${i}"><input type="text" inputmode="decimal" data-k="0" value="${escapeHtml(String(r[0]))}" aria-label="From %"><input type="text" maxlength="12" data-k="1" value="${escapeHtml(String(r[1]))}" aria-label="Letter"><input type="text" inputmode="decimal" data-k="2" value="${escapeHtml(String(r[2]))}" aria-label="GPA points"><button type="button" data-del="${i}" title="Remove this row" aria-label="Remove this row"><i class="fa-regular fa-trash-can"></i></button></div>`).join(''); }
    let SC_TARGET = 'account';
    function sdScaleTargets() { // account-wide, each semester, each (current) subject
      return [['account', 'Everything (my default)'], ...SD.semesters.filter(x => !x.archived_at || true).sort((a, b) => b.start_date.localeCompare(a.start_date)).map(x => ['sem:' + x.id, 'Semester: ' + x.name]), ...SD.courses.filter(c => !c.archived).map(c => ['course:' + c.id, 'Subject: ' + c.name])];
    }
    const sdScaleOf = t => t === 'account' ? sdAccountScale() : t.startsWith('sem:') ? (sdSem(t.slice(4)) || {}).grade_scale : (sdCourse(t.slice(7)) || {}).grade_scale;
    function sdScaleLoad() {
      const own = sdScaleOf(SC_TARGET), inherited = SC_TARGET === 'account' ? SD_SCALE_DEFAULT : SC_TARGET.startsWith('sem:') ? (sdAccountScale() || SD_SCALE_DEFAULT) : sdScale({ semester_id: (sdCourse(SC_TARGET.slice(7)) || {}).semester_id });
      SC_ROWS = (sdValidScale(own) ? own : inherited).map(r => r.slice());
      docEl('sdScaleHint').textContent = (SC_TARGET === 'account' ? 'Your default scale, used wherever a semester or subject has none of its own.' : sdValidScale(own) ? 'This one has its own scale.' : 'This one follows the scale above it for now. Change the rows and save to give it its own scale.') + ' A mark gets the first row whose minimum it reaches. The last row should start at 0.';
      paintScaleRows();
    }
    function openScale() {
      SC_TARGET = 'account'; sdErr('sdScaleError', '');
      const sel = docEl('sdScaleFor'); sel.innerHTML = sdScaleTargets().map(([v, n]) => `<option value="${v}">${escapeHtml(n)}</option>`).join(''); sel.value = SC_TARGET; skinSelect(sel);
      sdScaleLoad(); sdOpen('sdScaleOverlay');
    }
    docEl('sdScaleFor').addEventListener('change', () => { SC_TARGET = docEl('sdScaleFor').value; sdErr('sdScaleError', ''); sdScaleLoad(); });
    docEl('sdScaleClose').onclick = () => sdClose('sdScaleOverlay');
    docEl('sdScaleOverlay').onclick = e => { if (e.target === docEl('sdScaleOverlay')) sdClose('sdScaleOverlay'); const d = e.target.closest('[data-del]'); if (d) { if (SC_ROWS.length <= 2) return sdErr('sdScaleError', 'Keep at least two rows.'); SC_ROWS.splice(+d.dataset.del, 1); paintScaleRows(); } };
    docEl('sdScaleRows').addEventListener('input', e => { const inp = e.target.closest('input[data-k]'); if (!inp) return; SC_ROWS[+inp.closest('[data-i]').dataset.i][+inp.dataset.k] = inp.value; });
    docEl('sdScaleAdd').onclick = () => { if (SC_ROWS.length >= 20) return; SC_ROWS.push(['', '', '']); paintScaleRows(); };
    docEl('sdScaleReset').onclick = async () => { // account: back to the standard scale; semester / subject: stop having its own scale
      sdErr('sdScaleError', ''); if (SC_TARGET === 'account') { SC_ROWS = SD_SCALE_DEFAULT.map(r => r.slice()); return paintScaleRows(); }
      const sem = SC_TARGET.startsWith('sem:'), id = SC_TARGET.slice(sem ? 4 : 7), r = await (sem ? LumaStudy.semesters : LumaStudy.courses).update(id, { grade_scale: null });
      if (r.error) return sdErr('sdScaleError', r.error.message); const list = sem ? SD.semesters : SD.courses, k = list.findIndex(x => x.id === id); if (k >= 0) list[k] = r.data;
      sdScaleLoad(); sdAfterSave(); flashToast('Back to the scale above it', '', 'fa-rotate-left', '#34d399');
    };
    docEl('sdScaleSave').onclick = async () => {
      const rows = SC_ROWS.map(r => [Number(String(r[0]).replace(',', '.')), String(r[1]).trim(), Number(String(r[2]).replace(',', '.'))]);
      if (rows.some(r => !isFinite(r[0]) || r[0] < 0 || r[0] > 100 || String(SC_ROWS[rows.indexOf(r)][0]).trim() === '')) return sdErr('sdScaleError', 'Every row needs a "From %" between 0 and 100.');
      if (rows.some(r => !r[1] || r[1].length > 12)) return sdErr('sdScaleError', 'Every row needs a grade name (up to 12 characters, like A- or Distinction).');
      if (rows.some((r, i) => !isFinite(r[2]) || r[2] < 0 || r[2] > 10 || String(SC_ROWS[i][2]).trim() === '')) return sdErr('sdScaleError', 'GPA points are numbers from 0 to 10.');
      if (new Set(rows.map(r => r[0])).size !== rows.length) return sdErr('sdScaleError', 'Two rows start at the same percentage.');
      if (!rows.some(r => r[0] === 0)) return sdErr('sdScaleError', 'One row must start at 0 so every mark gets a grade.');
      rows.sort((a, b) => b[0] - a[0]);
      const same = JSON.stringify(rows) === JSON.stringify(SD_SCALE_DEFAULT), value = same && SC_TARGET === 'account' ? null : rows;
      sdBtn('sdScaleSave', true);
      if (SC_TARGET === 'account') await setLumaPref('grade_scale', value);
      else { // a semester's or a subject's own scale (migration 061)
        const sem = SC_TARGET.startsWith('sem:'), id = SC_TARGET.slice(sem ? 4 : 7), r = await (sem ? LumaStudy.semesters : LumaStudy.courses).update(id, { grade_scale: rows });
        if (r.error || r.data.grade_scale === undefined) { sdBtn('sdScaleSave', false, 'Save scale'); return sdErr('sdScaleError', r.error ? r.error.message : 'Run supabase/migrations/061_grade_scales.sql in the SQL Editor first.'); }
        const list = sem ? SD.semesters : SD.courses, k = list.findIndex(x => x.id === id); if (k >= 0) list[k] = r.data;
      }
      sdBtn('sdScaleSave', false, 'Save scale');
      sdClose('sdScaleOverlay'); sdAfterSave(); flashToast('Grade scale saved', same ? 'Using the standard scale' : 'Your GPA and letters use it now', 'fa-check', '#22c55e');
    };

    // --- breaks & holidays ---
    function sdPaintBreaks() {
      docEl('sdBreakList').innerHTML = SD.breaks.length ? [...SD.breaks].sort((a, b) => a.start_date.localeCompare(b.start_date)).map(b => `<div class="sd-brk"><div><b>${escapeHtml(b.name)}</b><small>${sdShort(b.start_date)}${b.end_date !== b.start_date ? ' to ' + sdShort(b.end_date) : ''} · ${sdDiff(b.start_date, b.end_date) + 1} day${sdDiff(b.start_date, b.end_date) ? 's' : ''}</small></div><button type="button" class="h-del" data-brk-del="${b.id}" title="Delete" aria-label="Delete"><i class="fa-regular fa-trash-can"></i></button></div>`).join('') : '<div class="ls" style="padding:4px 2px">No breaks yet.</div>';
    }
    function openBreaks() { sdErr('sdBreakError', ''); docEl('sdBreakName').value = ''; docEl('sdBreakFrom').value = sdKey(); docEl('sdBreakTo').value = sdKey(); ['sdBreakFrom', 'sdBreakTo'].forEach(id => docEl(id)._luDateRefresh && docEl(id)._luDateRefresh()); sdPaintBreaks(); sdOpen('sdBreakOverlay'); }
    docEl('sdBreakClose').onclick = () => sdClose('sdBreakOverlay');
    docEl('sdBreakOverlay').onclick = async e => {
      if (e.target === docEl('sdBreakOverlay')) return sdClose('sdBreakOverlay');
      const d = e.target.closest('[data-brk-del]'); if (!d) return;
      const { error } = await LumaStudy.breaks.remove(d.dataset.brkDel); if (error) return sdErr('sdBreakError', error.message);
      SD.breaks = SD.breaks.filter(x => x.id !== d.dataset.brkDel); sdPaintBreaks(); sdAfterSave();
    };
    docEl('sdBreakAdd').onclick = async () => {
      const name = docEl('sdBreakName').value.trim(), a = docEl('sdBreakFrom').value, b = docEl('sdBreakTo').value;
      if (!name) return sdErr('sdBreakError', 'Give the break a name.');
      if (!a || !b) return sdErr('sdBreakError', 'Pick both dates.');
      if (b < a) return sdErr('sdBreakError', 'The last day must not be before the first day.');
      sdErr('sdBreakError', ''); sdBtn('sdBreakAdd', true);
      const { data, error } = await LumaStudy.breaks.add({ name, start_date: a, end_date: b });
      sdBtn('sdBreakAdd', false, 'Add break');
      if (error) return sdErr('sdBreakError', /study_breaks|schema cache|does not exist/i.test(error.message) ? 'Breaks aren\'t set up yet — run supabase/migrations/052_study_extras.sql.' : sdHint(error.message));
      SD.breaks.push(data); docEl('sdBreakName').value = ''; sdPaintBreaks(); sdAfterSave();
    };

    // ---------- archiving: subjects one by one or several at once, or a whole semester ----------
    async function sdSetCoursesArchived(ids, on) {
      const rs = await Promise.all(ids.map(id => LumaStudy.courses.update(id, { archived: on })));
      const bad = rs.find(r => r.error); if (bad) return bad.error.message;
      rs.forEach(r => { const i = SD.courses.findIndex(x => x.id === r.data.id); if (i >= 0) SD.courses[i] = r.data; }); return '';
    }
    const sdSemNeedsMigration = 'Semesters aren\'t set up for this yet — run supabase/migrations/055 and 056 in the SQL Editor.';
    const sdRpcHint = m => /could not find the function|schema cache/i.test(m) ? sdSemNeedsMigration : m;
    async function sdActivateSemester(id) {
      const sem = sdSem(id); if (!sem) return;
      const r = await LumaStudy.semesters.activate(id); if (r.error) return luAlert('Could not activate it: ' + sdRpcHint(r.error.message));
      await sdLoad(); sdAfterSave(); flashToast('Semester activated', sem.name + ' now receives everything you add in Study', 'fa-bolt', '#34d399');
    }
    // "Done with this semester": a summary and an optional remark, then everything in it moves to the archive
    let sdArchId = null;
    function sdFinishSemester(id) {
      const sem = sdSem(id); if (!sem) return; sdArchId = id;
      const cs = SD.courses.filter(c => c.semester_id === id), ids = cs.map(c => c.id), tk = SD.tasks.filter(t => ids.includes(t.course_id) || t.semester_id === id), open = tk.filter(t => t.status !== 'done').length, cl = SD.classes.filter(c => ids.includes(c.course_id)).length;
      docEl('sdArchTitle').textContent = 'Archive “' + sem.name + '”';
      docEl('sdArchSummary').innerHTML = `${cs.length} subject${cs.length === 1 ? '' : 's'}, ${cl} class${cl === 1 ? '' : 'es'} and ${tk.length} assignment${tk.length === 1 ? '' : 's'}${open ? ` (<b>${open} still open</b>)` : ''}, plus the notes, group projects, reminders and other items you added in it, move to <b>Study → Archive</b>. They leave your timetable, Calendar and reminders, and your GPA keeps them. You can restore the semester any time. Next semester, use <b>Start from a previous semester</b> to copy your subjects and timetable.`;
      docEl('sdArchRemark').value = sem.remark || ''; sdErr('sdArchError', ''); sdOpen('sdArchOverlay'); setTimeout(() => docEl('sdArchRemark').focus(), 50);
    }
    docEl('sdArchClose').onclick = () => sdClose('sdArchOverlay');
    docEl('sdArchOverlay').onclick = e => { if (e.target === docEl('sdArchOverlay')) sdClose('sdArchOverlay'); };
    docEl('sdArchSave').onclick = async () => {
      const sem = sdSem(sdArchId); if (!sem) return; sdErr('sdArchError', ''); sdBtn('sdArchSave', true);
      const r = await LumaStudy.semesters.archive(sem.id, docEl('sdArchRemark').value.trim()); sdBtn('sdArchSave', false, 'Archive semester');
      if (r.error) return sdErr('sdArchError', sdRpcHint(r.error.message));
      sdClose('sdArchOverlay'); await sdLoad(); sdAfterSave(); flashToast('Semester archived', sem.name + ' is now in Study → Archive', 'fa-box-archive', '#34d399');
    };
    async function sdRestoreSemester(id) {
      const sem = sdSem(id); if (!sem) return;
      const r = await LumaStudy.semesters.restore(id); if (r.error) return luAlert('Could not restore the semester: ' + sdRpcHint(r.error.message));
      await sdLoad(); sdAfterSave();
      flashToast('Semester restored', r.data === 'active' ? sem.name + ' is the active semester again' : sem.name + ' is back, inactive: another semester is active', 'fa-rotate-left', '#34d399');
    }
    // several subjects at once (Subjects → Select)
    async function sdArchiveSelected(on) {
      const ids = [...SD.sel].filter(id => { const c = sdCourse(id); return c && !!c.archived !== on; }); if (!ids.length) return;
      if (!await luConfirm({ title: on ? `Archive ${ids.length} subject${ids.length === 1 ? '' : 's'}?` : `Restore ${ids.length} subject${ids.length === 1 ? '' : 's'}?`, message: on ? 'They leave your timetable, Calendar and reminders. Their marks still count in your GPA.' : 'They come back to your timetable, Calendar and reminders.', ok: on ? 'Archive' : 'Restore', icon: 'fa-box-archive', tone: 'info' })) return;
      const err = await sdSetCoursesArchived(ids, on); SD.sel = null; sdAfterSave();
      if (err) return luAlert('Could not change some subjects: ' + err);
      flashToast(on ? 'Archived' : 'Restored', `${ids.length} subject${ids.length === 1 ? '' : 's'}`, 'fa-box-archive', '#34d399');
    }

    // ---------- start a new semester from an old one: copy the subjects and timetable (and what is still unfinished) ----------
    const SDC = { what: new Set(['setup']) };
    function sdCopyCounts() {
      const from = docEl('sdCopyFrom').value, cs = SD.courses.filter(c => c.semester_id === from), ids = cs.map(c => c.id);
      return { subjects: cs.length, classes: SD.classes.filter(k => ids.includes(k.course_id)).length, open: SD.tasks.filter(t => t.status !== 'done' && (ids.includes(t.course_id) || t.semester_id === from)).length };
    }
    function sdCopyPaint() {
      sdChips('sdCopyWhat', [['setup', 'Subjects and timetable', 'fa-book'], ['open', 'Unfinished assignments', 'fa-list-check']].map(([k, n, i]) => [k, n, i]), '', 'cw');
      docEl('sdCopyWhat').querySelectorAll('[data-cw]').forEach(b => b.classList.toggle('on', SDC.what.has(b.dataset.cw)));
      const c = sdCopyCounts(), to = sdActiveSem();
      docEl('sdCopyHint').textContent = `${c.subjects} subject${c.subjects === 1 ? '' : 's'}, ${c.classes} class${c.classes === 1 ? '' : 'es'} and ${c.open} unfinished assignment${c.open === 1 ? '' : 's'} in the semester you pick. Classes run for the dates of ${to ? to.name : 'this semester'}. Marks, scores and notes are not copied.`;
    }
    function openCopySemester() {
      const to = sdActiveSem(); if (!to) return sdNeedSem();
      const others = SD.semesters.filter(x => x.id !== to.id).sort((a, b) => b.start_date.localeCompare(a.start_date));
      if (!others.length) return luAlert('You have no other semester to copy from yet.', 'Nothing to copy');
      SDC.what = new Set(['setup']); sdErr('sdCopyError', '');
      docEl('sdCopyTo').innerHTML = `Copying into <b>${escapeHtml(to.name)}</b> (your active semester).`;
      docEl('sdCopyFrom').innerHTML = others.map(x => `<option value="${x.id}">${escapeHtml(x.name)}${x.archived_at ? ' (archived)' : ''}</option>`).join(''); skinSelect(docEl('sdCopyFrom'));
      sdCopyPaint(); sdOpen('sdCopyOverlay');
    }
    docEl('sdCopyClose').onclick = () => sdClose('sdCopyOverlay');
    docEl('sdCopyOverlay').onclick = e => { if (e.target === docEl('sdCopyOverlay')) return sdClose('sdCopyOverlay'); const w = e.target.closest('[data-cw]'); if (w) { SDC.what.has(w.dataset.cw) ? SDC.what.delete(w.dataset.cw) : SDC.what.add(w.dataset.cw); sdCopyPaint(); } };
    docEl('sdCopyFrom').addEventListener('change', sdCopyPaint);
    docEl('sdCopyGo').onclick = async () => {
      const to = sdActiveSem(), from = docEl('sdCopyFrom').value; if (!to || !from) return;
      if (!SDC.what.size) return sdErr('sdCopyError', 'Pick what to copy.');
      sdErr('sdCopyError', ''); sdBtn('sdCopyGo', true);
      try {
        const today = sdKey(), srcCourses = SD.courses.filter(c => c.semester_id === from), srcIds = srcCourses.map(c => c.id), made = { subjects: 0, classes: 0, tasks: 0 }, idMap = {};
        const mine = SD.courses.filter(c => c.semester_id === to.id); // a subject already in this semester is reused, not copied twice
        const fresh = [];
        srcCourses.forEach(c => { const ex = mine.find(m => m.name.toLowerCase() === c.name.toLowerCase() && (m.code || '') === (c.code || '')); if (ex) idMap[c.id] = ex.id; else fresh.push(c); });
        if (SDC.what.has('setup') || (SDC.what.has('open') && fresh.length)) {
          if (fresh.length) {
            const r = await LumaStudy.courses.addMany(fresh.map(c => ({ name: c.name, code: c.code || '', color: c.color, lecturer: c.lecturer || '', credit_hours: c.credit_hours, target_percent: c.target_percent })));
            if (r.error) throw new Error(r.error.message);
            (r.data || []).forEach((row, i) => { idMap[fresh[i].id] = row.id; SD.courses.push(row); }); made.subjects = fresh.length;
          }
        }
        if (SDC.what.has('setup')) {
          const start = today > to.start_date ? today : to.start_date, rows = SD.classes.filter(k => srcIds.includes(k.course_id) && idMap[k.course_id]).map(k => ({ course_id: idMap[k.course_id], weekday: k.weekday, start_time: k.start_time, end_time: k.end_time, room: k.room || '', kind: k.kind, start_date: start, end_date: to.end_date }));
          if (rows.length && to.end_date >= start) { const r = await LumaStudy.classes.addMany(rows); if (r.error) throw new Error(r.error.message); made.classes = rows.length; }
        }
        if (SDC.what.has('open')) {
          const rows = SD.tasks.filter(t => t.status !== 'done' && (srcIds.includes(t.course_id) || t.semester_id === from)).map(t => ({ course_id: t.course_id ? (idMap[t.course_id] || null) : null, title: t.title, kind: t.kind, due_date: t.due_date && t.due_date >= today ? t.due_date : null, due_time: t.due_date && t.due_date >= today ? t.due_time : null, weight: t.weight, notes: t.notes || '', status: 'todo' }));
          if (rows.length) { const r = await LumaStudy.tasks.addMany(rows); if (r.error) throw new Error(r.error.message); made.tasks = rows.length; }
        }
        sdClose('sdCopyOverlay'); await sdLoad(); sdAfterSave();
        flashToast('Copied into ' + to.name, `${made.subjects} subject${made.subjects === 1 ? '' : 's'}, ${made.classes} class${made.classes === 1 ? '' : 'es'}, ${made.tasks} assignment${made.tasks === 1 ? '' : 's'}`, 'fa-copy', '#34d399');
      } catch (e) { sdErr('sdCopyError', sdHint(e.message || String(e))); }
      sdBtn('sdCopyGo', false, 'Copy into this semester');
    };

    // ---------- pick people from your contacts (used by shared notes and group projects) ----------
    let SD_CONTACTS = null, sdPickResolve = null;
    // resolves with a Map(userId → name) of the people ticked, or null if the popup was closed
    async function sdPickContacts({ title = 'Pick contacts', selected = new Map(), exclude = new Set() } = {}) {
      docEl('sdPickTitle').textContent = title; const box = docEl('sdPickList'); box.innerHTML = '<div class="ls" style="padding:8px 2px">Loading…</div>'; sdOpen('sdPickOverlay');
      if (!SD_CONTACTS) {
        const r = await LumaContacts.listContacts();
        if (r.error) { box.innerHTML = `<div class="ls" style="padding:8px 2px">Could not load your contacts: ${escapeHtml(r.error.message)}</div>`; return new Promise(res => { sdPickResolve = res; }); }
        SD_CONTACTS = (r.data || []).filter(c => c.status === 'accepted');
      }
      box.innerHTML = SD_CONTACTS.length ? SD_CONTACTS.map(c => { const nm = [c.other_first_name, c.other_last_name].filter(Boolean).join(' ') || c.other_email, dis = exclude.has(c.other_id);
        return `<label class="cal-pick ${dis ? 'dis' : ''}"><input type="checkbox" data-id="${c.other_id}" data-name="${escapeHtml(nm)}" ${dis || selected.has(c.other_id) ? 'checked' : ''} ${dis ? 'disabled' : ''}><span class="av">${escapeHtml((nm[0] || '?').toUpperCase())}</span><span class="nm">${escapeHtml(nm)}<small>${dis ? 'Already added' : escapeHtml(c.other_email || '')}</small></span></label>`; }).join('')
        : '<div class="ls" style="padding:8px 2px">You have no contacts yet. Add people on the Contacts page first.</div>';
      return new Promise(res => { sdPickResolve = res; });
    }
    const sdPickEnd = v => { sdClose('sdPickOverlay'); const r = sdPickResolve; sdPickResolve = null; if (r) r(v); };
    docEl('sdPickClose').onclick = () => sdPickEnd(null);
    docEl('sdPickOverlay').onclick = e => { if (e.target === docEl('sdPickOverlay')) sdPickEnd(null); };
    docEl('sdPickDone').onclick = () => sdPickEnd(new Map([...docEl('sdPickList').querySelectorAll('input[type=checkbox]:checked:not(:disabled)')].map(i => [i.dataset.id, i.dataset.name])));

    // ---------- global search and "Export my data" ----------
    // Study items appear in search where Study data is visible (Study mode, or Personal with "Show Study in Personal" on)
    async function studySearchItems() {
      if (!(LUMA_MODE === 'study' || prefOn('show_study_personal', false))) return [];
      await sdEnsureLoaded(); if (SD.err) return [];
      const ok = async p => { try { const r = await p; return r && !r.error && Array.isArray(r.data) ? r.data : []; } catch (e) { return []; } };
      const [notes, projects] = await Promise.all([ok(LumaStudy.notes.list()), ok(LumaStudy.groups.list())]);
      const out = [];
      SD.courses.forEach(c => out.push({ type: 'study', raw: { kind: 'course', id: c.id }, title: c.name, sub: 'Study subject' + (c.code ? ' · ' + c.code : '') + (c.archived ? ' · archived' : ''), hay: [c.name, c.code, c.lecturer].join(' ') }));
      sdLiveTasks().forEach(t => out.push({ type: 'study', raw: { kind: 'task', id: t.id }, title: t.title, sub: `${sdKind(t.kind)[1]} · ${t.status === 'done' ? 'done' : t.due_date ? 'due ' + sdShort(t.due_date) : 'no due date'}${sdCourse(t.course_id) ? ' · ' + sdCourse(t.course_id).name : ''}`, hay: [t.title, t.notes, (sdCourse(t.course_id) || {}).name].join(' ') }));
      notes.forEach(n => out.push({ type: 'study', raw: { kind: 'note', id: n.id }, title: n.title, sub: 'Study note' + (sdCourse(n.course_id) ? ' · ' + sdCourse(n.course_id).name : ''), hay: [n.title, n.body].join(' ') }));
      projects.forEach(p => out.push({ type: 'study', raw: { kind: 'group', id: p.id }, title: p.title, sub: 'Group project' + (p.course_name ? ' · ' + p.course_name : ''), hay: [p.title, p.course_name].join(' ') }));
      return out;
    }
    async function sdOpenFromSearch(r) {
      await sdEnsureLoaded();
      if (r.kind === 'course') { const c = sdCourse(r.id); if (c) openCourseModal(c); }
      else if (r.kind === 'task') { const t = SD.tasks.find(x => x.id === r.id); if (t) sdOpenTaskModal(t); }
      else if (r.kind === 'note' && typeof sdOpenNoteById === 'function') sdOpenNoteById(r.id);
      else if (r.kind === 'group' && typeof sdOpenProject === 'function') sdOpenProject(r.id);
    }
    async function sdExport() {
      const get = async p => { try { const r = await p; return r && !r.error ? r.data : null; } catch (e) { return null; } };
      return { semesters: await get(LumaStudy.semesters.list()), subjects: await get(LumaStudy.courses.list()), classes: await get(LumaStudy.classes.list()), cancelled_class_dates: await get(LumaStudy.skips.list()),
        breaks_and_holidays: await get(LumaStudy.breaks.list()), assignments: await get(LumaStudy.tasks.list()), notes: await get(LumaStudy.notes.list()), notes_shared_with_me: await get(LumaStudy.notes.shared()), group_projects: await get(LumaStudy.groups.list()),
        grade_scale: (LUMA_PROFILE && LUMA_PROFILE.preferences && LUMA_PROFILE.preferences.grade_scale) || 'standard' };
    }

    // --- import public holidays (a country list, the fixed national days, or a calendar file) ---
    const SDH = { src: 'country', items: [], countries: null };
    const SD_HOL_FALLBACK = [['MY', 'Malaysia'], ['SG', 'Singapore'], ['ID', 'Indonesia'], ['PH', 'Philippines'], ['VN', 'Vietnam'], ['GB', 'United Kingdom'], ['US', 'United States'], ['AU', 'Australia'], ['CA', 'Canada'], ['NZ', 'New Zealand'], ['JP', 'Japan'], ['KR', 'South Korea'], ['CN', 'China'], ['HK', 'Hong Kong']];
    function sdHolPaintSrc() {
      sdChips('sdHolSrc', [['country', 'By country', 'fa-earth-asia'], ['my', 'Malaysia: national days', 'fa-flag'], ['file', 'From a file', 'fa-file']], SDH.src, 'hs');
      docEl('sdHolCountry').style.display = SDH.src === 'country' ? '' : 'none'; docEl('sdHolMy').style.display = SDH.src === 'my' ? '' : 'none'; docEl('sdHolFile').style.display = SDH.src === 'file' ? '' : 'none';
    }
    function sdHolPaintList() {
      const L = docEl('sdHolList');
      L.innerHTML = SDH.items.length ? `<div class="ls" style="margin-bottom:6px">${SDH.items.length} found. Untick any you do not want.</div>` + SDH.items.map((h, i) => `<label class="cal-pick"><input type="checkbox" data-hi="${i}" ${h.on ? 'checked' : ''} ${h.dup ? 'disabled' : ''}><span class="nm">${escapeHtml(h.name)}<small>${sdFmtDate(h.start, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}${h.end !== h.start ? ' to ' + sdShort(h.end) : ''}${h.dup ? ' · already added' : h.note ? ' · ' + escapeHtml(h.note) : ''}</small></span></label>`).join('') : '';
      const n = SDH.items.filter(h => h.on && !h.dup).length; docEl('sdHolAdd').disabled = !n; docEl('sdHolAdd').textContent = n ? `Add ${n} holiday${n === 1 ? '' : 's'}` : 'Add selected';
    }
    const sdHolSet = items => { SDH.items = items.map(h => ({ ...h, dup: SD.breaks.some(b => b.start_date === h.start && b.end_date === h.end && b.name === h.name), on: h.on !== false })); SDH.items.forEach(h => { if (h.dup) h.on = false; }); sdHolPaintList(); };
    async function sdHolCountries() {
      if (SDH.countries) return SDH.countries;
      try { const r = await fetch('https://date.nager.at/api/v3/AvailableCountries'); const j = await r.json(); SDH.countries = j.map(c => [c.countryCode, c.name]).sort((a, b) => a[1].localeCompare(b[1])); } catch (e) { SDH.countries = SD_HOL_FALLBACK; }
      return SDH.countries;
    }
    async function openHolidays() {
      sdErr('sdHolError', ''); SDH.items = []; SDH.src = 'country'; sdHolPaintSrc(); sdHolPaintList(); sdOpen('sdHolOverlay');
      const y = +sdKey().slice(0, 4), yr = docEl('sdHolYear'), my = docEl('sdHolMyYear');
      yr.innerHTML = my.innerHTML = [y, y + 1].map(v => `<option value="${v}">${v}</option>`).join(''); skinSelect(yr); skinSelect(my);
      const list = await sdHolCountries(), mine = (lumaCountry() || '').toLowerCase(), pick = (list.find(c => c[1].toLowerCase() === mine) || list.find(c => c[0] === 'SG') || list[0])[0];
      docEl('sdHolCode').innerHTML = list.map(c => `<option value="${c[0]}">${escapeHtml(c[1])}</option>`).join(''); docEl('sdHolCode').value = pick; skinSelect(docEl('sdHolCode'));
    }
    docEl('sdHolOpen').onclick = openHolidays;
    docEl('sdHolClose').onclick = () => sdClose('sdHolOverlay');
    docEl('sdHolOverlay').onclick = e => {
      if (e.target === docEl('sdHolOverlay')) return sdClose('sdHolOverlay');
      const hs = e.target.closest('[data-hs]'); if (hs) { SDH.src = hs.dataset.hs; SDH.items = []; sdErr('sdHolError', ''); sdHolPaintSrc(); sdHolPaintList(); }
      const hi = e.target.closest('input[data-hi]'); if (hi) { SDH.items[+hi.dataset.hi].on = hi.checked; sdHolPaintList(); }
    };
    docEl('sdHolFind').onclick = async () => {
      const code = docEl('sdHolCode').value, year = docEl('sdHolYear').value; sdErr('sdHolError', ''); docEl('sdHolList').innerHTML = '<div class="ls">Looking…</div>';
      try {
        const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${code}`);
        if (r.status === 204 || r.status === 404) { SDH.items = []; sdHolPaintList(); return sdErr('sdHolError', 'No automatic list exists for that country. Try “Malaysia: national days” or import a calendar file.'); }
        const j = await r.json(); sdHolSet(j.map(h => ({ name: h.localName && h.localName !== h.name ? `${h.localName} (${h.name})` : h.name, start: h.date, end: h.date, on: h.global !== false, note: h.global === false ? 'some regions only' : '' })));
      } catch (e) { SDH.items = []; sdHolPaintList(); sdErr('sdHolError', 'Could not reach the holiday list (are you online?). You can still import a calendar file.'); }
    };
    docEl('sdHolMyGo').onclick = () => { // the same-date national days of Malaysia, plus the Agong's birthday (first Monday of June)
      const y = +docEl('sdHolMyYear').value, jun1 = new Date(Date.UTC(y, 5, 1)).getUTCDay(), agong = 1 + ((8 - jun1) % 7), p = n => String(n).padStart(2, '0');
      sdHolSet([['New Year\'s Day', `${y}-01-01`], ['Labour Day', `${y}-05-01`], ['Agong\'s Birthday', `${y}-06-${p(agong)}`], ['Merdeka Day', `${y}-08-31`], ['Malaysia Day', `${y}-09-16`], ['Christmas Day', `${y}-12-25`]].map(([name, d]) => ({ name, start: d, end: d })));
    };
    // a calendar file: all-day events become holidays (the end date of an all-day event is the day after it, so one day is taken off)
    function sdParseIcs(text) {
      const lines = text.replace(/\r/g, '').replace(/\n[ \t]/g, '').split('\n'), out = []; let cur = null;
      const day = v => { const m = /(\d{4})(\d{2})(\d{2})/.exec(v || ''); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };
      lines.forEach(l => {
        if (l.startsWith('BEGIN:VEVENT')) cur = {};
        else if (l.startsWith('END:VEVENT')) { if (cur && cur.s && cur.name) { let e = cur.e && cur.e > cur.s ? sdAdd(cur.e, cur.allDay ? -1 : 0) : cur.s; if (e < cur.s) e = cur.s; out.push({ name: cur.name, start: cur.s, end: e }); } cur = null; }
        else if (cur) {
          if (l.startsWith('DTSTART')) { cur.s = day(l.split(':').pop()); cur.allDay = /VALUE=DATE(?!-)/.test(l) || l.split(':').pop().length === 8; }
          else if (l.startsWith('DTEND')) cur.e = day(l.split(':').pop());
          else if (l.startsWith('SUMMARY')) cur.name = l.slice(l.indexOf(':') + 1).replace(/\\,/g, ',').replace(/\\n/g, ' ').trim().slice(0, 60);
        }
      });
      return out.slice(0, 300);
    }
    docEl('sdHolIcs').onchange = async () => {
      const f = docEl('sdHolIcs').files[0]; docEl('sdHolIcs').value = ''; if (!f) return; sdErr('sdHolError', '');
      try { const items = sdParseIcs(await f.text()); if (!items.length) { SDH.items = []; sdHolPaintList(); return sdErr('sdHolError', 'No events were found in that file.'); } sdHolSet(items); }
      catch (e) { sdErr('sdHolError', 'Could not read that file.'); }
    };
    docEl('sdHolAdd').onclick = async () => {
      const rows = SDH.items.filter(h => h.on && !h.dup).map(h => ({ name: h.name.slice(0, 60), start_date: h.start, end_date: h.end })); if (!rows.length) return;
      sdBtn('sdHolAdd', true); const r = await LumaStudy.breaks.addMany(rows); sdBtn('sdHolAdd', false, 'Add selected');
      if (r.error) return sdErr('sdHolError', /study_breaks|schema cache|does not exist/i.test(r.error.message) ? 'Breaks aren\'t set up yet — run supabase/migrations/052_study_extras.sql.' : sdHint(r.error.message));
      SD.breaks.push(...(r.data || [])); sdClose('sdHolOverlay'); sdPaintBreaks(); sdAfterSave(); flashToast('Holidays added', `${rows.length} added to your breaks`, 'fa-flag', '#34d399');
    };

    // ---------- calendar: classes repeat every week, assignments show on their due date ----------
    // in Personal mode the person chooses whether Study shows on the Calendar (Settings → Preferences); in Study mode it always does
    const studyVisibleOnCalendar = () => LumaPlan.hasAddon('study') && (LUMA_MODE === 'study' || prefOn('show_study_personal', false));
    function studyCalItems(k) {
      if (!studyVisibleOnCalendar()) return [];
      const out = [];
      if (!cHidden.has('Classes')) SD.classes.filter(c => sdClassOn(c, k)).forEach(c => { const co = sdCourse(c.course_id); out.push({ type: 'sdclass', id: c.id, title: co ? co.name : 'Class', time: sdHM(c.start_time), end: sdHM(c.end_time), color: co ? co.color : '#34d399', cat: 'Classes', label: 'Class' }); });
      if (!cHidden.has('Study')) sdLiveTasks().filter(t => t.due_date === k && t.status !== 'done').forEach(t => { const co = sdCourse(t.course_id); out.push({ type: 'sdtask', id: t.id, title: t.title, color: co ? co.color : '#a78bfa', cat: 'Study', label: sdKind(t.kind)[1] + ' due' }); });
      return out;
    }
    function sdOpenFromCal(type, id) {
      if (type === 'sdclass') { const c = SD.classes.find(x => x.id === id); if (c) openClassModal(c); }
      else { const t = SD.tasks.find(x => x.id === id); if (t) sdOpenTaskModal(t); }
    }

    // ---------- wiring ----------
    WIRE.study = async function (pg) {
      pg.querySelector('#sdTabs').addEventListener('click', e => { const b = e.target.closest('[data-sdtab]'); if (b) { SD.tab = b.dataset.sdtab; sdPaint(); const r = docEl('sdRoot'); if (r) r.scrollTop = 0; if (SD_ONSHOW[SD.tab]) SD_ONSHOW[SD.tab](); } });
      pg.querySelector('#sdAdd').addEventListener('click', () => { const a = SD_ADD[SD.tab]; if (a) a[1](); });
      pg.querySelector('#sdRoot').addEventListener('click', e => {
        const chk = e.target.closest('[data-check]'); if (chk) return sdToggleDone(chk.dataset.check);
        if (e.target.closest('[data-goto-sem]')) { SD.tab = 'semesters'; return sdPaint(); }
        const cp = e.target.closest('[data-copy-sem]'); if (cp) return openCopySemester();
        const act = e.target.closest('[data-activate-sem]'); if (act) return sdActivateSemester(act.dataset.activateSem);
        const fin = e.target.closest('[data-finish-sem]'); if (fin) return sdFinishSemester(fin.dataset.finishSem);
        if (e.target.closest('[data-open-archive]')) return goTo('studyarchive');
        if (e.target.closest('[data-sel-start]')) { SD.sel = new Set(); return sdPaint(); }
        if (e.target.closest('[data-sel-cancel]')) { SD.sel = null; return sdPaint(); }
        if (e.target.closest('[data-sel-all]')) { SD.sel = new Set(SD.courses.filter(c => SD.showArchived || !c.archived).map(c => c.id)); return sdPaint(); }
        if (e.target.closest('[data-sel-archive]')) return sdArchiveSelected(true);
        if (e.target.closest('[data-sel-restore]')) return sdArchiveSelected(false);
        const sm = e.target.closest('[data-sem]'); if (sm) return openSemModal(sdSem(sm.dataset.sem));
        const add = e.target.closest('[data-add]'); if (add) return add.dataset.add === 'course' ? openCourseModal(null) : add.dataset.add === 'semester' ? openSemModal(null) : openClassModal(null, add.dataset.day != null ? +add.dataset.day : undefined);
        if (e.target.closest('[data-ended]')) { SD.showEnded = !SD.showEnded; return sdPaint(); }
        if (e.target.closest('[data-scale]')) return openScale();
        if (e.target.closest('[data-breaks]')) return openBreaks();
        const wl = e.target.closest('.sd-ttnav .lb'); if (wl) return void luDatePopup(wl, { value: SD.ttWeek || sdWeekStart(), onPick: k => { SD.ttWeek = sdWeekStartOf(k); sdPaint(); } });
        const wk = e.target.closest('[data-ttw]'); if (wk) { const m = wk.dataset.ttw; SD.ttWeek = m === 'today' ? sdWeekStart() : sdAdd(SD.ttWeek || sdWeekStart(), m === 'next' ? 7 : -7); return sdPaint(); }
        const cell = e.target.closest('.tg-col'); if (cell && !e.target.closest('.tg-ev')) { const y = e.clientY - cell.getBoundingClientRect().top, h = Math.max(0, Math.min(23, Math.floor(y / SD_H))); return openClassModal(null, +cell.dataset.wd, String(h).padStart(2, '0') + ':00'); } // an empty hour: new class at that hour
        const tt = e.target.closest('[data-tt]'); if (tt) { try { localStorage.setItem('luma_tt_view', tt.dataset.tt); } catch (x) { } return sdPaint(); }
        for (const h of SD_CLICK) if (h(e)) return;
        if (e.target.closest('[data-archived]')) { SD.showArchived = !SD.showArchived; return sdPaint(); }
        const f = e.target.closest('[data-f]'); if (f) { SD.filter = f.dataset.f; return sdPaint(); }
        const fc = e.target.closest('[data-fc]'); if (fc) { SD.fCourse = fc.dataset.fc; return sdPaint(); }
        const cls = e.target.closest('[data-cls]'); if (cls) return openClassModal(SD.classes.find(x => x.id === cls.dataset.cls));
        const row = e.target.closest('[data-task]'); if (row) return sdOpenTaskModal(SD.tasks.find(x => x.id === row.dataset.task));
        const co = e.target.closest('[data-course]'); if (co) { if (SD.sel) { const id = co.dataset.course; SD.sel.has(id) ? SD.sel.delete(id) : SD.sel.add(id); return sdPaint(); } return openCourseModal(sdCourse(co.dataset.course)); }
      });
      if (!sdGuest()) await sdLoad(); sdPaint();
      if (SD_VIEW[SD.tab] && SD_ONSHOW[SD.tab]) SD_ONSHOW[SD.tab]();
    };
