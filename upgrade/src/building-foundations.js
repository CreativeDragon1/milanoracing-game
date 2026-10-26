// Fit building bases after terrain, paddock and pit surfaces are finished.
// Level architecture keeps its mapped X/Z and floor heights; only the supporting
// plinth reaches down to the actual rendered ground. No work runs during racing.
const buildingFoundationAudit={circuit:CIRCUIT.id,sites:[],segments:0,roadConflicts:[],missingGround:0,missingSamples:[]};
const inspectFoundationSamples=new URLSearchParams(location.search).has('qaStructures');
if(buildingFoundationSites.length){
 scene.updateMatrixWorld(true);
 const sites=buildingFoundationSites.map(s=>{const rings=s.rings.map(r=>r.map(p=>new T.Vector3(p[0],s.floor(p[0],p[1]),p[1]).applyMatrix4(s.group.matrixWorld)));const p=rings.flat();return{...s,rings,bounds:[Math.min(...p.map(v=>v.x))-2,Math.min(...p.map(v=>v.z))-2,Math.max(...p.map(v=>v.x))+2,Math.max(...p.map(v=>v.z))+2]}});
 const occupied=new Set();for(const s of sites)for(let x=Math.floor(s.bounds[0]/32);x<=Math.floor(s.bounds[2]/32);x++)for(let z=Math.floor(s.bounds[1]/32);z<=Math.floor(s.bounds[3]/32);z++)occupied.add(x+':'+z);
 const cells=new Map(),v=new T.Vector3(),surfaces=[];
 scene.traverseVisible(o=>{if(o.isMesh&&!o.isInstancedMesh&&(o.userData.waterSupport||o.userData.calendarGround||o.userData.mainRoad||['Circuit terrain','Measured regional terrain','Original circuit regional ground','Grass verge','Paved runoff','Pit service apron','Pit-lane asphalt','Mapped surrounding road network'].includes(o.name)))surfaces.push(o)});
 for(const o of surfaces){const p=o.geometry.attributes.position,idx=o.geometry.index,count=idx?idx.count:p.count;
  for(let i=0;i<count;i+=3){if(i%1536===0&&MilanoBoot.shouldYield())await MilanoBoot.checkpoint('Building foundations');const t=[];for(let j=0;j<3;j++){v.fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(o.matrixWorld);t.push(v.x,v.y,v.z)}
   const x=Math.min(t[0],t[3],t[6]),X=Math.max(t[0],t[3],t[6]),z=Math.min(t[2],t[5],t[8]),Z=Math.max(t[2],t[5],t[8]);
   for(let a=Math.floor(x/32);a<=Math.floor(X/32);a++)for(let b=Math.floor(z/32);b<=Math.floor(Z/32);b++){const key=a+':'+b;if(!occupied.has(key))continue;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(t)}
  }
 }
 const height=(x,z)=>{let y=-Infinity;for(const t of cells.get(Math.floor(x/32)+':'+Math.floor(z/32))||[]){const den=(t[5]-t[8])*(t[0]-t[6])+(t[6]-t[3])*(t[2]-t[8]);if(Math.abs(den)<1e-9)continue;const a=((t[5]-t[8])*(x-t[6])+(t[6]-t[3])*(z-t[8]))/den,b=((t[8]-t[2])*(x-t[6])+(t[0]-t[6])*(z-t[8]))/den;if(a>=-1e-6&&b>=-1e-6&&a+b<=1+1e-6)y=Math.max(y,a*t[1]+b*t[4]+(1-a-b)*t[7])}return y;};
 const tiles=new Map();
 for(const site of sites){let gap=0,count=0;const checks=[];
  for(const ring of site.rings)for(let i=0;i<ring.length;i++){const A=ring[i],B=ring[(i+1)%ring.length],length=Math.hypot(B.x-A.x,B.z-A.z),n=Math.max(1,Math.ceil(length/1.5));
   for(let j=0;j<n;j++){if(MilanoBoot.shouldYield())await MilanoBoot.checkpoint('Building foundations');const a=A.clone().lerp(B,j/n),b=A.clone().lerp(B,(j+1)/n),sample=[];
    for(const u of[0,.25,.5,.75,1]){const x=a.x+(b.x-a.x)*u,z=a.z+(b.z-a.z)*u;sample.push({x,z,ground:height(x,z),top:a.y+(b.y-a.y)*u})}
    if(sample.some(p=>!Number.isFinite(p.ground))){buildingFoundationAudit.missingGround++;if(buildingFoundationAudit.missingSamples.length<30){const p=sample.find(p=>!Number.isFinite(p.ground));buildingFoundationAudit.missingSamples.push({name:site.name,x:p.x,z:p.z,y:p.top})}continue;}
    const exposed=Math.max(...sample.map(p=>p.top-p.ground));gap=Math.max(gap,exposed);if(exposed<-.02)continue;
    if(sample.some(p=>Number.isFinite(drivingClearance(p.x,p.z,.1)))){buildingFoundationAudit.roadConflicts.push({name:site.name,x:a.x,z:a.z});continue;}
    const bottom=Math.min(...sample.map(p=>p.ground),a.y,b.y)-.65,key=Math.floor((a.x+b.x)/440)+':'+Math.floor((a.z+b.z)/440);
    if(!tiles.has(key))tiles.set(key,{P:[],U:[]});const tile=tiles.get(key);
    for(const p of[[a.x,bottom,a.z],[b.x,bottom,b.z],[b.x,b.y,b.z],[a.x,bottom,a.z],[b.x,b.y,b.z],[a.x,a.y,a.z]]){tile.P.push(...p);tile.U.push((j/n*length+(p[0]===b.x&&p[2]===b.z?length/n:0))/3,p[1]/3)}
    if(inspectFoundationSamples)for(const p of sample)checks.push([p.x,p.z,p.ground,bottom,p.top]);count++;
   }
  }
  buildingFoundationAudit.sites.push({name:site.name,maxUnsupportedHeightBefore:gap,segments:count,checks});buildingFoundationAudit.segments+=count;
 }
 // Masonry at hillside venues gives exposed retaining bases a coherent scale.
 // One shared texture and static tiles; no animated terrain deformation.
 const masonry=CIRCUIT.id==='monaco'||THEME==='alpine',baseMap=masonry?canvasTex(512,512,(ctx,w,h)=>{ctx.fillStyle='#8d8b80';ctx.fillRect(0,0,w,h);for(let row=0;row<8;row++)for(let col=-1;col<6;col++){const seed=(row*71+col*37+1024)%19,shade=164+seed*2;ctx.fillStyle='rgb('+shade+','+(shade-2)+','+(shade-12)+')';ctx.fillRect(col*104+(row%2)*52+2,row*64+2,100,60);}for(let i=0;i<6000;i++){ctx.fillStyle=i%2?'#ffffff0c':'#0000000c';ctx.fillRect((i*173)%512,(i*317+Math.floor(i/512)*73)%512,2,1)}}):barrierColor;
 if(masonry){baseMap.wrapS=baseMap.wrapT=T.RepeatWrapping;}
 const material=new T.MeshStandardMaterial({map:baseMap,normalMap:barrierNormal,normalScale:new T.Vector2(.10,.10),color:0xffffff,roughness:.93,envMapIntensity:.35,side:T.DoubleSide});
 for(const tile of tiles.values()){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(tile.P,3));g.setAttribute('uv',new T.Float32BufferAttribute(tile.U,2));g.computeVertexNormals();const mesh=new T.Mesh(g,material);mesh.name='Terrain-fitted building foundations';mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh)}
}
