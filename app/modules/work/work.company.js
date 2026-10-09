// LUMA — module: company (the Company page in Work mode)
    // The companies you work for. Several can be active at once; the one you open in Work is the one in view.
    // Archiving a company keeps everything (projects, tasks, notes) readable but frozen; restore it to carry on. Tables: migration 074.
    const WKC = { id: null };

    MODULES.company = function () {
      return head('Company', '<span id="wkcSub">Loading…</span>', '<button type="button" class="create-btn" id="wkcAdd"><i class="fa-solid fa-plus"></i> New company</button>')
        + '<div id="wkcRoot"><div class="ls" style="padding:10px 2px">Loading…</div></div>';
    };

    const wkCoLimit = () => { const v = LumaPlan.get('work_companies'); return v == null ? 5 : v; };
    function wkcPaint() {
      const root = docEl('wkcRoot'), sub = docEl('wkcSub'); if (!root) return;
      if (WK.err) { sub.textContent = 'Could not load'; root.innerHTML = card(`<div class="ls">${escapeHtml(wkHint(WK.err))}</div>`); return; }
      const act = WK.companies.filter(c => !c.archived_at), arc = WK.companies.filter(c => c.archived_at);
      sub.textContent = `${act.length} active${arc.length ? ' · ' + arc.length + ' archived' : ''} · ${WK.companies.length} of ${wkCoLimit()} used`;
      const stat = c => { const ps = WK.rawProjects.filter(p => p.owner_id === wkMe() && p.company_id === c.id), ids = new Set(ps.map(p => p.id)), ts = WK.rawTasks.filter(t => ids.has(t.project_id));
        return { p: ps.length, open: ts.filter(t => t.status !== 'done').length, done: ts.filter(t => t.status === 'done').length }; };
      const dmy = k => new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
      const span = c => c.start_date || c.end_date ? `<span class="wk-coc-d"><i class="fa-regular fa-calendar"></i> ${c.start_date ? dmy(c.start_date) : '…'} → ${c.end_date ? dmy(c.end_date) : 'now'}</span>` : '';
      const since = c => new Date(c.archived_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const row = c => { const s = stat(c), arch = !!c.archived_at, cur = c.id === WK.company;
        return `<div class="card wk-coc ${arch ? 'off' : ''}" data-co="${c.id}"><div class="wk-coc-h"><span class="wk-coc-i"><i class="fa-regular fa-building"></i></span><div class="wk-coc-n"><b>${escapeHtml(c.name)}</b>${c.position ? `<span class="wk-coc-p">${escapeHtml(c.position)}</span>` : ''}<small>${s.p} project${s.p === 1 ? '' : 's'} · ${s.open} open task${s.open === 1 ? '' : 's'}${arch ? ' · archived ' + since(c) : ''}</small>${span(c)}</div>${cur && !arch ? '<span class="wk-coc-cur">In view</span>' : ''}</div>
          <div class="wk-coc-b">${arch
            ? `<button type="button" class="np-btn" data-coview="${c.id}"><i class="fa-regular fa-eye"></i> View</button><button type="button" class="np-btn" data-coedit="${c.id}"><i class="fa-solid fa-pen"></i> Edit</button><button type="button" class="np-btn" data-corestore="${c.id}"><i class="fa-solid fa-rotate-left"></i> Restore</button><button type="button" class="np-btn danger" data-codel="${c.id}" title="Delete" aria-label="Delete"><i class="fa-regular fa-trash-can"></i></button>`
            : `<button type="button" class="np-btn" data-coview="${c.id}"><i class="fa-solid fa-arrow-right"></i> ${cur ? 'Open in Work' : 'Switch to this'}</button><button type="button" class="np-btn" data-coedit="${c.id}"><i class="fa-solid fa-pen"></i> Edit</button><button type="button" class="np-btn" data-coarch="${c.id}"><i class="fa-solid fa-box-archive"></i> Archive</button>`}</div></div>`; };
      root.innerHTML = (act.length ? `<div class="grid-2">${act.map(row).join('')}</div>` : card('<div class="h-empty"><div class="h-empty-ico"><i class="fa-regular fa-building"></i></div><div class="h-empty-t">No active company</div><div class="h-empty-s">Add a company to start using Work, or restore an archived one below.</div></div>'))
        + (arc.length ? `<div class="sd-gh" style="margin-top:18px"><b>Archived</b><span>${arc.length}</span></div><div class="grid-2">${arc.map(row).join('')}</div>` : '')
        + `<div class="ls" style="font-size:0.75rem;line-height:1.5;margin-top:14px">Your ${LumaPlan.addonName('work')} add-on allows up to ${wkCoLimit()} companies in total${LumaPlan.workTier() === 'pro' ? '' : ' (Work Pro allows 20)'}. It is the same on every plan. Active and archived ones both count, so delete an archived company if you need the place back. You can work for several companies at once. Archiving one keeps all its projects, tasks and notes so you can look at them later, but nothing in it can be changed until you restore it.</div>`;
    }
    function wkcOpen(c) {
      WKC.id = c ? c.id : null; docEl('wkCoHead').textContent = c ? 'Edit company' : 'New company'; docEl('wkCoName').value = c ? c.name : ''; docEl('wkCoStart').value = c && c.start_date ? c.start_date : ''; docEl('wkCoEnd').value = c && c.end_date ? c.end_date : ''; docEl('wkCoPos').value = c ? c.position || '' : ''; ['wkCoStart', 'wkCoEnd'].forEach(i => docEl(i)._luDateRefresh && docEl(i)._luDateRefresh()); docEl('wkCoError').textContent = ''; docEl('wkCoLimitNote').textContent = `Your ${LumaPlan.addonName('work')} add-on allows up to ${wkCoLimit()} companies in total${LumaPlan.workTier() === 'pro' ? '' : ' (Work Pro allows 20)'}: active and archived ones both count, so delete an archived company to free a place.`; docEl('wkCoError').classList.remove('show');
      sdOpen('wkCoOverlay'); setTimeout(() => docEl('wkCoName').focus(), 50);
    }
    docEl('wkCoClose').onclick = () => sdClose('wkCoOverlay'); docEl('wkCoOverlay').onclick = e => { if (e.target === docEl('wkCoOverlay')) sdClose('wkCoOverlay'); };
    docEl('wkCoName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); docEl('wkCoSave').click(); } });
    docEl('wkCoSave').onclick = async () => {
      const name = docEl('wkCoName').value.trim(); if (!name) return wkErr('wkCoError', 'Give the company a name.');
      const f = { name, position: docEl('wkCoPos').value.trim(), start_date: docEl('wkCoStart').value || null, end_date: docEl('wkCoEnd').value || null };
      if (f.start_date && f.end_date && f.start_date > f.end_date) return wkErr('wkCoError', 'The start date can not be after the end date.');
      sdBtn('wkCoSave', true); const r = WKC.id ? await LumaWork.companies.update(WKC.id, f) : await LumaWork.companies.add(f); sdBtn('wkCoSave', false, 'Save');
      if (r.error) return wkErr('wkCoError', /allows up to \d+ companies/.test(r.error.message) ? r.error.message + '. Delete an archived one, or upgrade in Settings → your plan.' : /dates_check/.test(r.error.message) ? 'The start date can not be after the end date.' : /row-level security/i.test(r.error.message) ? 'The Work add-on is needed to change companies.' : wkHint(r.error.message));
      const i = WK.companies.findIndex(x => x.id === r.data.id); if (i >= 0) WK.companies[i] = r.data; else { WK.companies.push(r.data); if (!WK.company || (wkCoOf(WK.company) || {}).archived_at) wkSetCompany(r.data.id); }
      sdClose('wkCoOverlay'); wkcPaint(); flashToast(WKC.id ? 'Company saved' : 'Company added', name, 'fa-building', '#fb923c');
    };
    async function wkcSet(id, f) { const r = await LumaWork.companies.update(id, f); if (r.error) { luAlert(wkHint(r.error.message)); return false; } const i = WK.companies.findIndex(x => x.id === id); if (i >= 0) WK.companies[i] = r.data; return true; }

    WIRE.company = async function (pg) {
      pg.querySelector('#wkcAdd').addEventListener('click', () => wkcOpen(null));
      pg.querySelector('#wkcRoot').addEventListener('click', async e => {
        const t = e.target, get = k => { const b = t.closest('[data-' + k + ']'); return b ? WK.companies.find(c => c.id === b.dataset[k]) : null; };
        let c;
        if ((c = get('coview'))) { wkSetCompany(c.id); WK.tab = c.archived_at ? 'projects' : WK.tab === 'overview' || !WK.tab ? 'overview' : WK.tab; WK.project = ''; return goTo('work'); }
        if ((c = get('coedit'))) return wkcOpen(c);
        if ((c = get('coarch'))) {
          if (!await luConfirm({ title: `Archive “${c.name}”?`, message: 'All its projects, tasks and notes are kept and can be looked at any time, but nothing in it can be changed until you restore it. Your other companies are not affected.', ok: 'Archive', icon: 'fa-box-archive', tone: 'info' })) return;
          if (!await wkcSet(c.id, { archived_at: new Date().toISOString(), end_date: c.end_date || mytDayKey(Date.now()) })) return;
          if (WK.company === c.id) wkSetCompany((wkCoActive()[0] || {}).id || ''); wkcPaint(); return flashToast('Company archived', c.name, 'fa-box-archive', '#fb923c');
        }
        if ((c = get('corestore'))) { if (!await wkcSet(c.id, { archived_at: null, end_date: null })) return; wkcPaint(); return flashToast('Company restored', c.name, 'fa-rotate-left', '#34d399'); }
        if ((c = get('codel'))) {
          const n = WK.rawProjects.filter(p => p.owner_id === wkMe() && p.company_id === c.id).length;
          if (!await luConfirm({ title: `Delete “${c.name}” for good?`, message: `This deletes the company${n ? ` and its ${n} project${n === 1 ? '' : 's'}, with every task and note` : ''}. This can't be undone. (Archived is safer if you may want to look at it again.)`, ok: 'Delete' })) return;
          const r = await LumaWork.companies.remove(c.id); if (r.error) return luAlert(r.error.message);
          WK.companies = WK.companies.filter(x => x !== c); WK.rawProjects = WK.rawProjects.filter(p => p.company_id !== c.id); if (WK.company === c.id) wkSetCompany((wkCoActive()[0] || {}).id || ''); wkcPaint();
        }
      });
      wkcPaint(); await wkLoad(); wkcPaint();
    };
