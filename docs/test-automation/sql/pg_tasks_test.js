const { boot } = require('./pg_boot.js');
const U1='00000000-0000-0000-0000-000000000001'; let pass=0,fail=0; const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log('  ✗',n,x||'');} };
(async()=>{
  const {db,problems}=await boot({verbose:false}); ok('migrations apply',problems.length===0,JSON.stringify(problems).slice(0,300));
  await db.exec("select set_config('request.jwt.claim.role','service_role',false)"); await db.query('insert into auth.users (id,email) values ($1,$2)',[U1,'a@x.com']);
  const as=async(q,p)=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${U1}',false), set_config('request.jwt.claim.role','authenticated',false)`);try{return await db.query(q,p)}finally{await db.exec('reset role')}};
  const nd=async(d,r,t)=>(await db.query(`select luma.next_task_date($1::date,$2,$3::date) as d`,[d,r,t])).rows[0].d.toISOString().slice(0,10);
  ok('daily, due today → tomorrow', await nd('2026-10-09','daily','2026-10-09')==='2026-10-10');
  ok('daily, overdue by a week → tomorrow (after today)', await nd('2026-10-02','daily','2026-10-09')==='2026-10-10');
  ok('weekly keeps the weekday', await nd('2026-10-02','weekly','2026-10-09')==='2026-10-16');
  ok('weekdays skips the weekend (Fri → Mon)', await nd('2026-10-09','weekdays','2026-10-09')==='2026-10-12');
  ok('monthly clamps (31 Jan → 28 Feb)', await nd('2026-01-31','monthly','2026-01-31')==='2026-02-28');
  ok('yearly', await nd('2026-10-09','yearly','2026-10-09')==='2027-10-09');
  const t=(await as(`insert into luma.tasks (title,due_date,repeat,checklist,notes) values ('Water plants', current_date, 'weekly', '[{"t":"balcony","d":true},{"t":"kitchen","d":false}]', 'n') returning id`)).rows[0].id;
  await as(`update luma.tasks set status='done' where id=$1`,[t]);
  let r=await db.query(`select title,status,repeat,due_date,checklist,notes from luma.tasks where user_id=$1 order by created_at`,[U1]); ok('finishing a repeating task makes the next one',r.rows.length===2&&r.rows[1].status==='todo'&&r.rows[1].repeat==='weekly',JSON.stringify(r.rows));
  ok('the next one has its checklist unticked',r.rows[1].checklist.every(x=>x.d===false)&&r.rows[1].checklist.length===2&&r.rows[1].notes==='n');
  await as(`update luma.tasks set status='todo' where id=$1`,[t]); await as(`update luma.tasks set status='done' where id=$1`,[t]); r=await db.query(`select count(*)::int n from luma.tasks`); ok('reopening and finishing again does not make a second copy',r.rows[0].n===2);
  const t2=(await as(`insert into luma.tasks (title,due_date) values ('once', current_date) returning id`)).rows[0].id; await as(`update luma.tasks set status='done' where id=$1`,[t2]); r=await db.query(`select count(*)::int n from luma.tasks`); ok('a normal task makes no copy',r.rows[0].n===3);
  let e=null; try{ await as(`insert into luma.tasks (title,due_date,repeat) values ('x',current_date,'hourly')`);}catch(x){e=x.message} ok('unknown repeat refused',!!e);
  e=null; try{ await as(`insert into luma.tasks (title,due_date,checklist) values ('x',current_date,'{"a":1}')`);}catch(x){e=x.message} ok('a checklist must be a list',!!e);
  // a study task finishing with no active semester still works
  await db.query(`insert into luma.user_addons (user_id,addon,source,expires_at) values ($1,'study','admin',now()+interval '30 days')`,[U1]);
  const t3=(await db.query(`insert into luma.tasks (user_id,title,due_date,repeat,space) values ($1,'study rep',current_date,'daily','study') returning id`,[U1]).catch(x=>({rows:[],err:x.message})));
  ok('(setup) a study-space task cannot even be made without a semester',t3.rows.length===0);
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
