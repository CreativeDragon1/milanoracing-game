// Shared offline choreography. Every transform is baked and clearance-checked.
function filmApplyPose(node,p){
 node.position.fromArray(p.position);
 const b=p.basis;node.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(...b.slice(0,3)),new T.Vector3(...b.slice(3,6)),new T.Vector3(...b.slice(6,9))));
}
function filmScreenBox(node,camera){
 const lo=new T.Vector2(Infinity,Infinity),hi=new T.Vector2(-Infinity,-Infinity);
 for(const x of[-2.85,2.85])for(const y of[0,1.5])for(const z of[-.85,.85]){
  const q=new T.Vector3(x,y,z).applyMatrix4(node.matrixWorld).project(camera);
  if(q.z>1)return new T.Vector4(3,3,.01,.01);
  lo.min(new T.Vector2(q.x*.5+.5,q.y*.5+.5));hi.max(new T.Vector2(q.x*.5+.5,q.y*.5+.5));
 }
 const c=lo.clone().add(hi).multiplyScalar(.5),r=hi.sub(lo).multiplyScalar(.65);
 return new T.Vector4(c.x,c.y,Math.max(.005,r.x),Math.max(.005,r.y));
}
function filmPrepareCamera(motion,aspect){
 const probe=new T.PerspectiveCamera(55,aspect,.35,8000),point=new T.Vector3();
 let fit=Math.tan(T.MathUtils.degToRad(aspect>1?57:78)/2),hits=0;
 for(const row of motion.frames.slice(120)){
  probe.position.fromArray(row.camera);probe.lookAt(new T.Vector3(...row.focus));probe.updateMatrixWorld();
  const p=row.cars[0],b=p.basis;
  for(const x of[-2.85,2.85])for(const y of[0,1.8])for(const z of[-.95,.95]){
   point.set(p.position[0]+b[0]*x+b[3]*y+b[6]*z,p.position[1]+b[1]*x+b[4]*y+b[7]*z,p.position[2]+b[2]*x+b[5]*y+b[8]*z).applyMatrix4(probe.matrixWorldInverse);
   if(point.z>=-.1)throw Error('Camera crossed hero car');
   fit=Math.max(fit,Math.abs(point.y)/(-point.z*.84),Math.abs(point.x)/(-point.z*aspect*.84));
  }
  if(buildingAt(row.camera[0],row.camera[2],.55))hits++;
 }
 const fov=T.MathUtils.radToDeg(2*Math.atan(fit));
 if(fov>100)throw Error('Shot framing is excessively wide: '+fov);
 return{fov,buildingFootprintSamples:hits};
}
