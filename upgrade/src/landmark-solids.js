// Reference-led reconstructions, not survey/BIM assets. All envelopes are closed
// and exported to the native build; distant detail is carried by shared materials.
function solidRoof(positions,indices,thickness){
 const n=positions.length/3,P=positions.slice(),I=[],edges=new Map();
 for(let k=0;k<n;k++)P.push(positions[k*3],positions[k*3+1]-thickness,positions[k*3+2]);
 for(let k=0;k<indices.length;k+=3){let[a,b,c]=indices.slice(k,k+3);const ax=P[b*3]-P[a*3],az=P[b*3+2]-P[a*3+2],bx=P[c*3]-P[a*3],bz=P[c*3+2]-P[a*3+2];if(az*bx-ax*bz<0)[b,c]=[c,b];I.push(a,b,c,c+n,b+n,a+n);for(const[x,y]of[[a,b],[b,c],[c,a]]){const key=Math.min(x,y)+':'+Math.max(x,y);if(edges.has(key))edges.delete(key);else edges.set(key,[x,y]);}}
 for(const[a,b]of edges.values())I.push(b,a,a+n,b,a+n,b+n);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();g.userData.closedEnvelope=true;return g;
}
function rectangleLoft(profile,steps=55){
 const P=[],U=[],I=[],g=new T.BufferGeometry();
 // Separate side vertices retain crisp stone/glass corners and independent UVs.
 for(let side=0;side<4;side++){
  const start=P.length/3;
  for(let j=0;j<=steps;j++){const p=profile(j/steps),corners=[[-p.w/2,-p.d/2],[p.w/2,-p.d/2],[p.w/2,p.d/2],[-p.w/2,p.d/2]];for(const k of[side,(side+1)%4]){P.push(corners[k][0]+(p.x||0),p.y,corners[k][1]+p.z);U.push(k===side?0:1,j/steps);}}
  const begin=I.length;for(let j=0;j<steps;j++){const a=start+j*2;I.push(a,a+2,a+1,a+1,a+2,a+3)}g.addGroup(begin,I.length-begin,side%2===0?0:1);
 }
 for(const top of[0,1]){const p=profile(top),k=P.length/3;P.push(-p.w/2+(p.x||0),p.y,p.z-p.d/2,p.w/2+(p.x||0),p.y,p.z-p.d/2,p.w/2+(p.x||0),p.y,p.z+p.d/2,-p.w/2+(p.x||0),p.y,p.z+p.d/2);U.push(0,0,1,0,1,1,0,1);const begin=I.length;if(top)I.push(k,k+2,k+1,k,k+3,k+2);else I.push(k,k+1,k+2,k,k+2,k+3);g.addGroup(begin,6,1);}
 g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.setIndex(I);g.computeVertexNormals();g.userData.closedEnvelope=true;return g;
}
function buildMarinaBaySands(towers){
 if(towers.length!==3)return;
 const centres=towers.map(landmarkCentre),dx=centres[2][0]-centres[0][0],dz=centres[2][1]-centres[0][1],axis=Math.atan2(dz,dx),co=Math.cos(axis),si=Math.sin(axis),mid=centres[1],base=groundHeight(...mid),roof=base+193;
 const stone=new T.MeshStandardMaterial({color:linear(0xdad4c4),metalness:.12,roughness:.52,envMapIntensity:.65,emissive:isNight?0x75532c:0,emissiveIntensity:.16});
 const map=canvasTex(512,2048,(c,w,h)=>{c.fillStyle='#1b3035';c.fillRect(0,0,w,h);for(let floor=0;floor<55;floor++)for(let col=0;col<18;col++){const x=col*w/18,y=floor*h/55,lit=((floor*71+col*37)%23)<4;c.fillStyle=isNight&&lit?['#c6aa70','#d7bd8e','#b5945e'][(floor+col)%3]:['#263d42','#2b4247','#20383f','#344b50'][(floor*3+col)%4];c.fillRect(x+1,y+2,w/18-2,h/55-4);c.fillStyle='#8b948e';c.fillRect(x,y,w/18,1.7);c.fillStyle='#293c40';c.fillRect(x,y+2,1,h/55-2);}});
 const glass=new T.MeshStandardMaterial({map,color:0x61777b,metalness:.22,roughness:.42,envMapIntensity:.38,emissiveMap:isNight?map:null,emissive:0xffffff,emissiveIntensity:isNight?.13:0});
 const built=[],towerTops=[];
 towers.forEach((f,index)=>{
  const pts=f.points.slice(0,-1),edges=pts.map((a,i)=>{const b=pts[(i+1)%pts.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);return{angle:Math.atan2(dz,dx),score:len*Math.abs((dx*co+dz*si)/len)**6}}).sort((a,b)=>b.score-a.score);let angle=edges[0].angle;if(Math.cos(angle-axis)<0)angle+=Math.PI;
  const c=Math.cos(angle),s=Math.sin(angle),local=pts.map(p=>[(p[0]-centres[index][0])*c+(p[1]-centres[index][1])*s,-(p[0]-centres[index][0])*s+(p[1]-centres[index][1])*c]),xs=local.map(p=>p[0]),zs=local.map(p=>p[1]),ox=(Math.min(...xs)+Math.max(...xs))/2,oz=(Math.min(...zs)+Math.max(...zs))/2,W=Math.max(...xs)-Math.min(...xs),D=Math.max(...zs)-Math.min(...zs),centre=[centres[index][0]+c*ox-s*oz,centres[index][1]+s*ox+c*oz];
  const g=new T.Group();g.name=f.name+' curved twin slabs';g.userData.landmark=f.id;g.position.set(centre[0],groundHeight(...centre)-.5,centre[1]);g.rotation.y=-angle;scene.add(g);const H=roof-g.position.y;
  for(const leg of[-1,1]){
   const profile=u=>({w:W*(1-.035*u),d:13.8,y:u*H,z:leg*(7.1+(D*.5-14.1)*(1-u)**(leg===1?2.15:1.2)),x:leg*1.2*u});
   const m=landmarkMesh(g,rectangleLoft(profile),[glass,stone]);m.name=f.name+(leg===1?' curved eastern wing':' bay wing');
   const bands=[];for(let floor=1;floor<=55;floor++){const p=profile(floor/55);bands.push([p.x,p.y,p.z,p.w+.1,.19,p.d+.32]);}const bandMesh=instanceBoxes(g,stone,bands);bandMesh.name=f.name+' floor ledges';
   // Continuous pale end fins follow the same curve as the glazing.
   for(const side of[-1,1]){const fin=u=>{const p=profile(u);return{...p,x:(p.x||0)+side*(p.w/2-1.05),w:2.1,d:p.d+.35}};const edge=landmarkMesh(g,rectangleLoft(fin),[stone,stone]);edge.name=f.name+' curved stone fin';}
  }
  // Inset atrium glazing only below the point where the two legs converge.
  const atrium=landmarkMesh(g,new T.BoxGeometry(W*.68,H*.20,.35),glass,0,H*.10,0);atrium.name=f.name+' atrium';
  const roofRoom=landmarkMesh(g,new T.BoxGeometry(W*.86,3.8,24),glass,0,H+1.9,0);roofRoom.name=f.name+' roof pavilion';
  built.push({id:f.id,name:f.name,position:g.position.toArray(),width:W,baseDepth:D,roofDatum:roof,closedSlabs:2});towerTops.push([(centre[0]-mid[0])*co+(centre[1]-mid[1])*si,-(centre[0]-mid[0])*si+(centre[1]-mid[1])*co]);
 });
 const park=new T.Group();park.name='Marina Bay Sands SkyPark';park.userData.landmark='mbs-skypark';park.position.set(mid[0],base,mid[1]);park.rotation.y=-axis;scene.add(park);
 let x0=towerTops[0][0]-32,x1=x0+340,outline=[];
 // A 340 x 38 m boat-shaped plan, with the long public cantilever beyond Tower 3.
 const halfWidth=t=>19*Math.sqrt(Math.max(0,1-(t*2-1)**8));
 for(let i=0;i<=64;i++){const t=i/64;outline.push([x0+340*t,-halfWidth(t)]);}for(let i=63;i>0;i--){const t=i/64;outline.push([x0+340*t,halfWidth(t)]);}
 const mappedPark=mappedBuildings.find(f=>f.id===116800998);
 if(mappedPark){outline=mappedPark.footprint.map(p=>[(p[0]-mid[0])*co+(p[1]-mid[1])*si,-(p[0]-mid[0])*si+(p[1]-mid[1])*co]);x0=Math.min(...outline.map(p=>p[0]));x1=Math.max(...outline.map(p=>p[0]));}
 const deckCentre=x=>{const zs=[];for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];if((a[0]<=x&&b[0]>x)||(b[0]<=x&&a[0]>x))zs.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));}return zs.length?(Math.min(...zs)+Math.max(...zs))/2:0;};
 const shape=new T.Shape(outline.map(p=>new T.Vector2(p[0],-p[1]))),deck=landmarkMesh(park,new T.ExtrudeGeometry(shape,{depth:5.5,bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:1.2,bevelThickness:1.2}),stone,0,194,0);deck.name='MBS SkyPark closed hull';deck.rotation.x=-Math.PI/2;
 const deckY=200.75,deckMaterial=M(0xaa9c7d,.08,.78),gardenMaterial=M(0x395633,0,.95),poolMaterial=new T.MeshPhysicalMaterial({color:0x3b9baf,metalness:.25,roughness:.16,clearcoat:.8});
 const paving=landmarkMesh(park,new T.ShapeGeometry(shape,48),deckMaterial,0,deckY,0);paving.rotation.x=-Math.PI/2;paving.name='MBS rooftop terrace';
 const poolSegments=[];for(let i=0;i<30;i++){const x=x0+38+i*5,z=deckCentre(x)-10;poolSegments.push([x,deckY+.15,z,5.1,.20,9.4,0,-Math.atan2(deckCentre(x+2)-deckCentre(x-2),4)]);}const pool=instanceBoxes(park,poolMaterial,poolSegments);pool.name='MBS infinity pool';
 const gardens=[],planters=[],rails=[];for(let x=x0+18;x<x1-67;x+=19){const z=deckCentre(x)+7;gardens.push([x,deckY+.25,z,14,.35,9]);planters.push([x,deckY+.6,z,14,.45,.25]);}
 instanceBoxes(park,gardenMaterial,gardens);instanceBoxes(park,stone,planters);
 const trunkGeo=new T.CylinderGeometry(.15,.22,3.2,6),crownGeo=new T.SphereGeometry(1.6,7,5),trunks=new T.InstancedMesh(trunkGeo,M(0x685745,0,.9),30),crowns=new T.InstancedMesh(crownGeo,gardenMaterial,30),o=new T.Object3D();
 for(let i=0;i<30;i++){const x=x0+18+(i%15)*16;o.position.set(x,deckY+1.6,deckCentre(x)+(i<15?10:4));o.scale.set(1,1,1);o.updateMatrix();trunks.setMatrixAt(i,o.matrix);o.position.y=deckY+3.8;o.scale.set(1,1.1,1);o.updateMatrix();crowns.setMatrixAt(i,o.matrix);}park.add(trunks,crowns);trunks.name='MBS rooftop garden trunks';crowns.name='MBS rooftop garden crowns';
 for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];rails.push([[a[0],deckY+1.25,a[1]],[b[0],deckY+1.25,b[1]],.07]);if(i%2===0)rails.push([[a[0],deckY,a[1]],[a[0],deckY+1.25,a[1]],.055]);}beams(park,rails,stone);
 const pavilions=instanceBoxes(park,glass,[[x0+60,deckY+2.3,deckCentre(x0+60)+6,25,4.6,13],[x0+190,deckY+2.3,deckCentre(x0+190)+6,30,4.6,13]]);pavilions.name='MBS rooftop restaurants';
 const audit={name:'Marina Bay Sands',type:'mbs',id:'mbs',position:[mid[0],base,mid[1]],height:207,span:340,towers:built,skypark:{length:340,width:38,northOverhang:x1-towerTops[2][0]},sources:['https://www.safdiearchitects.com/projects/marina-bay-sands-integrated-resort','https://www.arup.com/en-us/projects/marina-bay-sands-integrated-resort/']};landmarkAudit.push(audit);venueObjects.push({kind:'mapped-landmark',...audit});
}
