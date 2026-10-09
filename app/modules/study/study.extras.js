// LUMA — module: study (attendance, "what if" grades, and saving your timetable to a phone or computer calendar)
    // Attendance: tables and the goal per subject come from migration 067. "What if" is worked out on the screen and saves nothing.
    // These add to the pages study.js draws (after each draw, sdXDecorate() adds the extra buttons); clicks are caught before the page's own handlers.
    const SDX = { att: [], attOk: true, loaded: false, course: null };
    const SD_ATT = [['present', 'Present', 'fa-check', '#34d399'], ['late', 'Late', 'fa-clock', '#fbbf24'], ['absent', 'Absent', 'fa-xmark', '#f87171'], ['excused', 'Excused', 'fa-hand', '#94a3b8']];

    // ---------- load attendance together with the rest of Study ----------
    async function sdAttLoad() {
      try { const r = await LumaStudy.attendance.list(); SDX.attOk = !r.error; SDX.att = r.error ? [] : (r.data || []); } catch (e) { SDX.attOk = false; SDX.att = []; }
      SDX.loaded = true;
    }
    { const base = sdLoad; sdLoad = async function () { await base(); await sdAttLoad(); }; }
    { const base = sdPaint; sdPaint = function () { base(); try { sdXDecorate(); } catch (e) { console.warn('LUMA: Study extras', e); } }; }
    const sdAttGet = (classId, date) => SDX.att.find(a => a.class_id === classId && a.att_date === date);

    // every class meeting of a subject so far (past) and still to come (future): its weekly slots, minus cancelled days and breaks
    function sdSessions(course) {
      const today = sdKey(), nowM = sdNowMin(), sem = (course.semester_id && sdSem(course.semester_id)) || sdActiveSem(), past = [], future = [];
      SD.classes.filter(c => c.course_id === course.id).forEach(c => {
        const start = c.start_date || (sem && sem.start_date); if (!start) return;
        const end = c.end_date || (sem && sem.end_date) || today;
        let d = start; while (sdDow(d) !== c.weekday) d = sdAdd(d, 1);
        for (let n = 0; d <= end && n < 400; d = sdAdd(d, 7), n++) {
          if (sdSkipped(c, d) || sdInBreak(d)) continue;
          ((d < today || (d === today && sdMin(c.end_time) <= nowM)) ? past : future).push({ c, date: d });
        }
      });
      past.sort((a, b) => b.date.localeCompare(a.date) || sdHM(b.c.start_time).localeCompare(sdHM(a.c.start_time)));
      return { past, future };
    }
    function sdAttStats(course) {
      const rows = SDX.att.filter(a => a.course_id === course.id), n = s => rows.filter(a => a.status === s).length;
      const present = n('present'), late = n('late'), absent = n('absent'), excused = n('excused'), counted = present + late + absent;
      const { past, future } = sdSessions(course), target = course.attendance_target != null ? +course.attendance_target : 80, total = past.length + future.length;
      const allowed = Math.floor(Math.max(0, total - excused) * (1 - target / 100) + 1e-9);
      return { present, late, absent, excused, counted, pct: counted ? (present + late) / counted * 100 : null, target, total, past: past.length, unmarked: past.filter(s => !sdAttGet(s.c.id, s.date)).length, canMiss: Math.max(0, allowed - absent), below: counted > 0 && (present + late) / counted * 100 < target };
    }
    async function sdAttSet(classId, courseId, date, status) {
      const cur = sdAttGet(classId, date);
      if (cur && cur.status === status) { // tapping the same one again clears it
        const { error } = await LumaStudy.attendance.clear(classId, date); if (error) return luAlert('Could not save: ' + error.message);
        SDX.att = SDX.att.filter(a => a !== cur); return;
      }
      const { data, error } = await LumaStudy.attendance.set([{ class_id: classId, course_id: courseId, att_date: date, status }]);
      if (error) return luAlert(/study_attendance|schema cache|does not exist/i.test(error.message) ? 'Attendance needs one more database step: run supabase/migrations/067_study_attendance_cards.sql in the SQL Editor.' : error.message);
      SDX.att = SDX.att.filter(a => !(a.class_id === classId && a.att_date === date)).concat(data || []);
    }

    // ---------- the extra buttons on the pages ----------
    function sdXDecorate() {
      const root = docEl('sdRoot'); if (!root || sdGuest()) return;
      if (SD.tab === 'overview' && SDX.attOk) {
        const today = sdKey(), nowM = sdNowMin();
        root.querySelectorAll('.sd-today[data-cls]').forEach(el => {
          const c = SD.classes.find(x => x.id === el.dataset.cls); if (!c || sdMin(c.start_time) > nowM) return;   // only classes that have started
          const cur = sdAttGet(c.id, today), bd = el.querySelector('.bd'); if (!bd) return;
          bd.insertAdjacentHTML('beforeend', `<div class="sx-mark" title="Were you there?">${SD_ATT.slice(0, 3).map(([k, n, i, col]) => `<button type="button" data-sx-att="${c.id}|${c.course_id}|${today}|${k}" class="${cur && cur.status === k ? 'on' : ''}" style="--c:${col}" title="${n}"><i class="fa-solid ${i}"></i><span>${n}</span></button>`).join('')}</div>`);
        });
      }
      if (SD.tab === 'subjects') {
        root.querySelectorAll('.sd-course[data-course]').forEach(el => {
          const c = sdCourse(el.dataset.course); if (!c || c.archived) return;
          const st = sdAttStats(c), hasClasses = SD.classes.some(x => x.course_id === c.id);
          el.insertAdjacentHTML('beforeend', `<div class="sx-att ${st.below ? 'bad' : ''}">${hasClasses && SDX.attOk ? `<div class="sx-att-t"><i class="fa-solid fa-user-check"></i><div><b>${st.pct == null ? 'Attendance' : 'Attendance ' + sdPct(st.pct) + '%'}</b><small>${st.counted ? `${st.present + st.late} of ${st.counted} classes · goal ${st.target}%${st.total ? ' · can miss ' + st.canMiss + ' more' : ''}` : st.past ? `${st.past} classes so far, none marked yet` : 'No classes yet'}</small></div></div>` : ''}
            <div class="sx-att-b">${hasClasses && SDX.attOk ? `<button type="button" class="np-btn" data-sx-open="${c.id}"><i class="fa-solid fa-clipboard-user"></i> Attendance${st.unmarked ? ` (${st.unmarked})` : ''}</button>` : ''}<button type="button" class="np-btn" data-sx-wif="${c.id}"><i class="fa-solid fa-calculator"></i> What if?</button></div></div>`);
        });
      }
      if (SD.tab === 'timetable') {
        const top = root.querySelector('.sd-tt-top');
        if (top) top.insertAdjacentHTML('beforeend', '<button type="button" class="np-btn sx-export" data-sx-ics title="Save your classes and deadlines for Google, Apple or Outlook Calendar"><i class="fa-solid fa-file-export"></i> <span>Export</span></button>');
      }
    }
    // clicks on the extra buttons are handled here first
    document.addEventListener('click', async e => {
      const b = e.target.closest('[data-sx-att], [data-sx-open], [data-sx-wif], [data-sx-ics], #sdAttList [data-sx-set]'); if (!b) return;
      e.stopPropagation(); e.preventDefault();
      if (b.dataset.sxAtt) { const [cid, coid, date, st] = b.dataset.sxAtt.split('|'); await sdAttSet(cid, coid, date, st); sdPaint(); }
      else if (b.dataset.sxOpen) sdAttOpen(b.dataset.sxOpen);
      else if (b.dataset.sxWif) sdWifOpen(b.dataset.sxWif);
      else if (b.dataset.sxSet !== undefined) { const [cid, coid, date, st] = b.dataset.sxSet.split('|'); await sdAttSet(cid, coid, date, st); sdAttPaint(); sdPaint(); }
      else if (b.hasAttribute('data-sx-ics')) sdExportIcs();
    }, true);

    // ---------- attendance for one subject ----------
    function sdAttPaint() {
      const c = sdCourse(SDX.course); if (!c) return; const st = sdAttStats(c), { past } = sdSessions(c);
      docEl('sdAttTitle').textContent = 'Attendance · ' + c.name;
      docEl('sdAttSum').innerHTML = `<div class="sx-pct ${st.below ? 'bad' : ''}"><b>${st.pct == null ? '—' : sdPct(st.pct) + '%'}</b><span>${st.counted ? `${st.present + st.late} of ${st.counted} classes attended` : 'Nothing marked yet'}</span></div>
        <div class="sx-chips">${SD_ATT.map(([k, n, i, col]) => `<span style="--c:${col}"><i class="fa-solid ${i}"></i> ${st[k]} ${n.toLowerCase()}</span>`).join('')}</div>
        <div class="ls" style="line-height:1.5;margin-top:8px">${st.total ? `${st.total} classes this semester · to stay at ${st.target}% you can miss <b>${st.canMiss}</b> more.` : 'Add dates to your classes (or an active semester) to see how many you can still miss.'}${st.below ? ' <b style="color:#fca5a5">You are below your goal.</b>' : ''}</div>`;
      docEl('sdAttList').innerHTML = past.length ? past.slice(0, 120).map(s => {
        const cur = sdAttGet(s.c.id, s.date);
        return `<div class="sx-row"><div class="sx-d"><b>${sdFmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b><small>${sdT12(s.c.start_time)}${s.c.room ? ' · ' + escapeHtml(s.c.room) : ''}</small></div><div class="sx-set">${SD_ATT.map(([k, n, i, col]) => `<button type="button" data-sx-set="${s.c.id}|${c.id}|${s.date}|${k}" class="${cur && cur.status === k ? 'on' : ''}" style="--c:${col}" title="${n}" aria-label="${n}"><i class="fa-solid ${i}"></i></button>`).join('')}</div></div>`;
      }).join('') : '<div class="ls">No classes have taken place yet. They appear here once they have.</div>';
    }
    function sdAttOpen(courseId) { SDX.course = courseId; const c = sdCourse(courseId); if (!c) return; docEl('sdAttTarget').value = c.attendance_target != null ? c.attendance_target : 80; sdErr('sdAttError', ''); sdAttPaint(); sdOpen('sdAttOverlay'); }
    docEl('sdAttClose').onclick = () => sdClose('sdAttOverlay');
    docEl('sdAttOverlay').onclick = e => { if (e.target === docEl('sdAttOverlay')) sdClose('sdAttOverlay'); };
    docEl('sdAttTargetSave').onclick = async () => {
      const v = Math.round(Number(String(docEl('sdAttTarget').value).replace(',', '.'))); if (!(v >= 0 && v <= 100)) return sdErr('sdAttError', 'Enter a goal between 0 and 100.');
      const { data, error } = await LumaStudy.courses.update(SDX.course, { attendance_target: v });
      if (error) return sdErr('sdAttError', /attendance_target|schema cache/i.test(error.message) ? 'Run supabase/migrations/067_study_attendance_cards.sql in the SQL Editor first.' : error.message);
      Object.assign(sdCourse(SDX.course), data); sdErr('sdAttError', ''); sdAttPaint(); sdPaint(); flashToast('Goal saved', v + '% attendance', 'fa-bullseye', '#34d399');
    };

    // ---------- "what if I score…" ----------
    const SDW = { courseId: null, vals: {} };
    function sdWifOpen(courseId) {
      const c = sdCourse(courseId); if (!c) return; SDW.courseId = courseId; SDW.vals = {}; docEl('sdWifTitle').textContent = 'What if… · ' + c.name;
      const items = SD.tasks.filter(t => t.course_id === c.id && Number(t.weight) > 0);
      if (!items.length) { docEl('sdWifBody').innerHTML = '<div class="ls" style="line-height:1.55">Give this subject\'s assignments, tests and exams a weight (the % of the grade each is worth) and this calculator works out where you would end up.</div>'; docEl('sdWifOut').innerHTML = ''; sdOpen('sdWifOverlay'); return; }
      const now = sdGrade(c.id); const seed = now != null ? Math.round(now) : 70;
      items.filter(t => !(t.score != null && Number(t.max_score) > 0)).forEach(t => { SDW.vals[t.id] = String(seed); });
      const wAssigned = items.reduce((a, t) => a + Number(t.weight), 0); if (wAssigned < 99.99) SDW.vals.__rest = String(seed);
      sdWifPaint(true); sdOpen('sdWifOverlay');
    }
    function sdWifPaint(full) {
      const c = sdCourse(SDW.courseId); if (!c) return;
      const items = SD.tasks.filter(t => t.course_id === c.id && Number(t.weight) > 0), done = items.filter(t => t.score != null && Number(t.max_score) > 0), todo = items.filter(t => !(t.score != null && Number(t.max_score) > 0));
      const wDone = done.reduce((a, t) => a + Number(t.weight), 0), earned = done.reduce((a, t) => a + Number(t.score) / Number(t.max_score) * Number(t.weight), 0);
      const wRest = Math.max(0, 100 - items.reduce((a, t) => a + Number(t.weight), 0)), val = id => { const v = Number(String(SDW.vals[id] == null ? '' : SDW.vals[id]).replace(',', '.')); return isFinite(v) ? Math.max(0, Math.min(100, v)) : 0; };
      if (full) docEl('sdWifBody').innerHTML = (done.length ? `<div class="sx-wif-h">Already marked · ${sdPct(earned)} of ${sdPct(wDone)} points</div>${done.map(t => `<div class="sx-wif done"><span>${escapeHtml(t.title)}</span><b>${+t.score}/${+t.max_score} · ${+t.weight}%</b></div>`).join('')}` : '')
        + (todo.length || wRest > 0.01 ? '<div class="sx-wif-h">Still to come: what mark (%) will you get?</div>' : '')
        + todo.map(t => `<div class="sx-wif"><span>${escapeHtml(t.title)} <small>${+t.weight}%</small></span><input type="text" inputmode="decimal" data-wif="${t.id}" value="${escapeHtml(SDW.vals[t.id] || '')}" maxlength="5" autocomplete="off"></div>`).join('')
        + (wRest > 0.01 ? `<div class="sx-wif"><span>Everything else (e.g. the final exam) <small>${sdPct(wRest)}%</small></span><input type="text" inputmode="decimal" data-wif="__rest" value="${escapeHtml(SDW.vals.__rest || '')}" maxlength="5" autocomplete="off"></div>` : '');
      const proj = earned + todo.reduce((a, t) => a + Number(t.weight) * val(t.id) / 100, 0) + wRest * val('__rest') / 100, L = sdLetter(proj, c);
      const sem = c.semester_id, peers = SD.courses.filter(x => !x.archived && x.id !== c.id && x.semester_id === sem), before = sdGpa(peers.concat([c])), after = sdGpa(peers.concat([{ ...c, final_percent: proj }]));
      const tgt = c.target_percent != null ? Number(c.target_percent) : null;
      docEl('sdWifOut').innerHTML = `<div class="sx-big"><b>${sdPct(proj)}%</b><span>${L[1]} · ${Number(L[2]).toFixed(2)} points</span></div>${tgt != null ? `<div class="sx-note ${proj >= tgt ? 'ok' : 'warn'}"><i class="fa-solid fa-bullseye"></i> ${proj >= tgt ? `That reaches your ${tgt}% target.` : `${sdPct(tgt - proj)} points short of your ${tgt}% target.`}</div>` : ''}${after ? `<div class="ls" style="margin-top:8px">Semester GPA would be <b style="color:#fff">${after.gpa.toFixed(2)}</b>${before && c.final_percent == null ? ` (now ${before.gpa.toFixed(2)})` : ''}.</div>` : ''}`;
    }
    docEl('sdWifClose').onclick = () => sdClose('sdWifOverlay');
    docEl('sdWifOverlay').onclick = e => { if (e.target === docEl('sdWifOverlay')) sdClose('sdWifOverlay'); };
    docEl('sdWifBody').addEventListener('input', e => { const i = e.target.closest('[data-wif]'); if (!i) return; i.value = i.value.replace(/[^0-9.,]/g, '').slice(0, 5); SDW.vals[i.dataset.wif] = i.value; sdWifPaint(false); });

    // ---------- save the timetable and deadlines as a calendar file ----------
    async function sdExportIcs() {
      const sem = sdActiveSem(), today = sdKey(), BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'], evs = [];
      SD.classes.filter(c => !sdArchived(c.course_id) && !sdClassEnded(c)).forEach(c => {
        const co = sdCourse(c.course_id), start = c.start_date || (sem && sem.start_date) || today, end = c.end_date || (sem && sem.end_date) || null;
        let d = start; while (sdDow(d) !== c.weekday) d = sdAdd(d, 1); if (end && d > end) return;
        const ex = SD.skips.filter(x => x.class_id === c.id).map(x => x.skip_date);
        SD.breaks.forEach(b => { for (let k = b.start_date < d ? d : b.start_date, n = 0; k <= b.end_date && (!end || k <= end) && n < 400; k = sdAdd(k, 1), n++) if (sdDow(k) === c.weekday) ex.push(k); });
        evs.push({ uid: 'class-' + c.id, title: co ? co.name : 'Class', date: d, time: sdHM(c.start_time), endTime: sdHM(c.end_time), rrule: 'FREQ=WEEKLY;BYDAY=' + BY[c.weekday], until: end, exdates: [...new Set(ex)].filter(x => x >= d), loc: c.room || '', desc: (SD_CLASS_KINDS.find(x => x[0] === c.kind) || [])[1] || '', alarm: 15 });
      });
      const open = sdLiveTasks().filter(t => t.status !== 'done' && t.due_date);
      open.forEach(t => { const co = sdCourse(t.course_id), hm = t.due_time ? sdHM(t.due_time) : null; evs.push({ uid: 'task-' + t.id, title: `${sdKind(t.kind)[1]}: ${t.title}${co ? ' (' + co.name + ')' : ''}`, date: t.due_date, time: hm, endTime: hm ? sdHM(sdMinToHM(sdMin(hm) + 60)) : null, allDay: !hm, desc: t.notes || '', alarm: hm ? 60 : 1440 }); });
      if (!evs.length) return luAlert('There is nothing to export yet. Add your classes and assignments first.');
      const nC = evs.filter(e => e.rrule).length;
      if (!await luConfirm({ title: 'Export your timetable', message: `${nC} weekly class${nC === 1 ? '' : 'es'} (with your cancelled days and breaks left out) and ${evs.length - nC} deadline${evs.length - nC === 1 ? '' : 's'} are saved in one .ics file. Open it on your phone or computer to add them to Google, Apple or Outlook Calendar. It is a copy: later changes in LUMA are not sent to it.`, ok: 'Download', icon: 'fa-file-export', tone: 'info' })) return;
      luIcs.download('LUMA-study.ics', luIcs.build(evs, 'LUMA Study')); flashToast('Timetable saved', 'LUMA-study.ics', 'fa-file-export', '#34d399');
    }
    const sdMinToHM = m => String(Math.min(23, Math.floor(m / 60))).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

    // "Export my data" also includes what these add
    { const base = sdExport; sdExport = async function () { const out = await base(); const get = async p => { try { const r = await p; return r && !r.error ? r.data : null; } catch (e) { return null; } }; out.attendance = await get(LumaStudy.attendance.list()); out.flashcard_decks = await get(LumaStudy.decks.list()); out.flashcards = await get(LumaStudy.cards.list()); return out; }; }
