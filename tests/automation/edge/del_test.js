const ROOTDIR = (process.env.LUMA_ROOT || require('path').resolve(__dirname, '../../..')).replace(/\/?$/, '/');   // the project folder; set LUMA_ROOT to override
const e=require('esbuild'), fs=require('fs');
let src=fs.readFileSync(ROOTDIR+'supabase/functions/lumi/index.ts','utf8').replace(/^import .*$/m,'const createClient=()=>({});');
src=e.transformSync(src,{loader:'ts'}).code+"\nmodule.exports={runTool};";
globalThis.Deno={env:{get:()=>undefined},serve(){}};
const m={exports:{}}; new Function('module','exports','Deno',src)(m,m.exports,globalThis.Deno); const {runTool}=m.exports;
// tiny in-memory database
const T={ tasks:[{id:'t1',user_id:'u1',title:'Quiz prep',space:'study',status:'todo'},{id:'t2',user_id:'u1',title:'Quiz notes',space:'personal',status:'done'},{id:'t3',user_id:'u2',title:'Quiz of someone else',space:'study',status:'todo'},{id:'t4',user_id:'u1',title:'Buy milk',space:'study',status:'todo'}], assistant_pending:[] };
function q(table){ const st={ f:[], op:'select', payload:null, ids:null };
  const api={ select(){ if(st.op==='delete') st.ret=true; return api; }, eq(c,v){ st.f.push(r=>r[c]===v); return api; }, ilike(c,p){ const s=p.replace(/%/g,'').toLowerCase(); st.f.push(r=>String(r[c]).toLowerCase().includes(s)); return api; }, lt(c,v){ st.f.push(r=>r[c]<v); return api; }, in(c,v){ st.f.push(r=>v.includes(r[c])); return api; }, limit(){ return api; },
    maybeSingle(){ st.single=true; return api; }, upsert(row){ T[table]=T[table].filter(r=>r.user_id!==row.user_id).concat([row]); return Promise.resolve({data:null,error:null}); }, delete(){ st.op='delete'; return api; },
    then(res){ let rows=T[table].filter(r=>st.f.every(f=>f(r))); if(st.op==='delete'){ T[table]=T[table].filter(r=>!rows.includes(r)); return res({data:st.ret?rows.map(r=>({id:r.id})):null,error:null}); } return res({data:st.single?(rows[0]||null):rows,error:null}); } };
  return api; }
const db={ from:q };
(async()=>{
  const run=(a,ctx)=>runTool('delete_items',a,db,'2026-10-08','u1','study',ctx);
  console.log('1 no filter:', JSON.stringify(await run({table:'tasks'},{reqId:'r1'})));
  console.log('2 preview:', JSON.stringify(await run({table:'tasks',title_contains:'quiz'},{reqId:'r1'})));
  console.log('3 confirm same request:', JSON.stringify(await run({table:'tasks',confirm:true},{reqId:'r1',lastUser:'yes'})));
  console.log('4 confirm, not a yes:', JSON.stringify(await run({table:'tasks',confirm:true},{reqId:'r2',lastUser:'hmm maybe later please'})));
  console.log('5 confirm, injected long text:', JSON.stringify(await run({table:'tasks',confirm:true},{reqId:'r2',lastUser:'yes '+'x'.repeat(60)})));
  console.log('6 confirm yes:', JSON.stringify(await run({table:'tasks',confirm:true},{reqId:'r2',lastUser:'Yes'})));
  console.log('remaining tasks:', T.tasks.map(t=>t.id+':'+t.user_id).join(', '), '| pending left:', T.assistant_pending.length);
  console.log('7 confirm again (nothing pending):', JSON.stringify(await run({table:'tasks',confirm:true},{reqId:'r3',lastUser:'yes'})));
  console.log('8 other kind not allowed:', JSON.stringify(await runTool('delete_items',{table:'profiles',all:true},db,'2026-10-08','u1','study',{reqId:'r4'})));
})();
