const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{pathToFileURL}=require('url');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];let passed=false;
try{for(const id of Object.keys(JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')))){
 const p=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(pathToFileURL(path.resolve('upgrade/qa/standalone.html')).href+'?circuit='+id);await p.waitForFunction(()=>window.MilanoReady,null,{timeout:180000});
 const result=await p.evaluate(async()=>{
  window.cameraTestFrame=frame;frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));newSession('pr');state='pause';show('none');$('hud').hidden=true;
  const records=[];for(const mode of [0,2])for(const side of [0,-1,1]){camMode=mode;let maxSide=0,maxYawError=0,minHeight=Infinity,minBoom=Infinity,maxLift=0,maxCostMs=0;const costs=[];
   for(let i=0;i<N;i+=side?6:3){const h=Math.atan2(tz[i],tx[i]),offset=side*(trackHalf(i,side||1)-1),view={x:cx[i]+nx[i]*offset,z:cz[i]+nz[i]*offset,h,idx:i,vx:20+75*(i/N),st:Math.sin(i)};snap=i===0;
    const start=performance.now();updateDrivingCamera(view,roadHeightAt(view.x,view.z,i),1/60);const cost=performance.now()-start;costs.push(cost);maxCostMs=Math.max(maxCostMs,cost);
    const co=Math.cos(h),si=Math.sin(h),dx=cam.position.x-view.x,dz=cam.position.z-view.z;
    maxSide=Math.max(maxSide,Math.abs(-si*dx+co*dz));const d=lookSmooth.clone().sub(cam.position),yaw=Math.atan2(d.z,d.x);maxYawError=Math.max(maxYawError,Math.abs(Math.atan2(Math.sin(yaw-h),Math.cos(yaw-h))));
    minHeight=Math.min(minHeight,cam.position.y-roadHeightAt(cam.position.x,cam.position.z,i));minBoom=Math.min(minBoom,drivingRig.distance);maxLift=Math.max(maxLift,drivingRig.lift);
    if(cam.fov!==drivingViews[mode].fov||!Number.isFinite(cam.position.length()+lookSmooth.length()))throw Error('Camera became nonfinite or changed zoom');
   }
   costs.sort((a,b)=>a-b);records.push({mode,side,samples:costs.length,maxSide,maxYawError,minHeight,minBoom,maxLift,maxCostMs,p95CostMs:costs[Math.floor(costs.length*.95)]});
  }
  return {id:CIRCUIT.id,records};
 });
 assert.deepEqual(errors,[]);for(const r of result.records){assert(r.maxSide<1e-7&&r.maxYawError<1e-7,id+' camera sways during turns');assert(r.minHeight>=.89,id+' camera goes below road');assert(r.minBoom>=0);assert(r.maxLift<3,id+' background terrain pulls the camera away from the car: '+r.maxLift)}
 if(['monaco','singapore','spa','zandvoort'].includes(id)){
  const shot=await p.evaluate(()=>{let i=0;for(let j=1;j<N;j++)if(CIRCUIT.line.speed[j]<CIRCUIT.line.speed[i])i=j;placeCar(i);c.vx=20;camMode=0;S.line=0;updateRacingLine();snap=true;cameraTestFrame(performance.now()+16);cam.updateMatrixWorld(true);return{station:i,carScreen:car.position.clone().add(new T.Vector3(0,.6,0)).project(cam).toArray(),camera:cam.position.toArray()}});
  result.shot=shot;await p.screenshot({path:'upgrade/qa/steady-camera-'+id+'.png'});
 }
 reports.push({...result,errors});console.log(id,JSON.stringify(result.records));await p.close();
}passed=true;}finally{await browser.close();fs.writeFileSync('upgrade/qa/driving-camera-browser.json',JSON.stringify({passed,fileSHA256:require('crypto').createHash('sha256').update(fs.readFileSync('upgrade/qa/standalone.html')).digest('hex'),reports,scope:'Actual circuit camera sweep with fixed zoom and car-relative heading, clearance checks and sampled rendered hairpins. Timing is diagnostic, not a real-time FPS benchmark.'},null,2));}})().catch(e=>{console.error(e);process.exit(1)});
