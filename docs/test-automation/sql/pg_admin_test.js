const { boot } = require('./pg_boot.js');
const U1='00000000-0000-0000-0000-000000000001',U2='00000000-0000-0000-0000-000000000002',U3='00000000-0000-0000-0000-000000000003',U4='00000000-0000-0000-0000-000000000004';
let pass=0,fail=0; const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log('  ✗',n,x||'');} };
(async()=>{
  const {db,problems}=await boot({verbose:false}); ok('migrations apply',problems.length===0,JSON.stringify(problems).slice(0,300));
  const sup=async(q,p)=>{await db.exec("select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)");return db.query(q,p)};
  const as=async(u,q,p)=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false), set_config('request.jwt.claim.role','authenticated',false)`);try{return await db.query(q,p)}finally{await db.exec('reset role')}};
  const err=async(u,q,p)=>{try{await as(u,q,p);return null}catch(e){return e.message}};
  for(const [i,e] of [[U1,'admin'],[U2,'b'],[U3,'c'],[U4,'d']]) await sup('insert into auth.users (id,email) values ($1,$2)',[i,e+'@x.com']);
  await sup('insert into luma.admin_users (user_id) values ($1)',[U1]);
  // ----- trials -----
  let e=await err(U2,`select luma.admin_give_trial($1,'study')`,[U3]); ok('only admins can give trials',!!e&&/Not allowed/.test(e),e);
  await as(U1,`select luma.admin_give_trial($1,'study',7)`,[U3]);
  let r=await as(U3,'select luma.my_limits() as m'); ok('the trial is active and counted as used',r.rows[0].m.addons.includes('study')&&r.rows[0].m.trials_used.includes('study')&&r.rows[0].m.addon_info.study.source==='trial',JSON.stringify(r.rows[0].m));
  e=await err(U1,`select luma.admin_give_trial($1,'study')`,[U3]); ok('cannot start a trial on top of an active add-on',!!e,e);
  await sup(`update luma.user_addons set expires_at = now() - interval '1 day' where user_id=$1`,[U3]);
  e=await err(U3,`select luma.start_addon_trial('study')`); ok('after it ends the user cannot start the trial again',!!e&&/already used/.test(e),e);
  await as(U1,`select luma.admin_reset_trial($1,'study')`,[U3]); r=await as(U3,`select luma.start_addon_trial('study') as t`); ok('after a reset the user can start it again',!!r.rows[0].t);
  // ----- bulk grant -----
  e=await err(U1,`select luma.admin_bulk_grant($1::uuid[],'study')`,[[U2]]); ok('a duration is required',!!e&&/how long/.test(e),e);
  e=await err(U2,`select luma.admin_bulk_grant($1::uuid[],'study',30)`,[[U2]]); ok('only admins can bulk grant',!!e,e);
  r=await as(U1,`select luma.admin_bulk_grant($1::uuid[],'study',30,null,null,false,'Beta testers') as g`,[[U2,U4,'00000000-0000-0000-0000-0000000000ff']]); ok('bulk grant gives 2 people access (unknown ids ignored)',r.rows[0].g.given===2,JSON.stringify(r.rows[0].g));
  r=await as(U2,'select luma.my_limits() as m'); ok('a gift does not use up the free trial',r.rows[0].m.addons.includes('study')&&r.rows[0].m.trials_used.length===0&&r.rows[0].m.addon_info.study.source==='admin',JSON.stringify(r.rows[0].m));
  r=await as(U1,`select luma.admin_bulk_grant($1::uuid[],'study',30) as g`,[[U2,U4]]); ok('people who already have it are skipped',r.rows[0].g.skipped===2&&r.rows[0].g.given===0,JSON.stringify(r.rows[0].g));
  const before=(await sup(`select expires_at from luma.user_addons where user_id=$1 and addon='study'`,[U2])).rows[0].expires_at;
  r=await as(U1,`select luma.admin_bulk_grant($1::uuid[],'study',14,null,null,true) as g`,[[U2]]); const after=(await sup(`select expires_at from luma.user_addons where user_id=$1 and addon='study'`,[U2])).rows[0].expires_at;
  ok('"add time" extends from the current end',r.rows[0].g.extended===1&&new Date(after)-new Date(before)>13*864e5,JSON.stringify(r.rows[0].g));
  r=await as(U2,`select count(*)::int n from luma.notifications where title like '🎁%'`); ok('they are told about the gift',r.rows[0].n>=1);
  r=await as(U1,`select * from luma.admin_list_users('',50)`); ok('admin list shows trial usage and add-on source',r.rows.some(x=>x.id===U3&&x.trials_used.includes('study'))&&r.rows.some(x=>x.id===U2&&x.addon_source.study==='admin'));
  // ----- deactivate -----
  await sup('insert into auth.sessions (user_id) values ($1)',[U2]);
  await as(U1,`select luma.admin_set_disabled($1,true,'abuse')`,[U2]);
  r=await sup('select p.disabled_at, p.disabled_reason, u.banned_until from luma.profiles p join auth.users u on u.id=p.id where p.id=$1',[U2]); ok('deactivate marks the profile and bans sign-in',r.rows[0].disabled_at&&r.rows[0].disabled_reason==='abuse'&&r.rows[0].banned_until!==null,JSON.stringify(r.rows[0]));
  r=await sup('select count(*)::int n from auth.sessions where user_id=$1',[U2]); ok('open sessions are ended',r.rows[0].n===0);
  await as(U2,`update luma.profiles set disabled_at = null where id=$1`,[U2]); r=await sup('select disabled_at from luma.profiles where id=$1',[U2]); ok('a user cannot reactivate themselves',r.rows[0].disabled_at!==null);
  e=await err(U1,`select luma.admin_set_disabled($1,true)`,[U1]); ok('cannot deactivate yourself',!!e);
  await sup('insert into luma.admin_users (user_id) values ($1)',['00000000-0000-0000-0000-0000000000a1']).catch(()=>{});
  await sup(`insert into auth.users (id,email) values ('00000000-0000-0000-0000-0000000000a1','a2@x.com')`).catch(()=>{}); await sup(`insert into luma.admin_users (user_id) values ('00000000-0000-0000-0000-0000000000a1') on conflict do nothing`);
  e=await err(U1,`select luma.admin_set_disabled('00000000-0000-0000-0000-0000000000a1',true)`); ok('cannot deactivate another admin',!!e,e);
  await as(U1,`select luma.admin_set_disabled($1,false)`,[U2]); r=await sup('select p.disabled_at, u.banned_until from luma.profiles p join auth.users u on u.id=p.id where p.id=$1',[U2]); ok('reactivate clears both',r.rows[0].disabled_at===null&&r.rows[0].banned_until===null);
  // ----- admin roles -----
  e=await err(U2,`select luma.admin_set_admin($1,true)`,[U4]); ok('only admins can make admins',!!e&&/Not allowed/.test(e),e);
  e=await err(U1,`select luma.admin_set_admin($1,false)`,[U1]); ok('cannot change your own admin access',!!e);
  await as(U1,`select luma.admin_set_admin($1,true)`,[U2]); r=await sup('select count(*)::int n from luma.admin_users where user_id=$1',[U2]); ok('make admin',r.rows[0].n===1);
  r=await as(U2,'select luma.is_admin() as a'); ok('the new admin can use admin functions',r.rows[0].a===true);
  await as(U1,`select luma.admin_set_admin($1,false)`,[U2]); r=await sup('select count(*)::int n from luma.admin_users where user_id=$1',[U2]); ok('remove admin',r.rows[0].n===0);
  await as(U1,`select luma.admin_set_disabled($1,true)`,[U2]); e=await err(U1,`select luma.admin_set_admin($1,true)`,[U2]); ok('a deactivated account cannot be made admin',!!e,e); await as(U1,`select luma.admin_set_disabled($1,false)`,[U2]);
  // ----- audit -----
  r=await as(U1,'select * from luma.admin_recent_actions(50)'); const acts=r.rows.map(x=>x.action).join(','); ok('every admin action is logged',['give_trial','reset_trial','bulk_grant','deactivate','reactivate'].every(a=>acts.includes(a)),acts);
  e=await err(U2,'select * from luma.admin_recent_actions(5)'); ok('only admins read the log',!!e);
  // ----- deleting an account removes everything (foreign keys) -----
  await sup(`update luma.profiles set plan='zenith' where id in ($1,$2)`,[U3,U4]);
  await sup(`insert into luma.contacts (requester_id,addressee_id,status) values ($1,$2,'accepted')`,[U3,U4]);
  const ins=async(q)=>{ try{ await as(U3,q); return true;}catch(x){ console.log('   setup skipped:',q.slice(0,50),'→',x.message.slice(0,80)); return false; } };
  await ins(`insert into luma.tasks (title,due_date) values ('t', current_date)`); await ins(`insert into luma.events (title,category,event_date,all_day,repeats,note) values ('e','Meeting',current_date,true,'none','')`);
  await ins(`insert into luma.notes (title,body) values ('n','b')`); await ins(`insert into luma.habits (name) values ('h')`); await ins(`insert into luma.goals (title) values ('g')`);
  await ins(`insert into luma.bills (name,amount,due_date) values ('b',10,current_date)`); await ins(`insert into luma.money_entries (amount,name) values (5,'m')`);
  await ins(`insert into luma.reminders (title,start_date,remind_time) values ('r',current_date,'09:00')`);
  await sup(`select luma.notify($1,'system','x','y','dashboard')`,[U3]);
  await as(U1,`select luma.admin_bulk_grant($1::uuid[],'study',30,null,null,true)`,[[U3]]);
  const sem=(await as(U3,`insert into luma.study_semesters (name,start_date,end_date) values ('S',current_date-5,current_date+60) returning id`)).rows[0].id; await as(U3,`select luma.activate_study_semester($1)`,[sem]);
  const c=(await as(U3,`insert into luma.study_courses (name) values ('C') returning id`)).rows[0].id; await ins(`insert into luma.study_tasks (course_id,title,kind,due_date,status) values ('${c}','a','assignment',current_date,'todo')`);
  await as(U3,`select luma.create_study_project('P','',null,'')`); await as(U3,`select luma.save_split(null,'Dinner',20,$1,current_date,'','equal',$2::jsonb)`,[U3,JSON.stringify([{user_id:U3,share:10},{user_id:U4,share:10}])]);
  await sup(`insert into luma.plan_changes (user_id,old_plan,new_plan,changed_by) values ($1,'dawn','glow',$2)`,[U3,U1]);
  let delErr=null; try{ await sup('delete from auth.users where id=$1',[U3]); }catch(x){ delErr=x.message; } ok('deleting the account works (nothing blocks it)',!delErr,delErr);
  const left=await sup(`select (select count(*) from luma.tasks where user_id=$1)::int t,(select count(*) from luma.profiles where id=$1)::int p,(select count(*) from luma.study_courses where user_id=$1)::int c,(select count(*) from luma.expense_splits where owner_id=$1)::int s,(select count(*) from luma.contacts where requester_id=$1 or addressee_id=$1)::int ct,(select count(*) from luma.user_addons where user_id=$1)::int ua,(select count(*) from luma.purchase_history where user_id=$1)::int ph`,[U3]); ok('everything of theirs is gone',Object.values(left.rows[0]).every(v=>v===0),JSON.stringify(left.rows[0]));
  r=await sup(`select count(*)::int n from luma.profiles where id=$1`,[U4]); ok('other people are untouched',r.rows[0].n===1);
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
