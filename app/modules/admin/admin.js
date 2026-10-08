// LUMA — module: admin
      // ---------------- ADMIN ----------------
    MODULES.admin = function () {
        return head('Admin', '<span id="admSub">Loading…</span>') + '<div id="admRoot"><div class="ls" style="padding:10px 2px">Loading…</div></div>';
    };

    // =====================================================
    //  ADMIN — see every account and change anyone's plan (super admin only; enforced by the database)
    // =====================================================
    async function loadAdmin(pg) {
      const root = pg.querySelector('#admRoot'), sub = pg.querySelector('#admSub');
      if (!LumaPlan.admin) { sub.textContent = 'Not allowed'; root.innerHTML = card('<div class="ls">This page is only for administrators.</div>'); return; }
      const db = () => LumaAuth.client.schema('luma'), ago = iso => { if (!iso) return 'never'; const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };
      root.innerHTML = '<div class="adm-stats" id="admStats"></div><div id="admReport"></div><div class="adm-search"><i class="fa-solid fa-search"></i><input id="admSearch" type="text" placeholder="Search by name or email…" autocomplete="off"></div><div id="admList"><div class="ls" style="padding:10px 2px">Loading…</div></div>';
      const stats = async () => { const { data } = await db().rpc('admin_stats'); if (!data) return; sub.textContent = `${data.total} account${data.total === 1 ? '' : 's'} · ${data.new_7d} new this week`; document.getElementById('admStats').innerHTML = [['Accounts', data.total], ['Dawn', data.dawn], ['Glow', data.glow], ['Zenith', data.zenith], ['New in 7 days', data.new_7d]].map(([l, v]) => `<div class="adm-stat"><div class="l">${l}</div><div class="v">${v}</div></div>`).join(''); };
      const list = async () => {
        const box = document.getElementById('admList'), q = document.getElementById('admSearch').value.trim();
        const { data, error } = await db().rpc('admin_list_users', { p_search: q, p_limit: 200 });
        if (error) { box.innerHTML = card(`<div class="ls">Could not load accounts: ${escapeHtml(error.message)}. Has <b>supabase/migrations/036_admin.sql</b> been run?</div>`); return; }
        box.innerHTML = (data || []).length ? data.map(u => {
          const nm = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email, me = LUMA_USER && u.id === LUMA_USER.id;
          return `<div class="adm-row" data-id="${u.id}"><div class="adm-av">${escapeHtml((nm[0] || '?').toUpperCase())}</div>
            <div style="min-width:0"><div class="adm-name">${escapeHtml(nm)}${u.is_admin ? '<span class="b">Admin</span>' : ''}${me ? '<span class="b" style="background:rgba(59,130,246,0.2);color:#93c5fd">You</span>' : ''}${u.email_confirmed_at ? '' : '<span class="u">Unverified</span>'}</div><div class="adm-sub">${escapeHtml(u.email)}${u.country ? ' · ' + escapeHtml(u.country) : ''}</div></div>
            <div class="adm-meta">Joined ${ago(u.created_at)}<br>Last seen ${ago(u.last_sign_in_at)}</div>
            <div class="adm-plan"><button type="button" class="adm-planbtn ${admEndClass(u.plan !== 'dawn' && u.plan_expires_at)}" data-plan-open><b>${LumaPlan.NAMES[u.plan]}</b><small>${u.plan === 'dawn' ? 'free' : admEndText(u.plan_expires_at)}</small></button><div class="adm-addons">${['work', 'study'].map(k => { const on = (u.addons || []).includes(k), ex = (u.addon_expiry || {})[k]; return `<button type="button" data-addon="${k}" class="${on ? 'on' : ''} ${on ? admEndClass(ex) : ''}" title="${LumaPlan.ADDON_NAMES[k]} add-on${on ? ' · ' + admEndText(ex) : ''}">${LumaPlan.ADDON_NAMES[k]}${on && ex ? `<small>${admShort(ex)}</small>` : ''}</button>`; }).join('')}</div></div></div>`;
        }).join('') : '<div class="ls" style="padding:14px 2px">No accounts match.</div>';
        ADM_USERS = Object.fromEntries((data || []).map(u => [u.id, u]));
      };
      // a plan or an add-on is changed in a popup: what, for how long, and whether to ADD time to what is left
      document.getElementById('admList').addEventListener('click', e => {
        const row = e.target.closest('.adm-row'); if (!row) return; const u = ADM_USERS[row.dataset.id]; if (!u) return;
        const ab = e.target.closest('.adm-addons button'); if (ab) return admOpen(u, 'addon', ab.dataset.addon);
        if (e.target.closest('[data-plan-open]')) admOpen(u, 'plan');
      });
      ADM_AFTER = async (id, own) => { await Promise.all([list(), stats()]); if (own) { await LumaPlan.load(); Object.keys(rendered).forEach(k => { if (k !== 'admin') delete rendered[k]; }); await enforceModeAccess(); flashToast('Your own plan or add-ons changed', 'The app now follows them', 'fa-user-shield', '#3b82f6'); } };
      let t = null; document.getElementById('admSearch').addEventListener('input', () => { clearTimeout(t); t = setTimeout(list, 300); });
      // the monthly report lives on its own page (opened from here)
      const report = async () => {
        document.getElementById('admReport').innerHTML = card(`<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div class="rp-ico" style="--c:#60a5fa"><i class="fa-solid fa-chart-column"></i></div><div style="flex:1;min-width:200px"><div style="color:#fff;font-weight:600;font-size:0.9rem">Plan report</div><div class="ls" style="margin-top:2px">People on each plan month by month, with a chart, a month and date range, and a CSV download.</div></div><button type="button" class="create-btn" id="admOpenReport">View report <i class="fa-solid fa-arrow-right"></i></button></div>`);
        document.getElementById('admOpenReport').onclick = () => goTo('adminreport');
      };
      await Promise.all([stats(), report(), list()]);
    }


    // ---------- change a plan / add-on, with how long it runs ----------
    let ADM_USERS = {}, ADM_AFTER = null;
    const ADM = { kind: 'plan', user: null, addon: 'work', plan: 'glow', on: true, dur: '1', until: '', extend: true };
    const admShort = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const admDaysLeft = iso => Math.ceil((Date.parse(iso) - Date.now()) / 864e5);
    const admEndText = iso => { if (!iso) return 'no end date'; const d = admDaysLeft(iso); return d < 0 ? 'ended ' + admShort(iso) : d === 0 ? 'ends today' : `until ${admShort(iso)} (${d} day${d === 1 ? '' : 's'})`; };
    const admEndClass = iso => !iso ? '' : admDaysLeft(iso) <= 7 ? 'soon' : '';
    const admAddMonths = (base, n) => { const d = new Date(base), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return d; };
    const admCur = () => ADM.kind === 'plan' ? { plan: ADM.user.plan, end: ADM.user.plan_expires_at } : { on: (ADM.user.addons || []).includes(ADM.addon), end: (ADM.user.addon_expiry || {})[ADM.addon] };
    // when it will end if applied now
    function admResult() {
      const cur = admCur(), paid = ADM.kind === 'plan' ? ADM.plan !== 'dawn' : ADM.on;
      if (!paid) return { end: null, text: ADM.kind === 'plan' ? 'The free plan has no end date.' : 'The add-on is switched off.' };
      if (ADM.dur === 'none') return { end: null, text: 'No end date: it stays until you change it.' };
      if (ADM.dur === 'date') return ADM.until ? { end: ADM.until, text: `It runs until the end of ${admShort(ADM.until + 'T00:00:00')}.` } : { end: null, bad: true, text: 'Pick the last day.' };
      const n = +ADM.dur, same = ADM.kind === 'plan' ? ADM.plan === cur.plan : cur.on, left = cur.end && admDaysLeft(cur.end) > 0, base = ADM.extend && same && left ? new Date(cur.end) : new Date();
      const end = admAddMonths(base, n); return { end, months: n, text: `It runs until ${admShort(end)}${ADM.extend && same && left ? ` (${admShort(cur.end)} + ${n} month${n === 1 ? '' : 's'})` : ` (${n} month${n === 1 ? '' : 's'} from today)`}.` };
    }
    function admPaint() {
      const plan = ADM.kind === 'plan', cur = admCur(), paid = plan ? ADM.plan !== 'dawn' : ADM.on;
      docEl('admPlanPlanF').style.display = plan ? '' : 'none'; docEl('admPlanOnF').style.display = plan ? 'none' : '';
      if (plan) sdChips('admPlanPlan', ['dawn', 'glow', 'zenith'].map(p => [p, LumaPlan.NAMES[p] + (cur.plan === p ? ' (now)' : ''), '']), ADM.plan, 'ap');
      else sdChips('admPlanOn', [['yes', 'On', 'fa-bolt'], ['no', 'Off', 'fa-power-off']], ADM.on ? 'yes' : 'no', 'ao');
      docEl('admPlanDurF').style.display = paid ? '' : 'none';
      sdChips('admPlanDur', [['1', '1 month', ''], ['3', '3 months', ''], ['6', '6 months', ''], ['12', '12 months', ''], ['date', 'Until a date', ''], ['none', 'No end', '']], ADM.dur, 'ad');
      docEl('admPlanUntilW').style.display = paid && ADM.dur === 'date' ? '' : 'none';
      const same = plan ? ADM.plan === cur.plan : cur.on, canExt = paid && same && cur.end && admDaysLeft(cur.end) > 0 && !['date', 'none'].includes(ADM.dur);
      docEl('admPlanExtF').style.display = canExt ? '' : 'none';
      if (canExt) sdChips('admPlanExt', [['yes', `Add to it (ends ${admShort(cur.end)} now)`, 'fa-plus'], ['no', 'Start from today', 'fa-rotate']], ADM.extend ? 'yes' : 'no', 'ae');
      docEl('admPlanPrev').textContent = admResult().text;
    }
    function admOpen(u, kind, addon) {
      ADM.user = u; ADM.kind = kind; ADM.addon = addon || 'work'; ADM.plan = u.plan === 'dawn' ? 'glow' : u.plan; ADM.on = true; ADM.dur = '1'; ADM.until = ''; ADM.extend = true;
      const nm = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
      docEl('admPlanTitle').textContent = kind === 'plan' ? 'Change plan' : LumaPlan.ADDON_NAMES[ADM.addon] + ' add-on';
      const cur = admCur(); docEl('admPlanWho').innerHTML = `<b style="color:#fff">${escapeHtml(nm)}</b> · ${escapeHtml(u.email)}<br>Now: ${kind === 'plan' ? `<b>${LumaPlan.NAMES[u.plan]}</b>${u.plan === 'dawn' ? '' : ' · ' + admEndText(u.plan_expires_at)}` : cur.on ? 'on · ' + admEndText(cur.end) : 'off'}`;
      docEl('admPlanUntil').value = ''; docEl('admPlanUntil')._luDateRefresh && docEl('admPlanUntil')._luDateRefresh(); sdErr('admPlanError', ''); admPaint(); sdOpen('admPlanOverlay');
    }
    docEl('admPlanClose').onclick = () => sdClose('admPlanOverlay');
    docEl('admPlanOverlay').onclick = e => {
      if (e.target === docEl('admPlanOverlay')) return sdClose('admPlanOverlay');
      const ap = e.target.closest('[data-ap]'); if (ap) { ADM.plan = ap.dataset.ap; return admPaint(); }
      const ao = e.target.closest('[data-ao]'); if (ao) { ADM.on = ao.dataset.ao === 'yes'; return admPaint(); }
      const ad = e.target.closest('[data-ad]'); if (ad) { ADM.dur = ad.dataset.ad; return admPaint(); }
      const ae = e.target.closest('[data-ae]'); if (ae) { ADM.extend = ae.dataset.ae === 'yes'; return admPaint(); }
    };
    docEl('admPlanUntil').addEventListener('change', () => { ADM.until = docEl('admPlanUntil').value; admPaint(); });
    docEl('admPlanSave').onclick = async () => {
      const paid = ADM.kind === 'plan' ? ADM.plan !== 'dawn' : ADM.on, res = admResult(); if (paid && res.bad) return sdErr('admPlanError', res.text);
      const args = paid ? { p_months: ADM.dur !== 'date' && ADM.dur !== 'none' ? +ADM.dur : null, p_until: ADM.dur === 'date' ? ADM.until : null, p_extend: ADM.extend } : { p_months: null, p_until: null, p_extend: false };
      sdErr('admPlanError', ''); sdBtn('admPlanSave', true);
      const db = LumaAuth.client.schema('luma'), u = ADM.user, who = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
      const { error } = ADM.kind === 'plan' ? await db.rpc('admin_set_plan', { p_user: u.id, p_plan: ADM.plan, ...args }) : await db.rpc('admin_set_addon', { p_user: u.id, p_addon: ADM.addon, p_on: ADM.on, ...args });
      sdBtn('admPlanSave', false, 'Apply');
      if (error) return sdErr('admPlanError', /could not find the function|schema cache/i.test(error.message) ? 'Run supabase/migrations/062_plan_expiry.sql in the SQL Editor first.' : error.message);
      sdClose('admPlanOverlay'); flashToast(ADM.kind === 'plan' ? 'Plan changed' : 'Add-on changed', `${who}: ${res.text}`, 'fa-check', '#22c55e');
      if (ADM_AFTER) ADM_AFTER(u.id, !!(LUMA_USER && u.id === LUMA_USER.id));
    };

    WIRE.admin = function (pg) { return loadAdmin(pg); };
