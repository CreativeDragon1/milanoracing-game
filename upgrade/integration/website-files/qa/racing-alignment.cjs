const {chromium}=require('@playwright/test'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']});
 const report={scope:'Production-built private page layout; lightweight iframe fixture isolates parent layout from the game GPU renderer.',widths:[]};
 try{
  const page=await browser.newPage();
  await page.route('**/play/**',route=>route.fulfill({contentType:'text/html',body:'<body style="background:#0b111e"><script>addEventListener("message",e=>{if(e.data?.type==="milano:hello")parent.postMessage({type:"milano:ready"},location.origin)})</script>'}));
  for(const [width,height] of [[320,568],[390,844],[560,800],[561,800],[694,900],[768,1024],[1024,768],[1440,900],[1920,1080]]){
   await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5183/racing');await page.locator('.racing-play').waitFor();await page.evaluate(()=>document.fonts.ready);
   const launcher=await page.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};return{heading:r('.racing-heading'),console:r('.racing-console'),main:r('main'),padding:parseFloat(getComputedStyle(document.querySelector('main')).paddingLeft),overflow:document.documentElement.scrollWidth>innerWidth}});
   assert(!launcher.overflow);assert(Math.abs(launcher.console.x-launcher.heading.x)<1);assert(Math.abs(launcher.console.x-launcher.main.x-launcher.padding)<1,'Double padding at '+width);
   await page.getByRole('button',{name:'Play now'}).click();await page.getByText('Garage ready').waitFor();
   const playing=await page.evaluate(()=>{const b=document.querySelector('.racing-console').getBoundingClientRect(),f=document.querySelector('iframe').getBoundingClientRect(),h=document.querySelector('.header').getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height,frameHeight:f.height,headerBottom:h.bottom,overflow:document.documentElement.scrollWidth>innerWidth}});
   assert(!playing.overflow);assert(playing.frameHeight>260);assert(playing.bottom<=height+1,`Game bottom outside viewport: ${width} ${JSON.stringify(playing)}`);
   if(width<=760){assert(Math.abs(playing.y)<1);assert(Math.abs(playing.height-height)<1)}else assert(playing.y>=playing.headerBottom+10&&playing.y<=playing.headerBottom+14,'Sticky header clearance');
   if(width===1440)await page.screenshot({path:'qa/racing-alignment-desktop.png'});
   if(width===390)await page.screenshot({path:'qa/racing-alignment-phone.png'});
   await page.getByRole('button',{name:'Exit game',exact:true}).click();assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
   report.widths.push({width,height,launcher,playing});
  }
  report.passed=true;
 }finally{fs.writeFileSync('qa/racing-alignment.json',JSON.stringify(report,null,2));await browser.close()}
 console.log({passed:report.passed,widths:report.widths.length});
})().catch(e=>{console.error(e);process.exit(1)});
