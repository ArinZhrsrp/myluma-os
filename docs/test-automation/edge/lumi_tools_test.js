const ROOTDIR = (process.env.LUMA_ROOT || require('path').resolve(__dirname, '../../..')).replace(/\/?$/, '/');   // the project folder; set LUMA_ROOT to override
const e=require('esbuild'), fs=require('fs');
let src=fs.readFileSync(ROOTDIR+'supabase/functions/lumi/index.ts','utf8').replace(/^import .*$/m,'const createClient=()=>({});');
src=e.transformSync(src,{loader:'ts'}).code+"\nmodule.exports={runTool, TOOLS};";
globalThis.Deno={env:{get:()=>undefined},serve(){}};
const m={exports:{}}; new Function('module','exports','Deno',src)(m,m.exports,globalThis.Deno);
const {runTool,TOOLS}=m.exports;
const calls=[]; const data={
  habits:[{id:'h1',name:'Read 20 pages'}], goals:[{id:'g1',title:'Save RM 1000',current_value:250,target_value:1000}],
  bills:[{id:'b1',name:'Unifi',amount:129,recurrence:'monthly',due_date:'2026-05-15'}], bill_payments:[{bill_id:'b1',due_date:'2026-09-15'}],
  tasks:[{id:'t1',title:'Pay rent'},{id:'t2',title:'Pay phone'}], events:[{id:'e1',title:'Standup',start_time:'10:00',end_time:null}], notes:[{id:'n1',title:'Ideas',body:'first'}],
};
const mk=(t)=>{ const st={t,op:'select',filters:[]}; const q=new Proxy({}, { get(_,k){
  if(k==='then') return (res)=>{ calls.push(st); res({data: st.op==='select'?(data[t]||[]).filter(r=>!st.ilike||String(r[st.ilike[0]]).toLowerCase().includes(st.ilike[1])):null,error:null}); };
  return (...a)=>{ if(['update','upsert','delete','insert'].includes(k)){st.op=k; st.payload=a[0];} else if(k==='ilike') st.ilike=[a[0],a[1].replace(/%/g,'').toLowerCase()]; else st.filters.push([k,a]); return q; }; } }); return q; };
const db={from:mk, rpc:async(n,a)=>{ calls.push({rpc:n,a}); if(n==='list_contacts') return {data:[{status:'accepted',other_id:'u2',other_first_name:'Aina',other_last_name:'Tan'},{status:'accepted',other_id:'u3',other_first_name:'Ben',other_last_name:''}],error:null};
  if(n==='my_splits') return {data:[{id:'s1',title:'Dinner at Nobu',paid_by:'u1',paid_by_name:'You',members:[{user_id:'u1',name:'You',share:50,paid:false},{user_id:'u2',name:'Aina Tan',share:50,paid:false}]}],error:null};
  return {data:'ok',error:null}; }};
const last=()=>calls[calls.length-1];
(async()=>{
  console.log('tools:', TOOLS.map(t=>t.function.name).join(', '));
  let o=await runTool('log_habit',{habit:'read'},db,'2026-10-08','u1'); console.log('log_habit:',JSON.stringify(o), JSON.stringify(last().payload));
  o=await runTool('update_goal',{goal:'save',add:100},db,'2026-10-08','u1'); console.log('update_goal:',JSON.stringify(o));
  o=await runTool('mark_bill_paid',{bill:'unifi'},db,'2026-10-08','u1'); console.log('mark_bill_paid:',JSON.stringify(o), JSON.stringify(last().payload));
  o=await runTool('update_item',{table:'tasks',match:'rent',status:'done'},db,'2026-10-08','u1'); console.log('update_item done:',JSON.stringify(o));
  o=await runTool('update_item',{table:'tasks',match:'pay',status:'done'},db,'2026-10-08','u1'); console.log('update_item ambiguous:',JSON.stringify(o));
  o=await runTool('update_item',{table:'events',match:'standup',date:'2026-10-10',time:'11:00'},db,'2026-10-08','u1'); console.log('update_item event:',JSON.stringify(o));
  o=await runTool('update_item',{table:'notes',match:'ideas',append:'second'},db,'2026-10-08','u1'); console.log('note append:',JSON.stringify(last().payload));
  o=await runTool('create_habits',{items:[{name:'Stretch',days:[1,3]}]},db,'2026-10-08','u1'); console.log('create_habits:',JSON.stringify(o));
  o=await runTool('create_bills',{items:[{name:'Netflix',amount:55}]},db,'2026-10-08','u1'); console.log('create_bills:',JSON.stringify(o));
  o=await runTool('split_expense',{title:'Dinner',amount:100,tax:'service10_sst6',people:['Aina','Ben']},db,'2026-10-08','u1'); console.log('split:',JSON.stringify(o)); const sv=calls.filter(c=>c.rpc==='save_split').pop(); console.log(' rpc:',JSON.stringify(sv.a));
  o=await runTool('split_expense',{title:'Trip',amount:90,people:['Zed']},db,'2026-10-08','u1'); console.log('split unknown:',JSON.stringify(o));
  o=await runTool('split_expense',{title:'Gift',amount:90,people:['Aina'],include_me:false},db,'2026-10-08','u1'); console.log('split not me:',JSON.stringify(o));
  o=await runTool('mark_split_paid',{split:'nobu',person:'aina'},db,'2026-10-08','u1'); console.log('mark_split_paid:',JSON.stringify(o));
  o=await runTool('get_overview',{},db,'2026-10-08','u1'); console.log('overview keys:',Object.keys(o).join(','), JSON.stringify(o.split_expenses));
})().catch(x=>console.log('ERR',x.stack.split('\n').slice(0,4).join(' | ')));
