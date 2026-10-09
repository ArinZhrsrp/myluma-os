const { boot } = require('./pg_boot.js');
const U=['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003'];
const [A,B,ADM]=U; let pass=0,fail=0; const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log('  ✗',n,x||'');} };
(async()=>{
  const {db,problems}=await boot({verbose:false}); ok('migrations apply',problems.length===0,JSON.stringify(problems).slice(0,300));
  const sup=async(q,p)=>{await db.exec("select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)");return db.query(q,p)};
  const as=async(u,q,p)=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false), set_config('request.jwt.claim.role','authenticated',false)`);try{return await db.query(q,p)}finally{await db.exec('reset role')}};
  const err=async(u,q,p)=>{try{await as(u,q,p);return null}catch(e){return e.message}};
  for(const [i,e] of U.map((u,i)=>[u,'u'+i])) await sup('insert into auth.users (id,email) values ($1,$2)',[i,e+'@x.com']);
  await sup(`insert into luma.admin_users (user_id) values ($1)`,[ADM]);
  // a timezone where it is 18:xx right now
  const h=(await sup(`select extract(hour from now() at time zone 'UTC')::int h`)).rows[0].h; let off=((18-h)%24+24)%24; if(off>14) off-=24;
  const tz=off===0?'Etc/UTC':(off>0?`Etc/GMT-${off}`:`Etc/GMT+${-off}`);
  await sup(`update luma.profiles set timezone=$2 where id=$1`,[A,tz]);
  const D=(await sup(`select (timezone($1,now())::date+1)::text d`,[tz])).rows[0].d;
  const stats=async(u)=> (await sup(`select * from luma.busy_day_stats($1,$2::date)`,[u,D])).rows[0];
  let s=await stats(A); ok('an empty day is empty',+s.n===0&&+s.hours===0&&s.clashes===0,JSON.stringify(s));
  // 5 plain events + 1 task → 6 things = busy (normal)
  for(let i=0;i<5;i++) await sup(`insert into luma.events (user_id,title,event_date,all_day) values ($1,'e${'$'}{i}'::text,$2,true)`.replace("'e${'$'}{i}'::text","'e"+i+"'"),[A,D]);
  await sup(`insert into luma.tasks (user_id,title,due_date) values ($1,'t',$2)`,[A,D]);
  await sup(`insert into luma.tasks (user_id,title,due_date,status) values ($1,'done one',$2,'done')`,[A,D]);
  s=await stats(A); ok('events and open tasks count, done ones do not',+s.n===6,JSON.stringify(s));
  // timed events with a clash: 09:00-11:00 and 10:00-12:00 → 4h booked, 1 clash
  await sup(`insert into luma.events (user_id,title,event_date,start_time,end_time) values ($1,'x',$2,'09:00','11:00'),($1,'y',$2,'10:00','12:00')`,[A,D]);
  s=await stats(A); ok('hours and clashes from timed events',+s.hours===4&&s.clashes===1&&+s.n===8,JSON.stringify(s));  // 9-12 = union is not computed: 120+120=240min... see below
  // weekly repeat from a past date counts too
  await sup(`insert into luma.events (user_id,title,event_date,repeats) values ($1,'w',$2::date-7,'weekly')`,[A,D]);
  s=await stats(A); ok('a weekly repeat lands on the day',+s.n===9,JSON.stringify(s));
  // Work + Study
  await sup(`insert into luma.user_addons (user_id,addon,source,expires_at) values ($1,'work','admin',now()+interval '30 days'),($1,'study','admin',now()+interval '30 days')`,[A]);
  await sup(`update luma.profiles set plan='zenith' where id=$1`,[A]);
  const pr=(await as(A,`insert into luma.work_projects (name) values ('P') returning id`)).rows[0].id;
  await as(A,`insert into luma.work_tasks (project_id,title,start_date,due_date) values ($1,'span',$2::date-1,$2::date+1)`,[pr,D]);
  s=await stats(A); ok('a Work task spanning the day counts',+s.n===10,JSON.stringify(s));
  const dow=(await sup(`select extract(dow from $1::date)::int d`,[D])).rows[0].d;
  const sem=(await as(A,`insert into luma.study_semesters (name, start_date, end_date) values ('S', current_date - 20, current_date + 80) returning id`)).rows[0].id; await as(A,`select luma.activate_study_semester($1)`,[sem]);
  const course=(await as(A,`insert into luma.study_courses (name) values ('C') returning id`)).rows[0].id;
  await as(A,`insert into luma.study_classes (course_id,weekday,start_time,end_time) values ($1,$2,'08:00','09:00'),($1,$2,'13:00','14:00')`,[course,dow]);
  s=await stats(A); ok('two classes count as one thing',+s.n===11,JSON.stringify(s));
  // the other person has the add-ons off: their data stays out
  s=await stats(B); ok('someone else is empty',+s.n===0);
  // push
  let r=await sup(`select luma.run_busy_alerts() n`); ok('a packed day sends one notification',+r.rows[0].n===1,JSON.stringify(r.rows));
  r=await sup(`select title,link,body from luma.notifications where user_id=$1 and type='busy_day'`,[A]); ok('tomorrow is packed → red wording, opens the calendar',r.rows.length===1&&/packed/.test(r.rows[0].title)&&r.rows[0].link==='calendar',JSON.stringify(r.rows));
  r=await sup(`select luma.run_busy_alerts() n`); ok('not twice in a day',+r.rows[0].n===0);
  await sup(`delete from luma.notifications where type='busy_day'`);
  await sup(`update luma.profiles set preferences = preferences || '{"busy_push":false}' where id=$1`,[A]); r=await sup(`select luma.run_busy_alerts() n`); ok('switch "evening before" off → nothing',+r.rows[0].n===0);
  await sup(`update luma.profiles set preferences = '{"busy_alerts":false}' where id=$1`,[A]); r=await sup(`select luma.run_busy_alerts() n`); ok('busy alerts off → nothing',+r.rows[0].n===0);
  await sup(`update luma.profiles set preferences = '{"busy_level":"relaxed"}' where id=$1`,[A]); r=await sup(`select luma.run_busy_alerts() n`); r=await sup(`select title from luma.notifications where type='busy_day'`);
  ok('relaxed: 11 things is only busy (amber), not packed',r.rows.length===1&&/busy/.test(r.rows[0].title),JSON.stringify(r.rows));
  await sup(`delete from luma.notifications where type='busy_day'`);
  await sup(`update luma.profiles set preferences = '{"busy_level":"sensitive"}' where id=$1`,[A]); await sup(`select luma.run_busy_alerts()`); r=await sup(`select title from luma.notifications where type='busy_day'`); ok('sensitive → packed',r.rows.length===1&&/packed/.test(r.rows[0].title));
  // hour other than 6 pm: nothing
  await sup(`delete from luma.notifications where type='busy_day'`); await sup(`update luma.profiles set timezone=$2, preferences='{}' where id=$1`,[A, off===0?'Etc/GMT-3':'Etc/UTC']);
  r=await sup(`select luma.run_busy_alerts() n`); ok('only at 6 pm local',+r.rows[0].n===0||h===18);
  // plan limits admin
  e=await err(A,`select * from luma.admin_plan_limits()`); ok('a normal user cannot read the editor',!!e,e);
  r=await as(ADM,`select * from luma.admin_plan_limits()`); ok('admin lists all limits',r.rows.length>20&&r.rows.some(x=>x.key==='work_tasks'&&x.plan==='work'),r.rows.length);
  await as(ADM,`select luma.admin_set_plan_limit('work','work_tasks',123)`); r=await sup(`select value from luma.plan_limits where plan='work' and key='work_tasks'`); ok('admin changes a limit',r.rows[0].value===123);
  await as(ADM,`select luma.admin_set_plan_limit('work','work_tasks',null)`); r=await sup(`select value from luma.plan_limits where plan='work' and key='work_tasks'`); ok('null = unlimited',r.rows[0].value===null);
  e=await err(ADM,`select luma.admin_set_plan_limit('dawn','nonsense',1)`); ok('unknown key refused',!!e&&/no limit/.test(e),e);
  e=await err(ADM,`select luma.admin_set_plan_limit('work','work_tasks',-1)`); ok('negative refused',!!e);
  e=await err(A,`select luma.admin_set_plan_limit('work','work_tasks',5)`); ok('non-admin cannot change',!!e);
  // Work sizes through the admin function
  await as(ADM,`select luma.admin_set_addon($1,'work',true,1,null,false,'pro')`,[B]); r=await sup(`select tier from luma.user_addons where user_id=$1 and addon='work'`,[B]); ok('admin gives Work Pro',r.rows[0].tier==='pro');
  r=await as(ADM,`select addon_tier from luma.admin_list_users('',50) where id=$1`,[B]); ok('the admin list shows the size',r.rows[0].addon_tier.work==='pro',JSON.stringify(r.rows));
  await as(ADM,`select luma.admin_set_addon($1,'work',true,1,null,true)`,[B]); r=await sup(`select tier from luma.user_addons where user_id=$1 and addon='work'`,[B]); ok('renewing without a size keeps it',r.rows[0].tier==='pro');
  await as(ADM,`select luma.admin_set_addon($1,'work',true,1,null,true,'standard')`,[B]); r=await sup(`select tier from luma.user_addons where user_id=$1 and addon='work'`,[B]); ok('and it can be set back',r.rows[0].tier==='standard');
  e=await err(ADM,`select luma.admin_set_addon($1,'work',true,1,null,false,'huge')`,[B]); ok('unknown size refused',!!e);
  await as(ADM,`select luma.admin_set_addon($1,'study',true,1,null,false,'pro')`,[B]); r=await sup(`select tier from luma.user_addons where user_id=$1 and addon='study'`,[B]); ok('Study has no sizes',r.rows[0].tier==='standard');
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
