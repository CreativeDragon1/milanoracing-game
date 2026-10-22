const fs=require('fs'),vm=require('vm'),assert=require('assert'),{spawnSync}=require('child_process');
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync('upgrade/src/track-limits.js','utf8').replace('__TRACK_LIMIT_RULES__',fs.readFileSync('upgrade/src/track-limits.json','utf8'))+';this.rule=TrackLimits;',box);
const {rule}=box,tour=JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')),sequences=[],reports=[];
function run(half,side,hz,sections){let s=rule.fresh(),count=0,sequence=[],events=[];for(const [excess,seconds,speed=50]of sections)for(let i=0;i<Math.round(seconds*hz);i++){const input=[side*(half+excess),half,speed,1/hz];s=rule.update(s,...input);sequence.push(input);if(s.triggered){count++;events.push(sequence.length/hz)}}sequences.push(sequence);return{count,s,events}}
for(const [id,d]of Object.entries(tour))for(const widths of[d.widthLeft,d.widthRight])for(const half of[Math.min(...widths),Math.max(...widths)])for(const side of[-1,1])for(const hz of[20,60,120]){
 assert.equal(run(half,side,hz,[[2.3,3]]).count,0,'Kerb and tyre use must remain valid');
 assert.equal(run(half,side,hz,[[3,.35],[0,.6],[3,.35],[0,.6]]).count,0,'Separate brief excursions must recover');
 assert.equal(run(half,side,hz,[[3,4]]).count,1,'Sustained excursion counts once');
 assert.equal(run(half,side,hz,[[3,1.2],[0,.6],[3,1.2]]).count,2,'Separate cuts count separately');
 const deep=run(half,side,hz,[[5.5,.4]]);assert.equal(deep.count,1,'Deep shortcut must be detected');assert(deep.events[0]<=.3);
 assert.equal(run(half,side,hz,[[3,.9,100]]).count,1,'Fast 70 metre cut cannot hide in the time grace');
 reports.push({id,half,side,hz,passed:true});
}
// Compare both implementations on sampled traces, including edge jitter.
const fixtures=sequences.filter((_,i)=>i%97===0);fixtures.push(Array.from({length:150},(_,i)=>[6+(i%3?3:.95),6,30,.05]));
const py=spawnSync('python',['-X','utf8','-c',"import sys,json;sys.path.insert(0,'upgrade/server');import track_limits as t;out=[]\nfor seq in json.load(sys.stdin):\n s=t.fresh();events=[]\n for i,a in enumerate(seq):\n  s=t.update(s,*a)\n  if s['triggered']:events.append(i)\n out.append(events)\nprint(json.dumps(out))"],{input:JSON.stringify(fixtures),encoding:'utf8'});assert.equal(py.status,0,py.stderr);
const expected=fixtures.map(seq=>{let s=rule.fresh(),events=[];seq.forEach((a,i)=>{s=rule.update(s,...a);if(s.triggered)events.push(i)});return events});assert.deepEqual(JSON.parse(py.stdout),expected);
fs.writeFileSync('upgrade/qa/track-limits.json',JSON.stringify({circuitConfigurations:reports.length,scenarioChecks:reports.length*6,serverBrowserParityTraces:fixtures.length,rules:rule.cfg},null,2));console.log('Track limits passed',reports.length*6,'scenarios and',fixtures.length,'browser/server parity traces.');
