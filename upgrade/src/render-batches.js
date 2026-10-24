// Three r128 does not calculate instance bounds. Give each immutable batch its
// real local-space bounds; otherwise a whole circuit is submitted every pass.

function boundInstances(mesh){
 const geometry=mesh.geometry.clone(),matrix=new T.Matrix4(),box=new T.Box3(),one=new T.Box3();
 geometry.computeBoundingBox();const base=geometry.boundingBox.clone();
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);box.union(one.copy(base).applyMatrix4(matrix))}
 geometry.boundingBox=box;geometry.boundingSphere=box.getBoundingSphere(new T.Sphere());
 mesh.geometry=geometry;mesh.frustumCulled=true;batchAudit.bounded++;batchAudit.instances+=mesh.count;
}
function sceneryMaterialKey(m){
 // Keys need texture identity, never exported image pixels. Seed Three's
 // serializer cache to avoid re-encoding canvases/data textures during load.
 const meta={textures:{},images:{}};
 for(const field of Object.keys(m))if(m[field]?.isTexture)meta.textures[m[field].uuid]={uuid:m[field].uuid};
 const data=m.toJSON(meta);delete data.uuid;delete data.name;delete data.userData;
 for(const field of Object.keys(m))if(m[field]?.isColor)data[field]=m[field].toArray();
 return JSON.stringify(data);
}
function finalizeSceneryBatches(){
 // Identical paint was often created once per building. Reuse exact material
 // values before grouping draws; retain custom shaders and all texture IDs.
 const paints=new Map(),paintKeys=new WeakMap(),boxKinds=new Map(),dynamic=new Set([car,sky,sun,sun.target,nightLight,contactShadow,guideArrows,guideOutline,...crew]);
 const ordinary=m=>m&&!m.isShaderMaterial&&!m.isRawShaderMaterial&&m.onBeforeCompile===T.Material.prototype.onBeforeCompile&&m.customProgramCacheKey===T.Material.prototype.customProgramCacheKey;
 scene.traverse(o=>{if(!o.isMesh)return;for(let p=o;p;p=p.parent)if(dynamic.has(p))return;
  if(!Array.isArray(o.material)&&ordinary(o.material)){
   const m=o.material;let key=paintKeys.get(m);
   if(key===undefined){key=sceneryMaterialKey(m);paintKeys.set(m,key);}
   if(paints.has(key)){o.material=paints.get(key);batchAudit.materialReuses=(batchAudit.materialReuses||0)+1}else paints.set(key,m);
  }
  // Normalize only untouched solid boxes. Vertex colours, edited geometry,
  // normals and UV variations are deliberately excluded from this conversion.
  const g=o.geometry,p=g.parameters;
  if(!o.isInstancedMesh&&!o.children.length&&p&&g.type==='BoxGeometry'&&Object.keys(g.attributes).every(k=>['position','normal','uv'].includes(k))&&!Object.keys(g.morphAttributes).length&&!o.customDepthMaterial&&!o.customDistanceMaterial&&!Array.isArray(o.material)){
   if(!boxKinds.has(g)){let same=!!g.index&&g.index.count===unitBox.index.count&&g.index.array.every((n,i)=>n===unitBox.index.array[i])&&g.drawRange.start===0&&g.drawRange.count===Infinity;
    for(const key of['position','normal','uv']){const a=g.attributes[key],b=unitBox.attributes[key];if(!a||a.count!==b.count){same=false;break}for(let i=0;i<a.array.length;i++){const scale=key==='position'?[p.width,p.height,p.depth][i%3]:1;if(Math.abs(a.array[i]-b.array[i]*scale)>1e-5){same=false;break}}}boxKinds.set(g,same)}
   if(boxKinds.get(g)){o.geometry=unitBox;o.scale.multiply(new T.Vector3(p.width,p.height,p.depth));o.updateMatrix();o.userData.staticArchitecture=true;batchAudit.canonicalBoxes=(batchAudit.canonicalBoxes||0)+1;}
  }
 });
 // The guide and foliage move every frame; fixed bounds would make them vanish
 // after driving away from the origin. Only immutable scenery is consolidated.
 scene.updateMatrixWorld(true);const shared=new Map(),source=[];
 // Identical static props retain their geometry, materials and world transforms
 // while sharing a draw call. Explicit tagging keeps cars and moving effects out.
 const details=new Map();scene.traverseVisible(o=>{if(o.isMesh&&!o.isInstancedMesh&&!o.children.length&&o.userData.staticArchitecture&&!Array.isArray(o.material)&&!o.material.transparent){const key=[o.geometry.uuid,o.material.uuid,o.castShadow,o.receiveShadow,o.renderOrder,Math.floor(o.matrixWorld.elements[12]/220),Math.floor(o.matrixWorld.elements[14]/220)].join(':');if(!details.has(key))details.set(key,[]);details.get(key).push(o)}});
 for(const objects of details.values()){if(objects.length<2)continue;const o=objects[0],mesh=new T.InstancedMesh(o.geometry,o.material,objects.length);mesh.name='Shared static venue detail';mesh.castShadow=o.castShadow;mesh.receiveShadow=o.receiveShadow;mesh.renderOrder=o.renderOrder;objects.forEach((p,i)=>mesh.setMatrixAt(i,p.matrixWorld));scene.add(mesh);objects.forEach(p=>p.parent.remove(p));batchAudit.sharedDetailDrawsSaved+=objects.length-1;}
 scene.traverse(o=>{if(o.isInstancedMesh&&o.visible&&o.geometry===unitBox&&!o.material.transparent){source.push(o);const matrix=new T.Matrix4(),color=new T.Color();for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);matrix.premultiply(o.matrixWorld);const key=[o.material.uuid,!!o.instanceColor,o.castShadow,o.receiveShadow,o.renderOrder,Math.floor(matrix.elements[12]/220),Math.floor(matrix.elements[14]/220)].join(':');if(!shared.has(key))shared.set(key,{source:o,entries:[]});if(o.instanceColor)o.getColorAt(i,color);shared.get(key).entries.push({matrix:matrix.clone(),color:o.instanceColor?color.clone():null})}}});
 for(const {source:o,entries} of shared.values()){const m=new T.InstancedMesh(unitBox,o.material,entries.length);m.name='Static architecture tile';m.castShadow=o.castShadow;m.receiveShadow=o.receiveShadow;m.renderOrder=o.renderOrder;entries.forEach((e,i)=>{m.setMatrixAt(i,e.matrix);if(e.color)m.setColorAt(i,e.color)});scene.add(m)}
 for(const o of source)o.parent.remove(o);batchAudit.mergedDrawBatches=source.length-shared.size;
 const list=[];scene.traverse(o=>{if(o.isInstancedMesh&&o.visible&&!o.name.startsWith('3D vegetation')&&o!==farTree&&o!==farTrunks&&o!==guideArrows&&o!==guideOutline)list.push(o)});
 for(const mesh of list){
  if(mesh.parent!==scene||mesh.count<128){boundInstances(mesh);continue}
  const groups=new Map(),matrix=new T.Matrix4(),color=new T.Color();
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);const k=Math.floor(matrix.elements[12]/220)+','+Math.floor(matrix.elements[14]/220);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i)}
  if(groups.size<2){boundInstances(mesh);continue}
  const parent=new T.Group();parent.name=mesh.name+' spatial tiles';parent.position.copy(mesh.position);parent.quaternion.copy(mesh.quaternion);parent.scale.copy(mesh.scale);
  for(const ids of groups.values()){const tile=new T.InstancedMesh(mesh.geometry,mesh.material,ids.length);tile.name=mesh.name+' tile';tile.castShadow=mesh.castShadow;tile.receiveShadow=mesh.receiveShadow;tile.renderOrder=mesh.renderOrder;
   ids.forEach((id,j)=>{mesh.getMatrixAt(id,matrix);tile.setMatrixAt(j,matrix);if(mesh.instanceColor){mesh.getColorAt(id,color);tile.setColorAt(j,color)}});boundInstances(tile);parent.add(tile);batchAudit.tiles++}
  scene.add(parent);scene.remove(mesh);
 }
}
await window.sponsorReady;
finalizeSceneryBatches();
registerPalmLods();

// Immutable scenery never needs a new local/world matrix per render pass.
// Keep animated subtrees live; new cars added later retain Three's normal updates.
const dynamicSceneRoots=new Set([car,sun,sun.target,sky,nightLight,contactShadow,guideArrows,guideOutline,...crew]);
scene.updateMatrixWorld(true);
let frozenSceneryTransforms=0;
function freezeSceneryTransforms(node){
 if(dynamicSceneRoots.has(node))return;
 node.matrixAutoUpdate=false;frozenSceneryTransforms++;
 for(const child of node.children)freezeSceneryTransforms(child);
}
for(const child of scene.children)freezeSceneryTransforms(child);
scene.matrixAutoUpdate=false;
