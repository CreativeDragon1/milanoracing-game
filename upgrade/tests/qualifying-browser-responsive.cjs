const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const report={scope:'Real private browser game: completing and cancelling the remaining full qualifying sessions after Q1 elimination.'};
 try{
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon')){errors.push(m.text().slice(0,500));console.log('BROWSER ERROR',m.text().slice(0,500))}});
  await p.goto('http://127.0.0.1:5183/play/?circuit=singapore');await p.waitForFunction(()=>window.MilanoReady===true||document.getElementById('load-retry')?.hidden===false,null,{timeout:180000});
  assert(await p.evaluate(()=>window.MilanoReady===true),errors.join('\n')||await p.locator('#load-progress').textContent());
  const eliminated=()=>{$('gp-qualifying').value='full';const started=performance.now();newSession('qual');window.qualSetupMs=performance.now()-started;const w=GP.weekend;for(const d of w.drivers){d.best=d.id?90+d.id*.3:Infinity;d.bestSet=d.id;}w.endQual();gpResults();window.qualPaints=0;window.qualGaps=[];window.qualSpikes=[];if(!window.qualFrameBase){window.qualFrameBase=frame;frame=function(t){const start=performance.now();qualFrameBase(t);const ms=performance.now()-start;if(ms>40)qualSpikes.push({ms,simulating:!!GP.qualAdvance})}}let last=performance.now();function tick(t){qualPaints++;qualGaps.push({ms:t-last,simulating:!!GP.qualAdvance});last=t;if(GP.weekend?.stage<2||GP.qualAdvance)requestAnimationFrame(tick)}requestAnimationFrame(tick)};
  await p.evaluate(eliminated);await p.locator('#gp-next').click();await p.waitForFunction(()=>GP.weekend?.stage===2&&GP.weekend.phase==='qualifying-result'&&!GP.qualAdvance,null,{timeout:120000});
  const completed=await p.evaluate(()=>({paints:qualPaints,gaps:qualGaps.length,maxGapMs:Math.max(...qualGaps.map(g=>g.ms)),maxSimulationGapMs:Math.max(0,...qualGaps.filter(g=>g.simulating).map(g=>g.ms)),slowFrames:qualGaps.filter(g=>g.ms>100),frameWorkSpikes:qualSpikes,setupMs:qualSetupMs,grid:GP.weekend.grid,button:$('gp-to-race').textContent}));
  assert(completed.paints>15,'Rendering must continue while remaining sessions simulate');assert.equal(new Set(completed.grid).size,22);assert.equal(completed.button,'TO THE GRID');report.completed=completed;
  await p.evaluate(eliminated);await p.locator('#gp-next').click();await p.locator('#gp-back').click();await p.waitForTimeout(500);
  assert(await p.evaluate(()=>GP.weekend===null&&!GP.qualAdvance&&document.body.dataset.screen==='menu'));
  await p.screenshot({path:'upgrade/qa/qualifying-responsive-cancel.png'});assert.deepEqual(errors,[]);report.cancelled=true;report.errors=errors;report.passed=true;
 }finally{fs.writeFileSync('upgrade/qa/qualifying-browser-responsive.json',JSON.stringify(report,null,2));await browser.close()}
 console.log(report);
})().catch(e=>{console.error(e);process.exit(1)});
