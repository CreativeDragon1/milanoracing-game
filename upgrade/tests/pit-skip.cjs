const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {Weekend}=require('../src/race-weekend-core.js');
const source=fs.readFileSync('upgrade/src/race-weekend.js','utf8'),context={};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('async function gpAdvancePit('),source.indexOf('async function gpSkipPit(')),context);
const tracks=JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')),pits=JSON.parse(fs.readFileSync('upgrade/src/pit-lanes.json'));
function create(id,qual){const t=tracks[id],w=new Weekend({length:t.length,speed:t.line.speed,ds:t.line.ds,left:t.widthLeft,right:t.widthRight,lineOffset:t.line.offset,pit:pits[id],baseLap:t.line.report.optimizedTime,difficulty:'pro',qualifying:'full',laps:10});if(qual)w.startQual(0);else{w.startRace();w.player.progress=pits[id].entry/t.N*t.length;w.player.penalty=5;w.enterPit(w.player)}return w}
function snapshot(w){return JSON.stringify({clock:w.clock,phase:w.phase,drivers:w.drivers.map(d=>({progress:d.progress,v:d.v,wear:d.wear,tyre:d.tyre,stops:d.stops,used:[...d.used],penalty:d.penalty,laps:d.laps,pit:d.pit,best:d.best}))})}
(async()=>{const rows=[];for(const id of Object.keys(tracks))for(const qual of[false,true]){
 const a=create(id,qual),b=create(id,qual);let normal=0;while(a.player.pit&&normal++<72000){a.update(1/120);a.events.length=0}assert(!a.player.pit);
 let yields=0,clock=0;assert(await context.gpAdvancePit(b,()=>true,async()=>{yields++},()=>clock++,dt=>{b.update(dt);b.events.length=0}));
 assert.equal(snapshot(b),snapshot(a),id+' no competitive advantage');assert(yields>0);assert.equal(b.player.stops,qual?0:1);rows.push({id,qual,elapsed:b.clock,yields});
 }
 const w=create('monaco',false);let current=true,t=0;assert.equal(await context.gpAdvancePit(w,()=>current,async()=>{current=false},()=>t++,dt=>w.update(dt)),false);assert(w.player.pit);
 const timing=create('monaco',false);timing.player.pit=null;timing.player.progress=-.2;timing.clock=10;timing.advance(timing.player,1);const lapStart=timing.player.lapStart;timing.clock=11;timing.advance(timing.player,-1);timing.clock=12;timing.advance(timing.player,1);assert.equal(timing.player.lapStart,lapStart,'reversing across start cannot earn a new lap time');assert.equal(timing.player.valid,false);
 fs.writeFileSync('upgrade/qa/pit-skip.json',JSON.stringify({passed:true,rows,cancellation:true,scope:'All 14 routes, qualifying exits and race stops match continuous session advancement exactly.'},null,2));console.log('28 pit traversals, timing/service equivalence and cancellation passed');
})().catch(e=>{console.error(e);process.exit(1)});
