const { boot } = require('./pg_boot.js');
const U1='00000000-0000-0000-0000-000000000001',U2='00000000-0000-0000-0000-000000000002',U3='00000000-0000-0000-0000-000000000003'; let pass=0,fail=0; const ok=(n,c,x)=>{ if(c)pass++; else {fail++; console.log('  ✗',n,x||'');} };
(async()=>{
  const {db,problems}=await boot({verbose:false}); ok('migrations apply',problems.length===0,JSON.stringify(problems).slice(0,300));
  const sup=async(q,p)=>{await db.exec("select set_config('request.jwt.claim.role','service_role',false), set_config('request.jwt.claim.sub','',false)");return db.query(q,p)};
  const as=async(u,q,p)=>{await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false), set_config('request.jwt.claim.role','authenticated',false)`);try{return await db.query(q,p)}finally{await db.exec('reset role')}};
  const err=async(u,q,p)=>{try{await as(u,q,p);return null}catch(e){return e.message}};
  for(const [i,e] of [[U1,'admin'],[U2,'b'],[U3,'c']]) await sup('insert into auth.users (id,email) values ($1,$2)',[i,e+'@x.com']);
  await sup('insert into luma.admin_users (user_id) values ($1)',[U1]);
  let e=await err(U2,`select luma.admin_bulk_gift($1::uuid[],'study',14)`,[[U2]]); ok('only admins send gifts',!!e);
  e=await err(U1,`select luma.admin_bulk_gift($1::uuid[],'study')`,[[U2]]); ok('a length is required',!!e&&/how long/.test(e),e);
  let r=await as(U1,`select luma.admin_bulk_gift($1::uuid[],'study',14,null,60,'Thanks for testing') as g`,[[U2,U3]]); ok('gift sent to 2 people',r.rows[0].g.given===2,JSON.stringify(r.rows[0].g));
  r=await as(U2,'select luma.my_limits() as m'); ok('a gift does NOT switch the add-on on',!r.rows[0].m.addons.includes('study'));
  r=await as(U2,'select luma.my_gifts() as g'); const gift=r.rows[0].g[0]; ok('the person sees the gift waiting with a use-by date',r.rows[0].g.length===1&&gift.state==='waiting'&&gift.days===14&&gift.claim_by&&gift.message==='Thanks for testing',JSON.stringify(r.rows[0].g));
  r=await as(U3,'select luma.my_gifts() as g'); ok("people see only their own gifts",r.rows[0].g.length===1&&r.rows[0].g[0].id!==gift.id);
  r=await sup(`select ref, link, type from luma.notifications where user_id=$1 and type='gift'`,[U2]); ok('the notification points at the gift (opens Settings)',r.rows.length===1&&r.rows[0].ref===gift.id&&r.rows[0].link==='settings',JSON.stringify(r.rows));
  e=await err(U3,`select luma.claim_gift($1)`,[gift.id]); ok("cannot use someone else's gift",!!e&&/not found/.test(e),e);
  const end=(await as(U2,`select luma.claim_gift($1) as e`,[gift.id])).rows[0].e; ok('using it starts the add-on for 14 days',Math.abs((new Date(end)-Date.now())/864e5-14)<0.1,String(end));
  r=await as(U2,'select luma.my_limits() as m'); ok('now it is on, as a gift (not a trial)',r.rows[0].m.addons.includes('study')&&r.rows[0].m.addon_info.study.source==='admin'&&r.rows[0].m.trials_used.length===0,JSON.stringify(r.rows[0].m));
  e=await err(U2,`select luma.claim_gift($1)`,[gift.id]); ok('a gift can only be used once',!!e&&/already used/.test(e),e);
  r=await as(U2,'select luma.my_gifts() as g'); ok('used gifts show as used',r.rows[0].g[0].state==='used');
  // a second gift adds time on top
  await as(U1,`select luma.admin_bulk_gift($1::uuid[],'study',7,null,null,'')`,[[U2]]); const g2=(await as(U2,'select luma.my_gifts() as g')).rows[0].g.find(x=>x.state==='waiting');
  const end2=(await as(U2,`select luma.claim_gift($1) as e`,[g2.id])).rows[0].e; ok('a second gift adds its time after the first',Math.abs((new Date(end2)-new Date(end))/864e5-7)<0.1,`${end} → ${end2}`);
  // limit of 3 unused
  for(let i=0;i<3;i++) await as(U1,`select luma.admin_bulk_gift($1::uuid[],'work',3,null,60,'')`,[[U3]]);
  r=await as(U1,`select luma.admin_bulk_gift($1::uuid[],'work',3,null,60,'') as g`,[[U3]]); ok('a person can hold at most 3 unused gifts',r.rows[0].g.skipped===1&&r.rows[0].g.given===0,JSON.stringify(r.rows[0].g));
  // expiry
  await sup(`update luma.addon_gifts set claim_by = now() - interval '1 hour' where user_id=$1 and addon='work'`,[U3]);
  r=await as(U3,'select luma.my_gifts() as g'); ok('expired gifts show as expired and cannot be used',r.rows[0].g.some(x=>x.state==='expired')); const ex=r.rows[0].g.find(x=>x.state==='expired');
  e=await err(U3,`select luma.claim_gift($1)`,[ex.id]); ok('using an expired gift is refused',!!e&&/expired/.test(e),e);
  // reminders
  const near=(await as(U1,`select luma.admin_bulk_gift($1::uuid[],'work',3,null,7,'')`,[[U2]])).rows[0]; await sup(`update luma.addon_gifts set claim_by = now() + interval '6 days 12 hours' where user_id=$1 and addon='work' and claimed_at is null`,[U2]);
  await sup('select luma.run_gift_reminders()'); r=await sup(`select title from luma.notifications where user_id=$1 and title like '⏳%'`,[U2]); ok('a reminder goes out 7 days before it expires',r.rows.length===1,JSON.stringify(r.rows));
  await sup('select luma.run_gift_reminders()'); r=await sup(`select count(*)::int n from luma.notifications where user_id=$1 and title like '⏳%'`,[U2]); ok('and not twice',r.rows[0].n===1);
  // deleting an account removes its gifts
  await sup('delete from auth.users where id=$1',[U3]); r=await sup('select count(*)::int n from luma.addon_gifts where user_id=$1',[U3]); ok('deleting the account removes its gifts',r.rows[0].n===0);
  r=await as(U1,'select * from luma.admin_recent_actions(20)'); ok('gifts are in the admin log',r.rows.some(x=>x.action==='bulk_gift'));
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.stack.split('\n').slice(0,4).join(' | '));process.exit(2)});
