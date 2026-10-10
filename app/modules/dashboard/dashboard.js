// LUMA — module: dashboard
    // =====================================================
    //  DASHBOARD — every widget is computed from your real data
    // =====================================================
    let dashGoals = [], dashTasks = [], dashRecHidden = false, dashPrIds = null; // dashPrIds: the priorities shown at the last load — ticked ones stay (crossed out) until the dashboard is reloaded
    const D_PRIO = { high: ['#ef4444', 0], med: ['#f59e0b', 1], low: ['#22c55e', 2] };
    const dashCard = (icon, color, label, value) => `<div style="flex:1;text-align:center;padding:14px 6px;min-width:0;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);"><i class="fa-solid ${icon}" style="color:${color};font-size:1.2rem;"></i><div class="wgt-it" style="margin-top:9px;">${value}</div><div class="wgt-sub" style="margin-top:2px;">${label}</div></div>`;
    const dashChip = (icon, color, text, page) => `<span data-go="${page}" style="cursor:pointer;display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);font-size:0.75rem;color:rgba(255,255,255,0.85);"><i class="${icon}" style="color:${color};"></i> ${text}</span>`;
    const dashRecGone = rec => { try { return localStorage.getItem('luma_rec_x') === new Date().toDateString() + '|' + String(rec[0]).replace(/<[^>]*>/g, ''); } catch (e) { return false; } }; // "Not now" is remembered for today, for that same suggestion
    const dashSet = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };

    // ----- tips of the day: every tip that applies right now is a candidate; one is picked at random and rotates -----
    let dashCtx = null, dashTipId = null;
    const DASH_TIPS = [
      // situational
      ['overdue', c => c.overdue > 0, c => `You have ${c.overdue} overdue task${c.overdue > 1 ? 's' : ''}. Clear one first. It lifts your productivity score fastest.`],
      ['heavy', c => c.load > 6, () => 'Your day is heavy. Block focus time and push the small stuff to tomorrow.'],
      ['dueToday', c => c.dueToday > 0 && c.load <= 6, c => `${c.dueToday} task${c.dueToday > 1 ? 's are' : ' is'} due today. Tick them off from Today's Priorities.`],
      ['clear', c => c.open === 0, () => 'No open tasks. A good moment to plan tomorrow or add a goal.'],
      ['habitsLeft', c => c.habitsLeft > 0, c => `${c.habitsLeft} habit${c.habitsLeft > 1 ? 's' : ''} still to tick today. A quick win before your next task.`],
      ['habitsDone', c => c.habits > 0 && c.habitsLeft === 0, () => 'All habits done for today. Streaks grow one day at a time.'],
      ['noHabits', c => c.habits === 0, () => 'No habits yet. Start with one small daily habit, like 6 hours of sleep.'],
      ['water', c => !c.hasWater, () => 'You have not logged water today. Use the quick-add buttons on the Health page.'],
      ['sleep', c => !c.hasSleep, () => 'Log last night\'s sleep in Health to keep your wellness picture complete.'],
      ['mood', c => !c.hasMood, () => 'How are you feeling? Log your mood in Health to spot patterns over time.'],
      ['budgetNone', c => !c.budget, () => 'Set a monthly budget on the Money page to see how much you have left to spend.'],
      ['budgetOver', c => c.budget && c.left < 0, () => 'You are over budget this month. Review your biggest categories on the Money page.'],
      ['budgetNear', c => c.budget && c.left >= 0 && c.spent / c.budget >= 0.8, () => 'You have used over 80% of your budget. Pause non-essential spending for now.'],
      ['budgetOk', c => c.budget && c.spent / c.budget < 0.5, () => 'You are well within budget this month. Consider moving the extra into savings.'],
      ['billsOver', c => c.billsOver > 0, c => `${c.billsOver} bill${c.billsOver > 1 ? 's are' : ' is'} overdue. Pay and tick ${c.billsOver > 1 ? 'them' : 'it'} off in Bills.`],
      ['noBills', c => c.bills === 0, () => 'Add your regular bills and subscriptions so LUMA can remind you before they are due.'],
      ['noEvents', c => c.events === 0, () => 'Nothing on your calendar today. Block time for focused work or rest.'],
      ['events', c => c.events > 2, c => `${c.events} events today. Leave a gap between them so you can breathe.`],
      ['income', c => !c.income, () => 'Add your salary on the Money page and LUMA will work out your take-home and savings.'],
      // always useful
      ['quick', () => true, () => 'Use Quick Actions to add a task, expense, event or note in two taps.'],
      ['lumi', () => true, () => 'Ask Lumi to add things for you, for example "Add dentist on Friday 3pm" or "Log 500ml water".'],
      ['lumiQ', () => true, () => 'Ask Lumi questions about your own data, like "How is my spending this month?".'],
      ['insights', () => true, () => 'Open Analytics and tap "Get AI insights" for a short summary of your week.'],
      ['reminders', () => true, () => 'Choose which reminders you get, and when, in Settings → Reminders.'],
      ['push', () => true, () => 'Turn on push notifications in Settings so reminders reach you even when LUMA is closed.'],
      ['priority', () => true, () => 'Mark your top tasks High priority. They float to the top of Today\'s Priorities.'],
      ['dueDate', () => true, () => 'Give every task a due date. Overdue tasks are highlighted so nothing slips.'],
      ['kanban', () => true, () => 'Tap the status chip on a task card to move it between To do, In progress and Done.'],
      ['calendarView', () => true, () => 'Switch the Calendar between Day, Week, Month and Year, and click any event for details.'],
      ['repeat', () => true, () => 'Set an event to repeat daily, weekly, monthly or yearly so you only create it once.'],
      ['notes', () => true, () => 'Tag your notes and attach documents to them, then filter by tag to find things fast.'],
      ['docs', () => true, () => 'Store important documents in LUMA and share them with your contacts.'],
      ['goals', () => true, () => 'Break a big goal into a measurable target and update your progress as you go.'],
      ['habitBack', () => true, () => 'Forgot to tick a habit? You can fill in the last 14 days on the Habits page.'],
      ['streak', () => true, () => 'A missed day does not end a weekly or monthly habit. Only the period counts.'],
      ['subs', () => true, () => 'Review your subscriptions every few months and pause the ones you no longer use.'],
      ['health', () => true, () => 'Small health logs add up. Quick-add water and steps through the day.'],
      ['contacts', () => true, () => 'Add contacts to chat, share documents and send a friendly nudge.'],
      ['timezone', () => true, () => 'Travelling? Change your time zone in Edit profile and every reminder follows.'],
      ['background', () => true, () => 'Make LUMA yours: pick a wallpaper and theme in Settings.'],
      ['focus', () => true, () => 'Do your hardest task first, while your energy is highest.'],
      ['breaks', () => true, () => 'Take a short break every hour. Your focus will thank you.'],
      ['plan', () => true, () => 'Spend two minutes tonight planning tomorrow\'s top three tasks.'],
      ['review', () => true, () => 'Check Analytics once a week to see what is working and what is not.'],
    ];
    function showDashTip(rotate) {
      const el = document.getElementById('dashTip'); if (!el || !dashCtx) return;
      const ok = DASH_TIPS.filter(t => { try { return t[1](dashCtx); } catch (e) { return false; } });
      const cur = ok.find(t => t[0] === dashTipId);
      if (cur && !rotate) { el.innerHTML = `<strong>Tip for today:</strong> ${escapeHtml(cur[2](dashCtx))}`; return; }
      const pool = ok.filter(t => t[0] !== dashTipId), pick = (pool.length ? pool : ok)[Math.floor(Math.random() * (pool.length ? pool : ok).length)];
      if (!pick) return;
      dashTipId = pick[0];
      const apply = () => { el.innerHTML = `<strong>Tip for today:</strong> ${escapeHtml(pick[2](dashCtx))}`; el.style.opacity = ''; };
      if (rotate) { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(apply, 300); } else apply();
    }
    setInterval(() => { if (document.getElementById('page-dashboard').classList.contains('active') && !document.hidden) showDashTip(true); }, 20000);

    // Small pills in the greeting for things that are close to their time: reminders later today, bills and subscriptions due in the next 3 days,
    // habits and water still to do in the evening, goals ending this week. Nothing is shown when nothing is near; the nearest five are kept (today before tomorrow before later).
    function dashNearChips(today, rows, habitsLeft) {
      const out = [], nowM = mytNowMin(), hour = Math.floor(nowM / 60), esc = escapeHtml;
      const days = d => bDays(d, today), when = n => n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
      try {   // reminders that will fire later today
        const rl = (typeof REMS !== 'undefined' ? REMS : []).filter(r => r.active && typeof remNext === 'function' && remNext(r) === today).sort((a, b) => a.remind_time.localeCompare(b.remind_time));
        if (rl.length) { const mins = +rl[0].remind_time.slice(0, 2) * 60 + +rl[0].remind_time.slice(3, 5) - nowM; out.push({ rank: Math.max(0, mins) / 60, icon: 'fa-solid fa-bell', color: '#fcd34d', page: 'reminders', text: rl.length === 1 ? `${esc(rl[0].title)} at ${fmt12(rl[0].remind_time)}` : `${rl.length} reminders later today` }); }
      } catch (e) { }
      try {   // bills (not subscriptions) due today or within 3 days
        const bl = rows.filter(r => r.status !== 'paid' && r.status !== 'overdue' && r.b.category !== 'Subscription' && days(r.due) <= 3);
        if (bl.length) { const d = Math.min(...bl.map(r => days(r.due))); out.push({ rank: d * 24, icon: 'fa-solid fa-file-invoice-dollar', color: '#fdba74', page: 'bills', text: bl.length === 1 ? `${esc(bl[0].b.name)} (${bRM(bl[0].amount)}) due ${when(days(bl[0].due))}` : `${bl.length} bills due in the next 3 days` }); }
      } catch (e) { }
      try {   // subscriptions renewing within 3 days
        const sl = (typeof BILLS !== 'undefined' && typeof bNext === 'function' ? BILLS : []).filter(b => b.category === 'Subscription' && b.active !== false).map(b => ({ b, d: bNext(b, today) })).filter(x => x.d && days(x.d) <= 3).sort((a, c) => a.d.localeCompare(c.d));
        if (sl.length) out.push({ rank: days(sl[0].d) * 24 + 1, icon: 'fa-solid fa-repeat', color: '#c4b5fd', page: 'subscriptions', text: sl.length === 1 ? `${esc(sl[0].b.name)} renews ${when(days(sl[0].d))} (${bRM(sl[0].b.amount)})` : `${sl.length} subscriptions renew in the next 3 days` });
      } catch (e) { }
      try {   // evening: habits not ticked, water below the goal
        if (hour >= 17 && habitsLeft.length) out.push({ rank: 6, icon: 'fa-solid fa-seedling', color: '#86efac', page: 'habits', text: `${habitsLeft.length} habit${habitsLeft.length > 1 ? 's' : ''} left to tick today` });
        const goal = an && an.goals ? Number(an.goals.water_ml) : 0, log = (an && an.health ? an.health : []).find(r => r.log_date === today) || {}, have = Number(log.water_ml) || 0;
        if (hour >= 16 && goal && have < goal) out.push({ rank: 7, icon: 'fa-solid fa-droplet', color: '#38bdf8', page: 'health', text: `${(goal - have) >= 1000 ? ((goal - have) / 1000).toFixed(1).replace(/\.0$/, '') + ' L' : (goal - have) + ' ml'} of water to go` });
      } catch (e) { }
      try {   // goals that end within a week and are not finished
        const gl = (dashGoals || []).filter(g => g.deadline && !g.completed_at && days(g.deadline) >= 0 && days(g.deadline) <= 7 && !(Number(g.target_value) && Number(g.current_value) >= Number(g.target_value))).sort((a, c) => a.deadline.localeCompare(c.deadline));
        if (gl.length) out.push({ rank: days(gl[0].deadline) * 24 + 2, icon: 'fa-solid fa-bullseye', color: '#f9a8d4', page: 'goals', text: gl.length === 1 ? `Goal “${esc(gl[0].title)}” ends ${when(days(gl[0].deadline))}` : `${gl.length} goals end this week` });
      } catch (e) { }
      return out.sort((a, b) => a.rank - b.rank).slice(0, 5).map(c => dashChip(c.icon, c.color, c.text, c.page)).join('');
    }

    // the lists in the cards scroll after about five rows; a soft fade at the bottom says there is more (it goes away at the end of the list)
    function dashFade(el) {
      if (!el) return;
      const f = () => el.classList.toggle('more', el.scrollHeight - el.scrollTop - el.clientHeight > 4);
      el.onscroll = f; f();
    }
    function paintDashboard() {
      if (!document.getElementById('dashChips')) return;
      if (typeof wkPaintDashCard === 'function') wkPaintDashCard();
      luPaintBusy('dashBusy', { slim: true });
      const today = hToday(), T = dashTasks, open = T.filter(t => t.status !== 'done');
      const overdue = open.filter(t => t.due_date && t.due_date < today), dueToday = open.filter(t => t.due_date === today);
      const hid = [...cHidden]; cHidden.clear(); // the calendar's category filter shouldn't hide things here
      const todayItems = cItemsOn(today); hid.forEach(c => cHidden.add(c));
      const events = todayItems.filter(i => i.type === 'event');
      const first = bFirst(today), txns = mTxns(first);
      const spent = txns.filter(t => t.kind === 'expense').reduce((a, t) => a + t.amount, 0), income = txns.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0);
      const budget = Number(MSET.monthly_budget) || 0, left = budget - spent;
      const habitsLeft = HABITS.filter(h => h.period === 'daily' && hSched(h, today) && hBorn(h) <= today && !hLogged(h, today));
      const rows = [...bRows(first), ...bRows(bAddMonths(first, 1))].filter(r => r.status !== 'paid');
      const billsOver = rows.filter(r => r.status === 'overdue');

      // greeting chips
      const urgent = overdue.length + dueToday.length;
      dashSet('dashChips', [
        dashChip('fa-solid fa-fire', '#fca5a5', urgent ? `${urgent} task${urgent > 1 ? 's' : ''} due or overdue` : 'No tasks due today', 'tasks'),
        dashChip('fa-regular fa-calendar', '#93c5fd', events.length ? `${events.length} event${events.length > 1 ? 's' : ''} today` : 'No events today', 'calendar'),
        budget ? dashChip('fa-solid fa-wallet', left < 0 ? '#fca5a5' : '#6ee7b7', left < 0 ? `${bRM(-left)} over budget` : `${bRM(left)} left to spend`, 'money') : dashChip('fa-solid fa-wallet', '#6ee7b7', `${bRM(spent)} spent this month`, 'money'),
        dashNearChips(today, rows, habitsLeft),
        dashAddonChip() + dashInstallChip()
      ].join(''));

      // suggestion
      let rec = null;
      if (overdue.length) rec = [`You have ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}. Start with <span style="color:#c4b5fd;">${escapeHtml(overdue.sort((a, b) => a.due_date.localeCompare(b.due_date))[0].title)}</span>.`, 'tasks', 'Open tasks'];
      else if (billsOver.length) rec = [`${billsOver.length} bill${billsOver.length > 1 ? 's are' : ' is'} overdue. Pay <span style="color:#c4b5fd;">${escapeHtml(billsOver[0].b.name)}</span> (${bRM(billsOver[0].amount)}) first.`, 'bills', 'Open bills'];
      else if (dueToday.length > 5) rec = [`${dueToday.length} tasks are due today. Move the less important ones to another day to protect your focus.`, 'tasks', 'Open tasks'];
      else if (habitsLeft.length) rec = [`${habitsLeft.length} habit${habitsLeft.length > 1 ? 's' : ''} still to tick today, including <span style="color:#c4b5fd;">${escapeHtml(habitsLeft[0].name)}</span>.`, 'habits', 'Open habits'];
      const recEl = document.getElementById('dashRec');
      const aiOn = prefOn('ai', true), tipCard = document.querySelector('#page-dashboard .tip-card'); if (tipCard) tipCard.style.display = aiOn ? '' : 'none';
      if (recEl) { recEl.style.display = rec && !dashRecHidden && !dashRecGone(rec) && aiOn ? 'flex' : 'none'; if (rec) { document.getElementById('dashRecText').innerHTML = rec[0]; recEl.dataset.go = rec[1]; recEl.dataset.key = String(rec[0]).replace(/<[^>]*>/g, ''); recEl.querySelector('#dashRecGo span').textContent = rec[2]; } }

      // schedule
      dashSet('dashSched', todayItems.length ? todayItems.map(it => `<div data-cal="${it.type}:${it.id}" style="display:flex;gap:11px;cursor:pointer;"><span class="wgt-time" style="width:56px;flex-shrink:0;padding-top:9px;">${it.time ? t12(it.time) : it.type === 'event' ? 'All day' : it.type === 'bill' ? 'Bill' : 'Task'}</span><span style="width:3px;border-radius:3px;background:${it.color};margin:3px 0;"></span><div style="flex:1;min-width:0;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);"><div class="wgt-it">${escapeHtml(it.title)}</div><div class="wgt-sub" style="margin-top:2px;">${escapeHtml(cTimeLabel(it))}${it.type === 'event' ? ' · ' + escapeHtml(it.cat) : ''}</div></div></div>`).join('') : '<div class="wgt-sub lu-empty">Nothing scheduled today. Add an event on the Calendar.</div>');

      // priorities: 8 open tasks — overdue ones first (oldest first), then high priority first (nearest due date first), then medium, then low
      const od = t => t.due_date && t.due_date < today ? 0 : 1;
      if (!dashPrIds) dashPrIds = open.slice().sort((a, b) => od(a) - od(b) || (od(a) === 0 ? a.due_date.localeCompare(b.due_date) : 0) || (D_PRIO[a.priority] || D_PRIO.med)[1] - (D_PRIO[b.priority] || D_PRIO.med)[1] || (a.due_date || '9999').localeCompare(b.due_date || '9999')).slice(0, 15).map(t => t.id);
      const prAll = dashPrIds.map(id => T.find(t => t.id === id)).filter(Boolean);
      const pr = [...prAll.filter(t => t.status !== 'done'), ...prAll.filter(t => t.status === 'done')]; // crossed-out ones sink below the rest (list order otherwise unchanged)
      dashSet('dashTasks', pr.length ? pr.map(t => { const dl = t.due_date && t.status !== 'done' ? (t.due_date < today ? '<span style="color:#fca5a5;font-size:0.68rem;">overdue</span>' : t.due_date === today ? '<span style="color:#fcd34d;font-size:0.68rem;">today</span>' : `<span style="color:rgba(255,255,255,0.45);font-size:0.68rem;">${hKeyLabel(t.due_date)}</span>`) : ''; return `<div class="check-row ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}"><span class="check-box"><i class="fa-solid fa-check"></i></span><span class="ct"><span class="ct-t" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>${dl}</span><span class="prio-dot" style="background:${(D_PRIO[t.priority] || D_PRIO.med)[0]};"></span></div>`; }).join('') : '<div class="wgt-sub lu-empty">No open tasks. Enjoy the calm.</div>');

      // money
      const bp = budget ? Math.min(100, Math.round(spent / budget * 100)) : 0, ip = income ? Math.min(100, Math.round(spent / income * 100)) : 0;
      dashSet('dashMoney', `<div style="display:flex;justify-content:space-between;margin-bottom:0.7rem;"><div><div class="wgt-sub">Spent</div><div class="wgt-num" style="margin-top:4px;">${bRM(spent)}</div></div><div style="text-align:right;"><div class="wgt-sub">${budget ? 'Left in budget' : 'Budget'}</div><div class="wgt-num" style="margin-top:4px;color:${budget && left < 0 ? '#fca5a5' : '#6ee7b7'};">${budget ? (left < 0 ? '−' : '') + bRM(Math.abs(left)) : 'Not set'}</div></div></div><div class="pbar" style="margin-bottom:1.1rem;"><span style="width:${bp}%;${left < 0 ? 'background:#ef4444;' : ''}"></span></div><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;"><span class="wgt-sub">Income this month</span><span class="wgt-sub" style="color:rgba(255,255,255,0.8);">${bRM(income)}</span></div><div class="pbar"><span style="width:${ip}%;background:linear-gradient(90deg,#22c55e,#10b981);"></span></div>`);

      // wellness (today's log)
      const log = (an && an.health ? an.health : []).find(r => r.log_date === today) || {};
      dashSet('dashWell', dashCard('fa-moon', '#a78bfa', 'Sleep', log.sleep_hours != null ? Number(log.sleep_hours) + 'h' : '—') + dashCard('fa-droplet', '#38bdf8', 'Water', log.water_ml != null ? (log.water_ml / 1000).toFixed(1).replace(/\.0$/, '') + 'L' : '—') + dashCard('fa-shoe-prints', '#34d399', 'Steps', log.steps != null ? Number(log.steps).toLocaleString() : '—') + dashCard(log.mood ? MOOD_ICO[log.mood - 1] : 'fa-face-meh-blank', log.mood ? MOOD_COL[log.mood - 1] : 'rgba(255,255,255,0.3)', 'Mood', log.mood ? MOOD_NAME[log.mood - 1] : '—'));

      // productivity (last 7 days vs the 7 before)
      if (an) {
        const cur = anCalc(anKeys(7)), prev = anCalc(anKeys(7, 7)), pct = v => v == null ? '—' : Math.round(v * 100) + '%', w = v => v == null ? 0 : Math.round(v * 100);
        dashSet('dashProdPill', cur.score != null && prev.score != null ? `<span class="pill ${cur.score >= prev.score ? 'pill-low' : 'pill-high'}">${cur.score >= prev.score ? '+' : ''}${Math.round((cur.score - prev.score) * 100)}%</span>` : '');
        dashSet('dashProd', `<div style="display:flex;align-items:center;gap:16px;"><div style="text-align:center;flex-shrink:0;"><div class="wgt-num" style="font-size:1.9rem;">${cur.score == null ? '—' : Math.round(cur.score * 100)}</div><div class="wgt-sub" style="margin-top:4px;">score</div></div><div style="flex:1;"><div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span class="wgt-sub">Task completion</span><span class="wgt-sub" style="color:rgba(255,255,255,0.85);">${pct(cur.taskRate)}</span></div><div class="pbar" style="margin-bottom:0.8rem;"><span style="width:${w(cur.taskRate)}%;"></span></div><div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span class="wgt-sub">Habit consistency</span><span class="wgt-sub" style="color:rgba(255,255,255,0.85);">${pct(cur.habit)}</span></div><div class="pbar"><span style="width:${w(cur.habit)}%;background:linear-gradient(90deg,#22c55e,#10b981);"></span></div></div></div>`);
      }

      // reminders: next unpaid bills & subscriptions
      const billUp = rows.map(r => { const d = bDays(r.due, today), sub = r.b.category === 'Subscription', [, icon] = bCat(r.b.category); return { key: r.due, time: '99:99', icon, name: r.b.name, d, price: bRM(r.amount), label: d < 0 ? 'Overdue ' + (-d) + 'd' : d === 0 ? 'Due today' : (sub ? 'Renews in ' : 'Due in ') + d + 'd' }; });
      const remUp = REMS.map(r => ({ r, k: remNext(r) })).filter(x => x.k && bDays(x.k, today) <= 14).map(({ r, k }) => { const d = bDays(k, today); return { key: k, time: r.remind_time, icon: 'fa-bell', name: r.title, d, price: fmt12(r.remind_time), label: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : 'In ' + d + 'd' }; });
      const up = [...billUp, ...remUp].sort((a, b) => a.key.localeCompare(b.key) || a.time.localeCompare(b.time)).slice(0, 12);
      dashSet('dashRem', up.length ? up.map(x => `<div class="reminder-item" style="font-size:0.78rem;padding:0.5rem 0;"><span class="title" style="color:#fff"><i class="fa-solid ${x.icon}" style="color:rgba(255,255,255,0.7)"></i> ${escapeHtml(x.name)}</span><span><span class="meta" style="font-weight:600;color:${x.d < 0 ? '#fca5a5' : x.d === 0 ? '#fcd34d' : 'rgba(255,255,255,0.75)'}">${x.label}</span> <span class="price">${x.price}</span></span></div>`).join('') : '<div class="wgt-sub lu-empty">No reminders, bills or subscriptions coming up.</div>');
      ['dashSched', 'dashTasks', 'dashRem', 'dashHabits'].forEach(id => dashFade(document.getElementById(id)));

      // overview
      const load = overdue.length + dueToday.length, lvl = load <= 3 ? ['Low', '✅', '#6ee7b7'] : load <= 6 ? ['Medium', '🟡', '#fcd34d'] : ['High', '⚠️', '#fca5a5'];
      dashSet('dashOver', `<div class="stat-item" style="font-size:0.78rem;"><span class="stat-label">Events</span><span class="stat-value">${events.length}</span></div><div class="stat-item" style="font-size:0.78rem;"><span class="stat-label">Open tasks</span><span class="stat-value">${open.length}</span></div><div class="stat-item" style="font-size:0.78rem;"><span class="stat-label">Due Today</span><span class="stat-value">${dueToday.length}</span></div><div class="stat-item budget" style="font-size:0.78rem;"><span class="stat-label">${budget ? 'Left in Budget' : 'Spent'}</span><span class="stat-value">${budget ? (left < 0 ? '−' : '') + bRM(Math.abs(left)) : bRM(spent)}</span></div><div class="stat-item workload"><span class="stat-label">Workload Level</span><span class="stat-value" style="color:${lvl[2]};font-size:0.78rem">${lvl[1]} ${lvl[0]}</span></div>`);

      // tip: chosen at random from the ones that fit right now (see DASH_TIPS)
      dashCtx = { overdue: overdue.length, dueToday: dueToday.length, open: open.length, load, habits: HABITS.length, habitsLeft: habitsLeft.length, budget, left, spent, billsOver: billsOver.length, bills: BILLS.length, events: events.length, hasWater: log.water_ml != null, hasSleep: log.sleep_hours != null, hasMood: log.mood != null, income };
      showDashTip(false);
      paintDashHabits();
    }

    // Work and Study keep what you create in them out of Personal until you choose to show it: a chip beside the others says so, with a way to switch it on
    const DASH_SPACES = { work: ['Work', 'fa-briefcase'], study: ['Study', 'fa-graduation-cap'] };
    const dashAddonChip = () => Object.keys(DASH_SPACES).filter(k => LumaPlan.hasAddon(k) && !prefOn('show_' + k + '_personal', false) && !prefOn(k + '_note_dismissed', false))
      .map(k => `<span class="dash-addon" title="${DASH_SPACES[k][0]} items are kept out of Personal until you show them"><i class="fa-solid ${DASH_SPACES[k][1]}"></i> ${DASH_SPACES[k][0]} is hidden here<button type="button" data-addon-show="${k}">Show</button><button type="button" class="x" data-addon-dismiss="${k}" title="Don\'t show this again" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button></span>`).join('');
    // on a phone or tablet: offer to add LUMA to the home screen (until it is installed or the person closes it)
    const dashInstallChip = () => { let gone = false; try { gone = !!localStorage.getItem('luma_install_dismissed'); } catch (e) { }
      return window.LumaInstall && LumaInstall.isMobile() && !LumaInstall.installed() && !gone ? `<span class="dash-addon dash-install"><i class="fa-solid fa-mobile-screen-button"></i> Add LUMA to your home screen<button type="button" data-install-go>${LumaInstall.canPrompt() ? 'Install' : 'How'}</button><button type="button" class="x" data-install-dismiss title="Not now" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button></span>` : ''; };
    document.addEventListener('luma-install', () => { if (document.getElementById('page-dashboard') && typeof paintDashboard === 'function') paintDashboard(); });
    document.getElementById('page-dashboard').addEventListener('click', async e => {
      if (e.target.closest('[data-install-go]')) return lumaInstallNow();
      if (e.target.closest('[data-install-dismiss]')) { try { localStorage.setItem('luma_install_dismissed', '1'); } catch (x) { } return paintDashboard(); }
      const no = e.target.closest('[data-addon-dismiss]'); if (no) { await setLumaPref(no.dataset.addonDismiss + '_note_dismissed', true); return paintDashboard(); }
      const yes = e.target.closest('[data-addon-show]'); if (!yes) return;
      const k = yes.dataset.addonShow; await setLumaPref('show_' + k + '_personal', true); if (k === 'study') await sdEnsureLoaded(); await loadDashboard().catch(() => { });
      flashToast(DASH_SPACES[k][0] + ' is now shown in Personal', 'You can change this in Settings → Preferences', DASH_SPACES[k][1], '#34d399');
    });
    async function loadDashboard() {
      const [t, ev, rm] = await Promise.all([LumaTasks.list(), LumaEvents.list(), LumaReminders.list(), refreshHabits(), loadMoneyData(), LumaHealth.listLogs(hKeyAdd(hToday(), -70)).then(h => { an = { ...(an || {}), health: h.error ? [] : (h.data || []) }; }), LumaHealth.getGoals().then(g => { an = { ...(an || {}), goals: g.data }; }), (LumaPlan.hasAddon('study') && prefOn('show_study_personal', false)) ? sdEnsureLoaded() : null, LumaGoals.list().then(r => { dashGoals = r.error ? [] : (r.data || []); }), LumaEvents.invited().then(r => { CINV = r.error ? [] : (r.data || []); })]);
      if (!rm.error) REMS = rm.data || [];
      dashTasks = t.error ? [] : t.data; CTASKS = dashTasks; if (!ev.error) CEV = ev.data || [];
      an = { ...(an || {}), tasks: dashTasks };
      dashPrIds = null; // a fresh load picks the top 8 again
      dashTipId = null; // ...and a new random tip
      paintDashboard();
    }

    // widgets are clickable: chips and suggestion open their page, schedule rows open the calendar item, priorities tick a task off
    document.getElementById('page-dashboard').addEventListener('click', async e => {
      const go = e.target.closest('[data-go]');
      if (go && !e.target.closest('#dashRecNo')) { if (go.id === 'dashRec' && !e.target.closest('#dashRecGo')) return; return goTo(go.dataset.go); }
      if (e.target.closest('#dashRecNo')) { dashRecHidden = true; try { localStorage.setItem('luma_rec_x', new Date().toDateString() + '|' + (document.getElementById('dashRec').dataset.key || '')); } catch (x) { } document.getElementById('dashRec').style.display = 'none'; return; }
      const sc = e.target.closest('[data-cal]');
      if (sc) { const [type, id] = sc.dataset.cal.split(':'); goTo('calendar'); setTimeout(() => calOpenItem(type, id, hToday()), 400); return; }
      const row = e.target.closest('#dashTasks .check-row');
      if (row) {
        const t = dashTasks.find(x => String(x.id) === row.dataset.id); if (!t) return;
        const status = t.status === 'done' ? (t._was && t._was !== 'done' ? t._was : 'todo') : 'done', old = { status: t.status, completed_at: t.completed_at };
        if (status === 'done') t._was = t.status; // un-ticking puts it back where it was (To do / In progress)
        t.status = status; t.completed_at = status === 'done' ? new Date().toISOString() : null; paintDashboard();
        const { data, error } = await LumaTasks.update(t.id, { status });
        if (error) { Object.assign(t, old); paintDashboard(); return luAlert('Could not update the task: ' + error.message); }
        Object.assign(t, data);
        paintDashboard();
      }
    });


    // =====================================================
    //  DASHBOARD INTERACTIONS
    // =====================================================

    // AI assistant on dashboard: jump to the full chat page
    (function initDashAI() {
      const ai = document.querySelector('#page-dashboard .assistant-input');
      if (!ai) return;
      const badges = document.querySelectorAll('#page-dashboard .suggestion-badge');
      const open = () => document.querySelector('.menu[data-page="assistant"]')?.click();
      ai.querySelector('.send').addEventListener('click', open);
      ai.style.cursor = 'pointer';
      ai.addEventListener('click', open);
      badges.forEach(b => b.addEventListener('click', open));
    })();
    // Quick actions route to modules
    // when a popup closes while you're on the dashboard, refresh the widgets so the new task / expense / event shows up
    ['taskOverlay', 'moneyEntryOverlay', 'calEventOverlay'].forEach(id => {
      const ov = document.getElementById(id); if (!ov) return;
      let was = false;
      new MutationObserver(() => { const on = ov.classList.contains('open'); if (was && !on && document.getElementById('page-dashboard').classList.contains('active')) loadDashboard().catch(() => { }); was = on; }).observe(ov, { attributes: true, attributeFilter: ['class'] });
    });
    (function initQuick() {
      // each button opens its own popup right away (Notes opens its editor once that page is ready)
      const when = (test, fn, n = 40) => { if (test()) return fn(); if (n > 0) setTimeout(() => when(test, fn, n - 1), 100); };
      const acts = {
        'Add Task': () => openTaskModal(null),
        'Log Expense': () => openEntryModal(null, 'expense'),
        'New Event': () => openCalModal(null, mytDayKey(Date.now())),
        'Add Note': () => { // set the Notes page up in the background (not shown) so its editor opens right here
          const pg = document.getElementById('page-notes'); pg.innerHTML = MODULES.notes(); rendered.notes = true; wireModule('notes');
          when(() => pg.querySelector('#newNoteBtn') && pg.querySelector('#newNoteBtn').onclick, () => pg.querySelector('#newNoteBtn').click(), 80);
        },
        'AI Chat': () => openChat()
      };
      document.querySelectorAll('#page-dashboard .quick-btn').forEach(q => q.addEventListener('click', () => { const a = acts[q.textContent.trim()]; if (a) a(); }));
    })();
    ;
    // dashboard reminders / overview view-all → route
    document.querySelectorAll('#page-dashboard .action, #page-dashboard .box-head a').forEach(el => {
      if (/view all/i.test(el.textContent)) el.style.cursor = 'pointer', el.addEventListener('click', () => document.querySelector('.menu[data-page="subscriptions"]')?.click());
    });


    // widget shortcut links → modules
    const dashNav = { 'nav-cal': 'calendar', 'nav-tasks': 'tasks', 'nav-money': 'money', 'nav-habits': 'habits', 'nav-health': 'health', 'nav-subs': 'subscriptions' };
    Object.entries(dashNav).forEach(([cls, key]) => {
      document.querySelectorAll('#page-dashboard .' + cls).forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => document.querySelector(`.menu[data-page="${key}"]`)?.click());
      });
    });
