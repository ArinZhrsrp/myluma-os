// LUMA — module: split (Split expenses; a Zenith feature)
    // Share a bill with people in your contacts. The person who paid marks each share as paid back; your own share lands in Money as an expense.
    // Everything goes through database functions (migration 064): save_split, delete_split, my_splits, mark_split_paid, nudge_split_member.
    const SP = { list: [], loaded: false, err: '', filter: 'open', open: new Set(), contacts: null, f: null };
    const spDb = () => LumaAuth.client.schema('luma');
    const spCan = () => LumaPlan.plan === 'zenith' || (LumaPlan.get('split') || 0) >= 1;
    const spMe = () => LUMA_USER.id;
    const spRM = n => 'RM ' + (Math.round(Number(n) * 100) / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const spCents = n => Math.round(Number(n) * 100);
    const spShort = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const spSettled = s => s.members.every(m => m.user_id === s.paid_by || m.paid);
    const spNum = v => { const n = Number(String(v).replace(/,/g, '').trim()); return isFinite(n) ? n : NaN; };
    const spBtn = (id, busy, label) => { const b = docEl(id); b.disabled = busy; b.textContent = busy ? 'Saving…' : label; };
    // Malaysian taxes on a purchase: [key, chip, service charge %, tax %, label saved with the split]
    const SP_TAXES = [['none', 'No tax', 0, 0, ''], ['sst6', 'SST 6%', 0, 6, 'SST 6%'], ['sst8', 'SST 8%', 0, 8, 'SST 8%'], ['fnb', 'Service charge 10% + SST 6%', 10, 6, 'Service charge 10% + SST 6%'], ['sales5', 'Sales tax 5%', 0, 5, 'Sales tax 5%'], ['sales10', 'Sales tax 10%', 0, 10, 'Sales tax 10%'], ['other', 'Other', 0, 0, '']];
    const spTaxOf = f => { const t = SP_TAXES.find(x => x[0] === f.tax) || SP_TAXES[0]; return t[0] === 'other' ? { s: 0, t: Math.max(0, Math.min(100, spNum(f.taxPct) || 0)), label: (spNum(f.taxPct) || 0) > 0 ? 'Tax ' + (spNum(f.taxPct) || 0) + '%' : '' } : { s: t[2], t: t[3], label: t[4] }; };
    const spMult = f => { const x = spTaxOf(f); return (1 + x.s / 100) * (1 + x.t / 100); };
    // money boxes fill from the right like a card reader: typing 1, 2, 3 shows 0.01, 0.12, 1.23
    function spMask(el) { const d = el.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10); el.value = d ? (Number(d) / 100).toFixed(2) : ''; try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { } }
    const spIsMoney = el => el && (el.id === 'spTotal' || el.id === 'spFinal' || (el.dataset && el.dataset.spVal !== undefined && el.dataset.money === '1'));
    const spFirst = name => String(name || '').split(' ')[0] || 'Someone';

    MODULES.split = function () {
      return head('Split expenses', 'Share a bill with your contacts and keep track of who has paid you back',
        `<button type="button" class="create-btn" id="spNew"><i class="fa-solid fa-plus"></i> New split</button>`) + `<div id="spRoot"><span class="ls">Loading…</span></div>`;
    };

    // what each person owes, netted per person: positive = they owe me
    function spBalances() {
      const bal = new Map(), names = new Map();
      SP.list.forEach(s => s.members.forEach(m => {
        names.set(m.user_id, m.name);
        if (m.user_id === s.paid_by || m.paid || !Number(m.share)) return;
        if (s.paid_by === spMe()) bal.set(m.user_id, (bal.get(m.user_id) || 0) + spCents(m.share));
        else if (m.user_id === spMe()) { bal.set(s.paid_by, (bal.get(s.paid_by) || 0) - spCents(m.share)); names.set(s.paid_by, s.paid_by_name); }
      }));
      return [...bal.entries()].filter(([, c]) => c !== 0).map(([id, c]) => ({ id, name: names.get(id), cents: c })).sort((a, b) => Math.abs(b.cents) - Math.abs(a.cents));
    }

    function spPaint() {
      const root = docEl('spRoot'); if (!root) return;
      if (SP.err) { root.innerHTML = `<div class="card full-width"><span class="ls">${escapeHtml(SP.err)}</span></div>`; return; }
      if (!SP.list.length && !spCan()) {
        root.innerHTML = `<div class="card full-width sp-lock"><i class="fa-solid fa-lock" style="font-size:1.4rem;color:#a78bfa"></i><div style="color:#fff;font-weight:600;margin-top:8px">Split expenses is a Zenith feature</div><p>Share dinners, trips and bills with your contacts, see who owes whom, and mark shares as paid. Your own share is added to Money for you.</p><button type="button" class="create-btn" id="spUpgrade" style="margin:0 auto">See plans</button></div>`; return;
      }
      const bal = spBalances(), owed = bal.filter(b => b.cents > 0).reduce((a, b) => a + b.cents, 0), owe = bal.filter(b => b.cents < 0).reduce((a, b) => a - b.cents, 0);
      const rows = SP.list.filter(s => SP.filter === 'all' || (SP.filter === 'open') === !spSettled(s));
      root.innerHTML = `<div class="sp-cards"><div class="card sp-stat"><div class="l">Owed to you</div><div class="v in">${spRM(owed / 100)}</div></div><div class="card sp-stat"><div class="l">You owe</div><div class="v out">${spRM(owe / 100)}</div></div></div>`
        + (bal.length ? `<div class="sp-people-list">${bal.map(b => `<span class="sp-bal">${b.cents > 0 ? `${escapeHtml(spFirst(b.name))} owes you <b class="in">${spRM(b.cents / 100)}</b>` : `You owe ${escapeHtml(spFirst(b.name))} <b class="out">${spRM(-b.cents / 100)}</b>`}</span>`).join('')}</div>` : '')
        + `<div class="ph-chips">${[['open', 'Open'], ['settled', 'Settled'], ['all', 'All']].map(c => `<button type="button" class="ph-chip ${SP.filter === c[0] ? 'active' : ''}" data-spf="${c[0]}">${c[1]}</button>`).join('')}</div>`
        + `<div class="card full-width">${rows.length ? rows.map(spRow).join('') : `<span class="ls">${SP.list.length ? 'Nothing here.' : 'No splits yet. Tap “New split” to add your first one.'}</span>`}</div>`;
    }
    function spRow(s) {
      const me = spMe(), mine = s.members.find(m => m.user_id === me), done = spSettled(s), open = SP.open.has(s.id), iPaid = s.paid_by === me;
      const sub = `${spShort(s.split_date)} · ${iPaid ? 'you paid' : escapeHtml(spFirst(s.paid_by_name)) + ' paid'} · ${s.members.length} people` + (s.tax_label ? ` · ${escapeHtml(s.tax_label)}${s.subtotal ? ' on ' + spRM(s.subtotal) : ''}` : '');
      let side = '';
      if (mine && mine.user_id !== s.paid_by && Number(mine.share)) side = `<div style="font-size:0.72rem;color:rgba(255,255,255,0.6)">${mine.paid ? 'You paid your' : 'You owe'} ${spRM(mine.share)}</div>`;
      const det = !open ? '' : `<div class="sp-detail">${s.members.map(m => {
        const pay = m.user_id === s.paid_by, nm = m.user_id === me ? 'You' : escapeHtml(m.name);
        const st = pay ? '<span class="st ok">paid the bill</span>' : m.paid ? '<span class="st ok"><i class="fa-solid fa-check"></i> paid back</span>' : '<span class="st">not paid yet</span>';
        const btn = iPaid && !pay ? (m.paid ? `<button type="button" class="np-btn" data-sp-pay="${s.id}|${m.user_id}|0">Undo</button>` : `<button type="button" class="np-btn" data-sp-pay="${s.id}|${m.user_id}|1"><i class="fa-solid fa-check"></i> Mark as paid</button>${m.user_id !== me ? `<button type="button" class="np-btn" data-sp-nudge="${s.id}|${m.user_id}"><i class="fa-regular fa-bell"></i> Remind</button>` : ''}`) : '';
        return `<div class="sp-mem"><span class="n">${nm}</span><span>${spRM(m.share)}</span>${st}${btn}</div>`;
      }).join('')}${s.note ? `<div class="ls" style="margin-top:8px">${escapeHtml(s.note)}</div>` : ''}${s.owner_id === me ? `<div class="sp-acts"><button type="button" class="np-btn" data-sp-edit="${s.id}"><i class="fa-solid fa-pen"></i> Edit</button><button type="button" class="np-btn" data-sp-del="${s.id}" style="color:#fca5a5"><i class="fa-regular fa-trash-can"></i> Delete</button></div>` : `<div class="ls" style="margin-top:8px">Added by ${escapeHtml(s.owner_name)}</div>`}</div>`;
      return `<div class="sp-row" data-id="${s.id}"><div class="sp-top" data-sp-toggle="${s.id}"><div class="sp-main"><div class="sp-name">${escapeHtml(s.title)}</div><div class="sp-sub">${sub}</div></div><div class="sp-side"><div class="t">${spRM(s.total)}</div>${side}<span class="sp-tag ${done ? 'done' : 'open'}">${done ? 'Settled' : 'Open'}</span></div></div>${det}</div>`;
    }

    async function spLoad() {
      const { data, error } = await spDb().rpc('my_splits');
      SP.loaded = true;
      if (error) SP.err = /my_splits|schema cache|does not exist/i.test(error.message) ? 'Split expenses will work once your database is up to date.' : error.message;
      else { SP.err = ''; SP.list = Array.isArray(data) ? data : []; }
      spPaint();
    }

    // ---------- the New / Edit popup ----------
    const SP_METHODS = [['equal', 'Equally'], ['exact', 'Exact amounts'], ['percent', 'By percent'], ['shares', 'By shares']];
    async function spContacts() {
      if (SP.contacts) return SP.contacts;
      const r = await LumaContacts.listContacts();
      SP.contacts = r.error ? [] : (r.data || []).filter(c => c.status === 'accepted').map(c => ({ id: c.other_id, name: [c.other_first_name, c.other_last_name].filter(Boolean).join(' ') || c.other_email }));
      return SP.contacts;
    }
    // The two totals: type the one before tax, the one after tax, or both. With a tax chosen, one works out the other;
    // with "No tax" and both typed, the difference is the tax.
    function spTotals() {
      const f = SP.f, subIn = spCents(spNum(docEl('spTotal').value) || 0), finIn = spCents(spNum(docEl('spFinal').value) || 0), m = spMult(f);
      let sub, fin;
      if (m !== 1) { if (f.anchor === 'after' && finIn > 0) { fin = finIn; sub = Math.round(fin / m); } else { sub = subIn; fin = Math.round(sub * m); } }
      else if (f.anchor === 'after' || f.finTyped) { fin = finIn; sub = subIn > 0 && finIn >= subIn ? subIn : finIn; }
      else { sub = subIn; fin = subIn; }
      if (m === 1 && fin < sub) fin = sub;
      return { sub, fin };
    }
    // keep the box that is worked out in step with the one that was typed
    function spSyncTotals(t) {
      const f = SP.f, B = docEl('spTotal'), A = docEl('spFinal'), show = c => c > 0 ? (c / 100).toFixed(2) : '';
      if (spMult(f) !== 1) { if (f.anchor === 'after') B.value = show(t.sub); else A.value = show(t.fin); }
      else if (!f.finTyped) A.value = show(t.sub);
      else if (!(spCents(spNum(B.value) || 0) > 0)) B.value = show(t.fin);
    }
    // each person's amount in cents (tax included), or ok:false while the numbers are not complete
    function spCalc() {
      const f = SP.f, ids = f.people.filter(p => p.on).map(p => p.id), pre = new Map(), out = new Map(), t = spTotals(), sub = t.sub, fin = t.fin;
      if (!ids.length) return { out, msg: 'Pick at least one person to split with.', ok: false };
      if (sub <= 0) return { out, msg: 'Enter a total (before or after tax) to see each share.', ok: false };
      const taxed = fin !== sub;
      const val = id => Number(String(f.vals[id] ?? '').replace(',', '.')) || 0;
      let msg, ok = true;
      if (f.method === 'equal') { const base = Math.floor(sub / ids.length), extra = sub - base * ids.length; ids.forEach((id, i) => pre.set(id, base + (i < extra ? 1 : 0))); msg = `${ids.length} people`; }
      else if (f.method === 'exact') { let sum = 0; ids.forEach(id => { const c = spCents(val(id)); pre.set(id, c); sum += c; }); const left = sub - sum; ok = left === 0; msg = left === 0 ? 'Adds up' : left > 0 ? `${spRM(left / 100)} still to assign` : `${spRM(-left / 100)} over the amount`; }
      else {
        const w = ids.map(id => Math.max(0, val(id))), sw = w.reduce((a, b) => a + b, 0);
        if (f.method === 'percent' && Math.abs(sw - 100) > 0.05) { ids.forEach(id => pre.set(id, 0)); ok = false; msg = `Percentages add up to ${Math.round(sw * 100) / 100}%, they should be 100%`; }
        else if (sw <= 0) { ids.forEach(id => pre.set(id, 0)); ok = false; msg = 'Enter the shares for each person.'; }
        else { let given = 0; ids.forEach((id, i) => { const c = i === ids.length - 1 ? sub - given : Math.round(sub * w[i] / sw); pre.set(id, c); given += c; }); msg = f.method === 'percent' ? 'Split by percent' : 'Split by shares'; }
      }
      // add the tax to each person's part, keeping the cents adding up to the final total
      const m = fin / sub; let given = 0; ids.forEach(id => { const c = Math.floor((pre.get(id) || 0) * m + 1e-9); out.set(id, c); given += c; });
      const takers = ids.filter(id => (pre.get(id) || 0) > 0); for (let i = 0, rest = fin - given; rest > 0 && takers.length; i = (i + 1) % takers.length, rest--) out.set(takers[i], out.get(takers[i]) + 1);
      msg += taxed ? ` · ${spRM(sub / 100)} + tax ${spRM((fin - sub) / 100)} = ${spRM(fin / 100)} in total` : ` · ${spRM(fin / 100)} in total`;
      const tx = spTaxOf(f), label = !taxed ? '' : tx.label || ('Tax RM ' + ((fin - sub) / 100).toFixed(2));
      return { out, ok, msg, sub, fin, taxed, label };
    }
    function spPaintForm() {
      const f = SP.f, calc = spCalc(), me = spMe();
      docEl('spPeople').innerHTML = f.people.map(p => {
        const inp = f.method === 'equal' ? '' : `<input class="val" data-sp-val="${p.id}" ${f.method === 'exact' ? 'data-money="1"' : ''} type="text" inputmode="${f.method === 'exact' ? 'numeric' : 'decimal'}" placeholder="${f.method === 'exact' ? 'RM' : f.method === 'percent' ? '%' : 'shares'}" value="${escapeHtml(String(f.vals[p.id] ?? ''))}" ${p.on ? '' : 'disabled'}>`;
        return `<div class="sp-person"><input type="checkbox" data-sp-on="${p.id}" id="spc_${p.id}" ${p.on ? 'checked' : ''}><span class="av">${escapeHtml((p.name[0] || '?').toUpperCase())}</span><label class="nm" for="spc_${p.id}">${p.id === me ? 'You' : escapeHtml(p.name)}</label>${inp}<span class="amt">${p.on && calc.out.has(p.id) ? spRM(calc.out.get(p.id) / 100) : ''}</span></div>`;
      }).join('');
      docEl('spMethods').innerHTML = SP_METHODS.map(m => `<button type="button" class="sp-chip ${f.method === m[0] ? 'active' : ''}" data-sp-m="${m[0]}">${m[1]}</button>`).join('');
      const payers = f.people.filter(p => p.on || p.id === me);
      if (!payers.some(p => p.id === f.payer)) f.payer = me;
      docEl('spPayers').innerHTML = payers.map(p => `<button type="button" class="sp-chip ${f.payer === p.id ? 'active' : ''}" data-sp-payer="${p.id}">${p.id === me ? 'You' : escapeHtml(spFirst(p.name))}</button>`).join('');
      docEl('spTax').innerHTML = SP_TAXES.map(t => `<button type="button" class="sp-chip ${f.tax === t[0] ? 'active' : ''}" data-sp-tax="${t[0]}">${t[1]}</button>`).join('');
      docEl('spTaxOther').style.display = f.tax === 'other' ? '' : 'none';
      docEl('spTaxHint').textContent = f.tax === 'none' ? 'Type either total (at least one): the other is worked out for you. With a tax picked it adds or removes the tax; with no tax, typing both makes the difference the tax.' : 'Type either total below and the other is worked out with this tax.';
      spSyncTotals(spTotals());
      const s = docEl('spSum'); s.textContent = calc.msg; s.classList.toggle('bad', !calc.ok && !!docEl('spTotal').value);
    }
    async function spOpenForm(split) {
      if (!spCan()) return openPlans();
      const contacts = await spContacts(), me = spMe();
      const people = [{ id: me, name: 'You', on: true }].concat(contacts.map(c => ({ id: c.id, name: c.name, on: false })));
      const f = SP.f = { id: split ? split.id : null, people, method: 'equal', vals: {}, payer: split ? split.paid_by : me, tax: 'none', taxPct: '', anchor: 'before', finTyped: false, keepLabel: split ? (split.tax_label || '') : '' };
      docEl('spTitle').textContent = split ? 'Edit split' : 'New split'; docEl('spError').textContent = ''; docEl('spError').classList.remove('show');
      docEl('spName').value = split ? split.title : ''; docEl('spTotal').value = split ? Number(split.subtotal || split.total).toFixed(2) : ''; docEl('spFinal').value = split && split.subtotal ? Number(split.total).toFixed(2) : ''; if (split && split.subtotal) { f.anchor = 'after'; f.finTyped = true; } docEl('spTaxPct').value = '';
      docEl('spDate').value = split ? split.split_date : mytDayKey(Date.now()); if (docEl('spDate')._luDateRefresh) docEl('spDate')._luDateRefresh();
      docEl('spNote').value = split ? split.note : '';
      if (split) { // the way it was split is not kept, only the amounts: edit them as exact amounts
        f.method = 'exact';
        split.members.forEach(m => { let p = people.find(x => x.id === m.user_id); if (!p) { p = { id: m.user_id, name: m.name, on: false }; people.push(p); } p.on = true; f.vals[m.user_id] = Number(m.share).toFixed(2); });
        const mineIn = split.members.some(m => m.user_id === me); people[0].on = mineIn; if (!mineIn) f.vals[me] = '0';
      }
      spPaintForm(); spTop();
      docEl('spOverlay').classList.add('open'); setTimeout(() => docEl('spName').focus(), 50);
    }
    const spTop = () => { docEl('spOverlay').querySelectorAll('.pem-body').forEach(el => { el.scrollTop = 0; }); };
    const spCloseForm = () => docEl('spOverlay').classList.remove('open');
    const spFormErr = m => { const e = docEl('spError'); e.textContent = m || ''; e.classList.toggle('show', !!m); };

    async function spSave() {
      const f = SP.f, name = docEl('spName').value.trim(), calc = spCalc(), me = spMe();
      if (!name) return spFormErr('Give the split a name.');
      if (!(calc.sub > 0)) return spFormErr('Enter a total, either before or after tax.');
      const on = f.people.filter(p => p.on);
      if (!on.some(p => p.id !== me)) return spFormErr('Pick at least one person to split with.');
      if (!calc.ok) return spFormErr(calc.msg);
      const members = on.map(p => ({ user_id: p.id, share: (calc.out.get(p.id) || 0) / 100 }));
      if (!on.some(p => p.id === me) && f.payer === me) members.push({ user_id: me, share: 0 });   // you paid but are not sharing the cost
      spBtn('spSave', true, 'Saving…'); spFormErr('');
      const { error } = await spDb().rpc('save_split', { p_id: f.id, p_title: name, p_total: calc.fin / 100, p_paid_by: f.payer, p_date: docEl('spDate').value || null, p_note: docEl('spNote').value.trim(), p_method: f.method, p_members: members, p_subtotal: calc.taxed ? calc.sub / 100 : null, p_tax_label: calc.label });
      spBtn('spSave', false, 'Save split');
      if (error) return spFormErr(error.message);
      spCloseForm(); await spLoad(); flashToast(f.id ? 'Split updated' : 'Split saved', name, 'fa-receipt', '#a78bfa');
    }

    function spWireForm() {
      docEl('spClose').onclick = spCloseForm;
      docEl('spOverlay').onclick = e => { if (e.target === docEl('spOverlay')) spCloseForm(); };
      docEl('spSave').onclick = spSave;
      docEl('spTotal').addEventListener('input', () => { spMask(docEl('spTotal')); if (SP.f) { SP.f.anchor = 'before'; spPaintFormKeepFocus(); } });
      docEl('spFinal').addEventListener('input', () => { spMask(docEl('spFinal')); if (SP.f) { SP.f.anchor = 'after'; SP.f.finTyped = !!docEl('spFinal').value; spPaintFormKeepFocus(); } });
      docEl('spTaxPct').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 5); if (SP.f) { SP.f.taxPct = e.target.value; spPaintFormKeepFocus(); } });
      docEl('spOverlay').addEventListener('change', e => { const c = e.target.closest('[data-sp-on]'); if (c && SP.f) { SP.f.people.find(p => p.id === c.dataset.spOn).on = c.checked; spPaintForm(); } });
      docEl('spOverlay').addEventListener('input', e => { const v = e.target.closest('[data-sp-val]'); if (v && SP.f) { if (spIsMoney(v)) spMask(v); else v.value = SP.f.method === 'shares' ? v.value.replace(/\D/g, '').slice(0, 3) : v.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 6); SP.f.vals[v.dataset.spVal] = v.value; spPaintFormKeepFocus(v); } });
      docEl('spOverlay').addEventListener('click', e => {
        const m = e.target.closest('[data-sp-m]'); if (m && SP.f) { SP.f.method = m.dataset.spM; if (SP.f.method === 'percent') { const n = SP.f.people.filter(p => p.on).length; SP.f.vals = {}; SP.f.people.filter(p => p.on).forEach(p => { SP.f.vals[p.id] = n ? String(Math.round(10000 / n) / 100) : ''; }); } else if (SP.f.method === 'shares') { SP.f.vals = {}; SP.f.people.filter(p => p.on).forEach(p => { SP.f.vals[p.id] = '1'; }); } else if (SP.f.method === 'exact') SP.f.vals = {}; spPaintForm(); }
        const tx = e.target.closest('[data-sp-tax]'); if (tx && SP.f) { SP.f.tax = tx.dataset.spTax; spPaintForm(); if (SP.f.tax === 'other') docEl('spTaxPct').focus(); }
        const p = e.target.closest('[data-sp-payer]'); if (p && SP.f) { SP.f.payer = p.dataset.spPayer; spPaintForm(); }
      });
    }
    // repaint while typing without losing the cursor: only the amounts and the summary change
    function spPaintFormKeepFocus(input) {
      const f = SP.f, calc = spCalc(); spSyncTotals(spTotals());
      docEl('spPeople').querySelectorAll('.sp-person').forEach(row => { const cb = row.querySelector('[data-sp-on]'), amt = row.querySelector('.amt'); if (cb && amt) amt.textContent = f.people.find(p => p.id === cb.dataset.spOn).on && calc.out.has(cb.dataset.spOn) ? spRM(calc.out.get(cb.dataset.spOn) / 100) : ''; });
      const s = docEl('spSum'); s.textContent = calc.msg; s.classList.toggle('bad', !calc.ok && !!docEl('spTotal').value);
    }

    WIRE.split = async function (pg) {
      if (!pg.dataset.spWired) {
        pg.dataset.spWired = '1';
        pg.addEventListener('click', async e => {
          if (e.target.closest('#spNew')) return spOpenForm(null);
          if (e.target.closest('#spUpgrade')) return openPlans();
          const fl = e.target.closest('[data-spf]'); if (fl) { SP.filter = fl.dataset.spf; return spPaint(); }
          const pay = e.target.closest('[data-sp-pay]');
          if (pay) { const [sid, uid, on] = pay.dataset.spPay.split('|'); pay.disabled = true; const { error } = await spDb().rpc('mark_split_paid', { p_split: sid, p_user: uid, p_paid: on === '1' }); if (error) { flashToast('Could not update', error.message, 'fa-triangle-exclamation', '#f87171'); } return spLoad(); }
          const nu = e.target.closest('[data-sp-nudge]');
          if (nu) { const [sid, uid] = nu.dataset.spNudge.split('|'); nu.disabled = true; const { data, error } = await spDb().rpc('nudge_split_member', { p_split: sid, p_user: uid }); nu.disabled = false; if (error) return flashToast('Could not remind', error.message, 'fa-triangle-exclamation', '#f87171'); return flashToast(data === 'sent' ? 'Reminder sent' : data === 'too_soon' ? 'Already reminded' : 'Nothing to remind', data === 'too_soon' ? 'You can remind again after 6 hours.' : '', 'fa-bell', '#a78bfa'); }
          const ed = e.target.closest('[data-sp-edit]'); if (ed) return spOpenForm(SP.list.find(s => s.id === ed.dataset.spEdit));
          const del = e.target.closest('[data-sp-del]');
          if (del) { const s = SP.list.find(x => x.id === del.dataset.spDel); if (!s || !await luConfirm({ title: `Delete “${s.title}”?`, message: 'Everyone in it is told, and your share is removed from Money. This can\'t be undone.' })) return; const { error } = await spDb().rpc('delete_split', { p_id: s.id }); if (error) return flashToast('Could not delete', error.message, 'fa-triangle-exclamation', '#f87171'); return spLoad(); }
          const tg = e.target.closest('[data-sp-toggle]'); if (tg) { const id = tg.dataset.spToggle; SP.open.has(id) ? SP.open.delete(id) : SP.open.add(id); spPaint(); }
        });
      }
      if (!window.__spFormWired) { window.__spFormWired = true; spWireForm(); }
      await spLoad();
    };
