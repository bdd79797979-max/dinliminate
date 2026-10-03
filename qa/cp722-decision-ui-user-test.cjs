const http=require('http');
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const {chromium}=require('playwright');

const ROOT=process.cwd(),PORT=4174,BASE='http://127.0.0.1:'+PORT;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const server=http.createServer((req,res)=>{
 try{
  const u=new URL(req.url,BASE);
  if(u.pathname==='/api/image'){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});return res.end(png);}
  if(u.pathname==='/api/restaurant-photo'){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('QA image miss');}
  const rel=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html';
  const file=path.join(ROOT,rel);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end('not found');}
  const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(500);res.end(String(e));}
});

const appKey='dinliminate.clean.cp1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const log=(s,d='')=>console.log('[CP722-UI-QA] '+s+(d?' — '+d:''));
const rect=async(page,sel)=>page.locator(sel).boundingBox();
const color=async(page,sel,prop)=>page.locator(sel).evaluate((el,p)=>getComputedStyle(el)[p],prop);

(async()=>{
 let browser,context,page;
 try{
  server.listen(PORT,'127.0.0.1');
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page=await context.newPage();
  const consoleErrors=[],pageErrors=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));

  log('Meals shell');
  await page.goto(BASE+'/?qa=1'); await page.waitForLoadState('domcontentloaded');
  await page.locator('#foodStart').click(); await wait(120);
  assert(await page.locator('#food').isVisible());
  assert.strictEqual(await page.locator('#foodCount').innerText(), '116 choices');
  assert.strictEqual(await page.locator('#foodQuick .quick-label-right').count(),0,'quick label wrapper is outside quick scroller');
  assert(await page.locator('.quick-section .quick-label-right #foodMaybeDeck').isVisible());
  assert.strictEqual(await page.locator('.unified-swipe-actions #foodMaybeDeck').count(),0,'All/Maybe must not remain in bottom rail');
  assert.deepStrictEqual(await page.locator('.unified-swipe-actions button').evaluateAll(bs=>bs.map(b=>b.id)),['foodBack','foodCut','foodMaybe','foodChoose']);
  assert.strictEqual(await page.locator('#foodCard #foodDetails').count(),1);
  assert.strictEqual(await page.locator('#foodCard .card-cuisine-row #foodDetails').count(),1);
  assert.strictEqual(await page.locator('#foodCard #foodChoose').count(),0,'Choose must not be on the meal card');
  log('Meals layout PASS');

  const qrow=await rect(page,'.quick-label'), qfilter=await rect(page,'#foodMaybeDeck'), qcount=await rect(page,'#foodCount');
  assert(qfilter.height<=qrow.height+0.5 && qcount.height<=qrow.height+0.5,'top controls must fit within Quick Cuts row');
  assert(Math.abs(qfilter.height-qcount.height)<1,'All/Maybe and choice count should share the same compact height');
  assert((await color(page,'#foodMaybeDeck','color'))==='rgb(115, 212, 155)','All/Maybe text should be green');
  assert((await color(page,'#foodCount','color'))==='rgb(115, 212, 155)','choice count should be green');
  log('Meals top-row geometry/color PASS',JSON.stringify({qrow,qfilter,qcount}));

  const mealName=await page.locator('#foodName').innerText(), before=await page.locator('#foodCount').innerText();
  await page.locator('#foodMaybe').click(); await wait(120);
  assert.strictEqual(await page.locator('#foodCount').innerText(),before);
  await page.locator('#foodMaybeDeck').click(); await wait(100);
  assert.strictEqual(await page.locator('#foodCount').innerText(),'1 choice');
  assert.strictEqual(await page.locator('#foodMaybeDeck').innerText(),'MAYBE');
  await page.locator('#foodMaybeDeck').click(); await wait(100);
  assert.strictEqual(await page.locator('#foodCount').innerText(),before);
  log('Meals All/Maybe wiring PASS');
  await page.locator('#foodBack').click(); await wait(80);
  await page.locator('#foodStart').click(); await wait(80);
  const chosen=await page.locator('#foodName').innerText();
  await page.locator('#foodChoose').click(); await wait(100);
  assert(await page.locator('#winner').isVisible());
  assert.strictEqual(await page.locator('#winName').innerText(),chosen);
  log('Meals Choose This wiring PASS');

  const rows=[
   {id:'qa-r1',name:'QA Bistro',category:'American',cuisine:'American',address:'1 Main St, Clarksville, TN',distance:1.2,lat:36.53,lon:-87.36,website:'https://example.com/qa-bistro',hoursState:'open',source:'QA'},
   {id:'qa-r2',name:'QA Pizza',category:'Pizza',cuisine:'Pizza',address:'2 Main St, Clarksville, TN',distance:2.1,lat:36.54,lon:-87.35,website:'https://example.com/qa-pizza',hoursState:'open',source:'QA'},
   {id:'qa-r3',name:'QA Grill',category:'Burgers',cuisine:'American',address:'3 Main St, Clarksville, TN',distance:3.3,lat:36.55,lon:-87.34,website:'https://example.com/qa-grill',hoursState:'open',source:'QA'}
  ];
  await page.evaluate(({key,rows})=>{
    localStorage.removeItem(key);
    localStorage.setItem(key,JSON.stringify({screen:'restaurant',saved:true,restaurantPool:rows,restaurantIndex:0,restaurantActions:[],restaurantCuts:[],restaurantMaybeRound:false,restaurantQuery:'',location:{lat:36.53,lon:-87.36,label:'QA location'},locationSource:'address',restaurantSearchOrigin:{lat:36.53,lon:-87.36},schemaVersion:5,hiddenRestaurants:{},custom:[],customQuickCuts:[],deletedCustomMeals:[],hidden:[],deleted:[],cutCats:[],foodCuts:[],maybe:[]}));
  },{key:appKey,rows});
  await page.goto(BASE+'/?qa=1'); await page.waitForLoadState('domcontentloaded'); await wait(150);
  assert(await page.locator('#restaurant').isVisible());
  await wait(100);
  assert.strictEqual(await page.locator('#restaurantCount').innerText(),'3 choices');
  assert(await page.locator('.restaurant-quick-section .quick-label-right #restaurantMaybeDeck').isVisible());
  assert.strictEqual(await page.locator('.restaurant-quick-section .unified-swipe-actions').count(),0);
  assert.deepStrictEqual(await page.locator('#restStage + .unified-swipe-actions button').evaluateAll(bs=>bs.map(b=>b.id)),['restBack','restCut','restMaybe','restChoose']);
  assert.strictEqual(await page.locator('#restaurantCard .restaurant-card-meta-row #restDetails').count(),1);
  assert.strictEqual(await page.locator('#restaurantCard .restaurant-card-meta-row .restaurant-card-website-utility').count(),1);
  assert.strictEqual(await page.locator('#restaurantCard #restChoose').count(),0);
  assert.strictEqual(await page.locator('#restaurantCard .restaurant-card-utility').count(),2,'Restaurant card should only expose Details and Website');
  log('Restaurant card/layout PASS');

  const rqrow=await rect(page,'#restaurant .quick-label'), rqfilter=await rect(page,'#restaurantMaybeDeck'), rqcount=await rect(page,'#restaurantCount');
  assert(rqfilter.height<=rqrow.height+0.5 && rqcount.height<=rqrow.height+0.5);
  assert(Math.abs(rqfilter.height-rqcount.height)<1);
  assert((await color(page,'#restaurantMaybeDeck','color'))==='rgb(115, 212, 155)');
  assert((await color(page,'#restaurantCount','color'))==='rgb(115, 212, 155)');
  log('Restaurant top-row geometry/color PASS',JSON.stringify({rqrow,rqfilter,rqcount}));

  await page.locator('#restDetails').click(); await wait(80);
  assert(await page.locator('#detailsModal').isVisible());
  await page.locator('#detailsModal [data-close]').click(); await wait(50);
  const websiteHref=await page.locator('#restaurantCard .restaurant-card-website-utility').getAttribute('href');
  assert(websiteHref && websiteHref.includes('example.com/qa-bistro'),'Website button should stay on restaurant card');
  await page.locator('#restaurantMaybeDeck').click(); await wait(80);
  assert.strictEqual(await page.locator('#restaurantCount').innerText(),'0 choices');
  assert.strictEqual(await page.locator('#restaurantMaybeDeck').innerText(),'MAYBE');
  await page.locator('#restaurantMaybeDeck').click(); await wait(80);
  assert.strictEqual(await page.locator('#restaurantCount').innerText(),'3 choices');
  log('Restaurant All/Maybe wiring PASS');

  await page.locator('#restChoose').click(); await wait(80);
  assert(await page.locator('#winner').isVisible());
  assert.strictEqual(await page.locator('#hungryRestaurantPanel').isVisible(),false);
  log('Restaurant Choose This wiring PASS');

  const one=rows.slice(0,1);
  await page.evaluate(({key,row})=>{
    localStorage.removeItem(key);
    localStorage.setItem(key,JSON.stringify({screen:'restaurant',saved:true,restaurantPool:[row],restaurantIndex:0,restaurantActions:[],restaurantCuts:[],restaurantMaybeRound:false,restaurantQuery:'',location:{lat:36.53,lon:-87.36,label:'QA location'},locationSource:'address',restaurantSearchOrigin:{lat:36.53,lon:-87.36},schemaVersion:5,hiddenRestaurants:{},custom:[],customQuickCuts:[],deletedCustomMeals:[],hidden:[],deleted:[],cutCats:[],foodCuts:[],maybe:[]}));
  },{key:appKey,row:one[0]});
  await page.reload(); await page.waitForLoadState('domcontentloaded'); await wait(150);
  assert(await page.locator('#restaurant').isVisible());
  await page.locator('#restCut').click(); await wait(100);
  assert(await page.locator('#winner').isVisible());
  assert(await page.locator('#hungryRestaurantPanel').isVisible());
  assert.strictEqual(await page.locator('#hungryNote').innerText(),'You eliminated everything. It’s either this or Waffle House.');
  assert.strictEqual(await page.locator('#hungryWheelPanel').isVisible(),false);
  assert(await page.locator('#hungryMysteryReveal').isVisible());
  assert.strictEqual(await page.locator('#hungryRestaurantCount').innerText(),'1 restaurants from your current search');
  await page.locator('#hungryMysteryReveal').click(); await wait(120);
  assert(await page.locator('#hungryMysteryResult').isVisible());
  assert((await page.locator('#hungryMysteryResultName').innerText()).length>0);
  assert(await page.locator('#hungryMysteryChoose').isVisible());
  await page.locator('#hungryMysteryChoose').click(); await wait(100);
  assert(await page.locator('#winner').isVisible());
  assert(!(await page.locator('#hungryRestaurantPanel').isVisible()));
  log('Restaurant Hungry Mystery Pick + Waffle House line PASS');

  assert.deepStrictEqual(consoleErrors,[],'Console errors: '+consoleErrors.join(' | '));
  assert.deepStrictEqual(pageErrors,[],'Page errors: '+pageErrors.join(' | '));
  log('ALL CP722 DECISION UI TESTS PASS');
 }catch(e){console.error('[CP722-UI-QA] FAIL:',e.stack||e);process.exitCode=1}
 finally{try{await context?.close()}catch{}try{await browser?.close()}catch{}try{server.close()}catch{}}
})();