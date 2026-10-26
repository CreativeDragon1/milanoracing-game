const {chromium}=require('playwright'),fs=require('fs'),assert=require('assert'),crypto=require('crypto');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync('upgrade/assets/livery/manifest.json'));
 const designer=fs.readFileSync('upgrade/assets/livery/designer-uv.bin');
 const original=JSON.parse(fs.readFileSync('upgrade/vendor/work/stem-car.json','utf8'));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+require('path').resolve('upgrade/qa/standalone.html').replace(/\\/g,'/')+'?circuit=singapore');await page.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});
  assert.equal(await page.locator('.home-tagline').textContent(),'Always the Fastest');
  const current=await page.evaluate(()=>stemAsset),changes={};
  for(const part of original.parts){
   const before=Buffer.from(part.data,'base64'),after=Buffer.from(current.parts.find(p=>p.name===part.name).data,'base64');assert.equal(before.length,after.length);
   let changed=0;
   for(let offset=0;offset<before.length;offset+=32){
    assert(before.subarray(offset,offset+24).equals(after.subarray(offset,offset+24)),'position and normal unchanged');
    if(!before.subarray(offset+24,offset+32).equals(after.subarray(offset+24,offset+32))){
     changed++;assert.equal(part.name,'body');
    }
   }changes[part.name]=changed;
  }
  assert.equal(changes.body,original.parts[0].count);assert.equal(current.liveryRevision,manifest.revision);
  const renderedAtlas=await page.evaluate(async()=>{await atlas.image.decode();return atlas.image.src.split(',')[1]});
  assert.equal(crypto.createHash('sha256').update(Buffer.from(renderedAtlas,'base64')).digest('hex'),manifest.artworkSHA256,'Rendered body must use the current supplied artwork');
  const body=Buffer.from(current.parts[0].data,'base64');let neutral=0;for(let i=0;i<current.parts[0].count;i++){const U=body.readFloatLE(i*32+24),V=body.readFloatLE(i*32+28);if(U===2800.5/4096&&V===1-900.5/4096){neutral++;assert(body.readFloatLE(i*32+8)*body.readFloatLE(i*32+20)<0);}else assert(body.subarray(i*32+24,i*32+32).equals(designer.subarray(i*8,i*8+8)),'exact designer UV correspondence');}assert.equal(neutral,72);for(const [part,n]of Object.entries(changes))if(part!=='body')assert.equal(n,0);
  await page.screenshot({path:'upgrade/qa/showroom-desktop.png'});
  await page.evaluate(()=>{frame=()=>{};document.querySelectorAll('.ov,#controller-dock,#scene-loading').forEach(e=>e.style.display='none')});
  for(const [view,position] of [['front',[5,3,-5]],['rear',[-5,2.5,5]],['top',[1,8,.5]]]){
   await page.evaluate(position=>{const camera=showroom.camera;camera.clearViewOffset();camera.fov=48;camera.aspect=1440/900;camera.position.set(...position);camera.lookAt(0,.35,0);camera.updateProjectionMatrix();ren.toneMappingExposure=1.02;ren.shadowMap.needsUpdate=true;ren.render(showroom.scene,camera)},position);
   await page.screenshot({path:`upgrade/qa/livery-${view}.png`});
  }
  for(const side of[-1,1]){
   await page.evaluate(side=>{const camera=showroom.camera;camera.clearViewOffset();camera.fov=55;camera.aspect=1440/900;camera.position.set(.55,1.1,side*-.3);camera.lookAt(-.1,.24,side*.45);camera.updateProjectionMatrix();ren.toneMappingExposure=1.02;ren.shadowMap.needsUpdate=true;ren.render(showroom.scene,camera)},side);
   await page.screenshot({path:`upgrade/qa/inner-sidepod-${side<0?'left':'right'}.png`});
  }
  assert.equal(errors.length,0,errors.join('\n'));
  const report={passed:true,revision:manifest.revision,artwork:manifest.artworkFile,changedUVVertices:changes,unchanged:'all positions, normals and wheels; body uses matching Designer_Livery_UV',atlasSHA256:crypto.createHash('sha256').update(fs.readFileSync('upgrade/assets/livery/'+manifest.artworkFile)).digest('hex'),tagline:'Always the Fastest',errors};
  fs.writeFileSync('upgrade/qa/livery.json',JSON.stringify(report,null,2));console.log(report);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
