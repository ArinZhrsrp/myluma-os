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
    const FB = { kind: 'idea', file: null, busy: false, mine: [], prev: '', replies: {}, replying: '', urls: {} };
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
        return `<div class="fb-it" data-id="${f.id}"><div class="fb-ith"><span class="fb-k" style="--c:${k[3]}"><i class="fa-solid ${k[2]}"></i> ${k[1]}</span><b>${escapeHtml(f.module)}${f.part ? ' › ' + escapeHtml(f.part) : ''}</b><span class="fb-st" style="--c:${st[2]}">${st[1]}</span></div><p>${escapeHtml(f.message)}</p>${f.image_path ? `<button type="button" class="fb-thumb" data-fbmyimg="${f.id}" title="Open the picture">${FB.urls[f.image_path] ? `<img src="${FB.urls[f.image_path]}" alt="The picture you sent">` : '<i class="fa-regular fa-image"></i> Open picture'}</button>` : ''}${f.admin_note ? `<div class="fb-note"><i class="fa-solid fa-reply"></i> ${escapeHtml(f.admin_note)}</div>` : ''}${(FB.replies[f.id] || []).map(x => fbBubble(x, !x.from_admin)).join('')}${f.admin_note || (FB.replies[f.id] || []).some(x => x.from_admin) ? (FB.replying === f.id ? `<div class="fb-rform"><textarea data-fbrtext maxlength="1000" rows="3" placeholder="Write your reply…"></textarea><div class="fb-radm"><button type="button" class="np-btn" data-fbrsend><i class="fa-solid fa-paper-plane"></i> Send reply</button><button type="button" class="np-btn" data-fbrcancel>Cancel</button></div></div>` : `<button type="button" class="np-btn fb-rbtn" data-fbreply="${f.id}"><i class="fa-solid fa-reply"></i> Reply</button>`) : ''}<small class="fb-dim">${fbDate(f.created_at)}</small></div>`; }).join('')}`) : '';
    }
    async function fbLoadMine() { const r = await LumaAuth.client.schema('luma').from('feedback').select('id, kind, module, part, message, image_path, status, admin_note, created_at').eq('user_id', LUMA_USER.id).order('created_at', { ascending: false }).limit(30); FB.mine = r.error ? [] : (r.data || []); await fbLoadReplies(FB.mine, FB.replies); await fbSignMine(); fbPaintMine(); return r; }
    // the pictures I sent: short-lived links so they can be shown here
    async function fbSignMine() {
      const paths = FB.mine.filter(f => f.image_path && !FB.urls[f.image_path]).map(f => f.image_path).slice(0, 30); if (!paths.length) return;
      try { const r = await LumaAuth.client.storage.from('luma-feedback').createSignedUrls(paths, 3600); (r.data || []).forEach(x => { if (x.signedUrl) FB.urls[x.path] = x.signedUrl; }); } catch (e) { /* the picture just shows as a link */ }
    }
    // the replies people sent to an administrator's note (migration 092); without the table, feedback still works
    async function fbLoadReplies(rows, into) {
      Object.keys(into).forEach(k => delete into[k]); const ids = rows.map(f => f.id); if (!ids.length) return;
      const r = await LumaAuth.client.schema('luma').from('feedback_replies').select('id, feedback_id, body, created_at, from_admin').in('feedback_id', ids).order('created_at'); if (r.error) return;
      (r.data || []).forEach(x => { (into[x.feedback_id] = into[x.feedback_id] || []).push(x); });
    }
    // one reply, from the person (their Feedback page) or from an administrator (the inbox); `scope` is the card holding the text box
    async function fbSendReply(id, scope, replies, done) {
      const box = scope && scope.querySelector('[data-fbrtext]'), body = box ? box.value.trim() : '';
      if (!body) return luAlert('Write your reply first.');
      const btn = scope.querySelector('[data-fbrsend]'); if (btn) btn.disabled = true;
      const r = await LumaAuth.client.schema('luma').from('feedback_replies').insert({ feedback_id: id, body }).select('id, feedback_id, body, created_at, from_admin').single();
      if (r.error) { if (btn) btn.disabled = false; return luAlert(/could not find the table|relation .* does not exist/i.test(r.error.message) ? 'Replies are not switched on yet (run supabase/migrations/092_feedback_replies.sql, then wait a few seconds).' : r.error.message); }
      (replies[id] = replies[id] || []).push(r.data); done(); flashToast('Reply sent', LumaPlan.admin && r.data.from_admin ? 'They will be notified.' : 'The developer will see it.', 'fa-reply', '#34d399');
    }
    // a reply as a bubble: the developer's side is green like the note, the person's is blue
    const fbBubble = (x, mine) => `<div class="fb-reply ${x.from_admin ? 'adm' : ''}"><i class="fa-solid fa-turn-up"></i> <span>${escapeHtml(x.body)}</span> <small class="fb-dim">${mine ? 'You' : x.from_admin ? 'Developer' : 'Them'} · ${fbDate(x.created_at)}</small></div>`;

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
      if (pg.dataset.fbWired) return fbLoadMine(); // wire the page's listeners once, not on every visit
      pg.dataset.fbWired = '1';
      pg.addEventListener('click', e => {
        const k = e.target.closest('[data-fbk]'); if (k) { FB.kind = k.dataset.fbk; pg.querySelectorAll('[data-fbk]').forEach(b => b.classList.toggle('on', b === k)); }
        if (e.target.closest('#fbPick')) docEl('fbFile').click(); if (e.target.closest('#fbDrop')) { FB.file = null; docEl('fbPrev').style.display = 'none'; docEl('fbFile').value = ''; }
        if (e.target.closest('#fbSend')) fbSend();
        const mi = e.target.closest('[data-fbmyimg]'); if (mi) { const f = FB.mine.find(x => x.id === mi.dataset.fbmyimg); if (f) { const u = FB.urls[f.image_path]; if (u) window.open(u, '_blank', 'noopener'); else LumaAuth.client.storage.from('luma-feedback').createSignedUrl(f.image_path, 3600).then(r => { if (r.data && r.data.signedUrl) window.open(r.data.signedUrl, '_blank', 'noopener'); }); } return; }
        const rp = e.target.closest('[data-fbreply]'); if (rp) { FB.replying = rp.dataset.fbreply; fbPaintMine(); const t = pg.querySelector('[data-fbrtext]'); if (t) t.focus(); }
        if (e.target.closest('[data-fbrcancel]')) { FB.replying = ''; fbPaintMine(); }
        const rs = e.target.closest('[data-fbrsend]'); if (rs) { const it = rs.closest('.fb-it'); fbSendReply(it.dataset.id, it, FB.replies, () => { FB.replying = ''; fbPaintMine(); }); }
      });
      pg.addEventListener('change', e => { if (e.target.id === 'fbModule') fbPaintPart(); if (e.target.id === 'fbFile' && e.target.files[0]) fbSetFile(e.target.files[0]); });
      pg.addEventListener('input', e => { if (e.target.id === 'fbText') docEl('fbLen').textContent = e.target.value.length; });
      fbLoadMine();
    };

    // ---------- the inbox (administrators) ----------
    const FBA = { rows: [], status: 'new', module: '', q: '', urls: {}, replies: {}, replying: '' }; // status '' = All (the last pill); the inbox opens on New
    MODULES.adminfeedback = function () {
      return head('Feedback inbox', '<span id="fbaSub">Loading…</span>', '<button class="create-btn" id="fbaBack" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-arrow-left"></i> Admin</button><button class="create-btn" id="fbaFloor" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-robot"></i> Agent floor</button>') + '<div id="fbaRoot"></div>';
    };
    function fbaPaint() {
      const root = docEl('fbaRoot'), sub = docEl('fbaSub'); if (!root) return;
      const all = FBA.rows, rows = all.filter(f => (!FBA.status || f.status === FBA.status) && (!FBA.module || f.module === FBA.module) && (!FBA.q || (f.message + ' ' + f.user_label + ' ' + f.part).toLowerCase().includes(FBA.q.toLowerCase())));
      const count = s => all.filter(f => f.status === s).length, mods = [...new Set(all.map(f => f.module))].sort();
      sub.textContent = `${count('new')} new · ${all.length} in total`;
      root.innerHTML = `<div class="fb-fbar"><div class="fb-chips" id="fbaChips">${FB_STATUS.map(s => [s[0], s[1], count(s[0])]).concat([['', 'All', all.length]]).map(([k, n, c]) => `<button type="button" data-fbs="${k}" class="${FBA.status === k ? 'on' : ''}">${n} <em>${c}</em></button>`).join('')}</div>
        <select id="fbaMod"><option value="">All modules</option>${mods.map(m => `<option ${m === FBA.module ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}</select><input id="fbaQ" type="text" placeholder="Search…" value="${escapeHtml(FBA.q)}" autocomplete="off"></div>`
        + (rows.length ? rows.map(f => { const k = FB_KINDS.find(x => x[0] === f.kind) || FB_KINDS[1], c = f.context || {};
          return `<div class="card fb-item" data-id="${f.id}"><div class="fb-ith"><span class="fb-k" style="--c:${k[3]}"><i class="fa-solid ${k[2]}"></i> ${k[1]}</span><b>${escapeHtml(f.module)}${f.part ? ' › ' + escapeHtml(f.part) : ''}</b><small class="fb-dim">${fbDate(f.created_at)}</small></div>
            <div class="fb-who">${escapeHtml(f.user_label || 'Deleted account')}${f.user_id && f.user_id !== LUMA_USER.id ? ' <button type="button" class="np-btn" data-fbchat title="Ask them about this"><i class="fa-regular fa-comment-dots"></i> Message</button>' : ''}</div><p>${escapeHtml(f.message)}</p>
            ${f.image_path ? `<button type="button" class="fb-thumb" data-fbimg="${f.id}" title="Open the picture">${FBA.urls[f.image_path] ? `<img src="${FBA.urls[f.image_path]}" alt="Picture sent with the message">` : '<i class="fa-regular fa-image"></i> Open picture'}</button>` : ''}
            <div class="fb-ctx">${[c.page && 'from ' + c.page, c.mode && c.mode + ' mode', c.version && 'v' + c.version, c.screen].filter(Boolean).map(escapeHtml).join(' · ')}</div>
            ${(FBA.replies[f.id] || []).length || f.user_id ? `<div class="fb-rthread">${(FBA.replies[f.id] || []).length ? `<div class="fb-adm-h"><i class="fa-regular fa-comments"></i> Replies with ${escapeHtml((f.user_label || 'the person').split(' <')[0])}</div>${FBA.replies[f.id].map(x => fbBubble(x, x.from_admin)).join('')}` : ''}${f.user_id ? (FBA.replying === f.id ? `<div class="fb-rform"><textarea data-fbrtext maxlength="1000" rows="3" placeholder="Reply to ${escapeHtml((f.user_label || 'the person').split(' <')[0])}…"></textarea><div class="fb-radm"><button type="button" class="np-btn" data-fbrsend><i class="fa-solid fa-paper-plane"></i> Send reply</button><button type="button" class="np-btn" data-fbrcancel>Cancel</button></div></div>` : `<button type="button" class="np-btn fb-rbtn" data-fbreply="${f.id}"><i class="fa-solid fa-reply"></i> Reply</button>`) : ''}</div>` : ''}
            <div class="fb-crew" data-crew="${f.id}">${fbaCrewHTML(f)}</div>
            <div class="fb-adm"><div class="fb-adm-h"><i class="fa-solid fa-sliders"></i> Handle this feedback <small class="fb-dim">(this does not send a chat message)</small></div>
              <div class="fb-adm-row"><select data-fbst aria-label="Status">${FB_STATUS.map(s => `<option value="${s[0]}" ${s[0] === f.status ? 'selected' : ''}>${s[1]}</option>`).join('')}</select><input type="text" data-fbnote maxlength="1000" placeholder="Note to the person (sent when you mark it Planned or Done)" value="${escapeHtml(f.admin_note || '')}" aria-label="Note to the person"></div>
              <div class="fb-adm-row fb-adm-act"><button type="button" class="np-btn" data-fbsave><i class="fa-solid fa-floppy-disk"></i> Save status &amp; note</button><button type="button" class="np-btn danger" data-fbdel title="Delete this feedback" aria-label="Delete this feedback"><i class="fa-regular fa-trash-can"></i></button></div></div></div>`; }).join('')
          : card('<div class="h-empty"><div class="h-empty-ico"><i class="fa-regular fa-comment-dots"></i></div><div class="h-empty-t">Nothing here</div><div class="h-empty-s">No messages match these filters.</div></div>'));
      root.querySelectorAll('select').forEach(s => skinSelect(s));
    }
    async function fbaLoad() {
      const sub = docEl('fbaSub'), root = docEl('fbaRoot');
      if (!LumaPlan.admin) { sub.textContent = 'Not allowed'; root.innerHTML = card('<div class="ls">This page is only for administrators.</div>'); return; }
      const r = await LumaAuth.client.schema('luma').from('feedback').select('id, user_id, user_label, kind, module, part, message, image_path, context, status, admin_note, created_at').order('created_at', { ascending: false }).limit(500);
      if (r.error) { sub.textContent = 'Could not load'; root.innerHTML = card(`<div class="ls">${/feedback|schema cache|does not exist/i.test(r.error.message) ? 'Run <b>supabase/migrations/081_feedback.sql</b> first.' : escapeHtml(r.error.message)}</div>`); return; }
      FBA.rows = r.data || []; await fbLoadReplies(FBA.rows, FBA.replies); await fbaLoadCrew();
      const paths = FBA.rows.filter(f => f.image_path).map(f => f.image_path).slice(0, 60);
      if (paths.length) { try { const s = await LumaAuth.client.storage.from('luma-feedback').createSignedUrls(paths, 3600); (s.data || []).forEach(x => { if (x.signedUrl) FBA.urls[x.path] = x.signedUrl; }); } catch (e) { /* the pictures just show as links */ } }
      fbaPaint();
    }
    WIRE.adminfeedback = async function (pg) {
      FBA.status = 'new'; FBA.module = ''; FBA.q = ''; // every visit starts on New, not on the filter used last time
      pg.querySelector('#fbaBack').onclick = () => goTo('admin'); pg.querySelector('#fbaFloor').onclick = () => goTo('agentfloor');
      if (pg.dataset.fbaWired) return fbaLoad(); // the listeners below stay on the page: adding them again made one click run several times
      pg.dataset.fbaWired = '1';
      pg.addEventListener('click', async e => {
        const s = e.target.closest('[data-fbs]'); if (s) { FBA.status = s.dataset.fbs; return fbaPaint(); }
        const card0 = e.target.closest('.fb-item'); if (!card0) return; const id = card0.dataset.id, f = FBA.rows.find(x => x.id === id); if (!f) return;
        if (e.target.closest('[data-crewrun]')) return void fbaCrewStart(f, e.target.closest('[data-crewrun]'));
        if (e.target.closest('[data-crewnote]')) { const run = FBA.crew[id]; if (!run) return; const note = card0.querySelector('[data-fbnote]'), sel = card0.querySelector('[data-fbst]');
          if (note) note.value = run.draft_reply.slice(0, 1000); if (sel && run.suggested_status) { sel.value = run.suggested_status; skinSelect(sel); }
          if (note) note.focus(); return void flashToast('Filled in', 'Check it, then press Save status & note.', 'fa-pen', '#a78bfa'); }
        if (e.target.closest('[data-crewreply]')) { const run = FBA.crew[id]; if (!run) return; FBA.replying = id; fbaPaint(); const t = pg.querySelector('.fb-item[data-id="' + id + '"] [data-fbrtext]'); if (t) { t.value = run.draft_reply; t.focus(); } return; }
        const im = e.target.closest('[data-fbimg]'); if (im) { const u = FBA.urls[f.image_path] || (await LumaAuth.client.storage.from('luma-feedback').createSignedUrl(f.image_path, 3600)).data?.signedUrl; if (u) window.open(u, '_blank', 'noopener'); return; }
        const ar = e.target.closest('[data-fbreply]'); if (ar) { FBA.replying = ar.dataset.fbreply; fbaPaint(); const t = pg.querySelector('[data-fbrtext]'); if (t) t.focus(); return; }
        if (e.target.closest('[data-fbrcancel]')) { FBA.replying = ''; return fbaPaint(); }
        if (e.target.closest('[data-fbrsend]')) return void fbSendReply(id, card0, FBA.replies, () => { FBA.replying = ''; fbaPaint(); });
        if (e.target.closest('[data-fbchat]')) { const topic = f.module + (f.part ? ' › ' + f.part : ''), snip = f.message.replace(/\s+/g, ' ').trim(), quote = snip.length > 80 ? snip.slice(0, 80).trim() + '…' : snip;
          return void adminMessageUser(f.user_id, f.user_label || 'User', `Hi, this is the LUMA admin. I'm reaching out about your feedback on ${topic}: "${quote}". Could you tell me a little more about it?`); }
        if (e.target.closest('[data-fbsave]')) { const st = card0.querySelector('[data-fbst]').value, note = card0.querySelector('[data-fbnote]').value; const r = await LumaAuth.client.schema('luma').rpc('admin_feedback_update', { p_id: id, p_status: st, p_note: note }); if (r.error) return luAlert(r.error.message); f.status = st; f.admin_note = note; flashToast('Saved', f.module, 'fa-check', '#34d399'); return fbaPaint(); }
        if (e.target.closest('[data-fbdel]')) { if (!await luConfirm({ title: 'Delete this feedback?', message: 'It is removed for good, with its picture.', ok: 'Delete' })) return; const r = await LumaAuth.client.schema('luma').rpc('admin_feedback_delete', { p_id: id }); if (r.error) return luAlert(r.error.message); if (f.image_path) LumaAuth.client.storage.from('luma-feedback').remove([f.image_path]); FBA.rows = FBA.rows.filter(x => x !== f); fbaPaint(); }
      });
      pg.addEventListener('change', e => { if (e.target.id === 'fbaMod') { FBA.module = e.target.value; fbaPaint(); } });
      fbaCrewLive();
      pg.addEventListener('input', e => { if (e.target.id === 'fbaQ') { FBA.q = e.target.value; const pos = e.target.selectionStart; fbaPaint(); const q = docEl('fbaQ'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } } });
      await fbaLoad();
    };

    // ---------- the AI crew's first look (migration 101 + supabase/functions/feedback-crew) ----------
    // For each new feedback the crew sorts it, rates how urgent it is, reads the code for bugs and drafts a reply. It never
    // sends anything to the person or changes the status: "Use as note" / "Use as reply" only fill in the boxes for you to check.
    const CREW_AGENTS = { engineer: ['Engineer', 'fa-screwdriver-wrench', '#60a5fa'], support: ['Support', 'fa-headset', '#34d399'], product: ['Product', 'fa-lightbulb', '#fbbf24'] };
    const CREW_SEV = { low: '#94a3b8', medium: '#fbbf24', high: '#fb923c', urgent: '#f87171' };
    const CREW_BUSY = { queued: 'Waiting to start', triaging: 'The lead is reading it', working: 'The crew is working on it', merging: 'The lead is putting it together' };
    FBA.crew = {}; FBA.crewOn = true; // crewOn: false until migration 101 has run, so the inbox looks as before
    const crewAgent = s => CREW_AGENTS[s.agent] || [s.agent, 'fa-user', '#94a3b8'];
    function fbaCrewHTML(f) {
      if (!FBA.crewOn) return '';
      const run = FBA.crew[f.id], h = '<i class="fa-solid fa-robot"></i> AI crew';
      if (!run) return `<div class="fb-crew-h">${h} <span class="fb-dim">has not looked at this yet</span><button type="button" class="np-btn" data-crewrun><i class="fa-solid fa-play"></i> Ask the crew</button></div>`;
      const steps = run.steps || [];
      const who = steps.map(s => { const a = crewAgent(s); return `<span class="fb-crew-ag" style="--c:${a[2]}" title="${escapeHtml(s.task || '')}"><i class="fa-solid ${a[1]}"></i> ${a[0]} ${s.status === 'working' ? '<i class="fa-solid fa-spinner fa-spin"></i>' : s.status === 'failed' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-check"></i>'}</span>`; }).join('');
      if (CREW_BUSY[run.status]) return `<div class="fb-crew-h">${h} <span class="fb-dim"><i class="fa-solid fa-spinner fa-spin"></i> ${CREW_BUSY[run.status]}…</span></div>${who ? `<div class="fb-crew-who">${who}</div>` : ''}`;
      if (run.status === 'failed') return `<div class="fb-crew-h">${h} <span class="fb-crew-err">Could not finish</span><button type="button" class="np-btn" data-crewrun><i class="fa-solid fa-rotate-right"></i> Try again</button></div>${run.error ? `<div class="fb-dim">${escapeHtml(run.error)}</div>` : ''}`;
      const st = FB_STATUS.find(s => s[0] === run.suggested_status), dup = run.duplicate_of && FBA.rows.find(x => x.id === run.duplicate_of), dst = dup && FB_STATUS.find(s => s[0] === dup.status);
      return `<div class="fb-crew-h">${h} ${run.category ? `<span class="fb-k" style="--c:#a78bfa">${escapeHtml(run.category)}</span>` : ''}${run.severity ? `<span class="fb-k" style="--c:${CREW_SEV[run.severity] || '#94a3b8'}">${escapeHtml(run.severity)}</span>` : ''}<button type="button" class="np-btn" data-crewrun title="Run the crew again" aria-label="Run the crew again"><i class="fa-solid fa-rotate-right"></i></button></div>
        ${run.summary ? `<p class="fb-crew-sum">${escapeHtml(run.summary)}</p>` : ''}
        ${dup ? `<div class="fb-crew-dup"><i class="fa-regular fa-copy"></i> Looks like the same thing as “${escapeHtml(dup.message.length > 120 ? dup.message.slice(0, 120) + '…' : dup.message)}”${dst ? ` (${dst[1]})` : ''}</div>` : ''}
        ${run.likely_cause || run.suggested_fix ? `<details class="fb-crew-d"><summary>Likely cause and fix</summary>${run.likely_cause ? `<div class="fb-crew-lbl">Likely cause</div><pre>${escapeHtml(run.likely_cause)}</pre>` : ''}${run.suggested_fix ? `<div class="fb-crew-lbl">Suggested fix</div><pre>${escapeHtml(run.suggested_fix)}</pre>` : ''}</details>` : ''}
        ${run.draft_reply ? `<div class="fb-crew-lbl">Draft reply${st ? ` <span class="fb-dim">· suggested status: ${st[1]}</span>` : ''}</div><div class="fb-crew-reply">${escapeHtml(run.draft_reply)}</div>
          <div class="fb-crew-act"><button type="button" class="np-btn" data-crewnote><i class="fa-solid fa-pen"></i> Use as note${st ? ' + ' + st[1] : ''}</button>${f.user_id ? '<button type="button" class="np-btn" data-crewreply><i class="fa-solid fa-reply"></i> Use as reply</button>' : ''}</div>` : ''}
        ${steps.length ? `<details class="fb-crew-d"><summary>What each teammate wrote</summary>${steps.map(s => { const a = crewAgent(s); return `<div class="fb-crew-lbl" style="color:${a[2]}"><i class="fa-solid ${a[1]}"></i> ${a[0]}</div><pre>${escapeHtml(s.output || '')}</pre>`; }).join('')}</details>` : ''}
        <div class="fb-dim fb-crew-foot">${escapeHtml(run.model || 'AI')} · nothing was sent to the person</div>`;
    }
    // the newest run for each feedback in the inbox, with its steps
    async function fbaLoadCrew() {
      const ids = FBA.rows.slice(0, 150).map(f => f.id); if (!ids.length) { FBA.crew = {}; return; }
      const sb = LumaAuth.client.schema('luma');
      const r = await sb.from('crew_runs').select('id, feedback_id, status, category, severity, summary, likely_cause, suggested_fix, draft_reply, suggested_status, duplicate_of, model, error, created_at').in('feedback_id', ids).order('created_at', { ascending: false }).limit(400);
      if (r.error) { FBA.crewOn = false; return; } // migration 101 not run yet
      FBA.crewOn = true; const latest = {};
      (r.data || []).forEach(x => { if (!latest[x.feedback_id]) latest[x.feedback_id] = { ...x, steps: [] }; });
      const byRun = {}; Object.values(latest).forEach(x => { byRun[x.id] = x; });
      const runIds = Object.keys(byRun);
      if (runIds.length) { const s = await sb.from('crew_steps').select('run_id, agent, task, status, output, started_at').in('run_id', runIds).order('started_at'); (s.data || []).forEach(x => { if (byRun[x.run_id]) byRun[x.run_id].steps.push(x); }); }
      FBA.crew = latest;
    }
    // redraw only the crew boxes, so a note or reply being typed is not lost
    function fbaCrewRepaint() {
      document.querySelectorAll('#fbaRoot .fb-crew[data-crew]').forEach(el => { const f = FBA.rows.find(x => x.id === el.dataset.crew); if (!f) return; const open = [...el.querySelectorAll('details')].map(d => d.open); el.innerHTML = fbaCrewHTML(f); el.querySelectorAll('details').forEach((d, i) => { if (open[i]) d.open = true; }); });
    }
    const fbaOpen = () => { const pg = document.getElementById('page-adminfeedback'); return !!(pg && pg.classList.contains('active') && !document.hidden); };
    let fbaCrewT = null;
    const fbaCrewSoon = () => { clearTimeout(fbaCrewT); fbaCrewT = setTimeout(async () => { if (!fbaOpen()) return; try { await fbaLoadCrew(); fbaCrewRepaint(); } catch (e) { /* the next change or tick tries again */ } }, 700); };
    function fbaCrewLive() {
      try { LumaAuth.client.channel('luma-crew').on('postgres_changes', { event: '*', schema: 'luma', table: 'crew_runs' }, fbaCrewSoon).on('postgres_changes', { event: '*', schema: 'luma', table: 'crew_steps' }, fbaCrewSoon).subscribe(); } catch (e) { /* the timer below still catches up */ }
      setInterval(() => { if (fbaOpen() && Object.values(FBA.crew).some(r => CREW_BUSY[r.status])) fbaCrewSoon(); }, 6000); // in case Realtime misses a change while the crew works
    }
    async function fbaCrewStart(f, btn) {
      if (btn) btn.disabled = true;
      const { data, error } = await LumaAuth.client.functions.invoke('feedback-crew', { body: { feedback_id: f.id } });
      if (error || (data && data.error)) { if (btn) btn.disabled = false; let msg = (data && data.error) || ''; try { if (!msg && error.context) msg = (await error.context.json()).error; } catch (e) { }
        return luAlert(msg || 'The crew is not set up yet: deploy supabase/functions/feedback-crew and set its secrets (see the top of its index.ts).'); }
      FBA.crew[f.id] = { id: data.run_id, feedback_id: f.id, status: 'queued', steps: [] }; fbaCrewRepaint(); fbaCrewSoon();
    }
