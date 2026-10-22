// Recognizable buildings and the infrastructure between them. Footprints and
// paths come from the cached OSM extract; architectural details are referenced
// reconstructions, with their evidence recorded in Venue Environment Research.
const contextAudit={structures:[],bridges:[],pools:[],piers:0,boats:0,roadSegments:0,banking:0};
const plaster=new T.MeshStandardMaterial({color:linear(0xd6cdbb),normalMap:barrierNormal,normalScale:new T.Vector2(.07,.07),roughness:.82,envMapIntensity:.5});
const paleStone=new T.MeshStandardMaterial({color:linear(0xe2dfd5),normalMap:barrierNormal,normalScale:new T.Vector2(.05,.05),roughness:.72,envMapIntensity:.5});
const blueGlass=new T.MeshPhysicalMaterial({color:linear(0x406478),metalness:.62,roughness:.24,clearcoat:.7,envMapIntensity:.7});
function recordContext(f,g,detail){contextAudit.structures.push({id:f.id,name:f.name,type:f.type,position:g.position.toArray(),detail,source:f.source});landmarkAudit.push({id:f.id,name:f.name,type:f.type,position:g.position.toArray()});g.userData.landmark=f.id;}
function contextBuilding(f,height,floors,options={}){
 const a=landmarkFrame(f),g=a.group,pts=a.local,base=options.base||0,solids=[],glass=[],rails=[],mat=options.material||plaster;
 mappedStorey(a,height,base,mat);
 const winding=T.ShapeUtils.area(pts.map(p=>new T.Vector2(...p)))>0?1:-1,fh=height/floors;
 for(let i=0;i<pts.length;i++){const A=pts[i],B=pts[(i+1)%pts.length],len=Math.hypot(B[0]-A[0],B[1]-A[1]);if(len<2)continue;const ux=(B[0]-A[0])/len,uz=(B[1]-A[1])/len,ox=uz*winding,oz=-ux*winding,angle=-Math.atan2(uz,ux),at=(t,y,o)=>[A[0]+ux*t+ox*o,y,A[1]+uz*t+oz*o],n=Math.max(1,Math.round(len/(options.bay||4.2))),cw=len/n;
  for(let k=0;k<floors;k++){
   const floor=base+k*fh;
   if(options.balconies){solids.push([...at(len/2,floor+.12,.8),len,.24,1.8,0,angle]);rails.push([...at(len/2,floor+1.2,1.6),len,.08,.08,0,angle]);}
   if(options.bands)solids.push([...at(len/2,floor+fh-.2,.25),len,.36,.65,0,angle]);
   for(let j=0;j<n;j++){const t=(j+.5)*cw,y=floor+fh*.48,w=cw*.70,h=fh*.68;glass.push([...at(t,y,.025),w,h,.10,0,angle]);solids.push([...at(t-w/2-.09,y,.11),.18,h+.3,.25,0,angle],[...at(t+w/2+.09,y,.11),.18,h+.3,.25,0,angle],[...at(t,y-h/2-.1,.2),w+.35,.2,.5,0,angle]);if(options.balconies)for(const d of[-cw/2,cw/2])rails.push([...at(t+d,floor+.65,1.6),.065,1.15,.065]);}
  }
  solids.push([...at(len/2,base+height+.3,.3),len+.4,.6,.8,0,angle]);
 }
 instanceBoxes(g,paleStone,solids);instanceBoxes(g,blueGlass,glass);instanceBoxes(g,venueMetal,rails);
 return a;
}
function contextClassic(f){
 const court=f.type==='supreme-court',city=f.type==='cityhall',palace=f.type==='palace',low=['cafe','rascasse','cricket','recreation','chapel'].includes(f.type);
 const h=city||court?25:palace?20:f.type==='oceanographic'?26:low?(f.type==='chapel'?10:9):28,floors=low||f.type==='oceanographic'?2:city||court?4:6;
 const a=contextBuilding(f,h,floors,{bands:true,balconies:['paris','hermitage','cafe'].includes(f.type),courtyard:city||court||palace,bay:city?5.2:4.4}),g=a.group;
 if(city||court){
  // Columns face the Padang, using the eastern long frontage of the mapped plan.
  const padang=geoPoint(103.8529,1.2905),co=Math.cos(a.angle),si=Math.sin(a.angle),target=[(padang.x-a.centre[0])*co+(padang.z-a.centre[1])*si,-(padang.x-a.centre[0])*si+(padang.z-a.centre[1])*co];
  const winding=T.ShapeUtils.area(a.local.map(p=>new T.Vector2(...p)))>0?1:-1;
  const edges=a.local.map((p,i)=>{const b=a.local[(i+1)%a.local.length],l=Math.hypot(b[0]-p[0],b[1]-p[1]),ox=(b[1]-p[1])/l*winding,oz=-(b[0]-p[0])/l*winding;return{p,b,l,ox,oz,score:l*((target[0]*ox+target[1]*oz)>0?1:0)}}).sort((x,y)=>y.score-x.score),e=edges[0],n=city?18:8,cols=[],bases=[];
  for(let i=0;i<n;i++){const t=(i+.5)/n,x=e.p[0]+(e.b[0]-e.p[0])*t+e.ox*1.4,z=e.p[1]+(e.b[1]-e.p[1])*t+e.oz*1.4;cols.push([x,13,z,.8,18,.8]);bases.push([x,4,z,2.2,.65,2.2],[x,22,z,2.2,.65,2.2]);}
  const mesh=new T.InstancedMesh(new T.CylinderGeometry(.87,1,1,20),paleStone,cols.length),o=new T.Object3D();cols.forEach((p,i)=>{o.position.set(...p.slice(0,3));o.scale.set(...p.slice(3));o.updateMatrix();mesh.setMatrixAt(i,o.matrix)});mesh.castShadow=true;g.add(mesh);instanceBoxes(g,paleStone,bases);
  if(court){landmarkMesh(g,new T.CylinderGeometry(12,12,9,40),paleStone,0,h+4,0);landmarkMesh(g,new T.SphereGeometry(12,40,22,0,Math.PI*2,0,Math.PI/2),M(0x718b84,.45,.58),0,h+8,0);landmarkMesh(g,new T.ConeGeometry(2,5,16),paleStone,0,h+22,0)}
 }else if(['paris','hermitage','palace'].includes(f.type)){
  footprintRoof(a,h,M(palace?0x97614a:0x65777b,.15,.75));
  if(f.type==='hermitage'){const p=a.local.reduce((v,p)=>p[0]<v[0]?p:v,a.local[0]);landmarkMesh(g,new T.SphereGeometry(6,32,20,0,Math.PI*2,0,Math.PI/2),M(0x708384,.25,.55),p[0]+7,h+2,p[1]);}
 }else if(f.type==='chapel'){
  footprintRoof(a,h,landmarkRoof,4);landmarkMesh(g,new T.BoxGeometry(3.8,11,3.8),paleStone,-a.L*.35,h+2,0);landmarkMesh(g,new T.ConeGeometry(3,4,4),landmarkRoof,-a.L*.35,h+9.5,0);
 }else footprintRoof(a,h,landmarkRoof);
 recordContext(f,g,'Mapped footprint, articulated facade, cornices and venue roof profile');
}
function contextHotel(f){
 const heights={fairmont:27,yachtclub:22,hilton:20,brdc:10,museum:10,'source-hotel':13,'eau-rouge-hotel':10,'suzuka-hotel':12,'monza-hospitality':11,mandarin:72,ritz:130,panpacific:153};
 const h=heights[f.type]||16,floors=Math.round(h/(h>100?3.8:4)),a=contextBuilding(f,h,floors,{balconies:['fairmont','yachtclub','mandarin','brdc'].includes(f.type),bands:true,base:f.type==='fairmont'?7:0,courtyard:f.type==='fairmont'}),g=a.group;
 if(f.type==='fairmont'){const pool=landmarkMesh(g,new T.BoxGeometry(22,.15,11),M(0x388d9d,.2,.18),a.L*.2,h+7.5,0);const screens=[];for(let x=-a.L*.4;x<a.L*.4;x+=4)screens.push([x,h+9,-a.D*.25,3.6,2,.18]);instanceBoxes(g,blueGlass,screens);}
 if(f.type==='yachtclub'){
  for(let level=1;level<=4;level++){const scale=1-level*.1,deck=a.local.map(p=>[p[0]*scale,p[1]*scale]);polygonStorey(g,deck,.35,level*5,paleStone);}
  const masts=[];for(const x of[-a.L*.28,a.L*.28])masts.push([[x,0,0],[x,42,0],.25],[[x,27,0],[x-10,27,0],.15]);beams(g,masts,venueWhite);
 }
 if(f.type==='hilton'){const fins=[];for(let x=-a.L/2;x<a.L/2;x+=5)fins.push([x,h/2,-a.D/2-.4,.25,h,1]);instanceBoxes(g,M(0x624b3e,.25,.7),fins);}
 if(f.type==='ritz'){const aperture=landmarkMesh(g,new T.RingGeometry(8,10,8),venueWhite,0,h-17,-a.D/2-.15);aperture.rotation.z=Math.PI/8;}
 recordContext(f,g,'Mapped hotel footprint, floor bands, glazing and terraces');
}
function contextTall(f){const a=landmarkFrame(f),g=a.group;
 if(f.type==='swissotel'){
  const r=Math.min(a.L,a.D)*.49,h=226;landmarkMesh(g,new T.CylinderGeometry(r,r,h,64),blueGlass,0,h/2,0);const rings=[];for(let y=31;y<h;y+=2.7){const t=landmarkMesh(g,new T.CylinderGeometry(r+.45,r+.45,.3,64),paleStone,0,y,0)}landmarkMesh(g,new T.CylinderGeometry(r+.65,r+.65,2,64),paleStone,0,h,0);
 }else if(f.type==='memorial'){
  for(const x of[-1.7,1.7])for(const z of[-1.7,1.7]){const shaft=landmarkMesh(g,new T.CylinderGeometry(.95,1.65,67,4),paleStone,x,33.5,z);shaft.rotation.y=Math.PI/4;}landmarkMesh(g,new T.BoxGeometry(14,1.3,14),paleStone,0,.65,0);
 }else if(f.type==='cathedral'){
  mappedStorey(a,15,0,paleStone);footprintRoof(a,15,M(0x4a565c,.2,.8),8);const x=-a.L*.35;landmarkMesh(g,new T.BoxGeometry(10,30,10),paleStone,x,23,0);landmarkMesh(g,new T.ConeGeometry(7,22,8),paleStone,x,49,0);for(const z of[-5,5])landmarkMesh(g,new T.ConeGeometry(1.2,8,6),paleStone,x,36,z);
 }else if(f.type==='merlion'){
  const body=landmarkMesh(g,new T.CylinderGeometry(1.1,1.8,5.5,32),paleStone,0,2.75,0),head=landmarkMesh(g,new T.SphereGeometry(1.55,24,18),paleStone,0,6.4,0);head.scale.set(1,1.1,.9);for(let i=0;i<12;i++){const t=i/12*Math.PI*2;landmarkMesh(g,new T.SphereGeometry(.47,8,6),paleStone,Math.sin(t)*1.22,6.4+Math.cos(t)*1.3,-.45)}landmarkMesh(g,new T.SphereGeometry(.68,16,10),paleStone,0,6.1,1.1);
 }else if(f.type==='lotus'){
  landmarkMesh(g,new T.CylinderGeometry(15,10,12,32),paleStone,0,6,0);
  for(let petal=0;petal<10;petal++){const angle=petal/10*Math.PI*2,P=[],I=[],length=petal%3===0?40:33;for(let j=0;j<=16;j++)for(let i=0;i<=8;i++){const u=j/16,v=i/8*2-1,r=8+u*length,w=Math.sin(Math.PI*u*.92)*8,z=v*w,y=9+u*u*(petal%3===0?40:31)+v*v*2;P.push(Math.cos(angle)*r-Math.sin(angle)*z,y,Math.sin(angle)*r+Math.cos(angle)*z)}for(let j=0;j<16;j++)for(let i=0;i<8;i++){const k=j*9+i;I.push(k,k+9,k+1,k+1,k+9,k+10)}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setIndex(I);geo.computeVertexNormals();landmarkMesh(g,geo,paleStone.clone()).material.side=T.DoubleSide;}
 }
 recordContext(f,g,'Authored silhouette and structural detail on mapped site');
}
function yasHotel(f){
 const a=landmarkFrame(f),g=a.group,L=217,D=44,P=[],I=[],uv=[],lines=[];
 // Two lobes joined by a lower saddle, with diamond panel seams. This replaces
 // the previous hemisphere and follows the engineer's 217 x 44 x 35 m envelope.
 const at=(u,v)=>{const x=(u-.5)*L,t=v*Math.PI,width=D*.5*(.78+.22*Math.sin(Math.PI*u)),saddle=1-.15*Math.exp(-(((u-.48)/.13)**2));return new T.Vector3(x,7+28*Math.sin(t)*saddle,Math.cos(t)*width+Math.sin(u*Math.PI*1.6)*5)};
 for(let j=0;j<=26;j++)for(let i=0;i<=86;i++){const p=at(i/86,j/26);P.push(...p.toArray());uv.push(i,j)}
 for(let j=0;j<26;j++)for(let i=0;i<86;i++){const k=j*87+i;I.push(k,k+1,k+87,k+1,k+88,k+87)}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(I);geo.computeVertexNormals();
 const panels=canvasTex(128,128,(c,w,h)=>{c.fillStyle='#a3aab9';c.fillRect(0,0,w,h);c.strokeStyle='#424352';c.lineWidth=4;c.beginPath();c.moveTo(0,0);c.lineTo(w,h);c.moveTo(w,0);c.lineTo(0,h);c.stroke();c.strokeStyle='#d7caeb';c.lineWidth=1;c.stroke()});panels.wrapS=panels.wrapT=T.RepeatWrapping;
 landmarkMesh(g,geo,new T.MeshPhysicalMaterial({map:panels,color:0xb4a2c8,metalness:.48,roughness:.28,side:T.DoubleSide,emissive:0x442082,emissiveIntensity:.28}));
 for(let i=0;i<=43;i++){const curve=[];for(let j=0;j<=26;j++)curve.push(at(i/43,j/26));for(let j=0;j<curve.length-1;j++)lines.push([curve[j].toArray(),curve[j+1].toArray(),.09]);}
 for(let i=0;i<10;i++){const x=-L*.43+i*L*.86/9;lines.push([[x,0,0],[x-3,12,-D*.42],.5],[[x,0,0],[x+3,12,D*.42],.5]);}
 beams(g,lines,venueWhite);recordContext(f,g,'217 m freeform grid shell, two lobes, saddle and V supports');
}
function contextStand(f){const a=landmarkFrame(f);scene.remove(a.group);const rows=f.type==='endurance'?24:f.type==='yas-stand'?20:18,g=mappedGrandstand({...f,height:rows*.64},rows);
 if(f.type==='bahrain-stand'||f.type==='yas-stand'){const roofs=[];for(let x=-a.L/2;x<a.L/2;x+=18){const local=new T.Group();local.position.set(x+9,0,rows*.6);g.add(local);roofSurface(local,19,rows*1.25+5,rows*.64+5,(u,v)=>3*(u*u-v*v),venueWhite,12);}}
 recordContext(f,g,'Mapped grandstand axis, track-facing seats, tiers and venue canopy');
}
function austriaWing(f){
 const a=landmarkFrame(f),g=a.group,q=prog(...a.centre,-1);if(-Math.sin(g.rotation.y)*(cx[q.i]-a.centre[0])-Math.cos(g.rotation.y)*(cz[q.i]-a.centre[1])<0)g.rotation.y+=Math.PI;
 // The promoter's plan places the 90 m Wing in the centre of Start/Ziel,
 // with the seated grandstand continuing on either side of the media centre.
 const length=94,depth=27,sideLength=(a.L-length)/2,co=Math.cos(g.rotation.y),si=Math.sin(g.rotation.y);
 for(const side of[-1,1]){const x=side*(length+sideLength)/2,z=-12;grandstand(a.centre[0]+co*x+si*z,a.centre[1]-si*x+co*z,g.rotation.y,sideLength,18,'START / ZIEL');}
 roofSurface(g,length,depth,15,(x,z)=>3.2*Math.sin((z+.5)*Math.PI),venueWhite,44);
 roofSurface(g,length,depth,10.6,(x,z)=>1.8*Math.sin((z+.5)*Math.PI),venueWhite,44);
 instanceBoxes(g,blueGlass,[[0,13.4,-depth/2+.5,86,4,.18],[0,13.4,depth/2-.5,86,4,.18],[0,4,1,68,8,18]]);
 const frames=[],supports=[];for(let x=-42;x<=42;x+=3)frames.push([x,13.6,-depth/2+.4,.13,4.6,.3],[x,13.6,depth/2-.4,.13,4.6,.3]);for(const x of[-35,35])supports.push([[x,0,0],[x-5,13,-11],.65],[[x,0,0],[x+5,13,11],.65]);
 instanceBoxes(g,venueMetal,frames);beams(g,supports,venueMetal);
 const section=new T.Shape();section.moveTo(-depth/2,9.8);section.quadraticCurveTo(0,10.4,depth/2,12);section.lineTo(depth/2,15);section.quadraticCurveTo(0,21,-depth/2,15);section.closePath();
 for(const side of[-1,1]){const plate=landmarkMesh(g,new T.ExtrudeGeometry(section,{depth:.7,bevelEnabled:true,bevelThickness:.15,bevelSize:.15,bevelSegments:2}),venueWhite,side*length/2,0,0);plate.rotation.y=Math.PI/2;}
 recordContext({...f,name:'Red Bull Wing / Start-Ziel'},g,'Central 94 m airfoil media building, glazing, supports and flanking stands; promoter-plan placement');
}
function buildContextStructures(){for(const f of contextHere.structures){if(architecturalModels[CIRCUIT.id]?.[f.id])continue;
 if(['cityhall','supreme-court','paris','hermitage','cafe','rascasse','chapel','cricket','recreation','palace','oceanographic'].includes(f.type))contextClassic(f);
 else if(['swissotel','memorial','cathedral','merlion','lotus'].includes(f.type))contextTall(f);
 else if(f.type==='yas-hotel')yasHotel(f);
 else if(f.type==='austria-wing')austriaWing(f);
 else if(f.type.endsWith('-stand')||f.type==='endurance')contextStand(f);
 else if(f.type.endsWith('-pit')){pitLandmark(f,f.type);contextAudit.structures.push({id:f.id,name:f.name,type:f.type,source:f.source})}
 else if(f.type==='wheel'){const p=landmarkCentre({points:f.footprint.concat([f.footprint[0]])}),g=observedWheel(...p,25,30,.3);recordContext(f,g,'Mapped Circuit Wheel position and 60 m overall height');}
 else if(f.type==='podium'){const a=landmarkFrame(f);polygonStorey(a.group,a.local,2,6,venueWhite);instanceBoxes(a.group,blueGlass,[[0,8,-a.D/2,a.L,2,.18]]);recordContext(f,a.group,'Monza podium overhang');}
 else contextHotel(f);
 }}
const marinaBoats=[];
const yachtHullMaterial=M(0xc4c7c5,.12,.4),yachtDeckMaterial=M(0x917456,.05,.8);
yachtHullMaterial.side=T.DoubleSide;
let sharedYachtHull,sharedYachtDeck;
function marinaYacht(x,z,length,heading,sea){
 const g=new T.Group();g.name='Marina yacht';g.position.set(x,sea+.15,z);g.rotation.y=heading;g.scale.z=.5;scene.add(g);
 const P=[],I=[],sections=[[-.5,.27,.55],[-.35,.30,.72],[0,.30,.82],[.3,.22,.85],[.48,.06,.9],[.52,0,.96]];
 for(const [u,w,h]of sections)for(const [side,level]of[[-1,1],[-1,0],[1,0],[1,1]])P.push(u*length,level?h*length*.085:-length*.035,side*w*length*(level?1:.58));
 for(let j=0;j<sections.length-1;j++)for(let k=0;k<3;k++){const a=j*4+k;I.push(a,a+4,a+1,a+1,a+4,a+5)}
 if(!sharedYachtHull){sharedYachtHull=new T.BufferGeometry();sharedYachtHull.setAttribute('position',new T.Float32BufferAttribute(P.map(v=>v/length),3));sharedYachtHull.setIndex(I);sharedYachtHull.computeVertexNormals();}
 const hullMesh=landmarkMesh(g,sharedYachtHull,yachtHullMaterial);hullMesh.scale.setScalar(length);
 const deck=[[-length*.5,-length*.27],[-length*.35,-length*.30],[0,-length*.30],[length*.30,-length*.22],[length*.48,-length*.06],[length*.52,0],[length*.48,length*.06],[length*.30,length*.22],[0,length*.30],[-length*.35,length*.30],[-length*.5,length*.27]];
 if(!sharedYachtDeck){const shape=new T.Shape(deck.map(p=>new T.Vector2(p[0]/length,-p[1]/length)));sharedYachtDeck=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});}
 const deckMesh=landmarkMesh(g,sharedYachtDeck,yachtDeckMaterial,0,length*.07,0);deckMesh.rotation.x=-Math.PI/2;deckMesh.scale.set(length,length,.15);
 const boxRows=[[ -length*.09,length*.13,0,length*.52,length*.12,length*.40],[-length*.13,length*.22,0,length*.35,length*.07,length*.30]];instanceBoxes(g,paleStone,boxRows);
 instanceBoxes(g,blueGlass,[[-length*.08,length*.15,-length*.202,length*.46,length*.055,.08],[-length*.08,length*.15,length*.202,length*.46,length*.055,.08],[length*.18,length*.15,0,.08,length*.055,length*.39],[-length*.12,length*.23,-length*.152,length*.3,length*.035,.08],[-length*.12,length*.23,length*.152,length*.3,length*.035,.08]]);
 const rail=[];for(let i=0;i<deck.length;i++){const a=deck[i],b=deck[(i+1)%deck.length];rail.push([[a[0],length*.07+.7,a[1]],[b[0],length*.07+.7,b[1]],.045],[[a[0],length*.07,a[1]],[a[0],length*.07+.7,a[1]],.04])}rail.push([[-length*.18,length*.25,0],[-length*.18,length*.36,0],.08]);beams(g,rail,venueMetal);contextAudit.boats++;marinaBoats.push({x,z,r:length*.62});
}
function contextPier(f,material){
 const sea=Math.min(...cy)-2,p=f.points,y=sea+1.1,items=[],closed=f.closed;
 if(closed)infrastructureSurface(p,y,material,'Mapped marina pier '+f.id);
 const water=(x,z)=>geography?.features.some(f=>f.kind==='water'&&insideFootprint(x,z,f.points));
 for(let i=1;i<p.length+(closed?1:0);i++){
  const A=p[i-1],B=p[i%p.length],dx=B[0]-A[0],dz=B[1]-A[1],len=Math.hypot(dx,dz);if(len<2)continue;const nx=-dz/len,nz=dx/len,width=closed?.6:parseFloat(f.tags.width)||3;
  if(!closed)items.push([(A[0]+B[0])/2,y-.2,(A[1]+B[1])/2,len,.4,width,0,-Math.atan2(dz,dx)]);
  if(!['monaco','abu-dhabi'].includes(CIRCUIT.id))continue;
  for(let d=12;d<len-7;d+=15){for(const side of[-1,1]){
   const length=CIRCUIT.id==='monaco'?20+(f.id%4)*3:24+(f.id%3)*3,x=A[0]+dx*d/len+nx*side*(length*.52+width/2+1),z=A[1]+dz*d/len+nz*side*(length*.52+width/2+1);
   if(marinaBoats.length>90||!water(x,z)||buildingAt(x,z,3)||marinaBoats.some(b=>Math.hypot(x-b.x,z-b.z)<(length*.62+b.r)*.64))continue;
   if(![-1,1].every(a=>[-1,1].every(b=>water(x+nx*side*length*.48*a+dx/len*length*.3*b,z+nz*side*length*.48*a+dz/len*length*.3*b))))continue;
   marinaYacht(x,z,length,-Math.atan2(nz*side,nx*side),sea);
  }}
 }
 instanceBoxes(scene,material,items,true,false);contextAudit.piers++;
}
function contextQuay(f){const segments=[],p=f.points,sea=Math.min(...cy)-2;for(let i=1;i<p.length;i++){const A=p[i-1],B=p[i],dx=B[0]-A[0],dz=B[1]-A[1],len=Math.hypot(dx,dz),n=Math.ceil(len/8);for(let j=0;j<n;j++){const x=A[0]+dx*(j+.5)/n,z=A[1]+dz*(j+.5)/n,q=prog(x,z,-1),ground=groundHeight(x,z);if(Math.hypot(x-cx[q.i],z-cz[q.i])>650||ground>sea+8)continue;const top=Math.max(sea+.7,ground),height=top-sea+2;segments.push([x,top-height/2,z,len/n+.1,height,.65,0,-Math.atan2(dz,dx)])}}const m=instanceBoxes(scene,concrete,segments,true,false);m.name='Mapped quay wall '+f.id;}
function infrastructureSurface(points,y,material,name){if(points.length<3)return null;const P=[],UV=[],I=T.ShapeUtils.triangulateShape(points.map(p=>new T.Vector2(...p)),[]);for(const tri of I)for(const k of tri){const p=points[k];P.push(p[0],typeof y==='function'?y(...p):y,p[1]);UV.push(p[0]/8,p[1]/8)}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('uv',new T.Float32BufferAttribute(UV,2));geo.computeVertexNormals();const mesh=new T.Mesh(geo,material);mesh.name=name;mesh.receiveShadow=true;scene.add(mesh);return mesh}
function contextBridge(f){
 const p=f.points;if(p.length<2)return;const anderson=f.tags['bridge:name']==='Anderson Bridge',helix=f.name.includes('Helix'),cavenagh=f.name==='Cavenagh Bridge',high=f.name.includes('East Coast')||f.name.includes('Sheares'),walking=['footway','pedestrian','path'].includes(f.tags.highway);
 const width=anderson?18:helix?6:cavenagh?7:parseFloat(f.tags.width)|| (walking?4:Math.min(24,(parseInt(f.tags.lanes)||2)*3.4));
 const endHeights=[groundHeight(...p[0]),groundHeight(...p[p.length-1])];let y=Math.max(...endHeights)+(high?15:walking?4:1);const deck=[],rails=[],piers=[],arched=[];
 // Set one continuous elevation for the complete bridge. Raising individual
 // spans at a road crossing used to leave unsupported slabs in mid-air.
 for(let i=1;i<p.length;i++){const A=p[i-1],B=p[i],dx=B[0]-A[0],dz=B[1]-A[1],len=Math.hypot(dx,dz);for(let j=0;j<=Math.ceil(len/4);j++){const t=j/Math.max(1,Math.ceil(len/4)),x=A[0]+dx*t,z=A[1]+dz*t,q=prog(x,z,-1);if(Math.hypot(x-cx[q.i],z-cz[q.i])<trackHalf(q.i,Math.sign(q.d))+width/2&&Math.abs(dx/len*tx[q.i]+dz/len*tz[q.i])<.8)y=Math.max(y,cy[q.i]+7.5);}}
 let total=0;for(let i=1;i<p.length;i++)total+=Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]);if(total<8)return;
 let done=0;
 for(let i=1;i<p.length;i++){const A=p[i-1],B=p[i],dx=B[0]-A[0],dz=B[1]-A[1],len=Math.hypot(dx,dz);if(len<.01)continue;const segments=Math.ceil(len/6),nx=-dz/len,nz=dx/len;
  for(let j=0;j<segments;j++){const u=j/segments,v=(j+1)/segments,x=A[0]+dx*(u+v)/2,z=A[1]+dz*(u+v)/2,q=prog(x,z,-1),near=Math.hypot(x-cx[q.i],z-cz[q.i]);let deckY=anderson?cy[q.i]+.06:y;
   // Crossing footbridges retain overhead clearance; a road already represented
   // by the racing surface does not receive a second deck over the racing car.
   const along=Math.abs((dx/len)*tx[q.i]+(dz/len)*tz[q.i])>.8,overRoad=near<trackHalf(q.i,Math.sign(q.d))+width/2;
   if(!(overRoad&&along))deck.push([x,deckY-.3,z,len/segments+.03,.6,width,0,-Math.atan2(dz,dx)]);
   if(!(overRoad&&along)||anderson)for(const side of[-1,1]){const rx=x+nx*side*width/2,rz=z+nz*side*width/2;rails.push([rx,deckY+1,rz,len/segments+.05,.13,.13,0,-Math.atan2(dz,dx)],[rx,deckY+.5,rz,.09,1,.09]);}
   if(j===0||j===segments-1||Math.floor((done+u*len)/22)!==Math.floor((done+v*len)/22)){
    for(const side of[-1,1]){const px=x+nx*side*(width/2-.5),pz=z+nz*side*(width/2-.5),near=prog(px,pz,-1);if(Math.hypot(px-cx[near.i],pz-cz[near.i])<trackHalf(near.i,Math.sign(near.d))+2)continue;const bottom=Math.min(groundHeight(px,pz),deckY-.6);piers.push([px,(deckY+bottom)/2-.3,pz,high?1.4:.45,deckY-bottom,high?1.4:.45]);}
   }
   if(anderson||cavenagh){const t=(done+(u+v)/2*len)/total,bow=anderson?9*Math.sin(Math.PI*t):5+7*(2*t-1)**2;for(const side of(anderson?[-1,0,1]:[-1,1])){const px=x+nx*side*width/2,pz=z+nz*side*width/2;arched.push([[px,deckY+.3,pz],[px,deckY+bow,pz],.14]);if(j<segments-1)arched.push([[px,deckY+bow,pz],[px+dx/segments,deckY+(anderson?9*Math.sin(Math.PI*(t+len/segments/total)):5+7*(2*(t+len/segments/total)-1)**2),pz+dz/segments],.3]);}}
   if(helix){for(const shift of[0,Math.PI]){const t=(done+u*len)*.23+shift,tt=(done+v*len)*.23+shift;arched.push([[A[0]+dx*u+nx*Math.cos(t)*3.3,deckY+3.5+Math.sin(t)*3,A[1]+dz*u+nz*Math.cos(t)*3.3],[A[0]+dx*v+nx*Math.cos(tt)*3.3,deckY+3.5+Math.sin(tt)*3,A[1]+dz*v+nz*Math.cos(tt)*3.3],.16]);}}
  }done+=len;
 }
 instanceBoxes(scene,concrete,deck,true,false);instanceBoxes(scene,venueMetal,rails,true,false);instanceBoxes(scene,concrete,piers,true,false);
 // Absolute-height bridge members use a parent group to avoid terrain added twice.
 const group=new T.Group();scene.add(group);beams(group,arched,anderson?paleStone:venueMetal);contextAudit.bridges.push({id:f.id,name:f.tags['bridge:name']||f.name||'Mapped bridge',segments:deck.length});
}
function contextBanking(f){const P=[],I=[],uv=[],posts=[],p=f.points;for(let i=0;i<p.length;i++){const A=p[Math.max(0,i-1)],B=p[Math.min(p.length-1,i+1)],dx=B[0]-A[0],dz=B[1]-A[1],len=Math.hypot(dx,dz)||1;let nx=-dz/len,nz=dx/len;if((p[i][0]-circuitCentre.x)*nx+(p[i][1]-circuitCentre.z)*nz<0){nx=-nx;nz=-nz}const ground=groundHeight(...p[i]);for(let k=0;k<=6;k++){const lateral=(k/6-.5)*12;P.push(p[i][0]+nx*lateral,ground+Math.max(0,lateral+6)*.80+.15,p[i][1]+nz*lateral);uv.push(i*.25,k/6)}if(i<p.length-1)for(let k=0;k<6;k++){const v=i*7+k;I.push(v,v+7,v+1,v+1,v+7,v+8)}posts.push([p[i][0]+nx*6,ground+10.2,p[i][1]+nz*6,.1,1,.1]);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(I);geo.computeVertexNormals();const m=new T.Mesh(geo,new T.MeshStandardMaterial({map:barrierColor,normalMap:barrierNormal,roughness:.96,side:T.DoubleSide}));m.name=f.name;m.receiveShadow=true;scene.add(m);instanceBoxes(scene,venueMetal,posts,true,false);contextAudit.banking++;}
function buildContextInfrastructure(){
 const pierMaterial=M(0x858682,.08,.92),poolMaterial=new T.MeshPhysicalMaterial({color:linear(0x41a2b3),roughness:.16,metalness:.28,normalMap:waterNormals,normalScale:new T.Vector2(.08,.08),side:T.DoubleSide});
 for(const f of contextHere.infrastructure){
  if(f.type==='bridge')contextBridge(f);
  else if(f.type==='banking')contextBanking(f);
  else if(f.type==='pool'){const p=landmarkCentre({points:f.points.concat([f.points[0]])}),y=groundHeight(...p)+.12;infrastructureSurface(f.points,y,poolMaterial,'Mapped swimming pool '+f.id);contextAudit.pools.push({id:f.id,position:p});}
  else if(f.type==='pier')contextPier(f,pierMaterial);
  else if(f.type==='quay')contextQuay(f);
 }
 // The auxiliary road network is actual mapped geometry, clipped clear of the
 // racing corridor and pit lane. It is not counted merely because data exists.
 const tiles=new Map();for(const road of geography?.features.filter(f=>f.kind==='road')||[]){const width=road.width||5;for(let i=1;i<road.points.length;i++){const A=road.points[i-1],B=road.points[i],dx=B[0]-A[0],dz=B[1]-A[1],len=Math.hypot(dx,dz),n=Math.ceil(len/8);if(!len)continue;for(let j=0;j<n;j++){const u=j/n,v=(j+1)/n,x=A[0]+dx*(u+v)/2,z=A[1]+dz*(u+v)/2,q=prog(x,z,-1),distance=Math.hypot(x-cx[q.i],z-cz[q.i]);if(distance<Math.abs(trackBarrier(q.i,Math.sign(q.d)))+width/2+2||buildingAt(x,z,0)||geography.features.some(f=>f.kind==='water'&&insideFootprint(x,z,f.points)))continue;const nx=-dz/len*width/2,nz=dx/len*width/2,key=Math.floor(x/220)+','+Math.floor(z/220);if(!tiles.has(key))tiles.set(key,{P:[],U:[]});const t=tiles.get(key);for(const[s,side]of[[u,-1],[v,-1],[v,1],[u,-1],[v,1],[u,1]]){const xx=A[0]+dx*s+nx*side,zz=A[1]+dz*s+nz*side;t.P.push(xx,groundHeight(xx,zz)+.065,zz);t.U.push(xx/8,zz/8)}contextAudit.roadSegments++;}}}
 for(const t of tiles.values()){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(t.P,3));g.setAttribute('uv',new T.Float32BufferAttribute(t.U,2));g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshStandardMaterial({map:asphalt,normalMap:asphaltNormal,normalScale:new T.Vector2(.18,.18),roughness:.95,side:T.DoubleSide,color:0x999b99}));m.name='Mapped surrounding road network';m.receiveShadow=true;scene.add(m)}
}
buildContextStructures();buildContextInfrastructure();
