// LUMA — module: notifications
      // ---------------- NOTIFICATIONS (full list) ----------------
    MODULES.notifications = function () {
        return head('Notifications', '<span id="notifSub">Loading…</span>',
          '<button class="create-btn" id="notifReadAll" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-check-double"></i> Mark all as read</button>') +
          '<div id="notifFilters" style="display:flex;gap:10px;margin-bottom:1rem"></div><div id="notifList"></div>';
    };

    // =====================================================
    //  NOTIFICATIONS — bell badge, today's dropdown, full page, live toasts
    //  Rows are created by database triggers (migration 008).
    // =====================================================
    let NOTIFS = [], notifChannel = null, notifFilter = 'all';
    // the server is asked for 50 at a time; the rest load as the person scrolls the full list. The totals come from count queries, not from the loaded rows.
    let notifCount = null, notifMore = false, notifBusy = false, notifLoadErr = false, notifIO = null, notifRecountT = null;
    const NOTIF_ICONS = {
      gift: ['fa-gift', '#34d399'], busy_day: ['fa-fire', '#fb923c'], birthday: ['fa-cake-candles', '#f472b6'], admin_birthday: ['fa-cake-candles', '#f472b6'], work_team: ['fa-people-group', '#fb923c'], work_invite: ['fa-briefcase', '#fb923c'], work_reply: ['fa-briefcase', '#fb923c'], work_task: ['fa-list-check', '#fb923c'], work_comment: ['fa-comment', '#fb923c'], work_mention: ['fa-at', '#fb923c'], work_budget: ['fa-stopwatch', '#f87171'], feedback: ['fa-lightbulb', '#fbbf24'], feedback_reply: ['fa-lightbulb', '#34d399'], reminder_work: ['fa-list-check', '#fb923c'], split: ['fa-receipt', '#a78bfa'], split_nudge: ['fa-bell', '#f59e0b'],
      welcome: ['fa-circle-check', '#22c55e'], share: ['fa-share-nodes', '#38bdf8'],
      contact_request: ['fa-user-plus', '#f59e0b'], nudge: ['fa-bell', '#f59e0b'], message: ['fa-comment', '#3b82f6'], reminder_water: ['fa-droplet', '#38bdf8'], reminder_steps: ['fa-shoe-prints', '#34d399'], reminder_active: ['fa-fire', '#fb923c'], reminder_habit: ['fa-bell', '#fb923c'], reminder_subscription: ['fa-repeat', '#f472b6'], reminder_sleep: ['fa-moon', '#a78bfa'], reminder_task: ['fa-list-check', '#60a5fa'], reminder_custom: ['fa-bell-concierge', '#f59e0b'], weekly_review: ['fa-chart-line', '#60a5fa'], reminder_bill: ['fa-file-invoice-dollar', '#fbbf24'], reminder_event: ['fa-calendar', '#8b5cf6'], reminder_goal: ['fa-bullseye', '#34d399'], reminder_study: ['fa-graduation-cap', '#34d399'], event_invite: ['fa-user-group', '#a78bfa'], reminder_class: ['fa-chalkboard-user', '#34d399'], note_share: ['fa-note-sticky', '#fbbf24'], project_invite: ['fa-people-group', '#a78bfa'], project_reply: ['fa-user-check', '#22c55e'], project_task: ['fa-thumbtack', '#60a5fa'], project_comment: ['fa-comments', '#60a5fa'], reminder_project: ['fa-people-group', '#34d399'], event_invite_reply: ['fa-user-check', '#22c55e'], budget_warn: ['fa-wallet', '#fbbf24'], budget_over: ['fa-triangle-exclamation', '#f87171'], contact_accepted: ['fa-user-check', '#22c55e'], system: ['fa-bell', '#94a3b8'],
    };
    const mytDayKey = d => new Intl.DateTimeFormat('en-CA', { timeZone: MYT }).format(new Date(d));
    const mytTime = d => new Intl.DateTimeFormat('en-US', { timeZone: MYT, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(d));
    const isToday = n => mytDayKey(n.created_at) === mytDayKey(Date.now());
    function notifDayLabel(iso) {
      const k = mytDayKey(iso);
      if (k === mytDayKey(Date.now())) return 'Today';
      if (k === mytDayKey(Date.now() - 86400000)) return 'Yesterday';
      return new Intl.DateTimeFormat('en-GB', { timeZone: MYT, day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
    }
    const notifUnread = () => notifCount ? notifCount.unread : NOTIFS.filter(n => !n.read_at).length;
    const notifTotal = () => notifCount ? notifCount.total : NOTIFS.length;
    function notifRecount(now) { // refresh the two totals (soon, so a burst of changes makes one request)
      clearTimeout(notifRecountT);
      notifRecountT = setTimeout(async () => { const c = await LumaNotifications.counts(); if (c) { notifCount = c; paintBadge(); renderNotifPanel(); const s = document.getElementById('notifSub'); if (s) renderNotifPage(true); } }, now ? 0 : 350);
    }

    function notifItemHtml(n, withDelete) {
      const [icon, col] = NOTIF_ICONS[n.type] || NOTIF_ICONS.system;
      return `<div class="notif-item ${n.read_at ? '' : 'unread'}" data-id="${n.id}">
        <div class="ni-ico" style="background:${col}22;color:${col}"><i class="fa-solid ${icon}"></i></div>
        <div class="ni-main"><div class="ni-title">${escapeHtml(n.title)}</div>${n.body ? `<div class="ni-body">${escapeHtml(n.body)}</div>` : ''}<div class="ni-time">${withDelete ? mytTime(n.created_at) : mytTime(n.created_at)}</div></div>
        <span class="ni-dot"></span>${withDelete ? '<i class="fa-solid fa-xmark ni-del" title="Delete"></i>' : ''}</div>`;
    }

    function paintBadge() {
      const n = notifUnread(), b = document.getElementById('bellBadge');
      if (!b) return;
      b.style.display = n ? '' : 'none';
      b.textContent = n > 9 ? '9+' : n;
    }
    function renderNotifPanel() {
      const list = document.getElementById('npList'); if (!list) return;
      const today = NOTIFS.filter(isToday), unread = notifUnread(), olderUnread = Math.max(0, unread - NOTIFS.filter(n => !n.read_at && isToday(n)).length);
      document.getElementById('npSub').textContent = unread ? `${unread} unread` : 'You\'re all caught up';
      document.getElementById('npMarkAll').disabled = !unread;
      list.innerHTML = today.length ? today.map(n => notifItemHtml(n, false)).join('') : '<div class="np-empty"><i class="fa-regular fa-bell-slash"></i>No notifications today</div>';
      document.getElementById('npOlder').textContent = olderUnread ? `${olderUnread} earlier unread` : '';
    }
    function renderNotifPage(keepScroll) {
      const list = document.getElementById('notifList'); if (!list) return;
      const unread = notifUnread();
      document.getElementById('notifSub').textContent = `${notifTotal()} notification${notifTotal() === 1 ? '' : 's'} · ${unread} unread`;
      document.getElementById('notifReadAll').disabled = !unread;
      document.getElementById('notifFilters').innerHTML = [['all', 'All'], ['unread', `Unread${unread ? ' (' + unread + ')' : ''}`]].map(([k, l]) =>
        `<span class="suggestion-badge notif-filter" data-k="${k}" style="${k === notifFilter ? 'background:rgba(59,130,246,0.14);color:#93c5fd;border-color:rgba(59,130,246,0.3)' : ''};font-size:0.7rem;padding:0.35rem 0.9rem;cursor:pointer">${l}</span>`).join('');
      const shown = NOTIFS.filter(n => notifFilter === 'all' || !n.read_at);
      let html = '', last = '';
      shown.forEach(n => { const g = notifDayLabel(n.created_at); if (g !== last) { html += `<div class="notif-group">${g}</div>`; last = g; } html += notifItemHtml(n, true); });
      if (notifMore) html += notifLoadErr ? '<div class="lu-empty notif-more"><button type="button" class="np-btn" id="notifMoreBtn">Could not load more. Try again</button></div>' : '<div class="lu-empty notif-more" id="notifMore">Loading more…</div>';
      list.innerHTML = html || `<div class="lu-empty">${notifFilter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}</div>`;
      const s = document.getElementById('notifMore');
      if (s && 'IntersectionObserver' in window) { if (!notifIO) notifIO = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) notifLoadMore(); }, { rootMargin: '300px' }); notifIO.disconnect(); notifIO.observe(s); }
    }
    function refreshNotifUI() { paintBadge(); renderNotifPanel(); renderNotifPage(); }

    async function loadNotifications() {
      const { data, error } = await LumaNotifications.list();
      if (error) { console.info('LUMA: notifications not available yet (run supabase/migrations/008_notifications.sql):', error.message); return; }
      NOTIFS = data; notifMore = data.length >= LumaNotifications.PAGE; notifLoadErr = false; refreshNotifUI();
      const c = await LumaNotifications.counts(); if (c) { notifCount = c; refreshNotifUI(); }
    }
    // the next 50, older than the last one on screen (called when the end of the list scrolls into view)
    async function notifLoadMore() {
      if (notifBusy || !notifMore || notifLoadErr || !NOTIFS.length) return;
      notifBusy = true;
      try {
        const before = NOTIFS[NOTIFS.length - 1].created_at, have = new Set(NOTIFS.map(n => n.id));
        let r = await LumaNotifications.list(LumaNotifications.PAGE, before), fresh = r.error ? [] : r.data.filter(n => !have.has(n.id));
        if (!r.error && !fresh.length && r.data.length >= LumaNotifications.PAGE) { r = await LumaNotifications.list(LumaNotifications.PAGE, before, true); fresh = r.error ? [] : r.data.filter(n => !have.has(n.id)); } // a whole page with the same time: step past it
        if (r.error) notifLoadErr = true; else { NOTIFS = NOTIFS.concat(fresh); notifMore = r.data.length >= LumaNotifications.PAGE && fresh.length > 0; }
      } finally { notifBusy = false; }
      renderNotifPage();
    }
    async function openNotif(n) {
      if (!n.read_at) { n.read_at = new Date().toISOString(); if (notifCount) notifCount.unread = Math.max(0, notifCount.unread - 1); refreshNotifUI(); LumaNotifications.markRead(n.id); }
      closeNotifPanel();
      if ((n.type === 'nudge' || n.type === 'message') && n.ref) pendingChatOpen = n.ref; // opens that chat once Contacts has loaded
      let target = (n.type === 'nudge' || n.type === 'message') ? null : n.ref;
      if (!target) target = luNoticeTarget(n.link, n.title, n.body, n.type);
      if (n.link && titles[n.link]) luOpenTarget(n.link, target, n.type);
    }
    // the user is looking at this conversation, so its message/nudge notifications are already read
    function markChatNotifsRead(contactId) {
      const now = new Date().toISOString(); let any = false;
      NOTIFS.forEach(n => { if (!n.read_at && n.ref === contactId && (n.type === 'message' || n.type === 'nudge')) { n.read_at = now; any = true; } });
      if (any) { refreshNotifUI(); notifRecount(); LumaNotifications.markContactRead(contactId).then(() => notifRecount()); }
    }
    async function markAllNotifsRead() {
      const now = new Date().toISOString();
      NOTIFS.forEach(n => { if (!n.read_at) n.read_at = now; }); if (notifCount) notifCount.unread = 0; refreshNotifUI();
      const { error } = await LumaNotifications.markAllRead();
      if (error) { luAlert('Could not mark as read: ' + error.message); loadNotifications(); }
    }

    // bell dropdown (today's notifications only; "See all" opens the full page)
    const notifPanel = () => document.getElementById('notifPanel');
    function closeNotifPanel() {
      notifPanel().style.display = 'none';
      document.removeEventListener('mousedown', notifOutside, true); document.removeEventListener('keydown', notifKey, true);
    }
    const notifOutside = e => { if (!notifPanel().contains(e.target) && !e.target.closest('#bellBtn')) closeNotifPanel(); };
    const notifKey = e => { if (e.key === 'Escape') closeNotifPanel(); };
    function toggleNotifPanel() {
      const p = notifPanel();
      if (p.style.display !== 'none') return closeNotifPanel();
      renderNotifPanel(); p.style.display = 'flex';
      const r = document.getElementById('bellBtn').getBoundingClientRect();
      p.style.top = (r.bottom + 10) + 'px';
      p.style.left = Math.max(12, Math.min(window.innerWidth - p.offsetWidth - 12, r.right - p.offsetWidth)) + 'px';
      document.addEventListener('mousedown', notifOutside, true); document.addEventListener('keydown', notifKey, true);
    }
    document.getElementById('bellBtn').addEventListener('click', toggleNotifPanel);
    document.getElementById('npMarkAll').addEventListener('click', markAllNotifsRead);
    document.getElementById('npSeeAll').addEventListener('click', () => { closeNotifPanel(); goTo('notifications'); });
    document.getElementById('npList').addEventListener('click', e => {
      const el = e.target.closest('.notif-item'); const n = el && NOTIFS.find(x => x.id === el.dataset.id); if (n) openNotif(n);
    });

    // in-app push: a toast slides in when a notification arrives live
    function showNotifToast(n) {
      // also a real browser notification when the tab is in the background (if the user allowed it)
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try { const bn = new Notification(n.title, { body: n.body || '' }); bn.onclick = () => { window.focus(); openNotif(n); bn.close(); }; } catch (e) { }
      }
      const [icon, col] = NOTIF_ICONS[n.type] || NOTIF_ICONS.system;
      const t = document.createElement('div'); t.className = 'notif-toast';
      t.innerHTML = `<div class="ni-ico" style="background:${col}22;color:${col}"><i class="fa-solid ${icon}"></i></div><div class="ni-main"><div class="ni-title" style="color:#fff">${escapeHtml(n.title)}</div>${n.body ? `<div class="ni-body">${escapeHtml(n.body)}</div>` : ''}</div>`;
      const dismiss = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
      t.onclick = () => { dismiss(); openNotif(n); };
      document.getElementById('notifToasts').appendChild(t);
      setTimeout(dismiss, 6000);
    }

    // called once the user is known (see authGate)
    function initNotifications(userId) {
      loadNotifications();
      notifChannel = LumaNotifications.subscribe(userId, ({ type, row }) => {
        if (type === 'INSERT') {
          if (!NOTIFS.some(n => n.id === row.id)) {
            // the database replaced the previous unread message notification for this chat; mirror that here
            if (row.type === 'message') NOTIFS = NOTIFS.filter(n => !(n.type === 'message' && n.ref === row.ref && !n.read_at));
            NOTIFS.unshift(row);
            const watching = row.type === 'message' && row.ref && row.ref === activeChatContactId && document.getElementById('contactChatOverlay').classList.contains('open');
            const quiet = prefOn('focus', false) && !/^(reminder_|budget_)/.test(row.type); // Focus mode: only urgent things pop up
            if (watching) markChatNotifsRead(row.ref); else if (!quiet) { showNotifToast(row); uiSound(880, 0.12); } // already looking at that chat: no pop-up
          }
        }
        else if (type === 'UPDATE') { const i = NOTIFS.findIndex(n => n.id === row.id); if (i >= 0) NOTIFS[i] = { ...NOTIFS[i], ...row }; }
        else if (type === 'DELETE') NOTIFS = NOTIFS.filter(n => n.id !== row.id);
        refreshNotifUI(); notifRecount();
      });
      // realtime can miss events while a tab sleeps — resync when it wakes
      document.addEventListener('visibilitychange', () => { if (!document.hidden) loadNotifications(); });
    }



    WIRE.notifications = function (pg, key) {
        renderNotifPage();
        pg.querySelector('#notifReadAll').onclick = markAllNotifsRead;
        pg.querySelector('#notifFilters').onclick = e => { const f = e.target.closest('.notif-filter'); if (f) { notifFilter = f.dataset.k; renderNotifPage(); } };
        pg.querySelector('#notifList').onclick = async e => {
          if (e.target.closest('#notifMoreBtn')) { notifLoadErr = false; return notifLoadMore(); }
          const el = e.target.closest('.notif-item'); const n = el && NOTIFS.find(x => x.id === el.dataset.id); if (!n) return;
          if (e.target.closest('.ni-del')) {
            const { error } = await LumaNotifications.remove(n.id);
            if (error) return luAlert('Could not delete: ' + error.message);
            NOTIFS = NOTIFS.filter(x => x !== n); if (notifCount) { notifCount.total = Math.max(0, notifCount.total - 1); if (!n.read_at) notifCount.unread = Math.max(0, notifCount.unread - 1); } return refreshNotifUI();
          }
          openNotif(n);
        };
    };
