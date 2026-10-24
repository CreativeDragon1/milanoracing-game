const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[],ids=process.argv.slice(2).length?process.argv.slice(2):Object.keys(JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')));let complete=false;
try{for(const id of ids){
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text().slice(0,600))});
 await page.goto('http://127.0.0.1:8878/?circuit='+id,{timeout:180000});await page.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});await page.evaluate(()=>sponsorReady);
 await page.evaluate(async()=>{frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));state='pause';show('none');$('hud').hidden=true;document.querySelectorAll('.controller-bar,.controller-dock').forEach(e=>e.hidden=true);car.visible=false;guideArrows.visible=guideOutline.visible=false;cam.fov=55;cam.updateProjectionMatrix()});
 const report=await page.evaluate(()=>{
  scene.updateMatrixWorld(true);const surfaces=[];scene.traverse(o=>{if(o.isMesh&&['Circuit terrain','Measured regional terrain'].includes(o.name))surfaces.push(o)});if(!geography)surfaces.push(gnd);
  const ray=new T.Raycaster(),miss=[],floating=[],samples=[];
  for(let i=0;i<trees.length;i+=Math.max(1,Math.floor(trees.length/90))){const t=trees[i];ray.set(new T.Vector3(t.x,t.y+1000,t.z),new T.Vector3(0,-1,0));const hits=ray.intersectObjects(surfaces,false);if(!hits.length)miss.push(i);else{const delta=Math.min(...hits.map(h=>Math.abs(h.point.y-t.y)));samples.push(delta);if(delta>.06)floating.push({i,delta,x:t.x,z:t.z})}}
  const palms=[];scene.traverse(o=>{if(o.isInstancedMesh&&o.name.startsWith('Mapped palm avenue trunks')){const m=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);m.decompose(p,q,s);palms.push({x:p.x,y:p.y-s.y*.5,z:p.z,h:s.y})}}});
  return{id:CIRCUIT.id,trees:trees.length,rootSamples:samples.length,miss,floating,maxRootError:Math.max(0,...samples),palms:palms.length,palm:palms[Math.floor(palms.length*.5)],assets:sceneAssetErrors,atlas:canopyTexture.image.width,views:[]};
 });
 assert.equal(report.assets.length,0);assert.equal(report.miss.length,0,id+' missing terrain');assert.equal(report.floating.length,0,id+' floating trees '+JSON.stringify(report.floating.slice(0,4)));assert.equal(report.atlas,1536);
 for(const view of ['driving','tree','palm']){
  if(view==='palm'&&!report.palm)continue;
  const stats=await page.evaluate(({view,palm})=>{
   if(view==='palm'){cam.position.set(palm.x+12,palm.y+3,palm.z+10);cam.lookAt(palm.x,palm.y+palm.h*.72,palm.z)}
   else if(view==='tree'){const t=trees.reduce((best,t)=>Math.abs(prog(t.x,t.z,-1).d)<Math.abs(prog(best.x,best.z,-1).d)?t:best,trees[0]);cam.position.set(t.x+14,t.y+2,t.z+12);cam.lookAt(t.x,t.y+t.h*.45,t.z)}
   else{const i=Math.round(N*.18);cam.position.set(cx[i],cy[i]+1.5,cz[i]);cam.lookAt(cx[(i+12)%N],cy[(i+12)%N]+1,cz[(i+12)%N]);}
   sun.position.copy(cam.position).addScaledVector(sunDirection,230);sun.target.position.copy(cam.position);sun.target.updateMatrixWorld();sky.position.copy(cam.position);updateVegetation(performance.now()+10000);renderGame();
   return{view,drawCalls:ren.info.render.calls,triangles:ren.info.render.triangles,tree:treeAudit.active};
  },{view,palm:report.palm});report.views.push(stats);await page.screenshot({path:`upgrade/qa/vegetation-${id}-${view}.png`});
 }
 assert.equal(errors.length,0,id+' '+errors.join(';'));reports.push({...report,errors});console.log(id,report.rootSamples,'root checks',report.palms,'palms');await page.close();
}complete=true;}finally{await browser.close();fs.writeFileSync('upgrade/qa/vegetation-render.json',JSON.stringify({passed:complete&&reports.length===ids.length,requested:ids,reports},null,2))}})().catch(e=>{console.error(e);process.exit(1)});
