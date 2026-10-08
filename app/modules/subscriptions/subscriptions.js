// LUMA — module: subscriptions
      // ---------------- SUBSCRIPTIONS ----------------
    MODULES.subscriptions = function () {
        return head('Subscriptions', '<span id="subsSub">Loading…</span>', '<button class="create-btn" id="addSubBtn"><i class="fa-solid fa-plus"></i> Add subscription</button>') +
          '<div id="subsRoot"></div>';
    };

    // ---------- Subscriptions: bills in the 'Subscription' category, so they appear on both pages ----------
    const S_TYPES = [['Streaming', 'fa-film', '#f87171'], ['Music', 'fa-music', '#4ade80'], ['Storage', 'fa-cloud', '#60a5fa'], ['Creative', 'fa-pen-nib', '#f472b6'], ['AI', 'fa-robot', '#a78bfa'], ['Productivity', 'fa-file-lines', '#cbd5e1'], ['Gaming', 'fa-gamepad', '#fb923c'], ['Other', 'fa-repeat', '#94a3b8']];
    const S_PRESETS = [
      { name: 'Netflix', note: 'Streaming' }, { name: 'Spotify', note: 'Music' }, { name: 'YouTube Premium', note: 'Streaming' }, { name: 'iCloud+', note: 'Storage' },
      { name: 'ChatGPT Plus', note: 'AI' }, { name: 'Adobe CC', note: 'Creative' }, { name: 'Notion', note: 'Productivity' }, { name: 'Disney+', note: 'Streaming' },
    ];
    let sTab = 'active'; // Active / Inactive filter pills
    let sHi = false; // 'Renews soon' tapped: highlight the subscriptions renewing within 7 days
    const sType = b => S_TYPES.find(t => t[0].toLowerCase() === (b.note || '').trim().toLowerCase()) || S_TYPES[S_TYPES.length - 1];
    const sList = () => BILLS.filter(b => b.category === 'Subscription');
    const sMonthly = b => b.recurrence === 'yearly' ? b.amount / 12 : b.recurrence === 'weekly' ? b.amount * 52 / 12 : b.amount; // monthly cost
    function bNext(b, today) { // the next renewal / due date on or after today (null if a one-off has passed)
      if (b.recurrence === 'once') return b.due_date >= today ? b.due_date : null;
      if (b.recurrence === 'weekly') return b.due_date >= today ? b.due_date : bAddDays(b.due_date, Math.ceil(bDays(today, b.due_date) / 7) * 7);
      for (let k = 0; k < 14; k++) { const d = bCycle(b, bAddMonths(bFirst(today), k)); if (d && d >= today) return d; }
      return null;
    }

    function paintSubs() {
      const root = docEl('subsRoot'), sub = docEl('subsSub'); if (!root) return;
      if (BILLS_ERR) {
        sub.textContent = 'Could not load subscriptions';
        root.innerHTML = card('<div class="ls">Has <b>supabase/migrations/020_bills.sql</b> been run in the Supabase SQL Editor?</div>');
        return;
      }
      const all = sList();
      if (!all.length) {
        sub.textContent = 'Keep track of what renews';
        root.innerHTML = card(`<div class="h-empty">
          <div class="h-empty-ico"><i class="fa-solid fa-repeat"></i></div>
          <div class="h-empty-t">Add your first subscription</div>
          <div class="h-empty-s">Track what you pay for each month or year and when it renews. Subscriptions also show up on your <b>Bills</b> page, so you can tick them off when paid. Start from a popular one or tap <b>Add subscription</b>.</div>
          <div class="h-empty-chips">${S_PRESETS.map((p, i) => `<button type="button" class="h-chip" data-spreset="${i}"><i class="fa-solid ${sType(p)[1]}" style="color:${sType(p)[2]}"></i>${p.name}</button>`).join('')}</div>
        </div>`);
        return;
      }
      const today = mytDayKey(Date.now()), active = all.filter(b => b.active !== false);
      const monthly = active.reduce((t, b) => t + sMonthly(b), 0);
      const soon = active.filter(b => { const n = bNext(b, today); return n && bDays(n, today) <= 7; }).length;
      sub.textContent = `${active.length} active · ${bRM(monthly)}/mo`;
      const cardOf = b => {
        const [, icon, col] = sType(b), n = bNext(b, today), d = n ? bDays(n, today) : null, on = b.active !== false;
        const isSoon = on && n != null && d <= 7;
        const [pc, pt] = !on ? ['', 'Paused'] : n == null ? ['', 'Ended'] : d === 0 ? ['pill-med', 'Renews today'] : [d <= 7 ? 'pill-med' : 'pill-blue', `Renews ${d} day${d === 1 ? '' : 's'}`];
        return card(`<div class="s-top"><div class="licon" style="color:${col};background:${col}22"><i class="fa-solid ${icon}"></i></div><div style="flex:1;min-width:0"><div class="lt">${escapeHtml(b.name)}</div><div class="ls">${escapeHtml((b.note || '').trim() || 'Subscription')}</div></div>
          <button type="button" class="hedit s-edit" title="Edit"><i class="fa-solid fa-pen"></i></button><button type="button" class="switch s-toggle ${on ? 'on' : ''}" title="${on ? 'Pause' : 'Resume'}"><span class="knob"></span></button></div>
          <div class="s-bottom"><div><div class="m-value" style="font-size:1.2rem;color:#fff">${bRM(b.amount)}</div><div class="ls">${b.recurrence === 'yearly' ? 'Yearly' : b.recurrence === 'weekly' ? 'Weekly' : b.recurrence === 'once' ? 'One-off' : 'Monthly'}</div></div><span class="pill ${pc}" style="${pc ? '' : 'color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.08)'}">${pt}</span></div>`, `s-card ${on ? '' : 'paused'} ${sHi && isSoon ? 'soon' : ''} ${sHi && !isSoon ? 'dim' : ''}" data-id="${b.id}`);
      };
      const byRenewal = (a, c) => (bNext(a, today) || '9999').localeCompare(bNext(c, today) || '9999');
      const live = all.filter(b => b.active !== false).sort(byRenewal), paused = all.filter(b => b.active === false).sort((a, c) => a.name.localeCompare(c.name));
      const shown = sTab === 'inactive' ? paused : live;
      root.innerHTML = `<div class="grid-4" style="margin-bottom:0.9rem">${[['Monthly total', bRM(monthly)], ['Yearly est.', bRM(monthly * 12)], ['Active', active.length], ['Renews soon', soon]].map(m => m[0] === 'Renews soon' ? card(`<div class="metric"><div class="m-label" style="color:#fff">${m[0]}${soon ? ' <span style="text-transform:none;letter-spacing:0;font-weight:400;color:rgba(255,255,255,0.45)">· tap to ' + (sHi ? 'click anywhere to clear' : 'highlight') + '</span>' : ''}</div><div class="m-value">${m[1]}</div></div>`, `s-clickable ${sHi ? 'on' : ''}" title="Highlight the subscriptions renewing within 7 days`) : card(`<div class="metric"><div class="m-label" style="color:#fff">${m[0]}</div><div class="m-value">${m[1]}</div></div>`)).join('')}</div>
        <div class="g-tabs"><button type="button" data-stab="active" class="${sTab === 'active' ? 'on' : ''}">Active (${live.length})</button><button type="button" data-stab="inactive" class="${sTab === 'inactive' ? 'on' : ''}">Inactive (${paused.length})</button></div>
        <div class="s-list">${shown.length ? `<div class="grid-3">${shown.map(cardOf).join('')}</div>` : `<div class="ls" style="padding:24px 4px;text-align:center">${sTab === 'active' ? 'No active subscriptions.' : 'No inactive subscriptions — paused ones will show up here.'}</div>`}</div>`;
    }

    async function toggleSubscription(b) {
      const was = b.active !== false;
      b.active = !was; paintSubs(); paintBills(); // optimistic
      const { error } = await LumaBills.update(b.id, { active: !was });
      if (error) { b.active = was; paintSubs(); paintBills(); luAlert(/active|schema cache/i.test(error.message) ? 'Pausing needs one more database step — run supabase/migrations/021_bill_active.sql in the SQL Editor.' : 'Could not save: ' + error.message); }
    }

    async function loadSubs(pg) {
      sHi = false; sTab = 'active';
      // while the yellow highlight is on, a click anywhere else on the page clears it (the Renews soon card itself toggles it)
      if (!window._sHiBound) { window._sHiBound = true; document.addEventListener('click', e => { if (sHi && docEl('subsRoot') && !e.target.closest('.s-clickable')) { sHi = false; paintSubs(); } }); }
      pg.querySelector('#addSubBtn').addEventListener('click', () => openBillModal(null, { category: 'Subscription', recurrence: 'monthly' }, 'sub'));
      pg.querySelector('#subsRoot').addEventListener('click', e => {
        const stab = e.target.closest('[data-stab]'); if (stab) { sTab = stab.dataset.stab; sHi = false; return paintSubs(); }
        if (e.target.closest('.s-clickable')) {
          sHi = !sHi; if (sHi) sTab = 'active'; paintSubs();
          if (sHi) { const first = pg.querySelector('.s-card.soon'); if (first) first.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
          return;
        }
        const pre = e.target.closest('[data-spreset]'); if (pre) { const p = S_PRESETS[+pre.dataset.spreset]; return openBillModal(null, { ...p, category: 'Subscription', recurrence: 'monthly' }, 'sub'); }
        const c = e.target.closest('.s-card'); if (!c) return;
        const b = BILLS.find(x => x.id === c.dataset.id); if (!b) return;
        if (e.target.closest('.s-edit')) return openBillModal(b, null, 'sub');
        if (e.target.closest('.s-toggle')) toggleSubscription(b);
      });
      paintSubs();
      await loadBillsData(); paintSubs();
    }


    WIRE.subscriptions = function (pg) { return loadSubs(pg); };
