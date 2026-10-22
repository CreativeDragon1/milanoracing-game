// Shared pit cross-sections. Consecutive quads use identical edge vertices.
const pitSections=PIT.x.map((x,i)=>{const h=PIT.heading[i],normal=[-Math.sin(h),Math.cos(h)],s=PIT.s[i],end=Math.min(s,PIT.length-s),blend=clamp(end/55,0,1);return{normal,point:(offset)=>{const xx=x+normal[0]*offset,zz=PIT.z[i]+normal[1]*offset,road=roadHeightAt(xx,zz);return[xx,PIT.y[i]+(road-PIT.y[i])*(1-blend)**2+.026,zz]}}});
const pitCutCells=new Map(),pitCutQuads=[];
for(let i=0;i<PIT.x.length-1;i++){
 const a=pitSections[i],b=pitSections[i+1],w=PIT.width/2-.012,v=[a.point(-w),b.point(-w),b.point(w),a.point(w)],q={v,index:i};
 const cross=(v[1][0]-v[0][0])*(v[2][2]-v[0][2])-(v[1][2]-v[0][2])*(v[2][0]-v[0][0]);if(cross<0)v.reverse();pitCutQuads.push(q);
 for(let x=Math.floor(Math.min(...v.map(p=>p[0]))/24);x<=Math.floor(Math.max(...v.map(p=>p[0]))/24);x++)for(let z=Math.floor(Math.min(...v.map(p=>p[2]))/24);z<=Math.floor(Math.max(...v.map(p=>p[2]))/24);z++){const key=x+':'+z;if(!pitCutCells.has(key))pitCutCells.set(key,[]);pitCutCells.get(key).push(q)}
}
const pitSurfaceAudit={trimmedMeshes:0,removedTriangles:0,elapsedMs:0};
function trimPitGround(){
 const begin=performance.now(),meshes=[];scene.updateMatrixWorld(true);
 scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&(o.userData.pitCut||o.userData.calendarGround||['Circuit terrain','Mapped surrounding road network'].includes(o.name)))meshes.push(o)});
 const split=(poly,a,b)=>{const inside=[],outside=[],distance=p=>(b[0]-a[0])*(p[2]-a[2])-(b[2]-a[2])*(p[0]-a[0]);for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],d=distance(p),e=distance(q);if(d>=-1e-8)inside.push(p);if(d<=1e-8)outside.push(p);if((d>1e-8&&e<-1e-8)||(d<-1e-8&&e>1e-8)){const f=d/(d-e),v=p.map((x,k)=>x+(q[k]-x)*f);inside.push(v);outside.push(v)}}return{inside,outside}};
 for(const mesh of meshes){
  const old=mesh.geometry,g=old.index?old.toNonIndexed():old,attributes=Object.entries(g.attributes),sizes=attributes.map(([_,a])=>a.itemSize),stride=sizes.reduce((a,b)=>a+b,0),rows=[],out=attributes.map(()=>[]),pos=g.attributes.position;let changed=false,removed=0;
  // These ground meshes have world-space vertices. Preserve all UVs, colours and normals.
  if(mesh.position.lengthSq()>1e-8||mesh.rotation.x||mesh.rotation.y||mesh.rotation.z)continue;
  for(let i=0;i<pos.count;i+=3){
   const tri=[];for(let j=0;j<3;j++){const v=[];for(const [_,a] of attributes)for(let k=0;k<a.itemSize;k++)v.push(a.array[(i+j)*a.itemSize+k]);tri.push(v)}
   const candidates=new Set();for(let x=Math.floor(Math.min(...tri.map(p=>p[0]))/24);x<=Math.floor(Math.max(...tri.map(p=>p[0]))/24);x++)for(let z=Math.floor(Math.min(...tri.map(p=>p[2]))/24);z<=Math.floor(Math.max(...tri.map(p=>p[2]))/24);z++)for(const q of pitCutCells.get(x+':'+z)||[])candidates.add(q);
   let pieces=[tri];for(const q of candidates){
    // Preserve true grade-separated road decks above the Abu Dhabi exit tunnel.
    if(mesh.userData.mainRoad&&Math.min(...tri.map(v=>v[1]))>Math.max(...q.v.map(v=>v[1]))+3.5)continue;
    const next=[];for(const poly of pieces){let inner=poly;for(let k=0;k<4&&inner.length>=3;k++){const parts=split(inner,q.v[k],q.v[(k+1)%4]);if(parts.outside.length>=3)next.push(parts.outside);inner=parts.inside;}if(inner.length>=3){changed=true;removed++}}pieces=next;if(!pieces.length)break;
   }
   for(const poly of pieces)for(let k=1;k<poly.length-1;k++)for(const v of [poly[0],poly[k],poly[k+1]]){let at=0;for(let a=0;a<attributes.length;a++){for(let c=0;c<sizes[a];c++)out[a].push(v[at++])}}
  }
  if(changed){const replacement=new T.BufferGeometry();attributes.forEach(([name,a],i)=>replacement.setAttribute(name,new T.Float32BufferAttribute(out[i],a.itemSize)));replacement.computeBoundingSphere();mesh.geometry=replacement;old.dispose();pitSurfaceAudit.trimmedMeshes++;pitSurfaceAudit.removedTriangles+=removed;}if(g!==old)g.dispose();
 }
 pitSurfaceAudit.elapsedMs=performance.now()-begin;
}
