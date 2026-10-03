const http=require('http');
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const {chromium}=require('playwright');

const ROOT=process.cwd(),PORT=4173,BASE='http://127.0.0.1:'+PORT;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const server=http.createServer((req,res)=>{
 try{
  const u=new URL(req.url,BASE);
  if(u.pathname==='/api/image'){res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store'});return res.end(png);}
  const rel=decodeURIComponent(u.pathname).replace(/^\//,'')||'index.html';
  const file=path.join(ROOT,rel);
  if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end('not found');}
  const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
 }catch(e){res.writeHead(500);res.end(String(e));}
});
const log=(x)=>console.log('[HUNGRY-WHEEL-QA] '+x);
(async()=>{
 let browser,context,page;
 try{
  server.listen(PORT,'127.0.0.1');
  browser=await chromium.launch({headless:true});
  context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  page=await context.newPage();
  const errors=[];const pageErrors=[];
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('pageerror',e=>pageErrors.push(String(e)));

  await page.goto(BASE+'/?qa=1');
  await page.waitForLoadState('domcontentloaded');
  const qa=()=>page.evaluate(()=>window.__DINLIMINATE_TEST__);
  assert(await page.locator('h1').isVisible());

  await page.evaluate(()=>window.__DINLIMINATE_TEST__.winner({category:'Hungry',name:'HUNGRY ☹',id:'hungry-test'}));
  await page.waitForTimeout(100);
  assert(await page.locator('#winner.hungry-mode').isVisible(),'Hungry mode should be visible');
  assert.strictEqual(await page.locator('#hungryNote').innerText(),'You eliminated everything. It’s either this or Fish Sticks.');
  const wheelCount=await page.locator('#hungryWheel path').count();
  const poolCount=await page.evaluate(()=>window.__DINLIMINATE_TEST__.hungryWheelPool().length);
  assert.strictEqual(wheelCount,poolCount,'Wheel path count should match available meal count');
  assert.strictEqual(poolCount,116,'Fresh app should have 116 available meals');
  assert(await page.locator('#hungryWheelSpin').isVisible());
  log('Hungry screen + '+wheelCount+' meal slices PASS');

  await page.evaluate(()=>{window.__DINLIMINATE_TEST_WHEEL_INDEX=0;document.getElementById('hungryWheelSpin').click()});
  await page.waitForTimeout(5750);
  assert(await page.locator('#hungryWheelResult').isVisible(),'Wheel result should appear after spin');
  const firstName=await page.locator('#hungryWheelResultName').innerText();
  assert(firstName.length>0,'Wheel should choose a meal');
  const firstRotation=Number((await page.locator('#hungryWheel').getAttribute('style')).match(/--wheel-rotation:\s*([\d.]+)/)?.[1]||0);
  assert(firstRotation>1500,'First spin should rotate multiple full turns');
  log('First spin PASS — '+firstName);

  await page.evaluate(()=>{window.__DINLIMINATE_TEST_WHEEL_INDEX=1;document.getElementById('hungryWheelSpin').click()});
  await page.waitForTimeout(5750);
  const secondName=await page.locator('#hungryWheelResultName').innerText();
  const secondRotation=Number((await page.locator('#hungryWheel').getAttribute('style')).match(/--wheel-rotation:\s*([\d.]+)/)?.[1]||0);
  assert(secondName.length>0,'Second spin should choose a meal');
  assert(secondRotation>firstRotation,'Spin Again should continue forward, not rotate backward');
  log('Second spin PASS — '+secondName);

  await page.locator('#hungryWheelChoose').click();
  await page.waitForTimeout(150);
  assert(!(await page.locator('#winner').evaluate(el=>el.classList.contains('hungry-mode'))),'Choose This should leave Hungry mode');
  assert.strictEqual(await page.locator('#winName').innerText(),secondName,'Chosen wheel meal should become winner');
  log('Choose This PASS');

  await page.locator('#winnerBackTop').click();
  await page.waitForTimeout(80);
  assert(await page.locator('#home').isVisible(),'Back should return home');
  assert.deepStrictEqual(errors,[],'Console errors: '+errors.join(' | '));
  assert.deepStrictEqual(pageErrors,[],'Page errors: '+pageErrors.join(' | '));
  log('BACK + ERROR CHECK PASS');
  log('ALL HUNGRY WHEEL TESTS PASS');
 }catch(e){console.error('[HUNGRY-WHEEL-QA] FAIL:',e.stack||e);process.exitCode=1}
 finally{try{await context?.close()}catch{}try{await browser?.close()}catch{}try{server.close()}catch{}}
})();