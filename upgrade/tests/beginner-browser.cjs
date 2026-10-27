const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 // Existing installations must receive the new default without losing their setup.
 await p.addInitScript(()=>{if(!localStorage.getItem('handling-test-seeded')){localStorage.setItem('mrs-team2:settings',JSON.stringify({steer:.85,line:0,vol:0}));localStorage.setItem('handling-test-seeded','1')}});
 await p.goto('http://127.0.0.1:5183/play/?circuit=monaco');await p.waitForFunction(()=>window.MilanoReady,null,{timeout:180000});
 assert.equal(await p.evaluate(()=>S.cornerAssist),1);
 await p.evaluate(()=>{show('settings');syncInterfaceControls()});await p.locator('[data-settings-tab="driver"]').click();
 await p.locator('#menu-corner-assist').selectOption('0');assert.equal(await p.evaluate(()=>S.cornerAssist),0);
 assert.match(await p.locator('label:has(#menu-corner-assist)').textContent(),/Handling assist/);
 await p.reload();await p.waitForFunction(()=>window.MilanoReady,null,{timeout:180000});assert.equal(await p.evaluate(()=>S.cornerAssist),0);
 await p.evaluate(()=>{show('settings');syncInterfaceControls()});await p.locator('[data-settings-tab="driver"]').click();await p.locator('#menu-corner-assist').selectOption('1');
 await p.screenshot({path:'upgrade/qa/beginner-controls.png'});
 const results=await p.evaluate(async()=>{
  // Stop animation scheduling so wall-clock GPU timing cannot change input duration.
  window.savedDrivingFrame=frame;frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  newSession('pr');state='race';show('none');race.cd=0;
  S.line=2;updateRacingLine();S.line=0;
  const cueSamples=racingGuide.speed.map((v,i)=>guideDemand(i,v+10));
  if(!cueSamples.some(d=>d.level===2&&d.brake>0)||!cueSamples.every(d=>Number.isFinite(d.target)))throw Error('Assisted racing-line cues are invalid');
  let hairpin=racingGuide.speed.indexOf(Math.min(...racingGuide.speed));placeCar(hairpin);c.vx=10;
  return {hairpin,heading:c.h,profileFinite:racingGuide.speed.every(Number.isFinite),lineHidden:S.line===0};
 });
 await p.keyboard.down('KeyW');await p.keyboard.down('KeyD');
 await p.evaluate(()=>{for(let i=0;i<60;i++)step(1/120)});
 results.keyboard=await p.evaluate(()=>({heading:c.h,speed:c.vx,steering:inp.s,brake:inp.b,throttle:inp.t,finite:Number.isFinite(c.x+c.z+c.h+c.vx)}));
 assert(Math.abs(results.keyboard.heading-results.heading)>.15,'keyboard actually turns through a tight bend');assert(results.keyboard.finite);
 assert.equal(results.keyboard.brake,0);assert.equal(results.keyboard.throttle,1);
 await p.keyboard.up('KeyD');await p.keyboard.up('KeyW');await p.evaluate(()=>{for(let i=0;i<90;i++)step(1/120)});assert(Math.abs(await p.evaluate(()=>inp.s))<.001);
 results.controller=await p.evaluate(()=>{
  placeCar(0);c.vx=30;const initial=c.h;
  const pad={mapping:'standard',axes:[.5],buttons:Array.from({length:16},(_,i)=>({value:i===7?1:0,pressed:false}))};
  Object.assign(padInput,readPad(pad,S.dz,c.vx));for(let i=0;i<36;i++)step(1/120);
  const result={headingChange:c.h-initial,steering:inp.s};Object.assign(padInput,{s:0,t:0,b:0});pause();placeCar(0);return result;
 });assert(results.controller.headingChange>.02);
 // Visual guidance updates with setup, but never drives the pedals.
 results.setup=await p.evaluate(()=>{S.grip=.9;resume();const key=racingGuide.setup;pause();S.grip=1;newSession('pr');state='pause';return{key,newKey:racingGuide.setup,resetBrake:c.cornerBrake}});
 assert(results.setup.key.startsWith('0.9:')&&results.setup.newKey.startsWith('1:'));assert.equal(results.setup.resetBrake,0);
 assert.deepEqual(errors,[]);assert(results.profileFinite&&results.lineHidden);
 fs.writeFileSync('upgrade/qa/beginner-browser.json',JSON.stringify({passed:true,fileSHA256:require('crypto').createHash('sha256').update(fs.readFileSync('upgrade/qa/standalone.html')).digest('hex'),...results,errors,scope:'Rendered browser settings, real keyboard events and software gamepad mapping; not physical hardware or human playtesting.'},null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
