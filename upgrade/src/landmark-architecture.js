// Authored venue forms registered to OSM footprints. Facade/roof dimensions are
// reconstructions from the linked venue/architect references, not survey models.
const landmarkAudit=[];
const landmarkStone=M(0xcfc9b9,.03,.82),landmarkTrim=M(0xe0dcd1,.12,.64),landmarkDark=M(0x283039,.45,.48),landmarkRoof=M(0x8d4634,.1,.87);
if(isNight){landmarkStone.emissive.setHex(0x8c662d);landmarkStone.emissiveIntensity=.18;landmarkTrim.emissive.setHex(0xb18a4a);landmarkTrim.emissiveIntensity=.12}
const architecturalModels={
 bahrain:{187123414:'tensile'},singapore:{938340113:'victoria',46595395:'fullerton',256163011:'esplanade',256163012:'esplanade'},
 monza:{34404652:'monza-pit'},monaco:{161769674:'casino'},austria:{118364939:'austria-pit',155581853:'chalet'},
 silverstone:{227332429:'wing'},'abu-dhabi':{168411369:'tensile',133907352:'tensile'},
 spa:{1134053908:'raidillon',77352246:'spa-pit'},suzuka:{184422099:'suzuka-pit'},interlagos:{33779114:'interlagos-pit'},zandvoort:{52473177:'zandvoort-pit'}
};
const EXTRA_LANDMARKS=__EXTRA_LANDMARKS__;
const VENUE_CONTEXT=__VENUE_CONTEXT__,contextHere=VENUE_CONTEXT[CIRCUIT.id]||{structures:[],infrastructure:[]};
const authoredIds=new Set(Object.keys(architecturalModels[CIRCUIT.id]||{}).map(Number));
contextHere.structures.forEach(f=>authoredIds.add(f.id));
(contextHere.replacedParts||[]).forEach(id=>authoredIds.add(id));
function landmarkMesh(parent,geometry,material,x=0,y=0,z=0){const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.staticArchitecture=true;parent.add(mesh);return mesh}
function landmarkFrame(f){
 const pts=f.footprint,centre=pts.reduce((a,p)=>[a[0]+p[0]/pts.length,a[1]+p[1]/pts.length],[0,0]);let longest=0,angle=0;
 pts.forEach((a,i)=>{const b=pts[(i+1)%pts.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length>longest){longest=length;angle=Math.atan2(b[1]-a[1],b[0]-a[0])}});
 const co=Math.cos(angle),si=Math.sin(angle),local=pts.map(p=>[(p[0]-centre[0])*co+(p[1]-centre[1])*si,-(p[0]-centre[0])*si+(p[1]-centre[1])*co]);
 const ox=(Math.min(...local.map(p=>p[0]))+Math.max(...local.map(p=>p[0])))/2,oz=(Math.min(...local.map(p=>p[1]))+Math.max(...local.map(p=>p[1])))/2;centre[0]+=ox*co-oz*si;centre[1]+=ox*si+oz*co;local.forEach(p=>{p[0]-=ox;p[1]-=oz});
 const minX=Math.min(...local.map(p=>p[0])),maxX=Math.max(...local.map(p=>p[0])),minZ=Math.min(...local.map(p=>p[1])),maxZ=Math.max(...local.map(p=>p[1]));
 const group=new T.Group();group.name=f.name||'Venue architecture';group.position.set(centre[0],groundHeight(...centre),centre[1]);group.rotation.y=-angle;scene.add(group);
 const holes=(f.holes||[]).map(h=>h.map(p=>[(p[0]-centre[0])*co+(p[1]-centre[1])*si,-(p[0]-centre[0])*si+(p[1]-centre[1])*co]));
 const roof=(f.roofMesh||[]).map(p=>[(p[0]-centre[0])*co+(p[1]-centre[1])*si,p[2],-(p[0]-centre[0])*si+(p[1]-centre[1])*co]);
 return{group,local,holes,roof,centre,angle,L:maxX-minX,D:maxZ-minZ,minX,maxX,minZ,maxZ};
}
function mappedStorey(a,height,y,material){const s=new T.Shape(a.local.map(p=>new T.Vector2(p[0],-p[1])));for(const hole of a.holes)s.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],-p[1]))));const m=landmarkMesh(a.group,new T.ExtrudeGeometry(s,{depth:height,bevelEnabled:false}),material,0,y,0);m.rotation.x=-Math.PI/2;return m;}
function footprintRoof(a,y,material,rise=3){
 if(a.roof.length){const g=new T.BufferGeometry(),P=[],U=[];for(const p of a.roof){P.push(p[0],y+p[1]*(rise/1.8),p[2]);U.push(p[0]/6,p[2]/6)}g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.computeVertexNormals();const m=landmarkMesh(a.group,g,material);m.material.side=T.DoubleSide;return m;}
 // Subdivide the actual concave plan, including courtyards. A bounding-box roof
 // would fill the spaces between wings and project into adjacent streets.
 const contours=[a.local,...a.holes],flat=contours.flat(),tri=T.ShapeUtils.triangulateShape(a.local.map(p=>new T.Vector2(...p)),a.holes.map(h=>h.map(p=>new T.Vector2(...p)))),P=[],UV=[];
 const height=p=>{let d=Infinity;for(const ring of contours)for(let i=0;i<ring.length;i++){const A=ring[i],B=ring[(i+1)%ring.length],dx=B[0]-A[0],dz=B[1]-A[1],t=clamp(((p[0]-A[0])*dx+(p[1]-A[1])*dz)/(dx*dx+dz*dz||1),0,1);d=Math.min(d,Math.hypot(p[0]-A[0]-dx*t,p[1]-A[1]-dz*t))}return y+Math.min(rise,d*.6)};
 function split(A,B,C,depth){if(depth<4&&Math.max(Math.hypot(A[0]-B[0],A[1]-B[1]),Math.hypot(B[0]-C[0],B[1]-C[1]),Math.hypot(C[0]-A[0],C[1]-A[1]))>7){const ab=[(A[0]+B[0])/2,(A[1]+B[1])/2],bc=[(B[0]+C[0])/2,(B[1]+C[1])/2],ca=[(C[0]+A[0])/2,(C[1]+A[1])/2];split(A,ab,ca,depth+1);split(ab,B,bc,depth+1);split(ca,bc,C,depth+1);split(ab,bc,ca,depth+1)}else for(const p of[A,B,C]){P.push(p[0],height(p),p[1]);UV.push(p[0]/6,p[1]/6)}}
 for(const t of tri)split(flat[t[0]],flat[t[1]],flat[t[2]],0);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('uv',new T.Float32BufferAttribute(UV,2));geo.computeVertexNormals();const m=landmarkMesh(a.group,geo,material);m.material.side=T.DoubleSide;return m;
}
function polygonStorey(parent,points,height,y,material,inset=0){const shape=new T.Shape(points.map(p=>new T.Vector2(p[0],-p[1])));if(inset>0){const c=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]),inner=points.map(p=>{const r=Math.hypot(p[0]-c[0],p[1]-c[1]),k=Math.max(.2,1-inset/r);return new T.Vector2(c[0]+(p[0]-c[0])*k,-c[1]-(p[1]-c[1])*k)});shape.holes.push(new T.Path(inner.reverse()))}const mesh=landmarkMesh(parent,new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false}),material,0,y,0);mesh.rotation.x=-Math.PI/2;return mesh}
function roofSurface(group,L,D,height,fn,material,steps=30){const P=[],I=[];for(let j=0;j<=8;j++)for(let i=0;i<=steps;i++){const x=(i/steps-.5)*L,z=(j/8-.5)*D;P.push(x,height+fn(x/L,z/D),z)}for(let j=0;j<8;j++)for(let i=0;i<steps;i++){const a=j*(steps+1)+i;I.push(a,a+1,a+steps+1,a+1,a+steps+2,a+steps+1)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();const m=landmarkMesh(group,g,material);m.material.side=T.DoubleSide;return m}
function mappedGrandstand(f,rows){const a=landmarkFrame(f);scene.remove(a.group);const q=prog(...a.centre,-1),height=f.height||10;rows=rows||Math.round(clamp(height/.55,10,22));let angle=-a.angle;const toRoad=[cx[q.i]-a.centre[0],cz[q.i]-a.centre[1]];if(-Math.sin(angle)*toRoad[0]-Math.cos(angle)*toRoad[1]<0)angle+=Math.PI;const depth=rows*1.25,back=[Math.sin(angle),Math.cos(angle)];const g=grandstand(a.centre[0]-back[0]*depth/2,a.centre[1]-back[1]*depth/2,angle,a.L,rows,f.name||CIRCUIT.name);g.userData.front=new T.Vector3(-back[0],0,-back[1]);g.userData.sourceFootprint=f.id;return g;}
function classicalLandmark(f,type){const a=landmarkFrame(f),g=a.group,pts=a.local,full=type==='fullerton',h=full?26:type==='casino'?22:18,solids=[],glass=[],columns=[];
 polygonStorey(g,pts,5,0,landmarkStone,8);polygonStorey(g,pts,h-5,5,landmarkStone,9);
 const sign=T.ShapeUtils.area(pts.map(p=>new T.Vector2(...p)))>0?1:-1;
 for(let i=0;i<pts.length;i++){const A=pts[i],B=pts[(i+1)%pts.length],len=Math.hypot(B[0]-A[0],B[1]-A[1]);if(len<4)continue;const ux=(B[0]-A[0])/len,uz=(B[1]-A[1])/len,ox=uz*sign,oz=-ux*sign,ang=-Math.atan2(uz,ux),n=Math.max(1,Math.round(len/5.8)),at=(t,y,o=0)=>[A[0]+ux*t+ox*o,y,A[1]+uz*t+oz*o];
  for(const y of[.5,4.8,h-5,h-4.2,h-1,h])solids.push([...at(len/2,y,.35),len+.6,y===h?.8:.28,1.15,0,ang]);
  for(let j=0;j<n;j++){const x=(j+.5)*len/n;for(let level=0;level<4;level++){const y=2.5+level*5.2;glass.push([...at(x,y,-.04),2.5,3.5,.13,0,ang]);for(const dx of[-1.4,0,1.4])solids.push([...at(x+dx,y,.08),dx===0?.09:.18,3.8,.25,0,ang]);solids.push([...at(x,y-1.85,.18),3,.18,.5,0,ang]);}
   if(len>15){const p=at(x,11.3,1.25);columns.push([p[0],p[1],p[2],.59,12.5,.59]);for(const y of[5,17.5])solids.push([...at(x,y,1.25),1.65,.6,1.65]);}
   if(full){const p=at(x,22.5,-2.2);solids.push([p[0],p[1],p[2],3.2,3,3.5,0,ang]);glass.push([...at(x,22.8,-.6),2.2,2.2,.12,0,ang]);}
  }
  if(full){const strip=landmarkMesh(g,new T.BoxGeometry(len, .35,7),landmarkRoof,...at(len/2,22.5,-2.2));strip.rotation.set(.53,ang,0,'YXZ')}
 }
 instanceBoxes(g,landmarkTrim,solids);instanceBoxes(g,venueGlass,glass);
 const col=new T.InstancedMesh(new T.CylinderGeometry(.87,1,1,20),landmarkTrim,columns.length),o=new T.Object3D();columns.forEach((p,i)=>{o.position.set(...p.slice(0,3));o.scale.set(...p.slice(3));o.updateMatrix();col.setMatrixAt(i,o.matrix)});col.castShadow=col.receiveShadow=true;g.add(col);
 if(full){const top=pts.map(p=>[p[0]*.70,p[1]*.70]);polygonStorey(g,top,6,h,landmarkTrim,5);polygonStorey(g,top,.55,h+6,landmarkTrim,5);landmarkMesh(g,new T.CylinderGeometry(6,6,5,8),venueGlass,0,h+8,0);landmarkMesh(g,new T.ConeGeometry(7,2,4),landmarkTrim,0,h+11,0);}
 else if(type==='casino'){for(const x of[-a.L*.34,a.L*.34]){landmarkMesh(g,new T.BoxGeometry(8,8,8),landmarkStone,x,h+3,-a.D*.25);landmarkMesh(g,new T.SphereGeometry(5,24,12,0,Math.PI*2,0,Math.PI/2),M(0x698e7d,.5,.55),x,h+7,-a.D*.25);landmarkMesh(g,new T.ConeGeometry(.8,4,10),landmarkTrim,x,h+13,-a.D*.25);}}
 else{landmarkMesh(g,new T.BoxGeometry(9,31,9),landmarkTrim,0,33,0);landmarkMesh(g,new T.CylinderGeometry(4.5,5.5,4,12),landmarkStone,0,49,0);landmarkMesh(g,new T.SphereGeometry(4.3,20,12,0,Math.PI*2,0,Math.PI/2),M(0x739285,.5,.6),0,51,0);for(const side of[-1,1]){const face=landmarkMesh(g,new T.CircleGeometry(2.1,24),M(0xe7e4d7,0,.8),0,42,side*4.55);face.rotation.y=side<0?Math.PI:0;}}
 landmarkAudit.push({name:f.name,type,id:f.id,position:g.position.toArray()});
}
function pitLandmark(f,type){const a=landmarkFrame(f),g=a.group,L=a.L,D=a.D,h=type==='wing'?12:type==='suzuka-pit'?12:type==='interlagos-pit'?9:10,stone=type==='austria-pit'?landmarkDark:venueWhite;
 const slabs=[],columns=[],glass=[],shutters=[],roofFrames=[];
 const pitch=type==='suzuka-pit'?.028:0;const groundAt=x=>x*pitch;
 for(const y of[.4,4.2,8.2,h])slabs.push([0,y,0,L,.45,D+1,0,0,Math.atan(pitch)]);
 for(let x=-L/2+3;x<L/2;x+=7){const y=groundAt(x);for(const side of[-1,1]){columns.push([x,h/2+y,side*(D/2-.25),.45,h,.5]);glass.push([x+3,6.3+y,side*(D/2-.5),5.8,3.3,.12]);shutters.push([x+3,2.2+y,side*(D/2-.6),5.8,3.8,.15]);}for(let k=0;k<8;k++)columns.push([x+3,.7+k*.43+y,-D/2-.04,5.8,.045,.08]);}
 instanceBoxes(g,stone,slabs);instanceBoxes(g,landmarkTrim,columns);instanceBoxes(g,venueGlass,glass);instanceBoxes(g,landmarkDark,shutters);
 if(type==='wing'){
  const roofFn=(x,z)=>{const wave=Math.sin((x+.5)*Math.PI*2.7);return 3+9*Math.max(0,wave)*(.5-z)+3*(x+.5)};
  roofSurface(g,L+8,D+12,h,roofFn,venueWhite,72);
  for(let x=-L/2;x<=L/2;x+=12){const y=h+roofFn(x/L,-.5);roofFrames.push([[x,h,-D/2],[x,y,-D/2-6],.18],[[x,y,-D/2-6],[x,h+3,D/2+6],.14]);}
  instanceBoxes(g,M(0xa61f23,.3,.65),[[0,h+.2,-D/2-1,L,.65,.25]]);
 }else if(type==='interlagos-pit'){roofSurface(g,L+4,D+8,h+2,(x,z)=>3.5*(1-4*z*z),venueWhite,40);for(let x=-L/2;x<L/2;x+=9)roofFrames.push([[x,h,-D/2],[x,h+6,0],.14],[[x,h+6,0],[x,h,D/2],.14]);}
 else if(type==='austria-pit'){instanceBoxes(g,venueMetal,[[0,h+1,0,L+8,.8,D+9],[0,7,-D/2-2,L,.35,5]]);}
 else if(type==='suzuka-pit'){instanceBoxes(g,venueWhite,[[0,h+1,0,L+6,.55,D+15,0,0,Math.atan(pitch)],[0,8.4,-D/2-3,L,.35,7,0,0,Math.atan(pitch)]]);}
 else{instanceBoxes(g,venueWhite,[[0,h+.6,0,L+4,.5,D+6],[0,7.5,-D/2-1.5,L,.25,4]]);if(type==='zandvoort-pit')landmarkMesh(g,new T.CylinderGeometry(7,7,6,32),venueGlass,L*.35,h+4,0);}
 beams(g,roofFrames,venueMetal);landmarkAudit.push({name:f.name||type,type,id:f.id,position:g.position.toArray()});
}
function shellLandmark(f,type){const a=landmarkFrame(f),g=a.group;
 if(type==='esplanade'){
  const dome=landmarkMesh(g,new T.SphereGeometry(1,48,24,0,Math.PI*2,0,Math.PI/2),venueGlass,0,5,0);dome.scale.set(a.L*.5,27,a.D*.5);
  const spikes=[],P=[],I=[];for(let j=1;j<16;j++)for(let i=0;i<44;i++){const phi=j/16*Math.PI/2,theta=(i+(j%2)*.5)/44*Math.PI*2,x=Math.sin(phi)*Math.cos(theta)*a.L*.51,y=5+Math.cos(phi)*27.5,z=Math.sin(phi)*Math.sin(theta)*a.D*.51;const index=P.length/3;P.push(x-1.3,y,z-1.4,x+1.3,y,z-1.4,x,y+1.7,z+1.6);I.push(index,index+1,index+2)}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setIndex(I);geo.computeVertexNormals();landmarkMesh(g,geo,venueWhite);
 }else if(type==='raidillon'){scene.remove(g);const stand=mappedGrandstand(f,24);stand.name='Raidillon permanent grandstand';instanceBoxes(stand,landmarkDark,[[0,21,14,a.L+12,1.1,37,-.055],[0,18,29,a.L,4,.5]]);}
 else if(type==='chalet'){polygonStorey(g,a.local,8,0,landmarkStone);roofSurface(g,a.L+4,a.D+4,8,(x,z)=>7*(1-Math.abs(z*2)),landmarkRoof,16);instanceBoxes(g,landmarkDark,[[0,5,-a.D/2-1,a.L,1.2,2]]);}
 else{const cols=[];for(let x=-a.L/2;x<a.L/2;x+=16){const canopy=new T.Group();canopy.position.x=x+8;g.add(canopy);roofSurface(canopy,17,a.D+6,16,(u,v)=>6*(u*u-v*v),venueWhite,12);cols.push([x+8,9,0,.5,18,.5]);}instanceBoxes(g,venueMetal,cols);polygonStorey(g,a.local,7,0,landmarkStone);}
 landmarkAudit.push({name:f.name,type,id:f.id,position:g.position.toArray()});
}
function buildLandmarkArchitecture(){
 for(const f of mappedBuildings){const type=architecturalModels[CIRCUIT.id]?.[f.id];if(!type)continue;if(type==='fullerton'||type==='casino'||type==='victoria')classicalLandmark(f,type);else if(type.endsWith('-pit')||type==='wing')pitLandmark(f,type);else shellLandmark(f,type)}
 for(const f of EXTRA_LANDMARKS[CIRCUIT.id]||[]){if(f.type==='bull'){
   const g=new T.Group();g.position.set(f.point[0],groundHeight(...f.point),f.point[1]);g.rotation.y=-.5;scene.add(g);const corten=M(0x6f4431,.5,.78),horn=M(0xa89344,.6,.4);
   const body=landmarkMesh(g,new T.IcosahedronGeometry(1,3),corten,0,11,0);body.scale.set(6,3.3,2.4);const head=landmarkMesh(g,new T.IcosahedronGeometry(1,2),corten,6,12,0);head.scale.set(2.5,2.6,2.2);
   beams(g,[[[-3,10,-1.6],[-5,4,-1.8],1.1],[[-3,10,1.6],[-1,3,1.9],1.1],[[3,10,-1.7],[5,5,-2],1.2],[[3,10,1.7],[8,8,2],1.2]],corten);
   for(const side of[-1,1]){const curve=new T.CatmullRomCurve3([new T.Vector3(6,13,side*1.7),new T.Vector3(6.2,15,side*3),new T.Vector3(4.3,17.2,side*2.6)]);landmarkMesh(g,new T.TubeGeometry(curve,18,.35,8,false),horn)}
   const arch=new T.Mesh(new T.TorusGeometry(11,.5,8,50,Math.PI),landmarkTrim);arch.position.set(0,2,0);g.add(arch);landmarkAudit.push({name:f.name,type:f.type,id:f.id,position:g.position.toArray()});
  }else if(!mappedBuildings.some(v=>v.id===f.id))classicalLandmark(f,f.type)}
 if(CIRCUIT.id==='milano'){instanceBoxes(pitGroup,venueGlass,[[0,5.9,2,130,4,.25]]);const ribs=[];for(let x=-62;x<=62;x+=7)ribs.push([[x,0,3],[x,9.8,1],.22]);beams(pitGroup,ribs,venueMetal);landmarkAudit.push({name:'Milano paddock',type:'original',position:pitGroup.position.toArray()})}
}
