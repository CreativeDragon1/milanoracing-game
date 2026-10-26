// Authoring correction for banked circuits. Build a road-aligned orthonormal
// frame, then keep the car's conservative lower envelope above the surface.
window.filmSurfaceChecks={poses:0,minimumClearance:Infinity,maximumLift:0};
window.fitFilmCarToSurface=function(node,p){
 const f=new T.Vector3(Math.cos(p.h),0,Math.sin(p.h)),r=new T.Vector3(-f.z,0,f.x),hint=Math.floor(p.f);
 const height=(x,z)=>roadHeightAt(x,z,hint),base=height(p.x,p.z);
 f.y=(height(p.x+f.x*1.6,p.z+f.z*1.6)-height(p.x-f.x*1.6,p.z-f.z*1.6))/3.2;
 r.y=(height(p.x+r.x*.65,p.z+r.z*.65)-height(p.x-r.x*.65,p.z-r.z*.65))/1.3;
 f.normalize();const up=new T.Vector3().crossVectors(r,f).normalize();r.crossVectors(f,up).normalize();
 node.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(f,up,r));node.position.set(p.x,base,p.z);
 let minimum=Infinity;
 for(let i=0;i<=8;i++)for(let j=0;j<=4;j++){
  const q=new T.Vector3(-2.85+5.7*i/8,.025,-.806+1.612*j/4).applyQuaternion(node.quaternion).add(node.position);
  minimum=Math.min(minimum,q.y-height(q.x,q.z));
 }
 const lift=Math.max(0,.02-minimum);node.position.y+=lift;
 filmSurfaceChecks.poses++;filmSurfaceChecks.minimumClearance=Math.min(filmSurfaceChecks.minimumClearance,minimum+lift);filmSurfaceChecks.maximumLift=Math.max(filmSurfaceChecks.maximumLift,lift);
};
