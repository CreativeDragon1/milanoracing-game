const {chromium}=require('playwright'),fs=require('node:fs');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
const p=await b.newPage({viewport:{width:1440,height:900}}),cdp=await p.context().newCDPSession(p);
await p.goto('http://127.0.0.1:5183/play/?circuit=singapore');await p.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});
await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
const frames=await p.evaluate(async()=>{const results=[],base=frame;frame=function(t){const start=performance.now();base(t);results.push({ms:performance.now()-start,textures:ren.info.memory.textures,programs:ren.info.programs.length})};newSession('qual');await new Promise(r=>setTimeout(r,18000));return results});
const cpu=(await cdp.send('Profiler.stop')).profile,nodes=new Map(cpu.nodes.map(n=>[n.id,{name:n.callFrame.functionName,line:n.callFrame.lineNumber+1,microseconds:0}]));cpu.samples.forEach((n,i)=>nodes.get(n).microseconds+=cpu.timeDeltas[i]);
const report={frames:frames.length,slowFrames:frames.filter(f=>f.ms>40),hot:[...nodes.values()].sort((a,b)=>b.microseconds-a.microseconds).slice(0,35)};fs.writeFileSync('upgrade/qa/session-entry-profile.json',JSON.stringify(report,null,2));console.log(report);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
