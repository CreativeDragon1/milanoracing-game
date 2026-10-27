// Recovered unchanged from the preserved Team Edition; source SHA256 a3439f4ebae934ce92960a7161b393ec4ba306ad12f590b2ace804ef029db1a2
function step(dt){
 const pr=prog(c.x,c.z,c.idx);c.idx=pr.i;c.d=pr.d;const ad=Math.abs(c.d);let mu=1,dr=0,kerb=0;
 // Going off track still costs time, but no longer causes a sudden loss of control.
 if(ad>W+1.5){mu=.72;dr=1;invalid('TRACK LIMITS Â· LAP INVALID')}else if(ad>W){mu=.98;kerb=1}
 const k=n=>keys.has(n),rp=(v,t,u,d)=>t>v?Math.min(t,v+u*dt):Math.max(t,v-d*dt);
 inp.t=rp(inp.t,Math.max((k('KeyW')||k('ArrowUp'))?1:0,padInput.t),2.5,9);
 inp.b=rp(inp.b,Math.max((k('KeyS')||k('ArrowDown')||k('Space'))?1:0,padInput.b),5,10);
 const ks=((k('KeyD')||k('ArrowRight'))?1:0)-((k('KeyA')||k('ArrowLeft'))?1:0),target=ks||padInput.s;
 // Smooth both directions equally; release recentres more quickly than turn-in.
 const steerRate=Math.abs(target)<.03?9:7.8-clamp(c.vx/45,0,1)*1.8;
 inp.s+=(target-inp.s)*(1-Math.exp(-steerRate*dt));
 if(Math.abs(inp.s)<.0001)inp.s=0;
 const along=Math.cos(c.h)*tx[c.idx]+Math.sin(c.h)*tz[c.idx],grade=(CIRCUIT.elevation?.grade[c.idx]||0)*along,verticalCurvature=(CIRCUIT.elevation?.verticalCurvature[c.idx]||0)*along*along;
 const m=VEH.mass,g=VEH.gravity,a=VEH.frontCG,b=VEH.rearCG,L=VEH.wheelbase,Iz=VEH.yawInertia,v=c.vx,e=vehicleEnvelope(v,S,mu,grade,verticalCurvature),maxLat=e.maxLat;
 c.st=inp.s*e.steer;
 const vs=Math.max(v,4),aF=Math.atan2(c.vy+a*c.r,vs)-c.st,aR=Math.atan2(c.vy-b*c.r,vs);
 const Fyf=-e.mu*e.front*Math.tanh(aF*14),Fyr=-e.mu*e.rear*Math.tanh(aR*14.16);
 // Each axle shares one friction circle between turning and longitudinal force.
 const frontAvailable=Math.sqrt(Math.max(0,(e.mu*e.front)**2-Fyf**2));
 const rearAvailable=Math.sqrt(Math.max(0,(e.mu*e.rear)**2-Fyr**2));
 const requestedBrake=inp.b*Math.min(e.brake,v*m/dt);
 const FxFront=clamp(-requestedBrake*VEH.brakeBias,-frontAvailable,frontAvailable);
 const FxRear=clamp(inp.t*e.drive-requestedBrake*(1-VEH.brakeBias),-rearAvailable,rearAvailable);
 const drag=Math.min(e.drag+dr*(600+50*v),v*m/dt),cs=Math.cos(c.st),sn=Math.sin(c.st);
 c.vx+=((FxFront*cs-Fyf*sn+FxRear-drag)/m*e.cosSlope-e.slopeGravity+c.r*c.vy)*dt;
 c.vy+=((Fyf*cs+FxFront*sn+Fyr)/m-c.r*c.vx)*dt;
 c.r+=((a*(Fyf*cs+FxFront*sn)-b*Fyr)/Iz)*dt;
 c.vx=Math.max(0,c.vx);
 // Electronic stability assistance removes sideways slip and catches excess rotation.
 // All targets come from driver input, never from track direction or position.
 const targetYaw=clamp(c.vx/L*Math.tan(c.st),-maxLat/Math.max(c.vx,4),maxLat/Math.max(c.vx,4));
 c.r+=(targetYaw-c.r)*(1-Math.exp(-6*dt));
 const yawLimit=Math.abs(targetYaw)+.10;
 c.r=clamp(c.r,-yawLimit,yawLimit);
 c.vy*=Math.exp(-(c.vx<5?12:5.8)*dt);
 const slipLimit=.35+c.vx*.10;c.vy=clamp(c.vy,-slipLimit,slipLimit);
 if(c.vx<.15){c.vy=0;c.r=0}
 if(kerb&&c.vx>8)rumble(.08,.16,70);
 if(kerb)c.r+=Math.sin(c.odo*2.4)*.12*dt*Math.min(c.vx/40,1);
 const co=Math.cos(c.h),si=Math.sin(c.h);c.h+=c.r*dt;
 const wx=c.vx*co-c.vy*si,wz=c.vx*si+c.vy*co;c.x+=wx*dt;c.z+=wz*dt;c.odo+=c.vx*dt;race.dist+=Math.hypot(wx,wz)*dt;
 const q=prog(c.x,c.z,c.idx),barrierDistance=Math.abs(trackBarrier(q.i,q.d>=0?1:-1))-.6;if(Math.abs(q.d)>barrierDistance){const s=Math.sign(q.d),e=Math.abs(q.d)-barrierDistance;c.x-=nx[q.i]*s*e;c.z-=nz[q.i]*s*e;c.vx*=.55;c.vy=0;c.r*=.3;msg('BARRIER CONTACT',900);rumble(.5,.6,150)}
 const pi=c.idx,p2=prog(c.x,c.z,c.idx);c.idx=p2.i;c.d=p2.d;
 if(!isFinite(c.x+c.z+c.vx+c.vy+c.r+c.h)){placeCar(pi);invalid('SIM RESET')}
 // Cosmetic drivetrain hysteresis prevents repeated shifts around one speed threshold.
 let gI=clamp((c.gear||1)-1,0,5);while(gI<5&&c.vx>vmx[gI])gI++;while(gI>0&&c.vx<vmx[gI-1]*.87)gI--;c.gear=gI+1;c.rpm=clamp(12500*c.vx/vmx[gI],4000,12500);
 race.t+=dt;timing(pi);if(++stepN%6===0){gph.push(c.vx*3.6);if(gph.length>400)gph.shift()}
}
