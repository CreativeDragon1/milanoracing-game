// Shared geometry and 13 instanced draws for an articulated ten-person team.
// The animation reads service progress; it never changes the stop duration.
const crewRoot=new T.Group();crewRoot.name='Working pit crew';pitBox.add(crewRoot);
const crew=[crewRoot],crewActors=[],crewParts=[],crewBatches=new Map();
const crewGeo={round:new T.SphereGeometry(1,16,12),limb:new T.CylinderGeometry(1,.86,1,12),box:new T.BoxGeometry(1,1,1),tyre:new T.TorusGeometry(.265,.105,10,24),visor:new T.SphereGeometry(1,20,8,Math.PI*.20,Math.PI*.60,Math.PI*.32,Math.PI*.29)};
crewGeo.torso=new T.LatheGeometry([new T.Vector2(.70,-1),new T.Vector2(.78,-.75),new T.Vector2(.92,.10),new T.Vector2(1,.54),new T.Vector2(.76,.84),new T.Vector2(.38,1)],20);
const crewPaint={suit:M(0x162332,.02,.87),panel:M(0x102c75,.05,.74),orange:M(0xff7a00,.12,.42),black:M(0x101319,.1,.64),visor:M(0x26465e,.8,.15),metal:M(0x667484,.8,.27),white:M(0xe4e7ed,.05,.48)};
function crewPart(parent,name,shape,paint){const o=new T.Object3D();o.name=name;parent.add(o);o.userData.crewShape=shape;o.userData.crewPaint=paint;crewParts.push(o);return o}
const crewVector=new T.Vector3(),crewUp=new T.Vector3(0,1,0),crewLocalMatrix=new T.Matrix4(),crewInverse=new T.Matrix4();
function crewShape(o,x,y,z,sx,sy,sz,rx=0){o.position.set(x,y,z);o.scale.set(Math.max(.0001,sx),Math.max(.0001,sy),Math.max(.0001,sz));o.rotation.set(rx,0,0)}
function crewBone(o,a,b,r){o.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);crewVector.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);o.scale.set(r,crewVector.length(),r);o.quaternion.setFromUnitVectors(crewUp,crewVector.normalize())}
for(const side of[-1,1])for(const axle of[-1,1])for(const role of['gun','tyre']){
 const root=new T.Group();crewRoot.add(root);root.rotation.y=side>0?Math.PI:0;
 const actor={root,side,axle,role,parts:{}};crewActors.push(actor);
 for(const [name,shape,paint] of [['torso','torso','suit'],['chest','round','panel'],['hips','round','suit'],['collar','round','black'],['helmet','round','black'],['chin','round','black'],['visor','visor','visor'],['stripe','round','orange'],['belt','round','black'],['tool','limb','metal'],['grip','box','black'],['wheel','tyre','black'],['hub','round','metal']])actor.parts[name]=crewPart(root,role+' '+name,shape,paint);
 for(const sign of[-1,1])for(const [name,shape,paint] of [['thigh','limb','suit'],['shin','limb','suit'],['boot','round','black'],['knee','round','black'],['upper','limb','suit'],['fore','limb','suit'],['glove','round','black'],['shoulder','round','orange']])actor.parts[name+sign]=crewPart(root,role+' '+name+sign,shape,paint);
}
const crewJacks=[];
for(const side of[-1,1]){
 const root=new T.Group();root.position.x=side*3.6;root.rotation.y=side<0?Math.PI/2:-Math.PI/2;crewRoot.add(root);
 const actor={root,side,axle:side,role:'jack',parts:{}};crewActors.push(actor);
 for(const [name,shape,paint]of[['torso','torso','suit'],['chest','round','panel'],['hips','round','suit'],['collar','round','black'],['helmet','round','black'],['chin','round','black'],['visor','visor','visor'],['stripe','round','orange'],['belt','round','black'],['tool','limb','metal'],['grip','box','black'],['wheel','tyre','black'],['hub','round','metal']])actor.parts[name]=crewPart(root,'jack '+name,shape,paint);
 for(const sign of[-1,1])for(const[name,shape,paint]of[['thigh','limb','suit'],['shin','limb','suit'],['boot','round','black'],['knee','round','black'],['upper','limb','suit'],['fore','limb','suit'],['glove','round','black'],['shoulder','round','orange']])actor.parts[name+sign]=crewPart(root,'jack '+name+sign,shape,paint);
 const jack={root,base:crewPart(root,'jack frame','box','metal'),handle:crewPart(root,'jack lever','limb','orange'),pad:crewPart(root,'jack saddle','box','black')};crewJacks.push(jack);
}
function pitServiceLift(phase){return .075*smoothCrew(0,.12,phase)*(1-smoothCrew(.86,1,phase))}
function smoothCrew(a,b,t){t=clamp((t-a)/(b-a),0,1);return t*t*(3-2*t)}
let crewPoseUpdates=0;
function posePitCrew(ready,phase){
 crewPoseUpdates++;
 const remove=smoothCrew(.20,.42,phase),fit=smoothCrew(.50,.68,phase),reach=remove*(1-fit),lift=pitServiceLift(phase);
 for(const a of crewActors){
  const p=a.parts,jack=a.role==='jack',handler=a.role==='tyre';
  if(jack){const engaged=ready*(a.side<0?smoothCrew(0,.065,phase):1);a.root.position.set(a.side*(3.9-engaged*.65),0,(a.side<0?2.6:-2.6)*(1-engaged))}
  else a.root.position.set((a.axle>0?1.538:-1.685)+(handler?a.axle*(.63-.28*fit*ready):0),0,a.side*((handler?3.35:3.0)-ready*(handler?1.05+.80*fit:1.40)));
  const crouch=ready*(jack?.20:handler?.34:.62),hip=.89-crouch*.65,neck=1.45-crouch,forward=ready*(jack?.14:.24);
  crewShape(p.hips,0,hip,0,.21,.18,.145);crewShape(p.belt,0,hip+.07,.005,.216,.035,.151);
  crewShape(p.torso,0,(hip+neck)/2,forward*.45,.255,(neck-hip)*.52,.16,-ready*.16);
  crewShape(p.chest,0,(hip+neck)/2+.035,.13+forward*.45,.15,(neck-hip)*.30,.026,-ready*.16);
  crewShape(p.collar,0,neck-.03,forward*.88,.11,.055,.105);
  crewShape(p.helmet,0,neck+.17,forward,.148,.178,.168,-ready*.12);
  crewShape(p.chin,0,neck+.08,.11+forward,.136,.065,.085);
  crewShape(p.visor,0,neck+.18,forward,.152,.18,.176,-ready*.12);
  crewShape(p.stripe,0,neck+.29,forward-.045,.022,.057,.147,-ready*.12);
  for(const s of[-1,1]){
   const knee=[s*.16,ready>.5&&!jack?.27:hip*.52,.12+ready*(s>0?.28:-.09)],ankle=[s*.17,.12,s>0?.16:-ready*.30],shoulder=[s*.24,neck-.12,forward*.65];
   const handY=jack?.76:handler?.43+lift:.38+lift;
   const hand=[s*(handler?.25:.13)+(handler?a.side*a.axle*.35*fit*ready:0),(.99*(1-ready)+handY*ready),.24+ready*((handler?.31+.32*fit:.48)-reach*.28)];
   const elbow=[s*.32,(shoulder[1]+hand[1])*.5,.13+ready*.21];
   crewBone(p['thigh'+s],[s*.13,hip-.03,0],knee,.10);crewBone(p['shin'+s],knee,ankle,.082);
   crewShape(p['boot'+s],ankle[0],.07,ankle[2]+.075,.10,.075,.18);crewShape(p['knee'+s],knee[0],knee[1],knee[2]+.055,.10,.13,.07);
   crewBone(p['upper'+s],shoulder,elbow,.083);crewBone(p['fore'+s],elbow,hand,.066);
   crewShape(p['glove'+s],hand[0],hand[1],hand[2],.068,.052,.085);crewShape(p['shoulder'+s],shoulder[0],shoulder[1]-.04,shoulder[2],.087,.032,.088);
  }
  crewShape(p.tool,0,.99*(1-ready)+(.38+lift)*ready,.31+ready*(.45-reach*.28),.055,handler||jack?0:.32,.055,Math.PI/2);
  crewShape(p.grip,0,.91*(1-ready)+(.28+lift)*ready,.31+ready*(.40-reach*.28),handler||jack?0:.08,.17,.07);
  const wheelVisible=handler&&(phase<.68||phase>.86)||a.role==='gun'&&phase>.25&&phase<.48;
  const wheelY=.99*(1-ready)+(.373+lift)*ready,wheelZ=handler?.31+ready*(.24+fit*.32):.97-remove*.65,wheelX=handler?a.side*a.axle*.35*fit*ready:0;
  crewShape(p.wheel,wheelX,wheelY,wheelZ,wheelVisible?1:0,wheelVisible?1:0,wheelVisible?1:0);crewShape(p.hub,wheelX,wheelY,wheelZ,wheelVisible?.16:0,wheelVisible?.16:0,wheelVisible?.07:0);
 }
 for(const j of crewJacks){crewShape(j.base,0,.10,.64,.50,.10,.85);crewShape(j.pad,0,.14+lift,1.03,.36,.08,.24);crewBone(j.handle,[0,.12,.80],[0,.95-ready*.16,.25],.033)}
 crewRoot.updateMatrixWorld(true);crewInverse.copy(crewRoot.matrixWorld).invert();
 for(const batch of crewBatches.values()){for(let i=0;i<batch.parts.length;i++){const part=batch.parts[i];crewLocalMatrix.copy(part.matrixWorld).premultiply(crewInverse);batch.mesh.setMatrixAt(i,crewLocalMatrix)}batch.mesh.instanceMatrix.needsUpdate=true}
}
for(const part of crewParts){const key=part.userData.crewShape+':'+part.userData.crewPaint;if(!crewBatches.has(key))crewBatches.set(key,{parts:[]});crewBatches.get(key).parts.push(part)}
for(const[key,b]of crewBatches){const[shape,paint]=key.split(':');b.mesh=new T.InstancedMesh(crewGeo[shape],crewPaint[paint],b.parts.length);b.mesh.name='Pit crew '+key;b.mesh.castShadow=b.mesh.receiveShadow=true;b.mesh.frustumCulled=false;b.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);crewRoot.add(b.mesh)}
let crewLastTime=0,crewReady=0,crewPhase=0,crewLift=0,crewPoseReady=NaN,crewPosePhase=NaN;
function animatePitCrew(w){
 const now=performance.now(),dt=Math.min(.05,Math.max(0,(now-crewLastTime)/1000));crewLastTime=now;
 const pit=w?.player.pit,near=!!pit&&!pit.releaseOnly&&Math.abs(pit.s-PIT.s[PIT.box])<14;
 const service=near&&pit.hold>0,phase=service?clamp((pit.hold-(pit.service?0:w.player.penalty||0))/2.5,0,1):0;
 const readyTarget=near&&!pit.service?1:0;
 crewReady+=(readyTarget-crewReady)*(1-Math.exp(-dt*6));if(Math.abs(crewReady-readyTarget)<.0001)crewReady=readyTarget;crewPhase=phase;
 crewRoot.visible=Math.hypot(c.x-pitBox.position.x,c.z-pitBox.position.z)<110;
 if(crewRoot.visible&&(crewReady!==crewPoseReady||phase!==crewPosePhase)){posePitCrew(crewReady,phase);crewPoseReady=crewReady;crewPosePhase=phase}
 crewLift=service?pitServiceLift(phase):0;
 setPitWheelVisibility(!(service&&phase>.30&&phase<.67));
 if(crewLift)car.position.y+=crewLift;
 updatePitSounds(phase,!!service,!!GP.pitSkip||state!=='race'||document.hidden||!crewRoot.visible);
}
posePitCrew(0,0);
