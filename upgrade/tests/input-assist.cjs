const fs=require('fs'),vm=require('vm'),assert=require('assert');
const harness={require};vm.createContext(harness);vm.runInContext(fs.readFileSync('upgrade/tests/steering-dynamics.cjs','utf8').split('const reports=[];')[0]+'\nthis.make=simulation;',harness);
const current='upgrade/src/handling.js',scheduled='upgrade/tests/fixtures/scheduled-braking-before.js';
function make(speed,assist=true,old=false){const m=harness.make(old?scheduled:current,speed);m.S.cornerAssist=assist?1:0;m.racingGuide={speed:Array(8).fill(14),assist:{speed:Array(8).fill(14),ds:Array(8).fill(10000)}};return m}
function tick(m,n,input,speed){for(let i=0;i<n;i++){m.keys.clear();m.padInput={t:0,b:0,s:0};input(m,i);if(speed!==undefined)m.c.vx=speed;m.step(1/120);assert(Number.isFinite(m.c.x+m.c.z+m.c.vx+m.c.vy+m.c.h+m.c.r))}}
function turn(m,type,sign=1){if(type==='keyboard')m.keys.add(sign>0?'KeyD':'KeyA');else m.padInput.s=.7*sign}
const responses=[];
for(const type of ['keyboard','controller'])for(const speed of [15,25,40,70]){
 const row={type,speedKmh:speed*3.6};
 for(const assist of [false,true]){const m=make(speed,assist);tick(m,24,()=>{},speed);tick(m,48,q=>turn(q,type),speed);row[assist?'assisted':'manual']={angle:m.c.h,yaw:m.c.r,steering:m.inp.s};
  assert.equal(m.inp.b,0);tick(m,120,()=>{});assert(Math.abs(m.inp.s)<.001&&Math.abs(m.c.r)<.02,'release settles steering and rotation');
 }
 assert(row.assisted.angle>row.manual.angle*1.02,'late input has more authority');responses.push(row);
}
const pedalOwnership=[];
for(const steer of [0,.4,1]){
 const row={steer};for(const old of [true,false]){const m=make(32,true,old);tick(m,120,q=>{q.padInput={s:steer,t:1,b:0}});row[old?'scheduled':'inputLed']={speed:m.c.vx,brake:m.inp.b,throttle:m.inp.t};if(!old){assert.equal(m.inp.b,0);assert(m.inp.t>.99)}}
 assert(row.inputLed.speed>row.scheduled.speed+5,'no imposed corner speed schedule');pedalOwnership.push(row);
}
// Same input, surface and vehicle state must produce the same result regardless
// of the guide or circuit heading. Assistance never chooses a line for the player.
const a=make(25),b=make(25);b.racingGuide.speed.fill(100);b.racingGuide.assist.speed.fill(100);b.tx.fill(-1);
tick(a,120,q=>q.padInput={t:.7,b:0,s:.7});tick(b,120,q=>q.padInput={t:.7,b:0,s:.7});assert.equal(a.c.x,b.c.x);assert.equal(a.c.z,b.c.z);
const wet=[];for(const grip of [1,.55]){const m=make(25);m.GP={weekend:{grip:()=>grip}};m.gpStepBefore=()=>false;m.gpStepAfter=()=>{};tick(m,120,q=>turn(q,'controller'),25);wet.push(m.c.h)}assert(wet[1]<wet[0]*.8,'wet tyres retain reduced grip');
const pulses=[];for(const speed of [50,75,95]){const m=make(speed);tick(m,10,q=>turn(q,'keyboard'),speed);const held=m.inp.s;tick(m,120,()=>{});assert(m.c.h<.07,'brief high-speed taps remain gentle');assert(m.c.cornerBrake===0);pulses.push({speed,held,heading:m.c.h})}
// Sustained correction from both sides must stay bounded and recover.
for(const sign of [-1,1]){const m=make(25);tick(m,60,q=>turn(q,'keyboard',sign),25);tick(m,18,q=>turn(q,'keyboard',-sign),25);assert(m.inp.s*sign<0);tick(m,180,()=>{});assert(Math.abs(m.c.r)<.01)}
const report={passed:true,scope:'Fixed-speed delayed input responses and pedal/guide independence in the real vehicle equations. Software tests do not establish human enjoyment or hardware feel.',responses,pedalOwnership,wetHeadings:wet,pulses};
fs.writeFileSync('upgrade/qa/input-assist.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
