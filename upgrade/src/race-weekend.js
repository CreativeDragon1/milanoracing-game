// Solo race-weekend integration; multiplayer keeps its server-authoritative session lifecycle.

const GP={weekend:null,models:[],lastHUD:0,qualAdvance:false,pitSkip:null,pitChoice:'hard',lastValid:true};

function gpConfig(){const lapsValue=$('gp-length').value,full=Math.floor((CIRCUIT.id==='monaco'?260000:305000)/LEN)+1;return{learnedProfile:learningProfile(),length:LEN,speed:racingGuide.speed,ds:CIRCUIT.line.ds,left:CIRCUIT.widthLeft,right:CIRCUIT.widthRight,lineOffset:CIRCUIT.line.offset,baseLap:racingGuide.report.time,pit:PIT,pitExitOffset:prog(PIT.x.at(-1),PIT.z.at(-1),-1).d-RaceWeekend.interp(CIRCUIT.line.offset,PIT.exit),difficulty:$('gp-difficulty').value,qualifying:$('gp-qualifying').value,laps:lapsValue==='full'?full:Number(lapsValue),twoCompounds:$('gp-strategy').checked,startTyre:$('gp-start-tyre').value}}

const baseNewSession=newSession,baseFinish=finish,baseTiming=timing;

newSession=function(m){if(typeof MP!=='undefined'&&MP.active&&m!=='mp')return;if(m==='qual'||m==='gp'){startWeekend(m);return}clearWeekend();baseNewSession(m)};

finish=function(){if(GP.weekend){if(GP.weekend.phase==='qualifying'){GP.weekend.expired=true;GP.weekend.endQual();gpResults()}else{GP.weekend.player.retired=true;GP.weekend.player.finished=true;GP.weekend.player.finishTime=GP.weekend.clock;gpResults(true)}return}baseFinish()};

timing=function(pi){if(GP.weekend)return;baseTiming(pi)};

function clearWeekend(){learningFlush();learning.rows=[];learning.lap=-1;GP.weekend=null;GP.qualAdvance=false;if(GP.drawRoot)GP.drawRoot.visible=false;for(const m of GP.models)m.visible=false;$('gp-timing').hidden=true;$('gp-race-strip').hidden=true;document.body.classList.remove('weekend-driving')}

function makeRaceModels(){if(GP.models.length)return;

 GP.drawGroups=new Map();GP.drawRoot=new T.Group();GP.drawRoot.name='Batched MR 26 field';scene.add(GP.drawRoot);

 for(let id=1;id<22;id++){const mesh=cloneRaceCar();mesh.name='MR 26 competitor '+id;mesh.visible=false;GP.models.push(mesh);

  mesh.traverse(part=>{if(!part.isMesh)return;const key=part.geometry.uuid+':'+(Array.isArray(part.material)?part.material.map(m=>m.uuid).join(','):part.material.uuid)+':'+part.renderOrder;

   if(!GP.drawGroups.has(key))GP.drawGroups.set(key,{geometry:part.geometry,material:part.material,order:part.renderOrder,receive:part.receiveShadow,entries:[]});GP.drawGroups.get(key).entries.push({root:mesh,part});});

 }

 for(const g of GP.drawGroups.values()){g.batches=[false,true].map(shadow=>{const batch=new T.InstancedMesh(g.geometry,g.material,g.entries.length);batch.name='MR 26 field '+(shadow?'near':'distant');batch.castShadow=shadow;batch.receiveShadow=g.receive;batch.renderOrder=g.order;batch.frustumCulled=false;batch.count=0;batch.instanceMatrix.setUsage(T.DynamicDrawUsage);GP.drawRoot.add(batch);return batch})}

}

const raceFrustum=new T.Frustum(),raceProjection=new T.Matrix4(),raceSphere=new T.Sphere();

function drawRaceInstances(){if(!GP.drawRoot)return;GP.drawRoot.visible=!!GP.weekend;if(!GP.weekend)return;

 cam.updateMatrixWorld();raceFrustum.setFromProjectionMatrix(raceProjection.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));

 for(const mesh of GP.models){mesh.userData.draw=false;if(!mesh.visible)continue;raceSphere.center.copy(mesh.position);raceSphere.radius=6;const near=mesh.position.distanceToSquared(car.position)<110**2;

  if(!near&&!raceFrustum.intersectsSphere(raceSphere))continue;mesh.userData.draw=true;mesh.userData.shadowNear=near;mesh.updateMatrixWorld(true);

 }

 for(const g of GP.drawGroups.values()){const counts=[0,0];for(const e of g.entries){if(!e.root.userData.draw||!e.part.visible)continue;const j=e.root.userData.shadowNear?1:0;g.batches[j].instanceMatrix.array.set(e.part.matrixWorld.elements,counts[j]++*16)}for(let j=0;j<2;j++){g.batches[j].count=counts[j];g.batches[j].visible=counts[j]>0;g.batches[j].instanceMatrix.needsUpdate=true}}

}

function startWeekend(m,existing=false){if(!existing){GP.weekend=new RaceWeekend.Weekend(gpConfig());learning.rows=[];learning.lap=-1;learning.clean=true;GP.pitChoice='hard'}const w=GP.weekend;baseNewSession(m);makeRaceModels();mode=m;for(const m of GP.models)m.visible=true;if(m==='qual'){w.startQual(existing?w.stage+1:0);state='race';show('none');const pose=w.pitPose(w.player);gpPlace(pose);race.cd=0}else{w.startRace();const p=w.player;gpPlace(gpTrackPose(p));race.cd=7.2+((Date.now()%1300)/1000);state='count';show('count')}race.started=true;race.lapNo=1;race.valid=true;acc=0;$('gp-timing').hidden=false;$('gp-race-strip').hidden=false;document.body.classList.add('weekend-driving');$('hud').hidden=false;gpHud(true)}

function gpPlace(p){Object.assign(c,{x:p.x,z:p.z,h:p.h,vx:0,vy:0,r:0,st:0,reverse:false,reverseArmed:true,reverseHold:0,limitState:TrackLimits.fresh()});const pr=prog(c.x,c.z,-1);c.idx=pr.i;c.d=pr.d;snap=true}

function gpTrackPose(d){

 const f=RaceWeekend.mod(d.progress,LEN)/LEN*N,i=Math.floor(f),u=f-i,wrap=n=>(n+N)%N;

 // Cubic Hermite position and its analytic tangent remove polygonal yaw steps.

 const sample=(values)=>{const a=values[i],b=values[wrap(i+1)],m=(b-values[wrap(i-1)])*.5,n=(values[wrap(i+2)]-a)*.5;return{v:(2*u**3-3*u*u+1)*a+(u**3-2*u*u+u)*m+(-2*u**3+3*u*u)*b+(u**3-u*u)*n,d:(6*u*u-6*u)*a+(3*u*u-4*u+1)*m+(-6*u*u+6*u)*b+(3*u*u-2*u)*n}};

 const X=sample(CIRCUIT.line.x),Z=sample(CIRCUIT.line.z),len=Math.hypot(X.d,Z.d),nnx=-Z.d/len,nnz=X.d/len;

 const offset=clamp(d.offset,-trackHalf(f,-1)+1.05-RaceWeekend.interp(CIRCUIT.line.offset,f),trackHalf(f,1)-1.05-RaceWeekend.interp(CIRCUIT.line.offset,f));

 const x=X.v+nnx*offset,z=Z.v+nnz*offset,h=Math.atan2(Z.d,X.d)+Math.atan2(d.lateralV||0,Math.max(8,d.v));

 return{x,z,y:roadHeightAt(x,z,i),h,f,offset};

}



function gpPitRequest(){const w=GP.weekend;if(!w||state!=='race')return;w.requestPit(0,GP.pitChoice);msg(w.player.requested?'BOX THIS LAP · '+RaceWeekend.TYRES[GP.pitChoice].name:'PIT CALL CANCELLED',1800)}

function gpCycleTyre(){GP.pitChoice=['soft','medium','hard'][(['soft','medium','hard'].indexOf(GP.pitChoice)+1)%3];if(GP.weekend?.player.requested)GP.weekend.player.nextTyre=GP.pitChoice;gpHud(true)}

// Advance the entire session, including rivals and tyre service, in bounded
// batches. Skipping the presentation never removes the time cost of a stop.
async function gpAdvancePit(w,current,yieldFrame,now,advance){
 let steps=0;
 while(w.player.pit){
  if(!current())return false;
  const deadline=now()+4;
  do{advance(1/120);if(++steps>120*600)throw new Error('Pit exit did not complete');}
  while(w.player.pit&&current()&&now()<deadline);
  await yieldFrame();
 }
 return current();
}
async function gpSkipPit(){
 const w=GP.weekend;
 if(!w?.player.pit||GP.pitSkip||state!=='race'||(typeof MP!=='undefined'&&MP.active))return;
 const token={w};GP.pitSkip=token;gpHud(true);
 const cover=$('pit-transition'),current=()=>GP.pitSkip===token&&GP.weekend===w&&state==='race'&&!document.hidden&&window.MilanoHostVisible!==false;
 const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
 cover.classList.add('active');acc=0;
 try{
  await new Promise(resolve=>setTimeout(resolve,240));
  const completed=await gpAdvancePit(w,current,paint,()=>performance.now(),dt=>gpStepBefore(dt));
  if(completed){inp.t=inp.b=0;previousPose=null;acc=0;snap=true;gpHud(true);await paint();await paint();}
 }catch(error){console.error(error);msg('Pit drive resumed',1800)}
 finally{cover.classList.remove('active');if(GP.pitSkip===token)GP.pitSkip=null;acc=0;last=performance.now();gpHud(true);}
}

addEventListener('keydown',e=>{if(e.repeat||!GP.weekend||state!=='race')return;if(e.code==='KeyP'){e.preventDefault();gpPitRequest()}if(e.code==='KeyT'){e.preventDefault();gpCycleTyre()}if(e.code==='KeyK'){e.preventDefault();gpSkipPit()}});

function gpStepBefore(dt){const w=GP.weekend;if(!w)return false;const p=w.player;if(p.pit||p.finished||w.phase==='qualifying'&&p.stageDone){const wasPit=!!p.pit;w.update(dt);if(p.pit||wasPit){c.reverse=false;c.reverseArmed=false;c.reverseHold=0;const pose=p.pit?w.pitPose(p):p.lastPitPose;c.x=pose.x;c.z=pose.z;c.h=pose.h;c.vx=p.v;c.vy=0;c.r=(pose.curvature||0)*p.v;c.st=Math.atan(VEH.wheelbase*(pose.curvature||0));inp.s=clamp(c.st/Math.max(.01,vehicleEnvelope(p.v).steer),-1,1);c.idx=Math.round(RaceWeekend.mod(p.progress,LEN)/LEN*N)%N;c.d=prog(c.x,c.z,c.idx).d;inp.t=p.v>0?.35:0;inp.b=p.v===0?1:0;}else{c.vx=0;inp.t=inp.b=0}race.t=w.clock;gpEvents();return true}return false}

function gpStepAfter(dt){const w=GP.weekend;if(!w)return;const pr=prog(c.x,c.z,c.idx),valid=!c.limitState?.violation;w.updatePlayer(pr.s/LEN*N,c.vx,dt,valid);w.player.offset=pr.d-RaceWeekend.interp(CIRCUIT.line.offset,pr.s/LEN*N);w.update(dt);race.t=w.clock;race.lapNo=Math.max(1,w.player.laps+1);race.lapStart=w.player.lapStart;race.valid=w.player.valid;race.best=w.player.best*1000;race.dist=Math.max(0,w.player.progress);if(w.phase==='race')gpContact();learningObserve(dt);gpEvents()}

function gpEvents(){const w=GP.weekend;if(!w)return;for(const event of w.events){if(event.type==='pit-entry'){const d=w.drivers[event.id],p=event.id===0?{x:c.x,z:c.z,h:c.h,y:roadHeightAt(c.x,c.z,c.idx)}:gpTrackPose(d.previous?{...d,...d.previous}:d);if(d.pit)d.pit.entryPose=p;}if(event.type==='qualifying-end'||event.type==='race-end'){learningFlush();gpResults();}else if(event.id===0){if(event.type==='pit-service')msg('TYRES ON · '+RaceWeekend.TYRES[event.tyre].name,1800);if(event.type==='track-warning')msg('TRACK LIMITS · WARNING '+event.count,1800);if(event.type==='penalty')msg('+'+event.seconds+' SEC · '+event.reason,2400);if(event.type==='finished')msg(event.dsq?'CHEQUERED FLAG · TYRE RULE NOT MET':'CHEQUERED FLAG',3000);if(event.type==='lap'){race.last=event.time*1000;msg('LAP '+fmt(race.last),1500)}}}w.events.length=0;}

function gpRender(){const w=GP.weekend;if(!w){animatePitCrew(null);drawRaceInstances();return;}const alpha=state==='race'?clamp(acc/H,0,1):1;

 GP.models.forEach((mesh,i)=>{const d=w.drivers[i+1];mesh.visible=d.active&&!d.stageDone&&!d.finished&&(!d.pit||w.clock>=d.pit.release);if(!mesh.visible)return;

  const previous=d.previous;let view=d;if(previous&&!!previous.pit===!!d.pit){view=Object.assign(mesh.userData.renderView||(mesh.userData.renderView={}),d);view.progress=previous.progress+(d.progress-previous.progress)*alpha;view.offset=previous.offset+(d.offset-previous.offset)*alpha;view.v=previous.v+(d.v-previous.v)*alpha;if(d.pit){view.pit=Object.assign(mesh.userData.pitView||(mesh.userData.pitView={}),d.pit);view.pit.s=previous.pit.s+(d.pit.s-previous.pit.s)*alpha}}

  const p=view.pit?w.pitPose(view):gpTrackPose(view);mesh.position.set(p.x,p.y+.025,p.z);mesh.rotation.set(view.pit?0:-bankAt(p.f),-p.h,view.pit?(p.pitch||0):roadPitchAt(p.x,p.z,p.h,Math.floor(p.f)%N),'YXZ');const distance=mesh.position.distanceToSquared(car.position);mesh.visible=distance<1200**2;

  if(!mesh.userData.raceParts){const parts=[],spins=[];mesh.traverse(o=>{if(o.isMesh)parts.push(o);if(o.userData.wheelSpin)spins.push(o)});mesh.userData.raceParts=parts;mesh.userData.raceSpins=spins}

  const cast=distance<110**2;if(mesh.userData.shadowNear!==cast){for(const part of mesh.userData.raceParts)part.castShadow=cast;mesh.userData.shadowNear=cast}

  const wheelAngle=Math.atan(VEH.wheelbase*(view.pit?p.curvature||0:RaceWeekend.interp(CIRCUIT.line.curvature,p.f)));

  for(const spin of mesh.userData.raceSpins){spin.rotation.z=-view.progress/.37;if(spin.parent.position.x>0)spin.parent.rotation.y=-wheelAngle;}

 });drawRaceInstances();animatePitCrew(w);gpHud()}



function gpTimingHud(){const w=GP.weekend;if(!w)return;const p=w.player,qual=w.phase.startsWith('qualifying');

 const remaining=Math.ceil(Math.max(0,w.duration-w.clock));

 hudText('session-type',qual?(w.cfg.qualifying==='full'?'Q'+(w.stage+1):'QUALIFYING'):'RACE');

 hudText('lap',qual?(w.expired?'CHEQUERED FLAG':Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0')):'LAP '+Math.min(w.cfg.laps,Math.max(1,Math.floor(Math.max(0,p.progress)/LEN)+1))+' · '+w.cfg.laps);

 hudKicker(qual&&p.outlap?'OUT LAP':'CURRENT LAP');

 hudText('cur',qual&&p.outlap?'--:--.---':fmt(Math.max(0,w.clock-p.lapStart)*1000));

 hudText('bst','BEST '+fmt(p.best*1000));hudText('sec',Number.isFinite(p.lastLap)?'LAST '+fmt(p.lastLap*1000):'');

 hudText('val',p.pit?(p.pit.hold?'TYRE SERVICE':'PIT LIMIT '+PIT.speedLimitKmh+' KM/H'):qual?(p.outlap?'OUT LAP':p.valid?'PUSH LAP':'LAP DELETED'):(p.penalty?'+'+p.penalty+' SEC PENALTY':'P'+(GP.position||1)+' OF 22'));

 const cls=qual&&!p.valid?'bad':'';if(hudNode('val').className!==cls)hudNode('val').className=cls;

 hudText('dl','POSITION '+(GP.position||1)+' OF 22');hudStyle('dl','color','var(--tx2)');

}

function gpHud(force=false){const w=GP.weekend;if(!w)return;const now=performance.now();if(!force&&now-GP.lastHUD<130)return;GP.lastHUD=now;const p=w.player,qual=w.phase.startsWith('qualifying'),order=w.standings(),pos=order.findIndex(d=>d.id===0)+1;GP.position=pos;if(force)gpTimingHud();

 $('gp-skip-pit').hidden=!p.pit||(typeof MP!=='undefined'&&MP.active);$('gp-skip-pit').disabled=!!GP.pitSkip;

 const first=order[0];const rows=order.slice(0,5);if(!rows.some(d=>d.id===0))rows.push(p);const timingHTML='<div class="gp-table-head">'+(qual?'CLASSIFICATION':'RACE ORDER')+'</div>'+rows.map(d=>{const position=order.indexOf(d)+1,time=qual?(Number.isFinite(d.best)?fmt(d.best*1000):'NO TIME'):(d.finished?'FINISHED':d.pit?'PIT':position===1?'LEADER':'+'+Math.max(0,(first.progress-d.progress)/Math.max(20,first.v)).toFixed(1));return '<div class="gp-row '+(d.id===0?'you':'')+'"><b>'+position+'</b><span>'+d.name+'</span><em style="color:'+RaceWeekend.TYRES[d.tyre].colour+'">'+RaceWeekend.TYRES[d.tyre].letter+'</em><small>'+time+'</small></div>'}).join('');

 if(GP.lastTimingHTML!==timingHTML){$('gp-timing').innerHTML=timingHTML;GP.lastTimingHTML=timingHTML}

 hudText('gp-tyre',RaceWeekend.TYRES[p.tyre].name+' · '+Math.round((1-p.wear)*100)+'%');hudText('gp-pit-call',p.pit?'PIT ASSIST':p.requested?'BOX THIS LAP':'P or RB · BOX');hudText('gp-next-tyre','T or LB · '+RaceWeekend.TYRES[GP.pitChoice].name);hudText('gp-strategy-status',qual?'FINISH YOUR LAP AFTER THE FLAG':w.cfg.twoCompounds?(p.used.size>=2?'COMPOUND RULE MET':'USE TWO COMPOUNDS'):'OPEN STRATEGY');$('gp-pit-call').classList.toggle('called',p.requested);}

// Finishing Q2/Q3 after elimination must leave input and paint time available.
async function gpSimulateRemainingQualifying(w,current,yieldFrame,now,onStage){
 while(w.stage<2){
  if(!current())return false;
  w.startQual(w.stage+1);onStage(w.stage);
  let guard=0;
  while(w.phase==='qualifying'){
   const deadline=now()+4;
   do{w.update(.1);if(++guard>600000)throw new Error('Qualifying did not finish');}
   while(w.phase==='qualifying'&&now()<deadline);
   if(w.phase==='qualifying'){await yieldFrame();if(!current())return false;}
  }
  w.events.length=0;
 }
 return current();
}
async function gpCompleteQualifying(w,button){
 if(GP.qualAdvance)return;
 GP.qualAdvance=w;button.disabled=true;
 try{
  const completed=await gpSimulateRemainingQualifying(w,()=>GP.weekend===w&&GP.qualAdvance===w,()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0))),()=>performance.now(),stage=>{button.textContent='Q'+(stage+1)+' · SIMULATING'});
  if(completed)gpResults();
 }catch(error){console.error(error);if(GP.weekend===w){button.disabled=false;button.textContent='COMPLETE QUALIFYING';msg('Could not complete qualifying. Return to the garage.',5000)}}
 finally{if(GP.qualAdvance===w)GP.qualAdvance=false;}
}

function gpResults(retired=false){const w=GP.weekend;if(!w)return;state='results';keys.clear();$('hud').hidden=true;const qual=w.phase==='qualifying-result',order=qual?w.grid.map(id=>w.drivers[id]):w.classification();const position=order.findIndex(d=>d.id===0)+1;let buttons='';if(qual){if(w.cfg.qualifying==='full'&&w.stage<2)buttons='<button class="p" id="gp-next">'+(w.player.active?'NEXT: Q'+(w.stage+2):'COMPLETE QUALIFYING')+'</button>';else buttons='<button class="p" id="gp-to-race">TO THE GRID</button>'}else buttons='<button class="p" id="gp-rematch">RACE AGAIN</button>';

 $('rb').innerHTML='<div class="eyebrow">'+CIRCUIT.name+'</div><h2>'+(qual?'Qualifying':retired?'Retired':'Race result')+'</h2><div class="gp-result-position">'+(w.player.dsq?'DSQ':'P'+position)+'</div><p>'+(qual?'Grid order is set by valid timed laps.':w.player.dsq?'Two different dry compounds were required.':w.player.penalty?'Includes '+w.player.penalty+' seconds in penalties.':'MR 26 · '+w.difficulty.name)+'</p><div class="gp-results-scroll"><table><thead><tr><th>POS</th><th>DRIVER</th><th>'+(qual?'BEST LAP':'TIME')+'</th><th>'+(qual?'STATUS':'STOPS')+'</th></tr></thead><tbody>'+order.map((d,i)=>'<tr class="'+(d.id===0?'you':'')+'"><td>'+(d.dsq?'DSQ':i+1)+'</td><td>'+d.name+'</td><td>'+(qual?fmt(d.best*1000):d.retired?'DNF':d.finished?fmt((d.finishTime+d.penalty)*1000):'RUNNING')+'</td><td>'+(qual?(d.active?'ADVANCED':'ELIMINATED'):d.stops)+'</td></tr>').join('')+'</tbody></table></div>'+buttons+'<button data-ov="menu" id="gp-back">MAIN MENU</button>';show('results');if($('gp-next'))$('gp-next').onclick=()=>{if(w.player.active)startWeekend('qual',true);else gpCompleteQualifying(w,$('gp-next'))};if($('gp-to-race'))$('gp-to-race').onclick=()=>{audioInit();startWeekend('gp',true)};if($('gp-rematch'))$('gp-rematch').onclick=()=>startWeekend('gp');$('gp-back').onclick=clearWeekend;}

$('gp-pit-call').onclick=gpPitRequest;$('gp-next-tyre').onclick=gpCycleTyre;$('gp-skip-pit').onclick=gpSkipPit;

document.addEventListener('click',e=>{const m=e.target.closest('[data-weekend]');if(m){mode=m.dataset.weekend;show('weekend');$('weekend-heading').textContent=mode==='qual'?'QUALIFYING':'RACE'}});

$('gp-start').onclick=()=>{audioInit();refreshGuideSpeeds();startWeekend(mode==='qual'?'qual':'gp')};



const normalWeekendHud=hud;hud=function(){normalWeekendHud();if(GP.weekend){gpTimingHud();gpHud()}};



let lastGpContact=-10;function gpContact(){const w=GP.weekend;if(!w||w.clock-lastGpContact<.4)return;for(const d of w.drivers.slice(1)){if(d.pit||d.finished)continue;let along=RaceWeekend.mod(d.progress-w.player.progress+LEN/2,LEN)-LEN/2;if(Math.abs(along)>5.2)continue;const p=gpTrackPose(d),lateral=(c.x-p.x)*-Math.sin(c.h)+(c.z-p.z)*Math.cos(c.h);if(Math.abs(lateral)>1.65)continue;lastGpContact=w.clock;if(along>0)c.vx=Math.min(c.vx,d.v*.9);else d.v=Math.min(d.v,c.vx*.92);rumble(.25,.5,120);msg('CAR CONTACT',800);break}}



document.addEventListener('click',e=>{if(e.target.closest('[data-ov="menu"]')&&GP.weekend)clearWeekend()});const baseWeekendMenu=$('tomenu').onclick;$('tomenu').onclick=()=>{clearWeekend();baseWeekendMenu()};

