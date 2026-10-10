// LUMA — module: adminreport
    MODULES.adminreport = function () {
        return head('Plan report', '<span id="arSub">Loading…</span>', '<button class="create-btn" id="arBack" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-arrow-left"></i> Admin</button><button class="create-btn" id="arCsv"><i class="fa-solid fa-download"></i> Download CSV</button>') + '<div id="arRoot"><div class="lu-empty">Loading…</div></div>';
    };

    // =====================================================
    //  ADMIN → PLAN REPORT: a page of its own (opened from the Admin page)
    // =====================================================
    async function loadAdminReport(pg) {
      const root = pg.querySelector('#arRoot'), sub = pg.querySelector('#arSub');
      pg.querySelector('#arBack').onclick = () => goTo('admin');
      if (!LumaPlan.admin) { sub.textContent = 'Not allowed'; root.innerHTML = card('<div class="ls">This page is only for administrators.</div>'); return; }
      const { data, error } = await LumaAuth.client.schema('luma').rpc('admin_monthly_stats', { p_months: 36 });
      if (error) { sub.textContent = 'Could not load'; root.innerHTML = card(`<div class="lu-empty">Could not load the report: ${escapeHtml(error.message)}. Has <b>supabase/migrations/040_admin_report.sql</b> been run?</div>`); return; }
      const all = (data || []).slice().sort((a, b) => a.period.localeCompare(b.period)); // oldest → newest
      if (!all.length) { root.innerHTML = card('<div class="lu-empty">No data yet.</div>'); return; }
      const lbl = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      const PLAN_COL = { dawn: '#34d399', glow: '#fbbf24', zenith: '#a78bfa' };
      // the range starts at the first month that has any account (or the last 12 months), ends at this month
      const firstWith = all.findIndex(r => r.total_accounts > 0);
      let to = all.length - 1, from = Math.max(firstWith < 0 ? all.length - 12 : firstWith, all.length - 12, 0), sel = to;
      const rangeRows = () => all.slice(from, to + 1);
      const opts = i => all.map((r, k) => `<option value="${k}" ${k === i ? 'selected' : ''}>${lbl(r.period)}</option>`).join('');
      root.innerHTML = `<div class="ar-bar"><div class="ar-chips" id="arChips">${[[3, 'Last 3 months'], [6, 'Last 6 months'], [12, 'Last 12 months'], [36, 'All']].map(([n, l]) => `<button type="button" data-n="${n}">${l}</button>`).join('')}</div>
          <div class="ar-range"><label><span>From</span><select id="arFrom"></select></label><label><span>To</span><select id="arTo"></select></label></div></div>
        <div id="arTiles"></div><div id="arChartCard"></div><div id="arTableCard"></div><div id="arWorkCard"></div>`;
      const selFrom = root.querySelector('#arFrom'), selTo = root.querySelector('#arTo');
      const fill = () => { selFrom.innerHTML = opts(from); selTo.innerHTML = opts(to); skinSelect(selFrom); skinSelect(selTo); };
      const paint = () => {
        const rows = rangeRows(); if (sel < from || sel > to) sel = to;
        const cur = all[sel];
        sub.textContent = `${lbl(all[from].period)} – ${lbl(all[to].period)}`;
        root.querySelectorAll('#arChips button').forEach(b => b.classList.toggle('on', Math.min(+b.dataset.n, all.length) === rows.length && to === all.length - 1));
        const tile = (l, v, c) => `<div class="adm-stat"><div class="l">${c ? `<span class="ar-dot" style="background:${c}"></span>` : ''}${l}</div><div class="v">${v}</div></div>`;
        root.querySelector('#arTiles').innerHTML = `<div class="ar-sel">${lbl(cur.period)}${sel === all.length - 1 ? ' (so far)' : ''}</div><div class="adm-stats ar-tiles">${tile('Accounts', cur.total_accounts)}${tile('New sign-ups', cur.new_signups)}${tile('Dawn', cur.on_dawn, PLAN_COL.dawn)}${tile('Glow', cur.on_glow, PLAN_COL.glow)}${tile('Zenith', cur.on_zenith, PLAN_COL.zenith)}${tile('Upgrades', cur.upgrades)}${tile('Downgrades', cur.downgrades)}</div>`;
        // stacked columns: one per month, Dawn at the bottom, then Glow, then Zenith
        const W = 900, H = 260, L = 38, B = 28, T = 10, n = rows.length, max = Math.max(1, ...rows.map(r => r.on_dawn + r.on_glow + r.on_zenith)), step = (W - L - 8) / n, bw = Math.min(46, step * 0.62), y = v => T + (H - T - B) * (1 - v / max);
        const nice = max <= 4 ? max : Math.ceil(max / 4), ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, 1, 2, 3, 4].map(i => i * nice);
        const bars = rows.map((r, i) => {
          const x = L + i * step + (step - bw) / 2; let acc = 0;
          const seg = (key, v) => { if (!v) return ''; const y1 = y(acc + v), y0 = y(acc); acc += v; return `<rect x="${x}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1)}" fill="${PLAN_COL[key]}" rx="2"/>`; };
          const k = from + i;
          return `<g class="ar-col ${k === sel ? 'sel' : ''}" data-k="${k}"><title>${lbl(r.period)}: ${r.on_dawn} Dawn · ${r.on_glow} Glow · ${r.on_zenith} Zenith</title><rect x="${L + i * step}" y="${T}" width="${step}" height="${H - T - B}" fill="transparent"/>${seg('dawn', r.on_dawn)}${seg('glow', r.on_glow)}${seg('zenith', r.on_zenith)}<text x="${x + bw / 2}" y="${H - 9}" text-anchor="middle" class="ar-x">${new Date(r.period + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}${n <= 12 ? '' : ''}</text></g>`;
        }).join('');
        root.querySelector('#arChartCard').innerHTML = card(`<div class="section-title"><i class="fa-solid fa-chart-column"></i> People on each plan <span class="ar-legend">${['dawn', 'glow', 'zenith'].map(k => `<span><i class="ar-dot" style="background:${PLAN_COL[k]}"></i>${LumaPlan.NAMES[k]}</span>`).join('')}</span></div>
          <svg viewBox="0 0 ${W} ${H}" class="ar-svg" role="img" aria-label="People on each plan at the end of each month">${ticks.map(t => `<line x1="${L}" x2="${W}" y1="${y(t)}" y2="${y(t)}" class="ar-grid"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" class="ar-y">${t}</text>`).join('')}${bars}</svg>
          <div class="ls" style="margin-top:6px">Click a month to see its numbers above. This month shows people right now.</div>`);
        root.querySelector('#arTableCard').innerHTML = card(`<div class="section-title"><i class="fa-solid fa-table"></i> Month by month</div><div class="adm-tbl-wrap"><table class="adm-tbl"><thead><tr><th>Month</th><th>Accounts</th><th>New sign-ups</th><th>Dawn</th><th>Glow</th><th>Zenith</th><th>Upgrades</th><th>Downgrades</th></tr></thead><tbody>${rows.slice().reverse().map(r => `<tr data-k="${all.indexOf(r)}" class="${all.indexOf(r) === sel ? 'sel' : ''}"><td>${lbl(r.period)}</td><td>${r.total_accounts}</td><td>${r.new_signups}</td><td>${r.on_dawn}</td><td>${r.on_glow}</td><td>${r.on_zenith}</td><td>${r.upgrades}</td><td>${r.downgrades}</td></tr>`).join('')}</tbody></table></div>`);
      };
      root.querySelector('#arChips').onclick = e => { const b = e.target.closest('button'); if (!b) return; to = all.length - 1; from = Math.max(0, all.length - Math.min(+b.dataset.n, all.length)); sel = to; fill(); paint(); };
      selFrom.onchange = () => { from = +selFrom.value; if (from > to) to = from; sel = Math.min(Math.max(sel, from), to); fill(); paint(); };
      selTo.onchange = () => { to = +selTo.value; if (to < from) from = to; sel = Math.min(Math.max(sel, from), to); fill(); paint(); };
      root.onclick = e => { const el = e.target.closest('[data-k]'); if (el && !e.target.closest('select')) { sel = +el.dataset.k; paint(); } };
      pg.querySelector('#arCsv').onclick = () => {
        const rows = rangeRows().slice().reverse(), csv = ['Month,Accounts,New sign-ups,Dawn,Glow,Zenith,Upgrades,Downgrades', ...rows.map(r => [r.period.slice(0, 7), r.total_accounts, r.new_signups, r.on_dawn, r.on_glow, r.on_zenith, r.upgrades, r.downgrades].join(','))].join('\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), a = document.createElement('a'); a.href = url; a.download = `luma-plan-report-${all[from].period.slice(0, 7)}-to-${all[to].period.slice(0, 7)}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      };
      fill(); paint();
      loadAdminWork(root.querySelector('#arWorkCard'));
    }

    // the Work add-on: how many have it, and how much it is used (migration 080)
    async function loadAdminWork(box) {
      if (!box) return; box.innerHTML = card('<div class="section-title"><i class="fa-solid fa-briefcase"></i> Work add-on</div><div class="lu-empty">Loading…</div>');
      const { data: w, error } = await LumaAuth.client.schema('luma').rpc('admin_work_stats');
      if (error || !w) { box.innerHTML = card(`<div class="section-title"><i class="fa-solid fa-briefcase"></i> Work add-on</div><div class="ls">${/admin_work_stats|schema cache|does not exist/i.test(error ? error.message : '') ? 'Run <b>supabase/migrations/080_work_links_budget_mentions.sql</b> to see the Work figures.' : escapeHtml(error ? error.message : 'No data')}</div>`); return; }
      const tile = (l, v, c) => `<div class="adm-stat"><div class="l">${c ? `<span class="ar-dot" style="background:${c}"></span>` : ''}${l}</div><div class="v">${v}</div></div>`, lbl = d => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      const months = (w.months || []).slice().reverse(), mx = k => Math.max(1, ...months.map(m => Number(m[k]) || 0));
      box.innerHTML = card(`<div class="section-title"><i class="fa-solid fa-briefcase"></i> Work add-on</div><div class="adm-stats ar-tiles">${tile('Have Work now', w.users_with_work, '#fb923c')}${tile('On a free trial', w.on_trial, '#60a5fa')}${tile('Paid or given', w.paid_or_granted, '#34d399')}${tile('Trials ever started', w.trials_started)}${tile('Active in 30 days', w.active_30d, '#fbbf24')}${tile('Companies', w.companies + (w.archived_companies ? ` <small>(${w.archived_companies} archived)</small>` : ''))}${tile('Projects', w.projects + (w.shared_projects ? ` <small>(${w.shared_projects} shared)</small>` : ''))}${tile('Tasks', `${w.tasks_done} / ${w.tasks} <small>done</small>`)}${tile('People on projects', w.people_invited)}${tile('Hours logged', w.hours_logged)}</div>
        <div class="adm-tbl-wrap" style="margin-top:12px"><table class="adm-tbl"><thead><tr><th>Month</th><th>New Work users</th><th>Projects made</th><th>Tasks made</th><th>Hours logged</th></tr></thead><tbody>${months.map(m => `<tr><td>${lbl(m.period)}</td><td>${m.new_users}</td><td>${m.projects}</td><td>${m.tasks}</td><td>${m.hours}</td></tr>`).join('')}</tbody></table></div>`);
    }


    WIRE.adminreport = function (pg) { return loadAdminReport(pg); };
