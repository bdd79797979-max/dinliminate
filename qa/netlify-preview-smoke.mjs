import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baseUrl=(process.env.BASE_URL||'').replace(/\/$/,'');
assert(baseUrl,'BASE_URL is required for Netlify smoke');
const expected=JSON.parse(fs.readFileSync(new URL('../app-release.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,timezoneId:'America/Chicago'});
const pageErrors=[],consoleErrors=[],critical=[];
page.on('pageerror',e=>pageErrors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('response',res=>{if(res.status()>=400){const u=new URL(res.url());if(u.origin===new URL(baseUrl).origin)critical.push(res.status()+' '+res.url())}});
try{
 await page.goto(baseUrl+'/?launch-smoke='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(400);
 assert.equal(await page.locator('#home').isVisible(),true);
 assert.equal(await page.locator('#foodStart').count(),1);
 assert.equal(await page.locator('#restStart').count(),1);
 assert.equal(await page.locator('#addToPhone').count(),1);
 assert.equal(await page.locator('#shareApp').count(),1);
 assert.equal(await page.locator('#restaurantSearch').count(),0);
 assert.equal(await page.locator('#hoursToggle').count(),0);
 const rel=await page.evaluate(async()=>({local:await fetch('./app-release.json?launch='+Date.now(),{cache:'no-store'}).then(r=>r.json()),runtime:await fetch('./api/release?launch='+Date.now(),{cache:'no-store'}).then(r=>r.json()),health:await fetch('./api/restaurant-search?mode=health&launch='+Date.now(),{cache:'no-store'}).then(r=>r.json())}));
 assert.equal(String(rel.local.build),String(expected.build));
 assert.equal(String(rel.runtime.build),String(expected.build));
 assert.equal(String(rel.runtime.sourceBranch),String(expected.sourceBranch));
 assert.equal(String(rel.health.version),'r25');
 assert.equal(Number(rel.health.maxRadiusMiles),100);
 const home=await page.evaluate(()=>({horizontal:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,vertical:document.documentElement.scrollHeight>innerHeight+2}));
 assert.equal(home.horizontal,false);assert.equal(home.vertical,false);
 console.log(JSON.stringify({ok:true,baseUrl,build:expected.build,checkpoint:expected.checkpoint,release:rel,home:'PASS',hiddenRestaurantSearch:true,hiddenOpenAll:true}));
}finally{await browser.close();}
assert.equal(pageErrors.length,0,'Netlify page errors: '+pageErrors.join(' | '));
assert.equal(consoleErrors.length,0,'Netlify console errors: '+consoleErrors.join(' | '));
assert.equal(critical.length,0,'Netlify critical HTTP errors: '+critical.join(' | '));