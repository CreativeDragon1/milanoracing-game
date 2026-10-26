const {chromium,expect}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const report={checks:[],scope:'Real embedded Singapore game in the private website; simulation-clock checks, visibility, resize and local Windows archive route.'};
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5183/racing');
  const download=page.getByRole('link',{name:'Download desktop app'});await expect(download).toBeVisible();
  assert.equal(await download.getAttribute('download'),'Milano-Apex-Windows.zip');
  const zip=await context.request.get('http://127.0.0.1:5183/downloads/Milano-Apex-Windows.zip',{headers:{Range:'bytes=0-3'}});
  assert.equal(zip.status(),206);assert.deepEqual([...await zip.body()],[80,75,3,4]);assert.match(zip.headers()['content-disposition'],/attachment.*Milano-Apex-Windows.zip/);
  const head=await context.request.head('http://127.0.0.1:5183/downloads/Milano-Apex-Windows.zip');assert.equal(head.status(),200);assert(Number(head.headers()['content-length'])>100_000_000);
  report.download={bytes:Number(head.headers()['content-length']),rangeSupported:true};
  await page.selectOption('#racing-circuit','singapore');await page.getByRole('button',{name:'Play now'}).click();
  const game=await (await page.locator('iframe').elementHandle()).contentFrame();
  await game.waitForFunction(()=>window.MilanoReady,null,{timeout:180000});await expect(page.getByRole('status').filter({hasText:'Garage ready'})).toBeVisible();
  await game.evaluate(()=>{$('gp-qualifying').value='full';newSession('qual')});
  const rows=await game.evaluate(async()=>{const rows=[];for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,80));rows.push({type:$('session-type').textContent,clock:$('lap').textContent,current:$('cur').textContent})}return rows});
  assert(rows.every(r=>r.type==='Q1'&&/^17:\d\d$|^18:00$/.test(r.clock)&&r.current==='--:--.---'),JSON.stringify(rows));report.checks.push('Q1 and countdown stable across asynchronous HUD cadences during pit outlap');
  const timed=await game.evaluate(async()=>{const w=GP.weekend,p=w.player;p.pit=null;p.outlap=false;p.progress=100;p.lapStart=w.clock-59.95;gpPlace(gpTrackPose(p));const values=[];for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,80));values.push({text:$('cur').textContent,expected:fmt((w.clock-p.lapStart)*1000)})}return values});
  const ms=s=>{const a=/^(\d+):(\d\d)\.(\d\d\d)$/.exec(s);assert(a,s);assert(Number(a[2])<60,s);return Number(a[1])*60000+Number(a[2])*1000+Number(a[3])};
  assert(timed.every(r=>Math.abs(ms(r.text)-ms(r.expected))<180));for(let i=1;i<timed.length;i++)assert(ms(timed[i].text)>=ms(timed[i-1].text));
  report.checks.push('Timed lap crosses the minute boundary without invalid seconds or backward jumps');
  const post=async visible=>page.evaluate(visible=>document.querySelector('iframe').contentWindow.postMessage({type:'milano:visibility',visible},location.origin),visible);
  await post(false);await game.waitForFunction(()=>state==='pause'&&MilanoHostVisible===false);await page.waitForTimeout(120);
  const frozen=await game.evaluate(()=>({time:GP.weekend.clock,frames:ren.info.render.frame}));await page.waitForTimeout(750);
  assert.deepEqual(await game.evaluate(()=>({time:GP.weekend.clock,frames:ren.info.render.frame})),frozen);
  await game.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://untrusted.invalid',source:parent,data:{type:'milano:visibility',visible:true}})));assert.equal(await game.evaluate(()=>MilanoHostVisible),false);
  await post(true);await game.waitForFunction(()=>MilanoHostVisible===true);assert.equal(await game.evaluate(()=>state),'pause');
  await game.evaluate(()=>{state='race';show('none');last=performance.now()});await page.waitForTimeout(250);assert((await game.evaluate(()=>GP.weekend.clock))-frozen.time<.6);
  report.checks.push('Hidden embed pauses simulation and GPU draws; untrusted messages ignored; return has no catch-up jump');
  await page.screenshot({path:'qa/racing-timers-desktop.png'});
  for(const [width,height] of [[768,1024],[390,844],[844,390],[1440,900]]){await page.setViewportSize({width,height});await page.waitForTimeout(350);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bounds=await page.locator('.racing-console').boundingBox();assert(bounds.y>=0&&bounds.y+bounds.height<=height+1,JSON.stringify(bounds));assert((await page.locator('iframe').boundingBox()).height>200);}
  await page.getByRole('button',{name:'Exit game',exact:true}).click();await expect(download).toBeVisible();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await page.screenshot({path:'qa/racing-download-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'qa/racing-download-phone.png',fullPage:true});
  report.checks.push('Tablet, phone portrait, phone landscape and desktop bounds; clean exit; download control remains aligned');
  assert.deepEqual(errors,[]);report.errors=errors;report.passed=true;
 }finally{fs.writeFileSync('qa/racing-timers.json',JSON.stringify(report,null,2));await browser.close()}
 console.log(report);
})().catch(e=>{console.error(e);process.exit(1)});
