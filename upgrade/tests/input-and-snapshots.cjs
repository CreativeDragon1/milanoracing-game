const fs=require('fs'),vm=require('vm'),assert=require('assert');
const box={Math,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};vm.createContext(box);
const handling=fs.readFileSync('upgrade/src/handling.js','utf8');vm.runInContext(handling.slice(0,handling.indexOf('function step(')),box);
const control=fs.readFileSync('upgrade/src/controller.js','utf8');vm.runInContext(control.slice(control.indexOf('const padButton='),control.indexOf('function cycleCamera')),box);
const network=fs.readFileSync('upgrade/src/multiplayer.js','utf8'),start=network.indexOf('function sampleGhost(');vm.runInContext(network.slice(start,network.indexOf('\n',start)),box);
const results=[];
for(const speed of[0,25,55,90]){let v=0,maxChange=0;for(let i=0;i<120;i++){const next=box.smoothDriverSteering(v,1,speed,1/120,true);maxChange=Math.max(maxChange,next-v);assert(next>=v&&next<=1);v=next}assert(v>.95);const oneSecond=v;for(let i=0;i<120;i++)v=box.smoothDriverSteering(v,1,speed,1/120,true);assert(v>.995);const full=v;for(let i=0;i<42;i++)v=box.smoothDriverSteering(v,0,speed,1/120,true);assert(Math.abs(v)<.035);assert(maxChange<.04);results.push({speed,steeringAfterOneSecond:oneSecond,fullLockAfterTwoSeconds:full,releaseAfter350ms:v,maxStep:maxChange});}
const pad=x=>({mapping:'standard',axes:[x],buttons:Array.from({length:17},(_,i)=>({value:i===7?1:i===6?.4:0,pressed:false}))});
for(const axis of[-.12,-.06,0,.06,.12])assert.strictEqual(box.readPad(pad(axis),.12).s,0);
const mid=box.readPad(pad(.5),.12),full=box.readPad(pad(1),.12);assert(mid.s>0&&mid.s<.4&&full.s===1&&full.t===1&&full.b===.4);
const poses=[{time:1000,x:0,z:0,h:Math.PI-.1,v:40},{time:1100,x:4,z:0,h:-Math.PI+.1,v:40}];
const midPose=box.sampleGhost(poses,1050);assert(Math.abs(Math.abs(midPose.h)-Math.PI)<1e-9&&midPose.x===2);const stale=box.sampleGhost(poses,9000);assert(Math.hypot(stale.x-4,stale.z)<=2.400001);assert(box.sampleGhost([],1000)===null);
fs.writeFileSync('upgrade/qa/input-and-snapshots.json',JSON.stringify({keyboard:results,standardGamepad:{mid,full},snapshotInterpolation:'shortest-angle, midpoint and bounded stale extrapolation passed',physicalControllerTested:false},null,2));console.log('Keyboard ramp/release, standard gamepad mapping and snapshot interpolation passed.');
