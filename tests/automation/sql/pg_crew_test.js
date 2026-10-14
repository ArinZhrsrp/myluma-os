// migration 101: the AI crew's tables (crew_runs / crew_steps), who can read them, and the "crew finished" notification
const { boot } = require('./pg_boot.js');
const [ADM, ADM2, USR] = ['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1'];
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else { fail++; console.log('  ✗', n, x || ''); } };
(async () => {
  const { db, problems } = await boot({ verbose: false }); ok('migrations apply', problems.length === 0, JSON.stringify(problems).slice(0, 300));
  const sup = async (q, p) => { await db.exec("reset role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)"); return db.query(q, p); };
  const svc = async (q, p) => { await db.exec("set role service_role; select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)"); try { return await db.query(q, p); } finally { await db.exec('reset role'); } };
  const as = async (u, q, p) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false), set_config('request.jwt.claim.role','authenticated',false)`); try { return await db.query(q, p); } finally { await db.exec('reset role'); } };
  const err = async (u, q, p) => { try { await as(u, q, p); return null; } catch (e) { return e.message; } };
  for (const [i, e] of [[ADM, 'a1'], [ADM2, 'a2'], [USR, 'u1']]) await sup('insert into auth.users (id,email) values ($1,$2)', [i, e + '@x.com']);
  for (const a of [ADM, ADM2]) await sup('insert into luma.admin_users (user_id) values ($1)', [a]);
  const f = (await as(USR, `insert into luma.feedback (kind,module,part,message) values ('bug','Work','Tasks: Gantt chart','The bar jumps when I drag it') returning id`)).rows[0];
  await sup(`delete from luma.notifications`);

  // the Edge Function (service role) records a run
  const run = (await svc(`insert into luma.crew_runs (feedback_id) values ($1) returning id, status, started_by`, [f.id])).rows[0];
  ok('the service role starts a run (queued, from the webhook)', run.status === 'queued' && run.started_by === 'webhook', JSON.stringify(run));
  await svc(`update luma.crew_runs set status='working', category='bug', severity='high', summary='Gantt drag saves the end date a day early' where id=$1`, [run.id]);
  const st = (await svc(`insert into luma.crew_steps (run_id, agent, task) values ($1,'engineer','find the cause') returning id`, [run.id])).rows[0];
  await svc(`update luma.crew_steps set status='done', output='Rounding in work.views.js' where id=$1`, [st.id]);
  let r = await sup(`select count(*)::int n from luma.notifications`); ok('nobody is told while the crew is still working', r.rows[0].n === 0);

  let e = await err(USR, `select * from luma.crew_runs`); r = e ? { rows: [] } : await as(USR, `select * from luma.crew_runs`);
  ok('the person who sent the feedback cannot see the crew\'s notes', r.rows.length === 0, e);
  r = await as(USR, `select count(*)::int n from luma.crew_steps`); ok('…nor the steps', r.rows[0].n === 0);
  r = await as(ADM, `select category, severity from luma.crew_runs where id=$1`, [run.id]); ok('an administrator reads the run', r.rows.length === 1 && r.rows[0].severity === 'high');
  r = await as(ADM, `select output from luma.crew_steps where run_id=$1`, [run.id]); ok('…and the steps', r.rows.length === 1 && /work\.views/.test(r.rows[0].output));
  e = await err(ADM, `insert into luma.crew_runs (feedback_id) values ($1)`, [f.id]); ok('an administrator cannot write runs from the page', !!e);
  e = await err(ADM, `update luma.crew_runs set summary='x' where id=$1`, [run.id]); r = await sup(`select summary from luma.crew_runs where id=$1`, [run.id]); ok('…nor change them', r.rows[0].summary !== 'x');
  e = await err(USR, `insert into luma.crew_steps (run_id, agent) values ($1,'engineer')`, [run.id]); ok('a person cannot add steps', !!e);
  e = null; try { await svc(`update luma.crew_runs set severity='apocalyptic' where id=$1`, [run.id]); } catch (x) { e = x.message; } ok('only the known severities', !!e);
  e = null; try { await svc(`insert into luma.crew_steps (run_id, agent) values ($1,'hacker')`, [run.id]); } catch (x) { e = x.message; } ok('only the known agents', !!e);

  await svc(`update luma.crew_runs set status='done', suggested_status='planned', draft_reply='Thanks, a fix is coming' where id=$1`, [run.id]);
  r = await sup(`select user_id, type, title, body, link, ref from luma.notifications order by user_id`);
  ok('every administrator is told when the crew finishes', r.rows.length === 2 && r.rows.every(n => n.type === 'feedback' && n.link === 'adminfeedback' && n.ref === f.id), JSON.stringify(r.rows));
  ok('the title names the module, the part and a high severity', /Crew looked at: Work › Tasks: Gantt chart \(high\)/.test(r.rows[0].title), r.rows[0].title);
  ok('the body is the summary', /end date a day early/.test(r.rows[0].body));
  r = await sup(`select count(*)::int n from luma.notifications where user_id=$1`, [USR]); ok('the person is not told anything', r.rows[0].n === 0);
  r = await sup(`select finished_at is not null fin, updated_at >= created_at upd from luma.crew_runs where id=$1`, [run.id]); ok('finished_at and updated_at are stamped', r.rows[0].fin && r.rows[0].upd);
  await svc(`update luma.crew_runs set summary='again' where id=$1`, [run.id]);
  r = await sup(`select count(*)::int n from luma.notifications`); ok('saving a finished run again does not tell anyone twice', r.rows[0].n === 2);
  r = await sup(`select status from luma.feedback where id=$1`, [f.id]); ok('the feedback\'s own status is untouched', r.rows[0].status === 'new');

  r = await sup(`select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='luma' and tablename like 'crew_%' order by 1`);
  ok('both tables are in Realtime', r.rows.map(x => x.tablename).join() === 'crew_runs,crew_steps', JSON.stringify(r.rows));
  await sup(`delete from luma.feedback where id=$1`, [f.id]); r = await sup(`select count(*)::int n from luma.crew_steps`); ok('deleting the feedback removes its runs and steps', r.rows[0].n === 0);
  // the migration is safe to re-run
  e = null; try { await db.exec(require('fs').readFileSync(require('path').resolve(__dirname, '../../../supabase/migrations/101_feedback_crew.sql'), 'utf8')); } catch (x) { e = x.message; } ok('the migration can run twice', !e, e);

  console.log(`pg_crew_test: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
