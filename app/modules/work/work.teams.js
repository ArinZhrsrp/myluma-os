// LUMA — Work: teams (departments, squads…). Needs supabase/migrations/084_work_teams.sql; until it has run the app just shows no teams.
// A team is a named list of people from your contacts, kept under one of your companies. A task can be "for" a team: picking the team ticks
// its people as assignees, and you can still add or remove single people (also people who are not in the team).
// (ids and functions here start with wkGrp… because "team" is already used in Work for the people on a project and for team time.)
(function () {
  if (typeof WK === 'undefined') return;
  WK.teamF = WK.teamF || '';

  const wkGrpMine = () => (WK.teams || []).filter(g => g.mine);
  const wkGrpOf = id => (WK.teams || []).find(g => g.id === id);
  const wkGrpLimit = () => { const v = LumaPlan.get('work_teams'); return v == null ? 5 : v; };
  window.wkGrpChip = t => { const g = t && t.team_id ? wkGrpOf(t.team_id) : null; return g ? `<span class="wk-grp-chip" style="--c:${g.color}" title="Team: ${escapeHtml(g.name)}"><i class="fa-solid fa-people-group"></i> ${escapeHtml(g.name)}</span>` : ''; };
  window.wkGrpFilterHtml = () => (WK.teams || []).length ? `<select id="wkFilterGrp"><option value="">All teams</option>${WK.teams.map(g => `<option value="${g.id}" ${g.id === WK.teamF ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('')}</select>` : '';

  // ---------- the Teams tab ----------
  window.wkGrpView = function () {
    const co = wkCoOf(WK.company), here = wkGrpMine().filter(g => g.company_id === WK.company), others = wkGrpMine().filter(g => g.company_id !== WK.company);
    const info = `<div class="ls wk-grp-info">${wkGrpMine().length} of ${wkGrpLimit()} teams used (all your companies together). A team groups the people you work with, such as Design or Finance. Give a task to a team and its people are ticked for you; you can still add anyone else.</div>`;
    const cardOf = g => { const open = WK.rawTasks.filter(t => t.team_id === g.id && t.status !== 'done').length, mem = g.members || [];
      return `<div class="card wk-grp" style="--c:${g.color}"><div class="wk-grp-h"><span class="wk-grp-dot"></span><div class="wk-grp-t"><b>${escapeHtml(g.name)}</b>${g.note ? `<small>${escapeHtml(g.note)}</small>` : ''}</div><button type="button" class="np-btn" data-wkgrp-edit="${g.id}"><i class="fa-regular fa-pen-to-square"></i> Edit</button></div>
        <div class="wk-grp-m">${mem.length ? mem.slice(0, 8).map(m => `<span class="wk-grp-p"><span class="wk-av">${escapeHtml(wkInit(m.user_id === wkMe() ? 'You' : m.name))}</span>${escapeHtml(m.user_id === wkMe() ? 'You' : m.name)}</span>`).join('') + (mem.length > 8 ? `<span class="wk-grp-p more">+${mem.length - 8} more</span>` : '') : '<span class="ls">Nobody in this team yet.</span>'}</div>
        <div class="wk-grp-f"><span><i class="fa-solid fa-user-group"></i> ${g.count} ${g.count === 1 ? 'person' : 'people'}</span><button type="button" class="sp-chip" data-wkgrp-tasks="${g.id}"><i class="fa-solid fa-list-check"></i> ${open} open task${open === 1 ? '' : 's'}</button></div></div>`; };
    const empty = card(`<div class="h-empty"><div class="h-empty-ico" style="--c:#fb923c"><i class="fa-solid fa-people-group"></i></div><div class="h-empty-t">No teams in ${co ? escapeHtml(co.name) : 'this company'} yet</div><div class="h-empty-s">Create a team for each department or squad. Then give a task to the whole team in one tap, or add the whole team to a project.</div>${wkHas() ? '<div class="h-empty-chips"><button type="button" class="h-chip" data-wkgrp-new><i class="fa-solid fa-plus"></i> Create a team</button></div>' : ''}</div>`);
    const inn = (WK.teams || []).filter(g => !g.mine && g.im_in), inHtml = inn.length ? `<div class="sd-gh" style="margin-top:18px"><b>Teams you are in</b><span>${inn.length}</span></div><div class="grid-2">${inn.map(g => `<div class="card wk-grp" style="--c:${g.color}"><div class="wk-grp-h"><span class="wk-grp-dot"></span><div class="wk-grp-t"><b>${escapeHtml(g.name)}</b><small>${escapeHtml(g.owner_name || '')}${g.note ? ' · ' + escapeHtml(g.note) : ''}</small></div></div><div class="wk-grp-f"><span><i class="fa-solid fa-user-group"></i> ${g.count} ${g.count === 1 ? 'person' : 'people'}</span></div></div>`).join('')}</div>` : '';
    return info + (here.length ? `<div class="grid-2">${here.map(cardOf).join('')}</div>` : empty) + inHtml + (others.length ? `<div class="sd-gh" style="margin-top:18px"><b>In your other companies</b><span>${others.length}</span></div><div class="ls" style="margin-bottom:8px">${others.map(g => escapeHtml(g.name) + ' (' + escapeHtml(((wkCoOf(g.company_id) || {}).name) || 'company') + ')').join(' · ')}. Switch company to change them.</div>` : '');
  };

  // ---------- the team window ----------
  const G = { id: null, color: '#fb923c', members: new Map() };   // members: user id → name
  function wkGrpPaint() {
    docEl('wkGrpColors').innerHTML = SD_COLORS.map(c => `<button type="button" class="sd-sw ${c === G.color ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join('');
    const me = wkMe(), rows = [...G.members.entries()].sort((a, b) => (a[0] === me ? -1 : b[0] === me ? 1 : a[1].localeCompare(b[1])));
    docEl('wkGrpMembers').innerHTML = rows.length ? rows.map(([id, nm]) => `<span class="wk-grp-p"><span class="wk-av">${escapeHtml(wkInit(id === me ? 'You' : nm))}</span>${escapeHtml(id === me ? 'You' : nm)}<button type="button" data-wkgrp-rm="${id}" aria-label="Remove ${escapeHtml(nm)}"><i class="fa-solid fa-xmark"></i></button></span>`).join('') : '<span class="ls">Nobody yet. Add people from your contacts.</span>';
    docEl('wkGrpMe').classList.toggle('active', G.members.has(me)); docEl('wkGrpCount').textContent = G.members.size + ' / 50';
  }
  window.wkGrpOpen = function (g) {
    if (!wkHas()) return openAddon('work');
    G.id = g ? g.id : null; G.color = g ? g.color : SD_COLORS[wkGrpMine().length % SD_COLORS.length]; G.members = new Map((g ? g.members : []).map(m => [m.user_id, m.name]));
    docEl('wkGrpHead').textContent = g ? 'Edit team' : 'New team'; docEl('wkGrpName').value = g ? g.name : ''; docEl('wkGrpNote').value = g ? g.note || '' : ''; docEl('wkGrpDelete').style.display = g ? '' : 'none'; wkErr('wkGrpError', '');
    wkGrpPaint(); sdOpen('wkGrpOverlay'); setTimeout(() => { if (!g) docEl('wkGrpName').focus(); }, 60);
  };
  docEl('wkGrpClose').onclick = () => sdClose('wkGrpOverlay');
  docEl('wkGrpOverlay').addEventListener('click', e => {
    if (e.target === docEl('wkGrpOverlay')) return sdClose('wkGrpOverlay');
    const c = e.target.closest('[data-color]'); if (c) { G.color = c.dataset.color; return wkGrpPaint(); }
    const rm = e.target.closest('[data-wkgrp-rm]'); if (rm) { G.members.delete(rm.dataset.wkgrpRm); return wkGrpPaint(); }
  });
  docEl('wkGrpMe').onclick = () => { const me = wkMe(); if (G.members.has(me)) G.members.delete(me); else G.members.set(me, 'You'); wkGrpPaint(); };
  docEl('wkGrpAdd').onclick = async () => {
    const got = await sdPickContacts({ title: 'Add people to this team', exclude: new Set(G.members.keys()) }); if (!got || !got.size) return;
    got.forEach((v, id) => { if (G.members.size < 50) G.members.set(id, typeof v === 'string' ? v : (v && v.name) || 'Someone'); }); wkGrpPaint();
  };
  docEl('wkGrpSave').onclick = async () => {
    const name = docEl('wkGrpName').value.trim(); if (!name) return wkErr('wkGrpError', 'Give the team a name.');
    sdBtn('wkGrpSave', true); wkErr('wkGrpError', '');
    const r = await LumaWork.teams.save({ id: G.id, company_id: WK.company, name, note: docEl('wkGrpNote').value.trim(), color: G.color, members: [...G.members.keys()] });
    sdBtn('wkGrpSave', false, 'Save team');
    if (r.error) return wkErr('wkGrpError', /could not find the function|schema cache/i.test(r.error.message) ? 'Run supabase/migrations/084_work_teams.sql in the SQL Editor first.' : wkHint(r.error.message).replace('Your plan allows', 'Your Work add-on allows'));
    sdClose('wkGrpOverlay'); await wkLoad(); wkPaint(); flashToast(G.id ? 'Team saved' : 'Team created', name, 'fa-people-group', '#fb923c');
  };
  docEl('wkGrpDelete').onclick = async () => {
    const g = wkGrpOf(G.id); if (!g) return;
    if (!await luConfirm({ title: `Delete the team “${g.name}”?`, message: 'The people stay on their tasks and projects. The tasks just lose the team label.', ok: 'Delete' })) return;
    const r = await LumaWork.teams.remove(g.id); if (r.error) return wkErr('wkGrpError', wkHint(r.error.message));
    sdClose('wkGrpOverlay'); await wkLoad(); wkPaint(); flashToast('Team deleted', g.name, 'fa-trash-can', '#f87171');
  };

  // ---------- on the page: buttons of the Teams tab, and the team filter on the Tasks tab ----------
  document.addEventListener('click', e => {
    const ed = e.target.closest('#wkRoot [data-wkgrp-edit]'); if (ed) return wkGrpOpen(wkGrpOf(ed.dataset.wkgrpEdit));
    if (e.target.closest('#wkRoot [data-wkgrp-new]')) return wkGrpOpen(null);
    const tk = e.target.closest('#wkRoot [data-wkgrp-tasks]'); if (tk) { WK.teamF = tk.dataset.wkgrpTasks; WK.tab = 'tasks'; WK.project = ''; return wkPaint(); }
  });
  document.addEventListener('change', e => { if (e.target.id === 'wkFilterGrp') { WK.teamF = e.target.value; wkPaint(); } });

  // ---------- in the task window ----------
  window.wkGrpPaintTask = function (pid, teamId) {
    const p = wkProj(pid), list = p ? (WK.teams || []).filter(g => g.owner_id === p.owner_id) : [], sel = docEl('wkTaskGrp');
    docEl('wkTaskGrpBox').style.display = list.length || teamId ? '' : 'none';
    sel.innerHTML = '<option value="">No team</option>' + list.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    sel.value = list.some(g => g.id === teamId) ? teamId : ''; sel.disabled = !!WKT.ro; docEl('wkTaskGrpNote').innerHTML = '';
    if (typeof skinSelect === 'function') skinSelect(sel);
  };
  // people of the team who are not on the project yet
  const wkGrpMissing = (g, pid) => { const on = new Set(wkPeopleOf(pid).map(x => x.user_id)), pend = new Set(WK.people.filter(x => x.project_id === pid && x.status === 'pending').map(x => x.user_id)); return (g.members || []).filter(m => !on.has(m.user_id)).map(m => ({ ...m, pending: pend.has(m.user_id) })); };
  docEl('wkTaskGrp').addEventListener('change', () => {
    const pid = docEl('wkTaskProject').value, g = wkGrpOf(docEl('wkTaskGrp').value), note = docEl('wkTaskGrpNote'); note.innerHTML = '';
    if (!g) return;
    if (!(g.members || []).length) { note.innerHTML = g.mine ? 'This team has nobody in it yet.' : 'Only the label is added: the project owner can see who is in this team.'; return; }
    const on = new Set(wkPeopleOf(pid).map(x => x.user_id)), add = g.members.filter(m => on.has(m.user_id));
    WKT.who = [...new Set([...WKT.who, ...add.map(m => m.user_id)])].slice(0, 10); wkPaintWho(pid);
    const miss = wkGrpMissing(g, pid), isOwner = wkRole(wkProj(pid)) === 'owner';
    note.innerHTML = `<span class="ok"><i class="fa-solid fa-check"></i> ${add.length} of ${g.members.length} ticked.</span> You can still add or remove people above.` + (miss.length ? `<div class="wk-grp-miss"><b>${miss.length} not on this project yet:</b> ${escapeHtml(miss.map(m => m.name + (m.pending ? ' (invited)' : '')).join(', '))}${isOwner && miss.some(m => !m.pending) ? ' <button type="button" class="np-btn" data-wkgrp-invite><i class="fa-solid fa-user-plus"></i> Add them to the project</button>' : isOwner ? '<br>They can be given the task once they accept.' : '<br>Ask the project owner to add them.'}</div>` : '');
  });
  docEl('wkTaskGrpNote').addEventListener('click', async e => {
    const b = e.target.closest('[data-wkgrp-invite]'); if (!b) return; const pid = docEl('wkTaskProject').value, g = wkGrpOf(docEl('wkTaskGrp').value); if (!g) return;
    const ids = wkGrpMissing(g, pid).filter(m => !m.pending).map(m => m.user_id); if (!ids.length) return;
    b.disabled = true; const r = await LumaWork.invite(pid, ids, 'member');
    if (r.error) { b.disabled = false; return wkErr('wkTaskError', wkHint(r.error.message)); }
    await wkLoad(); wkPaintWho(pid); docEl('wkTaskGrpNote').innerHTML = `<span class="ok"><i class="fa-solid fa-check"></i> ${r.data} invited.</span> They can be given the task once they accept.`;
  });

  // ---------- in the project window: add a whole team ----------
  window.wkGrpPaintProj = function (pid) {
    const box = docEl('wkProjGrpBox'), list = wkGrpMine(); box.style.display = pid && list.length ? '' : 'none'; if (!pid || !list.length) return;
    docEl('wkProjGrp').innerHTML = '<option value="">Add a whole team…</option>' + list.map(g => `<option value="${g.id}">${escapeHtml(g.name)} (${g.count})</option>`).join('');
    if (typeof skinSelect === 'function') skinSelect(docEl('wkProjGrp'));
  };
  docEl('wkProjGrpBtn').onclick = async () => {
    const pid = WKF.projectId, g = wkGrpOf(docEl('wkProjGrp').value); if (!pid) return; if (!g) return wkErr('wkProjError', 'Pick a team first.');
    const have = new Set(WK.people.filter(x => x.project_id === pid && x.status !== 'declined').map(x => x.user_id)), ids = (g.members || []).map(m => m.user_id).filter(u => u !== wkMe() && !have.has(u));
    if (!ids.length) return flashToast('Nothing to add', `Everyone in ${g.name} is already on this project`, 'fa-circle-info', '#60a5fa');
    sdBtn('wkProjGrpBtn', true); const r = await LumaWork.invite(pid, ids, 'member'); sdBtn('wkProjGrpBtn', false, 'Add team');
    if (r.error) return wkErr('wkProjError', wkHint(r.error.message));
    await wkLoad(); wkPaintProj(); wkPaint(); flashToast('Team added', `${r.data} ${r.data === 1 ? 'person' : 'people'} from ${g.name} invited`, 'fa-people-group', '#fb923c');
  };
})();
