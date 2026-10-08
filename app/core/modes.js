// LUMA — core: modes (Personal / Work / Study)
    // The switcher at the top of the menu. Personal is the normal LUMA; Work and Study are add-ons (see
    // supabase/migrations/044_addons.sql) that bring their own menu. A mode without its add-on shows what it is and
    // how to get it. `live: false` = still being built: the add-on is shown as "coming soon" and can't be bought or tried yet
    // (an admin can still switch it on from the Admin page to test it).
    const ADDONS = {
      work: { name: 'Work', icon: 'fa-briefcase', color: '#60a5fa', tag: 'Projects & teams', price: 'RM15 / month', live: false,
        perks: ['Projects with tasks, assignees, due dates and status', 'Board, list and timeline (Gantt) views', 'Comments and file uploads on every task', 'Invite people who already have a LUMA account', 'Time tracking and a monthly timesheet you can download'] },
      study: { name: 'Study', icon: 'fa-graduation-cap', color: '#34d399', tag: 'Classes & assignments', price: 'RM7 / month', live: false,
        perks: ['Weekly timetable for your classes', 'Assignments, tests and exams with reminders', 'Group projects: invite classmates who already have LUMA', 'Study sessions tied to each subject', 'Grades and a semester planner'] },
    };
    const MODE_HOME = { personal: 'dashboard', work: 'work', study: 'study' };
    // what each add-on mode shows in the menu (Personal shows everything that is not mode-only); Settings, Support and Admin always show
    const MODE_MENUS = { work: ['work', 'calendar', 'reminders', 'documents', 'contacts', 'assistant'], study: ['study', 'calendar', 'reminders', 'notes', 'documents', 'assistant'] };
    const MODE_ALWAYS = ['settings', 'support', 'admin', 'adminreport', 'notifications'];
    let LUMA_MODE = 'personal';

    function applyModeMenus() {
      document.querySelectorAll('#sidebar nav .menu').forEach(m => {
        const k = m.dataset.page, only = m.dataset.only;
        const show = MODE_ALWAYS.includes(k) ? true : only ? only === LUMA_MODE : LUMA_MODE === 'personal' || MODE_MENUS[LUMA_MODE].includes(k);
        m.classList.toggle('mode-off', !show);
      });
      const sw = document.getElementById('modeSwitch'); if (!sw) return;
      sw.dataset.mode = LUMA_MODE;
      sw.querySelectorAll('button').forEach(b => {
        const m = b.dataset.mode;
        b.classList.toggle('on', m === LUMA_MODE);
        b.classList.toggle('locked', m !== 'personal' && !LumaPlan.hasAddon(m) && !(m === 'study' && LumaPlan.guestStudy));
      });
    }
    // keeps the menu in step with the page being opened (a search result or a link can open any page)
    function modeSync(key) {
      let m = LUMA_MODE;
      if (key === 'work' || key === 'study') m = key;
      else if (m !== 'personal' && !MODE_MENUS[m].includes(key) && !MODE_ALWAYS.includes(key)) m = 'personal';
      if (m === LUMA_MODE) return;
      LUMA_MODE = m; try { localStorage.setItem('luma_mode', m); } catch (e) { }
      Object.keys(rendered).forEach(k => delete rendered[k]); // every page shows the new mode's items
      setLumaPref('mode', m);
      applyModeMenus();
    }
    function switchMode(m) {
      if (m !== 'personal' && !LumaPlan.hasAddon(m) && !(m === 'study' && LumaPlan.guestStudy)) return openAddon(m);
      LUMA_MODE = m; try { localStorage.setItem('luma_mode', m); } catch (e) { }
      Object.keys(rendered).forEach(k => delete rendered[k]); // every page shows the new mode's items
      setLumaPref('mode', m);
      applyModeMenus();
      goTo(MODE_HOME[m]);
    }
    // someone invited to a group project (or already in one) may open the Groups tab of Study even without the add-on
    async function sdCheckGuest() {
      if (LumaPlan.hasAddon('study') || typeof LumaStudy === 'undefined') return;
      try { const r = await LumaStudy.groups.list(); if (!r.error && (r.data || []).length) { LumaPlan.guestStudy = true; applyModeMenus(); } } catch (e) { }
    }
    // on sign-in: go back to the mode the person was in (only if they still have its add-on)
    function initModes() {
      let m = 'personal';
      try { m = ((LUMA_PROFILE && LUMA_PROFILE.preferences && LUMA_PROFILE.preferences.mode) || localStorage.getItem('luma_mode') || 'personal'); } catch (e) { }
      if (m !== 'work' && m !== 'study' || !LumaPlan.hasAddon(m)) m = 'personal';
      sdCheckGuest(); // a classmate invited to a group project can open Study (Groups) without the add-on
      LUMA_MODE = m; applyModeMenus();
      if (m !== 'personal' && !location.hash) goTo(MODE_HOME[m]); // a refresh keeps its page (#hash); a fresh start opens the mode's home
    }
    document.getElementById('modeSwitch').addEventListener('click', e => { const b = e.target.closest('button[data-mode]'); if (b && b.dataset.mode !== LUMA_MODE) switchMode(b.dataset.mode); });

    // ----- the add-on popup (what it is, and how to get it) -----
    let addonKey = null;
    function openAddon(key) {
      const a = ADDONS[key]; if (!a) return; addonKey = key;
      const ends = (LumaPlan.addonInfo[key] || {}).expires_at;
      docEl('addonTitle').textContent = a.name + ' mode';
      docEl('addonHero').style.setProperty('--ac', a.color);
      docEl('addonHero').innerHTML = `<span class="ai"><i class="fa-solid ${a.icon}"></i></span><div><div class="an">${a.name} add-on</div><div class="at">${a.tag}${a.live ? ' · ' + a.price : ''}</div></div>${a.live ? '' : '<span class="soon">Coming soon</span>'}`;
      docEl('addonPerks').style.setProperty('--ac', a.color);
      docEl('addonPerks').innerHTML = a.perks.map(x => `<li><i class="fa-solid fa-check"></i><span>${x}</span></li>`).join('');
      docEl('addonError').textContent = '';
      const btn = [];
      if (a.live) {
        if (LumaPlan.canTrial(key)) btn.push(`<button type="button" class="confirm-btn save" data-trial>Start 7-day free trial</button>`);
        btn.push(`<button type="button" class="confirm-btn ${LumaPlan.canTrial(key) ? 'cancel' : 'save'}" data-ask><i class="fa-brands fa-whatsapp"></i> Get ${a.name} on WhatsApp</button>`);
      }
      docEl('addonActions').innerHTML = (a.live ? '' : `<div class="ls" style="margin-bottom:4px">We're building this right now. It works on every plan (Dawn, Glow and Zenith) and will open here when it's ready.</div>`) + btn.join('');
      docEl('addonOverlay').classList.add('open');
      docEl('addonOverlay').querySelectorAll('.pem-body, .profile-edit-modal').forEach(el => { el.scrollTop = 0; });
    }
    const closeAddon = () => docEl('addonOverlay').classList.remove('open');
    docEl('addonClose').onclick = closeAddon;
    docEl('addonOverlay').onclick = async e => {
      if (e.target === docEl('addonOverlay')) return closeAddon();
      const a = ADDONS[addonKey]; if (!a) return;
      if (e.target.closest('[data-ask]')) {
        const num = String(window.LUMA_WHATSAPP || '').replace(/\D/g, ''); if (!num) return;
        const msg = `Hi LUMA! I'd like to add ${a.name} mode.\n\nName: ${lumaFullName()}\nEmail: ${lumaEmail()}\nCurrent plan: ${LumaPlan.name()}\nAdd-on: ${a.name}\nPrice: ${a.price}`;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener'); return closeAddon();
      }
      const t = e.target.closest('[data-trial]'); if (!t) return;
      t.disabled = true;
      const { error } = await LumaAuth.client.schema('luma').rpc('start_addon_trial', { p_addon: addonKey });
      if (error) { t.disabled = false; docEl('addonError').textContent = error.message; return; }
      const key = addonKey; closeAddon(); await LumaPlan.load(); switchMode(key);
      flashToast(a.name + ' trial started', 'Free for 7 days', 'fa-check', '#22c55e');
    };
