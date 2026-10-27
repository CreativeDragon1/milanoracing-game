const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const harness={require};vm.createContext(harness);
vm.runInContext(fs.readFileSync('upgrade/tests/steering-dynamics.cjs','utf8').split('const reports=[];')[0]+';this.make=simulation;',harness);
const oldFile='upgrade/tests/fixtures/team-edition-handling.js',file='upgrade/src/handling.js';
function make(speed,old=false){const m=harness.make(old?oldFile:file,speed);m.W=10000;m.S.cornerAssist=1;return m}
function input(m,type,s,t=0,b=0){m.keys.clear();m.padInput={s:0,t:0,b:0};m.touchInput={s:0,t:0,b:0};if(type==='keyboard'){if(s)m.keys.add(s>0?'KeyD':'KeyA');if(t)m.keys.add('KeyW');if(b)m.keys.add('Space')}else m[type==='touch'?'touchInput':'padInput']={s,t,b}}
const rows=[];
// Replay the preserved game at identical vehicle states. This proves the
// requested rollback, independently of the newer grip/power/circuit model.
for(const type of ['keyboard','controller','touch'])for(const speed of [0,8,20,40,70,95])for(const sign of [-1,1]){
 const a=make(speed,true),b=make(speed);let peak=0;
 for(let i=0;i<480;i++){
  const s=i<120?sign:i<240?0:i<360?-sign:0,t=i<100?1:0,br=i>=200&&i<260?1:0;
  // The old build predates touch: feed the same normalized request into its pad.
  input(a,type==='touch'?'controller':type,s,t,br);input(b,type,s,t,br);
  // Keep direction forward in this matched-state replay. Reverse and pedal
  // conflict behaviour intentionally differ from the old build, tested below.
  for(const m of [a,b]){m.c.vx=speed;m.c.vy=0;m.c.r=0;m.c.h=0;m.c.x=0;m.c.z=0;m.c.reverse=false;m.c.reverseArmed=false;m.c.reverseHold=0}
  a.step(1/120);b.step(1/120);
  for(const k of ['s','t','b'])assert(Math.abs(a.inp[k]-b.inp[k])<1e-9,`${type} ${speed}: original ${k} response`);
  assert(Math.abs(a.c.st-b.c.st)<1e-9,'original rack request');peak=Math.max(peak,Math.abs(b.c.st));
 }
 assert(Math.abs(b.inp.s)<.001);rows.push({type,speedKmh:speed*3.6,sign,peakSteeringRadians:peak});
}
// Partial inputs remain proportional, and both directions share one response.
for(const speed of [8,25,60,95])for(const amount of [.15,.35,.65,1]){
 const a=make(speed),b=make(speed);for(let i=0;i<120;i++){input(a,'controller',amount);input(b,'touch',-amount);a.c.vx=b.c.vx=speed;a.step(1/120);b.step(1/120)}
 assert(Math.abs(a.c.h+b.c.h)<1e-9,'left/right and normalized device symmetry');
 assert(Math.abs(a.c.z+b.c.z)<1e-9);assert(a.c.st>0);
 input(a,'controller',0);for(let i=0;i<180;i++)a.step(1/120);assert(Math.abs(a.c.r)<.02,'release settles');
}
const safety=[];
for(const type of ['keyboard','controller','touch']){
 const m=make(35);input(m,type,1,1,1);for(let i=0;i<180;i++)m.step(1/120);
 assert(m.c.vx<8,'braking still works while turning and holding gas');assert(!m.c.reverse);
 input(m,type,0,0,1);for(let i=0;i<400;i++)m.step(1/120);assert(m.c.vx>=0&&!m.c.reverse,'braking does not unexpectedly reverse');
 input(m,type,0);for(let i=0;i<40;i++)m.step(1/120);
 input(m,type,1,0,1);for(let i=0;i<180;i++)m.step(1/120);assert(m.c.reverse&&m.c.gear===-1&&m.c.vx< -2&&m.c.r<0,'reverse with steering');
 input(m,type,0,1);for(let i=0;i<300;i++)m.step(1/120);assert(m.c.vx>0&&!m.c.reverse,'return to forward');safety.push(type);
}
const a=make(25),b=make(25);a.racingGuide={speed:[1]};b.racingGuide={speed:[100]};
for(let i=0;i<240;i++){input(a,'controller',.6,1);input(b,'controller',.6,1);a.step(1/120);b.step(1/120);assert(a.inp.b===0&&b.inp.b===0);assert.equal(a.c.x,b.c.x);assert.equal(a.c.z,b.c.z)}
// A visually turned nose must also turn the trajectory. Previously the second
// yaw correction plus residual sideways velocity made it keep sliding wide.
const trajectories=[];
for(const speed of [8,20,40,70,95])for(const sign of [-1,1]){
 const m=make(speed);for(let i=0;i<240;i++){input(m,'controller',sign*.65);m.c.vx=speed;m.step(1/120);
  assert.equal(m.c.vy,0,'assisted travel follows the nose');
  assert(Math.abs(m.c.r-m.c.vx/3*Math.tan(m.c.st))<1e-9,'filtered rack determines actual turning');
 }
 trajectories.push({speed,sign,radius:m.c.vx/Math.abs(m.c.r),steering:m.c.st});
}
const wet=[];for(const grip of [1,.55]){const m=make(40);m.GP={weekend:{grip:()=>grip}};m.gpStepBefore=()=>false;m.gpStepAfter=()=>{};for(let i=0;i<120;i++){input(m,'controller',1);m.c.vx=40;m.step(1/120)}wet.push(m.c.r)}assert(wet[1]<wet[0]*.8,'wet grip still limits turning');
for(const dt of [1/60,1/120,1/240]){const m=make(70);for(let t=0;t<6;t+=dt){input(m,'controller',Math.sin(t*3),t%2<1?1:0,t%2>=1?1:0);m.step(dt);assert(Number.isFinite(m.c.x+m.c.z+m.c.h+m.c.vx+m.c.r));assert(Math.abs(m.c.vx)<106)}}
const report={passed:true,sourceSHA256:require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex'),reference:'Preserved Milano Racing - Team Edition.html; original input and rack requests replayed at matching vehicle states.',scope:'Restores steering and pedal response; retains current vehicle power, circuits, reverse, combined braking and device mappings. Assisted travel follows the nose within grip limits. Software checks do not establish human or physical-device feel.',rows,safety,trajectories,wet};
fs.writeFileSync('upgrade/qa/classic-handling.json',JSON.stringify(report,null,2));console.log('Classic controls: preserved-input equivalence, device symmetry, release, braking, reverse and guide independence passed.');
