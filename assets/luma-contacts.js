// LUMA — shared Supabase helpers for real contacts (request/accept) and
// 1:1 chat between users. Depends on luma-auth.js having already run
// (reuses its client rather than creating a second one).

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const client = window.LumaAuth.client;
  const db = () => client.schema("luma");

  const FOLLOWUP_DAYS = 7;

  window.LumaContacts = {
    FOLLOWUP_DAYS,

    // { data: {ok, reason, contact_id, other_id, other_first_name, other_last_name}, error }
    async requestByEmail(email) {
      const { data, error } = await db().rpc("request_contact", { p_email: email });
      if (error) return { data: null, error };
      return { data: (data && data[0]) || null, error: null };
    },

    // Flat list of every pending/accepted contact row involving the caller,
    // with the other participant's name/email already joined in.
    async listContacts() {
      return db().rpc("list_contacts");
    },

    // Sends the other person a "nudge" notification (needs migration 009).
    // { data: { ok, reason: 'sent'|'not_found'|'too_soon', retry_after }, error }
    async nudge(contactId) {
      const { data, error } = await db().rpc("nudge_contact", { p_contact: contactId });
      if (error) return { data: null, error };
      return { data: (data && data[0]) || null, error: null };
    },

    async acceptRequest(contactId) {
      return db().from("contacts").update({ status: "accepted" }).eq("id", contactId).select().single();
    },

    async declineRequest(contactId) {
      return db().from("contacts").update({ status: "declined" }).eq("id", contactId).select().single();
    },

    // Cancels an outgoing pending request, or removes an accepted contact
    // (cascades to that contact's messages).
    async removeContact(contactId) {
      return db().from("contacts").delete().eq("id", contactId);
    },

    async listMessages(contactId) {
      return db().from("messages").select("id, sender_id, body, created_at").eq("contact_id", contactId).order("created_at", { ascending: true });
    },

    async sendMessage(contactId, body) {
      const { data: { session } } = await client.auth.getSession();
      if (!session) return { data: null, error: { message: "Not signed in" } };
      return db().from("messages").insert({ contact_id: contactId, sender_id: session.user.id, body }).select().single();
    },

    // Marks this conversation as read as of now, for the caller only.
    // Call it whenever the caller actually views the chat — opening it,
    // or receiving a message while it's already open — so has_unread from
    // listContacts() clears for this contact.
    async markRead(contactId) {
      const { data: { session } } = await client.auth.getSession();
      if (!session) return { data: null, error: { message: "Not signed in" } };
      return db().from("message_reads").upsert(
        { contact_id: contactId, user_id: session.user.id, last_read_at: new Date().toISOString() },
        { onConflict: "contact_id,user_id" }
      );
    },

    // Realtime: fires onInsert(messageRow) for every new message on this
    // conversation. Returns the channel — pass it to unsubscribe() when the
    // chat closes so the subscription doesn't leak.
    subscribeToMessages(contactId, onInsert) {
      return client
        .channel("luma-messages-" + contactId)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "luma", table: "messages", filter: "contact_id=eq." + contactId },
          (payload) => onInsert(payload.new)
        )
        .subscribe();
    },

    unsubscribe(channel) {
      if (channel) client.removeChannel(channel);
    },

    // A contact needs a follow-up nudge if the pair has never messaged, or
    // hasn't in FOLLOWUP_DAYS — matches the "Lumi noticed" copy in the UI.
    needsFollowUp(row) {
      if (!row || row.status !== "accepted") return false;
      if (!row.last_message_at) return true;
      const days = (Date.now() - new Date(row.last_message_at).getTime()) / 86400000;
      return days >= FOLLOWUP_DAYS;
    },

    // True when the other person's latest message hasn't been read yet
    // (has_unread, computed server-side in list_contacts() from
    // luma.message_reads) — a stronger, more urgent nudge than needsFollowUp.
    hasUnread(row) {
      return !!(row && row.status === "accepted" && row.has_unread);
    },

    // Coarse "time ago" for contact rows/follow-up copy — matches the
    // mock's granularity ("Today", "2 days", "3 weeks", "1 month").
    relativeTime(dateStr) {
      if (!dateStr) return null;
      const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
      if (days <= 0) return "Today";
      if (days === 1) return "Yesterday";
      if (days < 7) return days + " days";
      if (days < 30) return Math.round(days / 7) + (Math.round(days / 7) === 1 ? " week" : " weeks");
      return Math.round(days / 30) + (Math.round(days / 30) === 1 ? " month" : " months");
    },
  };
})();
