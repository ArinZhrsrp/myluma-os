// LUMA — module: contacts
      // ---------------- CONTACTS ----------------
      // Real data — request/accept contacts + chat, backed by Supabase
      // (luma.contacts / luma.messages). See loadContactsData() for the
      // async fetch that populates this shell after it's rendered.
    MODULES.contacts = function () {
        return `<div class="page-head"><div><h1>Contacts</h1><p id="contactsSub">Loading…</p></div><div class="head-actions"><button class="create-btn" id="addContactBtn"><i class="fa-solid fa-user-plus"></i> Add contact</button></div></div>
        <div style="display:grid;grid-template-columns:1fr 320px;gap:0.9rem">
          <div style="display:flex;flex-direction:column;gap:0.9rem">
            ${card(`<div class="section-title"><i class="fa-solid fa-users"></i> All contacts</div><div id="contactsList"><div class="lu-empty">Loading…</div></div>`)}
            ${card(`<div class="section-title"><i class="fa-solid fa-user-clock"></i> Requests</div><div id="incomingRequests"><div class="lu-empty">Loading…</div></div><div id="outgoingRequests"></div>`)}
          </div>
          ${card(`<div class="section-title"><i class="fa-solid fa-robot"></i> Follow-ups</div><div id="contactsFollowups"><div class="lu-empty">Loading…</div></div>`)}
        </div>`;
    };

    // ---------- Nudge: ping a contact to read your message ----------
    const NUDGE_COOLDOWN_MS = 3 * 60 * 1000; // mirrors the server-side limit (migration 009)
    const nudging = new Set();                // contact ids with a nudge request in flight
    let pendingChatOpen = null;              // contact id to open once the Contacts page has loaded
    const nudgeKey = id => 'luma.nudge.' + (LUMA_USER ? LUMA_USER.id : '') + '.' + id; // per account, per contact
    const nudgeLeft = id => { try { return Math.max(0, NUDGE_COOLDOWN_MS - (Date.now() - Number(localStorage.getItem(nudgeKey(id)) || 0))); } catch (e) { return 0; } };
    const fmtLeft = ms => { const t = Math.ceil(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
    // while cooling down the button shows the time left (and a tooltip with it spelled out); it re-enables itself at 0
    function setNudgeBtn(btn, left) {
      const html = left > 0 ? `<i class="fa-solid fa-check"></i> Nudged · ${fmtLeft(left)}` : '<i class="fa-solid fa-bell"></i> Nudge';
      if (btn.innerHTML !== html) btn.innerHTML = html;
      btn.disabled = left > 0 || nudging.has(btn.dataset.nudge || activeChatContactId);
      btn.title = left > 0 ? `Nudge sent — you can nudge again in ${Math.floor(Math.ceil(left / 1000) / 60)} min ${Math.ceil(left / 1000) % 60} s` : 'Send a nudge notification';
    }
    function refreshNudgeButtons() {
      document.querySelectorAll('[data-nudge]').forEach(b => setNudgeBtn(b, nudgeLeft(b.dataset.nudge)));
      const cn = document.getElementById('chatNudge');
      if (cn && activeChatContactId) setNudgeBtn(cn, nudgeLeft(activeChatContactId));
    }

    async function nudgeContact(contactId, name, btn) {
      if (nudgeLeft(contactId) > 0 || nudging.has(contactId)) return;
      nudging.add(contactId); btn.disabled = true;
      const { data, error } = await LumaContacts.nudge(contactId);
      nudging.delete(contactId);
      if (error) {
        refreshNudgeButtons();
        return luAlert(/nudge_contact|schema cache/i.test(error.message) ? 'Nudges aren\'t set up yet — run supabase/migrations/009_nudges.sql in the SQL Editor.' : error.message);
      }
      if (data && data.ok) {
        try { localStorage.setItem(nudgeKey(contactId), String(Date.now())); } catch (e) { }
        btn.classList.add('ring'); setTimeout(() => btn.classList.remove('ring'), 700);
        refreshNudgeButtons();
        flashToast('Nudge sent', `${name} will get a notification to read your message.`, 'fa-bell', '#f59e0b');
      } else if (data && data.reason === 'too_soon') {
        try { localStorage.setItem(nudgeKey(contactId), String(Date.now() - (NUDGE_COOLDOWN_MS - data.retry_after * 1000))); } catch (e) { }
        refreshNudgeButtons();
        flashToast('Already nudged', `You nudged ${name} recently — you can nudge again in ${fmtLeft(data.retry_after * 1000)}.`, 'fa-hourglass-half', '#94a3b8');
      } else {
        refreshNudgeButtons(); luAlert('Couldn\'t send the nudge — is this contact still connected?');
      }
    }
    setInterval(() => { if (document.querySelector('[data-nudge]:disabled, #chatNudge:disabled')) refreshNudgeButtons(); }, 1000);
    document.getElementById('chatNudge').addEventListener('click', e => nudgeContact(activeChatContactId, chatNameEl.textContent, e.currentTarget));


    // ---------- Contacts: add-by-email + 1:1 chat (real, Supabase-backed) ----------

    const CONTACT_COLORS = ['#3b82f6', '#ec4899', '#22c55e', '#8b5cf6', '#f59e0b', '#38bdf8'];
    function colorForId(id) {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
      return CONTACT_COLORS[h % CONTACT_COLORS.length];
    }
    function contactDisplayName(row) {
      const name = [row.other_first_name, row.other_last_name].filter(Boolean).join(' ').trim();
      return name || row.other_email;
    }

    // ---- Add contact modal ----
    const acOverlay = document.getElementById('addContactOverlay');
    const acError = document.getElementById('acError');
    const acOk = document.getElementById('acOk');
    const acEmail = document.getElementById('acEmail');
    const acSend = document.getElementById('acSend');

    function acShowError(text) { acOk.style.display = 'none'; acError.textContent = text; acError.style.display = 'flex'; }
    function acShowOk(text) { acError.style.display = 'none'; acOk.textContent = text; acOk.style.display = 'flex'; }

    function openAddContactModal() {
      acError.style.display = 'none'; acOk.style.display = 'none';
      acEmail.value = ''; acSend.disabled = false; acSend.textContent = 'Send request';
      acOverlay.classList.add('open'); acEmail.focus();
    }
    function closeAddContactModal() { acOverlay.classList.remove('open'); }
    document.getElementById('acClose').addEventListener('click', closeAddContactModal);
    document.getElementById('acCancel').addEventListener('click', closeAddContactModal);
    acOverlay.addEventListener('click', (e) => { if (e.target === acOverlay) closeAddContactModal(); });

    const ADD_CONTACT_REASONS = {
      not_found: "No LUMA account found with that email.",
      self: "That's your own email — pick someone else.",
      already_pending: "There's already a pending request between you two — check Requests below.",
      already_accepted: "You're already connected with this person.",
    };

    acSend.addEventListener('click', async () => {
      const email = acEmail.value.trim();
      if (!email) return acShowError('Enter an email address.');
      acSend.disabled = true; acSend.textContent = 'Sending…';
      const { data, error } = await LumaContacts.requestByEmail(email);
      acSend.disabled = false; acSend.textContent = 'Send request';
      if (error && /^Plan limit/i.test(error.message)) return acShowError(error.message);
      if (error) return acShowError("Couldn't send that request: " + error.message + " (has supabase/migrations/001_profiles_contacts_chat.sql been run and the luma schema exposed?)");
      if (!data || !data.ok) return acShowError(ADD_CONTACT_REASONS[data && data.reason] || "Couldn't send that request.");
      acShowOk('Request sent — waiting for them to accept.');
      loadContactsData();
      setTimeout(closeAddContactModal, 1200);
    });

    // ---- Contact chat modal ----
    const chatOverlay = document.getElementById('contactChatOverlay');
    const chatScrollEl = document.getElementById('contactChatScroll');
    const chatInputEl = document.getElementById('contactChatInput');
    const chatSendBtn = document.getElementById('contactChatSend');
    const chatAvatarEl = document.getElementById('chatAvatar');
    const chatNameEl = document.getElementById('chatContactName');
    let activeChatContactId = null;
    let activeChatChannel = null;

    function pushContactBubble(role, text) {
      const b = document.createElement('div');
      b.className = 'bubble ' + role;
      b.textContent = text; // textContent, not innerHTML — messages are untrusted user input
      chatScrollEl.appendChild(b);
      chatScrollEl.scrollTop = chatScrollEl.scrollHeight;
    }
    // the chat opens on the latest 20 messages; scrolling to the top loads 20 more
    const CHAT_PAGE = 20;
    let chatOldest = null, chatHasMore = false, chatLoadingMore = false;
    const chatTopNote = () => { let n = chatScrollEl.querySelector('.chat-top'); if (!n) { n = document.createElement('div'); n.className = 'chat-top'; n.style.cssText = 'text-align:center;font-size:0.68rem;color:rgba(255,255,255,0.45);padding:4px 0 10px'; chatScrollEl.prepend(n); } return n; };
    function paintChatTop() { const n = chatTopNote(); n.textContent = chatLoadingMore ? 'Loading earlier messages…' : chatHasMore ? 'Scroll up for earlier messages' : ''; n.style.display = n.textContent ? '' : 'none'; }
    async function loadEarlierChat() {
      if (chatLoadingMore || !chatHasMore || !activeChatContactId) return;
      const id = activeChatContactId; chatLoadingMore = true; paintChatTop();
      const { data, error } = await LumaContacts.listMessages(id, { limit: CHAT_PAGE, before: chatOldest });
      if (id !== activeChatContactId) return; // the chat was closed or switched meanwhile
      chatLoadingMore = false;
      if (error || !data) { paintChatTop(); return; }
      const keep = chatScrollEl.scrollHeight, top = chatTopNote();
      const frag = document.createDocumentFragment();
      data.forEach(m => { const b = document.createElement('div'); b.className = 'bubble ' + (m.sender_id === LUMA_USER.id ? 'me' : 'ai'); b.textContent = m.body; frag.appendChild(b); });
      top.after(frag); // oldest first, right under the "scroll up" note
      if (data.length) chatOldest = data[0].created_at;
      chatHasMore = data.length === CHAT_PAGE;
      paintChatTop();
      chatScrollEl.scrollTop = chatScrollEl.scrollHeight - keep; // stay on the message you were reading
    }
    chatScrollEl.addEventListener('scroll', () => { if (chatScrollEl.scrollTop < 40) loadEarlierChat(); });

    async function openContactChat(contactId, name, color) {
      paintChatLeft();
      closeContactChat();
      activeChatContactId = contactId;
      chatNameEl.textContent = name;
      chatAvatarEl.textContent = (name || '?').charAt(0).toUpperCase();
      chatAvatarEl.style.background = color;
      chatScrollEl.innerHTML = '';
      chatOverlay.classList.add('open');
      refreshNudgeButtons();
      chatInputEl.value = '';
      chatInputEl.focus();

      chatOldest = null; chatHasMore = false; chatLoadingMore = false;
      const { data, error } = await LumaContacts.listMessages(contactId, { limit: CHAT_PAGE });
      if (!error && data) {
        data.forEach(m => pushContactBubble(m.sender_id === LUMA_USER.id ? 'me' : 'ai', m.body));
        if (data.length) chatOldest = data[0].created_at;
        chatHasMore = data.length === CHAT_PAGE; paintChatTop();
        chatScrollEl.scrollTop = chatScrollEl.scrollHeight; // start at the latest message
      } else if (error) pushContactBubble('ai', "Couldn't load message history: " + error.message);

      // Opening the chat counts as reading whatever was unread — clears the
      // "New message" nudge in Follow-ups for this contact.
      LumaContacts.markRead(contactId).then(() => loadContactsData());
      markChatNotifsRead(contactId);

      activeChatChannel = LumaContacts.subscribeToMessages(contactId, (msg) => {
        if (msg.sender_id !== LUMA_USER.id) {
          pushContactBubble('ai', msg.body);
          LumaContacts.markRead(contactId);
        }
      });
    }

    function closeContactChat() {
      chatOverlay.classList.remove('open');
      if (activeChatChannel) { LumaContacts.unsubscribe(activeChatChannel); activeChatChannel = null; }
      activeChatContactId = null;
    }

    async function sendContactChatMessage() {
      const text = chatInputEl.value.trim();
      if (!text || !activeChatContactId) return;
      chatInputEl.value = '';
      pushContactBubble('me', text);
      const { error } = await LumaContacts.sendMessage(activeChatContactId, text);
      if (error) pushContactBubble('ai', /^Daily limit/i.test(error.message) ? error.message : "Couldn't send that — " + error.message);
      paintChatLeft();
    }
    // "N messages left today" under the chat box (the limit is 50 a day on every plan)
    async function paintChatLeft() {
      const el = document.getElementById('chatLeft'); if (!el) return;
      const { data, error } = await LumaAuth.client.schema('luma').rpc('chat_left_today'); if (error || data === null || data === undefined) return;
      el.textContent = data === 0 ? "You've used all of today's messages. It resets at midnight." : `${data} message${data === 1 ? '' : 's'} left today`;
      el.style.color = data === 0 ? '#fca5a5' : data <= 10 ? '#fcd34d' : 'rgba(255,255,255,0.6)';
    }
    chatSendBtn.addEventListener('click', sendContactChatMessage);
    chatInputEl.addEventListener('keydown', e => { if (e.key === 'Enter') sendContactChatMessage(); });
    document.getElementById('contactChatClose').addEventListener('click', closeContactChat);
    chatOverlay.addEventListener('click', (e) => { if (e.target === chatOverlay) closeContactChat(); });

    // ---- Contacts page data (accepted / requests / follow-ups) ----
    async function loadContactsData() {
      const list = document.getElementById('contactsList');
      if (!list) return; // not on the Contacts page (shouldn't happen, called right after render)

      const { data, error } = await LumaContacts.listContacts();
      if (error) {
        list.innerHTML = `<div class="lu-empty">Couldn't load contacts: ${escapeHtml(error.message)} (has supabase/migrations/001_profiles_contacts_chat.sql been run and the luma schema exposed?)</div>`;
        return;
      }

      const rows = data || [];
      const accepted = rows.filter(r => r.status === 'accepted');
      const incoming = rows.filter(r => r.status === 'pending' && r.direction === 'incoming');
      const outgoing = rows.filter(r => r.status === 'pending' && r.direction === 'outgoing');
      const followups = accepted
        .filter(r => LumaContacts.hasUnread(r) || LumaContacts.needsFollowUp(r))
        .sort((a, b) => (LumaContacts.hasUnread(b) ? 1 : 0) - (LumaContacts.hasUnread(a) ? 1 : 0));

      const sub = document.getElementById('contactsSub');
      if (sub) sub.textContent = `${accepted.length} people · ${followups.length} follow-up${followups.length === 1 ? '' : 's'} due`;

      list.innerHTML = accepted.length ? accepted.map(r => {
        const name = contactDisplayName(r), color = colorForId(r.other_id);
        return `<div class="lrow" data-contact-id="${r.contact_id}" data-name="${escapeHtml(name)}" data-color="${color}">
          <div class="licon" style="border-radius:50%;background:${color};color:#fff;font-weight:600">${escapeHtml(name.charAt(0).toUpperCase())}</div>
          <div class="lmain"><div class="lt">${escapeHtml(name)}</div><div class="ls">${escapeHtml(r.other_email)}</div></div>
          <div class="c-actions" style="display:flex;align-items:center;gap:14px"><button type="button" class="nudge-btn" data-nudge="${r.contact_id}" title="Send ${escapeHtml(name)} a nudge notification"><i class="fa-solid fa-bell"></i> Nudge</button>${LumaContacts.hasUnread(r) ? '<span class="pill pill-blue">New message</span>' : (LumaContacts.needsFollowUp(r) ? '<span class="pill pill-med">Follow up</span>' : '')}<span class="ls c-time">${r.last_message_at ? escapeHtml(LumaContacts.relativeTime(r.last_message_at)) : 'No chats yet'}</span><button type="button" class="nudge-btn msg-btn" data-chat title="Open chat with ${escapeHtml(name)}"><i class="fa-regular fa-comment"></i> Message</button></div>
        </div>`;
      }).join('') : `<div class="lu-empty">No contacts yet — add someone by email to get started.</div>`;
      // each action is its own button now (Message / Nudge); the row itself isn't a click target
      list.querySelectorAll('[data-chat]').forEach(b => b.addEventListener('click', () => {
        const row = b.closest('.lrow'); openContactChat(row.dataset.contactId, row.dataset.name, row.dataset.color);
      }));
      list.querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click', () => {
        nudgeContact(b.dataset.nudge, b.closest('.lrow').dataset.name, b);
      }));
      refreshNudgeButtons();
      // arrived via a nudge notification: open that chat straight away
      if (pendingChatOpen) {
        const target = list.querySelector(`.lrow[data-contact-id="${pendingChatOpen}"]`); pendingChatOpen = null;
        if (target) openContactChat(target.dataset.contactId, target.dataset.name, target.dataset.color);
      }

      const incomingEl = document.getElementById('incomingRequests');
      incomingEl.innerHTML = incoming.length ? incoming.map(r => {
        const name = contactDisplayName(r), color = colorForId(r.other_id);
        return `<div class="lrow"><div class="licon" style="border-radius:50%;background:${color};color:#fff;font-weight:600">${escapeHtml(name.charAt(0).toUpperCase())}</div><div class="lmain"><div class="lt">${escapeHtml(name)}</div><div class="ls">Wants to connect</div></div><div style="display:flex;gap:8px"><button class="pill pill-btn pill-low" data-accept="${r.contact_id}" style="cursor:pointer;border:none">Accept</button><button class="pill pill-btn pill-high" data-decline="${r.contact_id}" style="cursor:pointer;border:none">Decline</button></div></div>`;
      }).join('') : `<div class="lu-empty">No incoming requests.</div>`;
      incomingEl.querySelectorAll('[data-accept]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; await LumaContacts.acceptRequest(b.dataset.accept); loadContactsData(); }));
      incomingEl.querySelectorAll('[data-decline]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; await LumaContacts.declineRequest(b.dataset.decline); loadContactsData(); }));

      const outgoingEl = document.getElementById('outgoingRequests');
      outgoingEl.innerHTML = outgoing.length ? outgoing.map(r => {
        const name = contactDisplayName(r);
        return `<div class="lrow"><div class="licon" style="border-radius:50%;background:rgba(255,255,255,0.08);color:#fff;font-weight:600">${escapeHtml(name.charAt(0).toUpperCase())}</div><div class="lmain"><div class="lt">${escapeHtml(name)}</div><div class="ls">Request sent</div></div><div style="display:flex;align-items:center;gap:10px"><span class="pill pill-btn pill-med">Pending</span><button class="pill pill-btn" data-cancel="${r.contact_id}" style="cursor:pointer;border:none;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.6)">Cancel</button></div></div>`;
      }).join('') : `<div class="lu-empty">No outgoing requests.</div>`;
      outgoingEl.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; await LumaContacts.removeContact(b.dataset.cancel); loadContactsData(); }));

      const fu = document.getElementById('contactsFollowups');
      fu.innerHTML = followups.length ? followups.map(r => {
        const name = contactDisplayName(r), color = colorForId(r.other_id);
        const unread = LumaContacts.hasUnread(r);
        const copy = unread
          ? `${name.split(' ')[0]} sent a new message you haven't read yet.`
          : r.last_message_at
            ? `It's been ${LumaContacts.relativeTime(r.last_message_at)} — you usually check in around now.`
            : `You haven't messaged yet — say hi to break the ice.`;
        return `<div class="followup-card" data-contact-id="${r.contact_id}" data-name="${escapeHtml(name)}" data-color="${color}" style="cursor:pointer;padding:13px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid ${unread ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)'};margin-bottom:10px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:30px;height:30px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:0.75rem;flex-shrink:0">${escapeHtml(name.charAt(0).toUpperCase())}</div><span class="lt">${escapeHtml(name)}</span>${unread ? '<span class="pill pill-blue" style="margin-left:auto">New</span>' : ''}</div><div class="ls">${escapeHtml(copy)}</div></div>`;
      }).join('') : `<div class="lu-empty">Nothing needs a follow-up right now.</div>`;
      fu.querySelectorAll('.followup-card[data-contact-id]').forEach(card => {
        card.addEventListener('click', () => openContactChat(card.dataset.contactId, card.dataset.name, card.dataset.color));
      });
    }


      // Contacts — add-by-email + requests + chat (fresh DOM every visit,
      // so it's always safe to re-wire; the static modals are wired once
      // at top level instead, see openAddContactModal/openContactChat)
    WIRE.contacts = function (pg, key) {
        pg.querySelector('#addContactBtn')?.addEventListener('click', openAddContactModal);
        loadContactsData();
    };
