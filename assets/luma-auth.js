// LUMA — shared Supabase auth helpers, used by the Login, Register, Reset
// Password and Dashboard pages. Depends on supabase-config.js and the
// Supabase JS SDK being loaded first.

(function () {
  if (!window.supabase || !window.supabase.createClient) {
    console.error("LUMA: Supabase SDK not loaded — check the <script> order.");
    return;
  }
  if (!window.LUMA_SUPABASE_URL || window.LUMA_SUPABASE_URL === "YOUR_SUPABASE_PROJECT_URL") {
    console.warn("LUMA: Supabase credentials are still placeholders — edit assets/supabase-config.js.");
  }

  // "Remember me": when ticked the session lives in localStorage (survives
  // closing the browser); when unticked it lives in sessionStorage (gone when
  // the tab/browser closes). The choice itself is kept in localStorage so every
  // page reads the session from the same place.
  const REMEMBER_KEY = "luma.remember";
  const remembered = () => {
    try { return localStorage.getItem(REMEMBER_KEY) !== "0"; } catch (e) { return true; }
  };
  const authStorage = {
    getItem: (k) => (remembered() ? localStorage : sessionStorage).getItem(k),
    setItem: (k, v) => (remembered() ? localStorage : sessionStorage).setItem(k, v),
    removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
  };

  const client = window.supabase.createClient(window.LUMA_SUPABASE_URL, window.LUMA_SUPABASE_ANON_KEY, {
    auth: { storage: authStorage },
  });

  window.LumaAuth = {
    client,

    // countries offered at sign-up and in Edit profile (Malaysian salary deductions only apply to "Malaysia")
    COUNTRIES: ["Malaysia", "Singapore", "Indonesia", "Brunei", "Thailand", "Philippines", "Vietnam", "Cambodia", "Myanmar", "Laos", "India", "Pakistan", "Bangladesh", "Sri Lanka", "China", "Hong Kong", "Taiwan", "Japan", "South Korea",
      "Australia", "New Zealand", "United Kingdom", "Ireland", "United States", "Canada", "Germany", "France", "Netherlands", "Spain", "Italy", "United Arab Emirates", "Saudi Arabia", "Qatar", "Turkey", "Egypt", "Nigeria", "South Africa", "Brazil", "Other"],

    // time zones offered at sign-up and in Edit profile: [IANA id, places]. Shown as "GMT+08:00 · Kuala Lumpur, Singapore …",
    // sorted by the current offset. The chosen zone drives the dashboard's dates/times and the server's push reminders.
    TIMEZONES: [["Pacific/Honolulu", "Honolulu"], ["America/Anchorage", "Anchorage"], ["America/Los_Angeles", "Los Angeles, Vancouver"], ["America/Denver", "Denver"], ["America/Chicago", "Chicago, Mexico City"],
      ["America/New_York", "New York, Toronto"], ["America/Halifax", "Halifax"], ["America/Sao_Paulo", "São Paulo"], ["Atlantic/Azores", "Azores"], ["Europe/London", "London, Dublin, Lisbon"],
      ["Europe/Paris", "Paris, Berlin, Madrid, Rome"], ["Europe/Athens", "Athens, Helsinki, Kyiv"], ["Africa/Cairo", "Cairo"], ["Africa/Johannesburg", "Johannesburg"], ["Africa/Lagos", "Lagos"], ["Europe/Istanbul", "Istanbul"],
      ["Asia/Riyadh", "Riyadh, Doha, Kuwait"], ["Asia/Dubai", "Dubai, Abu Dhabi"], ["Asia/Karachi", "Karachi"], ["Asia/Kolkata", "India, Sri Lanka"], ["Asia/Dhaka", "Dhaka"], ["Asia/Bangkok", "Bangkok, Hanoi, Jakarta"],
      ["Asia/Kuala_Lumpur", "Kuala Lumpur, Singapore, Brunei, Manila, Perth"], ["Asia/Shanghai", "China, Hong Kong, Taipei"], ["Asia/Tokyo", "Tokyo, Seoul"], ["Australia/Brisbane", "Brisbane"], ["Australia/Sydney", "Sydney, Melbourne"],
      ["Pacific/Auckland", "Auckland"]],
    DEFAULT_TIMEZONE: "Asia/Kuala_Lumpur",
    isValidTimezone(tz) { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return !!tz; } catch (e) { return false; } },
    // "GMT+08:00" (right now, so daylight saving is reflected)
    tzOffset(tz) {
      try { const p = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date()).find((x) => x.type === "timeZoneName"); return p.value === "GMT" ? "GMT+00:00" : p.value; }
      catch (e) { return "GMT"; }
    },
    // the country (from COUNTRIES) that goes with a time zone id such as "Asia/Singapore"; "" when we can't tell
    countryForTimezone(tz) {
      const exact = {
        "Asia/Kuala_Lumpur": "Malaysia", "Asia/Kuching": "Malaysia", "Asia/Singapore": "Singapore", "Asia/Brunei": "Brunei",
        "Asia/Jakarta": "Indonesia", "Asia/Pontianak": "Indonesia", "Asia/Makassar": "Indonesia", "Asia/Jayapura": "Indonesia",
        "Asia/Bangkok": "Thailand", "Asia/Manila": "Philippines", "Asia/Ho_Chi_Minh": "Vietnam", "Asia/Saigon": "Vietnam",
        "Asia/Phnom_Penh": "Cambodia", "Asia/Yangon": "Myanmar", "Asia/Rangoon": "Myanmar", "Asia/Vientiane": "Laos",
        "Asia/Kolkata": "India", "Asia/Calcutta": "India", "Asia/Karachi": "Pakistan", "Asia/Dhaka": "Bangladesh", "Asia/Colombo": "Sri Lanka",
        "Asia/Shanghai": "China", "Asia/Urumqi": "China", "Asia/Chongqing": "China", "Asia/Hong_Kong": "Hong Kong", "Asia/Taipei": "Taiwan",
        "Asia/Tokyo": "Japan", "Asia/Seoul": "South Korea", "Pacific/Auckland": "New Zealand", "Pacific/Chatham": "New Zealand",
        "Europe/London": "United Kingdom", "Europe/Dublin": "Ireland", "Europe/Berlin": "Germany", "Europe/Paris": "France",
        "Europe/Amsterdam": "Netherlands", "Europe/Madrid": "Spain", "Europe/Rome": "Italy", "Asia/Dubai": "United Arab Emirates",
        "Asia/Riyadh": "Saudi Arabia", "Asia/Qatar": "Qatar", "Europe/Istanbul": "Turkey", "Africa/Cairo": "Egypt", "Africa/Lagos": "Nigeria",
        "Africa/Johannesburg": "South Africa", "Pacific/Honolulu": "United States",
      };
      if (exact[tz]) return exact[tz];
      if (/^Australia\//.test(tz)) return "Australia";
      if (/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Montreal)$/.test(tz)) return "Canada";
      if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.*|Kentucky\/.*)$/.test(tz)) return "United States";
      if (/^America\/(Sao_Paulo|Fortaleza|Recife|Bahia|Manaus|Belem|Cuiaba|Campo_Grande)$/.test(tz)) return "Brazil";
      // a zone we have no entry for: try the language region of the browser, e.g. "en-MY" → Malaysia
      try {
        const region = new Intl.Locale(navigator.language).region, byRegion = { MY: "Malaysia", SG: "Singapore", ID: "Indonesia", BN: "Brunei", TH: "Thailand", PH: "Philippines", VN: "Vietnam", KH: "Cambodia", MM: "Myanmar", LA: "Laos", IN: "India", PK: "Pakistan", BD: "Bangladesh", LK: "Sri Lanka", CN: "China", HK: "Hong Kong", TW: "Taiwan", JP: "Japan", KR: "South Korea", AU: "Australia", NZ: "New Zealand", GB: "United Kingdom", IE: "Ireland", US: "United States", CA: "Canada", DE: "Germany", FR: "France", NL: "Netherlands", ES: "Spain", IT: "Italy", AE: "United Arab Emirates", SA: "Saudi Arabia", QA: "Qatar", TR: "Turkey", EG: "Egypt", NG: "Nigeria", ZA: "South Africa", BR: "Brazil" };
        return byRegion[region] || "";
      } catch (e) { return ""; }
    },
    // the browser's own zone if it is one we offer (used as the default for new accounts)
    browserTimezone() {
      try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; if (this.TIMEZONES.some((t) => t[0] === z)) return z; } catch (e) { /* ignore */ }
      return this.DEFAULT_TIMEZONE;
    },
    // <option> markup for a <select>, sorted by offset; `selected` may be any valid IANA zone (added if it isn't in the list)
    timezoneOptions(selected) {
      const mins = (tz) => { const m = /GMT([+-])(\d\d):(\d\d)/.exec(this.tzOffset(tz)); return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0; };
      const list = this.TIMEZONES.slice();
      if (selected && this.isValidTimezone(selected) && !list.some((t) => t[0] === selected)) list.push([selected, selected.split("/").pop().replace(/_/g, " ")]);
      return list.sort((a, b) => mins(a[0]) - mins(b[0]) || a[1].localeCompare(b[1]))
        .map(([id, places]) => `<option value="${id}"${id === selected ? " selected" : ""}>${this.tzOffset(id)} · ${places}</option>`).join("");
    },

    async signUp({ firstName, lastName, email, password, country = "", timezone = "" }) {
      return client.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName, country, timezone } },
      });
    },

    // Email verification with a 6-digit code (Supabase "Confirm signup" email template must show {{ .Token }}).
    // Verifying signs the person in.
    async verifyEmailCode(email, token) {
      this.setRemember(true);
      return client.auth.verifyOtp({ email, token, type: "signup" });
    },
    async resendSignupCode(email) {
      return client.auth.resend({ type: "signup", email });
    },

    // remember: true (default) keeps you signed in across browser restarts;
    // false ends the session when the browser/tab is closed.
    async signIn({ email, password, remember = true }) {
      this.setRemember(remember);
      const res = await client.auth.signInWithPassword({ email, password });
      if (res.error) return res;
      // drop any stale copy of the session left in the other storage
      if (remember) sessionStorage.clear(); else {
        Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k));
      }
      return res;
    },

    isRemembered: remembered,
    setRemember(on) {
      try { localStorage.setItem(REMEMBER_KEY, on ? "1" : "0"); } catch (e) {}
    },

    async signOut() {
      return client.auth.signOut();
    },

    async sendPasswordReset(email) {
      return client.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("LUMA Reset Password.html", window.location.href).href,
      });
    },

    async updatePassword(password) {
      return client.auth.updateUser({ password });
    },

    // May require confirmation from the new (and possibly old) email
    // address before it takes effect, depending on the project's
    // Authentication → "Secure email change" setting.
    async updateEmail(email) {
      return client.auth.updateUser({ email });
    },

    // Requires supabase/migrations/001_profiles_contacts_chat.sql to have been run, and "luma"
    // added to Project Settings → API → Exposed Schemas.
    async getProfile() {
      const session = await this.getSession();
      if (!session) return { data: null, error: { message: "Not signed in" } };
      return client.schema("luma").from("profiles").select("*").eq("id", session.user.id).single();
    },

    async updateProfile(fields) {
      const session = await this.getSession();
      if (!session) return { data: null, error: { message: "Not signed in" } };
      return client.schema("luma").from("profiles").update(fields).eq("id", session.user.id).select().single();
    },

    async getSession() {
      const { data: { session } } = await client.auth.getSession();
      return session;
    },

    // Call on protected pages — sends signed-out visitors to Login.
    async requireSession(redirectTo = "LUMA Login.html") {
      const session = await this.getSession();
      if (!session) {
        window.location.href = redirectTo;
        return null;
      }
      return session;
    },

    // Call on Login/Register — sends already-signed-in users to the dashboard.
    async redirectIfSignedIn(redirectTo = "LUMA Glass Dashboard.html") {
      const session = await this.getSession();
      if (session) window.location.href = redirectTo;
      return session;
    },

    displayName(user) {
      const meta = (user && user.user_metadata) || {};
      if (meta.first_name) return meta.first_name;
      if (user && user.email) return user.email.split("@")[0];
      return "there";
    },

    fullName(user) {
      const meta = (user && user.user_metadata) || {};
      const name = [meta.first_name, meta.last_name].filter(Boolean).join(" ");
      return name || this.displayName(user);
    },

    initial(user) {
      return this.displayName(user).charAt(0).toUpperCase();
    },
  };
})();
