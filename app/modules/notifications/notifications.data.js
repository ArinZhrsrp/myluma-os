// LUMA — Supabase helpers for in-app notifications (luma.notifications).
// Rows are created by database triggers; the client only reads, marks as read
// and deletes. Depends on luma-auth.js. Requires supabase/migrations/008_notifications.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const client = window.LumaAuth.client;
  const db = () => client.schema("luma");
  const COLS = "id, type, title, body, link, read_at, created_at";
  const COLS_REF = COLS + ", ref"; // ref (the contact a nudge refers to) arrives with migration 009

  window.LumaNotifications = {
    // newest first, at most PAGE (50) rows per call. `before` (an ISO time) continues after the last row of the previous page:
    // it uses "at or before" so rows that share the same second are not skipped (the caller drops the ones it already has)
    PAGE: 50,
    async list(limit = 50, before = null, strict = false) {
      limit = Math.min(Math.max(+limit || 50, 1), 50);
      const q = (cols) => { let r = db().from("notifications").select(cols).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit); if (before) r = strict ? r.lt("created_at", before) : r.lte("created_at", before); return r; };
      const res = await q(COLS_REF);
      return res.error ? q(COLS) : res; // fall back when 009 hasn't been run yet
    },
    // how many notifications the person has in all, and how many are unread (two cheap count queries, no rows)
    async counts() {
      const [a, b] = await Promise.all([
        db().from("notifications").select("id", { count: "exact", head: true }),
        db().from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      ]);
      return a.error || b.error ? null : { total: a.count || 0, unread: b.count || 0 };
    },
    async markRead(id) {
      return db().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null);
    },
    async markAllRead() {
      return db().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    },
    // Marks every unread message/nudge notification for one conversation as read
    // (used when that chat is opened). Needs migration 009's ref column.
    async markContactRead(contactId) {
      return db().from("notifications").update({ read_at: new Date().toISOString() })
        .eq("ref", contactId).in("type", ["message", "nudge"]).is("read_at", null);
    },
    // ----- Web Push subscriptions (needs migration 014) -----
    // sub = PushSubscription.toJSON(); a re-subscribe on the same device replaces the old row
    async savePushSubscription(sub) {
      await db().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      return db().from("push_subscriptions").insert({
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: (navigator.userAgent || "").slice(0, 200),
      });
    },
    async removePushSubscription(endpoint) {
      return db().from("push_subscriptions").delete().eq("endpoint", endpoint);
    },
    async remove(id) {
      return db().from("notifications").delete().eq("id", id);
    },

    // onChange({ type: 'INSERT'|'UPDATE'|'DELETE', row }) fires for this user's rows
    subscribe(userId, onChange) {
      return client
        .channel("luma-notifications-" + userId)
        .on(
          "postgres_changes",
          { event: "*", schema: "luma", table: "notifications", filter: "user_id=eq." + userId },
          (p) => onChange({ type: p.eventType, row: p.eventType === "DELETE" ? p.old : p.new })
        )
        .subscribe();
    },
    unsubscribe(channel) {
      if (channel) client.removeChannel(channel);
    },
  };
})();
