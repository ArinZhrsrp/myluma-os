// LUMA — module: studyarchive (the Study → Archive page)
    // Every semester you archived ("Done with this semester") lives here, with all its details: subjects and marks, timetable, assignments and notes.
    // Open one to look back; Restore brings the semester and its subjects back to your Study page. Subjects archived on their own are under "Archived subjects".
    const SA = { sem: null, tab: 'subjects' }; // sem: a semester id, '__none' (subjects archived on their own) or null (the list)
    const SA_TABS = [['subjects', 'Subjects', 'fa-book'], ['timetable', 'Timetable', 'fa-calendar-week'], ['assignments', 'Assignments', 'fa-list-check'], ['notes', 'Notes', 'fa-note-sticky']];

    MODULES.studyarchive = function () {
      return head('Study archive', '<span id="saSub">Loading…</span>', `<div id="saBack" style="display:none"><button type="button" class="create-btn" id="saBackBtn"><i class="fa-solid fa-arrow-left"></i> All semesters</button></div>`) + '<div id="saRoot"><div class="ls" style="padding:10px 2px">Loading…</div></div>';
    };
    // the subjects shown for the archived semester being looked at
    const saCourses = () => SA.sem === '__none' ? SD.courses.filter(c => c.archived && !(c.semester_id && sdSem(c.semester_id) && sdSem(c.semester_id).archived_at)) : SD.courses.filter(c => c.semester_id === SA.sem);
    const saDateRange = sem => `${sdShort(sem.start_date)} to ${sdFmtDate(sem.end_date, { day: 'numeric', month: 'short', year: 'numeric' })}`;

    function saPaint() {
      const root = document.getElementById('saRoot'), sub = document.getElementById('saSub'); if (!root) return;
      const back = document.getElementById('saBack'); back.style.display = SA.sem ? '' : 'none';
      if (SD.err) { sub.textContent = 'Could not load'; root.innerHTML = card(`<div class="ls">Could not load your study data: ${escapeHtml(SD.err)}</div>`); return; }
      const sems = SD.semesters.filter(x => x.archived_at).sort((a, b) => b.end_date.localeCompare(a.end_date));
      const loose = SD.courses.filter(c => c.archived && !(c.semester_id && sdSem(c.semester_id) && sdSem(c.semester_id).archived_at));
      if (SA.sem && SA.sem !== '__none' && !sdSem(SA.sem)) SA.sem = null;
      if (!SA.sem) {
        sub.textContent = sems.length || loose.length ? `${sems.length} archived semester${sems.length === 1 ? '' : 's'}${loose.length ? ` · ${loose.length} archived subject${loose.length === 1 ? '' : 's'}` : ''}` : 'Finished semesters live here';
        if (!sems.length && !loose.length) { root.innerHTML = card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-box-archive"></i></div><div class="h-empty-t">Nothing archived yet</div><div class="h-empty-s">When a semester is over, open Study → Semesters and choose <b>Done with this semester</b>. Its subjects, timetable, assignments and marks are kept here, and you can open them any time.</div><div class="h-empty-chips"><button type="button" class="h-chip" data-sa-go="study"><i class="fa-solid fa-calendar-days" style="color:#34d399"></i>Go to Semesters</button></div></div>`); return; }
        const cardFor = (sem, courses) => { const ids = courses.map(c => c.id), tasks = SD.tasks.filter(t => ids.includes(t.course_id)), done = tasks.filter(t => t.status === 'done').length, g = sdGpa(courses);
          return `<div class="card sd-sem sd-arch" data-sa-open="${sem ? sem.id : '__none'}"><div class="sm-top"><div class="sm-main"><div class="sm-t">${sem ? escapeHtml(sem.name) : 'Archived subjects'}</div><div class="sm-s">${sem ? `${saDateRange(sem)} · archived ${sdShort(mytDayKey(sem.archived_at))}` : 'Subjects archived on their own, not with a semester'}</div></div><div class="sm-gpa"><b>${g ? g.gpa.toFixed(2) : '—'}</b><span>GPA</span></div><span class="sa-go"><i class="fa-solid fa-chevron-right"></i></span></div>
            <div class="sm-subj"><span class="sd-pill">${courses.length} subject${courses.length === 1 ? '' : 's'}</span><span class="sd-pill">${SD.classes.filter(k => ids.includes(k.course_id)).length} classes</span><span class="sd-pill">${done} of ${tasks.length} assignments done</span>${g ? `<span class="sd-pill">${g.credits} credit hours</span>` : ''}</div></div>`; };
        root.innerHTML = sems.map(sem => cardFor(sem, SD.courses.filter(c => c.semester_id === sem.id))).join('') + (loose.length ? cardFor(null, loose) : '');
        return;
      }
      const sem = SA.sem === '__none' ? null : sdSem(SA.sem), courses = saCourses(), ids = courses.map(c => c.id), g = sdGpa(courses);
      sub.textContent = sem ? `${sem.name} · ${saDateRange(sem)}` : 'Archived subjects';
      const tasks = SD.tasks.filter(t => ids.includes(t.course_id)), classes = SD.classes.filter(k => ids.includes(k.course_id));
      const tiles = `<div class="sd-tiles"><div class="sd-tile" style="--c:#34d399"><i class="fa-solid fa-award"></i><div><b>${g ? g.gpa.toFixed(2) : '—'}</b><span>GPA</span></div></div><div class="sd-tile" style="--c:#60a5fa"><i class="fa-solid fa-book"></i><div><b>${courses.length}</b><span>Subjects</span></div></div><div class="sd-tile" style="--c:#a78bfa"><i class="fa-solid fa-list-check"></i><div><b>${tasks.filter(t => t.status === 'done').length}/${tasks.length}</b><span>Assignments done</span></div></div><div class="sd-tile" style="--c:#fbbf24"><i class="fa-solid fa-layer-group"></i><div><b>${g ? g.credits : 0}</b><span>Credit hours</span></div></div></div>`;
      const tabs = `<div class="sd-tabs sa-tabs">${SA_TABS.map(([k, n, i]) => `<button type="button" data-sa-tab="${k}" class="${SA.tab === k ? 'on' : ''}"><i class="fa-solid ${i}"></i><span>${n}</span></button>`).join('')}<button type="button" class="sa-restore" data-sa-restore><i class="fa-solid fa-rotate-left"></i><span>Restore</span></button></div>`;
      let body = '';
      if (SA.tab === 'subjects') body = courses.length ? `<div class="grid-2">${courses.map(sdCourseCard).join('')}</div>` : '<div class="ls" style="padding:8px 2px">No subjects.</div>';
      else if (SA.tab === 'timetable') {
        body = classes.length ? `<div class="sd-week">${SD_DAYS.map(([d, n]) => { const list = classes.filter(k => k.weekday === d).sort((a, b) => sdHM(a.start_time).localeCompare(sdHM(b.start_time))); return `<div class="sd-day"><div class="sd-dh"><span>${n}</span></div>${list.length ? list.map(sdClassCard).join('') : '<div class="sd-free">Free</div>'}</div>`; }).join('')}</div>` : '<div class="ls" style="padding:8px 2px">No classes were on the timetable.</div>';
        const brks = sem ? SD.breaks.filter(b => b.end_date >= sem.start_date && b.start_date <= sem.end_date) : [];
        if (brks.length) body += `<div class="sd-endednote ls">Breaks in this semester: ${brks.map(b => `${escapeHtml(b.name)} (${sdShort(b.start_date)}${b.end_date !== b.start_date ? ' to ' + sdShort(b.end_date) : ''})`).join(', ')}</div>`;
      } else if (SA.tab === 'assignments') {
        body = tasks.length ? courses.map(c => { const list = tasks.filter(t => t.course_id === c.id).sort((a, b) => (b.due_date || '').localeCompare(a.due_date || '')); return list.length ? card(`<div class="section-title"><span class="sc-dot" style="--c:${c.color};background:${c.color};width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:8px"></span>${escapeHtml(c.name)} <span class="sd-count">${list.length}</span></div>${list.map(sdRow).join('')}`) : ''; }).join('') + (tasks.some(t => !t.course_id) ? '' : '') : '<div class="ls" style="padding:8px 2px">No assignments.</div>';
      } else {
        body = SDN.loaded ? sdArchiveNotes(ids) : '<div class="ls" style="padding:8px 2px">Loading…</div>';
      }
      root.innerHTML = tiles + tabs + body;
    }
    function sdArchiveNotes(ids) {
      const list = SDN.notes.filter(n => ids.includes(n.course_id));
      return list.length ? `<div class="grid-2">${list.map(n => `<div class="card sd-note" data-sa-note="${n.id}"><div class="sn-h"><b>${escapeHtml(n.title)}</b>${sdCC(sdCourse(n.course_id))}</div><p>${escapeHtml(sdSnippet(n.body)) || '<span class="ls">Empty note</span>'}</p><small>Updated ${sdShort(mytDayKey(n.updated_at))}</small></div>`).join('')}</div>` : '<div class="ls" style="padding:8px 2px">No notes for these subjects.</div>';
    }
    WIRE.studyarchive = async function (pg) {
      pg.querySelector('#saBackBtn').addEventListener('click', () => { SA.sem = null; saPaint(); });
      pg.querySelector('#saRoot').addEventListener('click', async e => {
        const go = e.target.closest('[data-sa-go]'); if (go) return goTo(go.dataset.saGo);
        const open = e.target.closest('[data-sa-open]'); if (open) { SA.sem = open.dataset.saOpen; SA.tab = 'subjects'; saPaint(); const r = document.getElementById('saRoot'); if (r) r.scrollTop = 0; return; }
        const tab = e.target.closest('[data-sa-tab]'); if (tab) { SA.tab = tab.dataset.saTab; saPaint(); if (SA.tab === 'notes' && !SDN.loaded) { await sdNotesLoad(); saPaint(); } return; }
        if (e.target.closest('[data-sa-restore]')) {
          if (SA.sem === '__none') { const ids = saCourses().map(c => c.id); if (!await luConfirm({ title: `Restore ${ids.length} subject${ids.length === 1 ? '' : 's'}?`, message: 'They come back to your timetable, Calendar and reminders.', ok: 'Restore', icon: 'fa-rotate-left', tone: 'info' })) return; const err = await sdSetCoursesArchived(ids, false); if (err) luAlert('Could not restore: ' + err); SA.sem = null; return saPaint(); }
          const sem = sdSem(SA.sem); if (!sem) return;
          if (!await luConfirm({ title: `Restore “${sem.name}”?`, message: 'The semester and its subjects come back to your Study page, timetable, Calendar and reminders.', ok: 'Restore semester', icon: 'fa-rotate-left', tone: 'info' })) return;
          await sdRestoreSemester(sem.id); SA.sem = null; return saPaint();
        }
        const note = e.target.closest('[data-sa-note]'); if (note) return openNoteModal(SDN.notes.find(x => x.id === note.dataset.saNote));
        const cls = e.target.closest('[data-cls]'); if (cls) return openClassModal(SD.classes.find(x => x.id === cls.dataset.cls));
        const row = e.target.closest('[data-task]'); if (row && !e.target.closest('[data-check]')) return openTaskModal(SD.tasks.find(x => x.id === row.dataset.task));
        const chk = e.target.closest('[data-check]'); if (chk) return sdToggleDone(chk.dataset.check);
        const co = e.target.closest('[data-course]'); if (co) return openCourseModal(sdCourse(co.dataset.course));
      });
      if (!sdGuest()) await sdLoad(); saPaint();
    };
