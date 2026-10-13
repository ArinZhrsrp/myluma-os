// LUMA — core: live account sync
    // A change made on the server (an administrator upgrades the plan, switches an add-on on or off, deactivates the account,
    // a new contact request or message arrives) shows up straight away, with no refresh. Three things start a check:
    //   1. Supabase Realtime (migration 094): the person's own profile, add-ons and contacts
    //   2. a new notification (the app already listens for those)
    //   3. a slow timer and "the tab is visible again", for anything realtime missed (a sleeping tab, a dropped connection)
    (function () {
      let uid = null, busy = false, again = false, debounce = null, channel = null;
      const snap = () => JSON.stringify([LumaPlan.plan, LumaPlan.planExpires, LumaPlan.addons, LumaPlan.addonInfo, LumaPlan.lim, LumaPlan.admin]);

      async function refreshAccount() {
        if (!uid) return;
        if (busy) { again = true; return; }
        busy = true;
        try {
          const before = snap();
          const { data: pr, error } = await LumaAuth.getProfile();
          if (!error && pr && pr.disabled_at) { // deactivated while signed in: out at once
            try { await LumaAuth.client.auth.signOut(); } catch (e) { }
            location.replace('/login/?disabled=1'); return;
          }
          if (!error && pr) LUMA_PROFILE = pr;
          await LumaPlan.load();
          if (snap() === before) return;
          // something changed: everything drawn so far is drawn again with the new plan / add-ons
          const menuAdmin = document.getElementById('menuAdmin'); if (menuAdmin) menuAdmin.style.display = LumaPlan.admin ? '' : 'none';
          Object.keys(rendered).forEach(k => delete rendered[k]);
          await enforceModeAccess(); // sends the person out of Work / Study when that add-on is gone
          const pg = document.querySelector('.page.active'), key = pg ? pg.id.replace('page-', '') : '';
          if (key) goTo(key);
          flashToast('Your account was updated', 'Your plan or add-ons changed.', 'fa-circle-check', '#3b82f6');
        } catch (e) { /* offline or signed out: the next check tries again */ }
        finally { busy = false; if (again) { again = false; setTimeout(refreshAccount, 500); } }
      }
      const soon = () => { clearTimeout(debounce); debounce = setTimeout(refreshAccount, 600); };

      function contactsChanged() {
        const pg = document.getElementById('page-contacts');
        if (pg && pg.classList.contains('active') && typeof loadContactsData === 'function') loadContactsData();
      }

      window.lumaLiveStart = function (userId) {
        uid = userId;
        try {
          channel = LumaAuth.client.channel('luma-account-' + userId)
            .on('postgres_changes', { event: 'UPDATE', schema: 'luma', table: 'profiles', filter: 'id=eq.' + userId }, soon)
            .on('postgres_changes', { event: '*', schema: 'luma', table: 'user_addons', filter: 'user_id=eq.' + userId }, soon)
            .on('postgres_changes', { event: '*', schema: 'luma', table: 'contacts', filter: 'requester_id=eq.' + userId }, contactsChanged)
            .on('postgres_changes', { event: '*', schema: 'luma', table: 'contacts', filter: 'addressee_id=eq.' + userId }, contactsChanged)
            .subscribe();
        } catch (e) { /* the timer below still keeps things fresh */ }
        setInterval(() => { if (!document.hidden) refreshAccount(); }, 30000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshAccount(); contactsChanged(); } });
        window.addEventListener('online', soon);
      };
      // called for every new notification: a gift, a plan change, a contact request or a chat message all arrive this way
      window.lumaLiveNotif = function (row) {
        soon();
        if (row && (row.type === 'message' || /^contact/.test(row.type || ''))) contactsChanged();
      };
    })();
