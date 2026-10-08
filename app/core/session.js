// LUMA — core: session
    // ---------- Auth gate: require a signed-in session, personalize the UI ----------
    let LUMA_USER = null;
    let LUMA_PROFILE = null; // row from luma.profiles, once the schema is exposed + migrated

    // Prefer the real luma.profiles row (kept in sync via Settings → Edit);
    // fall back to the auth.users signup metadata if the schema isn't wired
    // up yet, so the UI never breaks either way.
    function lumaName() {
      if (LUMA_PROFILE && LUMA_PROFILE.first_name) return LUMA_PROFILE.first_name;
      return LumaAuth.displayName(LUMA_USER);
    }
    function lumaFullName() {
      if (LUMA_PROFILE && (LUMA_PROFILE.first_name || LUMA_PROFILE.last_name)) {
        return [LUMA_PROFILE.first_name, LUMA_PROFILE.last_name].filter(Boolean).join(" ");
      }
      return LumaAuth.fullName(LUMA_USER);
    }
    function lumaInitial() { return lumaName().charAt(0).toUpperCase(); }
    function lumaCountry() { return (LUMA_PROFILE && LUMA_PROFILE.country) || (LUMA_USER && LUMA_USER.user_metadata && LUMA_USER.user_metadata.country) || ""; }
    function lumaEmail() { return (LUMA_PROFILE && LUMA_PROFILE.email) || (LUMA_USER && LUMA_USER.email) || ""; }

    function applyUserUI() {
      applySavedBg();
      applyTheme((LUMA_PROFILE && LUMA_PROFILE.theme) || "midnight");
      const hour = mytHour();
      const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
      const greetEl = document.getElementById("greetName");
      if (greetEl) greetEl.textContent = timeGreeting + ", " + lumaName();
      const topbarDateEl = document.getElementById("topbarDate");
      if (topbarDateEl) topbarDateEl.textContent = mytTopbarDate();
      const greetDateEl = document.getElementById("greetDate");
      if (greetDateEl) greetDateEl.textContent = mytGreetingLine();
      document.querySelectorAll(".js-user-name").forEach(el => el.textContent = lumaName());
      document.querySelectorAll(".js-user-fullname").forEach(el => el.textContent = lumaFullName());
      document.querySelectorAll(".js-user-email").forEach(el => el.textContent = lumaEmail());
      document.querySelectorAll(".js-user-initial").forEach(el => el.textContent = lumaInitial());
    }


    // ---------- Ask to enable push after login ----------
    // Shown on login while this device isn't subscribed. "No thanks" (or turning push off in Settings) means never ask again on this
    // device; Settings → Push notifications and Health → Reminders still let the user enable it later.
    async function maybePromptPush() {
      try {
        if (!('Notification' in window) || Notification.permission === 'denied') return;
        const st = await pushStatus();
        if (st !== 'off' && st !== 'tab') return;
        let declined = false; try { declined = !!localStorage.getItem('luma_push_declined'); } catch (e) { }
        if (declined) return;
        const ov = document.getElementById('pushPromptOverlay'), yes = document.getElementById('pushPromptYes'), err = document.getElementById('pushPromptError');
        const close = () => ov.classList.remove('open');
        document.getElementById('pushPromptLater').onclick = () => { try { localStorage.setItem('luma_push_declined', '1'); } catch (e) { } close(); };
        yes.onclick = async () => {
          yes.disabled = true; err.style.display = 'none';
          try { await enablePush(); close(); paintPushControls(); }
          catch (e) { err.textContent = e.message || 'Could not turn on notifications.'; err.style.display = 'flex'; }
          yes.disabled = false;
        };
        ov.classList.add('open');
      } catch (e) { }
    }
