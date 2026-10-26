const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {PNG}=require('../node_modules/playwright-core/lib/utilsBundle.js');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
try{
 const p=await browser.newPage({viewport:{width:1440,height:810},deviceScaleFactor:1.5}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto('file:///'+path.resolve('upgrade/qa/standalone.html').replace(/\\/g,'/')+'?circuit=suzuka');
 await p.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});
 await p.evaluate(async()=>{frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));newSession('pr');state='pause';show('none');document.querySelectorAll('body>*:not(canvas):not(script):not(style)').forEach(o=>o.style.display='none');applyGraphics('high');const i=150;car.position.set(cx[i],cy[i],cz[i]);cam.position.set(cx[i]-tx[i]*8+nx[i]*2,cy[i]+2,cz[i]-tz[i]*8+nz[i]*2);cam.lookAt(car.position);cam.updateMatrixWorld();sky.position.copy(cam.position)});
 for(const [width,height] of [[1440,810],[390,844],[844,390]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(150);
  const size=await p.evaluate(()=>{resize(true);renderGame();return{width:ren.domElement.width,height:ren.domElement.height,ratio:ren.getPixelRatio(),targets:[composer.renderTarget1.width,composer.renderTarget1.height]}});
  const updated=await p.screenshot();
  await p.evaluate(()=>{const {w,h}=viewportSize(),pr=renderPixelRatio();ren.setPixelRatio(pr);ren.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();composer.setPixelRatio(pr);composer.setSize(w,h);renderGame()});
  const previous=await p.screenshot(),a=PNG.sync.read(updated),b=PNG.sync.read(previous);assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  let differentPixels=0,maxChannelDelta=0;for(let i=0;i<a.data.length;i+=4){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(a.data[i+c]-b.data[i+c]);maxChannelDelta=Math.max(maxChannelDelta,d);if(d)changed=true}if(changed)differentPixels++}
  // Repeated GPU renders can differ by a single 8-bit rounding step. Reject
  // any larger difference or a change affecting more than 0.01% of pixels.
  assert(maxChannelDelta<=1&&differentPixels/(a.width*a.height)<.0001,`Rendered image changed at ${width}x${height}: ${differentPixels} pixels, delta ${maxChannelDelta}`);
  reports.push({viewport:{width,height},...size,identicalPixels:differentPixels===0,differentPixels,maxChannelDelta});
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('upgrade/qa/resize-render-equivalence.json',JSON.stringify({passed:true,reports,errors},null,2));console.log({passed:true,reports});
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
