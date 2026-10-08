// LUMA — register page
    // fill the country list (shared with Edit profile)
    (function () { const tz = document.getElementById('timezone'); tz.innerHTML = LumaAuth.timezoneOptions(LumaAuth.browserTimezone()); const sel = document.getElementById('country'); (window.LumaAuth && LumaAuth.COUNTRIES || []).forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
      // the country starts as the one that goes with the person's time zone (their own choice always wins)
      let countryTouched = false;
      sel.addEventListener('change', () => { countryTouched = true; });
      const guess = (z) => { const c = LumaAuth.countryForTimezone(z); if (c && [...sel.options].some(o => o.value === c)) sel.value = c; };
      let browserZone = ''; try { browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
      guess(browserZone || tz.value);
      tz.addEventListener('change', () => { if (!countryTouched) guess(tz.value); }); })();
    LumaAuth.redirectIfSignedIn();

    // the Create account button stays off until the Terms and Privacy Policy box is ticked
    const agreeEl = document.getElementById("agree"), createBtn = document.getElementById("submitBtn");
    const syncAgree = () => { createBtn.disabled = !agreeEl.checked; createBtn.title = agreeEl.checked ? "" : "Tick the box to agree to the Terms of Service and Privacy Policy first"; };
    agreeEl.addEventListener("change", syncAgree); syncAgree();

    LumaAuth._comingSoon = (btn) => {
      const label = btn.textContent.trim();
      showError(label + " sign-up isn't connected yet \u2014 create an account with email for now.");
    };

    const form = document.getElementById("registerForm");
    const errEl = document.getElementById("formError");
    const okEl = document.getElementById("formOk");
    const submitBtn = document.getElementById("submitBtn");

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

      const firstName = document.getElementById("firstName").value.trim();
      const lastName = document.getElementById("lastName").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("pw").value;
      const password2 = document.getElementById("pw2").value;

      if (password !== password2) {
        showError("Passwords don't match.");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Creating account\u2026';

      const country = document.getElementById("country").value;
      const { data, error } = await LumaAuth.signUp({ firstName, lastName, email, password, country, timezone: document.getElementById("timezone").value });

      submitBtn.disabled = !agreeEl.checked;
      submitBtn.innerHTML = 'Create account <i class="fa-solid fa-arrow-right"></i>';

      if (error) {
        showError(error.message);
        return;
      }

      if (data.session) {
        window.location.href = "/app/";
        return;
      }

      // No session yet: the email must be verified first. Send the person to the code page.
      window.location.href = "/verify-email/?sent=1&email=" + encodeURIComponent(email);
    });
  
