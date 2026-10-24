// Event handling: assisted vehicle dynamics. The visual racing line never drives the car.
function smoothDriverSteering(current,target,speed,dt,keyboard){
 // Digital keys need a progressive build-up; sticks already carry fine positioning.
 // Preserve full lock when held, and centre promptly when the driver releases input.
 if(!keyboard)return current+(target-current)*(1-Math.exp(-(Math.abs(target)<.03?17:16-clamp(speed/75,0,1)*2)*dt));
 const fast=clamp(speed/90,0,1),release=Math.abs(target)<.015,reversing=current*target<-.001;
 const rate=release?13:reversing?(keyboard?9:12):(keyboard?7.5-fast*1.5:11.5-fast);
 const slew=release?7:reversing?(keyboard?5:8):(keyboard?4.5-fast:7);
 const change=(target-current)*(1-Math.exp(-rate*dt));
 const next=current+clamp(change,-slew*dt,slew*dt);
 return Math.abs(next)<.0001?0:clamp(next,-1,1);
}
