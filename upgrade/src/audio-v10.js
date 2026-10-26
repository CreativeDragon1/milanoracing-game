// RB1 V10 samples: Edvvc / Ed Pond, CC BY-SA 3.0. See the audio credits.
let AC=null,engineAudio=null;
const V10_BANK=__V10_BANK_META__,V10_URL='__V10_AUDIO__';
async function createV10Audio(ctx){
 const response=await fetch(V10_URL),decoded=await ctx.decodeAudioData(await response.arrayBuffer());
 const engineBus=ctx.createGain(),body=ctx.createBiquadFilter(),bite=ctx.createBiquadFilter(),filter=ctx.createBiquadFilter(),engineGain=ctx.createGain(),master=ctx.createGain(),limiter=ctx.createDynamicsCompressor();
 body.type='lowshelf';body.frequency.value=450;body.gain.value=3;
 bite.type='peaking';bite.frequency.value=2400;bite.Q.value=.7;
 filter.type='lowpass';filter.Q.value=.65;master.gain.value=0;engineGain.gain.value=0;
 limiter.threshold.value=-10;limiter.knee.value=9;limiter.ratio.value=5;limiter.attack.value=.002;limiter.release.value=.11;
 engineBus.connect(body);body.connect(bite);bite.connect(filter);filter.connect(engineGain);engineGain.connect(master);master.connect(limiter);limiter.connect(ctx.destination);
 const layers=V10_BANK.layers.map(meta=>{
  const first=Math.round(meta.start/V10_BANK.sampleRate*decoded.sampleRate),frames=Math.round(meta.frames/V10_BANK.sampleRate*decoded.sampleRate);
  const buffer=ctx.createBuffer(1,frames,decoded.sampleRate);buffer.copyToChannel(decoded.getChannelData(0).subarray(first,first+frames),0);
  const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(engineBus);source.start();return{source,gain,rpm:meta.rpm};
 });
 // One reusable noise source feeds quiet road/wind/tyre layers and short mechanical transients.
 const noise=ctx.createBufferSource(),noiseBuffer=ctx.createBuffer(2,ctx.sampleRate*2,ctx.sampleRate);let seed=23789;
 for(let channel=0;channel<2;channel++){const samples=noiseBuffer.getChannelData(channel);for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=seed/2147483648-1}}
 noise.buffer=noiseBuffer;noise.loop=true;
 function effect(type,frequency,q){const f=ctx.createBiquadFilter(),g=ctx.createGain();f.type=type;f.frequency.value=frequency;f.Q.value=q;g.gain.value=0;noise.connect(f);f.connect(g);g.connect(master);return{filter:f,gain:g}}
 const wind=effect('lowpass',850,.6),road=effect('bandpass',140,.7),tyre=effect('bandpass',1550,1.6),transient=effect('bandpass',1100,.65);noise.start();
 const weights=new Float32Array(layers.length),debug={rpm:4500,load:0,cut:false,blip:false,wind:0,road:0,tyre:0};
 let lastGear=1,lastLoad=0,cutUntil=0,blipUntil=0,shiftUntil=0,overrunUntil=0,popUntil=0,lastPop=0,lastUpdate=0;
 const limit=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(v)?v:a));
 function update(rpm,load,volume,on,gear,time=ctx.currentTime,drive={}){
  rpm=limit(rpm,4500,18000);load=limit(load,0,1);volume=limit(volume,0,1);
  if(on&&gear>lastGear){cutUntil=time+.065;shiftUntil=time+.025}
  if(on&&gear<lastGear){blipUntil=time+.095;shiftUntil=time+.02}
  if(on&&lastLoad>.45&&load<.18&&rpm>9000)overrunUntil=time+.22;
  if(on&&time<overrunUntil&&time-lastPop>.055){popUntil=time+.017;lastPop=time}
  lastGear=gear;lastLoad=load;lastUpdate=time;
  const rev=rpm*(time<blipUntil?1.035:1),cut=time<cutUntil?.16:1;
  weights.fill(0);let lower=0;while(lower<layers.length-2&&rev>layers[lower+1].rpm)lower++;
  const mix=limit(Math.log(rev/layers[lower].rpm)/Math.log(layers[lower+1].rpm/layers[lower].rpm),0,1);
  weights[lower]=Math.cos(mix*Math.PI/2);weights[lower+1]=Math.sin(mix*Math.PI/2);
  layers.forEach((layer,i)=>{layer.source.playbackRate.setTargetAtTime(rev/layer.rpm,time,.020);layer.gain.gain.setTargetAtTime(weights[i],time,.040)});
  const cockpit=drive.camera===1,overhead=drive.camera===2,speed=limit(drive.speed||0,0,90);
  body.gain.setTargetAtTime(2.5+load*3.5,time,.055);
  bite.frequency.setTargetAtTime(1500+rpm*.065,time,.05);bite.gain.setTargetAtTime(cockpit?4+load*2:1.5+load*2,time,.05);
  filter.frequency.setTargetAtTime((cockpit?3100:4200)+rpm*.16+load*2600,time,.05);
  engineGain.gain.setTargetAtTime((.16+load*.41)*(time<blipUntil?1.12:1)*cut,time,time<cutUntil?.006:.022);
  const windLevel=.033*(speed/64)**2*(cockpit?.8:1),roadLevel=.018*(speed/64)+.075*(drive.kerb||0)+.045*(drive.offroad||0),tyreLevel=.032*(drive.slip||0);
  wind.gain.gain.setTargetAtTime(windLevel,time,.12);road.gain.gain.setTargetAtTime(roadLevel,time,.025);tyre.gain.gain.setTargetAtTime(tyreLevel,time,.05);
  tyre.filter.frequency.setTargetAtTime(1200+speed*8,time,.08);
  transient.gain.gain.setTargetAtTime(time<shiftUntil?.045:time<popUntil?.035:0,time,.004);
  master.gain.setTargetAtTime(on?volume*(overhead?.72:.95):0,time,on?.018:.025);
  Object.assign(debug,{rpm,load,cut:time<cutUntil,blip:time<blipUntil,wind:windLevel,road:roadLevel,tyre:tyreLevel});
 }
 return{update,master,layers,debug,description:'Recorded V10 with wheel-speed RPM, load shaping, shift cuts, overrun and road feedback',stop(){for(const l of layers){l.source.stop();l.source.disconnect();l.gain.disconnect()}noise.stop();noise.disconnect();for(const e of[wind,road,tyre,transient]){e.filter.disconnect();e.gain.disconnect()}for(const node of[engineBus,body,bite,filter,engineGain,master,limiter])node.disconnect()}};
}
function audioInit(){try{if(AC){AC.resume();return}AC=new(window.AudioContext||window.webkitAudioContext)();AC.resume();preparePitSounds();createV10Audio(AC).then(engine=>{engineAudio=engine}).catch(()=>{if(AC)AC.close();AC=null;engineAudio=null;msg('Engine audio unavailable. Reload to retry.',3500)})}catch(e){if(AC)AC.close();AC=null;engineAudio=null}}
function audioUpd(dt=1/60){
 const on=(state==='race'||state==='count')&&!document.hidden&&!GP.pitSkip,countdown=state==='count';
 const throttle=countdown?Math.max(keys.has('KeyW')||keys.has('ArrowUp')?1:0,padInput.t):inp.t;
 const vs=Math.max(c.vx,4),frontSlip=Math.abs(Math.atan2(c.vy+VEH.frontCG*c.r,vs)-c.st),rearSlip=Math.abs(Math.atan2(c.vy-VEH.rearCG*c.r,vs));
 const d=driveSound.update({on,countdown,speed:Math.abs(c.vx),gear:c.gear,throttle:c.reverse?inp.b:throttle,brake:c.reverse?inp.t:inp.b,camera:camMode,tyreSlip:Math.max(frontSlip,rearSlip),kerb:Math.abs(c.d)>W&&Math.abs(c.d)<=W+1.5,offroad:Math.abs(c.d)>W+1.5,distance:c.odo},dt);
 if(AC&&engineAudio)engineAudio.update(d.rpm,d.load,S.vol,on,d.gear,AC.currentTime,d);
}
