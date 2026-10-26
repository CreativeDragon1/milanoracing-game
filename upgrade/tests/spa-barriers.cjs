const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('file:///'+path.resolve('upgrade/qa/standalone.html').replace(/\\/g,'/')+'?circuit=spa');
 await page.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});await page.evaluate(()=>window.sponsorReady);
 await page.evaluate(async()=>{frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));state='pause';show('none');document.querySelectorAll('body>*:not(canvas):not(script):not(style)').forEach(e=>e.style.display='none');car.visible=false;guideArrows.visible=guideOutline.visible=false;applyGraphics('ultra')});
 for(const station of [33,41,50,82,1132]){
  await page.evaluate(st=>{cam.position.set(cx[st]-tx[st]*22+nx[st]*20,cy[st]+20,cz[st]-tz[st]*22+nz[st]*20);cam.lookAt(cx[st],cy[st],cz[st]);cam.fov=65;cam.updateProjectionMatrix();sun.position.copy(cam.position).addScaledVector(sunDirection,230);sun.target.position.set(cx[st],cy[st],cz[st]);sun.target.updateMatrixWorld();sky.position.copy(cam.position);updateVegetation(performance.now()+200);for(let i=0;i<5;i++)renderGame()},station);
  await page.screenshot({path:`upgrade/qa/spa-barrier-fix-${station}.png`});
 }
 const state=await page.evaluate(()=>({fences:scene.children.filter(x=>x.name==='Circuit catch fencing').length,trimmed:pitSurfaceAudit.trimmedMeshes,assets:sceneAssetErrors}));assert(!errors.length&&!state.assets.length);fs.writeFileSync('upgrade/qa/spa-barrier-render.json',JSON.stringify({state,errors,views:[33,41,50,82,1132]},null,2));console.log('Spa barrier inspection frames and asset checks passed.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
