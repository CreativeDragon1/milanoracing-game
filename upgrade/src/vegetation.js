// Poly Haven Tree Small 02: real trunk, branches and individual leaf geometry, with distance LODs.
const TREE_MODEL=__TREE_MODEL__,treeLOD={near:[],middle:[],far:null,last:-Infinity},treeAudit={source:'Poly Haven Tree Small 02 / CC0',nearTriangles:0,middleTriangles:0};
const treeTextures={trunk:{map:pbrTexture('__TREE_TRUNK_DIFF__',true),normal:pbrTexture('__TREE_TRUNK_NORMAL__')},branches:{map:pbrTexture('__TREE_BRANCH_DIFF__',true),normal:pbrTexture('__TREE_BRANCH_NORMAL__')},leaves:{map:pbrTexture('__TREE_LEAF_DIFF__',true),normal:pbrTexture('__TREE_LEAF_NORMAL__')}};
const decodeTree=s=>new Float32Array(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
let modelMin=Infinity,modelMax=-Infinity;for(const part of TREE_MODEL.near){const p=decodeTree(part.positions);for(let i=1;i<p.length;i+=3){modelMin=Math.min(modelMin,p[i]);modelMax=Math.max(modelMax,p[i])}}
for(const level of['near','middle'])for(const part of TREE_MODEL[level]){const kind=part.material.includes('leaves')?'leaves':part.material.includes('branches')?'branches':'trunk',tex=treeTextures[kind],g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(decodeTree(part.positions),3));g.setAttribute('normal',new T.BufferAttribute(decodeTree(part.normals),3));g.setAttribute('uv',new T.BufferAttribute(decodeTree(part.uv),2));const material=new T.MeshStandardMaterial({map:tex.map,normalMap:tex.normal,normalScale:new T.Vector2(.45,.45),roughness:kind==='leaves'?.78:.95,side:kind==='leaves'?T.DoubleSide:T.FrontSide,color:kind==='leaves'?0xbac99f:0xffffff});const mesh=new T.InstancedMesh(g,material,level==='near'?32:128);mesh.frustumCulled=false;mesh.count=0;mesh.castShadow=level==='near';mesh.receiveShadow=true;mesh.name='3D vegetation '+level+' '+kind;scene.add(mesh);treeLOD[level].push(mesh);treeAudit[level+'Triangles']+=part.triangles;}
leaves.visible=false;trunks.visible=false;
const canopyTextures=[pbrTexture('__TREE_CANOPY_0__',true),pbrTexture('__TREE_CANOPY_1__',true)];
const canopyGeometry=new T.PlaneGeometry(1,1);
const canopyMaterial=new T.MeshStandardMaterial({map:canopyTextures[0],alphaTest:.42,side:T.DoubleSide,roughness:.92,color:0xc0c9b8});
const farTree=new T.InstancedMesh(canopyGeometry,canopyMaterial,treePositions.length*2),farTrunks=new T.InstancedMesh(new T.CylinderGeometry(.22,.36,1,5),M(0x605142,0,1),0);farTree.frustumCulled=false;farTree.receiveShadow=false;scene.add(farTree);treeLOD.far=farTree;

const trees=treePositions.map(([x,z,h],id)=>({x,z,h,y:groundHeight(x,z),id,angle:((id*129.32)%360)*Math.PI/180})),treeDummy=new T.Object3D();
const treeFrustum=new T.Frustum(),treeProjection=new T.Matrix4(),treeSphere=new T.Sphere();
function updateVegetation(now){if(now-treeLOD.last<180)return;treeLOD.last=now;cam.updateMatrixWorld();treeFrustum.setFromProjectionMatrix(treeProjection.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));const close=[],distant=[],cells=new Map();for(const t of trees){t.d=(t.x-cam.position.x)**2+(t.z-cam.position.z)**2;treeSphere.center.set(t.x,t.y+t.h*.5,t.z);treeSphere.radius=t.h*.9+30;if(t.d>150*150&&!treeFrustum.intersectsSphere(treeSphere))continue;
 // Nearby trees retain their complete geometry. At long distance, overlapping
 // canopy impostors share a stable world cell instead of shading the same pixels
 // dozens of times. Keep the tallest silhouette at its genuine source position.
 if(t.d<420*420)close.push(t);else{const size=t.d<1000*1000?12:t.d<2000*2000?18:24,key=size+':'+Math.floor(t.x/size)+':'+Math.floor(t.z/size),old=cells.get(key);if(!old||t.h+t.y>old.h+old.y)cells.set(key,t)}}distant.push(...cells.values());close.sort((a,b)=>a.d-b.d);const sorted=close.concat(distant);let near=0,middle=0,far=0;
 for(const t of sorted){treeSphere.center.set(t.x,t.y+t.h*.5,t.z);treeSphere.radius=t.h*.9+30;if(t.d>150*150&&!treeFrustum.intersectsSphere(treeSphere))continue;const level=t.d<150*150&&near<32?'near':t.d<420*420&&middle<128?'middle':null;
  if(level){const index=level==='near'?near++:middle++,scale=t.h/(modelMax-modelMin);treeDummy.position.set(t.x,t.y-modelMin*scale,t.z);treeDummy.scale.setScalar(scale);treeDummy.rotation.set(0,t.angle,0);treeDummy.updateMatrix();for(const mesh of treeLOD[level])mesh.setMatrixAt(index,treeDummy.matrix)}
  else{for(let j=0;j<2;j++){treeDummy.position.set(t.x,t.y+t.h*.5,t.z);treeDummy.scale.setScalar(t.h*(TREE_MODEL.canopyScale||1.5));treeDummy.rotation.set(0,t.angle+j*Math.PI/2,0);treeDummy.updateMatrix();farTree.setMatrixAt(far*2+j,treeDummy.matrix)}far++}

 }
 for(const level of['near','middle'])for(const mesh of treeLOD[level]){mesh.count=level==='near'?near:middle;mesh.instanceMatrix.needsUpdate=true}farTree.count=far*2;farTree.instanceMatrix.needsUpdate=true;farTrunks.instanceMatrix.needsUpdate=true;if(farTree.instanceColor)farTree.instanceColor.needsUpdate=true;treeAudit.active={near,middle,far};}
