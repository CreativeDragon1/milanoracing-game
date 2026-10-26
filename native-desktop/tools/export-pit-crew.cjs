const {chromium}=require('../../upgrade/node_modules/playwright'),fs=require('fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{const p=await b.newPage({viewport:{width:1280,height:720}});await p.goto('http://127.0.0.1:5183/play/?circuit=monaco');await p.waitForFunction(()=>window.MilanoReady,null,{timeout:180000});
 const data=await p.evaluate(async()=>{frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const geometry={},materials={},batches=[];
 for(const[name,g]of Object.entries(crewGeo)){geometry[name]={position:Array.from(g.attributes.position.array),normal:Array.from(g.attributes.normal.array),index:Array.from(g.index.array)}}
 for(const[name,m]of Object.entries(crewPaint))materials[name]={color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness};
 for(const[key,b]of crewBatches)batches.push({key,count:b.parts.length,shape:key.split(':')[0],paint:key.split(':')[1]});
 const snapshot=(ready,phase)=>{posePitCrew(ready,phase);return Array.from(crewBatches.values(),b=>Array.from(b.mesh.instanceMatrix.array))};
 return{geometry,materials,batches,ready:Array.from({length:21},(_,i)=>snapshot(i/20,0)),release:Array.from({length:21},(_,i)=>snapshot(i/20,1)),service:Array.from({length:101},(_,i)=>snapshot(1,i/100)),cues:pitAudio.cues,actors:crewActors.length};});
 fs.writeFileSync('native-desktop/game/assets/pit-crew-rig.json',JSON.stringify(data));console.log('Exported shared crew',data.actors,'people',data.batches.length,'instanced draws');
 const reports=[];for(const[phase,name]of[[0,'ready'],[.16,'guns'],[.40,'tyres-off'],[.61,'fitting'],[.78,'tighten'],[1,'release']]){
  await p.evaluate(([phase])=>{show('none');$('hud').hidden=true;crewRoot.visible=true;posePitCrew(1,phase);const w= new T.Vector3(5,3.0,6).applyMatrix4(pitBox.matrixWorld),target=new T.Vector3(0,.8,0).applyMatrix4(pitBox.matrixWorld);car.visible=true;car.position.copy(pitBox.position);car.position.y+=pitServiceLift(phase);car.rotation.set(0,-pitHeading,0);setPitWheelVisibility(!(phase>.30&&phase<.67));cam.position.copy(w);cam.lookAt(target);cam.fov=48;cam.aspect=1280/720;cam.updateProjectionMatrix();sky.position.copy(cam.position);ren.render(scene,cam)},[phase]);
  await p.screenshot({path:`upgrade/qa/pit-crew-${name}.png`});reports.push({phase,name});
 }
 fs.writeFileSync('upgrade/qa/pit-crew-visual.json',JSON.stringify({actors:data.actors,drawCalls:data.batches.length,frames:reports},null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
