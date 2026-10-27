const fs=require('fs'),vm=require('vm'),assert=require('assert');
const harness={require};vm.createContext(harness);vm.runInContext(fs.readFileSync('upgrade/tests/steering-dynamics.cjs','utf8').split('const reports=[];')[0]+';this.make=simulation;',harness);
const padCode=fs.readFileSync('upgrade/src/controller.js','utf8');
const touchCode=fs.readFileSync('upgrade/src/touch-controls.js','utf8'),touch={device:{touchLayout:'phone'},clamp:(v,a,b)=>Math.min(b,Math.max(a,v))};vm.createContext(touch);vm.runInContext(touchCode.slice(touchCode.indexOf('function touchSteeringValue'),touchCode.indexOf('function setTouchSteering')),touch);
function make(speed,old=false){const m=harness.make(old?'upgrade/tests/fixtures/input-led-handling-before.js':'upgrade/src/handling.js',speed);m.S.cornerAssist=1;vm.runInContext(padCode.slice(padCode.indexOf('const padButton'),padCode.indexOf('function cycleCamera')),m);return m}
function set(m,type,amount){m.keys.clear();m.padInput={s:0,t:0,b:0};m.touchInput={s:0,t:0,b:0};if(type==='keyboard'){if(amount)m.keys.add(amount>0?'KeyD':'KeyA')}else if(type==='controller')m.padInput=m.readPad({mapping:'standard',axes:[amount],buttons:[]},.12);else m.touchInput.s=amount;}
const rows=[];
for(const type of ['keyboard','controller','touch'])for(const speed of [15,20,25,40]){
 const row={type,kmh:speed*3.6};
 for(const old of [true,false]){
  const m=make(speed,old),raw=type==='keyboard'?1:type==='controller'?.65:old?Math.pow((36/76-.025)/.975,1.35):touch.touchSteeringValue(88+36,{left:0,width:176}).value;
  // Late input, then a committed turn. No path-following driver or speed plan.
  let headingAtHalfSecond=0;for(let i=0;i<264;i++){m.c.vx=speed;set(m,type,i<24?0:raw);m.step(1/120);if(i===83)headingAtHalfSecond=m.c.h;assert(m.inp.b===0&&m.c.cornerBrake===0);}
  row[old?'before':'after']={radius:speed/Math.abs(m.c.r),headingAtHalfSecond};
 }
 assert(row.after.radius<row.before.radius*(type==='keyboard'?.85:.75),'Deliberate '+type+' steering must reduce the wide radius');assert(row.after.headingAtHalfSecond>row.before.headingAtHalfSecond*1.15,'Late turn responds sooner');rows.push(row);
}
const taps=[];
for(const type of ['keyboard','controller','touch'])for(const speed of[30,55,80]){
 const m=make(speed);for(let i=0;i<130;i++){m.c.vx=speed;set(m,type,i<10?(type==='controller'?.35:1):0);m.step(1/120)}assert(Math.abs(m.c.h)<.07,'brief input must not snap the car');assert(Math.abs(m.inp.s)<.001&&Math.abs(m.c.r)<.02);taps.push({type,kmh:speed*3.6,heading:m.c.h});
}
for(const keyboard of[false,true])for(const speed of[5,20,50,90]){const m=make(speed);let previous=-1;for(let i=-100;i<=100;i++){const y=m.driverSteeringCommand(i/100,keyboard,.85,speed,true);assert(y>=previous-1e-10&&Math.abs(y)<=1);previous=y;}}
// The thumb pad has neutral centre, immediate signed taps and symmetric full lock.
for(const layout of['phone','tablet']){touch.device.touchLayout=layout;const w=layout==='tablet'?224:176;assert.equal(touch.touchSteeringValue(w/2,{left:0,width:w}).value,0);assert(touch.touchSteeringValue(20,{left:0,width:w}).value<-.9);assert(touch.touchSteeringValue(w-20,{left:0,width:w}).value>.9);}
const report={passed:true,rows,taps,scope:'Fixed-speed delayed input comparisons with the previously shipped handling, actual controller mapping and touch mapping. No optimized path follower; not physical device feel.'};fs.writeFileSync('upgrade/qa/turn-in.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
