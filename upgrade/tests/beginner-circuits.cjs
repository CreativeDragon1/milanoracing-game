const fs=require('fs'),vm=require('vm'),assert=require('assert');
const tour=JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')),reports=[];
const controller=fs.readFileSync('upgrade/src/controller.js','utf8');
for(const id of Object.keys(tour)){
 const d=tour[id],n=d.N,wrap=i=>(i%n+n)%n;
 const m={URL,location:{href:'http://localhost/?circuit='+id},Math,isFinite,console,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),S:{grip:1,df:1,steer:.85,brake:1,cornerAssist:1},
 c:{x:d.x[0],z:d.z[0],h:Math.atan2(d.tz[0],d.tx[0]),vx:0,vy:0,r:0,st:0,idx:0,d:0,rpm:0,gear:1,odo:0},inp:{t:0,b:0,s:0},padInput:{t:0,b:0,s:0},touchInput:{t:0,b:0,s:0},keys:new Set(),race:{dist:0,t:0},gph:[],stepN:0,vmx:[22,34,47,62,80,100],invalid:()=>m.invalidations++,invalidations:0,msg:()=>m.contacts++,contacts:0,rumble:()=>{},timing:()=>{},placeCar:()=>assert.fail('Nonfinite physics')};
 vm.createContext(m);
 vm.runInContext(fs.readFileSync('upgrade/src/track-limits.js','utf8').replace('__TRACK_LIMIT_RULES__',fs.readFileSync('upgrade/src/track-limits.json','utf8'))+fs.readFileSync('upgrade/src/tour-track.js','utf8').replace('__WORLD_TOUR_DATA__',JSON.stringify({[id]:d})).replace('__PIT_LANES__','{}')+fs.readFileSync('upgrade/src/vehicle-model.js','utf8').replace('__VEHICLE_DATA__',fs.readFileSync('upgrade/src/vehicle-model.json','utf8'))+fs.readFileSync('upgrade/src/handling.js','utf8')+controller.slice(controller.indexOf('const padButton'),controller.indexOf('function cycleCamera'))+`
 const racingGuide={speed:solveSpeedProfile(CIRCUIT.line.x,CIRCUIT.line.z,CIRCUIT.line.curvature,S,cy.map((h,i)=>surfaceHeight(i,CIRCUIT.line.offset[i]))).speed.map(v=>v*VEH.driverSpeedFactor)};
 racingGuide.assist=buildCornerAssistProfile();this.envelope=vehicleEnvelope;this.project=prog;`,m);
 let progress=0,last=0,maxError=0,maxSpeed=0,assistedTicks=0,peakBrakeChange=0,lastBrake=0;
 // Deliberately simple 10 Hz centre-road follower, with the accelerator held.
 // This exercises the gamepad mapping and assist on real geometry, not human skill.
 for(let tick=0;tick<120*300&&progress<n;tick++){
  if(tick%12===0){
   const look=5+m.c.vx*.3,j=wrap(m.c.idx+Math.max(1,Math.round(look/(d.length/n)))),dx=d.x[j]-m.c.x,dz=d.z[j]-m.c.z;
   const angle=Math.atan2(Math.sin(Math.atan2(dz,dx)-m.c.h),Math.cos(Math.atan2(dz,dx)-m.c.h));
   const desired=m.clamp(Math.atan(3*2*Math.sin(angle)/Math.max(2,Math.hypot(dx,dz)))/m.playerSteeringLock(m.envelope(m.c.vx),m.c.vx),-1,1);
   let lo=-1,hi=1;for(let k=0;k<20;k++){const mid=(lo+hi)/2;if(m.driverSteeringCommand(mid,false,.85,m.c.vx)<desired)lo=mid;else hi=mid}
   const s=(lo+hi)/2,raw=Math.abs(s)<.001?0:Math.sign(s)*(.12+.88*Math.abs(s));
   m.padInput=m.readPad({mapping:'standard',axes:[raw],buttons:Array.from({length:16},(_,i)=>({value:i===7?1:0,pressed:false}))},.12,m.c.vx);
  }
  m.step(1/120);let di=m.c.idx-last;if(di<-n/2)di+=n;if(di>n/2)di-=n;progress+=di;last=m.c.idx;
  maxError=Math.max(maxError,Math.abs(m.c.d));maxSpeed=Math.max(maxSpeed,m.c.vx*3.6);if(m.c.cornerBrake>.01)assistedTicks++;
  peakBrakeChange=Math.max(peakBrakeChange,Math.abs(m.c.cornerBrake-lastBrake));lastBrake=m.c.cornerBrake;
  assert(Number.isFinite(m.c.x+m.c.z+m.c.h+m.c.vx));
 }
 const report={id,laps:progress/n,seconds:m.race.t,maxError,maxSpeedKmh:maxSpeed,barrierContacts:m.contacts,invalidations:m.invalidations,assistedTicks,peakBrakeChange};reports.push(report);console.log(JSON.stringify(report));
}
const passed=reports.every(r=>r.laps>=.99&&r.barrierContacts===0);
fs.writeFileSync('upgrade/qa/beginner-circuits.json',JSON.stringify({passed,scope:'Software gamepad centre-road follower updated at 10 Hz, full throttle held, real circuit surfaces and grip. Not human or physical-controller validation.',reports},null,2));
assert(passed,'Held-throttle gamepad laps must complete without barrier contact');
