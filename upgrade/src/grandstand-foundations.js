// One construction-time spatial index, released before play. It samples the
// final visible triangle surfaces, including the terrain cut around pit aprons.
async function settleGrandstands(){
 if(!standGrounders.length)return;
 const cells=new Map(),vertex=new T.Vector3(),surfaces=[];scene.updateMatrixWorld(true);
 scene.traverse(o=>{if(o.isMesh)surfaces.push(o)});
 for(const o of surfaces){
  if(!o.isMesh||o.isInstancedMesh||!(o.userData.calendarGround||o.userData.mainRoad||['Circuit terrain','Measured regional terrain','Original circuit regional ground','Grass verge','Paved runoff','Pit service apron','Pit-lane asphalt','Mapped surrounding road network'].includes(o.name)))continue;
  const g=o.geometry,p=g.attributes.position,idx=g.index,count=idx?idx.count:p.count;
  for(let i=0;i<count;i+=3){if(i%768===0&&MilanoBoot.shouldYield())await MilanoBoot.checkpoint("Grandstand foundations");const tri=[];for(let j=0;j<3;j++){vertex.fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld);tri.push(vertex.x,vertex.y,vertex.z)}
   const minX=Math.min(tri[0],tri[3],tri[6]),maxX=Math.max(tri[0],tri[3],tri[6]),minZ=Math.min(tri[2],tri[5],tri[8]),maxZ=Math.max(tri[2],tri[5],tri[8]);
   if(!grandstandAudit.some(s=>Math.abs(s.x-(minX+maxX)/2)<s.length+s.rows*1.25+(maxX-minX)/2+2&&Math.abs(s.z-(minZ+maxZ)/2)<s.length+s.rows*1.25+(maxZ-minZ)/2+2))continue;
   for(let x=Math.floor(minX/32);x<=Math.floor(maxX/32);x++)for(let z=Math.floor(minZ/32);z<=Math.floor(maxZ/32);z++){const k=x+':'+z;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(tri)}
  }
 }
 const heightAt=(x,z)=>{let height=-Infinity;for(const t of cells.get(Math.floor(x/32)+':'+Math.floor(z/32))||[]){const den=(t[5]-t[8])*(t[0]-t[6])+(t[6]-t[3])*(t[2]-t[8]);if(Math.abs(den)<1e-8)continue;const a=((t[5]-t[8])*(x-t[6])+(t[6]-t[3])*(z-t[8]))/den,b=((t[8]-t[2])*(x-t[6])+(t[0]-t[6])*(z-t[8]))/den;if(a>=-1e-6&&b>=-1e-6&&a+b<=1+1e-6)height=Math.max(height,a*t[1]+b*t[4]+(1-a-b)*t[7]);}return Number.isFinite(height)?height:groundHeight(x,z)};
 for(const fit of standGrounders)fit(heightAt);standGrounders.length=0;scene.updateMatrixWorld(true);
}
await settleGrandstands();
