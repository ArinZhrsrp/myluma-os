// LUMA — module: study (flashcards with spaced repetition: a card you know comes back later, one you miss comes back sooner)
    // Tables and the deck statistics function: supabase/migrations/067. Decks sit in your active semester like the rest of Study.
    const SDK = { decks: [], stats: {}, loaded: false, err: null, edit: null, run: null };
    SD_TABS.splice(Math.max(0, SD_TABS.findIndex(t => t[0] === 'groups')), 0, ['cards', 'Cards', 'fa-clone']);
    SD_VIEW.cards = sdCardsView; SD_ONSHOW.cards = sdCardsLoad; SD_ADD.cards = ['New deck', () => sdDeckOpen(null)];

    async function sdCardsLoad() {
      try {
        const [d, s] = await Promise.all([LumaStudy.decks.list(), LumaStudy.rpc('my_deck_stats', { p_today: sdKey() })]);
        SDK.err = d.error ? d.error.message : null; SDK.decks = (d.data || []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
        SDK.stats = {}; (s.data || []).forEach(r => { SDK.stats[r.deck_id] = r; });
      } catch (e) { SDK.err = e.message || 'Could not load'; }
      SDK.loaded = true; if (SD.tab === 'cards') sdPaint();
    }
    const sdDeckVisible = d => !(d.semester_id && sdSem(d.semester_id) && sdSem(d.semester_id).archived_at);
    function sdCardsView() {
      if (!SDK.loaded) return '<div class="lu-empty">Loading…</div>';
      if (SDK.err) return card(`<div class="lu-empty">Could not load your flashcards: ${escapeHtml(SDK.err)}. ${/study_decks|study_cards|my_deck_stats|schema cache|does not exist/i.test(SDK.err) ? 'Has <b>supabase/migrations/067_study_attendance_cards.sql</b> been run in the Supabase SQL Editor?' : ''}</div>`);
      const decks = SDK.decks.filter(sdDeckVisible), st = d => SDK.stats[d.id] || { total: 0, due: 0 }, dueAll = decks.reduce((a, d) => a + st(d).due, 0);
      if (!decks.length) return card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-clone"></i></div><div class="h-empty-t">Make flashcards to remember things</div><div class="h-empty-s">Add a deck for a subject, write a question and an answer on each card, then test yourself. Cards you find easy come back less often; the ones you miss come back sooner.</div><div class="h-empty-chips"><button type="button" class="h-chip" data-deck-new><i class="fa-solid fa-plus" style="color:#34d399"></i>Make your first deck</button></div></div>`);
      return `<div class="sx-deckbar"><div><b>${dueAll}</b> card${dueAll === 1 ? '' : 's'} to review today</div>${dueAll ? '<button type="button" class="create-btn" data-run-all><i class="fa-solid fa-play"></i> Review all due</button>' : ''}</div>
        <div class="grid-2">${decks.map(d => { const s = st(d), c = sdCourse(d.course_id);
          return `<div class="card sx-deck" data-deck="${d.id}"><div class="sx-dh"><b>${escapeHtml(d.title)}</b>${sdCC(c)}</div><div class="sx-ds"><span><b>${s.total}</b> card${s.total === 1 ? '' : 's'}</span><span class="${s.due ? 'due' : ''}"><b>${s.due}</b> due</span></div>
            <div class="sx-da"><button type="button" class="create-btn" data-run="${d.id}" ${s.total ? '' : 'disabled'}><i class="fa-solid fa-play"></i> ${s.due ? 'Review ' + s.due : s.total ? 'Practise' : 'No cards yet'}</button><button type="button" class="np-btn" data-deck-edit="${d.id}"><i class="fa-solid fa-pen"></i> Edit</button></div></div>`; }).join('')}</div>`;
    }
    SD_CLICK.push(e => {
      if (e.target.closest('[data-deck-new]')) { sdDeckOpen(null); return true; }
      const ed = e.target.closest('[data-deck-edit]'); if (ed) { sdDeckOpen(SDK.decks.find(x => x.id === ed.dataset.deckEdit)); return true; }
      const rn = e.target.closest('[data-run]'); if (rn) { sdRunStart([rn.dataset.run]); return true; }
      if (e.target.closest('[data-run-all]')) { sdRunStart(SDK.decks.filter(sdDeckVisible).map(d => d.id)); return true; }
      return false;
    });

    // ---------- the deck editor ----------
    const sdDeckErr = m => sdErr('sdDeckError', m);
    function sdDeckPaint() {
      const E = SDK.edit; docEl('sdDeckCount').textContent = `(${E.cards.filter(c => !c.gone).length})`;
      docEl('sdDeckCards').innerHTML = E.cards.map((c, i) => c.gone ? '' : `<div class="sx-ce" data-i="${i}"><input type="text" data-f value="${escapeHtml(c.front)}" maxlength="500" placeholder="Front"><input type="text" data-b value="${escapeHtml(c.back)}" maxlength="1000" placeholder="Back"><button type="button" class="tk-x" data-rm title="Remove card"><i class="fa-solid fa-xmark"></i></button></div>`).join('') || '<div class="lu-empty">No cards yet. Add one below, or paste several.</div>';
    }
    async function sdDeckOpen(d) {
      if (!d && !sdActiveSem()) { sdNeedSem(); return; }
      SDK.edit = { id: d ? d.id : null, cards: [] }; docEl('sdDeckHead').textContent = d ? 'Edit deck' : 'New deck'; docEl('sdDeckTitle').value = d ? d.title : ''; sdCourseOptions('sdDeckCourse', d ? d.course_id : null, true);
      docEl('sdDeckFront').value = ''; docEl('sdDeckBack').value = ''; docEl('sdDeckPaste').value = ''; docEl('sdDeckDelete').style.display = d ? '' : 'none'; sdDeckErr('');
      if (d) { docEl('sdDeckCards').innerHTML = '<div class="lu-empty">Loading cards…</div>'; sdOpen('sdDeckOverlay'); const r = await LumaStudy.cards.inDeck(d.id); SDK.edit.cards = (r.data || []).map(c => ({ ...c, orig: { front: c.front, back: c.back } })); }
      else sdOpen('sdDeckOverlay');
      sdDeckPaint(); if (!d) setTimeout(() => docEl('sdDeckTitle').focus(), 50);
    }
    const sdDeckClose = () => sdClose('sdDeckOverlay');
    docEl('sdDeckClose').onclick = sdDeckClose; docEl('sdDeckOverlay').onclick = e => { if (e.target === docEl('sdDeckOverlay')) sdDeckClose(); };
    function sdDeckAddCard() {
      const f = docEl('sdDeckFront').value.trim(), b = docEl('sdDeckBack').value.trim(); if (!f || !b) return sdDeckErr('Write both sides of the card.');
      if (SDK.edit.cards.filter(c => !c.gone).length >= 500) return sdDeckErr('A deck can have up to 500 cards.');
      sdDeckErr(''); SDK.edit.cards.push({ front: f, back: b, isNew: true }); docEl('sdDeckFront').value = ''; docEl('sdDeckBack').value = ''; sdDeckPaint(); docEl('sdDeckFront').focus();
      const box = docEl('sdDeckCards'); box.scrollTop = box.scrollHeight;
    }
    docEl('sdDeckAdd').onclick = sdDeckAddCard;
    [docEl('sdDeckFront'), docEl('sdDeckBack')].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sdDeckAddCard(); } }));
    docEl('sdDeckPasteGo').onclick = () => {
      const lines = docEl('sdDeckPaste').value.split('\n').map(l => l.trim()).filter(Boolean); let added = 0, skipped = 0;
      lines.forEach(l => { const m = /^(.+?)\s*(?:\||\t)\s*(.+)$/.exec(l); if (!m || SDK.edit.cards.filter(c => !c.gone).length >= 500) { skipped++; return; } SDK.edit.cards.push({ front: m[1].slice(0, 500), back: m[2].slice(0, 1000), isNew: true }); added++; });
      docEl('sdDeckPaste').value = ''; sdDeckPaint(); sdDeckErr(skipped ? `${added} added. ${skipped} line${skipped === 1 ? '' : 's'} skipped (write each as: front | back).` : '');
    };
    docEl('sdDeckCards').addEventListener('input', e => { const row = e.target.closest('.sx-ce'); if (!row) return; const c = SDK.edit.cards[+row.dataset.i]; if (e.target.matches('[data-f]')) c.front = e.target.value; else if (e.target.matches('[data-b]')) c.back = e.target.value; });
    docEl('sdDeckCards').addEventListener('click', e => { const row = e.target.closest('.sx-ce'); if (!row || !e.target.closest('[data-rm]')) return; const c = SDK.edit.cards[+row.dataset.i]; if (c.isNew) SDK.edit.cards.splice(+row.dataset.i, 1); else c.gone = true; sdDeckPaint(); });
    docEl('sdDeckSave').onclick = async () => {
      const E = SDK.edit, title = docEl('sdDeckTitle').value.trim(); if (!title) return sdDeckErr('Give the deck a name.');
      const live = E.cards.filter(c => !c.gone); if (live.some(c => !c.front.trim() || !c.back.trim())) return sdDeckErr('Every card needs both a front and a back.');
      sdBtn('sdDeckSave', true); sdDeckErr('');
      try {
        let id = E.id; const fields = { title, course_id: docEl('sdDeckCourse').value || null };
        if (id) { const r = await LumaStudy.decks.update(id, fields); if (r.error) throw r.error; Object.assign(SDK.decks.find(x => x.id === id) || {}, r.data); }
        else { const r = await LumaStudy.decks.add(fields); if (r.error) throw r.error; id = r.data.id; SDK.decks.push(r.data); }
        const gone = E.cards.filter(c => c.gone && c.id), edited = live.filter(c => c.id && (c.front !== c.orig.front || c.back !== c.orig.back)), fresh = live.filter(c => c.isNew);
        for (const c of gone) { const r = await LumaStudy.cards.remove(c.id); if (r.error) throw r.error; }
        for (const c of edited) { const r = await LumaStudy.cards.update(c.id, { front: c.front.trim(), back: c.back.trim() }); if (r.error) throw r.error; }
        if (fresh.length) { const r = await LumaStudy.cards.addMany(fresh.map(c => ({ deck_id: id, front: c.front.trim(), back: c.back.trim() }))); if (r.error) throw r.error; }
        sdDeckClose(); await sdCardsLoad(); flashToast('Deck saved', title, 'fa-clone', '#34d399');
      } catch (err) { sdDeckErr(/study_decks|study_cards|schema cache|does not exist/i.test(err.message) ? 'Flashcards need one more database step: run supabase/migrations/067_study_attendance_cards.sql in the SQL Editor.' : err.message); }
      sdBtn('sdDeckSave', false, 'Save deck');
    };
    docEl('sdDeckDelete').onclick = async () => {
      const d = SDK.decks.find(x => x.id === SDK.edit.id); if (!d) return;
      if (!await luConfirm({ title: `Delete “${d.title}”?`, message: 'The deck and all its cards are removed. This can\'t be undone.' })) return;
      const r = await LumaStudy.decks.remove(d.id); if (r.error) return sdDeckErr(r.error.message);
      SDK.decks = SDK.decks.filter(x => x !== d); sdDeckClose(); await sdCardsLoad();
    };

    // ---------- studying ----------
    // when a card comes back, from how you rated it (a simple spaced-repetition rule)
    function sdSrs(card, rating) {
      let ease = Number(card.ease) || 2.5, interval = card.interval_days || 0, reps = card.reps || 0, lapses = card.lapses || 0;
      if (rating === 'again') { reps = 0; lapses++; ease = Math.max(1.3, ease - 0.2); interval = 0; }
      else {
        if (rating === 'hard') { ease = Math.max(1.3, ease - 0.15); interval = Math.max(1, Math.round((interval || 1) * 1.2)); }
        else if (rating === 'good') interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease));
        else { ease += 0.15; interval = reps === 0 ? 3 : Math.max(interval + 2, Math.round(Math.max(interval, 1) * ease * 1.3)); }
        reps++;
      }
      return { ease: Math.round(ease * 100) / 100, interval_days: interval, reps, lapses, due_on: sdAdd(sdKey(), interval), last_reviewed_at: new Date().toISOString() };
    }
    const sdDays = n => n <= 0 ? 'Today' : n === 1 ? '1 day' : n < 30 ? n + ' days' : Math.round(n / 30) + ' mo';
    async function sdRunStart(deckIds) {
      const today = sdKey(); let cards = [];
      for (const id of deckIds) { const r = await LumaStudy.cards.inDeck(id); (r.data || []).forEach(c => cards.push({ ...c, deck: id })); }
      const due = cards.filter(c => c.due_on <= today).sort((a, b) => a.due_on.localeCompare(b.due_on) || (a.created_at || '').localeCompare(b.created_at || '')).slice(0, 30);
      let queue = due, practice = false;
      if (!due.length) { if (!cards.length) return luAlert('This deck has no cards yet.'); practice = true; queue = cards.slice().sort(() => Math.random() - 0.5).slice(0, 15); }
      SDK.run = { queue, total: queue.length, done: 0, again: 0, flipped: false, practice, seen: new Map() };
      docEl('sdRunTitle').textContent = practice ? 'Practise (nothing is due)' : 'Review'; docEl('sdRunDone').style.display = 'none'; sdRunShow(); sdOpen('sdRunOverlay');
    }
    function sdRunShow() {
      const R = SDK.run, c = R.queue[0]; if (!c) return sdRunFinish();
      R.flipped = false; docEl('sdRunDone').style.display = 'none'; docEl('sdRunCard').style.display = ''; docEl('sdRunRate').style.display = 'none';
      docEl('sdRunBar').style.width = Math.round(R.done / R.total * 100) + '%'; docEl('sdRunCount').textContent = `${Math.min(R.done + 1, R.total)} of ${R.total}`;
      docEl('sdRunSide').textContent = 'Question'; docEl('sdRunText').textContent = c.front; docEl('sdRunTap').style.display = ''; docEl('sdRunCard').classList.remove('flip');
    }
    function sdRunFlip() {
      const R = SDK.run; if (!R || R.flipped || !R.queue[0]) return; const c = R.queue[0]; R.flipped = true;
      docEl('sdRunSide').textContent = 'Answer'; docEl('sdRunText').textContent = c.back; docEl('sdRunTap').style.display = 'none'; docEl('sdRunCard').classList.add('flip'); docEl('sdRunRate').style.display = '';
      docEl('sdRateHard').textContent = sdDays(sdSrs(c, 'hard').interval_days); docEl('sdRateGood').textContent = sdDays(sdSrs(c, 'good').interval_days); docEl('sdRateEasy').textContent = sdDays(sdSrs(c, 'easy').interval_days);
    }
    async function sdRunRate(rating) {
      const R = SDK.run; if (!R || !R.flipped) return; const c = R.queue.shift(), next = sdSrs(c, rating);
      if (!R.practice) LumaStudy.cards.update(c.id, next).then(r => { if (r.error) console.warn('LUMA: could not save a review', r.error.message); });
      if (rating === 'again') { R.again++; const n = (R.seen.get(c.id) || 0) + 1; R.seen.set(c.id, n); if (n < 3) R.queue.splice(Math.min(R.queue.length, 3), 0, { ...c, ...next }); else R.done++; } else R.done++;
      sdRunShow();
    }
    function sdRunFinish() {
      const R = SDK.run; docEl('sdRunBar').style.width = '100%'; docEl('sdRunCard').style.display = 'none'; docEl('sdRunRate').style.display = 'none'; docEl('sdRunCount').textContent = '';
      docEl('sdRunDone').style.display = ''; docEl('sdRunDone').innerHTML = `<div class="sx-fin"><i class="fa-solid fa-circle-check"></i><b>${R.practice ? 'Nice practice!' : 'All done for now!'}</b><span>${R.total} card${R.total === 1 ? '' : 's'} reviewed${R.again ? ` · ${R.again} you will see again soon` : ''}.</span><button type="button" class="create-btn" id="sdRunOk">Close</button></div>`;
      docEl('sdRunOk').onclick = () => { sdClose('sdRunOverlay'); sdCardsLoad(); }; SDK.run = null;
    }
    docEl('sdRunCard').onclick = sdRunFlip;
    docEl('sdRunRate').onclick = e => { const b = e.target.closest('[data-rate]'); if (b) sdRunRate(b.dataset.rate); };
    docEl('sdRunClose').onclick = () => { sdClose('sdRunOverlay'); SDK.run = null; sdCardsLoad(); };
    docEl('sdRunOverlay').addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); sdRunFlip(); } else if (SDK.run && SDK.run.flipped) { const k = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }[e.key]; if (k) sdRunRate(k); } });
