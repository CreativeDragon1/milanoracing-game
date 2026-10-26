// Offline authoring bridge. The shipped native game never loads JavaScript or a browser.
const {chromium}=require('../../upgrade/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../game'),out=path.join(root,'circuits');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(root,'assets/generated'),{recursive:true});
const ids=process.argv.slice(2).length?process.argv.slice(2):Object.keys(JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json','utf8')));
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
for(const id of ids){const p=await browser.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.exposeFunction('saveNativeTexture',async(data)=>{const bytes=Buffer.from(data.split(',')[1],'base64'),hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,20),name=hash+(data.startsWith('data:image/webp;')?'.webp':data.startsWith('data:image/jpeg;')?'.jpg':'.png');const file=path.join(root,'assets/generated',name);if(!fs.existsSync(file))fs.writeFileSync(file,bytes);return 'res://assets/generated/'+name});
await p.goto((process.env.MILANO_EXPORT_HTML?'file:///'+path.resolve(process.env.MILANO_EXPORT_HTML).replace(/\\/g,'/'):'http://127.0.0.1:8878/')+'?circuit='+id);await p.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});
await p.evaluate(()=>window.sponsorReady);
await p.evaluate(async()=>{frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
if(process.env.MILANO_CHECK_STRUCTURES){
 const audit=await p.evaluate(()=>({circuit:CIRCUIT.id,sites:buildingFoundationAudit.sites.length,segments:buildingFoundationAudit.segments,missingGround:buildingFoundationAudit.missingGround,missingSamples:buildingFoundationAudit.missingSamples,roadConflicts:buildingFoundationAudit.roadConflicts,roofs:landmarkAudit.filter(a=>a.roofFollowsSections),assetErrors:sceneAssetErrors}));
 fs.writeFileSync(path.resolve('native-desktop/qa/structure-'+id+'.json'),JSON.stringify(audit,null,2));
 if(audit.missingGround||audit.roadConflicts.length||audit.assetErrors.length)throw Error('Structure checks: '+JSON.stringify(audit));
}
const result=await p.evaluate(async()=>{
 updatePalmLods(true);
 const geos={},mats={},objects=[],blobs=[],texCache=new Map();let offset=0;
 const raw=a=>{const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),chunk=Array.from(bytes);const d={offset,bytes:bytes.length};offset+=bytes.length;blobs.push(chunk);return d};
 const attr=(a,size)=>{const out=new Float32Array(a.count*size);for(let i=0;i<a.count;i++)for(let j=0;j<size;j++)out[i*size+j]=j===0?a.getX(i):j===1?a.getY(i):j===2?a.getZ(i):a.getW(i);return raw(out)};
 async function texture(t){if(!t)return null;if(texCache.has(t.uuid))return texCache.get(t.uuid);let image=t.image;if(!image)return null;
 if(image.decode)await image.decode().catch(()=>{});if(!image.width||!image.height)return null;
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);
 const file=await window.saveNativeTexture(image.src?.startsWith('data:image/')?image.src:canvas.toDataURL('image/png'));const d={file,repeat:t.repeat.toArray(),offset:t.offset.toArray(),flipY:t.flipY,rotation:t.rotation};texCache.set(t.uuid,d);return d;}
 async function material(m){if(mats[m.uuid])return m.uuid;const d={name:m.name,type:m.type,color:m.color?.toArray()||[1,1,1],roughness:m.roughness??.8,metalness:m.metalness||0,opacity:m.opacity,alphaTest:m.alphaTest||0,transparent:!!m.transparent,side:m.side,vertexColors:!!m.vertexColors,clearcoat:m.clearcoat||0,emissive:m.emissive?.toArray()||[0,0,0],emissiveIntensity:m.emissiveIntensity||0,normalScale:m.normalScale?.x||.4,unlit:m.isMeshBasicMaterial||false};
 for(const k of['map','normalMap','roughnessMap','metalnessMap','emissiveMap'])d[k]=await texture(m[k]);mats[m.uuid]=d;return m.uuid;}
 function geometry(g){if(geos[g.uuid])return g.uuid;const d={count:g.attributes.position.count,attributes:{},groups:g.groups};for(const k of['position','normal','uv','color'])if(g.attributes[k])d.attributes[k]={...attr(g.attributes[k],g.attributes[k].itemSize),size:g.attributes[k].itemSize};if(g.index)d.index=raw(new Uint32Array(g.index.array));geos[g.uuid]=d;return g.uuid;}
 scene.updateMatrixWorld(true);const inverse=new T.Matrix4().copy(car.matrixWorld).invert(),skip=new Set([sky,contactShadow,farTree,farTrunks,leaves,trunks,guideArrows,guideOutline]);
 const meshes=[];scene.traverseVisible(o=>{if(!o.isMesh||!o.geometry.attributes.position.count||skip.has(o)||o.name.startsWith('3D vegetation')||o.material?.isShaderMaterial)return;let a=o,inCar=false;while(a){if(a===car){inCar=true;break}a=a.parent}meshes.push({o,inCar})});
 for(const {o,inCar} of meshes){const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.some(m=>m.isShaderMaterial))continue;
 const item={name:o.name||'Mesh',geometry:geometry(o.geometry),materials:[],matrix:(inCar?new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld):o.matrixWorld).toArray(),car:inCar,castShadow:o.castShadow,ground:!!(o.userData.mainRoad||o.userData.groundSurface||['Grass verge','Paved runoff','Profiled raised kerb','Track markings','Pit-lane asphalt','Pit service apron'].includes(o.name)||o.name==='Circuit terrain'||o.name==='Measured regional terrain'||o.userData.calendarGround),road:!!o.userData.mainRoad};
 for(const m of materials)item.materials.push(await material(m));if(o.isInstancedMesh){item.instances=raw(new Float32Array(o.instanceMatrix.array.slice(0,o.count*16)));item.count=o.count;if(o.instanceColor)item.colors=raw(new Float32Array(o.instanceColor.array.slice(0,o.count*3)))}objects.push(item);}
 const data={id:CIRCUIT.id,name:CIRCUIT.name,theme:THEME,geometry:geos,materials:mats,objects,trees:trees.map(t=>[t.x,t.y,t.z,t.h,t.angle]),sun:sunDirection.toArray(),bounds:trackBounds,carParts:objects.filter(x=>x.car).length};
 const buffer=new Uint8Array(offset);let at=0;for(const b of blobs){buffer.set(b,at);at+=b.length}let binary='';for(let i=0;i<buffer.length;i+=32768)binary+=String.fromCharCode(...buffer.subarray(i,i+32768));return{data,binary:btoa(binary)};
});
if(errors.length)throw Error(id+': '+errors.join('\n'));fs.writeFileSync(path.join(out,id+'.json'),JSON.stringify(result.data));fs.writeFileSync(path.join(out,id+'.bin'),Buffer.from(result.binary,'base64'));console.log(id,result.data.objects.length,'meshes',Object.keys(result.data.materials).length,'materials',Math.round(result.binary.length*.75/1048576)+' MiB');await p.close();
}await browser.close()})().catch(e=>{console.error(e);process.exit(1)});
