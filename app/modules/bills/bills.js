// LUMA — module: bills
      // ---------------- BILLS ----------------
    MODULES.bills = function () {
        return head('Bills', '<span id="billsSub">Loading…</span>', '<button class="create-btn" id="addBillBtn"><i class="fa-solid fa-plus"></i> Add bill</button>') +
          '<div id="billsRoot"></div>';
    };

    // ---------- Bills (luma.bills + luma.bill_payments) ----------
    const B_CATS = [['Internet', 'fa-wifi', '#38bdf8'], ['Electricity', 'fa-bolt', '#fbbf24'], ['Water', 'fa-droplet', '#22d3ee'], ['Phone', 'fa-mobile-screen', '#a78bfa'], ['Insurance', 'fa-shield-halved', '#34d399'],
    ['Credit card', 'fa-credit-card', '#f87171'], ['Rent', 'fa-house', '#fb923c'], ['Subscription', 'fa-repeat', '#ec4899'], ['Loan', 'fa-building-columns', '#94a3b8'], ['Other', 'fa-receipt', '#cbd5e1']];
    const B_PRESETS = [
      { name: 'Internet', category: 'Internet' }, { name: 'Electricity', category: 'Electricity' }, { name: 'Water', category: 'Water' }, { name: 'Phone', category: 'Phone' },
      { name: 'Rent', category: 'Rent' }, { name: 'Car insurance', category: 'Insurance', recurrence: 'yearly' }, { name: 'Credit card', category: 'Credit card' },
    ];
    const B_REPEAT = [['once', 'Once'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']];
    let BPAY_ROWS = []; // every payment row incl. paid_at (the Money page counts paid bills as spending)
    let BILLS = [], BPAY = new Map(), BILLS_ERR = null, bMonth = null; // BPAY: bill id → Map(due date → amount paid); bMonth: first day of the month shown (null = this month)
    const bForm = { id: null, category: 'Other', recurrence: 'monthly', mode: 'bill' }; // mode 'sub' = opened from the Subscriptions page (always a Subscription)

    const bCat = n => B_CATS.find(c => c[0] === n) || B_CATS[B_CATS.length - 1];
    const bRM = n => 'RM' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const bFirst = k => k.slice(0, 8) + '01';
    const bAddDays = (k, n) => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10);
    const bAddMonths = (first, n) => { const [y, m] = first.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10); };
    const bDays = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
    const bLabel = k => new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    const bMonthLabel = k => new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const bPaidAmt = (b, due) => { const m = BPAY.get(b.id); return m && m.has(due) ? m.get(due) : null; };

    // the due date of a bill's cycle that falls in the month starting `mFirst` (or null)
    function bCycle(b, mFirst) {
      const [ay, am, ad] = b.due_date.split('-').map(Number), [y, m] = mFirst.split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const mk = d => `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
      if (b.recurrence === 'once') return b.due_date >= mFirst && b.due_date <= mk(last) ? b.due_date : null;
      if (b.recurrence === 'yearly') return m === am && y >= ay ? mk(ad) : null;
      return y > ay || (y === ay && m >= am) ? mk(ad) : null;
    }
    function bCycles(b, mFirst) {
      if (b.recurrence !== 'weekly') { const c = bCycle(b, mFirst); return c ? [c] : []; }
      const last = bAddDays(bAddMonths(mFirst, 1), -1); let d = b.due_date;
      if (d > last) return [];
      if (d < mFirst) d = bAddDays(d, Math.ceil(bDays(mFirst, d) / 7) * 7);
      const out = []; for (; d <= last; d = bAddDays(d, 7)) out.push(d);
      return out;
    }
    // every bill cycle shown for a month: that month's cycles, plus (for the current month) unpaid ones from earlier months
    function bRows(mFirst) {
      const today = mytDayKey(Date.now()), thisFirst = bFirst(today), rows = [];
      BILLS.filter(b => b.active !== false).forEach(b => {
        bCycles(b, mFirst).forEach(due => rows.push({ b, due, paid: bPaidAmt(b, due) }));
        if (mFirst === thisFirst && b.recurrence !== 'weekly') {
          for (let k = 1; k <= (b.recurrence === 'once' ? 24 : 6); k++) {
            const d = bCycle(b, bAddMonths(mFirst, -k));
            // repeating bills only count as overdue from the month they were added (a past first due date doesn't create months of overdue bills)
            if (d && d < today && bPaidAmt(b, d) == null && (b.recurrence === 'once' || d >= bFirst(mytDayKey(b.created_at)))) rows.push({ b, due: d, paid: null, carry: true });
          }
        }
      });
      rows.forEach(r => { r.status = r.paid != null ? 'paid' : r.due < today ? 'overdue' : r.due === today ? 'today' : 'upcoming'; r.amount = r.paid != null ? r.paid : r.b.amount; });
      // unpaid first; then the due date closest to today first (whether just passed or coming up) — on a tie the overdue one goes first
      const gap = r => Math.abs(bDays(r.due, today));
      return rows.sort((a, c) => (a.status === 'paid') - (c.status === 'paid') || gap(a) - gap(c) || a.due.localeCompare(c.due));
    }

    function paintBills() {
      const root = docEl('billsRoot'), sub = docEl('billsSub'); if (!root) return;
      const oldTop = (root.querySelector('.b-list') || {}).scrollTop || 0; // keep the list where it was when something is ticked
      if (BILLS_ERR) {
        sub.textContent = 'Could not load bills';
        root.innerHTML = card('<div class="ls">Has <b>supabase/migrations/020_bills.sql</b> been run in the Supabase SQL Editor?</div>');
        return;
      }
      if (!BILLS.length) {
        sub.textContent = 'Never miss a payment';
        root.innerHTML = card(`<div class="h-empty">
          <div class="h-empty-ico"><i class="fa-solid fa-file-invoice-dollar"></i></div>
          <div class="h-empty-t">Add your first bill</div>
          <div class="h-empty-s">Add what you pay regularly — internet, electricity, rent — and tick it off each time you pay. You'll see what's due, what's overdue and what you've paid. Start from a quick pick or tap <b>Add bill</b>.</div>
          <div class="h-empty-chips">${B_PRESETS.map((p, i) => `<button type="button" class="h-chip" data-bpreset="${i}"><i class="fa-solid ${bCat(p.category)[1]}" style="color:${bCat(p.category)[2]}"></i>${p.name}</button>`).join('')}</div>
        </div>`);
        return;
      }
      const today = mytDayKey(Date.now()), thisFirst = bFirst(today), mFirst = bMonth || thisFirst;
      if (mFirst > bAddMonths(thisFirst, 12) || mFirst < bAddMonths(thisFirst, -24)) bMonth = null;
      const rows = bRows(bMonth || thisFirst), unpaid = rows.filter(r => r.status !== 'paid'), overdue = rows.filter(r => r.status === 'overdue');
      const toPay = unpaid.reduce((t, r) => t + r.amount, 0), paidTotal = rows.filter(r => r.status === 'paid').reduce((t, r) => t + r.amount, 0), overdueTotal = overdue.reduce((t, r) => t + r.amount, 0);
      const isNow = (bMonth || thisFirst) === thisFirst, title = isNow ? 'Due this month' : 'Due in ' + new Date((bMonth || thisFirst) + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
      sub.textContent = unpaid.length ? `${bRM(toPay)} to pay ${isNow ? 'this month' : 'in ' + bMonthLabel(bMonth)}` : rows.length ? 'All paid — nice!' : 'Nothing due ' + (isNow ? 'this month' : 'in ' + bMonthLabel(bMonth));

      const list = rows.length ? rows.map(r => {
        const [, icon, col] = bCat(r.b.category), d = bDays(r.due, today);
        const [pc, pt] = r.status === 'paid' ? ['pill-low', 'Paid'] : r.status === 'overdue' ? ['pill-high', `Overdue ${-d}d`] : r.status === 'today' ? ['pill-med', 'Due today'] : [d <= 7 ? 'pill-med' : 'pill-blue', `${d} day${d === 1 ? '' : 's'}`];
        const rep = r.b.recurrence === 'once' ? '' : ' · ' + r.b.recurrence;
        return `<div class="lrow b-row ${r.status === 'paid' ? 'is-paid' : ''}" data-id="${r.b.id}" data-due="${r.due}"><div class="licon" style="color:${col};background:${col}22;border-color:${col}33"><i class="fa-solid ${icon}"></i></div>
          <div class="lmain"><div class="lt">${escapeHtml(r.b.name)}</div><div class="ls">Due ${bLabel(r.due)}${rep}${r.b.note ? ' · ' + escapeHtml(r.b.note) : ''}</div></div>
          <span class="pill ${pc}">${pt}</span><span class="lright">${bRM(r.amount)}</span>
          <button type="button" class="hedit b-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button type="button" class="hbtn b-pay ${r.status === 'paid' ? 'on' : ''}" title="${r.status === 'paid' ? 'Paid — tap to undo' : 'Mark as paid'}" style="${r.status === 'paid' ? 'background:#22c55e' : ''}"><i class="fa-solid fa-check"></i></button></div>`;
      }).join('') : '<div class="ls" style="padding:18px 4px;text-align:center">No bills due in this month.</div>';

      root.innerHTML = `<div class="bills-grid">
        ${card(`<div class="section-title"><i class="fa-regular fa-calendar-check"></i> ${title}</div>
          <div class="h-mnav"><button type="button" class="b-mprev" title="Previous month"><i class="fa-solid fa-chevron-left"></i></button><span>${bMonthLabel(bMonth || thisFirst)}</span><button type="button" class="b-mnext" title="Next month"><i class="fa-solid fa-chevron-right"></i></button></div>
          <div class="m-value" style="font-size:2rem;color:#fff">${bRM(toPay)}</div>
          <div class="ls" style="margin-top:6px">${unpaid.length ? `across ${unpaid.length} unpaid bill${unpaid.length === 1 ? '' : 's'}` : rows.length ? 'everything is paid' : 'no bills this month'}</div>
          ${overdue.length ? `<div class="b-alert"><i class="fa-solid fa-circle-exclamation"></i><div>${overdue.length} bill${overdue.length === 1 ? ' is' : 's are'} overdue (${bRM(overdueTotal)}).</div></div>` : ''}
          <div class="b-stat"><span>Paid</span><b>${bRM(paidTotal)}</b></div>
          <button class="create-btn b-payall" style="width:100%;justify-content:center;margin-top:16px" ${unpaid.length ? '' : 'disabled'}><i class="fa-solid fa-check-double"></i> Mark all as paid</button>`)}
        ${card(`<div class="b-list h-list">${list}</div>`, 'b-main')}</div>`;
      const bl = root.querySelector('.b-list');
      if (bl) {
        bl.scrollTop = oldTop;
        const fade = () => bl.classList.toggle('more', bl.scrollTop + bl.clientHeight < bl.scrollHeight - 4); // soft fade = more bills below
        bl.addEventListener('scroll', fade); requestAnimationFrame(fade);
      }
    }

    async function loadBillsData() {
      const [b, p] = await Promise.all([LumaBills.list(), LumaBills.listPayments()]);
      BILLS_ERR = b.error || p.error || null;
      if (BILLS_ERR) return;
      BILLS = b.data.map(x => ({ ...x, amount: Number(x.amount) }));
      BPAY = new Map();
      BPAY_ROWS = p.data || [];
      (p.data || []).forEach(r => { if (!BPAY.has(r.bill_id)) BPAY.set(r.bill_id, new Map()); BPAY.get(r.bill_id).set(r.due_date, Number(r.amount)); });
    }

    async function toggleBillPaid(b, due) {
      if (!BPAY.has(b.id)) BPAY.set(b.id, new Map());
      const m = BPAY.get(b.id), was = m.has(due), amt = was ? m.get(due) : b.amount;
      was ? m.delete(due) : m.set(due, amt); paintBills(); // optimistic
      const { error } = await LumaBills.setPaid(b.id, due, !was, amt);
      if (error) { was ? m.set(due, amt) : m.delete(due); paintBills(); luAlert('Could not save: ' + error.message); }
    }

    async function payAllBills() {
      const rows = bRows(bMonth || bFirst(mytDayKey(Date.now()))).filter(r => r.status !== 'paid'); if (!rows.length) return;
      const total = rows.reduce((t, r) => t + r.amount, 0);
      if (!await luConfirm({ title: `Mark ${rows.length} bill${rows.length === 1 ? '' : 's'} as paid?`, message: rows.map(r => `• ${r.b.name} — ${bRM(r.amount)}`).join('\n') + `\n\nTotal ${bRM(total)}`, icon: 'fa-check-double', tone: 'info', ok: 'Mark paid' })) return;
      const { error } = await LumaBills.payMany(rows.map(r => ({ bill_id: r.b.id, due_date: r.due, amount: r.amount })));
      if (error) return luAlert('Could not save: ' + error.message);
      rows.forEach(r => { if (!BPAY.has(r.b.id)) BPAY.set(r.b.id, new Map()); BPAY.get(r.b.id).set(r.due, r.amount); });
      paintBills();
    }

    // ----- add / edit modal -----
    const billErr = m => { docEl('billError').textContent = m; docEl('billError').style.display = m ? 'flex' : 'none'; };
    function paintBillForm() {
      docEl('billCats').innerHTML = B_CATS.map(([n, i, c]) => `<button type="button" data-c="${n}" class="${n === bForm.category ? 'on' : ''}" style="--gc:${c}"><i class="fa-solid ${i}" style="color:${c}"></i>${n}</button>`).join('');
      const isSub = bForm.category === 'Subscription', subMode = bForm.mode === 'sub';
      if (isSub && bForm.recurrence === 'once') bForm.recurrence = 'monthly'; // subscriptions renew: weekly, monthly or yearly
      docEl('billCatsWrap').style.display = subMode ? 'none' : ''; docEl('billSubHint').style.display = isSub ? '' : 'none'; // opened from Subscriptions: always a subscription, no category to pick
      docEl('billRepeat').innerHTML = B_REPEAT.filter(([v]) => !isSub || v !== 'once').map(([v, l]) => `<button type="button" data-r="${v}" class="${v === bForm.recurrence ? 'on' : ''}">${l}</button>`).join('');
      docEl('billTypeWrap').style.display = isSub ? '' : 'none';
      docEl('billTypes').innerHTML = S_TYPES.map(([n, i, c]) => `<button type="button" class="h-chip sm ${docEl('billNote').value.trim().toLowerCase() === n.toLowerCase() ? 'on' : ''}" data-t="${n}"><i class="fa-solid ${i}" style="color:${c}"></i>${n}</button>`).join('');
      docEl('billTpls').innerHTML = B_PRESETS.map((p, i) => `<button type="button" class="h-chip sm" data-bpreset="${i}"><i class="fa-solid ${bCat(p.category)[1]}" style="color:${bCat(p.category)[2]}"></i>${p.name}</button>`).join('');
      docEl('billDueLbl').innerHTML = (isSub ? `Next renewal date (renews every ${bForm.recurrence === 'yearly' ? 'year' : bForm.recurrence === 'weekly' ? 'week' : 'month'} on this ${bForm.recurrence === 'weekly' ? 'weekday' : 'day'})` : bForm.recurrence === 'once' ? 'Due date' : bForm.recurrence === 'weekly' ? 'First due date (repeats every 7 days)' : bForm.recurrence === 'monthly' ? 'First due date (repeats on this day each month)' : 'First due date (repeats on this day each year)') + ' <span style="color:#fca5a5">*</span>';
    }
    function openBillModal(b, preset, mode) {
      if (!b && planBlocked('bills', BILLS.length, 'bills and subscriptions')) return;
      const src = b || preset || {}, sub = mode === 'sub';
      bForm.mode = sub ? 'sub' : 'bill'; bForm.id = b ? b.id : null; bForm.category = sub ? 'Subscription' : src.category || 'Other'; bForm.recurrence = src.recurrence || 'monthly';
      const word = sub ? 'subscription' : 'bill';
      bForm.saveLabel = 'Save ' + word; docEl('billSave').textContent = bForm.saveLabel;
      docEl('billModalTitle').textContent = (b ? 'Edit ' : 'Add ') + word;
      docEl('billNameLbl').innerHTML = (sub ? 'Subscription name' : 'Bill name') + ' <span style="color:#fca5a5">*</span>';
      docEl('billName').placeholder = sub ? 'e.g. Netflix' : 'e.g. Internet (Unifi)';
      docEl('billDelete').title = docEl('billDelete').ariaLabel = 'Delete ' + word;
      docEl('billName').value = src.name || ''; docEl('billAmount').value = b ? b.amount : ''; docEl('billNote').value = b ? b.note || '' : src.note || '';
      docEl('billDue').value = b ? b.due_date : mytDayKey(Date.now()); if (docEl('billDue')._luDateRefresh) docEl('billDue')._luDateRefresh();
      docEl('billDelete').style.display = b ? '' : 'none'; docEl('billTplWrap').style.display = b || sub ? 'none' : ''; // no quick-start list for subscriptions
      billErr(''); paintBillForm();
      docEl('billOverlay').classList.add('open'); setTimeout(() => docEl('billName').focus(), 50);
    }
    const closeBillModal = () => docEl('billOverlay').classList.remove('open');
    docEl('billClose').onclick = closeBillModal;
    docEl('billOverlay').onclick = e => { if (e.target === docEl('billOverlay')) closeBillModal(); };
    docEl('billCats').onclick = e => { const b = e.target.closest('button'); if (b) { bForm.category = b.dataset.c; paintBillForm(); } };
    docEl('billRepeat').onclick = e => { const b = e.target.closest('button'); if (b) { bForm.recurrence = b.dataset.r; paintBillForm(); } };
    docEl('billTypes').onclick = e => { const b = e.target.closest('button'); if (!b) return; docEl('billNote').value = docEl('billNote').value.trim().toLowerCase() === b.dataset.t.toLowerCase() ? '' : b.dataset.t; paintBillForm(); };
    docEl('billNote').addEventListener('input', () => { if (bForm.category === 'Subscription') paintBillForm(); });
    docEl('billTpls').onclick = e => { const b = e.target.closest('button'); if (b) openBillModal(null, B_PRESETS[+b.dataset.bpreset]); };
    docEl('billAmount').addEventListener('input', () => { const c = cleanDecimal(docEl('billAmount').value); if (c !== docEl('billAmount').value) docEl('billAmount').value = c; }); // numbers only
    docEl('billName').addEventListener('keydown', e => { if (e.key === 'Enter') docEl('billSave').click(); });
    docEl('billSave').onclick = async () => {
      const name = docEl('billName').value.trim(), amount = gNum(docEl('billAmount').value), due = docEl('billDue').value;
      if (!name) return billErr('Give the bill a name.');
      if (!(amount > 0)) return billErr('Enter the amount (a number above 0).');
      if (!due) return billErr('Pick the due date.');
      const fields = { name, amount, category: bForm.category, recurrence: bForm.recurrence, due_date: due, note: docEl('billNote').value.trim() };
      const btn = docEl('billSave'); btn.disabled = true; btn.textContent = 'Saving…';
      const { data, error } = bForm.id ? await LumaBills.update(bForm.id, fields) : await LumaBills.add(fields);
      btn.disabled = false; btn.textContent = bForm.saveLabel;
      if (error) return billErr(/recurrence|check constraint/i.test(error.message) ? 'Weekly needs a database update — run supabase/migrations/022_bill_weekly.sql in the SQL Editor.' : /bills|schema cache|does not exist/i.test(error.message) ? 'Bills aren\'t set up yet — run supabase/migrations/020_bills.sql in the SQL Editor.' : error.message);
      const row = { ...data, amount: Number(data.amount) }, i = BILLS.findIndex(x => x.id === row.id);
      if (i >= 0) BILLS[i] = row; else BILLS.push(row);
      closeBillModal(); paintBills(); paintSubs();
    };
    docEl('billDelete').onclick = async () => {
      const b = BILLS.find(x => x.id === bForm.id); if (!b) return;
      if (!await luConfirm({ title: `Delete “${b.name}”?`, message: 'The bill and its payment history are removed. This can\'t be undone.' })) return;
      const { error } = await LumaBills.remove(b.id);
      if (error) return billErr(error.message);
      BILLS = BILLS.filter(x => x !== b); BPAY.delete(b.id); closeBillModal(); paintBills(); paintSubs();
    };

    async function loadBills(pg) {
      bMonth = null;
      pg.querySelector('#addBillBtn').addEventListener('click', () => openBillModal(null));
      pg.querySelector('#billsRoot').addEventListener('click', e => {
        const pre = e.target.closest('[data-bpreset]'); if (pre) return openBillModal(null, B_PRESETS[+pre.dataset.bpreset]);
        const bj = e.target.closest('.h-mnav > span'); if (bj && bj.previousElementSibling && bj.previousElementSibling.classList.contains('b-mprev')) return void luDatePopup(bj, { value: bMonth || bFirst(mytDayKey(Date.now())), onPick: k => { bMonth = bFirst(k); if (bMonth === bFirst(mytDayKey(Date.now()))) bMonth = null; paintBills(); } });
        if (e.target.closest('.b-mprev') || e.target.closest('.b-mnext')) { bMonth = bAddMonths(bMonth || bFirst(mytDayKey(Date.now())), e.target.closest('.b-mprev') ? -1 : 1); if (bMonth === bFirst(mytDayKey(Date.now()))) bMonth = null; return paintBills(); }
        if (e.target.closest('.b-payall')) return payAllBills();
        const row = e.target.closest('.b-row'); if (!row) return;
        const b = BILLS.find(x => x.id === row.dataset.id); if (!b) return;
        if (e.target.closest('.b-edit')) return openBillModal(b);
        if (e.target.closest('.b-pay')) toggleBillPaid(b, row.dataset.due);
      });
      paintBills();
      await loadBillsData(); paintBills();
    }


    WIRE.bills = function (pg) { return loadBills(pg); };


    // a bill reminder can be about next month's due date: if it is not in this month, look in the next one
    LU_FOCUS_HOOKS.bills = (ref, type, tries) => {
      if (!BILLS.length || tries !== 6 || document.querySelector(`#page-bills [data-id="${ref}"]`)) return;
      bMonth = bAddMonths(bMonth || bFirst(mytDayKey(Date.now())), 1); paintBills();
    };
