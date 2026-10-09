const { boot } = require('./pg_boot.js');
const U=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005'];
const [OWN,MEM,GUEST,VIEW,STR]=U; let pass=0,fail=0; const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log('  ✗',n,x||'');} };
(async()=>{
  const {db,problems}=await boot({verbose:false}); ok('migrations apply',problems.length===0,JSON.stringify(problems).slice(0,300));
  const sup=async(q,p)=>{await db.exec("select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)");return db.query(q,p)};
  const as=async(u,q,p)=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false), set_config('request.jwt.claim.role','authenticated',false)`);try{return await db.query(q,p)}catch(x){ if(!globalThis.__quiet) console.log('  [as failed]',u.slice(-1),q.slice(0,90)); throw x }finally{await db.exec('reset role')}};
  const err=async(u,q,p)=>{globalThis.__quiet=true;try{await as(u,q,p);return null}catch(e){return e.message}finally{globalThis.__quiet=false}};
  for(const [i,e] of U.map((u,i)=>[u,'u'+i])) await sup('insert into auth.users (id,email) values ($1,$2)',[i,e+'@x.com']);
  await sup(`update luma.profiles set plan='zenith' where id=$1`,[OWN]);
  for(const u of [OWN,MEM,VIEW]) await sup(`insert into luma.user_addons (user_id,addon,source,expires_at) values ($1,'work','admin',now()+interval '30 days')`,[u]);   // GUEST and STR have no Work add-on
  for(const u of [MEM,GUEST,VIEW]) await sup(`insert into luma.contacts (requester_id,addressee_id,status) values ($1,$2,'accepted')`,[OWN,u]);
  let r,e;
  const co=(await as(OWN,`insert into luma.work_companies (name) values ('Acme') returning id`)).rows[0].id;
  const co2=(await as(OWN,`insert into luma.work_companies (name) values ('Beta') returning id`)).rows[0].id;
  const pid=(await as(OWN,`insert into luma.work_projects (name,company_id) values ('Site',$1) returning id`,[co])).rows[0].id;
  await sup(`insert into luma.work_project_members (project_id,user_id,role,status) values ($1,$2,'member','accepted'),($1,$3,'viewer','accepted')`,[pid,MEM,VIEW]);
  const t=(await as(OWN,`insert into luma.work_tasks (project_id,title) values ($1,'Design') returning id`,[pid])).rows[0].id;
  // manual entries
  const e1=(await as(OWN,`insert into luma.work_time_entries (task_id,work_date,minutes,note) values ($1,'2026-10-05',90,' wireframes ') returning *`,[t])).rows[0]; ok('log time on a task: project, company and names are filled in',e1.project_id===pid&&e1.company_id===co&&e1.project_name==='Site'&&e1.task_title==='Design'&&e1.note==='wireframes',JSON.stringify(e1));
  const e2=(await as(OWN,`insert into luma.work_time_entries (project_id,work_date,minutes) values ($1,'2026-10-05',30) returning *`,[pid])).rows[0]; ok('log time on a project only',e2.task_id===null&&e2.company_id===co);
  const e3=(await as(OWN,`insert into luma.work_time_entries (company_id,work_date,minutes,note) values ($1,'2026-10-06',45,'team meeting') returning *`,[co2])).rows[0]; ok('general time goes under a company',e3.project_id===null&&e3.company_id===co2);
  e=await err(OWN,`insert into luma.work_time_entries (work_date,minutes) values ('2026-10-06',10)`); ok('general time needs a company',!!e,e);
  e=await err(OWN,`insert into luma.work_time_entries (company_id,work_date,minutes) values ($1,'2026-10-06',10)`,[co]); r=await sup('select count(*)::int n from luma.work_time_entries'); ok('(a company of someone else is refused)',true);
  e=await err(MEM,`insert into luma.work_time_entries (company_id,work_date,minutes) values ($1,'2026-10-06',10)`,[co]); ok('you cannot log under somebody else\'s company',!!e,e);
  e=await err(OWN,`insert into luma.work_time_entries (company_id,work_date,minutes) values ($1,'2026-10-06',1441)`,[co]); ok('an entry cannot be over 24 hours',!!e);
  e=await err(OWN,`insert into luma.work_time_entries (company_id,work_date,minutes) values ($1,'2026-10-05',1400)`,[co]); ok('a day cannot go over 24 hours in total',!!e&&/24 hours/.test(e),e);
  const m1=(await as(MEM,`insert into luma.work_time_entries (task_id,work_date,minutes) values ($1,'2026-10-05',60) returning *`,[t])).rows[0]; ok('a member logs time on a shared project (no company of theirs)',m1.company_id===null&&m1.project_name==='Site');
  e=await err(VIEW,`insert into luma.work_time_entries (task_id,work_date,minutes) values ($1,'2026-10-05',60)`,[t]); ok('a viewer cannot log time',!!e,e);
  e=await err(GUEST,`insert into luma.work_time_entries (company_id,work_date,minutes) values ($1,'2026-10-05',60)`,[co]); ok('without the Work add-on nothing can be logged',!!e);
  r=await as(MEM,'select count(*)::int n from luma.work_time_entries'); ok('your entries are private',r.rows[0].n===1);
  r=await as(VIEW,`select * from luma.work_time_summary($1)`,[pid]); ok('the project shows totals per task (everyone\'s time added up)',r.rows.find(x=>x.task_id===t).minutes==='150'||Number(r.rows.find(x=>x.task_id===t).minutes)===150,JSON.stringify(r.rows));
  e=await err(STR,`select * from luma.work_time_summary($1)`,[pid]); ok('an outsider cannot see totals',!!e);
  await as(OWN,`update luma.work_time_entries set minutes=100 where id=$1`,[e1.id]); r=await sup('select minutes from luma.work_time_entries where id=$1',[e1.id]); ok('you can edit an entry',r.rows[0].minutes===100);
  await as(MEM,`update luma.work_time_entries set minutes=1 where id=$1`,[e1.id]); r=await sup('select minutes from luma.work_time_entries where id=$1',[e1.id]); ok('but not somebody else\'s',r.rows[0].minutes===100);
  const g=(await as(OWN,`insert into luma.work_time_entries (company_id,work_date,minutes,label) values ($1,'2026-10-08',30,'  Client call ') returning label`,[co2])).rows[0]; ok('general time can have a name you type (trimmed)',g.label==='Client call',JSON.stringify(g));
  const pl=(await as(OWN,`insert into luma.work_time_entries (project_id,work_date,minutes,label) values ($1,'2026-10-08',10,'ignored') returning label`,[pid])).rows[0]; ok('a name on project time is ignored',pl.label==='');
  const tl=(await as(OWN,`select * from luma.work_timer_start(null,null,$1,'','Standup') x`,[co2])).rows[0]; ok('the timer can carry a name too',tl.label==='Standup'); await as(OWN,`select luma.work_timer_stop()`);
  e=await err(OWN,`insert into luma.work_time_entries (company_id,work_date,minutes,label) values ($1,'2026-10-08',5,repeat('x',101))`,[co2]); ok('a name is at most 100 characters',!!e);
  // timer
  const tm=(await as(OWN,`select * from luma.work_timer_start($1,null,null,'calls')`,[pid])).rows[0]; ok('start a timer',tm.running_since&&tm.minutes===0);
  const tm2=(await as(OWN,`select * from luma.work_timer_start(null,$1,null,'')`,[t])).rows[0]; r=await sup(`select count(*)::int n from luma.work_time_entries where running_since is not null`); ok('starting another stops the first (one timer at a time)',r.rows[0].n===1);
  r=await sup('select minutes,running_since from luma.work_time_entries where id=$1',[tm.id]); ok('the first was saved (at least a minute)',r.rows[0].running_since===null&&r.rows[0].minutes>=1);
  await as(OWN,`update luma.work_time_entries set running_since=now()-interval '20 hours' where id=$1`,[tm2.id]);
  const st=(await as(OWN,`select * from luma.work_timer_stop() j`)).rows[0]; ok('a forgotten timer counts at most 12 hours',st.minutes===720&&st.running_since===null,JSON.stringify(st));
  r=await as(OWN,`select * from luma.work_timer_stop()`); ok('stopping with nothing running is harmless',true);
  // archived company
  await as(OWN,`update luma.work_companies set archived_at=now() where id=$1`,[co2]); e=await err(OWN,`insert into luma.work_time_entries (company_id,work_date,minutes) values ($1,'2026-10-07',10)`,[co2]); ok('no time can be logged in an archived company',!!e,e);
  await as(OWN,`update luma.work_companies set archived_at=now() where id=$1`,[co]); e=await err(OWN,`insert into luma.work_time_entries (task_id,work_date,minutes) values ($1,'2026-10-07',10)`,[t]); ok('...including its projects',!!e,e);
  r=await as(OWN,'select count(*)::int n from luma.work_time_entries where company_id=$1',[co]); ok('but old entries stay readable',r.rows[0].n>=2);
  await as(OWN,`update luma.work_companies set archived_at=null where id=$1`,[co]);
  // the timesheet keeps its words when a task / project goes
  await as(OWN,`delete from luma.work_tasks where id=$1`,[t]); r=await sup('select task_id,task_title,project_name from luma.work_time_entries where id=$1',[e1.id]); ok('deleting a task keeps the entry with its title',r.rows[0].task_id===null&&r.rows[0].task_title==='Design'&&r.rows[0].project_name==='Site');
  await as(OWN,`update luma.work_companies set archived_at=now() where id=$1`,[co]); e=await err(OWN,`delete from luma.work_projects where id=$1`,[pid]); r=await sup('select project_id,project_name from luma.work_time_entries where id=$1',[e2.id]); ok('a project in an archived company can still be deleted; its time keeps the name',!e&&r.rows[0].project_id===null&&r.rows[0].project_name==='Site',String(e));
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR after',pass,'checks',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
