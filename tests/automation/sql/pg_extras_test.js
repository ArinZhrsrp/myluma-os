const { boot } = require('./pg_boot.js');
const U=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005'];
const [OWN,MEM,GUEST,VIEW,STR]=U; let pass=0,fail=0; const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log('  ✗',n,x||'');} };
(async()=>{
  const {db,problems}=await boot({verbose:false}); ok('migrations apply',problems.length===0,JSON.stringify(problems).slice(0,300));
  const sup=async(q,p)=>{await db.exec("select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)");return db.query(q,p)};
  const as=async(u,q,p)=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false), set_config('request.jwt.claim.role','authenticated',false)`);try{return await db.query(q,p)}finally{await db.exec('reset role')}};
  const err=async(u,q,p)=>{try{await as(u,q,p);return null}catch(e){return e.message}};
  for(const [i,e] of U.map((u,i)=>[u,'u'+i])) await sup('insert into auth.users (id,email) values ($1,$2)',[i,e+'@x.com']);
  await sup(`update luma.profiles set plan='zenith' where id=$1`,[OWN]);
  for(const u of [OWN,MEM,VIEW]) await sup(`insert into luma.user_addons (user_id,addon,source,expires_at) values ($1,'work','admin',now()+interval '30 days')`,[u]);   // GUEST and STR have no Work add-on
  for(const u of [MEM,GUEST,VIEW]) await sup(`insert into luma.contacts (requester_id,addressee_id,status) values ($1,$2,'accepted')`,[OWN,u]);
  let r,e;
  const pid=(await as(OWN,`insert into luma.work_projects (name) values ('Site') returning id`)).rows[0].id, p2=(await as(OWN,`insert into luma.work_projects (name) values ('Other') returning id`)).rows[0].id;
  await sup(`insert into luma.work_project_members (project_id,user_id,role,status) values ($1,$2,'member','accepted'),($1,$3,'viewer','accepted')`,[pid,MEM,VIEW]);
  const mk=async(t,p=pid)=>(await as(OWN,`insert into luma.work_tasks (project_id,title,assignee_ids) values ($1,$2,$3::uuid[]) returning id`,[p,t,p===pid?[MEM]:[]])).rows[0].id;
  const a=await mk('Design'), b=await mk('Build'), c=await mk('Test'), o=await mk('Elsewhere',p2);
  // ----- links
  await as(OWN,`select luma.work_set_dependencies($1,array[$2::uuid])`,[b,a]); await as(OWN,`select luma.work_set_dependencies($1,array[$2::uuid,$3::uuid])`,[c,b,a]);
  r=await as(VIEW,`select task_id,depends_on from luma.work_task_links order by 1`); ok('links are readable by everyone on the project',r.rows.length===3);
  e=await err(OWN,`select luma.work_set_dependencies($1,array[$2::uuid])`,[a,c]); ok('a loop is refused (Design cannot wait for Test)',!!e&&/loop/.test(e),e);
  e=await err(OWN,`select luma.work_set_dependencies($1,array[$2::uuid])`,[a,o]); ok('only tasks of the same project',!!e,e);
  await as(OWN,`select luma.work_set_dependencies($1,array[$1::uuid,$2::uuid])`,[a,b]).catch(()=>{});
  e=await err(VIEW,`select luma.work_set_dependencies($1,array[$2::uuid])`,[b,c]); ok('a viewer cannot change links',!!e);
  await as(OWN,`select luma.work_set_dependencies($1,'{}')`,[c]); r=await sup(`select count(*)::int n from luma.work_task_links where task_id=$1`,[c]); ok('links can be cleared',r.rows[0].n===0);
  await as(OWN,`select luma.work_move_task($1,$2)`,[b,p2]); r=await sup(`select count(*)::int n from luma.work_task_links where task_id=$1 or depends_on=$1`,[b]); ok('moving a task to another project drops its links',r.rows[0].n===0);
  await as(OWN,`select luma.work_set_dependencies($1,array[$2::uuid])`,[c,a]); await as(OWN,`delete from luma.work_tasks where id=$1`,[a]); r=await sup(`select count(*)::int n from luma.work_task_links`); ok('deleting a task removes its links',r.rows[0].n===0);
  // ----- budget
  const t=await mk('Quote'); await as(OWN,`update luma.work_tasks set budget_minutes=120 where id=$1`,[t]); e=await err(OWN,`update luma.work_tasks set budget_minutes=0 where id=$1`,[t]); ok('a budget must be at least a minute',!!e);
  await as(MEM,`insert into luma.work_time_entries (task_id,work_date,minutes) values ($1,'2026-10-05',90)`,[t]);
  r=await sup(`select count(*)::int n from luma.notifications where type='work_budget'`); ok('under budget: nobody is told',r.rows[0].n===0);
  await as(MEM,`insert into luma.work_time_entries (task_id,work_date,minutes) values ($1,'2026-10-06',45)`,[t]);
  r=await sup(`select user_id,title,ref from luma.notifications where type='work_budget'`); ok('crossing the budget tells the owner (not the person who logged it), once',r.rows.length===1&&r.rows[0].user_id===OWN&&r.rows[0].ref===t,JSON.stringify(r.rows));
  await as(MEM,`insert into luma.work_time_entries (task_id,work_date,minutes) values ($1,'2026-10-07',30)`,[t]); r=await sup(`select count(*)::int n from luma.notifications where type='work_budget'`); ok('more time later does not tell again',r.rows[0].n===1);
  r=await as(VIEW,`select * from luma.work_time_totals()`); ok('totals per task are visible to the project',r.rows.some(x=>x.task_id===t&&Number(x.minutes)===165),JSON.stringify(r.rows));
  r=await as(STR,`select count(*)::int n from luma.work_time_totals()`); ok('an outsider sees none',r.rows[0].n===0);
  // ----- mentions
  const c1=(await as(OWN,`insert into luma.work_task_comments (task_id,body,mentions) values ($1,'@Member please check',array[$2::uuid,$3::uuid,$4::uuid]) returning id,mentions`,[t,MEM,STR,OWN])).rows[0];
  ok('mentions keep only people on the project, and not yourself',c1.mentions.length===1&&c1.mentions[0]===MEM,JSON.stringify(c1.mentions));
  r=await sup(`select type from luma.notifications where user_id=$1 and ref=$2 and type like 'work_%' and type in ('work_mention','work_comment')`,[MEM,t]); ok('the tagged person gets a mention, not also the general comment notice',r.rows.length===1&&r.rows[0].type==='work_mention',JSON.stringify(r.rows));
  await as(OWN,`update luma.work_task_comments set body='@Member please check again',mentions=array[$2::uuid,$3::uuid] where id=$1`,[c1.id,MEM,VIEW]); r=await sup(`select user_id,type from luma.notifications where type='work_mention' order by user_id`);
  ok('editing and tagging one more person tells only the new one',r.rows.length===2&&r.rows.some(x=>x.user_id===VIEW),JSON.stringify(r.rows));
  r=await as(MEM,`select mentions from luma.work_task_comments_of($1)`,[t]); ok('mentions come back with the comments',Array.isArray(r.rows[0].mentions));
  // ----- admin figures
  e=await err(OWN,`select luma.admin_work_stats()`); ok('only admins can read the Work figures',!!e,e);
  await sup(`insert into luma.admin_users (user_id) values ($1) on conflict do nothing`,[STR]);
  r=await as(STR,`select luma.admin_work_stats() j`); const j=r.rows[0].j; ok('an admin gets the figures',j.projects===2&&j.tasks>=3&&j.users_with_work===3&&Number(j.hours_logged)>0&&j.months.length===12,JSON.stringify(j).slice(0,300));
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
