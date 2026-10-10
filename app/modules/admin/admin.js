// LUMA — module: admin
      // ---------------- ADMIN ----------------
    MODULES.admin = function () {
        return head('Admin', '<span id="admSub">Loading…</span>') + '<div id="admRoot"><div class="lu-empty">Loading…</div></div>';
    };

    // =====================================================
    //  ADMIN — see every account and change anyone's plan (super admin only; enforced by the database)
    // =====================================================
    async function loadAdmin(pg) {
      const root = pg.querySelector('#admRoot'), sub = pg.querySelector('#admSub');
      if (!LumaPlan.admin) { sub.textContent = 'Not allowed'; root.innerHTML = card('<div class="ls">This page is only for administrators.</div>'); return; }
      const db = () => LumaAuth.client.schema('luma'), ago = iso => { if (!iso) return 'never'; const d = Math.floor((Date.now() - Date.parse(iso)) / 864e5); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago'; };
      root.innerHTML = '<div class="adm-stats" id="admStats"></div><div id="admReport"></div><div class="adm-search"><i class="fa-solid fa-search"></i><input id="admSearch" type="text" placeholder="Search by name or email…" autocomplete="off"></div><div class="adm-bar" id="admBar"></div><div id="admList"><div class="lu-empty">Loading…</div></div><div id="admLog"></div>';
      const stats = async () => { const { data } = await db().rpc('admin_stats'); if (!data) return; sub.textContent = `${data.total} account${data.total === 1 ? '' : 's'} · ${data.new_7d} new this week`; document.getElementById('admStats').innerHTML = [['Accounts', data.total], ['Dawn', data.dawn], ['Glow', data.glow], ['Zenith', data.zenith], ['New in 7 days', data.new_7d]].map(([l, v]) => `<div class="adm-stat"><div class="l">${l}</div><div class="v">${v}</div></div>`).join(''); };
      const list = async () => {
        const box = document.getElementById('admList'), q = document.getElementById('admSearch').value.trim();
        const { data, error } = await db().rpc('admin_list_users', { p_search: q, p_limit: 500 });
        if (error) { box.innerHTML = card(`<div class="lu-empty">Could not load accounts: ${escapeHtml(error.message)}. Has <b>supabase/migrations/036_admin.sql</b> been run?</div>`); return; }
        box.innerHTML = (data || []).length ? data.map(u => {
          const nm = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email, me = LUMA_USER && u.id === LUMA_USER.id;
          const planPaid = u.plan !== 'dawn', planEnd = planPaid ? admEndText(u.plan_expires_at) : 'free';
          const tile = (k, label, on, sub, cls, attrs) => `<button type="button" class="adm-tile ${on ? 'on' : ''} ${cls || ''}" ${attrs}><span class="k">${label}</span><b>${on ? (k === 'plan' ? LumaPlan.NAMES[u.plan] : 'On') : (k === 'plan' ? LumaPlan.NAMES[u.plan] : 'Off')}</b><small>${sub}</small></button>`;
          return `<div class="adm-row ${u.disabled_at ? 'is-off' : ''}" data-id="${u.id}"><label class="adm-chk" title="Select"><input type="checkbox" data-sel ${ADM_SEL.has(u.id) ? 'checked' : ''}></label><div class="adm-av">${escapeHtml((nm[0] || '?').toUpperCase())}</div>
            <div class="adm-who"><div class="adm-name">${escapeHtml(nm)}${u.is_admin ? '<span class="b">Admin</span>' : ''}${me ? '<span class="b" style="background:rgba(59,130,246,0.2);color:#93c5fd">You</span>' : ''}${u.email_confirmed_at ? '' : '<span class="u">Unverified</span>'}${u.disabled_at ? '<span class="u">Deactivated</span>' : ''}</div><div class="adm-sub">${escapeHtml(u.email)}${u.country ? ' · ' + escapeHtml(u.country) : ''}</div><div class="adm-seen">Joined ${ago(u.created_at)} · Seen ${ago(u.last_sign_in_at)}</div></div>
            <div class="adm-tiles">${tile('plan', 'Plan', planPaid, planEnd, 'plan ' + (planPaid ? 'paid ' : '') + admEndClass(planPaid && u.plan_expires_at), 'data-plan-open')}<div class="adm-addons">${['work', 'study'].map(k => { const on = (u.addons || []).includes(k), ex = (u.addon_expiry || {})[k]; return tile(k, k === 'work' && on && (u.addon_tier || {}).work === 'pro' ? 'Work Pro' : LumaPlan.ADDON_NAMES[k], on, on ? ((u.addon_source || {})[k] === 'trial' ? 'trial · ' : '') + (ex ? admShort(ex) : 'no end date') : 'tap to give', k + ' ' + (on ? admEndClass(ex) : ''), `data-addon="${k}" title="${LumaPlan.ADDON_NAMES[k]} add-on${on ? ' · ' + admEndText(ex) : ''}"`); }).join('')}</div></div>
            <button type="button" class="adm-more" data-acct title="Account actions"><i class="fa-solid fa-ellipsis"></i></button></div>`;
        }).join('') : '<div class="lu-empty">No accounts match.</div>';
        ADM_USERS = Object.fromEntries((data || []).map(u => [u.id, u]));
        ADM_ORDER = (data || []).map(u => u.id); ADM_SEL = new Set([...ADM_SEL].filter(id => ADM_USERS[id])); admBar();
      };
      // a plan or an add-on is changed in a popup: what, for how long, and whether to ADD time to what is left
      document.getElementById('admList').addEventListener('click', e => {
        const row = e.target.closest('.adm-row'); if (!row) return; const u = ADM_USERS[row.dataset.id]; if (!u) return;
        if (e.target.closest('.adm-chk')) { const cb = row.querySelector('[data-sel]'); if (e.target.matches('[data-sel]')) { ADMB.pickNote = ''; cb.checked ? ADM_SEL.add(u.id) : ADM_SEL.delete(u.id); admBar(); } return; }
        if (e.target.closest('[data-acct]')) return admAcctOpen(u);
        const ab = e.target.closest('.adm-addons button'); if (ab) return admOpen(u, 'addon', ab.dataset.addon);
        if (e.target.closest('[data-plan-open]')) admOpen(u, 'plan');
      });
      ADM_AFTER = async (id, own) => { await Promise.all([list(), stats(), admLogLoad()]); if (own) { await LumaPlan.load(); Object.keys(rendered).forEach(k => { if (k !== 'admin') delete rendered[k]; }); await enforceModeAccess(); flashToast('Your own plan or add-ons changed', 'The app now follows them', 'fa-user-shield', '#3b82f6'); } };
      let t = null; document.getElementById('admSearch').addEventListener('input', () => { clearTimeout(t); t = setTimeout(list, 300); });
      // the monthly report lives on its own page (opened from here)
      const report = async () => {
        document.getElementById('admReport').innerHTML = card(`<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div class="rp-ico" style="--c:#60a5fa"><i class="fa-solid fa-chart-column"></i></div><div style="flex:1;min-width:200px"><div style="color:#fff;font-weight:600;font-size:0.9rem">Plan report</div><div class="ls" style="margin-top:2px;font-size:0.78rem;line-height:1.5">People on each plan month by month, with a chart, a month and date range, and a CSV download.</div></div><button type="button" class="create-btn" id="admOpenReport">View report <i class="fa-solid fa-arrow-right"></i></button></div>`);
        document.getElementById('admOpenReport').onclick = () => goTo('adminreport');
        { const box = document.getElementById('admReport'); box.insertAdjacentHTML('beforeend', card(`<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div class="rp-ico" style="--c:#fbbf24"><i class="fa-regular fa-comment-dots"></i></div><div style="flex:1;min-width:200px"><div style="color:#fff;font-weight:600;font-size:0.9rem">Feedback inbox <span id="admFbNew" class="adm-fbnew"></span></div><div class="ls" style="margin-top:2px;font-size:0.78rem;line-height:1.5">What people sent from the Feedback page: bugs, ideas and questions, with pictures. Set a status and reply with a note.</div></div><button type="button" class="create-btn" id="admOpenFb">Open inbox <i class="fa-solid fa-arrow-right"></i></button></div>`)); document.getElementById('admOpenFb').onclick = () => goTo('adminfeedback');
          box.insertAdjacentHTML('beforeend', card(`<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div class="rp-ico" style="--c:#a78bfa"><i class="fa-solid fa-sliders"></i></div><div style="flex:1;min-width:200px"><div style="color:#fff;font-weight:600;font-size:0.9rem">Plan limits</div><div class="ls" style="margin-top:2px;font-size:0.78rem;line-height:1.5">How many reminders, projects, companies… each plan allows. Leave a box empty for unlimited. Work and Work Pro are the two sizes of the Work add-on: they set the Work numbers, whatever the plan. Changes apply straight away.</div></div><button type="button" class="create-btn" id="admLimBtn">Edit limits <i class="fa-solid fa-chevron-down"></i></button></div><div id="admLimBox" style="display:none;margin-top:12px"></div>`));
          document.getElementById('admLimBtn').onclick = admLimits; }
        { const box = document.getElementById('admReport'); box.insertAdjacentHTML('beforeend', card(`<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><div class="rp-ico" style="--c:#f472b6"><i class="fa-solid fa-cake-candles"></i></div><div style="flex:1;min-width:200px"><div style="color:#fff;font-weight:600;font-size:0.9rem">Birthdays <span id="admBdBadge" class="adm-fbnew"></span></div><div class="ls" style="margin-top:2px;font-size:0.78rem;line-height:1.5">Who has a birthday today and in the next 30 days, so you can send a wish or gift a plan or a free trial. You also get a notification at 9 am on days that have one.</div></div><button type="button" class="create-btn" id="admBdBtn">See birthdays <i class="fa-solid fa-chevron-down"></i></button></div><div id="admBdBox" style="display:none;margin-top:12px"></div>`));
          document.getElementById('admBdBtn').onclick = admBirthdays; admBdLoad(true); }
        { 
          LumaAuth.client.schema('luma').from('feedback').select('id', { count: 'exact', head: true }).eq('status', 'new').then(r => { const n = r && r.count; const el = document.getElementById('admFbNew'); if (el && n) el.textContent = n + ' new'; }); }
      };
      ADM_RELOAD = list;
      await Promise.all([stats(), report(), list(), admLogLoad()]);
    }


    // ---------- plan limits (luma.plan_limits) ----------
    const ADM_LIMIT_LABELS = { work_companies: 'Work · companies', work_projects: 'Work · projects', work_people: 'Work · people on a project', work_tasks: 'Work · tasks in a project', work_teams: 'Work · teams', lumi_questions: 'Lumi questions a day', lumi_actions: 'Lumi actions (0 = off, 1 = on)', insights: 'Insights a day', storage_mb: 'Storage (MB)', file_mb: 'File size (MB)', reminders: 'Reminders', habits: 'Habits', goals: 'Goals', bills: 'Bills', contacts: 'Contacts', wallpapers: 'Wallpapers', split: 'Split expenses (0 = off, 1 = on)' };
    // ---------- birthdays (migration 087) ----------
    let ADM_BD = [];
    const admBdName = r => [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email;
    async function admBdLoad(badgeOnly) {
      const { data, error } = await LumaAuth.client.schema('luma').rpc('admin_birthdays', { p_days: 30 });
      const badge = document.getElementById('admBdBadge');
      if (error) { ADM_BD = null; if (badge) badge.textContent = ''; return error; }
      ADM_BD = data || []; const today = ADM_BD.filter(r => r.days_until === 0).length, week = ADM_BD.filter(r => r.days_until > 0 && r.days_until <= 7).length;
      if (badge) badge.textContent = today ? `${today} today` : week ? `${week} this week` : '';
      if (!badgeOnly) admBdPaint(); return null;
    }
    function admBdPaint() {
      const box = document.getElementById('admBdBox'); if (!box) return;
      if (ADM_BD === null) { box.innerHTML = '<div class="pem-msg error" style="display:flex">Could not load birthdays. Run supabase/migrations/087_birthdays.sql in the SQL Editor first.</div>'; return; }
      const groups = [['Today', r => r.days_until === 0], ['In the next 7 days', r => r.days_until > 0 && r.days_until <= 7], ['Later this month', r => r.days_until > 7]];
      const when = r => new Date(r.next_on + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) + (r.days_until === 0 ? '' : r.days_until === 1 ? ' · tomorrow' : ` · in ${r.days_until} days`) + ` · turns ${r.turning}`;
      const row = r => `<div class="adm-bd-row" data-id="${r.id}"><div class="adm-bd-who"><b>${escapeHtml(admBdName(r))}</b><small>${escapeHtml(when(r))}</small><small>${escapeHtml(r.email || '')} · ${LumaPlan.NAMES[r.plan] || r.plan}${(r.addons || []).length ? ' + ' + r.addons.map(a => LumaPlan.ADDON_NAMES[a] || a).join(', ') : ''}</small></div>
        <div class="adm-bd-act"><button type="button" class="np-btn" data-bd-plan="${r.id}" title="Gift a month (or more) of a plan"><i class="fa-solid fa-gift"></i> Plan</button><button type="button" class="np-btn" data-bd-addon="work|${r.id}" title="Gift Work (a free trial or some months)"><i class="fa-solid fa-briefcase"></i> Work</button><button type="button" class="np-btn" data-bd-addon="study|${r.id}" title="Gift Study (a free trial or some months)"><i class="fa-solid fa-graduation-cap"></i> Study</button><button type="button" class="np-btn" data-bd-wish="${r.id}" ${r.wished_on ? 'disabled' : ''} title="Send a birthday notification">${r.wished_on ? '<i class="fa-solid fa-check"></i> Wished' : '<i class="fa-solid fa-cake-candles"></i> Wish'}</button></div></div>`;
      const html = groups.map(([t, f]) => { const rs = ADM_BD.filter(f); return rs.length ? `<div class="adm-bd-h">${t} <em>${rs.length}</em></div>${rs.map(row).join('')}` : ''; }).join('');
      box.innerHTML = html || '<div class="lu-empty">Nobody has a birthday in the next 30 days. (People add it when they register or in Settings → Profile → Edit.)</div>';
    }
    async function admBdUser(id) {
      if (ADM_USERS[id]) return ADM_USERS[id];
      const r = (ADM_BD || []).find(x => x.id === id); if (!r) return null;
      const { data } = await LumaAuth.client.schema('luma').rpc('admin_list_users', { p_search: r.email, p_limit: 5 });
      const u = (data || []).find(x => x.id === id); if (u) ADM_USERS[id] = u; return u || null;
    }
    async function admBirthdays() {
      const box = document.getElementById('admBdBox'), btn = document.getElementById('admBdBtn'); if (!box) return;
      if (box.style.display !== 'none') { box.style.display = 'none'; btn.innerHTML = 'See birthdays <i class="fa-solid fa-chevron-down"></i>'; return; }
      btn.innerHTML = 'Hide <i class="fa-solid fa-chevron-up"></i>'; box.style.display = ''; box.innerHTML = '<div class="lu-empty">Loading…</div>';
      await admBdLoad(false);
      box.onclick = async e => {
        const pl = e.target.closest('[data-bd-plan]'), ad = e.target.closest('[data-bd-addon]'), ws = e.target.closest('[data-bd-wish]');
        if (pl) { const u = await admBdUser(pl.dataset.bdPlan); if (u) admOpen(u, 'plan'); return; }
        if (ad) { const [k, id] = ad.dataset.bdAddon.split('|'), u = await admBdUser(id); if (u) admOpen(u, 'addon', k); return; }
        if (ws) {
          const r = (ADM_BD || []).find(x => x.id === ws.dataset.bdWish); if (!r) return;
          if (!await luConfirm({ title: `Send a birthday wish to ${admBdName(r)}?`, message: 'They get a "Happy birthday" notification (and a push). You can still gift a plan or add-on separately.', ok: 'Send wish', icon: 'fa-cake-candles', tone: 'info' })) return;
          ws.disabled = true; const { error } = await LumaAuth.client.schema('luma').rpc('admin_birthday_wish', { p_user: r.id, p_message: '' });
          if (error) { ws.disabled = false; return luAlert(error.message); }
          r.wished_on = new Date().toISOString(); admBdPaint(); flashToast('Wish sent', admBdName(r), 'fa-cake-candles', '#f472b6');
        }
      };
    }
    async function admLimits() {
      const box = document.getElementById('admLimBox'), btn = document.getElementById('admLimBtn'); if (!box) return;
      if (box.style.display !== 'none') { box.style.display = 'none'; btn.innerHTML = 'Edit limits <i class="fa-solid fa-chevron-down"></i>'; return; }
      btn.innerHTML = 'Hide <i class="fa-solid fa-chevron-up"></i>'; box.style.display = ''; box.innerHTML = '<div class="lu-empty">Loading…</div>';
      const { data, error } = await LumaAuth.client.schema('luma').rpc('admin_plan_limits');
      if (error) { box.innerHTML = `<div class="pem-msg error" style="display:flex">${escapeHtml(error.message)}</div>`; return; }
      const keys = [...new Set((data || []).map(r => r.key))], val = (k, p) => { const r = data.find(x => x.key === k && x.plan === p); return r ? (r.value === null ? '' : r.value) : null; };
      box.innerHTML = `<div class="adm-lim"><div class="al-h"><span></span><b>Dawn</b><b>Glow</b><b>Zenith</b><b>Work</b><b>Work Pro</b></div>${keys.map(k => `<div class="al-r"><span title="${k}">${escapeHtml(ADM_LIMIT_LABELS[k] || k.replace(/_/g, ' '))}</span>${['dawn', 'glow', 'zenith', 'work', 'work_pro'].map(p => { const v = val(k, p); return v === null ? '<i></i>' : `<input type="number" min="0" inputmode="numeric" placeholder="∞" data-lim="${k}" data-plan="${p}" value="${v}" aria-label="${k} for ${p}">`; }).join('')}</div>`).join('')}</div><div class="adm-lim-bar"><span id="admLimMsg"></span><button type="button" class="np-btn" id="admLimUndo" style="display:none">Undo changes</button><button type="button" class="create-btn" id="admLimSave" disabled>Save changes</button></div>`;
      // nothing is saved until you press Save: changed boxes light up, and Save says how many
      const inputs = [...box.querySelectorAll('input[data-lim]')], msg = document.getElementById('admLimMsg'), save = document.getElementById('admLimSave'), undo = document.getElementById('admLimUndo');
      const parse = inp => inp.value.trim() === '' ? null : Math.max(0, Math.floor(+inp.value));
      const orig = inp => inp.dataset.orig === '' ? null : +inp.dataset.orig;
      const dirty = () => inputs.filter(i => parse(i) !== orig(i));
      const refresh = () => { const d = dirty(); inputs.forEach(i => i.classList.toggle('chg', parse(i) !== orig(i))); save.disabled = !d.length; undo.style.display = d.length ? '' : 'none'; save.textContent = d.length ? `Save ${d.length} change${d.length === 1 ? '' : 's'}` : 'Save changes'; };
      inputs.forEach(i => { i.dataset.orig = i.value; i.oninput = refresh; i.onchange = refresh; });
      undo.onclick = () => { inputs.forEach(i => { i.value = i.dataset.orig; }); msg.textContent = ''; refresh(); };
      save.onclick = async () => {
        const d = dirty(); if (!d.length) return; save.disabled = true; undo.disabled = true; msg.style.color = ''; msg.textContent = 'Saving…'; let ok = 0, bad = '';
        for (const i of d) {
          const v = parse(i), r = await LumaAuth.client.schema('luma').rpc('admin_set_plan_limit', { p_plan: i.dataset.plan, p_key: i.dataset.lim, p_value: v });
          if (r.error) { bad = r.error.message; break; } i.value = v === null ? '' : v; i.dataset.orig = i.value; ok++;
        }
        undo.disabled = false; refresh();
        if (bad) { msg.textContent = `${ok ? ok + ' saved, then ' : ''}it stopped: ${bad}`; msg.style.color = '#fca5a5'; }
        else { msg.textContent = `Saved ${ok} change${ok === 1 ? '' : 's'}. They apply straight away.`; msg.style.color = '#86efac'; if (window.LumaPlan && LumaPlan.refresh) try { LumaPlan.refresh(); } catch (e) { } }
      };
      refresh();
    }

    // ---------- change a plan / add-on, with how long it runs ----------
    let ADM_USERS = {}, ADM_AFTER = null, ADM_SEL = new Set(), ADM_ORDER = [], ADM_RELOAD = null;
    const ADM = { kind: 'plan', user: null, tier: 'standard', addon: 'work', plan: 'glow', on: true, dur: '1', until: '', extend: true, type: 'normal' };
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
      if (ADM.kind === 'addon' && ADM.type === 'trial') return { end: null, trial: true, text: 'Starts their 7-day free trial now. It counts as their one free trial.' };
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
      const isTrial = !plan && paid && ADM.type === 'trial', used = !plan && (ADM.user.trials_used || []).includes(ADM.addon);
      docEl('admPlanTypeF').style.display = !plan && paid ? '' : 'none';
      if (!plan && paid) sdChips('admPlanType', [['normal', 'Normal (set the length)', 'fa-gift'], ['trial', 'Free trial · 7 days', 'fa-hourglass-half']], ADM.type, 'at');
      docEl('admPlanTierF').style.display = !plan && paid && ADM.addon === 'work' && ADM.type !== 'trial' ? '' : 'none';
      if (!plan && paid && ADM.addon === 'work') sdChips('admPlanTier', [['standard', 'Work · 5 companies, 20 projects', 'fa-briefcase'], ['pro', 'Work Pro · 20 companies, 60 projects', 'fa-rocket']], ADM.tier, 'az');
      docEl('admPlanTrialW').style.display = !plan ? '' : 'none';
      docEl('admPlanTrialNote').textContent = used ? 'They have already used their free trial for this add-on.' : 'They have not used their free trial for this add-on yet.';
      docEl('admPlanResetTrial').style.display = used ? '' : 'none';
      docEl('admPlanDurF').style.display = paid && !isTrial ? '' : 'none';
      sdChips('admPlanDur', [['1', '1 month', ''], ['3', '3 months', ''], ['6', '6 months', ''], ['12', '12 months', ''], ['date', 'Until a date', ''], ['none', 'No end', '']], ADM.dur, 'ad');
      docEl('admPlanUntilW').style.display = paid && !isTrial && ADM.dur === 'date' ? '' : 'none';
      const same = plan ? ADM.plan === cur.plan : cur.on, canExt = paid && !isTrial && same && cur.end && admDaysLeft(cur.end) > 0 && !['date', 'none'].includes(ADM.dur);
      docEl('admPlanExtF').style.display = canExt ? '' : 'none';
      if (canExt) sdChips('admPlanExt', [['yes', `Add to it (ends ${admShort(cur.end)} now)`, 'fa-plus'], ['no', 'Start from today', 'fa-rotate']], ADM.extend ? 'yes' : 'no', 'ae');
      docEl('admPlanPrev').textContent = admResult().text;
    }
    function admOpen(u, kind, addon) {
      ADM.user = u; ADM.kind = kind; ADM.addon = addon || 'work'; ADM.plan = u.plan === 'dawn' ? 'glow' : u.plan; ADM.on = true; ADM.dur = '1'; ADM.until = ''; ADM.extend = true; ADM.type = 'normal'; ADM.tier = (u.addon_tier || {}).work || 'standard';
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
      const at = e.target.closest('[data-at]'); if (at) { ADM.type = at.dataset.at; return admPaint(); }
      const az = e.target.closest('[data-az]'); if (az) { ADM.tier = az.dataset.az; return admPaint(); }
    };
    docEl('admPlanUntil').addEventListener('change', () => { ADM.until = docEl('admPlanUntil').value; admPaint(); });
    docEl('admPlanSave').onclick = async () => {
      const paid = ADM.kind === 'plan' ? ADM.plan !== 'dawn' : ADM.on, res = admResult(); if (paid && res.bad) return sdErr('admPlanError', res.text);
      if (ADM.kind === 'addon' && ADM.on && ADM.type === 'trial') {   // the free trial, started by hand
        sdErr('admPlanError', ''); sdBtn('admPlanSave', true); const u = ADM.user, who = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
        const { error } = await LumaAuth.client.schema('luma').rpc('admin_give_trial', { p_user: u.id, p_addon: ADM.addon, p_days: 7 }); sdBtn('admPlanSave', false, 'Apply');
        if (error) return sdErr('admPlanError', /could not find the function|schema cache/i.test(error.message) ? 'Run supabase/migrations/065_admin_tools.sql in the SQL Editor first.' : error.message);
        sdClose('admPlanOverlay'); flashToast('Free trial started', `${who}: 7 days of ${LumaPlan.ADDON_NAMES[ADM.addon]}`, 'fa-hourglass-half', '#22c55e'); if (ADM_AFTER) ADM_AFTER(u.id, !!(LUMA_USER && u.id === LUMA_USER.id)); return;
      }
      const args = paid ? { p_months: ADM.dur !== 'date' && ADM.dur !== 'none' ? +ADM.dur : null, p_until: ADM.dur === 'date' ? ADM.until : null, p_extend: ADM.extend } : { p_months: null, p_until: null, p_extend: false };
      sdErr('admPlanError', ''); sdBtn('admPlanSave', true);
      const db = LumaAuth.client.schema('luma'), u = ADM.user, who = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
      const { error } = ADM.kind === 'plan' ? await db.rpc('admin_set_plan', { p_user: u.id, p_plan: ADM.plan, ...args }) : await db.rpc('admin_set_addon', { p_user: u.id, p_addon: ADM.addon, p_on: ADM.on, ...args, ...(ADM.addon === 'work' && ADM.on ? { p_tier: ADM.tier } : {}) });
      sdBtn('admPlanSave', false, 'Apply');
      if (error) return sdErr('admPlanError', /could not find the function|schema cache/i.test(error.message) ? 'Run supabase/migrations/062_plan_expiry.sql in the SQL Editor first.' : error.message);
      sdClose('admPlanOverlay'); flashToast(ADM.kind === 'plan' ? 'Plan changed' : 'Add-on changed', `${who}: ${res.text}`, 'fa-check', '#22c55e');
      if (ADM_AFTER) ADM_AFTER(u.id, !!(LUMA_USER && u.id === LUMA_USER.id));
    };

    // ---------- let them use the free trial again ----------
    docEl('admPlanResetTrial').onclick = async () => {
      const u = ADM.user; sdErr('admPlanError', '');
      const { error } = await LumaAuth.client.schema('luma').rpc('admin_reset_trial', { p_user: u.id, p_addon: ADM.addon });
      if (error) return sdErr('admPlanError', /could not find the function|schema cache/i.test(error.message) ? 'Run supabase/migrations/065_admin_tools.sql in the SQL Editor first.' : error.message);
      u.trials_used = (u.trials_used || []).filter(a => a !== ADM.addon); admPaint(); flashToast('Free trial reset', 'They can start it again from the app', 'fa-rotate-left', '#22c55e'); if (ADM_RELOAD) ADM_RELOAD();
    };

    // ---------- pick many people, then give them free access ----------
    const ADMB = { addon: 'study', dur: '14d', until: '', ext: 'skip', pick: 10, pickAddon: 'study', when: 'now', claim: '60' };
    const admName = u => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
    function admBar() {
      const bar = document.getElementById('admBar'); if (!bar) return;
      if (!bar.dataset.built) {
        bar.dataset.built = '1';
        bar.innerHTML = `<div class="adm-bar-row"><button type="button" class="np-btn" data-bar="all"><i class="fa-regular fa-square-check"></i> Select all shown</button><button type="button" class="np-btn" data-bar="none" id="admBarClear">Clear</button><span class="adm-bar-n" id="admBarN"></span></div>
          <div class="adm-bar-row adm-pick"><span>Pick</span><input id="admPickN" type="text" inputmode="numeric" value="${ADMB.pick}" maxlength="3"><span>people who do not have</span><span class="adm-pick-chips" id="admPickChips"></span><button type="button" class="np-btn" data-bar="pick">Pick them</button><button type="button" class="create-btn" data-bar="give" id="admBarGive"><i class="fa-solid fa-gift"></i> Give free access…</button></div>`;
        bar.addEventListener('click', e => {
          const b = e.target.closest('[data-bar]'), pc = e.target.closest('[data-pickaddon]');
          if (pc) { ADMB.pickAddon = pc.dataset.pickaddon; return admBar(); }
          if (!b) return; const k = b.dataset.bar;
          if (k !== 'pick') ADMB.pickNote = '';
          if (k === 'all') { ADM_ORDER.forEach(id => ADM_SEL.add(id)); document.querySelectorAll('#admList [data-sel]').forEach(c => { c.checked = true; }); }
          else if (k === 'none') { ADM_SEL.clear(); document.querySelectorAll('#admList [data-sel]').forEach(c => { c.checked = false; }); }
          else if (k === 'pick') {
            const n = Math.max(1, Math.min(500, parseInt(docEl('admPickN').value, 10) || 0)); ADMB.pick = n; ADM_SEL.clear();
            ADM_ORDER.forEach(id => { const u = ADM_USERS[id]; if (ADM_SEL.size < n && !u.is_admin && !u.disabled_at && !(u.addons || []).includes(ADMB.pickAddon)) ADM_SEL.add(id); });
            document.querySelectorAll('#admList [data-sel]').forEach(c => { c.checked = ADM_SEL.has(c.closest('.adm-row').dataset.id); });
            ADMB.pickNote = ADM_SEL.size ? '' : 'Nobody to pick: administrators, deactivated accounts and people who already have ' + LumaPlan.ADDON_NAMES[ADMB.pickAddon] + ' are skipped. Tick someone by hand to include them.';
            if (ADM_SEL.size < n && ADM_SEL.size) flashToast('Only ' + ADM_SEL.size + ' found', 'That is everyone shown who does not have ' + LumaPlan.ADDON_NAMES[ADMB.pickAddon] + ' yet', 'fa-circle-info', '#60a5fa');
          } else if (k === 'give') return admBulkOpen();
          admBar();
        });
      }
      const n = ADM_SEL.size;
      docEl('admBarN').textContent = n ? n + ' selected' : (ADMB.pickNote || 'Nobody selected');
      docEl('admBarClear').style.display = n ? '' : 'none'; docEl('admBarGive').disabled = !n; docEl('admBarGive').innerHTML = '<i class="fa-solid fa-gift"></i> Give free access' + (n ? ' (' + n + ')' : '') + '…';
      docEl('admPickChips').innerHTML = ['study', 'work'].map(k => `<button type="button" class="sp-chip ${ADMB.pickAddon === k ? 'active' : ''}" data-pickaddon="${k}">${LumaPlan.ADDON_NAMES[k]}</button>`).join('');
    }
    const ADMB_DURS = [['7d', '7 days'], ['14d', '14 days'], ['1m', '1 month'], ['3m', '3 months'], ['date', 'Until a date']];
    function admBulkArgs() { const d = ADMB.dur; return { p_days: /d$/.test(d) && d !== 'date' ? parseInt(d, 10) : null, p_months: /m$/.test(d) ? parseInt(d, 10) : null, p_until: d === 'date' ? ADMB.until || null : null }; }
    function admBulkPaint() {
      const ids = [...ADM_SEL], have = ids.filter(id => (ADM_USERS[id].addons || []).includes(ADMB.addon)).length, nm = LumaPlan.ADDON_NAMES[ADMB.addon];
      sdChips('admBulkAddon', ['study', 'work'].map(k => [k, LumaPlan.ADDON_NAMES[k], k === 'study' ? 'fa-graduation-cap' : 'fa-briefcase']), ADMB.addon, 'ba');
      const later = ADMB.when === 'later'; if (later && ADMB.dur === 'date') ADMB.dur = '14d';
      sdChips('admBulkWhen', [['now', 'Start now', 'fa-bolt'], ['later', 'They choose when', 'fa-gift']], ADMB.when, 'bw');
      sdChips('admBulkDur', ADMB_DURS.filter(([k]) => !later || k !== 'date').map(([k, l]) => [k, l, '']), ADMB.dur, 'bd');
      docEl('admBulkClaimF').style.display = later ? '' : 'none'; if (later) sdChips('admBulkClaim', [['30', '30 days'], ['60', '60 days'], ['90', '90 days'], ['none', 'No deadline']], ADMB.claim, 'bc');
      docEl('admBulkUntilW').style.display = ADMB.dur === 'date' ? '' : 'none';
      docEl('admBulkExt').closest('.pem-field').style.display = have && !later ? '' : 'none';
      if (have && !later) sdChips('admBulkExt', [['skip', `Skip them (${have})`, 'fa-forward'], ['add', `Add time to theirs (${have})`, 'fa-plus']], ADMB.ext, 'bx');
      const a = admBulkArgs(); let when;
      if (ADMB.dur === 'date') when = ADMB.until ? 'until the end of ' + admShort(ADMB.until + 'T00:00:00') : 'until a date (pick it)';
      else when = 'for ' + (a.p_days ? a.p_days + ' days' : a.p_months + ' month' + (a.p_months === 1 ? '' : 's'));
      const give = ids.length - (ADMB.ext === 'skip' ? have : 0);
      if (later) { const by = ADMB.claim === 'none' ? 'with no deadline' : 'to use within ' + ADMB.claim + ' days'; docEl('admBulkPrev').textContent = `A gift of ${nm} ${when} is sent to ${ids.length} ${ids.length === 1 ? 'person' : 'people'}, ${by}. Nothing starts until they press “Use now”. People who already hold 3 unused gifts are skipped.`; }
      else docEl('admBulkPrev').textContent = `${nm} ${when}: ${give} of ${ids.length} people will get it${have ? (ADMB.ext === 'skip' ? `, ${have} already have it and are skipped.` : `, ${have} already have it and get extra time.`) : '.'}`;
      docEl('admBulkWho').innerHTML = `<b style="color:#fff">${ids.length} ${ids.length === 1 ? 'person' : 'people'} selected</b>${ids.length <= 3 ? ': ' + ids.map(id => escapeHtml(admName(ADM_USERS[id]))).join(', ') : ''}`;
    }
    function admBulkOpen() { if (!ADM_SEL.size) return; ADMB.until = ''; sdErr('admBulkError', ''); docEl('admBulkNote').value = ''; docEl('admBulkUntil').value = ''; docEl('admBulkUntil')._luDateRefresh && docEl('admBulkUntil')._luDateRefresh(); admBulkPaint(); sdOpen('admBulkOverlay'); }
    docEl('admBulkClose').onclick = () => sdClose('admBulkOverlay');
    docEl('admBulkOverlay').onclick = e => {
      if (e.target === docEl('admBulkOverlay')) return sdClose('admBulkOverlay');
      const bw = e.target.closest('[data-bw]'); if (bw) { ADMB.when = bw.dataset.bw; return admBulkPaint(); }
      const bc = e.target.closest('[data-bc]'); if (bc) { ADMB.claim = bc.dataset.bc; return admBulkPaint(); }
      const ba = e.target.closest('[data-ba]'); if (ba) { ADMB.addon = ba.dataset.ba; return admBulkPaint(); }
      const bd = e.target.closest('[data-bd]'); if (bd) { ADMB.dur = bd.dataset.bd; return admBulkPaint(); }
      const bx = e.target.closest('[data-bx]'); if (bx) { ADMB.ext = bx.dataset.bx; return admBulkPaint(); }
    };
    docEl('admBulkUntil').addEventListener('change', () => { ADMB.until = docEl('admBulkUntil').value; admBulkPaint(); });
    docEl('admBulkSave').onclick = async () => {
      if (ADMB.dur === 'date' && !ADMB.until) return sdErr('admBulkError', 'Pick the last day.');
      sdErr('admBulkError', ''); sdBtn('admBulkSave', true);
      const later = ADMB.when === 'later', a = admBulkArgs();
      const { data, error } = later ? await LumaAuth.client.schema('luma').rpc('admin_bulk_gift', { p_users: [...ADM_SEL], p_addon: ADMB.addon, p_days: a.p_days, p_months: a.p_months, p_claim_days: ADMB.claim === 'none' ? null : +ADMB.claim, p_note: docEl('admBulkNote').value.trim() })
        : await LumaAuth.client.schema('luma').rpc('admin_bulk_grant', { p_users: [...ADM_SEL], p_addon: ADMB.addon, ...a, p_extend: ADMB.ext === 'add', p_note: docEl('admBulkNote').value.trim() });
      sdBtn('admBulkSave', false, 'Give access');
      if (error) return sdErr('admBulkError', /could not find the function|schema cache/i.test(error.message) ? `Run supabase/migrations/${later ? '069_addon_gifts' : '065_admin_tools'}.sql in the SQL Editor first.` : error.message);
      sdClose('admBulkOverlay'); ADM_SEL.clear();
      if (later) { flashToast('Gift sent', `${data.given} sent${data.skipped ? ', ' + data.skipped + ' skipped (already hold 3)' : ''} · ${LumaPlan.ADDON_NAMES[ADMB.addon]}`, 'fa-gift', '#34d399'); if (ADM_AFTER) ADM_AFTER(null, false); return; }
      flashToast('Free access given', `${data.given} new${data.extended ? ', ' + data.extended + ' extended' : ''}${data.skipped ? ', ' + data.skipped + ' skipped' : ''} · ${LumaPlan.ADDON_NAMES[ADMB.addon]}`, 'fa-gift', '#22c55e');
      if (ADM_AFTER) ADM_AFTER(null, false);
    };

    // ---------- one account: deactivate, reactivate or delete ----------
    let ADM_ACCT = null;
    function admAcctPaint() {
      const u = ADM_ACCT, me = LUMA_USER && u.id === LUMA_USER.id, locked = u.is_admin || me, off = !!u.disabled_at;
      docEl('admAcctTitle').textContent = admName(u);
      docEl('admAcctWho').innerHTML = `${escapeHtml(u.email)}${u.country ? ' · ' + escapeHtml(u.country) : ''}<br>${LumaPlan.NAMES[u.plan]} plan · joined ${admShort(u.created_at)}${off ? `<br><b style="color:#fca5a5">Deactivated ${admShort(u.disabled_at)}</b>${u.disabled_reason ? ' · ' + escapeHtml(u.disabled_reason) : ''}` : ''}`;
      docEl('admAcctRole').style.display = me ? 'none' : '';
      docEl('admAcctRoleBtn').innerHTML = u.is_admin ? '<i class="fa-solid fa-user-minus"></i> Remove administrator access' : '<i class="fa-solid fa-user-shield"></i> Make administrator';
      docEl('admAcctRoleBtn').disabled = !u.is_admin && off;
      docEl('admAcctRoleNote').textContent = u.is_admin ? 'They keep their account but lose access to the Admin page.' : off ? 'Reactivate the account first.' : 'An administrator can see every account and change plans, add-ons and accounts.';
      docEl('admAcctDeact').style.display = locked ? 'none' : ''; docEl('admAcctDanger').style.display = locked ? 'none' : '';
      if (locked) docEl('admAcctWho').innerHTML += '<br><span class="ls">' + (me ? 'This is your own account.' : 'Remove their administrator access first to deactivate or delete them.') + '</span>';
      docEl('admAcctReasonF').style.display = off ? 'none' : '';
      const tg = docEl('admAcctToggle'); tg.innerHTML = off ? '<i class="fa-solid fa-user-check"></i> Reactivate account' : '<i class="fa-solid fa-user-slash"></i> Deactivate account'; tg.classList.toggle('adm-warn', !off);
      docEl('admAcctToggleNote').textContent = off ? 'They will be able to sign in again.' : 'They are signed out and can not sign in. Their data is kept, and you can reactivate any time.';
      docEl('admAcctDelete').disabled = docEl('admAcctConfirm').value.trim().toLowerCase() !== String(u.email).toLowerCase();
    }
    function admAcctOpen(u) { ADM_ACCT = u; sdErr('admAcctError', ''); docEl('admAcctReason').value = ''; docEl('admAcctConfirm').value = ''; admAcctPaint(); sdOpen('admAcctOverlay'); }
    docEl('admAcctClose').onclick = () => sdClose('admAcctOverlay');
    docEl('admAcctOverlay').onclick = e => { if (e.target === docEl('admAcctOverlay')) sdClose('admAcctOverlay'); };
    docEl('admAcctConfirm').addEventListener('input', admAcctPaint);
    docEl('admAcctToggle').onclick = async () => {
      const u = ADM_ACCT, off = !!u.disabled_at; sdErr('admAcctError', ''); sdBtn('admAcctToggle', true);
      const { error } = await LumaAuth.client.schema('luma').rpc('admin_set_disabled', { p_user: u.id, p_disabled: !off, p_reason: docEl('admAcctReason').value.trim() });
      docEl('admAcctToggle').disabled = false; admAcctPaint();
      if (error) return sdErr('admAcctError', /could not find the function|schema cache/i.test(error.message) ? 'Run supabase/migrations/065_admin_tools.sql in the SQL Editor first.' : error.message);
      sdClose('admAcctOverlay'); flashToast(off ? 'Account reactivated' : 'Account deactivated', admName(u), off ? 'fa-user-check' : 'fa-user-slash', off ? '#22c55e' : '#f59e0b'); if (ADM_AFTER) ADM_AFTER(null, false);
    };
    docEl('admAcctRoleBtn').onclick = async () => {
      const u = ADM_ACCT, make = !u.is_admin; if (!await luConfirm({ title: make ? `Make ${admName(u)} an administrator?` : `Remove ${admName(u)} as administrator?`, message: make ? 'They will be able to see every account and change plans, add-ons and accounts.' : 'They will no longer be able to open the Admin page.', ok: make ? 'Make administrator' : 'Remove', icon: 'fa-user-shield', tone: make ? 'warn' : 'danger' })) return;
      sdErr('admAcctError', ''); docEl('admAcctRoleBtn').disabled = true;
      const { error } = await LumaAuth.client.schema('luma').rpc('admin_set_admin', { p_user: u.id, p_admin: make }); docEl('admAcctRoleBtn').disabled = false;
      if (error) return sdErr('admAcctError', /could not find the function|schema cache/i.test(error.message) ? 'Run supabase/migrations/068_admin_roles.sql in the SQL Editor first.' : error.message);
      sdClose('admAcctOverlay'); flashToast(make ? 'Administrator added' : 'Administrator removed', admName(u), 'fa-user-shield', make ? '#a78bfa' : '#f59e0b'); if (ADM_AFTER) ADM_AFTER(null, false);
    };
    docEl('admAcctDelete').onclick = async () => {
      const u = ADM_ACCT; if (docEl('admAcctDelete').disabled) return;
      if (!await luConfirm({ title: `Delete ${admName(u)} forever?`, message: 'Their account, all their data and their files are removed. This can not be undone.' })) return;
      sdErr('admAcctError', ''); docEl('admAcctDelete').disabled = true;
      const { data, error } = await LumaAuth.client.functions.invoke('account', { body: { action: 'delete', user_id: u.id } });
      let msg = error ? error.message : (data && data.error) || '';
      if (error && error.context && typeof error.context.json === 'function') { try { const j = await error.context.json(); msg = j.error || msg; } catch (e) { } }
      if (msg) { docEl('admAcctDelete').disabled = false; return sdErr('admAcctError', /not found|failed to send|404|relay/i.test(msg) ? 'The "account" function is not deployed yet: run  supabase functions deploy account' : msg); }
      sdClose('admAcctOverlay'); flashToast('Account deleted', admName(u), 'fa-trash-can', '#f87171'); if (ADM_AFTER) ADM_AFTER(null, false);
    };

    // ---------- the admin log ----------
    const ADM_ACTS = { give_trial: ['Started a free trial', 'fa-hourglass-half', '#a78bfa'], reset_trial: ['Reset a free trial', 'fa-rotate-left', '#a78bfa'], bulk_grant: ['Gave free access', 'fa-gift', '#34d399'], bulk_gift: ['Sent a gift to start later', 'fa-gift', '#34d399'], deactivate: ['Deactivated an account', 'fa-user-slash', '#f59e0b'], reactivate: ['Reactivated an account', 'fa-user-check', '#34d399'], delete_account: ['Deleted an account', 'fa-trash-can', '#f87171'], make_admin: ['Made an administrator', 'fa-user-shield', '#a78bfa'], remove_admin: ['Removed an administrator', 'fa-user-minus', '#f59e0b'] };
    async function admLogLoad() {
      const box = document.getElementById('admLog'); if (!box) return;
      const { data, error } = await LumaAuth.client.schema('luma').rpc('admin_recent_actions', { p_limit: 15 });
      if (error || !data) { box.innerHTML = ''; return; }
      const when = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
      box.innerHTML = card(`<div class="section-title"><i class="fa-solid fa-clock-rotate-left"></i> Recent admin actions</div>${data.length ? data.map(a => {
        const t = ADM_ACTS[a.action] || [a.action, 'fa-circle', '#94a3b8'], d = a.detail || {};
        const more = a.action === 'bulk_gift' ? `${d.addon} · ${d.given} sent${d.skipped ? ', ' + d.skipped + ' skipped' : ''}${d.note ? ' · “' + d.note + '”' : ''}` : a.action === 'bulk_grant' ? `${d.addon} · ${d.given} given${d.extended ? ', ' + d.extended + ' extended' : ''}${d.skipped ? ', ' + d.skipped + ' skipped' : ''}${d.note ? ' · “' + d.note + '”' : ''}` : (a.target_email || '') + (d.addon ? ' · ' + d.addon : '') + (d.reason ? ' · ' + d.reason : '');
        return `<div class="adm-log"><div class="rp-ico" style="--c:${t[2]}"><i class="fa-solid ${t[1]}"></i></div><div class="adm-log-m"><div class="adm-log-t">${t[0]}</div><div class="adm-log-s">${escapeHtml(more)}</div></div><div class="adm-log-w">${escapeHtml(a.admin_name || '')}<br>${when(a.created_at)}</div></div>`;
      }).join('') : '<div class="lu-empty">Nothing yet.</div>'}`);
    }

    WIRE.admin = function (pg) { return loadAdmin(pg); };
