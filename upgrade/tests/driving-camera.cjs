const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),T=require('../vendor/work/three.min.js');
const source=fs.readFileSync('upgrade/src/driving-camera.js','utf8');
function make(){const m={Math,Number,T,cp:new T.Vector3(),lk:new T.Vector3(),lookSmooth:new T.Vector3(),cam:new T.PerspectiveCamera(),camMode:0,snap:true,CIRCUIT:{},prog:()=>({i:0,d:0}),trackHalf:()=>50,trackBarrier:()=>10000,buildingAt:()=>false,roadHeightAt:()=>0,groundHeight:()=>0};vm.createContext(m);vm.runInContext(source+';this.styles=drivingViews;this.rig=drivingRig;',m);return m}
const reports=[];
for(const hz of [30,60,120,144])for(const mode of [0,1,2,3]){
 const m=make();m.camMode=mode;let maxCentre=0,maxYawError=0,maxDistanceError=0,previous=null,maxStep=0;
 for(let frame=0;frame<hz*8;frame++){
  const t=frame/hz,h=t*.7,view={x:30*Math.sin(h),z:30*(1-Math.cos(h)),h,vx:50+45*Math.sin(t),st:Math.sin(t*5),idx:0};
  const saved=JSON.stringify(view);m.updateDrivingCamera(view,0,1/hz);assert.equal(JSON.stringify(view),saved,'camera must not change vehicle state');
  const co=Math.cos(h),si=Math.sin(h),dx=m.cam.position.x-view.x,dz=m.cam.position.z-view.z;
  maxCentre=Math.max(maxCentre,Math.abs(-si*dx+co*dz));maxDistanceError=Math.max(maxDistanceError,Math.abs(-(co*dx+si*dz)-m.styles[mode].distance));
  const aim=m.lookSmooth.clone().sub(m.cam.position),yaw=Math.atan2(aim.z,aim.x);maxYawError=Math.max(maxYawError,Math.abs(Math.atan2(Math.sin(yaw-h),Math.cos(yaw-h))));
  assert.equal(m.cam.fov,m.styles[mode].fov);assert.deepEqual(m.cam.up.toArray(),[0,1,0]);
  if(previous)maxStep=Math.max(maxStep,m.cam.position.distanceTo(previous));previous=m.cam.position.clone();
 }
 assert(maxCentre<1e-10&&maxYawError<1e-10&&maxDistanceError<1e-10,'fixed framing through turns, speed changes and heading wrap');
 reports.push({hz,mode,maxCentre,maxYawError,maxDistanceError,maxStep});
}
// Obstacles retract along the same viewing axis, then ease back out. They do
// not introduce a side orbit, change zoom or steer the car.
const m=make(),view={x:0,z:0,h:0,vx:40,idx:0};m.updateDrivingCamera(view,0,1/60);
m.buildingAt=x=>x< -4; m.updateDrivingCamera(view,0,1/60);assert(m.cam.position.x>=-4&&m.cam.position.x< -3.8);assert.equal(m.cam.position.z,0);assert.equal(m.lookSmooth.z,0);
const pitch=Math.atan2(m.lookSmooth.y-m.cam.position.y,m.lookSmooth.x-m.cam.position.x),originalPitch=Math.atan2(.85-2.45,14+6.8);assert(Math.abs(pitch-originalPitch)<1e-12);
m.buildingAt=()=>false;let last=m.rig.distance;for(let i=0;i<120;i++){m.updateDrivingCamera(view,0,1/60);assert(m.rig.distance>=last&&m.rig.distance-last<.3);last=m.rig.distance}assert(Math.abs(last-6.8)<.001);
// A raised road behind the car lifts the entire view without pitching it.
m.roadHeightAt=()=>5;m.updateDrivingCamera(view,0,1/60);assert(m.cam.position.y>=6.25);assert(Math.abs(Math.atan2(m.lookSmooth.y-m.cam.position.y,m.lookSmooth.x-m.cam.position.x)-originalPitch)<1e-12);
// Resets/mode changes must not inherit an old obstacle offset or camera lag.
m.roadHeightAt=()=>0;m.snap=true;view.x=500;view.h=Math.PI;m.updateDrivingCamera(view,0,1/60);assert.equal(m.rig.distance,6.8);assert.equal(m.rig.lift,0);
m.groundHeight=()=>100;m.updateDrivingCamera(view,0,1/60);assert.equal(m.rig.lift,0,'background terrain above an underpass must not move a road-level camera');assert.equal(m.cam.position.y,2.45);
const result={passed:true,sourceSHA256:require('crypto').createHash('sha256').update(source).digest('hex'),reports,scope:'Deterministic camera framing, speed independence, heading wrap, collision retraction, slope clearance and resets. No physical-device comfort claim.'};
fs.writeFileSync('upgrade/qa/driving-camera.json',JSON.stringify(result,null,2));console.log('Steady camera: four views at 30/60/120/144 Hz, obstacles, slope clearance and resets passed.');
