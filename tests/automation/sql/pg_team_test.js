const { boot } = require('./pg_boot.js');
const U=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000005'];
const [OWN,A,B,STR,OTH]=U; let pass=0,fail=0; const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log('  ✗',n,x||'');} };
(async()=>{
  const {db,problems}=await boot({verbose:false}); ok('migrations apply',problems.length===0,JSON.stringify(problems).slice(0,300));
  const sup=async(q,p)=>{await db.exec("select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)");return db.query(q,p)};
  const as=async(u,q,p)=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false), set_config('request.jwt.claim.role','authenticated',false)`);try{return await db.query(q,p)}finally{await db.exec('reset role')}};
  const err=async(u,q,p)=>{try{await as(u,q,p);return null}catch(e){return e.message}};
  for(const [i,e] of U.map((u,i)=>[u,'u'+i])) await sup('insert into auth.users (id,email) values ($1,$2)',[i,e+'@x.com']);
  for(const u of [OWN,A,B,OTH]) await sup(`insert into luma.user_addons (user_id,addon,source,expires_at) values ($1,'work','admin',now()+interval '30 days')`,[u]);
  for(const u of [A,B]) await sup(`insert into luma.contacts (requester_id,addressee_id,status) values ($1,$2,'accepted')`,[OWN,u]);
  const co=(await as(OWN,`insert into luma.work_companies (name) values ('Acme') returning id`)).rows[0].id;
  let r,e;
  const mk=async(u,name,members,comp=co)=> (await as(u,`select luma.work_set_team(null,$1,$2,'Dept',$3,$4::uuid[]) id`,[comp,name,'#22c55e',members])).rows[0].id;
  const t1=await mk(OWN,'Design',[A,B,OWN]); ok('a team is created with its people',!!t1);
  r=await as(OWN,`select count(*)::int n from luma.work_team_members where team_id=$1`,[t1]); ok('three people (you included)',r.rows[0].n===3);
  e=await err(OWN,`select luma.work_set_team(null,$1,'Design','',null,'{}')`,[co]); ok('same name in the same company refused',!!e&&/already have a team/.test(e),e);
  e=await err(OWN,`select luma.work_set_team(null,$1,'Strangers','',null,$2::uuid[])`,[co,[OTH]]); ok('only contacts can be added',!!e&&/contacts/.test(e),e);
  e=await err(A,`select luma.work_set_team(null,$1,'Mine','',null,'{}')`,[co]); ok('cannot make a team in someone else\'s company',!!e,e);
  e=await err(OTH,`select luma.work_set_team($1,null,'Hijack','',null,'{}')`,[t1]); ok('only the owner changes a team',!!e&&/owner/.test(e),e);
  await as(OWN,`select luma.work_set_team($1,null,'Design team','New note',null,$2::uuid[])`,[t1,[A]]); r=await sup(`select name,note from luma.work_teams where id=$1`,[t1]); const n2=(await sup(`select count(*)::int n from luma.work_team_members where team_id=$1`,[t1])).rows[0].n; ok('rename + replace people',r.rows[0].name==='Design team'&&n2===1,JSON.stringify(r.rows)+n2);
  await as(OWN,`select luma.work_set_team($1,null,'Design',null,null,$2::uuid[])`,[t1,[A,B]]);
  r=await sup(`select user_id,title,link,ref from luma.notifications where type='work_team' order by user_id`); ok('people added to a team are told (not the owner)',new Set(r.rows.map(x=>x.user_id)).size===2&&r.rows.every(x=>x.link==='work'&&x.ref===t1&&/Design/.test(x.title))&&!r.rows.some(x=>x.user_id===OWN),JSON.stringify(r.rows));
  await sup(`delete from luma.notifications where type='work_team'`);
  await as(OWN,`select luma.work_set_team($1,null,'Design',null,null,$2::uuid[])`,[t1,[A,B]]); r=await sup(`select count(*)::int n from luma.notifications where type='work_team'`); ok('saving again does not tell people who were already in',r.rows[0].n===0);
  r=await as(A,`select luma.my_work_teams() j`); ok('a member sees the team they are in (before being on any project)',r.rows[0].j.some(x=>x.id===t1&&x.im_in&&!x.mine&&x.owner_name),JSON.stringify(r.rows[0].j));
  // limit: Work = 5 teams
  for(let i=0;i<4;i++) await mk(OWN,'T'+i,[]);
  e=await err(OWN,`select luma.work_set_team(null,$1,'Sixth','',null,'{}')`,[co]); ok('Work allows 5 teams',!!e&&/up to 5 teams/.test(e),e);
  await sup(`update luma.user_addons set tier='pro' where user_id=$1 and addon='work'`,[OWN]); await mk(OWN,'Sixth',[]); ok('Work Pro allows more',true);
  // visibility
  const pr=(await as(OWN,`insert into luma.work_projects (name,company_id) values ('P',$1) returning id`,[co])).rows[0].id;
  r=await as(OWN,`select luma.my_work_teams() j`); const mine=r.rows[0].j.find(x=>x.id===t1); ok('owner sees the team with its people',mine&&mine.mine&&mine.members.length===2&&mine.count===2,JSON.stringify(mine));
  r=await as(OTH,`select luma.my_work_teams() j`); ok('someone unrelated sees nothing',r.rows[0].j.length===0);
  await sup(`insert into luma.work_project_members (project_id,user_id,role,status,invited_by) values ($1,$2,'member','accepted',$3)`,[pr,A,OWN]);
  r=await as(A,`select luma.my_work_teams() j`); const seen=r.rows[0].j.find(x=>x.id===t1); ok('people on the project see the team name but not its people',seen&&!seen.mine&&seen.members.length===0&&seen.count===2,JSON.stringify(seen));
  r=await as(A,`select count(*)::int n from luma.work_teams`); ok('and cannot read the table directly',r.rows[0].n===0);
  // tasks
  const t=(await as(OWN,`insert into luma.work_tasks (project_id,title,team_id,assignee_ids) values ($1,'Logo',$2,$3::uuid[]) returning id,team_id`,[pr,t1,[A]])).rows[0]; ok('a task can be for a team, with people outside it too',t.team_id===t1);
  await as(OWN,`update luma.work_tasks set assignee_ids=$2::uuid[] where id=$1`,[t.id,[A,OWN]]); r=await sup(`select cardinality(assignee_ids) n from luma.work_tasks where id=$1`,[t.id]); ok('assign someone not in the team (the owner)',r.rows[0].n===2);
  const tOther=await mk(OTH,'Elsewhere',[]).catch(()=>null); 
  const oc=(await as(OTH,`insert into luma.work_companies (name) values ('Other') returning id`)).rows[0].id; const ot=await mk(OTH,'Elsewhere',[],oc);
  e=await err(OWN,`update luma.work_tasks set team_id=$2 where id=$1`,[t.id,ot]); ok('a task cannot use someone else\'s team',!!e&&/does not belong/.test(e),e);
  await as(OWN,`select luma.work_delete_team($1)`,[t1]); r=await sup(`select team_id, cardinality(assignee_ids) n from luma.work_tasks where id=$1`,[t.id]); ok('deleting a team keeps the task and its people',r.rows[0].team_id===null&&r.rows[0].n===2,JSON.stringify(r.rows));
  e=await err(A,`select luma.work_delete_team($1)`,[t1]); ok('only the owner deletes',!!e);
  // archived company freezes teams
  const tt=await mk(OWN,'Frozen',[]); await as(OWN,`update luma.work_companies set archived_at=now() where id=$1`,[co]);
  e=await err(OWN,`select luma.work_set_team($1,null,'Frozen2','',null,'{}')`,[tt]); ok('archived company: teams are frozen',!!e&&/archived/.test(e),e);
  e=await err(OWN,`select luma.work_delete_team($1)`,[tt]); ok('archived company: cannot delete a team',!!e&&/archived/.test(e),e);
  // no add-on
  e=await err(STR,`select luma.work_set_team(null,$1,'x','',null,'{}')`,[co]); ok('needs the Work add-on',!!e);
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
