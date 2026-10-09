// LUMA — module: purchases (Settings → Purchase history)
    // Everything that happened to your plan and add-ons: free trials, switched on, time added, switched off, ended. Newest first, 40 at a time.
    const PH = { rows: [], filter: 'all', more: false, loading: false };
    const PH_VERB = { trial: ['Free trial started', 'fa-gift', '#a78bfa'], started: ['Switched on', 'fa-circle-check', '#34d399'], extended: ['Time added', 'fa-calendar-plus', '#60a5fa'], removed: ['Switched off', 'fa-circle-minus', '#f87171'], ended: ['Ended', 'fa-hourglass-end', '#fbbf24'] };
    const PH_PAGE = 40;

    MODULES.purchases = function () {
      PH.rows = []; PH.filter = 'all'; PH.more = false;
      return head('Purchase history', 'Your plan and add-ons: trials, start dates, time added and endings',
        `<button type="button" class="np-btn" id="phBack"><i class="fa-solid fa-arrow-left"></i> Settings</button>`) +
        `<div class="ph-chips" id="phChips"></div><div class="card full-width ph-card" id="phList"><span class="ls">Loading…</span></div>`;
    };
    const phName = r => r.kind === 'plan' ? r.item.charAt(0).toUpperCase() + r.item.slice(1) + ' plan' : ((ADDONS[r.item] || { name: r.item }).name + ' add-on');
    const phOf = r => r.kind === 'plan' ? ['fa-sun', '#fbbf24'] : [(ADDONS[r.item] || {}).icon || 'fa-puzzle-piece', (ADDONS[r.item] || {}).color || '#94a3b8'];
    function phPaint() {
      const f = PH.filter, rows = PH.rows.filter(r => f === 'all' || (f === 'plan' && r.kind === 'plan') || (f === 'addon' && r.kind === 'addon') || (f === 'trial' && r.action === 'trial'));
      document.getElementById('phChips').innerHTML = [['all', 'All'], ['plan', 'Plans'], ['addon', 'Add-ons'], ['trial', 'Trials']].map(c => `<button type="button" class="ph-chip ${f === c[0] ? 'active' : ''}" data-ph="${c[0]}">${c[1]}</button>`).join('');
      const day = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const time = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
      document.getElementById('phList').innerHTML = (rows.length ? rows.map(r => {
        const v = PH_VERB[r.action] || [r.action, 'fa-circle', '#94a3b8'], ic = phOf(r);
        const until = r.ends_at && r.action !== 'removed' && r.action !== 'ended' ? `<div class="ph-until">until ${day(new Date(Date.parse(r.ends_at) - 1000).toISOString())}</div>` : '';
        return `<div class="ph-row"><div class="rp-ico" style="--c:${ic[1]}"><i class="fa-solid ${ic[0]}"></i></div><div class="ph-main"><div class="ph-t"><b>${phName(r)}</b></div><div class="ph-v" style="color:${v[2]}"><i class="fa-solid ${v[1]}"></i> ${v[0]}</div></div><div class="ph-side"><div>${day(r.created_at)}</div><div class="ph-time">${time(r.created_at)}</div>${until}</div></div>`;
      }).join('') : `<span class="ls">${PH.rows.length ? 'Nothing in this filter.' : 'Nothing yet. Trials, plans and add-ons will be listed here.'}</span>`)
        + (PH.more ? '<button type="button" class="np-btn ph-more" id="phMore">Show older</button>' : '');
    }
    async function phLoad() {
      if (PH.loading) return; PH.loading = true;
      const { data, error } = await LumaAuth.client.schema('luma').from('purchase_history').select('kind, item, action, ends_at, created_at').order('created_at', { ascending: false }).range(PH.rows.length, PH.rows.length + PH_PAGE - 1);
      PH.loading = false;
      if (error) { document.getElementById('phList').innerHTML = '<span class="ls">History will appear here once your database is up to date.</span>'; return; }
      PH.rows = PH.rows.concat(data); PH.more = data.length === PH_PAGE; phPaint();
    }
    WIRE.purchases = function (pg) {
      pg.querySelector('#phBack').addEventListener('click', () => goTo('settings'));
      pg.addEventListener('click', e => { const c = e.target.closest('[data-ph]'); if (c) { PH.filter = c.dataset.ph; return phPaint(); } if (e.target.closest('#phMore')) phLoad(); });
      phLoad();
    };
