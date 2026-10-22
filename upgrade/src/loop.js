// ---- render and simulation loop ----
function resize(){if(!ren)return;ren.setPixelRatio(S.q?1:Math.min((devicePixelRatio||1)*(graphicsPreset==='ultra'?1.25:1),1.75));ren.setSize(innerWidth,innerHeight,false);ren.shadowMap.enabled=!S.q;cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();resizeFX()}
addEventListener('resize',resize);resize();
const cp=new T.Vector3(),lk=new T.Vector3(),lookSmooth=new T.Vector3(),sunFollow=new T.Vector3();let last=performance.now();placeCar(0);$('track-length').textContent=(LEN/1000).toFixed(2)+' KM';
const shadowGroundRotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let previousPose=null,lastHudPaint=0,lastPanelDraw=-Infinity,lastPanelScreen='',lastPanelQuality='',lastShowroomDraw=-Infinity;
function interpolatedPose(){if(snap||state!=='race'||!previousPose||Math.hypot(c.x-previousPose.x,c.z-previousPose.z)>35)return c;const a=clamp(acc/H,0,1),p=previousPose;return {...c,x:p.x+(c.x-p.x)*a,z:p.z+(c.z-p.z)*a,h:p.h+Math.atan2(Math.sin(c.h-p.h),Math.cos(c.h-p.h))*a,vx:p.vx+(c.vx-p.vx)*a};}
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;if(document.hidden){audioUpd();return}pollController(now);if(typeof MP!=='undefined')mpFrame(now,dt);
 const panel=document.body.dataset.screen;
 // Opaque settings need a fresh backdrop only on entry/quality change. Input,
 // audio and network polling continue; driving never uses this render throttle.
 if(window.MilanoReady&&state!=='race'&&state!=='count'&&!['menu','none','count'].includes(panel)){
  if(panel===lastPanelScreen&&graphicsPreset===lastPanelQuality&&now-lastPanelDraw<250){audioUpd(dt);return}lastPanelDraw=now;
 }lastPanelScreen=panel;lastPanelQuality=graphicsPreset;
 if(state==='count'){if(typeof MP!=='undefined'&&MP.active)race.cd=(MP.startAt-(Date.now()+MP.clockOffset))/1000;else race.cd-=dt;if(typeof GP!=='undefined'&&GP.weekend?.phase==='race')$('cdn').innerHTML=Array.from({length:5},(_,i)=>'<i class="start-light '+(race.cd<7.2-i?'on':'')+'"></i>').join('');else $('cdn').textContent=race.cd>0?Math.ceil(race.cd):'GO';if(race.cd<=0){state='race';show('none');msg('GO',1300)}}
 if(state==='race'){acc+=dt;let n=0;while(acc>=H&&n++<12&&state==='race'){previousPose={x:c.x,z:c.z,h:c.h,vx:c.vx};step(H);acc-=H}if(acc>H)acc=0}
 // The slowly orbiting home scene needs 30 fps; racing retains the display rate.
 // Input, countdown, network and CSS motion continue at their existing cadence.
 if(state==='menu'){if(now-lastShowroomDraw<1000/30){audioUpd(dt);return}lastShowroomDraw=now}
 const view=interpolatedPose();
 const showroom=state==='menu',baseY=showroom?groundHeight(0,0):typeof GP!=='undefined'&&GP.weekend?.player.pit?GP.weekend.pitPose(GP.weekend.player).y:roadHeightAt(view.x,view.z,view.idx),pitch=showroom?0:typeof GP!=='undefined'&&GP.weekend?.player.pit?GP.weekend.pitPose(GP.weekend.player).pitch:roadPitchAt(view.x,view.z,view.h,view.idx);if(showroom){car.position.set(0,baseY,0);car.rotation.set(0,0,0,'YXZ')}else{car.position.set(view.x,baseY+(Math.abs(view.d)>trackHalf(view.idx,Math.sign(view.d))&&view.vx>2?Math.sin(view.odo*5)*.009:0),view.z);car.rotation.set(typeof GP!=='undefined'&&GP.weekend?.player.pit?0:-bankAt(view.idx),-view.h,pitch,'YXZ')}
 const spin=showroom?0:view.vx/.37;for(const w of wheels){w.sp.rotation.z=(w.sp.rotation.z-spin*dt)%(Math.PI*2);if(w.front)w.pv.rotation.y=showroom?-.1:-view.st}
 rainLight.material.emissiveIntensity=showroom?.5:inp.b>.1?3:.6;
 const co=Math.cos(view.h),si=Math.sin(view.h),v=view.vx;
 if(showroom){const t=reducedMotion?0:Math.sin(now*.00008)*.16;cp.set(5.9+Math.sin(t)*1.4,1.6,-5.6+Math.cos(t)*.25);lk.set(.7,.55,1.25);cp.y+=baseY;lk.y+=baseY;cam.fov=46;cam.position.copy(cp);lookSmooth.copy(lk);snap=true}
 else{
  const forward=Math.round((8+v*.22)/(LEN/N)),ahead=(view.idx+forward)%N,roadAhead=new T.Vector3(cx[ahead],cy[ahead]+.6,cz[ahead]),headingAhead=Math.atan2(tz[ahead],tx[ahead]);
  const turn=Math.atan2(Math.sin(headingAhead-view.h),Math.cos(headingAhead-view.h)),lookDistance=10+v*.17;
  const fx=view.x+co*lookDistance,fz=view.z+si*lookDistance,blend=clamp(Math.abs(turn)*1.8,.10,.55);
  lk.set(fx*(1-blend)+roadAhead.x*blend,.65,fz*(1-blend)+roadAhead.z*blend);
  if(camMode===0){const distance=6.4+v*.010,side=clamp(turn*1.0,-.65,.65);cp.set(view.x-co*distance-si*side,2.05+v*.0045,view.z-si*distance+co*side)}
  else if(camMode===1){cp.set(view.x+co*2.35,1.0,view.z+si*2.35);lk.set(view.x+co*40,.95,view.z+si*40)}
  else if(camMode===2){cp.set(view.x-co*(10+v*.012),4.4+v*.005,view.z-si*(10+v*.012))}
  else{const side=clamp(turn*8,-5,5);cp.set(view.x-co*14-si*side,24,view.z-si*14+co*side);lk.set(view.x+co*12,.2,view.z+si*12)}
  const inPit=typeof GP!=='undefined'&&GP.weekend?.player.pit;if(inPit){const dist=camMode===1?2.35:camMode===2?-10:camMode===3?-14:-6.4;cp.set(view.x+co*dist,camMode===1?1:camMode===3?20:camMode===2?4.4:2.8,view.z+si*dist);lk.set(view.x+co*12,.7,view.z+si*12)}
  const cameraRoad=prog(cp.x,cp.z,view.idx),limit=Math.abs(trackBarrier(cameraRoad.i,cameraRoad.d>0?1:-1))-.8;
  if(!inPit&&camMode!==3&&Math.abs(cameraRoad.d)>limit){const move=Math.sign(cameraRoad.d)*limit-cameraRoad.d;cp.x+=nx[cameraRoad.i]*move;cp.z+=nz[cameraRoad.i]*move;}
  const cameraBase=inPit?baseY:roadHeightAt(cp.x,cp.z,view.idx);cp.y+=cameraBase;lk.y+=inPit?baseY:roadHeightAt(lk.x,lk.z,view.idx);
  if(!inPit&&camMode!==1)cp.y=Math.max(cp.y,groundHeight(cp.x,cp.z)+1.0,cameraBase+1.25);
  if(!inPit&&camMode!==3){for(let j=0;j<5&&buildingAt(cp.x,cp.z,.65);j++){cp.x+=(view.x-cp.x)*.22;cp.z+=(view.z-cp.z)*.22;cp.y=Math.max(cp.y,roadHeightAt(cp.x,cp.z,view.idx)+1.3)}}
  if(CIRCUIT.features?.tunnel&&camMode!==3){const [a,b]=CIRCUIT.features.tunnel;if(cameraRoad.i>=a&&cameraRoad.i<=b)cp.y=Math.min(cp.y,cameraBase+4.5)}
  if(snap||camMode===1){cam.position.copy(cp);lookSmooth.copy(lk)}else{cam.position.lerp(cp,1-Math.exp(-dt*(camMode===3?4.5:10)));lookSmooth.lerp(lk,1-Math.exp(-dt*6.5))}snap=false;
  cam.fov=camMode===3?51:camMode===2?55+v*.045:camMode===1?76:61+v*.055;
 }

 cam.lookAt(lookSmooth);cam.updateProjectionMatrix();updateVegetation(now);
 const px=car.position.x,pz=car.position.z;sun.position.copy(sunDirection).multiplyScalar(230).add(sunFollow.set(px,baseY,pz));sun.target.position.set(px,baseY,pz);sun.target.updateMatrixWorld();contactShadow.position.set(px,baseY+.049,pz);contactShadow.quaternion.copy(car.quaternion).multiply(shadowGroundRotation);
 windTime.value=reducedMotion?0:now*.001;sky.position.copy(cam.position);waterNormals.offset.set(windTime.value*.004,windTime.value*.002);
 if(msgT&&now>msgT){$('msg').textContent='';msgT=0}
 if((state==='race'||state==='count')&&now-lastHudPaint>=80){lastHudPaint=now;hud();$('camera-label').textContent=['CHASE','NOSE','WIDE CHASE','AERIAL'][camMode];$('drivekeys').textContent=activePad!==null?'Y or △ · Camera   X or □ · Reset   Menu · Pause':'C · Camera   R · Reset   Esc · Pause'}
 if(typeof GP!=='undefined')gpRender();nightLight.position.set(view.x,baseY+14,view.z);updateRacingLine();if(typeof MP!=='undefined')mpHud();audioUpd(dt);renderGame()}
if(ren)show('menu');requestAnimationFrame(frame);
