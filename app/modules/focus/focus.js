// LUMA — module: focus
    // ---------- Focus mode (Pomodoro timer + ambience) ----------
    // Saved: your three timer lengths, your ambience sound and its volume (in your profile, so they follow you to any device),
    // and every completed focus session (luma.focus_sessions) for the "today" line.
    (function initFocus() {
      const overlay = document.getElementById('focusOverlay');
      const durs = { focus: 25, short: 5, long: 15 };
      let mode = 'focus', remaining = durs.focus * 60, total = durs.focus * 60, running = false, tick = null, startedAt = null;
      const phaseLabel = { focus: 'Deep work session', short: 'Short break', long: 'Long break' };
      const timeEl = document.getElementById('fmTime');
      const ringEl = document.getElementById('fmRing');
      const phaseEl = document.getElementById('fmPhase');
      const playBtn = document.getElementById('fmPlay');
      let curSound = 'none', volume = 0.5, previewTimer = null;

      const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      const cap = k => k[0].toUpperCase() + k.slice(1);
      function render() {
        timeEl.textContent = fmt(remaining);
        ringEl.style.width = (100 - remaining / total * 100) + '%';
      }
      function paintDurs() {
        Object.keys(durs).forEach(k => { document.getElementById('dur' + cap(k)).textContent = durs[k]; document.getElementById('lbl' + cap(k)).textContent = durs[k]; });
        const w = document.getElementById('focusWidgetSub'); if (w) w.textContent = 'Deep work · ' + durs.focus + ' mins';
      }
      function setMode(m) {
        mode = m; total = durs[m] * 60; remaining = total; stop();
        document.querySelectorAll('.fm-mode').forEach(o => o.classList.toggle('active', o.dataset.mode === m));
        phaseEl.textContent = phaseLabel[m];
        render();
      }
      function stop() { running = false; clearInterval(tick); playBtn.innerHTML = '<i class="fa-solid fa-play"></i>'; Ambience.stop(); }
      function start() {
        running = true; playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>'; clearTimeout(previewTimer);
        if (mode === 'focus' && remaining === total) startedAt = new Date().toISOString();
        Ambience.play(curSound, volume);
        tick = setInterval(() => {
          if (remaining > 0) { remaining--; render(); }
          else finish();
        }, 1000);
      }
      function toggle() { running ? stop() : start(); }
      function finish() {
        const was = mode; stop(); if (curSound !== 'none' || prefOn('sounds', false)) Ambience.chime();
        if (was === 'focus') {
          flashToast('Focus session done 🎉', `${durs.focus} minutes. Time for a break.`, 'fa-crosshairs', '#3b82f6');
          recordSession(durs.focus);
          setMode('short');
        } else { flashToast('Break over', 'Ready for the next focus session?', 'fa-mug-hot', '#22c55e'); setMode('focus'); }
      }

      // ---- saved setup ----
      let saveT = null;
      const setup = () => ({ focus: durs.focus, short: durs.short, long: durs.long, sound: curSound, volume: Math.round(volume * 100) });
      function saveSetup() {
        try { localStorage.setItem('luma_focus_setup', JSON.stringify(setup())); } catch (e) { }
        clearTimeout(saveT); saveT = setTimeout(() => { if (typeof LUMA_PROFILE !== 'undefined' && LUMA_PROFILE) setLumaPref('focus_setup', setup()); }, 700);
      }
      function paintVol() { const el = document.getElementById('fmVol'), p = el.value + '%'; el.style.setProperty('--v', p); document.getElementById('fmVolPct').textContent = p; }
      function applySetup(c) {
        if (!c) return;
        ['focus', 'short', 'long'].forEach(k => { const v = Number(c[k]); if (v >= 1 && v <= 90) durs[k] = Math.round(v); });
        if (typeof c.sound === 'string') curSound = c.sound;
        if (c.volume >= 0 && c.volume <= 100) volume = c.volume / 100;
        paintDurs();
        document.querySelectorAll('.fm-sound').forEach(o => o.classList.toggle('active', o.dataset.sound === curSound));
        document.getElementById('fmVol').value = Math.round(volume * 100); paintVol();
        if (!running) setMode(mode);
      }
      function loadSetup() {
        let c = null;
        try { c = (LUMA_PROFILE && LUMA_PROFILE.preferences && LUMA_PROFILE.preferences.focus_setup) || JSON.parse(localStorage.getItem('luma_focus_setup') || 'null'); } catch (e) { }
        applySetup(c);
      }
      window.lumaFocusLoad = loadSetup; // called again once the profile is known

      // ---- history ----
      // Study add-on: tag the session with a subject (for "study time" on the Study page)
      const subjectId = () => { const row = document.getElementById('fmSubjectRow'); return row && row.style.display !== 'none' ? document.getElementById('fmSubject').value : ''; };
      async function paintSubjects() {
        const row = document.getElementById('fmSubjectRow'), sel = document.getElementById('fmSubject'); if (!row) return;
        if (!LumaPlan.hasAddon('study') || LUMA_MODE !== 'study' || typeof sdEnsureLoaded !== 'function') { row.style.display = 'none'; return; }
        await sdEnsureLoaded();
        if (!SD.courses.length) { row.style.display = 'none'; return; }
        const keep = sel.value; sel.innerHTML = '<option value="">No subject</option>' + SD.courses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
        sel.value = SD.courses.some(c => c.id === keep) ? keep : ''; skinSelect(sel); row.style.display = '';
      }
      async function recordSession(minutes) {
        try { await LumaAuth.client.schema('luma').from('focus_sessions').insert({ minutes, sound: curSound, started_at: startedAt || new Date().toISOString(), ...(subjectId() ? { course_id: subjectId() } : {}) }); } catch (e) { }
        paintStats();
      }
      async function paintStats() {
        const el = document.getElementById('fmStats'); if (!el) return;
        try {
          const since = new Date(); since.setHours(0, 0, 0, 0);
          const { data, error } = await LumaAuth.client.schema('luma').from('focus_sessions').select('minutes').gte('started_at', since.toISOString());
          if (error || !data) { el.textContent = ''; return; }
          const mins = data.reduce((t, r) => t + r.minutes, 0);
          el.textContent = data.length ? `Today: ${data.length} session${data.length === 1 ? '' : 's'} · ${mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60 ? mins % 60 + 'm' : '') : mins + ' min'} of focus` : 'No focus sessions yet today';
        } catch (e) { el.textContent = ''; }
      }

      // ---- ambience, generated in the browser (no files): each sound is shaped noise plus a little movement ----
      const Ambience = (() => {
        let ctx = null, master = null, nodes = [], timers = [];
        const ensure = () => { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; };
        const noise = kind => { // 4 seconds of white / pink / brown noise, looped
          const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
          if (kind === 'white') for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          else if (kind === 'brown') { let l = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } }
          else { let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; } }
          const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; return src;
        };
        const lfo = (freq, depth, target) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = freq; g.gain.value = depth; o.connect(g); g.connect(target); o.start(); nodes.push(o, g); };
        const filt = (type, f, q) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q) n.Q.value = q; nodes.push(n); return n; };
        const gain = v => { const g = ctx.createGain(); g.gain.value = v; nodes.push(g); return g; };
        const every = (fn, minMs, maxMs) => { const loop = () => { fn(); timers.push(setTimeout(loop, minMs + Math.random() * (maxMs - minMs))); }; timers.push(setTimeout(loop, minMs)); };
        const blip = (freq, dur, vol, type = 'sine', sweepTo = null) => { // a short tone: a bird, a clink
          const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime; o.type = type; o.frequency.setValueAtTime(freq, t);
          if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
        };
        const pop = vol => { // a fire crackle: a tiny burst of noise
          const t = ctx.currentTime, src = noise('white'), f = filt('highpass', 1800), g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05 + Math.random() * 0.06);
          src.connect(f); f.connect(g); g.connect(master); src.start(t); src.stop(t + 0.15);
        };
        function stop() {
          timers.forEach(clearTimeout); timers = [];
          if (master) { try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setTargetAtTime(0, ctx.currentTime, 0.15); } catch (e) { } }
          const old = nodes, oldMaster = master; nodes = []; master = null;
          setTimeout(() => { old.forEach(n => { try { n.stop && n.stop(); } catch (e) { } try { n.disconnect(); } catch (e) { } }); if (oldMaster) { try { oldMaster.disconnect(); } catch (e) { } } }, 600);
        }
        function play(kind, vol) { try { playInner(kind, vol); } catch (e) { /* no audio support: the timer still works */ } }
        function playInner(kind, vol) {
          stop(); if (kind === 'none') return; ensure();
          master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination); master.gain.setTargetAtTime(vol, ctx.currentTime, 0.4); // fades in
          const chain = (src, ...ns) => { let p = src; ns.forEach(n => { p.connect(n); p = n; }); p.connect(master); src.start(); nodes.push(src); return p; };
          if (kind === 'rain') { // steady hiss with a soft shimmer, plus drops
            const hiss = gain(0.5); lfo(0.2, 0.08, hiss.gain); chain(noise('white'), filt('highpass', 800), filt('lowpass', 7000), hiss);
            const rumble = gain(0.25); chain(noise('brown'), filt('lowpass', 400), rumble);
            every(() => blip(2500 + Math.random() * 2500, 0.05, 0.015, 'sine', 1200), 120, 500);
          } else if (kind === 'forest') { // gentle wind in leaves and now and then a bird
            const wind = gain(0.35); lfo(0.07, 0.2, wind.gain); const bp = filt('bandpass', 700, 0.6); lfo(0.05, 300, bp.frequency); chain(noise('pink'), bp, wind);
            every(() => { const f = 2400 + Math.random() * 1600; blip(f, 0.12, 0.05, 'sine', f * 1.3); setTimeout(() => ctx && master && blip(f * 1.1, 0.1, 0.04, 'sine', f * 1.4), 160); }, 2500, 7000);
          } else if (kind === 'cafe') { // low murmur of voices and an occasional clink
            const murmur = gain(0.5); lfo(0.4, 0.15, murmur.gain); const bp = filt('bandpass', 500, 0.8); chain(noise('pink'), bp, filt('lowpass', 1400), murmur);
            every(() => blip(3200 + Math.random() * 1500, 0.08, 0.035, 'triangle'), 3500, 11000);
          } else if (kind === 'waves') { // slow swells
            const swell = gain(0.4); lfo(0.09, 0.35, swell.gain); const lp = filt('lowpass', 900); lfo(0.09, 500, lp.frequency); chain(noise('brown'), lp, swell);
            const foam = gain(0.15); lfo(0.09, 0.12, foam.gain); chain(noise('white'), filt('highpass', 2500), foam);
          } else if (kind === 'brown') { // a deep, even hum
            chain(noise('brown'), filt('lowpass', 800), gain(0.7));
          } else if (kind === 'fire') { // low roar and crackles
            chain(noise('brown'), filt('lowpass', 500), gain(0.45));
            every(() => pop(0.25 + Math.random() * 0.35), 60, 700);
          } else { // white noise
            chain(noise('white'), filt('lowpass', 9000), gain(0.25));
          }
        }
        function setVolume(v) { if (master) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1); }
        function chime() { try { ensure(); const m = ctx.createGain(); m.gain.value = 0.12; m.connect(ctx.destination); [660, 880].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.22; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); o.connect(g); g.connect(m); o.start(t); o.stop(t + 0.7); }); } catch (e) { } }
        return { play, stop, setVolume, chime };
      })();

      // open/close
      function open() { overlay.classList.add('open'); paintStats(); paintSubjects(); }
      function close() { overlay.classList.remove('open'); }
      document.querySelectorAll('.focus, .focus button').forEach(el => el.addEventListener('click', open));
      document.getElementById('fmClose').addEventListener('click', close);
      overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

      // controls
      playBtn.addEventListener('click', toggle);
      document.getElementById('fmReset').addEventListener('click', () => { remaining = total; stop(); render(); });
      document.getElementById('fmSkip').addEventListener('click', () => { setMode(mode === 'focus' ? 'short' : 'focus'); });
      document.querySelectorAll('.fm-mode').forEach(o => o.addEventListener('click', () => setMode(o.dataset.mode)));

      // duration steppers (saved)
      document.querySelectorAll('.fm-stepper').forEach(st => {
        const key = st.dataset.dur;
        st.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
          durs[key] = Math.max(1, Math.min(90, durs[key] + parseInt(b.dataset.step)));
          paintDurs();
          if (key === mode) { total = durs[key] * 60; remaining = total; stop(); render(); }
          saveSetup();
        }));
      });

      // sounds (saved): while the timer runs the new sound takes over at once; otherwise you hear a short preview
      document.querySelectorAll('.fm-sound').forEach(s => s.addEventListener('click', () => {
        document.querySelectorAll('.fm-sound').forEach(o => o.classList.remove('active'));
        s.classList.add('active'); curSound = s.dataset.sound; saveSetup();
        clearTimeout(previewTimer);
        Ambience.play(curSound, volume);
        if (!running && curSound !== 'none') previewTimer = setTimeout(() => { if (!running) Ambience.stop(); }, 5000);
      }));
      document.getElementById('fmVol').addEventListener('input', e => { volume = e.target.value / 100; paintVol(); Ambience.setVolume(volume); saveSetup(); });

      loadSetup(); setMode('focus');
    })();
