// Deterministic solo sporting/session model. Seconds and metres throughout.
// Rules baseline: FIA 2026 Section B issue 06; condensed formats are game options.
const RaceWeekend=(()=>{
 const DIFFICULTIES={rookie:{name:'Rookie',pace:.72,brakeAssist:true},club:{name:'Club',pace:.84},pro:{name:'Pro',pace:.94},elite:{name:'Elite',pace:1}};
 const TYRES={soft:{name:'SOFT',letter:'S',colour:'#ff514c',grip:1.012,life:.52},medium:{name:'MEDIUM',letter:'M',colour:'#ffd24a',grip:1,life:.76},hard:{name:'HARD',letter:'H',colour:'#edf0f3',grip:.985,life:1.05}};
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mod=(x,n)=>(x%n+n)%n;
 const interp=(a,f)=>{const i=Math.floor(mod(f,a.length));return a[i]+(a[(i+1)%a.length]-a[i])*(mod(f,a.length)-i)};
 const names=['YOU','ROSSI','TAN','MORGAN','VEGA','SATO','COSTA','KIM','WALKER','SILVA','HART','LEE','DUBOIS','KING','SANTOS','BAUER','CRUZ','MOREAU','KATO','REED','ALI','SCOTT'];
 class Corridor{
  constructor(cfg){this.N=cfg.speed.length;const n=this.N*2,lo=new Float64Array(n),hi=new Float64Array(n);for(let i=0;i<n;i++){const j=i%this.N,l=cfg.lineOffset?.[j]||0;lo[i]=-(cfg.left?.[j]??7)+1.2-l;hi[i]=(cfg.right?.[j]??7)-1.2-l}this.lo=[lo];this.hi=[hi];for(let span=2;span<=n;span*=2){const k=this.lo.length-1,a=new Float64Array(n-span+1),b=new Float64Array(a.length);for(let i=0;i<a.length;i++){a[i]=Math.max(this.lo[k][i],this.lo[k][i+span/2]);b[i]=Math.min(this.hi[k][i],this.hi[k][i+span/2])}this.lo.push(a);this.hi.push(b)}}
  query(start,distance){const f=mod(start,this.N),end=f+clamp(distance,0,this.N-1);let a=Math.floor(f),b=Math.floor(end);let lo=Math.max(this.lo[0][a]+(this.lo[0][a+1]-this.lo[0][a])*(f-a),this.lo[0][b]+(this.lo[0][b+1]-this.lo[0][b])*(end-b)),hi=Math.min(this.hi[0][a]+(this.hi[0][a+1]-this.hi[0][a])*(f-a),this.hi[0][b]+(this.hi[0][b+1]-this.hi[0][b])*(end-b));a++;if(b>=a){const k=Math.floor(Math.log2(b-a+1)),tail=b-2**k+1;lo=Math.max(lo,this.lo[k][a],this.lo[k][tail]);hi=Math.min(hi,this.hi[k][a],this.hi[k][tail])}return [lo,hi]}
 }
 class Weekend{
  constructor(config){this.cfg={difficulty:'club',laps:5,qualifying:'short',twoCompounds:true,...config};this.L=config.length;this.N=config.speed.length;this.corridor=new Corridor(config);this.pit=config.pit;this.difficulty=DIFFICULTIES[this.cfg.difficulty]||DIFFICULTIES.club;this.clock=0;this.stage=0;this.phase='idle';this.grid=[];this.eliminated=[];this.events=[];this.drivers=Array.from({length:22},(_,id)=>({id,name:names[id],active:true,progress:0,v:0,best:Infinity,bestSet:Infinity,laps:0,lapStart:0,outlap:true,valid:true,tyre:'soft',wear:0,used:new Set(),stops:0,penalty:0,warnings:0,offset:0,lateralV:0,laneUntil:0,passTarget:-1,qMode:"outlap",finished:false,pace:this.difficulty.pace*(.958+((id*17)%23)/23*.042),pit:null}));}
  emit(type,data={}){this.events.push({type,time:this.clock,...data})}
  get player(){return this.drivers[0]}
  startQual(stage=0){this.events=[];this.phase='qualifying';this.stage=stage;this.clock=0;this.duration=this.cfg.qualifying==='full'?[1080,900,780][stage]:300;this.expired=false;this.stageEnded=false;this.qOrder=[];for(const d of this.drivers){if(d.active){d.best=Infinity;d.bestSet=Infinity}d.previous=null;d.lateralV=0;d.laneUntil=0;d.passTarget=-1;d.qMode="outlap";d.stageDone=!d.active;d.finished=false;d.retired=false;d.requested=false;d.valid=true;d.outlap=true;d.v=0;d.lapStart=0;d.tyre='soft';d.wear=0;if(d.active){d.progress=-(this.N-this.pit.station[this.pit.box])/this.N*this.L;d.pit={s:Math.max(0,this.pit.s[this.pit.box]-d.id*7),service:false,release:d.id*6.5,base:-this.L,hold:0,releaseOnly:true};d.progress=this.pitPose(d).progress;}}this.emit('qualifying-start',{stage});}
  standings(){return this.phase==='qualifying'||this.phase==='qualifying-result'?this.drivers.filter(d=>d.active).sort((a,b)=>a.best-b.best||a.bestSet-b.bestSet||a.id-b.id):[...this.drivers].sort((a,b)=>Number(!!a.dsq)-Number(!!b.dsq)||(a.finished&&b.finished?b.laps-a.laps||(a.finishTime+a.penalty)-(b.finishTime+b.penalty):b.progress-a.progress)||a.id-b.id)}
  endQual(){if(this.stageEnded)return;this.stageEnded=true;this.phase='qualifying-result';this.qOrder=this.standings().map(d=>d.id);if(this.cfg.qualifying==='full'&&this.stage<2){const keep=this.stage===0?16:10;this.eliminated.unshift(...this.qOrder.slice(keep));for(const id of this.qOrder.slice(keep))this.drivers[id].active=false;this.grid=this.qOrder.slice(0,keep).concat(this.eliminated)}else this.grid=this.qOrder.concat(this.eliminated);this.emit('qualifying-end',{grid:this.grid.slice(),stage:this.stage});}
  startRace(){this.events=[];this.phase='race';this.clock=0;this.raceLeaderFinished=false;this.complete=false;const grid=this.grid.length===22?this.grid:Array.from({length:22},(_,i)=>i===21?0:i+1);this.grid=grid;for(let pos=0;pos<22;pos++){const d=this.drivers[grid[pos]];Object.assign(d,{active:true,stageDone:false,progress:-6-pos*8,v:0,best:Infinity,bestSet:Infinity,laps:0,lapStart:0,outlap:false,valid:true,tyre:pos%3===0?'hard':'medium',wear:0,used:new Set(),stops:0,penalty:0,warnings:0,finished:false,retired:false,dsq:false,pit:null,requested:false,nextTyre:'hard',offset:(pos%2?2:-2)-interp(this.cfg.lineOffset||[0],mod(-6-pos*8,this.L)/this.L*this.N),lateralV:0,laneUntil:0,passTarget:-1,previous:null,gridPos:pos+1});if(d.id===0)d.tyre=this.cfg.startTyre||'medium';d.used.add(d.tyre);d.planLap=Math.max(1,Math.min(this.cfg.laps-1,Math.round(this.cfg.laps*(.40+(d.id%5)*.035))));}this.emit('race-start');}
  grip(d){return TYRES[d.tyre].grip*(1-.14*d.wear*d.wear)}
  speedAt(d,f){const grip=Math.floor(Math.sqrt(this.grip(d))*200)/200,key=grip+':'+d.pace;if(d.speedKey!==key){const speed=this.cfg.speed.map((v,i)=>v*d.pace*grip*(d.id?(this.cfg.learnedProfile?.[i]??1):1)),ds=this.cfg.ds;for(let pass=0;pass<3;pass++)for(let i=this.N-1;i>=0;i--)speed[i]=Math.min(speed[i],Math.sqrt(speed[(i+1)%this.N]**2+2*30*(ds?ds[i]:this.L/this.N)));d.speedProfile=speed;d.speedKey=key;}return interp(d.speedProfile,f)}
  requestPit(id=0,tyre){const d=this.drivers[id];if(d.finished||d.pit)return false;d.nextTyre=tyre||(['soft','medium','hard'].find(t=>t!==d.tyre));d.requested=!d.requested;this.emit('pit-request',{id,requested:d.requested,tyre:d.nextTyre});return d.requested}
  invalidate(d,reason){if(this.phase==='qualifying'){d.valid=false;return}if(d.trackOutside)return;d.trackOutside=true;d.warnings++;if(d.warnings%4!==0)this.emit('track-warning',{id:d.id,count:d.warnings%4});if(d.warnings%4===0){d.penalty+=5;this.emit('penalty',{id:d.id,seconds:5,reason})}}
  resetPenalty(){if(this.phase==='qualifying')this.player.valid=false;else if(this.phase==='race'){this.player.penalty+=5;this.emit('penalty',{id:0,seconds:5,reason:'RESET'})}}
  lap(d){const time=this.clock-d.lapStart;if(this.phase==='qualifying'){if(d.pit?.releaseOnly){d.lapStart=this.clock;return}if(!d.outlap&&d.qMode!=="cooldown"&&d.valid&&time>.1&&d.lapStart<this.duration&&time<d.best){d.best=time;d.bestSet=this.clock;this.emit('lap',{id:d.id,time,valid:true})}d.qMode=d.id&&d.qMode==="push"?"cooldown":"push";d.outlap=false;d.lapStart=this.clock;d.valid=true;if(this.expired)d.stageDone=true;}else{d.laps=Math.max(0,Math.floor((d.progress+.001)/this.L));if(d.laps>0&&d.valid&&time>.1)d.best=Math.min(d.best,time);d.valid=true;d.lapStart=this.clock;if(d.laps>=this.cfg.laps||this.raceLeaderFinished||(this.clock>=7200&&this.standings()[0].id===d.id)){d.finished=true;d.finishTime=this.clock;if(!this.raceLeaderFinished){this.raceLeaderFinished=true;this.winnerLaps=d.laps;this.raceEndClock=this.clock}d.dsq=this.cfg.twoCompounds&&d.used.size<2;this.emit('finished',{id:d.id,dsq:d.dsq})}}}
  advance(d,delta){if(!Number.isFinite(delta)||Math.abs(delta)>this.L*.1){d.valid=false;return}const before=d.progress;d.progress+=delta;const lineBefore=Math.floor(before/this.L),lineAfter=Math.floor(d.progress/this.L);if(lineAfter>lineBefore)this.lap(d);if(delta>0){const life=Math.max(this.L*2,this.cfg.laps*this.L*TYRES[d.tyre].life);d.wear=clamp(d.wear+delta/life,0,1)}}
  enterPit(d){const entry=this.pit.entry/this.N*this.L;const base=Math.round((d.progress-entry)/this.L)*this.L;d.pit={s:0,hold:0,service:false,release:0,base,releaseOnly:false};d.requested=false;d.v=Math.min(d.v,this.pit.speedLimitKmh/3.6);this.emit('pit-entry',{id:d.id})}
  pitPose(d){const p=this.pit,a=d.pit;let i=0;while(i<p.s.length-2&&p.s[i+1]<a.s)i++;const u=clamp((a.s-p.s[i])/(p.s[i+1]-p.s[i]),0,1),blend=v=>v[i]+(v[i+1]-v[i])*u;const pose={x:blend(p.x),z:blend(p.z),y:blend(p.y),h:p.heading?blend(p.heading):Math.atan2(p.z[i+1]-p.z[i],p.x[i+1]-p.x[i]),pitch:p.grade?Math.atan(blend(p.grade)):0,curvature:p.curvature?blend(p.curvature):0,progress:a.base+blend(p.station)/this.N*this.L};if(a.entryPose&&a.s<18){const t=clamp(a.s/18,0,1),v=t*t*(3-2*t),from=a.entryPose;pose.x+=(from.x-p.x[0])*(1-v);pose.z+=(from.z-p.z[0])*(1-v);pose.y+=(from.y-p.y[0])*(1-v);pose.h+=Math.atan2(Math.sin(from.h-p.heading[0]),Math.cos(from.h-p.heading[0]))*(1-v);}return pose}
  updatePit(d,dt){const a=d.pit,p=this.pit;if(this.clock<a.release){d.v=0;return}const box=p.s[p.box];if(!a.releaseOnly&&!a.service&&a.s>=box-.02){d.v=0;a.hold+=dt;const delay=2.5+(d.id%5)*.11+d.penalty;if(a.hold>=delay){d.tyre=d.nextTyre||'hard';d.wear=0;d.used.add(d.tyre);d.stops++;d.penalty=0;a.service=true;this.emit('pit-service',{id:d.id,tyre:d.tyre})}return}
   const remaining=!a.releaseOnly&&!a.service?Math.max(0,box-a.s):1e6;let k=0;while(k<p.s.length-2&&p.s[k+1]<a.s)k++;const limit=Math.min(p.speedLimitKmh/3.6,p.cornerSpeed?.[k]??Infinity);const target=Math.min(limit,Math.sqrt(2*12*remaining));d.v=Math.max(0,Math.min(target,d.v+7*dt));const before=a.s;a.s=Math.min(p.length,a.s+d.v*dt);if(remaining<.03||(!a.releaseOnly&&!a.service&&a.s>=box-.02))a.s=box;
   const pose=this.pitPose(d);d.lastPitPose=pose;this.advance(d,pose.progress-d.progress);
   if(a.s>=p.length-.001){d.pit=null;d.offset=this.cfg.pitExitOffset||0;d.lateralV=0;this.emit('pit-exit',{id:d.id})}
  }
  updatePlayer(station,speed,dt,valid=true){const d=this.player;if(d.finished||d.stageDone&&this.phase==='qualifying'||d.pit)return;const current=mod(d.progress,this.L),where=mod(station,this.N)/this.N*this.L;let delta=mod(where-current+this.L/2,this.L)-this.L/2;if(Math.abs(delta)>Math.max(8,speed*dt*2.5+2)){d.valid=false;return}d.v=speed;if(!valid)this.invalidate(d,'TRACK LIMITS');else d.trackOutside=false;this.advance(d,delta)}
  update(dt){if(!['race','qualifying'].includes(this.phase))return;const traffic=this.drivers.map(d=>({id:d.id,progress:d.progress,v:d.v,offset:d.offset,pit:!!d.pit,finished:d.finished,active:d.active,push:!d.outlap&&d.valid&&d.qMode!=="cooldown"}));for(const d of this.drivers)d.previous={progress:d.progress,offset:d.offset,v:d.v,pit:d.pit?{...d.pit}:null};this.clock+=dt;if(this.phase==='qualifying'&&this.clock>=this.duration)this.expired=true;const step=this.L/this.N;
   for(const d of this.drivers){if(!d.active||d.finished||this.phase==='qualifying'&&d.stageDone)continue;if(d.pit){this.updatePit(d,dt);continue}
    const f=mod(d.progress,this.L)/step,i=Math.floor(f);if(this.phase==='race'&&d.id&&this.cfg.twoCompounds&&d.stops===0&&Math.floor(Math.max(0,d.progress)/this.L)>=d.planLap){d.requested=true;d.nextTyre=d.tyre==='hard'?'medium':'hard'}
    const toEntry=mod(this.pit.entry-f,this.N)*step;if(d.requested&&toEntry<Math.max(.8,d.v*dt*1.25)){this.enterPit(d);continue}if(d.id===0)continue;
    let target=this.speedAt(d,f+d.v*.10/step);const pushLap=!d.outlap&&d.valid&&d.qMode!=="cooldown";if(this.phase==="qualifying"&&!pushLap)target*=d.qMode==="cooldown"?.72:.80;
    const line=interp(this.cfg.lineOffset||[0],f),left=interp(this.cfg.left||[7],f),right=interp(this.cfg.right||[7],f),minOffset=-left+1.05-line,maxOffset=right-1.05-line;
    const corridor=this.corridor.query(f,(35+d.v*3.5)/step);let futureMin=Math.max(minOffset,corridor[0]),futureMax=Math.min(maxOffset,corridor[1]);if(futureMin>futureMax){futureMin=Math.min(0,futureMin);futureMax=Math.max(0,futureMax)}
    const alongside=traffic.filter(o=>o.id!==d.id&&!o.pit&&!o.finished&&o.active&&Math.abs(mod(o.progress-d.progress+this.L/2,this.L)-this.L/2)<7.5+Math.abs(o.v-d.v)*.15);
    const ahead=traffic.filter(o=>o.id!==d.id&&!o.pit&&!o.finished&&o.active).map(o=>({...o,gap:mod(o.progress-d.progress,this.L)})).filter(o=>o.gap>0&&o.gap<Math.max(70,d.v*1.5)).sort((a,b)=>a.gap-b.gap);
    let desiredOffset=d.laneUntil>this.clock?d.lane:0;
    const passingRoom=futureMax-futureMin>5.4;
    if(!passingRoom)for(const o of traffic){const gap=mod(o.progress-d.progress,this.L);if(o.id!==d.id&&!o.pit&&!o.finished&&gap<18&&Math.abs(o.offset-d.offset)>2.05)target=Math.min(target,Math.max(0,o.v-15));}
    if(alongside.some(o=>Math.abs(o.offset-desiredOffset)<2.4))desiredOffset=d.offset;
    const leader=ahead.find(o=>Math.abs(o.offset-d.offset)<2.05);
    // Commit to the pass until the opponent is safely behind, rather than
    // returning to the racing line as an arbitrary two-second timer expires.
    const passing=traffic.find(o=>o.id===d.passTarget&&!o.pit&&!o.finished);
    if(!passing)d.passTarget=-1;
    if(passing){const signed=mod(passing.progress-d.progress+this.L/2,this.L)-this.L/2;if(signed>-14&&signed<180&&d.lane>=futureMin&&d.lane<=futureMax){desiredOffset=d.lane;d.laneUntil=this.clock+1;}else d.passTarget=-1;}
    if(this.phase==='qualifying'&&!pushLap){
     const approaching=traffic.filter(o=>o.id!==d.id&&o.active&&!o.finished&&!o.pit&&o.push).map(o=>({...o,behind:mod(d.progress-o.progress,this.L)})).filter(o=>o.behind<Math.max(180,o.v*4)&&o.behind>0).sort((a,b)=>a.behind-b.behind)[0];
     if(approaching&&passingRoom){
      const candidates=[futureMin+.2,futureMax-.2].filter(lane=>Math.abs(lane-approaching.offset)>2.7&&traffic.every(o=>o.id===d.id||o.pit||o.finished||Math.abs(mod(o.progress-d.progress+this.L/2,this.L)-this.L/2)>16||Math.abs(lane-o.offset)>2.2)).sort((a,b)=>Math.abs(b)-Math.abs(a));
      if(candidates.length){desiredOffset=d.lane=candidates[0];d.laneUntil=this.clock+3;d.passTarget=-1;target*=.82;}
     }
    }
    if((this.phase==='race'||pushLap)&&passingRoom&&leader&&leader.gap<Math.max(70,d.v*1.5)&&leader.v<target+1&&d.passTarget<0&&d.laneUntil<=this.clock){
     const candidates=[leader.offset-2.8,leader.offset+2.8].filter(o=>o>=futureMin&&o<=futureMax).sort((a,b)=>Math.abs(a-d.offset)-Math.abs(b-d.offset));
     const lane=candidates.find(lane=>traffic.every(o=>{if(o.id===d.id||o.pit||o.finished)return true;const gap=mod(o.progress-d.progress+this.L/2,this.L)-this.L/2;return gap>28||gap<-Math.max(18,(o.v-d.v)*2+10)||Math.abs(o.offset-lane)>2.2;}));
     if(lane!==undefined){desiredOffset=d.lane=lane;d.laneUntil=this.clock+2.5;d.passTarget=leader.id;this.emit('overtake-attempt',{id:d.id,target:leader.id});}
    }
    desiredOffset=clamp(desiredOffset,futureMin,futureMax);
    const mergeConflict=traffic.find(o=>o.id!==d.id&&!o.pit&&!o.finished&&o.active&&mod(o.progress-d.progress,this.L)<18&&Math.abs(o.offset-desiredOffset)<2.3&&Math.abs(o.offset-d.offset)>2.1);
    if(mergeConflict){target=Math.min(target,Math.max(0,mergeConflict.v-12));desiredOffset=d.offset;}
    const closing=d.offset<futureMin||d.offset>futureMax;
    if(closing){const blocking=alongside.find(o=>mod(o.progress-d.progress,this.L)<this.L/2);if(blocking){target=Math.min(target,Math.max(0,blocking.v-18));d.laneUntil=0;}}

    // Rate and acceleration limited lane changes, independent of rendering rate.
    const desiredV=clamp((desiredOffset-d.offset)*1.6,-1.6,1.6);d.lateralV+=clamp(desiredV-d.lateralV,-2.8*dt,2.8*dt);let nextOffset=clamp(d.offset+d.lateralV*dt,minOffset,maxOffset);
    if(d.offset>=minOffset&&d.offset<=maxOffset&&alongside.some(o=>Math.abs(nextOffset-o.offset)<2.15&&Math.abs(nextOffset-o.offset)<Math.abs(d.offset-o.offset))){nextOffset=d.offset;d.lateralV=0;}
    d.offset=nextOffset;
    const front=ahead.find(o=>!passingRoom||Math.abs(o.offset-d.offset)<2.3||Math.abs(o.offset-desiredOffset)<2.3);
    if(front){
     const ownDs=this.cfg.ds?interp(this.cfg.ds,f):step,frontDs=this.cfg.ds?interp(this.cfg.ds,mod(front.progress,this.L)/step):step,frontRate=front.v*step/Math.max(.5,frontDs);
     // Compare stopping distances before a queue compresses into a braking zone.
     // Reserve 3 m/s^2 of the available 38 for correction and 120 ms for response.
     const frontSpeed=frontRate*ownDs/step,space=Math.max(0,(front.gap-8.5)*ownDs/step),brake=35,reaction=.12;
     const safe=Math.max(0,Math.sqrt((brake*reaction)**2+frontSpeed**2*brake/38+2*brake*space)-brake*reaction);
     target=Math.min(target,safe,Math.max(0,(frontRate+(front.gap-9)*.8)*ownDs/step));
    }
    if(d.requested&&toEntry<180)target=Math.min(target,Math.sqrt((this.pit.speedLimitKmh/3.6)**2+2*18*Math.max(0,toEntry-6)));
    const accel=d.v>target?-38:Math.min(13,900/Math.max(15,d.v));d.v=Math.max(0,d.v>target?Math.max(target,d.v+accel*dt):Math.min(target,d.v+accel*dt));
    const ds=this.cfg.ds?interp(this.cfg.ds,f):step;let delta=d.v*dt*step/Math.max(.5,ds);
    if(front&&front.gap<14&&Math.abs(front.offset-d.offset)<2.1){const available=Math.max(0,front.gap-6.5+front.v*dt*step/Math.max(.5,this.cfg.ds?interp(this.cfg.ds,mod(front.progress,this.L)/step):step));if(delta>available){delta=available;d.v=Math.min(d.v,delta/dt*ds/step)}}
    this.advance(d,delta);

   }
   if(this.phase==='qualifying'&&this.expired&&(this.drivers.every(d=>!d.active||d.stageDone)||this.clock>this.duration+this.cfg.baseLap*2.5))this.endQual();
   if(this.phase==='race'&&this.raceLeaderFinished&&(this.drivers.every(d=>d.finished)||this.clock-this.raceEndClock>this.cfg.baseLap*2)){for(const d of this.drivers)if(!d.finished){d.finished=true;d.finishTime=this.clock;d.retired=true;d.dsq=this.cfg.twoCompounds&&d.used.size<2}this.complete=true;this.phase='race-result';this.emit('race-end')}
  }
  classification(){const rows=this.standings(),winner=Math.max(...this.drivers.map(d=>d.laps));return rows.map((d,i)=>({...d,used:[...d.used],position:i+1,classified:!d.dsq&&d.laps>=Math.floor(winner*.9),points:!d.dsq&&d.laps>=Math.floor(winner*.9)?([25,18,15,12,10,8,6,4,2,1][i]||0):0}))}
 }
 return {Weekend,DIFFICULTIES,TYRES,interp,mod};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=RaceWeekend;
