(function(){
  const keys=(new URLSearchParams(location.search).get('pages')||'dashboard,calendar,tasks,reminders,money,split,subscriptions,bills,goals,habits,health,notes,documents,contacts,assistant,analytics,settings,purchases,support,notifications,admin,adminreport').split(',');
  const out=[]; const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const desc=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'');
  async function run(){
    await wait(2500);
    for(const k of keys){
      try{ goTo(k); }catch(e){ out.push(k+': goTo failed '+e.message); continue; }
      await wait(1500);
      const pg=document.getElementById('page-'+k); const vw=document.documentElement.clientWidth; const bad=new Map();
      const scrollers=[document.documentElement, document.querySelector('.main-content'), pg];
      const wide=scrollers.filter(s=>s&&s.scrollWidth>s.clientWidth+1).map(s=>desc(s)+' '+s.scrollWidth+'>'+s.clientWidth);
      if(pg) pg.querySelectorAll('*').forEach(e=>{ const r=e.getBoundingClientRect(); if(r.width===0||r.height===0) return; const cs=getComputedStyle(e); if(cs.position==='fixed') return; if(r.right>vw+1||r.left<-1){ // ignore stuff inside a horizontally scrollable box
          let p=e.parentElement, inside=false; while(p&&p!==pg){ const o=getComputedStyle(p).overflowX; if(o==='auto'||o==='scroll'){ inside=true; break; } p=p.parentElement; } if(!inside){ const d=desc(e); bad.set(d,(bad.get(d)||0)+1); } } });
      let chain=''; if(bad.size){ const first=[...pg.querySelectorAll('*')].find(e=>{const r=e.getBoundingClientRect(); return r.width>0&&getComputedStyle(e).position!=='fixed'&&r.right>vw+1;}); if(first){ let p=first; const parts=[]; while(p&&p!==pg.parentElement){ const cs=getComputedStyle(p); parts.push(desc(p)+'['+cs.display+(cs.display.includes('grid')?' cols='+cs.gridTemplateColumns:'')+' w='+Math.round(p.getBoundingClientRect().width)+']'); p=p.parentElement; } chain='\n    chain: '+parts.slice(0,7).join(' < '); } }
      const hs=[]; if(pg) pg.querySelectorAll('*').forEach(e=>{ const o=getComputedStyle(e).overflowX; if((o==='auto'||o==='scroll')&&e.scrollWidth>e.clientWidth+1) hs.push(desc(e)+' '+e.scrollWidth+'>'+e.clientWidth); });
      if(hs.length) bad.set('HSCROLL:'+hs.slice(0,3).join(' | '),1);
      const clipped=new Map(); if(pg) pg.querySelectorAll('*').forEach(e=>{ const r=e.getBoundingClientRect(); if(r.width===0||r.height===0) return; if(getComputedStyle(e).position==='fixed') return; let a=e.parentElement; while(a&&a!==pg){ const o=getComputedStyle(a).overflowX; if(o==='hidden'||o==='clip'){ const ar=a.getBoundingClientRect(); if(r.right>ar.right+1.5&&ar.width>0){ const d=desc(e)+' in '+desc(a); clipped.set(d,(clipped.get(d)||0)+1); } break; } if(o==='auto'||o==='scroll') break; a=a.parentElement; } });
      if(clipped.size) bad.set('CLIPPED:'+[...clipped.keys()].slice(0,4).join(' | '),1);
      out.push(k+': '+(wide.length?'SCROLLS-X ['+wide.join('; ')+'] ':'ok ')+(bad.size?'overflowing: '+[...bad.entries()].slice(0,6).map(x=>x[0]+(x[1]>1?' x'+x[1]:'')).join(', '):'')+chain);
    }
    const pre=document.createElement('pre'); pre.id='auditOut'; pre.textContent='AUDIT-START\n'+out.join('\n')+'\nAUDIT-END'; (window.parent||window).document.body.appendChild(pre);
  }
  window.addEventListener('load',()=>setTimeout(run,500));
})();
