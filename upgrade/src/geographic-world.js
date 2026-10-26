// Real landform geometry replaces the procedural rings on every real venue.
const geographyAudit={realTerrain:!!geography,waterBodies:0,mappedRoads:0,forests:0,imageryVintage:geography?.imageryVintage};
if(geography){
 const g=geography,n=g.count,b=g.bounds,nb=g.nearBounds;
 const grid=regionalGroundGrid(),xx=grid.x,zz=grid.z,P=[],U=[],I=[];
 for(let j=0;j<zz.length;j++)for(let i=0;i<xx.length;i++){const x=xx[i],z=zz[j];P.push(x,grid.y[j*xx.length+i],z);U.push(x/6000+.5,-z/6000+.5)}
 for(let j=0;j<zz.length-1;j++)for(let i=0;i<xx.length-1;i++){const x=(xx[i]+xx[i+1])/2,z=(zz[j]+zz[j+1])/2;if(x>nb[0][0]&&x<nb[1][0]&&z>nb[0][1]&&z<nb[1][1])continue;const a=j*xx.length+i;I.push(a,a+xx.length,a+1,a+1,a+xx.length,a+xx.length+1)}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('uv',new T.Float32BufferAttribute(U,2));geo.setIndex(I);geo.computeVertexNormals();const farLand=new T.Mesh(geo,grassMaterial);farLand.name='Measured regional terrain';farLand.receiveShadow=true;scene.add(farLand);
 const cover=pbrTexture(g.cover,true);cover.wrapS=cover.wrapT=T.ClampToEdgeWrapping;
 const prior=grassMaterial.onBeforeCompile;
 grassMaterial.onBeforeCompile=s=>{prior(s);s.uniforms.geoCover={value:cover};s.uniforms.geoPaving={value:barrierColor};s.uniforms.geoPavingNormal={value:barrierNormal};s.uniforms.geoUrban={value:0};s.uniforms.coverBounds={value:new T.Vector4(nb[0][0],nb[0][1],nb[1][0]-nb[0][0],nb[1][1]-nb[0][1])};
 s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D geoCover,geoPaving,geoPavingNormal;uniform vec4 coverBounds;uniform float geoUrban;');
 s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
vec2 cuv=(landscapePos.xz-coverBounds.xy)/coverBounds.zw;
vec4 coverCol=texture2D(geoCover,vec2(cuv.x,1.-cuv.y));float inCover=step(0.,cuv.x)*step(cuv.x,1.)*step(0.,cuv.y)*step(cuv.y,1.);
float semantic=coverCol.a*inCover,vegetated=smoothstep(.025,.065,coverCol.g-coverCol.r);
float grey=1.-smoothstep(.025,.085,max(max(coverCol.r,coverCol.g),coverCol.b)-min(min(coverCol.r,coverCol.g),coverCol.b));
float geoPavedWeight=mix(geoUrban,grey,semantic);geoPavedWeight*=1.-vegetated*semantic;
vec3 paving=pow(texture2D(geoPaving,landscapePos.xz/3.).rgb,vec3(2.2))*.68;
vec2 tile=abs(fract(landscapePos.xz/2.4)-.5);float seam=smoothstep(.488,.496,max(tile.x,tile.y));paving*=1.-seam*.12;
// Semantic land cover selects complete materials. Low-resolution satellite colour
// must not paint giant grey/green blotches over grass or roads as the camera moves.
float forest=semantic*vegetated*(1.-smoothstep(.25,.4,coverCol.r));
diffuseColor.rgb=mix(diffuseColor.rgb*(1.-forest*.12),paving,geoPavedWeight);
`);
 s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',T.ShaderChunk.normal_fragment_maps.replace('texture2D( normalMap, vUv )','mix(texture2D( normalMap, vUv ),texture2D( geoPavingNormal, landscapePos.xz/3. ),geoPavedWeight)'));
 };grassMaterial.color.setHex(0xffffff);grassMaterial.needsUpdate=true;
 // Water follows the mapped shoreline. Only large coastal bodies share the local sea datum.
 const waterMaterial=new T.MeshPhysicalMaterial({color:linear(0x204e5c),normalMap:waterNormals,normalScale:new T.Vector2(.12,.12),metalness:0,roughness:.24,ior:1.333,reflectivity:.26,clearcoat:.2,clearcoatRoughness:.25,envMapIntensity:.55,side:T.DoubleSide});
 const coastal=['monaco','singapore','abu-dhabi','zandvoort'].includes(CIRCUIT.id),seaY=Math.min(...cy)-2;
 for(const f of g.features.filter(f=>f.kind==='water')){const pts=f.points,tri=T.ShapeUtils.triangulateShape(pts.map(p=>new T.Vector2(...p)),[]),p=[],uv=[];const area=Math.abs(T.ShapeUtils.area(pts.map(p=>new T.Vector2(...p))));const y=coastal&&area>8000?seaY:f.waterHeight??groundHeight(...pts[0])-.7;for(const t of tri)for(const j of t){p.push(pts[j][0],y,pts[j][1]);uv.push(pts[j][0]/120,pts[j][1]/120)}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();const mesh=new T.Mesh(geometry,waterMaterial);mesh.name=f.name||'Mapped water';mesh.userData.groundSurface=true;mesh.userData.waterSupport=true;scene.add(mesh);geographyAudit.waterBodies++;}
 if(coastal){
  const p=[],u=[],height=geographicHeights;
  // Interpolate the far coastline within each height triangle. The old all-three-
  // vertices test drew 35 m stair steps and invented pools inside mapped urban land.
  const point=id=>[b[0][0]+(id%n)/(n-1)*(b[1][0]-b[0][0]),b[0][1]+Math.floor(id/n)/(n-1)*(b[1][1]-b[0][1]),height[id]+g.datumOffset];
  for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++)for(const ids of[[j*n+i,(j+1)*n+i,j*n+i+1],[j*n+i+1,(j+1)*n+i,(j+1)*n+i+1]]){
   const pts=ids.map(point),x=(pts[0][0]+pts[1][0]+pts[2][0])/3,z=(pts[0][1]+pts[1][1]+pts[2][1])/3;
   if(x>nb[0][0]-80&&x<nb[1][0]+80&&z>nb[0][1]-80&&z<nb[1][1]+80)continue;
   const clipped=[];for(let k=0;k<3;k++){const A=pts[k],B=pts[(k+1)%3],inside=A[2]<1;if(inside)clipped.push(A);if(inside!==(B[2]<1)){const t=(1-A[2])/(B[2]-A[2]);clipped.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,1]);}}
   for(let k=1;k<clipped.length-1;k++)for(const v of[clipped[0],clipped[k],clipped[k+1]]){p.push(v[0],seaY-.15,v[1]);u.push(v[0]/120,v[1]/120);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(u,2));geometry.computeVertexNormals();const ocean=new T.Mesh(geometry,waterMaterial);ocean.name='Interpolated distant coastline';scene.add(ocean);
 }


 geographyAudit.mappedRoads=g.features.filter(f=>f.kind==='road').length;geographyAudit.forests=g.features.filter(f=>f.kind==='forest').length;
 scene.fog.density=isNight?.00038:CIRCUIT.id==='monaco'?.00016:THEME==='alpine'?.00012:.00020;
}
