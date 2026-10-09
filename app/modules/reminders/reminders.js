// LUMA — module: reminders
      // ---------------- REMINDERS ----------------
    MODULES.reminders = function () {
        return head('Reminders','<span id="remSub">Loading…</span>', '<button class="create-btn" id="remAddBtn"><i class="fa-solid fa-plus"></i> New reminder</button>') +
        '<div id="remRoot"><div class="ls" style="padding:10px 2px">Loading…</div></div>';
    };

    // =====================================================
    //  REMINDERS — your own reminders, separate from tasks (delivered by the server: inbox + push)
    // =====================================================
    const REM_KINDS = [['once', 'Does not repeat'], ['daily', 'Every day'], ['weekdays', 'Every weekday (Mon–Fri)'], ['weekends', 'Every weekend (Sat–Sun)'], ['weekly', 'Every week'], ['monthly', 'Every month on a date'], ['month_last_weekday', 'Last weekday of every month'], ['month_last_day', 'Last day of every month'], ['yearly', 'Every year']];
    // starting ideas for an empty Reminders page: they depend on the mode you are in
    const REM_TPL_SETS = {
      personal: [
        { title: 'Fill in the timesheet', kind: 'month_last_weekday', time: '09:00', note: 'Submit your hours for the month' },
        { title: 'Pay rent', kind: 'monthly', time: '09:00', day: 1 },
        { title: 'Weekly review', kind: 'weekly', time: '17:00', days: [5], note: 'What went well? What is next week?' },
        { title: 'Back up your files', kind: 'monthly', time: '10:00', day: 1 },
      ],
      study: [
        { title: 'Revise today\'s lessons', kind: 'daily', time: '20:00', note: 'Go through today\'s notes for 20 minutes' },
        { title: 'Plan the week', kind: 'weekly', time: '19:00', days: [0], note: 'Look at next week\'s classes and deadlines' },
        { title: 'Check the class portal', kind: 'weekdays', time: '18:00', note: 'Any new announcements or assignments?' },
        { title: 'Pay hostel or rent', kind: 'monthly', time: '09:00', day: 1 },
      ],
      work: [
        { title: 'Fill in the timesheet', kind: 'month_last_weekday', time: '09:00', note: 'Submit your hours for the month' },
        { title: 'Send the weekly report', kind: 'weekly', time: '16:00', days: [5], note: 'Summarise what you finished this week' },
        { title: 'Submit expense claims', kind: 'month_last_weekday', time: '10:00', note: 'Receipts and claims for the month' },
        { title: 'Plan the week', kind: 'weekly', time: '09:00', days: [1], note: 'Priorities and meetings for the week' },
      ],
    };
    const remTpls = () => REM_TPL_SETS[LUMA_MODE] || REM_TPL_SETS.personal;
    const REM_EMPTY_TEXT = {
      personal: 'Reminders are separate from tasks. Use them for things that come around again and again, like filling in your timesheet on the last weekday of the month.',
      study: 'Reminders are separate from your assignments (those already remind you before they are due). Use them for things that repeat, like revising every evening or planning the week.',
      work: 'Reminders are separate from tasks. Use them for things that come around again and again, like the timesheet on the last weekday of the month or the weekly report.',
    };
    let REMS = [], REM_ERR = null;
    const remForm = { id: null, kind: 'once', days: new Set(), active: true };
    const remErr = m => { docEl('crError').textContent = m; docEl('crError').style.display = m ? 'flex' : 'none'; };
    const remLastDay = k => { const d = new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0)); return d.toISOString().slice(0, 10); };
    function remDue(r, k) {
      if (k < r.start_date) return false;
      const dow = hDow(k);
      switch (r.kind) {
        case 'once': return k === r.start_date;
        case 'daily': return true;
        case 'weekdays': return dow >= 1 && dow <= 5;
        case 'weekends': return dow === 0 || dow === 6;
        case 'weekly': return (r.days && r.days.length ? r.days.map(Number) : [hDow(r.start_date)]).includes(dow);
        case 'monthly': return +k.slice(8) === Math.min(+r.start_date.slice(8), cLast(k));
        case 'yearly': return k.slice(5, 7) === r.start_date.slice(5, 7) && +k.slice(8) === Math.min(+r.start_date.slice(8), cLast(k));
        case 'month_last_day': return k === remLastDay(k);
        case 'month_last_weekday': { let l = remLastDay(k); while ([0, 6].includes(hDow(l))) l = bAddDays(l, -1); return k === l; }
      }
      return false;
    }
    // the next day (from today on) this reminder will fire, or null
    function remNext(r) {
      if (!r.active) return null;
      const today = mytDayKey(Date.now()), nowM = mytNowMin(), tm = +r.remind_time.slice(0, 2) * 60 + +r.remind_time.slice(3, 5);
      for (let i = 0; i < 800; i++) {
        const k = bAddDays(today, i);
        if (!remDue(r, k)) continue;
        if (r.last_fired_on === k) continue;
        if (k === today && nowM > tm + 10) continue; // today's time has passed
        return k;
      }
      return null;
    }
    function remDesc(r) {
      const t = fmt12(r.remind_time), dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const when = { once: `${cFmt(r.start_date, { day: 'numeric', month: 'short', year: 'numeric' })}`, daily: 'Every day', weekdays: 'Every weekday', weekends: 'Every weekend (Sat & Sun)', monthly: `Day ${+r.start_date.slice(8)} of every month`, yearly: `Every ${cFmt(r.start_date, { day: 'numeric', month: 'long' })}`, month_last_day: 'Last day of every month', month_last_weekday: 'Last weekday of every month',
        weekly: 'Every ' + (r.days && r.days.length ? [...r.days].map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => dn[d]).join(', ') : dn[hDow(r.start_date)]) }[r.kind];
      return `${when} · ${t}`;
    }
    function paintReminders() {
      const root = document.getElementById('remRoot'), sub = document.getElementById('remSub'); if (!root) return;
      if (REM_ERR) { sub.textContent = 'Could not load reminders'; root.innerHTML = card('<div class="ls">Has <b>supabase/migrations/032_reminders.sql</b> been run in the Supabase SQL Editor?</div>'); return; }
      if (!REMS.length) {
        sub.textContent = 'Never forget the things that are not tasks';
        root.innerHTML = card(`<div class="h-empty"><div class="h-empty-ico"><i class="fa-solid fa-bell-concierge"></i></div><div class="h-empty-t">Add your first reminder</div>
          <div class="h-empty-s">${REM_EMPTY_TEXT[LUMA_MODE] || REM_EMPTY_TEXT.personal} You get a notification at the time you choose. Start from an idea or tap <b>New reminder</b>.</div>
          <div class="h-empty-chips">${remTpls().map((t, i) => `<button type="button" class="h-chip" data-rtpl="${i}"><i class="fa-solid fa-bell" style="color:#f59e0b"></i>${t.title}</button>`).join('')}</div></div>`);
        return;
      }
      const today = mytDayKey(Date.now()), items = REMS.map(r => ({ r, next: remNext(r) }));
      const upcoming = items.filter(x => x.next).sort((a, b) => a.next.localeCompare(b.next) || a.r.remind_time.localeCompare(b.r.remind_time));
      const paused = items.filter(x => !x.r.active), done = items.filter(x => x.r.active && !x.next);
      sub.textContent = upcoming.length ? `${upcoming.length} upcoming · next: ${upcoming[0].r.title} ${upcoming[0].next === today ? 'today' : cFmt(upcoming[0].next, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Nothing upcoming';
      const item = ({ r, next }) => {
        const nextTxt = !r.active ? 'Paused' : next ? `Next: ${next === today ? 'Today' : next === bAddDays(today, 1) ? 'Tomorrow' : cFmt(next, { weekday: 'short', day: 'numeric', month: 'short' })}, ${fmt12(r.remind_time)}` : 'Done';
        return `<div class="rem-item ${r.active ? '' : 'off'}" data-id="${r.id}"><div class="licon" style="color:#f59e0b;background:#f59e0b22"><i class="fa-solid fa-bell"></i></div>
          <div class="lmain"><div class="lt">${escapeHtml(r.title)}</div><div class="ls">${escapeHtml(remDesc(r))}</div><div class="rn" style="${!r.active || !next ? 'color:rgba(255,255,255,0.5)' : ''}">${nextTxt}</div>${r.note ? `<div class="rnote">${escapeHtml(r.note)}</div>` : ''}</div>
          <div class="rem-act"><button type="button" class="switch ${r.active ? 'on' : ''}" data-toggle title="${r.active ? 'Pause' : 'Turn on'}"><span class="knob"></span></button><button type="button" class="hedit" data-edit title="Edit"><i class="fa-solid fa-pen"></i></button><button type="button" class="hedit" data-del title="Delete"><i class="fa-regular fa-trash-can"></i></button></div></div>`;
      };
      root.innerHTML = (upcoming.length ? `<div class="rem-sec">Upcoming</div>${upcoming.map(item).join('')}` : '') + (done.length ? `<div class="rem-sec">Done</div>${done.map(item).join('')}` : '') + (paused.length ? `<div class="rem-sec">Paused</div>${paused.map(item).join('')}` : '');
    }

    // ----- popup -----
    function paintRemForm() {
      docEl('remKinds').innerHTML = REM_KINDS.map(([k, l]) => `<button type="button" class="h-chip sm ${k === remForm.kind ? 'on' : ''}" data-k="${k}">${l}</button>`).join('');
      const k = remForm.kind;
      docEl('remDateWrap').style.display = ['once', 'monthly', 'yearly'].includes(k) ? '' : 'none';
      docEl('remDateLbl').innerHTML = (k === 'once' ? 'Date' : k === 'monthly' ? 'First date <span style="color:rgba(255,255,255,0.4);font-weight:400">(repeats on this day each month)</span>' : 'Date <span style="color:rgba(255,255,255,0.4);font-weight:400">(repeats every year)</span>') + ' <span style="color:#fca5a5">*</span>';
      docEl('remDaysWrap').style.display = k === 'weekly' ? '' : 'none';
      docEl('remDays').innerHTML = H_DAY_ORDER.map(([d, l]) => `<button type="button" data-d="${d}" class="${remForm.days.has(d) ? 'on' : ''}">${l}</button>`).join('');
      docEl('remHint').textContent = { month_last_weekday: 'Fires on the last Monday–Friday of each month, so it never lands on a weekend.', month_last_day: 'Fires on the last calendar day of each month.', weekdays: 'Fires Monday to Friday.', weekends: 'Fires every Saturday and Sunday.', daily: 'Fires every day.', weekly: remForm.days.size ? '' : 'Pick the days. If you pick none, it uses the weekday of today.', once: '', monthly: 'On short months it fires on the last day of the month.', yearly: '' }[k] || '';
    }
    function openRemModal(r, preset) {
      if (!r && planBlocked('reminders', REMS.length, 'custom reminders')) return;
      if (!remSkinned) { skinDate(docEl('remDate')); skinTime(docEl('remTime')); remSkinned = true; }
      const p = r || preset || {};
      remForm.id = r ? r.id : null; remForm.kind = p.kind || 'once'; remForm.active = r ? r.active : true;
      remForm.days = new Set(p.days ? p.days.map(Number) : []);
      docEl('remModalTitle').textContent = r ? 'Edit reminder' : 'New reminder'; docEl('crSave').textContent = r ? 'Save changes' : 'Add reminder';
      docEl('remTitle').value = p.title || ''; docEl('remNote').value = p.note || '';
      const today = mytDayKey(Date.now());
      docEl('remDate').value = r ? r.start_date : p.day ? (+today.slice(8) <= p.day ? today.slice(0, 8) + String(p.day).padStart(2, '0') : bAddMonths(bFirst(today), 1).slice(0, 8) + String(p.day).padStart(2, '0')) : today;
      if (docEl('remDate')._luDateRefresh) docEl('remDate')._luDateRefresh();
      docEl('remTime').value = r ? r.remind_time : p.time || '09:00'; if (docEl('remTime')._luTimeRefresh) docEl('remTime')._luTimeRefresh();
      docEl('remDelete').style.display = r ? '' : 'none'; remErr(''); paintRemForm();
      docEl('reminderOverlay').classList.add('open'); setTimeout(() => docEl('remTitle').focus(), 50);
    }
    const closeRemModal = () => docEl('reminderOverlay').classList.remove('open');
    docEl('crClose').onclick = closeRemModal;
    docEl('reminderOverlay').onclick = e => { if (e.target === docEl('reminderOverlay')) closeRemModal(); };
    docEl('remKinds').onclick = e => { const b = e.target.closest('button'); if (b) { remForm.kind = b.dataset.k; paintRemForm(); } };
    docEl('remDays').onclick = e => { const b = e.target.closest('button'); if (!b) return; const d = +b.dataset.d; remForm.days.has(d) ? remForm.days.delete(d) : remForm.days.add(d); paintRemForm(); };
    let remSkinned = false; // the date / time pickers are set up the first time the popup opens (they rely on helpers defined further down)
    docEl('crSave').onclick = async () => {
      const title = docEl('remTitle').value.trim(), time = docEl('remTime').value, k = remForm.kind, today = mytDayKey(Date.now());
      if (!title) return remErr('Give the reminder a name.');
      if (!time) return remErr('Choose the time.');
      let date = ['once', 'monthly', 'yearly'].includes(k) ? docEl('remDate').value : today;
      if (!date) return remErr('Pick the date.');
      if (k === 'once' && !remForm.id && (date < today || (date === today && mytNowMin() > +time.slice(0, 2) * 60 + +time.slice(3, 5) + 10))) return remErr('That time has already passed. Pick a later time or date.');
      const fields = { title, note: docEl('remNote').value.trim(), kind: k, start_date: date, remind_time: time, days: k === 'weekly' ? [...remForm.days].sort() : [], active: remForm.active };
      if (remForm.id) fields.last_fired_on = null; // an edited reminder can fire again
      const btn = docEl('crSave'); btn.disabled = true; remErr('');
      const { data, error } = remForm.id ? await LumaReminders.update(remForm.id, fields) : await LumaReminders.add(fields);
      btn.disabled = false;
      if (error) return remErr(/reminders|schema cache|does not exist/i.test(error.message) ? 'Reminders aren\'t set up yet — run supabase/migrations/032_reminders.sql in the Supabase SQL Editor.' : error.message);
      const i = REMS.findIndex(x => x.id === data.id); if (i >= 0) REMS[i] = data; else REMS.push(data);
      closeRemModal(); paintReminders();
    };
    docEl('remDelete').onclick = () => remDelete(remForm.id);
    async function remDelete(id) {
      const r = REMS.find(x => x.id === id); if (!r) return;
      if (!await luConfirm({ title: 'Delete this reminder?', message: `"${r.title}" will stop reminding you.`, ok: 'Delete' })) return;
      const { error } = await LumaReminders.remove(id); if (error) return luAlert('Could not delete: ' + error.message);
      REMS = REMS.filter(x => x.id !== id); closeRemModal(); paintReminders();
    }

    async function loadReminders(pg) {
      pg.querySelector('#remAddBtn').onclick = () => openRemModal(null);
      pg.querySelector('#remRoot').onclick = async e => {
        const tpl = e.target.closest('[data-rtpl]'); if (tpl) return openRemModal(null, remTpls()[+tpl.dataset.rtpl]);
        const row = e.target.closest('.rem-item'); if (!row) return; const r = REMS.find(x => x.id === row.dataset.id); if (!r) return;
        if (e.target.closest('[data-toggle]')) {
          const { data, error } = await LumaReminders.update(r.id, { active: !r.active, last_fired_on: null });
          if (error) return luAlert('Could not update: ' + error.message);
          Object.assign(r, data); return paintReminders();
        }
        if (e.target.closest('[data-del]')) return remDelete(r.id);
        openRemModal(r);
      };
      paintReminders();
      const { data, error } = await LumaReminders.list();
      REM_ERR = error || null; if (!error) REMS = data || [];
      paintReminders();
    }


    WIRE.reminders = function (pg) { return loadReminders(pg); };
