// LUMA — module: study (notes per subject, shareable with your contacts)
    // Your own notes for a subject, with simple formatting (bold, lists, links…). Share a note with accepted contacts and choose whether they can
    // read it or edit it too; attach files they can open. Notes shared with you are listed under "Shared with me" (editable ones open for editing).
    // Tables and functions: supabase/migrations/053 + 059.
    const SDN = { notes: [], shared: [], loaded: false, err: null, course: '', editId: null, mode: 'own', shares: [], add: new Map(), perm: 'read', remove: new Set(), viewId: null, previewing: false };
    SD_VIEW.notes = sdNotesView; SD_ONSHOW.notes = sdNotesLoad; SD_ADD.notes = ['New note', () => openNoteModal(null)];

    // ---------- a small formatter: **bold**, *italic*, `code`, # headings, - lists, 1. lists, - [ ] checklists, [links](https://…) ----------
    function sdMd(src) {
      const inline = t => escapeHtml(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>').replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      let out = '', list = null, para = [];
      const flush = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
      const close = () => { if (list) { out += `</${list}>`; list = null; } };
      String(src || '').replace(/\r/g, '').split('\n').forEach(line => {
        let m;
        if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { flush(); close(); out += `<h${m[1].length + 2}>${inline(m[2])}</h${m[1].length + 2}>`; }
        else if ((m = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/.exec(line))) { flush(); if (list !== 'ul') { close(); out += '<ul class="chk">'; list = 'ul'; } out += `<li><i class="fa-regular ${m[1] === ' ' ? 'fa-square' : 'fa-square-check'}"></i> ${inline(m[2])}</li>`; }
        else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) { flush(); if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(m[1])}</li>`; }
        else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) { flush(); if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
        else if (!line.trim()) { flush(); close(); }
        else { close(); para.push(line); }
      });
      flush(); close(); return out || '<p class="ls">(empty)</p>';
    }
    const sdPlain = t => String(t || '').replace(/[#*`>\[\]]|\(https?:[^)]*\)|^\s*[-\d.)]+\s/gm, '').replace(/\s+/g, ' ').trim();

    async function sdNotesLoad() {
      try {
        const [n, sh] = await Promise.all([LumaStudy.notes.list(), LumaStudy.notes.shared()]);
        SDN.err = n.error ? n.error.message : null; SDN.notes = (n.data || []).slice().sort((a, b) => b.updated_at.localeCompare(a.updated_at)); SDN.shared = sh.error ? [] : (sh.data || []);
      } catch (e) { SDN.err = e.message || 'Could not load'; }
      SDN.loaded = true; if (SD.tab === 'notes') sdPaint();
    }
    const sdSnippet = t => sdPlain(t).slice(0, 140);
    function sdNotesView() {
      if (!SDN.loaded) return '<div class="ls" style="padding:10px 2px">Loading…</div>';
      if (SDN.err) return card(`<div class="ls">Could not load your notes: ${escapeHtml(SDN.err)}. ${/study_notes|schema cache|does not exist/i.test(SDN.err) ? 'Has <b>supabase/migrations/053_study_notes.sql</b> been run in the Supabase SQL Editor?' : ''}</div>`);
      const chips = SD.courses.length ? `<div class="sd-filters"><div class="sd-subj"><button type="button" data-ncourse="" class="${SDN.course === '' ? 'on' : ''}">All subjects</button>${SD.courses.filter(c => !c.archived).map(c => `<button type="button" data-ncourse="${c.id}" class="${SDN.course === c.id ? 'on' : ''}" style="--c:${c.color}"><i></i>${escapeHtml(c.name)}</button>`).join('')}</div></div>` : '';
      const list = SDN.notes.filter(n => (!SDN.course || n.course_id === SDN.course) && !(n.semester_id && sdSem(n.semester_id) && sdSem(n.semester_id).archived_at));
      const mine = list.length ? `<div class="grid-2">${list.map(n => { const c = sdCourse(n.course_id); return `<div class="card sd-note" data-note="${n.id}"><div class="sn-h"><b>${escapeHtml(n.title)}</b>${sdCC(c)}</div><p>${escapeHtml(sdSnippet(n.body)) || '<span class="ls">Empty note</span>'}</p><small>Updated ${sdShort(mytDayKey(n.updated_at))}</small></div>`; }).join('')}</div>`
        : card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-note-sticky"></i></div><div class="h-empty-t">${SDN.notes.length ? 'No notes for this subject' : 'Keep your study notes here'}</div><div class="h-empty-s">Write notes per subject, and share them with classmates from your contacts.</div><div class="h-empty-chips"><button type="button" class="h-chip" data-note-new><i class="fa-solid fa-plus" style="color:#34d399"></i>New note</button></div></div>`);
      const shared = SDN.shared.length ? `<div class="sd-gh" style="margin-top:18px"><b>Shared with me</b><span>${SDN.shared.length}</span></div><div class="grid-2">${SDN.shared.map(n => `<div class="card sd-note shared" data-shared="${n.id}"><div class="sn-h"><b>${escapeHtml(n.title)}</b>${n.course_name ? `<span class="sd-cc"><i></i>${escapeHtml(n.course_name)}</span>` : ''}</div><p>${escapeHtml(sdSnippet(n.body))}</p><small><i class="fa-solid fa-user-group"></i> From ${escapeHtml(n.owner_name)} · ${n.can_edit ? '<i class="fa-solid fa-pen"></i> you can edit' : '<i class="fa-solid fa-eye"></i> read only'}</small></div>`).join('')}</div>` : '';
      return chips + mine + shared;
    }
    SD_CLICK.push(e => {
      const nc = e.target.closest('[data-ncourse]'); if (nc) { SDN.course = nc.dataset.ncourse; sdPaint(); return true; }
      if (e.target.closest('[data-note-new]')) { openNoteModal(null); return true; }
      const n = e.target.closest('[data-note]'); if (n) { openNoteModal(SDN.notes.find(x => x.id === n.dataset.note)); return true; }
      const sh = e.target.closest('[data-shared]'); if (sh) { openSharedNote(sh.dataset.shared); return true; }
      return false;
    });

    // ---------- files on a note (opened and attached the same way as in group projects) ----------
    function sdFileRows(rows, canRemove, attr) {
      return rows.length ? rows.map(f => `<div class="sd-file"><i class="fa-solid fa-file"></i><button type="button" class="nm" data-nfile-open="${escapeHtml(f.storage_path)}">${escapeHtml(f.name)}</button><small>${LumaDocuments.formatSize(Number(f.size_bytes || 0))}</small>${canRemove ? `<button type="button" class="ic" data-nfile-del="${f.id}" title="Remove from the note" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`).join('') : '<div class="ls" style="padding:2px 0">No files attached.</div>';
    }
    async function sdNoteFiles(id, boxId, canRemove) { const r = await LumaStudy.notes.files(id); if (r.error) return; docEl(boxId).innerHTML = sdFileRows(r.data || [], canRemove); }
    async function sdOpenNoteFile(path) { const r = await LumaDocuments.signedUrl({ storage_path: path }); if (r.error || !r.url) return luAlert('Could not open the file: ' + ((r.error && r.error.message) || 'no link')); window.open(r.url, '_blank', 'noopener'); }

    // ---------- the editor ----------
    const sdPermChips = () => sdChips('sdNotePerm', [['read', 'Can read', 'fa-eye'], ['edit', 'Can edit', 'fa-pen']], SDN.perm, 'np');
    function paintNoteShares() {
      docEl('sdNoteShareSig').value = JSON.stringify([[...SDN.add.keys()], [...SDN.remove], SDN.shares.map(x => x.can_edit), SDN.perm]); docEl('sdNoteShareSig').dispatchEvent(new Event('input', { bubbles: true })); // so Save notices a changed share list
      docEl('sdNoteShares').innerHTML = SDN.shares.filter(x => !SDN.remove.has(x.user_id)).map(x => `<span class="cal-gchip"><i class="fa-solid ${x.can_edit ? 'fa-pen' : 'fa-eye'}" style="font-size:0.62rem;color:#a7f3d0"></i>${escapeHtml(x.name)}<button type="button" class="pm" data-perm="${x.user_id}" title="${x.can_edit ? 'Can edit: tap to make read only' : 'Can read: tap to let them edit'}">${x.can_edit ? 'edit' : 'read'}</button><button type="button" data-rm="${x.user_id}" aria-label="Stop sharing"><i class="fa-solid fa-xmark"></i></button></span>`).join('')
        + [...SDN.add].map(([id, nm]) => `<span class="cal-gchip new"><i class="fa-solid fa-paper-plane"></i>${escapeHtml(nm)} <small>${SDN.perm === 'edit' ? 'can edit' : 'can read'}</small><button type="button" data-un="${id}" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
    }
    function sdNotePreview(on) {
      SDN.previewing = on; docEl('sdNoteBody').style.display = on ? 'none' : ''; docEl('sdNotePreview').style.display = on ? '' : 'none';
      if (on) docEl('sdNotePreview').innerHTML = sdMd(docEl('sdNoteBody').value);
      docEl('sdNotePrev').innerHTML = on ? '<i class="fa-solid fa-pen"></i> Edit' : '<i class="fa-regular fa-eye"></i> Preview';
      docEl('sdNoteBar').querySelectorAll('[data-md]').forEach(b => { b.disabled = on; });
    }
    // formatting buttons: wrap the selected text, or put a mark at the start of the selected lines
    function sdMdApply(kind) {
      const ta = docEl('sdNoteBody'), a = ta.selectionStart, b = ta.selectionEnd, v = ta.value, sel = v.slice(a, b);
      let out, from = a, to = b;
      const wrap = (l, r, ph) => { out = l + (sel || ph) + r; from = a + l.length; to = from + (sel || ph).length; };
      if (kind === 'b') wrap('**', '**', 'bold'); else if (kind === 'i') wrap('*', '*', 'italic');
      else if (kind === 'a') { out = '[' + (sel || 'link text') + '](https://)'; from = a + out.length - 9; to = a + out.length - 1; }
      else { // line marks
        const ls = v.lastIndexOf('\n', a - 1) + 1, le = b === a || v[b - 1] !== '\n' ? (v.indexOf('\n', b) < 0 ? v.length : v.indexOf('\n', b)) : b, block = v.slice(ls, le).split('\n');
        const mark = kind === 'h' ? i => '## ' : kind === 'ul' ? i => '- ' : kind === 'ol' ? i => (i + 1) + '. ' : i => '- [ ] ';
        const txt = block.map((l, i) => mark(i) + l).join('\n'); ta.value = v.slice(0, ls) + txt + v.slice(le); ta.setSelectionRange(ls, ls + txt.length); ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true })); return;
      }
      ta.value = v.slice(0, a) + out + v.slice(b); ta.setSelectionRange(from, to); ta.focus(); ta.dispatchEvent(new Event('input', { bubbles: true }));
    }
    docEl('sdNoteBar').onclick = e => { const b = e.target.closest('[data-md]'); if (b && !b.disabled) sdMdApply(b.dataset.md); };
    docEl('sdNotePrev').onclick = () => sdNotePreview(!SDN.previewing);

    function openNoteModal(n) {
      if (!n && !sdActiveSem()) { sdNeedSem(); return; }
      docEl('sdNoteError').style.background = ''; docEl('sdNoteError').style.color = ''; // (the shared-note editor tints it blue)
      SDN.mode = 'own'; SDN.editId = n ? n.id : null; SDN.shares = []; SDN.add = new Map(); SDN.remove = new Set(); SDN.perm = 'read';
      docEl('sdNoteHead').textContent = n ? 'Edit note' : 'New note';
      docEl('sdNoteTitle').value = n ? n.title : ''; docEl('sdNoteBody').value = n ? n.body || '' : '';
      docEl('sdNoteCourse').closest('.pem-field').style.display = ''; docEl('sdNoteSharedBox').style.display = ''; docEl('sdNoteFilesBox').style.display = ''; docEl('sdNoteSave').textContent = 'Save note';
      sdCourseOptions('sdNoteCourse', n ? n.course_id : (SDN.course || null), true);
      docEl('sdNoteDelete').style.display = n ? '' : 'none'; sdErr('sdNoteError', ''); sdPermChips(); paintNoteShares(); sdNotePreview(false);
      docEl('sdNoteAttach').style.display = n ? '' : 'none'; docEl('sdNoteFilesHint').style.display = n ? 'none' : ''; docEl('sdNoteFiles').innerHTML = '';
      if (n) { LumaStudy.notes.sharedWith(n.id).then(r => { if (!r.error && SDN.editId === n.id) { SDN.shares = r.data || []; paintNoteShares(); } }); sdNoteFiles(n.id, 'sdNoteFiles', true); }
      sdOpen('sdNoteOverlay'); setTimeout(() => docEl('sdNoteTitle').focus(), 50);
    }
    docEl('sdNoteClose').onclick = () => sdClose('sdNoteOverlay');
    docEl('sdNoteOverlay').onclick = async e => {
      if (e.target === docEl('sdNoteOverlay')) return sdClose('sdNoteOverlay');
      const rm = e.target.closest('[data-rm]'); if (rm) { SDN.remove.add(rm.dataset.rm); return paintNoteShares(); }
      const un = e.target.closest('[data-un]'); if (un) { SDN.add.delete(un.dataset.un); return paintNoteShares(); }
      const pm = e.target.closest('[data-perm]'); if (pm) { // switch a person between read and edit right away
        const x = SDN.shares.find(s => s.user_id === pm.dataset.perm); if (!x) return; const r = await LumaStudy.notes.setEdit(SDN.editId, x.user_id, !x.can_edit);
        if (r.error) return sdErr('sdNoteError', r.error.message); x.can_edit = !x.can_edit; return paintNoteShares();
      }
      const np = e.target.closest('[data-np]'); if (np) { SDN.perm = np.dataset.np; sdPermChips(); return paintNoteShares(); }
      const fo = e.target.closest('[data-nfile-open]'); if (fo) return sdOpenNoteFile(fo.dataset.nfileOpen);
      const fd = e.target.closest('[data-nfile-del]'); if (fd) { if (!await luConfirm({ title: 'Remove this file from the note?', message: 'The people the note is shared with can no longer open it. The file stays in your Documents.', ok: 'Remove', icon: 'fa-paperclip', tone: 'info' })) return; const r = await LumaStudy.notes.detach(fd.dataset.nfileDel); if (r.error) sdErr('sdNoteError', r.error.message); return sdNoteFiles(SDN.editId, 'sdNoteFiles', true); }
    };
    docEl('sdNoteShareBtn').onclick = async () => {
      const got = await sdPickContacts({ title: 'Share with', selected: SDN.add, exclude: new Set(SDN.shares.filter(x => !SDN.remove.has(x.user_id)).map(x => x.user_id)) });
      if (got) { SDN.add = got; paintNoteShares(); }
    };
    docEl('sdNoteAttach').onclick = () => docEl('sdNoteFile').click();
    docEl('sdNoteFile').onchange = async () => {
      const file = docEl('sdNoteFile').files[0]; docEl('sdNoteFile').value = ''; if (!file || !SDN.editId) return;
      const b = docEl('sdNoteAttach'); b.disabled = true; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading…'; sdErr('sdNoteError', '');
      try { const up = await LumaDocuments.upload(file); if (up.error) throw new Error(up.error.message); const at = await LumaStudy.notes.attach(SDN.editId, up.data.id); if (at.error) throw new Error(at.error.message); }
      catch (e) { sdErr('sdNoteError', 'Could not attach the file: ' + e.message); }
      b.disabled = false; b.innerHTML = '<i class="fa-solid fa-paperclip"></i> Attach a file'; sdNoteFiles(SDN.editId, 'sdNoteFiles', true);
    };
    docEl('sdNoteSave').onclick = async () => {
      const title = docEl('sdNoteTitle').value.trim(); if (!title) return sdErr('sdNoteError', 'Give the note a title.');
      if (SDN.mode === 'shared') { // someone else's note that you may edit
        sdErr('sdNoteError', ''); sdBtn('sdNoteSave', true); const r = await LumaStudy.notes.updateShared(SDN.editId, title, docEl('sdNoteBody').value); sdBtn('sdNoteSave', false, 'Save changes');
        if (r.error) return sdErr('sdNoteError', r.error.message);
        const x = SDN.shared.find(s => s.id === SDN.editId); if (x) { x.title = title; x.body = docEl('sdNoteBody').value; x.updated_at = r.data || x.updated_at; }
        sdClose('sdNoteOverlay'); sdPaint(); return flashToast('Changes saved', 'The owner and everyone else with access will see them', 'fa-check', '#22c55e');
      }
      const fields = { title, body: docEl('sdNoteBody').value, course_id: docEl('sdNoteCourse').value || null };
      sdErr('sdNoteError', ''); sdBtn('sdNoteSave', true);
      const { data, error } = SDN.editId ? await LumaStudy.notes.update(SDN.editId, fields) : await LumaStudy.notes.add(fields);
      sdBtn('sdNoteSave', false, 'Save note');
      if (error) return sdErr('sdNoteError', /study_notes|schema cache|does not exist/i.test(error.message) ? 'Notes aren\'t set up yet — run supabase/migrations/053_study_notes.sql in the SQL Editor.' : sdHint(error.message));
      let shareErr = '';
      for (const uid of SDN.remove) { const r = await LumaStudy.notes.unshare(data.id, uid); if (r.error) shareErr = r.error.message; }
      if (SDN.add.size) { const r = await LumaStudy.notes.share(data.id, [...SDN.add.keys()], SDN.perm === 'edit'); if (r.error) shareErr = /could not find the function|schema cache/i.test(r.error.message) ? 'Run supabase/migrations/059_study_notes_extras.sql to share notes.' : r.error.message; else flashToast('Note shared', [...SDN.add.values()].join(', '), 'fa-paper-plane', '#22c55e'); }
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

    // ---------- a note someone shared with me: read it, or edit it when they allowed that ----------
    function openSharedNote(id) {
      const n = SDN.shared.find(x => x.id === id); if (!n) return;
      if (n.can_edit) { // the same editor, in "shared" mode: title and text only
        SDN.mode = 'shared'; SDN.editId = id; SDN.shares = []; SDN.add = new Map(); SDN.remove = new Set();
        docEl('sdNoteHead').textContent = 'Editing a shared note'; docEl('sdNoteTitle').value = n.title; docEl('sdNoteBody').value = n.body || '';
        docEl('sdNoteCourse').closest('.pem-field').style.display = 'none'; docEl('sdNoteSharedBox').style.display = 'none'; docEl('sdNoteDelete').style.display = 'none'; docEl('sdNoteSave').textContent = 'Save changes';
        docEl('sdNoteAttach').style.display = 'none'; docEl('sdNoteFilesHint').style.display = 'none'; docEl('sdNoteFilesBox').style.display = ''; docEl('sdNoteFiles').innerHTML = '';
        sdNoteFiles(id, 'sdNoteFiles', false); sdErr('sdNoteError', `From ${n.owner_name}. You can edit it, and so can they. The latest save wins.`); docEl('sdNoteError').style.display = 'flex'; docEl('sdNoteError').style.background = 'rgba(96,165,250,0.12)'; docEl('sdNoteError').style.color = '#bfdbfe';
        sdNotePreview(false); sdOpen('sdNoteOverlay'); return;
      }
      SDN.viewId = id; docEl('sdNoteViewHead').textContent = n.title;
      docEl('sdNoteViewMeta').innerHTML = `<i class="fa-solid fa-user-group"></i> From ${escapeHtml(n.owner_name)}${n.course_name ? ' · ' + escapeHtml(n.course_name) : ''} · updated ${sdShort(mytDayKey(n.updated_at))} · read only`;
      docEl('sdNoteViewBody').innerHTML = sdMd(n.body); docEl('sdNoteViewFiles').innerHTML = ''; sdNoteFiles(id, 'sdNoteViewFiles', false); sdOpen('sdNoteViewOverlay');
    }
    docEl('sdNoteViewClose').onclick = () => sdClose('sdNoteViewOverlay');
    docEl('sdNoteViewOverlay').onclick = e => { if (e.target === docEl('sdNoteViewOverlay')) return sdClose('sdNoteViewOverlay'); const fo = e.target.closest('[data-nfile-open]'); if (fo) sdOpenNoteFile(fo.dataset.nfileOpen); };
    docEl('sdNoteViewRemove').onclick = async () => {
      const n = SDN.shared.find(x => x.id === SDN.viewId); if (!n) return;
      if (!await luConfirm({ title: 'Remove this shared note?', message: `“${n.title}” is taken off your list. ${n.owner_name} keeps it.`, ok: 'Remove', icon: 'fa-user-group', tone: 'info' })) return;
      const { error } = await LumaStudy.notes.unshare(n.id, LUMA_USER.id); if (error) return luAlert('Could not remove it: ' + error.message);
      SDN.shared = SDN.shared.filter(x => x !== n); sdClose('sdNoteViewOverlay'); sdPaint();
    };
