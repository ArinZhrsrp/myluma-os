// LUMA — module: Work Gantt chart and Timeline (two more ways to look at the tasks in Tasks)
    // Gantt: a bar for every task from its start date to its end date on a date axis, grouped by project (or by phase / folder for one project).
    // Timeline: the same tasks as a vertical list of what happens when, with project deadlines as milestones.
    // Both draw from WK.tasks (already filtered by the project and "Assigned to me" chips) and open the task when tapped.
    const WKG = { zoom: 'month' };
    const WKG_DAY = { week: 38, month: 16, quarter: 5 };   // pixels per day
    const wkDn = k => Math.round(Date.parse(k + 'T00:00:00Z') / 864e5);
    const wkDk = n => new Date(n * 864e5).toISOString().slice(0, 10);
    const wkMon = n => new Date(n * 864e5).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    // the first and last day a task covers: start..end, or just its one date
    const wkSpan = t => { const a = t.start_date || t.due_date, b = t.due_date || t.start_date; return a ? [wkDn(a), wkDn(b) >= wkDn(a) ? wkDn(b) : wkDn(a)] : null; };
    const wkProg = t => { const s = Array.isArray(t.checklist) ? t.checklist : []; return t.status === 'done' ? 1 : s.length ? s.filter(x => x.d).length / s.length : t.status === 'doing' ? 0.4 : t.status === 'review' ? 0.8 : 0; };

    function wkGanttView(sel, tasks) {
      const day = WKG_DAY[WKG.zoom] || 16, today = wkDn(wkToday()), dated = tasks.filter(wkSpan), undated = tasks.filter(t => !wkSpan(t));
      const projs = sel ? [wkProj(sel)] : WK.projects.filter(p => dated.some(t => t.project_id === p.id));
      const deadlines = projs.filter(p => p && p.deadline && p.status === 'active');
      if (!dated.length && !deadlines.length) return card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-chart-gantt"></i></div><div class="h-empty-t">Nothing to draw yet</div><div class="h-empty-s">Give tasks a start and an end date and they appear here as bars.${undated.length ? ` ${undated.length} task${undated.length === 1 ? ' has' : 's have'} no dates.` : ''}</div></div>`);
      let lo = Math.min(today, ...dated.map(t => wkSpan(t)[0]), ...deadlines.map(p => wkDn(p.deadline))) - 3, hi = Math.max(today, ...dated.map(t => wkSpan(t)[1]), ...deadlines.map(p => wkDn(p.deadline))) + 7;
      if (hi - lo < 28) hi = lo + 28;
      const days = hi - lo + 1, width = days * day;
      // the header: months on top, then a tick per day (week zoom), per Monday (month zoom) or nothing (quarter zoom)
      let months = '', ticks = ''; for (let n = lo; n <= hi;) { const d = new Date(n * 864e5), end = Math.min(hi, Math.round(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 864e5) - 1); months += `<div class="wk-gm" style="left:${(n - lo) * day}px;width:${(end - n + 1) * day}px">${wkMon(n)}</div>`; n = end + 1; }
      for (let n = lo; n <= hi; n++) { const dow = new Date(n * 864e5).getUTCDay(); if (WKG.zoom === 'week' || (WKG.zoom === 'month' && dow === 1)) ticks += `<span class="wk-gt ${dow === 0 || dow === 6 ? 'we' : ''}" style="left:${(n - lo) * day}px;width:${day}px">${new Date(n * 864e5).getUTCDate()}</span>`; }
      const grid = `<div class="wk-gtoday" style="left:calc(var(--gl) + ${(today - lo) * day + day / 2}px)"></div>`;
      const bar = t => { const [a, b] = wkSpan(t), st = wkStatus(t.status), p = wkProj(t.project_id), can = wkCanEdit(p), late = t.status !== 'done' && b < today, one = a === b && !t.start_date, left = (a - lo) * day, w = Math.max((b - a + 1) * day, 10), pr = wkProg(t);
        return one ? `<button type="button" class="wk-gms ${late ? 'late' : ''} ${can ? 'mv' : ''}" data-gtask="${t.id}" ${can ? 'data-gdrag="move"' : ''} style="left:${left + day / 2 - 7}px;--c:${st[2]}" title="${escapeHtml(t.title)} · due ${wkFmt(t.due_date)}"></button>`
          : `<button type="button" class="wk-gbar ${late ? 'late' : ''} ${t.status === 'done' ? 'done' : ''} ${can ? 'mv' : ''}" data-gtask="${t.id}" ${can ? 'data-gdrag="move"' : ''} style="left:${left}px;width:${w}px;--c:${st[2]}" title="${escapeHtml(t.title)} · ${wkFmt(t.start_date || t.due_date)} → ${wkFmt(t.due_date || t.start_date)} · ${st[1]}"><i style="width:${Math.round(pr * 100)}%"></i><span>${w > 70 ? escapeHtml(t.title) : ''}</span>${can ? '<b class="wk-gh l" data-gdrag="start"></b><b class="wk-gh r" data-gdrag="end"></b>' : ''}</button>`; };
      let y = 0, ypos = {};   // the top of each task row, to draw the links between them
      const row = (label, sub, inner, cls = '') => { const out = `<div class="wk-grow ${cls}"><div class="wk-glab" ${cls === 't' ? '' : ''}>${label}${sub ? `<small>${sub}</small>` : ''}</div><div class="wk-gtrack" style="width:${width}px">${inner}</div></div>`; y += cls === 'h' ? 28 : 38; return out; };
      const trow = t => { ypos[t.id] = y; return row(escapeHtml(t.title), `${(wkProj(t.project_id) || {}).name || ''}${wkWho(t).length ? ' · ' + escapeHtml(wkWho(t).join(', ')) : ''}`, bar(t), 't')  .replace('class="wk-glab"', `class="wk-glab" data-gtask="${t.id}"`); };
      const sortT = (a, b) => wkSpan(a)[0] - wkSpan(b)[0] || wkSpan(a)[1] - wkSpan(b)[1];
      let body = '';
      projs.forEach(p => { if (!p) return; const mine = dated.filter(t => t.project_id === p.id);
        body += row(`<span class="wk-gdot" style="background:${p.color}"></span>${escapeHtml(p.name)}`, p.client ? escapeHtml(p.client) : '', p.deadline && p.status === 'active' ? `<span class="wk-gflag" style="left:${(wkDn(p.deadline) - lo) * day + day / 2 - 6}px" title="Project deadline · ${wkFmt(p.deadline)}"><i class="fa-solid fa-flag"></i></span>` : '', 'g');
        const fl = wkFolders(p.id);
        if (sel && fl.length) { fl.forEach(f => { const ts = mine.filter(t => t.folder_id === f.id).sort(sortT); if (ts.length) { body += row(`<span class="wk-gph">${escapeHtml(f.name)}</span>`, '', '', 'h'); body += ts.map(trow).join(''); } });
          const rest = mine.filter(t => !fl.some(f => f.id === t.folder_id)).sort(sortT); if (rest.length) { body += row('<span class="wk-gph">Not in a ' + wkKindWord(p).toLowerCase() + '</span>', '', '', 'h'); body += rest.map(trow).join(''); } }
        else body += mine.sort(sortT).map(trow).join(''); });
      // arrows from the end of a task to the start of the task that waits for it (red and dashed when it starts too early)
      const byId = Object.fromEntries(dated.map(t => [t.id, t])); let paths = '';
      WK.links.forEach(l => { const p = byId[l.depends_on], c = byId[l.task_id]; if (!p || !c || ypos[p.id] == null || ypos[c.id] == null) return;
        const x1 = (wkSpan(p)[1] - lo + 1) * day, y1 = ypos[p.id] + 19, x2 = (wkSpan(c)[0] - lo) * day, y2 = ypos[c.id] + 19, bad = x2 < x1 && p.status !== 'done', arrow = `${x2},${y2} ${x2 - 6},${y2 - 4} ${x2 - 6},${y2 + 4}`;
        const d = x2 >= x1 + 16 ? `M${x1},${y1} H${x1 + 8} V${y2} H${x2}` : `M${x1},${y1} H${x1 + 8} V${y1 + (y2 >= y1 ? 19 : -19)} H${x2 - 8} V${y2} H${x2}`;
        paths += `<path d="${d}" class="${bad ? 'bad' : ''}"/><polygon points="${arrow}" class="${bad ? 'bad' : ''}"/>`; });
      const links = paths ? `<svg class="wk-glinks" style="left:var(--gl)" width="${width}" height="${y}" aria-hidden="true">${paths}</svg>` : '';
      const zoom = `<div class="wk-gz"><span>Zoom</span>${['week', 'month', 'quarter'].map(z => `<button type="button" data-gz="${z}" class="${WKG.zoom === z ? 'on' : ''}">${z[0].toUpperCase() + z.slice(1)}</button>`).join('')}<button type="button" data-gtoday><i class="fa-solid fa-crosshairs"></i> Today</button></div>`;
      return `${zoom}<div class="card wk-gantt" id="wkGantt" data-today="${(today - lo) * day + day / 2}" data-first="${(Math.min(...dated.map(t => wkSpan(t)[0]), today) - lo) * day}"><div class="wk-ghead"><div class="wk-glab"></div><div class="wk-gtrack" style="width:${width}px"><div class="wk-gmonths">${months}</div><div class="wk-gticks">${ticks}</div></div></div><div class="wk-gbody" style="min-width:calc(var(--gl) + ${width}px)">${body}${links}${grid}</div></div>`
        + `<div class="wk-glegend">${WK_STATUS.map(([k, n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}<span><i class="fl"></i>Project deadline</span><span><i class="ln"></i>Waits for</span><span><i class="td"></i>Today</span></div>`
        + (undated.length ? card(`<div class="section-title"><i class="fa-regular fa-calendar-xmark"></i> No dates yet <small>${undated.length}</small></div>${undated.map(wkRowT).join('')}`) : '');
    }
    // where to scroll: the earliest bar if today is close to it, otherwise so that today sits about 60% across
    function wkGanttTarget(g) { const gl = (g.querySelector('.wk-glab') || {}).offsetWidth || 190, v = g.clientWidth - gl; return Math.max(0, Math.max(+g.dataset.first - 12, +g.dataset.today - 0.6 * v)); }
    // after drawing, bring today into view
    function wkGanttScroll() { const g = docEl('wkGantt'); if (!g) return; const keep = WKG.keep; g.scrollLeft = keep != null ? keep : wkGanttTarget(g); WKG.keep = null; }

    function wkTimelineView(sel, tasks) {
      const today = wkDn(wkToday()), items = [];
      tasks.forEach(t => { const sp = wkSpan(t); if (t.status === 'done' && (!t.completed_at || today - wkDn(t.completed_at.slice(0, 10)) > 14)) return; items.push({ kind: 't', t, at: sp ? sp[1] : null, sp }); });
      (sel ? [wkProj(sel)] : WK.projects).forEach(p => { if (p && p.deadline && p.status === 'active') items.push({ kind: 'p', p, at: wkDn(p.deadline), sp: [wkDn(p.deadline), wkDn(p.deadline)] }); });
      if (!items.length) return card('<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-timeline"></i></div><div class="h-empty-t">Nothing on the timeline</div><div class="h-empty-s">Tasks with dates, and project deadlines, show up here in the order they happen.</div></div>');
      const weekStart = n => n - ((new Date(n * 864e5).getUTCDay() + 6) % 7), thisWeek = weekStart(today);
      const bucket = it => { if (it.at == null) return [9e9, 'No date']; if (it.kind === 't' && it.t.status === 'done') return [-1, 'Recently done']; if (it.at < today) return [0, 'Overdue'];
        const w = weekStart(it.at); if (w === thisWeek) return [1, 'This week']; if (w === thisWeek + 7) return [2, 'Next week'];
        const d = new Date(it.at * 864e5); return [100 + d.getUTCFullYear() * 12 + d.getUTCMonth(), d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })]; };
      const groups = new Map(); items.forEach(it => { const [k, name] = bucket(it); if (!groups.has(k)) groups.set(k, { name, list: [] }); groups.get(k).list.push(it); });
      const rel = n => n === today ? 'Today' : n === today + 1 ? 'Tomorrow' : n === today - 1 ? 'Yesterday' : wkFmt(wkDk(n));
      const html = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([k, g]) => `<div class="wk-tlg ${k === 0 ? 'late' : ''}"><div class="wk-tlh">${g.name}<small>${g.list.length}</small></div>${g.list.sort((a, b) => (a.at ?? 9e9) - (b.at ?? 9e9)).map(it => {
        if (it.kind === 'p') return `<div class="wk-tli ms" data-wkproj="${it.p.id}"><span class="wk-tld" style="--c:${it.p.color}"><i class="fa-solid fa-flag"></i></span><div class="wk-tlb"><b>${escapeHtml(it.p.name)}</b><small>Project deadline · ${rel(it.at)}</small></div></div>`;
        const t = it.t, st = wkStatus(t.status), p = wkProj(t.project_id), f = WK.folders.find(x => x.id === t.folder_id), a = it.sp ? it.sp[0] : null, b = it.sp ? it.sp[1] : null;
        const when = !it.sp ? 'No date' : a === b ? rel(b) : `${wkFmt(wkDk(a))} → ${rel(b)}`, span = it.sp && a !== b ? Math.round((b - a + 1)) + ' days' : '';
        return `<div class="wk-tli ${t.status === 'done' ? 'done' : ''}" data-gtask="${t.id}"><span class="wk-tld" style="--c:${st[2]}"></span><div class="wk-tlb"><b>${escapeHtml(t.title)}</b><small>${escapeHtml([p && p.name, f && f.name].filter(Boolean).join(' › '))}${wkWho(t).length ? ' · ' + escapeHtml(wkWho(t).join(', ')) : ''}</small>${it.sp && a !== b ? `<div class="wk-tlbar"><i style="width:${Math.round(wkProg(t) * 100)}%;background:${st[2]}"></i></div>` : ''}</div><div class="wk-tlw"><span class="wk-st" style="--c:${st[2]}">${st[1]}</span><em class="${it.at != null && it.at < today && t.status !== 'done' ? 'over' : ''}">${when}${span ? ' · ' + span : ''}</em></div></div>`; }).join('')}</div>`).join('');
      return `<div class="card wk-timeline">${html}</div>`;
    }

    // ---------- drag a bar to move the task, or drag its left / right end to change the start / end date ----------
    let wkDrag = null, wkJustDragged = 0;
    const wkShift = (k, d) => wkDk(wkDn(k) + d);
    function wkDragDates(dr, d) {   // the new start / end dates for a drag of d days
      const t = dr.t, [a, b] = wkSpan(t); let ns = t.start_date, nd = t.due_date;
      if (dr.mode === 'move') { if (ns) ns = wkShift(ns, d); if (nd) nd = wkShift(nd, d); }
      else if (dr.mode === 'start') { const v = Math.min(a + d, b); ns = wkDk(v); if (!nd) nd = null; }
      else { const v = Math.max(b + d, a); nd = wkDk(v); if (!ns && t.due_date == null) ns = t.start_date; }
      return { start_date: ns, due_date: nd };
    }
    // The tasks that wait for `t` (and the ones waiting for them…) follow it:
    //  • `t` now ends later and runs into a task that waits for it: that task is pushed later by the days they overlap;
    //  • `t` now ends earlier: a task that started the very next day after it ("tight") is pulled earlier by the same days, but never before
    //    the end of its other predecessors, and a task with a gap left on purpose stays where it is.
    // Tasks you can't edit, or that are done, are left alone.
    function wkCascade(t, f) {
      const out = [], seen = new Set([t.id]), end = x => wkDn(x.due_date || x.start_date), moved = {};   // moved: id -> new dates already planned
      const cur = id => moved[id] || WK.tasks.find(x => x.id === id);
      const queue = [{ id: t.id, oldEnd: end(t), newEnd: end(f) }];
      while (queue.length) {
        const c = queue.shift();
        WK.links.filter(l => l.depends_on === c.id).forEach(l => {
          const s = WK.tasks.find(x => x.id === l.task_id); if (!s || seen.has(s.id) || s.status === 'done' || !wkCanEdit(wkProj(s.project_id)) || !(s.start_date || s.due_date)) return;
          seen.add(s.id);
          const sStart = wkDn(s.start_date || s.due_date); let delta = 0;
          if (c.newEnd > c.oldEnd) delta = Math.max(0, c.newEnd + 1 - sStart);                    // run into it: push later
          else if (c.newEnd < c.oldEnd && sStart === c.oldEnd + 1) {                              // was right behind it: follow it earlier
            delta = c.newEnd - c.oldEnd;
            const floor = Math.max(-1e9, ...WK.links.filter(k => k.task_id === s.id && k.depends_on !== c.id).map(k => { const q = cur(k.depends_on); return q && (q.due_date || q.start_date) ? end(q) + 1 : -1e9; }));
            delta = Math.min(0, Math.max(delta, floor - sStart));
          }
          if (!delta) return;
          const nf = { start_date: s.start_date ? wkShift(s.start_date, delta) : null, due_date: s.due_date ? wkShift(s.due_date, delta) : null };
          out.push({ t: s, f: nf }); moved[s.id] = { ...s, ...nf }; queue.push({ id: s.id, oldEnd: end(s), newEnd: end(nf) });
        });
      }
      return out;
    }
    function wkDragTip(x, y, text) { let tip = document.getElementById('wkGtip'); if (!tip) { tip = document.createElement('div'); tip.id = 'wkGtip'; tip.className = 'wk-gtip'; document.body.appendChild(tip); } tip.textContent = text; tip.style.left = Math.min(window.innerWidth - 150, x + 12) + 'px'; tip.style.top = (y - 34) + 'px'; }
    document.addEventListener('pointerdown', e => {
      const h = e.target.closest('#wkGantt [data-gdrag]'); if (!h || (e.button != null && e.button > 0)) return;
      const el = h.closest('[data-gtask]'), t = WK.tasks.find(x => x.id === el.dataset.gtask); if (!t || !wkCanEdit(wkProj(t.project_id))) return;
      const g = docEl('wkGantt'), day = WKG_DAY[WKG.zoom] || 16, sp = wkSpan(t);
      wkDrag = { t, el, mode: h.dataset.gdrag, x0: e.clientX, day, moved: false, d: 0, left0: parseFloat(el.style.left) || 0, w0: parseFloat(el.style.width) || 14, sp, keep: g ? g.scrollLeft : 0 };
      try { el.setPointerCapture(e.pointerId); } catch (x) { /* older browsers: the document listeners below still follow the pointer */ }
      if (wkDrag.mode !== 'move') e.preventDefault();
    });
    document.addEventListener('pointermove', e => {
      if (!wkDrag) return; const dr = wkDrag, dx = e.clientX - dr.x0;
      if (!dr.moved && Math.abs(dx) < 5) return; dr.moved = true; document.body.classList.add('wk-dragging');
      const d = Math.round(dx / dr.day); dr.d = d; const nd = wkDragDates(dr, d), a = wkDn(nd.start_date || nd.due_date), b = wkDn(nd.due_date || nd.start_date);
      // move the bar on screen straight away: the chart's left edge is fixed, so only the offset from where it began changes
      if (dr.el.classList.contains('wk-gms')) dr.el.style.left = (dr.left0 + (a - dr.sp[0]) * dr.day) + 'px';
      else { dr.el.style.left = (dr.left0 + (a - dr.sp[0]) * dr.day) + 'px'; dr.el.style.width = Math.max((b - a + 1) * dr.day, 10) + 'px'; }
      wkDragTip(e.clientX, e.clientY, `${wkFmt(wkDk(a))} → ${wkFmt(wkDk(b))} · ${b - a + 1} day${b - a ? 's' : ''}`);
    });
    const wkDragEnd = async e => {
      if (!wkDrag) return; const dr = wkDrag; wkDrag = null; document.body.classList.remove('wk-dragging'); const tip = document.getElementById('wkGtip'); if (tip) tip.remove();
      try { dr.el.releasePointerCapture(e.pointerId); } catch (x) { }
      if (!dr.moved) return; wkJustDragged = Date.now();
      if (!dr.d) return wkPaint();
      const f = wkDragDates(dr, dr.d), old = { start_date: dr.t.start_date, due_date: dr.t.due_date }; WKG.keep = dr.keep;
      const chain = wkCascade(dr.t, f);   // tasks that wait for this one are pushed later when the bar now runs into them
      const olds = chain.map(c => ({ t: c.t, o: { start_date: c.t.start_date, due_date: c.t.due_date } }));
      Object.assign(dr.t, f); chain.forEach(c => Object.assign(c.t, c.f)); wkPaint();
      const undo = () => { Object.assign(dr.t, old); olds.forEach(x => Object.assign(x.t, x.o)); WKG.keep = dr.keep; wkPaint(); };
      const r = await LumaWork.tasks.update(dr.t.id, f);
      if (r.error) { undo(); return luAlert(/dates_check/.test(r.error.message) ? 'The start date can not be after the end date.' : /row-level security/i.test(r.error.message) ? 'You can\'t change tasks in this project.' : wkHint(r.error.message)); }
      Object.assign(dr.t, r.data);
      let moved = 0;
      for (const c of chain) { const x = await LumaWork.tasks.update(c.t.id, c.f); if (!x.error) { Object.assign(c.t, x.data); moved++; } else { Object.assign(c.t, olds.find(o => o.t === c.t).o); } }
      if (moved < chain.length) wkPaint();
      flashToast('Dates changed', `${dr.t.title} · ${wkFmt(f.start_date || f.due_date)} → ${wkFmt(f.due_date || f.start_date)}${moved ? ` · ${moved} linked task${moved === 1 ? '' : 's'} moved too` : ''}`, 'fa-calendar-days', '#fb923c');
    };
    document.addEventListener('pointerup', wkDragEnd); document.addEventListener('pointercancel', wkDragEnd);

    document.addEventListener('click', e => {
      if (Date.now() - wkJustDragged < 400) return;   // the click that ends a drag is not a tap
      const g = e.target.closest('#wkRoot [data-gtask]'); if (g && !e.target.closest('.wk-row')) { const t = WK.tasks.find(x => x.id === g.dataset.gtask); if (t) wkOpenTask(t); return; }
      const z = e.target.closest('#wkRoot [data-gz]'); if (z) { WKG.zoom = z.dataset.gz; const gg = docEl('wkGantt'); if (gg) WKG.keep = null; return wkPaint(); }
      if (e.target.closest('#wkRoot [data-gtoday]')) { const gg = docEl('wkGantt'); if (gg) gg.scrollTo({ left: wkGanttTarget(gg), behavior: 'smooth' }); }
    });
