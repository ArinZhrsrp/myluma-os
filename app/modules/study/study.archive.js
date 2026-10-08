// LUMA — module: studyarchive (the Study → Archive page)
    // Every semester you archived ("Done with this semester") lives here, with all its details: subjects and marks, timetable, assignments and notes.
    // Open one to look back; Restore brings the semester and its subjects back to your Study page. Subjects archived on their own are under "Archived subjects".
    const SA = { sem: null, tab: 'subjects', other: null }; // sem: a semester id, '__none' (subjects archived on their own) or null (the list)
    const SA_TABS = [['subjects', 'Subjects', 'fa-book'], ['timetable', 'Timetable', 'fa-calendar-week'], ['assignments', 'Assignments', 'fa-list-check'], ['notes', 'Notes', 'fa-note-sticky'], ['groups', 'Groups', 'fa-user-group'], ['other', 'Other', 'fa-layer-group']];

    MODULES.studyarchive = function () {
      SA.sem = null; SA.tab = 'subjects'; SA.other = null; // opening the archive from the menu starts on the list of semesters
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
          return `<div class="card sd-sem sd-arch" data-sa-open="${sem ? sem.id : '__none'}"><div class="sm-top"><div class="sm-main"><div class="sm-t">${sem ? escapeHtml(sem.name) : 'Archived subjects'}</div><div class="sm-s">${sem ? `${saDateRange(sem)} · archived ${sdShort(mytDayKey(sem.archived_at))}` : 'Subjects archived on their own, not with a semester'}</div>${sem && sem.remark ? `<div class="sa-rm">“${escapeHtml(sem.remark.length > 110 ? sem.remark.slice(0, 110) + '…' : sem.remark)}”</div>` : ''}</div><div class="sm-gpa"><b>${g ? g.gpa.toFixed(2) : '—'}</b><span>GPA</span></div><span class="sa-go"><i class="fa-solid fa-chevron-right"></i></span></div>
            <div class="sm-subj"><span class="sd-pill">${courses.length} subject${courses.length === 1 ? '' : 's'}</span><span class="sd-pill">${SD.classes.filter(k => ids.includes(k.course_id)).length} classes</span><span class="sd-pill">${done} of ${tasks.length} assignments done</span>${g ? `<span class="sd-pill">${g.credits} credit hours</span>` : ''}</div></div>`; };
        root.innerHTML = sems.map(sem => cardFor(sem, SD.courses.filter(c => c.semester_id === sem.id))).join('') + (loose.length ? cardFor(null, loose) : '');
        return;
      }
      const sem = SA.sem === '__none' ? null : sdSem(SA.sem), courses = saCourses(), ids = courses.map(c => c.id), g = sdGpa(courses);
      sub.textContent = sem ? `${sem.name} · ${saDateRange(sem)}` : 'Archived subjects';
      const tasks = SD.tasks.filter(t => ids.includes(t.course_id)), classes = SD.classes.filter(k => ids.includes(k.course_id));
      const tiles = `<div class="sd-tiles"><div class="sd-tile" style="--c:#34d399"><i class="fa-solid fa-award"></i><div><b>${g ? g.gpa.toFixed(2) : '—'}</b><span>GPA</span></div></div><div class="sd-tile" style="--c:#60a5fa"><i class="fa-solid fa-book"></i><div><b>${courses.length}</b><span>Subjects</span></div></div><div class="sd-tile" style="--c:#a78bfa"><i class="fa-solid fa-list-check"></i><div><b>${tasks.filter(t => t.status === 'done').length}/${tasks.length}</b><span>Assignments done</span></div></div><div class="sd-tile" style="--c:#fbbf24"><i class="fa-solid fa-layer-group"></i><div><b>${g ? g.credits : 0}</b><span>Credit hours</span></div></div></div>`;
      const tabs = `<div class="sd-tabs sa-tabs">${SA_TABS.map(([k, n, i]) => `<button type="button" data-sa-tab="${k}" class="${SA.tab === k ? 'on' : ''}"><i class="fa-solid ${i}"></i><span>${n}</span></button>`).join('')}<button type="button" class="sa-restore" data-sa-restore><i class="fa-solid fa-rotate-left"></i><span>Restore</span></button><button type="button" class="sa-delete" data-sa-delete title="Delete for good"><i class="fa-regular fa-trash-can"></i><span>Delete permanently</span></button></div>`;
      const remark = sem ? `<div class="sa-remark"><i class="fa-regular fa-comment-dots"></i><div><b>Your remark</b><p>${sem.remark ? escapeHtml(sem.remark) : '<span class="ls">No remark yet.</span>'}</p></div><button type="button" class="np-btn" data-sa-remark>${sem.remark ? 'Edit' : 'Add'} remark</button></div>` : '';
      let body = '';
      if (SA.tab === 'subjects') body = courses.length ? `<div class="grid-2">${courses.map(sdCourseCard).join('')}</div>` : '<div class="ls" style="padding:8px 2px">No subjects.</div>';
      else if (SA.tab === 'timetable') {
        body = classes.length ? `<div class="sd-week">${SD_DAYS.map(([d, n]) => { const list = classes.filter(k => k.weekday === d).sort((a, b) => sdHM(a.start_time).localeCompare(sdHM(b.start_time))); return `<div class="sd-day"><div class="sd-dh"><span>${n}</span></div>${list.length ? list.map(sdClassCard).join('') : '<div class="sd-free">Free</div>'}</div>`; }).join('')}</div>` : '<div class="ls" style="padding:8px 2px">No classes were on the timetable.</div>';
        const brks = sem ? SD.breaks.filter(b => b.end_date >= sem.start_date && b.start_date <= sem.end_date) : [];
        if (brks.length) body += `<div class="sd-endednote ls">Breaks in this semester: ${brks.map(b => `${escapeHtml(b.name)} (${sdShort(b.start_date)}${b.end_date !== b.start_date ? ' to ' + sdShort(b.end_date) : ''})`).join(', ')}</div>`;
      } else if (SA.tab === 'assignments') {
        body = tasks.length ? courses.map(c => { const list = tasks.filter(t => t.course_id === c.id).sort((a, b) => (b.due_date || '').localeCompare(a.due_date || '')); return list.length ? card(`<div class="section-title"><span class="sc-dot" style="--c:${c.color};background:${c.color};width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:8px"></span>${escapeHtml(c.name)} <span class="sd-count">${list.length}</span></div>${list.map(sdRow).join('')}`) : ''; }).join('') + (tasks.some(t => !t.course_id) ? '' : '') : '<div class="ls" style="padding:8px 2px">No assignments.</div>';
      } else if (SA.tab === 'notes') {
        body = SDN.loaded ? sdArchiveNotes(ids) : '<div class="ls" style="padding:8px 2px">Loading…</div>';
      } else if (SA.tab === 'groups') {
        const gl = sem ? SDG.list.filter(p => p.semester_id === sem.id) : [];
        body = !SDG.loaded ? '<div class="ls" style="padding:8px 2px">Loading…</div>' : gl.length ? `<div class="grid-2">${gl.map(p => `<div class="card sd-proj" data-proj="${p.id}"><div class="sp-h"><b>${escapeHtml(p.title)}</b>${p.course_name ? `<span class="sd-cc"><i></i>${escapeHtml(p.course_name)}</span>` : ''}</div><div class="sp-m"><span><i class="fa-solid fa-user-group"></i> ${p.members}</span><span>${p.tasks_done} of ${p.tasks_total} tasks done</span>${p.due_date ? `<span><i class="fa-regular fa-calendar"></i> ${sdShort(p.due_date)}</span>` : ''}</div></div>`).join('')}</div>` : '<div class="ls" style="padding:8px 2px">No group projects were made in this semester.</div>';
      } else {
        body = !sem ? '<div class="ls" style="padding:8px 2px">Nothing here.</div>' : (SA.other && SA.other.semId === sem.id) ? saOtherHtml(SA.other.data) : '<div class="ls" style="padding:8px 2px">Loading…</div>';
      }
      root.innerHTML = remark + tiles + tabs + body;
    }
    // events, reminders, tasks, notes and documents you added while this semester was active (the shared filter normally hides them; here it is switched off)
    async function saLoadOther(semId) {
      const db = () => LumaAuth.client.schema('luma'), out = {};
      if (typeof LumaSpace !== 'undefined') LumaSpace.bypass = true;
      const q = (t, cols) => db().from(t).select(cols).eq('semester_id', semId).limit(200);
      const ps = { events: q('events', 'id, title, event_date'), reminders: q('reminders', 'id, title, start_date, kind'), tasks: q('tasks', 'id, title, due_date, status'), notes: q('notes', 'id, title'), documents: q('documents', 'id, name') };
      if (typeof LumaSpace !== 'undefined') LumaSpace.bypass = false;
      for (const k of Object.keys(ps)) { try { const r = await ps[k]; out[k] = r.error ? [] : (r.data || []); } catch (e) { out[k] = []; } }
      SA.other = { semId, data: out };
    }
    function saOtherHtml(d) {
      const sec = (label, icon, rows, f) => rows.length ? card(`<div class="section-title"><i class="fa-solid ${icon}"></i> ${label} <span class="sd-count">${rows.length}</span></div>${rows.map(f).join('')}`) : '';
      const row = (t, sub) => `<div class="sd-row" style="cursor:default"><div class="sd-rb"><div class="sd-rt">${escapeHtml(t || '(no title)')}</div>${sub ? `<div class="sd-rm">${sub}</div>` : ''}</div></div>`;
      const html = sec('Calendar events', 'fa-calendar', d.events, e => row(e.title, e.event_date ? sdFmtDate(e.event_date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''))
        + sec('Reminders (switched off)', 'fa-bell-concierge', d.reminders, r => row(r.title, r.start_date ? sdShort(r.start_date) : ''))
        + sec('Tasks', 'fa-square-check', d.tasks, t => row(t.title, (t.status === 'done' ? 'Done' : 'Open') + (t.due_date ? ' · due ' + sdShort(t.due_date) : '')))
        + sec('Notes', 'fa-note-sticky', d.notes, n => row(n.title, ''))
        + sec('Documents', 'fa-file', d.documents, x => row(x.name, ''));
      return html || '<div class="ls" style="padding:8px 2px">Nothing else was added in this semester.</div>';
    }
    function sdArchiveNotes(ids) {
      const list = SDN.notes.filter(n => ids.includes(n.course_id));
      return list.length ? `<div class="grid-2">${list.map(n => `<div class="card sd-note" data-sa-note="${n.id}"><div class="sn-h"><b>${escapeHtml(n.title)}</b>${sdCC(sdCourse(n.course_id))}</div><p>${escapeHtml(sdSnippet(n.body)) || '<span class="ls">Empty note</span>'}</p><small>Updated ${sdShort(mytDayKey(n.updated_at))}</small></div>`).join('')}</div>` : '<div class="ls" style="padding:8px 2px">No notes for these subjects.</div>';
    }
    // delete for good: a semester with everything in it (or the subjects archived on their own). Two steps, because it cannot be undone.
    async function saDeleteForever() {
      const none = SA.sem === '__none', sem = none ? null : sdSem(SA.sem), courses = saCourses(), ids = courses.map(c => c.id);
      const name = sem ? sem.name : 'these subjects';
      if (!none) await saLoadOther(SA.sem);
      const o = (SA.other && SA.other.data) || {}, tk = SD.tasks.filter(t => ids.includes(t.course_id) || (sem && t.semester_id === sem.id)), cl = SD.classes.filter(k => ids.includes(k.course_id)), nt = SDN.notes.filter(n => ids.includes(n.course_id) || (sem && n.semester_id === sem.id));
      const extra = [['event', o.events], ['reminder', o.reminders], ['task', o.tasks], ['note', o.notes], ['document (file)', o.documents]].filter(([, l]) => l && l.length).map(([k, l]) => `${l.length} ${k}${l.length === 1 ? '' : 's'}`);
      const list = [`${courses.length} subject${courses.length === 1 ? '' : 's'}`, `${cl.length} class${cl.length === 1 ? '' : 'es'}`, `${tk.length} assignment${tk.length === 1 ? '' : 's'}`, ...(nt.length ? [`${nt.length} note${nt.length === 1 ? '' : 's'}`] : []), ...extra];
      if (!await luConfirm({ title: `Delete ${sem ? '“' + sem.name + '”' : 'these subjects'} permanently?`, message: `This removes ${list.join(', ')}${sem ? ', and the group projects you own in it' : ''}. Your GPA will no longer count them. This can\'t be undone.`, ok: 'Continue', icon: 'fa-trash-can', tone: 'danger' })) return;
      const typed = await luPrompt({ title: 'Type DELETE to confirm', message: `Nothing in ${name} can be brought back.`, placeholder: 'DELETE', ok: 'Delete forever', icon: 'fa-trash-can', tone: 'danger' }); if (typed == null) return;
      if (typed.trim().toUpperCase() !== 'DELETE') return luAlert('Nothing was deleted: you did not type DELETE.');
      try {
        if (none) { // subjects archived on their own: their assignments first, then the subjects (classes go with them)
          for (const t of tk) { const r = await LumaStudy.tasks.remove(t.id); if (r.error) throw new Error(r.error.message); }
          for (const id of ids) { const r = await LumaStudy.courses.remove(id); if (r.error) throw new Error(r.error.message); }
        } else {
          if (typeof LumaSpace !== 'undefined') LumaSpace.bypass = true; // read the archived documents so their files are deleted too
          const dq = LumaAuth.client.schema('luma').from('documents').select('id, storage_path').eq('semester_id', sem.id);
          if (typeof LumaSpace !== 'undefined') LumaSpace.bypass = false;
          const docs = (await dq).data || [];
          for (const d of docs) { const r = await LumaDocuments.remove(d); if (r.error) throw new Error(r.error.message); }
          const r = await LumaStudy.semesters.destroy(sem.id); if (r.error) throw new Error(/could not find the function|schema cache/i.test(r.error.message) ? 'Run supabase/migrations/057_delete_archived_semester.sql in the SQL Editor first.' : r.error.message);
        }
      } catch (e) { return luAlert('Could not delete everything: ' + (e.message || e)); }
      SA.sem = null; SA.other = null; SDN.loaded = false; SDG.loaded = false;
      await sdLoad(); saPaint(); flashToast('Deleted permanently', name, 'fa-trash-can', '#f87171');
    }
    WIRE.studyarchive = async function (pg) {
      pg.querySelector('#saBackBtn').addEventListener('click', () => { SA.sem = null; saPaint(); });
      pg.querySelector('#saRoot').addEventListener('click', async e => {
        const go = e.target.closest('[data-sa-go]'); if (go) { if (go.dataset.saGo === 'study') { SD.tab = 'semesters'; SD.keepTab = true; } return goTo(go.dataset.saGo); }
        const open = e.target.closest('[data-sa-open]'); if (open) { SA.sem = open.dataset.saOpen; SA.tab = 'subjects'; saPaint(); const r = document.getElementById('saRoot'); if (r) r.scrollTop = 0; return; }
        const tab = e.target.closest('[data-sa-tab]'); if (tab) {
          SA.tab = tab.dataset.saTab; saPaint();
          if (SA.tab === 'notes' && !SDN.loaded) { await sdNotesLoad(); saPaint(); }
          if (SA.tab === 'groups' && !SDG.loaded) { await sdGroupsLoad(); saPaint(); }
          if (SA.tab === 'other' && SA.sem && SA.sem !== '__none' && !(SA.other && SA.other.semId === SA.sem)) { await saLoadOther(SA.sem); saPaint(); }
          return;
        }
        if (e.target.closest('[data-sa-remark]')) {
          const sem = sdSem(SA.sem); if (!sem) return;
          const v = await luPrompt({ title: 'Remark', message: `Your remark for ${sem.name}`, value: sem.remark || '', placeholder: 'e.g. Finished with a 3.6 GPA', ok: 'Save' }); if (v == null) return;
          const r = await LumaStudy.semesters.update(sem.id, { remark: v.trim().slice(0, 1000) }); if (r.error) return luAlert('Could not save the remark: ' + r.error.message);
          const i = SD.semesters.findIndex(x => x.id === sem.id); if (i >= 0) SD.semesters[i] = r.data; return saPaint();
        }
        const proj = e.target.closest('[data-proj]'); if (proj) return sdOpenProject(proj.dataset.proj);
        if (e.target.closest('[data-sa-delete]')) return saDeleteForever();
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
