// Event dressing between the mapped landmarks. These temporary installations
// are fictional Milano event equipment, not claims about permanent buildings.
// Everything is baked once, spatially batched, and excluded from roads and water.
const venueLifeAudit={sites:[],planting:[],sectors:[],connections:[],rejected:0,instances:0,triangles:0};
const venueLifeFascias=[];
(() => {
 const profile={bahrain:'desert',singapore:'civic',monza:'woodland',monaco:'harbour',austria:'alpine',silverstone:'airfield','abu-dhabi':'marina',spa:'woodland',suzuka:'park',interlagos:'park',zandvoort:'dunes',milano:'alpine',riviera:'harbour',solara:'desert'}[CIRCUIT.id];
 const dry=['desert','marina','dunes'].includes(profile),city=['civic','harbour'].includes(profile),occupied=[],cells=new Map(),batches=new Map();
 const features=(geography?.features||[]).map(f=>({...f,b:[Math.min(...f.points.map(p=>p[0])),Math.min(...f.points.map(p=>p[1])),Math.max(...f.points.map(p=>p[0])),Math.max(...f.points.map(p=>p[1]))]}));
 const water=features.filter(f=>f.kind==='water'),roads=features.filter(f=>f.kind==='road'),green=features.filter(f=>['forest','grass'].includes(f.kind));
 const atFeature=(x,z,items,r=0)=>items.some(f=>x>=f.b[0]-r&&x<=f.b[2]+r&&z>=f.b[1]-r&&z<=f.b[3]+r&&insideFootprint(x,z,f.points));
 const segmentDistance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],u=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(x-a[0]-dx*u,z-a[1]-dz*u)};
 function putDensity(x,z){const key=Math.floor(x/80)+','+Math.floor(z/80);if(!cells.has(key))cells.set(key,[]);cells.get(key).push([x,z]);}
 for(const t of treePositions)putDensity(t[0],t[1]);
 for(const b of mappedBounds)putDensity((b.x+b.X)/2,(b.z+b.Z)/2);
 function density(x,z){let n=0;const X=Math.floor(x/80),Z=Math.floor(z/80);for(let a=X-1;a<=X+1;a++)for(let b=Z-1;b<=Z+1;b++)for(const p of cells.get(a+','+b)||[])if(Math.hypot(x-p[0],z-p[1])<90)n++;return n;}
 function terrainY(x,z){const list=terrainCells.get(Math.floor(x/60)+':'+Math.floor(z/60)),v=terrainVertices;if(!list)return null;for(const i of list){const ax=v[i],az=v[i+2],bx=v[i+3],bz=v[i+5],dx=v[i+6],dz=v[i+8],den=(bz-dz)*(ax-dx)+(dx-bx)*(az-dz),a=((bz-dz)*(x-dx)+(dx-bx)*(z-dz))/den,b=((dz-az)*(x-dx)+(ax-dx)*(z-dz))/den;if(a>=0&&b>=0&&a+b<=1)return a*v[i+1]+b*v[i+4]+(1-a-b)*v[i+7];}return null;}
 function clear(x,z,r,facility=false){
  if(!clearSite(x,z,r)||atFeature(x,z,water,r)||occupied.some(p=>Math.hypot(x-p.x,z-p.z)<p.r+r+3))return false;
  if(geography&&geographicHeight(x,z)+geography.datumOffset<1)return false;
  for(let i=1;i<PIT.x.length;i+=3)if(segmentDistance(x,z,[PIT.x[Math.max(0,i-3)],PIT.z[Math.max(0,i-3)]],[PIT.x[i],PIT.z[i]])<r+17)return false;
  for(const road of roads){if(x<road.b[0]-r-8||x>road.b[2]+r+8||z<road.b[1]-r-8||z>road.b[3]+r+8)continue;for(let i=1;i<road.points.length;i++)if(segmentDistance(x,z,road.points[i-1],road.points[i])<r+(road.width||5)/2+2)return false;}
  for(const s of grandstandAudit){const dx=x-s.x,dz=z-s.z,xx=dx*Math.cos(s.rotation)-dz*Math.sin(s.rotation),zz=dx*Math.sin(s.rotation)+dz*Math.cos(s.rotation);if(Math.abs(xx)<s.length/2+r+3&&zz>-5-r&&zz<s.rows*1.25+r+3)return false;}
  const y=terrainY(x,z);if(y===null)return false;
  if(facility)for(const [dx,dz] of [[r,0],[-r,0],[0,r],[0,-r]]){const yy=terrainY(x+dx,z+dz);if(yy===null||Math.abs(yy-y)>.35||buildingAt(x+dx,z+dz,1)||atFeature(x+dx,z+dz,water))return false;}
  return true;
 }
 const material={stone:new T.MeshStandardMaterial({color:linear(0xb8b9b0),map:barrierColor,normalMap:barrierNormal,normalScale:new T.Vector2(.12,.12),roughness:.9}),steel:venueMetal,white:venueWhite,glass:venueGlass,rubber:M(0x26292b,0,.93),fabric:M(dry?0xd7c8ab:0xd9dedb,0,.9),orange:M(0xff7a00,.1,.65),blue:M(0x0019ff,.12,.65),skin:M(0xffffff,0,.87),foliage:M(dry?0x7a8253:0x4b6943,0,1)};
 const geo={box:unitBox,head:new T.SphereGeometry(1,6,4),rock:new T.IcosahedronGeometry(1,0),body:new T.CylinderGeometry(.8,1,1,6),canopy:new T.ConeGeometry(1,1,4),wheel:new T.CylinderGeometry(1,1,1,10)};
 const obj=new T.Object3D(),surfaceBatches=new Map();
 function piece(s,kind,mat,x,y,z,w,h,d,rx=0,rz=0,color){
  const co=Math.cos(s.a),si=Math.sin(s.a),xx=s.x+x*co+z*si,zz=s.z-x*si+z*co;
  const key=[kind,mat,Math.floor(xx/180),Math.floor(zz/180)].join(':');if(!batches.has(key))batches.set(key,{kind,mat,items:[]});
  obj.position.set(xx,s.y+y,zz);obj.rotation.set(rx,s.a+(kind==='canopy'?Math.PI/4:0),rz,'YXZ');obj.scale.set(w,h,d);obj.updateMatrix();batches.get(key).items.push({matrix:obj.matrix.clone(),color});
 }
 function rail(s,x,z,length){for(const y of[.55,1.05])piece(s,'box','steel',x,y,z,length,.07,.07);for(let k=-length/2;k<=length/2;k+=2)piece(s,'box','steel',x+k,.55,z,.06,1.1,.06);}
 function person(s,x,z,i,marshal=false){const size=.9+(i%4)*.06;piece(s,'body','skin',x,1.16*size,z,.25,.62*size,.2,0,0,marshal?0xff7a00:[0x263e6b,0xe0c9ad,0xd66231,0xdee2dc,0x223026,0x576979][i%6]);piece(s,'head','skin',x,1.64*size,z,.15,.18,.15,0,0,[0xc79b7a,0x906445,0xd5ad8e,0x624735][i%4]);for(const side of[-1,1]){piece(s,'box','rubber',x+side*.11,.48*size,z,.15,.7*size,.18);piece(s,'box','skin',x+side*.28,1.05*size,z,.13,.55*size,.13,0,side*.12,marshal?0xff7a00:0x4d5b67);}}
 function shade(s,x,z,width=7){piece(s,'canopy','fabric',x,3.5,z,width*.71,1.65,width*.71,0,0);for(const a of[-1,1])for(const b of[-1,1])piece(s,'box','steel',x+a*width*.48,1.5,z+b*width*.48,.08,3,.08);}
 function equipment(s,x,z){piece(s,'box','white',x,.8,z,2.5,1.6,1.8);for(const yy of[.4,.65,.9,1.15])piece(s,'box','steel',x,yy,z-.92,2.1,.07,.05);piece(s,'box','rubber',x,1.65,z,1.5,.12,1.1);}
 function compound(s,index){
  // The concourse follows the existing ground; no floating concrete platforms.
  paving(s,19,14);
  for(const x of[-8,8]){equipment(s,x,5);rail(s,x,-5,2);}
  for(const x of[-7,7]){piece(s,'box','stone',x,.25,6.2,1.8,.5,1.2);for(let k=0;k<3;k++)piece(s,'rock','foliage',x+(k-1)*.5,.8,6.2,.55,.55,.5);}
  piece(s,'box','steel',7,3.8,4,.1,7.6,.1);piece(s,'box','white',7,7.6,4,1.2,.12,.8);
  for(let k=0;k<5;k++)person(s,-6+k*2.8,5.2,index+k);
  // Three complete installations, each beside a real venue access point.
  const type=s.facilityType??index%3;
  if(type===0){
   piece(s,'box','white',2,1.5,2,8,3,4);piece(s,'box','steel',2,3.12,2,8.4,.25,4.4);piece(s,'box','glass',2,2.1,-.035,6,1.1,.08);piece(s,'box','orange',2,.7,-.06,8,.26,.12);equipment(s,-5,3);shade(s,-3,-2,5);for(let k=0;k<4;k++)person(s,-5+k*1.4,-3,index+k,true);
  }else if(type===1){
   for(const x of[-3,3])for(const z of[-2,2])piece(s,'box','steel',x,2.6,z,.18,5.2,.18);piece(s,'box','steel',0,5.2,0,7,.2,5);piece(s,'box','white',0,6.4,1,6,2.4,2);piece(s,'box','steel',0,7.7,0,7.5,.25,5.5);rail(s,0,-2.5,7);piece(s,'box','rubber',0,6.3,-1.8,1.2,.7,1.4);piece(s,'box','rubber',0,6.3,-2.7,.5,.5,.6);for(let k=0;k<9;k++)piece(s,'box','steel',-4, .3+k*.55,2-k*.42,1.5,.15,.55);for(let k=0;k<3;k++)person({...s,y:s.y+5.2},2-k*1.5,-.8,index+k);equipment(s,4,3);
  }else{
   shade(s,-3,1,7);shade(s,4,2,5);rail(s,0,-5,16);for(let k=0;k<26;k++)person(s,-6.7+(k%9)*1.55,-3.5+Math.floor(k/9)*1.8,index+k);for(const x of[-6,5])piece(s,'box','blue',x,.6,3,2,1.2,1.4);
  }
  // A proper fascia gives each partner one equal, undistorted allocation.
  const g=new T.Group();g.position.set(s.x,s.y,s.z);g.rotation.y=s.a;scene.add(g);venueLifeFascias.push({group:g,station:s.station,y:type===1?5.1:.65,z:-5.57,width:14.4});
 }

 function world(s,x,z){return {x:s.x+x*Math.cos(s.a)+z*Math.sin(s.a),z:s.z-x*Math.sin(s.a)+z*Math.cos(s.a)}}
 function terrainSurface(points,name){
  const key=name+':'+Math.floor(points[0].x/180)+':'+Math.floor(points[0].z/180);
  if(!surfaceBatches.has(key))surfaceBatches.set(key,{name,p:[],uv:[]});const b=surfaceBatches.get(key);
  for(const indices of [[0,2,1],[1,2,3]])for(const i of indices){const p=points[i];b.p.push(p.x,terrainY(p.x,p.z)+.024,p.z);b.uv.push(p.x/5,p.z/5)}
 }
 function paving(s,w,d){
  for(let x=-w/2;x<w/2;x+=2)for(let z=-d/2;z<d/2;z+=2){const X=Math.min(x+2,w/2),Z=Math.min(z+2,d/2);terrainSurface([[x,z],[X,z],[x,Z],[X,Z]].map(p=>world(s,...p)),'Venue concourse')}
 }
 function connection(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),steps=Math.max(2,Math.ceil(length/2)),ux=-dz/length*1.2,uz=dx/length*1.2,sections=[];
  if(length<1||length>70)return null;
  let previous=null;
  for(let i=0;i<=steps;i++){
   const x=a.x+dx*i/steps,z=a.z+dz*i/steps,y=terrainY(x,z);
   if(y===null||atFeature(x,z,water,2)||buildingAt(x,z,1.5)||!clearSite(x,z,1.5))return null;
   if(previous!==null&&Math.abs(y-previous)/(length/steps)>.12)return null;previous=y;
   for(const side of[-1,1]){const xx=x+ux*side,zz=z+uz*side;if(terrainY(xx,zz)===null||atFeature(xx,zz,water))return null;}
   for(let k=0;k<PIT.x.length;k+=3)if(Math.hypot(x-PIT.x[k],z-PIT.z[k])<18)return null;
   // Do not send a path through another grandstand or another installation.
   for(const st of grandstandAudit){const xx=(x-st.x)*Math.cos(st.rotation)-(z-st.z)*Math.sin(st.rotation),zz=(x-st.x)*Math.sin(st.rotation)+(z-st.z)*Math.cos(st.rotation);if(Math.abs(xx)<st.length/2+1&&zz>-3&&zz<st.rows*1.25+1)return null;}
   if(occupied.some(s=>Math.hypot(x-s.x,z-s.z)<s.r+1))return null;
   sections.push([{x:x+ux,z:z+uz},{x:x-ux,z:z-uz}]);
  }
  return {a,b,length,sections};
 }
 function finishConnection(route){
  for(let i=1;i<route.sections.length;i++)terrainSurface([...route.sections[i-1],...route.sections[i]],'Venue access walk');
  venueLifeAudit.connections.push({from:route.a,to:route.b,length:route.length});
 }
 const anchors=[];
 // A stand is a destination, not an obstacle to sprinkle buildings around.
 // Its side exits lead into a shared concourse with seating, shade and services.
 for(const st of grandstandAudit){
  const a={x:st.x,z:st.z,a:st.rotation};
  for(const side of[-1,1]){
   const gate=world(a,side*(st.length/2+5),st.rows*1.25+5);
   for(const back of[5,17])for(const out of[20,32]){
    const p=world(a,side*(st.length/2+out),st.rows*1.25+back);
    anchors.push({...p,a:st.rotation,station:st.station,anchor:{name:st.name||'Grandstand access',kind:'grandstand',x:gate.x,z:gate.z},facilityType:2});
   }
  }
 }
 // Service hubs are allowed only beside venue buildings AND mapped access roads.
 // Residential/public city blocks never become fictional paddocks.
 const venueBuilding=b=>['pavilion','grandstand','sports_hall','stadium','industrial'].includes(b.f.building)||/pit|paddock|box|garage|tribuna/i.test(b.f.name||'');
 const edgeRoad=[];
 for(const road of roads)for(let j=1;j<road.points.length;j++){
  const a=road.points[j-1],b=road.points[j],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<5)continue;
  const x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,q=prog(x,z,-1);
  if(Math.hypot(x-cx[q.i],z-cz[q.i])<Math.abs(trackBarrier(q.i,Math.sign(q.d)))+16||Math.hypot(x-cx[q.i],z-cz[q.i])>160)continue;
  const near=mappedBounds.find(v=>venueBuilding(v)&&Math.hypot(x-(v.x+v.X)/2,z-(v.z+v.Z)/2)<90);
  if(!near)continue;
  edgeRoad.push({x,z,dx:(b[0]-a[0])/l,dz:(b[1]-a[1])/l,width:road.width||5,station:q.i,building:near.f.name||'Mapped venue facility',name:road.name||'Mapped access road'});
 }
 for(const r of edgeRoad)for(const side of[-1,1]){
  const separation=r.width/2+16,anchorDistance=r.width/2+1.5;
  anchors.push({x:r.x-r.dz*side*separation,z:r.z+r.dx*side*separation,a:-Math.atan2(r.dz,r.dx),station:r.station,facilityType:0,anchor:{name:r.name+' / '+r.building,kind:'mapped service access',x:r.x-r.dz*side*anchorDistance,z:r.z+r.dx*side*anchorDistance}});
 }
 let siteIndex=0;const usedAnchors=new Set();
 for(const candidate of anchors){
  if(venueLifeAudit.sites.length>=28)break;
  const key=candidate.anchor.kind+':'+Math.round(candidate.anchor.x/25)+':'+Math.round(candidate.anchor.z/25);
  if(usedAnchors.has(key)||occupied.some(s=>Math.hypot(s.x-candidate.x,s.z-candidate.z)<65))continue;
  if(!clear(candidate.x,candidate.z,13,true)){venueLifeAudit.rejected++;continue;}
  const dx=candidate.anchor.x-candidate.x,dz=candidate.anchor.z-candidate.z,l=Math.hypot(dx,dz);
  const from={x:candidate.x+dx/l*9.8,z:candidate.z+dz/l*9.8},route=connection(from,candidate.anchor);
  if(!route){venueLifeAudit.rejected++;continue;}
  const s={...candidate,y:terrainY(candidate.x,candidate.z),r:13};
  finishConnection(route);compound(s,siteIndex++);occupied.push(s);usedAnchors.add(key);
  venueLifeAudit.sites.push({...s,type:s.facilityType===2?'Spectator concourse':'Venue service court',accessLength:route.length});putDensity(s.x,s.z);
 }
 // Continuous vegetation follows mapped cover and the local landform. It is
 // landscape texture, not a reason to put unrelated structures into a valley.
 for(let distance=65;distance<LEN;distance+=115){
  const station=Math.round(distance/LEN*N)%N;if(tunnelStation(station))continue;
  const record={station,distance,before:density(cx[station],cz[station]),features:0,trees:0};
  for(const side of[-1,1])for(let j=0;j<(dry?6:20);j++){
   const k=(station+Math.round((j%5-2)*10/LEN*N)+N)%N,o=trackBarrier(k,side)+side*(18+Math.floor(j/5)*15+(j*17%11)),x=cx[k]+nx[k]*o,z=cz[k]+nz[k]*o;
   if(density(x,z)>15||!clear(x,z,3)||geography&&!atFeature(x,z,green))continue;
   const terrain=terrainY(x,z),neighbor=terrainY(x+3,z+3);if(neighbor===null||Math.abs(terrain-neighbor)>2)continue;
   if(dry){const s={x,z,y:terrain,a:j*1.37};for(let n=0;n<3;n++)piece(s,'rock','foliage',(n-1)*1.1,.55,Math.sin(n)*.6,1.1,.75,.9,0,.15);venueLifeAudit.planting.push({x,z,r:3,type:'mapped scrub'});}
   else{const h=(city?5:8)+Math.sin(j*1.31)*1.2;treePositions.push([x,z,h]);venueLifeAudit.planting.push({x,z,r:3,type:'mapped green-space tree'});}
   putDensity(x,z);record.trees++;
  }
  // Arid detail is only on sand/scrub, never on paved runoff or access roads.
  if(dry)for(const side of[-1,1])for(let j=0;j<4;j++){
   const p=venuePoint(station/N,side,38+j*13);
   if(!clear(p.x,p.z,3)||geography&&!atFeature(p.x,p.z,features.filter(f=>f.kind==='sand'||f.kind==='grass')))continue;
   const s={...p,y:terrainY(p.x,p.z),a:j*.8};for(let k=0;k<4;k++)piece(s,'rock',j%2?'foliage':'stone',(k-1.5)*1.4,.35,Math.sin(k*2)*1.2,.65+k*.17,.5+k*.11,.6,0,k*.4);record.features++;
  }
  venueLifeAudit.sectors.push(record);
 }
 const pavingMat=new T.MeshStandardMaterial({map:asphalt,normalMap:asphaltNormal,normalScale:new T.Vector2(.12,.12),color:linear(dry?0xc4b8a4:0xa6aaa7),roughness:.94,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 for(const b of surfaceBatches.values()){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('uv',new T.Float32BufferAttribute(b.uv,2));g.computeVertexNormals();
  const m=new T.Mesh(g,pavingMat);m.name=b.name;m.receiveShadow=true;m.userData.venueAccess=true;scene.add(m);venueLifeAudit.triangles+=b.p.length/9;
 }
 for(const batch of batches.values()){
  const mesh=new T.InstancedMesh(geo[batch.kind],material[batch.mat],batch.items.length);mesh.name='Venue life '+profile+' '+batch.kind;mesh.castShadow=['box','canopy','body'].includes(batch.kind);mesh.receiveShadow=true;
  batch.items.forEach((p,i)=>{mesh.setMatrixAt(i,p.matrix);if(p.color!==undefined)mesh.setColorAt(i,linear(p.color))});scene.add(mesh);venueLifeAudit.instances+=mesh.count;venueLifeAudit.triangles+=mesh.count*(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;
 }
})();
