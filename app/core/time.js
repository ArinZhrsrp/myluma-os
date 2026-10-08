// LUMA — core: time
    // ---------- App time zone ----------
    // Every date and time in the app (greeting, calendar, reminders, "today") uses this zone, whatever the browser's own is.
    // It is the time zone chosen at sign-up / in Edit profile (Malaysia, UTC+8, until one is chosen). The helper names
    // below still start with "myt" for historical reasons.
    let MYT = LumaAuth.DEFAULT_TIMEZONE;
    const tzOffsetLabel = () => LumaAuth.tzOffset(MYT); // "GMT+08:00"
    function setAppTimezone(tz) { if (tz && LumaAuth.isValidTimezone(tz)) MYT = tz; }
    function mytHour() {
      return parseInt(new Intl.DateTimeFormat("en-GB", { timeZone: MYT, hour: "2-digit", hourCycle: "h23" }).format(new Date()), 10);
    }
    function mytTopbarDate() {
      return new Intl.DateTimeFormat("en-GB", { timeZone: MYT, day: "numeric", month: "short", year: "numeric" }).format(new Date());
    }
    // "7 Oct 2026, 3:45 PM" in the app time zone, for upload / created / updated stamps
    function mytDateTime(iso) {
      if (!iso) return "";
      const d = new Date(iso);
      return new Intl.DateTimeFormat("en-GB", { timeZone: MYT, day: "numeric", month: "short", year: "numeric" }).format(d)
        + ", " + new Intl.DateTimeFormat("en-US", { timeZone: MYT, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
    }
    function mytGreetingLine() {
      const day = new Intl.DateTimeFormat("en-GB", { timeZone: MYT, weekday: "long" }).format(new Date());
      const date = new Intl.DateTimeFormat("en-GB", { timeZone: MYT, day: "numeric", month: "long" }).format(new Date());
      const time = new Intl.DateTimeFormat("en-US", { timeZone: MYT, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date());
      return day + " · " + date + " · " + time;
    }
