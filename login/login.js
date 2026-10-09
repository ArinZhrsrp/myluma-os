// LUMA — login page
    LumaAuth.redirectIfSignedIn();

    // restore the last choice and, if remembered, the email
    const rememberEl = document.getElementById("remember");
    rememberEl.checked = LumaAuth.isRemembered();
    try {
      const saved = localStorage.getItem("luma.rememberedEmail");
      if (saved && rememberEl.checked) document.getElementById("email").value = saved;
    } catch (e) {}

    LumaAuth._comingSoon = (btn) => {
      const label = btn.textContent.trim();
      showError(label + " sign-in isn't connected yet — use email for now.");
    };

    const form = document.getElementById("loginForm");
    const errEl = document.getElementById("formError");
    const okEl = document.getElementById("formOk");
    const submitBtn = document.getElementById("submitBtn");

    if (/[?&]disabled=1\b/.test(location.search)) setTimeout(() => showError('This account has been deactivated. Please contact support if you think this is a mistake.'), 0);
    if (/[?&]deleted=1\b/.test(location.search)) setTimeout(() => showOk('Your account and all its data have been deleted. Thank you for trying LUMA.'), 0);
    function showError(text) {
      okEl.style.display = "none";
      errEl.textContent = text;
      errEl.style.display = "flex";
    }
    function showOk(text) {
      errEl.style.display = "none";
      okEl.textContent = text;
      okEl.style.display = "flex";
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.style.display = "none";
      okEl.style.display = "none";

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("pw").value;

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Signing in…';

      const remember = rememberEl.checked;
      const { error } = await LumaAuth.signIn({ email, password, remember });

      if (error) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Sign in <i class="fa-solid fa-arrow-right"></i>';
        if (/not confirmed/i.test(error.message || "")) { // the account exists but the email was never verified: send a fresh code
          await LumaAuth.resendSignupCode(email);
          window.location.href = "/verify-email/?sent=1&email=" + encodeURIComponent(email);
          return;
        }
        showError(/banned|deactivated|disabled/i.test(error.message || '') ? 'This account has been deactivated. Please contact support if you think this is a mistake.' : error.message);
        return;
      }

      try {
        if (remember) localStorage.setItem("luma.rememberedEmail", email);
        else localStorage.removeItem("luma.rememberedEmail");
      } catch (e) {}
      window.location.href = "/app/";
    });

    document.getElementById("forgotLink").addEventListener("click", async (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      if (!email) {
        showError("Enter your email above first, then click “Forgot password?”");
        return;
      }
      const { error } = await LumaAuth.sendPasswordReset(email);
      if (error) {
        const message = error.code === "email_address_invalid" || error.message.includes("Email address")
          ? "This Supabase project blocks @example.com addresses. Use a real email address, such as Gmail, to receive the reset link."
          : error.message;
        showError(message);
        return;
      }
      showOk("Password reset link sent to " + email + ".");
    });
  
