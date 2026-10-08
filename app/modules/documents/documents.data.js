// LUMA — Supabase helpers for the Documents module (metadata in
// luma.documents / luma.document_categories, files in the private
// "luma-documents" Storage bucket). Depends on luma-auth.js.
// Requires supabase/migrations/003_documents.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const client = window.LumaAuth.client;
  const db = () => client.schema("luma");
  const BUCKET = "luma-documents";
  const MAX_BYTES = 50 * 1024 * 1024; // the hard ceiling; each plan has its own (smaller) file size and storage limits
  const DOC_COLS = "id, category_id, name, mime_type, size_bytes, storage_path, created_at";

  window.LumaDocuments = {
    MAX_BYTES,

    // ----- categories -----
    async listCategories() {
      return db().from("document_categories").select("id, name, parent_id, color").order("created_at", { ascending: true });
    },
    // parentId nests it inside another category (null = top level)
    async addCategory(name, parentId = null, color = null) {
      return db().from("document_categories").insert({ name: name.trim(), parent_id: parentId, color }).select("id, name, parent_id, color").single();
    },
    async renameCategory(id, name) {
      return db().from("document_categories").update({ name: name.trim() }).eq("id", id).select("id, name, parent_id, color").single();
    },
    async setCategoryColor(id, color) {
      return db().from("document_categories").update({ color }).eq("id", id).select("id, name, parent_id, color").single();
    },
    async moveCategory(id, parentId) {
      return db().from("document_categories").update({ parent_id: parentId }).eq("id", id).select("id, name, parent_id, color").single();
    },
    // Its documents become uncategorised (category_id → null) and its
    // subcategories move up to top level.
    async deleteCategory(id) {
      return db().from("document_categories").delete().eq("id", id);
    },

    // ----- documents -----
    async listDocuments() {
      return db().from("documents").select(DOC_COLS).order("created_at", { ascending: false });
    },

    // Uploads the bytes first, then records the metadata row; if the row
    // insert fails the orphaned file is removed again.
    async upload(file, { name, categoryId = null } = {}) {
      if (file.size > MAX_BYTES) return { data: null, error: { message: "File is larger than 50 MB." } };
      const plan = window.LumaPlan;
      if (plan && plan.ready) { // friendly checks up front (the database enforces the same limits)
        const fileMb = plan.get("file_mb"), storeMb = plan.get("storage_mb");
        if (fileMb !== null && file.size > fileMb * 1048576) return { data: null, error: { message: `Plan limit: the ${plan.name()} plan allows files up to ${fileMb} MB. Upgrade your plan in Settings for bigger files.` } };
        if (storeMb !== null) {
          const { data: rows } = await db().from("documents").select("size_bytes");
          const used = (rows || []).reduce((t, r) => t + Number(r.size_bytes || 0), 0);
          if (used + file.size > storeMb * 1048576) return { data: null, error: { message: `Plan limit: the ${plan.name()} plan includes ${storeMb} MB of file storage and it is full. Delete files or upgrade your plan in Settings.` } };
        }
      }
      const session = await window.LumaAuth.getSession();
      if (!session) return { data: null, error: { message: "Not signed in" } };
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${session.user.id}/${crypto.randomUUID()}-${safe}`;
      const up = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
      if (up.error) return { data: null, error: up.error };
      const res = await db().from("documents").insert({
        name: (name || file.name).trim(),
        category_id: categoryId,
        mime_type: file.type || null,
        size_bytes: file.size,
        storage_path: path,
      }).select(DOC_COLS).single();
      if (res.error) await client.storage.from(BUCKET).remove([path]);
      return res;
    },

    // fields: { name?, category_id? }
    async updateDocument(id, fields) {
      return db().from("documents").update(fields).eq("id", id).select(DOC_COLS).single();
    },

    async remove(doc) {
      const { error } = await db().from("documents").delete().eq("id", doc.id);
      if (error) return { error };
      await client.storage.from(BUCKET).remove([doc.storage_path]);
      return { error: null };
    },

    // ----- sharing (needs migration 004) -----
    // [{document_id, shared_with}] for every document the caller has shared
    async listMyShares() {
      return db().from("document_shares").select("document_id, shared_with");
    },
    // Documents others shared with the caller (read-only), owner name joined in.
    async listSharedWithMe() {
      return db().rpc("list_shared_documents");
    },
    // Recipient must be an accepted contact — enforced by the database.
    async share(documentId, userId) {
      return db().from("document_shares").insert({ document_id: documentId, shared_with: userId });
    },
    async unshare(documentId, userId) {
      return db().from("document_shares").delete().eq("document_id", documentId).eq("shared_with", userId);
    },
    // Recipient files a shared document under one of their own categories
    // (null = un-file). Needs migration 007.
    async setSharedCategory(documentId, categoryId) {
      return db().rpc("set_shared_document_category", { p_document: documentId, p_category: categoryId });
    },
    // Recipient dismisses a document someone shared with them.
    async removeSharedWithMe(documentId) {
      const session = await window.LumaAuth.getSession();
      if (!session) return { error: { message: "Not signed in" } };
      return this.unshare(documentId, session.user.id);
    },

    // Fetches the file bytes as a Blob (typed from the stored mime type or
    // the file extension) for in-app preview. A blob: URL is used rather than
    // the signed URL because Storage serves objects with a sandboxing CSP
    // that stops browsers rendering them inside an <iframe>.
    async download(doc) {
      const { data, error } = await client.storage.from(BUCKET).download(doc.storage_path);
      if (error) return { blob: null, error };
      const ext = doc.name.split(".").pop().toLowerCase();
      const type = doc.mime_type || (ext === "pdf" ? "application/pdf" : data.type);
      return { blob: new Blob([data], { type }), error: null };
    },

    // Short-lived link for viewing/downloading a private file.
    async signedUrl(doc, seconds = 120) {
      const { data, error } = await client.storage.from(BUCKET).createSignedUrl(doc.storage_path, seconds, { download: false });
      return { url: data && data.signedUrl, error };
    },

    // ----- formatting -----
    formatSize(bytes) {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
      return (bytes / 1024 / 1024).toFixed(1) + " MB";
    },
    icon(doc) {
      const m = doc.mime_type || "", n = doc.name.toLowerCase();
      if (m.startsWith("image/")) return "fa-file-image";
      if (m === "application/pdf" || n.endsWith(".pdf")) return "fa-file-pdf";
      if (/\.(docx?|pages)$/.test(n)) return "fa-file-word";
      if (/\.(xlsx?|csv|numbers)$/.test(n)) return "fa-file-excel";
      if (m.startsWith("video/")) return "fa-file-video";
      return "fa-file";
    },
  };
})();
