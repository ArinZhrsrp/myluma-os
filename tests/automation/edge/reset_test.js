const ROOTDIR = (process.env.LUMA_ROOT || require('path').resolve(__dirname, '../../..')).replace(/\/?$/, '/');   // the project folder; set LUMA_ROOT to override
const { JSDOM } = require('./node_modules/jsdom'); const fs=require('fs');
let html=fs.readFileSync(ROOTDIR+'reset-password/index.html','utf8').replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g,'').replace(/<link[^>]*>/g,'');
const js=fs.readFileSync(ROOTDIR+'reset-password/reset-password.js','utf8');
(async()=>{
  const dom=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/reset-password/'}); const w=dom.window; let calls=0,out=0;
  w.LumaAuth={getSession:async()=>({user:1}),updatePassword:async()=>{calls++;await new Promise(r=>setTimeout(r,300));return {error:null}},signOut:async()=>{out++}};
  w.eval(js); await new Promise(r=>setTimeout(r,200));
  const d=w.document, f=d.getElementById('resetForm'), b=d.getElementById('submitBtn');
  d.getElementById('pw').value='abcdef'; d.getElementById('pw2').value='abcdef';
  f.dispatchEvent(new w.Event('submit',{cancelable:true})); f.dispatchEvent(new w.Event('submit',{cancelable:true})); f.dispatchEvent(new w.Event('submit',{cancelable:true}));
  await new Promise(r=>setTimeout(r,50));
  console.log('while saving: disabled', b.disabled, '| spinner', /fa-spin/.test(b.innerHTML), '| inputs locked', d.getElementById('pw').disabled, '| text', b.textContent.trim());
  await new Promise(r=>setTimeout(r,500));
  console.log('after: calls', calls, '| signOut', out, '| still locked', b.disabled, '| text', b.textContent.trim(), '| ok shown', d.getElementById('formOk').style.display);
  // error path
  const dom2=new JSDOM(html,{runScripts:'outside-only',url:'http://localhost/reset-password/'}); const w2=dom2.window;
  w2.LumaAuth={getSession:async()=>({user:1}),updatePassword:async()=>({error:{message:'Password too weak'}}),signOut:async()=>{}}; w2.eval(js); await new Promise(r=>setTimeout(r,200));
  const d2=w2.document; d2.getElementById('pw').value='x'; d2.getElementById('pw2').value='x'; d2.getElementById('resetForm').dispatchEvent(new w2.Event('submit',{cancelable:true})); await new Promise(r=>setTimeout(r,100));
  console.log('error path: unlocked', !d2.getElementById('submitBtn').disabled, '| text', d2.getElementById('submitBtn').textContent.trim(), '| msg', d2.getElementById('formError').textContent);
  process.exit(0);
})();
