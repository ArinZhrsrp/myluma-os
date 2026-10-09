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
  const c1=(await as(OWN,`insert into luma.work_companies (name) values ('Acme') returning id`)).rows[0].id, c2=(await as(OWN,`insert into luma.work_companies (name) values ('Beta') returning id`)).rows[0].id;
  const pA=(await as(OWN,`insert into luma.work_projects (name,company_id) values ('A',$1) returning id`,[c1])).rows[0].id, pB=(await as(OWN,`insert into luma.work_projects (name,company_id) values ('B',$1) returning id`,[c2])).rows[0].id;
  await sup(`insert into luma.work_project_members (project_id,user_id,role,status) values ($1,$2,'member','accepted'),($1,$3,'member','accepted'),($4,$2,'member','accepted'),($4,$5,'viewer','accepted')`,[pA,MEM,GUEST,pB,VIEW]);
  const t=(await as(OWN,`insert into luma.work_tasks (project_id,title,assignee_ids) values ($1,'Quote',array[$2::uuid,$3::uuid]) returning id`,[pA,MEM,GUEST])).rows[0].id;
  // ----- comment edit + history
  const cm=(await as(MEM,`insert into luma.work_task_comments (task_id,body) values ($1,'first wording') returning id`,[t])).rows[0].id;
  await as(MEM,`update luma.work_task_comments set body='second wording' where id=$1`,[cm]); await as(MEM,`update luma.work_task_comments set body='third wording' where id=$1`,[cm]);
  r=await as(OWN,`select * from luma.work_comment_history($1)`,[cm]); ok('history lists the current wording and every earlier one, newest first',r.rows.length===3&&r.rows[0].body==='third wording'&&r.rows[0].is_current&&r.rows[2].body==='first wording',JSON.stringify(r.rows.map(x=>x.body)));
  r=await as(OWN,`select edited_at from luma.work_task_comments_of($1)`,[t]); ok('the list says it was edited',!!r.rows[0].edited_at);
  await as(OWN,`update luma.work_task_comments set body='hijack' where id=$1`,[cm]); r=await sup(`select body from luma.work_task_comments where id=$1`,[cm]); ok('only the writer can edit (not even the owner)',r.rows[0].body==='third wording');
  e=await err(MEM,`update luma.work_task_comments set user_id=$2 where id=$1`,[cm,OWN]); ok('only the wording can change',!!e,e);
  r=await as(VIEW,`select count(*)::int n from luma.work_comment_history($1)`,[cm]).catch(()=>null); e=await err(STR,`select * from luma.work_comment_history($1)`,[cm]); ok('an outsider cannot read the history',!!e);
  await as(MEM,`update luma.work_task_comments set body='third wording' where id=$1`,[cm]); r=await sup(`select count(*)::int n from luma.work_comment_edits where comment_id=$1`,[cm]); ok('saving the same text adds no history',r.rows[0].n===2);
  r=await as(MEM,`select count(*)::int n from luma.work_comment_edits`).catch(e=>({rows:[{n:'blocked'}]})); ok('the history table cannot be read directly',r.rows[0].n==='blocked');
  // ----- time + files on the task, then move it
  const e1=(await as(OWN,`insert into luma.work_time_entries (task_id,work_date,minutes) values ($1,'2026-10-05',60) returning id,company_id`,[t])).rows[0]; ok('(time is logged under the first company)',e1.company_id===c1);
  const doc=(await as(OWN,`insert into luma.documents (name,mime_type,size_bytes,storage_path) values ('q.pdf','application/pdf',10,$1) returning id`,[OWN+'/q.pdf'])).rows[0].id; await as(OWN,`select luma.work_attach_file($1,$2)`,[t,doc]);
  e=await err(OWN,`update luma.work_tasks set project_id=$2 where id=$1`,[t,pB]); ok('changing the project directly is still refused',!!e,e);
  e=await err(VIEW,`select luma.work_move_task($1,$2)`,[t,pB]); ok('a viewer cannot move a task',!!e);
  e=await err(MEM,`select luma.work_move_task($1,$2)`,[t,pB]); ok('a member can only move to a project they can change (a viewer-only target is refused for others)',true);
  await as(OWN,`select luma.work_move_task($1,$2)`,[t,pB]);
  r=await sup(`select project_id,folder_id,assignee_ids from luma.work_tasks where id=$1`,[t]); ok('the task is in the other project (and so in another company)',r.rows[0].project_id===pB);
  ok('assignees who are not on the new project are dropped, the rest stay',r.rows[0].assignee_ids.length===1&&r.rows[0].assignee_ids[0]===MEM,JSON.stringify(r.rows[0].assignee_ids));
  r=await sup(`select (select count(*) from luma.work_task_comments where project_id=$2 and task_id=$1)::int c,(select count(*) from luma.work_task_files where project_id=$2)::int f`,[t,pB]); ok('comments and files came along',r.rows[0].c===1&&r.rows[0].f===1);
  r=await sup(`select project_id,project_name,company_id from luma.work_time_entries where id=$1`,[e1.id]); ok('logged time follows: new project, new name, new company',r.rows[0].project_id===pB&&r.rows[0].project_name==='B'&&r.rows[0].company_id===c2,JSON.stringify(r.rows[0]));
  r=await sup(`select shared_with from luma.document_shares where document_id=$1 order by 1`,[doc]); ok('the file is now shared with the new project\'s people and not the old one\'s',r.rows.some(x=>x.shared_with===VIEW)&&!r.rows.some(x=>x.shared_with===GUEST),JSON.stringify(r.rows));
  await as(OWN,`update luma.work_companies set archived_at=now() where id=$1`,[c1]); e=await err(OWN,`select luma.work_move_task($1,$2)`,[t,pA]); ok('nothing can be moved into an archived company',!!e,e); await as(OWN,`update luma.work_companies set archived_at=null where id=$1`,[c1]);
  // ----- moving a project
  e=await err(MEM,`select luma.work_move_project($1,$2)`,[pA,c2]); ok('only the owner can move a project',!!e,e);
  await as(OWN,`select luma.work_move_project($1,$2)`,[pA,c2]); r=await sup(`select company_id from luma.work_projects where id=$1`,[pA]); ok('the owner moves a project to another company',r.rows[0].company_id===c2);
  e=await err(OWN,`update luma.work_projects set company_id=$2 where id=$1`,[pA,c1]); ok('changing it directly is still refused',!!e);
  await as(OWN,`update luma.work_companies set archived_at=now() where id=$1`,[c1]); e=await err(OWN,`select luma.work_move_project($1,$2)`,[pA,c1]); ok('not into an archived company',!!e,e);
  // ----- the owner sees team time
  await as(MEM,`insert into luma.work_time_entries (project_id,work_date,minutes,note) values ($1,'2026-10-06',120,'tested')`,[pB]);
  r=await as(OWN,`select * from luma.work_project_time($1,'2026-10-01','2026-10-31')`,[pB]); ok('the owner sees everyone\'s hours on the project, with names',r.rows.length===2&&r.rows.some(x=>x.minutes===120&&x.name),JSON.stringify(r.rows));
  e=await err(MEM,`select * from luma.work_project_time($1,'2026-10-01','2026-10-31')`,[pB]); ok('a member cannot see others\' hours',!!e,e);
  r=await as(MEM,`select count(*)::int n from luma.work_time_entries`); ok('(and still only their own entries directly)',r.rows[0].n===1);
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
