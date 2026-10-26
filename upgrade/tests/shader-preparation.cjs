const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const {PNG}=require('../node_modules/playwright-core/lib/utilsBundle.js');
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true}),reports=[],images=[];
try{for(const variant of ['prepared','reference','fallback']){
 const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text().slice(0,500))});
 await p.addInitScript(fallback=>{let seed=1234567;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};if(fallback)for(const cls of [WebGLRenderingContext,WebGL2RenderingContext]){const original=cls.prototype.getExtension;cls.prototype.getExtension=function(name){return name==='KHR_parallel_shader_compile'?null:original.call(this,name)}}},variant==='fallback');
 if(variant==='reference')await p.route('**/assets/*.js',async route=>{const response=await route.fetch(),text=await response.text();await route.fulfill({response,body:text.replace('await prepareCircuitGraphics();window.MilanoReady=true','window.MilanoReady=true')})});
 const start=performance.now();await p.goto('http://127.0.0.1:5183/play/?circuit=singapore');await p.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});const readyMs=performance.now()-start;
 const data=await p.evaluate(async()=>{frame=()=>{};await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));state='pause';show('none');document.querySelectorAll('body>*:not(canvas):not(script):not(style)').forEach(o=>o.style.display='none');applyGraphics('high');windTime.value=0;const i=150;car.position.set(cx[i],cy[i]+.025,cz[i]);car.rotation.set(0,0,0);cam.position.set(cx[i]-tx[i]*8+nx[i]*2,cy[i]+2,cz[i]-tz[i]*8+nz[i]*2);cam.lookAt(car.position);cam.updateMatrixWorld();sky.position.copy(cam.position);const start=performance.now();renderGame();const firstDrawMs=performance.now()-start,gl=ren.getContext();return{firstDrawMs,preparation:window.MilanoShaderPreparation,unlinked:ren.info.programs.filter(p=>!gl.getProgramParameter(p.program,gl.LINK_STATUS)).length,shaderDiagnostics:ren.debug.checkShaderErrors}});
 assert.equal(data.unlinked,0);assert.equal(data.shaderDiagnostics,true);assert.deepEqual(errors,[]);if(variant==='prepared')assert.equal(data.preparation.parallel,true);if(variant==='fallback')assert.equal(data.preparation.parallel,false);
  const image=await p.screenshot();fs.writeFileSync('upgrade/qa/shader-'+variant+'.png',image);images.push(PNG.sync.read(image));
  if(variant==='prepared'){
   data.linkFailureRejected=await p.evaluate(async()=>{const testScene=new T.Scene(),material=new T.ShaderMaterial({vertexShader:'void main(){gl_Position=vec4(position,1.);}',fragmentShader:'void main(){this_is_an_intentional_test_error;}'}),geometry=new T.PlaneGeometry(1,1);testScene.add(new T.Mesh(geometry,material));try{ren.compilePending(testScene,cam);await prepareCircuitGraphics();return false}catch(e){return /Circuit shader failed/.test(e.message)}finally{material.dispose();geometry.dispose()}});
   assert.equal(data.linkFailureRejected,true,'Shader preparation must reject a broken shader rather than suppress it');
  }
  reports.push({variant,readyMs,...data,errors});await p.close();
 }
 let differentPixels=0,maxDelta=0;const a=images[0].data,c=images[1].data;for(let i=0;i<a.length;i+=4){let changed=false;for(let j=0;j<3;j++){const d=Math.abs(a[i+j]-c[i+j]);maxDelta=Math.max(maxDelta,d);changed||=d>0}if(changed)differentPixels++}
 assert(maxDelta<=1&&differentPixels/(images[0].width*images[0].height)<.0001,`Shader warmup changed pixels: ${differentPixels}, delta ${maxDelta}`);
 fs.writeFileSync('upgrade/qa/shader-preparation.json',JSON.stringify({passed:true,fileSHA256:require('node:crypto').createHash('sha256').update(fs.readFileSync('upgrade/qa/standalone.html')).digest('hex'),reports,differentPixels,maxDelta,scope:'Same seeded circuit and fixed camera with preparation enabled versus disabled; fallback tested with the extension withheld.'},null,2));console.log({passed:true,reports,differentPixels,maxDelta});
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
