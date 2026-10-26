// Zandvoort's natural surfaces share one continuous sand/marram material.
// Mapped paved routes and gravel traps retain their own exact boundaries.
if(CIRCUIT.id==='zandvoort'){
 const duneMask=pbrTexture('__ZANDVOORT_DUNE_COVER__');duneMask.wrapS=duneMask.wrapT=T.ClampToEdgeWrapping;
 const b=geography.nearBounds;
 scene.traverse(o=>{if(o.userData.calendarGround&&/^Mapped (lawn|meadow|scrub|sand) ground detail$/.test(o.name))o.visible=false;});
 grassMaterial.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{duneCover:{value:duneMask},duneSand:{value:photoSand},duneGrass:{value:photoGrass},duneSandNormal:{value:photoSandNormal},duneGrassNormal:{value:photoGrassNormal},duneBounds:{value:new T.Vector4(b[0][0],b[0][1],b[1][0]-b[0][0],b[1][1]-b[0][1])}});
  s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 duneWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nduneWorld=(modelMatrix*vec4(position,1.)).xyz;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>',`#include <common>
varying vec3 duneWorld;uniform sampler2D duneCover,duneSand,duneGrass,duneSandNormal,duneGrassNormal;uniform vec4 duneBounds;
float duneHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float duneNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(duneHash(i),duneHash(i+vec2(1,0)),f.x),mix(duneHash(i+vec2(0,1)),duneHash(i+vec2(1,1)),f.x),f.y);}
`);
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`
vec2 duneUV=vec2(duneWorld.x,-duneWorld.z),duneC=(duneWorld.xz-duneBounds.xy)/duneBounds.zw;
float growth=texture2D(duneCover,vec2(duneC.x,1.-duneC.y)).r;
float smallDunes=duneNoise(duneWorld.xz*.24),largeDunes=duneNoise(duneWorld.xz*.021);
growth=smoothstep(.16,.82,growth+(smallDunes-.5)*.34+(largeDunes-.5)*.12);
vec3 sand=pow(texture2D(duneSand,duneUV/1.8).rgb,vec3(2.2));
vec3 grass=pow(texture2D(duneGrass,duneUV/1.4).rgb,vec3(2.2))*vec3(.92,.91,.70);
diffuseColor.rgb=mix(sand,grass,growth)*(.86+largeDunes*.20+smallDunes*.08);
`);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',T.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vUv )','mix(texture2D(duneSandNormal,duneUV/1.8),texture2D(duneGrassNormal,duneUV/1.4),growth)'));
 };grassMaterial.customProgramCacheKey=()=> 'zandvoort-continuous-dunes-v1';grassMaterial.needsUpdate=true;
 // Low marram clumps supply a real silhouette at track level. One shared mesh,
 // spatial batches and no per-frame animation keep the grass cheap to draw.
 const P=[],C=[];for(let blade=0;blade<7;blade++){
  const angle=blade*2.399,dx=Math.cos(angle),dz=Math.sin(angle),h=.36+(blade%3)*.15,w=.025;
  const points=[[-dz*w,0,dx*w],[dz*w,0,-dx*w],[dx*.10+dz*w*.45,h*.65,dz*.10-dx*w*.45],[dx*.16,h,dz*.16]];
  for(const ids of[[0,1,2],[0,2,3]])for(const j of ids){P.push(...points[j]);C.push(...linear(j===3?0xb8af75:j===0?0x666b43:0x929568).toArray())}
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('color',new T.Float32BufferAttribute(C,3));geo.computeVertexNormals();
 const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}),groups=new Map();
 let state=7083;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<N;i+=3)for(const side of[-1,1])for(let j=0;j<3;j++){
  const off=trackBarrier(i,side)+side*(6+random()*42),x=cx[i]+nx[i]*off+(random()-.5)*7,z=cz[i]+nz[i]*off+(random()-.5)*7;
  if(!clearSite(x,z,2)||buildingAt(x,z,2))continue;
  const h=localTerrainHeight(x,z);if(h===null)continue;
  const key=Math.floor(x/120)+':'+Math.floor(z/120);if(!groups.has(key))groups.set(key,[]);groups.get(key).push([x,h,z,.65+random()*.75,random()*Math.PI*2]);
 }
 const object=new T.Object3D();for(const rows of groups.values()){
  const localGeo=geo.clone();localGeo.boundingSphere=new T.Box3().setFromPoints(rows.map(p=>new T.Vector3(p[0],p[1],p[2]))).getBoundingSphere(new T.Sphere());localGeo.boundingSphere.radius+=1.5;
  const mesh=new T.InstancedMesh(localGeo,mat,rows.length);mesh.name='Zandvoort marram dune grass';mesh.frustumCulled=true;
  rows.forEach(([x,y,z,k,a],i)=>{object.position.set(x,y,z);object.scale.set(k,k,k);object.rotation.set(0,a,0);object.updateMatrix();mesh.setMatrixAt(i,object.matrix)});
  mesh.receiveShadow=true;scene.add(mesh);
 }
}
