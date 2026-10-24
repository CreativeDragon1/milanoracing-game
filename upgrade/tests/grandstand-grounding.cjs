const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
(async()=>{
 const before=process.argv.includes('--before'),ids=process.argv.slice(2).filter(x=>!x.startsWith('--'));
 const circuits=ids.length?ids:Object.keys(JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json'))),reports=[];
 const browser=await chromium.launch({channel:'msedge',headless:true});let complete=false;
 try{for(const id of circuits){
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8878/?circuit='+id,{timeout:180000});await page.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});await page.evaluate(()=>sponsorReady);
  const report=await page.evaluate(async()=>{
   frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));scene.updateMatrixWorld(true);
   const instanceCentres=new Map(),matrix=new T.Matrix4(),key=p=>p.map(v=>v.toFixed(2)).join(':'),surfaces=[];
   scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&(o.userData.calendarGround||o.userData.mainRoad||['Circuit terrain','Measured regional terrain','Original circuit regional ground','Grass verge','Paved runoff','Pit service apron','Pit-lane asphalt','Mapped surrounding road network'].includes(o.name)))surfaces.push(o);if(o.isInstancedMesh&&o.name.startsWith('Static architecture tile'))for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);const e=matrix.elements,k=key([e[12],e[13],e[14]]);instanceCentres.set(k,Array.from(e));}});
   const ray=new T.Raycaster(),stands=grandstandAudit.map(s=>{
    const base=s.group.getWorldPosition(new T.Vector3()).y,co=Math.cos(s.rotation),si=Math.sin(s.rotation),samples=[];
    for(let col=0;col<=6;col++)for(let zz=0;zz<s.rows*1.25;zz+=2.5){const xx=-s.length/2+col*s.length/6,x=s.x+co*xx+si*zz,z=s.z-si*xx+co*zz;
     samples.push({x,z,gap:base+.1-groundHeight(x,z)});}
    const data=s.group.userData.grounding;let grounding;
    if(data){let missing=0,maxFootGap=-Infinity,maxTerrainGap=-Infinity,terrainMiss=0,roadOverlap=0,pitOverlap=0;
     data.feet.forEach((f,i)=>{const x=s.x+co*f.xx+si*f.zz,z=s.z-si*f.xx+co*f.zz,y=(f.bottom+f.top)*.5;let m=instanceCentres.get(key([x,y,z]));if(!m)m=Array.from(instanceCentres.values()).find(e=>Math.abs(e[12]-x)<.003&&Math.abs(e[13]-y)<.003&&Math.abs(e[14]-z)<.003);if(!m)missing++;else maxFootGap=Math.max(maxFootGap,m[13]-Math.abs(m[5])*.5-groundHeight(x,z));
      if(i%Math.max(1,Math.floor(data.feet.length/4))===0){ray.set(new T.Vector3(x,base+1000,z),new T.Vector3(0,-1,0));const hits=ray.intersectObjects(surfaces,false);if(!hits.length)terrainMiss++;else maxTerrainGap=Math.max(maxTerrainGap,f.bottom-hits[0].point.y);}
      const q=prog(x,z,-1);if(Math.abs(q.d)<trackHalf(q.i,Math.sign(q.d))+.5)roadOverlap++;for(let j=0;j<PIT.x.length;j+=3)if(Math.hypot(PIT.x[j]-x,PIT.z[j]-z)<2.5){pitOverlap++;break;}
     });grounding={feet:data.feet.length,missing,maxFootGap,maxTerrainGap,terrainMiss,roadOverlap,pitOverlap,minDeckClearance:data.minDeckClearance};
    }
    return{name:s.name,x:s.x,z:s.z,rotation:s.rotation,length:s.length,rows:s.rows,base,maxOldGap:Math.max(...samples.map(p=>p.gap)),minOldGap:Math.min(...samples.map(p=>p.gap)),grounding};
   });return{id:CIRCUIT.id,stands,assets:sceneAssetErrors};
  });
  reports.push(report);assert.equal(errors.length,0,errors.join(';'));assert.equal(report.assets.length,0);
  if(!before)for(const s of report.stands){assert(s.grounding,s.name+' missing foundation');assert.equal(s.grounding.missing,0,s.name+' foundation missing from render batches');assert.equal(s.grounding.terrainMiss,0,s.name+' missing visible terrain');assert(s.grounding.maxTerrainGap<=.025,s.name+' gap above rendered terrain');assert(s.grounding.minDeckClearance>=.05,s.name+' terrain through seating');assert.equal(s.grounding.roadOverlap,0,s.name+' support on racing surface');assert.equal(s.grounding.pitOverlap,0,s.name+' support in pit lane');}
  const worst=report.stands.reduce((a,b)=>!a||b.maxOldGap>a.maxOldGap?b:a,null);
  if(worst){await page.evaluate(s=>{state='pause';show('none');$('hud').hidden=true;car.visible=false;guideArrows.visible=guideOutline.visible=false;
   const co=Math.cos(s.rotation),si=Math.sin(s.rotation),xx=s.length*.65,zz=-24;cam.position.set(s.x+co*xx+si*zz,s.base+5,s.z-si*xx+co*zz);cam.lookAt(s.x,s.base+s.rows*.32,s.z);cam.fov=60;cam.updateProjectionMatrix();sun.position.copy(cam.position).addScaledVector(sunDirection,230);sun.target.position.set(s.x,s.base,s.z);sun.target.updateMatrixWorld();sky.position.copy(cam.position);renderGame();},worst);
   await page.screenshot({path:`upgrade/qa/grandstand-${before?'before':'after'}-${id}.png`});}
  console.log(id,report.stands.length,'stands; old worst base gap',worst?.maxOldGap.toFixed(2));await page.close();
 }complete=true;}finally{await browser.close();fs.writeFileSync(`upgrade/qa/grandstand-grounding${before?'-before':''}.json`,JSON.stringify({passed:complete,requested:circuits,reports},null,2));}
})().catch(e=>{console.error(e);process.exit(1)});
