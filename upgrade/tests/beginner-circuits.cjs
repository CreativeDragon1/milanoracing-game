const fs=require('fs'),vm=require('vm'),assert=require('assert');
const tour=JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')),reports=[];
const controller=fs.readFileSync('upgrade/src/controller.js','utf8');
for(const id of Object.keys(tour)){
 const d=tour[id],n=d.N,wrap=i=>(i%n+n)%n;
 const m={URL,location:{href:'http://localhost/?circuit='+id},Math,isFinite,console,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),S:{grip:1,df:1,steer:.85,brake:1,cornerAssist:1},
 c:{x:d.x[0],z:d.z[0],h:Math.atan2(d.tz[0],d.tx[0]),vx:0,vy:0,r:0,st:0,idx:0,d:0,rpm:0,gear:1,odo:0},inp:{t:0,b:0,s:0},padInput:{t:0,b:0,s:0},touchInput:{t:0,b:0,s:0},keys:new Set(),race:{dist:0,t:0},gph:[],stepN:0,vmx:[22,34,47,62,80,100],invalid:()=>m.invalidations++,invalidations:0,msg:()=>m.contacts++,contacts:0,rumble:()=>{},timing:()=>{},placeCar:()=>assert.fail('Nonfinite physics')};
 vm.createContext(m);
 vm.runInContext(fs.readFileSync('upgrade/src/track-limits.js','utf8').replace('__TRACK_LIMIT_RULES__',fs.readFileSync('upgrade/src/track-limits.json','utf8'))+fs.readFileSync('upgrade/src/tour-track.js','utf8').replace('__WORLD_TOUR_DATA__',JSON.stringify({[id]:d})).replace('__PIT_LANES__','{}')+fs.readFileSync('upgrade/src/vehicle-model.js','utf8').replace('__VEHICLE_DATA__',fs.readFileSync('upgrade/src/vehicle-model.json','utf8'))+fs.readFileSync('upgrade/src/handling.js','utf8')+controller.slice(controller.indexOf('const padButton'),controller.indexOf('function cycleCamera'))+`
 const curvature=cx.map((_,i)=>{const a=(i+N-1)%N,b=(i+1)%N,abx=cx[i]-cx[a],abz=cz[i]-cz[a],bcx=cx[b]-cx[i],bcz=cz[b]-cz[i];return 2*(abx*bcz-abz*bcx)/Math.max(.001,Math.hypot(abx,abz)*Math.hypot(bcx,bcz)*Math.hypot(cx[b]-cx[a],cz[b]-cz[a]))});
 this.reference=solveSpeedProfile(cx,cz,curvature,S,cy,CIRCUIT.bank);this.envelope=vehicleEnvelope;this.project=prog;`,m);
 let progress=0,last=0,maxError=0,maxSpeed=0,driverBrakingTicks=0,pending={t:0,b:0,s:0};
 // A 10 Hz software driver supplies BOTH steering and pedals, one update late.
 // The speed plan belongs to this test driver; the game no longer controls speed.
 for(let tick=0;tick<120*300&&progress<n;tick++){
  if(tick%12===0){
   // Include the restored steering filter's settling time in the test driver's
   // preview. The 100 ms input delay and speed plan are unchanged. The former
   // short preview relied on the removed extra grip to recover overshoots.
   const look=5+m.c.vx*.7,j=wrap(m.c.idx+Math.max(1,Math.round(look/(d.length/n)))),dx=d.x[j]-m.c.x,dz=d.z[j]-m.c.z;
   const angle=Math.atan2(Math.sin(Math.atan2(dz,dx)-m.c.h),Math.cos(Math.atan2(dz,dx)-m.c.h));
   const desired=Math.atan(3*2*Math.sin(angle)/Math.max(2,Math.hypot(dx,dz)));
   let lo=-1,hi=1;for(let k=0;k<20;k++){const mid=(lo+hi)/2,e=m.envelope(m.c.vx),command=m.driverSteeringCommand(mid,false,.85,m.c.vx,true);if(command*m.playerSteeringLock(e,m.c.vx)<desired)lo=mid;else hi=mid}
   const s=(lo+hi)/2,raw=Math.abs(s)<.001?0:Math.sign(s)*(.12+.88*Math.abs(s));
   const ahead=wrap(m.c.idx+Math.round(m.c.vx*.45/(d.length/n))),next=wrap(ahead+1),target=m.reference.speed[ahead]*.90;
   const feed=Math.min(0,(m.reference.speed[next]**2-m.reference.speed[ahead]**2)*.81/(2*m.reference.ds[ahead]));
   const demand=feed+(target*target-m.c.vx*m.c.vx)/(2*Math.max(10,m.c.vx*.3)),e=m.envelope(m.c.vx);
   const force=(demand+e.drag/800)*800,gas=m.clamp(force/e.drive,0,1),brake=m.clamp(-force/e.brake,0,1);
   m.padInput=pending;pending=m.readPad({mapping:'standard',axes:[raw],buttons:Array.from({length:16},(_,i)=>({value:i===7?gas:i===6?brake:0,pressed:false}))},.12,m.c.vx);
  }
  m.step(1/120);let di=m.c.idx-last;if(di<-n/2)di+=n;if(di>n/2)di-=n;progress+=di;last=m.c.idx;
  maxError=Math.max(maxError,Math.abs(m.c.d));maxSpeed=Math.max(maxSpeed,m.c.vx*3.6);if(m.padInput.b>.01)driverBrakingTicks++;
  assert.equal(m.c.cornerBrake,0,'no automatic braking');
  assert(Number.isFinite(m.c.x+m.c.z+m.c.h+m.c.vx));
 }
 const report={id,laps:progress/n,seconds:m.race.t,maxError,maxSpeedKmh:maxSpeed,barrierContacts:m.contacts,invalidations:m.invalidations,driverBrakingTicks};reports.push(report);console.log(JSON.stringify(report));
}
const passed=reports.every(r=>r.laps>=.99&&r.barrierContacts===0&&r.invalidations===0);
fs.writeFileSync('upgrade/qa/beginner-circuits.json',JSON.stringify({passed,lookaheadSeconds:.7,scope:'Software gamepad driver supplies steering and pedals at 10 Hz with 100 ms control delay, real circuit surfaces and grip. Preview includes the restored input filter; speed plan unchanged. No game-controlled braking. Not human or physical-controller validation.',reports},null,2));
assert(passed,'Delayed-input gamepad laps must complete without barrier contact');
