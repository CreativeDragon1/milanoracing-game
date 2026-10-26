// Track-relative placement keeps buildings away from every road branch.
function clearSite(x,z,r){if(buildingAt(x,z,r))return false;const q=prog(x,z,-1);return Math.hypot(x-cx[q.i],z-cz[q.i])>Math.abs(trackBarrier(q.i,q.d>0?1:-1))+r+5}
const night=THEME==='city',arid=THEME==='desert'||THEME==='marina'||THEME==='dunes',urban=night||THEME==='harbour'||THEME==='metropolis';
const pitSide=Math.sign(prog(PIT.x[PIT.box],PIT.z[PIT.box],-1).d)||-1;
const mainGrandstand=geography?null:grandstand(cx[25]-nx[25]*pitSide*40,cz[25]-nz[25]*pitSide*40,-Math.atan2(tz[25],tx[25])+(pitSide>0?Math.PI:0),85,10,CIRCUIT.name);
// Original venue garages are prepared beside the actual service lane in pit-details.js.
const pitLamps=[],posts=[];
const glow=new T.MeshStandardMaterial({color:0xe7f5ff,emissive:night?0xc9e1ff:0xffd6a4,emissiveIntensity:night?2:.6});
function tunnelStation(i){return CIRCUIT.features?.tunnel&&i>=CIRCUIT.features.tunnel[0]&&i<=CIRCUIT.features.tunnel[1]}
const fenceLines=[];for(let i=0;i<N;i+=4)for(const side of[-1,1]){if(pitOpening(i,side)||tunnelStation(i))continue;const o=trackBarrier(i,side)+side*.25,xx=cx[i]+nx[i]*o,zz=cz[i]+nz[i]*o;const base=(unifiedGround&&!bridgeSegments.has(i)?groundHeight(xx,zz):surfaceHeight(i,o))-groundHeight(xx,zz);fenceLines.push([[xx,base+1.1,zz],[xx,base+(urban?4.5:3.2),zz],.055]);}
beams(scene,fenceLines,M(0x737f8c,.5,.5));
for(let i=0;i<N;i+=28){if(tunnelStation(i))continue;const side=i%56?1:-1,o=trackBarrier(i,side)+side*2,xx=cx[i]+nx[i]*o,zz=cz[i]+nz[i]*o;posts.push([[xx,0,zz],[xx,15,zz],.12],[[xx,15,zz],[xx-nx[i]*side*3,15,zz-nz[i]*side*3],.1]);pitLamps.push([xx-nx[i]*side*1.5,14.8,zz-nz[i]*side*1.5,3,.15,1,0,-Math.atan2(tz[i],tx[i])]);}
beams(scene,posts);instanceBoxes(scene,glow,pitLamps,false);
// City windows are baked into a repeating texture; hundreds of towers cost one draw call.
const windowTexture=canvasTex(512,1024,(a,w,h)=>{a.fillStyle=night?'#162130':THEME==='harbour'?'#b9aa94':'#959ba1';a.fillRect(0,0,w,h);for(let yy=24;yy<h;yy+=72)for(let xx=20;xx<w;xx+=64){a.fillStyle=night?(rand()>.65?'#c7b995':'#23354b'):'#34444b';a.fillRect(xx,yy,34,45);a.fillStyle=night?'#384656':'#78828a';a.fillRect(xx+2,yy+2,14,19);a.fillStyle='#b0afa755';a.fillRect(xx+18,yy+2,14,40);a.fillStyle='#252d36';a.fillRect(xx-2,yy+46,39,4);a.fillStyle='#b4b3b14a';a.fillRect(xx-2,yy+50,39,3)}for(let yy=0;yy<h;yy+=72){a.fillStyle='#13182155';a.fillRect(0,yy,w,3)}});
const buildings=[];
// Mapped architecture and authored original districts supply the skyline.

instanceBoxes(scene,new T.MeshStandardMaterial({map:windowTexture,roughness:.65,metalness:.25,emissiveMap:windowTexture,emissive:night?0xffffff:0x000000,emissiveIntensity:night?.42:0}),buildings,false);
if(THEME==='desert'&&!geography){
 const i=100,o=trackBarrier(i,-1)-65,xx=cx[i]+nx[i]*o,zz=cz[i]+nz[i]*o;
 if(clearSite(xx,zz,30)){const tower=new T.Mesh(new T.CylinderGeometry(15,23,45,48),M(0xb9ac95,.35,.38));tower.position.set(xx,22.5+groundHeight(xx,zz),zz);scene.add(tower);for(let y=6;y<46;y+=6){const ring=new T.Mesh(new T.CylinderGeometry(24-y*.18,24-y*.18,.6,48),M(0xe8d2a7,.4,.3));ring.position.set(xx,y+groundHeight(xx,zz),zz);scene.add(ring)}}
}
if(THEME==='city'&&!geography){
 // Skyline landmark: three towers and a sky deck, placed clear of the race surface.
 const xx=trackBounds.x-155,zz=circuitCentre.z;
 const landmark=[];for(const d of [-48,0,48])landmark.push([xx+d,75,zz,24,150,32]);landmark.push([xx,155,zz,153,8,40]);instanceBoxes(scene,M(0x567590,.6,.3),landmark);
 const wheel=new T.Mesh(new T.TorusGeometry(57,1,8,96),glow);wheel.position.set(trackBounds.X+140,62+groundHeight(trackBounds.X+140,circuitCentre.z),circuitCentre.z);scene.add(wheel);const spokes=[];for(let a=0;a<16;a++){const t=a/16*Math.PI*2;spokes.push([[trackBounds.X+140,62,circuitCentre.z],[trackBounds.X+140+Math.cos(t)*57,62+Math.sin(t)*57,circuitCentre.z],.25]);}beams(scene,spokes);
}
const treePositions=[],treeItems=[],crowns=[];
const treeMax=urban?260:arid?90:THEME==='forest'?1800:1300;
for(let i=0;i<16000&&treePositions.length<treeMax;i++){const xx=trackBounds.x-500+rand()*(trackBounds.X-trackBounds.x+1000),zz=trackBounds.z-500+rand()*(trackBounds.Z-trackBounds.z+1000),h=6+rand()*9;if((geography&&geographicHeight(xx,zz)+geography.datumOffset<1)||!clearSite(xx,zz,10)||geography?.features.some(f=>f.kind==='water'&&insideFootprint(xx,zz,f.points)))continue;if(mappedForest.length&&!mappedForest.some(f=>insideFootprint(xx,zz,f.footprint))&&rand()<.87)continue;treePositions.push([xx,zz,h]);treeItems.push([xx,h*.4,zz,.45,h*.8,.45]);for(let j=0;j<3;j++)crowns.push([xx+Math.sin(j*2)*h*.13,h*(.7+j*.09),zz+Math.cos(j*2)*h*.13,h*.35,h*.3,h*.35]);}
// Crossed foliage cards use small leaf clusters to avoid balloon-shaped canopies.
const foliageTexture=canvasTex(256,256,(x,w,h)=>{for(let i=0;i<1900;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*.46,xx=.5+Math.cos(a)*r,yy=.5+Math.sin(a)*r;if(rand()>.9)continue;x.fillStyle=['#b1bd8e','#839965','#677e50','#94a775','#bac296'][i%5];x.beginPath();x.ellipse(xx*w,yy*h,3+rand()*5,2+rand()*3,rand()*6.28,0,Math.PI*2);x.fill()}});
const foliageVertices=[],foliageUV=[];for(let j=0;j<32;j++){const a=rand()*Math.PI*2,z=rand()*2-1,r=Math.sqrt(1-z*z)*(.25+rand()*.6),centre=new T.Vector3(Math.cos(a)*r,z*.9,Math.sin(a)*r),right=new T.Vector3(Math.cos(a),0,Math.sin(a)).multiplyScalar(.22+rand()*.18),up=new T.Vector3(0,.32+rand()*.2,0);for(const [u,v]of[[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){const p=centre.clone().addScaledVector(right,u*2-1).addScaledVector(up,v*2-1);foliageVertices.push(p.x,p.y,p.z);foliageUV.push(u,v)}}const foliageGeometry=new T.BufferGeometry();foliageGeometry.setAttribute('position',new T.Float32BufferAttribute(foliageVertices,3));foliageGeometry.setAttribute('uv',new T.Float32BufferAttribute(foliageUV,2));foliageGeometry.computeVertexNormals();const foliageMaterial=new T.MeshStandardMaterial({map:foliageTexture,alphaTest:.45,side:T.DoubleSide,roughness:1,color:0xffffff});
const trunks=new T.InstancedMesh(new T.CylinderGeometry(.2,.32,1,7),M(0x645442,0,1),treePositions.length),leaves=new T.InstancedMesh(foliageGeometry,foliageMaterial,treePositions.length*5),dummy=new T.Object3D();
treePositions.forEach(([x,z,h],i)=>{const ground=groundHeight(x,z);dummy.position.set(x,ground+h*.35,z);dummy.scale.set(1,h*.7,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);for(let j=0;j<5;j++){dummy.position.set(x+Math.sin(j*2.4)*h*.22,ground+h*(.65+(j===1?.18:j===4?.08:0)),z+Math.cos(j*2.4)*h*.22);dummy.scale.set(h*.24,h*.30,h*.24);dummy.rotation.set(rand(),rand()*3,rand());dummy.updateMatrix();leaves.setMatrixAt(i*5+j,dummy.matrix);leaves.setColorAt(i*5+j,linear([0x657b55,0x829468,0x536f55,0x819665,0x66835b][i%5]))}});leaves.material.onBeforeCompile=shader=>{shader.uniforms.windTime=windTime;shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nreflectedLight.indirectDiffuse+=diffuseColor.rgb*vec3(.05,.075,.025);');shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float windTime;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(windTime+instanceMatrix[3].x*.1+instanceMatrix[3].z*.05)*.018*(position.y+1.);');};trunks.castShadow=true;leaves.castShadow=true;leaves.receiveShadow=true;scene.add(trunks,leaves);
const meadow={count:0};
// Broad mountain silhouettes, atmospheric distance and dressed infield.
if(!geography&&!urban&&THEME!=='airfield')for(let band=0;band<3;band++){
 const vertices=[],colors=[],indices=[],segments=256,rings=16;
 const near=circuitRadius+180+band*300,depth=350,baseColor=linear([0x65736c,0x79838a,0x96939b][band]);
 for(let r=0;r<=rings;r++)for(let a=0;a<=segments;a++){
  const theta=a/segments*Math.PI*2,f=r/rings,radius=near+f*depth;
  const ridge=70+band*23+Math.sin(theta*5+band)*37+Math.sin(theta*11+1.7)*19+Math.sin(theta*23)*8+Math.sin(theta*47+f*5)*5;
  const height=Math.pow(Math.sin(f*Math.PI),1.45)*ridge*(.8+.2*Math.sin(theta*3+f*4));
  vertices.push(circuitCentre.x+Math.cos(theta)*radius,height*(THEME==='alpine'?2.4:THEME==='forest'?1.65:THEME==='dunes'?.20:arid?.32:.45)-8,circuitCentre.z+Math.sin(theta)*radius);
  const tint=baseColor.clone().multiplyScalar(.82+.24*f+.12*height/190);colors.push(tint.r,tint.g,tint.b);
  if(r<rings&&a<segments){const i=r*(segments+1)+a;indices.push(i,i+segments+1,i+1,i+1,i+segments+1,i+segments+2)}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const mountainMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:1,envMapIntensity:.35,side:T.DoubleSide});mountainMaterial.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 ridgePosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nridgePosition=position;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 ridgePosition;float terrainHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float terrainNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(terrainHash(i),terrainHash(i+vec2(1.,0.)),f.x),mix(terrainHash(i+vec2(0.,1.)),terrainHash(i+vec2(1.,1.)),f.x),f.y);}').replace('#include <map_fragment>','#include <map_fragment>\nvec2 rp=ridgePosition.xz+ridgePosition.y*.32;float rock=terrainNoise(rp*.024)*.55+terrainNoise(rp*.071)*.3+terrainNoise(rp*.21)*.15;diffuseColor.rgb*=.70+rock*.47;');};const ridge=new T.Mesh(geometry,mountainMaterial);scene.add(ridge);
}
const waterNormals=canvasTex(256,256,(c,w,h)=>{const data=c.createImageData(w,h),waves=[[3,2,.32],[5,-3,.21],[-7,5,.17],[11,9,.10],[-13,4,.08],[17,-15,.05]];for(let j=0;j<h;j++)for(let i=0;i<w;i++){const a=i/w*Math.PI*2,b=j/h*Math.PI*2,k=(j*w+i)*4;let nx=0,ny=0;for(let q=0;q<waves.length;q++){const[x,y,am]=waves[q],v=Math.cos(a*x+b*y+q*1.79)*am/Math.hypot(x,y);nx+=x*v;ny+=y*v;}const z=1/Math.hypot(nx,ny,1);data.data[k]=(nx*z*.5+.5)*255;data.data[k+1]=(ny*z*.5+.5)*255;data.data[k+2]=(z*.5+.5)*255;data.data[k+3]=255;}c.putImageData(data,0,0)});waterNormals.encoding=T.LinearEncoding;waterNormals.wrapS=waterNormals.wrapT=T.RepeatWrapping;waterNormals.repeat.set(4,4);
if(!geography&&(THEME==='harbour'||THEME==='marina')){
 const wx=trackBounds.X+210,wz=circuitCentre.z,water=new T.Mesh(new T.PlaneGeometry(350,1100),new T.MeshStandardMaterial({color:0x316c84,metalness:.55,roughness:.2,normalMap:waterNormals,envMapIntensity:1.2}));water.rotation.x=-Math.PI/2;water.position.set(wx,.005,wz);scene.add(water);
 const yachts=[],cabins=[];for(let i=0;i<16;i++){const xx=wx-100+(i%4)*65,zz=wz-350+Math.floor(i/4)*170;yachts.push([xx,.8,zz,9,1.6,30]);cabins.push([xx,2.2,zz-2,6,2,14]);}instanceBoxes(scene,M(0xe9edf0,.3,.3),yachts,true,false);instanceBoxes(scene,M(0x7191a4,.6,.2),cabins,true,false);
}
if(THEME==='marina'&&!geography){
 const xx=trackBounds.x-90,zz=circuitCentre.z;
 const hotel=new T.Mesh(new T.SphereGeometry(1,32,20),new T.MeshStandardMaterial({color:0xb6c4df,metalness:.7,roughness:.24,wireframe:true,emissive:0x5533ad,emissiveIntensity:.7}));hotel.scale.set(45,26,100);hotel.position.set(xx,20+groundHeight(xx,zz),zz);scene.add(hotel);
}
if(THEME==='airfield'&&!geography){const i=140,o=trackBarrier(i,-1)-65;box(90,8,30,0x8999ac,cx[i]+nx[i]*o,4,cz[i]+nz[i]*o,-Math.atan2(tz[i],tx[i]));}
// A small light rig follows the player on night layouts; masts provide the visual source.
const nightLight=new T.PointLight(0xcce5ff,night?1.8:0,75,1.1);nightLight.position.set(0,14,0);scene.add(nightLight);

const fenceTex=canvasTex(64,64,(a,w,h)=>{a.strokeStyle='#9ba7ab';a.lineWidth=.65;for(let j=-64;j<128;j+=16){a.beginPath();a.moveTo(j,0);a.lineTo(j+64,64);a.stroke();a.beginPath();a.moveTo(j,0);a.lineTo(j-64,64);a.stroke()}});fenceTex.wrapS=fenceTex.wrapT=T.RepeatWrapping;fenceTex.repeat.set(4,4);fenceTex.anisotropy=8;
const fenceMat=new T.MeshStandardMaterial({map:fenceTex,color:0x687783,alphaTest:.25,side:T.DoubleSide,roughness:.7,metalness:.25});
for(const side of[-1,1]){const P=[],UV=[];for(let i=0;i<N;i++){if(pitOpening(i,side)||tunnelStation(i))continue;const j=(i+1)%N,o=trackBarrier(i,side)+side*.25,p=trackBarrier(j,side)+side*.25,A=[cx[i]+nx[i]*o,cz[i]+nz[i]*o],B=[cx[j]+nx[j]*p,cz[j]+nz[j]*p],h=urban?4.5:3.2,u=i*LEN/N/2,v=(i+1)*LEN/N/2,ay=unifiedGround&&!bridgeSegments.has(i)?groundHeight(...A):surfaceHeight(i,o),by=unifiedGround&&!bridgeSegments.has(j)?groundHeight(...B):surfaceHeight(j,p);P.push(A[0],ay+1.2,A[1],B[0],by+1.2,B[1],B[0],by+h,B[1],A[0],ay+1.2,A[1],B[0],by+h,B[1],A[0],ay+h,A[1]);UV.push(u,0,v,0,v,h-1.2,u,0,v,h-1.2,u,h-1.2)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('uv',new T.Float32BufferAttribute(UV,2));g.computeVertexNormals();const fence=new T.Mesh(g,fenceMat);fence.name='Circuit catch fencing';fence.userData.trimRaceCorridor=true;scene.add(fence)}
