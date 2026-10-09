// LUMA — module: work (the Work add-on: projects, tasks and the people on them)
    // Projects have tasks on a Board (To do / Doing / Review / Done) or a List. The owner can invite people from their contacts.
    // Someone WITHOUT the Work add-on who was added to a project can only look at it (read-only); with the add-on a member can add and change tasks.
    // Tables and rules: supabase/migrations/071. (Time tracking and timesheets are the next step.)
    const WK_STATUS = [['todo', 'To do', '#94a3b8'], ['doing', 'Doing', '#60a5fa'], ['review', 'Review', '#fbbf24'], ['done', 'Done', '#34d399']];
    const WK_PRIO = [['low', 'Low', '#94a3b8'], ['med', 'Medium', '#fbbf24'], ['high', 'High', '#f87171']];
    const WK_PSTATUS = [['active', 'Active'], ['on_hold', 'On hold'], ['done', 'Done'], ['archived', 'Archived']];
    const WK_TABS = [['overview', 'Overview', 'fa-table-columns'], ['projects', 'Projects', 'fa-folder-open'], ['tasks', 'Tasks', 'fa-list-check'], ['teams', 'Teams', 'fa-people-group'], ['time', 'Time', 'fa-clock']];
    const WK = { projects: [], tasks: [], folders: [], links: [], teams: [], tmins: {}, companies: [], company: '', rawProjects: [], rawTasks: [], shared: [], people: [], loaded: false, err: null, tab: 'overview', project: '', mine: false, view: 'board', showDone: false, loadedAt: 0 };

    const wkMe = () => (LUMA_USER && LUMA_USER.id) || '';
    const wkHas = () => LumaPlan.hasAddon('work');                         // may create and change things (the add-on)
    const WK_PHASE_KINDS = [['project', 'Project', 'Six phases: planning to deployment'], ['general', 'General', 'Your own folders, for documents, approvals, memos']];
    const wkFolders = pid => WK.folders.filter(f => f.project_id === pid).sort((a, b) => a.position - b.position);
    const wkKindWord = p => p && p.kind === 'general' ? 'Folder' : 'Phase';
    const wkProj = id => WK.projects.find(p => p.id === id) || WK.rawProjects.find(p => p.id === id);
    const wkRole = p => !p ? null : p.owner_id === wkMe() ? 'owner' : ((WK.shared.find(s => s.id === p.id) || {}).my_role || 'viewer');
    const wkCoOf = id => WK.companies.find(c => c.id === id);
    const wkCoActive = () => WK.companies.filter(c => !c.archived_at);
    // a project in an archived company can be read but not changed (the database refuses it too)
    const wkArchived = p => !p ? false : p.owner_id === wkMe() ? !!(wkCoOf(p.company_id) || {}).archived_at : !!(WK.shared.find(s => s.id === p.id) || {}).archived;
    const wkCanEdit = p => !!p && wkHas() && ['owner', 'member'].includes(wkRole(p)) && !wkArchived(p);
    // picks the company in view: the last one used if it still exists, else the first active one
    function wkPickCompany() {
      let id = WK.company; try { id = id || localStorage.getItem('luma_work_company') || ''; } catch (e) { }
      if (!wkCoOf(id)) id = (wkCoActive()[0] || {}).id || '';
      WK.company = id; try { localStorage.setItem('luma_work_company', id); } catch (e) { }
    }
    const wkSetCompany = id => { WK.company = id; if (typeof WKTM !== 'undefined') WKTM.co = null; try { localStorage.setItem('luma_work_company', id); } catch (e) { } };
    const wkPeopleOf = id => WK.people.filter(x => x.project_id === id && x.status === 'accepted');
    const wkName = (id, uid) => { const x = WK.people.find(p => p.project_id === id && p.user_id === uid); return x ? (x.user_id === wkMe() ? 'You' : x.name) : ''; };
    const wkInit = n => (String(n || '?').replace(/^You$/, 'Y').trim()[0] || '?').toUpperCase();
    const wkStatus = s => WK_STATUS.find(x => x[0] === s) || WK_STATUS[0];
    const wkToday = () => mytDayKey(Date.now());
    const wkFmt = k => new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const wkWho = t => (t.assignee_ids || []).map(u => wkName(t.project_id, u)).filter(Boolean);
    const wkDue = t => { if (!t.due_date) return null; const today = wkToday(), d = Math.round((Date.parse(t.due_date) - Date.parse(today)) / 864e5), done = t.status === 'done',
      dl = new Date(t.due_date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const end = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d < 0 && !done ? 'Overdue · ' + dl : dl;
      return { text: t.start_date && t.start_date !== t.due_date ? wkFmt(t.start_date) + ' → ' + end : end, cls: done ? '' : d < 0 ? 'over' : d <= 1 ? 'soon' : '' }; };
    const wkHint = m => /Your plan allows/.test(m || '') ? m.replace('Your plan allows', 'Your ' + LumaPlan.addonName('work') + ' add-on allows') + (LumaPlan.workTier() === 'pro' ? '.' : '. Work Pro allows more: see Settings → your plan → Add-ons.') : /budget_minutes|work_projects|work_tasks|work_folders|work_companies|company_id|folder_id|kind|my_work|schema cache|does not exist/i.test(m || '') ? 'Work isn\'t set up yet: run supabase/migrations/071 to 080 (the work_*.sql files) in the Supabase SQL Editor.' : m;

    MODULES.work = function () {
      const info = (LumaPlan.addonInfo && LumaPlan.addonInfo.work) || {}, ends = info.expires_at ? new Date(info.expires_at) : null;
      const left = ends ? Math.ceil((ends - Date.now()) / 864e5) : null;
      const note = ends && wkHas() ? ` · ${info.source === 'trial' ? 'free trial' : 'add-on'} until ${new Date(ends - 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}${left !== null && left <= 7 ? ' (' + Math.max(left, 0) + ' day' + (left === 1 ? '' : 's') + ' left)' : ''}` : '';
      if (!wkHas() && WK.tab !== 'projects' && WK.tab !== 'tasks') WK.tab = 'projects';
      return head('Work', `<button type="button" class="wk-co" id="wkCo" style="display:none"></button><span id="wkSub">Loading…</span>${note}`,
        `<div class="wk-tabs" id="wkTabs">${WK_TABS.filter(t => wkHas() || (t[0] !== 'overview' && t[0] !== 'time' && t[0] !== 'teams')).map(([k, n, i]) => `<button type="button" data-wktab="${k}" class="${WK.tab === k ? 'on' : ''}"><i class="fa-solid ${i}"></i><span>${n}</span></button>`).join('')}</div><button type="button" class="create-btn wk-add" id="wkAdd"><i class="fa-solid fa-plus"></i> <span id="wkAddT">New task</span></button>`) + `<div id="wkRoot"><div class="ls" style="padding:10px 2px">Loading…</div></div>`;
    };

    async function wkLoad() {
      try {
        // a request that never answers must not leave the page on "Loading…" for ever: each one gives up after 20 seconds and says which it was
        const slow = (name, pr) => Promise.race([Promise.resolve(pr), new Promise(r => setTimeout(() => r({ data: null, error: { message: `Timed out while loading ${name}. Check your connection and try again.` } }), 20000))]);
        const [p, t, s, pe, fo, co, ln, tt, tm] = await Promise.all([slow('projects', LumaWork.projects.list()), slow('tasks', LumaWork.tasks.list()), slow('shared projects', LumaWork.shared()), slow('people', LumaWork.people()), slow('folders', LumaWork.folders.list()), slow('companies', LumaWork.companies.list()), slow('links', LumaWork.links.list()), slow('time totals', LumaWork.timeTotals()), slow('teams', LumaWork.teams.list())]);
        const bad = p.error || t.error || fo.error || co.error; WK.err = bad ? bad.message : null;
        if (!bad) {
          WK.teams = tm && !tm.error && Array.isArray(tm.data) ? tm.data : []; WK.links = ln.error ? [] : (ln.data || []); WK.tmins = {}; (tt.error ? [] : (tt.data || [])).forEach(x => { WK.tmins[x.task_id] = Number(x.minutes); });
          WK.companies = co.data || []; WK.rawProjects = p.data || []; WK.rawTasks = t.data || []; wkPickCompany();
          // only the company in view (and projects other people shared with me) are shown
          WK.projects = WK.rawProjects.filter(x => x.owner_id !== wkMe() || x.company_id === WK.company); const ids = new Set(WK.projects.map(x => x.id)); WK.tasks = WK.rawTasks.filter(x => ids.has(x.project_id)); WK.folders = fo.data || []; WK.shared = s.error ? [] : (s.data || []); WK.people = pe.error ? [] : (pe.data || []); }
      } catch (e) { WK.err = e.message || 'Could not load'; }
      WK.loaded = true; WK.loadedAt = Date.now();
    }

    // ---------- drawing ----------
    function wkPaint() {
      const root = docEl('wkRoot'), sub = docEl('wkSub'); if (!root) return;
      document.querySelectorAll('#wkTabs button').forEach(b => b.classList.toggle('on', b.dataset.wktab === WK.tab));
      root.classList.toggle('wk-timeview', WK.tab === 'time');
      const co = wkCoOf(WK.company), pill = docEl('wkCo'), setup = wkHas() && WK.loaded && !WK.err && !co;
      if (pill) { pill.style.display = wkHas() && co ? '' : 'none'; if (co) { pill.innerHTML = `<i class="fa-regular fa-building"></i> <b>${escapeHtml(co.name)}</b>${co.archived_at ? ' <em>archived</em>' : ''} <i class="fa-solid fa-chevron-right"></i>`; pill.title = 'Change or add a company'; } }
      const addBtn = docEl('wkAdd'), canAdd = wkHas() && !setup && !(co && co.archived_at); addBtn.style.display = canAdd ? '' : 'none';
      docEl('wkAddT').textContent = WK.tab === 'projects' ? 'New project' : WK.tab === 'time' ? 'Log time' : WK.tab === 'teams' ? 'New team' : 'New task';
      if (!WK.loaded) { root.innerHTML = '<div class="ls" style="padding:10px 2px">Loading…</div>'; return; }
      if (WK.err) { sub.textContent = 'Could not load'; root.innerHTML = card(`<div class="ls">${escapeHtml(wkHint(WK.err))}</div><button type="button" class="np-btn" data-wkretry style="margin-top:10px"><i class="fa-solid fa-rotate"></i> Try again</button>`); return; }
      if (setup) { sub.textContent = 'Set up your company'; root.innerHTML = wkSetup(); return; }
      if (WK.tab === 'time') { sub.textContent = 'Your hours and timesheet'; wkTimePaint(); if (!WKTM.loaded) wkTimeRefresh(); return; }
      const open = WK.tasks.filter(t => t.status !== 'done');
      sub.textContent = WK.projects.length ? `${WK.projects.filter(p => p.status === 'active').length} active project${WK.projects.filter(p => p.status === 'active').length === 1 ? '' : 's'} · ${open.length} open task${open.length === 1 ? '' : 's'}` : 'Projects, tasks and teams';
      root.innerHTML = (co && co.archived_at ? `<div class="wk-lock"><i class="fa-solid fa-box-archive"></i><div><b>${escapeHtml(co.name)} is archived</b><span>You can look at everything, but nothing can be changed. Restore it on the Company page to carry on.</span></div><button type="button" class="create-btn" data-wk-co>Company</button></div>` : '') + (WK.tab === 'projects' ? wkProjectsView : WK.tab === 'tasks' ? wkTasksView : WK.tab === 'teams' ? wkGrpView : wkOverview)();
      const pf = docEl('wkFilterProj'); if (pf) skinSelect(pf);
      if (WK.tab === 'tasks' && WK.view === 'gantt' && typeof wkGanttScroll === 'function') wkGanttScroll();
    }
    // first time in Work (or no active company): ask for the company name
    function wkSetup() {
      const arch = WK.companies.length;
      return card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-regular fa-building"></i></div><div class="h-empty-t">${arch ? 'No active company' : 'What is your company called?'}</div>
        <div class="h-empty-s">${arch ? 'Your companies are archived. Add a new one, or restore an old one on the Company page.' : 'Your projects and tasks are kept under a company. You can rename it later, and add more companies if you work for several. Freelancing? Use your own name.'}</div>
        <div class="wk-setup"><input id="wkSetupName" type="text" maxlength="80" placeholder="e.g. Acme Sdn Bhd" autocomplete="off"><button type="button" class="create-btn" data-wk-cosave>Continue</button></div>
        ${arch ? '<div class="h-empty-chips"><button type="button" class="h-chip" data-wk-co>Open Company page</button></div>' : ''}<div class="pem-msg error" id="wkSetupErr"></div></div>`);
    }
    // up to three round avatars, then +N
    const wkAvatar = (pid, ids) => { ids = ids || []; if (!ids.length) return ''; const shown = ids.slice(0, 3); return `<span class="wk-avs">${shown.map(u => `<span class="wk-av" title="${escapeHtml(wkName(pid, u) || 'Assigned')}">${escapeHtml(wkInit(wkName(pid, u)))}</span>`).join('')}${ids.length > 3 ? `<span class="wk-av more">+${ids.length - 3}</span>` : ''}</span>`; };
    // the time budget of a task: "3h / 8h", red once it is over
    function wkBud(t) { if (!t.budget_minutes) return ''; const m = WK.tmins[t.id] || 0, over = m > t.budget_minutes; return `<span class="wk-bud ${over ? 'over' : ''}" title="Time logged / budget"><i class="fa-solid fa-stopwatch"></i> ${wkDur(m)} / ${wkDur(t.budget_minutes)}</span>`; }
    // a "waits for" line when the task starts before something it depends on has ended
    const wkDeps = id => WK.links.filter(l => l.task_id === id).map(l => WK.tasks.find(x => x.id === l.depends_on) || WK.rawTasks.find(x => x.id === l.depends_on)).filter(Boolean);
    function wkCard(t, showProject) {
      const p = wkProj(t.project_id), du = wkDue(t), st = wkStatus(t.status), edit = wkCanEdit(p), i = WK_STATUS.findIndex(x => x[0] === t.status);
      const steps = Array.isArray(t.checklist) ? t.checklist : [], dn = steps.filter(x => x.d).length;
      return `<div class="wk-card" data-id="${t.id}" style="--c:${p ? p.color : '#fb923c'}"><div class="wk-ct">${escapeHtml(t.title)}</div>
        <div class="wk-cm">${showProject && p ? `<span class="wk-proj"><i></i>${escapeHtml(p.name)}</span>` : ''}${wkGrpChip(t)}${du ? `<span class="wk-due ${du.cls}"><i class="fa-regular fa-clock"></i> ${du.text}</span>` : ''}${t.priority === 'high' ? '<span class="wk-pr" title="High priority"><i class="fa-solid fa-flag"></i></span>' : ''}${steps.length ? `<span class="wk-chk ${dn === steps.length ? 'ok' : ''}"><i class="fa-regular fa-square-check"></i> ${dn}/${steps.length}</span>` : ''}${wkBud(t)}${wkDeps(t.id).some(x => x.status !== 'done') ? '<span class="wk-blk" title="Waiting for another task"><i class="fa-solid fa-link"></i></span>' : ''}${wkAvatar(t.project_id, t.assignee_ids)}</div>
        ${edit ? `<div class="wk-mv"><button type="button" data-wkmv="${t.id}|-1" ${i <= 0 ? 'disabled' : ''} title="Move back"><i class="fa-solid fa-chevron-left"></i></button><span style="--c:${st[2]}">${st[1]}</span><button type="button" data-wkmv="${t.id}|1" ${i >= WK_STATUS.length - 1 ? 'disabled' : ''} title="Move forward"><i class="fa-solid fa-chevron-right"></i></button></div>` : ''}</div>`;
    }
    function wkRowT(t) {
      const p = wkProj(t.project_id), du = wkDue(t), st = wkStatus(t.status);
      return `<div class="wk-row" data-id="${t.id}" style="--c:${p ? p.color : '#fb923c'}"><span class="wk-st" style="--c:${st[2]}">${st[1]}</span><div class="wk-rt"><b>${escapeHtml(t.title)}</b><small>${p ? escapeHtml(p.name) : ''}${t.team_id && wkGrpChip(t) ? ' · ' + escapeHtml((wkGrpOf(t.team_id) || {}).name || '') : ''}${wkWho(t).length ? ' · ' + escapeHtml(wkWho(t).join(', ')) : ''}</small></div>${wkBud(t)}${du ? `<span class="wk-due ${du.cls}">${du.text}</span>` : ''}</div>`;
    }
    function wkOverview() {
      const today = wkToday(), open = WK.tasks.filter(t => t.status !== 'done'), mine = open.filter(t => (t.assignee_ids || []).includes(wkMe()));
      const over = open.filter(t => t.due_date && t.due_date < today), week = open.filter(t => t.due_date && t.due_date >= today && Math.round((Date.parse(t.due_date) - Date.parse(today)) / 864e5) <= 7);
      const tiles = [['fa-folder-open', '#fb923c', WK.projects.filter(p => p.status === 'active').length, 'Active projects'], ['fa-list-check', '#60a5fa', open.length, 'Open tasks'], ['fa-calendar-day', '#fbbf24', week.length, 'Due this week'], ['fa-triangle-exclamation', over.length ? '#f87171' : '#94a3b8', over.length, 'Overdue']]
        .map(([i, c, v, l]) => `<div class="sd-tile" style="--c:${c}"><i class="fa-solid ${i}"></i><div><b>${v}</b><span>${l}</span></div></div>`).join('');
      const prog = WK.projects.filter(p => p.status === 'active').map(p => { const ts = WK.tasks.filter(t => t.project_id === p.id), dn = ts.filter(t => t.status === 'done').length;
        return `<div class="wk-prog" data-wkproj="${p.id}" style="--c:${p.color}"><div class="sb-h"><span>${escapeHtml(p.name)}${p.client ? ` <small>${escapeHtml(p.client)}</small>` : ''}</span><b>${dn}/${ts.length}</b></div><div class="sb-t"><i style="width:${ts.length ? Math.max(4, Math.round(dn / ts.length * 100)) : 0}%"></i></div></div>`; }).join('');
      const soon = open.filter(t => t.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 8);
      if (!WK.projects.length) return card(`<div class="h-empty"><div class="h-empty-ico" style="--c:#fb923c"><i class="fa-solid fa-briefcase"></i></div><div class="h-empty-t">Start your first project</div><div class="h-empty-s">A project holds the tasks for one piece of work, such as a client job or a launch. Add people from your contacts to share it.</div><div class="h-empty-chips"><button type="button" class="h-chip" data-wk-newproj><i class="fa-solid fa-plus" style="color:#fb923c"></i>New project</button></div></div>`);
      setTimeout(() => luPaintBusy('wkBusy'), 0);
      return `${wkInvites()}<div id="wkBusy" class="wk-busybox" style="display:none"></div><div class="sd-tiles wk-tiles">${tiles}</div><div class="grid-2">
        ${card(`<div class="section-title"><i class="fa-solid fa-user-check"></i> Assigned to me</div>${mine.length ? mine.slice(0, 8).map(wkRowT).join('') : '<div class="ls" style="padding:6px 2px">Nothing is assigned to you.</div>'}`)}
        ${card(`<div class="section-title"><i class="fa-solid fa-hourglass-half"></i> Due soon</div>${soon.length ? soon.map(wkRowT).join('') : '<div class="ls" style="padding:6px 2px">Nothing has a due date yet.</div>'}`)}
        ${card(`<div class="section-title"><i class="fa-solid fa-chart-simple"></i> Project progress</div>${prog || '<div class="ls" style="padding:6px 2px">No active projects.</div>'}`)}</div>`;
    }
    // invitations waiting for an answer
    function wkInvites() {
      const inv = WK.shared.filter(s => s.my_status === 'pending'); if (!inv.length) return '';
      return inv.map(s => `<div class="wk-invite" data-id="${s.id}"><div class="wk-inv-i"><i class="fa-solid fa-briefcase"></i></div><div class="wk-inv-t"><b>${escapeHtml(s.owner_name)} added you to “${escapeHtml(s.name)}”</b><small>${s.my_role === 'viewer' ? 'You can look at it' : wkHas() ? 'You can add and change tasks' : 'You can look at it (changing tasks needs the Work add-on)'}</small></div><div class="wk-inv-b"><button type="button" class="np-btn" data-wkinv="${s.id}|0">Decline</button><button type="button" class="create-btn" data-wkinv="${s.id}|1">Accept</button></div></div>`).join('');
    }
    function wkProjCard(p, shared) {
      const ts = WK.tasks.filter(t => t.project_id === p.id), dn = ts.filter(t => t.status === 'done').length, st = (WK_PSTATUS.find(x => x[0] === p.status) || WK_PSTATUS[0])[1];
      const sh = shared ? WK.shared.find(s => s.id === p.id) : null, ppl = wkPeopleOf(p.id).length, dl = p.deadline ? new Date(p.deadline + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '';
      return `<div class="card wk-pcard ${p.status !== 'active' ? 'off' : ''}" data-id="${p.id}" style="--c:${p.color}"><div class="wk-ph"><i></i><b>${escapeHtml(p.name)}</b><span class="wk-ps">${st}</span></div>
        <div class="wk-pm"><span><i class="fa-solid ${p.kind === 'general' ? 'fa-folder-tree' : 'fa-diagram-project'}"></i> ${p.kind === 'general' ? 'General' : '6 phases'}</span>${p.client ? `<span><i class="fa-regular fa-building"></i> ${escapeHtml(p.client)}</span>` : ''}${dl ? `<span><i class="fa-regular fa-calendar"></i> ${dl}</span>` : ''}${ppl > 1 ? `<span><i class="fa-solid fa-user-group"></i> ${ppl}</span>` : ''}${sh ? `<span>by ${escapeHtml(sh.owner_name)}${sh.my_role === 'viewer' || !wkHas() ? ' · view only' : ''}</span>` : ''}</div>
        <div class="sb-t"><i style="width:${ts.length ? Math.max(4, Math.round(dn / ts.length * 100)) : 0}%"></i></div><div class="wk-pf"><span>${dn} of ${ts.length} done</span><button type="button" class="np-btn" data-wkopen="${p.id}">Open tasks</button>${!shared && !wkArchived(p) ? `<button type="button" class="np-btn" data-wkedit="${p.id}"><i class="fa-solid fa-pen"></i></button>` : ''}</div></div>`;
    }
    function wkProjectsView() {
      const own = WK.projects.filter(p => p.owner_id === wkMe()), shared = WK.projects.filter(p => p.owner_id !== wkMe());
      const guestNote = !wkHas() ? `<div class="wk-lock"><i class="fa-solid fa-lock"></i><div><b>You are viewing projects other people shared with you</b><span>Work lets you create your own projects, add and change tasks, and invite people. Without it you can look at the projects you were added to.</span></div><button type="button" class="create-btn" data-wk-get>Get Work</button></div>` : '';
      const ownHtml = wkHas() ? (own.length ? `<div class="grid-2">${own.map(p => wkProjCard(p, false)).join('')}</div>` : card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-folder-open"></i></div><div class="h-empty-t">No projects yet</div><div class="h-empty-s">Create one for each client job or piece of work, then add tasks and invite your team.</div><div class="h-empty-chips"><button type="button" class="h-chip" data-wk-newproj><i class="fa-solid fa-plus" style="color:#fb923c"></i>New project</button></div></div>`)) : '';
      const sharedHtml = shared.length ? `<div class="sd-gh" style="margin-top:18px"><b>Shared with me</b><span>${shared.length}</span></div><div class="grid-2">${shared.map(p => wkProjCard(p, true)).join('')}</div>` : '';
      return `${guestNote}${wkInvites()}${ownHtml}${sharedHtml}${!wkHas() && !shared.length && !WK.shared.length ? card('<div class="ls">Nothing has been shared with you yet.</div>') : ''}`;
    }
    function wkTasksView() {
      const projects = WK.projects, sel = WK.project && wkProj(WK.project) ? WK.project : '', view = WK.view === 'phases' && !sel ? 'board' : WK.view;
      let tasks = WK.tasks.filter(t => (!sel || t.project_id === sel) && (!WK.mine || (t.assignee_ids || []).includes(wkMe())) && (!WK.teamF || t.team_id === WK.teamF));
      const bar = `<div class="wk-bar"><select id="wkFilterProj"><option value="">All projects</option>${projects.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${escapeHtml(p.name)}</option>`).join('')}</select>${wkGrpFilterHtml()}
        <button type="button" class="sp-chip ${WK.mine ? 'active' : ''}" data-wkmine>Assigned to me</button>${sel && wkRole(wkProj(sel)) === 'owner' && wkPeopleOf(sel).length > 1 ? '<button type="button" class="sp-chip" data-wkteam title="The hours everyone logged on this project"><i class="fa-regular fa-clock"></i> Team time</button>' : ''}<button type="button" class="sp-chip" data-wkics title="Save the deadlines as a calendar file for Google, Apple or Outlook Calendar"><i class="fa-regular fa-calendar-plus"></i> Calendar file</button><span class="wk-seg">${sel ? `<button type="button" data-wkview="phases" class="${view === 'phases' ? 'on' : ''}"><i class="fa-solid ${wkProj(sel).kind === 'general' ? 'fa-folder-tree' : 'fa-diagram-project'}"></i> ${wkProj(sel).kind === 'general' ? 'Folders' : 'Phases'}</button>` : ''}<button type="button" data-wkview="board" class="${view === 'board' ? 'on' : ''}"><i class="fa-solid fa-table-columns"></i> Board</button><button type="button" data-wkview="list" class="${view === 'list' ? 'on' : ''}"><i class="fa-solid fa-list"></i> List</button><button type="button" data-wkview="gantt" class="${view === 'gantt' ? 'on' : ''}"><i class="fa-solid fa-chart-gantt"></i> Gantt</button><button type="button" data-wkview="timeline" class="${view === 'timeline' ? 'on' : ''}"><i class="fa-solid fa-timeline"></i> Timeline</button></span></div>`;
      if (!projects.length) return bar.replace(/<div class="wk-bar">.*<\/div>$/s, '') + card('<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-list-check"></i></div><div class="h-empty-t">No tasks yet</div><div class="h-empty-s">Create a project first, then add its tasks here.</div><div class="h-empty-chips">' + (wkHas() ? '<button type="button" class="h-chip" data-wk-newproj><i class="fa-solid fa-plus" style="color:#fb923c"></i>New project</button>' : '') + '</div></div>');
      if (view === 'phases') return bar + wkPhasesView(sel, tasks);
      if (view === 'gantt') return bar + wkGanttView(sel, tasks);
      if (view === 'timeline') return bar + wkTimelineView(sel, tasks);
      if (view === 'list') return bar + (tasks.length ? `<div class="card">${tasks.slice().sort((a, b) => (a.status === 'done') - (b.status === 'done') || (a.due_date || '9999').localeCompare(b.due_date || '9999')).map(wkRowT).join('')}</div>` : card('<div class="ls">No tasks match.</div>'));
      return bar + `<div class="wk-board">${WK_STATUS.map(([k, n, col]) => { const items = tasks.filter(t => t.status === k).sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || a.position - b.position);
        return `<div class="wk-col"><div class="wk-ch"><span class="d" style="background:${col}"></span><b>${n}</b><em>${items.length}</em></div><div class="wk-cb">${items.map(t => wkCard(t, !sel)).join('') || '<div class="wk-empty">Nothing here</div>'}</div></div>`; }).join('')}</div>`;
    }

    // a project's phases (or a general project's folders): each holds its tasks and a notes area
    function wkPhasesView(pid, tasks) {
      const p = wkProj(pid), edit = wkCanEdit(p), fl = wkFolders(pid), word = wkKindWord(p).toLowerCase();
      const none = tasks.filter(t => !t.folder_id || !fl.some(f => f.id === t.folder_id));
      const sect = (f, i) => { const ts = tasks.filter(t => t.folder_id === f.id), dn = ts.filter(t => t.status === 'done').length, note = (f.notes || '').trim();
        return `<div class="card wk-ph-card"><div class="wk-phh"><span class="wk-phn">${f.is_phase ? i + 1 : '<i class="fa-regular fa-folder"></i>'}</span><b>${escapeHtml(f.name)}</b><em>${dn}/${ts.length}</em><button type="button" class="np-btn" data-wkfolder="${f.id}"><i class="fa-regular fa-note-sticky"></i> ${note ? 'Notes' : edit ? 'Add notes' : 'Notes'}</button></div>
          ${note ? `<div class="wk-phnote">${escapeHtml(note.slice(0, 160))}${note.length > 160 ? '…' : ''}</div>` : ''}
          ${ts.map(wkRowT).join('') || `<div class="ls" style="padding:4px 2px">No tasks in this ${word} yet.</div>`}
          ${edit ? `<button type="button" class="np-btn wk-phadd" data-wkfaddt="${f.id}"><i class="fa-solid fa-plus"></i> Add task</button>` : ''}</div>`; };
      return `${fl.map(sect).join('')}${p.kind === 'general' && !fl.length ? card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-folder-tree"></i></div><div class="h-empty-t">No folders yet</div><div class="h-empty-s">Make a folder for each kind of document or approval, then add tasks and notes inside it.</div></div>`) : ''}
        ${none.length ? `<div class="card wk-ph-card"><div class="wk-phh"><span class="wk-phn"><i class="fa-regular fa-circle"></i></span><b>Not in a ${word}</b><em>${none.length}</em></div>${none.map(wkRowT).join('')}</div>` : ''}
        ${p.kind === 'general' && edit ? `<button type="button" class="np-btn wk-phadd" data-wkfnew><i class="fa-solid fa-folder-plus"></i> New folder</button>` : ''}`;
    }

    // ---------- a phase or folder (name + notes) ----------
    const WKFD = { id: null, project: null, ro: false };
    function wkOpenFolder(f) {
      const p = wkProj(f ? f.project_id : WK.project), edit = wkCanEdit(p); WKFD.id = f ? f.id : null; WKFD.project = p.id; WKFD.ro = !edit;
      docEl('wkFolderHead').textContent = f ? f.name : 'New folder'; docEl('wkFolderName').value = f ? f.name : ''; docEl('wkFolderNotes').value = f ? f.notes : '';
      docEl('wkFolderName').disabled = !edit || !!(f && f.is_phase); docEl('wkFolderNotes').disabled = !edit; docEl('wkFolderRo').style.display = edit ? 'none' : '';
      docEl('wkFolderSave').style.display = edit ? '' : 'none'; docEl('wkFolderDelete').style.display = edit && f && !f.is_phase ? '' : 'none'; wkErr('wkFolderError', '');
      sdOpen('wkFolderOverlay'); if (!f) setTimeout(() => docEl('wkFolderName').focus(), 50);
    }
    docEl('wkFolderClose').onclick = () => sdClose('wkFolderOverlay'); docEl('wkFolderOverlay').onclick = e => { if (e.target === docEl('wkFolderOverlay')) sdClose('wkFolderOverlay'); };
    docEl('wkFolderSave').onclick = async () => {
      const name = docEl('wkFolderName').value.trim(); if (!name) return wkErr('wkFolderError', 'Give the folder a name.');
      const f = { name, notes: docEl('wkFolderNotes').value }; if (!WKFD.id) { f.project_id = WKFD.project; f.position = wkFolders(WKFD.project).length; }
      sdBtn('wkFolderSave', true); wkErr('wkFolderError', '');
      const r = WKFD.id ? await LumaWork.folders.update(WKFD.id, f) : await LumaWork.folders.add(f); sdBtn('wkFolderSave', false, 'Save');
      if (r.error) return wkErr('wkFolderError', wkHint(r.error.message));
      const i = WK.folders.findIndex(x => x.id === r.data.id); if (i >= 0) WK.folders[i] = r.data; else WK.folders.push(r.data); sdClose('wkFolderOverlay'); wkPaint();
    };
    docEl('wkFolderDelete').onclick = async () => {
      const f = WK.folders.find(x => x.id === WKFD.id); if (!f) return;
      if (!await luConfirm({ title: `Delete “${f.name}”?`, message: 'The folder and its notes are removed. Its tasks stay in the project.' })) return;
      const r = await LumaWork.folders.remove(f.id); if (r.error) return wkErr('wkFolderError', r.error.message);
      WK.folders = WK.folders.filter(x => x !== f); WK.tasks.forEach(t => { if (t.folder_id === f.id) t.folder_id = null; }); sdClose('wkFolderOverlay'); wkPaint();
    };

    // ---------- project popup (with the team) ----------
    const WKF = { projectId: null, color: '#fb923c', status: 'active', kind: 'project' };
    const wkErr = (id, m) => sdErr(id, m);
    function wkPaintProj() {
      sdChips('wkProjKind', WK_PHASE_KINDS.map(([k, n]) => [k, n, '']), WKF.kind, 'pk');
      docEl('wkProjKindNote').textContent = (WK_PHASE_KINDS.find(x => x[0] === WKF.kind) || [])[2] + (WKF.projectId ? ' (can not be changed later)' : '');
      docEl('wkProjKind').classList.toggle('wk-locked', !!WKF.projectId);
      sdChips('wkProjStatus', WK_PSTATUS.map(([k, n]) => [k, n, '']), WKF.status, 'ps');
      docEl('wkProjColors').innerHTML = SD_COLORS.map(c => `<button type="button" class="sd-sw ${c === WKF.color ? 'on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Colour ${c}"></button>`).join('');
      const box = docEl('wkTeamBox'); const id = WKF.projectId; box.style.display = id ? '' : 'none'; wkGrpPaintProj(id); if (!id) return;
      const rows = WK.people.filter(x => x.project_id === id);
      docEl('wkTeamList').innerHTML = rows.map(x => `<div class="wk-tm"><span class="wk-av">${escapeHtml(wkInit(x.user_id === wkMe() ? 'You' : x.name))}</span><div class="wk-tn"><b>${escapeHtml(x.user_id === wkMe() ? 'You' : x.name)}</b><small>${x.role === 'owner' ? 'Owner' : x.status === 'pending' ? 'Invited · waiting' : x.role === 'viewer' ? 'Viewer' : 'Member'}</small></div>${x.role === 'owner' ? '' : `<button type="button" class="np-btn" data-wkrole="${x.user_id}|${x.role === 'viewer' ? 'member' : 'viewer'}" title="Change what they can do">${x.role === 'viewer' ? 'Make member' : 'Make viewer'}</button><button type="button" class="tk-x" data-wkrm="${x.user_id}" title="Remove"><i class="fa-solid fa-xmark"></i></button>`}</div>`).join('') || '<div class="ls">Just you so far.</div>';
    }
    function wkOpenProj(p) {
      if (!p && !wkHas()) return openAddon('work');
      WKF.projectId = p ? p.id : null; WKF.color = p ? p.color : SD_COLORS[WK.projects.length % SD_COLORS.length]; WKF.status = p ? p.status : 'active'; WKF.kind = p ? p.kind || 'project' : 'project';
      docEl('wkProjHead').textContent = p ? 'Edit project' : 'New project'; docEl('wkProjName').value = p ? p.name : ''; docEl('wkProjClient').value = p ? p.client : ''; docEl('wkProjDesc').value = p ? p.description : '';
      docEl('wkProjDeadline').value = p && p.deadline ? p.deadline : ''; if (docEl('wkProjDeadline')._luDateRefresh) docEl('wkProjDeadline')._luDateRefresh();
      { const act = wkCoActive(), sel = docEl('wkProjCompany'), cur = p ? p.company_id : WK.company; sel.innerHTML = act.concat(p && !act.some(c => c.id === p.company_id) && wkCoOf(p.company_id) ? [wkCoOf(p.company_id)] : []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join(''); sel.value = cur; skinSelect(sel);
        docEl('wkProjCoNote').textContent = p ? 'Moving a project keeps all its tasks, notes and your logged time.' : ''; docEl('wkProjCoBox').style.display = act.length > 1 || p ? '' : 'none'; }
      docEl('wkProjDelete').style.display = p ? '' : 'none'; wkErr('wkProjError', ''); wkPaintProj(); sdOpen('wkProjOverlay'); if (!p) setTimeout(() => docEl('wkProjName').focus(), 50);
    }
    docEl('wkProjClose').onclick = () => sdClose('wkProjOverlay'); docEl('wkProjOverlay').onclick = e => {
      if (e.target === docEl('wkProjOverlay')) return sdClose('wkProjOverlay');
      const pk = e.target.closest('[data-pk]'); if (pk && !WKF.projectId) { WKF.kind = pk.dataset.pk; return wkPaintProj(); }
      const ps = e.target.closest('[data-ps]'); if (ps) { WKF.status = ps.dataset.ps; return wkPaintProj(); }
      const sw = e.target.closest('.sd-sw'); if (sw) { WKF.color = sw.dataset.color; return wkPaintProj(); }
    };
    docEl('wkProjSave').onclick = async () => {
      const name = docEl('wkProjName').value.trim(); if (!name) return wkErr('wkProjError', 'Give the project a name.');
      const f = { name, client: docEl('wkProjClient').value.trim(), status: WKF.status, color: WKF.color, deadline: docEl('wkProjDeadline').value || null, description: docEl('wkProjDesc').value.trim() };
      const co = docEl('wkProjCompany').value || WK.company, old = WKF.projectId ? wkProj(WKF.projectId) : null, moving = !!old && co !== old.company_id;
      if (!WKF.projectId) { f.kind = WKF.kind; f.company_id = co; }
      if (moving && !await luConfirm({ title: `Move to ${(wkCoOf(co) || {}).name || 'that company'}?`, message: 'The project, all its tasks and notes, and your logged time on it move to that company.', ok: 'Move', icon: 'fa-right-left', tone: 'info' })) return;
      sdBtn('wkProjSave', true); wkErr('wkProjError', '');
      if (moving) { const mv = await LumaWork.moveProject(WKF.projectId, co); if (mv.error) { sdBtn('wkProjSave', false, 'Save project'); return wkErr('wkProjError', wkHint(mv.error.message)); } }
      const r = WKF.projectId ? await LumaWork.projects.update(WKF.projectId, f) : await LumaWork.projects.add(f); sdBtn('wkProjSave', false, 'Save project');
      if (r.error) return wkErr('wkProjError', /row-level security/i.test(r.error.message) ? 'The Work add-on is needed to create or change projects.' : wkHint(r.error.message));
      sdClose('wkProjOverlay'); await wkLoad(); wkPaint(); flashToast(moving ? 'Project moved' : WKF.projectId ? 'Project saved' : 'Project created', moving ? `${name} · ${(wkCoOf(co) || {}).name}` : name, 'fa-briefcase', '#fb923c');
    };
    docEl('wkProjDelete').onclick = async () => {
      const p = wkProj(WKF.projectId); if (!p) return;
      if (!await luConfirm({ title: `Delete “${p.name}”?`, message: 'The project and all its tasks are removed for everyone on it. This can\'t be undone.' })) return;
      const r = await LumaWork.projects.remove(p.id); if (r.error) return wkErr('wkProjError', r.error.message);
      sdClose('wkProjOverlay'); await wkLoad(); wkPaint(); undoNote();
      function undoNote() { flashToast('Project deleted', p.name, 'fa-trash-can', '#f87171'); }
    };
    docEl('wkTeamAdd').onclick = async () => {
      const id = WKF.projectId; if (!id) return; const have = new Set(WK.people.filter(x => x.project_id === id).map(x => x.user_id));
      const got = await sdPickContacts({ title: 'Add people to this project', exclude: have }); if (!got || !got.size) return;
      const r = await LumaWork.invite(id, [...got.keys()], 'member'); if (r.error) return wkErr('wkProjError', r.error.message);
      await wkLoad(); wkPaintProj(); wkPaint(); flashToast('Invitations sent', `${r.data} ${r.data === 1 ? 'person' : 'people'} added`, 'fa-user-plus', '#fb923c');
    };
    docEl('wkTeamList').addEventListener('click', async e => {
      const id = WKF.projectId; if (!id) return;
      const rm = e.target.closest('[data-wkrm]'); if (rm) { if (!await luConfirm({ title: 'Remove this person?', message: 'They lose access, and their tasks become unassigned.', ok: 'Remove' })) return; const r = await LumaWork.removeMember(id, rm.dataset.wkrm); if (r.error) return wkErr('wkProjError', r.error.message); await wkLoad(); wkPaintProj(); return wkPaint(); }
      const ro = e.target.closest('[data-wkrole]'); if (ro) { const [u, role] = ro.dataset.wkrole.split('|'); const r = await LumaWork.setRole(id, u, role); if (r.error) return wkErr('wkProjError', r.error.message); await wkLoad(); wkPaintProj(); }
    });

    // ---------- task popup ----------
    const WKT = { id: null, status: 'todo', priority: 'med', list: [], ro: false, who: [], deps: [], deps0: [] };
    function wkPaintTask() {
      sdChips('wkTaskStatus', WK_STATUS.map(([k, n]) => [k, n, '']), WKT.status, 'ts'); sdChips('wkTaskPrio', WK_PRIO.map(([k, n]) => [k, n, '']), WKT.priority, 'tp');
      docEl('wkTaskChecklist').innerHTML = WKT.list.map((x, i) => `<div class="tk-item ${x.d ? 'done' : ''}" data-i="${i}"><button type="button" class="tk-tick" data-tick><i class="fa-solid fa-check"></i></button><input type="text" value="${escapeHtml(x.t)}" maxlength="120" data-text ${WKT.ro ? 'disabled' : ''}>${WKT.ro ? '' : '<button type="button" class="tk-x" data-rm title="Remove"><i class="fa-solid fa-xmark"></i></button>'}</div>`).join('');
      docEl('wkTaskOverlay').classList.toggle('wk-readonly', WKT.ro);
    }
    // the phase / folder a task sits in
    function wkPaintFolder(pid, cur) {
      const p = wkProj(pid), fl = wkFolders(pid), sel = docEl('wkTaskFolder');
      docEl('wkTaskFolderL').textContent = wkKindWord(p) + ' (optional)'; docEl('wkTaskFolderBox').style.display = fl.length ? '' : 'none';
      sel.innerHTML = `<option value="">No ${wkKindWord(p).toLowerCase()}</option>` + fl.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join(''); sel.value = fl.some(f => f.id === cur) ? cur : ''; skinSelect(sel);
    }
    // the tasks this one waits for
    function wkPaintDeps(pid) {
      const all = WK.rawTasks.filter(x => x.project_id === pid && x.id !== WKT.id), chosen = WKT.deps.map(id => all.find(x => x.id === id)).filter(Boolean);
      WKT.deps = chosen.map(x => x.id);
      docEl('wkTaskDeps').innerHTML = chosen.length ? chosen.map(x => `<button type="button" class="on" data-dep-rm="${x.id}" title="Remove"><i class="fa-solid fa-link"></i> ${escapeHtml(x.title)} <i class="fa-solid fa-xmark"></i></button>`).join('') : '<span class="ls" style="font-size:0.8rem">Nothing. This task can start any time.</span>';
      const sel = docEl('wkTaskDepAdd'); sel.innerHTML = '<option value="">Add a task it waits for…</option>' + all.filter(x => !WKT.deps.includes(x.id)).slice(0, 300).map(x => `<option value="${x.id}">${escapeHtml(x.title)}</option>`).join(''); sel.value = ''; skinSelect(sel);
      sel.disabled = WKT.ro || !all.length; docEl('wkTaskDepsBox').style.display = WKT.ro && !chosen.length ? 'none' : '';
      const start = docEl('wkTaskStart').value || docEl('wkTaskDue').value, late = start ? chosen.filter(x => x.status !== 'done' && (x.due_date || x.start_date) && (x.due_date || x.start_date) >= start) : [], w = docEl('wkTaskDepWarn');
      w.style.display = late.length ? '' : 'none'; if (late.length) w.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> This task starts before ${late.map(x => '“' + escapeHtml(x.title) + '”').join(', ')} ${late.length === 1 ? 'ends' : 'end'}.`;
    }
    // time logged against the budget (in the task window)
    function wkPaintBudget() {
      const t = WK.tasks.find(x => x.id === WKT.id), bud = Math.round((parseFloat(docEl('wkTaskBudget').value) || 0) * 60), m = t ? (WK.tmins[t.id] || 0) : 0, box = docEl('wkTaskLogged');
      box.innerHTML = !t ? '' : bud ? `<div class="wk-bt"><i style="width:${Math.min(100, Math.round(m / bud * 100))}%" class="${m > bud ? 'over' : ''}"></i></div><small class="${m > bud ? 'over' : ''}">${wkDur(m)} logged of ${wkDur(bud)}${m > bud ? ' · over by ' + wkDur(m - bud) : ''}</small>` : `<small>${wkDur(m)} logged so far</small>`;
    }
    // who the task can be given to: everyone on the project (tap to pick one, several or nobody)
    function wkPaintWho(pid) {
      const ppl = wkPeopleOf(pid); WKT.who = WKT.who.filter(u => ppl.some(x => x.user_id === u));
      docEl('wkTaskAssignees').innerHTML = ppl.length ? ppl.map(x => `<button type="button" class="${WKT.who.includes(x.user_id) ? 'on' : ''}" data-who="${x.user_id}" ${WKT.ro ? 'disabled' : ''}><span class="wk-av">${escapeHtml(wkInit(x.user_id === wkMe() ? 'You' : x.name))}</span> ${escapeHtml(x.user_id === wkMe() ? 'You' : x.name)}</button>`).join('') : '<span class="ls" style="font-size:0.8rem">Nobody else is on this project yet.</span>';
    }
    function wkOpenTask(t, pre) {
      const editable = WK.projects.filter(wkCanEdit);
      if (!t && !editable.length) return wkHas() ? luAlert('Create a project first: tasks live inside a project.', 'No project yet') : openAddon('work');
      const p = t ? wkProj(t.project_id) : null, ro = !!t && !wkCanEdit(p); WKT.id = t ? t.id : null; WKT.ro = ro; WKT.status = t ? t.status : (pre && pre.status) || 'todo'; WKT.priority = t ? t.priority : 'med'; WKT.list = t && Array.isArray(t.checklist) ? t.checklist.map(x => ({ t: x.t, d: !!x.d })) : [];
      docEl('wkTaskHead').textContent = ro ? 'Task' : t ? 'Edit task' : 'New task'; docEl('wkTaskTitle').value = t ? t.title : ''; docEl('wkTaskDesc').value = t ? t.description : '';
      const pid = t ? t.project_id : (pre && pre.project) || (WK.project && editable.some(x => x.id === WK.project) ? WK.project : editable[0].id);
      const ps = docEl('wkTaskProject'); const pool = t && !ro ? WK.rawProjects.filter(x => wkCanEdit(x) || x.id === t.project_id) : t ? WK.projects : editable, multiCo = new Set(pool.filter(x => x.owner_id === wkMe()).map(x => x.company_id)).size > 1;
      ps.innerHTML = pool.map(x => `<option value="${x.id}">${escapeHtml(x.name)}${multiCo && wkCoOf(x.company_id) ? ' · ' + escapeHtml(wkCoOf(x.company_id).name) : ''}</option>`).join(''); ps.value = pid; ps.disabled = !!t && (ro || pool.length < 2); skinSelect(ps); WKT.project0 = pid;
      docEl('wkTaskMoveNote').style.display = 'none';
      WKT.who = t ? (t.assignee_ids || []).slice() : []; wkPaintWho(pid); wkGrpPaintTask(pid, t ? t.team_id : ''); WKT.deps = t ? WK.links.filter(l => l.task_id === t.id).map(l => l.depends_on) : []; WKT.deps0 = WKT.deps.slice(); docEl('wkTaskBudget').value = t && t.budget_minutes ? +(t.budget_minutes / 60).toFixed(2) : ''; wkPaintFolder(pid, t ? t.folder_id : pre && pre.folder); docEl('wkTaskFolder').disabled = ro; docEl('wkTaskStart').value = t && t.start_date ? t.start_date : ''; if (docEl('wkTaskStart')._luDateRefresh) docEl('wkTaskStart')._luDateRefresh(); docEl('wkTaskDue').value = t && t.due_date ? t.due_date : ''; if (docEl('wkTaskDue')._luDateRefresh) docEl('wkTaskDue')._luDateRefresh();
      docEl('wkTaskCheckNew').value = ''; wkErr('wkTaskError', '');
      docEl('wkTaskRo').style.display = ro ? '' : 'none'; if (ro) docEl('wkTaskRoWhy').textContent = !wkHas() ? 'Changing tasks needs the Work add-on.' : 'You were added to this project as a viewer.';
      ['wkTaskTitle', 'wkTaskDesc', 'wkTaskStart', 'wkTaskDue', 'wkTaskCheckNew'].forEach(i => { docEl(i).disabled = ro; });
      docEl('wkTaskSave').style.display = ro ? 'none' : ''; docEl('wkTaskDelete').style.display = t && !ro && (wkRole(p) === 'owner' || t.created_by === wkMe()) ? '' : 'none'; docEl('wkTaskCheckAdd').style.display = ro ? 'none' : '';
      wkPaintDeps(pid); wkPaintBudget(); docEl('wkTaskBudget').disabled = ro; wkPaintTask(); wkPaintMore(t); sdOpen('wkTaskOverlay'); if (!t) setTimeout(() => docEl('wkTaskTitle').focus(), 50);
    }
    // files and the discussion of the task being looked at (only for tasks that already exist)
    const wkAgo = iso => { const s = (Date.now() - Date.parse(iso)) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); };
    const wkCanTalk = () => { const t = WK.tasks.find(x => x.id === WKT.id); return !!t && wkCanEdit(wkProj(t.project_id)); };
    // @Name in a comment: the tagged people are highlighted; the people tagged are worked out from the words when it is sent
    const wkPeopleNames = pid => wkPeopleOf(pid).filter(x => x.user_id !== wkMe()).sort((a, b) => b.name.length - a.name.length);
    function wkMentionsOf(text, pid) { return wkPeopleNames(pid).filter(x => text.toLowerCase().includes('@' + x.name.toLowerCase())).map(x => x.user_id); }
    function wkMentionHtml(body, ids, pid) {
      let out = escapeHtml(body || ''); const tagged = new Set(ids || []);
      wkPeopleOf(pid).forEach(x => { if (tagged.has(x.user_id)) out = out.replace(new RegExp('@' + escapeHtml(x.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<span class="wk-mention">${m}</span>`); });
      return out;
    }
    // the little list that opens when you type @
    function wkMentionBox(ta) {
      const box = ta.closest('.wk-mnwrap, .wk-cmt-edit') && ta.closest('.wk-mnwrap, .wk-cmt-edit').querySelector('.wk-mn') || (() => { const w = ta.closest('.wk-cmt-edit'); if (!w) return null; const b = document.createElement('div'); b.className = 'wk-mn'; w.insertBefore(b, w.firstChild.nextSibling); w.style.position = 'relative'; return b; })();
      if (!box) return; const t = WK.tasks.find(x => x.id === WKT.id), pos = ta.selectionStart || 0, m = /(^|\s)@([^\s@]*)$/.exec(ta.value.slice(0, pos));
      if (!t || !m) { box.style.display = 'none'; return; }
      const q = m[2].toLowerCase(), list = wkPeopleNames(t.project_id).filter(x => !q || x.name.toLowerCase().split(/\s+/).some(w => w.startsWith(q)) || x.name.toLowerCase().startsWith(q)).slice(0, 6);
      if (!list.length) { box.style.display = 'none'; return; }
      box.innerHTML = list.map(x => `<button type="button" data-mn="${escapeHtml(x.name)}"><span class="wk-av">${escapeHtml(wkInit(x.name))}</span>${escapeHtml(x.name)}</button>`).join(''); box.style.display = '';
      box._ta = ta; box._start = pos - m[2].length - 1;
    }
    document.addEventListener('input', e => { if (e.target.matches('#wkTaskCmtText, .wk-cmt-edit textarea')) wkMentionBox(e.target); });
    document.addEventListener('mousedown', e => {
      const b = e.target.closest('.wk-mn [data-mn]'); if (!b) return; e.preventDefault(); const box = b.closest('.wk-mn'), ta = box._ta; if (!ta) return;
      const pos = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, box._start) + '@' + b.dataset.mn + ' ' + ta.value.slice(pos); ta.focus(); const at = box._start + b.dataset.mn.length + 2; ta.setSelectionRange(at, at); box.style.display = 'none';
    });
    async function wkLoadComments() {
      if (!WKT.id) return; const r = await LumaWork.comments.list(WKT.id); if (r.error) return; const owner = wkRole(wkProj((WK.tasks.find(x => x.id === WKT.id) || {}).project_id)) === 'owner', can = wkCanTalk();
      docEl('wkTaskComments').innerHTML = (r.data || []).length ? r.data.map(c => `<div class="sd-cmt"><span class="av">${escapeHtml((c.name[0] || '?').toUpperCase())}</span><div class="bd"><div class="h"><b>${escapeHtml(c.name)}${c.user_id === wkMe() ? ' <small>(you)</small>' : ''}</b><small>${wkAgo(c.created_at)}</small>${c.edited_at ? `<button type="button" class="wk-edited" data-cmt-hist="${c.id}" title="See the earlier wording">edited</button>` : ''}${can && c.user_id === wkMe() ? `<button type="button" data-cmt-edit="${c.id}" title="Edit" aria-label="Edit"><i class="fa-solid fa-pen"></i></button>` : ''}${can && (c.user_id === wkMe() || owner) ? `<button type="button" data-cmt-del="${c.id}" title="Delete" aria-label="Delete"><i class="fa-solid fa-xmark"></i></button>` : ''}</div><p>${wkMentionHtml(c.body, c.mentions, (WK.tasks.find(x => x.id === WKT.id) || {}).project_id)}</p></div></div>`).join('') : `<div class="ls" style="padding:2px 0;font-size:0.78rem">No comments yet.${can ? ' Be the first to write one.' : ''}</div>`;
    }
    async function wkLoadFiles() {
      if (!WKT.id) return; const r = await LumaWork.files.list(WKT.id); if (r.error) return; const t = WK.tasks.find(x => x.id === WKT.id), owner = wkRole(wkProj(t && t.project_id)) === 'owner', can = wkCanTalk();
      docEl('wkTaskFiles').innerHTML = (r.data || []).length ? r.data.map(f => `<div class="sd-file"><i class="fa-solid fa-file"></i><button type="button" class="nm" data-file-open="${escapeHtml(f.storage_path)}">${escapeHtml(f.name)}</button><small>${LumaDocuments.formatSize(Number(f.size_bytes || 0))} · ${escapeHtml(f.added_by_name)}</small>${can && (f.added_by === wkMe() || owner) ? `<button type="button" class="ic" data-file-del="${f.id}" title="Remove from the task" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`).join('') : '<div class="ls" style="padding:2px 0">No files attached.</div>';
    }
    function wkPaintMore(t) {
      docEl('wkTaskMore').style.display = t ? '' : 'none'; if (!t) return; const can = wkCanTalk();
      docEl('wkTaskCmtAdd').style.display = can ? '' : 'none'; docEl('wkTaskAttach').style.display = can ? '' : 'none'; docEl('wkTaskCmtErr').textContent = ''; docEl('wkTaskCmtText').value = '';
      docEl('wkTaskFiles').innerHTML = docEl('wkTaskComments').innerHTML = '<div class="ls" style="padding:2px 0">Loading…</div>'; wkLoadFiles(); wkLoadComments(); wkPaintTaskTime();
    }
    docEl('wkTaskAttach').onclick = () => docEl('wkTaskFile').click();
    docEl('wkTaskFile').onchange = async () => {
      const file = docEl('wkTaskFile').files[0]; docEl('wkTaskFile').value = ''; if (!file || !WKT.id) return;
      const b = docEl('wkTaskAttach'); b.disabled = true; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading…'; wkErr('wkTaskError', '');
      try { const up = await LumaDocuments.upload(file); if (up.error) throw new Error(up.error.message); const at = await LumaWork.files.attach(WKT.id, up.data.id); if (at.error) throw new Error(at.error.message); }
      catch (e) { wkErr('wkTaskError', 'Could not attach the file: ' + (/schema cache|does not exist|work_attach_file/i.test(e.message) ? 'run supabase/migrations/075_work_comments_files.sql first.' : e.message)); }
      b.disabled = false; b.innerHTML = '<i class="fa-solid fa-paperclip"></i> Attach a file'; wkLoadFiles(); if (!docEl('wkTaskError').textContent) flashToast('File attached', 'The people on this project can open it', 'fa-paperclip', '#fb923c');
    };
    docEl('wkTaskCmtSend').onclick = async () => {
      const txt = docEl('wkTaskCmtText').value.trim(); docEl('wkTaskCmtErr').textContent = '';
      if (!txt) { docEl('wkTaskCmtErr').textContent = 'Write your comment first, then press send.'; return docEl('wkTaskCmtText').focus(); }
      const b = docEl('wkTaskCmtSend'); b.disabled = true; const r = await LumaWork.comments.add(WKT.id, txt, wkMentionsOf(txt, (WK.tasks.find(x => x.id === WKT.id) || {}).project_id)); b.disabled = false;
      if (r.error) return void (docEl('wkTaskCmtErr').textContent = /row-level security/i.test(r.error.message) ? 'Only owners and members with the Work add-on can comment.' : /schema cache|does not exist/i.test(r.error.message) ? 'Comments aren\'t set up yet: run supabase/migrations/075_work_comments_files.sql.' : r.error.message);
      docEl('wkTaskCmtText').value = ''; wkLoadComments(); flashToast('Comment sent', 'The people on this task are told', 'fa-paper-plane', '#fb923c');
    };
    docEl('wkTaskCmtText').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); docEl('wkTaskCmtSend').click(); } });
    // earlier wordings of a comment, newest first
    async function wkShowHistory(id) {
      wkErr('wkHistError', ''); docEl('wkHistList').innerHTML = '<div class="ls">Loading…</div>'; sdOpen('wkHistOverlay');
      const r = await LumaWork.comments.history(id); if (r.error) { docEl('wkHistList').innerHTML = ''; return wkErr('wkHistError', /schema cache|does not exist/i.test(r.error.message) ? 'Run supabase/migrations/078_work_edit_move_team.sql first.' : r.error.message); }
      const when = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
      docEl('wkHistList').innerHTML = (r.data || []).map(h => `<div class="wk-hv ${h.is_current ? 'cur' : ''}"><div class="wk-hvh"><b>${h.is_current ? 'Now' : 'Before'}</b><small>${when(h.edited_at)}</small></div><p>${escapeHtml(h.body)}</p></div>`).join('');
    }
    docEl('wkHistClose').onclick = () => sdClose('wkHistOverlay'); docEl('wkHistOverlay').onclick = e => { if (e.target === docEl('wkHistOverlay')) sdClose('wkHistOverlay'); };
    docEl('wkTaskDepAdd').addEventListener('change', () => { const v = docEl('wkTaskDepAdd').value; if (!v || WKT.deps.length >= 10) return; WKT.deps.push(v); wkPaintDeps(docEl('wkTaskProject').value); });
    ['wkTaskStart', 'wkTaskDue'].forEach(i => docEl(i).addEventListener('change', () => wkPaintDeps(docEl('wkTaskProject').value)));
    docEl('wkTaskBudget').addEventListener('input', wkPaintBudget);
    docEl('wkTaskClose').onclick = () => sdClose('wkTaskOverlay');
    docEl('wkTaskOverlay').onclick = async e => {
      if (e.target === docEl('wkTaskOverlay')) return sdClose('wkTaskOverlay');
      const fopen = e.target.closest('[data-file-open]'); if (fopen) { const r = await LumaDocuments.signedUrl({ storage_path: fopen.dataset.fileOpen }); if (r.error || !r.url) return wkErr('wkTaskError', 'Could not open the file: ' + ((r.error && r.error.message) || 'no link')); return void window.open(r.url, '_blank', 'noopener'); }
      const fdel = e.target.closest('[data-file-del]'); if (fdel) { if (!await luConfirm({ title: 'Remove this file from the task?', message: 'The others can no longer open it. The file stays in the Documents of the person who attached it.', ok: 'Remove', icon: 'fa-paperclip', tone: 'info' })) return; const r = await LumaWork.files.detach(fdel.dataset.fileDel); if (r.error) wkErr('wkTaskError', r.error.message); return wkLoadFiles(); }
      const dr = e.target.closest('[data-dep-rm]'); if (dr && !WKT.ro) { WKT.deps = WKT.deps.filter(x => x !== dr.dataset.depRm); return wkPaintDeps(docEl('wkTaskProject').value); }
      const hist = e.target.closest('[data-cmt-hist]'); if (hist) return wkShowHistory(hist.dataset.cmtHist);
      const cedit = e.target.closest('[data-cmt-edit]'); if (cedit) { const row = cedit.closest('.sd-cmt'), p = row.querySelector('p'), id = cedit.dataset.cmtEdit; row.querySelector('.bd').insertAdjacentHTML('beforeend', `<div class="wk-cmt-edit" data-id="${id}"><textarea maxlength="2000">${escapeHtml(p.textContent)}</textarea><div><button type="button" class="np-btn" data-cmt-save="${id}">Save</button><button type="button" class="np-btn" data-cmt-cancel>Cancel</button></div></div>`); p.style.display = 'none'; cedit.style.display = 'none'; row.querySelector('textarea').focus(); return; }
      if (e.target.closest('[data-cmt-cancel]')) return wkLoadComments();
      const csave = e.target.closest('[data-cmt-save]'); if (csave) { const box = csave.closest('.wk-cmt-edit'), txt = box.querySelector('textarea').value.trim(); if (!txt) return wkErr('wkTaskError', 'A comment can not be empty. Delete it instead.'); csave.disabled = true; const r = await LumaWork.comments.edit(csave.dataset.cmtSave, txt, wkMentionsOf(txt, (WK.tasks.find(x => x.id === WKT.id) || {}).project_id)); if (r.error) { csave.disabled = false; return wkErr('wkTaskError', wkHint(r.error.message)); } wkErr('wkTaskError', ''); return wkLoadComments(); }
      const cdel = e.target.closest('[data-cmt-del]'); if (cdel) { const r = await LumaWork.comments.remove(cdel.dataset.cmtDel); if (r.error) wkErr('wkTaskError', r.error.message); return wkLoadComments(); }
      if (WKT.ro) return; const wh = e.target.closest('[data-who]'); if (wh) { const u = wh.dataset.who; WKT.who = WKT.who.includes(u) ? WKT.who.filter(x => x !== u) : [...WKT.who, u].slice(0, 10); return wkPaintWho(docEl('wkTaskProject').value); }
      const ts = e.target.closest('[data-ts]'); if (ts) { WKT.status = ts.dataset.ts; return wkPaintTask(); } const tp = e.target.closest('[data-tp]'); if (tp) { WKT.priority = tp.dataset.tp; wkPaintTask(); }
    };
    docEl('wkTaskProject').addEventListener('change', () => { const v = docEl('wkTaskProject').value; WKT.deps = []; wkPaintDeps(v); wkPaintWho(v); wkGrpPaintTask(v, ''); wkPaintFolder(v, null); docEl('wkTaskMoveNote').style.display = WKT.id && v !== WKT.project0 ? '' : 'none'; });
    const wkAddStep = () => { const v = docEl('wkTaskCheckNew').value.trim(); if (!v) return; if (WKT.list.length >= 30) return wkErr('wkTaskError', 'A checklist can have up to 30 steps.'); WKT.list.push({ t: v.slice(0, 120), d: false }); docEl('wkTaskCheckNew').value = ''; wkPaintTask(); docEl('wkTaskCheckNew').focus(); };
    docEl('wkTaskCheckAdd').onclick = wkAddStep; docEl('wkTaskCheckNew').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); wkAddStep(); } });
    docEl('wkTaskChecklist').addEventListener('click', e => { const row = e.target.closest('.tk-item'); if (!row || WKT.ro) return; const i = +row.dataset.i; if (e.target.closest('[data-tick]')) { WKT.list[i].d = !WKT.list[i].d; wkPaintTask(); } else if (e.target.closest('[data-rm]')) { WKT.list.splice(i, 1); wkPaintTask(); } });
    docEl('wkTaskChecklist').addEventListener('input', e => { const row = e.target.closest('.tk-item'); if (row && e.target.matches('[data-text]')) WKT.list[+row.dataset.i].t = e.target.value; });
    docEl('wkTaskSave').onclick = async () => {
      const title = docEl('wkTaskTitle').value.trim(); if (!title) return wkErr('wkTaskError', 'Give the task a name.');
      const f = { title, description: docEl('wkTaskDesc').value.trim(), status: WKT.status, priority: WKT.priority, folder_id: docEl('wkTaskFolder').value || null, budget_minutes: Math.round((parseFloat(docEl('wkTaskBudget').value) || 0) * 60) || null, assignee_ids: WKT.who, team_id: docEl('wkTaskGrp').value || null, start_date: docEl('wkTaskStart').value || null, due_date: docEl('wkTaskDue').value || null, checklist: WKT.list.filter(x => x.t.trim()).map(x => ({ t: x.t.trim(), d: !!x.d })) };
      if (f.start_date && f.due_date && f.start_date > f.due_date) return wkErr('wkTaskError', 'The start date can not be after the end date.');
      if (!WKT.id) f.project_id = docEl('wkTaskProject').value;
      const dest = docEl('wkTaskProject').value, moving = !!WKT.id && dest !== WKT.project0;
      if (moving && !await luConfirm({ title: 'Move this task?', message: `It moves to “${(wkProj(dest) || {}).name}”, with its comments, files and logged time. People who are not on that project are taken off the task.`, ok: 'Move', icon: 'fa-right-left', tone: 'info' })) return;
      sdBtn('wkTaskSave', true); wkErr('wkTaskError', '');
      if (moving) { const mv = await LumaWork.moveTask(WKT.id, dest); if (mv.error) { sdBtn('wkTaskSave', false, 'Save task'); return wkErr('wkTaskError', wkHint(mv.error.message)); } }
      const r = WKT.id ? await LumaWork.tasks.update(WKT.id, f) : await LumaWork.tasks.add(f); sdBtn('wkTaskSave', false, 'Save task');
      if (r.error) return wkErr('wkTaskError', /row-level security/i.test(r.error.message) ? 'You can\'t change tasks in this project (the Work add-on is needed, and viewers can only look).' : wkHint(r.error.message));
      sdClose('wkTaskOverlay'); if (moving) { await wkLoad(); wkPaint(); return flashToast('Task moved', `${title} → ${(wkProj(dest) || {}).name}`, 'fa-right-left', '#fb923c'); }
      const i = WK.tasks.findIndex(x => x.id === r.data.id); if (i >= 0) WK.tasks[i] = r.data; else { WK.tasks.push(r.data); WK.rawTasks.push(r.data); }
      if (JSON.stringify(WKT.deps.slice().sort()) !== JSON.stringify(WKT.deps0.slice().sort())) { const dr = await LumaWork.links.set(r.data.id, WKT.deps); if (dr.error) luAlert(/loop/.test(dr.error.message) ? 'The task was saved, but its links were not: ' + dr.error.message : 'The task was saved, but its links were not: ' + wkHint(dr.error.message)); else { WK.links = WK.links.filter(l => l.task_id !== r.data.id).concat(WKT.deps.map(d => ({ task_id: r.data.id, depends_on: d, project_id: r.data.project_id }))); } }
      wkPaint();
    };
    docEl('wkTaskDelete').onclick = async () => {
      const t = WK.tasks.find(x => x.id === WKT.id); if (!t) return;
      if (!await luConfirm({ title: `Delete “${t.title}”?`, message: 'This task is removed. This can\'t be undone.' })) return;
      const r = await LumaWork.tasks.remove(t.id); if (r.error) return wkErr('wkTaskError', r.error.message);
      WK.tasks = WK.tasks.filter(x => x !== t); sdClose('wkTaskOverlay'); wkPaint();
      luUndo('Task deleted', async () => { const { data, error } = await LumaWork.tasks.add({ project_id: t.project_id, title: t.title, description: t.description, status: t.status, priority: t.priority, folder_id: t.folder_id, assignee_ids: t.assignee_ids, start_date: t.start_date, due_date: t.due_date, checklist: t.checklist }); if (error) throw error; WK.tasks.push(data); wkPaint(); });
    };

    // ---------- the page: clicks and loading ----------
    async function wkMove(id, dir) {
      const t = WK.tasks.find(x => x.id === id); if (!t || !wkCanEdit(wkProj(t.project_id))) return; const i = WK_STATUS.findIndex(x => x[0] === t.status), n = WK_STATUS[i + dir]; if (!n) return;
      const before = t.status; t.status = n[0]; wkPaint(); const r = await LumaWork.tasks.update(id, { status: n[0] });
      if (r.error) { t.status = before; wkPaint(); return luAlert('Could not move the task: ' + r.error.message); } Object.assign(t, r.data); wkPaint();
    }
    WIRE.work = async function (pg) {
      pg.querySelector('#wkTabs').addEventListener('click', e => { const b = e.target.closest('[data-wktab]'); if (b) { WK.tab = b.dataset.wktab; wkPaint(); if (WK.tab === 'time') wkTimeRefresh(); } });
      pg.querySelector('#wkCo').addEventListener('click', () => goTo('company'));
      pg.querySelector('#wkRoot').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'wkSetupName') { e.preventDefault(); pg.querySelector('[data-wk-cosave]').click(); } });
      pg.querySelector('#wkAdd').addEventListener('click', () => WK.tab === 'projects' ? wkOpenProj(null) : WK.tab === 'time' ? wkTimeOpen(null) : WK.tab === 'teams' ? wkGrpOpen(null) : wkOpenTask(null));
      pg.querySelector('#wkRoot').addEventListener('click', async e => {
        const t = e.target;
        if (t.closest('[data-wk-co]')) return goTo('company');
        if (t.closest('[data-wktm-start]')) { const v = docEl('wkTimerFor').value; if (!v) return; if (await wkTimerStart(v, docEl('wkTimerNote').value.trim(), 'wkTimerErr')) wkTimePaint(); return; }
        if (t.closest('[data-wktm-stop]')) return wkTimerStop();
        if (t.closest('[data-wktm-pick]')) return void luDatePopup(t.closest('[data-wktm-pick]'), { value: WKTM.month + '-01', onPick: k => { WKTM.month = k.slice(0, 7); wkTimeRefresh(); } });
        const mo = t.closest('[data-wktm-mon]'); if (mo) { WKTM.month = wkMonthShift(WKTM.month, +mo.dataset.wktmMon); return wkTimeRefresh(); }
        if (t.closest('[data-wktm-csv]')) return wkTimesheetCsv();
        if (t.closest('[data-wktm-pdf]')) return wkTimesheetPdf();
        const te = t.closest('[data-wkte]'); if (te) return wkTimeOpen(WKTM.entries.find(x => x.id === te.dataset.wkte));
        if (t.closest('[data-wk-cosave]')) { const nm = docEl('wkSetupName').value.trim(); if (!nm) return (docEl('wkSetupErr').textContent = 'Type the company name first.'); const r = await LumaWork.companies.add(nm); if (r.error) return (docEl('wkSetupErr').textContent = /row-level security/i.test(r.error.message) ? 'The Work add-on is needed.' : wkHint(r.error.message)); wkSetCompany(r.data.id); await wkLoad(); wkPaint(); return flashToast('Company added', r.data.name, 'fa-building', '#fb923c'); }
        if (t.closest('[data-wk-newproj]')) return wkOpenProj(null);
        if (t.closest('[data-wk-get]')) return openAddon('work');
        const inv = t.closest('[data-wkinv]'); if (inv) { const [id, yes] = inv.dataset.wkinv.split('|'); const r = await LumaWork.respond(id, yes === '1'); if (r.error) return luAlert(r.error.message); await wkLoad(); wkPaint(); return flashToast(yes === '1' ? 'Joined the project' : 'Declined', '', 'fa-briefcase', '#fb923c'); }
        const mv = t.closest('[data-wkmv]'); if (mv) { const [id, d] = mv.dataset.wkmv.split('|'); return wkMove(id, +d); }
        const ed = t.closest('[data-wkedit]'); if (ed) return wkOpenProj(wkProj(ed.dataset.wkedit));
        const op = t.closest('[data-wkopen]'); if (op) { WK.project = op.dataset.wkopen; WK.tab = 'tasks'; WK.view = 'phases'; return wkPaint(); }
        const pr = t.closest('[data-wkproj]'); if (pr) { WK.project = pr.dataset.wkproj; WK.tab = 'tasks'; WK.view = 'phases'; return wkPaint(); }
        const vw = t.closest('[data-wkview]'); if (vw) { WK.view = vw.dataset.wkview; return wkPaint(); }
        if (t.closest('[data-wkteam]')) return wkTeamOpen(WK.project);
        if (t.closest('[data-wkics]')) {
          const sel = WK.project && wkProj(WK.project) ? WK.project : '', evs = [];
          WK.tasks.filter(x => x.due_date && x.status !== 'done' && (!sel || x.project_id === sel) && (!WK.mine || (x.assignee_ids || []).includes(wkMe()))).forEach(x => evs.push({ uid: 'luma-work-' + x.id, title: `${(wkProj(x.project_id) || {}).name || 'Work'}: ${x.title}`, date: x.start_date && x.start_date <= x.due_date ? x.start_date : x.due_date, endDate: x.due_date, allDay: true, desc: x.description || '' }));
          WK.projects.filter(p => p.deadline && p.status === 'active' && (!sel || p.id === sel)).forEach(p => evs.push({ uid: 'luma-work-p-' + p.id, title: 'Deadline: ' + p.name, date: p.deadline, allDay: true }));
          if (!evs.length) return luAlert('There are no open tasks with a due date to export.', 'Nothing to export');
          luIcs.download('LUMA-work.ics', luIcs.build(evs, 'LUMA Work')); return flashToast('Calendar file saved', `${evs.length} deadline${evs.length === 1 ? '' : 's'} · LUMA-work.ics`, 'fa-file-export', '#fb923c');
        }
        if (t.closest('[data-wkmine]')) { WK.mine = !WK.mine; return wkPaint(); }
        const fa = t.closest('[data-wkfaddt]'); if (fa) return wkOpenTask(null, { project: WK.project, folder: fa.dataset.wkfaddt });
        if (t.closest('[data-wkretry]')) { WK.loaded = false; wkPaint(); await wkLoad(); return wkPaint(); }
        const fo = t.closest('[data-wkfolder]'); if (fo) return wkOpenFolder(WK.folders.find(x => x.id === fo.dataset.wkfolder));
        if (t.closest('[data-wkfnew]')) return wkOpenFolder(null);
        const row = t.closest('.wk-card, .wk-row'); if (row) return wkOpenTask(WK.tasks.find(x => x.id === row.dataset.id));
        const pc = t.closest('.wk-pcard'); if (pc) { const p = wkProj(pc.dataset.id); if (p && p.owner_id === wkMe() && !wkArchived(p)) return wkOpenProj(p); WK.project = pc.dataset.id; WK.tab = 'tasks'; WK.view = 'phases'; wkPaint(); }
      });
      pg.querySelector('#wkRoot').addEventListener('change', e => { if (e.target.id === 'wkFilterProj') { WK.project = e.target.value; wkPaint(); } if (e.target.id === 'wkTimeCo') { WKTM.co = e.target.value; wkTimePaint(); } });
      wkPaint(); await wkLoad(); wkPaint();
    };

    // ---------- the Calendar and the Dashboard ----------
    async function wkEnsureLoaded() { if (!WK.loaded || Date.now() - WK.loadedAt > 60000) await wkLoad(); }
    const workVisibleOnCalendar = () => LumaPlan.hasAddon('work') && (LUMA_MODE === 'work' || prefOn('show_work_personal', false));
    // task deadlines (and project deadlines) of the company in view, on the day they fall due
    function workCalItems(k) {
      if (!workVisibleOnCalendar() || !WK.loaded || WK.err || (typeof cHidden !== 'undefined' && cHidden.has('Work tasks'))) return [];
      const out = [];
      // a task shows on every day from its start to its end date (a long one only on its first and last day); open tasks only
      WK.tasks.filter(t => t.status !== 'done' && (t.due_date || t.start_date)).forEach(t => {
        const end = t.due_date || t.start_date, start = t.start_date && t.start_date <= end ? t.start_date : end; if (k < start || k > end) return;
        const long = Math.round((Date.parse(end) - Date.parse(start)) / 864e5) > 31; if (long && k !== start && k !== end) return;
        const p = wkProj(t.project_id), one = start === end, label = (p ? p.name + ' · ' : '') + (one ? 'task due' : k === start ? 'task starts' : k === end ? 'task due' : 'task in progress');
        out.push({ type: 'wktask', id: t.id, title: t.title, color: p ? p.color : '#fb923c', cat: 'Work tasks', label, span: !one && k !== start && k !== end });
      });
      WK.projects.filter(p => p.deadline === k && p.status === 'active').forEach(p => out.push({ type: 'wktask', id: 'p:' + p.id, title: p.name, color: p.color, cat: 'Work tasks', label: 'Project deadline' }));
      return out;
    }
    // the Work card on the Personal Dashboard (shown once you choose to show Work in Personal; in Work mode the Overview tab is the home page)
    async function wkPaintDashCard() {
      const box = docEl('dashWork'); if (!box) return;
      if (!(LumaPlan.hasAddon('work') && prefOn('show_work_personal', false))) { box.style.display = 'none'; return; }
      box.style.display = '';
      if (!WK.loaded || Date.now() - WK.loadedAt > 60000) { box.querySelector('.wgt-sub') && (box.querySelector('.wgt-sub').textContent = 'Loading…'); await wkLoad(); }
      if (typeof wkTimeLoad === 'function' && !WKTM.loaded) await wkTimeLoad();
      if (WK.err) { docEl('dashWorkBody').innerHTML = `<div class="wgt-sub">${escapeHtml(wkHint(WK.err))}</div>`; return; }
      const today = wkToday(), me = wkMe(), mine = WK.tasks.filter(t => t.status !== 'done' && (t.assignee_ids || []).includes(me));
      const over = mine.filter(t => t.due_date && t.due_date < today), due = mine.filter(t => t.due_date === today), next = [...over, ...due, ...mine.filter(t => t.due_date > today).sort((a, b) => a.due_date.localeCompare(b.due_date))].slice(0, 4);
      const mins = WKTM.entries.filter(e => e.work_date === today).reduce((a, e) => a + e.minutes, 0), co = wkCoOf(WK.company);
      docEl('dashWorkSub').textContent = co ? co.name : '';
      docEl('dashWorkBody').innerHTML = `<div class="dw-stats"><div class="${over.length ? 'bad' : ''}"><b>${over.length}</b><span>Overdue</span></div><div><b>${due.length}</b><span>Due today</span></div><div><b>${mine.length}</b><span>Yours, open</span></div><div data-dw-time><b>${wkDur(mins)}</b><span>${WKTM.running ? 'Timer running' : 'Logged today'}</span></div></div>`
        + (next.length ? next.map(t => { const du = wkDue(t); return `<div class="dw-row" data-dw-task="${t.id}"><span class="dw-dot" style="background:${(wkProj(t.project_id) || {}).color || '#fb923c'}"></span><b>${escapeHtml(t.title)}</b><small class="${du && du.cls}">${du ? escapeHtml(du.text) : 'no date'}</small></div>`; }).join('') : '<div class="wgt-sub">Nothing is waiting for you. Enjoy the quiet.</div>');
    }
    document.addEventListener('click', e => {
      const card = e.target.closest('#dashWork'); if (!card) return;
      const t = e.target.closest('[data-dw-task]'); if (t) return wkOpenFromSearch({ kind: 'task', id: t.dataset.dwTask });
      if (e.target.closest('[data-dw-time]')) { WK.tab = 'time'; return goTo('work'); }
      if (e.target.closest('[data-dw-open]')) return goTo('work');
    });

    // ---------- search (Work mode): projects, tasks, and the notes inside phases and folders ----------
    async function workSearchItems() {
      if (!(LUMA_MODE === 'work' && (wkHas() || LumaPlan.guestWork))) return [];
      if (!WK.loaded) await wkLoad(); if (WK.err) return [];
      const out = [], pn = id => (WK.rawProjects.find(p => p.id === id) || {}).name || '';
      WK.rawProjects.forEach(p => out.push({ type: 'work', raw: { kind: 'project', id: p.id }, title: p.name, sub: 'Work project' + (p.client ? ' · ' + p.client : ''), hay: [p.name, p.client, p.description].join(' ') }));
      WK.rawTasks.forEach(t => out.push({ type: 'work', raw: { kind: 'task', id: t.id }, title: t.title, sub: `Work task · ${pn(t.project_id)}${t.status === 'done' ? ' · done' : t.due_date ? ' · due ' + wkFmt(t.due_date) : ''}`, hay: [t.title, t.description, pn(t.project_id)].join(' ') }));
      WK.folders.forEach(f => out.push({ type: 'work', raw: { kind: 'folder', id: f.id }, title: f.name, sub: `${f.is_phase ? 'Phase' : 'Folder'} · ${pn(f.project_id)}`, hay: [f.name, f.notes, pn(f.project_id)].join(' ') }));
      return out;
    }
    async function wkOpenFromSearch(r) {
      if (!WK.loaded) await wkLoad();
      const t = r.kind === 'task' ? WK.rawTasks.find(x => x.id === r.id) : null, f = r.kind === 'folder' ? WK.folders.find(x => x.id === r.id) : null;
      const p = WK.rawProjects.find(x => x.id === (t ? t.project_id : f ? f.project_id : r.id)); if (!p) return;
      if (p.owner_id === wkMe() && p.company_id !== WK.company) { wkSetCompany(p.company_id); await wkLoad(); }
      WK.tab = 'tasks'; WK.project = p.id; WK.mine = false; WK.view = t ? 'list' : 'phases'; goTo('work');
      for (let i = 0; i < 30 && !(WK.loaded && docEl('wkRoot') && WK.tab === 'tasks'); i++) await new Promise(res => setTimeout(res, 100));
      await new Promise(res => setTimeout(res, 300));
      if (t) { const x = WK.tasks.find(y => y.id === t.id); if (x) wkOpenTask(x); } else if (f) { const x = WK.folders.find(y => y.id === f.id); if (x) wkOpenFolder(x); }
    }

    // ---------- people who were only added to a project can still open Work (read-only) ----------
    async function wkCheckGuest() {
      if (LumaPlan.hasAddon('work') || typeof LumaWork === 'undefined') return;
      try { const r = await LumaWork.shared(); LumaPlan.guestWork = !r.error && (r.data || []).some(s => s.owner_id !== wkMe()); applyModeMenus(); } catch (e) { }
    }
    // notifications: "X gave you a task" opens that task; "X added you to a project" opens Projects
    LU_FOCUS_HOOKS.work = (ref, type, tries) => {
      if (!WK.loaded) return;
      if (type === 'work_comment' || type === 'work_mention' || type === 'work_budget') { const t = WK.tasks.find(x => x.id === ref); if (t) { if (WK.tab !== 'tasks' || WK.project !== t.project_id) { WK.tab = 'tasks'; WK.project = t.project_id; WK.mine = false; wkPaint(); } if (!docEl('wkTaskOverlay').classList.contains('open')) wkOpenTask(t); } }
      else if (type === 'work_task') { const t = WK.tasks.find(x => x.id === ref); if (t && (WK.tab !== 'tasks' || WK.project !== t.project_id)) { WK.tab = 'tasks'; WK.project = t.project_id; WK.mine = false; wkPaint(); } }
      else if (type === 'reminder_work') { const t = WK.tasks.find(x => x.id === ref); if (t && (WK.tab !== 'tasks' || WK.project !== t.project_id)) { WK.tab = 'tasks'; WK.project = t.project_id; WK.mine = false; wkPaint(); } }
      else if (type === 'work_team') { WK.tab = wkHas() ? 'teams' : 'projects'; wkPaint(); }
      else if ((type === 'work_invite' || type === 'work_reply') && WK.tab !== 'projects' && WK.tab !== 'overview') { WK.tab = wkHas() ? 'projects' : 'projects'; wkPaint(); }
    };
