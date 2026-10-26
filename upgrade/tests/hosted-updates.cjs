const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const folder='upgrade/server/public',a=JSON.parse(fs.readFileSync(folder+'/build.json')).build,b='b'.repeat(64);
 const script=fs.readdirSync(folder+'/assets').find(n=>n.endsWith('.js')&&fs.statSync(folder+'/assets/'+n).size<200&&fs.readFileSync(folder+'/assets/'+n,'utf8').startsWith('window.MilanoBuildId='));assert(script);
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:810}});let newer=false,navigations=0;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++});
  await page.route('**/api/build',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({build:newer?b:a})}));
  await page.route('**/assets/'+script,r=>r.fulfill({contentType:'text/javascript',body:'window.MilanoBuildId='+JSON.stringify(newer?b:a)+';'}));
  await page.goto('http://127.0.0.1:5183/play/?circuit=interlagos');await page.waitForFunction(()=>window.MilanoReady,null,{timeout:180000});
  assert(await page.locator('#desktop-download').isVisible());assert.equal(await page.locator('#desktop-download').getAttribute('href'),'/downloads/Milano-Apex-Windows.zip');assert(!(await page.locator('#play-latest').isVisible()));
  await page.screenshot({path:'upgrade/qa/download-home.png'});
  await page.evaluate(()=>{newSession('pr');race.cd=0;state='race';show('none')});newer=true;
  await page.evaluate(()=>MilanoUpdates.check());assert.equal(navigations,1);assert.equal(await page.evaluate(()=>MilanoUpdates.pending),b);
  await page.waitForTimeout(400);assert.equal(navigations,1);
  await page.evaluate(()=>{state='menu';show('menu');MilanoUpdates.apply()});
  await page.waitForFunction(()=>window.MilanoBuildId==='b'.repeat(64)&&window.MilanoReady,null,{timeout:180000});
  assert.equal(navigations,2);await page.evaluate(()=>MilanoUpdates.check());await page.waitForTimeout(250);assert.equal(navigations,2);assert.deepEqual(errors,[]);
  fs.writeFileSync('upgrade/qa/hosted-updates.json',JSON.stringify({passed:true,navigations,errors,build:a,scope:'Real hosted renderer with simulated version responses: active driving defers reload, home reloads once, new shell version is stable, download button visible.'},null,2));console.log('Hosted updates and download button passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
