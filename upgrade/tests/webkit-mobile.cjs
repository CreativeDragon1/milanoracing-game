process.env.PLAYWRIGHT_BROWSERS_PATH=require('path').resolve('work/playwright-browsers');
const {webkit}=require('playwright'),fs=require('fs'),assert=require('assert');
fs.copyFileSync('upgrade/server/public/index.html','upgrade/qa/mobile.html');
(async()=>{const browser=await webkit.launch({headless:true}),reports=[];let passed=false;try{for(const id of['singapore','milano']){
 const context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true,userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8878/mobile.html?circuit='+id,{timeout:180000});await page.waitForFunction(()=>window.MilanoReady===true,null,{timeout:180000});
 const stats=await page.evaluate(()=>({id:CIRCUIT.id,mobile:device.mobile,webgl2:ren.capabilities.isWebGL2,assets:sceneAssetErrors,renderer:ren.getContext().getParameter(ren.getContext().RENDERER)}));assert.equal(stats.id,id);assert(stats.mobile);assert.equal(stats.assets.length,0);
 await page.locator('#menu .home-drive').tap();await page.locator('[data-go="pr"]').tap();await page.locator('#go').tap();await page.waitForFunction(()=>state==='race',null,{timeout:60000});
 assert.equal(await page.evaluate(()=>state),'race');
 await page.locator('#touch-camera').tap();await page.locator('#touch-pause').tap();assert.equal(await page.evaluate(()=>state),'pause');
 await page.screenshot({path:`upgrade/qa/webkit-${id}.png`});assert.equal(errors.length,0,errors.join('\n'));reports.push(stats);await context.close();console.log('WebKit',id,'passed');
}passed=true;}finally{await browser.close();fs.writeFileSync('upgrade/qa/webkit-mobile.json',JSON.stringify({passed,reports,scope:'Desktop WebKit compatibility and touch taps; not a physical iOS device.'},null,2));}})().catch(e=>{console.error(e);process.exit(1)});
