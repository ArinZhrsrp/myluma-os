// LUMA — Supabase helpers for the Notes & Docs module (luma.notes plus links
// to luma.documents). Depends on luma-auth.js. Requires
// supabase/migrations/005_notes.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COLS = "id, title, body, tag, created_at, updated_at, note_documents(document_id, documents(id, name, mime_type, size_bytes, storage_path, created_at))";

  // flatten the embedded links into note.docs (skips documents the user can
  // no longer see, e.g. a share that was revoked)
  const shape = (n) => ({
    ...n,
    docs: (n.note_documents || []).map((l) => l.documents).filter(Boolean),
  });

  window.LumaNotes = {
    async list() {
      const { data, error } = await db().from("notes").select(COLS).order("updated_at", { ascending: false });
      return { data: data ? data.map(shape) : null, error };
    },
    async add({ title, body, tag }) {
      const { data, error } = await db().from("notes").insert({ title, body, tag }).select(COLS).single();
      return { data: data ? shape(data) : null, error };
    },
    async update(id, fields) {
      const { data, error } = await db().from("notes").update(fields).eq("id", id).select(COLS).single();
      return { data: data ? shape(data) : null, error };
    },
    async remove(id) {
      return db().from("notes").delete().eq("id", id);
    },
    // ----- tag colours (needs migration 006) -----
    async listTagColors() {
      return db().from("note_tags").select("id, name, color");
    },
    // creates the row, or updates it when the tag already has one
    async saveTagColor(name, color, existingId = null) {
      const q = existingId
        ? db().from("note_tags").update({ color }).eq("id", existingId)
        : db().from("note_tags").insert({ name: name.trim(), color });
      return q.select("id, name, color").single();
    },
    async attach(noteId, documentId) {
      return db().from("note_documents").insert({ note_id: noteId, document_id: documentId });
    },
    async detach(noteId, documentId) {
      return db().from("note_documents").delete().eq("note_id", noteId).eq("document_id", documentId);
    },

    // "Today" / "Yesterday" / "3 days" / "2 weeks" / "12 Sep"
    relativeTime(iso) {
      const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
      if (days <= 0) return "Today";
      if (days === 1) return "Yesterday";
      if (days < 7) return days + " days";
      if (days < 30) return Math.floor(days / 7) + (days < 14 ? " week" : " weeks");
      return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
    },
  };
})();
