const assert=require('node:assert/strict'),fs=require('node:fs');
const {Weekend:After}=require('../src/race-weekend-core.js');
class Before extends After{
 speedAt(d,f){const grip=Math.floor(Math.sqrt(this.grip(d))*200)/200,key=grip+':'+d.pace;if(d.speedKey!==key){const speed=this.cfg.speed.map((v,i)=>v*d.pace*grip*(d.id?(this.cfg.learnedProfile?.[i]??1):1)),ds=this.cfg.ds;for(let pass=0;pass<3;pass++)for(let i=this.N-1;i>=0;i--)speed[i]=Math.min(speed[i],Math.sqrt(speed[(i+1)%this.N]**2+60*(ds?ds[i]:this.L/this.N)));d.speedProfile=speed;d.speedKey=key;}return d.speedProfile[0]}
}
const tracks=JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')),pits=JSON.parse(fs.readFileSync('upgrade/src/pit-lanes.json'));
let maximumError=0,profiles=0;
for(const [id,t] of Object.entries(tracks))for(const difficulty of ['rookie','club','pro','elite']){
 const cfg={length:t.length,speed:t.line.speed,ds:t.line.ds,left:t.widthLeft,right:t.widthRight,lineOffset:t.line.offset,pit:pits[id],difficulty,learnedProfile:t.line.speed.map((_,i)=>.93+(i%17)*.004)};
 const before=new Before(cfg),after=new After(cfg);
 for(let car=0;car<22;car++)for(const [tyre,wear] of [['soft',0],['medium',.45],['hard',.95]]){
  const a=before.drivers[car],b=after.drivers[car];Object.assign(a,{tyre,wear});Object.assign(b,{tyre,wear});
  before.speedAt(a,12.5);after.speedAt(b,12.5);profiles++;
  for(let i=0;i<t.N;i++){const error=Math.abs(a.speedProfile[i]-b.speedProfile[i]);maximumError=Math.max(maximumError,error);assert(error<1e-10,`${id} ${difficulty} car ${car} point ${i}: ${error}`)}
  const buffer=b.speedProfile;after.speedAt(b,-.25);assert.equal(b.speedProfile,buffer);b.wear=.64;after.speedAt(b,0);assert.equal(b.speedProfile,buffer,'Profile changes reuse the same buffer');
 }
}
const report={passed:true,profiles,maximumErrorMetresPerSecond:maximumError,scope:'All 14 circuits, four difficulties, 22 drivers, three tyre/wear combinations, learned pace and lap seam; same braking envelope within 1e-10 m/s, reused profile buffers.'};
fs.writeFileSync('upgrade/qa/speed-profile-equivalence.json',JSON.stringify(report,null,2));console.log(report);
