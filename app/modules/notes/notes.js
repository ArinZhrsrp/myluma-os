// LUMA — module: notes
      // ---------------- NOTES ----------------
    MODULES.notes = function () {
        return head('Notes & Docs', '<span id="notesSub">Loading…</span>',
          '<button class="create-btn date-filter-btn" id="noteDateBtn" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-regular fa-calendar"></i> Any time</button><input id="noteSearch" placeholder="Search notes…" autocomplete="off" style="height:38px;width:200px;border-radius:11px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;padding:0 12px;font-size:0.78rem;outline:none;font-family:inherit"><button class="create-btn" id="newNoteBtn"><i class="fa-solid fa-plus"></i> New note</button>') +
          '<div id="noteFilters" style="display:flex;gap:10px;margin-bottom:1rem;flex-wrap:wrap"></div><div class="notes-cols" id="noteGrid"></div>';
    };

    // ---------- Notes & Docs (Supabase-backed, links to Documents) ----------
    async function loadNotes(pg) {
      const sub = pg.querySelector('#notesSub');
      let notes = [], filter = 'all', query = '', dateF = newDateFilter();
      let editing = null;        // note being edited, or null for a new one
      let atts = [];             // documents attached in the editor (saved on Save)
      let libDocs = null;        // lazy cache of own + shared documents for the picker
      const showErr = m => { docEl('noteError').textContent = m; docEl('noteError').style.display = m ? 'flex' : 'none'; };
      const tagMap = {}; // lower-case tag name → { id, color } saved colours
      const tagColor = t => (tagMap[t.toLowerCase()] || {}).color || catColor(t.toLowerCase());
      const usedTagColors = () => Object.values(tagMap).map(r => r.color);
      // change a tag's colour (creates the saved row on first change); updates the UI at once
      const setTagColor = async (name, color) => {
        const key = name.toLowerCase(), rec = tagMap[key];
        tagMap[key] = { id: rec && rec.id, color }; render(); renderTagChips();
        const res = await LumaNotes.saveTagColor(name, color, rec && rec.id);
        if (res.error) { if (rec) tagMap[key] = rec; else delete tagMap[key]; render(); renderTagChips(); return luAlert(/note_tags|schema cache|does not exist/i.test(res.error.message) ? 'Tag colours aren\'t set up yet — run supabase/migrations/006_colors.sql in the SQL Editor.' : res.error.message); }
        tagMap[key] = res.data;
      };

      const render = () => {
        const tags = [...new Set(notes.map(n => n.tag).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        if (filter !== 'all' && !tags.includes(filter)) filter = 'all';
        sub.textContent = `${notes.length} note${notes.length === 1 ? '' : 's'} · your personal knowledge base`;
        pg.querySelector('#noteFilters').innerHTML = ['all', ...tags].map(t =>
          `<span class="suggestion-badge note-filter" data-k="${escapeHtml(t)}" style="${t === filter ? 'background:rgba(59,130,246,0.14);color:#93c5fd;border-color:rgba(59,130,246,0.3)' : ''};font-size:0.7rem;padding:0.35rem 0.9rem;cursor:pointer">${t === 'all' ? 'All' : `<span class="chip-dot" style="background:${tagColor(t)}"></span>${escapeHtml(t)}`}</span>`).join('');
        const q = query.trim().toLowerCase();
        const shown = notes.filter(n => inDateRange(n.updated_at, dateF) && (filter === 'all' || n.tag === filter) && (!q || (n.title + ' ' + n.body + ' ' + n.tag).toLowerCase().includes(q)));
        pg.querySelector('#noteGrid').innerHTML = shown.length ? shown.map(n => `<div class="card note" data-id="${n.id}">
          <div class="doc-actions"><i class="fa-solid fa-pen note-edit" title="Edit"></i><i class="fa-regular fa-trash-can note-del" title="Delete"></i></div>
          <div class="n-tag"><span class="dot" style="background:${n.tag ? tagColor(n.tag) : 'rgba(255,255,255,0.2)'}"></span> ${n.tag ? escapeHtml(n.tag) : 'No tag'}</div>
          <div class="n-title">${escapeHtml(n.title || 'Untitled note')}</div>
          <div class="n-body">${escapeHtml(n.body.length > 220 ? n.body.slice(0, 220) + '…' : n.body)}</div>
          <div class="n-foot">${n.docs.length ? `<div class="n-clip"><i class="fa-solid fa-paperclip"></i> ${n.docs.length} document${n.docs.length === 1 ? '' : 's'}</div>` : ''}
          <div class="n-date"><i class="fa-regular fa-clock"></i> ${mytDateTime(n.updated_at)}</div></div></div>`).join('')
          : `<div class="ls" style="padding:10px 2px">${notes.length ? 'No notes match.' : 'No notes yet — hit New note.'}</div>`;
      };

      // tags as pills: existing ones, the starters, then "+ Add" which turns into an inline input
      let extraTags = [], addingTag = false, pendingColor = '#3b82f6', addText = '';
      const renderTagChips = () => {
        const prevInp = docEl('tagNewInput'); if (prevInp) addText = prevInp.value; // keep what was typed across re-renders
        const cur = docEl('noteTag').value.trim().toLowerCase();
        const all = [...new Set([...notes.map(n => n.tag).filter(Boolean), 'Personal', 'Work', 'Home', ...extraTags])];
        docEl('noteTagChips').innerHTML = all.map(t => `<span class="tag-chip ${t.toLowerCase() === cur ? 'on' : ''}" data-t="${escapeHtml(t)}"><span class="dot tag-dot" title="Change colour" style="background:${tagColor(t)}"></span>${escapeHtml(t)}</span>`).join('')
          + (addingTag ? `<span class="tag-chip tag-new"><i class="fa-solid fa-tag" style="font-size:0.65rem;color:${pendingColor}"></i><input id="tagNewInput" maxlength="30" placeholder="Tag name" autocomplete="off"></span>`
            : '<span class="tag-chip tag-add"><i class="fa-solid fa-plus" style="font-size:0.65rem"></i> Add</span>');
        // inline colour row for the selected tag, so changing its colour is discoverable
        const row = docEl('noteTagColors'), sel = docEl('noteTag').value.trim();
        if (sel || addingTag) {
          const now = (addingTag ? pendingColor : tagColor(sel)).toLowerCase();
          row.innerHTML = `<span class="tc-label">Colour for <b>${addingTag ? 'new tag' : escapeHtml(sel)}</b></span>` + COLOR_PALETTE.map(([c, name]) => `<button type="button" class="sw ${c === now ? 'on' : ''}" data-c="${c}" title="${name}" style="background:${c}"><i class="fa-solid fa-check"></i></button>`).join('');
          row.classList.add('show');
        } else { row.innerHTML = ''; row.classList.remove('show'); }
        const inp = docEl('tagNewInput');
        if (inp) {
          inp.value = addText; inp.focus();
          const commit = () => {
            const v = inp.value.trim(); addingTag = false;
            if (v) {
              const existing = all.find(t => t.toLowerCase() === v.toLowerCase()); const name = existing || v;
              if (!existing) { extraTags.push(name); setTagColor(name, pendingColor); } // the colour shown while typing (random unless changed)
              docEl('noteTag').value = name;
            }
            renderTagChips();
          };
          inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') { e.stopPropagation(); addingTag = false; addText = ''; renderTagChips(); } };
          inp.onblur = () => { if (addingTag) commit(); };
        }
      };
      docEl('noteTagColors').onmousedown = e => { if (addingTag && e.target.closest('.sw')) e.preventDefault(); }; // keep typing focus while picking a colour
      docEl('noteTagColors').onclick = e => {
        const b = e.target.closest('.sw'); if (!b) return;
        if (addingTag) { pendingColor = b.dataset.c; renderTagChips(); } else setTagColor(docEl('noteTag').value.trim(), b.dataset.c);
      };
      docEl('noteTagChips').onclick = e => {
        const dot = e.target.closest('.tag-dot');
        if (dot) { const t = dot.closest('.tag-chip').dataset.t; return openSwatches(dot, tagColor(t), c => setTagColor(t, c)); }
        if (e.target.closest('.tag-add')) { addingTag = true; addText = ''; pendingColor = randomColor(usedTagColors()); return renderTagChips(); }
        const c = e.target.closest('.tag-chip[data-t]');
        // clicking the selected pill again clears it (tag is optional)
        if (c) { docEl('noteTag').value = c.classList.contains('on') ? '' : c.dataset.t; renderTagChips(); }
      };

      const renderAtts = () => {
        docEl('noteAttCount').textContent = atts.length ? `(${atts.length})` : '';
        // colour + label per file type so a long list is easy to scan
        const kind = d => {
          const ext = (d.name.split('.').pop() || '').toLowerCase(), m = d.mime_type || '';
          if (ext === 'pdf' || m === 'application/pdf') return ['PDF', '#f87171'];
          if (/^(docx?|pages)$/.test(ext)) return ['Word', '#60a5fa'];
          if (/^(xlsx?|csv|numbers)$/.test(ext)) return ['Sheet', '#34d399'];
          if (m.startsWith('image/')) return ['Image', '#c084fc'];
          if (m.startsWith('video/')) return ['Video', '#fbbf24'];
          return [(ext || 'File').slice(0, 5).toUpperCase(), '#94a3b8'];
        };
        docEl('noteAtts').innerHTML = atts.length ? atts.map(d => { const [label, col] = kind(d); return `<div class="att-chip" data-id="${d.id}"><div class="att-ico" style="background:${col}22;color:${col}"><i class="fa-solid ${LumaDocuments.icon(d)}"></i></div><div class="att-meta" title="${escapeHtml(d.name)} — click to preview"><span class="att-name">${escapeHtml(d.name)}</span><span class="att-sub">${label} · ${LumaDocuments.formatSize(d.size_bytes)}</span></div><i class="fa-solid fa-xmark att-x" title="Remove"></i></div>`; }).join('')
          : '<div class="att-empty" style="grid-column:1/-1">No documents attached</div>';
      };

      const loadLibrary = async () => {
        if (libDocs) return libDocs;
        const [d, sw] = await Promise.all([LumaDocuments.listDocuments(), LumaDocuments.listSharedWithMe()]);
        const shared = sw.error ? [] : sw.data;
        libDocs = [...(d.data || []).filter(x => !shared.some(y => y.id === x.id)), ...shared];
        return libDocs;
      };
      // picker: every document (own + shared) with a tick for those attached to this note
      const renderPicker = async () => {
        const box = docEl('attachList');
        if (!libDocs) box.innerHTML = '<div class="ls">Loading…</div>';
        const lib = await loadLibrary(), q = docEl('attachSearch').value.trim().toLowerCase();
        const shown = lib.filter(d => !q || d.name.toLowerCase().includes(q));
        box.innerHTML = shown.length ? selectAllRow(shown.length) + shown.map(d => `<label class="cat-row" style="cursor:pointer"><input type="checkbox" data-id="${d.id}" ${atts.some(a => a.id === d.id) ? 'checked' : ''}><i class="fa-solid ${LumaDocuments.icon(d)}" style="color:#93c5fd"></i><span style="color:#fff;font-size:0.78rem;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(d.name)}</span><span class="ls" style="margin-left:auto;white-space:nowrap;font-size:0.66rem">${mytDateTime(d.created_at)} · ${LumaDocuments.formatSize(d.size_bytes)}</span></label>`).join('')
          : `<div class="ls" style="padding:8px 2px">${lib.length ? 'No documents match.' : 'No documents yet — use Upload.'}</div>`;
        syncSelectAll(box);
      };

      const openEditor = note => {
        editing = note || null; atts = note ? [...note.docs] : [];
        docEl('noteHeading').textContent = note ? 'Edit note' : 'New note';
        docEl('noteTitle').value = note ? note.title : '';
        docEl('noteTag').value = note ? note.tag : (filter !== 'all' ? filter : ''); // new note pre-fills the tag being filtered on, none under All
        docEl('noteBody').value = note ? note.body : '';
        docEl('noteSave').textContent = 'Save note'; updateSave();
        addingTag = false; extraTags = []; addText = '';
        showErr(''); renderAtts(); renderTagChips();
        docEl('noteOverlay').classList.add('open'); docEl('noteTitle').focus();
      };
      const closeEditor = () => docEl('noteOverlay').classList.remove('open');
      // Save stays disabled until both required fields have text
      const updateSave = () => { docEl('noteSave').disabled = !(docEl('noteTitle').value.trim() && docEl('noteBody').value.trim()); };
      ['noteTitle', 'noteBody'].forEach(id => docEl(id).addEventListener('input', () => { updateSave(); showErr(''); }));
      docEl('noteClose').onclick = closeEditor;
      docEl('noteOverlay').onclick = e => { if (e.target === docEl('noteOverlay')) closeEditor(); };

      docEl('noteAttachBtn').onclick = () => { docEl('attachSearch').value = ''; docEl('attachOverlay').classList.add('open'); renderPicker(); docEl('attachSearch').focus(); };
      const closePicker = () => docEl('attachOverlay').classList.remove('open');
      docEl('attachClose').onclick = docEl('attachDone').onclick = closePicker;
      docEl('attachOverlay').onclick = e => { if (e.target === docEl('attachOverlay')) closePicker(); };
      docEl('attachSearch').oninput = renderPicker;
      docEl('attachList').onchange = e => {
        const cb = e.target.closest('input[type=checkbox]'); if (!cb || cb.hasAttribute('data-all')) return;
        const d = libDocs.find(x => x.id === cb.dataset.id); if (!d) return;
        if (cb.checked) { if (!atts.some(a => a.id === d.id)) atts.push(d); } else atts = atts.filter(a => a.id !== d.id);
        renderAtts();
      };
      docEl('noteAtts').onclick = e => {
        const chip = e.target.closest('.att-chip'); if (!chip) return;
        const d = atts.find(x => x.id === chip.dataset.id); if (!d) return;
        if (e.target.closest('.att-x')) { atts = atts.filter(x => x !== d); renderAtts(); }
        else if (e.target.closest('.att-meta')) viewDocument(d);
      };
      // upload straight from the note: stored as a normal document (Uncategorised) and attached
      docEl('noteUploadBtn').onclick = () => docEl('noteUploadInput').click();
      docEl('noteUploadInput').onchange = async e => {
        const file = e.target.files[0]; e.target.value = ''; if (!file) return;
        const btn = docEl('noteUploadBtn'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading…';
        const { data, error } = await LumaDocuments.upload(file);
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-upload"></i> Upload new';
        if (error) return showErr(error.message);
        showErr(''); atts.push(data); if (libDocs) libDocs.unshift(data); renderAtts();
      };

      docEl('noteSave').onclick = async () => {
        const title = docEl('noteTitle').value.trim(), body = docEl('noteBody').value, tag = docEl('noteTag').value.trim();
        if (!title || !body.trim()) return; // button is disabled in this state; guard anyway
        const btn = docEl('noteSave'); btn.disabled = true; btn.textContent = 'Saving…';
        const fail = m => { btn.disabled = false; btn.textContent = 'Save note'; showErr(m); };
        let res = editing ? await LumaNotes.update(editing.id, { title, body, tag }) : await LumaNotes.add({ title, body, tag });
        if (res.error) return fail(res.error.message);
        if (tag && !tagMap[tag.toLowerCase()]) setTagColor(tag, randomColor(usedTagColors())); // first use of a tag: give it a random unused colour
        const noteId = res.data.id, had = new Set(editing ? editing.docs.map(d => d.id) : []), want = new Set(atts.map(d => d.id));
        const ops = [...[...want].filter(id => !had.has(id)).map(id => LumaNotes.attach(noteId, id)), ...[...had].filter(id => !want.has(id)).map(id => LumaNotes.detach(noteId, id))];
        const results = await Promise.all(ops);
        const bad = results.find(r => r.error); if (bad) return fail(bad.error.message);
        const fresh = await LumaNotes.list(); // re-read so attachments reflect the database
        if (!fresh.error) notes = fresh.data;
        closeEditor(); render();
      };

      // read-only view: content plus clickable attachments
      let viewing = null;
      const openView = n => {
        viewing = n;
        docEl('nvTag').innerHTML = `<span class="dot" style="width:7px;height:7px;border-radius:50%;background:${n.tag ? tagColor(n.tag) : 'rgba(255,255,255,0.2)'}"></span> ${n.tag ? escapeHtml(n.tag) : 'No tag'}`;
        docEl('nvTitle').textContent = n.title || 'Untitled note';
        docEl('nvBody').textContent = n.body || '';
        docEl('nvBody').style.display = n.body ? '' : 'none';
        docEl('nvDocs').innerHTML = n.docs.length ? `<div class="pem-field" style="margin-bottom:0"><label>Documents</label>${n.docs.map(d => `<div class="att-row" data-id="${d.id}"><i class="fa-solid ${LumaDocuments.icon(d)}" style="color:#93c5fd"></i><span class="att-name">${escapeHtml(d.name)}</span><span class="ls">${mytDateTime(d.created_at)} · ${LumaDocuments.formatSize(d.size_bytes)}</span><i class="fa-regular fa-eye" style="color:rgba(255,255,255,0.5)"></i></div>`).join('')}</div>` : '';
        docEl('nvDate').textContent = 'Created ' + mytDateTime(n.created_at) + (n.updated_at !== n.created_at ? ' · Updated ' + mytDateTime(n.updated_at) : '') + ' (' + tzOffsetLabel() + ')';
        docEl('noteViewOverlay').classList.add('open');
      };
      const closeView = () => docEl('noteViewOverlay').classList.remove('open');
      docEl('nvClose').onclick = closeView;
      docEl('noteViewOverlay').onclick = e => { if (e.target === docEl('noteViewOverlay')) closeView(); };
      docEl('nvDocs').onclick = e => {
        const row = e.target.closest('.att-row'); const d = row && viewing.docs.find(x => x.id === row.dataset.id);
        if (d) viewDocument(d);
      };

      pg.querySelector('#newNoteBtn').onclick = () => openEditor(null);
      const noteDateBtn = pg.querySelector('#noteDateBtn');
      noteDateBtn.onclick = () => openDateFilter(noteDateBtn, dateF, st => { dateF = st; paintDateFilterBtn(noteDateBtn, dateF); render(); }); // filters by last-updated date
      pg.querySelector('#noteSearch').oninput = e => { query = e.target.value; render(); };
      pg.querySelector('#noteFilters').onclick = e => { const f = e.target.closest('.note-filter'); if (f) { filter = f.dataset.k; render(); } };
      pg.querySelector('#noteGrid').onclick = async e => {
        const el = e.target.closest('.note'); const n = el && notes.find(x => x.id === el.dataset.id); if (!n) return;
        if (e.target.closest('.note-edit')) return openEditor(n);
        if (e.target.closest('.note-del')) {
          if (!await luConfirm({ title: 'Delete this note?', message: `“${n.title || 'Untitled note'}” will be deleted. Attached documents are kept.`, ok: 'Delete note' })) return;
          const { error } = await LumaNotes.remove(n.id);
          if (error) return luAlert('Could not delete: ' + error.message);
          notes = notes.filter(x => x !== n); render();
          return luUndo('Note deleted', async () => { const { data, error } = await LumaNotes.add({ title: n.title, body: n.body, tag: n.tag }); if (error) throw error; notes.unshift(data); render(); });
        }
        openView(n);
      };

      const { data, error } = await LumaNotes.list();
      if (error) { sub.textContent = 'Could not load notes — has supabase/migrations/005_notes.sql been run?'; return; }
      notes = data;
      const tc = await LumaNotes.listTagColors(); // optional until migration 006 has been run
      if (!tc.error) tc.data.forEach(r => { tagMap[r.name.toLowerCase()] = r; });
      render();
    }



    WIRE.notes = function (pg) { return loadNotes(pg); };
