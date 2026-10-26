// Full-calendar visual sweep. This complements topology checks; it is not a
// claim that every square metre is surveyed or that every frame is bug-free.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{
 const ids=process.argv.slice(2).length?process.argv.slice(2):Object.keys(JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')));
 const root='upgrade/qa/terrain-review';fs.mkdirSync(root,{recursive:true});const reports=[];
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const id of ids){
  const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto('file:///'+path.resolve('upgrade/qa/standalone.html').replace(/\\/g,'/')+'?circuit='+id);
  await page.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});await page.evaluate(()=>window.sponsorReady);
  await page.evaluate(async()=>{frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));state='pause';show('none');document.querySelectorAll('body>*:not(canvas):not(script):not(style)').forEach(e=>e.style.display='none');applyGraphics('high');guideArrows.visible=guideOutline.visible=contactShadow.visible=car.visible=false;clearWeekend();});
  const shots=[];
  for(let k=0;k<12;k++){
   const result=await page.evaluate(k=>{const i=Math.floor(k*N/12),look=(i+9)%N,side=k%2?1:-1;
    cam.position.set(cx[i]-tx[i]*12+nx[i]*side*2,cy[i]+(k%3===0?15:5),cz[i]-tz[i]*12+nz[i]*side*2);
    cam.lookAt(cx[look],cy[look]+1,cz[look]);cam.fov=65;cam.updateProjectionMatrix();cam.updateMatrixWorld();sun.position.copy(cam.position).addScaledVector(sunDirection,230);sun.target.position.set(cx[i],cy[i],cz[i]);sun.target.updateMatrixWorld();sky.position.copy(cam.position);updateVegetation(performance.now()+500);for(let n=0;n<3;n++)renderGame();
    return{station:i,position:cam.position.toArray(),drawCalls:ren.info.render.calls,triangles:ren.info.render.triangles};
   },k);
   const file=`${root}/${id}-${String(k).padStart(2,'0')}.jpg`;await page.screenshot({path:file,quality:84});shots.push({...result,file});
  }
  const audit=await page.evaluate(()=>({assets:sceneAssetErrors,ground:scene.children.filter(x=>x.userData.groundSurface&&x.visible).map(x=>({name:x.name,vertices:x.geometry?.attributes.position.count,normal:x.geometry?.attributes.normal?.count})),mapped:calendarAudit}));
  assert(!errors.length&&!audit.assets.length,JSON.stringify({id,errors,audit}));reports.push({id,shots,audit,errors});await page.close();
  console.log('Terrain sweep',id,'12 views; no script/shader/asset errors');
 }}finally{await browser.close()}
 fs.writeFileSync(`${root}/report.json`,JSON.stringify(reports,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
