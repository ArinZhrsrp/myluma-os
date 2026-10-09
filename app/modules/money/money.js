// LUMA — module: money
      // ---------------- MONEY ----------------
    MODULES.money = function () {
        return head('Money', '<span id="moneySub">Loading…</span>',
          '<button class="create-btn" id="moneyIncomeBtn" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-wallet"></i> Income</button><button class="create-btn" id="moneyBudgetBtn" style="background:rgba(255,255,255,0.06);box-shadow:none"><i class="fa-solid fa-bullseye"></i> Budget</button><button class="create-btn" id="moneyAddBtn"><i class="fa-solid fa-plus"></i> Log expense</button>') +
          '<div id="moneyRoot"></div>';
    };


    // ---------- Money (income, spending, budget) ----------
    // ===== Malaysian payroll estimate (employee side), rules as of 2026 =====
    //  EPF       employee 11% of gross (9% or 0% if chosen), rounded up to the next ringgit
    //  SOCSO     employee 0.5% (Invalidity scheme) on wages up to RM6,000, worked out on the midpoint of each RM100 band like the PERKESO table
    //  EIS       employee 0.2% on wages up to RM6,000 (same band method)
    //  LINDUNG 24 Jam (SKBBK) — NEW from 1 June 2026: 0.75% of wages up to RM6,000, paid entirely by the employee
    //  PCB       NOT estimated — it is whatever you enter from your payslip (blank = RM0)
    function myPayroll(gross, o = {}) {
      const r2 = x => Math.round(x * 100) / 100, r5 = x => Math.round(Math.round(x * 100) / 5) * 5 / 100, CAP = 6000; // r5: nearest 5 sen
      const w = Math.min(Math.max(gross, 0), CAP), mid = w > 0 ? Math.ceil(w / 100) * 100 - 50 : 0;
      const epf = Math.ceil(Math.max(gross, 0) * (o.epfRate == null ? 11 : o.epfRate) / 100);
      const socso = r5(mid * 5 / 1000), eis = r5(mid * 2 / 1000), lindung = r5(mid * 75 / 10000); // all worked out on the midpoint of the RM100 wage band, to the nearest 5 sen
      const pcb = o.pcbOverride != null ? Math.max(0, o.pcbOverride) : 0; // only what you enter from your payslip
      return { gross, epf, socso, eis, lindung, pcb, net: r2(gross - epf - socso - eis - lindung - pcb) };
    }

    const M_CATS = [['Housing', 'fa-house', '#60a5fa'], ['Food & dining', 'fa-utensils', '#a78bfa'], ['Groceries', 'fa-basket-shopping', '#4ade80'], ['Transport', 'fa-car', '#34d399'], ['Bills & utilities', 'fa-bolt', '#fbbf24'], ['Subscriptions', 'fa-repeat', '#f472b6'],
    ['Shopping', 'fa-bag-shopping', '#fb7185'], ['Health', 'fa-heart-pulse', '#f87171'], ['Entertainment', 'fa-film', '#c084fc'], ['Education', 'fa-graduation-cap', '#38bdf8'], ['Insurance', 'fa-shield-halved', '#2dd4bf'], ['Debt', 'fa-credit-card', '#f97316'], ['Other', 'fa-receipt', '#94a3b8']];
    const M_INCOME_CATS = [['Bonus', 'fa-gift', '#4ade80'], ['Freelance', 'fa-laptop-code', '#60a5fa'], ['Investment', 'fa-chart-line', '#a78bfa'], ['Gift', 'fa-hand-holding-heart', '#f472b6'], ['Other income', 'fa-coins', '#fbbf24']];
    const M_BILLCAT = { Internet: 'Bills & utilities', Electricity: 'Bills & utilities', Water: 'Bills & utilities', Phone: 'Bills & utilities', Insurance: 'Insurance', 'Credit card': 'Debt', Rent: 'Housing', Subscription: 'Subscriptions', Loan: 'Debt', Other: 'Other' };
    let MSET = { ...LumaMoney.DEFAULT_SETTINGS }, MENT = [], MERR = null, mMonth = null;
    const mForm = { id: null, kind: 'expense', category: 'Other' };

    const mCatInfo = (name, kind) => (kind === 'income' ? [...M_INCOME_CATS, ['Salary', 'fa-arrow-trend-up', '#4ade80']] : M_CATS).find(c => c[0] === name) || (kind === 'income' ? M_INCOME_CATS[M_INCOME_CATS.length - 1] : M_CATS[M_CATS.length - 1]);
    const mIsMY = () => lumaCountry() === 'Malaysia' && LumaPlan.has('payroll'); // the payroll calculator is a Glow / Zenith feature
    // take-home pay: Malaysia works out the deductions, other countries use the income as entered
    const mPay = () => mIsMY() ? myPayroll(MSET.gross_salary, { epfRate: MSET.epf_rate, pcbOverride: MSET.pcb_override == null ? null : Number(MSET.pcb_override) }) : { gross: MSET.gross_salary, net: MSET.gross_salary };

    // everything that happened in the month starting `mFirst`: logged entries, bills/subscriptions you marked paid, and the monthly salary
    function mTxns(mFirst) {
      const mLast = bAddDays(bAddMonths(mFirst, 1), -1), today = mytDayKey(Date.now()), out = [];
      MENT.forEach(e => { if (e.entry_date >= mFirst && e.entry_date <= mLast) out.push({ kind: e.kind, amount: Number(e.amount), cat: e.category, name: e.name || e.category, date: e.entry_date, entry: e }); });
      BPAY_ROWS.forEach(r => {
        const b = BILLS.find(x => x.id === r.bill_id), d = mytDayKey(r.paid_at);
        if (b && d >= mFirst && d <= mLast) out.push({ kind: 'expense', amount: Number(r.amount), cat: M_BILLCAT[b.category] || 'Other', name: b.name, date: d, bill: b });
      });
      const net = mPay().net, since = MSET.created_at ? bFirst(mytDayKey(MSET.created_at)) : null;
      if (net > 0 && since && mFirst >= since) {
        const day = Math.min(MSET.pay_day || 25, +mLast.slice(8)), date = mFirst.slice(0, 8) + String(day).padStart(2, '0');
        out.push({ kind: 'income', amount: net, cat: 'Salary', name: 'Salary', date, salary: true, expected: date > today });
      }
      return out.sort((a, c) => c.date.localeCompare(a.date));
    }

    function mTxRow(t) {
      const [, icon, col] = t.salary ? ['', 'fa-arrow-trend-up', '#4ade80'] : mCatInfo(t.cat, t.kind), dl = new Date(t.date + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      return `<div class="lrow m-tx" ${t.entry ? `data-id="${t.entry.id}"` : ''}><div class="licon" style="color:${col};background:${col}22"><i class="fa-solid ${icon}"></i></div>
        <div class="lmain"><div class="lt">${escapeHtml(t.name)}${t.bill ? `<span class="m-tag">${t.bill.category === 'Subscription' ? 'Subscription' : 'Bill'}</span>` : ''}${t.expected ? '<span class="m-tag">Expected</span>' : ''}</div><div class="ls">${escapeHtml(t.salary ? 'Income' : t.cat)} · ${dl}</div></div>
        <span class="m-amt ${t.kind === 'income' ? 'in' : 'out'}">${t.kind === 'income' ? '+' : '−'}${bRM(t.amount)}</span>${t.entry ? '<button type="button" class="hedit m-edit" title="Edit"><i class="fa-solid fa-pen"></i></button>' : ''}</div>`;
    }

    function paintMoney() {
      const root = docEl('moneyRoot'), sub = docEl('moneySub'); if (!root) return;
      if (MERR) {
        sub.textContent = 'Could not load money';
        root.innerHTML = card('<div class="ls">Has <b>supabase/migrations/023_money_country.sql</b> been run in the Supabase SQL Editor?</div>');
        return;
      }
      const thisFirst = bFirst(mytDayKey(Date.now())), mFirst = mMonth || thisFirst;
      if (mFirst > bAddMonths(thisFirst, 12) || mFirst < bAddMonths(thisFirst, -24)) mMonth = null;
      const first = mMonth || thisFirst, txns = mTxns(first);
      const income = txns.filter(t => t.kind === 'income').reduce((t, x) => t + x.amount, 0), spentRows = txns.filter(t => t.kind === 'expense'), spent = spentRows.reduce((t, x) => t + x.amount, 0);
      const budget = Number(MSET.monthly_budget) || 0, left = budget - spent, mName = new Date(first + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
      sub.textContent = `${mName} · ${bRM(spent)} spent` + (budget ? ` of ${bRM(budget)}` : '');

      const byCat = {}; spentRows.forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + t.amount; });
      const cats = Object.entries(byCat).sort((a, c) => c[1] - a[1]);
      const catHtml = cats.length ? cats.map(([n, v]) => { const [, , col] = mCatInfo(n, 'expense'); return `<div class="m-cat"><div class="top"><span class="dot" style="background:${col}"></span>${escapeHtml(n)}<span class="amt">${bRM(v)}</span></div><div class="bar"><span style="width:${Math.max(2, Math.round(v / spent * 100))}%;background:${col}"></span></div></div>`; }).join('')
        : '<div class="ls" style="padding:18px 2px">No spending logged this month yet. Log an expense, or mark a bill as paid.</div>';
      const shownTx = txns.slice(0, 5); // the page only lists the 5 latest; View all opens the full list
      const txHtml = shownTx.length ? shownTx.map(mTxRow).join('') : '<div class="ls" style="padding:18px 2px">Nothing yet this month.</div>';

      const incomeNote = MSET.gross_salary > 0 ? (mIsMY() ? 'take-home after EPF, SOCSO & EIS' : 'salary + other income') : 'tap to set your salary';
      root.innerHTML = `<div class="m-nav"><div class="h-mnav"><button type="button" class="m-mprev" title="Previous month"><i class="fa-solid fa-chevron-left"></i></button><span>${bMonthLabel(first)}</span><button type="button" class="m-mnext" title="Next month"><i class="fa-solid fa-chevron-right"></i></button></div></div>
        <div class="grid-4" style="margin-bottom:0.9rem">
          ${card(`<div class="metric"><div class="m-label" style="color:#fff">Income <i class="fa-solid fa-arrow-trend-up"></i></div><div class="m-value">${bRM(income)}</div><div class="m-sub">${incomeNote}</div></div>`, 'm-card-btn" data-act="income')}
          ${card(`<div class="metric"><div class="m-label" style="color:#fff">Spent <i class="fa-solid fa-arrow-trend-down"></i></div><div class="m-value">${bRM(spent)}</div><div class="m-sub">${spentRows.length} transaction${spentRows.length === 1 ? '' : 's'}</div></div>`)}
          ${card(`<div class="metric"><div class="m-label" style="color:#fff">Saved <i class="fa-solid fa-piggy-bank"></i></div><div class="m-value" style="${income - spent < 0 ? 'color:#fca5a5' : ''}">${income - spent < 0 ? '−' : ''}${bRM(Math.abs(income - spent))}</div><div class="m-sub">${income > 0 ? Math.round((income - spent) / income * 100) + '% of income' : 'income − spending'}</div></div>`)}
          ${card(`<div class="metric"><div class="m-label" style="color:#fff">Budget left <i class="fa-solid fa-wallet"></i></div><div class="m-value" style="${budget && left < 0 ? 'color:#fca5a5' : ''}">${budget ? (left < 0 ? '−' : '') + bRM(Math.abs(left)) : 'Set budget'}</div><div class="m-sub">${budget ? (left < 0 ? 'over budget' : 'of ' + bRM(budget)) : 'tap to set a monthly budget'}</div></div>`, 'm-card-btn" data-act="budget')}
        </div>
        <div class="m-grid">
          ${card(`<div class="section-title"><i class="fa-solid fa-chart-pie"></i> Spending by category</div><div class="m-scroll">${catHtml}</div>`, 'm-panel')}
          ${card(`<div class="section-title"><i class="fa-solid fa-right-left"></i> Recent transactions<button type="button" class="wgt-link m-viewall" style="margin-left:auto;background:none;border:none;font-family:inherit">View all</button></div><div class="m-scroll">${txHtml}</div>`, 'm-panel')}
        </div>`;
    }

    // ----- all transactions popup: change the month and (optionally) a single day -----
    let mAllMonth = null, mAllDay = '';
    function paintAllTx() {
      const first = mAllMonth, txns = mTxns(first), last = bAddDays(bAddMonths(first, 1), -1), nDays = +last.slice(8);
      const sel = docEl('mAllDay');
      if (mAllDay && !(mAllDay >= first && mAllDay <= last)) mAllDay = '';
      sel.innerHTML = '<option value="">All days</option>' + Array.from({ length: nDays }, (_, i) => { const k = first.slice(0, 8) + String(i + 1).padStart(2, '0'); return `<option value="${k}">${new Date(k + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</option>`; }).join('');
      sel.value = mAllDay; skinSelect(sel);
      docEl('mAllMonth').textContent = bMonthLabel(first);
      const rows = mAllDay ? txns.filter(t => t.date === mAllDay) : txns;
      const out = rows.filter(t => t.kind === 'expense').reduce((a, t) => a + t.amount, 0), inc = rows.filter(t => t.kind === 'income').reduce((a, t) => a + t.amount, 0);
      const m2 = v => 'RM' + Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      docEl('mAllSum').innerHTML = `<div class="mall-stat"><div class="l">Transactions</div><div class="v">${rows.length}</div></div><div class="mall-stat"><div class="l">Spent</div><div class="v" style="color:#fca5a5">${m2(out)}</div></div><div class="mall-stat"><div class="l">Income</div><div class="v" style="color:#6ee7b7">${m2(inc)}</div></div>`;
      docEl('mAllList').innerHTML = rows.length ? rows.map(mTxRow).join('') : `<div class="ls" style="padding:18px 2px">${mAllDay ? 'Nothing on this day.' : 'Nothing this month.'}</div>`;
      const thisFirst = bFirst(mytDayKey(Date.now()));
      docEl('mAllPrev').disabled = first <= bAddMonths(thisFirst, -24); docEl('mAllNext').disabled = first >= bAddMonths(thisFirst, 12);
    }
    function openAllTx() {
      mAllMonth = mMonth || bFirst(mytDayKey(Date.now())); mAllDay = '';
      paintAllTx();
      docEl('moneyAllOverlay').classList.add('open');
      docEl('moneyAllOverlay').querySelectorAll('.pem-body, .profile-edit-modal').forEach(el => { el.scrollTop = 0; });
    }
    const closeAllTx = () => docEl('moneyAllOverlay').classList.remove('open');
    docEl('mAllClose').onclick = docEl('mAllDone').onclick = closeAllTx;
    docEl('moneyAllOverlay').onclick = e => {
      if (e.target === docEl('moneyAllOverlay')) return closeAllTx();
      const row = e.target.closest('.m-tx[data-id]'); if (row && e.target.closest('.m-edit')) { closeAllTx(); openEntryModal(MENT.find(x => x.id === row.dataset.id)); }
    };
    const keyEnd = first => bAddDays(bAddMonths(first, 1), -1); // the last day of the month that starts on `first`
    docEl('mAllMonth').style.cursor = 'pointer'; docEl('mAllMonth').title = 'Choose a month and year';
    docEl('mAllMonth').onclick = () => { const thisFirst = bFirst(mytDayKey(Date.now())); luDatePopup(docEl('mAllMonth'), { value: mAllMonth, min: bAddMonths(thisFirst, -24), max: keyEnd(bAddMonths(thisFirst, 12)), onPick: k => { mAllMonth = bFirst(k); mAllDay = ''; paintAllTx(); } }); };
    docEl('mAllPrev').onclick = () => { mAllMonth = bAddMonths(mAllMonth, -1); mAllDay = ''; paintAllTx(); };
    docEl('mAllNext').onclick = () => { mAllMonth = bAddMonths(mAllMonth, 1); mAllDay = ''; paintAllTx(); };
    docEl('mAllDay').addEventListener('change', () => { mAllDay = docEl('mAllDay').value; paintAllTx(); });

    async function loadMoneyData() {
      const since = bAddMonths(bFirst(mytDayKey(Date.now())), -24);
      const [s, e] = await Promise.all([LumaMoney.getSettings(), LumaMoney.listEntries(since), loadBillsData()]);
      MERR = s.error || e.error || null; // bills failing to load only means no bill payments show up
      if (!MERR) { MSET = s.data; MENT = e.data || []; }
    }

    // ----- log expense / income -----
    const mErr = m => { docEl('mEntryError').textContent = m; docEl('mEntryError').style.display = m ? 'flex' : 'none'; };
    function paintEntryForm() {
      const inc = mForm.kind === 'income', list = inc ? M_INCOME_CATS : M_CATS;
      if (!list.some(c => c[0] === mForm.category)) mForm.category = list[list.length - 1][0];
      docEl('mEntryKind').innerHTML = [['expense', 'Expense'], ['income', 'Income']].map(([k, l]) => `<button type="button" data-k="${k}" class="${k === mForm.kind ? 'on' : ''}">${l}</button>`).join('');
      docEl('mEntryCats').innerHTML = list.map(([n, i, c]) => `<button type="button" data-c="${n}" class="${n === mForm.category ? 'on' : ''}" style="--gc:${c}"><i class="fa-solid ${i}" style="color:${c}"></i>${n}</button>`).join('');
      docEl('mEntryTitle').textContent = (mForm.id ? 'Edit ' : 'Log ') + (inc ? 'income' : 'expense');
    }
    function openEntryModal(e, kind) {
      mForm.id = e ? e.id : null; mForm.kind = e ? e.kind : kind || 'expense'; mForm.category = e ? e.category : 'Other';
      docEl('mEntryAmount').value = e ? e.amount : ''; docEl('mEntryName').value = e ? e.name : '';
      docEl('mEntryDate').value = e ? e.entry_date : mytDayKey(Date.now()); if (docEl('mEntryDate')._luDateRefresh) docEl('mEntryDate')._luDateRefresh();
      docEl('mEntryDelete').style.display = e ? '' : 'none'; mErr(''); paintEntryForm();
      docEl('moneyEntryOverlay').classList.add('open'); setTimeout(() => docEl('mEntryAmount').focus(), 50);
    }
    const closeEntryModal = () => docEl('moneyEntryOverlay').classList.remove('open');
    docEl('mEntryClose').onclick = closeEntryModal;
    docEl('moneyEntryOverlay').onclick = e => { if (e.target === docEl('moneyEntryOverlay')) closeEntryModal(); };
    docEl('mEntryKind').onclick = e => { const b = e.target.closest('button'); if (b) { mForm.kind = b.dataset.k; paintEntryForm(); } };
    docEl('mEntryCats').onclick = e => { const b = e.target.closest('button'); if (b) { mForm.category = b.dataset.c; paintEntryForm(); } };
    docEl('mEntryAmount').addEventListener('input', () => { const c = cleanDecimal(docEl('mEntryAmount').value); if (c !== docEl('mEntryAmount').value) docEl('mEntryAmount').value = c; });
    docEl('mEntrySave').onclick = async () => {
      const amount = gNum(docEl('mEntryAmount').value), date = docEl('mEntryDate').value;
      if (!(amount > 0)) return mErr('Enter the amount (a number above 0).');
      if (!date) return mErr('Pick the date.');
      const fields = { kind: mForm.kind, amount, category: mForm.category, name: docEl('mEntryName').value.trim(), entry_date: date };
      const btn = docEl('mEntrySave'); btn.disabled = true; btn.textContent = 'Saving…';
      const { data, error } = mForm.id ? await LumaMoney.updateEntry(mForm.id, fields) : await LumaMoney.addEntry(fields);
      btn.disabled = false; btn.textContent = 'Save';
      if (error) return mErr(/money_entries|schema cache|does not exist/i.test(error.message) ? 'Money isn\'t set up yet — run supabase/migrations/023_money_country.sql in the SQL Editor.' : error.message);
      const i = MENT.findIndex(x => x.id === data.id); if (i >= 0) MENT[i] = data; else MENT.unshift(data);
      closeEntryModal(); paintMoney();
    };
    docEl('mEntryDelete').onclick = async () => {
      if (!await luConfirm({ title: 'Delete this entry?', message: 'It will be removed from your totals. This can\'t be undone.' })) return;
      const { error } = await LumaMoney.removeEntry(mForm.id);
      if (error) return mErr(error.message);
      MENT = MENT.filter(x => x.id !== mForm.id); closeEntryModal(); paintMoney();
    };

    // ----- income & salary -----
    const mInc = { epf: 11 };
    const mIncErr = m => { docEl('mIncError').textContent = m; docEl('mIncError').style.display = m ? 'flex' : 'none'; };
    function paintIncomeForm() {
      const my = docEl('mIncCountry').value === 'Malaysia', gross = gNum(docEl('mIncGross').value) || 0;
      docEl('mIncMy').style.display = my ? '' : 'none'; docEl('mIncPcbWrap').style.display = my ? '' : 'none';
      docEl('mIncGrossLbl').textContent = my ? 'Gross monthly salary (RM) — before deductions' : 'Monthly income (RM) — what you receive';
      docEl('mIncEpf').innerHTML = [[11, '11% (standard)'], [9, '9% (reduced)'], [0, '0% (none)']].map(([v, l]) => `<button type="button" data-e="${v}" class="${v === mInc.epf ? 'on' : ''}">${l}</button>`).join('');
      const box = docEl('mIncBreak'), f = x => bRM(x);
      if (!my) { box.innerHTML = `<div class="row total"><span>Monthly income counted</span><b>${f(gross)}</b></div><div class="note">Salary deductions (EPF, SOCSO, EIS, tax) are only worked out for Malaysia. Enter what you take home each month.</div>`; return; }
      if (!(gross > 0)) { box.innerHTML = '<div class="note" style="margin:0">Enter your gross salary to see your take-home pay.</div>'; return; }
      const p = myPayroll(gross, { epfRate: mInc.epf, pcbOverride: docEl('mIncPcb').value.trim() === '' ? null : gNum(docEl('mIncPcb').value) });
      box.innerHTML = `<div class="row"><span>Gross salary</span><b>${f(p.gross)}</b></div>
        <div class="row minus"><span>EPF (${mInc.epf}%)</span><b>−${f(p.epf)}</b></div>
        <div class="row minus"><span>SOCSO (0.5%)</span><b>−${f(p.socso)}</b></div>
        <div class="row minus"><span>EIS (0.2%)</span><b>−${f(p.eis)}</b></div>
        <div class="row minus"><span>LINDUNG 24 Jam (0.75%) <span class="m-tag">New · Jun 2026</span></span><b>−${f(p.lindung)}</b></div>
        ${p.pcb > 0 ? `<div class="row minus"><span>PCB (income tax)</span><b>−${f(p.pcb)}</b></div>` : ''}
        <div class="row total"><span>Take-home pay</span><b>${f(p.net)}</b></div>
        <div class="note">EPF, SOCSO, EIS and LINDUNG 24 Jam are worked out from your gross salary (SOCSO, EIS and LINDUNG 24 Jam apply to wages up to RM6,000). Income tax (PCB) is not estimated — type the amount from your payslip above if you pay any.</div>`;
    }
    function openIncomeModal() {
      mIncErr('');
      const c = lumaCountry(); docEl('mIncCountry').innerHTML = '<option value="">Select country</option>' + LumaAuth.COUNTRIES.map(x => `<option value="${x}">${x}</option>`).join('');
      docEl('mIncCountry').value = c; if (docEl('mIncCountry').selectedIndex < 0) docEl('mIncCountry').value = ''; skinSelect(docEl('mIncCountry'));
      mInc.epf = Number(MSET.epf_rate);
      docEl('mIncGross').value = MSET.gross_salary || ''; docEl('mIncPayDay').value = MSET.pay_day || 25; docEl('mIncPcb').value = MSET.pcb_override == null ? '' : MSET.pcb_override;
      paintIncomeForm(); docEl('moneyIncomeOverlay').classList.add('open');
    }
    const closeIncomeModal = () => docEl('moneyIncomeOverlay').classList.remove('open');
    docEl('mIncClose').onclick = closeIncomeModal;
    docEl('moneyIncomeOverlay').onclick = e => { if (e.target === docEl('moneyIncomeOverlay')) closeIncomeModal(); };
    docEl('mIncCountry').addEventListener('change', paintIncomeForm);
    docEl('mIncEpf').onclick = e => { const b = e.target.closest('button'); if (b) { mInc.epf = +b.dataset.e; paintIncomeForm(); } };
    ['mIncGross', 'mIncPcb'].forEach(id => docEl(id).addEventListener('input', () => { const c = cleanDecimal(docEl(id).value); if (c !== docEl(id).value) docEl(id).value = c; paintIncomeForm(); }));
    ['mIncPayDay'].forEach(id => docEl(id).addEventListener('input', () => { const c = docEl(id).value.replace(/\D/g, ''); if (c !== docEl(id).value) docEl(id).value = c; paintIncomeForm(); }));
    docEl('mIncSave').onclick = async () => {
      const gross = gNum(docEl('mIncGross').value || '0'), pay = Math.round(gNum(docEl('mIncPayDay').value || '25')), pcbRaw = docEl('mIncPcb').value.trim(), pcb = pcbRaw === '' ? null : gNum(pcbRaw);
      if (!(gross >= 0)) return mIncErr('Enter your salary as a number.');
      if (!(pay >= 1 && pay <= 31)) return mIncErr('Pay day must be between 1 and 31.');
      if (pcb != null && !(pcb >= 0)) return mIncErr('PCB must be a number (0 or more), or left blank.');
      const country = docEl('mIncCountry').value, btn = docEl('mIncSave'); btn.disabled = true; btn.textContent = 'Saving…';
      if (country && country !== lumaCountry()) { // keep the profile in sync with the country chosen here
        const r = await LumaAuth.updateProfile({ country }); if (!r.error) LUMA_PROFILE = r.data;
        else if (LUMA_PROFILE) LUMA_PROFILE = { ...LUMA_PROFILE, country }; // column missing: still use it this session
      }
      const { data, error } = await LumaMoney.saveSettings({ gross_salary: gross, epf_rate: mInc.epf, pay_day: pay, pcb_override: pcb });
      btn.disabled = false; btn.textContent = 'Save income';
      if (error) return mIncErr(/money_settings|schema cache|does not exist/i.test(error.message) ? 'Money isn\'t set up yet — run supabase/migrations/023_money_country.sql in the SQL Editor.' : error.message);
      MSET = { ...MSET, ...data }; closeIncomeModal(); paintMoney();
    };

    async function editBudget() {
      const raw = await luPrompt({ title: 'Monthly budget', message: 'How much do you plan to spend each month? Enter 0 to turn the budget off.', placeholder: 'e.g. 3000', value: MSET.monthly_budget ? String(MSET.monthly_budget) : '', ok: 'Save', numeric: true });
      if (raw == null) return;
      const v = gNum(raw); if (!(v >= 0)) return luAlert('Please enter a number (0 or more).', 'Invalid amount');
      const { data, error } = await LumaMoney.saveSettings({ monthly_budget: v });
      if (error) return luAlert('Could not save: ' + error.message);
      MSET = { ...MSET, ...data }; paintMoney();
    }

    async function loadMoney(pg) {
      mMonth = null;
      pg.querySelector('#moneyAddBtn').addEventListener('click', () => openEntryModal(null, 'expense'));
      pg.querySelector('#moneyIncomeBtn').addEventListener('click', openIncomeModal);
      pg.querySelector('#moneyBudgetBtn').addEventListener('click', editBudget);
      pg.querySelector('#moneyRoot').addEventListener('click', e => {
        const mj = e.target.closest('.m-nav .h-mnav > span'); if (mj) { const cur = mMonth || bFirst(mytDayKey(Date.now())); return void luDatePopup(mj, { value: cur, onPick: k => { mMonth = bFirst(k); if (mMonth === bFirst(mytDayKey(Date.now()))) mMonth = null; paintMoney(); } }); }
        if (e.target.closest('.m-mprev') || e.target.closest('.m-mnext')) { mMonth = bAddMonths(mMonth || bFirst(mytDayKey(Date.now())), e.target.closest('.m-mprev') ? -1 : 1); if (mMonth === bFirst(mytDayKey(Date.now()))) mMonth = null; return paintMoney(); }
        if (e.target.closest('.m-viewall')) return openAllTx();
        const act = e.target.closest('[data-act]'); if (act) return act.dataset.act === 'income' ? openIncomeModal() : editBudget();
        const row = e.target.closest('.m-tx[data-id]'); if (row && e.target.closest('.m-edit')) openEntryModal(MENT.find(x => x.id === row.dataset.id));
      });
      paintMoney();
      await loadMoneyData(); paintMoney();
    }


    WIRE.money = function (pg) { return loadMoney(pg); };
