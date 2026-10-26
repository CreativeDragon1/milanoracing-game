// Inspect final rendered surfaces and the exported support meshes, not the
// nominal height function used before the pit and terrain cuts are applied.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert');
(async()=>{fs.mkdirSync('upgrade/qa/structures',{recursive:true});
 const ids=process.argv.slice(2).length?process.argv.slice(2):Object.keys(JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json'))),all=[];
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const id of ids){
  const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await p.goto('file:///'+path.resolve('upgrade/qa/standalone.html').replace(/\\/g,'/')+'?circuit='+id+'&qaStructures=1');
  await p.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});await p.evaluate(()=>window.sponsorReady);
  await p.evaluate(async()=>{frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));state='pause';show('none');document.querySelectorAll('body>*:not(canvas):not(script):not(style)').forEach(e=>e.style.display='none');applyGraphics('high');guideArrows.visible=guideOutline.visible=contactShadow.visible=car.visible=false;clearWeekend();});
  const report=await p.evaluate(()=>{
   const meshes=scene.children.filter(o=>o.name==='Terrain-fitted building foundations'),ground=[];
   scene.traverseVisible(o=>{if(o.isMesh&&!o.isInstancedMesh&&(o.userData.waterSupport||o.userData.calendarGround||o.userData.mainRoad||['Circuit terrain','Measured regional terrain','Original circuit regional ground','Grass verge','Paved runoff','Pit service apron','Pit-lane asphalt','Mapped surrounding road network'].includes(o.name)))ground.push(o)});
   const ray=new T.Raycaster(),v=new T.Vector3(),failures=[];let tests=0,segment=0;const stride=Math.max(1,Math.ceil(buildingFoundationAudit.segments/600));
   // Each new vertical quad must reach below an independently raycast terrain
   // height at its midpoint, with no support intersecting either driving lane.
   for(const mesh of meshes){const pos=mesh.geometry.attributes.position;for(let i=0;i<pos.count;i+=6){if(segment++%stride)continue;const x=(pos.getX(i)+pos.getX(i+1))/2,z=(pos.getZ(i)+pos.getZ(i+1))/2,bottom=pos.getY(i),top=(pos.getY(i+2)+pos.getY(i+5))/2;
    ray.set(v.set(x,2000,z),new T.Vector3(0,-1,0));const hit=ray.intersectObjects(ground,false)[0];tests++;
    if(!hit||bottom>hit.point.y+.002)failures.push({x,z,bottom,ground:hit?.point.y});
    if(Number.isFinite(drivingClearance(x,z,.1)))failures.push({x,z,road:true});
   }}
   return{...buildingFoundationAudit,checks:tests,failures,meshCount:meshes.length,triangles:meshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0),assets:sceneAssetErrors};
  });
  const worst=report.sites.filter(s=>s.segments).sort((a,b)=>b.maxUnsupportedHeightBefore-a.maxUnsupportedHeightBefore);
  const selected=[...worst.slice(0,2),...report.sites.filter(s=>s.segments&&/Hôtel|Hotel|Pit|Stand Endurance/i.test(s.name))].filter((s,i,a)=>a.findIndex(q=>q.name===s.name)===i).slice(0,5);
  for(let i=0;i<selected.length;i++){
   const s=selected[i],check=s.checks.reduce((a,b)=>b[4]-b[2]>a[4]-a[2]?b:a);
   await p.evaluate(({check,name})=>{const site=buildingFoundationSites.find(s=>s.name===name),pts=site.rings[0].map(p=>new T.Vector3(p[0],site.floor(p[0],p[1]),p[1]).applyMatrix4(site.group.matrixWorld));const centre=pts.reduce((a,p)=>a.addScaledVector(p,1/pts.length),new T.Vector3()),dir=new T.Vector3(check[0]-centre.x,0,check[1]-centre.z).normalize();
    cam.position.set(check[0]+dir.x*35,Math.max(check[2],check[4])+9,check[1]+dir.z*35);cam.lookAt(check[0],check[4]+2,check[1]);cam.fov=65;cam.aspect=1440/900;cam.updateProjectionMatrix();cam.updateMatrixWorld();sun.position.copy(cam.position).addScaledVector(sunDirection,230);sun.target.position.copy(centre);sun.target.updateMatrixWorld();sky.position.copy(cam.position);updateVegetation(performance.now()+500);ren.shadowMap.needsUpdate=true;for(let n=0;n<3;n++)renderGame();
   },{check,name:s.name});
   await p.screenshot({path:`upgrade/qa/structures/${id}-${i}.png`});
  }
  const brief={...report,sites:report.sites.map(({checks,...s})=>s),screenshots:selected.map((s,i)=>({name:s.name,file:`structures/${id}-${i}.png`}))};
  all.push(brief);fs.writeFileSync('upgrade/qa/structure-grounding.json',JSON.stringify(all,null,2));
  console.log(id,report.sites.length,'sites;',report.checks,'ground checks;',report.roadConflicts.length,'rejected road overlaps;',report.failures.length,'failures;',report.missingGround,'missing ground');
  assert(!errors.length&&!report.assets.length,JSON.stringify({errors,assets:report.assets}));
  assert(report.failures.length===0,'Support must meet real terrain and clear both roadways');
  // Keep collecting every circuit before reporting any uncovered footprint.
  await p.close();
 }}finally{await browser.close()}
 assert(all.every(r=>!r.missingGround),'Some building perimeters have no rendered ground; inspect missingSamples');
})().catch(e=>{console.error(e);process.exit(1)});
