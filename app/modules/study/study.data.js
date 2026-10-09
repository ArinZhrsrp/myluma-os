// LUMA — Supabase helpers for the Study add-on. Depends on luma-auth.js (reuses its client).
// Requires supabase/migrations/044_addons.sql and 045_study.sql (+ 047 class dates, 049 semesters / marks).
// Columns added by a later migration are optional: until that migration has run the app falls back to the older columns.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }

  const db = () => window.LumaAuth.client.schema("luma");
  const COURSE_BASE = "id, name, code, color, lecturer, credit_hours, archived, created_at";
  const CLASS_BASE = "id, course_id, weekday, start_time, end_time, room, kind, created_at";
  const TASK = "id, course_id, title, kind, due_date, due_time, weight, score, max_score, status, notes, completed_at, created_at";
  const SEMESTER = "id, name, start_date, end_date, created_at";

  // the same calls for each table; user_id defaults to auth.uid() in the database.
  // `extra` = columns a later migration added: tried first, left out again if the database doesn't have them yet.
  const table = (name, base, order, extra = []) => {
    const cols = extra.length ? base + ", " + extra.join(", ") : base;
    const missing = new RegExp(extra.concat(["schema cache"]).join("|"), "i");
    const strip = (f) => { const g = Array.isArray(f) ? f.map(strip) : { ...f }; if (!Array.isArray(g)) extra.forEach((c) => delete g[c]); return g; };
    const retry = (r, again) => (r.error && extra.length && missing.test(r.error.message) ? again() : r);
    return {
      async list() { return retry(await db().from(name).select(cols).order(order, { ascending: true }), () => db().from(name).select(base).order(order, { ascending: true })); },
      async add(f) { return retry(await db().from(name).insert(f).select(cols).single(), () => db().from(name).insert(strip(f)).select(base).single()); },
      async addMany(rows) { return retry(await db().from(name).insert(rows).select(cols), () => db().from(name).insert(strip(rows)).select(base)); },
      async update(id, f) { return retry(await db().from(name).update(f).eq("id", id).select(cols).single(), () => db().from(name).update(strip(f)).eq("id", id).select(base).single()); },
      remove: (id) => db().from(name).delete().eq("id", id),
    };
  };

  window.LumaStudy = {
    courses: table("study_courses", COURSE_BASE, "created_at", ["semester_id", "target_percent", "final_percent", "grade_scale", "attendance_target"]),
    classes: table("study_classes", CLASS_BASE, "start_time", ["start_date", "end_date"]),
    tasks: table("study_tasks", TASK, "due_date", ["semester_id", "remind_at", "reminded_at"]),
    semesters: Object.assign(table("study_semesters", SEMESTER, "start_date", ["archived_at", "is_active", "remark", "grade_scale"]), {
      // one semester is active at a time; these functions (migration 056) are the only way to change that
      activate: (id) => db().rpc("activate_study_semester", { p_id: id }),
      archive: (id, remark) => db().rpc("archive_study_semester", { p_id: id, p_remark: remark || "" }),
      restore: (id) => db().rpc("restore_study_semester", { p_id: id }),
      destroy: (id) => db().rpc("delete_study_semester", { p_id: id }), // deletes an archived semester and everything in it (migration 057)
    }),
    // cancelled single sessions and break weeks / holidays (migration 052)
    skips: table("study_class_skips", "id, class_id, skip_date", "skip_date"),
    breaks: table("study_breaks", "id, name, start_date, end_date", "start_date"),
    // notes per subject, shareable with contacts (migration 053)
    notes: Object.assign(table("study_notes", "id, course_id, title, body, created_at, updated_at", "updated_at", ["semester_id"]), {
      shared: () => db().rpc("shared_study_notes"),
      sharedWith: (id) => db().rpc("study_note_shared_with", { p_note: id }),
      share: (id, users, canEdit) => db().rpc("share_study_note", { p_note: id, p_users: users, p_can_edit: !!canEdit }),
      setEdit: (id, user, canEdit) => db().rpc("set_study_note_edit", { p_note: id, p_user: user, p_can_edit: !!canEdit }),
      updateShared: (id, title, body) => db().rpc("update_shared_study_note", { p_note: id, p_title: title, p_body: body }),
      files: (id) => db().rpc("note_files", { p_note: id }),
      attach: (id, documentId) => db().rpc("attach_note_file", { p_note: id, p_document: documentId }),
      detach: (fileId) => db().rpc("detach_note_file", { p_file: fileId }),
      unshare: (id, user) => db().rpc("unshare_study_note", { p_note: id, p_user: user }),
    }),
    // group projects (migration 054): everything goes through functions that check who is asking
    groups: {
      list: () => db().rpc("my_study_projects"),
      detail: (id) => db().rpc("study_project_detail", { p_project: id }),
      create: (title, course, due, notes) => db().rpc("create_study_project", { p_title: title, p_course: course || "", p_due: due || null, p_notes: notes || "" }),
      update: (id, fields) => db().rpc("update_study_project", { p_project: id, p_fields: fields }),
      remove: (id) => db().rpc("delete_study_project", { p_project: id }),
      invite: (id, users) => db().rpc("invite_to_study_project", { p_project: id, p_users: users }),
      respond: (id, accept) => db().rpc("respond_study_project", { p_project: id, p_accept: accept }),
      leave: (id, user) => db().rpc("leave_study_project", { p_project: id, p_user: user }),
      addTask: (id, title, assignee, due) => db().rpc("add_study_project_task", { p_project: id, p_title: title, p_assignee: assignee || null, p_due: due || null }),
      updateTask: (taskId, fields) => db().rpc("update_study_project_task", { p_task: taskId, p_fields: fields }),
      removeTask: (taskId) => db().rpc("delete_study_project_task", { p_task: taskId }),
      comments: (id) => db().rpc("project_comments", { p_project: id }),
      addComment: (id, body) => db().rpc("add_project_comment", { p_project: id, p_body: body }),
      removeComment: (commentId) => db().rpc("delete_project_comment", { p_comment: commentId }),
      files: (id) => db().rpc("project_files", { p_project: id }),
      attach: (id, documentId) => db().rpc("attach_project_file", { p_project: id, p_document: documentId }),
      detach: (fileId) => db().rpc("detach_project_file", { p_file: fileId }),
      nudge: (id, user, task) => db().rpc("nudge_study_project_member", { p_project: id, p_user: user, p_task: task || null }),
    },
    rpc: (name, args) => db().rpc(name, args),
    // attendance per class and date (migration 067)
    attendance: Object.assign(table("study_attendance", "id, class_id, course_id, att_date, status", "att_date", ["semester_id"]), {
      set: (rows) => db().from("study_attendance").upsert(rows, { onConflict: "class_id,att_date" }).select("id, class_id, course_id, att_date, status"),
      clear: (classId, date) => db().from("study_attendance").delete().eq("class_id", classId).eq("att_date", date),
    }),
    // flashcards (migration 067)
    decks: table("study_decks", "id, course_id, title, created_at", "created_at", ["semester_id"]),
    cards: Object.assign(table("study_cards", "id, deck_id, front, back, ease, interval_days, reps, lapses, due_on, last_reviewed_at, created_at", "created_at"), {
      inDeck: (deckId) => db().from("study_cards").select("id, deck_id, front, back, ease, interval_days, reps, lapses, due_on, last_reviewed_at, created_at").eq("deck_id", deckId).order("created_at", { ascending: true }).limit(600),
    }),
    // focus sessions tagged with a subject since a moment (for "study time")
    focusSince: (iso) => db().from("focus_sessions").select("minutes, course_id, started_at").gte("started_at", iso),
  };
})();
