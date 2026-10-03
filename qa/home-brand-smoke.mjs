import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.png':'image/png','.b64':'text/plain'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
  const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');
  const file=path.join(root,rel);
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:4173/?qa=1',{waitUntil:'domcontentloaded'});
await page.waitForLoadState('networkidle').catch(()=>{});
assert.equal(errors.length,0,'Home must load without page errors: '+errors.join(' | '));

async function homeState(label){
 const d=await page.evaluate(()=>{
   const app=document.querySelector('.app');
   const home=document.getElementById('home');
   const logo=document.querySelector('.app-topbar .brand');
   const r=app.getBoundingClientRect();
   const cs=getComputedStyle(app), lc=getComputedStyle(logo);
   return {
     label:home?.className||'',
     homeActive:app?.classList.contains('home-active'),
     bg:cs.backgroundImage,
     appWidth:r.width,appHeight:r.height,
     logoSize:lc.fontSize,logoWeight:lc.fontWeight,logoSpacing:lc.letterSpacing,
     logoBg:lc.backgroundImage
   };
 });
 assert.equal(d.homeActive,true,label+': app must be home-active');
 assert.ok(d.bg.includes('home-background.jpg'),label+': Home background must use the bundled local JPEG');
 assert.ok(d.bg.includes('linear-gradient'),label+': Home background must retain premium overlay');
 assert.ok(d.appHeight>=852-2,label+': Home shell must cover viewport');
 return d;
}

const home1=await homeState('Initial Home');
const logo1=home1;
assert.equal(logo1.logoSize,'20px');
assert.equal(logo1.logoWeight,'850');
assert.notEqual(logo1.logoBg,'none');

await page.locator('#foodStart').click();
await page.waitForTimeout(120);
assert.equal(await page.locator('#food').isVisible(),true);
const foodLogo=await page.locator('#food .decision-brand').evaluate(el=>{
 const c=getComputedStyle(el); return {size:c.fontSize,weight:c.fontWeight,spacing:c.letterSpacing,bg:c.backgroundImage};
});
assert.equal(foodLogo.size,'20px','Meals logo must match Home size');
assert.equal(foodLogo.weight,'850','Meals logo must match Home weight');
assert.equal(foodLogo.bg,logo1.logoBg,'Meals logo must match Home gradient');
const effectiveSpacing = (v,size) => String(v).endsWith('em') ? parseFloat(v)*parseFloat(size) : parseFloat(v);
assert.ok(Math.abs(effectiveSpacing(foodLogo.spacing,foodLogo.size)-effectiveSpacing(logo1.logoSpacing,logo1.logoSize))<0.01,'Meals logo letter spacing must visually match Home');

await page.locator('#foodBackTop').click();
await page.waitForTimeout(120);
const home2=await homeState('After Meals return');
assert.equal(home2.bg,home1.bg,'Home background must be identical after returning from Meals');

await page.locator('#restStart').click();
await page.waitForTimeout(200);
assert.equal(await page.locator('#restaurant').isVisible(),true);
const restLogo=await page.locator('#restaurant .decision-brand').evaluate(el=>{
 const c=getComputedStyle(el); return {size:c.fontSize,weight:c.fontWeight,spacing:c.letterSpacing,bg:c.backgroundImage};
});
assert.deepEqual(restLogo,foodLogo,'Restaurants logo must match Meals logo');

await page.locator('#restaurantBackTop').click();
await page.waitForTimeout(120);
await homeState('After Restaurants return');

await page.evaluate(()=>{
 const item=window.DINLIMINATE_FOODS?.[0]||{id:'qa',name:'QA',image:''};
 window.__DINLIMINATE_TEST__.winner({id:'qa-winner',name:item.name||'QA Winner',image:item.image||''},'food');
});
await page.waitForTimeout(120);
const winnerLogo=await page.locator('#winner .winner-brand').evaluate(el=>{
 const c=getComputedStyle(el); return {size:c.fontSize,weight:c.fontWeight,spacing:c.letterSpacing,bg:c.backgroundImage};
});
assert.deepEqual(winnerLogo,foodLogo,'Winner logo must match Meals logo');

await page.locator('#winnerBackTop').click();
await page.waitForTimeout(120);
await homeState('After Winner return');

assert.equal(await page.locator('#home h1').innerText(),'Dinner Decisions Simplified');
assert.equal(await page.locator('#home .sub').innerText(),'Swipe. Dinliminate. Enjoy.');

console.log('CP801_HOME_BRAND_SMOKE_OK');
await browser.close();
server.close();
