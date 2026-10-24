const {Weekend,DIFFICULTIES,mod}=require('../src/race-weekend-core'),assert=require('assert'),fs=require('fs');
const reports=[];
for(const difficulty of Object.keys(DIFFICULTIES))for(const phase of ['race','qualifying'])for(const width of [8,2.5]){
const N=256,L=4000,a=v=>Array(N).fill(v),w=new Weekend({difficulty,length:L,speed:a(75),ds:a(L/N),left:a(width),right:a(width),lineOffset:a(0),pit:{entry:240,box:1,station:[240,245,250],s:[0,50,100],x:[0,50,100],z:[0,0,0],y:[0,0,0],length:100,width:7,speedLimitKmh:80},laps:10,twoCompounds:false,baseLap:80});
w.startRace();w.phase=phase;w.duration=300;w.drivers.forEach(d=>d.active=d.id===1||d.id===2);const leader=w.drivers[1],chaser=w.drivers[2];
Object.assign(leader,{progress:550,v:32,offset:0,pace:.5,qMode:phase==='qualifying'?'cooldown':'push',outlap:false});Object.assign(chaser,{progress:450,v:50,offset:0,pace:DIFFICULTIES[difficulty].pace,qMode:'push',outlap:false});
let maxOffset=0,minSeparation=Infinity,passed=false,yielded=false;
for(let i=0;i<120*22;i++){w.update(1/120);maxOffset=Math.max(maxOffset,Math.abs(chaser.offset));if(phase==='qualifying'&&Math.abs(leader.offset)>2.5)yielded=true;const gap=mod(leader.progress-chaser.progress+L/2,L)-L/2;if(Math.abs(leader.offset-chaser.offset)<1.8)minSeparation=Math.min(minSeparation,Math.abs(gap));if(gap<-14)passed=true;}
assert(minSeparation>5.7,'no overlap');if(width===8){assert(passed,difficulty+' '+phase+' completes pass');if(phase==='qualifying')assert(yielded,'cooldown car yields');else assert(maxOffset>2.3,'race car leaves line');}else assert(!passed,'no forced pass without space');
reports.push({difficulty,phase,width,passed,yielded,maxOffset,minSeparation});
}
fs.writeFileSync('upgrade/qa/overtaking.json',JSON.stringify({passed:true,reports},null,2));console.log('PASS',reports.length,'overtaking and qualifying scenarios');
