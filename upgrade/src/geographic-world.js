// Real landform geometry replaces the procedural rings on every real venue.
const geographyAudit={realTerrain:!!geography,waterBodies:0,mappedRoads:0,forests:0,imageryVintage:geography?.imageryVintage};
if(geography){
 const g=geography,n=g.count,b=g.bounds,nb=g.nearBounds;
 const axis=(j)=>[...new Set([...Array.from({length:n},(_,i)=>b[0][j]+i/(n-1)*(b[1][j]-b[0][j])),nb[0][j],nb[1][j]])].sort((a,b)=>a-b);
 const xx=axis(0),zz=axis(1),P=[],U=[],I=[];
 for(const z of zz)for(const x of xx){const edge=(Math.abs(x-nb[0][0])<.01||Math.abs(x-nb[1][0])<.01)&&z>=nb[0][1]&&z<=nb[1][1]||(Math.abs(z-nb[0][1])<.01||Math.abs(z-nb[1][1])<.01)&&x>=nb[0][0]&&x<=nb[1][0];P.push(x,edge?groundHeight(x,z):geographicHeight(x,z),z);U.push(x/6000+.5,-z/6000+.5)}
 for(let j=0;j<zz.length-1;j++)for(let i=0;i<xx.length-1;i++){const x=(xx[i]+xx[i+1])/2,z=(zz[j]+zz[j+1])/2;if(x>nb[0][0]&&x<nb[1][0]&&z>nb[0][1]&&z<nb[1][1])continue;const a=j*xx.length+i;I.push(a,a+xx.length,a+1,a+1,a+xx.length,a+xx.length+1)}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(P,3));geo.setAttribute('uv',new T.Float32BufferAttribute(U,2));geo.setIndex(I);geo.computeVertexNormals();const farLand=new T.Mesh(geo,grassMaterial);farLand.name='Measured regional terrain';farLand.receiveShadow=true;scene.add(farLand);
 const satellite=pbrTexture(g.satellite,true),cover=pbrTexture(g.cover,true);satellite.wrapS=satellite.wrapT=cover.wrapS=cover.wrapT=T.ClampToEdgeWrapping;
 const prior=grassMaterial.onBeforeCompile;
 grassMaterial.onBeforeCompile=s=>{prior(s);s.uniforms.geoSatellite={value:satellite};s.uniforms.geoCover={value:cover};s.uniforms.geoBounds={value:new T.Vector4(b[0][0],b[0][1],b[1][0]-b[0][0],b[1][1]-b[0][1])};s.uniforms.coverBounds={value:new T.Vector4(nb[0][0],nb[0][1],nb[1][0]-nb[0][0],nb[1][1]-nb[0][1])};s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D geoSatellite,geoCover;uniform vec4 geoBounds,coverBounds;');s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
vec2 guv=(landscapePos.xz-geoBounds.xy)/geoBounds.zw,cuv=(landscapePos.xz-coverBounds.xy)/coverBounds.zw;
vec3 satelliteCol=pow(texture2D(geoSatellite,vec2(guv.x,1.-guv.y)).rgb,vec3(2.2));vec4 coverCol=texture2D(geoCover,vec2(cuv.x,1.-cuv.y));float inCover=step(0.,cuv.x)*step(cuv.x,1.)*step(0.,cuv.y)*step(cuv.y,1.);
float detail=clamp(dot(diffuseColor.rgb,vec3(.333))*3.,.6,1.3);vec3 mapped=mix(satelliteCol*1.12,pow(coverCol.rgb,vec3(2.2)),coverCol.a*inCover*.85);diffuseColor.rgb=mapped*mix(1.,detail,.25);
`);};grassMaterial.color.setHex(0xffffff);grassMaterial.needsUpdate=true;
 // Water follows the mapped shoreline. Only large coastal bodies share the local sea datum.
 const waterMaterial=new T.MeshPhysicalMaterial({color:linear(0x204e5c),normalMap:waterNormals,normalScale:new T.Vector2(.12,.12),metalness:0,roughness:.24,ior:1.333,reflectivity:.26,clearcoat:.2,clearcoatRoughness:.25,envMapIntensity:.55,side:T.DoubleSide});
 const coastal=['monaco','singapore','abu-dhabi','zandvoort'].includes(CIRCUIT.id),seaY=Math.min(...cy)-2;
 for(const f of g.features.filter(f=>f.kind==='water')){const pts=f.points,tri=T.ShapeUtils.triangulateShape(pts.map(p=>new T.Vector2(...p)),[]),p=[],uv=[];const area=Math.abs(T.ShapeUtils.area(pts.map(p=>new T.Vector2(...p))));const y=coastal&&area>8000?seaY:f.waterHeight??groundHeight(...pts[0])-.7;for(const t of tri)for(const j of t){p.push(pts[j][0],y,pts[j][1]);uv.push(pts[j][0]/120,pts[j][1]/120)}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();const mesh=new T.Mesh(geometry,waterMaterial);mesh.name=f.name||'Mapped water';mesh.userData.groundSurface=true;scene.add(mesh);geographyAudit.waterBodies++;}
 if(coastal){const p=[],u=[];for(let j=0;j<n-1;j++)for(let i=0;i<n-1;i++){const ids=[j*n+i,j*n+i+1,(j+1)*n+i,(j+1)*n+i+1];for(const t of[[0,2,1],[1,2,3]]){if(!t.every(k=>geographicHeights[ids[k]]+g.datumOffset<1))continue;for(const k of t){const id=ids[k],x=b[0][0]+(id%n)/(n-1)*(b[1][0]-b[0][0]),z=b[0][1]+Math.floor(id/n)/(n-1)*(b[1][1]-b[0][1]);p.push(x,seaY-.15,z);u.push(x/120,z/120)}}}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(p,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(u,2));geometry.computeVertexNormals();const ocean=new T.Mesh(geometry,waterMaterial);ocean.name='DEM coastline ocean';scene.add(ocean)}

 geographyAudit.mappedRoads=g.features.filter(f=>f.kind==='road').length;geographyAudit.forests=g.features.filter(f=>f.kind==='forest').length;
 scene.fog.density=isNight?.00038:CIRCUIT.id==='monaco'?.00016:THEME==='alpine'?.00012:.00020;
}
