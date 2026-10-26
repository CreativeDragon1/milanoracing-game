const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const old=fs.readFileSync('upgrade/tests/fixtures/hud-before-oct25.js','utf8')+'function gpResults(';
const extract=(text,a,b)=>text.slice(text.indexOf(a),text.indexOf(b,text.indexOf(a)));
function fixture(){
 const nodes=new Map(),canvas=new Proxy({},{get:()=>()=>{}}),kicker={textContent:''};let writes=0;
 const get=id=>{if(!nodes.has(id)){let value='';nodes.set(id,{get textContent(){return value},set textContent(v){value=String(v);writes++},style:{},className:'',classList:{toggle(){}},getContext:()=>canvas,querySelector:()=>kicker,innerHTML:''})}return nodes.get(id)};
 const p={id:0,name:'YOU',progress:40,lapStart:8,best:90,outlap:false,valid:true,tyre:'soft',wear:0,used:new Set(),pit:null};
 const weekend={player:p,clock:54,duration:300,stage:0,phase:'qualifying',cfg:{qualifying:'full'},standings:()=>[p]};
 const c={console,$:get,document:{querySelectorAll:()=>[]},performance:{now:()=>c.now},now:140,GP:{weekend,lastHUD:0,pitChoice:'hard'},MP:{active:false},race:{started:true,t:54,lapStart:8,lapNo:1,valid:true,best:90000,pbOld:Infinity,laps:[],ref:null,last:null},c:{vx:30,gear:3,idx:0},driveSound:{state:{rpm:9000}},inp:{t:.5,b:0,s:0},mode:'qual',LEN:5000,PIT:{speedLimitKmh:80},RaceWeekend:{TYRES:{soft:{name:'SOFT',letter:'S',colour:'#f00'},hard:{name:'HARD',letter:'H'}}},clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),drawCircuitMap(){},gph:[],nodes,get,writes:()=>writes,kicker};
 vm.createContext(c);return c;
}
function install(c,before){
 vm.runInContext(before?extract(old,'const fmt=ms=>','function finish(){'):fs.readFileSync('upgrade/src/time-format.js','utf8'),c);
 vm.runInContext(before?extract(old,'function hud(){','// Quality presets'):fs.readFileSync('upgrade/src/hud.js','utf8'),c);
 const weekend=before?old:fs.readFileSync('upgrade/src/race-weekend.js','utf8');
 vm.runInContext(extract(weekend,before?'function gpHud(force=false)':'function gpTimingHud(){','function gpResults('),c);
 vm.runInContext(before?'const base=hud;hud=()=>{base();gpHud()}':'const base=hud;hud=()=>{base();gpTimingHud();gpHud()}',c);
}
const before=fixture();install(before,true);vm.runInContext('hud()',before);assert.equal(before.get('session-type').textContent,'Q1');before.now=220;vm.runInContext('hud()',before);
assert.equal(before.get('session-type').textContent,'PRACTICE','Baseline should reproduce the competing HUD writers');
const after=fixture();install(after,false);
for(let i=0;i<120;i++){after.now=140+i*80;after.GP.weekend.clock=54+i*.08;vm.runInContext('hud();gpHud()',after);assert.equal(after.get('session-type').textContent,'Q1');assert.match(after.get('lap').textContent,/^[34]:\d\d$/);assert.equal(after.get('val').textContent,'PUSH LAP')}
assert.equal(vm.runInContext('fmt(59999.999999)',after),'1:00.000');
assert.equal(vm.runInContext('fmt(-.000001)',after),'0:00.000');
assert.equal(vm.runInContext('fmt(Infinity)',after),'--:--.---');
after.GP.weekend.clock=70;after.GP.weekend.player.lapStart=69.75;after.race.lapStart=1;
vm.runInContext('hud()',after);assert.equal(after.get('cur').textContent,'0:00.250','Use the actual weekend clock even when the practice clock is stale');
after.GP.weekend.player.outlap=true;vm.runInContext('hud()',after);assert.equal(after.get('cur').textContent,'--:--.---');assert.equal(after.kicker.textContent,'OUT LAP');
after.GP.weekend=null;after.MP.active=true;after.get('session-type').textContent='ONLINE RACE';after.get('cur').textContent='2:31.100';vm.runInContext('base()',after);assert.equal(after.get('session-type').textContent,'ONLINE RACE');assert.equal(after.get('cur').textContent,'2:31.100');
after.MP.active=false;after.mode='pr';vm.runInContext('base()',after);assert.equal(after.get('session-type').textContent,'PRACTICE');assert.equal(after.kicker.textContent,'CURRENT LAP');
const writes=after.writes();for(let i=0;i<100;i++)vm.runInContext('base()',after);assert.equal(after.writes(),writes,'Unchanged telemetry must not rewrite text nodes');
const report={passed:true,baselineFlickerReproduced:true,checks:['120 alternating HUD updates retain Q1/countdown/push status','Minute rounding and nonnegative clock','Pit-to-track timer reads session clock','Out lap display','Online timing ownership','Return to practice','No unchanged text writes'],scope:'Actual generated baseline HUD and updated source functions with controlled DOM and simulation clocks; browser integration still requires rendered verification.'};
fs.writeFileSync('upgrade/qa/hud-timing.json',JSON.stringify(report,null,2));console.log(report);
