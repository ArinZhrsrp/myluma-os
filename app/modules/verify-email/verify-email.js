// LUMA — verify-email page
    const form = document.getElementById("verifyForm"), errEl = document.getElementById("formError"), okEl = document.getElementById("formOk");
    const submitBtn = document.getElementById("submitBtn"), resendBtn = document.getElementById("resendBtn"), codeEl = document.getElementById("code"), emailEl = document.getElementById("email");
    const q = new URLSearchParams(location.search);
    let email = (q.get("email") || "").trim();
    const showError = (t) => { okEl.style.display = "none"; errEl.textContent = t; errEl.style.display = "flex"; };
    const showOk = (t) => { errEl.style.display = "none"; okEl.textContent = t; okEl.style.display = "flex"; };

    if (email) document.getElementById("headSub").textContent = "We sent a 6-digit code to " + email + ".";
    else { document.getElementById("emailField").style.display = ""; document.getElementById("headSub").textContent = "Enter your email and the code we sent you."; }
    if (q.get("sent") === "1") showOk("Account created. We emailed you a code.");
    codeEl.focus();
    codeEl.addEventListener("input", () => { codeEl.value = codeEl.value.replace(/\D/g, ""); });

    // "send a new code" waits 60 seconds between sends
    let wait = 0, timer = null;
    function tick() {
      resendBtn.disabled = wait > 0;
      resendBtn.textContent = wait > 0 ? "Send a new code in " + wait + "s" : "Send a new code";
      if (wait > 0) { wait--; timer = setTimeout(tick, 1000); }
    }
    wait = q.get("sent") === "1" ? 45 : 0; tick();

    resendBtn.addEventListener("click", async () => {
      email = email || emailEl.value.trim();
      if (!email) return showError("Enter your email first.");
      resendBtn.disabled = true;
      const { error } = await LumaAuth.resendSignupCode(email);
      if (error) { showError(error.message); wait = 0; tick(); return; }
      showOk("A new code is on its way to " + email + ".");
      wait = 60; clearTimeout(timer); tick();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.style.display = "none"; okEl.style.display = "none";
      email = email || emailEl.value.trim();
      const code = codeEl.value.trim();
      if (!email) return showError("Enter your email first.");
      if (code.length < 6) return showError("Enter the full code from the email.");
      submitBtn.disabled = true; submitBtn.innerHTML = "Verifying\u2026";
      const { data, error } = await LumaAuth.verifyEmailCode(email, code);
      if (error || !data || !data.session) {
        submitBtn.disabled = false; submitBtn.innerHTML = 'Verify and continue <i class="fa-solid fa-arrow-right"></i>';
        showError(/expired|invalid/i.test((error && error.message) || "") ? "That code is wrong or has expired. Check it, or send a new code." : ((error && error.message) || "Could not verify. Please try again."));
        return;
      }
      showOk("Email verified. Taking you in\u2026");
      window.location.href = "/app/";
    });
  
