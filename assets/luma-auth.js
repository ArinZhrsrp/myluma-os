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

  // The session always lives in sessionStorage: a page refresh keeps you signed
  // in, but closing the tab or killing the app signs you out, so LUMA reopens on
  // the Login page. (The "Remember me" checkbox only remembers the email address.)
  const REMEMBER_KEY = "luma.remember";
  const remembered = () => false;
  const authStorage = {
    getItem: (k) => sessionStorage.getItem(k),
    setItem: (k, v) => sessionStorage.setItem(k, v),
    removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
  };

  const client = window.supabase.createClient(window.LUMA_SUPABASE_URL, window.LUMA_SUPABASE_ANON_KEY, {
    auth: { storage: authStorage },
  });

  window.LumaAuth = {
    client,

    async signUp({ firstName, lastName, email, password }) {
      return client.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName } },
      });
    },

    // The session ends when the tab/app is closed whatever `remember` is; it only
    // decides whether the Login page pre-fills the email next time.
    async signIn({ email, password, remember = true }) {
      this.setRemember(remember);
      const res = await client.auth.signInWithPassword({ email, password });
      if (res.error) return res;
      // drop any stale copy of the session left in the other storage
      Object.keys(localStorage).filter((k) => k.startsWith("sb-")).forEach((k) => localStorage.removeItem(k));
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
