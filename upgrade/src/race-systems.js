// Calibrated game models, SI units; coefficients are not proprietary F1 telemetry.
// Weather integrates surface-water balance. Tyres/brakes integrate heat and work.
const RaceSystems=(()=>{
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
 const compounds={soft:{ideal:95,window:24,life:90000,dry:1.012},medium:{ideal:100,window:27,life:125000,dry:1},hard:{ideal:105,window:30,life:170000,dry:.985},inter:{ideal:70,window:20,life:110000,dry:.86},wet:{ideal:60,window:20,life:130000,dry:.74}};
 function weather(mode='dry',duration=600,seed=1){return{mode,duration:Math.max(240,duration),seed,time:0,rain:mode==='rain'||mode==='drying'?.8:0,air:25,track:mode==='dry'?36:28,film:Array(32).fill(mode==='rain'||mode==='drying'?1.4:0),line:Array(32).fill(mode==='rain'||mode==='drying'?1.15:0),everWet:mode==='rain'||mode==='drying'};}
 function rainAt(w){if(w.mode==='dry')return 0;if(w.mode==='rain')return .7+.18*Math.sin(w.time/73);const u=w.time/w.duration,keys=w.mode==='drying'?[[0,.9],[.12,.6],[.28,.1],[.38,0],[1,0]]:[[0,0],[.12,0],[.28,.55],[.43,.95],[.58,.65],[.73,0],[1,0]];for(let i=1;i<keys.length;i++)if(u<=keys[i][0]){const a=keys[i-1],b=keys[i],t=clamp((u-a[0])/(b[0]-a[0]),0,1);return mix(a[1],b[1],t*t*(3-2*t));}return 0;}
 function weatherStep(w,dt,traffic=[]){w.time+=dt;w.rain=rainAt(w);w.track+=(w.air+11*(1-w.rain)-w.track)*(1-Math.exp(-dt/80));const counts=Array(32).fill(0);for(const d of traffic)if(!d.pit&&d.v>10)counts[Math.floor(((d.fraction%1+1)%1)*32)]+=1;
  for(let i=0;i<32;i++){const local=w.rain*(.88+.12*Math.sin(i*.61+w.time/100+w.seed)),rain=local*.032,evap=.0028*(1-local)*(w.track/30),drain=.012+.008*(.5+.5*Math.sin(i*.83+w.seed));w.film[i]=clamp(w.film[i]+dt*(rain-drain*w.film[i]-evap),0,3);w.line[i]=clamp(w.line[i]+dt*(rain-drain*w.line[i]-evap*(1.3+counts[i]*.8)-counts[i]*.009*w.line[i]),0,w.film[i]);}w.everWet ||= Math.max(...w.film)>.25;
 }
 function water(w,fraction,offset=0){const f=((fraction%1+1)%1)*32,i=Math.floor(f),j=(i+1)%32,t=f-i,base=mix(w.film[i],w.film[j],t),line=mix(w.line[i],w.line[j],t);return mix(line,base,clamp(Math.abs(offset)/3,0,1));}
 function fresh(){return{tyres:Array.from({length:4},()=>({surface:78,core:76,wear:0,grain:0,blister:0})),brakes:[420,420,380,380],brakeWear:0,ice:0,mguk:0,mguh:0,turbo:0,engineTemp:95,energy:.8,boost:1,front:0,rear:0,floor:0,suspension:0,repair:false,contactCooldown:0,previousV:0};}
 function tyreFactor(type,tyre,film,speed){const p=compounds[type]||compounds.medium,damp=clamp(film,0,3);let grip;
  if(type==='wet')grip=p.dry+.20*clamp(damp/1.4,0,1)-.09*clamp((damp-2)/1,0,1);
  else if(type==='inter')grip=p.dry+.12*clamp(damp/.55,0,1)-.29*clamp((damp-.8)/1.4,0,1);
  else grip=p.dry*(1-.72*clamp(damp/.9,0,1));
  const heat=clamp(1-Math.max(0,Math.abs(tyre.core-p.ideal)-p.window)*.006,.65,1),degradation=1-.22*tyre.wear*tyre.wear-.13*tyre.grain-.18*tyre.blister;
  const drain=type==='wet'?2.1:type==='inter'?.95:.15,hydro=clamp((damp-drain)*Math.max(0,speed-42)/180,0,.40);
  return clamp(grip*heat*degradation*(1-hydro),.15,1.04);
 }
 function factors(s,type,film,speed,hybrid=true){const grip=s.tyres.reduce((a,t)=>a+tyreFactor(type,t,film,speed),0)/4;const temperature=s.brakes.reduce((a,b)=>a+b,0)/4;const fade=clamp(1-Math.max(0,temperature-1000)/700,.4,1)*(1-.25*s.brakeWear);const cold=clamp(.72+temperature/1100,.72,1);return{grip,downforce:clamp(1-.34*s.front-.29*s.rear-.26*s.floor,.25,1),frontBalance:clamp(.45-.14*s.front+.13*s.rear,.25,.65),drag:1+.24*s.front+.2*s.rear+.14*s.floor,power:clamp((1-.18*s.ice-.28*s.turbo)*(hybrid?(.82+.18*(1-s.mguk)*clamp(s.energy*6,0,1)):(1))*(1-Math.max(0,s.engineTemp-118)*.008),.35,1),brake:fade*cold,steering:1-.25*s.suspension};}
 function step(s,input,dt){const {speed=0,throttle=0,brake=0,lateral=0,film=0,type='medium',track=30,hybrid=true,wearScale=1}=input,p=compounds[type]||compounds.medium,wet=type==='inter'||type==='wet';
  const decel=clamp((s.previousV-speed)/Math.max(dt,.001),0,45),energy=800*decel*Math.max(0,(speed+s.previousV)/2);s.previousV=speed;s.contactCooldown=Math.max(0,s.contactCooldown-dt);
  for(let i=0;i<4;i++){const tyre=s.tyres[i],load=.7+Math.min(2,Math.abs(lateral)/30)+(i<2?brake*.8:throttle*.45),slip=clamp(input.slip||0,0,3);const heat=load*speed*.026+slip*speed*.09+(wet?speed*.03*(1-clamp(film,0,1)):0),cool=(.012+speed*.00055+film*.025);tyre.surface+=dt*(heat-(tyre.surface-track)*cool);tyre.core+=(tyre.surface-tyre.core)*(1-Math.exp(-dt/18));tyre.surface=clamp(tyre.surface,track-3,180);tyre.core=clamp(tyre.core,track-3,170);
   const tooHot=Math.max(0,tyre.core-p.ideal-p.window),tooCold=Math.max(0,p.ideal-p.window-tyre.core);tyre.grain=clamp(tyre.grain+dt*(tooCold*slip*.00006-(tooCold===0?.0003:0)),0,1);tyre.blister=clamp(tyre.blister+dt*tooHot*load*.00006,0,1);tyre.wear=clamp(tyre.wear+dt*speed/p.life*wearScale*(.65+load*.35+slip*.8+tooHot*.05)*(wet?1+3*(1-clamp(film,0,1)):1),0,1);
   const share=i<2?.29:.21;s.brakes[i]=clamp(s.brakes[i]+dt*(energy*share/2200-(s.brakes[i]-25)*(.016+speed*.00065+film*.008)),25,1500);
  }
  s.brakeWear=clamp(s.brakeWear+energy*dt/1.8e10*(1+Math.max(0,Math.max(...s.brakes)-1050)/100),0,1);
  s.engineTemp+=dt*(throttle*7.5-(s.engineTemp-80)*(.08+speed*.0012));const stress=1+Math.max(0,s.engineTemp-112)*.12;
  s.ice=clamp(s.ice+dt*throttle*stress/180000,0,1);s.turbo=clamp(s.turbo+dt*throttle*throttle*stress/150000,0,1);
  if(hybrid){const harvest=brake*speed*.00018*(1-s.mguk)+throttle*.003*(1-s.mguh),deployment=throttle*.010*(1-s.mguk);s.energy=clamp(s.energy+dt*(harvest-deployment),0,1);s.mguk=clamp(s.mguk+dt*(brake+throttle)*stress/240000,0,1);s.mguh=clamp(s.mguh+dt*throttle*stress/200000,0,1);}
  return s;
 }
 function impact(s,speed,zone='front',strength=1){if(s.contactCooldown>0||speed<2)return 0;const severity=clamp((speed*speed-4)/650*strength,.01,.85);if(zone==='side'){s.floor=clamp(s.floor+severity*.65,0,1);s.suspension=clamp(s.suspension+severity*.45,0,1)}else s[zone]=clamp(s[zone]+severity,0,1);s.contactCooldown=.7;return severity;}
 function service(s,repair=false){s.tyres=fresh().tyres;if(repair){s.front=0;s.repair=false;}return s;}
 return {compounds,weather,weatherStep,water,fresh,tyreFactor,factors,step,impact,service};
})();
if(typeof module!=='undefined')module.exports=RaceSystems;
