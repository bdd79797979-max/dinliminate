import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const releaseMeta=JSON.parse(fs.readFileSync(path.join(root,'app-release.json'),'utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.png':'image/png'};
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
await context.setGeolocation({latitude:36.5304,longitude:-87.3601});
const page=await context.newPage();
const errors=[],consoleErrors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error'&&!/404 \(Not Found\)/i.test(m.text()))consoleErrors.push(m.text());});

const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
await page.route('**/*',async route=>{
  const u=route.request().url();
  if(u.includes('/api/release')){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,name:releaseMeta.name,version:releaseMeta.version,build:String(releaseMeta.build),sourceBranch:releaseMeta.sourceBranch,expectedBranch:releaseMeta.sourceBranch,environment:'test'})});
  }
  if(u.includes('/api/restaurant-search?mode=health')){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,version:'r27',maxRadiusMiles:100})});
  }
  if(u.includes('/api/restaurant-search?mode=reverse')){
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,display:'Clarksville, TN'})});
  }
  if(u.includes('/api/restaurant-search?mode=search')){
    const rows=[
      {id:'qa-restaurant-1',name:"McDonald's",category:'Fast Food',fastFood:true,cuisine:'burger',address:'100 Main St, Clarksville, TN',lat:36.5305,lon:-87.3600,distance:0.1,website:'https://www.mcdonalds.com',opening_hours:'24/7',openNow:true,photo:'https://images.unsplash.com/photo-1514933651103-005eec06c04b'},
      {id:'qa-restaurant-2',name:'Thirsty Goat',category:'Pizza',fastFood:false,cuisine:'pizza',address:'200 Main St, Clarksville, TN',lat:36.5320,lon:-87.3590,distance:0.2,website:'',opening_hours:'',openNow:true,photo:'https://images.unsplash.com/photo-1579684947550-22e945225d9a'},
      {id:'qa-restaurant-3',name:'Ruby Tuesday',category:'American',fastFood:false,cuisine:'american',address:'300 Main St, Clarksville, TN',lat:36.5350,lon:-87.3600,distance:0.4,website:'',opening_hours:'24/7',openNow:true,photo:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4'}
    ];
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,version:'r27',radiusMiles:10,total:rows.length,fastFoodCount:1,timezone:'America/Chicago',results:rows})});
  }
  if(u.includes('/api/restaurant-photo')){
    return route.fulfill({status:200,contentType:'image/png',body:tiny});
  }
  if(u.includes('/api/image?url=')||u.startsWith('https://images.unsplash.com/')||u.startsWith('https://images.pexels.com/')){
    return route.fulfill({status:200,contentType:'image/png',body:tiny});
  }
  return route.continue();
});

await page.goto('http://127.0.0.1:4173/?qa=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(150);
assert.equal(await page.locator('#home h1').innerText(),'Meal Decisions Simplified');
assert.equal(await page.locator('#foodStart strong').innerText(),'DINNER IN');
assert.equal(await page.locator('#foodStart .home-card-copy>span').innerText(),'Tonight’s meal awaits.');
assert.equal(await page.locator('#restStart strong').innerText(),'DINNER OUT');
assert.equal(await page.locator('#restStart .home-card-copy>span').innerText(),'Your table awaits');
assert.equal(await page.locator('#home').locator('text=DINE IN').count(),0);
assert.equal(await page.locator('#home').locator('text=DINE OUT').count(),0);
const homeLuxury=await page.evaluate(()=>{
 const root=getComputedStyle(document.querySelector('.app:has(#home:not(.hidden))'));
 const logo=getComputedStyle(document.querySelector('.app:has(#home:not(.hidden)) .app-topbar .brand'));
 const eyebrow=getComputedStyle(document.querySelector('.app:has(#home:not(.hidden)) #home .home-intro .eyebrow'));
 const headline=getComputedStyle(document.querySelector('.app:has(#home:not(.hidden)) #home .home-intro h1'));
 const card=getComputedStyle(document.querySelector('.app:has(#home:not(.hidden)) #home .home-card-photo'));
 const arrow=getComputedStyle(document.querySelector('.app:has(#home:not(.hidden)) #home .home-card-photo .arrow'));
 return {logoBackground:logo.backgroundImage,logoColor:logo.color,eyebrowColor:eyebrow.color,eyebrowSpacing:eyebrow.letterSpacing,headlineShadow:headline.textShadow,cardBorder:card.borderTopColor,arrowBorder:arrow.borderTopColor,rootOverlay:root.position};
});
assert.ok(homeLuxury.logoBackground.includes('linear-gradient'),'Home logo must use the polished champagne gradient');
assert.notEqual(homeLuxury.eyebrowColor,'rgb(255, 255, 255)','Home eyebrow must use the champagne accent');
assert.ok(homeLuxury.eyebrowSpacing!=='normal','Home eyebrow must retain premium letter spacing');
assert.notEqual(homeLuxury.headlineShadow,'none','Home headline must retain contrast shadow');
assert.notEqual(homeLuxury.cardBorder,'rgba(255, 255, 255, 0.28)','Home photo-window border must use the warmer luxury finish');

const menuBefore=await page.evaluate(()=>{const d=getComputedStyle(document.getElementById('drawer')),bg=getComputedStyle(document.getElementById('drawerBg'));return {drawerPos:d.position,drawerTop:d.top,drawerRight:d.right,drawerBottom:d.bottom,bgPos:bg.position};});
assert.equal(menuBefore.drawerPos,'fixed','Home Menu drawer must be fixed to the viewport');
assert.equal(menuBefore.drawerTop,'0px','Home Menu drawer must start at the top');
assert.equal(menuBefore.drawerBottom,'auto','Home Menu drawer must not anchor to the bottom');
assert.equal(menuBefore.bgPos,'fixed','Menu backdrop must be fixed to the viewport');
const menuButtons=await page.evaluate(()=>{const vw=innerWidth,vh=innerHeight;return {vw,vh,items:['menu','foodMenu','restaurantMenu','winnerMenu'].map(id=>{const e=document.getElementById(id),r=e?.getBoundingClientRect();return {id,exists:!!e,left:r?.left??-1,right:r?.right??-1,top:r?.top??-1,bottom:r?.bottom??-1,width:r?.width??0,height:r?.height??0};})};});
for(const m of menuButtons.items){assert.ok(m.exists,m.id+' must exist');assert.ok(m.left>=0 && m.right<=menuButtons.vw+1,m.id+' must stay inside viewport horizontally');assert.ok(m.top>=0 && m.bottom<=menuButtons.vh+1,m.id+' must stay inside viewport vertically');}
assert.ok(menuButtons.items.find(x=>x.id==='menu').right>menuButtons.vw-80,'Home menu must remain near the top-right');


const homeBg=await page.evaluate(()=>{const app=document.querySelector('.app'),home=document.getElementById('home'),style=getComputedStyle(app),homeStyle=getComputedStyle(home),food=getComputedStyle(document.getElementById('foodStart')),rest=getComputedStyle(document.getElementById('restStart')),bar=getComputedStyle(document.getElementById('appTopbar'));return {appBg:style.backgroundImage,homeBg:homeStyle.backgroundColor,homeShadow:food.boxShadow,foodPhoto:food.backgroundImage,restPhoto:rest.backgroundImage,appPosition:style.position,barPosition:bar.position,barRight:bar.right,appHeight:app.getBoundingClientRect().height,appWidth:app.getBoundingClientRect().width,viewportHeight:innerHeight,viewportWidth:innerWidth};});
assert.ok(homeBg.appBg.includes('8417853'),'Home must use Pexels photo 8417853 as the full-page background');
assert.equal(homeBg.homeBg,'rgba(0, 0, 0, 0)','Home canvas must be transparent over the full background');
assert.ok(homeBg.homeShadow.includes('inset'),'Dine In photo window may use only a subtle inset highlight, not a drop shadow');
assert.ok(homeBg.foodPhoto.includes('/api/image?url=') || homeBg.foodPhoto.includes('11368700'),'Dine In photo window must retain its photo');
assert.ok(homeBg.restPhoto.includes('/api/image?url=') || homeBg.restPhoto.includes('37307284'),'Dine Out photo window must retain its photo');
assert.equal(homeBg.appPosition,'relative','Home app must anchor the absolute top bar');
assert.equal(homeBg.barPosition,'absolute','Home top bar must float over the background');
assert.ok(homeBg.appHeight>=homeBg.viewportHeight-1,'Home background canvas must cover the full viewport height');
assert.ok(homeBg.appWidth>=homeBg.viewportWidth-1 || homeBg.appWidth>=500,'Home background canvas must cover the app viewport width');
const deckPos=await page.evaluate(()=>{const a=getComputedStyle(document.getElementById('foodMaybeDeck')),r=getComputedStyle(document.getElementById('restaurantMaybeDeck'));return {foodPosition:a.position,foodTransform:a.transform,restaurantPosition:r.position,restaurantTransform:r.transform};});
assert.equal(deckPos.foodPosition,'static','Meals ALL/MAYBES must stay in normal grid flow');
assert.equal(deckPos.restaurantPosition,'static','Restaurants ALL/MAYBES must stay in normal grid flow');
assert.equal(deckPos.foodTransform,'none','Meals ALL/MAYBES must not inherit the legacy absolute transform');
assert.equal(deckPos.restaurantTransform,'none','Restaurants ALL/MAYBES must not inherit the legacy absolute transform');



assert.equal(await page.locator('#home .sub').innerText(),'Swipe. Dinliminate. Enjoy.');
assert.equal(await page.locator('#addToPhone').count(),1);
assert.equal(await page.locator('#shareApp').count(),1);
assert.equal(await page.locator('#foodStart').locator('strong').innerText(),'DINNER IN');
assert.equal(await page.locator('#foodStart .home-card-copy > span').innerText(),'Tonight’s meal awaits.');
assert.equal(await page.locator('#restStart').locator('strong').innerText(),'DINNER OUT');
assert.equal(await page.locator('#restStart .home-card-copy > span').innerText(),'Your table awaits');
assert.equal(await page.locator('#homeFirstNudge').innerText(),'Swipe until it’s revealed.');
assert.equal(await page.locator('#homeFirstNudge').isVisible(),true);
assert.equal(await page.locator('#foodStart .home-card-copy strong').innerText(),'DINNER IN');
assert.equal(await page.locator('#restStart .home-card-copy strong').innerText(),'DINNER OUT');
const ambient=await page.evaluate(()=>getComputedStyle(document.querySelector('.app'),'::after').animationDuration);
assert.equal(ambient,'0s');
const homeGeom=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight,innerHeight}));
assert.equal(homeGeom.scrollWidth,homeGeom.clientWidth);
assert.ok(homeGeom.scrollHeight<=homeGeom.innerHeight+2);

await page.locator('#foodStart').click({position:{x:10,y:10}});
await page.waitForTimeout(100);
assert.equal(await page.locator('#foodCard').isVisible(),true);
const deckVisual=await page.evaluate(()=>{const f=document.getElementById('foodMaybeDeck'),fc=getComputedStyle(f),fr=f.getBoundingClientRect();return {foodText:f.textContent.trim(),foodFont:fc.fontSize,foodHeight:fr.height,foodWidth:fr.width};});
assert.equal(deckVisual.foodText.replace(/[^A-Z]/g,''),'ALLMAYBES','Meals filter must contain ALL and MAYBES');
assert.match(await page.locator('#foodCount').innerText(),/^\d+$/,'Meal count must be numeric only');

assert.equal(await page.locator('#foodCard .swipe-card-coach').count(),1);
assert.equal(await page.locator('#food .quick-section').getAttribute('class').then(x=>String(x||'')).then(x=>x.includes('is-collapsed')),true);
assert.equal(await page.locator('#food .deck-filter-label-all').innerText(),'ALL');
assert.equal(await page.locator('#food .deck-filter-label-maybe').innerText(),'MAYBES');
const foodFilterGeom=await page.evaluate(()=>{const f=document.getElementById('foodMaybeDeck').getBoundingClientRect(),c=document.getElementById('foodCount').getBoundingClientRect();return {filterRight:f.right,countLeft:c.left};});
assert.ok(foodFilterGeom.filterRight<=foodFilterGeom.countLeft,'Meals ALL/MAYBES must be left of count');
assert.equal(await page.locator('.swipe-hint').count(),0);
assert.match(await page.locator('#foodCard .swipe-card-coach').innerText(),/← CUT.*SWIPE.*MAYBE →/s);
const foodMaybeStyle=await page.locator('#foodMaybe').evaluate(el=>getComputedStyle(el,'::before').animationName);
assert.equal(foodMaybeStyle,'cp774MaybeGlow');
const foodBefore=Number((await page.locator('#foodCount').innerText()).match(/\d+/)?.[0]||0);
assert.equal(foodBefore,116);
await page.locator('#foodMaybe').dispatchEvent('pointerdown',{pointerType:'mouse',button:0});
assert.match(await page.locator('#foodMaybe').getAttribute('class'),/is-pressed/);
await page.locator('#foodMaybe').dispatchEvent('pointerup',{pointerType:'mouse',button:0});
await page.waitForTimeout(400);
assert.equal(Number((await page.locator('#foodCount').innerText()).match(/\d+/)?.[0]||0),foodBefore);
assert.equal(await page.locator('#foodCard .swipe-card-coach').count(),0);
assert.equal(await page.locator('.swipe-hint').count(),0);
await page.locator('#foodCut').dispatchEvent('pointerdown',{pointerType:'mouse',button:0});
assert.match(await page.locator('#foodCut').getAttribute('class'),/is-pressed/);
await page.locator('#foodCut').dispatchEvent('pointerup',{pointerType:'mouse',button:0});
await page.waitForTimeout(220);

assert.equal(Number((await page.locator('#foodCount').innerText()).match(/\d+/)?.[0]||0),115);
await page.locator('#foodBack').click();
await page.waitForTimeout(120);
assert.equal(Number((await page.locator('#foodCount').innerText()).match(/\d+/)?.[0]||0),116);
await page.locator('#foodDetails').click();
await page.waitForTimeout(80);
assert.equal(await page.locator('#detailsModal').count(),1);
assert.ok((await page.locator('#detailsModal').getAttribute('class')).includes('details-modal'));
const mealDetailTiming=await page.locator('#detailsModal .history-detail-photo').evaluate(el=>getComputedStyle(el).transitionDuration);
assert.ok(mealDetailTiming.includes('0.2s'),'Meal Details photo transition must include a 0.2s transform timing: '+mealDetailTiming);
const mealTitleTiming=await page.locator('#detailsModal .detail-unified-title').evaluate(el=>getComputedStyle(el).transitionDuration);
assert.ok(mealTitleTiming.includes('0.18s'),'Meal Details title transition must include a 0.18s timing: '+mealTitleTiming);
await page.locator('#detailNotesToggle').click();
await page.locator('#detailNotesInput').fill('Keep this one in mind.');
await page.locator('#detailNotesSave').click();
assert.equal(await page.locator('#detailNoteEdit').isVisible(),true);
assert.equal(await page.locator('#detailNotesDelete').isVisible(),true);
await page.locator('#detailNoteEdit').click();
await page.locator('#detailNotesInput').fill('Updated note.');
await page.locator('#detailNotesSave').click();
assert.equal(await page.locator('#detailNotesPreview').innerText(),'Updated note.');
await page.locator('#detailNotesDelete').click();
assert.equal(await page.locator('#detailNotesEmpty').isVisible(),true);
await page.locator('#detailsModal [data-close]').click();
await page.locator('#foodBackTop').click();
await page.locator('#foodStart').click();
await page.waitForTimeout(100);
await page.locator('#foodChoose').click();
await page.waitForTimeout(120);
assert.equal(await page.locator('#winner').isVisible(),true);
assert.equal(await page.locator('#celebration').isVisible(),true);
assert.equal(await page.locator('#celebration .firework-burst').count(),3);
const fireworkLoop=await page.locator('#celebration .firework-burst').first().evaluate(el=>getComputedStyle(el).animationIterationCount);
assert.equal(fireworkLoop,'infinite');
const fireworkRayLoop=await page.locator('#celebration .firework-burst span').first().evaluate(el=>getComputedStyle(el).animationIterationCount);
assert.equal(fireworkRayLoop,'infinite');
const fireworkDuration=await page.locator('#celebration .firework-burst span').first().evaluate(el=>getComputedStyle(el).animationDuration);
assert.equal(fireworkDuration,'2.7s');
assert.equal(await page.locator('#winner').isVisible(),true);
await page.waitForTimeout(5000);
assert.equal(await page.locator('#celebration').isVisible(),true);
await page.locator('#winnerBackTop').click();
await page.waitForTimeout(200);
assert.equal(await page.locator('#homeFirstNudge').count(),0);
await page.evaluate(()=>{localStorage.removeItem('dinliminate.swipeHint.v4');localStorage.removeItem('dinliminate.swipeHint.v5');});

async function assertUtilityTop(buttonId,modalId){
  await page.locator('#menu').click();
  await page.waitForTimeout(220);
  await page.locator('#'+buttonId).click();
  await page.waitForTimeout(240);
  const geom=await page.evaluate(({modalId})=>{
    const modal=document.getElementById(modalId+'Modal');
    const menu=document.getElementById('menu');
    const mr=modal?.getBoundingClientRect(), br=menu?.getBoundingClientRect();
    return {modalTop:mr?.top??-1,modalBottom:mr?.bottom??-1,menuBottom:br?.bottom??-1,modalVisible:!!modal};
  },{modalId});
  assert.equal(geom.modalVisible,true,modalId+' must open');
  assert.ok(geom.modalTop>=geom.menuBottom-1,modalId+' must open underneath the hamburger');
  assert.ok(geom.modalTop<=geom.menuBottom+24,modalId+' must stay close beneath the hamburger');
  await page.locator('#'+modalId+'Modal [data-close]').click();
  await page.waitForTimeout(220);
}
await assertUtilityTop('manage','manageFoods');
await assertUtilityTop('history','history');
await assertUtilityTop('settings','settings');



await page.locator('#restStart').click();
await page.waitForTimeout(600);
assert.equal(await page.locator('#restaurant').isVisible(),true);
assert.equal(await page.locator('#restaurantSearch').count(),0,'Restaurant Search must remain hidden');
assert.equal(await page.locator('#hoursToggle').count(),0,'Open/All must remain hidden');
assert.equal(await page.locator('#restaurantQuery').count(),1);
assert.equal(await page.locator('#restaurant .swipe-card-coach').count(),1);
assert.equal(await page.locator('#restaurant .deck-filter-all').count(),0);
assert.equal(await page.locator('#restaurant .deck-filter-label-all').innerText(),'ALL');
assert.equal(await page.locator('#restaurant .deck-filter-label-maybe').innerText(),'MAYBES');
const sourceParity=await page.evaluate(()=>{const f=document.getElementById('foodMaybeDeck'),r=document.getElementById('restaurantMaybeDeck');return {foodClass:f.className,restaurantClass:r.className,foodHTML:f.innerHTML,restaurantHTML:r.innerHTML};});
assert.ok(sourceParity.foodClass.includes('all-maybe-toggle')&&sourceParity.restaurantClass.includes('all-maybe-toggle'),'Both visible screens must use the shared All-Maybes component class');
assert.equal(sourceParity.restaurantHTML,sourceParity.foodHTML,'Meals and Restaurants All-Maybes rendered markup must match exactly');

const restaurantFilterGeom=await page.evaluate(()=>{const f=document.getElementById('restaurantMaybeDeck').getBoundingClientRect(),c=document.getElementById('restaurantCount').getBoundingClientRect();return {filterRight:f.right,countLeft:c.left};});
assert.ok(restaurantFilterGeom.filterRight<=restaurantFilterGeom.countLeft,'Restaurants ALL/MAYBES must be left of count');
const restaurantVisual=await page.evaluate(()=>{const f=document.getElementById('restaurantMaybeDeck'),m=document.getElementById('foodMaybeDeck'),fc=getComputedStyle(f),mc=getComputedStyle(m);return {restaurantFont:fc.fontSize,foodFont:mc.fontSize,restaurantLine:fc.lineHeight,foodLine:mc.lineHeight,restaurantHeight:fc.height,foodHeight:mc.height,restaurantPad:fc.padding,foodPad:mc.padding,restaurantBorder:fc.borderWidth,foodBorder:mc.borderWidth,restaurantGap:fc.gap,foodGap:mc.gap};});
assert.equal(restaurantVisual.restaurantFont,restaurantVisual.foodFont,'Meals and Restaurants filter typography must match');
assert.equal(restaurantVisual.restaurantLine,restaurantVisual.foodLine,'Meals and Restaurants filter line-height must match');
assert.equal(restaurantVisual.restaurantHeight,restaurantVisual.foodHeight,'Meals and Restaurants filter height must match');
assert.equal(restaurantVisual.restaurantPad,restaurantVisual.foodPad,'Meals and Restaurants filter padding must match');
assert.equal(restaurantVisual.restaurantBorder,restaurantVisual.foodBorder,'Meals and Restaurants filter border must match');
assert.equal(restaurantVisual.restaurantGap,restaurantVisual.foodGap,'Meals and Restaurants filter spacing must match');
assert.match(await page.locator('#restaurantCount').innerText(),/^\d+$/,'Restaurant count must be numeric only');
assert.match(await page.locator('#foodCount').innerText(),/^\d+$/,'Meal count must be numeric only');

assert.equal(await page.locator('#restStage #restaurantCard').count(),1);
const restBefore=Number((await page.locator('#restaurantCount').innerText()).match(/\d+/)?.[0]||0);
assert.equal(restBefore,3);
await page.locator('#restMaybe').dispatchEvent('pointerdown',{pointerType:'mouse',button:0});
assert.match(await page.locator('#restMaybe').getAttribute('class'),/is-pressed/);
await page.locator('#restMaybe').dispatchEvent('pointerup',{pointerType:'mouse',button:0});
await page.waitForTimeout(400);
assert.equal(Number((await page.locator('#restaurantCount').innerText()).match(/\d+/)?.[0]||0),restBefore);
await page.locator('#restCut').dispatchEvent('pointerdown',{pointerType:'mouse',button:0});
assert.match(await page.locator('#restCut').getAttribute('class'),/is-pressed/);
await page.locator('#restCut').dispatchEvent('pointerup',{pointerType:'mouse',button:0});
await page.waitForTimeout(220);
assert.equal(Number((await page.locator('#restaurantCount').innerText()).match(/\d+/)?.[0]||0),2);
await page.locator('#restBack').click();
await page.waitForTimeout(120);
assert.equal(Number((await page.locator('#restaurantCount').innerText()).match(/\d+/)?.[0]||0),3);
await page.locator('#restDetails').click();
await page.waitForTimeout(80);
assert.equal(await page.locator('#detailNotesToggle').count(),1);
assert.ok((await page.locator('#detailsModal').getAttribute('class')).includes('details-modal'));
const restDetailTiming=await page.locator('#detailsModal .history-detail-photo').evaluate(el=>getComputedStyle(el).transitionDuration);
assert.ok(restDetailTiming.includes('0.2s'),'Restaurant Details photo transition must include a 0.2s transform timing: '+restDetailTiming);
await page.locator('#detailNotesToggle').click();
await page.locator('#detailNotesInput').fill('Try the pizza.');
await page.locator('#detailNotesSave').click();
assert.equal(await page.locator('#detailNoteEdit').count(),1);
await page.locator('#detailNotesDelete').click();
assert.equal(await page.locator('#detailNotesEmpty').isVisible(),true);

assert.equal(errors.length,0,'Browser page errors: '+errors.join(' | '));
assert.equal(consoleErrors.length,0,'Browser console errors: '+consoleErrors.join(' | '));
console.log(JSON.stringify({ok:true,build:releaseMeta.build,checkpoint:releaseMeta.checkpoint,home:'PASS',meal:'PASS',notes:'PASS',restaurant:'PASS',hiddenRestaurantSearch:true,hiddenOpenAll:true}));
await browser.close();
server.close();