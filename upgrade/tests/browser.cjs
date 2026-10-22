const {chromium}=require('playwright');const fs=require('fs'),assert=require('assert');
const tour=JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json'));const output=[];
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
for(const id of Object.keys(tour)){
 const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text().slice(0,500))});
 await page.goto('http://127.0.0.1:8878/?circuit='+id);await page.waitForFunction(()=>window.MilanoBuild&&typeof sponsorAudit!=='undefined'&&sponsorAudit.length>=16&&(isNight||hdrReady),null,{timeout:90000});await page.evaluate(()=>window.sponsorReady);await page.waitForTimeout(900);
 const stats=await page.evaluate(()=>{let nonfinite=0;scene.traverse(o=>{if(o.isMesh){const a=o.geometry.getAttribute('position');if(a)for(let i=0;i<a.count;i++)if(!Number.isFinite(a.getX(i)+a.getY(i)+a.getZ(i)))nonfinite++}});const brake=racingGuide.speed.reduce((a,v,i)=>guideDemand(i,v).brake>a.brake?{i,brake:guideDemand(i,v).brake}:a,{i:0,brake:0});return {diagnostics:MilanoBuild.getDiagnostics(),nonfinite,sponsors:sponsorAudit,venues:venueObjects,stopped:guideDemand(brake.i,0),braking:guideDemand(brake.i,racingGuide.speed[brake.i]),renderer:ren.getContext().getParameter(ren.getContext().RENDERER)}});
 assert(stats.nonfinite===0);assert(new Set(stats.sponsors.map(a=>a.name)).size===6);assert(stats.stopped.throttle>.99&&stats.stopped.brake===0);assert(stats.braking.brake>.1);
 await page.screenshot({path:'upgrade/qa/'+id+'-garage.png'});
 await page.locator('[data-ov="sessions"]').click();await page.locator('[data-go="pr"]').click();await page.waitForTimeout(300);await page.evaluate(()=>{state='pause';show('none');S.line=0;camMode=0;placeCar(Math.round(N*.14));snap=true;});await page.waitForTimeout(500);await page.screenshot({path:'upgrade/qa/'+id+'-circuit.png'});
 const performanceResult=await page.evaluate(async()=>{const frames=[];let last;await new Promise(resolve=>{let n=0;function tick(t){if(last)frames.push(t-last);last=t;if(++n<61)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)});frames.sort((a,b)=>a-b);return {medianFrameMs:frames[30],p95FrameMs:frames[57],...MilanoBuild.getDiagnostics()}});
 if(id==='milano'){
  await page.evaluate(()=>applyGraphics('high'));await page.waitForTimeout(200);await page.evaluate(()=>applyGraphics('performance'));await page.waitForTimeout(200);await page.evaluate(()=>applyGraphics('ultra'));await page.setViewportSize({width:960,height:600});await page.waitForTimeout(200);await page.screenshot({path:'upgrade/qa/milano-small.png'});
  const control=await page.evaluate(()=>{const b=Array.from({length:17},()=>({pressed:false,value:0}));b[7]={pressed:true,value:1};b[6]={pressed:true,value:.4};return readPad({mapping:'standard',axes:[.5],buttons:b},.12)});assert(control.t===1&&control.b===.4&&control.s>0&&control.s<1);
 }
 output.push({id,errors,...stats,performance:performanceResult});fs.writeFileSync('upgrade/qa/browser.json',JSON.stringify(output,null,2));console.log(id,JSON.stringify({errors,performance:performanceResult}));await context.close();assert(errors.length===0,id+' render errors');
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
