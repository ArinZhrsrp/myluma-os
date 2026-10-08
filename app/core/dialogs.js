// LUMA — core: dialogs
    // ---------- Themed dialogs: use these instead of confirm() / alert() / prompt() ----------
    // All return promises:  await luConfirm({...}) → true/false · await luAlert(msg) · await luPrompt({...}) → string | null
    // keep only digits, commas and a single decimal point (used by number-only text boxes)
    function cleanDecimal(v) {
      let t = String(v).replace(/[^0-9.,]/g, ''); const i = t.indexOf('.');
      return i >= 0 ? t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '') : t;
    }
    function luDialog({ title, message = '', icon = 'fa-trash-can', tone = 'danger', ok = 'OK', cancel = 'Cancel', showCancel = true, input = null }) {
      return new Promise(resolve => {
        const ov = document.getElementById('dialogOverlay'), inp = document.getElementById('dlgInput');
        const ic = document.getElementById('dlgIcon'), okBtn = document.getElementById('dlgOk'), cancelBtn = document.getElementById('dlgCancel');
        ic.className = 'confirm-icon' + (tone === 'info' ? ' info' : tone === 'warn' ? ' warn' : '');
        ic.innerHTML = '<i class="fa-solid ' + icon + '"></i>';
        document.getElementById('dlgTitle').textContent = title;
        const msg = document.getElementById('dlgMsg'); msg.textContent = message; msg.style.display = message ? '' : 'none'; msg.style.textAlign = message.includes('\n') ? 'left' : ''; // lists read better left-aligned
        okBtn.textContent = ok; okBtn.className = 'confirm-btn ' + (tone === 'danger' ? 'danger' : 'primary');
        cancelBtn.textContent = cancel; cancelBtn.style.display = showCancel ? '' : 'none';
        inp.style.display = input ? '' : 'none';
        inp.inputMode = input && input.numeric ? 'decimal' : 'text';
        if (input) { inp.value = input.value || ''; inp.placeholder = input.placeholder || ''; }
        // with a text box, the confirm button stays disabled until something is typed
        const sync = () => { if (input && input.numeric) inp.value = cleanDecimal(inp.value); okBtn.disabled = !!input && !inp.value.trim(); };
        inp.oninput = sync; sync();
        const done = result => {
          ov.classList.remove('open');
          okBtn.onclick = cancelBtn.onclick = ov.onclick = inp.onkeydown = inp.oninput = null;
          document.removeEventListener('keydown', onKey, true);
          resolve(result);
        };
        const accept = () => { if (input && !inp.value.trim()) return; done(input ? inp.value.trim() : true); };
        const dismiss = () => done(input ? null : false);
        const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); dismiss(); } else if (e.key === 'Enter' && !input) { e.preventDefault(); accept(); } };
        okBtn.onclick = accept; cancelBtn.onclick = dismiss;
        ov.onclick = e => { if (e.target === ov) dismiss(); };
        inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); accept(); } };
        document.addEventListener('keydown', onKey, true);
        ov.classList.add('open');
        setTimeout(() => (input ? inp : okBtn).focus(), 30);
      });
    }
    const luConfirm = o => luDialog({ ok: 'Delete', ...o });
    const luAlert = (message, title = 'Something went wrong') => luDialog({ title, message, icon: 'fa-triangle-exclamation', tone: 'warn', ok: 'OK', showCancel: false });
    const luPrompt = o => luDialog({ icon: 'fa-pen', tone: 'info', ok: 'Add', ...o, input: { placeholder: o.placeholder, value: o.value, numeric: o.numeric } });
