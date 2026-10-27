const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const reports=[];try{for(const id of ['interlagos','abu-dhabi']){
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(path.resolve('upgrade/qa/standalone.html')).href+'?circuit='+id);await p.waitForFunction(()=>window.MilanoReady,null,{timeout:180000});
 const result=await p.evaluate(async()=>{
  window.testDrivingFrame=frame;frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));state='pause';show('none');$('hud').hidden=true;car.visible=false;scene.updateMatrixWorld(true);
  const ray=new T.Raycaster(),objects=[];scene.traverseVisible(o=>{if(o.isMesh&&/Circuit catch fencing|Solid chamfered safety barrier/.test(o.name))objects.push(o)});const hits=[];let rays=0;
  for(let i=PIT.box;i<PIT.x.length-2;i++)for(const off of[-1.1,0,1.1])for(const height of[.4,1.4,2.8]){const a=pitSections[i].point(off),b=pitSections[i+1].point(off),from=new T.Vector3(a[0],a[1]+height,a[2]),to=new T.Vector3(b[0],b[1]+height,b[2]);ray.set(from,to.clone().sub(from).normalize());ray.far=from.distanceTo(to);rays++;const hit=ray.intersectObjects(objects,false)[0];if(hit)hits.push({i,off,height,name:hit.object.name,distance:hit.distance})}
  return {rays,hits,tunnel:PIT.tunnel?{...PIT.tunnel,startS:PIT.s[PIT.tunnel.start],endS:PIT.s[PIT.tunnel.end],width:PIT.width}:null};
 });
 const cameras=[];for(const mode of[0,1,2,3]){const camera=await p.evaluate(mode=>{
  newSession('qual');state='pause';show('none');$('hud').hidden=true;car.visible=true;S.line=0;camMode=mode;
  const samples=CIRCUIT.id==='interlagos'?[740,775,799,850,927,1100,1390]:[PIT.tunnel.start+3,Math.round((PIT.tunnel.start+PIT.tunnel.end)/2),PIT.tunnel.end-3];
  const ray=new T.Raycaster(),roofs=[],poses=[];scene.traverseVisible(o=>{if(o.isMesh&&!o.isInstancedMesh&&!o.userData.groundSurface&&o!==pitRoad&&!/water|shadow|grass|terrain|asphalt|road|vegetation/i.test(o.name))roofs.push(o)});
  for(const k of samples){GP.weekend.player.pit.s=PIT.s[k];gpStepBefore(0);snap=true;testDrivingFrame(performance.now()+16);scene.updateMatrixWorld(true);ray.set(cam.position,new T.Vector3(0,1,0));ray.far=8;const hit=ray.intersectObjects(roofs,false)[0],floor=pitCameraSurface(cam.position.x,cam.position.z,GP.weekend.player.pit.s);poses.push({k,position:cam.position.toArray(),height:cam.position.y-floor.y,offset:floor.offset,station:floor.s,headroom:PIT.tunnel?PIT.tunnel.clearance-(cam.position.y-floor.y):null,overhead:hit?{name:hit.object.name,distance:hit.distance}:null})}
  return {mode,poses};
 },mode);cameras.push(camera);await p.screenshot({path:`upgrade/qa/pit-exit-${id}-camera-${mode}.png`})}
 const motion=await p.evaluate(()=>{
  if(!PIT.tunnel)return [];
  const records=[],a=PIT.s[PIT.tunnel.start],b=PIT.s[PIT.tunnel.end];
  for(const mode of [2,3]){
   camMode=mode;let now=performance.now(),previous=null,maxStep=0,minHeadroom=Infinity,minHeight=Infinity,maxOffset=0,samples=0;
   for(let s=a-45;s<=b+45;s+=.6){GP.weekend.player.pit.s=s;gpStepBefore(0);snap=previous===null;now+=1000/30;testDrivingFrame(now);const floor=pitCameraSurface(cam.position.x,cam.position.z,s);if(previous)maxStep=Math.max(maxStep,cam.position.distanceTo(previous));previous=cam.position.clone();
    if(floor.s>=a&&floor.s<=b){samples++;minHeadroom=Math.min(minHeadroom,PIT.tunnel.clearance-(cam.position.y-floor.y));minHeight=Math.min(minHeight,cam.position.y-floor.y);maxOffset=Math.max(maxOffset,Math.abs(floor.offset));}
   }
   records.push({mode,samples,maxStep,minHeadroom,minHeight,maxOffset});
  }
  return records;
 });
 reports.push({id,...result,cameras,motion,errors});
 fs.writeFileSync('upgrade/qa/pit-exit-clearance-progress.json',JSON.stringify(reports,null,2));
 assert.equal(result.hits.length,0,id+' pit path intersects barrier: '+JSON.stringify(result.hits.slice(0,4)));
 for(const camera of cameras)for(const pose of camera.poses){assert(Number.isFinite(pose.height));if(result.tunnel){if(pose.station>=result.tunnel.startS&&pose.station<=result.tunnel.endS){assert(pose.headroom>=.6,id+' camera clips roof');assert(pose.height>=.99,id+' camera clips floor');assert(Math.abs(pose.offset)<=result.tunnel.width/2-.5,'Camera clips tunnel side')}if(pose.overhead)assert(pose.overhead.distance>=.6,'Actual overhead mesh clearance')}else assert.equal(pose.overhead,null,'Unexpected Interlagos pit-exit ceiling')}
 for(const m of motion){assert(m.samples>30);assert(m.minHeadroom>=.6&&m.minHeight>=.99,'Moving camera clearance');assert(m.maxOffset<=result.tunnel.width/2-.5);assert(m.maxStep<1.25,'Tunnel transition jumps: '+JSON.stringify(m));}
 if(id==='interlagos')for(const k of [775,799,927]){await p.evaluate(k=>{camMode=0;GP.weekend.player.pit.s=PIT.s[k];gpStepBefore(0);snap=true;testDrivingFrame(performance.now()+16)},k);await p.screenshot({path:`upgrade/qa/pit-exit-interlagos-fixed-${k}.png`})}
 assert.deepEqual(errors,[]);console.log(id,result.rays,'pit-body rays clear',JSON.stringify(motion));await p.close();
}fs.writeFileSync('upgrade/qa/pit-exit-clearance.json',JSON.stringify({passed:true,fileSHA256:require('crypto').createHash('sha256').update(fs.readFileSync('upgrade/qa/standalone.html')).digest('hex'),reports},null,2));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
