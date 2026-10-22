// Acoustic drivetrain state follows wheel speed and the current gear, with launch clutch slip.
function createDriveSoundModel(){
 const m={rpm:4500,load:0,speed:0,slip:0,kerb:0,offroad:0,gear:1,camera:0,throttle:0};
 return{state:m,update(q,dt){dt=Math.max(.001,Math.min(.1,dt||1/60));
  const speed=Math.max(0,q.speed||0),throttle=Math.min(1,Math.max(0,q.throttle||0)),brake=Math.min(1,Math.max(0,q.brake||0));
  const gear=Math.max(1,Math.min(6,q.gear||1)),tops=[30,45,60,72,85,100],wheelRPM=18000*speed/tops[gear-1];
  const launchRPM=(4500+throttle*5500)*(1-Math.min(speed/20,1)*.22);
  let target=q.countdown?4500+throttle*10500:Math.max(4500,wheelRPM,gear===1?launchRPM:4500);
  target=Math.min(18000,target);if(!q.on)target=m.rpm;
  const tau=gear!==m.gear?.045:target>m.rpm?.10:.075;
  m.rpm+=(target-m.rpm)*(1-Math.exp(-dt/tau));
  const acceleration=(speed-m.speed)/dt,load=throttle*(1-brake*.65)*Math.max(.25,Math.min(1,(100-speed)/5));
  m.load+=(Math.min(1,load*(.9+Math.max(0,Math.min(.1,acceleration*.02))))-m.load)*(1-Math.exp(-dt/.05));
  m.speed=speed;m.gear=gear;m.throttle=throttle;m.camera=q.camera||0;
  m.slip=Math.min(1,Math.max(0,((q.tyreSlip||0)-.035)/.09))*Math.min(1,speed/12);
  m.kerb=q.kerb?Math.min(1,speed/30)*(.4+.6*Math.abs(Math.sin((q.distance||0)*2.4))):0;
  m.offroad=q.offroad?Math.min(1,speed/25):0;
  return m;
 }};
}
const driveSound=createDriveSoundModel();
