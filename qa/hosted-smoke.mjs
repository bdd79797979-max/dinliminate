import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

const base=String(process.env.BASE_URL||'').replace(/\/$/,'');
assert(base,'BASE_URL is required for hosted smoke');
const releaseExpected=JSON.parse(fs.readFileSync(new URL('../app-release.json',import.meta.url),'utf8'));

const health=await fetch(base+'/api/restaurant-search?mode=health',{cache:'no-store'});
const hText=await health.text();let h=null;try{h=JSON.parse(hText)}catch{}
assert.equal(health.ok,true,'Hosted restaurant health endpoint must return HTTP 200: '+hText.slice(0,400));
assert.equal(h?.ok,true,'Hosted restaurant health must report ok');
assert.equal(Number(h?.maxRadiusMiles),100,'Hosted restaurant API must expose 100-mile maximum');
assert.equal(String(h?.version),'r25','Hosted restaurant API must report r25');

const release=await fetch(base+'/api/release',{cache:'no-store'});
const releaseText=await release.text();let rel=null;try{rel=JSON.parse(releaseText)}catch{}
assert.equal(release.ok,true,'Hosted release endpoint must return HTTP 200: '+releaseText.slice(0,400));
assert.equal(String(rel?.build),String(releaseExpected.build),'Hosted release build must match app-release.json');
assert.equal(String(rel?.sourceBranch),String(releaseExpected.sourceBranch),'Hosted release branch must match app-release.json');

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const response=await page.goto(base+'/?hosted-smoke='+Date.now(),{waitUntil:'domcontentloaded',timeout:30000});
assert(response&&response.ok(),'Hosted app page must load successfully');
assert.match(await page.title(),/Dinliminate/);
assert.equal(await page.locator('#foodStart').isVisible(),true);
assert.equal(await page.locator('#restStart').isVisible(),true);
assert.equal(await page.locator('#addToPhone').count(),1);
assert.equal(await page.locator('#shareApp').count(),1);
assert.equal(await page.locator('#restaurantSearch').count(),0,'Restaurant Search must remain hidden');
assert.equal(await page.locator('#hoursToggle').count(),0,'Open/All must remain hidden');
const geom=await page.evaluate(()=>({clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,innerHeight,scrollHeight:document.documentElement.scrollHeight}));
assert.equal(geom.scrollWidth,geom.clientWidth);assert.ok(geom.scrollHeight<=geom.innerHeight+2);
assert.equal(errors.length,0,'Hosted page/console errors: '+errors.join(' | '));
await browser.close();
console.log(JSON.stringify({ok:true,base,build:releaseExpected.build,checkpoint:releaseExpected.checkpoint,health:h,release:rel,home:'PASS',hiddenRestaurantSearch:true,hiddenOpenAll:true}));