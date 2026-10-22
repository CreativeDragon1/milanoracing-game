// Per-venue civil detail, baked from source geometry and draped onto terrain.
const CALENDAR_ENVIRONMENTS=__CALENDAR_ENVIRONMENTS__,calendarHere=CALENDAR_ENVIRONMENTS[CIRCUIT.id];
const calendarAudit={surfaceTiles:0,surfaceTriangles:0,planting:0,boundarySegments:0,spectatorSections:0};
if(calendarHere){
 // Keep asynchronous loader-owned textures; cloning before onLoad leaves an empty image.
 const lawnMap=photoGrass,sandMap=photoSand,lawnNormal=photoGrassNormal,sandNormal=photoSandNormal;
 const materials={
  lawn:new T.MeshStandardMaterial({map:lawnMap,normalMap:lawnNormal,normalScale:new T.Vector2(.3,.3),color:linear(0x8caa71),roughness:.98}),
  meadow:new T.MeshStandardMaterial({map:lawnMap,normalMap:lawnNormal,normalScale:new T.Vector2(.45,.45),color:linear(0x919c69),roughness:1}),
  scrub:new T.MeshStandardMaterial({map:lawnMap,color:linear(THEME==='dunes'?0xb6aa78:0x8c956a),roughness:1}),
  sand:new T.MeshStandardMaterial({map:sandMap,normalMap:sandNormal,normalScale:new T.Vector2(.5,.5),color:linear(0xd6c4a4),roughness:1}),
  gravel:new T.MeshStandardMaterial({map:gravel,normalMap:gravelNormal,normalScale:new T.Vector2(.7,.7),roughnessMap:gravelRough,color:linear(0xf3eee5),roughness:.94}),
  asphalt:new T.MeshStandardMaterial({map:asphalt,normalMap:asphaltNormal,normalScale:new T.Vector2(.25,.25),color:linear(0x959a9b),roughness:.94})
 };
 for(const m of Object.values(materials)){m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-2;}
 for(const tile of calendarHere.tiles){const p=new Float32Array(Uint8Array.from(atob(tile.positions),c=>c.charCodeAt(0)).buffer),g=new T.BufferGeometry(),uv=new Float32Array(p.length/3*2);for(let i=0;i<p.length/3;i++){const scale=['lawn','meadow','scrub','sand'].includes(tile.kind)?4500:6;uv[i*2]=['lawn','meadow','scrub','sand'].includes(tile.kind)?p[i*3]/6000+.5:p[i*3]/(tile.kind==='gravel'?2.4:6);uv[i*2+1]=['lawn','meadow','scrub','sand'].includes(tile.kind)?-p[i*3+2]/6000+.5:p[i*3+2]/(tile.kind==='gravel'?2.4:6)}g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('uv',new T.BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingSphere();const m=new T.Mesh(g,materials[tile.kind]);m.name='Mapped '+tile.kind+' ground detail';m.userData.calendarGround=true;m.receiveShadow=true;scene.add(m);calendarAudit.surfaceTiles++;calendarAudit.surfaceTriangles+=p.length/9;}
 // Replace sparse random planting locally; real source rows remain aligned.
 const occupied=new Set(treePositions.map(p=>Math.floor(p[0]/7)+':'+Math.floor(p[1]/7)));
 const palms=[];
 for(const [x,z,h] of calendarHere.planting){const key=Math.floor(x/7)+':'+Math.floor(z/7);if(occupied.has(key)||!clearSite(x,z,3))continue;occupied.add(key);if(['bahrain','abu-dhabi'].includes(CIRCUIT.id))palms.push([x,z,h]);else treePositions.push([x,z,h]);calendarAudit.planting++;}
 if(palms.length){
  const trunkGeo=new T.CylinderGeometry(.18,.34,1,7),crownGeo=new T.BufferGeometry(),P=[],I=[];
  // Drooping compound fronds: separate leaflets give depth rather than flat discs.
  for(let f=0;f<9;f++){const angle=f/9*Math.PI*2;for(let j=0;j<12;j++){const u=j/12,r=.25+u*3.5,y=Math.sin(u*Math.PI)*1.2-u*u*1.4,w=(1-u)*.55+.08;for(const side of[-1,1]){const k=P.length/3;for(const [rr,yy,ss]of[[r,y,0],[r+.48,y-.1,side*w],[r+.28,y+.035,0]])P.push(Math.cos(angle)*rr-Math.sin(angle)*ss,yy,Math.sin(angle)*rr+Math.cos(angle)*ss);I.push(k,k+1,k+2);}}}
  crownGeo.setAttribute('position',new T.Float32BufferAttribute(P,3));crownGeo.setIndex(I);crownGeo.computeVertexNormals();
  const stems=new T.InstancedMesh(trunkGeo,M(0x8c7961,.02,.98),palms.length),crowns=new T.InstancedMesh(crownGeo,new T.MeshStandardMaterial({color:linear(0x527047),roughness:.94,side:T.DoubleSide}),palms.length),o=new T.Object3D();
  palms.forEach(([x,z,h],i)=>{const y=groundHeight(x,z);o.position.set(x,y+h/2,z);o.scale.set(1,h,1);o.rotation.set(0,0,0);o.updateMatrix();stems.setMatrixAt(i,o.matrix);o.position.set(x,y+h,z);o.scale.setScalar(.8+h/18);o.rotation.y=i*1.73;o.updateMatrix();crowns.setMatrixAt(i,o.matrix)});stems.name='Mapped palm avenue trunks';crowns.name='Mapped palm avenue fronds';stems.castShadow=crowns.castShadow=true;stems.receiveShadow=crowns.receiveShadow=true;scene.add(stems,crowns);
 }
 const wallRows=[],hedgeRows=[],railRows=[];
 for(const f of calendarHere.boundaries){for(let i=1;i<f.points.length;i++){const a=f.points[i-1],b=f.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),n=Math.ceil(len/5);for(let j=0;j<n;j++){const x=a[0]+dx*(j+.5)/n,z=a[1]+dz*(j+.5)/n,p=prog(x,z,-1);if(Math.hypot(x-cx[p.i],z-cz[p.i])<Math.abs(trackBarrier(p.i,Math.sign(p.d)))+5||buildingAt(x,z,1))continue;const angle=-Math.atan2(dz,dx);if(f.type==='hedge')hedgeRows.push([x,.8,z,len/n+.15,1.6,1.2,0,angle]);else if(f.type==='guard_rail'){for(const h of[.45,.72])railRows.push([x,h,z,len/n+.05,.22,.12,0,angle]);}else wallRows.push([x,.75,z,len/n+.1,1.5,.55,0,angle]);calendarAudit.boundarySegments++;}}}
 instanceBoxes(scene,M(0x536246,0,1),hedgeRows);instanceBoxes(scene,paleStone,wallRows);instanceBoxes(scene,venueMetal,railRows);
 for(const f of calendarHere.bleachers){const g=mappedGrandstand({...f,height:5},8);if(g)calendarAudit.spectatorSections++;}
}
