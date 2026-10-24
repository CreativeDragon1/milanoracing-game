const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 const p=await b.newPage({viewport:{width:1440,height:810}}),cdp=await p.context().newCDPSession(p);
 await p.goto('file:///'+path.resolve('upgrade/qa/standalone.html').replace(/\\/g,'/')+'?circuit=singapore');
 await p.waitForFunction(()=>window.MilanoReady===true,null,{timeout:120000});
 await p.evaluate(()=>{applyGraphics('high');newSession('gp');state='race';show('none');snap=true;});await p.waitForTimeout(3000);
 await cdp.send('Tracing.start',{categories:'-*,v8,devtools.timeline,disabled-by-default-v8.gc',transferMode:'ReturnAsStream'});
 const data=await p.evaluate(async()=>{const times=[],tasks=[],start=performance.now();new PerformanceObserver(l=>tasks.push(...l.getEntries().map(e=>({at:e.startTime-start,ms:e.duration})))).observe({type:'longtask'});const base=frame;frame=function(now){const t=performance.now();base(now);const ms=performance.now()-t;if(ms>20)times.push({at:t-start,ms})};await new Promise(r=>setTimeout(r,20000));return {tasks,times}});
 const completed=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');const {stream}=await completed;let trace='';while(true){const chunk=await cdp.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break}await cdp.send('IO.close',{handle:stream});
 fs.writeFileSync('upgrade/qa/frame-spikes-trace.json',trace);
 const events=JSON.parse(trace).traceEvents.filter(e=>e.ph==='X'&&e.dur>10000).sort((a,b)=>b.dur-a.dur).slice(0,45).map(e=>({name:e.name,ms:e.dur/1000,args:e.args}));
 fs.writeFileSync('upgrade/qa/frame-spikes.json',JSON.stringify({data,events},null,2));console.log('FRAME SPIKES',JSON.stringify({data,events:events.map(e=>({name:e.name,ms:e.ms}))}));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
