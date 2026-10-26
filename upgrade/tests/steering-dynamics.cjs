const fs=require('fs'),vm=require('vm'),assert=require('assert');
function simulation(file,speed){
 const m={Math,isFinite,clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),S:{df:1,grip:1,steer:.85,brake:1},N:8,LEN:80000,cx:Array(8).fill(0),cz:Array(8).fill(0),tx:Array(8).fill(1),tz:Array(8).fill(0),nx:Array(8).fill(0),nz:Array(8).fill(1),CIRCUIT:{},
 c:{x:0,z:0,h:0,vx:speed,vy:0,r:0,st:0,idx:0,d:0,odo:0,gear:1},keys:new Set(),inp:{t:0,b:0,s:0},padInput:{t:0,b:0,s:0},touchInput:{t:0,b:0,s:0},race:{t:0,dist:0},vmx:[22,34,47,62,80,100],gph:[],stepN:0,
 prog:(x,z)=>({i:0,d:z,s:x}),trackHalf:()=>10000,trackBarrier:(_,s)=>s*10000,rumble:()=>{},msg:()=>{},timing:()=>{},invalid:()=>{},placeCar:()=>assert.fail('nonfinite dynamics'),TrackLimits:{fresh:()=>({}),update:()=>({})}};
 vm.createContext(m);vm.runInContext(fs.readFileSync('upgrade/src/vehicle-model.js','utf8').replace('__VEHICLE_DATA__',fs.readFileSync('upgrade/src/vehicle-model.json','utf8'))+fs.readFileSync(file,'utf8'),m);return m;
}
const reports=[];
for(const speed of [15,30,50,75])for(const input of ['keyboard','stick']){
 const results={};for(const [label,file]of [['before','upgrade/tests/fixtures/handling-dynamics-before.js'],['after','upgrade/src/handling.js']]){
  const m=simulation(file,speed);if(input==='keyboard')m.keys.add('KeyD');else m.padInput.s=.4;
  for(let i=0;i<10;i++)m.step(1/120);const tapAngle=m.c.st;
  m.keys.clear();m.padInput.s=0;for(let i=0;i<110;i++)m.step(1/120);
  const tapHeading=m.c.h,lateralDisplacement=m.c.z;
  const b=simulation(file,speed);b.inp.s=1;b.keys.add('KeyD');b.keys.add('Space');b.inp.b=1;
  for(let i=0;i<120;i++)b.step(1/120);
  results[label]={tapAngle,tapHeading,lateralDisplacement,speedAfterBraking:b.c.vx};
 }
 if(speed>=50)assert(Math.abs(results.after.tapAngle)<Math.abs(results.before.tapAngle)*.85,'gentle high-speed input');
 assert(Number.isFinite(results.after.tapHeading+results.after.lateralDisplacement),'finite manoeuvre');
 assert(results.after.speedAfterBraking<results.before.speedAfterBraking+.5,'braking authority not lost during cornering');
 reports.push({speedKmh:speed*3.6,input,...results});
}
const m=simulation('upgrade/src/handling.js',30);
for(let i=-100;i<=100;i++)for(const keyboard of[true,false]){const x=i/100,y=m.driverSteeringCommand(x,keyboard,.85);assert(Math.abs(y)<=1&&Math.sign(y)===Math.sign(x));if(Math.abs(x)===1)assert.equal(y,x);}
for(const fx of[-50000,-20000,0,15000])for(const fy of[-20000,0,20000]){const f=m.combinedAxleForces(fx,fy,12000);assert(Math.hypot(f.longitudinal,f.lateral)<=12000.0001);if(fx&&fy)assert(Math.abs(f.longitudinal)>1000,'combined braking remains available');}
fs.writeFileSync('upgrade/qa/steering-dynamics.json',JSON.stringify({passed:true,scope:'Deterministic straight-road pulse, release and combined braking manoeuvres. Not physical controller validation.',reports},null,2));console.log(JSON.stringify(reports,null,2));
