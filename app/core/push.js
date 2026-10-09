// LUMA — core: push
    // ---------- Web Push (device notifications when LUMA is closed) ----------
    // Needs: LUMA served over http://localhost or https (not file://), a VAPID public key in shared/push-config.js,
    // and the send-push Edge Function deployed — see README → "Background reminders & push".
    const pushPossible = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname));
    const pushConfigured = () => !!(window.LUMA_VAPID_PUBLIC_KEY || '').trim();
    const b64ToBytes = b64 => { const pad = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); };
    async function pushRegistration() { return navigator.serviceWorker.register('/sw.js'); }
    // 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on'  (+ 'tab' = tab-only notifications when push isn't possible)
    async function pushStatus() {
      if (!('Notification' in window)) return 'unsupported';
      if (!pushPossible() || !pushConfigured()) return Notification.permission === 'granted' ? 'tab-on' : Notification.permission === 'denied' ? 'denied' : 'tab';
      if (Notification.permission === 'denied') return 'denied';
      try { const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription(); return sub && Notification.permission === 'granted' ? 'on' : 'off'; } catch (e) { return 'off'; }
    }
    async function enablePush() {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return perm;
      if (!pushPossible() || !pushConfigured()) return 'granted';
      const reg = await pushRegistration(); await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(window.LUMA_VAPID_PUBLIC_KEY.trim()) });
      const { error } = await LumaNotifications.savePushSubscription(sub.toJSON());
      if (error) throw new Error(/push_subscriptions|schema cache/i.test(error.message) ? 'Run supabase/migrations/014_server_reminders_and_push.sql first.' : error.message);
      return 'granted';
    }
    async function disablePush() {
      const reg = await navigator.serviceWorker.getRegistration(); const sub = reg && await reg.pushManager.getSubscription();
      if (sub) { await LumaNotifications.removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
    }

    // ---- push on/off UI shared by the Reminders modal, Settings and the login prompt ----
    const PUSH_TEXT = {
      unsupported: ['Not supported by this browser. On iPhone, add LUMA to your Home Screen first.', null],
      denied: ['Blocked — allow notifications for LUMA in your device or browser settings.', null],
      on: ['On — reminders and messages reach this device even when LUMA is closed.', 'Turn off'],
      off: ['Off — turn on to get reminders on this device even when LUMA is closed.', 'Enable'],
      tab: ['Off — enable to get notifications on this device. (Closed-app push needs a VAPID key — see README.)', 'Enable'],
      'tab-on': ['On while LUMA is open in a browser tab. (Closed-app push needs a VAPID key — see README.)', null],
    };
    const PUSH_CONTROLS = [['remBrowserState', 'remBrowserBtn', 'remError'], ['setPushState', 'setPushBtn', 'setPushError']];
    async function paintPushControls() {
      const st = await pushStatus(), T = PUSH_TEXT[st];
      PUSH_CONTROLS.forEach(([tid, bid]) => {
        const txt = document.getElementById(tid), btn = document.getElementById(bid);
        if (!txt || !btn) return;
        txt.textContent = T[0]; btn.style.display = T[1] ? '' : 'none'; if (T[1]) btn.textContent = T[1]; btn.dataset.st = st;
      });
      const sw = document.getElementById('setNotifSwitch'), sub = document.getElementById('setNotifSub');
      if (sw) sw.classList.toggle('on', st === 'on' || st === 'tab-on');
      if (sub) sub.textContent = ({ on: 'On. Reminders and messages reach this device even when LUMA is closed.', 'tab-on': 'On while LUMA is open in a browser tab.', off: 'Off. Turn on to get reminders on this device, even when LUMA is closed.', tab: 'Off. Turn on to get notifications on this device.', denied: 'Blocked. Allow notifications for LUMA in your device or browser settings.', unsupported: 'Not supported by this browser. On iPhone, add LUMA to your Home Screen first.' })[st] || '';
      // once notifications are on, the Reminders modal doesn't need the box (turn them off in Settings)
      const dev = document.getElementById('remDevice'); if (dev) dev.style.display = (st === 'on' || st === 'tab-on') ? 'none' : '';
      return st;
    }
    async function togglePush(btn, errId) {
      btn.disabled = true;
      try { if (btn.dataset.st === 'on') { await disablePush(); try { localStorage.setItem('luma_push_declined', '1'); } catch (e) { } } else await enablePush(); }
      catch (e) { const el = document.getElementById(errId); if (el) { el.textContent = e.message || 'Could not change notification settings.'; el.style.display = 'flex'; } }
      btn.disabled = false; return paintPushControls();
    }
    // a tapped push notification asks the open dashboard to go to the right page
    if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'open-page' && e.data.link && titles[e.data.link]) luOpenTarget(e.data.link, e.data.ref, e.data.ntype); });
    // keep the worker registered (so pushes can be received) for users who already turned it on
    // re-save this device's subscription after login so the server row comes back if it was ever dropped
    function resyncPush() {
      if (pushPossible() && pushConfigured() && Notification.permission === 'granted') {
        pushRegistration().then(async reg => { await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await LumaNotifications.savePushSubscription(sub.toJSON()); }).catch(() => { });
      }
    }
