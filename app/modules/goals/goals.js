// LUMA — module: goals
      // ---------------- GOALS ----------------
    MODULES.goals = function () {
        return head('Goals', '<span id="goalsSub">Loading…</span>', '<button class="create-btn" id="addGoalBtn"><i class="fa-solid fa-plus"></i> New goal</button>') +
          '<div id="goalsRoot"></div>';
    };

    // ---------- Goals (luma.goals) ----------
    const G_CATS = [['Finance', 'fa-piggy-bank', '#3b82f6'], ['Health', 'fa-person-running', '#22c55e'], ['Learning', 'fa-book-open', '#8b5cf6'], ['Career', 'fa-rocket', '#f59e0b'], ['Personal', 'fa-heart', '#ec4899'], ['Other', 'fa-bullseye', '#94a3b8']];
    const G_PRESETS = [
      { title: 'Save for an emergency fund', category: 'Finance', unit: 'RM', target_value: 12000 },
      { title: 'Run a half marathon', category: 'Health', unit: 'km', target_value: 21 },
      { title: 'Read 24 books this year', category: 'Learning', unit: 'books', target_value: 24 },
      { title: 'Launch my side project', category: 'Career', unit: '%', target_value: 100 },
    ];
    const G_UNITS = ['RM', '%', 'km', 'kg', 'books', 'hours', 'days'];
    const G_STATUS = { done: ['Completed', '#86efac', 'rgba(34,197,94,0.16)'], overdue: ['Overdue', '#fca5a5', 'rgba(239,68,68,0.16)'], behind: ['Behind', '#fcd34d', 'rgba(245,158,11,0.16)'], ontrack: ['On track', '#93c5fd', 'rgba(59,130,246,0.16)'] };
    let GOALS = [], GOALS_ERR = null, gTab = 'active';
    const gForm = { id: null, category: 'Personal' };

    const gCat = name => G_CATS.find(c => c[0] === name) || G_CATS[5];
    const gNum = v => { const n = Number(String(v).replace(/,/g, '').trim()); return isFinite(n) ? n : NaN; };
    const gRow = g => ({ ...g, target_value: Number(g.target_value), current_value: Number(g.current_value) });
    // "RM8,200", "42%", "18 books"
    const gFmt = (v, u) => {
      const t = Number.isInteger(v) ? fmtNum(v) : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
      return !u ? t : ['RM', '$', '€', '£', 'USD', 'SGD', 'S$'].includes(u) ? u + t : u === '%' ? t + '%' : t + ' ' + u;
    };
    const gDone = g => g.current_value >= g.target_value;
    const gPct = g => Math.min(100, Math.round(g.current_value / g.target_value * 100));
    const gDays = g => Math.round((Date.parse(g.deadline) - Date.parse(mytDayKey(Date.now()))) / 864e5);
    function gStatus(g) { // done | overdue | behind | ontrack — "behind" = less done than the time used so far (5% slack)
      if (gDone(g)) return 'done';
      if (!g.deadline) return 'ontrack';
      if (gDays(g) < 0) return 'overdue';
      const start = mytDayKey(g.created_at), total = (Date.parse(g.deadline) - Date.parse(start)) / 864e5, used = (Date.parse(mytDayKey(Date.now())) - Date.parse(start)) / 864e5;
      const expected = total > 0 ? Math.min(1, used / total) : 1;
      return g.current_value / g.target_value >= expected - 0.05 ? 'ontrack' : 'behind';
    }
    const gDeadlineLabel = k => new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

    function paintGoals() {
      const root = docEl('goalsRoot'), sub = docEl('goalsSub'); if (!root) return;
      if (GOALS_ERR) {
        sub.textContent = 'Could not load goals';
        root.innerHTML = card('<div class="ls">Has <b>supabase/migrations/019_goals.sql</b> been run in the Supabase SQL Editor?</div>');
        return;
      }
      const active = GOALS.filter(g => !gDone(g)), done = GOALS.filter(gDone);
      sub.textContent = GOALS.length ? `${active.length} active · on track for ${active.filter(g => gStatus(g) === 'ontrack').length}` + (done.length ? ` · ${done.length} completed` : '') : 'Set goals and watch your progress';
      if (!GOALS.length) {
        root.innerHTML = card(`<div class="h-empty">
          <div class="h-empty-ico"><i class="fa-solid fa-bullseye"></i></div>
          <div class="h-empty-t">Set your first goal</div>
          <div class="h-empty-s">Pick something you want to reach — saving money, running a distance, finishing books — then update your progress as you go. Start from an idea or tap <b>New goal</b>.</div>
          <div class="h-empty-chips">${G_PRESETS.map((p, i) => `<button type="button" class="h-chip" data-gpreset="${i}"><i class="fa-solid ${gCat(p.category)[1]}" style="color:${gCat(p.category)[2]}"></i>${escapeHtml(p.title)}</button>`).join('')}</div>
        </div>`);
        return;
      }
      if (gTab === 'completed' && !done.length) gTab = 'active';
      const list = gTab === 'completed' ? done : active;
      const tabs = `<div class="g-tabs"><button type="button" data-tab="active" class="${gTab === 'active' ? 'on' : ''}">Active (${active.length})</button><button type="button" data-tab="completed" class="${gTab === 'completed' ? 'on' : ''}">Completed (${done.length})</button></div>`;
      const cards = list.length ? list.map(g => {
        const [, icon, col] = gCat(g.category), st = gStatus(g), [stLabel, stCol, stBg] = G_STATUS[st], d = g.deadline ? gDays(g) : null;
        const left = !g.deadline ? 'No deadline' : st === 'done' ? `Due ${gDeadlineLabel(g.deadline)}` : d < 0 ? `${-d} day${d === -1 ? '' : 's'} overdue` : d === 0 ? 'Due today' : `${d} day${d === 1 ? '' : 's'} left · ${gDeadlineLabel(g.deadline)}`;
        return `<div class="card g-card" data-id="${g.id}"><div class="g-top">${ring(gPct(g), st === 'done' ? '#22c55e' : col, gPct(g) + '%', '', 86)}
          <div class="g-main"><div class="g-tag"><i class="fa-solid ${icon}" style="color:${col}"></i> ${g.category}</div><div class="g-title">${escapeHtml(g.title)}</div>
            <div class="g-sub">${gFmt(g.current_value, g.unit)} of ${gFmt(g.target_value, g.unit)}</div>${g.note ? `<div class="g-note">${escapeHtml(g.note)}</div>` : ''}</div>
          <button type="button" class="hedit g-edit" title="Edit"><i class="fa-solid fa-pen"></i></button></div>
          <div class="g-bottom"><span class="pill" style="color:${stCol};background:${stBg}">${stLabel}</span><span class="g-left">${left}</span><button type="button" class="np-btn g-update"><i class="fa-solid fa-arrow-trend-up"></i> Update progress</button></div></div>`;
      }).join('') : '<div class="ls" style="padding:10px 2px">Nothing here yet.</div>';
      root.innerHTML = tabs + `<div class="grid-2">${cards}</div>`;
    }

    async function loadGoalsData() {
      const { data, error } = await LumaGoals.list();
      GOALS_ERR = error || null;
      if (!error) GOALS = data.map(gRow);
    }

    // ----- add / edit modal -----
    const goalErr = m => { docEl('goalError').textContent = m; docEl('goalError').style.display = m ? 'flex' : 'none'; };
    // explains what to type in "Progress so far", with an example built from the target / unit entered above
    function paintGoalHint() {
      const unit = docEl('goalUnit').value.trim(), target = gNum(docEl('goalTarget').value);
      docEl('goalUnits').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.u === unit)); // highlight the chosen unit chip
      docEl('goalCurrentHint').textContent = unit === '%'
        ? 'Type the percentage you have reached so far, as a number — for example 40 for 40%.'
        : `Type how much you have done so far, in the same units as your target${unit ? ' (' + unit + ')' : ''} — not a percentage; the % is worked out for you. Decimals are fine, like 12.5.` + (target > 0 ? ` Example: ${gFmt(Math.round(target * 0.4 * 100) / 100, unit)} of ${gFmt(target, unit)}.` : '');
    }
    ['goalTarget', 'goalCurrent'].forEach(id => { docEl(id).addEventListener('input', () => { const c = cleanDecimal(docEl(id).value); if (c !== docEl(id).value) docEl(id).value = c; }); }); // numbers only
    ['goalTarget', 'goalUnit'].forEach(id => docEl(id).addEventListener('input', paintGoalHint));
    function paintGoalForm() {
      docEl('goalCats').innerHTML = G_CATS.map(([n, i, c]) => `<button type="button" data-c="${n}" class="${n === gForm.category ? 'on' : ''}" style="--gc:${c}"><i class="fa-solid ${i}" style="color:${c}"></i>${n}</button>`).join('');
      docEl('goalUnits').innerHTML = G_UNITS.map(u => `<button type="button" class="h-chip sm" data-u="${u}">${u}</button>`).join('');
      docEl('goalTpls').innerHTML = G_PRESETS.map((p, i) => `<button type="button" class="h-chip sm" data-gpreset="${i}"><i class="fa-solid ${gCat(p.category)[1]}" style="color:${gCat(p.category)[2]}"></i>${escapeHtml(p.title)}</button>`).join('');
      docEl('goalNoDeadline').style.display = docEl('goalDeadline').value ? '' : 'none';
      paintGoalHint();
    }
    function openGoalModal(g, preset) {
      if (!g && planBlocked('goals', GOALS.filter(x => !x.completed_at).length, 'active goals')) return;
      const src = g || preset || {};
      gForm.id = g ? g.id : null; gForm.category = src.category || 'Personal';
      docEl('goalModalTitle').textContent = g ? 'Edit goal' : 'New goal';
      docEl('goalTitle').value = src.title || ''; docEl('goalTarget').value = src.target_value != null ? src.target_value : ''; docEl('goalUnit').value = src.unit || '';
      docEl('goalCurrent').value = g ? g.current_value : ''; docEl('goalNote').value = g ? g.note || '' : '';
      docEl('goalDeadline').value = g && g.deadline ? g.deadline : ''; if (docEl('goalDeadline')._luDateRefresh) docEl('goalDeadline')._luDateRefresh();
      docEl('goalDelete').style.display = g ? '' : 'none';
      docEl('goalTplWrap').style.display = g ? 'none' : '';
      goalErr(''); paintGoalForm();
      docEl('goalOverlay').classList.add('open'); setTimeout(() => docEl('goalTitle').focus(), 50);
    }
    const closeGoalModal = () => docEl('goalOverlay').classList.remove('open');
    docEl('goalClose').onclick = closeGoalModal;
    docEl('goalOverlay').onclick = e => { if (e.target === docEl('goalOverlay')) closeGoalModal(); };
    docEl('goalCats').onclick = e => { const b = e.target.closest('button'); if (b) { gForm.category = b.dataset.c; paintGoalForm(); } };
    // tap a unit to use it; tap the highlighted one again (or empty the Unit box) to remove the unit
    docEl('goalUnits').onclick = e => { const b = e.target.closest('button'); if (b) { docEl('goalUnit').value = docEl('goalUnit').value.trim() === b.dataset.u ? '' : b.dataset.u; paintGoalHint(); } };
    docEl('goalTpls').onclick = e => { const b = e.target.closest('button'); if (b) openGoalModal(null, G_PRESETS[+b.dataset.gpreset]); };
    docEl('goalNoDeadline').onclick = () => { docEl('goalDeadline').value = ''; docEl('goalDeadline')._luDateRefresh(); paintGoalForm(); };
    docEl('goalDeadline').addEventListener('change', paintGoalForm);
    docEl('goalTitle').addEventListener('keydown', e => { if (e.key === 'Enter') docEl('goalSave').click(); });
    docEl('goalSave').onclick = async () => {
      const title = docEl('goalTitle').value.trim(), target = gNum(docEl('goalTarget').value), curRaw = docEl('goalCurrent').value.trim(), cur = curRaw === '' ? 0 : gNum(curRaw);
      if (!title) return goalErr('Give your goal a name.');
      if (!(target > 0)) return goalErr('Enter a target above 0 (use 100 with the unit % if it has no number).');
      if (!(cur >= 0)) return goalErr('Progress must be 0 or more.');
      const fields = { title, category: gForm.category, unit: docEl('goalUnit').value.trim(), target_value: target, current_value: cur, deadline: docEl('goalDeadline').value || null, note: docEl('goalNote').value.trim() };
      const before = GOALS.find(x => x.id === gForm.id), wasDone = before ? gDone(before) : false;
      const btn = docEl('goalSave'); btn.disabled = true; btn.textContent = 'Saving…';
      const { data, error } = gForm.id ? await LumaGoals.update(gForm.id, fields) : await LumaGoals.add(fields);
      btn.disabled = false; btn.textContent = 'Save goal';
      if (error) return goalErr(/goals|schema cache|does not exist/i.test(error.message) ? 'Goals aren\'t set up yet — run supabase/migrations/019_goals.sql in the SQL Editor.' : error.message);
      const row = gRow(data), i = GOALS.findIndex(x => x.id === row.id);
      if (i >= 0) GOALS[i] = row; else GOALS.push(row);
      closeGoalModal(); paintGoals();
      if (gDone(row) && !wasDone) flashToast('Goal reached 🎉', row.title, 'fa-trophy', '#22c55e');
    };
    docEl('goalDelete').onclick = async () => {
      const g = GOALS.find(x => x.id === gForm.id); if (!g) return;
      if (!await luConfirm({ title: `Delete “${g.title}”?`, message: 'This goal and its progress are removed. This can\'t be undone.' })) return;
      const { error } = await LumaGoals.remove(g.id);
      if (error) return goalErr(error.message);
      GOALS = GOALS.filter(x => x !== g); closeGoalModal(); paintGoals();
    };

    // quick progress update from a card
    async function updateGoalProgress(g) {
      const raw = await luPrompt({ title: g.title, message: `Now: ${gFmt(g.current_value, g.unit)} of ${gFmt(g.target_value, g.unit)}. Enter your new total.`, placeholder: String(g.current_value), value: String(g.current_value), ok: 'Save', numeric: true });
      if (raw == null) return;
      const v = gNum(raw);
      if (!(v >= 0)) return luAlert('Please enter a number (0 or more).', 'Invalid amount');
      const wasDone = gDone(g);
      const { data, error } = await LumaGoals.update(g.id, { current_value: v });
      if (error) return luAlert('Could not save: ' + error.message);
      Object.assign(g, gRow(data)); paintGoals();
      if (gDone(g) && !wasDone) flashToast('Goal reached 🎉', g.title, 'fa-trophy', '#22c55e');
    }

    async function loadGoals(pg) {
      gTab = 'active';
      pg.querySelector('#addGoalBtn').addEventListener('click', () => openGoalModal(null));
      pg.querySelector('#goalsRoot').addEventListener('click', e => {
        const pre = e.target.closest('[data-gpreset]'); if (pre) return openGoalModal(null, G_PRESETS[+pre.dataset.gpreset]);
        const tab = e.target.closest('[data-tab]'); if (tab) { gTab = tab.dataset.tab; return paintGoals(); }
        const c = e.target.closest('.g-card'); if (!c) return;
        const g = GOALS.find(x => x.id === c.dataset.id); if (!g) return;
        if (e.target.closest('.g-edit')) return openGoalModal(g);
        if (e.target.closest('.g-update')) updateGoalProgress(g);
      });
      paintGoals();
      await loadGoalsData(); paintGoals();
    }


    WIRE.goals = function (pg) { return loadGoals(pg); };
