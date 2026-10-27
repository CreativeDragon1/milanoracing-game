// Shared pit cross-sections. Consecutive quads use identical edge vertices.
const pitSections=PIT.x.map((x,i)=>{const h=PIT.heading[i],normal=[-Math.sin(h),Math.cos(h)],s=PIT.s[i],end=Math.min(s,PIT.length-s),blend=clamp(end/55,0,1);return{normal,point:(offset)=>{const xx=x+normal[0]*offset,zz=PIT.z[i]+normal[1]*offset,road=roadHeightAt(xx,zz);return[xx,PIT.y[i]+(road-PIT.y[i])*(1-blend)**2+.026,zz]}}});
// A rear camera must follow the floor beneath itself, not the car's floor on
// a different part of a ramp. Pit samples are approximately one metre apart.
function pitCameraSurface(x,z,s){
 const hint=Math.round(s/PIT.length*(PIT.x.length-1));let best=Infinity,result=null;
 for(let i=Math.max(0,hint-32);i<Math.min(PIT.x.length-1,hint+33);i++){
  const dx=PIT.x[i+1]-PIT.x[i],dz=PIT.z[i+1]-PIT.z[i],length=dx*dx+dz*dz;if(length<1e-8)continue;
  const t=clamp(((x-PIT.x[i])*dx+(z-PIT.z[i])*dz)/length,0,1),px=PIT.x[i]+dx*t,pz=PIT.z[i]+dz*t,d=(x-px)**2+(z-pz)**2;
  if(d<best){best=d;result={y:PIT.y[i]+(PIT.y[i+1]-PIT.y[i])*t,s:PIT.s[i]+(PIT.s[i+1]-PIT.s[i])*t,x:px,z:pz,nx:-dz/Math.sqrt(length),nz:dx/Math.sqrt(length),offset:((z-pz)*dx-(x-px)*dz)/Math.sqrt(length)}}
 }
 return result;
}
function pitCameraTunnelWeight(s){if(!PIT.tunnel)return 0;const a=PIT.s[PIT.tunnel.start],b=PIT.s[PIT.tunnel.end],distance=Math.max(a-s,s-b,0),t=clamp(1-distance/28,0,1);return t*t*(3-2*t)}
const pitCutCells=new Map(),pitCutQuads=[];
for(let i=0;i<PIT.x.length-1;i++){
 // Clip to the same edge used by the pit asphalt. An inset left a thin second
 // road/ground layer at the joins, only millimetres away, which fought for depth.
 const a=pitSections[i],b=pitSections[i+1],w=PIT.width/2,v=[a.point(-w),b.point(-w),b.point(w),a.point(w)],q={v,index:i};
 const cross=(v[1][0]-v[0][0])*(v[2][2]-v[0][2])-(v[1][2]-v[0][2])*(v[2][0]-v[0][0]);if(cross<0)v.reverse();pitCutQuads.push(q);
 for(let x=Math.floor(Math.min(...v.map(p=>p[0]))/24);x<=Math.floor(Math.max(...v.map(p=>p[0]))/24);x++)for(let z=Math.floor(Math.min(...v.map(p=>p[2]))/24);z<=Math.floor(Math.max(...v.map(p=>p[2]))/24);z++){const key=x+':'+z;if(!pitCutCells.has(key))pitCutCells.set(key,[]);pitCutCells.get(key).push(q)}
}
const pitSurfaceAudit={trimmedMeshes:0,removedTriangles:0,elapsedMs:0};
async function trimPitGround(roadPass=false,onlyMeshes=null){
 const begin=performance.now(),meshes=onlyMeshes||[];scene.updateMatrixWorld(true);
 if(!onlyMeshes)scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&(roadPass?(o.userData.trimRaceCorridor||o.userData.calendarGround||['Circuit terrain','Mapped surrounding road network'].includes(o.name)):(o.userData.pitCut||o.userData.calendarGround||['Circuit terrain','Mapped surrounding road network'].includes(o.name))))meshes.push(o)});
 const cutCells=roadPass?raceSurfaceCutCells():pitCutCells;
 const split=(poly,a,b)=>{const inside=[],outside=[],distance=p=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],d=distance(p),e=distance(q);if(d>=-1e-8)inside.push(p);if(d<=1e-8)outside.push(p);if((d>1e-8&&e<-1e-8)||(d<-1e-8&&e>1e-8)){const f=d/(d-e),v=p.map((x,k)=>x+(q[k]-x)*f);inside.push(v);outside.push(v)}}return{inside,outside}};
 for(const mesh of meshes){
  const old=mesh.geometry,g=old.index?old.toNonIndexed():old,attributes=Object.entries(g.attributes),sizes=attributes.map(([_,a])=>a.itemSize),stride=sizes.reduce((a,b)=>a+b,0),rows=[],out=attributes.map(()=>[]),pos=g.attributes.position;let changed=false,removed=0;
  // These ground meshes have world-space vertices. Preserve all UVs, colours and normals.
  if(mesh.position.lengthSq()>1e-8||mesh.rotation.x||mesh.rotation.y||mesh.rotation.z)continue;
  for(let i=0;i<pos.count;i+=3){
   if(i%384===0&&MilanoBoot.shouldYield())await MilanoBoot.checkpoint("Pit surface fitting");
   const tri=[];for(let j=0;j<3;j++){const v=[];for(const [_,a] of attributes)for(let k=0;k<a.itemSize;k++)v.push(a.array[(i+j)*a.itemSize+k]);tri.push(v)}
   const candidates=new Set();for(let x=Math.floor(Math.min(...tri.map(p=>p[0]))/24);x<=Math.floor(Math.max(...tri.map(p=>p[0]))/24);x++)for(let z=Math.floor(Math.min(...tri.map(p=>p[2]))/24);z<=Math.floor(Math.max(...tri.map(p=>p[2]))/24);z++)for(const q of cutCells.get(x+':'+z)||[])candidates.add(q);
   let pieces=[tri];for(const q of candidates){
    // Suzuka's two road decks and Yas Marina's exit tunnel are distinct layers.
    if(roadPass&&(Math.min(...tri.map(v=>v[1]))>q.maxY+3.5||Math.max(...tri.map(v=>v[1]))<q.minY-3.5))continue;
    // Preserve true grade-separated road decks above the Abu Dhabi exit tunnel.
    if(mesh.userData.mainRoad&&Math.min(...tri.map(v=>v[1]))>Math.max(...q.v.map(v=>v[1]))+3.5)continue;
    const next=[];for(const poly of pieces){
     // Bounding-cell membership alone does not mean a polygon intersects the
     // lane. Cutting against disjoint quads caused tens of thousands of thin
     // fragments, more draw work and unstable depth near terrain seams.
     let overlap=poly;for(let k=0;k<4&&overlap.length>=3;k++)overlap=split(overlap,q.v[k],q.v[(k+1)%4]).inside;
     let area=0;if(overlap.length>=3)for(let k=1;k<overlap.length-1;k++){const a=overlap[0],b=overlap[k],c=overlap[k+1],x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],X=c[0]-a[0],Y=c[1]-a[1],Z=c[2]-a[2];area+=Math.hypot(y*Z-z*Y,z*X-x*Z,x*Y-y*X)*.5;}
     if(area<1e-7){next.push(poly);continue;}
     let inner=poly;for(let k=0;k<4&&inner.length>=3;k++){const parts=split(inner,q.v[k],q.v[(k+1)%4]);if(parts.outside.length>=3)next.push(parts.outside);inner=parts.inside;}changed=true;removed++;
    }pieces=next;if(!pieces.length)break;
   }
   for(const poly of pieces)for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]]){let at=0;for(let a=0;a<attributes.length;a++){for(let c=0;c<sizes[a];c++)out[a].push(v[at++])}}
  }
  if(changed){const replacement=new T.BufferGeometry();attributes.forEach(([name,a],i)=>replacement.setAttribute(name,new T.Float32BufferAttribute(out[i],a.itemSize)));replacement.computeBoundingSphere();mesh.geometry=replacement;old.dispose();pitSurfaceAudit.trimmedMeshes++;pitSurfaceAudit.removedTriangles+=removed;}if(g!==old)g.dispose();
 }
 pitSurfaceAudit.elapsedMs=performance.now()-begin;
}
let cachedRaceSurfaceCutCells=null;
function raceSurfaceCutCells(){
 if(cachedRaceSurfaceCutCells)return cachedRaceSurfaceCutCells;
 const cells=new Map();
 for(let i=0;i<N;i++){const j=(i+1)%N,v=[];
  for(const [k,side]of[[i,-1],[j,-1],[j,1],[i,1]]){const off=side*(trackHalf(k,side)+1.49);v.push([cx[k]+nx[k]*off,surfaceHeight(k,off),cz[k]+nz[k]*off]);}
  const cross=(v[1][0]-v[0][0])*(v[2][2]-v[0][2])-(v[1][2]-v[0][2])*(v[2][0]-v[0][0]);if(cross<0)v.reverse();
  const q={v,index:i,minY:Math.min(...v.map(p=>p[1])),maxY:Math.max(...v.map(p=>p[1]))};
  for(let x=Math.floor(Math.min(...v.map(p=>p[0]))/24);x<=Math.floor(Math.max(...v.map(p=>p[0]))/24);x++)for(let z=Math.floor(Math.min(...v.map(p=>p[2]))/24);z<=Math.floor(Math.max(...v.map(p=>p[2]))/24);z++){const key=x+':'+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(q)}
 }
 cachedRaceSurfaceCutCells=cells;return cells;
}
