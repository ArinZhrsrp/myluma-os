const { boot } = require('./pg_boot.js');
const U1 = '00000000-0000-0000-0000-000000000001', U2 = '00000000-0000-0000-0000-000000000002', U3 = '00000000-0000-0000-0000-000000000003';
let pass = 0, fail = 0; const failed = [];
const ok = (name, cond, extra) => { if (cond) { pass++; } else { fail++; failed.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗', name, extra || ''); } };
(async () => {
  const { db, problems } = await boot({ verbose: false });
  ok('all migrations apply', problems.length === 0, problems.map(p => p[0] + ': ' + p[1]).join('; ').slice(0, 300));
  const as = async (uid, sql, params) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false), set_config('request.jwt.claim.role', 'authenticated', false);`); try { return await db.query(sql, params); } finally { await db.exec('reset role'); } };
  const err = async (uid, sql, params) => { try { await as(uid, sql, params); return null; } catch (e) { return e.message; } };
  const sup = async (sql, params) => { await db.exec("select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)"); return db.query(sql, params); };   // superuser (the server jobs)
  for (const [id, em, fn] of [[U1, 'shirin@x.com', 'Shirin'], [U2, 'aina@x.com', 'Aina'], [U3, 'ben@x.com', 'Ben']]) {
    await sup(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3::jsonb)`, [id, em, JSON.stringify({ first_name: fn })]);
  }
  const prof = await sup('select id, plan from luma.profiles order by email'); ok('profiles are created for new users', prof.rows.length === 3, JSON.stringify(prof.rows));
  await sup(`insert into luma.admin_users (user_id) values ($1)`, [U1]);
  await sup(`insert into luma.contacts (requester_id, addressee_id, status) values ($1,$2,'accepted'), ($1,$3,'accepted')`, [U1, U2, U3]);

  // ---------- add-on gating ----------
  let e = await err(U1, `insert into luma.study_courses (name) values ('Calculus')`); ok('no add-on → cannot add a subject', !!e, e);
  let r = await as(U1, `select luma.admin_set_addon($1, 'study', true, 1)`, [U1]); ok('admin switches Study on (1 month)', r.rows.length === 1);
  r = await as(U1, 'select luma.my_limits() as m'); ok('my_limits lists study + plan_expires_at key', r.rows[0].m.addons.includes('study') && 'plan_expires_at' in r.rows[0].m, JSON.stringify(r.rows[0].m).slice(0, 200));
  e = await err(U1, `insert into luma.study_courses (name) values ('Calculus')`); ok('Study on but no active semester → "Activate a semester first"', !!e && /Activate a semester first/.test(e), e);

  // ---------- semesters: only one active ----------
  const sem1 = (await as(U1, `insert into luma.study_semesters (name, start_date, end_date) values ('Sem 1', current_date - 20, current_date + 80) returning id`)).rows[0].id;
  const sem2 = (await as(U1, `insert into luma.study_semesters (name, start_date, end_date) values ('Sem 2', current_date + 100, current_date + 200) returning id`)).rows[0].id;
  e = await err(U1, `update luma.study_semesters set is_active = true where id = $1`, [sem1]); const direct = await sup('select is_active from luma.study_semesters where id = $1', [sem1]); ok('direct update cannot activate (protected flag)', direct.rows[0].is_active === false);
  await as(U1, `select luma.activate_study_semester($1)`, [sem1]);
  e = await err(U1, `select luma.activate_study_semester($1)`, [sem2]); ok('second activation refused while one is active', !!e && /only one semester/i.test(e), e);
  const act = await sup('select name from luma.study_semesters where is_active'); ok('exactly one active semester', act.rows.length === 1 && act.rows[0].name === 'Sem 1');

  // ---------- subjects, classes, assignments land in the active semester ----------
  const c1 = (await as(U1, `insert into luma.study_courses (name, credit_hours, color) values ('Calculus', 4, '#34d399') returning id, semester_id`)).rows[0]; ok('new subject goes into the active semester automatically', c1.semester_id === sem1);
  const c2 = (await as(U1, `insert into luma.study_courses (name, credit_hours) values ('Physics', 3) returning id`)).rows[0].id;
  const k1 = (await as(U1, `insert into luma.study_classes (course_id, weekday, start_time, end_time, start_date, end_date) values ($1, 1, '09:00', '10:30', current_date, current_date + 60) returning id`, [c1.id])).rows[0].id;
  e = await err(U1, `insert into luma.study_classes (course_id, weekday, start_time, end_time) values ($1, 1, '11:00', '10:00')`, [c1.id]); ok('class must end after it starts', !!e);
  await as(U1, `insert into luma.study_class_skips (class_id, skip_date) values ($1, current_date + 7)`, [k1]);
  await as(U1, `insert into luma.study_breaks (name, start_date, end_date) values ('Break', current_date + 14, current_date + 20)`);
  const t1 = (await as(U1, `insert into luma.study_tasks (course_id, title, kind, due_date, due_time, weight, status, remind_at) values ($1, 'ER report', 'assignment', current_date + 3, '23:59', 20, 'todo', now() + interval '1 day') returning id, semester_id`, [c1.id])).rows[0]; ok('assignment gets the active semester', t1.semester_id === sem1);
  await as(U1, `insert into luma.study_tasks (course_id, title, kind, due_date, status) values ($1, 'Old overdue', 'quiz', current_date - 2, 'todo')`, [c1.id]);
  const n1 = (await as(U1, `insert into luma.study_notes (course_id, title, body) values ($1, 'ER basics', 'entities') returning id, semester_id`, [c1.id])).rows[0]; ok('note gets the active semester', n1.semester_id === sem1);
  // other people cannot see it
  r = await as(U2, 'select count(*)::int as n from luma.study_courses'); ok("another user cannot read my subjects (RLS)", r.rows[0].n === 0);
  e = await err(U2, `update luma.study_courses set name = 'hacked' where id = $1`, [c1.id]); const still = await sup('select name from luma.study_courses where id = $1', [c1.id]); ok('another user cannot change my subject', still.rows[0].name === 'Calculus');

  // ---------- spaces (Work / Study keep their items) ----------
  const rem = (await as(U1, `insert into luma.reminders (title, start_date, remind_time, space) values ('study reminder', current_date + 1, '09:00', 'study') returning id, space, semester_id`)).rows[0]; ok('a reminder made in Study mode keeps space=study and the semester', rem.space === 'study' && rem.semester_id === sem1, JSON.stringify(rem));
  const rem2 = (await as(U2, `insert into luma.reminders (title, start_date, remind_time, space) values ('sneaky', current_date + 1, '09:00', 'study') returning space`)).rows[0]; ok('without the add-on a "study" tag is downgraded to personal', rem2.space === 'personal');

  // ---------- server jobs run ----------
  for (const fn of ['run_study_reminders', 'run_class_reminders', 'run_group_task_reminders', 'run_plan_expiry', 'run_event_reminders', 'run_morning_reminders', 'run_weekly_review']) {
    try { await sup(`select luma.${fn}()`); ok(`job ${fn}() runs`, true); } catch (x) { ok(`job ${fn}() runs`, false, x.message); }
  }
  // a custom reminder fires: due-today task with a near time makes a notification for the owner
  await sup(`update luma.study_tasks set due_date = (now() at time zone 'Asia/Kuala_Lumpur')::date, due_time = ((now() at time zone 'Asia/Kuala_Lumpur') + interval '20 minutes')::time where id = $1`, [t1.id]);
  await sup(`select luma.run_study_reminders()`); const nt = await sup(`select title from luma.notifications where user_id = $1 and type = 'reminder_study'`, [U1]); ok('a timed item due in 20 min is reminded now', nt.rows.length >= 1, JSON.stringify(nt.rows));
  await sup(`update luma.study_tasks set remind_at = now() - interval '1 minute', reminded_at = null where id = $1`, [t1.id]); await sup('select luma.run_study_reminders()');
  const custom = await sup(`select reminded_at from luma.study_tasks where id = $1`, [t1.id]); ok('the extra reminder fires once and is marked', custom.rows[0].reminded_at !== null);

  // ---------- archive ----------
  await as(U1, `select luma.archive_study_semester($1, 'Went well')`, [sem1]);
  const arch = await sup('select archived_at, is_active, remark from luma.study_semesters where id = $1', [sem1]); ok('archive sets archived_at, clears active, keeps the remark', arch.rows[0].archived_at && !arch.rows[0].is_active && arch.rows[0].remark === 'Went well');
  const cs = await sup('select count(*)::int as n from luma.study_courses where semester_id = $1 and archived', [sem1]); ok('its subjects are archived', cs.rows[0].n === 2);
  const rr = await sup('select active from luma.reminders where id = $1', [rem.id]); ok('its reminders are switched off', rr.rows[0].active === false);
  e = await err(U1, `insert into luma.study_courses (name) values ('New')`); ok('after archiving, adding needs a new active semester', !!e && /Activate a semester first/.test(e));
  await as(U1, `select luma.activate_study_semester($1)`, [sem2]); ok('next semester can be activated', true);
  r = await as(U1, `select luma.restore_study_semester($1) as s`, [sem1]); ok('restoring while another is active → inactive', r.rows[0].s === 'inactive', JSON.stringify(r.rows[0]));
  await as(U1, `select luma.archive_study_semester($1, '')`, [sem1]);
  r = await as(U1, `select luma.delete_study_semester($1) as d`, [sem1]); ok('deleting an archived semester returns counts', r.rows[0].d && r.rows[0].d.subjects === 2, JSON.stringify(r.rows[0].d));
  const gone = await sup('select (select count(*) from luma.study_courses where semester_id = $1)::int a, (select count(*) from luma.study_tasks where user_id = $2)::int b, (select count(*) from luma.study_classes)::int c', [sem1, U1]); ok('everything in it is gone', gone.rows[0].a === 0 && gone.rows[0].b === 0 && gone.rows[0].c === 0, JSON.stringify(gone.rows[0]));
  e = await err(U1, `select luma.delete_study_semester($1)`, [sem2]); ok('an active (not archived) semester cannot be deleted', !!e && /archived/i.test(e), e);

  // ---------- group projects ----------
  const p1 = (await as(U1, `select luma.create_study_project('DB presentation', 'Databases', current_date + 10, '') as id`)).rows[0].id; ok('project created', !!p1);
  r = await as(U1, `select luma.invite_to_study_project($1, array[$2::uuid]) as n`, [p1, U2]); ok('invite a contact', r.rows[0].n === 1);
  e = await err(U1, `select luma.invite_to_study_project($1, array[$2::uuid])`, [p1, '00000000-0000-0000-0000-0000000000aa']); ok('cannot invite a non-contact', !!e);
  e = await err(U3, `select luma.study_project_detail($1)`, [p1]); ok('a non-member cannot open the project', !!e && /Not allowed/.test(e), e);
  r = await as(U2, `select * from luma.my_study_projects()`); ok('invited person sees the invitation (pending)', r.rows.length === 1 && r.rows[0].my_status === 'pending');
  const dpend = (await as(U2, `select luma.study_project_detail($1) as d`, [p1])).rows[0].d; ok('pending member sees no tasks or notes yet', dpend.tasks.length === 0 && dpend.project.notes === '');
  await as(U2, `select luma.respond_study_project($1, true)`, [p1]);
  const tk = (await as(U1, `select luma.add_study_project_task($1, 'Draw ER', $2, current_date + 2) as id`, [p1, U2])).rows[0].id; ok('task assigned to a member', !!tk);
  e = await err(U1, `select luma.add_study_project_task($1, 'x', $2, null)`, [p1, U3]); ok('cannot assign to someone not on the project', !!e);
  await as(U2, `select luma.update_study_project_task($1, '{"status":"done"}'::jsonb)`, [tk]);
  await as(U2, `select luma.add_project_comment($1, 'Done!')`, [p1]); r = await as(U1, `select * from luma.project_comments($1)`, [p1]); ok('comment visible to the team', r.rows.length === 1 && r.rows[0].name.length > 0);
  r = await as(U1, `select luma.nudge_study_project_member($1, $2) as s`, [p1, U2]); ok('nudge sent', r.rows[0].s === 'sent');
  r = await as(U1, `select luma.nudge_study_project_member($1, $2) as s`, [p1, U2]); ok('second nudge within 6 hours refused', r.rows[0].s === 'too_soon');
  // files
  const doc = (await as(U1, `insert into luma.documents (name, mime_type, size_bytes, storage_path) values ('slides.pdf', 'application/pdf', 1200, $1) returning id`, [U1 + '/slides.pdf'])).rows[0].id;
  await as(U1, `select luma.attach_project_file($1, $2)`, [p1, doc]); let sh = await sup('select count(*)::int n from luma.document_shares where document_id = $1 and shared_with = $2', [doc, U2]); ok('attaching a file shares it with the team', sh.rows[0].n === 1);
  r = await as(U2, `select * from luma.project_files($1)`, [p1]); ok('a teammate lists the project files', r.rows.length === 1 && r.rows[0].name === 'slides.pdf');
  const f1 = r.rows[0].id; await as(U1, `select luma.detach_project_file($1)`, [f1]); sh = await sup('select count(*)::int n from luma.document_shares where document_id = $1 and shared_with = $2', [doc, U2]); ok('detaching removes the sharing again', sh.rows[0].n === 0);
  await as(U1, `select luma.attach_project_file($1, $2)`, [p1, doc]); await as(U2, `select luma.leave_study_project($1, $2)`, [p1, U2]); sh = await sup('select count(*)::int n from luma.document_shares where document_id = $1 and shared_with = $2', [doc, U2]); ok('leaving the project removes the sharing', sh.rows[0].n === 0);
  r = await as(U3, `select luma.create_study_project('Classmate project', '', null, '') as id`); ok('a person without the add-on can start a project', !!r.rows[0].id);
  await as(U1, `select luma.delete_study_project($1)`, [p1]); r = await sup('select count(*)::int n from luma.document_shares where document_id = $1', [doc]); ok('deleting the project cleans the file sharing', r.rows[0].n === 0);
  await sup(`update luma.study_project_tasks set due_date = current_date`); try { await sup('select luma.run_group_task_reminders()'); ok('group task reminder job runs with data', true); } catch (x) { ok('group task reminder job runs with data', false, x.message); }

  // ---------- notes: share (read / edit) and files ----------
  const sn = (await as(U1, `select luma.activate_study_semester($1)`, [sem2]).catch(() => null), (await as(U1, `insert into luma.study_notes (title, body) values ('Shared note', 'v1') returning id`)).rows[0].id);
  await as(U1, `select luma.share_study_note($1, array[$2::uuid], false)`, [sn, U2]);
  e = await err(U2, `select luma.update_shared_study_note($1, 'x', 'hack')`, [sn]); ok('a reader cannot edit', !!e && /only read/i.test(e), e);
  await as(U1, `select luma.set_study_note_edit($1, $2, true)`, [sn, U2]); await as(U2, `select luma.update_shared_study_note($1, 'Shared note', 'v2 by Aina')`, [sn]);
  r = await as(U1, `select body from luma.study_notes where id = $1`, [sn]); ok('an editor can change the note', r.rows[0].body === 'v2 by Aina');
  r = await as(U2, `select * from luma.shared_study_notes()`); ok('shared notes list shows can_edit', r.rows.length === 1 && r.rows[0].can_edit === true);
  e = await err(U2, `select * from luma.study_notes`); r = await as(U2, 'select count(*)::int n from luma.study_notes'); ok('the table itself stays private to the owner', r.rows[0].n === 0);
  await as(U1, `select luma.attach_note_file($1, $2)`, [sn, doc]); sh = await sup('select count(*)::int n from luma.document_shares where document_id = $1 and shared_with = $2', [doc, U2]); ok('a file on a shared note is shared with the readers', sh.rows[0].n === 1);
  await as(U1, `select luma.unshare_study_note($1, $2)`, [sn, U2]); sh = await sup('select count(*)::int n from luma.document_shares where document_id = $1 and shared_with = $2', [doc, U2]); ok('stopping sharing removes the file access', sh.rows[0].n === 0);

  // ---------- calendar invitations ----------
  const ev = (await as(U1, `insert into luma.events (title, category, event_date, all_day, start_time, end_time, repeats, note) values ('Study group', 'Meeting', current_date + 1, false, '16:00', '17:00', 'none', '') returning id`)).rows[0].id;
  await as(U1, `select luma.invite_to_event($1, array[$2::uuid])`, [ev, U2]); r = await as(U2, 'select * from luma.my_invited_events()'); ok('an invited person sees the event', r.rows.length === 1 && r.rows[0].my_status === 'pending');
  await as(U2, `select luma.respond_event_invite($1, true)`, [ev]); r = await as(U1, `select * from luma.event_attendees($1)`, [ev]); ok('attendees list includes the owner and the guest', r.rows.length === 2);

  // ---------- plan expiry ----------
  r = await as(U1, `select luma.admin_set_plan($1, 'glow', 1) as p`, [U2]); const end1 = await sup('select plan, plan_expires_at from luma.profiles where id = $1', [U2]); ok('admin sets Glow for 1 month', end1.rows[0].plan === 'glow' && end1.rows[0].plan_expires_at);
  const before = new Date(end1.rows[0].plan_expires_at); await as(U1, `select luma.admin_set_plan($1, 'glow', 2, null, true)`, [U2]); const end2 = await sup('select plan_expires_at from luma.profiles where id = $1', [U2]);
  ok('"add time" extends from the current end date', new Date(end2.rows[0].plan_expires_at) - before > 55 * 864e5, String(end2.rows[0].plan_expires_at));
  e = await err(U2, `update luma.profiles set plan = 'zenith', plan_expires_at = null where id = $1`, [U2]); const still2 = await sup('select plan from luma.profiles where id = $1', [U2]); ok('a user cannot give themselves a plan or change its end', still2.rows[0].plan === 'glow');
  e = await err(U3, `select luma.admin_set_plan($1, 'zenith', 1)`, [U3]); ok('only admins can set plans', !!e && /Not allowed/.test(e), e);
  await sup(`update luma.profiles set plan_expires_at = now() - interval '1 hour' where id = $1`, [U2]); await sup('select luma.run_plan_expiry()'); const dn = await sup('select plan, plan_expires_at from luma.profiles where id = $1', [U2]); ok('an ended plan returns to Dawn', dn.rows[0].plan === 'dawn' && dn.rows[0].plan_expires_at === null);
  const nn = await sup(`select title from luma.notifications where user_id = $1 and title like 'Your Glow plan has ended%'`, [U2]); ok('and the person is told', nn.rows.length === 1);
  r = await as(U1, `select * from luma.admin_list_users()`); ok('admin list returns plan_expires_at and addon_expiry', r.rows.length === 3 && 'plan_expires_at' in r.rows[0] && 'addon_expiry' in r.rows[0]);

  const hh = await as(U2, `select kind, item, action from luma.purchase_history order by created_at, action`); const acts = hh.rows.map(x => x.kind + ':' + x.item + ':' + x.action).join(',');
  ok('history records plan start, extension and end for the user', ['plan:glow:started', 'plan:glow:extended', 'plan:glow:ended'].every(k => acts.includes(k)), acts);
  const h1 = await as(U1, `select kind, item, action from luma.purchase_history`); ok('admin add-on switch-on is recorded', h1.rows.some(x => x.item === 'study' && x.action === 'started'), JSON.stringify(h1.rows));
  ok("another person's history is not visible", (await as(U3, `select 1 from luma.purchase_history where user_id <> '${U3}'`)).rows.length === 0);
  await sup(`select luma.admin_set_addon('${U3}','work',false)`).catch(() => {});
  console.log(`\n${pass} checks passed, ${fail} failed`); if (failed.length) console.log(failed.map(f => ' - ' + f).join('\n'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('RUNNER ERROR', e.stack.split('\n').slice(0, 5).join(' | ')); process.exit(2); });
