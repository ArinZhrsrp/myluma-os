// LUMA — core: plans
    // ----- Plans popup (a preview for now: nothing is enforced or sold yet) -----
    // true (and an upgrade prompt) when adding one more would go over the plan's limit — the database enforces it too
    function planBlocked(key, count, what) {
      const lim = LumaPlan.get(key);
      if (lim === null || count < lim) return false;
      luConfirm({ title: 'Plan limit reached', message: `Your ${LumaPlan.name()} plan includes up to ${lim} ${what}. Upgrade to add more.`, ok: 'See plans', icon: 'fa-lock', tone: 'info' }).then(ok => { if (ok) openPlans(); });
      return true;
    }
    function planLocked(feature, need) { // for features a lower plan doesn't have
      luConfirm({ title: 'Not in your plan', message: `${feature} is available on ${need}. Want to see the plans?`, ok: 'See plans', icon: 'fa-lock', tone: 'info' }).then(ok => { if (ok) openPlans(); });
    }
    const PLANS = [
      { id: 'dawn', name: 'Dawn', icon: 'fa-seedling', color: '#34d399', tag: 'Start here', price: 'Free forever', rank: 0, perks: ['Lumi: 3 questions a day (answers only)', '50 MB of file storage (5 MB per file)', '5 custom reminders', '5 habits, 3 goals, 5 bills', '3 contacts', 'Core calendar, tasks, notes, money and health', '4 wallpapers, 1 theme', 'Chat with contacts: up to 50 messages a day'] },
      { id: 'glow', name: 'Glow', icon: 'fa-sun', color: '#fbbf24', tag: 'The full toolkit', price: 'RM9 / month', rank: 1, perks: ['Lumi: 10 questions a day, and it can add things for you', '3 AI insights a day in Analytics', '300 MB of file storage (20 MB per file)', '25 custom reminders', '10 habits, 5 goals, 12 bills', '12 contacts', 'Adjustable reminder times', 'Malaysian payroll calculator', '8 wallpapers and all 3 themes', 'Chat with contacts: up to 50 messages a day'] },
      { id: 'zenith', name: 'Zenith', icon: 'fa-rocket', color: '#a78bfa', tag: 'No limits', price: 'RM19 / month', rank: 2, perks: ['Lumi: 15 questions a day, and it can add things for you', '10 AI insights a day in Analytics', '1 GB of file storage (50 MB per file)', 'Unlimited reminders, habits, goals, bills and contacts', 'Everything in Glow', 'All 11 wallpapers, and upload your own', 'Early access to new features', 'Chat with contacts: up to 50 messages a day'] },
    ];
    let planFirst = false, planResolve = null; // planFirst: the welcome version shown once after the first login
    function openPlans(first) {
      planFirst = first === true;
      const cur = PLANS.find(p => p.id === LumaPlan.plan) || PLANS[0];
      docEl('planTitle').textContent = planFirst ? 'Welcome to LUMA! Pick your plan' : 'Plans';
      docEl('planNote').innerHTML = planFirst ? 'You start on <b>Dawn</b>, free forever. Want more? Tap a plan to upgrade. We\'ll open WhatsApp with your details filled in. Not now? You can always upgrade later from Settings.' : 'To upgrade, tap a plan. We\'ll open WhatsApp with your name, email, plan and price filled in.';
      docEl('planGrid').innerHTML = PLANS.map(p => `<div class="plan-card ${p.id === cur.id ? 'cur' : ''}" style="--pc:${p.color}">
        ${p.id === cur.id ? '<span class="pb">Your plan</span>' : ''}
        <div class="pn"><span class="pi"><i class="fa-solid ${p.icon}"></i></span>${p.name}</div><div class="pt">${p.tag}</div><div class="pp">${p.price}</div>
        <ul>${p.perks.map(x => `<li><i class="fa-solid fa-check"></i><span>${x}</span></li>`).join('')}</ul>
        ${p.rank > cur.rank ? `<button type="button" class="pbtn up" data-up="${p.id}"><i class="fa-brands fa-whatsapp"></i> Upgrade to ${p.name}</button>` : p.id === cur.id ? (planFirst ? `<button type="button" class="pbtn" data-stay>Stay on ${p.name}</button>` : '<button type="button" class="pbtn" disabled>Current plan</button>') : '<button type="button" class="pbtn" disabled>Included</button>'}</div>`).join('');
      paintPlanAddons();
      docEl('planOverlay').classList.add('open');
      docEl('planOverlay').querySelectorAll('.pem-body, .profile-edit-modal').forEach(el => { el.scrollTop = 0; });
    }
    // Work / Study add-ons under the plans (not on the very first login, which is only about the plan)
    function paintPlanAddons() {
      const box = docEl('planAddons');
      if (planFirst || typeof ADDONS === 'undefined') { box.style.display = 'none'; box.innerHTML = ''; return; }
      const when = iso => new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
      box.style.display = '';
      box.innerHTML = `<div class="pa-head"><div class="pa-t">Add-ons</div><div class="ls">Work and Study go on top of any plan.</div></div><div class="pa-grid">` + Object.keys(ADDONS).map(k => {
        const a = ADDONS[k], on = LumaPlan.hasAddon(k), info = LumaPlan.addonInfo[k] || {};
        const status = on ? (info.source === 'trial' && info.expires_at ? `Trial until ${when(info.expires_at)}` : info.expires_at ? `Active until ${when(info.expires_at)}` : 'Active') : a.price;
        return `<div class="plan-card ${on ? 'cur' : ''}" style="--pc:${a.color}">
          ${on ? '<span class="pb">Active</span>' : ''}
          <div class="pn"><span class="pi"><i class="fa-solid ${a.icon}"></i></span>${a.name}</div><div class="pt">${a.tag}</div><div class="pp">${status}</div>
          <ul>${a.perks.slice(0, 3).map(x => `<li><i class="fa-solid fa-check"></i><span>${x}</span></li>`).join('')}</ul>
          ${on ? `<button type="button" class="pbtn" data-addon="${k}" data-open style="cursor:pointer">Open ${a.name} mode</button>` : `<button type="button" class="pbtn up" data-addon-buy="${k}"><i class="fa-brands fa-whatsapp"></i> Get ${a.name}</button><button type="button" class="pbtn" data-addon="${k}" style="cursor:pointer">See what's included</button>`}
        </div>`;
      }).join('') + (!LumaPlan.hasAddon('work') && !LumaPlan.hasAddon('study') ? `<div class="plan-card ad-bundle" style="--pc:#34d399"><span class="pb">${ADDON_BUNDLE.save}</span><div class="pn"><span class="pi"><i class="fa-solid fa-layer-group"></i></span>${ADDON_BUNDLE.name}</div><div class="pt">Both add-ons together</div><div class="pp">${ADDON_BUNDLE.price}</div><button type="button" class="pbtn up" data-addon-buy="both"><i class="fa-brands fa-whatsapp"></i> Get both</button></div>` : '') + '</div>';
    }
    // opens WhatsApp with the person's details and the plan they picked already typed in
    function requestUpgrade(planId) {
      const p = PLANS.find(x => x.id === planId); if (!p) return;
      const num = String(window.LUMA_WHATSAPP || '').replace(/\D/g, '');
      if (!num) return luAlert('The upgrade WhatsApp number isn\'t set up yet. Please email aeinscape@gmail.com to upgrade.', 'Almost there');
      const msg = `Hi LUMA! I'd like to upgrade my plan.\n\nName: ${lumaFullName()}\nEmail: ${lumaEmail()}\nCurrent plan: ${LumaPlan.name()}\nUpgrade to: ${p.name}\nPrice: ${p.price}`;
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
      closePlans();
    }
    const closePlans = () => { docEl('planOverlay').classList.remove('open'); if (planResolve) { const r = planResolve; planResolve = null; r(); } };
    docEl('planClose').onclick = closePlans;
    docEl('planOverlay').onclick = e => {
      if (e.target === docEl('planOverlay')) return closePlans();
      const up = e.target.closest('[data-up]'); if (up) return requestUpgrade(up.dataset.up);
      const buy = e.target.closest('[data-addon-buy]'); if (buy) { closePlans(); return requestAddon(buy.dataset.addonBuy); }
      const ad = e.target.closest('[data-addon]'); if (ad) { if (ad.hasAttribute('data-open')) { closePlans(); return switchMode(ad.dataset.addon); } return openAddon(ad.dataset.addon); }
      if (e.target.closest('[data-stay]')) closePlans();
    };
    // first login on the free plan: offer the upgrade once; whatever they choose, never show it again
    function maybePromptPlan() {
      return new Promise(resolve => {
        try {
          const prefs = (LUMA_PROFILE && LUMA_PROFILE.preferences) || {};
          if (prefs.plan_prompted || LumaPlan.plan !== 'dawn' || !LumaPlan.ready) return resolve();
          setLumaPref('plan_prompted', true);
          planResolve = resolve; openPlans(true);
        } catch (e) { resolve(); }
      });
    }
