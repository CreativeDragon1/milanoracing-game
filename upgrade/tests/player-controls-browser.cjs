const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:810}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5183/play/?circuit=monaco');await p.waitForFunction(()=>window.MilanoReady,null,{timeout:180000});
 await p.evaluate(()=>{newSession('qual');state='pause';show('none');$('hud').hidden=false;gpHud(true)});
 const layouts=[];
 for(const [w,h,touch] of [[1440,810,false],[1366,768,false],[1280,600,false],[390,844,true],[844,390,true],[667,375,true]]){
  await p.setViewportSize({width:w,height:h});await p.evaluate(t=>{document.documentElement.classList.toggle('touch-device',t);gpHud(true)},touch);await p.waitForTimeout(200);
  const box=await p.evaluate(()=>{const a=$('gp-timing').getBoundingClientRect(),b=$('gp-race-strip').getBoundingClientRect(),k=$('gp-skip-pit').getBoundingClientRect();return{standings:a.toJSON(),strategy:b.toJSON(),skip:k.toJSON(),width:innerWidth,height:innerHeight}});
  assert(box.standings.bottom<=box.strategy.top+1,'standings must not overlap strategy '+w+'x'+h);
  assert(box.skip.x>=0&&box.skip.right<=w&&box.skip.y>=0&&box.skip.bottom<h,'skip control within screen');
  layouts.push(box);await p.screenshot({path:`upgrade/qa/driver-hud-${w}x${h}.png`});
 }
 await p.setViewportSize({width:1440,height:810});await p.evaluate(()=>{document.documentElement.classList.remove('touch-device');state='race';show('none');window.skipClock=GP.weekend.clock;window.skipProgress=GP.weekend.drivers[1].progress;window.testPad={index:7,id:'Synthetic standard controller',connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({value:0,pressed:false}))};gamepads=()=>[testPad];pollController(performance.now());testPad.buttons[15]={value:1,pressed:true};pollController(performance.now())});
 await p.waitForFunction(()=>!!GP.pitSkip,null,{timeout:5000});
 const fade=await p.locator('#pit-transition').evaluate(n=>n.classList.contains('active'));assert(fade);
 await p.waitForFunction(()=>!GP.pitSkip&&!GP.weekend.player.pit,null,{timeout:60000});
 const skip=await p.evaluate(()=>({elapsed:GP.weekend.clock-skipClock,rivalMoved:GP.weekend.drivers[1].progress>skipProgress,finite:Number.isFinite(c.x+c.z+c.h+c.vx),speed:c.vx,cover:getComputedStyle($('pit-transition')).opacity}));assert(skip.elapsed>5&&skip.rivalMoved&&skip.finite&&skip.speed>0);await p.waitForTimeout(350);assert.equal(await p.locator('#pit-transition').evaluate(n=>getComputedStyle(n).opacity),'0');
 await p.evaluate(()=>{testPad.buttons[15]={value:0,pressed:false};newSession('pr');state='pause';show('none');$('hud').hidden=false;placeCar(0);testPad.buttons[6]={value:1,pressed:true};pollController(performance.now());for(let i=0;i<120;i++)step(1/120);hud()});
 assert.equal(await p.locator('#gr').innerText(),'R');assert(await p.evaluate(()=>c.vx< -1));
 await p.screenshot({path:'upgrade/qa/driver-reverse.png'});
 // A reset must clear reverse, and disconnect must clear held controls.
 await p.evaluate(()=>resetCar());assert(await p.evaluate(()=>!c.reverse&&c.vx===0));
 await p.evaluate(()=>{state='race';gamepads=()=>[];pollController(performance.now())});assert(await p.evaluate(()=>state==='pause'&&padInput.t===0&&padInput.b===0&&padInput.s===0));
 assert.deepEqual(errors,[]);fs.writeFileSync('upgrade/qa/player-controls-browser.json',JSON.stringify({passed:true,layouts,skip,reverse:true,disconnectPaused:true,errors,scope:'Rendered UI and software-injected standard gamepad; no physical controller paired.'},null,2));console.log('Responsive HUD, controller pit skip, fade, reverse HUD, reset and disconnect passed');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
