const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert'),{pathToFileURL}=require('url');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];try{
 const page=await browser.newPage({viewport:{width:1440,height:810}});const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,600))});await page.route(/^https?:/,r=>{external.push(r.request().url());return r.abort()});
 for(const id of Object.keys(JSON.parse(fs.readFileSync('upgrade/src/world-tour-data.json')))){
  await page.goto(pathToFileURL(path.resolve('upgrade/qa/standalone.html')).href+'?circuit='+id);await page.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});
  await page.evaluate(()=>{newSession('pr');race.cd=0;state='race';show('none')});await page.keyboard.down('ArrowUp');await page.waitForTimeout(700);await page.keyboard.up('ArrowUp');
  const info=await page.evaluate(()=>({id:CIRCUIT.id,speed:c.vx,assets:sceneAssetErrors,terrain:!!scene.getObjectByName('Circuit terrain'),shaders:MilanoShaderPreparation,unlinkedPrograms:ren.info.programs.filter(p=>!ren.getContext().getProgramParameter(p.program,ren.getContext().LINK_STATUS)).length}));assert(info.id===id&&info.speed>2&&info.terrain&&!info.assets.length&&info.unlinkedPrograms===0);assert(!errors.length&&!external.length,errors.join('\n'));reports.push(info);console.log(id,'offline loaded and accelerated; shaders linked',info.shaders.programs);
 }
 fs.writeFileSync('upgrade/qa/offline-all.json',JSON.stringify({fileSHA256:require('node:crypto').createHash('sha256').update(fs.readFileSync('upgrade/qa/standalone.html')).digest('hex'),reports,errors,externalRequests:external},null,2));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
