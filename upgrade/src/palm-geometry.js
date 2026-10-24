// Date-palm silhouettes: tapered ringed stems and arching pinnate fronds.
// Shared meshes keep each planted avenue to spatially culled instance batches.
function buildPalmGeometry(coarse=false){
 const trunk=new T.CylinderGeometry(.21,.38,1,12,48),p=trunk.attributes.position;
 for(let i=0;i<p.count;i++){const y=p.getY(i)+.5,r=1+.065*Math.cos(y*24*Math.PI*2);p.setXYZ(i,p.getX(i)*r+Math.sin(y*2)*.035,p.getY(i),p.getZ(i)*r)}trunk.computeVertexNormals();
 const P=[],UV=[],C=[],idx=[],base=linear(0x557c35),tip=linear(0x82904a);
 function vertex(v,u,w,c){P.push(v.x,v.y,v.z);UV.push(u,w);C.push(c.r,c.g,c.b)}
 function leafQuad(a,b,c,d,u,v,color){const k=P.length/3;vertex(a,0,u,color);vertex(b,1,u,color);vertex(c,0,v,color);vertex(d,1,v,color);idx.push(k,k+2,k+1,k+1,k+2,k+3)}
 for(let f=0;f<27;f++){
  const ring=Math.floor(f/9),angle=f*2.39996323+Math.sin(f*4.71)*.1,length=(ring===0?2.25:ring===1?3.1:3.55)*(1+Math.sin(f*7.3)*.09),raise=[1.9,1.15,.35][ring],drop=[.15,1.15,2.1][ring]*(1+Math.sin(f*3.1)*.12);
  const outward=new T.Vector3(Math.cos(angle),0,Math.sin(angle)),side=new T.Vector3(-Math.sin(angle),0,Math.cos(angle));
  const at=u=>outward.clone().multiplyScalar(.13+u*length).add(new T.Vector3(0,raise*Math.sin(u*Math.PI*.75)-drop*u*u+.12,0));
  // The central rachis is a narrow folded ribbon, visible from both sides.
  for(let j=0;j<18;j++){
   const u=j/18,v=(j+1)/18,a=at(u),b=at(v),w=.055*(1-u)+.012;
   leafQuad(a.clone().addScaledVector(side,-w),a.clone().addScaledVector(side,w),b.clone().addScaledVector(side,-w*.9),b.clone().addScaledVector(side,w*.9),u,v,base);
   if(j<2)continue;
   for(const sign of[-1,1]){
    const reach=(.19+.72*Math.sin(u*Math.PI*.9))*(1-u*.45)*(1+Math.sin(j*3.7+f+sign)*.12),root=at(u),peak=root.clone().addScaledVector(side,sign*reach*.55).addScaledVector(outward,.11),end=root.clone().addScaledVector(side,sign*reach).addScaledVector(outward,.28);
    peak.y+=.055;end.y-=.14+u*.12;
    const width=.055*(1-u*.5),color=base.clone().lerp(tip,.18+(f%4)*.08);
    if(coarse){const k=P.length/3;vertex(root.clone().addScaledVector(outward,-width),0,u,color);vertex(root.clone().addScaledVector(outward,width),1,u,color);vertex(end,.5,u+.03,color);idx.push(k,k+1,k+2);continue;}
    leafQuad(root.clone().addScaledVector(outward,-width),root.clone().addScaledVector(outward,width),peak.clone().addScaledVector(outward,-width*.7),peak.clone().addScaledVector(outward,width*.7),u,u+.02,color);
    const k=P.length/3;vertex(peak.clone().addScaledVector(outward,-width*.7),0,u,color);vertex(peak.clone().addScaledVector(outward,width*.7),1,u,color);vertex(end,.5,u+.03,color);idx.push(k,k+1,k+2);
   }
  }
 }
 const crown=new T.BufferGeometry();crown.setAttribute('position',new T.Float32BufferAttribute(P,3));crown.setAttribute('uv',new T.Float32BufferAttribute(UV,2));crown.setAttribute('color',new T.Float32BufferAttribute(C,3));crown.setIndex(idx);crown.computeVertexNormals();
 return {trunk,crown};
}
const palmLodTiles=[];let palmLodTime=-Infinity,palmCoarseGeometry=null;
function registerPalmLods(){
 scene.traverse(o=>{if(!o.isInstancedMesh||!o.name.startsWith('Mapped palm avenue fronds'))return;
  if(!palmCoarseGeometry)palmCoarseGeometry=buildPalmGeometry(true).crown;
  const low=palmCoarseGeometry.clone();low.boundingBox=o.geometry.boundingBox;low.boundingSphere=o.geometry.boundingSphere;
  palmLodTiles.push({mesh:o,full:o.geometry,low,center:o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld),coarse:false});
 });
}
function updatePalmLods(forceFull=false){
 const now=performance.now();if(!forceFull&&now-palmLodTime<180)return;palmLodTime=now;
 for(const tile of palmLodTiles){const d=cam.position.distanceTo(tile.center),coarse=!forceFull&&d>(tile.coarse?280:320);if(coarse!==tile.coarse){tile.mesh.geometry=coarse?tile.low:tile.full;tile.coarse=coarse;}}
}
