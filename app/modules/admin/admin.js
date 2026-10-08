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
            <div class="adm-plan"><select data-cur="${u.plan}">${['dawn', 'glow', 'zenith'].map(p => `<option value="${p}" ${p === u.plan ? 'selected' : ''}>${LumaPlan.NAMES[p]}</option>`).join('')}</select><div class="adm-addons">${['work', 'study'].map(k => `<button type="button" data-addon="${k}" class="${(u.addons || []).includes(k) ? 'on' : ''}" title="${LumaPlan.ADDON_NAMES[k]} add-on">${LumaPlan.ADDON_NAMES[k]}</button>`).join('')}</div></div></div>`;
        }).join('') : '<div class="ls" style="padding:14px 2px">No accounts match.</div>';
        box.querySelectorAll('.adm-plan select').forEach(skinSelect);
      };
      document.getElementById('admList').addEventListener('click', async e => {
        const btn = e.target.closest('.adm-addons button'); if (!btn) return;
        const row = btn.closest('.adm-row'), id = row.dataset.id, k = btn.dataset.addon, on = !btn.classList.contains('on'), who = row.querySelector('.adm-name').firstChild.textContent, nm = LumaPlan.ADDON_NAMES[k];
        if (!await luConfirm({ title: on ? `Turn on ${nm}?` : `Turn off ${nm}?`, message: `${who}: ${nm} add-on ${on ? 'on, with no end date' : 'off'}`, ok: on ? 'Turn on' : 'Turn off', icon: 'fa-user-shield', tone: 'info' })) return;
        const { error } = await db().rpc('admin_set_addon', { p_user: id, p_addon: k, p_on: on, p_days: null });
        if (error) return luAlert(`Could not change the ${nm} add-on: ` + error.message + (/could not find the function/i.test(error.message) ? ' Has supabase/migrations/044_addons.sql been run?' : ''));
        btn.classList.toggle('on', on); flashToast(`${nm} add-on ${on ? 'on' : 'off'}`, who, 'fa-check', '#22c55e');
        if (LUMA_USER && id === LUMA_USER.id) { await LumaPlan.load(); if (!LumaPlan.hasAddon(LUMA_MODE)) { LUMA_MODE = 'personal'; } applyModeMenus(); } // you changed your own add-ons: the menu follows
      });
      document.getElementById('admList').addEventListener('change', async e => {
        const sel = e.target.closest('select'); if (!sel) return;
        const row = sel.closest('.adm-row'), id = row.dataset.id, old = sel.dataset.cur, next = sel.value, who = row.querySelector('.adm-name').firstChild.textContent;
        const revert = () => { sel.value = old; skinSelect(sel); };
        if (!await luConfirm({ title: 'Change plan?', message: `${who}: ${LumaPlan.NAMES[old]} → ${LumaPlan.NAMES[next]}`, ok: 'Change plan', icon: 'fa-user-shield', tone: 'info' })) return revert();
        const { error } = await db().rpc('admin_set_plan', { p_user: id, p_plan: next });
        if (error) { revert(); return luAlert('Could not change the plan: ' + error.message); }
        sel.dataset.cur = next; flashToast('Plan changed', `${who} is now on ${LumaPlan.NAMES[next]}`, 'fa-check', '#22c55e'); stats();
        if (LUMA_USER && id === LUMA_USER.id) { await LumaPlan.load(); Object.keys(rendered).forEach(k => { if (k !== 'admin') delete rendered[k]; }); flashToast('Your own plan changed', 'Other pages now use the new limits', 'fa-user-shield', '#3b82f6'); } // you changed your own plan: the app follows
      });
      let t = null; document.getElementById('admSearch').addEventListener('input', () => { clearTimeout(t); t = setTimeout(list, 300); });
      // the monthly report lives on its own page (opened from here)
      const report = async () => {
        document.getElementById('admReport').innerHTML = card(`<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div class="rp-ico" style="--c:#60a5fa"><i class="fa-solid fa-chart-column"></i></div><div style="flex:1;min-width:200px"><div style="color:#fff;font-weight:600;font-size:0.9rem">Plan report</div><div class="ls" style="margin-top:2px">People on each plan month by month, with a chart, a month and date range, and a CSV download.</div></div><button type="button" class="create-btn" id="admOpenReport">View report <i class="fa-solid fa-arrow-right"></i></button></div>`);
        document.getElementById('admOpenReport').onclick = () => goTo('adminreport');
      };
      await Promise.all([stats(), report(), list()]);
    }


    WIRE.admin = function (pg) { return loadAdmin(pg); };
