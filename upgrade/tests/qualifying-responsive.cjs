const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {Weekend}=require('../src/race-weekend-core.js');
const source=fs.readFileSync('upgrade/src/race-weekend.js','utf8');
const context={};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('async function gpSimulateRemainingQualifying('),source.indexOf('async function gpCompleteQualifying(')),context);
const t=JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')).singapore;
const pit=JSON.parse(fs.readFileSync('upgrade/src/pit-lanes.json')).singapore;
function session(){
 const w=new Weekend({length:t.length,speed:t.line.speed,ds:t.line.ds,left:t.widthLeft,right:t.widthRight,lineOffset:t.line.offset,pit,baseLap:t.line.report.optimizedTime,difficulty:'pro',qualifying:'full'});
 w.startQual(0);for(const d of w.drivers){d.best=d.id?90+d.id*.3:Infinity;d.bestSet=d.id;}
 w.endQual();assert(!w.player.active);return w;
}
function snapshot(w){return {phase:w.phase,stage:w.stage,clock:w.clock,grid:w.grid,drivers:w.drivers.map(d=>[d.id,d.best,d.progress,d.active,d.laps,d.wear])}}
(async()=>{
 const before=session();while(before.stage<2){before.startQual(before.stage+1);let guard=0;while(before.phase==='qualifying'&&guard++<600000)before.update(.1);assert.equal(before.phase,'qualifying-result');before.events=[];}
 const after=session();let ticks=0,yields=0;const stages=[];
 assert(await context.gpSimulateRemainingQualifying(after,()=>true,async()=>{yields++;await new Promise(setImmediate)},()=>ticks++,stage=>stages.push(stage)));
 assert.deepEqual(snapshot(after),snapshot(before),'Yielding must preserve the complete qualifying result');
 assert(yields>10);assert.deepEqual(stages,[1,2]);assert.equal(new Set(after.grid).size,22);
 const cancelled=session();let current=true,updates=0;const update=cancelled.update.bind(cancelled);cancelled.update=dt=>{updates++;update(dt)};
 assert.equal(await context.gpSimulateRemainingQualifying(cancelled,()=>current,async()=>{current=false},()=>ticks++,()=>{}),false);
 const stopped=updates;await new Promise(setImmediate);assert.equal(updates,stopped);assert.equal(cancelled.stage,1);
 const report={passed:true,yields,checks:['Identical full Q2 and Q3 grid, times, progress and wear after Q1 elimination','UI yields during simulation','Leaving the session cancels pending work','All 22 grid entries retained'],scope:'Real Singapore session model and actual batching helper; deterministic state equivalence and cancellation.'};
 fs.writeFileSync('upgrade/qa/qualifying-responsive.json',JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e);process.exit(1)});
