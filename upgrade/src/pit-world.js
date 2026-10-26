// Physical pit-lane surface, working area and visible service crew.
const racePitGroup=new T.Group();racePitGroup.name='Mapped pit lane';scene.add(racePitGroup);
const pitMeshData={p:[],u:[]};
for(let i=0;i<PIT.x.length-1;i++){const j=i+1;for(const [k,side]of[[i,-1],[i,1],[j,1],[i,-1],[j,1],[j,-1]]){pitMeshData.p.push(...pitSections[k].point(side*PIT.width/2));pitMeshData.u.push(PIT.s[k]/5,(side+1)*PIT.width/10)}}
// Ground trimming runs once after the service aprons have been prepared.
const pitGeo=new T.BufferGeometry();pitGeo.setAttribute('position',new T.Float32BufferAttribute(pitMeshData.p,3));pitGeo.setAttribute('uv',new T.Float32BufferAttribute(pitMeshData.u,2));pitGeo.computeVertexNormals();const pitRoad=new T.Mesh(pitGeo,new T.MeshStandardMaterial({map:asphalt,normalMap:asphaltNormal,normalScale:new T.Vector2(.28,.28),roughnessMap:asphaltRough,roughness:.88,side:T.DoubleSide}));pitRoad.name='Pit-lane asphalt';pitRoad.userData.groundSurface=true;pitRoad.receiveShadow=true;racePitGroup.add(pitRoad);
// Continuous edge paint follows the same sections, with no floating straight boxes.
// Keep pit markings on the separated lane. No painted branch across the racing surface.
const pitPaint=[];let pitPaintSegments=0;
for(const side of[-1,1])for(let i=0;i<PIT.x.length-1;i++){
 if(PIT.s[i]<120||PIT.length-PIT.s[i+1]<120)continue;
 const points=[pitSections[i].point(side*(PIT.width/2-.25)),pitSections[i+1].point(side*(PIT.width/2-.25))];
 if(!points.every(p=>{const q=prog(p[0],p[2],-1);return Math.abs(q.d)>trackHalf(q.i,Math.sign(q.d))+.8}))continue;
 pitPaintSegments++;for(const[k,o]of[[i,-.06],[i,.06],[i+1,.06],[i,-.06],[i+1,.06],[i+1,-.06]]){const p=pitSections[k].point(side*(PIT.width/2-.25)+o);p[1]+=.012;pitPaint.push(...p)}
}
const paintGeo=new T.BufferGeometry();paintGeo.setAttribute('position',new T.Float32BufferAttribute(pitPaint,3));paintGeo.computeVertexNormals();const paintMesh=new T.Mesh(paintGeo,new T.MeshStandardMaterial({color:0xf1eee3,roughness:.9,side:T.DoubleSide}));paintMesh.name='Continuous pit edge markings';racePitGroup.add(paintMesh);
// The Yas Marina exit crosses beneath the racing surface, with separate road decks.
if(PIT.tunnel){const q=PIT.tunnel,p=[],uv=[],face=(a,b,c,d)=>{for(const[v,u,w]of[[a,0,0],[b,1,0],[c,1,1],[a,0,0],[c,1,1],[d,0,1]]){p.push(...v);uv.push(u,w)}};for(let i=q.start;i<q.end;i++){const a=pitSections[i],b=pitSections[i+1],l=a.point(-3.7),r=a.point(3.7),L=b.point(-3.7),R=b.point(3.7),up=v=>[v[0],v[1]+q.clearance,v[2]];face(l,L,up(L),up(l));face(R,r,up(r),up(R));face(up(l),up(L),up(R),up(r))}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();const m=new T.Mesh(g,new T.MeshStandardMaterial({map:barrierColor,normalMap:barrierNormal,roughness:.88,side:T.DoubleSide,color:0xb2b4b5}));m.name='Yas Marina pit exit tunnel';m.castShadow=m.receiveShadow=true;racePitGroup.add(m)}
const pitBox=new T.Group(),pitBoxIndex=PIT.box,pitHeading=Math.atan2(PIT.z[pitBoxIndex+1]-PIT.z[pitBoxIndex-1],PIT.x[pitBoxIndex+1]-PIT.x[pitBoxIndex-1]);pitBox.position.set(PIT.x[pitBoxIndex],PIT.y[pitBoxIndex]+.075,PIT.z[pitBoxIndex]);pitBox.rotation.y=-pitHeading;racePitGroup.add(pitBox);
const pitWhite=M(0xf0f0e9,.05,.8),pitOrange=M(0xff7a00,.15,.5),crewBlue=M(0x142872,.05,.8),crewBlack=M(0x11141b,.1,.6);
function pitPart(group,geometry,material,x,y,z,rotation=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.rotation.z=rotation;m.castShadow=true;m.receiveShadow=true;group.add(m);return m}
for(const z of[-1.8,1.8])pitPart(pitBox,new T.BoxGeometry(8,.018,.10),pitWhite,0,.02,z);
for(const x of[-4,4])pitPart(pitBox,new T.BoxGeometry(.1,.018,3.6),pitWhite,x,.02,0);
/* __PIT_CREW__ */
for(const z of[-4.3,4.3])for(let i=0;i<3;i++){const tyre=pitPart(pitBox,new T.TorusGeometry(.34,.13,7,16),crewBlack,-2+i*.9,.32,z);tyre.rotation.x=Math.PI/2}
const pitSign=new T.Mesh(new T.PlaneGeometry(4,1.1),new T.MeshBasicMaterial({map:textTexture('MR 26','#101927','#ff7a00','MILANO RACING'),side:T.DoubleSide}));pitSign.position.set(0,3.2,-4.7);pitBox.add(pitSign);pitPart(pitBox,new T.BoxGeometry(.12,3.5,.12),pitOrange,0,1.75,-4.7);
