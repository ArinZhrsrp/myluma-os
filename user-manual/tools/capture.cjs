// npm install --prefix /tmp/luma-manual-tools playwright-core
// Start preview-app.cjs first. Chrome must be installed; all account data is fictional.
const {chromium}=require(process.env.PLAYWRIGHT_CORE || '/tmp/luma-manual-tools/node_modules/playwright-core');
const path=require('path'),fs=require('fs');
const output=path.resolve(__dirname,'../assets/screenshots');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1040},deviceScaleFactor:1,timezoneId:'Asia/Kuala_Lumpur'});
 // Prevent real database calls, including on unauthenticated pages.
 await context.route('**/*.supabase.co/**',route=>route.abort());
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const pages=['dashboard','calendar','tasks','reminders','money','bills','subscriptions','split','goals','habits','health','notes','documents','contacts','assistant','analytics','settings','notifications','purchases','feedback','support'];
 const targets=pages.map(id=>({id,url:'/app/?mode=personal#'+id})).concat([
 {id:'work',url:'/app/?mode=work#work'}, {id:'company',url:'/app/?mode=work#company'},
 {id:'study',url:'/app/?mode=study#study'}, {id:'studyarchive',url:'/app/?mode=study#studyarchive'},
 ...['login','register','verify-email','reset-password'].map(id=>({id,url:'/'+id+'/'}))]);
 for (const [mode, tabs, attr] of [['work',['projects','tasks','teams','time'],'wktab'],['study',['timetable','assignments','subjects','semesters','notes','cards','groups'],'sdtab']]) {
  for (const tab of tabs) targets.push({id:mode+'-'+tab,url:'/app/?mode='+mode+'#'+mode,selector:'[data-'+attr+'="'+tab+'"]'});
 }
 const manifest=[];
 for(const target of targets){
  if(process.env.TABS_ONLY && !target.selector) continue;
  errors.length=0;await page.goto('http://127.0.0.1:8771'+target.url,{waitUntil:'load'});await page.waitForTimeout(1700);
  if(target.selector){await page.locator(target.selector).click();await page.waitForTimeout(800);}
  await page.screenshot({path:path.join(output,target.id+'.png')});
  manifest.push({...target,errors:[...errors],text:(await page.locator('body').innerText()).slice(0,1200)});console.log(target.id,errors.length?'ERROR '+errors.join('; '):'captured');
 }
 fs.writeFileSync(path.join(output,'capture-log.json'),JSON.stringify({appVersion:'0.30.4',commit:'8c0e122',sampleData:true,pages:manifest},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
