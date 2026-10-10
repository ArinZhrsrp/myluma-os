// LUMA — module: feedback (a Feedback page for everyone, and the Feedback inbox for administrators)
    // Pick the module (and the part of it), say what kind of message it is, write your comments and add a picture if you like.
    // It goes to the developer; nothing else about you is sent except your name and email (so there can be a reply) and a little context
    // (the page you came from, the app version, the screen size). Tables and rules: supabase/migrations/081_feedback.sql.
    const FB_MODULES = [
      ['dashboard', 'Dashboard', ['Overview', 'Today\'s schedule', 'Priorities', 'Money and habits cards', 'Lumi suggestions', 'Busy-day alerts']],
      ['calendar', 'Calendar', ['Month view', 'Week view', 'Day view', 'Year view', 'Creating or editing events', 'Invitations', 'Calendar file (export)']],
      ['reminders', 'Reminders', ['Creating a reminder', 'Repeating reminders', 'Notifications']],
      ['tasks', 'Tasks & Work (Personal)', ['Task list', 'Repeating tasks', 'Checklists', 'Calendar export']],
      ['money', 'Money', ['Overview', 'Income & salary', 'Budget', 'Transactions', 'Charts']],
      ['split', 'Split expenses', ['Creating a split', 'Tax', 'Marking as paid']],
      ['subscriptions', 'Subscriptions', []], ['bills', 'Bills', ['Paying', 'Recurring bills']], ['goals', 'Goals', []], ['habits', 'Habits', ['Today', 'Consistency']],
      ['health', 'Health', []], ['notes', 'Notes', []], ['documents', 'Documents', ['Uploading', 'Sharing', 'Folders']], ['contacts', 'Contacts & chat', ['Requests', 'Chat']],
      ['assistant', 'Lumi (AI assistant)', ['Answers', 'Adding things for me', 'Speed']], ['analytics', 'Analytics', []],
      ['settings', 'Settings', ['Appearance', 'Reminders', 'Plan & add-ons', 'Account', 'Install on my phone']], ['notifications', 'Notifications', []], ['support', 'Support & FAQ', []],
      ['work', 'Work', ['Overview', 'Projects', 'Tasks: board', 'Tasks: list', 'Tasks: Gantt chart', 'Tasks: timeline', 'Time & timesheet', 'Comments & files', 'Team & invitations', 'Reminders']],
      ['company', 'Work: Companies', []],
      ['study', 'Study', ['Overview', 'Timetable', 'Assignments', 'Subjects', 'Semesters', 'Notes', 'Flashcards', 'Groups', 'Archive']],
      ['login', 'Sign in, register or password', []], ['admin', 'Admin (administrators)', []], ['other', 'Something else / the whole app', []],
    ];
    const FB_KINDS = [['bug', 'Bug', 'fa-bug', '#f87171'], ['idea', 'Idea', 'fa-lightbulb', '#fbbf24'], ['question', 'Question', 'fa-circle-question', '#60a5fa'], ['praise', 'Praise', 'fa-heart', '#f472b6']];
    const FB_STATUS = [['new', 'New', '#60a5fa'], ['seen', 'Seen', '#94a3b8'], ['planned', 'Planned', '#a78bfa'], ['done', 'Done', '#34d399'], ['wontfix', 'Won\'t do', '#f87171']];
    const FB_PAGE_TO_MODULE = { studyarchive: 'study', purchases: 'settings', adminreport: 'admin', adminfeedback: 'admin', feedback: 'other' };
    const FB = { kind: 'idea', file: null, busy: false, mine: [], prev: '' };
    const fbDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    MODULES.feedback = function () {
      return head('Feedback', 'Tell the developer what to fix or add') + `<div id="fbRoot"></div>`;
    };
    function fbPaint() {
      const root = docEl('fbRoot'); if (!root) return;
      const mods = FB_MODULES.filter(m => m[0] !== 'admin' || LumaPlan.admin);
      let cur = FB_PAGE_TO_MODULE[FB.prev] || FB.prev; if (!mods.some(m => m[0] === cur)) cur = 'other';
      root.innerHTML = `<div class="card fb-card"><div class="section-title"><i class="fa-regular fa-comment-dots"></i> New message</div>
        <div class="pem-msg error" id="fbError"></div><div class="pem-msg ok" id="fbOk" style="display:none"></div>
        <div class="fb-row"><div class="pem-field"><label>Module <span style="color:#fca5a5">*</span></label><select id="fbModule">${mods.map(m => `<option value="${m[0]}" ${m[0] === cur ? 'selected' : ''}>${m[1]}</option>`).join('')}</select></div>
          <div class="pem-field" id="fbPartBox"><label>Part of it <span class="fb-dim">(optional)</span></label><select id="fbPart"></select></div></div>
        <div class="pem-field"><label>What kind of message?</label><div class="h-tpls" id="fbKinds">${FB_KINDS.map(([k, n, i, c]) => `<button type="button" data-fbk="${k}" class="${k === FB.kind ? 'on' : ''}" style="--c:${c}"><i class="fa-solid ${i}"></i> ${n}</button>`).join('')}</div></div>
        <div class="pem-field"><label>Your comments <span style="color:#fca5a5">*</span></label><textarea id="fbText" maxlength="4000" placeholder="What happened, what did you expect, or what would you like? The more detail the better."></textarea><div class="fb-count"><span id="fbLen">0</span> / 4000</div></div>
        <div class="pem-field"><label>Picture <span class="fb-dim">(optional: a screenshot helps a lot)</span></label>
          <div class="fb-pic" id="fbPic"><button type="button" class="np-btn" id="fbPick"><i class="fa-regular fa-image"></i> Add a picture</button><input type="file" id="fbFile" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none"></div>
          <div class="fb-prev" id="fbPrev" style="display:none"><img id="fbImg" alt="Your picture"><button type="button" class="fb-x" id="fbDrop" title="Remove the picture" aria-label="Remove the picture"><i class="fa-solid fa-xmark"></i></button></div></div>
        <div class="fb-actions"><button type="button" class="create-btn" id="fbSend"><i class="fa-solid fa-paper-plane"></i> Send feedback</button><span class="fb-dim">Sent with your name and email so the developer can reply. Up to 10 messages a day.</span></div></div>
        <div id="fbMine"></div>`;
      const sel = docEl('fbModule'); skinSelect(sel); fbPaintPart(); fbPaintMine();
    }
    function fbPaintPart() {
      const m = FB_MODULES.find(x => x[0] === docEl('fbModule').value), box = docEl('fbPartBox'), sel = docEl('fbPart'), parts = m ? m[2] : [];
      box.style.display = parts.length ? '' : 'none'; sel.innerHTML = '<option value="">The whole thing / not sure</option>' + parts.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join(''); sel.value = ''; skinSelect(sel);
    }
    function fbPaintMine() {
      const box = docEl('fbMine'); if (!box) return;
      box.innerHTML = FB.mine.length ? card(`<div class="section-title"><i class="fa-solid fa-inbox"></i> Your messages <small class="fb-dim">${FB.mine.length}</small></div>${FB.mine.map(f => { const st = FB_STATUS.find(x => x[0] === f.status) || FB_STATUS[0], k = FB_KINDS.find(x => x[0] === f.kind) || FB_KINDS[1];
        return `<div class="fb-it"><div class="fb-ith"><span class="fb-k" style="--c:${k[3]}"><i class="fa-solid ${k[2]}"></i> ${k[1]}</span><b>${escapeHtml(f.module)}${f.part ? ' › ' + escapeHtml(f.part) : ''}</b><span class="fb-st" style="--c:${st[2]}">${st[1]}</span></div><p>${escapeHtml(f.message)}</p>${f.image_path ? '<small class="fb-dim"><i class="fa-regular fa-image"></i> with a picture</small>' : ''}${f.admin_note ? `<div class="fb-note"><i class="fa-solid fa-reply"></i> ${escapeHtml(f.admin_note)}</div>` : ''}<small class="fb-dim">${fbDate(f.created_at)}</small></div>`; }).join('')}`) : '';
    }
    async function fbLoadMine() { const r = await LumaAuth.client.schema('luma').from('feedback').select('id, kind, module, part, message, image_path, status, admin_note, created_at').order('created_at', { ascending: false }).limit(30); FB.mine = r.error ? [] : (r.data || []); fbPaintMine(); return r; }

    // shrink big screenshots before they are sent (GIFs are sent as they are)
    async function fbPrepare(file) {
      if (!/^image\//.test(file.type)) throw new Error('Please choose a picture (PNG, JPG, WEBP or GIF).');
      if (file.type === 'image/gif') { if (file.size > 5 * 1048576) throw new Error('That picture is bigger than 5 MB.'); return file; }
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be read.')); i.src = url; });
        const max = 1800, sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)); if (sc === 1 && file.size <= 1.5 * 1048576) return file;
        const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.86)); if (!blob || blob.size > 5 * 1048576) throw new Error('That picture is too large even after shrinking it.');
        return new File([blob], (file.name || 'screenshot').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
      } finally { URL.revokeObjectURL(url); }
    }
    async function fbSetFile(file) {
      const err = docEl('fbError'); err.style.display = 'none';
      try { FB.file = await fbPrepare(file); } catch (e) { FB.file = null; err.textContent = e.message; err.style.display = 'flex'; }
      docEl('fbPrev').style.display = FB.file ? '' : 'none'; if (FB.file) docEl('fbImg').src = URL.createObjectURL(FB.file);
    }
    async function fbSend() {
      if (FB.busy) return; const err = docEl('fbError'), ok = docEl('fbOk'), btn = docEl('fbSend'), text = docEl('fbText').value.trim(); err.style.display = ok.style.display = 'none';
      if (text.length < 3) { err.textContent = 'Write a few words about it first.'; err.style.display = 'flex'; return docEl('fbText').focus(); }
      FB.busy = true; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending…';
      const m = FB_MODULES.find(x => x[0] === docEl('fbModule').value) || FB_MODULES[FB_MODULES.length - 1], sb = LumaAuth.client;
      try {
        let path = null;
        if (FB.file) { const ext = (FB.file.type.split('/')[1] || 'png').replace('jpeg', 'jpg'); path = `${LUMA_USER.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`; const up = await sb.storage.from('luma-feedback').upload(path, FB.file, { contentType: FB.file.type, upsert: false }); if (up.error) throw new Error(/bucket|not found/i.test(up.error.message) ? 'Pictures are not set up yet (run supabase/migrations/081_feedback.sql).' : 'The picture could not be uploaded: ' + up.error.message); }
        const row = { kind: FB.kind, module: m[1], part: docEl('fbPart').value || '', message: text, image_path: path, context: { page: FB.prev || '', mode: typeof LUMA_MODE !== 'undefined' ? LUMA_MODE : '', version: window.LUMA_VERSION || '', screen: `${innerWidth}x${innerHeight}`, lang: navigator.language || '', ua: (navigator.userAgent || '').slice(0, 160) } };
        const r = await sb.schema('luma').from('feedback').insert(row); if (r.error) { if (path) sb.storage.from('luma-feedback').remove([path]); throw new Error(/feedback|schema cache|does not exist/i.test(r.error.message) && !/10 messages/.test(r.error.message) ? 'Feedback is not set up yet (run supabase/migrations/081_feedback.sql).' : r.error.message); }
        docEl('fbText').value = ''; docEl('fbLen').textContent = '0'; FB.file = null; docEl('fbPrev').style.display = 'none'; docEl('fbFile').value = '';
        ok.textContent = 'Thank you! Your message was sent to the developer.'; ok.style.display = 'flex'; flashToast('Feedback sent', 'Thank you', 'fa-paper-plane', '#34d399'); fbLoadMine();
      } catch (e) { err.textContent = e.message || 'Could not send. Please try again.'; err.style.display = 'flex'; }
      FB.busy = false; btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send feedback';
    }
    WIRE.feedback = async function (pg) {
      FB.prev = window.LU_PREV_PAGE || ''; FB.file = null; FB.kind = 'idea'; fbPaint();
      pg.addEventListener('click', e => {
        const k = e.target.closest('[data-fbk]'); if (k) { FB.kind = k.dataset.fbk; pg.querySelectorAll('[data-fbk]').forEach(b => b.classList.toggle('on', b === k)); }
        if (e.target.closest('#fbPick')) docEl('fbFile').click(); if (e.target.closest('#fbDrop')) { FB.file = null; docEl('fbPrev').style.display = 'none'; docEl('fbFile').value = ''; }
        if (e.target.closest('#fbSend')) fbSend();
      });
      pg.addEventListener('change', e => { if (e.target.id === 'fbModule') fbPaintPart(); if (e.target.id === 'fbFile' && e.target.files[0]) fbSetFile(e.target.files[0]); });
      pg.addEventListener('input', e => { if (e.target.id === 'fbText') docEl('fbLen').textContent = e.target.value.length; });
      fbLoadMine();
    };

    // ---------- the inbox (administrators) ----------
    const FBA = { rows: [], status: 'new', module: '', q: '', urls: {} };
    MODULES.adminfeedback = function () {
      return head('Feedback inbox', '<span id="fbaSub">Loading…</span>', '<button class="create-btn" id="fbaBack" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-arrow-left"></i> Admin</button>') + '<div id="fbaRoot"></div>';
    };
    function fbaPaint() {
      const root = docEl('fbaRoot'), sub = docEl('fbaSub'); if (!root) return;
      const all = FBA.rows, rows = all.filter(f => (!FBA.status || f.status === FBA.status) && (!FBA.module || f.module === FBA.module) && (!FBA.q || (f.message + ' ' + f.user_label + ' ' + f.part).toLowerCase().includes(FBA.q.toLowerCase())));
      const count = s => all.filter(f => f.status === s).length, mods = [...new Set(all.map(f => f.module))].sort();
      sub.textContent = `${count('new')} new · ${all.length} in total`;
      root.innerHTML = `<div class="fb-fbar"><div class="fb-chips" id="fbaChips">${[['', 'All', all.length]].concat(FB_STATUS.map(s => [s[0], s[1], count(s[0])])).map(([k, n, c]) => `<button type="button" data-fbs="${k}" class="${FBA.status === k ? 'on' : ''}">${n} <em>${c}</em></button>`).join('')}</div>
        <select id="fbaMod"><option value="">All modules</option>${mods.map(m => `<option ${m === FBA.module ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}</select><input id="fbaQ" type="text" placeholder="Search…" value="${escapeHtml(FBA.q)}" autocomplete="off"></div>`
        + (rows.length ? rows.map(f => { const k = FB_KINDS.find(x => x[0] === f.kind) || FB_KINDS[1], c = f.context || {};
          return `<div class="card fb-item" data-id="${f.id}"><div class="fb-ith"><span class="fb-k" style="--c:${k[3]}"><i class="fa-solid ${k[2]}"></i> ${k[1]}</span><b>${escapeHtml(f.module)}${f.part ? ' › ' + escapeHtml(f.part) : ''}</b><small class="fb-dim">${fbDate(f.created_at)}</small></div>
            <div class="fb-who">${escapeHtml(f.user_label || 'Deleted account')}</div><p>${escapeHtml(f.message)}</p>
            ${f.image_path ? `<button type="button" class="fb-thumb" data-fbimg="${f.id}" title="Open the picture">${FBA.urls[f.image_path] ? `<img src="${FBA.urls[f.image_path]}" alt="Picture sent with the message">` : '<i class="fa-regular fa-image"></i> Open picture'}</button>` : ''}
            <div class="fb-ctx">${[c.page && 'from ' + c.page, c.mode && c.mode + ' mode', c.version && 'v' + c.version, c.screen].filter(Boolean).map(escapeHtml).join(' · ')}</div>
            <div class="fb-adm"><select data-fbst>${FB_STATUS.map(s => `<option value="${s[0]}" ${s[0] === f.status ? 'selected' : ''}>${s[1]}</option>`).join('')}</select><input type="text" data-fbnote maxlength="1000" placeholder="Note to the person (sent when you mark it Planned or Done)" value="${escapeHtml(f.admin_note || '')}"><button type="button" class="np-btn" data-fbsave>Save</button><button type="button" class="np-btn danger" data-fbdel title="Delete" aria-label="Delete"><i class="fa-regular fa-trash-can"></i></button></div></div>`; }).join('')
          : card('<div class="h-empty"><div class="h-empty-ico"><i class="fa-regular fa-comment-dots"></i></div><div class="h-empty-t">Nothing here</div><div class="h-empty-s">No messages match these filters.</div></div>'));
      root.querySelectorAll('select').forEach(s => skinSelect(s));
    }
    async function fbaLoad() {
      const sub = docEl('fbaSub'), root = docEl('fbaRoot');
      if (!LumaPlan.admin) { sub.textContent = 'Not allowed'; root.innerHTML = card('<div class="ls">This page is only for administrators.</div>'); return; }
      const r = await LumaAuth.client.schema('luma').from('feedback').select('id, user_label, kind, module, part, message, image_path, context, status, admin_note, created_at').order('created_at', { ascending: false }).limit(500);
      if (r.error) { sub.textContent = 'Could not load'; root.innerHTML = card(`<div class="ls">${/feedback|schema cache|does not exist/i.test(r.error.message) ? 'Run <b>supabase/migrations/081_feedback.sql</b> first.' : escapeHtml(r.error.message)}</div>`); return; }
      FBA.rows = r.data || [];
      const paths = FBA.rows.filter(f => f.image_path).map(f => f.image_path).slice(0, 60);
      if (paths.length) { try { const s = await LumaAuth.client.storage.from('luma-feedback').createSignedUrls(paths, 3600); (s.data || []).forEach(x => { if (x.signedUrl) FBA.urls[x.path] = x.signedUrl; }); } catch (e) { /* the pictures just show as links */ } }
      fbaPaint();
    }
    WIRE.adminfeedback = async function (pg) {
      pg.querySelector('#fbaBack').onclick = () => goTo('admin');
      pg.addEventListener('click', async e => {
        const s = e.target.closest('[data-fbs]'); if (s) { FBA.status = s.dataset.fbs; return fbaPaint(); }
        const card0 = e.target.closest('.fb-item'); if (!card0) return; const id = card0.dataset.id, f = FBA.rows.find(x => x.id === id); if (!f) return;
        const im = e.target.closest('[data-fbimg]'); if (im) { const u = FBA.urls[f.image_path] || (await LumaAuth.client.storage.from('luma-feedback').createSignedUrl(f.image_path, 3600)).data?.signedUrl; if (u) window.open(u, '_blank', 'noopener'); return; }
        if (e.target.closest('[data-fbsave]')) { const st = card0.querySelector('[data-fbst]').value, note = card0.querySelector('[data-fbnote]').value; const r = await LumaAuth.client.schema('luma').rpc('admin_feedback_update', { p_id: id, p_status: st, p_note: note }); if (r.error) return luAlert(r.error.message); f.status = st; f.admin_note = note; flashToast('Saved', f.module, 'fa-check', '#34d399'); return fbaPaint(); }
        if (e.target.closest('[data-fbdel]')) { if (!await luConfirm({ title: 'Delete this feedback?', message: 'It is removed for good, with its picture.', ok: 'Delete' })) return; const r = await LumaAuth.client.schema('luma').rpc('admin_feedback_delete', { p_id: id }); if (r.error) return luAlert(r.error.message); if (f.image_path) LumaAuth.client.storage.from('luma-feedback').remove([f.image_path]); FBA.rows = FBA.rows.filter(x => x !== f); fbaPaint(); }
      });
      pg.addEventListener('change', e => { if (e.target.id === 'fbaMod') { FBA.module = e.target.value; fbaPaint(); } });
      pg.addEventListener('input', e => { if (e.target.id === 'fbaQ') { FBA.q = e.target.value; const pos = e.target.selectionStart; fbaPaint(); const q = docEl('fbaQ'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } } });
      await fbaLoad();
    };
