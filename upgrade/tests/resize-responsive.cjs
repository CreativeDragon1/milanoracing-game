const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const device=fs.readFileSync('upgrade/src/device.js','utf8'),loop=fs.readFileSync('upgrade/src/loop.js','utf8');
let width=1440,height=810,reads=0,resizes=0,projections=0,fx=0,drawing,timeout;
const events={};
const context={state:'race',devicePixelRatio:1.5,graphicsPreset:'high',S:{q:0},device:{mobile:false},
 document:{documentElement:{get clientWidth(){reads++;return width}}},innerWidth:width,innerHeight:height,
 window:{visualViewport:{get height(){reads++;return height},addEventListener:(name,fn)=>events['visual-'+name]=fn}},
 ren:{setDrawingBufferSize:(w,h,ratio)=>{resizes++;drawing={w,h,ratio}},shadowMap:{}},
 cam:{updateProjectionMatrix:()=>projections++},resizeFX:()=>fx++,
 addEventListener:(name,fn)=>events[name]=fn,setTimeout:fn=>timeout=fn,clearTimeout:()=>{timeout=null}};
vm.createContext(context);vm.runInContext(device.slice(device.indexOf('function viewportSize')),context);
vm.runInContext(loop.slice(0,loop.indexOf('const cp=')),context);
assert.deepEqual(drawing,{w:1440,h:810,ratio:1.5});
const initialReads=reads;
for(let i=0;i<1200;i++)context.resize();
assert.equal(reads,initialReads,'Steady driving must not read viewport layout');assert.equal(resizes,1);
width=810;height=1440;events.resize();context.resize();
assert.deepEqual(drawing,{w:810,h:1440,ratio:1.5});assert.equal(resizes,2);
timeout();assert.equal(resizes,2,'Debounced event must not duplicate the render-buffer resize');
height=1200;events['visual-resize']();timeout();assert.equal(drawing.h,1200);
context.S.q=1;context.resize();assert.equal(drawing.ratio,1);assert.equal(context.ren.shadowMap.enabled,false);
context.S.q=0;context.graphicsPreset='ultra';context.devicePixelRatio=2;context.resize();assert.equal(drawing.ratio,1.75);
context.state='menu';context.resize();assert.equal(drawing.ratio,Math.sqrt(3200000/(width*height)));
context.device.mobile=true;context.state='race';context.resize();assert.equal(drawing.ratio,Math.sqrt(1800000/(width*height)));
const n=resizes;context.resize(true);assert.equal(resizes,n+1,'Context restoration must recreate render targets');
assert.equal(projections,resizes);assert.equal(fx,resizes);
console.log({passed:true,unchangedFrames:1200,viewportReadsDuringUnchangedFrames:0,checks:['Rotation','Visual viewport resize','DPR change','Menu and race resolution','Quality switch','Context restoration','No duplicate debounced resize']});
