const ROOTDIR = (process.env.LUMA_ROOT || require('path').resolve(__dirname, '../../..')).replace(/\/?$/, '/');   // the project folder; set LUMA_ROOT to override
const e=require('esbuild'), fs=require('fs');
let src=fs.readFileSync(ROOTDIR+'supabase/functions/lumi/index.ts','utf8').replace(/^import .*$/m,'const createClient=()=>({});');
src=e.transformSync(src,{loader:'ts'}).code+"\nmodule.exports={runTool,TOOLS};";
globalThis.Deno={env:{get:()=>undefined},serve(){}};
const m={exports:{}}; new Function('module','exports','Deno',src)(m,m.exports,globalThis.Deno); const {runTool,TOOLS}=m.exports;
const T={ study_tasks:[{id:'t1',title:'ER diagram report',course_id:'c1',status:'todo'},{id:'t2',title:'Midterm exam',course_id:'c2',status:'todo'},{id:'t3',title:'Midterm quiz',course_id:'c2',status:'todo'}], study_courses:[{id:'c1',name:'Database Systems',archived:false},{id:'c2',name:'Calculus',archived:false},{id:'c3',name:'Old Physics',archived:true}], study_classes:[{id:'k1',course_id:'c2',weekday:1,start_time:'09:00:00',end_time:'10:00:00'},{id:'k2',course_id:'c2',weekday:3,start_time:'14:00:00',end_time:'15:00:00'},{id:'k3',course_id:'c1',weekday:2,start_time:'10:00:00',end_time:'12:00:00'}] };
const log=[];
function q(table){ const st={f:[],op:'select',upd:null};
  const api={ select(){return api;}, eq(c,v){st.f.push(r=>r[c]===v);return api;}, ilike(c,p){const s=String(p).replace(/%/g,'').toLowerCase(); st.f.push(r=>String(r[c]).toLowerCase().includes(s));return api;}, limit(){return api;}, update(u){st.op='update';st.upd=u;return api;},
    then(res){ const rows=T[table].filter(r=>st.f.every(f=>f(r))); if(st.op==='update'){ rows.forEach(r=>Object.assign(r,st.upd)); log.push([table,rows.map(r=>r.id),st.upd]); return res({data:rows,error:null}); } return res({data:rows,error:null}); } };
  return api; }
const db={from:q};
(async()=>{
  const run=(n,a)=>runTool(n,a,db,'2026-10-08','u1','study',{});
  console.log('tools:', TOOLS.map(t=>t.function.name).filter(n=>/update_study/.test(n)).join(', '));
  console.log('1 unique:', JSON.stringify(await run('update_study_items',{items:[{match:'ER diagram',due_date:'2026-10-20',status:'in_progress'}]})), JSON.stringify(log.pop()));
  console.log('2 ambiguous:', JSON.stringify(await run('update_study_items',{items:[{match:'midterm',due_date:'2026-10-21'}]})));
  console.log('3 exact among several:', JSON.stringify(await run('update_study_items',{items:[{match:'Midterm exam',score:45,max_score:50,due_date:''}]})), JSON.stringify(log.pop()));
  console.log('4 unknown subject:', JSON.stringify(await run('update_study_items',{items:[{match:'ER diagram',subject:'Nope'}]})));
  console.log('5 subject edit:', JSON.stringify(await run('update_study_subject',{match:'calc',credit_hours:4,target_percent:80})), JSON.stringify(log.pop()));
  console.log('6 archived subject not touched:', JSON.stringify(await run('update_study_subject',{match:'physics',credit_hours:3})));
  console.log('7 class: several classes:', JSON.stringify(await run('update_study_class',{subject:'Calculus',start_time:'10:00'})));
  console.log('8 class move:', JSON.stringify(await run('update_study_class',{subject:'Calculus',weekday:1,new_weekday:4,start_time:'11:00',end_time:'12:00'})), JSON.stringify(log.pop()));
  console.log('9 end before start:', JSON.stringify(await run('update_study_class',{subject:'Database',start_time:'13:00'})));
})();
