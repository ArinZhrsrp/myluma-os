// LUMA — module: study (group projects)
    // Invite classmates from your contacts, split the work into tasks, keep shared notes and nudge a teammate.
    // Everything goes through database functions that check who is asking: supabase/migrations/054_study_groups.sql.
    // Invited classmates can use this tab even without the Study add-on (the organiser covers it).
    const SDG = { list: [], loaded: false, err: null, d: null, id: null, guests: new Map() };
    SD_VIEW.groups = sdGroupsView; SD_ONSHOW.groups = sdGroupsLoad; SD_ADD.groups = ['New project', () => openProjNew()];

    async function sdGroupsLoad() {
      try { const r = await LumaStudy.groups.list(); SDG.err = r.error ? r.error.message : null; SDG.list = r.data || []; } catch (e) { SDG.err = e.message || 'Could not load'; }
      SDG.loaded = true; if (SD.tab === 'groups') sdPaint();
    }
    function sdGroupsView() {
      if (!SDG.loaded) return '<div class="ls" style="padding:10px 2px">Loading…</div>';
      if (SDG.err) return card(`<div class="ls">Could not load your group projects: ${escapeHtml(SDG.err)}. ${/study_project|schema cache|does not exist|my_study_projects/i.test(SDG.err) ? 'Has <b>supabase/migrations/054_study_groups.sql</b> been run in the Supabase SQL Editor?' : ''}</div>`);
      const invites = SDG.list.filter(p => p.my_status === 'pending'), mine = SDG.list.filter(p => p.my_status === 'accepted' && !(p.semester_id && sdSem(p.semester_id) && sdSem(p.semester_id).archived_at));
      const inv = invites.map(p => `<div class="card sd-invite"><i class="fa-solid fa-people-group"></i><div class="bd"><b>${escapeHtml(p.owner_name)} invited you to “${escapeHtml(p.title)}”</b><small>${p.course_name ? escapeHtml(p.course_name) + ' · ' : ''}${p.due_date ? 'due ' + sdShort(p.due_date) : 'no due date'}</small></div><button type="button" class="confirm-btn cancel" data-gp-no="${p.id}">Decline</button><button type="button" class="confirm-btn save" data-gp-yes="${p.id}">Join</button></div>`).join('');
      const cards = mine.length ? `<div class="grid-2">${mine.map(p => { const pct = p.tasks_total ? Math.round(p.tasks_done / p.tasks_total * 100) : 0, d = p.due_date ? sdDiff(sdKey(), p.due_date) : null;
        return `<div class="card sd-proj" data-proj="${p.id}"><div class="sp-h"><b>${escapeHtml(p.title)}</b>${p.course_name ? `<span class="sd-cc"><i></i>${escapeHtml(p.course_name)}</span>` : ''}</div>
          <div class="sp-m"><span><i class="fa-solid fa-user-group"></i> ${p.members}</span><span><i class="fa-solid fa-crown"></i> ${LUMA_USER && p.owner_id === LUMA_USER.id ? 'You' : escapeHtml(p.owner_name)}</span>${p.due_date ? `<span class="${d < 0 ? 'over' : d <= 3 ? 'soon' : ''}"><i class="fa-regular fa-calendar"></i> ${d < 0 ? -d + ' days overdue' : d === 0 ? 'Due today' : 'Due ' + sdShort(p.due_date)}</span>` : ''}</div>
          <div class="sd-bar" style="--c:#34d399;margin:10px 0 0"><div class="sb-h"><span>${p.tasks_done} of ${p.tasks_total} tasks done</span><b>${pct}%</b></div><div class="sb-t"><i style="width:${pct}%"></i></div></div></div>`; }).join('')}</div>`
        : (invites.length ? '' : card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-people-group"></i></div><div class="h-empty-t">Group projects</div><div class="h-empty-s">Start a project, invite classmates from your contacts, split the work into tasks and keep shared notes in one place.</div>${'<div class="h-empty-chips"><button type="button" class="h-chip" data-gp-new><i class="fa-solid fa-plus" style="color:#34d399"></i>New project</button></div>'}</div>`));
      return inv + cards;
    }
    SD_CLICK.push(e => {
      const yes = e.target.closest('[data-gp-yes]'); if (yes) { sdRespondProject(yes.dataset.gpYes, true); return true; }
      const no = e.target.closest('[data-gp-no]'); if (no) { sdRespondProject(no.dataset.gpNo, false); return true; }
      if (e.target.closest('[data-gp-new]')) { openProjNew(); return true; }
      const p = e.target.closest('[data-proj]'); if (p) { sdOpenProject(p.dataset.proj); return true; }
      return false;
    });
    async function sdRespondProject(id, accept) {
      const { error } = await LumaStudy.groups.respond(id, accept); if (error) return luAlert('Could not send your reply: ' + error.message);
      await sdGroupsLoad(); if (accept) { flashToast('You joined the project', '', 'fa-check', '#22c55e'); sdOpenProject(id); }
    }

    // ----- create -----
    function paintNewGuests() {
      docEl('sdProjNewGuests').innerHTML = [...SDG.guests].map(([id, nm]) => `<span class="cal-gchip new"><i class="fa-solid fa-paper-plane"></i>${escapeHtml(nm)}<button type="button" data-un="${id}" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
    }
    function openProjNew() {
      if (!sdGuest() && !sdActiveSem()) { sdNeedSem(); return; } // a classmate without the Study add-on can start projects too (up to 3)
      SDG.guests = new Map(); docEl('sdProjNewTitle').value = ''; docEl('sdProjNewCourse').value = ''; docEl('sdProjNewDue').value = ''; docEl('sdProjNewDue')._luDateRefresh && docEl('sdProjNewDue')._luDateRefresh();
      docEl('sdProjCourses').innerHTML = SD.courses.filter(c => !c.archived).map(c => `<option value="${escapeHtml(c.name)}">`).join('');
      sdErr('sdProjNewError', ''); paintNewGuests(); sdOpen('sdProjNewOverlay'); setTimeout(() => docEl('sdProjNewTitle').focus(), 50);
    }
    docEl('sdProjNewClose').onclick = () => sdClose('sdProjNewOverlay');
    docEl('sdProjNewOverlay').onclick = e => { if (e.target === docEl('sdProjNewOverlay')) sdClose('sdProjNewOverlay'); const un = e.target.closest('[data-un]'); if (un) { SDG.guests.delete(un.dataset.un); paintNewGuests(); } };
    docEl('sdProjNewPick').onclick = async () => { const got = await sdPickContacts({ title: 'Invite classmates', selected: SDG.guests }); if (got) { SDG.guests = got; paintNewGuests(); } };
    docEl('sdProjNewSave').onclick = async () => {
      const title = docEl('sdProjNewTitle').value.trim(); if (!title) return sdErr('sdProjNewError', 'Give the project a name.');
      sdErr('sdProjNewError', ''); sdBtn('sdProjNewSave', true);
      const r = await LumaStudy.groups.create(title, docEl('sdProjNewCourse').value.trim(), docEl('sdProjNewDue').value, '');
      if (r.error) { sdBtn('sdProjNewSave', false, 'Create project'); return sdErr('sdProjNewError', /create_study_project|schema cache|does not exist/i.test(r.error.message) ? 'Group projects aren\'t set up yet — run supabase/migrations/054_study_groups.sql.' : r.error.message); }
      let inviteErr = '';
      if (SDG.guests.size) { const iv = await LumaStudy.groups.invite(r.data, [...SDG.guests.keys()]); if (iv.error) inviteErr = iv.error.message; }
      sdBtn('sdProjNewSave', false, 'Create project'); sdClose('sdProjNewOverlay');
      await sdGroupsLoad(); sdOpenProject(r.data);
      if (inviteErr) luAlert('The project was created, but the invitations could not be sent: ' + inviteErr);
    };

    // ----- one project -----
    const sdMe = () => (LUMA_USER && LUMA_USER.id) || '';
    async function sdOpenProject(id) {
      SDG.id = id; sdErr('sdProjError', '');
      const r = await LumaStudy.groups.detail(id); if (r.error) return luAlert('Could not open the project: ' + r.error.message);
      SDG.d = r.data; paintProj(true); sdOpen('sdProjOverlay');
      if (SDG.d.me.status === 'accepted') { sdLoadComments(); sdLoadFiles(); }
    }
    function paintProj(fill) {
      const d = SDG.d; if (!d) return; const owner = d.project.owner_id === sdMe(), pending = d.me.status === 'pending';
      docEl('sdProjHead').textContent = d.project.title;
      docEl('sdProjPending').style.display = pending ? '' : 'none'; docEl('sdProjMain').style.display = pending ? 'none' : '';
      docEl('sdProjSave').style.display = pending ? 'none' : ''; docEl('sdProjDelete').style.display = owner ? '' : 'none'; docEl('sdProjLeave').style.display = !owner && !pending ? '' : 'none';
      if (pending) {
        const ow = d.members.find(m => m.user_id === d.project.owner_id);
        docEl('sdProjPending').innerHTML = `<div class="sd-invite" style="margin:0"><i class="fa-solid fa-people-group"></i><div class="bd"><b>${escapeHtml((ow || {}).name || 'Someone')} invited you to this project</b><small>${d.project.course_name ? escapeHtml(d.project.course_name) + ' · ' : ''}${d.project.due_date ? 'due ' + sdShort(d.project.due_date) : 'no due date'}. Join to see the tasks and notes.</small></div><button type="button" class="confirm-btn cancel" data-gp-no="${d.project.id}">Decline</button><button type="button" class="confirm-btn save" data-gp-yes="${d.project.id}">Join</button></div>`;
        return;
      }
      if (fill) {
        docEl('sdProjTitle').value = d.project.title; docEl('sdProjCourse').value = d.project.course_name || ''; docEl('sdProjDue').value = d.project.due_date || ''; docEl('sdProjNotes').value = d.project.notes || '';
        docEl('sdProjDue')._luDateRefresh && docEl('sdProjDue')._luDateRefresh();
      }
      ['sdProjTitle', 'sdProjCourse'].forEach(i => { docEl(i).readOnly = !owner; }); docEl('sdProjDue').disabled = !owner; const dw = docEl('sdProjDue')._luWrap || docEl('sdProjDue').nextElementSibling; if (dw && dw.classList) dw.classList.toggle('plan-locked', !owner);
      docEl('sdProjInvite').style.display = owner ? '' : 'none';
      const acc = d.members.filter(m => m.status === 'accepted');
      docEl('sdProjTeam').innerHTML = d.members.map(m => `<div class="sd-mem ${m.status}"><span class="av">${escapeHtml((m.name[0] || '?').toUpperCase())}</span><span class="nm">${escapeHtml(m.name)}${m.user_id === d.project.owner_id ? ' <i class="fa-solid fa-crown" title="Organiser"></i>' : ''}${m.user_id === sdMe() ? ' <small>(you)</small>' : ''}${m.status === 'pending' ? ' <small>invited</small>' : ''}</span>${m.user_id !== sdMe() && m.status === 'accepted' ? `<button type="button" data-nudge="${m.user_id}" title="Nudge ${escapeHtml(m.name)}"><i class="fa-solid fa-hand"></i></button>` : ''}${owner && m.user_id !== sdMe() ? `<button type="button" data-kick="${m.user_id}" title="Remove from the project" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`).join('');
      docEl('sdProjTaskWho').innerHTML = '<option value="">Anyone</option>' + acc.map(m => `<option value="${m.user_id}">${escapeHtml(m.name)}${m.user_id === sdMe() ? ' (you)' : ''}</option>`).join('');
      const tasksHtml = d.tasks.length ? d.tasks.map(t => { const done = t.status === 'done'; return `<div class="sd-ptask ${done ? 'done' : ''}" data-pt="${t.id}"><button type="button" class="sd-check ${done ? 'on' : ''}" data-pt-check="${t.id}" title="${done ? 'Mark as not done' : 'Mark as done'}"><i class="fa-solid fa-check"></i></button><span class="tt">${escapeHtml(t.title)}</span><span class="due ${t.due_date && t.status !== 'done' && t.due_date < sdKey() ? 'over' : ''}"><input type="text" data-pt-due="${t.id}" value="${t.due_date || ''}" aria-label="Due date">${t.due_date ? `<button type="button" class="ic" data-pt-clear="${t.id}" title="Remove the due date" aria-label="Remove the due date"><i class="fa-solid fa-xmark"></i></button>` : ''}</span><select data-pt-who="${t.id}" aria-label="Assigned to"><option value="">Anyone</option>${acc.map(m => `<option value="${m.user_id}" ${m.user_id === t.assignee_id ? 'selected' : ''}>${escapeHtml(m.name)}${m.user_id === sdMe() ? ' (you)' : ''}</option>`).join('')}</select>${t.assignee_id && t.assignee_id !== sdMe() && !done ? `<button type="button" class="ic" data-pt-nudge="${t.id}" data-who="${t.assignee_id}" title="Nudge about this task"><i class="fa-solid fa-hand"></i></button>` : ''}<button type="button" class="ic" data-pt-del="${t.id}" title="Delete task" aria-label="Delete task"><i class="fa-solid fa-xmark"></i></button></div>`; }).join('') : '<div class="ls" style="padding:2px 0 6px">No tasks yet. Add the first one below and give it to someone.</div>';
      docEl('sdProjTasks').innerHTML = tasksHtml; docEl('sdProjTasks').querySelectorAll('select').forEach(skinSelect); docEl('sdProjTasks').querySelectorAll('input[data-pt-due]').forEach(i => { skinDate(i); i._luDateRefresh && i._luDateRefresh(); }); skinSelect(docEl('sdProjTaskWho'));
    }
    const sdAgo = iso => { const s = (Date.now() - Date.parse(iso)) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : sdShort(mytDayKey(iso)); };
    async function sdLoadComments() {
      const r = await LumaStudy.groups.comments(SDG.id); if (r.error) return;
      const owner = SDG.d && SDG.d.project.owner_id === sdMe();
      docEl('sdProjComments').innerHTML = (r.data || []).length ? r.data.map(c => `<div class="sd-cmt"><span class="av">${escapeHtml((c.name[0] || '?').toUpperCase())}</span><div class="bd"><div class="h"><b>${escapeHtml(c.name)}${c.user_id === sdMe() ? ' <small>(you)</small>' : ''}</b><small>${sdAgo(c.created_at)}</small>${c.user_id === sdMe() || owner ? `<button type="button" data-cmt-del="${c.id}" title="Delete" aria-label="Delete"><i class="fa-solid fa-xmark"></i></button>` : ''}</div><p>${escapeHtml(c.body)}</p></div></div>`).join('') : '<div class="ls" style="padding:4px 0">No comments yet.</div>';
    }
    async function sdLoadFiles() {
      const r = await LumaStudy.groups.files(SDG.id); if (r.error) return;
      const owner = SDG.d && SDG.d.project.owner_id === sdMe();
      docEl('sdProjFiles').innerHTML = (r.data || []).length ? r.data.map(f => `<div class="sd-file"><i class="fa-solid fa-file"></i><button type="button" class="nm" data-file-open="${escapeHtml(f.storage_path)}">${escapeHtml(f.name)}</button><small>${LumaDocuments.formatSize(Number(f.size_bytes || 0))} · ${escapeHtml(f.added_by_name)}</small>${f.added_by === sdMe() || owner ? `<button type="button" class="ic" data-file-del="${f.id}" title="Remove from the project" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`).join('') : '<div class="ls" style="padding:2px 0">No files attached.</div>';
    }
    docEl('sdProjAttach').onclick = () => docEl('sdProjFile').click();
    docEl('sdProjFile').onchange = async () => {
      const file = docEl('sdProjFile').files[0]; docEl('sdProjFile').value = ''; if (!file) return;
      const b = docEl('sdProjAttach'); b.disabled = true; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading…'; sdErr('sdProjError', '');
      try {
        const up = await LumaDocuments.upload(file); if (up.error) throw new Error(up.error.message);
        const at = await LumaStudy.groups.attach(SDG.id, up.data.id); if (at.error) throw new Error(at.error.message);
      } catch (e) { sdErr('sdProjError', 'Could not attach the file: ' + e.message); }
      b.disabled = false; b.innerHTML = '<i class="fa-solid fa-paperclip"></i> Attach a file'; sdLoadFiles();
    };
    docEl('sdProjCmtSend').onclick = async () => {
      const t = docEl('sdProjCmtText').value.trim(); if (!t) return; sdErr('sdProjError', '');
      const r = await LumaStudy.groups.addComment(SDG.id, t); if (r.error) return sdErr('sdProjError', r.error.message);
      docEl('sdProjCmtText').value = ''; sdLoadComments();
    };
    docEl('sdProjCmtText').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); docEl('sdProjCmtSend').click(); } });
    async function sdReloadProject() { const r = await LumaStudy.groups.detail(SDG.id); if (!r.error) { SDG.d = r.data; paintProj(false); } else sdErr('sdProjError', r.error.message); sdGroupsLoad(); }
    docEl('sdProjClose').onclick = () => sdClose('sdProjOverlay');
    docEl('sdProjOverlay').onclick = async e => {
      if (e.target === docEl('sdProjOverlay')) return sdClose('sdProjOverlay');
      const yes = e.target.closest('[data-gp-yes]'); if (yes) { sdClose('sdProjOverlay'); return sdRespondProject(yes.dataset.gpYes, true); }
      const no = e.target.closest('[data-gp-no]'); if (no) { sdClose('sdProjOverlay'); return sdRespondProject(no.dataset.gpNo, false); }
      const chk = e.target.closest('[data-pt-check]'); if (chk) { const t = SDG.d.tasks.find(x => x.id === chk.dataset.ptCheck); const r = await LumaStudy.groups.updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' }); if (r.error) sdErr('sdProjError', r.error.message); return sdReloadProject(); }
      const clr = e.target.closest('[data-pt-clear]'); if (clr) { const r = await LumaStudy.groups.updateTask(clr.dataset.ptClear, { due_date: null }); if (r.error) sdErr('sdProjError', r.error.message); return sdReloadProject(); }
      const cdel = e.target.closest('[data-cmt-del]'); if (cdel) { const r = await LumaStudy.groups.removeComment(cdel.dataset.cmtDel); if (r.error) sdErr('sdProjError', r.error.message); return sdLoadComments(); }
      const fdel = e.target.closest('[data-file-del]'); if (fdel) { if (!await luConfirm({ title: 'Remove this file from the project?', message: 'Your teammates can no longer open it. The file stays in your Documents.', ok: 'Remove', icon: 'fa-paperclip', tone: 'info' })) return; const r = await LumaStudy.groups.detach(fdel.dataset.fileDel); if (r.error) sdErr('sdProjError', r.error.message); return sdLoadFiles(); }
      const fopen = e.target.closest('[data-file-open]'); if (fopen) { const r = await LumaDocuments.signedUrl({ storage_path: fopen.dataset.fileOpen }); if (r.error || !r.url) return sdErr('sdProjError', 'Could not open the file: ' + ((r.error && r.error.message) || 'no link')); return void window.open(r.url, '_blank', 'noopener'); }
      const del = e.target.closest('[data-pt-del]'); if (del) { const r = await LumaStudy.groups.removeTask(del.dataset.ptDel); if (r.error) sdErr('sdProjError', r.error.message); return sdReloadProject(); }
      const nt = e.target.closest('[data-pt-nudge]'); if (nt) return sdNudge(nt.dataset.who, nt.dataset.ptNudge);
      const nu = e.target.closest('[data-nudge]'); if (nu) return sdNudge(nu.dataset.nudge, null);
      const kick = e.target.closest('[data-kick]'); if (kick) {
        const m = SDG.d.members.find(x => x.user_id === kick.dataset.kick);
        if (!await luConfirm({ title: `Remove ${m ? m.name : 'this person'}?`, message: 'They leave the project and their tasks become unassigned.', ok: 'Remove', icon: 'fa-user-minus', tone: 'info' })) return;
        const r = await LumaStudy.groups.leave(SDG.id, kick.dataset.kick); if (r.error) sdErr('sdProjError', r.error.message); return sdReloadProject();
      }
    };
    docEl('sdProjTasks').addEventListener('change', async e => {
      const due = e.target.closest('input[data-pt-due]'); if (due) { const r = await LumaStudy.groups.updateTask(due.dataset.ptDue, { due_date: due.value || null }); if (r.error) sdErr('sdProjError', r.error.message); return sdReloadProject(); }
      const w = e.target.closest('select[data-pt-who]'); if (!w) return;
      const r = await LumaStudy.groups.updateTask(w.dataset.ptWho, { assignee_id: w.value || null }); if (r.error) sdErr('sdProjError', r.error.message); sdReloadProject();
    });
    async function sdNudge(userId, taskId) {
      const r = await LumaStudy.groups.nudge(SDG.id, userId, taskId); const m = SDG.d.members.find(x => x.user_id === userId);
      if (r.error) return sdErr('sdProjError', r.error.message);
      flashToast(r.data === 'sent' ? 'Nudge sent' : 'Already nudged recently', r.data === 'sent' ? (m ? m.name : '') : 'You can nudge the same person again after a few hours', r.data === 'sent' ? 'fa-hand' : 'fa-clock', r.data === 'sent' ? '#22c55e' : '#fbbf24');
    }
    async function sdAddProjTask() {
      const title = docEl('sdProjTaskTitle').value.trim(); if (!title) return;
      sdErr('sdProjError', ''); const r = await LumaStudy.groups.addTask(SDG.id, title, docEl('sdProjTaskWho').value, docEl('sdProjTaskDue').value || null);
      if (r.error) return sdErr('sdProjError', r.error.message);
      docEl('sdProjTaskTitle').value = ''; docEl('sdProjTaskDue').value = ''; docEl('sdProjTaskDue')._luDateRefresh && docEl('sdProjTaskDue')._luDateRefresh(); sdReloadProject();
    }
    docEl('sdProjTaskAdd').onclick = sdAddProjTask;
    docEl('sdProjTaskTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sdAddProjTask(); } });
    docEl('sdProjInvite').onclick = async () => {
      const got = await sdPickContacts({ title: 'Invite classmates', exclude: new Set(SDG.d.members.map(m => m.user_id)) }); if (!got || !got.size) return;
      const r = await LumaStudy.groups.invite(SDG.id, [...got.keys()]); if (r.error) return sdErr('sdProjError', r.error.message);
      flashToast('Invitations sent', [...got.values()].join(', '), 'fa-paper-plane', '#22c55e'); sdReloadProject();
    };
    docEl('sdProjSave').onclick = async () => {
      const owner = SDG.d.project.owner_id === sdMe(), title = docEl('sdProjTitle').value.trim();
      if (owner && !title) return sdErr('sdProjError', 'The project needs a name.');
      const fields = owner ? { title, course_name: docEl('sdProjCourse').value.trim(), due_date: docEl('sdProjDue').value || null, notes: docEl('sdProjNotes').value } : { notes: docEl('sdProjNotes').value };
      sdErr('sdProjError', ''); sdBtn('sdProjSave', true); const r = await LumaStudy.groups.update(SDG.id, fields); sdBtn('sdProjSave', false, 'Save');
      if (r.error) return sdErr('sdProjError', r.error.message);
      sdClose('sdProjOverlay'); sdGroupsLoad(); flashToast('Project saved', '', 'fa-check', '#22c55e');
    };
    docEl('sdProjDelete').onclick = async () => {
      if (!await luConfirm({ title: `Delete “${SDG.d.project.title}”?`, message: 'The project, its tasks and notes are removed for everyone on the team. This can\'t be undone.' })) return;
      const r = await LumaStudy.groups.remove(SDG.id); if (r.error) return sdErr('sdProjError', r.error.message);
      sdClose('sdProjOverlay'); sdGroupsLoad();
    };
    docEl('sdProjLeave').onclick = async () => {
      if (!await luConfirm({ title: 'Leave this project?', message: 'You are taken off the team and your tasks become unassigned. The organiser is not asked.', ok: 'Leave project', icon: 'fa-right-from-bracket', tone: 'info' })) return;
      const r = await LumaStudy.groups.leave(SDG.id, sdMe()); if (r.error) return sdErr('sdProjError', r.error.message);
      sdClose('sdProjOverlay'); sdGroupsLoad();
    };
