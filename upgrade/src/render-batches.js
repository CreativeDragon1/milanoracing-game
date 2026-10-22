// Three r128 does not calculate instance bounds. Give each immutable batch its
// real local-space bounds; otherwise a whole circuit is submitted every pass.
const batchAudit={bounded:0,tiles:0,instances:0,mergedDrawBatches:0,sharedDetailDrawsSaved:0};
function boundInstances(mesh){
 const geometry=mesh.geometry.clone(),matrix=new T.Matrix4(),box=new T.Box3(),one=new T.Box3();
 geometry.computeBoundingBox();const base=geometry.boundingBox.clone();
 for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);box.union(one.copy(base).applyMatrix4(matrix))}
 geometry.boundingBox=box;geometry.boundingSphere=box.getBoundingSphere(new T.Sphere());
 mesh.geometry=geometry;mesh.frustumCulled=true;batchAudit.bounded++;batchAudit.instances+=mesh.count;
}
function finalizeSceneryBatches(){
 // The guide and foliage move every frame; fixed bounds would make them vanish
 // after driving away from the origin. Only immutable scenery is consolidated.
 scene.updateMatrixWorld(true);const shared=new Map(),source=[];
 // Identical static props retain their geometry, materials and world transforms
 // while sharing a draw call. Explicit tagging keeps cars and moving effects out.
 const details=new Map();scene.traverseVisible(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.userData.staticArchitecture&&!Array.isArray(o.material)&&!o.material.transparent){const key=[o.geometry.uuid,o.material.uuid,o.castShadow,o.receiveShadow,o.renderOrder,Math.floor(o.matrixWorld.elements[12]/220),Math.floor(o.matrixWorld.elements[14]/220)].join(':');if(!details.has(key))details.set(key,[]);details.get(key).push(o)}});
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
finalizeSceneryBatches();
