// Capture real UI with fictional fixtures; assert the actual page, not only the URL.
const {chromium}=require(process.env.PLAYWRIGHT_CORE || '/tmp/luma-manual-tools/node_modules/playwright-core');
const path=require('path'),fs=require('fs'),assert=require('node:assert/strict'),crypto=require('crypto');
const output=path.resolve(__dirname,'../assets/screenshots');
const titles={dashboard:'Dashboard',calendar:'Calendar',tasks:'Tasks & Work',reminders:'Reminders',money:'Money',bills:'Bills',subscriptions:'Subscriptions',split:'Split expenses',goals:'Goals',habits:'Habits',health:'Health',notes:'Notes & Docs',documents:'Documents',contacts:'Contacts',assistant:'Lumi',analytics:'Analytics',settings:'Settings',notifications:'Notifications',purchases:'Purchase history',feedback:'Feedback',support:'Support',work:'Work',company:'Company',study:'Study',studyarchive:'Study archive'};
const forms={login:'loginForm',register:'registerForm','verify-email':'verifyForm','reset-password':'resetForm'};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try {
 const context=await browser.newContext({viewport:{width:1440,height:1040},deviceScaleFactor:1,timezoneId:'Asia/Kuala_Lumpur',serviceWorkers:'block'});
 await context.route('**/*.supabase.co/**',route=>route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const targets=Object.keys(titles).map(id=>({id,page:id,mode:['work','company'].includes(id)?'work':['study','studyarchive'].includes(id)?'study':'personal'}));
 targets.push(...Object.keys(forms).map(id=>({id,form:forms[id]})));
 for(const [mode,tabs,attr] of [['work',['projects','tasks','teams','time'],'wktab'],['study',['timetable','assignments','subjects','semesters','notes','cards','groups'],'sdtab']])
  for(const tab of tabs) targets.push({id:mode+'-'+tab,page:mode,mode,tab,selector:`[data-${attr}="${tab}"]`});
 const manifest=[];
 for(const target of targets){
  errors.length=0;
  if(target.form){
   await page.goto('http://127.0.0.1:8771/'+target.id+'/',{waitUntil:'load'});
   await page.locator('#'+target.form).waitFor({state:'visible'});
   await page.waitForFunction(()=>!document.getElementById('lumaLoader'));
   if(target.id==='reset-password')assert(await page.locator('#submitBtn').isEnabled(),'Recovery fixture must have a valid session');
  }else{
   await page.goto('http://127.0.0.1:8771/app/?mode='+target.mode,{waitUntil:'load'});
   await page.waitForFunction(()=>typeof lumaModesReady !== 'undefined' && typeof goTo === 'function');
   await page.evaluate(async()=>{await lumaModesReady;});
   // initModes can reset the initial hash to a workspace home. Navigate after it completes.
   await page.evaluate(key=>goTo(key),target.page);
   await page.locator('#page-'+target.page+'.active').waitFor({state:'visible'});
   await page.waitForFunction(()=>!document.getElementById('lumaLoader'));
   assert.equal((await page.locator('#pageTitle').innerText()).trim(),titles[target.page],target.id+' title');
   if(target.selector){
    await page.locator(target.selector).click();
    await page.waitForFunction(selector=>document.querySelector(selector)?.classList.contains('on'),target.selector);
   }
   await page.waitForFunction(()=>!document.querySelector('.page.active')?.innerText.includes('Loading…'));
  }
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(350); // Let layout transitions and charts settle after readiness assertions.
  assert.deepEqual(errors,[],target.id+' browser errors');
  const state=await page.evaluate(()=>({activePage:document.querySelector('.page.active')?.id||null,title:document.querySelector('#pageTitle')?.textContent||document.querySelector('h2')?.textContent,activeTab:document.querySelector('#wkTabs .on, #sdTabs .on')?.textContent.trim()||null,text:(document.querySelector('.page.active')||document.querySelector('form')||document.body).innerText}));
  if(target.page)assert.equal(state.activePage,'page-'+target.page);
  const image=await page.screenshot({path:path.join(output,target.id+'.png')});
  manifest.push({...target,...state,sha256:crypto.createHash('sha256').update(image).digest('hex'),errors:[]});
  console.log(target.id+' verified: '+state.title+(target.selector?' / '+state.activeTab:''));
 }
 assert.equal(manifest.length,40);
 assert.equal(new Set(manifest.map(p=>p.sha256)).size,40,'Different topics must not reuse identical screenshots');
 fs.writeFileSync(path.join(output,'capture-log.json'),JSON.stringify({appVersion:'0.30.4',commit:'8c0e122',sampleData:true,pages:manifest},null,2)+'\n');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
