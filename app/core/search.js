// LUMA — core: search
    // =====================================================
    //  GLOBAL SEARCH — the magnifier in the header (or Ctrl/⌘ K): pages plus your tasks, events, notes, documents,
    //  habits, goals, bills, subscriptions, reminders, contacts and money entries
    // =====================================================
    let SRCH = { at: 0, items: [], loading: false }, srchSel = 0, srchFlat = [];
    const SRCH_TYPES = { page: ['Pages', 'fa-compass', '#60a5fa'], task: ['Tasks', 'fa-square-check', '#3b82f6'], event: ['Events', 'fa-calendar', '#8b5cf6'], note: ['Notes', 'fa-note-sticky', '#fbbf24'], doc: ['Documents', 'fa-file', '#38bdf8'], habit: ['Habits', 'fa-fire', '#fb923c'], goal: ['Goals', 'fa-bullseye', '#34d399'], bill: ['Bills', 'fa-file-invoice-dollar', '#f59e0b'], sub: ['Subscriptions', 'fa-repeat', '#f472b6'], reminder: ['Reminders', 'fa-bell-concierge', '#f59e0b'], contact: ['Contacts', 'fa-user', '#22c55e'], money: ['Money', 'fa-wallet', '#4ade80'], study: ['Study', 'fa-graduation-cap', '#34d399'], work: ['Work', 'fa-briefcase', '#fb923c'] };
    const srchPageItems = () => Object.entries(titles).map(([k, name]) => ({ type: 'page', key: k, title: name, sub: 'Open page', hay: name }));
    async function srchLoad() {
      if (SRCH.loading || Date.now() - SRCH.at < 60000) return; // reuse what was fetched in the last minute
      SRCH.loading = true;
      try {
      const ok = async p => { try { const r = await p; return r && !r.error && Array.isArray(r.data) ? r.data : []; } catch (e) { return []; } };
      const since = bAddMonths(bFirst(mytDayKey(Date.now())), -24);
      const [tasks, events, notes, docs, goals, bills, rems, contacts, money] = await Promise.all([ok(LumaTasks.list()), ok(LumaEvents.list()), ok(LumaNotes.list()), ok(LumaDocuments.listDocuments()), ok(LumaGoals.list()), ok(LumaBills.list()), ok(LumaReminders.list()), ok(LumaContacts.listContacts()), ok(LumaMoney.listEntries(since))]);
      const items = [], add = (list, fn) => list.forEach(x => { try { const it = fn(x); if (it) items.push(it); } catch (e) { /* one odd row never breaks the search */ } });
      add(tasks, t => ({ type: 'task', raw: t, title: t.title, sub: `Task · ${t.status === 'done' ? 'done' : t.due_date ? 'due ' + cFmt(t.due_date, { day: 'numeric', month: 'short' }) : 'no due date'}${t.tag ? ' · ' + t.tag : ''}`, hay: [t.title, t.notes, t.tag].join(' ') }));
      add(events, e => ({ type: 'event', raw: e, title: e.title, sub: `Event · ${cFmt(e.event_date, { weekday: 'short', day: 'numeric', month: 'short' })}${e.start_time ? ' · ' + fmt12(e.start_time) : ''}`, hay: [e.title, e.note, e.category].join(' ') }));
      add(notes, n => ({ type: 'note', raw: n, title: n.title, sub: 'Note' + (n.tag ? ' · ' + n.tag : ''), hay: [n.title, n.body, n.tag].join(' ') }));
      add(docs, d => ({ type: 'doc', raw: d, title: d.name, sub: 'Document', hay: d.name }));
      add(typeof HABITS !== 'undefined' ? HABITS : [], h => ({ type: 'habit', raw: h, title: h.name, sub: 'Habit · ' + (h.period || 'daily'), hay: h.name }));
      add(goals, g => ({ type: 'goal', raw: g, title: g.title, sub: 'Goal' + (g.category ? ' · ' + g.category : ''), hay: [g.title, g.note, g.category].join(' ') }));
      add(bills, b => ({ type: b.category === 'Subscription' ? 'sub' : 'bill', raw: b, title: b.name, sub: `${b.category === 'Subscription' ? 'Subscription' : 'Bill'} · ${bRM(b.amount)}`, hay: [b.name, b.category].join(' ') }));
      add(rems, r => ({ type: 'reminder', raw: r, title: r.title, sub: 'Reminder · ' + remDesc(r), hay: [r.title, r.note].join(' ') }));
      add(contacts, c => { const nm = [c.other_first_name, c.other_last_name].filter(Boolean).join(' ') || c.other_email || ''; return nm ? { type: 'contact', raw: c, title: nm, sub: 'Contact' + (c.other_email ? ' · ' + c.other_email : ''), hay: [nm, c.other_email].join(' ') } : null; });
      add(money, m => ({ type: 'money', raw: m, title: m.name || m.category, sub: `${m.kind === 'income' ? 'Income' : 'Expense'} · ${bRM(m.amount)} · ${cFmt(m.entry_date, { day: 'numeric', month: 'short', year: 'numeric' })}`, hay: [m.name, m.category].join(' ') }));
      if (typeof studySearchItems === 'function' && LumaPlan.hasAddon('study')) { try { items.push(...await studySearchItems()); } catch (e) { /* study search is optional */ } }
      if (typeof workSearchItems === 'function') { try { items.push(...await workSearchItems()); } catch (e) { /* work search is optional */ } }
      SRCH = { at: Date.now(), items, loading: false };
      } catch (e) { console.warn('LUMA search: could not load everything', e); SRCH.loading = false; SRCH.at = 0; }
      finally { SRCH.loading = false; if (docEl('searchOverlay').classList.contains('open')) srchRender(); }
    }
    function srchRender() {
      const q = docEl('srchInput').value.trim().toLowerCase(), box = docEl('srchList');
      let pool = [...srchPageItems(), ...SRCH.items];
      if (!q) pool = pool.filter(i => i.type === 'page'); // nothing typed: show the pages
      else {
        const words = q.split(/\s+/);
        pool = pool.map(i => { const h = (i.hay || '').toLowerCase(), t = i.title.toLowerCase(); if (!words.every(w => h.includes(w))) return null; return { i, r: t.startsWith(q) ? 0 : t.includes(q) ? 1 : 2 }; }).filter(Boolean).sort((a, b) => a.r - b.r).map(x => x.i);
      }
      const groups = {}; pool.forEach(i => (groups[i.type] = groups[i.type] || []).push(i));
      srchFlat = [];
      const mark = t => { const e = escapeHtml(t); if (!q) return e; try { return e.replace(new RegExp('(' + q.split(/\s+/).filter(Boolean).map(w => escapeHtml(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig'), '<mark>$1</mark>'); } catch (x) { return e; } };
      let html = '';
      Object.keys(SRCH_TYPES).forEach(type => {
        const list = (groups[type] || []).slice(0, q ? 5 : 30); if (!list.length) return;
        const [label, icon, col] = SRCH_TYPES[type];
        html += `<div class="srch-g">${label}${groups[type].length > list.length ? ` · ${groups[type].length}` : ''}</div>` + list.map(i => { const idx = srchFlat.push(i) - 1; return `<div class="srch-it" data-i="${idx}" style="--c:${col}"><div class="si"><i class="fa-solid ${icon}"></i></div><div class="st"><div class="t">${mark(i.title)}</div><div class="s">${escapeHtml(i.sub)}</div></div></div>`; }).join('');
      });
      box.innerHTML = html || `<div class="srch-empty">${SRCH.loading ? 'Searching…' : q ? `Nothing found for “${escapeHtml(docEl('srchInput').value.trim())}”.` : 'Start typing to search.'}</div>`;
      srchSel = 0; srchMark();
    }
    function srchMark() { const els = [...docEl('srchList').querySelectorAll('.srch-it')]; els.forEach((el, i) => el.classList.toggle('hl', i === srchSel)); if (els[srchSel]) els[srchSel].scrollIntoView({ block: 'nearest' }); }
    function openSearch() {
      docEl('searchOverlay').classList.add('open'); docEl('srchInput').value = ''; srchRender();
      setTimeout(() => docEl('srchInput').focus(), 30);
      srchLoad();
    }
    const closeSearch = () => docEl('searchOverlay').classList.remove('open');
    function srchGo(i) {
      if (!i) return; closeSearch();
      const r = i.raw;
      switch (i.type) {
        case 'page': return goTo(i.key);
        case 'task': return openTaskModal(r);
        case 'event': return calOpenItem('event', r.id, r.event_date);
        case 'note': return goTo('notes');
        case 'doc': return goTo('documents');
        case 'habit': return goTo('habits');
        case 'goal': return goTo('goals');
        case 'bill': return goTo('bills');
        case 'sub': return goTo('subscriptions');
        case 'reminder': return openRemModal(r);
        case 'contact': return goTo('contacts');
        case 'money': return openEntryModal(r);
        case 'study': return sdOpenFromSearch(r);
        case 'work': return wkOpenFromSearch(r);
      }
    }
    docEl('topSearchBtn').onclick = openSearch;
    docEl('topSearchBtn').onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSearch(); } };
    docEl('srchInput').addEventListener('input', srchRender);
    docEl('srchInput').addEventListener('keydown', e => {
      const n = docEl('srchList').querySelectorAll('.srch-it').length;
      if (e.key === 'ArrowDown') { e.preventDefault(); srchSel = Math.min(n - 1, srchSel + 1); srchMark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); srchSel = Math.max(0, srchSel - 1); srchMark(); }
      else if (e.key === 'Enter') { e.preventDefault(); srchGo(srchFlat[srchSel]); }
    });
    docEl('srchClose').onclick = closeSearch;
    docEl('searchOverlay').onclick = e => { if (e.target === docEl('searchOverlay')) return closeSearch(); const it = e.target.closest('.srch-it'); if (it) srchGo(srchFlat[+it.dataset.i]); };
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); docEl('searchOverlay').classList.contains('open') ? closeSearch() : openSearch(); }
    });
