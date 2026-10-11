const {chromium}=require(process.env.PLAYWRIGHT_CORE||'/tmp/luma-manual-tools/node_modules/playwright-core');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const imageRoot=path.resolve(__dirname,'../assets/screenshots');
const captures=JSON.parse(fs.readFileSync(path.join(imageRoot,'capture-log.json'))).pages;
assert.equal(captures.length,40,'Every screenshot must have a verified capture record');
assert.equal(new Set(captures.map(c=>c.id)).size,40);
assert.equal(new Set(captures.map(c=>c.sha256)).size,40,'Duplicate captures');
for(const c of captures){
 assert.deepEqual(c.errors,[]);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(imageRoot,c.id+'.png'))).digest('hex'),c.sha256,'Capture changed since verification: '+c.id);
 if(c.page)assert.equal(c.activePage,'page-'+c.page,'Wrong application page: '+c.id);
 if(c.tab)assert.equal(c.activeTab.toLowerCase(),c.tab,'Wrong application tab: '+c.id);
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8772/');
 const guides=await page.evaluate(()=>window.LUMA_GUIDES);assert.equal(guides.length,29);
 const ids=new Set(guides.map(g=>g.id));let screenshots=0;
 for(const g of guides){
  for(const id of g.related)assert(ids.has(id),'Missing related guide '+id);
  await page.goto('http://127.0.0.1:8772/#'+g.id);
  await page.waitForFunction(title=>document.querySelector('h1')?.textContent===title,g.title);
  assert.equal(await page.locator('.steps li').count(),g.steps.length);
  for(const id of [g.id,...(g.gallery||[]).map(x=>x.id)]){
   assert(captures.some(c=>c.id===id),'Missing verified screenshot for '+id);
   const r=await page.request.get('http://127.0.0.1:8772/assets/screenshots/'+id+'.png');assert.equal(r.status(),200,id);screenshots++;
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desktop overflow '+g.id);
 }
 await page.goto('http://127.0.0.1:8772/#study');await page.locator('.gallery-item').first().click();assert(await page.locator('#image-dialog').isVisible());await page.keyboard.press('Escape');assert(!await page.locator('#image-dialog').isVisible());
 await page.locator('#search').fill('timesheet');assert((await page.locator('.nav-link').count())>0);assert((await page.locator('.nav-link').count())<29);
 await page.locator('#search').fill('zzzzzzzzzz');assert(await page.locator('.no-results').isVisible());await page.locator('#search').fill('');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
 for(const g of guides){await page.goto('http://127.0.0.1:8772/#'+g.id);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow '+g.id);}
 await page.locator('#menu-toggle').click();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');await page.locator('.nav-link[href="#register"]').click();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');
 await page.goto('http://127.0.0.1:8772/#home');await page.waitForTimeout(250);assert(await page.evaluate(()=>document.querySelector('#sidebar').getBoundingClientRect().right<=0),'Mobile menu should start closed');
 await page.screenshot({path:'/tmp/luma-guide-mobile-final.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1050});await page.waitForTimeout(250);await page.screenshot({path:'/tmp/luma-guide-desktop-final.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log(`PASS: ${guides.length} guides, ${screenshots} screenshots, related links, search, image viewer, mobile menu and desktop/mobile overflow checks.`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
