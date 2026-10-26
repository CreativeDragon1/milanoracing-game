// Event handling: assisted vehicle dynamics. The visual racing line never drives the car.
function smoothDriverSteering(current,target,speed,dt,keyboard){
 // Digital keys need a progressive build-up; sticks already carry fine positioning.
 // Preserve full lock when held, and centre promptly when the driver releases input.
 if(!keyboard)return current+clamp((target-current)*(1-Math.exp(-(Math.abs(target)<.03?17:16-clamp(speed/75,0,1)*2)*dt)),-8*dt,8*dt);
 const fast=clamp(speed/90,0,1),release=Math.abs(target)<.015,reversing=current*target<-.001;
 const rate=release?11:4.8-fast*1.3;
 const slew=release?5.5:2.7;
 const change=(target-current)*(1-Math.exp(-rate*dt));
 const next=current+clamp(change,-slew*dt,slew*dt);
 return Math.abs(next)<.0001?0:clamp(next,-1,1);
}
function driverSteeringCommand(input,keyboard,sensitivity){
 // Sensitivity changes the centre response even when the tyre-based lock is
 // limiting the rack. Retain full lock for hairpins and deliberate long holds.
 const magnitude=Math.abs(input),gentle=clamp((1.25-sensitivity)/.65,0,1),linear=keyboard?.42:.78;
 return Math.sign(input)*(magnitude*(linear-.12*gentle)+(1-linear+.12*gentle)*magnitude*magnitude*magnitude);
}
function combinedAxleForces(longitudinal,lateral,capacity){
 const scale=Math.min(1,capacity/Math.max(1,Math.hypot(longitudinal,lateral)));
 return{longitudinal:longitudinal*scale,lateral:lateral*scale};
}
function step(dt){
 if(typeof GP!=='undefined'&&GP.weekend&&gpStepBefore(dt))return;
 const pr=prog(c.x,c.z,c.idx);c.idx=pr.i;c.d=pr.d;const ad=Math.abs(c.d),edge=trackHalf(c.idx,c.d>=0?1:-1);let mu=1,dr=0,kerb=0;
 // Going off track still costs time, but no longer causes a sudden loss of control.
 if(ad>edge+1.1){const blend=clamp((ad-edge-1.1)/1.8,0,1);mu=.98-.26*blend;dr=blend}else if(ad>edge){mu=.98;kerb=1}
 if(typeof GP!=='undefined'&&GP.weekend)mu*=GP.weekend.grip(GP.weekend.player);
 const k=n=>keys.has(n),rp=(v,t,u,d)=>t>v?Math.min(t,v+u*dt):Math.max(t,v-d*dt);
 inp.t=rp(inp.t,Math.max((k('KeyW')||k('ArrowUp'))?1:0,padInput.t,touchInput.t),5,12);
 inp.b=rp(inp.b,Math.max((k('KeyS')||k('ArrowDown')||k('Space'))?1:0,padInput.b,touchInput.b),12,15);
 if(typeof GP!=='undefined'&&GP.weekend?.difficulty.brakeAssist){const demand=guideDemand(c.idx,c.vx);if(demand.brake>.03){inp.b=Math.max(inp.b,demand.brake);inp.t=Math.min(inp.t,1-demand.brake)}}
 const ks=((k('KeyD')||k('ArrowRight'))?1:0)-((k('KeyA')||k('ArrowLeft'))?1:0),target=ks||touchInput.s||padInput.s;
 const keyboard=ks!==0||(Math.abs(padInput.s)<.015&&Math.abs(touchInput.s)<.015);
 inp.s=smoothDriverSteering(inp.s,target,c.vx,dt,keyboard);
 const along=Math.cos(c.h)*tx[c.idx]+Math.sin(c.h)*tz[c.idx],ia=(c.idx+N-1)%N,ib=(c.idx+1)%N,centreK=(tx[c.idx]*(tz[ib]-tz[ia])-tz[c.idx]*(tx[ib]-tx[ia]))/(2*LEN/N),metric=Math.max(.25,1-centreK*c.d),grade=(CIRCUIT.elevation?.grade[c.idx]||0)*along/metric,verticalCurvature=(CIRCUIT.elevation?.verticalCurvature[c.idx]||0)*along*along/(metric*metric);
 const bank=(CIRCUIT.bank?.[c.idx]||0)*along;
 const m=VEH.mass,g=VEH.gravity,a=VEH.frontCG,b=VEH.rearCG,L=VEH.wheelbase,Iz=VEH.yawInertia,v=c.vx,e=vehicleEnvelope(v,S,mu,grade,verticalCurvature,bank),maxLat=e.maxLat;
 c.st=driverSteeringCommand(inp.s,keyboard,S.steer)*e.steer;
 const vs=Math.max(v,4),aF=Math.atan2(c.vy+a*c.r,vs)-c.st,aR=Math.atan2(c.vy-b*c.r,vs);
 let Fyf=-e.mu*e.front*Math.tanh(aF*14),Fyr=-e.mu*e.rear*Math.tanh(aR*14.16);
 // Share grip between the requested forces. Allocating all lateral grip first
 // used to make braking almost disappear while the driver held steering lock.
 const requestedBrake=inp.b*Math.min(e.brake,v*m/dt);
 const frontForce=combinedAxleForces(-requestedBrake*VEH.brakeBias,Fyf,e.mu*e.front),rearForce=requestedBrake>0?combinedAxleForces(inp.t*e.drive-requestedBrake*(1-VEH.brakeBias),Fyr,e.mu*e.rear):{longitudinal:Math.min(inp.t*e.drive,Math.sqrt(Math.max(0,(e.mu*e.rear)**2-Fyr**2))),lateral:Fyr};
 const FxFront=frontForce.longitudinal,FxRear=rearForce.longitudinal;Fyf=frontForce.lateral;Fyr=rearForce.lateral;
 const drag=Math.min(e.drag+dr*(600+50*v),v*m/dt),cs=Math.cos(c.st),sn=Math.sin(c.st);
 c.vx+=((FxFront*cs-Fyf*sn+FxRear-drag)/m*e.cosSlope-e.slopeGravity+c.r*c.vy)*dt;
 c.vy+=((Fyf*cs+FxFront*sn+Fyr)/m+g*Math.sin(bank)-c.r*c.vx)*dt;
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
 // Kerbs retain grip loss and controller feedback; no artificial yaw oscillation.
 const co=Math.cos(c.h),si=Math.sin(c.h);c.h+=c.r*dt;
 const wx=c.vx*co-c.vy*si,wz=c.vx*si+c.vy*co;c.x+=wx*dt;c.z+=wz*dt;c.odo+=c.vx*dt;race.dist+=Math.hypot(wx,wz)*dt;
 const q=prog(c.x,c.z,c.idx),barrierDistance=Math.abs(trackBarrier(q.i,q.d>=0?1:-1))-.6;if(Math.abs(q.d)>barrierDistance){const s=Math.sign(q.d),e=Math.abs(q.d)-barrierDistance;c.x-=nx[q.i]*s*e;c.z-=nz[q.i]*s*e;c.vx*=.55;c.vy=0;c.r*=.3;msg('BARRIER CONTACT',900);rumble(.5,.6,150)}
 const pi=c.idx,p2=prog(c.x,c.z,c.idx);c.idx=p2.i;c.d=p2.d;
 if(!isFinite(c.x+c.z+c.vx+c.vy+c.r+c.h)){placeCar(pi);invalid('SIM RESET')}
 c.limitState=TrackLimits.update(c.limitState,c.d,trackHalf(c.idx,c.d>=0?1:-1),c.vx,dt);
 if(c.limitState.violation&&!(typeof GP!=='undefined'&&GP.weekend)&&!(typeof MP!=='undefined'&&MP.active))invalid('TRACK LIMITS · LAP DELETED');
 // Cosmetic drivetrain hysteresis prevents repeated shifts around one speed threshold.
 let gI=clamp((c.gear||1)-1,0,5);while(gI<5&&c.vx>vmx[gI])gI++;while(gI>0&&c.vx<vmx[gI-1]*.87)gI--;c.gear=gI+1;c.rpm=clamp(12500*c.vx/vmx[gI],4000,12500);
 race.t+=dt;timing(pi);if(typeof GP!=='undefined'&&GP.weekend)gpStepAfter(dt);if(++stepN%6===0){gph.push(c.vx*3.6);if(gph.length>400)gph.shift()}
}
