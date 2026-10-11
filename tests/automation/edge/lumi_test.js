const ROOTDIR = (process.env.LUMA_ROOT || require('path').resolve(__dirname, '../../..')).replace(/\/?$/, '/');   // the project folder; set LUMA_ROOT to override
const e=require('esbuild'), fs=require('fs');
let src=fs.readFileSync(ROOTDIR+'supabase/functions/lumi/index.ts','utf8').replace(/^import .*$/m,'const createClient=()=>({});');
src=e.transformSync(src,{loader:'ts'}).code+"\nmodule.exports={runTool, TOOLS};";
globalThis.Deno={env:{get:()=>undefined},serve(){}};
const m={exports:{}}; new Function('module','exports','Deno',src)(m,m.exports,globalThis.Deno);
const {runTool,TOOLS}=m.exports;
// fake db recording inserts
const log=[]; const store={study_courses:[{id:'c1',name:'Calculus'}]};
const db={from:(t)=>({ select:()=>({ then:(r)=>r({data:store[t]||[],error:null}), maybeSingle(){return this}, single(){return this} }), insert:(rows)=>{ log.push([t,rows]); const q={ select:()=>({ single:()=>Promise.resolve({data:{id:'new-'+log.length},error:null}) }), then:(r)=>r({data:rows,error:null}) }; return q; } }) };
(async()=>{
  console.log('tools:', TOOLS.map(t=>t.function.name).join(', '));
  let out=await runTool('create_reminders',{items:Array.from({length:3},(_,i)=>({title:'R'+i}))},db,'2026-10-08','u1'); console.log('reminders:',JSON.stringify(out)); console.log(JSON.stringify(log.pop()[1][1]));
  out=await runTool('add_study_items',{items:[{title:'Quiz 1',kind:'quiz',subject:'Calculus'},{title:'Report',subject:'Physics'},{title:'Exam',kind:'exam',due_date:'2026-12-01',due_time:'09:00',weight:40}]},db,'2026-10-08','u1'); console.log('study items:',JSON.stringify(out)); 
  console.log('inserts:', log.map(l=>l[0]+':'+(Array.isArray(l[1])?l[1].length:1)).join(' | ')); console.log(JSON.stringify(log[log.length-1][1][0]), JSON.stringify(log[log.length-1][1][1]));
  out=await runTool('add_study_classes',{items:[{subject:'Calculus',weekdays:[1,3],start_time:'09:00',weeks:14}]},db,'2026-10-08','u1'); console.log('classes:',JSON.stringify(out)); console.log(JSON.stringify(log[log.length-1][1]));
  out=await runTool('create_tasks',{items:[{title:'T1'},{title:'T2',due_date:'2026-10-20'}]},db,'2026-10-08','u1'); console.log('tasks:',JSON.stringify(out));
})();
