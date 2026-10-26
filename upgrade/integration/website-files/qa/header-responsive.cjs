const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const report={widths:[],passed:false};
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:5183/racing');
  for(const width of [320,390,560,561,694,768,850,980,1001,1080,1081,1440]){
   await page.setViewportSize({width,height:900});
   const desktop=width>560;
   if(desktop){await expect(page.locator('.desktop-nav')).toBeVisible();await expect(page.getByRole('button',{name:'Open navigation',exact:true})).toBeHidden();}
   else{await expect(page.locator('.desktop-nav')).toBeHidden();await expect(page.getByRole('button',{name:'Open navigation',exact:true})).toBeVisible();}
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow at '+width);
   if(desktop){
    assert.equal(await page.locator('.desktop-nav a').count(),6);
    assert(await page.locator('.desktop-nav a').evaluateAll(links=>links.every(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0;})));
   }
   report.widths.push(width);
  }
  await page.setViewportSize({width:694,height:900});await page.screenshot({path:'qa/header-compact-desktop.png'});await page.locator('.header').screenshot({path:'qa/header-restored.png'});
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  await expect(page.getByRole('navigation',{name:'Mobile navigation'}).getByRole('link',{name:'Race',exact:true})).toBeVisible();
  assert.equal(await page.locator('#mobile-nav a').count(),6);
  await page.screenshot({path:'qa/header-phone-open.png'});report.passed=true;
 }finally{fs.writeFileSync('qa/header-responsive.json',JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
