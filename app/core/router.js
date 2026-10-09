// LUMA — core: router
    const MODULES = {};   // page renderers: each module folder adds its own  MODULES.<page> = function () { … }
    const WIRE = {};      // page wiring:    each module folder adds its own  WIRE.<page> = function (pg) { … }


    // ---------- Nav item click: set active + switch page ----------
    const pageTitle = document.getElementById('pageTitle');
    const titles = {
      dashboard: 'Dashboard', calendar: 'Calendar', reminders: 'Reminders', work: 'Work', company: 'Company', feedback: 'Feedback', adminfeedback: 'Feedback inbox', study: 'Study', studyarchive: 'Study archive', admin: 'Admin', adminreport: 'Plan report', tasks: 'Tasks & Work', money: 'Money',
      subscriptions: 'Subscriptions', bills: 'Bills', goals: 'Goals', habits: 'Habits', health: 'Health',
      notes: 'Notes & Docs', documents: 'Documents', contacts: 'Contacts', assistant: 'Lumi',
      analytics: 'Analytics', settings: 'Settings', purchases: 'Purchase history', split: 'Split expenses', support: 'Support', notifications: 'Notifications'
    };
    const rendered = {};
    const FIT_PAGES = new Set(['documents', 'notes', 'notifications', 'habits', 'goals', 'bills', 'subscriptions', 'money', 'tasks', 'calendar', 'analytics', 'reminders', 'purchases', 'split', 'admin', 'adminreport', 'dashboard', 'settings', 'purchases', 'split', 'health', 'contacts', 'assistant', 'support', 'work', 'company', 'study', 'studyarchive', 'work', 'feedback', 'adminfeedback']); // pages whose header stays fixed while their list scrolls
    // Contacts, Tasks, Documents and Notes hold live data instead of static mock content, so
    // they re-fetch on every visit instead of rendering once.
    const LIVE_MODULES = new Set(['contacts', 'tasks', 'documents', 'notes', 'notifications', 'health', 'habits', 'goals', 'bills', 'subscriptions', 'money', 'analytics', 'reminders', 'admin', 'adminreport', 'study', 'studyarchive', 'work', 'company', 'feedback', 'adminfeedback']);

    // pages whose markup is "heading + content": the content goes into one scrolling box so the heading stays put
    const FIT_WRAP = new Set(['split', 'health', 'contacts', 'assistant', 'support', 'work', 'company', 'study', 'studyarchive', 'feedback', 'adminfeedback']);
    function fitWrap(pg, key) {
      if (!FIT_WRAP.has(key) || pg.querySelector(':scope > .fit-root')) return;
      const head = pg.querySelector(':scope > .page-head'), box = document.createElement('div'); box.className = 'fit-root';
      [...pg.children].forEach(c => { if (c !== head) box.appendChild(c); });
      pg.appendChild(box);
    }
    function goTo(key) {
      if (!key || !titles[key]) return;
      if (key === 'feedback') { const cur = document.querySelector('.page.active'); if (cur && cur.id !== 'page-feedback') window.LU_PREV_PAGE = cur.id.replace('page-', ''); }   // the Feedback page starts on the module you came from
      if ((key === 'work' || key === 'study') && !LumaPlan.hasAddon(key) && !lumaModeOpen(key)) return openAddon(key);
      if (key === 'company' && !LumaPlan.hasAddon('work')) return openAddon('work'); // companies are for people with the Work add-on
      if (key === 'studyarchive' && !LumaPlan.hasAddon('study')) return openAddon('study'); // the archive is for people with the Study add-on // the add-on isn't switched on for this account
      modeSync(key);
      closeContactChat(); // tear down any open chat's realtime subscription before navigating away
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const pg = document.getElementById('page-' + key);
      if (pg) pg.classList.add('active');
      pageTitle.textContent = titles[key];
      document.querySelectorAll('.menu').forEach(i => i.classList.toggle('active', i.dataset.page === (key === 'adminreport' ? 'admin' : key)));
      if (MODULES[key] && (!rendered[key] || LIVE_MODULES.has(key))) { pg.innerHTML = MODULES[key](); fitWrap(pg, key); rendered[key] = true; LumaLoader.page(pg, key, wireModule(key)); } else if (key !== 'dashboard') LumaLoader.page(pg, key);
      const mc = document.querySelector('.main-content');
      mc.classList.toggle('fit', FIT_PAGES.has(key));
      if (key === 'calendar') calOnShow();
      if (key === 'dashboard') { const dg = pg.querySelector('.dashboard-grid'); if (dg) dg.scrollTop = 0; }
      if (key === 'dashboard' && typeof LumaLoader !== 'undefined') LumaLoader.page(pg, key, loadDashboard().catch(e => console.error('LUMA: dashboard failed to load', e)));
      mc.scrollTop = 0; if (pg) pg.scrollTop = 0; // on phones the page itself is the scroller
      // remember the page in the URL so a browser refresh lands back here
      try { history.replaceState(null, '', '#' + key); } catch (e) { }
    }

    document.querySelectorAll('.menu').forEach(item => {
      item.addEventListener('click', function () {
        const key = this.dataset.page;
        if (key) goTo(key);
        if (window.innerWidth <= 768) toggleSidebar();
      });
    });

    // =====================================================
    //  MODULE PAGE RENDERERS
    // =====================================================

    function wireModule(key) {
      let wp = null; // the page's data load, so the loading cover can wait for it
      const pg = document.getElementById('page-' + key);
      // toggle switches
      pg.querySelectorAll('.switch').forEach(s => s.addEventListener('click', () => s.classList.toggle('on')));
      // habit rows
      // add-card
      pg.querySelectorAll('.add-card').forEach(a => a.addEventListener('click', () => {
        const col = a.parentElement;
        if (!col.querySelector('.kcol-head') || key === 'tasks') return;
        const c = document.createElement('div'); c.className = 'card kcard';
        c.innerHTML = '<div class="kt">New task</div><div class="kmeta"><span class="pill pill-low">Low</span><span>Personal</span></div>';
        col.insertBefore(c, a);
      }));
      const wire = WIRE[key]; // each page registers its own wiring in WIRE (see its module folder)
      if (wire) { const r = wire(pg, key); if (r !== undefined) wp = r; }
      return wp;
    }
