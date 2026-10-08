// LUMA — core: appearance
    // ---------- Background wallpaper ----------
    const BGS = [
      { name: 'Valley', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1920&q=80', thumb: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&q=60' },
      { name: 'Foggy forest', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80', thumb: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&q=60' },
      { name: 'Starry peak', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80', thumb: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&q=60' },
      { name: 'Dusk ridge', url: 'https://images.unsplash.com/photo-1444080748397-f442aa95c3e5?w=1920&q=80', thumb: 'https://images.unsplash.com/photo-1444080748397-f442aa95c3e5?w=300&q=60' },
      { name: 'Aurora', url: 'https://images.unsplash.com/photo-1502790671504-542ad42d5189?w=1920&q=80', thumb: 'https://images.unsplash.com/photo-1502790671504-542ad42d5189?w=300&q=60' },
          { name:'Alpine lake', url:'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80', thumb:'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&q=60' },
      { name:'Forest light', url:'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80', thumb:'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&q=60' },
      { name:'Sunset sea', url:'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=1920&q=80', thumb:'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=300&q=60' },
      { name:'Rocky peak', url:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80', thumb:'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=300&q=60' },
      { name:'Waterfall', url:'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&q=80', thumb:'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=300&q=60' },
      { name:'Mirror lake', url:'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80', thumb:'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=300&q=60' },
];
    // a wallpaper value is a picture address, or "storage:<path>" for the image you uploaded (kept in your private storage)
    async function bgAddress(val) {
      if (!val || !String(val).startsWith('storage:')) return val;
      const { data, error } = await LumaAuth.client.storage.from('luma-backgrounds').createSignedUrl(String(val).slice(8), 60 * 60 * 24 * 7);
      return error || !data ? null : data.signedUrl;
    }
    async function applyBgValue(val) { const a = await bgAddress(val); if (a) applyBg(a); return !!a; }
    function applySavedBg() {
      const saved = LUMA_PROFILE && LUMA_PROFILE.background_url;
      applyBg(String(saved || '').startsWith('storage:') ? BGS[0].url : (saved || BGS[0].url)); // something nice straight away...
      if (String(saved || '').startsWith('storage:')) applyBgValue(saved).catch(() => { }); // ...then your own picture as soon as its address is ready
    }
    // shrink a picture to at most 1920 px and re-save it as a JPEG, so a phone photo doesn't fill your storage
    function shrinkImage(file, max = 1920) {
      return new Promise((resolve, reject) => {
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
          const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          c.toBlob(b => b ? resolve(b) : reject(new Error('Could not process that picture.')), 'image/jpeg', 0.85);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as a picture.')); };
        img.src = url;
      });
    }
    function applyBg(val) { document.documentElement.style.setProperty('--app-bg', val.indexOf('url(') === 0 ? val : "url('" + val + "')"); }

    // ---------- Theme ----------
    const THEMES = {
      slate: 'rgba(100,116,139,0.28)',   // lightest: a soft grey-blue haze over the wallpaper
      midnight: 'rgba(15,23,42,0.45)',   // the default: deep navy
      obsidian: 'rgba(2,3,10,0.64)',     // darkest, but your wallpaper still shows through
    };
    function applyTheme(t) { if (THEMES[t]) document.documentElement.style.setProperty('--theme-tint', THEMES[t]); }

    // ---------- Preference toggles ----------
    // Background, theme and preferences all live on luma.profiles now (see
    // applyUserUI below) instead of localStorage, so they follow the
    // account rather than the browser.
    // Your look and settings (theme, wallpaper, preferences) live in your account, so they follow you to any device.
    // If saving fails (offline, a hiccup) the change is kept on this device and sent the next time you open LUMA.
    const PENDING_PROFILE = 'luma_profile_pending';
    async function saveProfile(fields) {
      const { data, error } = await LumaAuth.updateProfile(fields);
      if (!error) { LUMA_PROFILE = data; return { data }; }
      try { const p = JSON.parse(localStorage.getItem(PENDING_PROFILE) || '{}'); localStorage.setItem(PENDING_PROFILE, JSON.stringify({ ...p, ...fields })); } catch (e) { }
      console.warn("LUMA: couldn't save to your account yet", error.message);
      flashToast("Couldn't save that to your account", "It's kept on this device and will be saved when you next open LUMA online.", 'fa-triangle-exclamation', '#f59e0b');
      return { error };
    }
    async function flushPendingProfile() {
      try {
        const p = JSON.parse(localStorage.getItem(PENDING_PROFILE) || 'null'); if (!p) return;
        const { data, error } = await LumaAuth.updateProfile(p);
        if (!error) { LUMA_PROFILE = data; localStorage.removeItem(PENDING_PROFILE); }
      } catch (e) { }
    }
    async function setLumaPref(key, val) {
      const prefs = { ...((LUMA_PROFILE && LUMA_PROFILE.preferences) || {}), [key]: val };
      if (LUMA_PROFILE) LUMA_PROFILE.preferences = prefs; // use it at once; the save follows
      await saveProfile({ preferences: prefs });
    }

    const prefOn = (key, dflt) => { const v = ((LUMA_PROFILE && LUMA_PROFILE.preferences) || {})[key]; return v === undefined ? dflt : !!v; };
    // soft interface sounds (Settings → Preferences → Interface sounds); generated in the browser, no files
    let _audio = null, _lastSound = 0;
    function uiSound(freq = 620, dur = 0.05, force = false) {
      if (!force && !prefOn('sounds', false)) return;
      try {
        const now = Date.now(); if (!force && now - _lastSound < 60) return; _lastSound = now;
        _audio = _audio || new (window.AudioContext || window.webkitAudioContext)(); if (_audio.state === 'suspended') _audio.resume();
        const o = _audio.createOscillator(), g = _audio.createGain(), t = _audio.currentTime;
        o.type = 'sine'; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(_audio.destination); o.start(t); o.stop(t + dur + 0.02);
      } catch (e) { }
    }
    document.addEventListener('click', e => {
      if (!prefOn('sounds', false)) return;
      const sw = e.target.closest('.switch'); if (sw) return setTimeout(() => uiSound(sw.classList.contains('on') ? 760 : 520), 0);
      if (e.target.closest('button, .menu, .quick-btn, .check-row, .h-chip, .create-btn')) uiSound(e.target.closest('.save, .create-btn, .check-row') ? 700 : 600);
    }, true);
