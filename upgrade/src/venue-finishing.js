// Venue-specific civil geometry. Horizontal alignments are mapped; unmeasured
// facade, cliff and ride heights remain documented visual reconstructions.
const venueFinishAudit={cliffs:[],tunnel:null,rides:[],wheel:null};
function buildCircuitWheel(x,z){
 const g=new T.Group();g.name='Suzuka Circuit Wheel';g.position.set(x,groundHeight(x,z),z);g.rotation.y=.3;scene.add(g);const red=M(0xaf2b32,.35,.5),white=M(0xe4e4db,.35,.5),glass=M(0x355d6b,.55,.2),radius=22,centre=27,spokes=[],supports=[],pods=[],podGlass=[];
 for(const depth of[-1.8,1.8])landmarkMesh(g,new T.TorusGeometry(radius,.24,6,112),white,0,centre,depth);
 for(let i=0;i<32;i++){const t=i/32*Math.PI*2,xx=Math.cos(t)*radius,yy=centre+Math.sin(t)*radius;for(const d of[-1.8,1.8])spokes.push([[0,centre,d],[xx,yy,d],.055]);spokes.push([[xx,yy,-1.8],[xx,yy,1.8],.09]);pods.push([xx,yy-.7,0,1.8,1.7,2.4]);podGlass.push([xx,yy-.65,-1.22,1.3,.9,.07],[xx,yy-.65,1.22,1.3,.9,.07]);}
 for(const d of[-4.5,4.5]){supports.push([[-12,0,d*1.4],[0,centre,d],.7],[[12,0,d*1.4],[0,centre,d],.7]);for(let k=1;k<7;k++){const y=k*3.6,w=12*(1-y/centre);supports.push([[-w,y,d],[w,y,d],.22],[[0,y-3.6,d],[w,y,d],.16])}}
 beams(g,spokes,white);beams(g,supports,red);instanceBoxes(g,red,pods);instanceBoxes(g,glass,podGlass);instanceBoxes(g,white,[[0,1,0,16,2,10]]);return g;
}
function venueRibbon(name,rows,material){
 const P=[],U=[],I=[];for(let i=0;i<rows.length;i++)for(let j=0;j<rows[i].length;j++){P.push(...rows[i][j]);U.push(i/2,j/2);if(i&&j){const n=rows[i].length,k=i*n+j;I.push(k-n-1,k-n,k-1,k-1,k-n,k)}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();g.computeBoundingSphere();const m=new T.Mesh(g,material);m.name=name;m.castShadow=m.receiveShadow=true;scene.add(m);return m;
}
function resampleVenuePath(p,spacing=5){const result=[];for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/spacing));for(let j=0;j<n;j++)result.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n])}return result.concat([p.at(-1)]);}
function buildMonacoCliffs(){
 const rock=new T.MeshStandardMaterial({color:linear(0xbfc0b8),map:gravel,normalMap:asphaltNormal,normalScale:new T.Vector2(.5,.5),roughness:.97,side:T.DoubleSide});
 const outcrops=[],o=new T.Object3D(),roads=geography.features.filter(f=>f.kind==='road');
 const nearRoad=(x,z)=>roads.some(f=>f.points.some((a,i)=>{if(!i)return false;const b=f.points[i-1],dx=b[0]-a[0],dz=b[1]-a[1],u=clamp(((x-a[0])*dx+(z-a[1])*dz)/Math.max(1e-8,dx*dx+dz*dz),0,1);return Math.hypot(x-a[0]-dx*u,z-a[1]-dz*u)<(f.width||5)/2+5}));
 for(const f of contextHere.infrastructure.filter(f=>f.type==='cliff')){
  if(!f.terrainMesh?.length)continue;const P=f.terrainMesh.flat(),U=f.terrainMesh.flatMap(p=>[p[0]/6,p[2]/6]),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(f.terrainMesh.map((_,i)=>i));g.computeVertexNormals();g.computeBoundingSphere();const mesh=new T.Mesh(g,rock);mesh.name='Mapped Monaco limestone cliff '+f.id;mesh.userData.cliff=true;mesh.receiveShadow=true;scene.add(mesh);
  const y=f.terrainMesh.map(p=>p[1]);venueFinishAudit.cliffs.push({id:f.id,vertices:f.terrainMesh.length,maxRelief:Math.max(...y)-Math.min(...y),terrainJoined:true});
  // Solid fractured outcrops are embedded in the cliff slope. Their small-scale
  // form is reconstructed; mapped roads and building footprints remain clear.
  for(const [i,p]of resampleVenuePath(f.points,12).entries()){const [x,z]=p,q=prog(x,z,-1);if(buildingAt(x,z,5)||nearRoad(x,z)||Math.hypot(x-cx[q.i],z-cz[q.i])<Math.abs(trackBarrier(q.i,Math.sign(q.d)))+10)continue;const h=1.2+(Math.sin(x*.7+z*.3)+1)*.7;outcrops.push([x,groundHeight(x,z)-h*.3,z,2.1,h,1.8,i*.74]);}
 }
 const rocks=new T.InstancedMesh(new T.DodecahedronGeometry(1,1),rock,outcrops.length);rocks.name='Monaco fractured limestone outcrops';outcrops.forEach((p,i)=>{o.position.set(p[0],p[1],p[2]);o.scale.set(p[3],p[4],p[5]);o.rotation.set(.2,p[6],.4);o.updateMatrix();rocks.setMatrixAt(i,o.matrix)});rocks.castShadow=rocks.receiveShadow=true;scene.add(rocks);
}
function buildMonacoTunnel(){
 const [start,end]=CIRCUIT.features.tunnel,roof=[],inland=[],sill=[],columns=[],ribs=[],lamps=[],fixtures=[],drains=[];
 const mid=Math.round((start+end)/2),sea=geoPoint(7.4309,43.7381),seaSide=Math.sign((sea.x-cx[mid])*nx[mid]+(sea.z-cz[mid])*nz[mid])||1;
 const shell=new T.MeshStandardMaterial({color:linear(0x777d7b),map:barrierColor,normalMap:barrierNormal,normalScale:new T.Vector2(.14,.14),roughness:.91,side:T.DoubleSide});
 const liner=new T.MeshStandardMaterial({color:linear(0x9a9b8f),roughness:.81,normalMap:barrierNormal,normalScale:new T.Vector2(.08,.08),side:T.DoubleSide});
 const warm=new T.MeshStandardMaterial({color:0xffe3ad,emissive:0xffce87,emissiveIntensity:2.5,toneMapped:false});
 let distance=0,lastColumn=-20,lastLamp=-20;
 for(let i=start;i<=end;i++){
  const left=trackHalf(i,-1)+1.35,right=trackHalf(i,1)+1.35,edge=seaSide<0?-left:right,inner=seaSide<0?right:-left,point=(d,y)=>[cx[i]+nx[i]*d,cy[i]+y,cz[i]+nz[i]*d];
  const row=[];for(let j=0;j<=8;j++){const t=j/8,d=-left+(left+right)*t;row.push(point(d,5.6+1.1*Math.sin(t*Math.PI)))}roof.push(row);inland.push([point(inner,0),point(inner,5.6)]);sill.push([point(edge,.15),point(edge,1.2)]);
  if(i>start)distance+=Math.hypot(cx[i]-cx[i-1],cz[i]-cz[i-1]);const angle=-Math.atan2(tz[i],tx[i]);
  if(distance-lastColumn>=7.8||i===end){lastColumn=distance;columns.push([...point(edge,2.95),.75,5.9,.9,0,angle]);ribs.push([...point((right-left)/2,6),.25,.45,left+right,0,angle]);}
  if(distance-lastLamp>=11){lastLamp=distance;for(const d of[-left*.55,right*.55]){fixtures.push([...point(d,6.15),2.8,.18,.48,0,angle]);lamps.push([...point(d,6.04),2.4,.035,.25,0,angle]);}}
  for(const d of[-left+.3,right-.3])drains.push([...point(d,.06),LEN/N+.06,.08,.25,0,angle]);
 }
 const meshes=[venueRibbon('Louis II continuous tunnel soffit',roof,shell),venueRibbon('Louis II inland retaining wall',inland,liner),venueRibbon('Louis II seaward balustrade',sill,liner)];meshes.forEach(m=>m.userData.tunnel=true);
 // Parent-relative arrays already contain road elevation; do not add terrain twice.
 const g=new T.Group();g.name='Louis II colonnade and luminaires';scene.add(g);instanceBoxes(g,liner,columns);instanceBoxes(g,shell,ribs);instanceBoxes(g,landmarkDark,fixtures);instanceBoxes(g,warm,lamps,false,false);instanceBoxes(g,landmarkDark,drains);
 for(const station of[start,end]){const width=trackHalf(station,-1)+trackHalf(station,1)+2.7,a=-Math.atan2(tz[station],tx[station]);instanceBoxes(g,paleStone,[[cx[station],cy[station]+6.7,cz[station],1.1,1.2,width,0,a]])}
 // Two soft fill sources, no per-bay shadow maps. Daylight comes through the sea side.
 for(const f of[.32,.72]){const i=Math.round(start+(end-start)*f),light=new T.PointLight(0xffdab0,.75,100,1.6);light.position.set(cx[i],cy[i]+4.7,cz[i]);scene.add(light)}
 venueFinishAudit.tunnel={start,end,length:distance,seaSide,bays:columns.length,minClearance:5.6,continuous:true};
}
function joinRideWays(features){const todo=features.map(f=>f.points.slice()),paths=[];while(todo.length){let p=todo.shift(),changed=true;while(changed){changed=false;for(let i=0;i<todo.length;i++){const q=todo[i],same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.1;if(same(p.at(-1),q[0]))p=p.concat(q.slice(1));else if(same(p.at(-1),q.at(-1)))p=p.concat(q.slice(0,-1).reverse());else if(same(p[0],q.at(-1)))p=q.slice(0,-1).concat(p);else if(same(p[0],q[0]))p=q.slice(1).reverse().concat(p);else continue;todo.splice(i,1);changed=true;break;}}paths.push(p)}return paths;}
function parkCoaster(points,name,type){
 const samples=resampleVenuePath(points,3),base=samples.reduce((sum,p)=>sum+groundHeight(...p),0)/samples.length,closed=Math.hypot(...[samples[0][0]-samples.at(-1)[0],samples[0][1]-samples.at(-1)[1]])<1;
 const raw=samples.filter((_,i)=>i%3===0||i===samples.length-1),vectors=raw.map((p,i)=>{const u=i/Math.max(1,raw.length-1),lift=type==='gp'?3.5+13*Math.pow(Math.sin(Math.PI*u),2):type==='rocky'?4+14*Math.pow(Math.sin(Math.PI*u*2),4):3+7*Math.pow(Math.sin(Math.PI*u),2);return new T.Vector3(p[0],Math.max(base,groundHeight(...p))+lift,p[1])}),curve=new T.CatmullRomCurve3(vectors,closed,'centripetal'),length=curve.getLength(),n=Math.ceil(length/2.5),steel=type==='gp'?venueMetal:M(0x544936,.4,.76),supportMat=type==='adventure'?plaster:steel;
 const g=new T.Group();g.name=name;scene.add(g);const rails=[[],[]],beamsList=[],supports=[],feet=[],ties=[];
 for(let i=0;i<=n;i++){const t=i/n,p=curve.getPointAt(t),dir=curve.getTangentAt(t),normal=new T.Vector3(-dir.z,0,dir.x).normalize();for(const [j,sign]of[-1,1].entries())rails[j].push(p.clone().addScaledVector(normal,sign*(type==='gp'?.8:.65)));if(i%2===0)ties.push([p.clone().addScaledVector(normal,-.95).toArray(),p.clone().addScaledVector(normal,.95).toArray(),.10]);
  if(i%5===0){const ground=groundHeight(p.x,p.z);supports.push([[p.x,ground,p.z],p.toArray(),.32]);feet.push([p.x,ground+.2,p.z,1.4,.4,1.4]);if(i%10===0)supports.push([[p.x+normal.x*3,ground,p.z+normal.z*3],p.toArray(),.18]);}}
 for(const path of rails){const railCurve=new T.CatmullRomCurve3(path,closed,'centripetal');landmarkMesh(g,new T.TubeGeometry(railCurve,n,.115,6,closed),steel)}
 beams(g,supports,supportMat);beams(g,ties,steel);instanceBoxes(g,concrete,feet);
 // Static exhibit train avoids idle animation work outside the racing scene.
 const cars=[];for(let i=0;i<(type==='rocky'?5:2);i++){const t=.31-i*3/length,p=curve.getPointAt(Math.max(0,t)),dir=curve.getTangentAt(Math.max(0,t));cars.push([p.x,p.y+.7,p.z,2.3,1.1,1.3,0,-Math.atan2(dir.z,dir.x)])}instanceBoxes(g,type==='rocky'?plaster:M(0x82927e,.2,.5),cars);
 venueFinishAudit.rides.push({name,type,length,samples:n,alignment:type==='gp'?'Official park map reconstruction':'OpenStreetMap mapped alignment',verticalProfile:'Estimated from venue photographs'});
}
function buildSuzukaPark(){
 venueFinishAudit.wheel={overallHeight:50,source:'https://www.suzukacircuit.jp/park/attraction/circuit-wheel/'};
 for(const type of['rocky-coaster','adventure-drive'])for(const path of joinRideWays(contextHere.infrastructure.filter(f=>f.type===type)))parkCoaster(path,type==='rocky-coaster'?'Rocky Coaster':'Adventure Drive',type==='rocky-coaster'?'rocky':'adventure');
 // Park roads follow their own mapped layouts; never lay them on the GP track.
 const groups=new Map();for(const f of contextHere.infrastructure.filter(f=>f.type==='park-road')){if(!groups.has(f.name))groups.set(f.name,[]);groups.get(f.name).push(f)}
 for(const[name,features]of groups){const rows=[];for(const f of features){const p=resampleVenuePath(f.points,4);for(let i=1;i<p.length;i++){const a=p[i-1],b=p[i],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,q=prog(x,z,-1);if(Math.hypot(x-cx[q.i],z-cz[q.i])<trackHalf(q.i,Math.sign(q.d))+6)continue;rows.push([x,groundHeight(x,z)+.1,z,Math.hypot(b[0]-a[0],b[1]-a[1])+.1,.16,3.2,0,-Math.atan2(b[1]-a[1],b[0]-a[0])])}}const g=new T.Group();g.name='Suzuka park '+name;scene.add(g);instanceBoxes(g,M(0x646563,0,.95),rows);venueFinishAudit.rides.push({name,type:'park-road',segments:rows.length,alignment:'OpenStreetMap'})}
 // GP Racers dual track: located between GP Square and the race circuit.
 const gps=[[136.54046,34.84566],[136.54068,34.8455],[136.54048,34.84527],[136.54014,34.84509],[136.53989,34.84509],[136.53977,34.84523],[136.54004,34.84545],[136.54037,34.8455],[136.54049,34.84538],[136.54028,34.84524],[136.54009,34.84527],[136.54016,34.84545],[136.54046,34.84566]],gp=gps.map(([lon,lat])=>{const p=geoPoint(lon,lat);return[p.x,p.z]});
 for(const shift of[-1.7,1.7])parkCoaster(gp.map(p=>[p[0]+shift,p[1]]),'GP Racers '+(shift<0?'red':'blue'),'gp');
}
if(CIRCUIT.id==='monaco'){buildMonacoCliffs();buildMonacoTunnel()}
if(CIRCUIT.id==='suzuka')buildSuzukaPark();
