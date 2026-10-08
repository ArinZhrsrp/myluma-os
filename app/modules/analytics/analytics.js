// LUMA — module: analytics
      // ---------------- ANALYTICS ----------------
    MODULES.analytics = function () {
        return head('Analytics', '<span id="anSub">Your patterns across tasks, habits, health and money</span>',
          '<div class="an-range" id="anRange"><button data-n="7" class="on">7 days</button><button data-n="30">30 days</button></div>') +
          '<div id="anRoot"><div class="ls" style="padding:10px 2px">Loading…</div></div>';
    };

    // =====================================================
    //  ANALYTICS — everything is computed from your real tasks, habits, health logs, bills and money entries
    // =====================================================
    let anRange = 7, an = null;
    const anAvg = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
    const anKeys = (n, back = 0) => Array.from({ length: n }, (_, i) => hKeyAdd(hToday(), -(n - 1) - back + i)); // oldest → newest
    const anRM = v => 'RM ' + v.toLocaleString('en-MY', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    function anCalc(keys) {
      const set = new Set(keys), T = an.tasks;
      const due = T.filter(t => t.due_date && set.has(t.due_date));
      const perDay = keys.map(k => T.filter(t => t.completed_at && mytDayKey(t.completed_at) === k).length);
      const taskRate = due.length ? due.filter(t => t.status === 'done').length / due.length : null;
      const habitDay = keys.map(k => {
        const d = HABITS.filter(h => h.period === 'daily' && hSched(h, k) && hBorn(h) <= k);
        return d.length ? d.filter(h => hLogged(h, k)).length / d.length : null;
      });
      const g = an.goals;
      const healthRows = an.health.filter(r => set.has(r.log_date)).map(r => anAvg([
        r.sleep_hours != null && g.sleep_hours ? Math.min(1, r.sleep_hours / g.sleep_hours) : null,
        r.water_ml != null && g.water_ml ? Math.min(1, r.water_ml / g.water_ml) : null,
        r.steps != null && g.steps ? Math.min(1, r.steps / g.steps) : null,
        r.active_minutes != null && g.active_minutes ? Math.min(1, r.active_minutes / g.active_minutes) : null]));
      const health = anAvg(healthRows), habit = anAvg(habitDay);
      const cats = new Map(); let spend = 0, income = 0;
      const add = (c, v) => { spend += v; cats.set(c, (cats.get(c) || 0) + v); };
      BPAY_ROWS.forEach(r => { const k = r.paid_at ? mytDayKey(r.paid_at) : r.due_date; if (!set.has(k)) return; const b = BILLS.find(x => x.id === r.bill_id); add(b ? (b.category === 'Subscription' ? 'Subscriptions' : 'Bills & utilities') : 'Bills & utilities', Number(r.amount) || 0); });
      MENT.forEach(e => { if (!set.has(e.entry_date)) return; if (e.kind === 'income') income += Number(e.amount) || 0; else add(e.category || 'Other', Number(e.amount) || 0); });
      const score = anAvg([taskRate, habit, health]);
      return { keys, due, perDay, taskRate, habitDay, habit, health, spend, income, cats, score, done: perDay.reduce((a, b) => a + b, 0) };
    }
    const anPct = v => v == null ? null : Math.round(v * 100);
    const anDelta = (cur, prev) => cur == null || prev == null ? '<span class="pill pill-blue">No earlier data</span>' : (() => { const d = Math.round((cur - prev) * 100); return `<span class="pill ${d >= 0 ? 'pill-low' : 'pill-high'}">${d >= 0 ? '+' : ''}${d} pts vs last</span>`; })();

    function anBars(vals, keys, max, fmt, cls) {
      const lbl = (k, i) => anRange === 7 ? hKeyLabel(k).split(' ')[0].slice(0, 3) : (i % 5 === 0 || i === keys.length - 1 ? hKeyLabel(k).split(' ').slice(1).join(' ') : '');
      return `<div class="barchart an-bars">${vals.map((v, i) => `<div class="bcol" title="${hKeyLabel(keys[i])} · ${fmt(v)}"><div class="bbar ${cls || ''} ${!v ? 'zero' : ''}" style="height:${v ? Math.max(6, v / (max || 1) * 100) : 6}%"></div><div class="blbl" style="white-space:nowrap">${lbl(keys[i], i)}</div></div>`).join('')}</div>`;
    }

    function paintAnalytics() {
      const root = document.getElementById('anRoot'); if (!root || !an) return;
      const cur = anCalc(anKeys(anRange)), prev = anCalc(anKeys(anRange, anRange));
      const label = anRange === 7 ? 'week' : 'month';
      const rings = [
        ['Productivity score', cur.score, prev.score, '#3b82f6', 'Average of tasks, habits and health'],
        ['Task completion', cur.taskRate, prev.taskRate, '#22c55e', cur.due.length ? `${cur.due.filter(t => t.status === 'done').length} of ${cur.due.length} due tasks done` : 'No tasks due in this period'],
        ['Habit consistency', cur.habit, prev.habit, '#8b5cf6', HABITS.length ? 'Daily habits ticked' : 'No habits yet']];
      const maxT = Math.max(1, ...cur.perDay);
      const cats = [...cur.cats.entries()].sort((a, b) => b[1] - a[1]), catMax = cats.length ? cats[0][1] : 1;
      const mcol = Object.fromEntries(M_CATS.map(c => [c[0], c[2]]));
      const tagMap = new Map(); an.tasks.filter(t => t.status === 'done' && t.completed_at && cur.keys.includes(mytDayKey(t.completed_at))).forEach(t => tagMap.set(t.tag || 'Other', (tagMap.get(t.tag || 'Other') || 0) + 1));
      const tags = [...tagMap.entries()].sort((a, b) => b[1] - a[1]), tagTot = tags.reduce((a, b) => a + b[1], 0);
      const tcol = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#94a3b8', '#ec4899'];
      const bar = (name, shown, pct, color) => `<div style="margin-bottom:0.7rem"><div style="display:flex;justify-content:space-between;font-size:0.72rem;margin-bottom:5px"><span style="color:rgba(255,255,255,0.6)">${escapeHtml(name)}</span><span style="color:rgba(255,255,255,0.85)">${shown}</span></div><div class="pbar"><span style="width:${pct}%;background:${color}"></span></div></div>`;

      // insights, only ones the data supports
      const ins = [];
      const wd = [0, 0, 0, 0, 0, 0, 0]; an.tasks.forEach(t => { if (t.completed_at) wd[hDow(mytDayKey(t.completed_at))]++; });
      const names = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'], top = wd.indexOf(Math.max(...wd));
      if (Math.max(...wd) > 0) ins.push(['fa-sun', `You finish the most tasks on ${names[top]} (${wd[top]} so far). Plan your big ones for then.`]);
      const late = an.tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < hToday()).length;
      ins.push(late ? ['fa-triangle-exclamation', `${late} task${late > 1 ? 's are' : ' is'} overdue. Clear or reschedule ${late > 1 ? 'them' : 'it'} to lift your score.`] : ['fa-circle-check', 'Nothing is overdue. Nice work keeping up.']);
      if (cur.habit != null && prev.habit != null) { const d = Math.round((cur.habit - prev.habit) * 100); ins.push(['fa-fire', d === 0 ? `Habit consistency is steady at ${anPct(cur.habit)}%.` : `Habit consistency is ${d > 0 ? 'up' : 'down'} ${Math.abs(d)} points on last ${label}.`]); }
      if (cur.spend > 0 || prev.spend > 0) { const d = prev.spend ? Math.round((cur.spend - prev.spend) / prev.spend * 100) : null; ins.push(['fa-arrow-trend-' + (cur.spend > prev.spend ? 'up' : 'down'), d == null ? `You spent ${anRM(cur.spend)} this ${label}.` : `Spending is ${cur.spend >= prev.spend ? 'up' : 'down'} ${Math.abs(d)}% on last ${label} (${anRM(cur.spend)}).`]); }
      if (cur.health != null) ins.push(['fa-heart-pulse', `You hit ${anPct(cur.health)}% of your health goals on days you logged.`]);
      if (ins.length < 3) ins.push(['fa-lightbulb', 'Log more tasks, habits and health data and these insights get sharper.']);

      document.getElementById('anSub').textContent = `Last ${anRange} days compared with the ${anRange} days before`;
      root.innerHTML = `<div class="grid-3" style="margin-bottom:0.9rem">${rings.map(r => card(`<div style="display:flex;align-items:center;gap:16px">${ring(r[1] == null ? 0 : anPct(r[1]), r[3], r[1] == null ? '—' : anPct(r[1]) + '%', '', 80)}<div><div class="m-label">${r[0]}</div><div class="ls" style="margin:4px 0 8px">${r[4]}</div>${anDelta(r[1], r[2])}</div></div>`)).join('')}</div>
        <div class="grid-2" style="margin-bottom:0.9rem">
          ${card(`<div class="section-title"><i class="fa-solid fa-chart-column"></i> Tasks completed by day <span class="ls" style="margin-left:auto">${cur.done} total</span></div>${anBars(cur.perDay, cur.keys, maxT, v => v + ' done')}`)}
          ${card(`<div class="section-title"><i class="fa-solid fa-fire"></i> Habit consistency by day</div>${anBars(cur.habitDay.map(v => v == null ? 0 : v), cur.keys, 1, v => Math.round(v * 100) + '%', 'alt')}`)}
        </div>
        <div class="grid-2" style="margin-bottom:0.9rem">
          ${card(`<div class="section-title"><i class="fa-solid fa-chart-pie"></i> Completed tasks by tag</div>${tags.length ? tags.map((t, i) => bar(t[0], `${t[1]} · ${Math.round(t[1] / tagTot * 100)}%`, t[1] / tagTot * 100, tcol[i % tcol.length])).join('') : '<div class="ls">No tasks completed in this period.</div>'}`)}
          ${card(`<div class="section-title"><i class="fa-solid fa-wallet"></i> Spending by category <span class="ls" style="margin-left:auto">${anRM(cur.spend)}${cur.income ? ' · income ' + anRM(cur.income) : ''}</span></div>${cats.length ? cats.slice(0, 6).map(c => bar(c[0], anRM(c[1]), c[1] / catMax * 100, mcol[c[0]] || '#94a3b8')).join('') : '<div class="ls">No spending recorded in this period.</div>'}`)}
        </div>
        ${card(`<div class="section-title"><i class="fa-solid fa-robot"></i> Lumi's insights <button type="button" class="create-btn" id="anAiBtn" style="margin-left:auto;padding:6px 12px;font-size:0.7rem;background:rgba(255,255,255,0.08);box-shadow:none"><i class="fa-solid fa-wand-magic-sparkles"></i> ${anAiGet() ? 'Refresh with AI' : 'Get AI insights'}</button></div><div class="ls" style="margin:-4px 0 10px"><span id="anAiNote" style="display:${anAiGet() ? 'inline' : 'none'}">Written by Lumi (AI) from your numbers. · </span><span id="anAiLeft">${anAiLeftTxt()}</span></div>${(() => { const n = (anAiGet() || ins).slice(0, 6).length; return `<div class="${n === 4 || n === 2 ? 'grid-2' : 'grid-3'}">`; })()}${(anAiGet() ? anAiGet().map(t => ['fa-wand-magic-sparkles', t]) : ins).slice(0, 6).map(c => `<div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05)"><i class="fa-solid ${c[0]}" style="color:#93c5fd;font-size:1.1rem"></i><p style="margin-top:10px;font-size:0.75rem;color:rgba(255,255,255,0.8);line-height:1.55">${escapeHtml(c[1])}</p></div>`).join('')}</div>`)}`;
      document.getElementById('anAiBtn').onclick = anAskAi; anAiPaintLeft();
    }

    let anAiLeft = null, anAiLimit = 10;
    const anAiLeftTxt = () => LumaPlan.get('insights') === 0 ? 'AI insights are on the Glow and Zenith plans' : anAiLeft == null ? `${anAiLimit} AI insights per day` : `${anAiLeft} of ${anAiLimit} AI insights left today`;
    function anAiPaintLeft() { const el = document.getElementById('anAiLeft'); if (!el) return; el.textContent = anAiLeftTxt(); el.style.color = anAiLeft === 0 ? '#fca5a5' : anAiLeft != null && anAiLeft <= 2 ? '#fcd34d' : 'rgba(255,255,255,0.6)'; const b = document.getElementById('anAiBtn'); if (b && anAiLeft === 0) { b.disabled = true; b.title = 'You have used all your AI insights for today'; } }
    async function anAiCheckLeft() { if (LumaPlan.get('insights') === 0) { anAiLeft = 0; anAiLimit = 0; return anAiPaintLeft(); } anAiLimit = LumaPlan.get('insights') ?? anAiLimit; const r = await lumiCall({ mode: 'chat', check: true, kind: 'insights' }); if (r && r.left != null) { anAiLeft = r.left; anAiLimit = r.limit || anAiLimit; anAiPaintLeft(); } }
    const anAiKey = () => `luma_ai_ins_${LUMA_USER ? LUMA_USER.id : ''}_${hToday()}_${anRange}`;
    function anAiGet() { try { const v = JSON.parse(localStorage.getItem(anAiKey()) || 'null'); return Array.isArray(v) && v.length ? v : null; } catch (e) { return null; } }
    async function anAskAi() {
      const btn = document.getElementById('anAiBtn'); if (!btn || !an) return;
      if (LumaPlan.get('insights') === 0) return planLocked('AI insights', 'the Glow and Zenith plans');
      const cur = anCalc(anKeys(anRange)), prev = anCalc(anKeys(anRange, anRange)), P = v => v == null ? null : Math.round(v * 100);
      const cats = [...cur.cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => [n, Math.round(v)]);
      const metrics = { period_days: anRange, productivity_score_pct: [P(cur.score), P(prev.score)], task_completion_pct: [P(cur.taskRate), P(prev.taskRate)], habit_consistency_pct: [P(cur.habit), P(prev.habit)], health_goal_progress_pct: [P(cur.health), P(prev.health)], tasks_completed: [cur.done, prev.done], spending_rm: [Math.round(cur.spend), Math.round(prev.spend)], income_rm: Math.round(cur.income), top_spending_categories: cats, overdue_open_tasks: an.tasks.filter(t => t.status !== 'done' && t.due_date && t.due_date < hToday()).length, note: 'each pair is [this period, previous period]' };
      btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Thinking…';
      const r = await lumiCall({ mode: 'insights', metrics });
      if (r.left != null) { anAiLeft = r.left; anAiLimit = r.limit || anAiLimit; }
      if (r.insights && r.insights.length) { try { localStorage.setItem(anAiKey(), JSON.stringify(r.insights)); } catch (e) { } paintAnalytics(); }
      else { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Get AI insights'; luAlert((r.error || 'Lumi could not write insights just now.') + (r.detail ? '\n\n' + r.detail.slice(0, 600) : '')); }
    }

    async function loadAnalytics(pg) {
      const range = pg.querySelector('#anRange');
      range.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.n === anRange));
      range.onclick = e => { const b = e.target.closest('button'); if (!b) return; anRange = +b.dataset.n; range.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); paintAnalytics(); };
      const since = hKeyAdd(hToday(), -70);
      const [t, , , h, g] = await Promise.all([LumaTasks.list(), refreshHabits(), loadMoneyData(), LumaHealth.listLogs(since), LumaHealth.getGoals()]);
      an = { tasks: t.error ? [] : t.data, health: h.error ? [] : (h.data || []), goals: g.data };
      paintAnalytics(); anAiCheckLeft();
    }


    WIRE.analytics = function (pg) { return loadAnalytics(pg); };
