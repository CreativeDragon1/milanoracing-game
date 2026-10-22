// Circuit architecture. Repeated seats, spectators and structures are instanced.
const unitBox=new T.BoxGeometry(1,1,1),steel=M(0x57636d,.55,.42),concrete=M(0x989c9b,0,.94),seatMat=M(0xffffff,.08,.65),roofMat=M(0xc0c9cd,.45,.5);
function instanceBoxes(parent,material,items,shadow=true,elevate=true){const mesh=new T.InstancedMesh(unitBox,material,items.length),o=new T.Object3D();items.forEach((p,i)=>{o.position.set(p[0],p[1]+(parent===scene&&elevate?groundHeight(p[0],p[2]):0),p[2]);o.scale.set(p[3],p[4],p[5]);o.rotation.set(p[6]||0,p[7]||0,p[8]||0,'YXZ');o.updateMatrix();mesh.setMatrixAt(i,o.matrix);if(p[9]!==undefined)mesh.setColorAt(i,linear(p[9]))});mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh}
function beams(parent,items,material=steel){const mesh=new T.InstancedMesh(unitBox,material,items.length),o=new T.Object3D(),axis=new T.Vector3(0,1,0);items.forEach(([a,b,w],i)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b);if(parent===scene){A.y+=groundHeight(A.x,A.z);B.y+=groundHeight(B.x,B.z)}const d=B.clone().sub(A);o.position.copy(A).add(B).multiplyScalar(.5);o.quaternion.setFromUnitVectors(axis,d.clone().normalize());o.scale.set(w,d.length(),w);o.updateMatrix();mesh.setMatrixAt(i,o.matrix)});mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
function grandstand(x,z,rotation,length,rows,title){const group=new T.Group();group.position.set(x,groundHeight(x,z),z);group.rotation.y=rotation;scene.add(group);const steps=[],seats=[],crowd=[],framework=[],rails=[],canopy=[],heads=[];
 const columns=Math.floor(length/.79),depth=rows*1.25,roofY=rows*.64+3.5;
 for(let row=0;row<rows;row++){const y=.8+row*.64,zz=row*1.25;steps.push([0,y-.3,zz,length,.24,1.27],[0,y-.56,zz-.57,length,.52,.12]);
 for(let col=0;col<columns;col++){const xx=-length/2+.5+col*.79;if(col%23>=20)continue;const color=(Math.floor(col/23)+Math.floor(row/3))%4===0?0xe57437:0x29467a;
 seats.push([xx,y+.14,zz,.54,.10,.50,0,0,0,color],[xx,y+.38,zz+.25,.54,.48,.08,-.12,0,0,color]);
 if(rand()>.2){const shift=(rand()-.5)*.12;crowd.push([xx+shift,y+.51,zz+.02,.36,.43,.3,0,0,(rand()-.5)*.12,[0x273e57,0xc5c4bb,0xb46639,0x394344,0x394c81,0xa3afb9][Math.floor(rand()*6)]]);heads.push([xx+shift,y+.85,zz+.03,.14,[0xce9d7b,0xb27b56,0x755443,0xd3b398][Math.floor(rand()*4)]])}
 }}
 for(let col=20;col<columns;col+=23){const xx=-length/2+col*.79+.75;for(let r=0;r<rows*2;r++)steps.push([xx,.30+r*.32,r*.625-1.1,2.1,.16,.63]);rails.push([[xx-1.1,1.7,-1],[xx-1.1,rows*.64+1.8,depth-1],.045]);}
 for(let xx=-length/2;xx<=length/2+.1;xx+=length/6){framework.push([[xx,0,depth-1],[xx,roofY+1,depth-1],.2],[[xx,roofY+1,depth-1],[xx,roofY,-3.2],.17],[[xx,roofY-1,depth-1],[xx,roofY,-3.2],.12],[[xx,0,depth-1],[xx,rows*.64+.4,depth*.5],.12]);for(let zz=0;zz<depth;zz+=2.5)framework.push([[xx,.1,zz],[xx,.64*zz/1.25+.6,zz],.1]);}
 for(let r=0;r<3;r++)framework.push([[-length/2,roofY+r*.1,-2+r*depth/2],[length/2,roofY+r*.1,-2+r*depth/2],.12]);
 canopy.push([0,roofY+.22,depth*.44-1,length+3,.18,depth+4,-.065]);
 for(let xx=-length/2;xx<=length/2;xx+=2.3){rails.push([[xx,.85,-1.1],[xx,1.95,-1.1],.045]);}
 rails.push([[-length/2,1.95,-1.1],[length/2,1.95,-1.1],.05]);
 instanceBoxes(group,concrete,steps);instanceBoxes(group,seatMat,seats);instanceBoxes(group,M(0xffffff,0,.96),crowd,false);beams(group,framework);beams(group,rails);instanceBoxes(group,roofMat,canopy);
 const headMesh=new T.InstancedMesh(new T.SphereGeometry(1,8,6),M(0xffffff,0,.95),heads.length),d=new T.Object3D();heads.forEach(([xx,y,zz,r,color],i)=>{d.position.set(xx,y,zz);d.scale.set(r,r*1.12,r);d.updateMatrix();headMesh.setMatrixAt(i,d.matrix);headMesh.setColorAt(i,linear(color))});group.add(headMesh);
 instanceBoxes(group,M(0x162a43,.2,.6),[[0,roofY-.12,-3.05,length+3,.6,.14]]);instanceBoxes(group,M(0xe77f41,.1,.65),[[0,roofY-.46,-3.07,length+3,.055,.16]]);
 const label=new T.Mesh(new T.PlaneGeometry(Math.min(28,length*.5),1.0),new T.MeshBasicMaterial({map:textTexture(title,'#14243c','#f6f0e6','MILANO CIRCUIT  /  TEAM EDITION'),side:T.DoubleSide}));label.position.set(0,roofY-.05,-3.16);label.rotation.y=Math.PI;group.add(label);
 return group;
}
const mainGrandstand=grandstand(72,29,0,112,11,'MILANO GRANDSTAND');
for(const [i,side,length,rows,title] of[[CIRCUIT.turns[1].index,-1,65,8,'CURVA 02'],[CIRCUIT.turns[7].index,-1,68,8,'TRIBUNA MILANO']]){grandstand(cx[i]+nx[i]*(trackBarrier(i,side)+side*13),cz[i]+nz[i]*(trackBarrier(i,side)+side*13),-Math.atan2(tz[i],tx[i])+(side<0?Math.PI:0),length,rows,title)}
// Pit lane, working garages and the glazed hospitality floor.
box(480,.04,12,0x41474d,130,.025,-28);
for(let x=7;x<128;x+=9){box(4,.008,.10,0xe5dfce,x,.052,-25);box(.1,.008,3.6,0xe7bf42,x,.053,-29)}
box(123,.8,.6,0xa5a8a8,67,.4,-21.7);
const pit=new T.Group();scene.add(pit);const pitFrames=[],pitWalls=[],pitGlass=[],pitDetails=[];
for(let j=0;j<9;j++){const x=15+j*12;
 pitWalls.push([x,2.7,-39,11.8,5.4,13],[x,6.6,-39,11.8,2.2,13]);
 pitDetails.push([x,2.2,-32.45,9.8,3.9,.15,0,0,0,0x152331]);
 // Shutter header, garage jambs, warm strips and floor markings.
 pitFrames.push([x-5.2,2.4,-32.1,.24,4.8,.3],[x+5.2,2.4,-32.1,.24,4.8,.3],[x,4.82,-32.1,10.6,.24,.3]);
 pitGlass.push([x,6.6,-32.35,10.4,1.75,.12]);
 for(let k=-1;k<=1;k++)pitFrames.push([x+k*3.5,6.65,-32.21,.08,1.85,.12]);
 board(String(j+1).padStart(2,'0'),x,4.36,-31.97,0,1.7,.85,'GARAGE');
 for(const d of[-1,1])pitDetails.push([x+d*4.1,.7,-31.65,.8,1.4,.8,0,0,0,j%2?0x23478c:0xc7733c]);
}
instanceBoxes(pit,M(0xbec3c4,.12,.8),pitWalls);instanceBoxes(pit,steel,pitFrames);instanceBoxes(pit,M(0x21364c,.55,.22),pitGlass);instanceBoxes(pit,M(0xffffff,.1,.7),pitDetails);
box(113,.28,14.2,0x405362,63,8.02,-39);box(112,.18,2.2,0x263542,63,5.48,-31.25);
board('MILANO RACING',64,8.7,-38,0,37,1.65,'PADDOCK CLUB  /  RACE CONTROL');
const pitLights=new T.InstancedMesh(unitBox,new T.MeshStandardMaterial({color:0xffedc9,emissive:0xffd39a,emissiveIntensity:.85}),9);const lightDummy=new T.Object3D();for(let i=0;i<9;i++){lightDummy.position.set(15+i*12,4.47,-32.0);lightDummy.scale.set(8,.07,.12);lightDummy.updateMatrix();pitLights.setMatrixAt(i,lightDummy.matrix)}scene.add(pitLights);
// Mesh catch fencing: fine diagonal mesh with structural posts and inward arms.
const fenceTex=canvasTex(128,128,(x,w,h)=>{x.clearRect(0,0,w,h);x.strokeStyle='rgba(107,125,136,.72)';x.lineWidth=1.3;for(let i=-128;i<256;i+=16){x.beginPath();x.moveTo(i,0);x.lineTo(i+128,128);x.stroke();x.beginPath();x.moveTo(i,0);x.lineTo(i-128,128);x.stroke()}});fenceTex.wrapS=fenceTex.wrapT=T.RepeatWrapping;fenceTex.repeat.set(70,2);
const fenceMat=new T.MeshStandardMaterial({map:fenceTex,transparent:true,alphaTest:.15,side:T.DoubleSide,roughness:.85,depthWrite:false});
function safetyFence(side,start,end){const P=[],UV=[],posts=[];for(let i=start;i<end;i++){const j=i+1,a=k=>[cx[k]+nx[k]*(trackBarrier(k,side)+side*.3),cz[k]+nz[k]*(trackBarrier(k,side)+side*.3)];const A=a(i),B=a(j),u=(i-start)/(end-start),v=(j-start)/(end-start);P.push(A[0],1.2,A[1],B[0],1.2,B[1],B[0],4.2,B[1],A[0],1.2,A[1],B[0],4.2,B[1],A[0],4.2,A[1]);UV.push(u,0,v,0,v,1,u,0,v,1,u,1);if(i%3===0)posts.push([[A[0],1.1,A[1]],[A[0],4.35,A[1]],.075],[[A[0],4.35,A[1]],[A[0]-nx[i]*side*.55,4.8,A[1]-nz[i]*side*.55],.065]);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));g.computeVertexNormals();const m=new T.Mesh(g,fenceMat);scene.add(m);beams(scene,posts)}
safetyFence(1,0,100);safetyFence(-1,0,100);for(const turn of [CIRCUIT.turns[1],CIRCUIT.turns[7]])safetyFence(-1,turn.index-15,turn.index+15);
// Textured gravel shoulders and rubber laid down in the braking zones.
const gravel=canvasTex(256,256,x=>{x.fillStyle='#8b8271';x.fillRect(0,0,256,256);for(let i=0;i<14000;i++){x.fillStyle=rand()>.5?'#b8ac97':'#625e54';const z=1+rand()*2;x.fillRect(rand()*256,rand()*256,z,z)}});gravel.wrapS=gravel.wrapT=T.RepeatWrapping;
const shoulders=scene.children.filter(o=>o.isMesh&&o.geometry.attributes?.color&&o.material.vertexColors&&!o.material.map&&o.position.y===0).slice(0,2);for(const m of shoulders){m.material.map=gravel;m.material.bumpMap=gravel;m.material.bumpScale=.04;m.material.needsUpdate=true}
const skidCanvas=canvasTex(64,256,(x,w,h)=>{const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(9,11,13,0)');g.addColorStop(.3,'rgba(9,11,13,.25)');g.addColorStop(.7,'rgba(9,11,13,.25)');g.addColorStop(1,'rgba(9,11,13,0)');x.fillStyle=g;x.fillRect(0,0,w,h)});
const skidMat=new T.MeshStandardMaterial({map:skidCanvas,transparent:true,depthWrite:false,roughness:.88,polygonOffset:true,polygonOffsetFactor:-1});
for(const start of[70,175,250,360,445,525]){for(const side of[-.85,.85]){const P=[],U=[];for(let n=0;n<12;n++){const i=(start+n)%N,j=(i+1)%N;for(const [k,o,u,v]of[[i,side-.15,0,0],[i,side+.15,1,0],[j,side+.15,1,1],[i,side-.15,0,0],[j,side+.15,1,1],[j,side-.15,0,1]]){P.push(cx[k]+nx[k]*o,.048,cz[k]+nz[k]*o);U.push(u,v)}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(U,2));g.computeVertexNormals();scene.add(new T.Mesh(g,skidMat))}}
// Landscaped tree belt: softer, clustered crowns instead of pointed placeholders.
const treePositions=[];for(let i=0;i<6000&&treePositions.length<750;i++){const x=trackBounds.x-130+rand()*(trackBounds.X-trackBounds.x+260),z=trackBounds.z-130+rand()*(trackBounds.Z-trackBounds.z+260),p=prog(x,z,-1);if(Math.hypot(x-cx[p.i],z-cz[p.i])<Math.abs(trackBarrier(p.i,p.d>0?1:-1))+24)continue;if(((x-245)/92)**2+((z-142)/54)**2<1)continue;if(x>-15&&x<145&&z>-65&&z<70)continue;treePositions.push([x,z,5+rand()*7])}
// Crossed foliage cards use small leaf clusters to avoid balloon-shaped canopies.
const foliageTexture=canvasTex(256,256,(x,w,h)=>{for(let i=0;i<1900;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*.46,xx=.5+Math.cos(a)*r,yy=.5+Math.sin(a)*r;if(rand()>.9)continue;x.fillStyle=['#b1bd8e','#839965','#677e50','#94a775','#bac296'][i%5];x.beginPath();x.ellipse(xx*w,yy*h,3+rand()*5,2+rand()*3,rand()*6.28,0,Math.PI*2);x.fill()}});
const foliageVertices=[],foliageUV=[];for(let j=0;j<3;j++){const a=j*Math.PI/3,x=Math.cos(a),z=Math.sin(a);foliageVertices.push(-x,-1,-z,x,-1,z,x,1,z,-x,-1,-z,x,1,z,-x,1,-z);foliageUV.push(0,0,1,0,1,1,0,0,1,1,0,1)}const foliageGeometry=new T.BufferGeometry();foliageGeometry.setAttribute('position',new T.Float32BufferAttribute(foliageVertices,3));foliageGeometry.setAttribute('uv',new T.Float32BufferAttribute(foliageUV,2));foliageGeometry.computeVertexNormals();const foliageMaterial=new T.MeshStandardMaterial({map:foliageTexture,alphaTest:.45,side:T.DoubleSide,roughness:1,color:0xffffff});
const trunks=new T.InstancedMesh(new T.CylinderGeometry(.2,.32,1,7),M(0x645442,0,1),treePositions.length),leaves=new T.InstancedMesh(foliageGeometry,foliageMaterial,treePositions.length*5),dummy=new T.Object3D();
treePositions.forEach(([x,z,h],i)=>{dummy.position.set(x,h*.35,z);dummy.scale.set(1,h*.7,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);for(let j=0;j<5;j++){dummy.position.set(x+Math.sin(j*2.4)*h*.22,h*(.65+(j===1?.18:j===4?.08:0)),z+Math.cos(j*2.4)*h*.22);dummy.scale.set(h*.24,h*.30,h*.24);dummy.rotation.set(rand(),rand()*3,rand());dummy.updateMatrix();leaves.setMatrixAt(i*5+j,dummy.matrix);leaves.setColorAt(i*5+j,linear([0x8a9c77,0xa4ad86,0x7d9678,0xb2b68e,0x93a080][i%5]))}});leaves.material.onBeforeCompile=shader=>{shader.uniforms.windTime=windTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float windTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(windTime+instanceMatrix[3].x*.1+instanceMatrix[3].z*.05)*.018*(position.y+1.);');};trunks.castShadow=true;leaves.castShadow=true;leaves.receiveShadow=true;scene.add(trunks,leaves);
for(let i=30;i<N;i+=48){const side=i%3?1:-1;board(i%2?'MILANO RACING':'MILANO CIRCUIT',cx[i]+nx[i]*(trackBarrier(i,side)+side*2),2.2,cz[i]+nz[i]*(trackBarrier(i,side)+side*2),-Math.atan2(tz[i],tx[i])+(side<0?0:Math.PI),15,1.8,'TEAM EDITION  /  MOTORSPORT')}
// Distant light masts add scale; emissive fixtures require no extra realtime lights.
const masts=[],lamps=[];for(const x of[-12,40,95,142]){for(const z of[-53,52]){masts.push([[x,0,z],[x,18,z],.16],[[x-2,18,z],[x+2,18,z],.14]);lamps.push([x,17.85,z,4,.16,.65])}}beams(scene,masts);instanceBoxes(scene,new T.MeshStandardMaterial({color:0xffefcf,emissive:0xffdba4,emissiveIntensity:.65}),lamps,false);
