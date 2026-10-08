// LUMA — module: assistant
      // ---------------- AI ASSISTANT (full chat) ----------------
    MODULES.assistant = function () {
        const mem = ['Add events, tasks and notes', 'Log sleep, water, steps and mood', 'Record expenses and income', 'Answer questions about your data'];
        const cmds = ['What should I focus on today?', 'How is my spending this month?', 'Add a task: pay rent, due Friday', 'Log 7 hours of sleep', 'Add dentist tomorrow 3pm'];
        const firstName = lumaName();
        return head('Lumi', 'Your personal assistant') +
          `<div style="display:grid;grid-template-columns:1fr 300px;gap:0.9rem;align-items:start">
          ${card(`<div id="chatScroll" class="chat-scroll"><div class="bubble ai">Hi ${firstName}! I can add events, tasks and notes, log your health and expenses, and answer questions about your LUMA data. I can't delete things or help with topics outside the app.</div></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:0.8rem">${cmds.slice(0, 3).map(c => `<span class="chat-chip suggestion-badge" style="font-size:0.62rem;padding:0.25rem 0.8rem;background:rgba(59,130,246,0.12);color:#93c5fd;border-color:rgba(59,130,246,0.25)">${c}</span>`).join('')}</div>
            <div class="lumi-left" style="font-size:0.7rem;color:rgba(255,255,255,0.6);text-align:right;margin-top:0.6rem">15 questions per day</div><div class="chat-input" style="margin-top:0.4rem"><input id="chatInput" placeholder="Message Lumi…" autocomplete="off"><button class="chat-send" id="chatSend"><i class="fa-solid fa-arrow-up"></i></button></div>`)}
          <div style="display:flex;flex-direction:column;gap:0.9rem">
            ${card(`<div class="section-title"><i class="fa-solid fa-brain"></i> What Lumi can do</div>${mem.map(m => `<div style="display:flex;gap:10px;align-items:center;font-size:0.75rem;color:rgba(255,255,255,0.8);padding:6px 0"><i class="fa-solid fa-check" style="color:#6ee7b7"></i> ${m}</div>`).join('')}`)}
            ${card(`<div class="section-title"><i class="fa-solid fa-terminal"></i> Quick commands</div>${cmds.slice(2).map(c => `<div class="chat-chip add-card" style="justify-content:flex-start;margin-bottom:0.5rem;font-size:0.72rem">${c}</div>`).join('')}`)}
          </div>
        </div>`;
    };

    // ----- Lumi: real assistant (Supabase Edge Function "lumi"; free-tier Gemini / Groq on the server) -----
    const LUMI_HIST = []; let lumiLeft = null, lumiLimit = 15, lumiBusy = false;
    async function lumiCall(body) {
      const now = new Intl.DateTimeFormat('en-GB', { timeZone: MYT, dateStyle: 'full', timeStyle: 'short' }).format(new Date());
      try {
        const { data, error } = await LumaAuth.client.functions.invoke('lumi', { body: { ...body, tz: MYT, today: hToday(), now } });
        if (error && error.context && error.context.status === 404) return { error: "Lumi isn't deployed on this environment yet. Run ./scripts/deploy-functions.sh (see the README, Lumi assistant)." };
        if (error) { try { return await error.context.json(); } catch (e) { return { error: /not found|404/i.test(error.message || '') ? "Lumi isn't deployed yet — see the README (Lumi assistant)." : 'Lumi could not be reached. Please try again.' }; } }
        return data || { error: 'No answer came back.' };
      } catch (e) { return { error: 'Lumi could not be reached. Please check your connection.' }; }
    }
    function lumiPaintLeft() {
      if (lumiLeft == null) lumiLimit = LumaPlan.get('lumi_questions') ?? lumiLimit;
      const known = lumiLeft != null, txt = known ? `${lumiLeft} of ${lumiLimit} questions left today` : `${lumiLimit} questions per day`;
      document.querySelectorAll('#chatPop .chat-pop-head .s').forEach(el => { el.innerHTML = `<span class="dot"></span> Online · ${txt}`; });
      document.querySelectorAll('.lumi-left').forEach(el => { el.textContent = txt; el.style.color = known && lumiLeft === 0 ? '#fca5a5' : known && lumiLeft <= 3 ? '#fcd34d' : 'rgba(255,255,255,0.7)'; });
    }
    async function lumiCheckLeft() { if (lumiLeft != null) return; const r = await lumiCall({ mode: 'chat', check: true }); if (r && r.left != null) { lumiLeft = r.left; lumiLimit = r.limit || 15; lumiPaintLeft(); } }
    // push(role, text) must return the bubble element
    async function lumiSend(text, push) {
      if (lumiBusy) return; lumiBusy = true;
      push('me', text); LUMI_HIST.push({ role: 'user', content: text });
      const bub = push('ai', 'Lumi is thinking…'); bub.style.opacity = '0.6';
      const r = await lumiCall({ mode: 'chat', messages: LUMI_HIST });
      bub.style.opacity = ''; bub.textContent = r.reply || r.error || 'Something went wrong.'; if (r.detail) console.warn('Lumi detail:', r.detail), bub.textContent += '\n(' + r.detail.slice(0, 600) + ')';
      if (r.reply) LUMI_HIST.push({ role: 'assistant', content: r.reply }); else LUMI_HIST.pop();
      if (LUMI_HIST.length > 12) LUMI_HIST.splice(0, LUMI_HIST.length - 12);
      if (r.left != null) { lumiLeft = r.left; lumiLimit = r.limit || lumiLimit; lumiPaintLeft(); }
      if (r.actions && r.actions.length) { // something was saved: refresh what's on screen
        if (document.getElementById('page-dashboard').classList.contains('active')) loadDashboard().catch(() => { });
        const act = document.querySelector('.page.active'); if (act && act.id !== 'page-dashboard' && act.id !== 'page-assistant') goTo(act.id.replace('page-', ''));
      }
      lumiBusy = false;
    }

    // ---------- Floating AI chat ----------
    const chatPop = document.getElementById('chatPop');
    const popBody = document.getElementById('popBody');
    const popInput = document.getElementById('popInput');
    function openChat() { chatPop.classList.add('open'); setTimeout(() => popInput.focus(), 100); lumiPaintLeft(); lumiCheckLeft(); }
    function closeChat() { chatPop.classList.remove('open'); }
    function toggleChat() { chatPop.classList.contains('open') ? closeChat() : openChat(); }
    function popPush(role, text) {
      const b = document.createElement('div'); b.className = 'bubble ' + role; b.textContent = text;
      popBody.appendChild(b); popBody.scrollTop = popBody.scrollHeight; return b;
    }
    function popSubmit(val) {
      const t = (val || popInput.value).trim(); if (!t) return;
      popInput.value = ''; lumiSend(t, popPush);
    }
    document.getElementById('fab').addEventListener('click', toggleChat);
    document.getElementById('chatClose').addEventListener('click', closeChat);
    document.getElementById('popSend').addEventListener('click', () => popSubmit());
    popInput.addEventListener('keydown', e => { if (e.key === 'Enter') popSubmit(); });
    document.querySelectorAll('#chatPop .chip').forEach(c => c.addEventListener('click', () => popSubmit(c.textContent.trim())));
  

      // AI assistant full chat
    WIRE.assistant = function (pg, key) {
        const scroll = pg.querySelector('#chatScroll');
        const input = pg.querySelector('#chatInput');
        const send = pg.querySelector('#chatSend');
        const push = (role, text) => {
          const b = document.createElement('div'); b.className = 'bubble ' + role; b.textContent = text;
          scroll.appendChild(b); scroll.scrollTop = scroll.scrollHeight; return b;
        };
        const submit = (val) => {
          const t = (val || input.value).trim(); if (!t) return;
          input.value = ''; lumiSend(t, (r, x) => { const b = push(r, x); scroll.scrollTop = scroll.scrollHeight; return b; });
        };
        lumiPaintLeft(); lumiCheckLeft();
        send.addEventListener('click', () => submit());
        input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
        pg.querySelectorAll('.chat-chip').forEach(c => c.addEventListener('click', () => submit(c.textContent.trim())));
    };
