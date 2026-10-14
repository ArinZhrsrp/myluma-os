// LUMA — module: agentfloor (administrators)
// A pixel office that shows the AI feedback crew at work (migration 101 + supabase/functions/feedback-crew).
// It reads the same rows as the Feedback inbox: when a feedback arrives the lead walks to the whiteboard to sort it,
// the Engineer, Support and Product walk to their desks while their step is running, and everyone drifts back to
// the kitchen when the run is done. Nothing here changes data except "Ask the crew", which starts a run.
(function () {
  const AF = { rows: [], runs: {}, steps: {}, on: true, loaded: false, replay: null, lastSeen: {}, wired: false };
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BUSY = ['queued', 'triaging', 'working', 'merging'];

  // ---------- the crew (agent keys match crew_steps.agent) ----------
  const CREW = [
    { id: 'lead', name: 'Ada', role: 'Lead', look: { skin: '#E8B98F', hair: '#3A2418', style: 1, shirt: '#2F5DD0', pants: '#2A2F3A' } },
    { id: 'engineer', name: 'Cleo', role: 'Engineer', look: { skin: '#F1CDB0', hair: '#C8553D', style: 1, shirt: '#6B4FA0', pants: '#2A2F3A' }, desk: 0 },
    { id: 'support', name: 'Mira', role: 'Support', look: { skin: '#E2B48C', hair: '#E3C26A', style: 1, shirt: '#3C8D5A', pants: '#3B4252' }, desk: 1 },
    { id: 'product', name: 'Rue', role: 'Product', look: { skin: '#6E4630', hair: '#2B1D16', style: 0, shirt: '#D98E04', pants: '#2A2F3A' }, desk: 2 },
  ];
  const LABEL = { idle: 'idle', planning: 'sorting', awaiting: 'waiting', working: 'working', done: 'done', failed: 'blocked', reviewing: 'reviewing', queued: 'lining up' };

  // ---------- map (tile units, 8 px tiles, 40 × 24) ----------
  const T = 8, CORR = 15.5;
  const DOORS = { office: { x: 7.5, y: 9.5 }, meeting: { x: 13.5, y: 9.5 } };
  const DESKS = [];
  for (const row of [0, 1]) for (const col of [2, 9, 16, 23]) DESKS.push({ dx: col, dy: row ? 18 : 11, seat: { x: col + 2, y: row ? 17.3 : 14.1 }, facing: row ? 'down' : 'up' });
  const LEAD_SEAT = { x: 4, y: 3.7 }, WHITEBOARD = { x: 13.5, y: 3.9 };
  const KITCHEN = [{ x: 32.6, y: 6.4 }, { x: 34.8, y: 6.6 }, { x: 37, y: 7.2 }, { x: 32.4, y: 10.6 }, { x: 35.2, y: 11.2 }, { x: 37.4, y: 13 }, { x: 32.2, y: 19.4 }, { x: 37.6, y: 20.6 }, { x: 35.6, y: 15.6 }];
  const zoneOf = p => p.y < 9.6 && p.x < 10.5 ? 'office' : p.y < 9.6 && p.x < 25.5 ? 'meeting' : p.x > 30.4 ? 'kitchen' : 'floor';
  function route(a, b) {
    const za = zoneOf(a), zb = zoneOf(b), pts = [];
    if (za === zb && za !== 'floor') return [{ x: b.x, y: a.y }, b];
    if (DOORS[za]) { const d = DOORS[za]; pts.push({ x: d.x, y: a.y }, { x: d.x, y: CORR }); } else pts.push({ x: a.x, y: CORR });
    if (DOORS[zb]) { const d = DOORS[zb]; pts.push({ x: d.x, y: CORR }, { x: d.x, y: b.y }, { x: b.x, y: b.y }); } else pts.push({ x: b.x, y: CORR }, { x: b.x, y: b.y });
    return pts;
  }

  // ---------- where each person is and what they're doing ----------
  const rt = {}; const taken = new Array(KITCHEN.length).fill(null);
  function freeSpot(id) {
    const r = rt[id]; if (r.spot != null) taken[r.spot] = null;
    const free = KITCHEN.map((_, i) => i).filter(i => !taken[i]); const i = free.length ? free[Math.floor(Math.random() * free.length)] : 0;
    taken[i] = id; r.spot = i; return KITCHEN[i];
  }
  CREW.forEach(c => {
    rt[c.id] = { x: 0, y: 0, path: [], facing: 'down', sitting: false, anim: 0, spot: null, state: 'idle', note: '', target: '', wanderAt: performance.now() + 5000 + Math.random() * 10000 };
    if (c.id === 'lead') { Object.assign(rt.lead, { x: LEAD_SEAT.x, y: LEAD_SEAT.y, sitting: true, target: 'seat' }); }
    else { const p = freeSpot(c.id); Object.assign(rt[c.id], { x: p.x, y: p.y, target: 'kitchen' }); }
  });
  // go somewhere only when the destination changes, so a data refresh doesn't restart a walk
  function send(id, key, p, facing, sit) {
    const r = rt[id]; if (r.target === key) return; r.target = key;
    if (key !== 'kitchen' && r.spot != null) { taken[r.spot] = null; r.spot = null; }
    r.sitting = false; r.endFacing = facing || 'down'; r.endSit = !!sit;
    if (reduced()) { r.x = p.x; r.y = p.y; r.path = []; r.facing = r.endFacing; r.sitting = r.endSit; return; }
    r.path = route({ x: r.x, y: r.y }, p);
  }
  const toKitchen = id => { if (rt[id].target !== 'kitchen') send(id, 'kitchen', freeSpot(id), 'down', false); };
  const toDesk = c => send(c.id, 'desk', DESKS[c.desk].seat, DESKS[c.desk].facing, true);
  function step(r, dt) {
    if (!r.path.length) return;
    const t = r.path[0], dx = t.x - r.x, dy = t.y - r.y, d = Math.hypot(dx, dy), s = 5 * dt;
    if (d <= s) { r.x = t.x; r.y = t.y; r.path.shift(); if (!r.path.length) { r.facing = r.endFacing; r.sitting = r.endSit; } }
    else { r.x += dx / d * s; r.y += dy / d * s; r.anim += dt; r.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
  }

  // ---------- drawing ----------
  const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const plant = (c, x, y) => { R(c, x + 1, y + 6, 6, 4, '#B5653D'); R(c, x + 1, y + 6, 6, 1, '#8E4B2C'); R(c, x + 3, y, 2, 6, '#3E8E53'); R(c, x, y + 2, 3, 3, '#5DB36E'); R(c, x + 5, y + 1, 3, 3, '#5DB36E'); R(c, x + 2, y + 4, 4, 2, '#3E8E53'); };
  const chair = (c, x, y, col) => { R(c, x, y, 8, 5, col); R(c, x, y + 5, 8, 1, '#3A4252'); R(c, x + 1, y + 6, 1, 1, '#3A4252'); R(c, x + 6, y + 6, 1, 1, '#3A4252'); };
  const wallH = (c, x0, x1, ty) => { const w = (x1 - x0 + 1) * T; R(c, x0 * T, ty * T + 1, w, 5, '#EEE9E0'); R(c, x0 * T, ty * T + 6, w, 2, '#9AA1AD'); R(c, x0 * T, ty * T, w, 1, '#6E7684'); };
  const wallV = (c, tx, y0, y1) => { const h = (y1 - y0 + 1) * T; R(c, tx * T + 2, y0 * T, 4, h, '#EEE9E0'); R(c, tx * T + 1, y0 * T, 1, h, '#6E7684'); R(c, tx * T + 6, y0 * T, 1, h, '#9AA1AD'); };
  const windowAt = (c, x) => { R(c, x, 2, 22, 10, '#2A2F3A'); R(c, x + 1, 3, 9, 8, '#8EC3EC'); R(c, x + 12, 3, 9, 8, '#8EC3EC'); R(c, x + 2, 4, 2, 2, '#D6ECFA'); R(c, x + 13, 4, 2, 2, '#D6ECFA'); };
  let bg = null;
  function background() {
    if (bg) return bg; bg = document.createElement('canvas'); bg.width = 320; bg.height = 192; const c = bg.getContext('2d');
    R(c, 0, 0, 320, 192, '#1B1F27');
    for (let ty = 2; ty < 23; ty++) for (let tx = 1; tx < 39; tx++) {
      const z = zoneOf({ x: tx + .5, y: ty + .5 }), o = (tx + ty) % 2;
      R(c, tx * T, ty * T, T, T, z === 'office' ? (o ? '#8E9DB5' : '#8898B0') : z === 'meeting' ? (o ? '#9AA6BD' : '#94A1B8') : z === 'kitchen' ? (o ? '#E3D9C3' : '#D8CDB5') : (o ? '#A7BCB3' : '#9EB4AB'));
    }
    R(c, 0, 0, 320, 16, '#C5CCD6'); R(c, 0, 13, 320, 3, '#9AA3B0'); R(c, 0, 0, 320, 1, '#6E7684');
    [22, 140, 170, 205].forEach(x => windowAt(c, x));
    R(c, 62, 4, 7, 7, '#F4F6F8'); R(c, 62, 4, 7, 1, '#2A2F3A'); R(c, 62, 10, 7, 1, '#2A2F3A'); R(c, 62, 4, 1, 7, '#2A2F3A'); R(c, 68, 4, 1, 7, '#2A2F3A'); R(c, 65, 6, 1, 3, '#2A2F3A'); R(c, 65, 8, 2, 1, '#C8423B');
    R(c, 94, 2, 34, 11, '#6E7684'); R(c, 95, 3, 32, 9, '#FAFAF7');
    R(c, 250, 3, 52, 8, '#B8C1CC'); for (let x = 252; x < 300; x += 12) { R(c, x, 4, 10, 6, '#CDD4DC'); R(c, x + 8, 6, 1, 2, '#6E7684'); }
    wallV(c, 0, 2, 22); wallV(c, 39, 2, 22); wallH(c, 0, 39, 23); wallV(c, 10, 2, 9); wallH(c, 1, 6, 9); wallH(c, 8, 10, 9);
    wallH(c, 11, 12, 9); wallH(c, 14, 25, 9); wallV(c, 25, 2, 9); wallV(c, 30, 2, 13); wallV(c, 30, 17, 22);
    R(c, 16, 33, 34, 10, '#C89B61'); R(c, 16, 43, 34, 3, '#9C7240'); R(c, 17, 46, 2, 3, '#7A5530'); R(c, 47, 46, 2, 3, '#7A5530'); R(c, 38, 38, 8, 2, '#E6E9EE'); R(c, 20, 39, 6, 3, '#F4F6F8'); R(c, 21, 40, 4, 1, '#2F5DD0');
    R(c, 9, 18, 6, 22, '#7A5530'); [20, 26, 32].forEach((y, i) => R(c, 10, y, 4, 4, ['#C8423B', '#2F5DD0', '#3C8D5A'][i])); plant(c, 68, 58);
    R(c, 128, 34, 58, 18, '#B98A55'); R(c, 128, 50, 58, 2, '#8E643A'); for (let x = 132; x < 184; x += 13) { chair(c, x, 26, '#8E3B5A'); chair(c, x, 54, '#8E3B5A'); } plant(c, 186, 58);
    R(c, 212, 22, 22, 12, '#D7DCE2'); R(c, 212, 22, 22, 2, '#A8B1BC'); R(c, 216, 25, 14, 2, '#2A2F3A'); R(c, 218, 30, 10, 3, '#F4F6F8'); R(c, 224, 58, 8, 10, '#DCE3E8'); R(c, 225, 50, 6, 8, '#8EC5F0'); R(c, 226, 51, 2, 3, '#C8E5FA');
    for (const d of DESKS) { const x = d.dx * T, y = d.dy * T; R(c, x, y + 2, 32, 10, '#C89B61'); R(c, x, y + 12, 32, 3, '#9C7240'); R(c, x + 1, y + 15, 2, 2, '#7A5530'); R(c, x + 29, y + 15, 2, 2, '#7A5530'); R(c, x + 11, y + 8, 10, 2, '#E6E9EE'); R(c, x + 24, y + 6, 4, 3, '#F4F6F8'); chair(c, d.seat.x * T - 4, d.facing === 'up' ? d.seat.y * T - 6 : d.seat.y * T - 8, '#6B7C95'); }
    [[10, 170], [226, 170], [10, 82], [226, 82], [298, 172], [250, 60]].forEach(([x, y]) => plant(c, x, y));
    R(c, 248, 16, 44, 12, '#9AA6B3'); R(c, 248, 16, 44, 2, '#C9D1DA'); R(c, 252, 10, 8, 8, '#3A3F4A'); R(c, 254, 12, 4, 3, '#C8423B'); R(c, 266, 13, 10, 3, '#B8C1CC');
    R(c, 294, 14, 16, 28, '#E2E8ED'); R(c, 294, 14, 16, 1, '#6E7684'); R(c, 294, 41, 16, 1, '#6E7684'); R(c, 294, 26, 16, 1, '#9AA1AD'); R(c, 307, 18, 1, 5, '#6E7684'); R(c, 307, 29, 1, 6, '#6E7684');
    R(c, 262, 146, 30, 14, '#C89B61'); R(c, 262, 158, 30, 2, '#9C7240'); R(c, 268, 149, 6, 4, '#F4F6F8'); R(c, 280, 150, 5, 3, '#E3C26A');
    [[266, 138], [282, 138], [266, 162], [282, 162]].forEach(([x, y]) => chair(c, x, y, '#8E3B5A'));
    return bg;
  }
  function person(c, L, px, py, facing, frame, sitting) {
    const x = Math.round(px) - 4, y = Math.round(py) - 13, P = (xx, yy, w, h, col) => { c.fillStyle = col; c.fillRect(x + xx, y + yy, w, h); };
    if (sitting) P(2, 10, 4, 2, L.pants); else { const a = frame ? 1 : 0; P(2, 10, 2, 3 - a, L.pants); P(4, 10, 2, 2 + a, L.pants); P(2, 12 - a, 2, 1, '#1B1F27'); P(4, 11 + a, 2, 1, '#1B1F27'); }
    P(1, 6, 6, 4, L.shirt); P(0, 6, 1, 3, L.shirt); P(7, 6, 1, 3, L.shirt); P(0, 9, 1, 1, L.skin); P(7, 9, 1, 1, L.skin); P(1, 1, 6, 5, L.skin);
    if (facing === 'up') { P(1, 0, 6, 5, L.hair); P(2, 5, 4, 1, L.skin); if (L.style === 1) { P(0, 1, 1, 6, L.hair); P(7, 1, 1, 6, L.hair); P(1, 5, 6, 2, L.hair); } }
    else { if (L.style !== 2) P(1, 0, 6, 2, L.hair); else P(2, 0, 4, 1, L.hair); P(1, 2, 1, 2, L.hair); P(6, 2, 1, 2, L.hair); if (L.style === 1) { P(0, 1, 1, 6, L.hair); P(7, 1, 1, 6, L.hair); } const ex = facing === 'left' ? -1 : facing === 'right' ? 1 : 0; P(2 + ex, 3, 1, 1, '#1B1F27'); P(5 + ex, 3, 1, 1, '#1B1F27'); }
  }
  function monitor(c, x, y, on, t) {
    R(c, x, y, 10, 7, '#2B303A'); R(c, x + 4, y + 7, 2, 1, '#2B303A');
    if (!on) return R(c, x + 1, y + 1, 8, 5, '#55657C');
    R(c, x + 1, y + 1, 8, 5, '#13301F'); const o = Math.floor(t / 180) % 4; for (let i = 0; i < 3; i++) R(c, x + 2, y + 2 + i, 2 + ((i * 3 + o) * 5) % 6, 1, '#5BE08F');
  }
  const GLOW = { working: '#34d399', planning: '#60a5fa', reviewing: '#60a5fa', awaiting: '#60a5fa', done: '#a78bfa', failed: '#f87171', queued: '#fbbf24' };

  let last = performance.now(), loopOn = false, scale = 1;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const pg = document.getElementById('page-agentfloor'), cv = document.getElementById('afCanvas');
    const ctx = cv && cv.getContext ? cv.getContext('2d') : null; // no canvas (very old or locked-down browsers): the panels still work
    if (pg && pg.classList.contains('active') && ctx && !document.hidden) {
      CREW.forEach(c => step(rt[c.id], dt));
      if (!reduced()) CREW.forEach(c => { const r = rt[c.id]; if (c.id !== 'lead' && r.state === 'idle' && r.target === 'kitchen' && !r.path.length && now > r.wanderAt) { r.wanderAt = now + 9000 + Math.random() * 16000; r.target = ''; toKitchen(c.id); } });
      ctx.drawImage(background(), 0, 0);
      const planning = rt.lead.state === 'planning', lines = planning ? 1 + Math.floor(now / 400) % 4 : 2;
      for (let i = 0; i < lines; i++) R(ctx, 97, 4 + i * 2, [18, 24, 14, 22][i], 1, ['#2F5DD0', '#C8423B', '#3C8D5A', '#2A2F3A'][i]);
      monitor(ctx, 27, 29, ['reviewing', 'awaiting', 'planning'].includes(rt.lead.state), now);
      DESKS.forEach((d, i) => { const c = CREW.find(x => x.desk === i), r = c && rt[c.id]; monitor(ctx, d.dx * T + 11, d.dy * T, !!(r && r.state === 'working' && r.sitting), now + i * 97); });
      CREW.slice().sort((a, b) => rt[a.id].y - rt[b.id].y).forEach(c => {
        const r = rt[c.id], px = r.x * T, py = r.y * T, g = GLOW[r.state];
        if (g) { ctx.globalAlpha = .45; R(ctx, px - 6, py - 1, 12, 2, g); R(ctx, px - 4, py - 2, 8, 1, g); R(ctx, px - 4, py + 1, 8, 1, g); ctx.globalAlpha = 1; }
        person(ctx, c.look, px, py, r.facing, r.path.length ? Math.floor(r.anim * 8) % 2 : 0, r.sitting);
        const b = document.querySelector('#afWrap [data-afb="' + c.id + '"]');
        if (b) { const txt = LABEL[r.state] || r.state; if (b.textContent !== txt) b.textContent = txt; b.dataset.s = r.state;
          const bw = b.offsetWidth, bh = b.offsetHeight, W = 320 * scale; // keep the bubble inside the office
          b.style.left = Math.min(W - bw / 2 - 2, Math.max(bw / 2 + 2, px * scale)) + 'px'; b.style.top = Math.max(bh + 2, (py - 15) * scale) + 'px'; }
      });
    }
    requestAnimationFrame(frame);
  }
  function fit() {
    const st = document.getElementById('afStage'), cv = document.getElementById('afCanvas'); if (!st || !cv) return;
    const w = st.clientWidth - 16; let s = w / 320; s = s >= 2 ? Math.min(4, Math.floor(s)) : Math.max(0.8, s); scale = s;
    cv.style.width = (320 * s) + 'px'; cv.style.height = (192 * s) + 'px';
  }

  // ---------- data → what everyone does ----------
  const snip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const fbOf = run => AF.rows.find(f => f.id === run.feedback_id);
  function setState(id, state, note) { rt[id].state = state; rt[id].note = note || ''; }
  function act(run, stepsOverride) {
    const f = fbOf(run), about = f ? snip((f.module + (f.part ? ' › ' + f.part : '')) + ': ' + f.message, 70) : 'a feedback';
    const steps = stepsOverride || AF.steps[run.id] || [];
    if (run.status === 'queued' || run.status === 'triaging') { setState('lead', 'planning', 'Sorting ' + about); send('lead', 'board', WHITEBOARD, 'up', false); }
    else if (run.status === 'working') { setState('lead', 'awaiting', 'Waiting on the crew: ' + about); send('lead', 'seat', LEAD_SEAT, 'down', true); }
    else if (run.status === 'merging') { setState('lead', 'reviewing', 'Putting together ' + about); send('lead', 'seat', LEAD_SEAT, 'down', true); }
    CREW.filter(c => c.id !== 'lead').forEach(c => {
      const s = steps.find(x => x.agent === c.id);
      if (!s || run.status === 'queued' || run.status === 'triaging') { setState(c.id, 'idle'); toKitchen(c.id); return; }
      setState(c.id, s.status === 'working' ? 'working' : s.status === 'failed' ? 'failed' : 'done', snip(s.task, 80)); toDesk(c);
    });
  }
  function settle() { setState('lead', 'idle'); send('lead', 'seat', LEAD_SEAT, 'down', true); CREW.forEach(c => { if (c.id !== 'lead') { setState(c.id, 'idle'); toKitchen(c.id); } }); }
  // the newest run that is still going drives the floor; a run that just finished stays on screen a few seconds
  function sync() {
    if (AF.replay) return;
    const runs = Object.values(AF.runs).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const live = runs.find(r => BUSY.includes(r.status));
    const justDone = !live && runs.find(r => r.status === 'done' && r.finished_at && Date.now() - new Date(r.finished_at).getTime() < 8000);
    if (live) act(live);
    else if (justDone) { act({ ...justDone, status: 'merging' }); setState('lead', 'done', 'Finished: ' + snip(justDone.summary, 70)); }
    else settle();
    paintSide();
  }

  // ---------- replay the last finished run, step by step ----------
  function replay() {
    const run = Object.values(AF.runs).filter(r => r.status === 'done').sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
    if (!run) return luAlert('The crew has not finished a feedback yet, so there is nothing to replay. Send a feedback first.');
    const steps = AF.steps[run.id] || [], sw = steps.map(s => ({ ...s, status: 'working' }));
    if (AF.replay) AF.replay.forEach(clearTimeout);
    const at = (ms, fn) => setTimeout(fn, reduced() ? Math.min(ms, 300) : ms);
    AF.replay = [
      at(0, () => act({ ...run, status: 'triaging' })),
      at(3500, () => act({ ...run, status: 'working' }, sw)),
      at(9000, () => act({ ...run, status: 'working' }, steps)),
      at(11000, () => act({ ...run, status: 'merging' }, steps)),
      at(14000, () => { setState('lead', 'done', 'Finished: ' + snip(run.summary, 70)); paintSide(); }),
      at(18000, () => { AF.replay = null; sync(); }),
    ];
    flashToast('Replaying', snip((fbOf(run) || {}).message || 'the last run', 60), 'fa-clapperboard', '#a78bfa');
    const tick = setInterval(() => { if (!AF.replay) return clearInterval(tick); paintSide(); }, 500);
  }

  // ---------- data ----------
  async function load() {
    const sb = LumaAuth.client.schema('luma');
    const f = await sb.from('feedback').select('id, kind, module, part, message, status, created_at').order('created_at', { ascending: false }).limit(30);
    if (f.error) return;
    AF.rows = f.data || [];
    const ids = AF.rows.map(x => x.id);
    if (!ids.length) { AF.runs = {}; AF.steps = {}; AF.loaded = true; return sync(); }
    const r = await sb.from('crew_runs').select('id, feedback_id, status, category, severity, summary, error, created_at, finished_at').in('feedback_id', ids).order('created_at', { ascending: false }).limit(200);
    if (r.error) { AF.on = false; AF.loaded = true; return paintSide(); }
    AF.on = true; const runs = {};
    (r.data || []).forEach(x => { if (!runs[x.feedback_id]) runs[x.feedback_id] = x; });
    AF.runs = {}; Object.values(runs).forEach(x => { AF.runs[x.id] = x; });
    const runIds = Object.keys(AF.runs); AF.steps = {};
    if (runIds.length) { const s = await sb.from('crew_steps').select('run_id, agent, task, status, output, started_at, finished_at').in('run_id', runIds).order('started_at'); (s.data || []).forEach(x => { (AF.steps[x.run_id] = AF.steps[x.run_id] || []).push(x); }); }
    AF.loaded = true; sync();
  }
  let soonT = null;
  const soon = () => { clearTimeout(soonT); soonT = setTimeout(() => { const pg = document.getElementById('page-agentfloor'); if (pg && pg.classList.contains('active') && !document.hidden) load().catch(() => { }); }, 600); };

  // ---------- side panel: the queue, the crew, what happened ----------
  const runOf = fid => Object.values(AF.runs).find(r => r.feedback_id === fid);
  const CHIP = { none: ['Not checked', '#94a3b8'], queued: ['Lining up', '#fbbf24'], triaging: ['Sorting', '#60a5fa'], working: ['Working', '#34d399'], merging: ['Putting together', '#60a5fa'], done: ['Done', '#a78bfa'], failed: ['Failed', '#f87171'] };
  function paintSide() {
    const q = document.getElementById('afQueue'), crew = document.getElementById('afCrew'), log = document.getElementById('afLog'), sub = document.getElementById('afSub');
    if (!q) return;
    if (!AF.on) { q.innerHTML = '<div class="af-empty">Run <b>supabase/migrations/101_feedback_crew.sql</b> first, then come back.</div>'; return; }
    const busy = Object.values(AF.runs).filter(r => BUSY.includes(r.status)).length, unchecked = AF.rows.filter(f => !runOf(f.id) && f.status === 'new').length;
    if (sub) sub.textContent = AF.replay ? 'Replaying the last run' : busy ? `${busy} feedback being worked on` : unchecked ? `${unchecked} new feedback the crew has not checked` : 'All caught up';
    crew.innerHTML = CREW.map(c => { const r = rt[c.id]; return `<div class="af-member" data-s="${r.state}"><canvas width="10" height="9" data-afav="${c.id}"></canvas><div><b>${c.name}</b> <span class="fb-dim">${c.role}</span><div class="af-st"><i></i>${LABEL[r.state] || r.state}</div>${r.note ? `<div class="af-note">${escapeHtml(r.note)}</div>` : ''}</div></div>`; }).join('');
    crew.querySelectorAll('[data-afav]').forEach(cv => { const c = CREW.find(x => x.id === cv.dataset.afav), x = cv.getContext && cv.getContext('2d'); if (!x) return; x.clearRect(0, 0, 10, 9); person(x, c.look, 5, 13, 'down', 0, true); });
    q.innerHTML = AF.rows.length ? AF.rows.slice(0, 12).map(f => { const r = runOf(f.id), ch = CHIP[r ? r.status : 'none'] || CHIP.none;
      return `<div class="af-q" data-afq="${f.id}"><div class="af-qh"><span class="fb-k" style="--c:${ch[1]}">${ch[0]}</span><b>${escapeHtml(f.module)}${f.part ? ' › ' + escapeHtml(f.part) : ''}</b></div><div class="af-qm">${escapeHtml(snip(f.message, 110))}</div>${!r || r.status === 'failed' ? `<button type="button" class="np-btn" data-afask="${f.id}"><i class="fa-solid fa-play"></i> Ask the crew</button>` : r.status === 'done' && r.summary ? `<div class="af-qs">${escapeHtml(snip(r.summary, 140))}</div>` : ''}</div>`; }).join('')
      : '<div class="af-empty">No feedback yet. When someone sends one, the crew starts here.</div>';
    // what happened, newest first (from the runs' and steps' own times)
    const ev = [];
    Object.values(AF.runs).forEach(r => { const f = fbOf(r), what = f ? snip(f.module + ': ' + f.message, 50) : 'a feedback';
      ev.push([r.created_at, `Ada picked up “${what}”`]);
      (AF.steps[r.id] || []).forEach(s => { const c = CREW.find(x => x.id === s.agent); ev.push([s.started_at, `${c ? c.name : s.agent} started`]); if (s.finished_at) ev.push([s.finished_at, `${c ? c.name : s.agent} ${s.status === 'failed' ? 'got stuck' : 'finished'}`]); });
      if (r.finished_at) ev.push([r.finished_at, r.status === 'failed' ? `The crew could not finish: ${snip(r.error, 60)}` : `Done: ${snip(r.summary, 70)}`]); });
    ev.sort((a, b) => (b[0] || '').localeCompare(a[0] || ''));
    log.innerHTML = ev.length ? ev.slice(0, 14).map(([t, s]) => `<div class="af-ev"><time>${t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time><span>${escapeHtml(s)}</span></div>`).join('') : '<div class="af-empty">Nothing yet.</div>';
  }
  async function ask(id, btn) {
    if (btn) btn.disabled = true;
    const { data, error } = await LumaAuth.client.functions.invoke('feedback-crew', { body: { feedback_id: id } });
    if (error || (data && data.error)) { if (btn) btn.disabled = false; let msg = (data && data.error) || ''; try { if (!msg && error.context) msg = (await error.context.json()).error; } catch (e) { } return luAlert(msg || 'The crew is not set up yet: deploy supabase/functions/feedback-crew and set its secrets.'); }
    AF.runs[data.run_id] = { id: data.run_id, feedback_id: id, status: 'queued', created_at: new Date().toISOString() }; sync(); soon();
  }

  // ---------- page ----------
  MODULES.agentfloor = function () {
    return head('Agent floor', '<span id="afSub">Loading…</span>', '<button class="create-btn" id="afReplay" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-clapperboard"></i> Replay last run</button><button class="create-btn" id="afInbox"><i class="fa-regular fa-comment-dots"></i> Feedback inbox</button>')
      + `<div class="af-grid"><div class="af-main"><div class="af-stage" id="afStage"><div class="af-wrap" id="afWrap"><canvas id="afCanvas" width="320" height="192" aria-label="The AI crew's office"></canvas>${CREW.map(c => `<div class="af-bubble" data-afb="${c.id}"></div>`).join('')}</div></div>
        ${card('<div class="section-title"><i class="fa-solid fa-users"></i> The crew</div><div class="af-crew" id="afCrew"></div>')}</div>
        <div class="af-side">${card('<div class="section-title"><i class="fa-solid fa-inbox"></i> Latest feedback</div><div id="afQueue" class="af-queue"></div>')}${card('<div class="section-title"><i class="fa-solid fa-clock-rotate-left"></i> What happened</div><div id="afLog" class="af-log"></div>')}</div></div>`;
  };
  WIRE.agentfloor = async function (pg) {
    if (!LumaPlan.admin) { pg.querySelector('#afSub').textContent = 'Not allowed'; pg.querySelector('.af-grid').innerHTML = card('<div class="ls">This page is only for administrators.</div>'); return; }
    pg.querySelector('#afInbox').onclick = () => goTo('adminfeedback');
    pg.querySelector('#afReplay').onclick = replay;
    pg.querySelector('.af-side').addEventListener('click', e => {
      const a = e.target.closest('[data-afask]'); if (a) return void ask(a.dataset.afask, a);
      if (e.target.closest('[data-afq]')) goTo('adminfeedback');
    });
    pg.querySelector('#afCanvas').addEventListener('click', () => goTo('adminfeedback'));
    if (!AF.wired) {
      AF.wired = true;
      try { LumaAuth.client.channel('luma-agentfloor').on('postgres_changes', { event: '*', schema: 'luma', table: 'crew_runs' }, soon).on('postgres_changes', { event: '*', schema: 'luma', table: 'crew_steps' }, soon).subscribe(); } catch (e) { /* the timer below catches up */ }
      setInterval(soon, 8000); // new feedback the crew has not seen yet, and anything Realtime missed
      setInterval(() => { const pg2 = document.getElementById('page-agentfloor'); if (pg2 && pg2.classList.contains('active') && !AF.replay) sync(); }, 2000); // let a finished run settle
      window.addEventListener('resize', fit);
    }
    if (!loopOn) { loopOn = true; requestAnimationFrame(frame); }
    fit(); setTimeout(fit, 50); paintSide();
    await load();
  };
})();
