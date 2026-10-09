(function(){
  const out=[]; const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const desc=e=>e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\s+/).slice(0,2).join('.'):'');
  async function run(){
    await wait(3000);
    const vw=document.documentElement.clientWidth;
    const ovs=[...document.querySelectorAll('.modal-overlay')];
    for(const ov of ovs){
      ov.classList.add('open'); await wait(120);
      const box=ov.querySelector('.profile-edit-modal, .confirm-modal, [class*="modal"]:not(.modal-overlay)')||ov.firstElementChild;
      const bad=new Map(); let w=0;
      if(box){ const r=box.getBoundingClientRect(); w=Math.round(r.width); if(r.right>vw+1||r.left<-1) bad.set('BOX '+Math.round(r.left)+'..'+Math.round(r.right),1);
        box.querySelectorAll('*').forEach(e=>{ const rr=e.getBoundingClientRect(); if(rr.width===0||rr.height===0) return; if(getComputedStyle(e).display==='none') return;
          let p=e.parentElement, skip=false; while(p&&p!==box){ const o=getComputedStyle(p).overflowX; if(o==='auto'||o==='scroll'){ skip=true; break; } p=p.parentElement; }
          if(!skip&&(rr.right>box.getBoundingClientRect().right+1.5||rr.right>vw+1)){ const d=desc(e); bad.set(d,(bad.get(d)||0)+1); } }); }
      if(bad.size) out.push((ov.id||desc(ov))+' (w='+w+'): '+[...bad.entries()].slice(0,5).map(x=>x[0]).join(', '));
      ov.classList.remove('open');
    }
    out.push('checked '+ovs.length+' popups at '+vw+'px');
    const pre=document.createElement('pre'); pre.id='auditOut'; pre.textContent='AUDIT-START\n'+out.join('\n')+'\nAUDIT-END'; (window.parent||window).document.body.appendChild(pre);
  }
  window.addEventListener('load',()=>setTimeout(run,300));
})();
