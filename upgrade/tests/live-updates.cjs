const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('upgrade/src/updates.js','utf8');
function setup(protocol='https:'){
 let revision='a'.repeat(64),reloads=0,requests=0,on=true;const elements={'desktop-download':{},'play-latest':{},menu:{classList:{contains:()=>on}}},events={},timers=[];
 const context={state:'menu',MP:{active:false},location:{protocol,reload:()=>reloads++},window:{MilanoReady:true,MilanoBuildId:revision},
 document:{hidden:false,getElementById:id=>elements[id],addEventListener:(name,fn)=>events[name]=fn},
 fetch:async(url,options)=>{assert.equal(url,'/api/build');assert.equal(options.cache,'no-store');assert.equal(options.credentials,'same-origin');requests++;return {ok:true,json:async()=>({build:revision})}},
 setTimeout:fn=>timers.push(fn),setInterval:fn=>timers.push(fn)};
 vm.createContext(context);vm.runInContext(code,context);
 return {context,elements,events,timers,change:v=>revision=v,menu:v=>on=v,get reloads(){return reloads},get requests(){return requests}};
}
(async()=>{
 const a=setup(),api=a.context.window.MilanoUpdates;
 assert.equal(a.elements['desktop-download'].href,'/downloads/Milano-Apex-Windows.zip');assert(a.elements['play-latest'].hidden);
 await api.check();assert.equal(a.reloads,0);
 a.change('b'.repeat(64));a.context.state='race';await api.check();assert.equal(a.reloads,0);assert(api.pending);
 for(const state of ['pause','count','qualifying']){a.context.state=state;api.apply();assert.equal(a.reloads,0)}
 a.context.state='menu';a.context.MP.active=true;api.apply();assert.equal(a.reloads,0);
 a.context.MP.active=false;a.menu(false);api.apply();assert.equal(a.reloads,0);
 a.menu(true);api.apply();assert.equal(a.reloads,1);api.apply();assert.equal(a.reloads,1);
 a.context.document.hidden=true;const n=a.requests;await api.check();assert.equal(a.requests,n);
 a.context.document.hidden=false;a.change('<invalid>');await api.check();assert.equal(a.reloads,1);
 const offline=setup('file:');assert(!offline.context.window.MilanoUpdates);assert.equal(offline.timers.length,0);assert.equal(offline.requests,0);assert(!offline.elements['play-latest'].hidden);
 assert(offline.elements['desktop-download'].href.startsWith('https://game.milanoracing.team/'));
 const report={passed:true,checks:['Hosted download','Revalidate without cache','Defer until home','No race/qualifying/pause reload','No multiplayer reload','One safe reload','No hidden-tab polling','Invalid build ignored','Offline HTML makes no update request']};
 fs.writeFileSync('upgrade/qa/live-updates.json',JSON.stringify(report,null,2));console.log(report);
})().catch(e=>{console.error(e);process.exit(1)});
