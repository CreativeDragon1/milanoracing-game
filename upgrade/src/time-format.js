// Round once, before splitting units: floating simulation ticks must never
// produce 0:60.000 or negative fractional digits at a minute boundary.
const fmt=ms=>{
 if(!Number.isFinite(ms))return '--:--.---';
 const value=Math.max(0,Math.round(ms)),minutes=Math.floor(value/60000);
 return minutes+':'+String(Math.floor(value/1000)%60).padStart(2,'0')+'.'+String(value%1000).padStart(3,'0');
};
