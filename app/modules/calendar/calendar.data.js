// LUMA — Supabase helpers for the Calendar. Depends on luma-auth.js
// (reuses its client). Requires supabase/migrations/027_events.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COLS = "id, title, category, event_date, all_day, start_time, end_time, repeats, note, created_at";

  window.LumaEvents = {
    async list() {
      return db().from("events").select(COLS).order("event_date", { ascending: true }).limit(5000);
    },
    // user_id defaults to auth.uid() in the database
    async add(fields) {
      return db().from("events").insert(fields).select(COLS).single();
    },
    async update(id, fields) {
      return db().from("events").update(fields).eq("id", id).select(COLS).single();
    },
    async remove(id) {
      return db().from("events").delete().eq("id", id);
    },
    // ---- invitations (migration 048): invite your contacts, accept / decline, see who is on an event ----
    invited: () => db().rpc("my_invited_events"),
    invite: (eventId, userIds) => db().rpc("invite_to_event", { p_event: eventId, p_users: userIds }),
    respond: (eventId, accept) => db().rpc("respond_event_invite", { p_event: eventId, p_accept: accept }),
    uninvite: (eventId, userId) => db().rpc("uninvite_from_event", { p_event: eventId, p_user: userId }),
    attendees: (eventId) => db().rpc("event_attendees", { p_event: eventId }),
  };
})();
