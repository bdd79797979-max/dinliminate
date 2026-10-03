import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baseUrl=(process.env.BASE_URL||'').replace(/\/$/,'');
assert(baseUrl,'BASE_URL is required for hosted iPhone smoke');
const release=JSON.parse(fs.readFileSync(new URL('../app-release.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:393,height:852},{width:375,height:667}]){
    const context=await browser.newContext({viewport,deviceScaleFactor:2,isMobile:true,hasTouch:true,timezoneId:'America/Chicago'});
    const page=await context.newPage();
    const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
    await page.goto(baseUrl+'/?iphone-smoke='+viewport.width+'x'+viewport.height,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(250);
    const home=await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,innerHeight,scrollHeight:document.documentElement.scrollHeight}));
    assert.equal(home.scrollWidth,home.clientWidth,'Home should not horizontally overflow');
    assert.ok(home.scrollHeight<=home.innerHeight+2,'Home should fit one viewport');
    for(const id of ['addToPhone','shareApp','menu'])assert.equal(await page.locator('#'+id).count(),1,'Missing Home control '+id);
    for(const id of ['addToPhone','shareApp']){const r=await page.locator('#'+id).boundingBox();assert.ok(r&&r.width>=44&&r.height>=44,id+' should have a 44px touch target');}
    await page.locator('#foodStart').click();await page.waitForTimeout(100);
    for(const id of ['foodBack','foodCut','foodMaybe','foodChoose','foodDetails'])assert.equal(await page.locator('#'+id).count(),1,'Missing Meal control '+id);
    for(const id of ['foodCut','foodMaybe']){const r=await page.locator('#'+id).boundingBox();assert.ok(r&&r.width>=60&&r.height>=60,id+' should remain large');}
    const foodGeom=await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,innerHeight,scrollHeight:document.documentElement.scrollHeight}));
    assert.equal(foodGeom.scrollWidth,foodGeom.clientWidth);assert.ok(foodGeom.scrollHeight<=foodGeom.innerHeight+2);
    await page.locator('#foodBackTop').click();await page.locator('#restStart').click();await page.waitForTimeout(200);
    assert.equal(await page.locator('#restaurantSearch').count(),0,'Restaurant Search must remain hidden');
    assert.equal(await page.locator('#hoursToggle').count(),0,'Open/All must remain hidden');
    const formSizes=await page.evaluate(()=>Object.fromEntries(['address','radius'].map(id=>{const e=document.getElementById(id),c=getComputedStyle(e);return[id,{fontSize:parseFloat(c.fontSize),height:e.getBoundingClientRect().height}]})));
    assert.ok(formSizes.address.fontSize>=16);assert.ok(formSizes.radius.fontSize>=16);
    const restGeom=await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth}));
    assert.equal(restGeom.scrollWidth,restGeom.clientWidth);
    const radiusOptions=await page.locator('#radius option').allTextContents();assert.deepEqual(radiusOptions,['1 mi','3 mi','5 mi','10 mi','25 mi','50 mi','100 mi']);
    for(const id of ['locate','find','radius']){const r=await page.locator('#'+id).boundingBox();assert.ok(r&&r.width>=32&&r.height>=32,id+' should remain usable');}
    assert.equal(pageErrors.length,0,'No page errors at '+viewport.width+'x'+viewport.height+': '+pageErrors.join(' | '));
    console.log(JSON.stringify({viewport,build:release.build,home:'PASS',meal:'PASS',restaurant:'PASS',hiddenRestaurantSearch:true,hiddenOpenAll:true}));
    await context.close();
  }
}finally{await browser.close();}