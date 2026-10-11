const ROOTDIR = (process.env.LUMA_ROOT || require('path').resolve(__dirname, '../../..')).replace(/\/?$/, '/');   // the project folder; set LUMA_ROOT to override
const fs=require('fs'), vm=require('vm');
const calls=[]; let hasColumn=true;
const builder=(t)=>({ select:(...a)=>{ const q={ cols:a[0], filters:[], in(c,v){ this.filters.push([c,v]); return this; }, or(v){ this.filters.push(['or',v]); return this; }, not(){ return Promise.resolve({data:[{id:'sm0'}],error:null}); }, limit(){ return Promise.resolve({data:[],error:hasColumn?null:{message:'column space does not exist'}}); } }; calls.push(['select',t,q]); return q; }, insert:(rows)=>{ calls.push(['insert',t,rows]); return { select(){ return this; } }; }, update:(r)=>{ calls.push(['update',t,r]); return {}; }, delete:()=>({}) });
const client={ schema:(n)=>({ from:(t)=>builder(t) }) };
const win={ LumaAuth:{ client } };
const ctx=vm.createContext({ window:win, LUMA_MODE:'personal', prefs:{}, prefOn:(k,d)=>k in ctx.prefs?ctx.prefs[k]:d, console });
vm.runInContext("var LumaSpace;", ctx);
vm.runInContext(fs.readFileSync(ROOTDIR+'shared/luma-space.js','utf8').replace(/window\.LumaSpace/,'window.LumaSpace'), ctx);
const S=win.LumaSpace; const c=win.LumaAuth.client;
(async()=>{
  console.log('ready before init:', S.ready);
  c.schema('luma').from('tasks').select('*'); console.log('not ready → no filter:', JSON.stringify(calls.pop()[2].filters));
  hasColumn=false; console.log('init without column:', await S.init());
  hasColumn=true; console.log('init with column:', await S.init());
  const r=(m,prefs)=>{ ctx.LUMA_MODE=m; ctx.prefs=prefs||{}; return JSON.stringify(S.allowed()); };
  console.log('personal:', r('personal'), '| +study:', r('personal',{show_study_personal:true}), '| +both:', r('personal',{show_study_personal:true,show_work_personal:true}), '| work:', r('work',{show_study_personal:true}), '| study:', r('study'));
  ctx.LUMA_MODE='study'; c.schema('luma').from('events').select('id,title'); let q=calls.pop(); console.log('study read filter:', JSON.stringify(q[2].filters));
  c.schema('luma').from('events').insert({title:'x'}); console.log('study insert:', JSON.stringify(calls.pop()[2]));
  c.schema('luma').from('reminders').insert([{title:'a'},{title:'b',space:'work'}]); console.log('array insert:', JSON.stringify(calls.pop()[2]));
  c.schema('luma').from('contacts').select('*'); q=calls.pop(); console.log('unscoped table filter:', JSON.stringify(q[2].filters));
  c.schema('luma').from('tasks').update({title:'y'}); console.log('update untouched:', JSON.stringify(calls.pop()[2]));
  console.log('visible(row study) in personal:', (ctx.LUMA_MODE='personal', S.visible({space:'study'})), '| in study:', (ctx.LUMA_MODE='study', S.visible({space:'study'})));
})();

(async()=>{
  await new Promise(r=>setTimeout(r,50));
  hasColumn=true; await S.init(); console.log('semReady after init:', S.semReady, '| archived ids:', JSON.stringify(S.archivedSems));
  ctx.LUMA_MODE='study'; calls.length=0; c.schema('luma').from('reminders').select('id,title'); let q=calls.pop(); console.log('study read with archived semester:', JSON.stringify(q[2].filters));
  S.bypass=true; c.schema('luma').from('reminders').select('id'); q=calls.pop(); console.log('bypass (archive page):', JSON.stringify(q[2].filters)); S.bypass=false;
  S.setArchived([]); c.schema('luma').from('events').select('id'); q=calls.pop(); console.log('no archived semesters:', JSON.stringify(q[2].filters));
})();
