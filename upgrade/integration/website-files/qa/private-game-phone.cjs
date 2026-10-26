const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const report={scope:'Chromium phone viewport and touch emulation, not a physical Safari test.',checks:[]};
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2}),page=await context.newPage();
  await page.goto('http://127.0.0.1:5183/racing');
  await expect(page.getByRole('button',{name:'Play now'})).toBeVisible();
  await page.getByRole('button',{name:'Play now'}).tap();
  const frame=await(await page.locator('iframe').elementHandle()).contentFrame();
  await frame.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});
  await expect(page.getByRole('status').filter({hasText:'Garage ready'})).toBeVisible();
  assert(await frame.evaluate(()=>device.touch&&device.mobile));
  await page.screenshot({path:'qa/private-game-phone-garage.png'});
  await frame.locator('#menu [data-ov="sessions"]').tap();await frame.locator('[data-go="pr"]').tap();await frame.locator('#go').tap();
  await frame.waitForFunction(()=>state==='race');
  await expect(frame.locator('#touch-throttle')).toBeVisible();
  await expect(frame.locator('#touch-steering')).toBeVisible();
  await page.screenshot({path:'qa/private-game-phone-race.png'});
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>document.querySelector('.racing-console').getBoundingClientRect().height===390);
  // The game intentionally pauses on rotation so held steering/pedals cannot persist.
  await expect(frame.getByRole('button',{name:'Resume',exact:true})).toBeVisible();
  await frame.getByRole('button',{name:'Resume',exact:true}).tap();
  await frame.waitForFunction(()=>state==='race');
  await expect(frame.locator('#touch-throttle')).toBeVisible();
  assert(await frame.locator('#touch-throttle').evaluate(el=>{const r=el.getBoundingClientRect();return r.right<=innerWidth&&r.bottom<=innerHeight&&r.left>=0&&r.top>=0;}));
  await page.screenshot({path:'qa/private-game-phone-landscape.png'});
  await page.getByRole('button',{name:'Exit game',exact:true}).tap();
  await expect(page.getByRole('button',{name:'Play now'})).toBeVisible();assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  report.checks=['Actual game detects touch in embedded phone mode','Practice and touch controls launch','Portrait and landscape fill screen without page chrome','Exit restores page scrolling'];report.passed=true;
 }finally{fs.writeFileSync('qa/private-game-phone.json',JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
