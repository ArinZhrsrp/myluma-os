// LUMA — Supabase helpers for the Work add-on. Depends on luma-auth.js. Requires supabase/migrations/071_work_projects.sql.

(function () {
  if (!window.LumaAuth || !window.LumaAuth.client) {
    console.error("LUMA: LumaAuth not loaded — check <script> order (luma-auth.js must come first).");
    return;
  }
  const db = () => window.LumaAuth.client.schema("luma");
  const P = "id, owner_id, name, client, color, company_id, status, deadline, kind, description, created_at, updated_at";
  // team_id comes from migration 084: until it has run the app falls back to the older columns
  const T0 = "id, project_id, title, description, status, priority, folder_id, assignee_ids, start_date, due_date, budget_minutes, position, checklist, created_by, created_at, completed_at";
  const T = T0 + ", team_id", noTeam = /team_id|schema cache/i; let teamOk = true;
  const CO = "id, name, archived_at, start_date, end_date, position, created_at";
  const TM = "id, company_id, project_id, task_id, project_name, task_title, work_date, minutes, note, label, running_since, created_at";
  const F = "id, project_id, name, notes, position, is_phase, created_at";
  window.LumaWork = {
    // the companies a person works for; archiving one freezes all its projects (migration 074)
    companies: {
      list: () => db().from("work_companies").select(CO).order("created_at", { ascending: true }),
      add: (f) => db().from("work_companies").insert(f).select(CO).single(),
      update: (id, f) => db().from("work_companies").update(f).eq("id", id).select(CO).single(),
      remove: (id) => db().from("work_companies").delete().eq("id", id),
    },
    projects: {
      list: () => db().from("work_projects").select(P).order("created_at", { ascending: true }),
      add: (f) => db().from("work_projects").insert(f).select(P).single(),
      update: (id, f) => db().from("work_projects").update(f).eq("id", id).select(P).single(),
      remove: (id) => db().from("work_projects").delete().eq("id", id),
    },
    tasks: {
      list: async () => { const q = (c) => db().from("work_tasks").select(c).order("position", { ascending: true }).order("created_at", { ascending: true }).limit(5000); let r = await q(teamOk ? T : T0); if (r.error && teamOk && noTeam.test(r.error.message)) { teamOk = false; r = await q(T0); } return r; },
      add: async (f) => { const g = { ...f }; if (!teamOk) delete g.team_id; let r = await db().from("work_tasks").insert(g).select(teamOk ? T : T0).single(); if (r.error && teamOk && noTeam.test(r.error.message)) { teamOk = false; delete g.team_id; r = await db().from("work_tasks").insert(g).select(T0).single(); } return r; },
      update: async (id, f) => { const g = { ...f }; if (!teamOk) delete g.team_id; let r = await db().from("work_tasks").update(g).eq("id", id).select(teamOk ? T : T0).single(); if (r.error && teamOk && noTeam.test(r.error.message)) { teamOk = false; delete g.team_id; r = await db().from("work_tasks").update(g).eq("id", id).select(T0).single(); } return r; },
      remove: (id) => db().from("work_tasks").delete().eq("id", id),
    },
    // phases (project) or folders (general project), each with a notes area (migration 073)
    folders: {
      list: () => db().from("work_folders").select(F).order("position", { ascending: true }).order("created_at", { ascending: true }),
      add: (f) => db().from("work_folders").insert(f).select(F).single(),
      update: (id, f) => db().from("work_folders").update(f).eq("id", id).select(F).single(),
      remove: (id) => db().from("work_folders").delete().eq("id", id),
    },
    // a task's discussion and attached documents (migration 075)
    comments: {
      list: (task) => db().rpc("work_task_comments_of", { p_task: task }),
      add: (task, body, mentions) => db().from("work_task_comments").insert({ task_id: task, body, mentions: mentions || [] }).select("id").single(),
      edit: (id, body, mentions) => db().from("work_task_comments").update({ body, mentions: mentions || [] }).eq("id", id).select("id").single(),
      history: (id) => db().rpc("work_comment_history", { p_comment: id }),
      remove: (id) => db().from("work_task_comments").delete().eq("id", id),
    },
    files: {
      list: (task) => db().rpc("work_task_files_of", { p_task: task }),
      attach: (task, doc) => db().rpc("work_attach_file", { p_task: task, p_document: doc }),
      detach: (id) => db().rpc("work_detach_file", { p_file: id }),
    },
    // your own hours, a running timer, and per-task totals (migration 076)
    time: {
      list: (from, to) => db().from("work_time_entries").select(TM).gte("work_date", from).lte("work_date", to).is("running_since", null).order("work_date", { ascending: true }).order("created_at", { ascending: true }).limit(2000),
      running: () => db().from("work_time_entries").select(TM).not("running_since", "is", null).maybeSingle(),
      add: (f) => db().from("work_time_entries").insert(f).select(TM).single(),
      update: (id, f) => db().from("work_time_entries").update(f).eq("id", id).select(TM).single(),
      remove: (id) => db().from("work_time_entries").delete().eq("id", id),
      start: (project, task, company, note, label) => db().rpc("work_timer_start", { p_project: project || null, p_task: task || null, p_company: company || null, p_note: note || "", p_label: label || "" }),
      stop: () => db().rpc("work_timer_stop"),
      summary: (project) => db().rpc("work_time_summary", { p_project: project }),
    },
    // moving a task to another project, a project to another company (migration 078), and the owner's view of the team's hours
    moveTask: (task, project) => db().rpc("work_move_task", { p_task: task, p_project: project }),
    moveProject: (project, company) => db().rpc("work_move_project", { p_project: project, p_company: company }),
    teamTime: (project, from, to) => db().rpc("work_project_time", { p_project: project, p_from: from, p_to: to }),
    // links between tasks ("waits for"), and the minutes logged per task (migration 080)
    links: {
      list: () => db().from("work_task_links").select("task_id, depends_on, project_id").limit(5000),
      set: (task, ids) => db().rpc("work_set_dependencies", { p_task: task, p_depends: ids }),
    },
    timeTotals: () => db().rpc("work_time_totals"),
    // teams of people (migration 084): only the owner changes them, through functions
    teams: {
      list: () => db().rpc("my_work_teams"),
      save: (t) => db().rpc("work_set_team", { p_id: t.id || null, p_company: t.company_id || null, p_name: t.name, p_note: t.note || "", p_color: t.color || "", p_members: t.members || [] }),
      remove: (id) => db().rpc("work_delete_team", { p_team: id }),
    },
    // people on projects: invitations go through functions that check who is asking (migration 071)
    shared: () => db().rpc("my_work_shared"),
    people: () => db().rpc("my_work_people"),
    members: (id) => db().rpc("work_project_members", { p_project: id }),
    invite: (id, users, role) => db().rpc("work_invite", { p_project: id, p_users: users, p_role: role || "member" }),
    respond: (id, accept) => db().rpc("work_respond", { p_project: id, p_accept: accept }),
    removeMember: (id, user) => db().rpc("work_remove_member", { p_project: id, p_user: user }),
    setRole: (id, user, role) => db().rpc("work_set_role", { p_project: id, p_user: user, p_role: role }),
  };
})();
