const assert=require('assert'),fs=require('fs'),vm=require('vm');
function filter(file){const ctx={Math,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};vm.createContext(ctx);vm.runInContext(fs.readFileSync(file,'utf8').split('function step(dt)')[0]+'\nthis.filter=smoothDriverSteering;',ctx);return ctx.filter}
const current=filter('upgrade/src/handling.js'),before=filter('upgrade/tests/fixtures/steering-before.js');const result=[];
for(const keyboard of [true,false])for(const speed of [0,30,70,95]){
 let x=0,old=0;for(let i=0;i<10;i++){x=current(x,1,speed,1/120,keyboard);old=before(old,1,speed,1/120,keyboard)}
 if(keyboard)assert(x<old*.8,'short keyboard taps must be gentler');const pulse=x;
 for(let i=0;i<240;i++)x=current(x,1,speed,1/120,keyboard);assert(x>.995&&x<=1,'full steering remains available');
 for(let i=0;i<120;i++)x=current(x,0,speed,1/120,keyboard);assert(Math.abs(x)<.001,'release returns to centre');
 for(let i=0;i<120;i++){x=current(x,-1,speed,1/120,keyboard);assert(x>=-1&&x<=1&&Number.isFinite(x))}assert(x<-.95);
 result.push({keyboard,speedKmh:speed*3.6,previous83msPulse:old,current83msPulse:pulse});
}
fs.writeFileSync('upgrade/qa/controls-regression.json',JSON.stringify({passed:true,scope:'Synthetic keyboard/stick input filtering; physical Bluetooth controller testing remains separate.',results:result},null,2));console.log('Progressive taps, full lock, release and reversal passed.',result.filter(r=>r.keyboard));
