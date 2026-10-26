const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true,args:['--autoplay-policy=no-user-gesture-required']});try{
 const p=await b.newPage({viewport:{width:1440,height:810}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:5183/play/?circuit=monaco');await p.waitForFunction(()=>window.MilanoReady,null,{timeout:180000});
 await p.evaluate(()=>{newSession('pr');race.cd=0;state='race';show('none');placeCar(PIT.station[PIT.box]|0)});
 await p.waitForTimeout(2200);assert(await p.evaluate(()=>Number.isFinite(crewReady)&&[...crewBatches.values()].every(b=>b.mesh.instanceMatrix.array.every(Number.isFinite))),'finite practice crew transforms');const idleUpdates=await p.evaluate(()=>crewPoseUpdates);await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>crewPoseUpdates),idleUpdates,'stationary crew does not upload identical poses');
 await p.evaluate(()=>audioInit());await p.waitForFunction(()=>engineAudio&&pitAudio.buffers.gun&&pitAudio.buffers.jack&&pitAudio.buffers.tyre);
 await p.evaluate(()=>{newSession('gp');state='race';show('none');const w=GP.weekend;w.player.progress=PIT.entry/N*LEN;w.enterPit(w.player);w.player.pit.s=PIT.s[PIT.box];w.player.v=0;gpPlace(w.pitPose(w.player));window.crewAudioPeak=0;window.crewAuditTimer=setInterval(()=>{crewAudioPeak=Math.max(crewAudioPeak,pitAudio.sources.size)},10)});
 await p.waitForFunction(()=>crewPhase>.36&&crewPhase<.60);
 assert(await p.evaluate(()=>wheels.every(w=>!w.tyre.visible)),'wheels actually removed');
 assert(await p.evaluate(()=>axleHardware.visible&&axleHardware.parent===car&&axleHardware.count===10&&wheels.every(w=>w.sp.visible&&w.pv.visible)), 'axles, hubs and wheel carriers remain attached');
 assert(await p.evaluate(()=>{const copy=cloneRaceCar(),tyres=[];copy.traverse(p=>{if(p.userData.removablePitWheel)tyres.push(p)});return tyres.length===4&&tyres.every(t=>t.visible)}),'opponents cannot inherit removed wheels from an active stop');
 assert(await p.evaluate(()=>[...crewBatches.values()].every(b=>b.mesh.instanceMatrix.array.every(Number.isFinite))),'finite service crew transforms');
 const midway=await p.evaluate(()=>({phase:crewPhase,lift:crewLift,actors:crewActors.length,draws:crewBatches.size,peakSources:crewAudioPeak,context:AC.state}));assert(midway.lift>.05&&midway.actors===10&&midway.draws<=14&&midway.peakSources>=4);assert.equal(midway.context,'running');
 await p.screenshot({path:'upgrade/qa/pit-service-live.png'});
 await p.waitForFunction(()=>GP.weekend.player.pit?.service);assert(await p.evaluate(()=>wheels.every(w=>w.tyre.visible)));assert(await p.evaluate(()=>crewLift<.001));
 await p.evaluate(()=>{clearInterval(crewAuditTimer);newSession('qual');state='race';show('none');gpSkipPit()});await p.waitForFunction(()=>GP.pitSkip);await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>pitAudio.sources.size),0,'skip silences service cues');await p.waitForFunction(()=>!GP.pitSkip,null,{timeout:60000});
 assert.deepEqual(errors,[]);fs.writeFileSync('upgrade/qa/pit-crew-browser.json',JSON.stringify({passed:true,midway,wheelsRestored:true,axlesRetained:true,idlePoseUploads:0,skipSilent:true,errors,scope:'Real rendered stop, wheel visibility, lift and Web Audio cue scheduling. Sound character not a recording claim.'},null,2));console.log('Live crew, wheel exchange, lift, sound cues and silent skip passed');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
