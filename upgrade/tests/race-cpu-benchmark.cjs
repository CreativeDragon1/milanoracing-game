const crypto=require('crypto'),fs=require('fs'),path=require('path'),assert=require('assert');
const baseline=require('../../upgrade/tests/fixtures/race-core-before.js'),current=require('../src/race-weekend-core.js');
const tracks=JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')),pits=JSON.parse(fs.readFileSync('upgrade/src/pit-lanes.json'));
const reports=[];
for(const id of ['monza','singapore','interlagos']){
 const t=tracks[id],config={length:t.length,speed:t.line.speed,ds:t.line.ds,left:t.widthLeft,right:t.widthRight,lineOffset:t.line.offset,pit:pits[id],baseLap:t.line.report.optimizedTime,laps:3,difficulty:'pro',twoCompounds:false};
 const result={id,before:[],after:[]};
 for(let repeat=0;repeat<7;repeat++)for(const [key,lib] of repeat%2?[['after',current],['before',baseline]]:[['before',baseline],['after',current]]){
  const w=new lib.Weekend(config);w.startRace();const begin=performance.now();for(let i=0;i<3600;i++)w.update(1/120);const elapsed=performance.now()-begin;if(repeat)result[key].push(elapsed);assert(w.drivers.every(d=>Number.isFinite(d.v+d.progress)));
 }
 const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];result.beforeMs=median(result.before);result.afterMs=median(result.after);result.reductionPercent=100*(1-result.afterMs/result.beforeMs);reports.push(result);console.log(id,result.beforeMs.toFixed(1),result.afterMs.toFixed(1),result.reductionPercent.toFixed(1)+'%');
}
fs.writeFileSync('upgrade/qa/race-cpu-performance.json',JSON.stringify({sourceSHA256:crypto.createHash('sha256').update(fs.readFileSync('upgrade/src/race-weekend-core.js')).digest('hex'),baselineSHA256:crypto.createHash('sha256').update(fs.readFileSync('upgrade/tests/fixtures/race-core-before.js')).digest('hex'),scope:'Alternating old/new race core, 22 drivers, 3600 fixed 120Hz steps (30 simulated seconds), six timed repeats after JIT warmup, no rendering. Measures race simulation CPU only.',reports},null,2));
