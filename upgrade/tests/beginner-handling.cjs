const fs=require('fs'),vm=require('vm'),assert=require('assert');
const fixture=fs.readFileSync('upgrade/tests/steering-dynamics.cjs','utf8').split('const reports=[];')[0];
const harness={require};vm.createContext(harness);vm.runInContext(fixture+'\nthis.make=simulation;',harness);
function make(old=false,speed=30){
 const m=harness.make(old?'upgrade/tests/fixtures/beginner-handling-before.js':'upgrade/src/handling.js',speed);
 const source=fs.readFileSync(old?'upgrade/tests/fixtures/beginner-controller-before.js':'upgrade/src/controller.js','utf8');
 vm.runInContext(source.slice(source.indexOf('const padButton'),source.indexOf('function cycleCamera')),m);
 m.S.cornerAssist=1;return m;
}
function pad(m,steer,gas=0,brake=0){m.padInput=m.readPad({mapping:'standard',axes:[steer],buttons:Array.from({length:16},(_,i)=>({value:i===7?gas:i===6?brake:0,pressed:false}))},.12,m.c.vx)}
function run(m,seconds,control,holdSpeed,dt=1/120){for(let i=0;i<Math.round(seconds/dt);i++){if(holdSpeed!==undefined)m.c.vx=holdSpeed;control?.(m,i);m.step(dt);assert(Number.isFinite(m.c.x+m.c.z+m.c.vx+m.c.vy+m.c.r+m.c.h),'finite vehicle state')}}
const rows=[];
for(const speed of [15,30,50,75]){
 const result={kmh:speed*3.6};
 for(const old of [true,false]){const m=make(old,speed);run(m,2,q=>pad(q,.5),speed);result[old?'before':'after']={steering:m.inp.s,yaw:m.c.r,radius:speed/Math.abs(m.c.r)}}
 assert(result.after.radius<result.before.radius*.9,'half stick must not require an oversized turning radius');
 if(speed>=50)assert(result.after.radius<result.before.radius*.7,'remove compound high-speed stick attenuation');
 rows.push(result);
}
const braking=[];
for(const steer of [0,.6,1]){
 const row={steer};
 for(const old of [true,false]){const m=make(old,50);run(m,1,q=>pad(q,steer,1,1));row[old?'before':'after']=m.c.vx}
 const brakeOnly=make(false,50);run(brakeOnly,1,q=>pad(q,steer,0,1));
 assert(Math.abs(brakeOnly.c.vx-row.after)<.15,'held accelerator must not defeat the brake pedal');
 assert(row.after<row.before-2,'braking authority improves with conflicting novice inputs');braking.push(row);
}
function corner(old,assist=true){const m=make(old,32);m.S.cornerAssist=assist?1:0;m.racingGuide={speed:Array(8).fill(18)};run(m,2,q=>{q.tx[0]=Math.cos(q.c.h);q.tz[0]=Math.sin(q.c.h);q.keys.add('KeyW');q.keys.add('KeyD')});return m}
const before=corner(true),after=corner(false),manual=corner(false,false);
assert(after.c.vx<20&&after.c.vx<before.c.vx*.75,'corner aid gets held-throttle drivers to a turnable speed');
assert(after.c.h>before.c.h,'the same held steering completes more of the bend');
assert(Math.abs(manual.c.vx-before.c.vx)<.1,'manual setting retains driver speed control');
const straight=make(false,50);straight.racingGuide={speed:Array(8).fill(100)};run(straight,2,q=>pad(q,0,1));assert(straight.c.vx>65&&straight.c.cornerBrake===0,'straight-line acceleration unaffected');
const backwards=make(false,0);backwards.racingGuide={speed:Array(8).fill(1)};run(backwards,2,q=>pad(q,1,0,1));assert(backwards.c.reverse&&backwards.c.vx< -3&&backwards.c.cornerBrake===0,'reverse remains driver controlled');
const counter=[];
for(const speed of [20,70]){const m=make(false,speed);m.keys.add('KeyD');run(m,1,null,speed);m.keys.clear();m.keys.add('KeyA');run(m,.15,null,speed);assert(m.inp.s<0,'countersteering crosses centre in 150 ms');counter.push({kmh:speed*3.6,steerAfter150ms:m.inp.s})}
// No hidden directional control: with the same guide, releasing steering stays straight.
const noSteer=make(false,32);noSteer.racingGuide={speed:Array(8).fill(18)};run(noSteer,2,q=>pad(q,0,1));assert(Math.abs(noSteer.c.h)<1e-9&&Math.abs(noSteer.c.z)<1e-9);
for(const speed of [20,50,75]){const m=make(false,speed);run(m,10/120,q=>pad(q,.5),speed);pad(m,0);run(m,1);assert(Math.abs(m.c.h)<.08,'short stick taps remain controllable');assert(Math.abs(m.inp.s)<.001,'stick release recentres')}
const report={passed:true,scope:'Deterministic driver inputs, real keyboard/gamepad mappings and vehicle equations. Synthetic corner envelope; physical controllers and human play are separate.',halfStick:rows,braking,counter,corner:{beforeKmh:before.c.vx*3.6,afterKmh:after.c.vx*3.6,beforeHeading:before.c.h,afterHeading:after.c.h}};
fs.writeFileSync('upgrade/qa/beginner-handling.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
