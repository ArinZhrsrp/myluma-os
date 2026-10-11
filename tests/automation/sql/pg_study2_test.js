const { boot } = require('./pg_boot.js');
const U1='00000000-0000-0000-0000-000000000001',U2='00000000-0000-0000-0000-000000000002'; let pass=0,fail=0; const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log('  ✗',n,x||'');} };
(async()=>{
  const {db,problems}=await boot({verbose:false}); ok('migrations apply',problems.length===0,JSON.stringify(problems).slice(0,300));
  const sup=async(q,p)=>{await db.exec("select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)");return db.query(q,p)};
  const as=async(u,q,p)=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false), set_config('request.jwt.claim.role','authenticated',false)`);try{return await db.query(q,p)}finally{await db.exec('reset role')}};
  const err=async(u,q,p)=>{try{await as(u,q,p);return null}catch(e){return e.message}};
  for(const [i,e] of [[U1,'a'],[U2,'b']]) await sup('insert into auth.users (id,email) values ($1,$2)',[i,e+'@x.com']);
  await sup(`insert into luma.user_addons (user_id,addon,source,expires_at) values ($1,'study','admin',now()+interval '30 days')`,[U1]);
  const sem=(await as(U1,`insert into luma.study_semesters (name,start_date,end_date) values ('S',current_date-30,current_date+60) returning id`)).rows[0].id; await as(U1,`select luma.activate_study_semester($1)`,[sem]);
  const c=(await as(U1,`insert into luma.study_courses (name) values ('DB') returning id, attendance_target`)).rows[0]; ok('a subject has an attendance goal of 80 by default',c.attendance_target===80);
  const k=(await as(U1,`insert into luma.study_classes (course_id,weekday,start_time,end_time) values ($1,1,'09:00','10:00') returning id`,[c.id])).rows[0].id;
  let e=await err(U1,`update luma.study_courses set attendance_target=120 where id=$1`,[c.id]); ok('goal must be 0-100',!!e);
  // attendance
  await as(U1,`insert into luma.study_attendance (class_id,course_id,att_date,status) values ($1,$2,current_date-7,'present')`,[k,c.id]);
  let r=await as(U1,'select semester_id from luma.study_attendance'); ok('attendance goes into the active semester',r.rows[0].semester_id===sem);
  e=await err(U1,`insert into luma.study_attendance (class_id,course_id,att_date,status) values ($1,$2,current_date-7,'late')`,[k,c.id]); ok('one record per class and date',!!e&&/duplicate|unique/i.test(e),e);
  await as(U1,`insert into luma.study_attendance (class_id,course_id,att_date,status) values ($1,$2,current_date-7,'late') on conflict (class_id,att_date) do update set status=excluded.status`,[k,c.id]); r=await as(U1,'select status from luma.study_attendance'); ok('upsert changes the status',r.rows.length===1&&r.rows[0].status==='late');
  e=await err(U1,`insert into luma.study_attendance (class_id,course_id,att_date,status) values ($1,$2,current_date,'sleeping')`,[k,c.id]); ok('unknown status refused',!!e);
  // someone else's class
  await db.exec("set session_replication_role = replica");
  const c2=(await sup(`insert into luma.study_courses (user_id,name,semester_id) values ($1,'Other',null) returning id`,[U2])).rows[0].id; const k2=(await sup(`insert into luma.study_classes (user_id,course_id,weekday,start_time,end_time) values ($1,$2,2,'09:00','10:00') returning id`,[U2,c2])).rows[0].id;
  await db.exec("set session_replication_role = origin");
  e=await err(U1,`insert into luma.study_attendance (class_id,course_id,att_date,status) values ($1,$2,current_date,'present')`,[k2,c2]); ok("cannot mark attendance on someone else's class",!!e,e);
  e=await err(U1,`insert into luma.study_attendance (class_id,course_id,att_date,status) values ($1,$2,current_date,'present')`,[k,c2]); ok('the class must belong to that subject',!!e,e);
  r=await as(U2,'select count(*)::int n from luma.study_attendance'); ok("others cannot read my attendance",r.rows[0].n===0);
  // no add-on
  await sup(`update luma.user_addons set expires_at=now()-interval '1 day' where user_id=$1`,[U1]);
  e=await err(U1,`insert into luma.study_attendance (class_id,course_id,att_date,status) values ($1,$2,current_date-14,'present')`,[k,c.id]); ok('without the add-on nothing can be added',!!e); await sup(`update luma.user_addons set expires_at=now()+interval '30 days' where user_id=$1`,[U1]);
  // decks and cards
  const d=(await as(U1,`insert into luma.study_decks (title,course_id) values ('Terms',$1) returning id,semester_id`,[c.id])).rows[0]; ok('a deck goes into the active semester',d.semester_id===sem);
  await as(U1,`insert into luma.study_cards (deck_id,front,back) values ($1,'PK','unique id')`,[d.id]); r=await as(U1,'select ease,interval_days,reps,due_on from luma.study_cards'); ok('a new card is due today with a starting ease',Number(r.rows[0].ease)===2.5&&r.rows[0].reps===0);
  e=await err(U1,`insert into luma.study_cards (deck_id,front,back) values ($1,'','x')`,[d.id]); ok('empty card refused',!!e);
  await db.exec("set session_replication_role = replica"); const d2=(await sup(`insert into luma.study_decks (user_id,title) values ($1,'theirs') returning id`,[U2])).rows[0].id; await db.exec("set session_replication_role = origin");
  e=await err(U1,`insert into luma.study_cards (deck_id,front,back) values ($1,'a','b')`,[d2]); ok("cannot add to someone else's deck",!!e,e);
  e=await err(U1,`insert into luma.study_decks (title,course_id) values ('x',$1)`,[c2]); ok("a deck cannot use someone else's subject",!!e,e);
  r=await as(U1,`select * from luma.my_deck_stats(current_date)`); ok('deck statistics count cards and due cards',r.rows.length===1&&r.rows[0].total===1&&r.rows[0].due===1,JSON.stringify(r.rows));
  await as(U1,`update luma.study_cards set due_on=current_date+3, reps=1 where deck_id=$1`,[d.id]); r=await as(U1,`select * from luma.my_deck_stats(current_date)`); ok('a card scheduled later is not due',r.rows[0].due===0&&r.rows[0].total===1);
  r=await as(U2,`select * from luma.my_deck_stats(current_date)`); ok("others' statistics do not include mine",r.rows.every(x=>x.deck_id!==d.id));
  // cap of 500 cards per deck
  await sup(`insert into luma.study_cards (deck_id,user_id,front,back) select $1,$2,'f'||g,'b' from generate_series(1,499) g`,[d.id,U1]);
  e=await err(U1,`insert into luma.study_cards (deck_id,front,back) values ($1,'one too many','x')`,[d.id]); ok('a deck holds at most 500 cards',!!e&&/500/.test(e),e);
  // archive + delete a semester removes decks, cards and attendance
  await as(U1,`select luma.archive_study_semester($1,'')`,[sem]); r=await as(U1,`select luma.delete_study_semester($1) as d`,[sem]);
  const left=await sup(`select (select count(*) from luma.study_decks where user_id=$1)::int d,(select count(*) from luma.study_cards where user_id=$1)::int c,(select count(*) from luma.study_attendance where user_id=$1)::int a`,[U1]); ok('deleting an archived semester removes its decks, cards and attendance',left.rows[0].d===0&&left.rows[0].c===0&&left.rows[0].a===0,JSON.stringify(left.rows[0]));
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
