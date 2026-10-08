// LUMA — module: documents
      // ---------------- DOCUMENTS ----------------
    MODULES.documents = function () {
        return head('Documents', '<span id="docsSub">Loading…</span>',
          '<button class="create-btn date-filter-btn" id="docDateBtn" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-regular fa-calendar"></i> Any time</button><button class="create-btn" id="manageCatsBtn" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-tags"></i> Categories</button><button class="create-btn" id="uploadDocBtn"><i class="fa-solid fa-upload"></i> Upload</button>') +
          '<div id="docFilters" style="display:flex;flex-direction:column;gap:8px;margin-bottom:1rem"></div><div class="grid-4" id="docGrid"></div>';
    };

    let viewerUrl = null;
    function closeViewer() {
      docEl('viewerOverlay').classList.remove('open');
      docEl('viewerBody').innerHTML = ''; docEl('viewerBody').className = 'viewer-body';
      if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; }
    }
    docEl('viewerClose').addEventListener('click', closeViewer);
    docEl('viewerOverlay').addEventListener('click', e => { if (e.target === docEl('viewerOverlay')) closeViewer(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && docEl('viewerOverlay').classList.contains('open')) closeViewer(); });

    // Preview libraries are only fetched the first time a matching file is opened.
    const scriptPromises = {};
    const loadScript = url => scriptPromises[url] || (scriptPromises[url] = new Promise((res, rej) => {
      const el = document.createElement('script'); el.src = url; el.onload = res;
      el.onerror = () => { delete scriptPromises[url]; rej(new Error('Could not load preview library (offline?)')); };
      document.head.appendChild(el);
    }));
    const PREVIEW_LIBS = {
      docx: ['https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', 'https://cdn.jsdelivr.net/npm/docx-preview@0.3.3/dist/docx-preview.min.js'],
      sheet: ['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'],
    };
    const SHEET_ROW_LIMIT = 1000;

    async function renderDocx(blob, body) {
      for (const u of PREVIEW_LIBS.docx) await loadScript(u);
      body.className = 'viewer-body scroll docx'; body.innerHTML = '';
      await docx.renderAsync(blob, body, null, { inWrapper: true, ignoreWidth: false, breakPages: true });
    }

    async function renderSheet(blob, body) {
      for (const u of PREVIEW_LIBS.sheet) await loadScript(u);
      const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
      body.className = 'viewer-body scroll'; body.innerHTML = '<div class="sheet-tabs"></div><div class="sheet-wrap"></div>';
      const tabs = body.querySelector('.sheet-tabs'), wrap = body.querySelector('.sheet-wrap');
      const show = name => {
        const ws = wb.Sheets[name]; let note = '';
        if (ws['!ref']) {
          const r = XLSX.utils.decode_range(ws['!ref']);
          if (r.e.r - r.s.r + 1 > SHEET_ROW_LIMIT) { r.e.r = r.s.r + SHEET_ROW_LIMIT - 1; ws['!ref'] = XLSX.utils.encode_range(r); note = `<div class="viewer-note">Showing the first ${SHEET_ROW_LIMIT} rows — download for the full sheet.</div>`; }
        }
        wrap.innerHTML = (ws['!ref'] ? XLSX.utils.sheet_to_html(ws, { editable: false }) : '<div class="viewer-note">This sheet is empty.</div>') + note;
        tabs.querySelectorAll('span').forEach(t => t.classList.toggle('on', t.dataset.n === name));
      };
      tabs.innerHTML = wb.SheetNames.map(n => `<span data-n="${escapeHtml(n)}">${escapeHtml(n)}</span>`).join('');
      tabs.onclick = e => { const t = e.target.closest('span'); if (t) show(t.dataset.n); };
      if (wb.SheetNames.length < 2) tabs.style.display = 'none';
      show(wb.SheetNames[0]);
    }

    async function viewDocument(d) {
      const body = docEl('viewerBody'), dl = docEl('viewerDownload');
      if (viewerUrl) { URL.revokeObjectURL(viewerUrl); viewerUrl = null; }
      docEl('viewerTitle').textContent = d.name;
      docEl('viewerSub').textContent = 'Uploaded ' + mytDateTime(d.created_at) + ' (' + tzOffsetLabel() + ')';
      dl.removeAttribute('href'); dl.removeAttribute('download');
      body.className = 'viewer-body'; body.innerHTML = '<div class="ls">Loading…</div>';
      docEl('viewerOverlay').classList.add('open');
      const { blob, error } = await LumaDocuments.download(d);
      if (!docEl('viewerOverlay').classList.contains('open')) return; // closed while loading
      if (error) { body.innerHTML = `<div class="ls" style="padding:20px">Could not load file: ${escapeHtml(error.message)}</div>`; return; }
      viewerUrl = URL.createObjectURL(blob);
      dl.href = viewerUrl; dl.download = d.name;
      const t = blob.type, ext = d.name.split('.').pop().toLowerCase();
      body.className = 'viewer-body';
      if (ext === 'docx' || ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        body.innerHTML = '<div class="ls">Preparing preview…</div>';
        try {
          if (ext === 'docx') await renderDocx(blob, body); else await renderSheet(blob, body);
        } catch (err) {
          body.className = 'viewer-body';
          body.innerHTML = `<div class="ls" style="padding:20px;text-align:center">Couldn't preview this file (${escapeHtml(err.message)}) — use Download.</div>`;
        }
        return;
      }
      if (t.startsWith('image/')) body.innerHTML = `<img src="${viewerUrl}" alt="">`;
      else if (t === 'application/pdf') body.innerHTML = `<iframe src="${viewerUrl}" title="${escapeHtml(d.name)}"></iframe>`;
      else if (t.startsWith('video/')) body.innerHTML = `<video src="${viewerUrl}" controls></video>`;
      else if (t.startsWith('audio/')) body.innerHTML = `<audio src="${viewerUrl}" controls></audio>`;
      else if (t.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(d.name)) {
        const pre = document.createElement('pre'); pre.textContent = await blob.text(); body.innerHTML = ''; body.appendChild(pre);
      } else body.innerHTML = `<div class="ls" style="padding:20px;text-align:center"><i class="fa-solid ${LumaDocuments.icon(d)}" style="font-size:2rem;display:block;margin-bottom:12px"></i>No preview for this file type — use Download.</div>`;
    }

    async function loadDocuments(pg) {
      const sub = pg.querySelector('#docsSub');
      const mem = (PAGE_MEM.documents = PAGE_MEM.documents || {}); // the folder and date filter you were on come back when you return to this page
      let dateF = mem.dateF || newDateFilter();
      let cats = [], docs = [], sharedDocs = [], shares = [], people = [], filter = mem.filter || 'all'; // 'all' | category id | 'none' | 'shared'
      const byId = id => cats.find(c => c.id === id);
      const catCol = c => c ? (c.color || catColor(c.id)) : '#94a3b8'; // chosen colour, else the old stable fallback; grey when uncategorised
      const kids = id => cats.filter(c => (c.parent_id || null) === id);
      // "Finance / Receipts" style path for a category id
      const catName = id => { const out = []; for (let c = byId(id); c; c = byId(c.parent_id)) out.unshift(c.name); return out.join(' / ') || 'Uncategorised'; };
      const descendants = id => kids(id).flatMap(c => [c.id, ...descendants(c.id)]);
      // depth-first [{cat, depth}] so selects/lists show children under their parent
      const flat = (parent = null, depth = 0) => kids(parent).flatMap(c => [{ cat: c, depth }, ...flat(c.id, depth + 1)]);

      const render = () => {
        mem.filter = filter; mem.dateF = dateF;
        sub.textContent = `${docs.length} file${docs.length === 1 ? '' : 's'}${sharedDocs.length ? ` (+${sharedDocs.length} shared with you)` : ''} · ${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}`;
        // one chip row per level: top level, then the children of each category
        // along the selected path, so nesting reads like a breadcrumb
        // categories that contain subcategories get a small count + chevron (down while open, right when closed)
        const openPath = new Set(); for (let c = byId(filter); c; c = byId(c.parent_id)) openPath.add(c.id);
        const subBadge = k => { const n = byId(k) ? kids(k).length : 0; return n ? `<span class="chip-sub" title="${n} subcategor${n === 1 ? 'y' : 'ies'}"><i class="fa-solid fa-chevron-${openPath.has(k) ? 'down' : 'right'}"></i>${n}</span>` : ''; };
        const chip = ([k, label]) => `<span class="suggestion-badge doc-filter" data-k="${k}" style="${k === filter ? 'background:rgba(59,130,246,0.14);color:#93c5fd;border-color:rgba(59,130,246,0.3)' : ''};font-size:0.7rem;padding:0.35rem 0.9rem">${byId(k) ? `<span class="chip-dot" style="background:${catCol(byId(k))}"></span>` : ''}${escapeHtml(label)}${subBadge(k)}</span>`;
        const top = [['all', 'All'], ['shared', `Shared with me${sharedDocs.length ? ' (' + sharedDocs.length + ')' : ''}`], ...kids(null).map(c => [c.id, c.name])];
        if (docs.some(d => !d.category_id)) top.push(['none', 'Uncategorised']);
        const path = []; for (let c = byId(filter); c; c = byId(c.parent_id)) path.unshift(c.id);
        const rows = [top];
        path.forEach(id => { const k = kids(id); if (k.length) rows.push(k.map(c => [c.id, c.name])); });
        pg.querySelector('#docFilters').innerHTML = rows.map((r, i) => {
          // keep the parent selected-looking in lower rows: a chip is "on" if it is on the path
          return `<div style="display:flex;gap:10px;flex-wrap:wrap;${i ? 'padding-left:14px' : ''}">${r.map(([k, l]) => chip([k, l]).replace(/background:rgba\(59,130,246,0\.14\)[^"]*"/, m => m)).join('')}</div>`;
        }).join('');
        const scope = new Set(filter === 'all' || filter === 'none' || filter === 'shared' ? [] : [filter, ...descendants(filter)]);
        const dateOf = d => mytDateTime(d.created_at);
        const sharedCard = d => {
          const owner = [d.owner_first_name, d.owner_last_name].filter(Boolean).join(' ') || d.owner_email;
          const rc = byId(d.recipient_category_id), scol = rc ? catCol(rc) : '#38bdf8';
          return card(`<div class="doc-actions"><i class="fa-solid fa-folder-plus doc-file" title="Add to a category"></i><i class="fa-solid fa-xmark doc-unshare" title="Remove from my list"></i></div>
            <div style="width:48px;height:48px;border-radius:13px;display:grid;place-items:center;background:${scol}22;color:${scol};margin-bottom:14px;font-size:1.2rem"><i class="fa-solid ${LumaDocuments.icon(d)}"></i></div>
            <div class="lt" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(d.name)}</div>
            <div class="ls" style="margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${rc ? escapeHtml(catName(rc.id)) + ' · ' : ''}From ${escapeHtml(owner)}</div>
            <div class="n-date" style="white-space:nowrap"><i class="fa-solid fa-user-group"></i> ${dateOf({ created_at: d.shared_at })} · ${LumaDocuments.formatSize(d.size_bytes)}</div>`, 'doc-card').replace('class="card doc-card"', `class="card doc-card" data-id="${d.id}" data-shared="1"`);
        };
        if (filter === 'shared') {
          const sharedInRange = sharedDocs.filter(d => inDateRange(d.shared_at, dateF));
          pg.querySelector('#docGrid').innerHTML = sharedInRange.length ? sharedInRange.map(sharedCard).join('') : sharedDocs.length ? '<div class="ls" style="padding:10px 2px;grid-column:1/-1">No shared documents in this date range.</div>' : '<div class="ls" style="padding:10px 2px;grid-column:1/-1">Nothing shared with you yet — files your contacts share will appear here automatically.</div>';
          return;
        }
        const shown = docs.filter(d => inDateRange(d.created_at, dateF) && (filter === 'all' || (filter === 'none' ? !d.category_id : scope.has(d.category_id))));
        // All shows everything you can open (own + shared with you); a category shows shared files you filed there
        const sharedFiled = (filter === 'all' ? sharedDocs : scope.size ? sharedDocs.filter(d => d.recipient_category_id && scope.has(d.recipient_category_id)) : []).filter(d => inDateRange(d.shared_at, dateF));
        const ownHtml = shown.map(d => {
          const col = catCol(byId(d.category_id));
          const n = shares.filter(x => x.document_id === d.id).length;
          return card(`<div class="doc-actions"><i class="fa-solid fa-share-nodes doc-share" title="Share with contacts"></i><i class="fa-solid fa-pen doc-edit" title="Rename / change category"></i><i class="fa-regular fa-trash-can doc-del" title="Delete"></i></div>
            <div style="width:48px;height:48px;border-radius:13px;display:grid;place-items:center;background:${col}22;color:${col};margin-bottom:14px;font-size:1.2rem"><i class="fa-solid ${LumaDocuments.icon(d)}"></i></div>
            <div class="lt" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(d.name)}</div>
            <div class="ls" style="margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(catName(d.category_id))}${n ? ` · <i class="fa-solid fa-share-nodes"></i> ${n}` : ''}</div>
            <div class="n-date" style="white-space:nowrap"><i class="fa-regular fa-clock"></i> ${dateOf(d)} · ${LumaDocuments.formatSize(d.size_bytes)}</div>`, 'doc-card').replace('class="card doc-card"', `class="card doc-card" data-id="${d.id}"`);
        }).join('');
        pg.querySelector('#docGrid').innerHTML = (ownHtml + sharedFiled.map(sharedCard).join('')) || `<div class="ls" style="padding:10px 2px;grid-column:1/-1;white-space:nowrap">${dateF.preset !== 'any' ? 'No documents in this date range.' : 'No documents here yet — hit Upload.'}</div>`;
      };

      const catOptions = sel => `<option value="" ${!sel ? 'selected' : ''}>No category</option>` + flat().map(({ cat: c, depth }) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${'\u00a0\u00a0'.repeat(depth)}${escapeHtml(c.name)}</option>`).join('');
      const showErr = (el, m) => { el.textContent = m; el.style.display = m ? 'flex' : 'none'; };

      // upload / edit modal
      let editing = null, editingShared = false;
      // upload queue: files picked or dropped, uploaded together on Upload
      let queue = []; // { file, status: 'pending'|'uploading'|'done'|'error', msg }
      const maxBytes = () => { const mb = LumaPlan.get('file_mb'); return mb === null ? LumaDocuments.MAX_BYTES : mb * 1048576; };
      const syncUploadUi = () => {
        const n = queue.filter(q => q.status !== 'done').length;
        docEl('docNameField').style.display = (editing || queue.length === 1) ? '' : 'none';
        if (!editing) { const verb = queue.some(q => q.err) ? 'Retry' : 'Upload'; docEl('docSave').textContent = n > 1 ? `${verb} ${n} files` : verb; }
        docEl('docQueue').innerHTML = queue.map((q, i) => `<div class="q-row ${q.status === 'error' ? 'err' : ''} ${q.status === 'done' ? 'done' : ''}" data-i="${i}">
          <i class="fa-solid ${LumaDocuments.icon({ name: q.file.name, mime_type: q.file.type })}" style="color:#93c5fd"></i>
          <span class="q-name" title="${escapeHtml(q.file.name)}">${escapeHtml(q.file.name)}</span>
          <span class="q-st">${q.status === 'uploading' ? 'Uploading…' : q.status === 'done' ? 'Uploaded' : q.status === 'error' ? escapeHtml(q.msg) : LumaDocuments.formatSize(q.file.size)}</span>
          ${q.status === 'uploading' || q.status === 'done' ? '' : '<i class="fa-solid fa-xmark q-x" title="Remove"></i>'}</div>`).join('');
      };
      const addFiles = list => {
        for (const f of list) {
          if (queue.some(q => q.file.name === f.name && q.file.size === f.size)) continue;
          queue.push(f.size > maxBytes() ? { file: f, status: 'error', msg: 'Over ' + Math.round(maxBytes() / 1048576) + ' MB (your plan limit)' } : { file: f, status: 'pending' });
        }
        if (queue.length === 1 && !docEl('docName').value) docEl('docName').value = queue[0].file.name;
        showErr(docEl('docError'), ''); syncUploadUi();
      };
      const drop = docEl('docDrop');
      drop.onclick = () => docEl('docFile').click();
      drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); docEl('docFile').click(); } };
      docEl('docFile').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
      ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', e => addFiles([...e.dataTransfer.files]));
      docEl('docQueue').onclick = e => {
        const row = e.target.closest('.q-row'); if (!row || !e.target.closest('.q-x')) return;
        queue.splice(+row.dataset.i, 1);
        if (queue.length !== 1) docEl('docName').value = ''; else docEl('docName').value = queue[0].file.name;
        syncUploadUi();
      };

      const openDocModal = (doc, shared = false) => {
        editing = doc || null; editingShared = !!(doc && shared); queue = [];
        docEl('docTitle').textContent = editingShared ? 'Add to category' : doc ? 'Edit document' : 'Upload documents';
        docEl('docSave').textContent = doc ? 'Save' : 'Upload';
        docEl('docFileField').style.display = doc ? 'none' : '';
        docEl('docName').value = doc ? doc.name : '';
        // editing keeps its category; a new upload pre-fills the category being filtered on, or none when viewing All / Uncategorised / Shared
        const filtered = byId(filter) ? filter : null;
        docEl('docCategory').innerHTML = catOptions(editingShared ? doc.recipient_category_id : doc ? doc.category_id : filtered);
        skinSelect(docEl('docCategory'));
        showErr(docEl('docError'), '');
        docEl('docSave').disabled = false;
        syncUploadUi();
        if (editingShared) docEl('docNameField').style.display = 'none'; // you can only file it, not rename the owner's file
        docEl('docOverlay').classList.add('open');
      };
      const closeDocModal = () => docEl('docOverlay').classList.remove('open');
      docEl('docClose').onclick = docEl('docCancel').onclick = closeDocModal;
      docEl('docOverlay').onclick = e => { if (e.target === docEl('docOverlay')) closeDocModal(); };
      docEl('docSave').onclick = async () => {
        const name = docEl('docName').value.trim();
        const category_id = docEl('docCategory').value || null;
        const btn = docEl('docSave'); const label = btn.textContent;
        if (editing && editingShared) {
          btn.disabled = true; btn.textContent = 'Saving…';
          const { error } = await LumaDocuments.setSharedCategory(editing.id, category_id);
          btn.disabled = false; btn.textContent = label;
          if (error) return showErr(docEl('docError'), /set_shared_document_category|schema cache/i.test(error.message) ? 'Not set up yet — run supabase/migrations/007_shared_document_categories.sql in the SQL Editor.' : error.message);
          editing.recipient_category_id = category_id; closeDocModal(); return render();
        }
        if (editing) {
          if (!name) return showErr(docEl('docError'), 'Enter a name.');
          btn.disabled = true; btn.textContent = 'Saving…';
          const res = await LumaDocuments.updateDocument(editing.id, { name, category_id });
          btn.disabled = false; btn.textContent = label;
          if (res.error) return showErr(docEl('docError'), res.error.message);
          Object.assign(editing, res.data); closeDocModal(); return render();
        }
        const todo = queue.filter(q => q.status === 'pending' || q.status === 'error' && q.file.size <= maxBytes());
        if (!todo.length) return showErr(docEl('docError'), 'Choose or drop at least one file.');
        showErr(docEl('docError'), '');
        btn.disabled = true; btn.textContent = 'Uploading…';
        // a custom name only applies when exactly one file is queued
        const custom = queue.length === 1 ? name : '';
        let next = 0;
        const worker = async () => {
          while (next < todo.length) {
            const q = todo[next++]; q.status = 'uploading'; syncUploadUi();
            const res = await LumaDocuments.upload(q.file, { name: custom || q.file.name, categoryId: category_id });
            if (res.error) { q.status = 'error'; q.msg = res.error.message.length > 40 ? 'Failed' : res.error.message; q.err = res.error.message; }
            else { q.status = 'done'; docs.unshift(res.data); filter = 'all'; render(); }
            syncUploadUi();
          }
        };
        await Promise.all([worker(), worker(), worker()]); // up to 3 uploads at a time
        btn.disabled = false;
        const failed = queue.filter(q => q.status === 'error');
        pg.querySelector('#docGrid').scrollTop = 0;
        if (!failed.length) return closeDocModal();
        queue = failed; // keep only the failures so Upload retries them
        showErr(docEl('docError'), `${failed.length} file${failed.length === 1 ? '' : 's'} couldn't be uploaded: ${failed[0].err || failed[0].msg}`);
        syncUploadUi();
      };

      // category manager
      // every category is a row: name (edit to rename), parent select (move),
      // + (add subcategory), trash. Depth shown by indentation.
      const renderCatList = () => {
        docEl('catList').innerHTML = flat().map(({ cat: c, depth }) => {
          const banned = new Set([c.id, ...descendants(c.id)]);
          const opts = `<option value="">Top level</option>` + flat().filter(x => !banned.has(x.cat.id)).map(x => `<option value="${x.cat.id}" ${x.cat.id === c.parent_id ? 'selected' : ''}>${'\u00a0\u00a0'.repeat(x.depth)}${escapeHtml(x.cat.name)}</option>`).join('');
          return `<div class="cat-row" data-id="${c.id}" style="margin-left:${depth * 18}px"><button type="button" class="color-dot" title="Change colour" style="background:${catCol(c)}"></button><input value="${escapeHtml(c.name)}" data-orig="${escapeHtml(c.name)}"><select class="cat-parent" title="Move inside…" style="width:130px;height:38px;border-radius:10px;background-color:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff;font-size:0.7rem">${opts}</select><i class="fa-solid fa-plus cat-sub" title="Add subcategory"></i><i class="fa-regular fa-trash-can cat-del" title="Delete"></i></div>`;
        }).join('');
        docEl('catList').querySelectorAll('.cat-parent').forEach(skinSelect);
      };
      pg.querySelector('#manageCatsBtn').onclick = () => { showErr(docEl('catError'), ''); newCatColor = randomColor(cats.map(catCol)); paintNewColor(); renderCatList(); docEl('catOverlay').classList.add('open'); };
      const closeCats = () => { docEl('catOverlay').classList.remove('open'); render(); };
      docEl('catClose').onclick = closeCats;
      docEl('catOverlay').onclick = e => { if (e.target === docEl('catOverlay')) closeCats(); };
      docEl('catList').onchange = async e => {
        const input = e.target.closest('input'); if (!input) return;
        const id = input.closest('.cat-row').dataset.id; const name = input.value.trim();
        if (!name) { input.value = input.dataset.orig; return; }
        const { data, error } = await LumaDocuments.renameCategory(id, name);
        if (error) { input.value = input.dataset.orig; return showErr(docEl('catError'), error.code === '23505' ? 'You already have a category with that name.' : error.message); }
        showErr(docEl('catError'), ''); input.dataset.orig = data.name;
        cats.find(c => c.id === id).name = data.name;
      };
      docEl('catList').addEventListener('change', async e => {
        const sel = e.target.closest('.cat-parent'); if (!sel) return;
        const c = byId(sel.closest('.cat-row').dataset.id);
        const { data, error } = await LumaDocuments.moveCategory(c.id, sel.value || null);
        if (error) { showErr(docEl('catError'), error.code === '23505' ? 'That location already has a category with this name.' : error.message); return renderCatList(); }
        showErr(docEl('catError'), ''); c.parent_id = data.parent_id; renderCatList();
      });
      docEl('catList').onclick = async e => {
        const row = e.target.closest('.cat-row'); if (!row) return;
        const c = byId(row.dataset.id);
        if (e.target.closest('.color-dot')) {
          return openSwatches(e.target.closest('.color-dot'), catCol(c), async color => {
            const { data, error } = await LumaDocuments.setCategoryColor(c.id, color);
            if (error) return showErr(docEl('catError'), /color/i.test(error.message) ? 'Colours aren\'t set up yet — run supabase/migrations/006_colors.sql in the SQL Editor.' : error.message);
            showErr(docEl('catError'), ''); c.color = data.color; renderCatList(); render();
          });
        }
        if (e.target.closest('.cat-sub')) {
          const name = ((await luPrompt({ title: 'New subcategory', message: `Inside “${c.name}”`, placeholder: 'Category name' })) || '').trim(); if (!name) return;
          const { data, error } = await LumaDocuments.addCategory(name, c.id, randomColor(cats.map(catCol)));
          if (error) return showErr(docEl('catError'), error.code === '23505' ? 'That category already has a subcategory with this name.' : error.message);
          showErr(docEl('catError'), ''); cats.push(data); return renderCatList();
        }
        if (!e.target.closest('.cat-del')) return;
        const n = docs.filter(d => d.category_id === c.id).length, sub = kids(c.id).length;
        if (!await luConfirm({ title: `Delete “${c.name}”?`, message: ((n ? `Its ${n} document${n === 1 ? '' : 's'} will become uncategorised. ` : '') + (sub ? `Its ${sub} subcategor${sub === 1 ? 'y' : 'ies'} will move to top level.` : '')).trim() || 'This category will be removed.', ok: 'Delete category' })) return;
        const { error } = await LumaDocuments.deleteCategory(c.id);
        if (error) return showErr(docEl('catError'), error.message);
        cats = cats.filter(x => x !== c); cats.forEach(x => { if (x.parent_id === c.id) x.parent_id = null; });
        docs.forEach(d => { if (d.category_id === c.id) d.category_id = null; });
        if (filter === c.id) filter = 'all';
        renderCatList();
      };
      // the new-category colour starts random (preferring unused colours); the dot lets you change it
      let newCatColor = randomColor(cats.map(catCol));
      const paintNewColor = () => { docEl('catNewColor').style.background = newCatColor; };
      docEl('catNewColor').onclick = e => openSwatches(e.currentTarget, newCatColor, c => { newCatColor = c; paintNewColor(); });
      docEl('catAdd').onclick = async () => {
        const name = docEl('catNew').value.trim(); if (!name) return;
        const { data, error } = await LumaDocuments.addCategory(name, null, newCatColor);
        if (error) return showErr(docEl('catError'), error.code === '23505' ? 'You already have a category with that name.' : error.message);
        showErr(docEl('catError'), ''); cats.push(data); docEl('catNew').value = ''; newCatColor = randomColor(cats.map(catCol)); paintNewColor(); renderCatList();
      };
      docEl('catNew').onkeydown = e => { if (e.key === 'Enter') docEl('catAdd').click(); };

      // share dialog
      let sharing = null;
      const renderShareList = () => {
        const on = new Set(shares.filter(x => x.document_id === sharing.id).map(x => x.shared_with));
        docEl('shareList').innerHTML = people.length ? selectAllRow(people.length) + people.map(p => `<label class="cat-row" style="cursor:pointer"><input type="checkbox" data-uid="${p.id}" ${on.has(p.id) ? 'checked' : ''} ><span style="color:#fff;font-size:0.82rem">${escapeHtml(p.name)}</span><span class="ls" style="margin-left:auto">${escapeHtml(p.email || '')}</span></label>`).join('')
          : '<div class="ls" style="padding:8px 2px">No contacts yet — add one on the Contacts page and wait for them to accept.</div>';
        syncSelectAll(docEl('shareList'));
      };
      const closeShare = () => { docEl('shareOverlay').classList.remove('open'); render(); };
      docEl('shareClose').onclick = closeShare;
      docEl('shareOverlay').onclick = e => { if (e.target === docEl('shareOverlay')) closeShare(); };
      // ticks are staged; the Share button applies the difference (adds + removals)
      docEl('shareSave').onclick = async () => {
        const want = new Set([...docEl('shareList').querySelectorAll('input[data-uid]:checked')].map(c => c.dataset.uid));
        const have = new Set(shares.filter(x => x.document_id === sharing.id).map(x => x.shared_with));
        const add = [...want].filter(u => !have.has(u)), del = [...have].filter(u => !want.has(u));
        showErr(docEl('shareError'), ''); docEl('shareOk').style.display = 'none';
        if (!add.length && !del.length) return closeShare();
        const btn = docEl('shareSave'); btn.disabled = true; btn.textContent = 'Saving…';
        const results = await Promise.all([
          ...add.map(u => LumaDocuments.share(sharing.id, u).then(r => ({ r, u, add: true }))),
          ...del.map(u => LumaDocuments.unshare(sharing.id, u).then(r => ({ r, u, add: false }))),
        ]);
        btn.disabled = false; btn.textContent = 'Share';
        results.forEach(({ r, u, add }) => {
          if (r.error) return;
          if (add) shares.push({ document_id: sharing.id, shared_with: u });
          else shares = shares.filter(x => !(x.document_id === sharing.id && x.shared_with === u));
        });
        // let each new recipient know in their 1:1 chat with me (best effort — the share itself already succeeded)
        const doc = sharing.name;
        await Promise.all(results.filter(x => x.add && !x.r.error).map(x => {
          const person = people.find(p => p.id === x.u);
          return person && person.contactId ? LumaContacts.sendMessage(person.contactId, `📎 I shared a document with you: “${doc}”. Find it under Documents → Shared with me.`) : null;
        }));
        const failed = results.find(x => x.r.error);
        if (failed) {
          renderShareList();
          const e = failed.r.error, missing = /document_shares|schema cache|does not exist/i.test(e.message || '') || ['42P01', 'PGRST205'].includes(e.code);
          return showErr(docEl('shareError'), missing ? 'Sharing isn\'t set up yet — run supabase/migrations/004_document_sharing.sql in the SQL Editor.' : e.message);
        }
        const ok = docEl('shareOk');
        ok.textContent = [add.length ? `Shared with ${add.length} contact${add.length === 1 ? '' : 's'}` : '', del.length ? `removed access for ${del.length}` : ''].filter(Boolean).join(' · ').replace(/^./, c => c.toUpperCase());
        ok.style.display = 'flex'; btn.disabled = true;
        setTimeout(closeShare, 900);
      };
      const openShare = d => {
        sharing = d; docEl('shareTitle').textContent = 'Share “' + d.name + '”';
        showErr(docEl('shareError'), ''); docEl('shareOk').style.display = 'none'; docEl('shareSave').disabled = false; docEl('shareSave').textContent = 'Share'; renderShareList(); docEl('shareOverlay').classList.add('open');
      };

      pg.querySelector('#uploadDocBtn').onclick = () => openDocModal(null);
      const docDateBtn = pg.querySelector('#docDateBtn');
      docDateBtn.onclick = () => openDateFilter(docDateBtn, dateF, st => { dateF = st; paintDateFilterBtn(docDateBtn, dateF); render(); }); // filters by upload date (shared files: the date they were shared)
      pg.querySelector('#docFilters').onclick = e => { const f = e.target.closest('.doc-filter'); if (f) { filter = f.dataset.k; render(); } };
      pg.querySelector('#docGrid').onclick = async e => {
        const el = e.target.closest('.doc-card'); if (!el) return;
        if (el.dataset.shared) {
          const sd = sharedDocs.find(x => x.id === el.dataset.id); if (!sd) return;
          if (e.target.closest('.doc-unshare')) {
            const { error } = await LumaDocuments.removeSharedWithMe(sd.id);
            if (error) return luAlert('Could not remove: ' + error.message);
            sharedDocs = sharedDocs.filter(x => x !== sd); return render();
          }
          if (e.target.closest('.doc-file')) return openDocModal(sd, true);
          return viewDocument(sd);
        }
        const d = docs.find(x => x.id === el.dataset.id); if (!d) return;
        if (e.target.closest('.doc-share')) return openShare(d);
        if (e.target.closest('.doc-edit')) return openDocModal(d);
        if (e.target.closest('.doc-del')) {
          if (!await luConfirm({ title: 'Delete this document?', message: `“${d.name}” will be permanently deleted. This can't be undone.`, ok: 'Delete document' })) return;
          const { error } = await LumaDocuments.remove(d);
          if (error) return luAlert('Could not delete: ' + error.message);
          docs = docs.filter(x => x !== d); return render();
        }
        viewDocument(d);
      };

      const [c, d, sh, sw, ct] = await Promise.all([LumaDocuments.listCategories(), LumaDocuments.listDocuments(), LumaDocuments.listMyShares(), LumaDocuments.listSharedWithMe(), LumaContacts.listContacts()]);
      if (c.error || d.error) {
        sub.textContent = 'Could not load documents — has supabase/migrations/003_documents.sql been run?';
        return;
      }
      cats = c.data;
      // documents can include rows shared with me (read-only) — keep only my own here
      docs = d.data.filter(x => !sw.data || !sw.data.some(y => y.id === x.id));
      // sharing is optional until 004 has been run; its absence just hides the feature
      shares = sh.error ? [] : sh.data;
      sharedDocs = sw.error ? [] : sw.data;
      if (filter !== 'all' && filter !== 'none' && filter !== 'shared' && !cats.some(c => c.id === filter)) filter = 'all'; // the folder was deleted meanwhile
      paintDateFilterBtn(docDateBtn, dateF);
      people = ct.error ? [] : ct.data.filter(r => r.status === 'accepted').map(r => ({ id: r.other_id, name: contactDisplayName(r), email: r.other_email, contactId: r.contact_id }));
      render();
    }



    WIRE.documents = function (pg) { return loadDocuments(pg); };
