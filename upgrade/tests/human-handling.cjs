const fs=require('fs'),vm=require('vm'),assert=require('assert');
const fixture=fs.readFileSync('upgrade/tests/steering-dynamics.cjs','utf8').split('const reports=[];')[0].replace("const fs=require('fs'),vm=require('vm'),assert=require('assert');",'');
const context={require,fs,vm,assert};vm.createContext(context);vm.runInContext(fixture,context);
const simulate=(speed,before=false)=>context.simulation(before?'upgrade/tests/fixtures/human-steering-before.js':'upgrade/src/handling.js',speed);
const padContext={clamp:(x,a,b)=>Math.min(b,Math.max(a,x))};vm.createContext(padContext);
const source=fs.readFileSync('upgrade/src/controller.js','utf8');vm.runInContext(source.slice(source.indexOf('const padButton'),source.indexOf('function cycleCamera')),padContext);
function input(m,type,steer,gas=0,brake=0){
 m.keys.clear();m.padInput={s:0,t:0,b:0};
 if(type==='keyboard'){if(steer)m.keys.add(steer>0?'KeyD':'KeyA');if(gas)m.keys.add('KeyW');if(brake)m.keys.add('Space')}
 else{const p={mapping:'standard',axes:[steer],buttons:Array.from({length:16},(_,i)=>({pressed:false,value:i===7?gas:i===6?brake:0}))};m.padInput=padContext.readPad(p,.12,m.c.vx)}
}
const rows=[];
for(const speed of [8,12,20,35,70])for(const type of ['keyboard','controller']){
 const row={speed,type};
 for(const old of [true,false]){const m=simulate(speed,old);input(m,type,type==='keyboard'?1:.7);
  for(let i=0;i<30;i++)m.step(1/120);
  row[old?'before':'after']={angle:m.c.st,yaw:m.c.r,heading:m.c.h};
  input(m,type,0);for(let i=0;i<120;i++)m.step(1/120);
  assert(Math.abs(m.inp.s)<.001);assert(Number.isFinite(m.c.x+m.c.z+m.c.r));
 }
 if(speed<=12){assert(row.after.angle>row.before.angle*(type==='keyboard'?1.5:1.15),'late hairpin input has more immediate steering');assert(row.after.yaw>row.before.yaw*(type==='keyboard'?1.5:1.2),'late input produces turning, not just wheel angle')}
 if(speed>=70)assert(Math.abs(row.after.heading)<=Math.abs(row.before.heading)*1.1,'high-speed inputs stay gentle');
 rows.push(row);
}
for(const type of ['keyboard','controller']){
 const m=simulate(15);input(m,type,0,0,1);for(let i=0;i<500;i++)m.step(1/120);
 assert(m.c.vx>=0&&!m.c.reverse,'braking alone never engages reverse while stopping');
 input(m,type,0);for(let i=0;i<20;i++)m.step(1/120);
 input(m,type,1,0,1);const old=m.c.x;for(let i=0;i<180;i++)m.step(1/120);
 assert(m.c.reverse&&m.c.gear===-1&&m.c.vx< -2&&m.c.vx>=-8);assert(m.c.x<old,'backs away');assert(m.c.r<0,'reverse steering rotates in correct direction');
 input(m,type,0,1);let crossed=false;for(let i=0;i<240;i++){const prev=m.c.vx;m.step(1/120);if(prev<-.1)assert(m.c.vx<=0,'direction change brakes to standstill');if(m.c.vx>0)crossed=true}
 assert(crossed&&!m.c.reverse&&m.c.gear>=1,'throttle returns to forward');
 const b=simulate(60);input(b,type,1,0,1);for(let i=0;i<120;i++)b.step(1/120);assert(b.c.vx<36,'strong combined braking retained');
}
for(const speed of [0,8,20,70,95])for(const type of ['keyboard','controller']){
 const m=simulate(speed);for(let i=0;i<720;i++){input(m,type,Math.sin(i/45),i%120<60?1:0,i%120>=60?1:0);m.step(1/120);assert(Number.isFinite(m.c.x+m.c.z+m.c.h+m.c.vx));assert(Math.abs(m.c.vx)<=106)}
}
const m=simulate(8);input(m,'controller',.1);for(let i=0;i<60;i++)m.step(1/120);assert.equal(m.inp.s,0,'deadzone rejects drift');
fs.writeFileSync('upgrade/qa/human-handling.json',JSON.stringify({passed:true,scope:'Actual driver equations with keyboard and standard gamepad axes/triggers; not a physical-controller test.',rows},null,2));console.log(JSON.stringify(rows,null,2));
