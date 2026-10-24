// Poly Haven Tree Small 02: real trunk, branches and individual leaf geometry, with distance LODs.
const TREE_MODEL=__TREE_MODEL__,treeLOD={near:[],middle:[],far:null,last:-Infinity},treeAudit={source:'Poly Haven Tree Small 02 / CC0',nearTriangles:0,middleTriangles:0};
const treeTextures={trunk:{map:pbrTexture('__TREE_TRUNK_DIFF__',true),normal:pbrTexture('__TREE_TRUNK_NORMAL__')},branches:{map:pbrTexture('__TREE_BRANCH_DIFF__',true),normal:pbrTexture('__TREE_BRANCH_NORMAL__')},leaves:{map:pbrTexture('__TREE_LEAF_DIFF__',true),normal:pbrTexture('__TREE_LEAF_NORMAL__')}};
const decodeTree=s=>new Float32Array(decodeBase64Bytes(s).buffer);
let modelMin=Infinity,modelMax=-Infinity;for(const part of TREE_MODEL.near){const p=decodeTree(part.positions);for(let i=1;i<p.length;i+=3){modelMin=Math.min(modelMin,p[i]);modelMax=Math.max(modelMax,p[i])}}
for(const level of['near','middle'])for(const part of TREE_MODEL[level]){const kind=part.material.includes('leaves')?'leaves':part.material.includes('branches')?'branches':'trunk',tex=treeTextures[kind],g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(decodeTree(part.positions),3));g.setAttribute('normal',new T.BufferAttribute(decodeTree(part.normals),3));g.setAttribute('uv',new T.BufferAttribute(decodeTree(part.uv),2));const material=new T.MeshStandardMaterial({map:tex.map,normalMap:tex.normal,normalScale:new T.Vector2(.45,.45),roughness:kind==='leaves'?.78:.95,side:kind==='leaves'?T.DoubleSide:T.FrontSide,color:kind==='leaves'?0xbac99f:0xffffff});const mesh=new T.InstancedMesh(g,material,level==='near'?32:128);mesh.frustumCulled=false;mesh.count=0;mesh.castShadow=level==='near';mesh.receiveShadow=true;mesh.name='3D vegetation '+level+' '+kind;scene.add(mesh);treeLOD[level].push(mesh);treeAudit[level+'Triangles']+=part.triangles;}
leaves.visible=false;trunks.visible=false;
const canopyTexture=pbrTexture('__TREE_CANOPY_ATLAS__',true),canopyP=[],canopyUV=[];
// View 0 was rendered along +X; view 1 along -Z. Each uses its own atlas half.
for(let view=0;view<2;view++)for(const [u,v] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){
 const a=Math.PI/2+view*Math.PI/2,x=u-.5,y=v-.5;canopyP.push(Math.cos(a)*x,y,-Math.sin(a)*x);canopyUV.push((view+u)/2,v);
}
const canopyGeometry=new T.BufferGeometry();canopyGeometry.setAttribute('position',new T.Float32BufferAttribute(canopyP,3));canopyGeometry.setAttribute('uv',new T.Float32BufferAttribute(canopyUV,2));canopyGeometry.computeVertexNormals();
const canopyMaterial=new T.MeshStandardMaterial({map:canopyTexture,alphaTest:.28,side:T.DoubleSide,roughness:.92,color:0xffffff});
const farTree=new T.InstancedMesh(canopyGeometry,canopyMaterial,treePositions.length),farTrunks=new T.InstancedMesh(new T.CylinderGeometry(.22,.36,1,5),M(0x605142,0,1),0);farTree.frustumCulled=false;farTree.receiveShadow=false;farTree.name='Distant vegetation atlas';scene.add(farTree);treeLOD.far=farTree;

const trees=treePositions.map(([x,z,h],id)=>({x,z,h,y:groundHeight(x,z),id,angle:((id*129.32)%360)*Math.PI/180})),treeDummy=new T.Object3D();
for(const t of trees){const scale=t.h/(modelMax-modelMin);treeDummy.position.set(t.x,t.y-modelMin*scale,t.z);treeDummy.scale.setScalar(scale);treeDummy.rotation.set(0,t.angle,0);treeDummy.updateMatrix();t.meshMatrix=new Float32Array(treeDummy.matrix.elements);const centre=TREE_MODEL.canopyCenter||[0,(modelMin+modelMax)/2,0],ox=centre[0]*scale,oz=centre[2]*scale;
 treeDummy.position.set(t.x+Math.cos(t.angle)*ox+Math.sin(t.angle)*oz,t.y+(centre[1]-modelMin)*scale,t.z-Math.sin(t.angle)*ox+Math.cos(t.angle)*oz);treeDummy.scale.setScalar(t.h*(TREE_MODEL.canopyScale||1.5));treeDummy.rotation.set(0,t.angle,0);treeDummy.updateMatrix();t.canopyMatrix=new Float32Array(treeDummy.matrix.elements);}

const treeFrustum=new T.Frustum(),treeProjection=new T.Matrix4(),treeSphere=new T.Sphere();
// Fixed world cells are built once, avoiding thousands of string keys and
// temporary map entries every foliage refresh. Representatives stay anchored.
const nearTreeCells=new Map(),farTreeCells=[12,18,24].map(size=>({size,entries:new Map()}));
for(const t of trees){const key=Math.floor(t.x/180)+','+Math.floor(t.z/180);if(!nearTreeCells.has(key))nearTreeCells.set(key,[]);nearTreeCells.get(key).push(t);
 for(const level of farTreeCells){const k=Math.floor(t.x/level.size)+','+Math.floor(t.z/level.size),old=level.entries.get(k);if(!old||t.y+t.h>old.y+old.h)level.entries.set(k,t)}}
for(const level of farTreeCells)level.entries=Array.from(level.entries.values());
const lastTreeCamera=new T.Vector3(Infinity,0,0),lastTreeRotation=new T.Quaternion();let lastTreeFov=-1,lastTreeAspect=-1;
function updateVegetation(now){updatePalmLods();if(now-treeLOD.last<180)return;
 if(cam.position.distanceToSquared(lastTreeCamera)<1&&cam.quaternion.angleTo(lastTreeRotation)<.01&&Math.abs(cam.fov-lastTreeFov)<.2&&cam.aspect===lastTreeAspect)return;
 const began=performance.now();treeLOD.last=now;lastTreeCamera.copy(cam.position);lastTreeRotation.copy(cam.quaternion);lastTreeFov=cam.fov;lastTreeAspect=cam.aspect;
 cam.updateMatrixWorld();treeFrustum.setFromProjectionMatrix(treeProjection.multiplyMatrices(cam.projectionMatrix,cam.matrixWorldInverse));const close=[],distant=[];
 const cellX=Math.floor(cam.position.x/180),cellZ=Math.floor(cam.position.z/180);
 for(let x=cellX-3;x<=cellX+3;x++)for(let z=cellZ-3;z<=cellZ+3;z++)for(const t of nearTreeCells.get(x+','+z)||[]){t.d=(t.x-cam.position.x)**2+(t.z-cam.position.z)**2;if(t.d>=420*420)continue;treeSphere.center.set(t.x,t.y+t.h*.5,t.z);treeSphere.radius=t.h*.9+30;if(t.d<150*150||treeFrustum.intersectsSphere(treeSphere))close.push(t)}
 for(let level=0;level<3;level++){const minimum=[420**2,1000**2,2000**2][level],maximum=[1000**2,2000**2,Infinity][level];for(const t of farTreeCells[level].entries){t.d=(t.x-cam.position.x)**2+(t.z-cam.position.z)**2;if(t.d<minimum||t.d>=maximum)continue;treeSphere.center.set(t.x,t.y+t.h*.5,t.z);treeSphere.radius=t.h*.9+30;if(treeFrustum.intersectsSphere(treeSphere))distant.push(t)}}
 close.sort((a,b)=>a.d-b.d);const sorted=close.concat(distant);let near=0,middle=0,far=0;
 for(const t of sorted){treeSphere.center.set(t.x,t.y+t.h*.5,t.z);treeSphere.radius=t.h*.9+30;if(t.d>150*150&&!treeFrustum.intersectsSphere(treeSphere))continue;const level=t.d<150*150&&near<32?'near':t.d<420*420&&middle<128?'middle':null;
  if(level){const index=level==='near'?near++:middle++;for(const mesh of treeLOD[level])mesh.instanceMatrix.array.set(t.meshMatrix,index*16)}
  else{farTree.instanceMatrix.array.set(t.canopyMatrix,far*16);far++}

 }
 for(const level of['near','middle'])for(const mesh of treeLOD[level]){mesh.count=level==='near'?near:middle;mesh.instanceMatrix.needsUpdate=true}farTree.count=far;farTree.instanceMatrix.needsUpdate=true;farTrunks.instanceMatrix.needsUpdate=true;if(farTree.instanceColor)farTree.instanceColor.needsUpdate=true;treeAudit.active={near,middle,far};treeAudit.lastUpdateMs=performance.now()-began;treeAudit.maxUpdateMs=Math.max(treeAudit.maxUpdateMs||0,treeAudit.lastUpdateMs);}
