// Pixel comparison isolates batching from livery/terrain changes in the release.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
try{for(const id of ['monza','interlagos','singapore'])for(const [label,file] of [['before','work/browser-before-material-sharing.html'],['after','upgrade/qa/standalone.html']]){
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let seed=25391;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296)});
 await page.goto('file:///'+path.resolve(file).replace(/\\/g,'/')+'?circuit='+id);
 await page.waitForFunction(()=>window.MilanoReady===true,null,{timeout:120000});
 await page.evaluate(async()=>{frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));state='pause';show('none');$('hud').hidden=true;S.line=0;guideArrows.visible=guideOutline.visible=false;applyGraphics('high');});
 const views=[];
 for(const fraction of [.01,.25,.65]){
  const data=await page.evaluate(f=>{
   const k=Math.round(N*f)%N;placeCar(k);car.position.set(c.x,roadHeightAt(c.x,c.z,k),c.z);car.rotation.set(-bankAt(k),-c.h,roadPitchAt(c.x,c.z,c.h,k),'YXZ');
   cam.position.set(cx[k]-tx[k]*8,cy[k]+3.5,cz[k]-tz[k]*8);cam.lookAt(cx[k]+tx[k]*20,cy[k]+1,cz[k]+tz[k]*20);cam.fov=61;cam.updateProjectionMatrix();
   sun.position.copy(cam.position).addScaledVector(sunDirection,230);sun.target.position.copy(cam.position);sun.target.updateMatrixWorld();sky.position.copy(cam.position);nightLight.position.set(cx[k],cy[k]+14,cz[k]);
   windTime.value=0;waterNormals.offset.set(0,0);contactShadow.visible=false;updateVegetation(1e9);renderGame();return {calls:ren.info.render.calls,triangles:ren.info.render.triangles,batches:batchAudit};
  },fraction);
  await page.screenshot({path:`upgrade/qa/batch-${id}-${label}-${fraction}.png`});views.push({fraction,...data});
 }
 assert(!errors.length,errors.join(';'));reports.push({id,label,views,errors});await page.close();
}fs.writeFileSync('upgrade/qa/batch-equivalence.json',JSON.stringify({scope:'Seeded identical scene, camera, lighting and quality; only material/box sharing differs.',reports},null,2));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
