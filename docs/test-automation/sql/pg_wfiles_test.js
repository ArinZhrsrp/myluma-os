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
  const pid=(await as(OWN,`insert into luma.work_projects (name) values ('Site') returning id`)).rows[0].id;
  await sup(`insert into luma.work_project_members (project_id,user_id,role,status) values ($1,$2,'member','accepted'),($1,$3,'viewer','accepted'),($1,$4,'member','accepted')`,[pid,MEM,VIEW,GUEST]);   // GUEST has no Work add-on
  const t=(await as(OWN,`insert into luma.work_tasks (project_id,title,assignee_ids) values ($1,'Design',array[$2::uuid]) returning id`,[pid,MEM])).rows[0].id;
  // comments
  const c1=(await as(OWN,`insert into luma.work_task_comments (task_id,body) values ($1,'Please use the new logo') returning id,project_id`,[t])).rows[0]; ok('the owner comments (project filled in)',c1.project_id===pid);
  r=await sup(`select title,body,ref from luma.notifications where user_id=$1 and type='work_comment'`,[MEM]); ok('the assignee is told, and it opens the task',r.rows.length===1&&r.rows[0].ref===t&&/commented/.test(r.rows[0].title),JSON.stringify(r.rows));
  r=await sup(`select count(*)::int n from luma.notifications where user_id=$1 and type='work_comment'`,[OWN]); ok('the writer is not told',r.rows[0].n===0);
  await as(MEM,`insert into luma.work_task_comments (task_id,body) values ($1,'Will do')`,[t]); r=await sup(`select count(*)::int n from luma.notifications where user_id=$1 and type='work_comment'`,[OWN]); ok('the person who made the task is told about a reply',r.rows[0].n===1);
  e=await err(VIEW,`insert into luma.work_task_comments (task_id,body) values ($1,'x')`,[t]); ok('a viewer cannot comment',!!e,e);
  e=await err(GUEST,`insert into luma.work_task_comments (task_id,body) values ($1,'x')`,[t]); ok('someone without the Work add-on cannot either',!!e,e);
  e=await err(STR,`insert into luma.work_task_comments (task_id,body) values ($1,'x')`,[t]); ok('an outsider cannot',!!e);
  e=await err(OWN,`insert into luma.work_task_comments (task_id,body) values ($1,'   ')`,[t]); ok('an empty comment is refused',!!e);
  r=await as(VIEW,`select * from luma.work_task_comments_of($1)`,[t]); ok('a viewer can read them, with names',r.rows.length===2&&r.rows[0].name);
  e=await err(STR,`select * from luma.work_task_comments_of($1)`,[t]); ok('an outsider cannot read them',!!e);
  await as(MEM,`delete from luma.work_task_comments where id=$1`,[c1.id]); r=await sup('select count(*)::int n from luma.work_task_comments'); ok('you cannot delete someone else\'s comment',r.rows[0].n===2);
  await as(OWN,`delete from luma.work_task_comments where id=$1`,[c1.id]); r=await sup('select count(*)::int n from luma.work_task_comments'); ok('the owner can delete any comment',r.rows[0].n===1);
  // files
  const doc=(await as(OWN,`insert into luma.documents (name,mime_type,size_bytes,storage_path) values ('brief.pdf','application/pdf',10,$1) returning id`,[OWN+'/brief.pdf'])).rows[0].id;
  const mdoc=(await as(MEM,`insert into luma.documents (name,mime_type,size_bytes,storage_path) values ('mine.pdf','application/pdf',10,$1) returning id`,[MEM+'/mine.pdf'])).rows[0].id;
  e=await err(OWN,`select luma.work_attach_file($1,$2)`,[t,mdoc]); ok('you can only attach your own documents',!!e&&/own/.test(e),e);
  e=await err(VIEW,`select luma.work_attach_file($1,$2)`,[t,doc]); ok('a viewer cannot attach',!!e);
  const f=(await as(OWN,`select luma.work_attach_file($1,$2) id`,[t,doc])).rows[0].id; ok('the owner attaches a document',!!f);
  r=await sup(`select shared_with from luma.document_shares where document_id=$1 order by 1`,[doc]); ok('it is shared with everyone on the project (not the outsider)',r.rows.length===3&&!r.rows.some(x=>x.shared_with===STR),JSON.stringify(r.rows));
  r=await as(VIEW,`select * from luma.work_task_files_of($1)`,[t]); ok('a viewer sees the file in the list',r.rows.length===1&&r.rows[0].name==='brief.pdf');
  e=await err(STR,`select * from luma.work_task_files_of($1)`,[t]); ok('an outsider does not',!!e);
  await as(MEM,`select luma.work_detach_file($1)`,[f]).catch(()=>{}); r=await sup('select count(*)::int n from luma.work_task_files'); ok('a member cannot remove a file someone else attached',r.rows[0].n===1);
  await as(OWN,`select luma.work_remove_member($1,$2)`,[pid,GUEST]); r=await sup(`select count(*)::int n from luma.document_shares where document_id=$1 and shared_with=$2`,[doc,GUEST]); ok('removing a person takes the sharing away',r.rows[0].n===0);
  await sup(`insert into luma.work_project_members (project_id,user_id,role,status) values ($1,$2,'member','pending')`,[pid,STR]); await sup(`update luma.user_addons set expires_at=now() where false`);
  await as(STR,`select luma.work_respond($1,true)`,[pid]); r=await sup(`select count(*)::int n from luma.document_shares where document_id=$1 and shared_with=$2`,[doc,STR]); ok('someone who joins later gets the files',r.rows[0].n===1);
  await as(OWN,`select luma.work_detach_file($1)`,[f]); r=await sup(`select count(*)::int n from luma.document_shares where document_id=$1`,[doc]); ok('detaching un-shares it from everybody',r.rows[0].n===0);
  const f2=(await as(OWN,`select luma.work_attach_file($1,$2) id`,[t,doc])).rows[0].id; await as(OWN,`delete from luma.work_tasks where id=$1`,[t]); r=await sup(`select (select count(*) from luma.document_shares where document_id=$1)::int s,(select count(*) from luma.work_task_files)::int f,(select count(*) from luma.work_task_comments)::int c`,[doc]); ok('deleting the task removes its files, comments and the sharing',r.rows[0].s===0&&r.rows[0].f===0&&r.rows[0].c===0,JSON.stringify(r.rows[0]));
  const t2=(await as(OWN,`insert into luma.work_tasks (project_id,title) values ($1,'Two') returning id`,[pid])).rows[0].id; await as(OWN,`select luma.work_attach_file($1,$2)`,[t2,doc]); await as(OWN,`delete from luma.work_projects where id=$1`,[pid]); r=await sup(`select count(*)::int n from luma.document_shares where document_id=$1`,[doc]); ok('deleting the project un-shares too',r.rows[0].n===0);
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
