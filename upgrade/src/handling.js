// Event handling: assisted vehicle dynamics. The visual racing line never drives the car.
function smoothDriverSteering(current,target,speed,dt,keyboard,assisted=false){
 // Digital keys need a progressive build-up; sticks already carry fine positioning.
 // Preserve full lock when held, and centre promptly when the driver releases input.
 if(!keyboard){const fast=clamp((Math.abs(speed)-12)/55,0,1),release=Math.abs(target)<.03,reversing=current*target<-.015,rate=release?18:reversing?18:16-2*fast,slew=release?7:reversing?7:7-fast;return clamp(current+clamp((target-current)*(1-Math.exp(-rate*dt)),-slew*dt,slew*dt),-1,1)}
 const fast=clamp((Math.abs(speed)-12)/38,0,1),release=Math.abs(target)<.015;
 const reversing=current*target<-.015;
 // Keep short taps gentle, then give a held key authority to finish a late turn.
 const commitment=assisted&&!release&&!reversing?clamp((Math.abs(current)-.28)/.40,0,1)*fast:0;
 const rate=release?18:reversing?18:12*(1-fast)+4.2*fast+5.8*commitment;
 const slew=release?7:reversing?7:5.8*(1-fast)+2.7*fast+3*commitment;
 const change=(target-current)*(1-Math.exp(-rate*dt));
 const next=current+clamp(change,-slew*dt,slew*dt);
 return Math.abs(next)<.0001?0:clamp(next,-1,1);
}
function driverSteeringCommand(input,keyboard,sensitivity,speed=50){
 // Sensitivity changes the centre response even when the tyre-based lock is
 // limiting the rack. Retain full lock for hairpins and deliberate long holds.
 const magnitude=Math.abs(input),gentle=clamp((1.25-sensitivity)/.65,0,1),fast=clamp((Math.abs(speed)-12)/38,0,1),linear=(keyboard?.88:.96)*(1-fast)+(keyboard?.42:.78)*fast;
 return Math.sign(input)*(magnitude*(linear-.12*gentle)+(1-linear+.12*gentle)*magnitude*magnitude*magnitude);
}
// Driver rack is independent of the racing-line planner. Sensitivity shapes
// small inputs, while a deliberate held input retains the full turning circle.
function playerSteeringLock(e,speed){return Math.min(.64/(1+(speed/40)**2),Math.atan(e.maxLat*VEH.wheelbase/(speed*speed+9)))}
// Input-led handling support: no track lookup, target speed or automatic pedal.
// Reserve additional grip for committed turns, tapering at very high speed.
// Road surface and tyre condition still scale the underlying tyre forces.
function driverGripSupport(input,speed,enabled){
 return enabled?clamp((Math.abs(input)-.12)/.65,0,1)*clamp((speed-6)/10,0,1)*(1-.65*clamp((speed-45)/35,0,1)):0;
}
function selectDriveDirection(car,gas,brake,dt){
 if(car.reverse===undefined){car.reverse=false;car.reverseArmed=Math.abs(car.vx)<.35;car.reverseHold=0}
 if(!car.reverse){
  if(car.vx>.35){car.reverseArmed=false;car.reverseHold=0}
  else if(brake<.1){car.reverseArmed=true;car.reverseHold=0}
  else if(car.reverseArmed&&gas<.1){car.reverseHold+=dt;if(car.reverseHold>=.25){car.reverse=true;car.vx=0}}
 }else if(gas>.1&&car.vx>=-.08){car.reverse=false;car.vx=0;car.reverseArmed=false;car.reverseHold=0}
 return car.reverse;
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
 const reversing=selectDriveDirection(c,inp.t,Math.max((k('KeyS')||k('ArrowDown')||k('Space'))?1:0,padInput.b,touchInput.b),dt);
 const ks=((k('KeyD')||k('ArrowRight'))?1:0)-((k('KeyA')||k('ArrowLeft'))?1:0),target=ks||touchInput.s||padInput.s;
 const keyboard=ks!==0||(Math.abs(padInput.s)<.015&&Math.abs(touchInput.s)<.015);
 const assisted=S.cornerAssist===1&&!reversing;
 inp.s=smoothDriverSteering(inp.s,target,c.vx,dt,keyboard,assisted);
 const along=Math.cos(c.h)*tx[c.idx]+Math.sin(c.h)*tz[c.idx],ia=(c.idx+N-1)%N,ib=(c.idx+1)%N,centreK=(tx[c.idx]*(tz[ib]-tz[ia])-tz[c.idx]*(tx[ib]-tx[ia]))/(2*LEN/N),metric=Math.max(.25,1-centreK*c.d),grade=(CIRCUIT.elevation?.grade[c.idx]||0)*along/metric,verticalCurvature=(CIRCUIT.elevation?.verticalCurvature[c.idx]||0)*along*along/(metric*metric);
 const bank=(CIRCUIT.bank?.[c.idx]||0)*along;
 const m=VEH.mass,g=VEH.gravity,a=VEH.frontCG,b=VEH.rearCG,L=VEH.wheelbase,Iz=VEH.yawInertia,v=c.vx,e=vehicleEnvelope(v,S,mu,grade,verticalCurvature,bank);
 const support=driverGripSupport(inp.s,v,assisted),gripReserve=1+.22*support;
 e.mu*=gripReserve;const maxLat=e.maxLat=Math.min(VEH.maxLateralAcceleration*1.08,e.maxLat*gripReserve);
 c.cornerBrake=0;
 // Only the driver's brake suppresses throttle. Assistance never presses it.
 if(!reversing)inp.t=Math.min(inp.t,Math.max(0,1-inp.b*20));
 c.st=driverSteeringCommand(inp.s,keyboard,S.steer,v)*playerSteeringLock(e,v);
 if(reversing){
  const targetSpeed=inp.t>.05?0:-8*inp.b,rate=inp.t>.05?10:inp.b>.05?3.8:2.5;
  c.vx+=clamp(targetSpeed-c.vx,-rate*dt,rate*dt);c.vy=0;
  c.r+=(c.vx/L*Math.tan(c.st)-c.r)*(1-Math.exp(-14*dt));
 }else{
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
 const lowSpeed=1-clamp((c.vx-12)/16,0,1),kinematic=lowSpeed*lowSpeed*(3-2*lowSpeed);
 c.r+=(targetYaw-c.r)*Math.max(kinematic,1-Math.exp(-(6+4*support)*dt));
 const yawLimit=Math.abs(targetYaw)+.10;
 c.r=clamp(c.r,-yawLimit,yawLimit);
 c.vy*=Math.exp(-(c.vx<5?12:5.8+2*support)*dt);
 const slipLimit=.35+c.vx*.10;c.vy=clamp(c.vy,-slipLimit,slipLimit);
 if(c.vx<.15){c.vy=0;c.r=0}
 }
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
 let gI=clamp((c.gear||1)-1,0,5);while(gI<5&&c.vx>vmx[gI])gI++;while(gI>0&&c.vx<vmx[gI-1]*.87)gI--;c.gear=reversing?-1:gI+1;c.rpm=clamp(12500*Math.abs(c.vx)/(reversing?12:vmx[gI]),4000,12500);
 race.t+=dt;timing(pi);if(typeof GP!=='undefined'&&GP.weekend)gpStepAfter(dt);if(++stepN%6===0){gph.push(c.vx*3.6);if(gph.length>400)gph.shift()}
}
