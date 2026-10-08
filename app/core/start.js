// LUMA — core: start
    (async function authGate() {
      const session = await LumaAuth.requireSession("/login/");
      if (!session) return; // requireSession already redirected
      LUMA_USER = session.user;

      await flushPendingProfile(); // anything that could not be saved last time
      const { data, error } = await LumaAuth.getProfile();
      if (!error) LUMA_PROFILE = data;
      await LumaPlan.load(); // which plan this account is on, and its limits
      if (window.lumaFocusLoad) window.lumaFocusLoad(); // timer lengths + ambience saved in the profile
      Object.keys(rendered).forEach(k => delete rendered[k]); // anything drawn before the plan was known is drawn again
      if (LumaPlan.admin) document.getElementById('menuAdmin').style.display = '';
      setAppTimezone((LUMA_PROFILE && LUMA_PROFILE.timezone) || (LUMA_USER.user_metadata && LUMA_USER.user_metadata.timezone)); // the time zone chosen at sign-up / in Edit profile
      if (error) console.info("LUMA: luma.profiles not reachable yet (run supabase/migrations/001_profiles_contacts_chat.sql and expose the schema) — using signup metadata instead.", error.message);

      applyUserUI();
      initNotifications(session.user.id);
      initReminders();
      loadDashboard().catch(e => console.error('LUMA: dashboard failed to load', e)).then(() => LumaLoader.release('app'));
      resyncPush();
      maybePromptPlan().then(() => maybePromptPush()); // the plan offer first, then the push offer
    })();


    // restore the page from the URL hash after a refresh (e.g. #documents)
    // A fresh launch (app killed and reopened, or a new tab) opens on the Dashboard home; only a refresh
    // keeps the page. A tapped push notification opens with ?from=push and goes to its page.
    (function () {
      let fresh = true; try { fresh = !sessionStorage.getItem('luma_booted'); sessionStorage.setItem('luma_booted', '1'); } catch (e) { }
      const fromPush = /[?&]from=push\b/.test(location.search);
      if (fresh && !fromPush) { if (location.hash) history.replaceState(null, '', location.pathname + location.search); return; }
      const key = decodeURIComponent(location.hash.slice(1));
      if (key && key !== 'dashboard' && titles[key]) LumaPlan.loaded.then(() => goTo(key)); // wait for the plan so locked things render locked
    })();
