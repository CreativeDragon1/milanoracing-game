// SI units. This object is injected from the same source used by the offline solver.
const VEH=__VEHICLE_DATA__;
function vehicleEnvelope(v,setup=S,roadMu=1,grade=0,verticalCurvature=0,bank=0){
 // v is horizontal speed. Project road-tangent forces into that coordinate;
 // road speed, gravity and crest/compression normal load use the actual slope.
 const p=VEH,m=p.mass,g=p.gravity,cosSlope=1/Math.hypot(1,grade),roadSpeed=v/cosSlope,normalG=Math.max(0,g*cosSlope*Math.cos(bank)+roadSpeed*roadSpeed*verticalCurvature),down=p.downforceCoefficient*setup.df*roadSpeed*roadSpeed,mu=p.tyreMu*setup.grip*roadMu;
 const front=m*normalG*p.rearCG/p.wheelbase+down*p.frontAeroShare,rear=m*normalG*p.frontCG/p.wheelbase+down*(1-p.frontAeroShare);
 const maxLat=Math.min(p.maxLateralAcceleration,.82*mu*(normalG+down/m));
 const steer=Math.min(p.steeringAngle/(1+(v/p.steeringSpeed)**2)*setup.steer,Math.atan(maxLat*p.wheelbase/(v*v+16)));
 return{front,rear,mu,maxLat,steer,cosSlope,roadSpeed,slopeGravity:g*grade*cosSlope*cosSlope,drag:.5*p.airDensity*(p.baseCdA+p.dfCdA*setup.df)*roadSpeed*roadSpeed+p.rollingCoefficient*m*normalG,drive:Math.min(p.maxDriveForce,p.power/Math.max(roadSpeed,6))*clamp((p.governorSpeed-roadSpeed)/p.governorRange,0,1),brake:p.maxBrakeForce*setup.brake};
}
function planningLimits(v,k,setup=S,grade=0,verticalCurvature=0,bank=0){
 const p=VEH,e=vehicleEnvelope(v,setup,1,grade,verticalCurvature,bank),ay=Math.abs(v*v*k-p.gravity*Math.sin(bank)),frontLat=p.mass*ay*p.rearCG/p.wheelbase,rearLat=p.mass*ay*p.frontCG/p.wheelbase;
 const frontAvailable=Math.sqrt(Math.max(0,(e.mu*e.front*p.plannerTyreReserve)**2-frontLat**2));
 const rearAvailable=Math.sqrt(Math.max(0,(e.mu*e.rear*p.plannerTyreReserve)**2-rearLat**2));
 const lateral=Math.min(e.maxLat*p.plannerSteerReserve,v*v/p.wheelbase*Math.tan(e.steer)*p.plannerSteerReserve,e.mu*e.front*p.wheelbase/(p.mass*p.rearCG)*p.plannerTyreReserve,e.mu*e.rear*p.wheelbase/(p.mass*p.frontCG)*p.plannerTyreReserve);
 return{lateral:lateral+p.gravity*Math.sin(bank)*Math.sign(k),acceleration:(Math.min(e.drive,rearAvailable)-e.drag)/p.mass*e.cosSlope-e.slopeGravity,deceleration:(Math.min(e.brake*p.brakeBias,frontAvailable)+Math.min(e.brake*(1-p.brakeBias),rearAvailable)+e.drag)/p.mass*e.cosSlope+e.slopeGravity};
}
function verticalGeometry(ds,height){const n=ds.length,grade=ds.map((d,i)=>(height[(i+1)%n]-height[(i+n-1)%n])/(d+ds[(i+n-1)%n])),angle=grade.map(Math.atan),curvature=ds.map((d,i)=>(angle[(i+1)%n]-angle[(i+n-1)%n])/((d+ds[(i+n-1)%n])*Math.hypot(1,grade[i])));return{grade,curvature}}
function solveSpeedProfile(x,z,k,setup=S,height=typeof cy!=='undefined'?cy:x.map(()=>0),bank=typeof CIRCUIT!=='undefined'?(CIRCUIT.bank||x.map(()=>0)):x.map(()=>0)){
 const count=x.length,ds=x.map((v,i)=>Math.hypot(x[(i+1)%count]-v,z[(i+1)%count]-z[i])),vertical=verticalGeometry(ds,height),limits=(v,curvature,i)=>planningLimits(v,curvature,setup,vertical.grade[i],vertical.curvature[i],bank[i]),speed=k.map((curvature,i)=>{let lo=0,hi=VEH.governorSpeed;for(let j=0;j<26;j++){const v=(lo+hi)/2;if(v*v*Math.abs(curvature)<=limits(v,curvature,i).lateral+1e-9&&limits(v,curvature,i).acceleration>=0)lo=v;else hi=v}return lo});
 let residual=Infinity,iterations=0;
 for(;iterations<40;iterations++){
  let change=0;
  for(let i=count-1;i>=0;i--){const j=(i+1)%count,kmax=Math.abs(k[i])>Math.abs(k[j])?k[i]:k[j],bound=speed[i];const feasible=v=>{const at=Math.max(v,speed[j]);return v*v<=speed[j]**2+2*Math.min(limits(at,kmax,i).deceleration,limits(at,kmax,j).deceleration)*ds[i]+1e-9};if(!feasible(bound)){let lo=0,hi=bound;for(let r=0;r<30;r++){const mid=(lo+hi)/2;if(feasible(mid))lo=mid;else hi=mid}change=Math.max(change,bound-lo);speed[i]=lo}}
  for(let i=0;i<count;i++){const j=(i+1)%count,kmax=Math.abs(k[i])>Math.abs(k[j])?k[i]:k[j],bound=speed[j];const feasible=v=>{const at=Math.max(v,speed[i]);return v*v<=speed[i]**2+2*Math.min(limits(at,kmax,i).acceleration,limits(at,kmax,j).acceleration)*ds[i]+1e-9};if(!feasible(bound)){let lo=0,hi=bound;for(let r=0;r<30;r++){const mid=(lo+hi)/2;if(feasible(mid))lo=mid;else hi=mid}change=Math.max(change,bound-lo);speed[j]=lo}}
  residual=change;if(change<1e-6)break;
 }
 return{speed,ds,vertical,iterations:iterations+1,residual,time:ds.reduce((t,d,i)=>t+2*d/(speed[i]+speed[(i+1)%count]),0)};
}
