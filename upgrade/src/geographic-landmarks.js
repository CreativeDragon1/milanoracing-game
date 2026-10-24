// Key landmark envelopes use actual OSM positions; detailed architectural surfaces are approximations.
const GEO_LANDMARKS=__GEO_LANDMARKS__,landmarksHere=GEO_LANDMARKS[CIRCUIT.id]||[];
function landmarkCentre(f){const p=f.points.slice(0,-1),n=p.length;return p.reduce((a,v)=>[a[0]+v[0]/n,a[1]+v[1]/n],[0,0])}
function observedWheel(x,z,radius,centreHeight,rotation=0){const group=new T.Group();group.position.set(x,groundHeight(x,z),z);group.rotation.y=rotation;scene.add(group);const material=new T.MeshStandardMaterial({color:0xe4e8e8,metalness:.5,roughness:.35,emissive:isNight?0x356b93:0,emissiveIntensity:.6});for(const depth of[-2.5,2.5]){const ring=new T.Mesh(new T.TorusGeometry(radius,.65,8,120),material);ring.position.set(0,centreHeight,depth);group.add(ring)}const rods=[];for(let i=0;i<28;i++){const a=i/28*Math.PI*2,x=Math.cos(a)*radius,y=centreHeight+Math.sin(a)*radius;rods.push([[0,centreHeight,0],[x,y,0],.18]);const pod=new T.Mesh(new T.CylinderGeometry(2.2,2.2,7,10),venueGlass);pod.rotation.x=Math.PI/2;pod.position.set(x,y,0);group.add(pod)}rods.push([[-20,0,-15],[0,centreHeight,0],1.4],[[20,0,15],[0,centreHeight,0],1.4]);beams(group,rods,material);return group}
if(CIRCUIT.id==='singapore'){
 const towers=landmarksHere.filter(f=>f.name.startsWith('Marina Bay Sands Tower')).sort((a,b)=>a.name.localeCompare(b.name));
 buildMarinaBaySands(towers);
 const wheel=landmarksHere.find(f=>f.name==='Singapore Flyer');if(wheel){const p=landmarkCentre(wheel);observedWheel(...p,75,90,-.7);venueObjects.push({kind:'mapped-landmark',name:'Singapore Flyer',height:165,sourceWay:wheel.id})}
}
if(CIRCUIT.id==='bahrain'){
 const f=landmarksHere[0];if(f){const p=landmarkCentre(f),y=groundHeight(...p);const tower=new T.Mesh(new T.CylinderGeometry(15,22,44,64),venueGlass);tower.position.set(p[0],y+22,p[1]);scene.add(tower);const base=new T.Mesh(new T.CylinderGeometry(24,27,5,64),venueWhite);base.position.set(p[0],y+2.5,p[1]);scene.add(base);for(let h=6;h<46;h+=5){const ring=new T.Mesh(new T.CylinderGeometry(22-h*.13,22-h*.13,.8,64),venueWhite);ring.position.set(p[0],y+h,p[1]);scene.add(ring)}venueObjects.push({kind:'mapped-landmark',name:'Sakhir Tower',sourceWay:f.id})}
}
// Low-cost distant canopy volumes extend mapped forests beyond the individual near trees.
if(geography&&!urban&&!arid&&mappedForest.length){const points=[];for(let i=0;i<12000&&points.length<2800;i++){const f=mappedForest[Math.floor(rand()*mappedForest.length)],xs=f.footprint.map(p=>p[0]),zs=f.footprint.map(p=>p[1]),x=Math.min(...xs)+rand()*(Math.max(...xs)-Math.min(...xs)),z=Math.min(...zs)+rand()*(Math.max(...zs)-Math.min(...zs));if(!insideFootprint(x,z,f.footprint)||!clearSite(x,z,6))continue;const p=prog(x,z,-1);if(Math.abs(p.d)<120||geography.features.some(f=>f.kind==='water'&&insideFootprint(x,z,f.points)))continue;points.push([x,z,8+rand()*10]);}treePositions.push(...points);geographyAudit.distantTrees=points.length;}
if(geography&&!urban&&!arid){
 const used=new Set(),cover=geography.features.filter(f=>f.kind==='forest');let count=0;
 for(const f of cover){const xs=f.points.map(p=>p[0]),zs=f.points.map(p=>p[1]);for(let x=Math.min(...xs);x<Math.max(...xs)&&count<14000;x+=23)for(let z=Math.min(...zs);z<Math.max(...zs)&&count<14000;z+=23){const xx=x+rand()*15,zz=z+rand()*15,key=Math.floor(xx/16)+':'+Math.floor(zz/16);if(used.has(key)||!insideFootprint(xx,zz,f.points))continue;used.add(key);const p=prog(xx,zz,-1);if(Math.hypot(xx-cx[p.i],zz-cz[p.i])<260||buildingAt(xx,zz,8))continue;treePositions.push([xx,zz,12+rand()*9]);count++;}}
 geographyAudit.regionalForestTrees=count;
}
