// LUMA — module: settings
      // ---------------- SETTINGS ----------------
    MODULES.settings = function () {
        const savedPrefs = (LUMA_PROFILE && LUMA_PROFILE.preferences) || {};
        const prefs = [['focus', 'Focus mode', 'Only urgent reminders get through. Chat messages and nudges stay quiet.', false], ['notif', 'Notifications', 'Checking this device…', true], ['ai', 'Proactive AI suggestions', 'Show Lumi\'s suggestion and daily tips on your dashboard', true], ['weekly', 'Weekly review', 'A summary of your week every Sunday at 6 pm', true], ['sounds', 'Interface sounds', 'Soft sounds when you tap, tick and get notified', false], ['busy_alerts', 'Busy-day alerts', 'Colour a busy day amber and a packed day red, and warn you on the Dashboard, Work, Study and Calendar before it arrives.', true], ['busy_push', 'Tell me the evening before', 'At 6 pm you get a notification when tomorrow is busy or packed. Needs Busy-day alerts to be on.', true], ...(LumaPlan.hasAddon('work') ? [['show_work_personal', 'Show Work in Personal', 'What you create in Work mode (reminders, events, documents…) also appears while you are in Personal mode. Turn it off and it is gone from Personal again.', false]] : []), ...(LumaPlan.hasAddon('study') ? [['show_study_personal', 'Show Study in Personal', 'What you create in Study mode (reminders, classes, assignments, notes…) also appears while you are in Personal mode. Turn it off and it is gone from Personal again.', false]] : [])];
        const hourOpts = REM_HOURS.map(h => `<option value="${h}">${fmt12(String(h).padStart(2, '0') + ':00')}</option>`).join('');
        const dayOpts = [1, 2, 3, 5, 7].map(d => `<option value="${d}">${d} day${d > 1 ? 's' : ''} before</option>`).join('');
        const fld = (label, key, opts) => `<label class="rp-f"><span>${label}</span><select data-rem="${key}">${opts}</select></label>`;
        const remCard = (key, icon, color, title, desc, fields) => `<div class="rp-card ${fields ? '' : 'rp-slim'}"><div class="rp-top"><div class="rp-ico" style="--c:${color}"><i class="fa-solid ${icon}"></i></div><div class="rp-t"><div class="a">${title}</div><div class="b">${desc}</div></div><button type="button" class="switch" data-rem="${key}"><span class="knob"></span></button></div>${fields ? `<div class="rp-ctl">${fields}</div>` : ''}</div>`;
        return head('Settings', 'Preferences, theme and integrations') +
          `<div id="setRoot"><div class="card full-width" style="margin-bottom:0.9rem">
          <div class="section-title"><i class="fa-regular fa-image"></i> Background <button type="button" class="create-btn ${LumaPlan.has('own_wallpaper') ? '' : 'plan-lock'}" id="bgUpload" style="margin-left:auto;padding:7px 13px;font-size:0.72rem;background:rgba(255,255,255,0.08);box-shadow:none"><i class="fa-solid fa-arrow-up-from-bracket"></i> Upload your own</button></div>
          <p class="ls" style="margin-bottom:0.9rem">Choose a wallpaper, or upload your own picture (it stays with your account).</p>
          <div class="bg-grid" id="bgGrid">
            ${savedPrefs.custom_bg_path ? `<div class="bg-thumb" id="bgCustom" data-bg="storage:${savedPrefs.custom_bg_path}" title="Your uploaded picture" style="background-color:rgba(255,255,255,0.08)"></div>` : ''}
            ${BGS.map((b, i) => `<div class="bg-thumb ${i >= (LumaPlan.get('wallpapers') ?? 99) ? 'plan-lock' : ''}" data-bg="${b.url}" style="background-image:url('${b.thumb}')" title="${b.name}${i >= (LumaPlan.get('wallpapers') ?? 99) ? ' · upgrade to unlock' : ''}"></div>`).join('')}
          </div>
          <input type="file" id="bgFile" accept="image/*" style="display:none">
        </div>
        <div class="grid-2">
          ${card(`<div class="section-title"><i class="fa-solid fa-user"></i> Profile</div><div style="display:flex;align-items:center;gap:16px"><div id="profAvatar" style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#3b82f6);display:grid;place-items:center;color:#fff;font-size:1.4rem;font-weight:600">${lumaInitial()}</div><div style="flex:1">
            <div id="profNameView" style="font-size:1rem;font-weight:600;color:#fff">${lumaFullName()}</div>
            <div class="ls" id="profEmailView">${lumaEmail()}</div>
              <button type="button" class="pill pill-violet" data-addon-pill title="See your plan and add-ons" style="margin-top:8px;border:none;cursor:pointer;font-family:inherit"><i class="fa-solid fa-sun" style="font-size:0.6rem"></i> ${LumaPlan.name()} plan</button>
              ${['work', 'study'].filter(k => LumaPlan.hasAddon(k)).map(k => { const inf = LumaPlan.addonInfo[k] || {}, a = ADDONS[k], d = LumaPlan.daysTo(inf.expires_at); return `<button type="button" class="pill pill-addon" data-addon-pill title="${a.name} add-on · see your plan and add-ons" style="--ac:${a.color};${d !== null && d <= 7 ? 'outline:1px solid #fca5a5;' : ''}"><i class="fa-solid ${a.icon}" style="font-size:0.6rem"></i> ${k === 'work' ? LumaPlan.addonName('work') : a.name} add-on${inf.source === 'trial' ? ' (trial)' : ''}</button>`; }).join('')}</div><div style="display:flex;flex-direction:column;gap:8px"><button id="profEditBtn" class="create-btn" style="background:rgba(255,255,255,0.06);box-shadow:none;justify-content:center">Edit</button><button id="logoutBtn" class="create-btn" style="background:rgba(239,68,68,0.35);color:#fff;border:1px solid rgba(248,113,113,0.7);box-shadow:none;justify-content:center">Log out</button></div></div>`)}
          ${card(`<div class="section-title"><i class="fa-solid fa-palette"></i> Theme</div><div style="display:flex;gap:12px" id="themeGrid">${[['Slate', '#64748b', 'slate'], ['Midnight Navy', '#0f172a', 'midnight'], ['Obsidian', '#030408', 'obsidian']].map(t => `<div class="theme-opt ${['midnight', 'slate', 'obsidian'].indexOf(t[2]) >= (LumaPlan.get('themes') ?? 99) ? 'plan-lock' : ''}" data-theme="${t[2]}" data-swatch="${t[1]}" style="flex:1;padding:12px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);text-align:center;cursor:pointer"><div style="height:44px;border-radius:10px;background:${t[1]};border:1px solid rgba(255,255,255,0.08);margin-bottom:9px"></div><span style="font-size:0.7rem;color:#fff">${t[0]}</span></div>`).join('')}</div>`)}
          ${card(`<div class="section-title"><i class="fa-solid fa-sliders"></i> Preferences</div><div class="pem-msg error" id="setPushError"></div>${prefs.map(p => `<div class="setting-row"><div class="sr-main"><div class="sr-t">${p[1]}</div><div class="sr-s" ${p[0] === 'notif' ? 'id="setNotifSub"' : ''}>${p[2]}</div></div><button class="switch ${p[0] === 'notif' ? '' : (savedPrefs[p[0]] ?? p[3]) ? 'on' : ''}" ${p[0] === 'notif' ? 'id="setNotifSwitch" data-push="1"' : `data-key="${p[0]}"`}><span class="knob"></span></button></div>`).join('')}${(() => { const lv = savedPrefs.busy_level || 'normal'; return `<div class="setting-row"><div class="sr-main"><div class="sr-t">How easily a day counts as busy</div><div class="sr-s" id="busyLvHint"></div></div><select class="np-btn" id="busyLevel" style="min-width:130px">${[['sensitive', 'Sensitive'], ['normal', 'Normal'], ['relaxed', 'Relaxed']].map(o => `<option value="${o[0]}" ${o[0] === lv ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>`; })()}`)}
          ${card(`<div class="section-title"><i class="fa-solid fa-shield-halved"></i> Account &amp; data</div><div class="pem-msg error" id="acctError"></div><div class="pem-msg ok" id="acctOk"></div>
            <div class="setting-row" id="installRow"><div class="sr-main"><div class="sr-t">Install LUMA</div><div class="sr-s" id="installSub"></div></div><button type="button" class="np-btn" id="installBtn"><i class="fa-solid fa-mobile-screen-button"></i> Install</button></div>
            <div class="setting-row"><div class="sr-main"><div class="sr-t">Change password</div><div class="sr-s">We'll email you a link to set a new one</div></div><button type="button" class="np-btn" id="acctPw">Send link</button></div>
            <div class="setting-row"><div class="sr-main"><div class="sr-t">Export my data</div><div class="sr-s">Download your tasks, events, notes, habits, goals, bills, money, reminders and study data as a file</div></div><button type="button" class="np-btn" id="acctExport">Export</button></div>
            <div class="setting-row"><div class="sr-main"><div class="sr-t">Sign out other devices</div><div class="sr-s">Log out everywhere except this device</div></div><button type="button" class="np-btn" id="acctOthers">Sign out</button></div>
            <div class="setting-row"><div class="sr-main"><div class="sr-t" style="color:#fca5a5">Delete my account</div><div class="sr-s">Permanently remove your account and everything in it</div></div><button type="button" class="np-btn acct-del" id="acctDelete"><i class="fa-regular fa-trash-can"></i> Delete…</button></div>`)}
        </div>
        <div class="card full-width" style="margin-top:0.9rem" id="planCard">
          <div class="section-title"><i class="fa-solid fa-crown"></i> Your plan and add-ons</div>
          <div id="pcGifts">${settingsGiftsHtml()}</div>
          ${(() => {
            const fmt = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const end = iso => { if (!iso) return '<span class="pc-end">No end date</span>'; const d = LumaPlan.daysTo(iso); return `<span class="pc-end ${d <= 7 ? 'soon' : ''}"><i class="fa-regular fa-clock"></i> ${d < 0 ? 'Ended ' + fmt(iso) : 'Last day: ' + fmt(new Date(Date.parse(iso) - 1000).toISOString()) + (d === 0 ? ' (today)' : ` · ${d} day${d === 1 ? '' : 's'} left`)}</span>`; };
            const row = (icon, color, name, right, status, btn, key) => `<div class="pc-row" ${key ? 'data-pc="' + key + '"' : ''}><div class="rp-ico" style="--c:${color}"><i class="fa-solid ${icon}"></i></div><div class="pc-main"><div class="pc-name">${name}</div>${status}</div>${btn || ''}</div>`;
            const plan = LumaPlan.plan, paid = plan !== 'dawn';
            const wpr = k => k === 'work' ? WORK_SIZES : null;
            const addon = k => { const a = ADDONS[k], on = LumaPlan.hasAddon(k), info = LumaPlan.addonInfo[k] || {}, tier = k === 'work' ? LumaPlan.workTier() : '', sz = wpr(k), nm = k === 'work' && on ? LumaPlan.addonName('work') : a.name;
              const buy = (key, label) => `<button type="button" class="np-btn" data-pc-buy="${key}"><i class="fa-brands fa-whatsapp"></i> ${label}</button>`;
              const btns = on ? (info.expires_at ? `<button type="button" class="np-btn" data-pc-renew="addon:${k}${k === 'work' ? ':' + tier : ''}"><i class="fa-brands fa-whatsapp"></i> Renew${k === 'work' ? ' ' + nm : ''}</button>` : '') + (k === 'work' && info.expires_at && tier === 'pro' ? `<button type="button" class="np-btn" data-pc-renew="addon:work:standard"><i class="fa-brands fa-whatsapp"></i> Renew as Work instead</button>` : '') + (k === 'work' && tier === 'standard' ? buy('workpro', 'Upgrade to Work Pro') : '')
                : (k === 'work' ? buy('work', `Get Work · ${sz.standard.price}`) + buy('workpro', `Get Work Pro · ${sz.pro.price}`) : buy(k, 'Get ' + a.name));
              return row(a.icon, a.color, `${nm} add-on${info.source === 'trial' && on ? ' <em>free trial</em>' : ''}`, '', on ? end(info.expires_at) : `<span class="pc-end off">Not switched on${k === 'work' ? '' : ' · ' + a.price}</span>`, `<div class="pc-btns" style="display:flex;flex-direction:column;gap:8px;align-items:stretch">${btns}</div>`, k); };
            return row(paid ? 'fa-sun' : 'fa-seedling', paid ? '#fbbf24' : '#34d399', `${LumaPlan.name()} plan`, '', paid ? end(LumaPlan.planExpires) : '<span class="pc-end off">Free forever</span>', paid ? (LumaPlan.planExpires ? '<button type="button" class="np-btn" data-pc-renew="plan:' + plan + '"><i class="fa-brands fa-whatsapp"></i> Renew</button>' : '') : '<button type="button" class="np-btn" data-pc-plans>See plans</button>', 'plan') + addon('work') + addon('study');
          })()}
          <p class="ls" style="margin-top:0.7rem;font-size:0.7rem;line-height:1.5">Plans and add-ons are monthly. The last day is the last day you can use it; after that you go back to the free Dawn plan (or the add-on switches off) and everything you made is kept. We remind you 7 days and 1 day before.</p>
          <button type="button" class="pc-hist-link" data-pc-plans><i class="fa-solid fa-layer-group"></i> See what each plan includes <i class="fa-solid fa-chevron-right"></i></button>
          <button type="button" class="pc-hist-link" id="pcHistLink"><i class="fa-solid fa-clock-rotate-left"></i> Purchase history <i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="card full-width" style="margin-top:0.9rem" id="remPrefs">
          <div class="section-title"><i class="fa-regular fa-clock"></i> Reminders</div>
          <p class="ls" style="font-size:0.72rem;line-height:1.5">Choose which reminders you get and when. Times follow your time zone (${tzOffsetLabel()}). They arrive in your inbox and as push notifications.</p>
          <div class="pem-msg error" id="remError"></div>
          <div class="rp-grid">
            ${remCard('event_on', 'fa-calendar', '#8b5cf6', 'Calendar events', 'Before a timed event, and a morning heads-up for all-day ones', fld('Remind me', 'event_lead_min', [5, 10, 15, 30, 60].map(m => `<option value="${m}">${m} min before</option>`).join('')) + fld('All-day at', 'allday_hour', hourOpts))}
            ${remCard('task_on', 'fa-list-check', '#3b82f6', 'Tasks', 'A daily summary of what is due today and overdue', fld('Send at', 'task_hour', hourOpts))}
            ${remCard('bill_on', 'fa-file-invoice-dollar', '#f59e0b', 'Bills', 'Before the due date, on it, and the day after if unpaid', fld('Remind me', 'bill_days', dayOpts) + fld('Send at', 'bill_hour', hourOpts))}
            ${remCard('sub_on', 'fa-repeat', '#f472b6', 'Subscriptions', 'Before a subscription renews', fld('Remind me', 'sub_days', dayOpts) + fld('Send at', 'sub_hour', hourOpts))}
            ${remCard('goal_on', 'fa-bullseye', '#34d399', 'Goals', 'Before a goal deadline, and on the day', fld('Remind me', 'goal_days', dayOpts) + fld('Send at', 'goal_hour', hourOpts))}
            ${LumaPlan.hasAddon('study') ? remCard('study_on', 'fa-graduation-cap', '#34d399', 'Study', 'Before an assignment, test or exam is due, the day before, and on the day. Items with a due time are reminded shortly before it. Overdue ones get a daily nudge for a week', fld('First reminder', 'study_days', dayOpts) + fld('Send at', 'study_hour', hourOpts) + fld('Items with a time', 'study_due_lead_min', [15, 30, 60, 90, 120, 180, 240].map(m => `<option value="${m}">${m >= 60 ? m / 60 + ' h' : m + ' min'} before</option>`).join(''))) : ''}
            ${LumaPlan.hasAddon('work') ? remCard('work_on', 'fa-briefcase', '#fb923c', 'Work', 'Before a task you were given is due, the day before, and on the day. Overdue ones get a daily nudge for a week', fld('First reminder', 'work_days', dayOpts) + fld('Send at', 'work_hour', hourOpts)) : ''}
            ${LumaPlan.hasAddon('study') ? remCard('class_on', 'fa-chalkboard-user', '#34d399', 'Classes', 'Shortly before each class on your timetable starts (not on cancelled days or breaks)', fld('Remind me', 'class_lead_min', [5, 10, 15, 30, 60].map(m => `<option value="${m}">${m} min before</option>`).join(''))) : ''}
            ${remCard('habit_on', 'fa-fire', '#fb923c', 'Habits', 'At the reminder time you set on each habit, if it is not done yet', '<button type="button" class="rp-link" data-golink="habits">Set times on each habit <i class="fa-solid fa-arrow-right"></i></button>')}
            ${remCard('health_on', 'fa-heart-pulse', '#f87171', 'Health', 'Water, steps, active minutes and sleep reminders', '<button type="button" class="rp-link" data-golink="health">Set times on the Health page <i class="fa-solid fa-arrow-right"></i></button>')}
            ${remCard('budget_on', 'fa-wallet', '#4ade80', 'Budget alerts', 'When your spending passes a share of your monthly budget, and when you go over', fld('Warn me at', 'budget_pct', [50, 60, 70, 75, 80, 85, 90, 95].map(p => `<option value="${p}">${p}% of budget</option>`).join('')))}
          </div>
          <p class="ls" style="margin-top:0.9rem;font-size:0.7rem;line-height:1.5">Your own one-off and repeating reminders (like the monthly timesheet) live on the Reminders page.</p>
        </div>
</div>`;
    };

    // ---------- Edit profile modal (name, email, password) ----------
    const pemOverlay = document.getElementById('profileEditOverlay');
    const pemError = document.getElementById('pemError');
    const pemOk = document.getElementById('pemOk');
    const pemFirst = document.getElementById('pemFirst');
    const pemLast = document.getElementById('pemLast');
    const pemEmail = document.getElementById('pemEmail');
    const pemPw = document.getElementById('pemPw');
    const pemPw2 = document.getElementById('pemPw2');
    const pemSave = document.getElementById('pemSave');
    const pemCountry = document.getElementById('pemCountry'), pemTimezone = document.getElementById('pemTimezone');
    pemCountry.innerHTML = '<option value="">Not set</option>' + LumaAuth.COUNTRIES.map(c => `<option value="${c}">${c}</option>`).join('');

    function pemShowError(text) { pemOk.style.display = 'none'; pemError.textContent = text; pemError.style.display = 'flex'; }
    function pemShowOk(text) { pemError.style.display = 'none'; pemOk.textContent = text; pemOk.style.display = 'flex'; }

    function openProfileEditModal() {
      pemError.style.display = 'none';
      pemOk.style.display = 'none';
      pemFirst.value = (LUMA_PROFILE && LUMA_PROFILE.first_name) || '';
      pemLast.value = (LUMA_PROFILE && LUMA_PROFILE.last_name) || '';
      pemEmail.value = lumaEmail();
      pemPw.value = '';
      pemPw2.value = '';
      pemCountry.value = lumaCountry(); if (pemCountry.selectedIndex < 0) pemCountry.value = '';
      skinSelect(pemCountry);
      pemTimezone.innerHTML = LumaAuth.timezoneOptions(MYT); skinSelect(pemTimezone);
      pemOverlay.classList.add('open');
      pemFirst.focus();
    }
    function closeProfileEditModal() { pemOverlay.classList.remove('open'); }
    document.getElementById('pemClose').addEventListener('click', closeProfileEditModal);
    pemOverlay.addEventListener('click', (e) => { if (e.target === pemOverlay) closeProfileEditModal(); });

    pemSave.addEventListener('click', async () => {
      pemError.style.display = 'none';
      pemOk.style.display = 'none';

      const newPw = pemPw.value;
      const newPw2 = pemPw2.value;
      if (newPw || newPw2) {
        if (newPw.length < 6) return pemShowError('New password must be at least 6 characters.');
        if (newPw !== newPw2) return pemShowError("New passwords don't match.");
      }

      pemSave.disabled = true;
      pemSave.textContent = 'Saving…';

      const notices = [];

      const tzChanged = pemTimezone.value && pemTimezone.value !== MYT;
      let tzSaved = false;
      let { data: profileData, error: profileError } = await LumaAuth.updateProfile({
        first_name: pemFirst.value.trim(),
        last_name: pemLast.value.trim(),
        country: pemCountry.value || null,
        timezone: pemTimezone.value || null,
      });
      if (!profileError && tzChanged) tzSaved = true;
      if (profileError && /country|timezone/i.test(profileError.message)) { // migrations 023 / 028 not run yet: still save the name
        ({ data: profileData, error: profileError } = await LumaAuth.updateProfile({ first_name: pemFirst.value.trim(), last_name: pemLast.value.trim() }));
        if (!profileError) notices.push('country / time zone not saved — run supabase/migrations/023_money_country.sql and 028_timezone.sql');
        if (!profileError && tzChanged) { setAppTimezone(pemTimezone.value); } // still use it in this session
      }
      if (profileError) {
        pemSave.disabled = false;
        pemSave.textContent = 'Save changes';
        pemShowError("Couldn't save name: " + profileError.message + " (has supabase/migrations/001_profiles_contacts_chat.sql been run and the luma schema exposed?)");
        return;
      }
      LUMA_PROFILE = profileData;

      const newEmail = pemEmail.value.trim();
      if (newEmail && newEmail !== LUMA_USER.email) {
        const { data: emailData, error: emailError } = await LumaAuth.updateEmail(newEmail);
        if (emailError) {
          pemSave.disabled = false;
          pemSave.textContent = 'Save changes';
          pemShowError("Couldn't update email: " + emailError.message);
          return;
        }
        if (emailData && emailData.user && emailData.user.email === newEmail) {
          LUMA_USER = emailData.user;
          await LumaAuth.updateProfile({ email: newEmail }); // keep the profiles copy in sync
          notices.push('email updated');
        } else {
          notices.push('check your inbox to confirm the new email');
        }
      }

      if (newPw) {
        const { error: pwError } = await LumaAuth.updatePassword(newPw);
        if (pwError) {
          pemSave.disabled = false;
          pemSave.textContent = 'Save changes';
          pemShowError("Couldn't update password: " + pwError.message);
          return;
        }
        notices.push('password updated');
      }

      pemSave.disabled = false;
      pemSave.textContent = 'Save changes';
      applyUserUI();
      const pg = document.getElementById('page-settings');
      const nameView = pg && pg.querySelector('#profNameView');
      const emailView = pg && pg.querySelector('#profEmailView');
      const avatar = pg && pg.querySelector('#profAvatar');
      if (nameView) nameView.textContent = lumaFullName();
      if (emailView) emailView.textContent = lumaEmail();
      if (avatar) avatar.textContent = lumaInitial();

      pemShowOk('Saved' + (notices.length ? ' — ' + notices.join(', ') + '.' : '.') + (tzSaved ? ' Applying your new time zone…' : ''));
      if (tzSaved) return setTimeout(() => location.reload(), 1200); // every date and time in the app follows the new zone
      setTimeout(closeProfileEditModal, 1400);
    });


    const REM_HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    const REM_DEFAULTS = { habit_on: true, health_on: true, budget_pct: 80, event_on: true, event_lead_min: 15, allday_hour: 8, task_on: true, task_hour: 9, bill_on: true, bill_hour: 9, bill_days: 3, sub_on: true, sub_hour: 9, sub_days: 3, goal_on: true, goal_hour: 9, goal_days: 3, budget_on: true, study_on: true, study_hour: 9, study_days: 3, class_on: true, class_lead_min: 15, study_due_lead_min: 60, work_on: true, work_hour: 9, work_days: 1 };
    async function wireReminderPrefs(pg) {
      const box = pg.querySelector('#remPrefs'); if (!box) return;
      const err = m => { const e = box.querySelector('#remError'); e.textContent = m; e.style.display = m ? 'flex' : 'none'; };
      const { data, error } = await LumaAuth.client.schema('luma').from('reminder_prefs').select('*').maybeSingle();
      if (error) err(/reminder_prefs|schema cache|does not exist/i.test(error.message) ? 'Reminder settings aren\'t set up yet — run supabase/migrations/031_reminder_prefs.sql in the Supabase SQL Editor.' : error.message);
      const v = { ...REM_DEFAULTS, ...(data || {}) };
      if (!LumaPlan.has('timing')) ['event_lead_min', 'allday_hour', 'task_hour', 'bill_hour', 'bill_days', 'sub_hour', 'sub_days', 'goal_hour', 'goal_days', 'budget_pct', 'study_hour', 'study_days', 'class_lead_min', 'study_due_lead_min', 'work_hour', 'work_days'].forEach(k => { v[k] = REM_DEFAULTS[k]; }); // Dawn: the standard times are what is used, so that is what is shown
      const dim = () => box.querySelectorAll('.setting-row, .rp-card').forEach(r => { const sw = r.querySelector('.switch'); r.classList.toggle('rem-off', !!sw && !sw.classList.contains('on')); });
      box.querySelectorAll('select[data-rem]').forEach(sel => { sel.value = String(v[sel.dataset.rem]); skinSelect(sel); });
      if (!LumaPlan.has('timing')) { // choosing the times is a Glow / Zenith feature; the on/off switches still work
        box.querySelectorAll('select[data-rem]').forEach(sel => { const b = sel._luWrap && sel._luWrap.querySelector('button'); if (b) b.disabled = true; sel._luWrap && sel._luWrap.classList.add('plan-locked'); });
        const note = document.createElement('div'); note.className = 'ls'; note.style.cssText = 'margin:2px 0 6px;color:#fcd34d'; note.innerHTML = '<i class="fa-solid fa-lock"></i> These are the standard times and levels, and they are what is used when a reminder is on. Choosing your own is available on Glow and Zenith.'; box.querySelector('#remError').after(note);
      }
      box.querySelectorAll('.switch[data-rem]').forEach(sw => sw.classList.toggle('on', !!v[sw.dataset.rem]));
      dim();
      const save = async patch => {
        err('');
        const { error: e } = await LumaAuth.client.schema('luma').from('reminder_prefs').upsert({ user_id: LUMA_USER.id, ...patch }, { onConflict: 'user_id' });
        if (e) err(/reminder_prefs|schema cache|does not exist/i.test(e.message) ? 'Reminder settings aren\'t set up yet — run supabase/migrations/031_reminder_prefs.sql in the Supabase SQL Editor.' : e.message);
        else flashToast('Reminder saved', '', 'fa-check', '#22c55e');
      };
      box.addEventListener('click', e => { const g = e.target.closest('[data-golink]'); if (g) goTo(g.dataset.golink); });
      box.addEventListener('change', e => { const sel = e.target.closest('select[data-rem]'); if (sel) save({ [sel.dataset.rem]: Number(sel.value) }); });
      box.addEventListener('click', e => { const sw = e.target.closest('.switch[data-rem]'); if (!sw) return; setTimeout(() => { dim(); save({ [sw.dataset.rem]: sw.classList.contains('on') }); }, 0); });
    }


      // Settings — background picker

    // ---------- gifts from an administrator: waiting to be used whenever you like ----------
    const giftLen = g => g.days ? g.days + ' day' + (g.days === 1 ? '' : 's') : g.months + ' month' + (g.months === 1 ? '' : 's');
    const giftDate = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    function settingsGiftsHtml() {
      const all = LumaPlan.gifts || [], wait = all.filter(g => g.state === 'waiting'), past = all.filter(g => g.state !== 'waiting').slice(0, 3);
      if (!all.length) return '';
      const row = g => { const a = ADDONS[g.addon] || { name: g.addon, icon: 'fa-gift', color: '#34d399' }, d = g.claim_by ? LumaPlan.daysTo(g.claim_by) : null;
        return `<div class="pc-gift ${g.state}" data-id="${g.id}"><div class="rp-ico" style="--c:${a.color}"><i class="fa-solid ${a.icon}"></i></div><div class="pc-main"><div class="pc-name">${a.name} · ${giftLen(g)} free${g.message ? ` <em>${escapeHtml(g.message)}</em>` : ''}</div>
          <div class="pc-end ${g.state === 'waiting' && d !== null && d <= 7 ? 'soon' : g.state === 'waiting' ? '' : 'off'}">${g.state === 'used' ? `<i class="fa-solid fa-check"></i> Used on ${giftDate(g.claimed_at)}` : g.state === 'expired' ? `Expired ${giftDate(g.claim_by)}` : g.claim_by ? `<i class="fa-regular fa-clock"></i> Use it by ${giftDate(g.claim_by)} · ${d} day${d === 1 ? '' : 's'} left` : '<i class="fa-regular fa-clock"></i> No deadline: use it any time'}</div></div>
          ${g.state === 'waiting' ? `<button type="button" class="np-btn pc-claim" data-pc-claim="${g.id}"><i class="fa-solid fa-gift"></i> Use now</button>` : ''}</div>`; };
      return `<div class="pc-gifts">${wait.length ? `<div class="pc-gh"><i class="fa-solid fa-gift"></i> ${wait.length === 1 ? 'A free gift is waiting for you' : wait.length + ' free gifts are waiting for you'}</div><div class="ls pc-gnote">Nothing starts, and no time is used up, until you press <b>Use now</b>. A gift runs for its full length from the day you start it, and you can use it any time before its “use by” date. You can keep up to 3 unused gifts at a time.</div>${wait.map(row).join('')}` : ''}${past.length ? `<div class="pc-gh pc-gpast">Earlier gifts</div>${past.map(row).join('')}` : ''}</div>`;
    }
    document.addEventListener('luma-gifts', () => { const box = document.getElementById('pcGifts'); if (box) box.innerHTML = settingsGiftsHtml(); }); // a gift arrived or was used: refresh the card if it is drawn
    async function claimGift(id) {
      const g = (LumaPlan.gifts || []).find(x => x.id === id); if (!g) return;
      const a = ADDONS[g.addon] || { name: g.addon }, info = LumaPlan.addonInfo[g.addon], base = LumaPlan.hasAddon(g.addon) && info && info.expires_at ? new Date(info.expires_at) : new Date();
      const end = new Date(base); if (g.days) end.setDate(end.getDate() + g.days); else end.setMonth(end.getMonth() + g.months);
      if (LumaPlan.hasAddon(g.addon) && !(info && info.expires_at)) return luAlert(`You already have ${a.name} with no end date, so there is nothing to add.`);
      if (!await luConfirm({ title: `Start your free ${a.name} access?`, message: `${giftLen(g)} of ${a.name} mode starts now and runs until ${giftDate(end.toISOString())}${LumaPlan.hasAddon(g.addon) ? ' (added after what you already have)' : ''}. A gift can be used once.`, ok: 'Use now', icon: 'fa-gift', tone: 'info' })) return;
      const { error } = await LumaAuth.client.schema('luma').rpc('claim_gift', { p_id: id });
      if (error) return luAlert(error.message);
      await LumaPlan.load(); await LumaPlan.loadGifts(); Object.keys(rendered).forEach(k => delete rendered[k]); if (typeof enforceModeAccess === 'function') await enforceModeAccess();
      flashToast(a.name + ' is on', 'Enjoy your free access', 'fa-gift', (ADDONS[g.addon] || {}).color || '#34d399'); goTo('settings');
    }
    WIRE.settings = function (pg, key) {
        wireReminderPrefs(pg);
        LumaPlan.loadGifts().then(() => { const box = pg.querySelector('#pcGifts'); if (box) box.innerHTML = settingsGiftsHtml(); }); // always show the latest
        pg.querySelector('#pcHistLink')?.addEventListener('click', () => goTo('purchases'));
          pg.querySelectorAll('[data-addon-pill]').forEach(b => b.addEventListener('click', () => pg.querySelector('#planCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
        pg.querySelector('#planCard')?.addEventListener('click', e => { const rn = e.target.closest('[data-pc-renew]'); if (rn) return requestRenew(rn.dataset.pcRenew); const cl = e.target.closest('[data-pc-claim]'); if (cl) return claimGift(cl.dataset.pcClaim); const by = e.target.closest('[data-pc-buy]'); if (by) return requestAddon(by.dataset.pcBuy); if (e.target.closest('[data-pc-plans]')) openPlans(); });
        pg.querySelector('#logoutBtn')?.addEventListener('click', openLogoutConfirm);
        // Notifications switch = push on this device
        pg.querySelector('#setNotifSwitch')?.addEventListener('click', async e => {
          const sw = e.currentTarget, want = sw.classList.contains('on'), err = pg.querySelector('#setPushError'); err.style.display = 'none'; sw.disabled = true;
          try {
            if (want) { const r = await enablePush(); if (r !== 'granted') throw new Error(r === 'denied' ? 'Notifications are blocked. Allow them for LUMA in your browser or device settings, then try again.' : 'Notifications were not allowed.'); try { localStorage.removeItem('luma_push_declined'); } catch (x) { } }
            else { await disablePush(); try { localStorage.setItem('luma_push_declined', '1'); } catch (x) { } }
          } catch (x) { err.textContent = x.message || 'Could not change notification settings.'; err.style.display = 'flex'; }
          sw.disabled = false; paintPushControls();
        });
        paintPushControls();
        pg.querySelector('#profEditBtn')?.addEventListener('click', openProfileEditModal);
        // Preferences — saved to luma.profiles.preferences
        pg.querySelectorAll('.switch[data-key]').forEach(s => {
          s.addEventListener('click', async () => {
            const on = s.classList.contains('on'); await setLumaPref(s.dataset.key, on);
            if (s.dataset.key === 'sounds' && on) uiSound(740, 0.09, true); // a little preview
          });
        });
        // how easily a day counts as busy
        const paintBusyHint = () => { const sel = pg.querySelector('#busyLevel'), h = pg.querySelector('#busyLvHint'); if (!sel || !h) return; const t = LU_BUSY_LEVELS[sel.value] || LU_BUSY_LEVELS.normal; h.textContent = `Amber from ${t.n[0]} things, ${t.h[0]} hours booked or ${t.clash[0]} clash${t.clash[0] === 1 ? '' : 'es'}; red from ${t.n[1]} things, ${t.h[1]} hours or ${t.clash[1]} clashes.`; };
        paintBusyHint(); const bl = pg.querySelector('#busyLevel'); if (bl) bl.onchange = async () => { paintBusyHint(); await setLumaPref('busy_level', bl.value); };
        // Install LUMA
        const paintInstall = () => { const sub = pg.querySelector('#installSub'), btn = pg.querySelector('#installBtn'); if (!sub || !window.LumaInstall) return;
          const done = LumaInstall.installed(); btn.style.display = done ? 'none' : '';
          sub.textContent = done ? 'LUMA is installed on this device ✓' : LumaInstall.ios() ? 'Add LUMA to your Home Screen to open it full screen like an app. On iPhone this is also needed for notifications.' : 'Add LUMA to your home screen or desktop and open it full screen like an app.'; };
        paintInstall(); pg.querySelector('#installBtn').onclick = () => lumaInstallNow(); document.addEventListener('luma-install', paintInstall);
        // Account & data
        const acctMsg = (ok, m) => { const e = pg.querySelector('#acctError'), k = pg.querySelector('#acctOk'); e.style.display = k.style.display = 'none'; const el = ok ? k : e; if (m) { el.textContent = m; el.style.display = 'flex'; } };
        pg.querySelector('#acctPw').onclick = async e => {
          const b = e.currentTarget; b.disabled = true; acctMsg(true, '');
          const { error } = await LumaAuth.sendPasswordReset(lumaEmail()); b.disabled = false;
          error ? acctMsg(false, error.message) : acctMsg(true, 'Check your email, ' + lumaEmail() + ', for the link to set a new password.');
        };
        pg.querySelector('#acctOthers').onclick = async e => {
          if (!await luConfirm({ title: 'Sign out other devices?', message: 'Every other phone or computer signed in to LUMA will be logged out. You stay signed in here.', ok: 'Sign out others', icon: 'fa-arrow-right-from-bracket', tone: 'info' })) return;
          const b = e.currentTarget; b.disabled = true; acctMsg(true, '');
          const { error } = await LumaAuth.client.auth.signOut({ scope: 'others' }); b.disabled = false;
          error ? acctMsg(false, error.message) : acctMsg(true, 'Signed out of your other devices.');
        };
        // delete my account: the person types their email; the `account` function removes the data, files and sign-in
        const delOv = document.getElementById('acctDelOverlay'), delIn = document.getElementById('acctDelEmail'), delGo = document.getElementById('acctDelGo'), delErr = document.getElementById('acctDelError');
        const delCheck = () => { delGo.disabled = delIn.value.trim().toLowerCase() !== String(lumaEmail()).toLowerCase(); };
        pg.querySelector('#acctDelete').onclick = () => {
          delErr.style.display = 'none'; delIn.value = ''; delCheck();
          document.getElementById('acctDelAdmin').style.display = LumaPlan.admin ? '' : 'none'; document.getElementById('acctDelBody').style.display = LumaPlan.admin ? 'none' : '';
          document.getElementById('acctDelEmailShow').textContent = lumaEmail(); delOv.classList.add('open');
        };
        document.getElementById('acctDelClose').onclick = () => delOv.classList.remove('open');
        delOv.onclick = e => { if (e.target === delOv) delOv.classList.remove('open'); };
        delIn.oninput = delCheck;
        document.getElementById('acctDelExport').onclick = () => pg.querySelector('#acctExport').click();
        delGo.onclick = async () => {
          if (delGo.disabled) return;
          if (!await luConfirm({ title: 'Delete your account forever?', message: 'Everything is removed and this can not be undone.', ok: 'Delete my account' })) return;
          delGo.disabled = true; delGo.textContent = 'Deleting…'; delErr.style.display = 'none';
          const { data, error } = await LumaAuth.client.functions.invoke('account', { body: { action: 'delete', confirm: delIn.value.trim() } });
          let msg = error ? error.message : (data && data.error) || '';
          if (error && error.context && typeof error.context.json === 'function') { try { const j = await error.context.json(); msg = j.error || msg; } catch (x) { } }
          if (msg) { delGo.textContent = 'Delete my account forever'; delCheck(); delErr.textContent = /not found|failed to send|404|relay/i.test(msg) ? 'Account deletion is not switched on yet. Please contact support to delete your account.' : msg; delErr.style.display = 'flex'; return; }
          try { await LumaAuth.client.auth.signOut(); } catch (x) { }
          try { localStorage.clear(); sessionStorage.clear(); } catch (x) { }
          location.replace('/login/?deleted=1');
        };
        pg.querySelector('#acctExport').onclick = async e => {
          const b = e.currentTarget; b.disabled = true; b.textContent = 'Preparing…'; acctMsg(true, '');
          try {
            const get = async p => { try { const r = await p; return r && !r.error ? r.data : null; } catch (x) { return null; } };
            const out = { exported_at: new Date().toISOString(), account: { email: lumaEmail(), name: lumaFullName(), plan: LumaPlan.plan, time_zone: MYT },
              tasks: await get(LumaTasks.list()), events: await get(LumaEvents.list()), notes: (await get(LumaNotes.list()) || []).map(n => ({ id: n.id, title: n.title, body: n.body, tag: n.tag, created_at: n.created_at })),
              habits: await get(LumaHabits.list()), habit_logs: await get(LumaHabits.logsSince('2000-01-01')), goals: await get(LumaGoals.list()),
              bills_and_subscriptions: await get(LumaBills.list()), bill_payments: await get(LumaBills.listPayments()), money_entries: await get(LumaMoney.listEntries('2000-01-01')),
              study: LumaPlan.hasAddon('study') && typeof sdExport === 'function' ? await sdExport() : undefined,
              reminders: await get(LumaReminders.list()), health_logs: await get(LumaHealth.listLogs('2000-01-01')), documents: (await get(LumaDocuments.listDocuments()) || []).map(d => ({ id: d.id, name: d.name, size_bytes: d.size_bytes, created_at: d.created_at })) };
            const url = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })), a = document.createElement('a');
            a.href = url; a.download = `luma-export-${hToday()}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
            acctMsg(true, 'Your data was downloaded. Uploaded files are not included, only their names.');
          } catch (x) { acctMsg(false, 'Could not export: ' + (x.message || x)); }
          b.disabled = false; b.textContent = 'Export';
        };
        const grid = pg.querySelector('#bgGrid');
        // theme picker — saved to luma.profiles.theme
        const curTheme = (LUMA_PROFILE && LUMA_PROFILE.theme) || 'midnight';
        const markTheme = (t) => pg.querySelectorAll('.theme-opt').forEach(o => o.style.borderColor = o.dataset.theme === t ? '#3b82f6' : 'rgba(255,255,255,0.06)');
        markTheme(curTheme);
        pg.querySelectorAll('.theme-opt').forEach(o => o.addEventListener('click', async () => {
          if (o.classList.contains('plan-lock')) return planLocked('More themes', 'the Glow and Zenith plans');
          const t = o.dataset.theme; applyTheme(t); markTheme(t);
          await saveProfile({ theme: t });
        }));
        // background — saved to luma.profiles.background_url
        const mark = (val) => pg.querySelectorAll('.bg-thumb').forEach(t => t.classList.toggle('active', t.dataset.bg === val));
        mark((LUMA_PROFILE && LUMA_PROFILE.background_url) || BGS[0].url);
        pg.querySelectorAll('.bg-thumb').forEach(t => t.addEventListener('click', async () => {
          if (t.classList.contains('plan-lock')) return planLocked('More wallpapers', LumaPlan.plan === 'dawn' ? 'the Glow and Zenith plans' : 'the Zenith plan');
          const url = t.dataset.bg; mark(url); if (!await applyBgValue(url)) return luAlert('Could not load that picture. Try uploading it again.');
          await saveProfile({ background_url: url });
        }));
        const file = pg.querySelector('#bgFile');
        pg.querySelector('#bgUpload').addEventListener('click', () => LumaPlan.has('own_wallpaper') ? file.click() : planLocked('Uploading your own wallpaper', 'the Zenith plan'));
        // the picture you upload is saved to your account (so it is there after a refresh or on another device); a new upload replaces and deletes the old one
        file.addEventListener('change', async e => {
          const f = e.target.files[0]; e.target.value = ''; if (!f) return;
          if (!f.type.startsWith('image/')) return luAlert('Please choose a picture (JPG, PNG, WebP…).');
          if (f.size > 15 * 1024 * 1024) return luAlert('That picture is over 15 MB. Please choose a smaller one.');
          const up = pg.querySelector('#bgUpload'), label = up.innerHTML; up.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…'; up.style.pointerEvents = 'none';
          try {
            const blob = await shrinkImage(f), path = `${LUMA_USER.id}/wallpaper-${Date.now()}.jpg`, bucket = LumaAuth.client.storage.from('luma-backgrounds');
            const put = await bucket.upload(path, blob, { contentType: 'image/jpeg' });
            if (put.error) throw new Error(/bucket not found/i.test(put.error.message) ? 'Wallpaper storage isn\'t set up yet — run supabase/migrations/042_backgrounds.sql in the SQL Editor.' : put.error.message);
            const prefs = (LUMA_PROFILE && LUMA_PROFILE.preferences) || {}, old = prefs.custom_bg_path;
            const { data, error } = await LumaAuth.updateProfile({ background_url: 'storage:' + path, preferences: { ...prefs, custom_bg_path: path } });
            if (error) { await bucket.remove([path]); throw new Error(error.message); }
            LUMA_PROFILE = data;
            if (old && old !== path) await bucket.remove([old]); // the previous picture is deleted
            await applyBgValue('storage:' + path);
            delete rendered.settings; goTo('settings'); // shows the new picture tile
            flashToast('Wallpaper saved', 'It will stay after a refresh and on your other devices.', 'fa-image', '#22c55e');
          } catch (err) { up.innerHTML = label; up.style.pointerEvents = ''; luAlert(err.message || 'Could not save the picture.'); }
        });
        // the saved picture's tile shows the picture itself
        const custom = pg.querySelector('#bgCustom');
        if (custom) bgAddress(custom.dataset.bg).then(a => { if (a) custom.style.backgroundImage = `url('${a}')`; });
    };
