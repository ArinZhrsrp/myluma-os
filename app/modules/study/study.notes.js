// LUMA — module: study (notes per subject, shareable with your contacts)
    // Your own notes for a subject; share one with accepted contacts and they can read it (only you can edit). Notes shared with you
    // are listed under "Shared with me". Tables and functions: supabase/migrations/053_study_notes.sql.
    const SDN = { notes: [], shared: [], loaded: false, err: null, course: '', editId: null, shares: [], add: new Map(), remove: new Set(), viewId: null };
    SD_VIEW.notes = sdNotesView; SD_ONSHOW.notes = sdNotesLoad; SD_ADD.notes = ['New note', () => openNoteModal(null)];

    async function sdNotesLoad() {
      try {
        const [n, sh] = await Promise.all([LumaStudy.notes.list(), LumaStudy.notes.shared()]);
        SDN.err = n.error ? n.error.message : null; SDN.notes = (n.data || []).slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)); SDN.shared = sh.error ? [] : (sh.data || []);
      } catch (e) { SDN.err = e.message || 'Could not load'; }
      SDN.loaded = true; if (SD.tab === 'notes') sdPaint();
    }
    const sdSnippet = t => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    function sdNotesView() {
      if (!SDN.loaded) return '<div class="ls" style="padding:10px 2px">Loading…</div>';
      if (SDN.err) return card(`<div class="ls">Could not load your notes: ${escapeHtml(SDN.err)}. ${/study_notes|schema cache|does not exist/i.test(SDN.err) ? 'Has <b>supabase/migrations/053_study_notes.sql</b> been run in the Supabase SQL Editor?' : ''}</div>`);
      const chips = SD.courses.length ? `<div class="sd-filters"><div class="sd-subj"><button type="button" data-ncourse="" class="${SDN.course === '' ? 'on' : ''}">All subjects</button>${SD.courses.filter(c => !c.archived).map(c => `<button type="button" data-ncourse="${c.id}" class="${SDN.course === c.id ? 'on' : ''}" style="--c:${c.color}"><i></i>${escapeHtml(c.name)}</button>`).join('')}</div></div>` : '';
      const list = SDN.notes.filter(n => !SDN.course || n.course_id === SDN.course);
      const mine = list.length ? `<div class="grid-2">${list.map(n => { const c = sdCourse(n.course_id); return `<div class="card sd-note" data-note="${n.id}"><div class="sn-h"><b>${escapeHtml(n.title)}</b>${sdCC(c)}</div><p>${escapeHtml(sdSnippet(n.body)) || '<span class="ls">Empty note</span>'}</p><small>Updated ${sdShort(mytDayKey(n.updated_at))}</small></div>`; }).join('')}</div>`
        : card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-note-sticky"></i></div><div class="h-empty-t">${SDN.notes.length ? 'No notes for this subject' : 'Keep your study notes here'}</div><div class="h-empty-s">Write notes per subject, and share them with classmates from your contacts.</div><div class="h-empty-chips"><button type="button" class="h-chip" data-note-new><i class="fa-solid fa-plus" style="color:#34d399"></i>New note</button></div></div>`);
      const shared = SDN.shared.length ? `<div class="sd-gh" style="margin-top:18px"><b>Shared with me</b><span>${SDN.shared.length}</span></div><div class="grid-2">${SDN.shared.map(n => `<div class="card sd-note shared" data-shared="${n.id}"><div class="sn-h"><b>${escapeHtml(n.title)}</b>${n.course_name ? `<span class="sd-cc"><i></i>${escapeHtml(n.course_name)}</span>` : ''}</div><p>${escapeHtml(sdSnippet(n.body))}</p><small><i class="fa-solid fa-user-group"></i> From ${escapeHtml(n.owner_name)}</small></div>`).join('')}</div>` : '';
      return chips + mine + shared;
    }
    SD_CLICK.push(e => {
      const nc = e.target.closest('[data-ncourse]'); if (nc) { SDN.course = nc.dataset.ncourse; sdPaint(); return true; }
      if (e.target.closest('[data-note-new]')) { openNoteModal(null); return true; }
      const n = e.target.closest('[data-note]'); if (n) { openNoteModal(SDN.notes.find(x => x.id === n.dataset.note)); return true; }
      const sh = e.target.closest('[data-shared]'); if (sh) { openSharedNote(sh.dataset.shared); return true; }
      return false;
    });

    // ----- write / edit a note -----
    function paintNoteShares() {
      docEl('sdNoteShareSig').value = JSON.stringify([[...SDN.add.keys()], [...SDN.remove]]); docEl('sdNoteShareSig').dispatchEvent(new Event('input', { bubbles: true })); // so Save notices a changed share list
      docEl('sdNoteShares').innerHTML = SDN.shares.filter(x => !SDN.remove.has(x.user_id)).map(x => `<span class="cal-gchip"><i class="fa-solid fa-eye" style="font-size:0.62rem;color:#a7f3d0"></i>${escapeHtml(x.name)}<button type="button" data-rm="${x.user_id}" aria-label="Stop sharing"><i class="fa-solid fa-xmark"></i></button></span>`).join('')
        + [...SDN.add].map(([id, nm]) => `<span class="cal-gchip new"><i class="fa-solid fa-paper-plane"></i>${escapeHtml(nm)}<button type="button" data-un="${id}" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
    }
    function openNoteModal(n) {
      SDN.editId = n ? n.id : null; SDN.shares = []; SDN.add = new Map(); SDN.remove = new Set();
      docEl('sdNoteHead').textContent = n ? 'Edit note' : 'New note';
      docEl('sdNoteTitle').value = n ? n.title : ''; docEl('sdNoteBody').value = n ? n.body || '' : '';
      sdCourseOptions('sdNoteCourse', n ? n.course_id : (SDN.course || null), true);
      docEl('sdNoteDelete').style.display = n ? '' : 'none'; sdErr('sdNoteError', ''); paintNoteShares();
      if (n) LumaStudy.notes.sharedWith(n.id).then(r => { if (!r.error && SDN.editId === n.id) { SDN.shares = r.data || []; paintNoteShares(); } });
      sdOpen('sdNoteOverlay'); setTimeout(() => docEl('sdNoteTitle').focus(), 50);
    }
    docEl('sdNoteClose').onclick = () => sdClose('sdNoteOverlay');
    docEl('sdNoteOverlay').onclick = e => { if (e.target === docEl('sdNoteOverlay')) sdClose('sdNoteOverlay'); };
    docEl('sdNoteShares').onclick = e => {
      const rm = e.target.closest('[data-rm]'); if (rm) { SDN.remove.add(rm.dataset.rm); return paintNoteShares(); }
      const un = e.target.closest('[data-un]'); if (un) { SDN.add.delete(un.dataset.un); paintNoteShares(); }
    };
    docEl('sdNoteShareBtn').onclick = async () => {
      const got = await sdPickContacts({ title: 'Share with', selected: SDN.add, exclude: new Set(SDN.shares.filter(x => !SDN.remove.has(x.user_id)).map(x => x.user_id)) });
      if (got) { SDN.add = got; paintNoteShares(); }
    };
    docEl('sdNoteSave').onclick = async () => {
      const title = docEl('sdNoteTitle').value.trim(); if (!title) return sdErr('sdNoteError', 'Give the note a title.');
      const fields = { title, body: docEl('sdNoteBody').value, course_id: docEl('sdNoteCourse').value || null };
      sdErr('sdNoteError', ''); sdBtn('sdNoteSave', true);
      const { data, error } = SDN.editId ? await LumaStudy.notes.update(SDN.editId, fields) : await LumaStudy.notes.add(fields);
      sdBtn('sdNoteSave', false, 'Save note');
      if (error) return sdErr('sdNoteError', /study_notes|schema cache|does not exist/i.test(error.message) ? 'Notes aren\'t set up yet — run supabase/migrations/053_study_notes.sql in the SQL Editor.' : sdHint(error.message));
      let shareErr = '';
      for (const uid of SDN.remove) { const r = await LumaStudy.notes.unshare(data.id, uid); if (r.error) shareErr = r.error.message; }
      if (SDN.add.size) { const r = await LumaStudy.notes.share(data.id, [...SDN.add.keys()]); if (r.error) shareErr = r.error.message; else flashToast('Note shared', [...SDN.add.values()].join(', '), 'fa-paper-plane', '#22c55e'); }
      const i = SDN.notes.findIndex(x => x.id === data.id); if (i >= 0) SDN.notes[i] = data; else SDN.notes.unshift(data);
      SDN.notes.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      sdClose('sdNoteOverlay'); sdAfterSave();
      if (shareErr) luAlert('The note was saved, but sharing did not fully work: ' + shareErr);
    };
    docEl('sdNoteDelete').onclick = async () => {
      const n = SDN.notes.find(x => x.id === SDN.editId); if (!n) return;
      if (!await luConfirm({ title: `Delete “${n.title}”?`, message: 'It is removed for you and for everyone you shared it with. This can\'t be undone.' })) return;
      const { error } = await LumaStudy.notes.remove(n.id); if (error) return sdErr('sdNoteError', error.message);
      SDN.notes = SDN.notes.filter(x => x !== n); sdClose('sdNoteOverlay'); sdAfterSave();
    };
    async function sdOpenNoteById(id) { if (!SDN.loaded) await sdNotesLoad(); const n = SDN.notes.find(x => x.id === id); if (n) openNoteModal(n); }

    // ----- a note someone shared with me (read only) -----
    function openSharedNote(id) {
      const n = SDN.shared.find(x => x.id === id); if (!n) return; SDN.viewId = id;
      docEl('sdNoteViewHead').textContent = n.title;
      docEl('sdNoteViewMeta').innerHTML = `<i class="fa-solid fa-user-group"></i> From ${escapeHtml(n.owner_name)}${n.course_name ? ' · ' + escapeHtml(n.course_name) : ''} · updated ${sdShort(mytDayKey(n.updated_at))}`;
      docEl('sdNoteViewBody').textContent = n.body || '(empty)'; sdOpen('sdNoteViewOverlay');
    }
    docEl('sdNoteViewClose').onclick = () => sdClose('sdNoteViewOverlay');
    docEl('sdNoteViewOverlay').onclick = e => { if (e.target === docEl('sdNoteViewOverlay')) sdClose('sdNoteViewOverlay'); };
    docEl('sdNoteViewRemove').onclick = async () => {
      const n = SDN.shared.find(x => x.id === SDN.viewId); if (!n) return;
      if (!await luConfirm({ title: 'Remove this shared note?', message: `“${n.title}” is taken off your list. ${n.owner_name} keeps it.`, ok: 'Remove', icon: 'fa-user-group', tone: 'info' })) return;
      const { error } = await LumaStudy.notes.unshare(n.id, LUMA_USER.id); if (error) return luAlert('Could not remove it: ' + error.message);
      SDN.shared = SDN.shared.filter(x => x !== n); sdClose('sdNoteViewOverlay'); sdPaint();
    };
