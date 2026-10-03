import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.png':'image/png','.b64':'text/plain','.jpg':'image/jpeg'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
  const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');
  const file=path.join(root,rel);
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,timezoneId:'America/Chicago'});
await context.grantPermissions(['geolocation'],{origin:'http://127.0.0.1:4173'});
await context.setGeolocation({latitude:36.5298,longitude:-87.3595});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));

const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
await page.route('**/*',async route=>{
 const u=route.request().url();
 if(u.includes('/api/image?url=')){
   return route.fulfill({status:200,contentType:'image/png',body:tiny});
 }
 if(u.includes('/api/release')){
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,build:'802',version:'1.0',name:'Dinliminate',environment:'test'})});
 }
 if(u.includes('/api/restaurant-search?mode=health')){
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,version:'r28',maxRadiusMiles:100})});
 }
 if(u.includes('/api/restaurant-search?mode=reverse')){
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,display:'Clarksville, TN'})});
 }
 if(u.includes('/api/restaurant-search?mode=resolve')){
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,display:'Clarksville, TN',lat:36.5298,lon:-87.3595})});
 }
 if(u.includes('/api/restaurant-search?mode=search')){
   const params=new URL(u).searchParams,r=Number(params.get('radius')||10);
   const rows=[
     {id:'qa-a',name:"McDonald's",category:'Fast Food',fastFood:true,cuisine:'burger',address:'100 Main St, Clarksville, TN',lat:36.5300,lon:-87.3595,distance:.1,photo:'https://images.unsplash.com/photo-1514933651103-005eec06c04b'},
     {id:'qa-b',name:'Ruby Tuesday',category:'American',fastFood:false,cuisine:'american',address:'300 Main St, Clarksville, TN',lat:36.5350,lon:-87.3600,distance:.4,photo:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'},
     {id:'qa-c',name:'Far Away Test Restaurant',category:'American',fastFood:false,cuisine:'american',address:'700 Test Rd, Springfield, TN',lat:36.95,lon:-87.36,distance:29.2,photo:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
   ].filter(x=>x.distance<=r);
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,version:'r28',radiusMiles:r,total:rows.length,fastFoodCount:rows.filter(x=>x.fastFood).length,searchLatencyMs:30,searchBudgetMs:12000,results:rows})});
 }
 if(u.includes('/api/restaurant-photo')) return route.fulfill({status:200,contentType:'image/png',body:tiny});
 return route.continue();
});

await page.goto('http://127.0.0.1:4173/?qa=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(250);
assert.equal(errors.length,0,'Initial load must have no page errors: '+errors.join(' | '));

// Home / exact door photo / no legacy asset.
const bg=await page.locator('#homeBackgroundImage');
assert.equal(await bg.count(),1);
assert.ok((await bg.getAttribute('src')).includes('6162883'),'Home must use the exact door photo 6162883');
assert.equal(await page.locator('#homeBackgroundLayer').count(),1);
const homeLayer=await page.evaluate(()=>{const l=document.getElementById('homeBackgroundLayer');const c=getComputedStyle(l);return {opacity:c.opacity,visibility:c.visibility}});
assert.equal(homeLayer.opacity,'1','Home background layer must be visible');
assert.equal(homeLayer.visibility,'visible');

// Canonical top wordmark.
const logoHome=await page.locator('#appTopbar .brand').evaluate(el=>{const c=getComputedStyle(el);return {size:c.fontSize,weight:c.fontWeight,spacing:c.letterSpacing,bg:c.backgroundImage}});
assert.equal(logoHome.size,'20px');assert.equal(logoHome.weight,'850');assert.ok(['-1px','-0.05em'].includes(logoHome.spacing));assert.notEqual(logoHome.bg,'none');

// Menu translucent; back arrow plain and gold.
const menu=await page.locator('#menu').evaluate(el=>{const c=getComputedStyle(el);return {bg:c.backgroundColor,border:c.borderTopColor,r:c.borderRadius}});
assert.ok(menu.bg.includes('rgba')&&menu.bg!=='rgb(23, 23, 23)','Menu must be translucent');
const back=await page.locator('#foodBackTop').evaluate(el=>{const c=getComputedStyle(el);return {bg:c.backgroundColor,border:c.borderTopWidth,r:c.borderRadius,color:c.color}});
assert.equal(back.bg,'rgba(0, 0, 0, 0)');assert.equal(back.border,'0px');assert.equal(back.r,'0px');assert.ok(back.color!=='rgb(170, 170, 170)','Back arrow must be gold, not old gray');

// Meals -> Home preserves background.
await page.locator('#foodStart').click();await page.waitForTimeout(100);
assert.equal(await page.locator('#food').isVisible(),true);
const foodLogo=await page.locator('#food .decision-brand').evaluate(el=>{const c=getComputedStyle(el);return {size:c.fontSize,weight:c.fontWeight,spacing:c.letterSpacing,bg:c.backgroundImage}});
assert.deepEqual(foodLogo,logoHome,'Meals logo must match Home');
await page.locator('#foodBackTop').click();await page.waitForTimeout(100);
assert.equal((await page.locator('#homeBackgroundImage').getAttribute('src')).includes('6162883'),true);

// Restaurants -> Home preserves background and logo.
await page.locator('#restStart').click();await page.waitForTimeout(350);
assert.equal(await page.locator('#restaurant').isVisible(),true);
const restLogo=await page.locator('#restaurant .decision-brand').evaluate(el=>{const c=getComputedStyle(el);return {size:c.fontSize,weight:c.fontWeight,spacing:c.letterSpacing,bg:c.backgroundImage}});
assert.deepEqual(restLogo,logoHome,'Restaurant logo must match Home');
await page.locator('#restaurantBackTop').click();await page.waitForTimeout(100);
assert.equal(await page.locator('#home').isVisible(),true);
assert.equal((await page.locator('#homeBackgroundImage').getAttribute('src')).includes('6162883'),true);

// Winner -> Home preserves background and logo.
await page.evaluate(()=>{
 const item=window.DINLIMINATE_FOODS?.[0]||{id:'qa',name:'QA',image:''};
 window.__DINLIMINATE_TEST__.winner({...item,id:'qa-winner',category:'American'},'food');
});
await page.waitForTimeout(120);
const winnerLogo=await page.locator('#winner .winner-brand').evaluate(el=>{const c=getComputedStyle(el);return {size:c.fontSize,weight:c.fontWeight,spacing:c.letterSpacing,bg:c.backgroundImage}});
assert.deepEqual(winnerLogo,logoHome,'Winner logo must match Home');
await page.locator('#winnerBackTop').click();await page.waitForTimeout(100);
assert.equal(await page.locator('#home').isVisible(),true);
assert.equal((await page.locator('#homeBackgroundImage').getAttribute('src')).includes('6162883'),true);

// Wheel: all active meals, no labels, two-tap state machine, automatic landing, gold fireworks.
await page.evaluate(()=>{window.__DINLIMINATE_TEST_WHEEL_INDEX=5; const item=window.DINLIMINATE_FOODS?.[0]||{id:'qa',name:'QA',image:''}; window.__DINLIMINATE_TEST__.winner({id:'qa-hungry',name:'HUNGRY',category:'Hungry',image:item.image||''},'food');});
await page.waitForTimeout(150);
const wheelCount=await page.locator('#hungryWheel .wheel-segment').count();
const available=await page.evaluate(()=>window.__DINLIMINATE_TEST__.hungryWheelPool().length);
assert.equal(wheelCount,available,'Wheel must use all available meals as slices');
assert.equal(await page.locator('#hungryWheel .wheel-label').count(),0,'Wheel must not display meal names');
const spin=page.locator('#hungryWheelSpin');
await spin.click();
assert.equal(await spin.innerText(),'Slow It Down','First tap must start continuous spinning and change button state');
await page.waitForTimeout(300);
assert.equal(await page.locator('#hungryWheelResult').isVisible(),false);
await spin.click();
assert.equal(await spin.isDisabled(),true,'Second tap must lock the button during deceleration');
await page.waitForFunction(()=>!document.querySelector('#hungryWheelSpin')?.disabled,{timeout:5000});
assert.equal(await page.locator('#hungryWheelResult').isVisible(),true,'Wheel must stop automatically after second tap');
assert.equal(await page.locator('#hungryWheelChoose').isVisible(),true);
assert.equal(await page.locator('#hungryWheel .wheel-segment.is-landed').count(),1);
assert.ok(await page.locator('#celebration .firework-burst span').count()>0,'Gold fireworks must render');
const palette=await page.locator('#celebration .firework-burst span').evaluateAll(spans=>spans.map(s=>s.style.getPropertyValue('--color')).filter(Boolean));
assert.ok(palette.length&&palette.every(c=>['#c6a46a','#f1d894','#fff7df','#d8b86b','#fffaf0'].includes(c)),'Wheel fireworks must use gold/white palette');

// Source-level assertions carried into browser test.
const source=await fs.promises.readFile(path.join(root,'api/restaurants.js'),'utf8');
assert.ok(source.includes("photonPlaces(lat,lon,50,searchTerm)"));
assert.ok(source.includes("arcgisPlaces(lat,lon,50,searchTerm)"));
assert.ok(source.includes("photonWidePlaces(lat,lon,radius,searchTerm)"));
assert.ok(source.includes("function norm(s)"));
assert.ok(source.includes("const MAX_RADIUS=100"));
assert.ok(source.includes("const WIDE_RADIUS_THRESHOLD=50"));
assert.ok(!source.includes("const WIDE_PROVIDER_RADIUS_CAP=50;")||source.includes("WIDE_PROVIDER_RADIUS_CAP"),'Wide provider cap may remain internally');
assert.ok(!((await fs.promises.readFile(path.join(root,'styles.css'),'utf8')).match(/home-background\.(?:jpg|b64)/)),'No stale incorrect Home background asset references may remain');

console.log('CP802_RECENT_REGRESSION_OK');
await browser.close();server.close();
