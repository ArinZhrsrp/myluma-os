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
  let e=await err(GUEST,`insert into luma.work_projects (name) values ('Nope')`); ok('without the Work add-on nobody can create a project',!!e,e);
  const pid=(await as(OWN,`insert into luma.work_projects (name,client,deadline) values ('Website','Acme',current_date+30) returning id`)).rows[0].id; ok('the owner creates a project',!!pid);
  const t1=(await as(OWN,`insert into luma.work_tasks (project_id,title,priority) values ($1,'Design home page','high') returning id,status`,[pid])).rows[0]; ok('and a task (starts in To do)',t1.status==='todo');
  e=await err(OWN,`insert into luma.work_tasks (project_id,title,assignee_ids) values ($1,'x',array[$2::uuid])`,[pid,MEM]); ok('cannot assign someone who is not on the project',!!e&&/not on this project/.test(e),e);
  // invitations
  e=await err(OWN,`select luma.work_invite($1,array[$2::uuid])`,[pid,STR]); ok('only contacts can be invited',!!e&&/contacts/.test(e),e);
  e=await err(MEM,`select luma.work_invite($1,array[$2::uuid])`,[pid,GUEST]); ok('only the owner can invite',!!e,e);
  let r=await as(OWN,`select luma.work_invite($1,array[$2::uuid,$3::uuid],'member') as n`,[pid,MEM,GUEST]); ok('invite a member and a guest (no add-on needed to be added)',r.rows[0].n===2);
  await as(OWN,`select luma.work_invite($1,array[$2::uuid],'viewer')`,[pid,VIEW]);
  r=await sup(`select ref,link from luma.notifications where user_id=$1 and type='work_invite'`,[GUEST]); ok('the invitation notification opens Work and points at the project',r.rows[0].link==='work'&&r.rows[0].ref===pid);
  r=await as(GUEST,'select count(*)::int n from luma.work_tasks'); ok('a pending invitation shows nothing yet',r.rows[0].n===0);
  r=await as(GUEST,'select luma.my_work_shared() as s'); ok('...but the invitation is listed with no counts',r.rows[0].s.length===1&&r.rows[0].s[0].my_status==='pending'&&Number(r.rows[0].s[0].tasks)===0);
  for(const u of [MEM,GUEST,VIEW]) await as(u,`select luma.work_respond($1,true)`,[pid]);
  r=await as(GUEST,'select count(*)::int n from luma.work_tasks'); ok('after accepting, a guest can LOOK at the tasks',r.rows[0].n===1);
  r=await as(GUEST,`select * from luma.work_projects`); ok('and at the project',r.rows.length===1&&r.rows[0].name==='Website');
  e=await err(GUEST,`insert into luma.work_tasks (project_id,title) values ($1,'sneaky')`,[pid]); ok('a guest without Work cannot add a task',!!e,e);
  await as(GUEST,`update luma.work_tasks set status='done' where id=$1`,[t1.id]); r=await sup('select status from luma.work_tasks where id=$1',[t1.id]); ok('a guest cannot change a task either',r.rows[0].status==='todo');
  e=await err(GUEST,`delete from luma.work_tasks where id=$1`,[t1.id]); r=await sup('select count(*)::int n from luma.work_tasks'); ok('or delete one',r.rows[0].n===1);
  await as(VIEW,`update luma.work_tasks set status='done' where id=$1`,[t1.id]); r=await sup('select status from luma.work_tasks where id=$1',[t1.id]); ok('a viewer (even with Work) cannot change tasks',r.rows[0].status==='todo');
  const t2=(await as(MEM,`insert into luma.work_tasks (project_id,title,assignee_ids,start_date,due_date) values ($1,'Write copy',array[$2::uuid,$3::uuid],current_date,current_date+5) returning id`,[pid,GUEST,MEM])).rows[0].id; ok('a member with Work adds a task and assigns it to the guest',!!t2);
  r=await sup(`select ref,link from luma.notifications where user_id=$1 and type='work_task'`,[GUEST]); ok('the guest is told, and the notification points at the task',r.rows.length===1&&r.rows[0].ref===t2&&r.rows[0].link==='work');
  r=await sup(`select count(*)::int n from luma.notifications where user_id=$1 and type='work_task' and ref=$2`,[MEM,t2]); ok('you are not told about a task you gave yourself',r.rows[0].n===0);
  e=await err(MEM,`update luma.work_tasks set start_date=current_date+9 where id=$1`,[t2]); ok('the start date cannot be after the end date',!!e,e);
  await as(MEM,`update luma.work_tasks set assignee_ids=array[$2::uuid,$3::uuid] where id=$1`,[t2,GUEST,OWN]); r=await sup(`select count(*)::int n from luma.notifications where type='work_task' and ref=$1`,[t2]); ok('adding one more person tells only the new one',r.rows[0].n===2,String(r.rows[0].n));
  e=await err(OWN,`update luma.work_tasks set assignee_ids=array[$2::uuid] where id=$1`,[t2,STR]); ok('assigning someone who is not on the project is refused',!!e);
  await as(MEM,`update luma.work_tasks set status='done' where id=$1`,[t1.id]); r=await sup('select status,completed_at from luma.work_tasks where id=$1',[t1.id]); ok('a member can finish a task (completed_at is stamped)',r.rows[0].status==='done'&&r.rows[0].completed_at);
  await sup(`update luma.user_addons set expires_at=now()-interval '1 day' where user_id=$1`,[MEM]); await as(MEM,`update luma.work_tasks set status='todo' where id=$1`,[t1.id]); r=await sup('select status from luma.work_tasks where id=$1',[t1.id]); ok('a member whose Work add-on ended becomes read-only',r.rows[0].status==='done');
  r=await as(MEM,'select count(*)::int n from luma.work_tasks'); ok('...but still sees the project',r.rows[0].n===2);
  await sup(`update luma.user_addons set expires_at=now()+interval '30 days' where user_id=$1`,[MEM]);
  // people and roles
  r=await as(GUEST,`select * from luma.work_project_members($1)`,[pid]); ok('people on the project can see who is on it',r.rows.length===4&&r.rows.some(x=>x.is_owner));
  e=await err(STR,`select * from luma.work_project_members($1)`,[pid]); ok('an outsider cannot',!!e);
  r=await as(STR,'select count(*)::int n from luma.work_projects'); ok('outsiders see no projects',r.rows[0].n===0);
  await as(OWN,`select luma.work_set_role($1,$2,'viewer')`,[pid,MEM]); await as(MEM,`update luma.work_tasks set title='hack' where id=$1`,[t1.id]); r=await sup('select title from luma.work_tasks where id=$1',[t1.id]); ok('the owner can make a member a viewer',r.rows[0].title==='Design home page');
  await as(OWN,`select luma.work_remove_member($1,$2)`,[pid,GUEST]); r=await sup('select assignee_ids from luma.work_tasks where id=$1',[t2]); ok('removing a person unassigns their tasks (others stay)',r.rows[0].assignee_ids.length===1&&r.rows[0].assignee_ids[0]===OWN,JSON.stringify(r.rows[0]));
  r=await as(GUEST,'select count(*)::int n from luma.work_tasks'); ok('and they no longer see the project',r.rows[0].n===0);
  await as(GUEST,`select luma.work_invite($1,array[$2::uuid])`,[pid,OWN]).catch(()=>{});
  // limit of 15
  for(let i=0;i<14;i++){ const id='00000000-0000-0000-0000-0000000001'+String(i).padStart(2,'0'); await sup('insert into auth.users (id,email) values ($1,$2)',[id,'m'+i+'@x.com']); await sup(`insert into luma.contacts (requester_id,addressee_id,status) values ($1,$2,'accepted')`,[OWN,id]); await as(OWN,`select luma.work_invite($1,array[$2::uuid])`,[pid,id]).catch(()=>{}); }
  r=await sup(`select count(*)::int n from luma.work_project_members where project_id=$1 and status<>'declined'`,[pid]); ok('a project holds at most 15 people',r.rows[0].n<=15,String(r.rows[0].n));
  // owner-only deletes
  e=await err(MEM,`delete from luma.work_projects where id=$1`,[pid]); r=await sup('select count(*)::int n from luma.work_projects'); ok('only the owner can delete the project',r.rows[0].n===1);
  await sup('delete from auth.users where id=$1',[OWN]); r=await sup('select (select count(*) from luma.work_projects)::int p,(select count(*) from luma.work_tasks)::int t,(select count(*) from luma.work_project_members)::int m'); ok("deleting the owner's account removes the project, its tasks and members",r.rows[0].p===0&&r.rows[0].t===0&&r.rows[0].m===0,JSON.stringify(r.rows[0]));
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
