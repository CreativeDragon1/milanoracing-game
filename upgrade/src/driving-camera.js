// A car-centred driving view. Heading comes only from the interpolated car;
// road curvature, steering input and speed never pan or zoom the camera.
const drivingViews=Object.freeze([
 Object.freeze({distance:6.8,height:2.45,look:14,aim:.85,fov:63}),
 Object.freeze({distance:-2.35,height:1,look:40,aim:.95,fov:76}),
 Object.freeze({distance:10.5,height:4.4,look:14,aim:.85,fov:58}),
 Object.freeze({distance:14,height:24,look:12,aim:.2,fov:51})
]);
const drivingRig={mode:-1,distance:0,lift:0,x:NaN,z:NaN};
function drivingCameraClear(view,co,si,distance,inPit,baseY,height){
 const x=view.x-co*distance,z=view.z-si*distance;
 if(inPit){
  const p=pitCameraSurface(x,z,GP.weekend.player.pit.s);
  return Math.abs(p.offset)<=PIT.width/2-.65;
 }
 const p=prog(x,z,view.idx),edge=Math.abs(trackBarrier(p.i,p.d>=0?1:-1))-.4;
 if(Math.abs(p.d)>edge||buildingAt(x,z,.65))return false;
 // Beside the road, a steep bank is an obstruction to the boom, not a reason
 // to lift the whole view away from the car.
 return Math.abs(p.d)<=trackHalf(p.i,p.d>=0?1:-1)+.4||groundHeight(x,z)+1<=baseY+height;
}
function updateDrivingCamera(view,baseY,dt){
 const mode=drivingViews[camMode]?camMode:0,style=drivingViews[mode],co=Math.cos(view.h),si=Math.sin(view.h);
 const inPit=typeof GP!=='undefined'&&!!GP.weekend?.player.pit;
 const tunnel=inPit&&PIT.tunnel?pitCameraTunnelWeight(GP.weekend.player.pit.s):0;
 const reset=snap||drivingRig.mode!==mode||!Number.isFinite(drivingRig.x)||Math.hypot(view.x-drivingRig.x,view.z-drivingRig.z)>35;
 let distance=style.distance,height=style.height;
 // High viewpoints lower gradually before a pit tunnel. The normal chase
 // view already fits, so it keeps the same framing through pit handovers.
 if(tunnel&&mode!==1){distance+=(Math.min(distance,6.8)-distance)*tunnel;height+=(Math.min(height,2.6)-height)*tunnel;}
 const framingDistance=distance;
 if(mode!==1&&(mode!==3||tunnel)){
  // Sweep the boom through the local road corridor, not the whole render scene.
  // Pull in along the car axis instead of pushing the camera sideways.
  const steps=Math.ceil(distance/1.5);let safe=0;
  for(let i=1;i<=steps;i++){
   const candidate=distance*i/steps;
   if(!drivingCameraClear(view,co,si,candidate,inPit,baseY,height)){
    let lo=safe,hi=candidate;
    for(let j=0;j<5;j++){const mid=(lo+hi)/2;if(drivingCameraClear(view,co,si,mid,inPit,baseY,height))lo=mid;else hi=mid;}
    distance=lo;break;
   }
   safe=candidate;
  }
 }
 // Safety retracts immediately; recovery eases out without a lateral orbit.
 const ease=1-Math.exp(-6*Math.max(0,dt));
 drivingRig.distance=reset?distance:Math.min(distance,drivingRig.distance+(distance-drivingRig.distance)*ease);
 cp.set(view.x-co*drivingRig.distance,baseY+height,view.z-si*drivingRig.distance);
 const floor=inPit?pitCameraSurface(cp.x,cp.z,GP.weekend.player.pit.s).y:roadHeightAt(cp.x,cp.z,view.idx);
 // On a road deck, use that deck rather than the background terrain field.
 // The latter may describe the hill/other level above a tunnel or underpass.
 const road=inPit?null:prog(cp.x,cp.z,view.idx);
 const onRoad=road&&Math.abs(road.d)<=trackHalf(road.i,road.d>=0?1:-1)+.4;
 const minimum=mode===1?floor+1:inPit||onRoad&&mode!==3?floor+1.25:Math.max(floor+1.25,groundHeight(cp.x,cp.z)+1);
 const lift=Math.max(0,minimum-cp.y);
 drivingRig.lift=reset?lift:Math.max(lift,drivingRig.lift+(lift-drivingRig.lift)*ease);
 cp.y+=drivingRig.lift;
 lk.set(view.x+co*style.look,baseY+style.aim+drivingRig.lift,view.z+si*style.look);
 // Preserve the viewing pitch while retracting the boom for a wall/building.
 // Tunnel lowering is intentionally shared with the look target's framing.
 const pitch=(height-style.aim)/(framingDistance+style.look);
 lk.y=cp.y-(drivingRig.distance+style.look)*pitch;
 if(inPit&&PIT.tunnel){
  const p=pitCameraSurface(cp.x,cp.z,GP.weekend.player.pit.s),weight=pitCameraTunnelWeight(p.s);
  if(weight){const ceiling=p.y+PIT.tunnel.clearance-.75,drop=Math.max(0,cp.y-ceiling)*weight;cp.y-=drop;lk.y-=drop;}
 }
 if(!inPit&&CIRCUIT.features?.tunnel&&mode!==3){
  const p=prog(cp.x,cp.z,view.idx),[a,b]=CIRCUIT.features.tunnel;
  if(p.i>=a&&p.i<=b){const drop=Math.max(0,cp.y-floor-4.5);cp.y-=drop;lk.y-=drop;}
 }
 // Both endpoints use the SAME car pose. Separate position/aim filters used
 // to make the car drift across the image during otherwise steady turns.
 cam.position.copy(cp);lookSmooth.copy(lk);cam.up.set(0,1,0);cam.fov=style.fov;
 drivingRig.mode=mode;drivingRig.x=view.x;drivingRig.z=view.z;snap=false;
}
