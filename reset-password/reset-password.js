// LUMA — reset-password page
    const form = document.getElementById("resetForm");
    const errEl = document.getElementById("formError");
    const okEl = document.getElementById("formOk");
    const submitBtn = document.getElementById("submitBtn");
    const headSub = document.getElementById("headSub");

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

    // The Supabase client reads the recovery token out of the URL on load and turns it into a temporary session.
    // We give it a moment, and if there is none we say WHY (an expired / already-used link, or a link that
    // Supabase refused to send here) instead of a vague message.
    (async () => {
      const params = new URLSearchParams((location.hash || "").replace(/^#/, ""));
      const query = new URLSearchParams(location.search);
      const urlCode = params.get("error_code") || query.get("error_code");
      const urlDesc = (params.get("error_description") || query.get("error_description") || "").replace(/\+/g, " ");
      let session = null;
      for (let i = 0; i < 8 && !session; i++) {
        session = await LumaAuth.getSession();
        if (!session) await new Promise((r) => setTimeout(r, 350));
      }
      if (!session) {
        headSub.textContent = "This link is invalid or has expired.";
        form.querySelectorAll("input, button[type=submit]").forEach((el) => (el.disabled = true));
        if (urlCode === "otp_expired") {
          showError("This reset link has expired or was already used. Some email programs open links automatically, which uses them up. Request a new link from the sign-in page and open it straight away.");
        } else if (urlDesc) {
          showError(urlDesc + " — request a new link from the sign-in page.");
        } else {
          showError('No reset link was found in this address. Request a new one from the sign-in page\'s "Forgot password?" link and open it from the email.');
        }
      }
    })();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.style.display = "none";
      okEl.style.display = "none";

      const pw = document.getElementById("pw").value;
      const pw2 = document.getElementById("pw2").value;
      if (pw !== pw2) {
        showError("Passwords don't match.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = "Updating…";

      const { error } = await LumaAuth.updatePassword(pw);

      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Update password <i class="fa-solid fa-arrow-right"></i>';

      if (error) {
        showError(error.message);
        return;
      }

      form.querySelectorAll("input, button").forEach((el) => (el.disabled = true));
      showOk("Password updated. Redirecting to sign in…");
      await LumaAuth.signOut();
      setTimeout(() => (window.location.href = "/login/"), 1800);
    });
  
