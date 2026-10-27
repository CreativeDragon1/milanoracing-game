// Offline local lap-time optimization; online speed solution uses shared vehicle forces.
const OPTIMIZED_LINE=__OPTIMIZED_LINE__;
const racingGuide={x:OPTIMIZED_LINE.x,z:OPTIMIZED_LINE.z,offset:OPTIMIZED_LINE.offset,curvature:OPTIMIZED_LINE.curvature,speed:[],limitSpeed:[],corner:[],setup:'',report:null};
const wrapLine=i=>(i%N+N)%N;
function refreshGuideSpeeds(){
 const key=[S.grip,S.brake,S.df,S.steer].join(':');if(key===racingGuide.setup)return;racingGuide.setup=key;
 const solved=solveSpeedProfile(racingGuide.x,racingGuide.z,racingGuide.curvature,S,cy.map((y,i)=>surfaceHeight(i,racingGuide.offset[i])));racingGuide.report=solved;
 racingGuide.limitSpeed=solved.speed;
 // Race envelope: no compounded safe-driving speed reductions.
 racingGuide.speed=solved.speed.map(v=>v*VEH.driverSpeedFactor);
 racingGuide.corner=racingGuide.curvature.map((_,i)=>{for(let j=-8;j<=24;j++)if(Math.abs(racingGuide.curvature[wrapLine(i+j)])>.0025)return true;return false});
}
refreshGuideSpeeds();
// Two instanced meshes provide high-contrast chevrons without hundreds of draw calls.
const arrowGeometry=new T.BufferGeometry();arrowGeometry.setAttribute('position',new T.Float32BufferAttribute([
 -1,0,-.65, -.20,0,-.65, .95,0,0, -1,0,-.65, .95,0,0, .12,0,0,
 -1,0,.65, .12,0,0, .95,0,0, -1,0,.65, .95,0,0, -.20,0,.65
],3));arrowGeometry.computeVertexNormals();
const guideArrows=new T.InstancedMesh(arrowGeometry,new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide,transparent:true,opacity:1,depthWrite:false,toneMapped:false}),52);
const guideOutline=new T.InstancedMesh(arrowGeometry,new T.MeshBasicMaterial({color:0x10191e,side:T.DoubleSide,transparent:true,opacity:.82,depthWrite:false,toneMapped:false}),52);
guideArrows.frustumCulled=guideOutline.frustumCulled=false;guideArrows.renderOrder=3;guideOutline.renderOrder=2;scene.add(guideOutline,guideArrows);
const guideDummy=new T.Object3D(),guideColours=[new T.Color(0x57efa5).convertSRGBToLinear(),new T.Color(0xffc34a).convertSRGBToLinear(),new T.Color(0xff5049).convertSRGBToLinear()];
function guideDemand(i,v){
 const solved=racingGuide.report,j=wrapLine(i+1),v0=racingGuide.speed[i],v1=racingGuide.speed[j],ds=solved.ds[i];
 const feed=(v1*v1-v0*v0)/(2*ds)*Math.min(1,v*v/Math.max(1,v0*v0)),correction=(v0*v0-v*v)/(2*Math.max(10,v*.22));
 const e=vehicleEnvelope(v,S,1,solved.vertical.grade[i],solved.vertical.curvature[i],bankAt(i)),limit=planningLimits(v,racingGuide.curvature[i],S,solved.vertical.grade[i],solved.vertical.curvature[i],bankAt(i));
 const coast=e.drag/VEH.mass*e.cosSlope+e.slopeGravity,required=feed+correction;
 const brake=clamp((-required-coast)/Math.max(1,limit.deceleration-coast),0,1),throttle=clamp((required+coast)/Math.max(1,limit.acceleration+coast),0,1);
 return {level:brake>.045?2:throttle<.85?1:0,brake,throttle,target:v0,required,feed,coast};
}
function guideLevel(speed,target){return speed>target+1?2:speed>target-2?1:0}
let lastGuideLevel=0,guideLevelTime=0;
function syncGuideControls(){const mode=Math.round(S.line);$('race-line').value=mode;$('line-pause').textContent='Racing line: '+['Off','Corners','Full'][mode]}
$('race-line').onchange=e=>{S.line=clamp(Math.round(+e.target.value),0,2);saveS();syncGuideControls()};
function cycleRacingLine(){S.line=(Math.round(S.line)+1)%3;saveS();syncGuideControls()}
$('line-pause').onclick=cycleRacingLine;syncGuideControls();
addEventListener('keydown',e=>{if(e.code==='KeyL'&&!e.repeat&&(state==='race'||state==='pause')){e.preventDefault();cycleRacingLine()}});
function updateRacingLine(){
 const mode=Math.round(S.line),visible=!(typeof GP!=='undefined'&&GP.weekend?.player.pit)&&mode>0&&(state==='race'||state==='count'||state==='pause');guideArrows.visible=guideOutline.visible=visible;$('line-cue').hidden=!visible;if(!visible)return;
 refreshGuideSpeeds();
 for(let n=0;n<52;n++){
  const i=wrapLine(c.idx+n),a=wrapLine(i-1),b=wrapLine(i+1),active=mode===2||racingGuide.corner[i];
  guideDummy.position.set(racingGuide.x[i],surfaceHeight(i,racingGuide.offset[i])+.084,racingGuide.z[i]);guideDummy.rotation.set(-bankAt(i),-Math.atan2(racingGuide.z[b]-racingGuide.z[a],racingGuide.x[b]-racingGuide.x[a]),Math.atan(racingGuide.report.vertical.grade[i]),'YXZ');
  const fade=n>44?(52-n)/8:1;guideDummy.scale.set(active?fade:0,1,active?fade:0);guideDummy.updateMatrix();guideArrows.setMatrixAt(n,guideDummy.matrix);guideArrows.setColorAt(n,guideColours[guideDemand(i,n<3?c.vx:racingGuide.speed[i]).level]);
  guideDummy.position.y=surfaceHeight(i,racingGuide.offset[i])+.079;guideDummy.scale.x*=1.13;guideDummy.scale.z*=1.35;guideDummy.updateMatrix();guideOutline.setMatrixAt(n,guideDummy.matrix);
 }
 guideArrows.instanceMatrix.needsUpdate=guideOutline.instanceMatrix.needsUpdate=true;guideArrows.instanceColor.needsUpdate=true;
 const i=wrapLine(c.idx+Math.max(0,Math.round(c.vx*.16/(LEN/N)))),demand=guideDemand(i,c.vx),inCorner=mode===2||racingGuide.corner[i];
 const now=performance.now();if(demand.level!==lastGuideLevel&&now-guideLevelTime>90){lastGuideLevel=demand.level;guideLevelTime=now}
 const level=lastGuideLevel;$('line-cue').hidden=!inCorner;$('line-action').textContent=level===2?'BRAKE '+Math.round(demand.brake*100)+'%':level===1?(demand.throttle>.08?'THROTTLE '+Math.round(demand.throttle*100)+'%':'LIFT'):'FULL THROTTLE';$('line-cue').dataset.level=level;$('line-speed').textContent=Math.round(demand.target*3.6)+' KM/H';
}
