const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),report=[];try{for(const id of['singapore','monaco']){
 const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8878/?circuit='+id,{timeout:180000});await page.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});await page.evaluate(()=>sponsorReady);
 await page.evaluate(async()=>{frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));state='pause';show('none');$('hud').hidden=true;$('connection').hidden=true;car.visible=false;guideArrows.visible=guideOutline.visible=false;});
 for(const view of['waterfront','elevated','reverse']){
  const info=await page.evaluate(view=>{
   const mb=CIRCUIT.id==='singapore',audit=landmarkAudit.find(a=>a.type==='mbs'),centre=mb?new T.Vector3(...audit.position):new T.Vector3(...landmarkAudit.find(a=>a.type==='yachtclub').position),p=mb?geoPoint(103.8534,1.2858):geoPoint(7.4267,43.7337);
   cam.position.set(p.x,centre.y+(view==='elevated'?125:12),p.z);if(view==='reverse'){cam.position.set(centre.x-(p.x-centre.x)*.7,centre.y+70,centre.z-(p.z-centre.z)*.7);}
   cam.fov=mb?45:60;cam.lookAt(centre.x,centre.y+(mb?95:10),centre.z);cam.updateProjectionMatrix();sun.position.copy(cam.position).addScaledVector(sunDirection,230);sun.target.position.copy(centre);sun.target.updateMatrixWorld();sky.position.copy(cam.position);updateVegetation(performance.now()+10000);renderGame();
   const closed=[];scene.traverse(o=>{if(o.isMesh&&o.geometry.userData.closedEnvelope)closed.push(o.name)});
   return{view,closed,boats:marinaBoats.length,yachts:marinaBoats,mbs:audit,calls:ren.info.render.calls,triangles:ren.info.render.triangles,assets:sceneAssetErrors};
  },view);assert.equal(info.assets.length,0);if(id==='singapore'){assert.equal(info.mbs.towers.length,3);assert(info.closed.length>=18);}else assert(info.boats>=20,'Monaco populated harbour');await page.screenshot({path:`upgrade/qa/waterfront-${id}-${view}.png`});report.push({id,...info});
 }
 assert.equal(errors.length,0,errors.join('\n'));await page.close();
}}finally{await browser.close();fs.writeFileSync('upgrade/qa/waterfront.json',JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exit(1)});
