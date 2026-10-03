const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const PORT = 4173;
const BASE = 'http://127.0.0.1:'+PORT;
const appKey = 'dinliminate.clean.cp1';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAAAQCAYAAAB49sBDAAAABmJLR0QA/wD/AP+gvaeTAAAA' +
  'B3RJTUUH6gESDgkVtQAAAB1JREFUeNrtwQENAAAAwqD3T20ON6B0QwAAAAAAAAAAAAAA' +
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD8G4QAAaJ8lOAAAAABJRU5ErkJggg==',
  'base64'
);

function log(section, detail='') {
  console.log('[USER-TEST] '+section+(detail?' — '+detail:''));
}

const server = http.createServer(async (req,res)=>{
  try {
    const u = new URL(req.url, BASE);
    if (u.pathname === '/api/image') {
      const raw = u.searchParams.get('url');
      if (!raw) { res.writeHead(400); return res.end('missing url'); }
      const upstream = await fetch(raw, { headers:{'User-Agent':'Dinliminate CP714 QA'} });
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'no-store'
      });
      const body = Buffer.from(await upstream.arrayBuffer());
      return res.end(body);
    }
    const relative = decodeURIComponent(u.pathname).replace(/^\//,'') || 'index.html';
    const file = path.join(ROOT,relative);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    const ext = path.extname(file);
    const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
    res.writeHead(200, {'Content-Type':types[ext] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(502);res.end(String(e));
  }
});

async function main() {
  server.listen(PORT,'127.0.0.1');
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({
    viewport:{width:390,height:844},
    deviceScaleFactor:1,
    isMobile:true,
    hasTouch:true
  });
  const page = await context.newPage();
  const consoleErrors=[];
  const pageErrors=[];
  page.on('console',msg=>{ if(msg.type()==='error') consoleErrors.push(msg.text()); });
  page.on('pageerror',err=>pageErrors.push(String(err)));

  const assertVisible = async sel => assert(await page.locator(sel).isVisible(), sel+' should be visible');
  const countValue = async ()=>Number((await page.locator('#foodCount').innerText()).match(/\d+/)?.[0]||0);
  const openMenu = async ()=>{ await page.locator('#menu').click(); await assertVisible('#drawer'); };
  const closeMenu = async ()=>{ await page.locator('#drawerClose').click(); };
  const tapManage = async ()=>{ await openMenu(); await page.locator('#manage').click(); await page.waitForTimeout(250); await assertVisible('#manageFoodsModal'); };
  const saveEditor = async ()=>{ await page.locator('#foodEditorForm button.cut').click(); await page.waitForTimeout(250); };
  const fillNutrition = async ()=>{
    for (const [id,value] of [['editFoodCalories','500'],['editFoodProtein','30'],['editFoodCarbs','45'],['editFoodFat','20'],['editFoodSodium','700']]) {
      await page.locator('#'+id).fill(value);
    }
  };
  const confirm = async ()=>{ await page.locator('#appConfirmOk').click(); await page.waitForTimeout(200); };

  log('Home shell');
  await page.goto(BASE+'/?qa=cp714');
  await page.waitForLoadState('networkidle');
  assert.strictEqual(await page.locator('h1').innerText(),'Dinner Decisions Simplified');
  assert.strictEqual(await page.locator('.home-intro .sub').innerText(),'Beautifully swipe until it’s revealed.');
  assert((await page.evaluate(()=>document.documentElement.scrollHeight <= window.innerHeight+2)), 'Home should fit without vertical page scroll');
  assert.strictEqual(await page.locator('.home-card').count(),2);
  assert.strictEqual(await page.locator('.home-foot-action').count(),2);
  log('Home shell PASS');

  log('Meal deck initial state');
  await page.locator('#foodStart').click();
  await page.waitForTimeout(150);
  await assertVisible('#foodCard');
  assert.strictEqual(await countValue(),116);
  assert((await page.locator('#foodImg').evaluate(img=>img.complete && img.naturalWidth>0)), 'Meal hero image should load');
  assert(await page.locator('#foodName').innerText(), 'Meal should have a name');
  log('Meals start PASS', '116 choices loaded with a real image');

  log('Meal Details');
  await page.locator('#foodDetails').click();
  await page.waitForTimeout(100);
  await assertVisible('#detailsModal');
  assert(await page.locator('#detailsModal .detail-section-title').count() >= 1);
  await page.locator('#detailsModal [data-close]').click();
  await page.waitForTimeout(50);
  log('Meal Details PASS');

  log('Quick Cuts');
  const beforeQuick = await countValue();
  await page.locator('#foodQuick [data-food-quick="Italian"]').click();
  await page.waitForTimeout(100);
  const afterQuick = await countValue();
  assert(afterQuick < beforeQuick, 'Italian Quick Cut should remove matching meals from the active deck');
  await page.locator('#foodQuick [data-food-quick="Italian"]').click();
  await page.waitForTimeout(100);
  assert.strictEqual(await countValue(),beforeQuick);
  const quickTiles=await page.locator('#foodQuick [data-food-quick]').count();
  assert(quickTiles >= 13, 'Standard Quick Cuts should be present');
  log('Quick Cuts PASS', quickTiles+' standard tiles visible and toggle restores the deck');

  log('Button geometry');
  const dims = await page.evaluate(()=>Object.fromEntries(['foodBack','foodCut','foodMaybe','foodMaybeDeck'].map(id=>{
    const r=document.getElementById(id).getBoundingClientRect(); return [id,{w:r.width,h:r.height,left:r.left,top:r.top}];
  })));
  assert(Math.abs(dims.foodCut.w-64)<1 && Math.abs(dims.foodMaybe.w-64)<1, 'Cut and Maybe should be 64px on 390px viewport');
  assert(Math.abs(dims.foodBack.w-44)<1, 'Back should remain 44px');
  log('Button geometry PASS', JSON.stringify(dims));

  log('Maybe button + recycle');
  const maybeStartCount=await countValue();
  const beforeMaybeName=await page.locator('#foodName').innerText();
  await page.locator('#foodMaybe').click();
  await page.waitForTimeout(150);
  assert.strictEqual(await countValue(),maybeStartCount);
  assert(await page.locator('#foodCard .maybe-stamp').isVisible());
  assert.notStrictEqual(await page.locator('#foodName').innerText(),beforeMaybeName);
  const afterMaybeRect=await page.locator('#foodMaybe').boundingBox();
  assert(Math.abs(afterMaybeRect.width-dims.foodMaybe.w)<1 && Math.abs(afterMaybeRect.height-dims.foodMaybe.h)<1);
  await page.locator('#foodBack').click();
  await page.waitForTimeout(100);
  assert.strictEqual(await countValue(),maybeStartCount);
  log('Maybe PASS', 'count stays '+maybeStartCount+' and choice recycles');

  log('Maybe deck filter');
  await page.locator('#foodMaybe').click();
  await page.waitForTimeout(80);
  await page.locator('#foodMaybeDeck').click();
  await page.waitForTimeout(80);
  assert.strictEqual(await countValue(),1);
  await page.locator('#foodMaybeDeck').click();
  await page.waitForTimeout(80);
  assert.strictEqual(await countValue(),maybeStartCount);
  await page.locator('#foodBack').click();
  log('Maybe deck filter PASS');

  log('Cut swipe + Back');
  const cutStart=await countValue();
  const box=await page.locator('#foodCard').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  for(let n=1;n<=5;n++) await page.mouse.move(box.x+box.width/2-55*n,box.y+box.height/2,{steps:2});
  await page.mouse.up();
  await page.waitForTimeout(350);
  assert.strictEqual(await countValue(),cutStart-1);
  await page.locator('#foodBack').click();
  await page.waitForTimeout(100);
  assert.strictEqual(await countValue(),cutStart);
  log('Left swipe PASS', 'Cut decreased by 1 and Back restored it');

  log('Maybe swipe');
  const maybeSwipeStart=await countValue();
  const b2=await page.locator('#foodCard').boundingBox();
  await page.mouse.move(b2.x+b2.width/2,b2.y+b2.height/2);
  await page.mouse.down();
  for(let n=1;n<=5;n++) await page.mouse.move(b2.x+b2.width/2+55*n,b2.y+b2.height/2,{steps:2});
  await page.mouse.up();
  await page.waitForTimeout(350);
  assert.strictEqual(await countValue(),maybeSwipeStart);
  assert(await page.locator('#foodCard .maybe-stamp').isVisible());
  await page.locator('#foodBack').click();
  log('Right swipe PASS', 'Maybe kept the count unchanged');

  log('Card action stability');
  const p0=await page.locator('#foodCut').boundingBox();
  const p1=await page.locator('#foodMaybe').boundingBox();
  await page.locator('#foodCut').click();
  await page.waitForTimeout(120);
  const p2=await page.locator('#foodCut').boundingBox();
  const p3=await page.locator('#foodMaybe').boundingBox();
  assert(Math.abs(p0.x-p2.x)<0.5 && Math.abs(p0.y-p2.y)<0.5);
  assert(Math.abs(p1.x-p3.x)<0.5 && Math.abs(p1.y-p3.y)<0.5);
  await page.locator('#foodBack').click();
  log('Card action stability PASS');

  log('Manage Meals action order');
  await page.locator('#foodBackTop').click();
  await tapManage();
  const firstButtons=await page.locator('.manage-food-row').first().locator('.food-row-actions button').allInnerTexts();
  assert.deepStrictEqual(firstButtons,['Edit','Hide','Delete']);
  assert.strictEqual(await page.locator('.manage-food-row').count(),116);
  log('Manage Meals order PASS', firstButtons.join(' -> '));

  log('Hide + Restore from library');
  const hideRow=page.locator('.manage-food-row').first();
  const hideName=await hideRow.locator('.manage-food-name b').innerText();
  await hideRow.locator('[data-food-hide]').click();
  await page.waitForTimeout(80);
  const hiddenRow=page.locator('.manage-food-row').filter({hasText:hideName}).first();
  assert((await hiddenRow.innerText()).includes('Hidden'));
  assert(await hiddenRow.locator('[data-food-restore]').count()===1);
  await hiddenRow.locator('[data-food-restore]').click();
  await page.waitForTimeout(80);
  assert((await page.locator('.manage-food-row').filter({hasText:hideName}).first().innerText()).includes('Active'));
  log('Hide/Restore PASS');

  log('Edit built-in meal + photo upload');
  const spaghettiRow=page.locator('.manage-food-row').filter({hasText:'Spaghetti'}).first();
  await spaghettiRow.locator('[data-food-edit]').click();
  await page.waitForTimeout(80);
  await page.locator('#editFoodName').fill('Spaghetti QA Edit');
  await page.locator('#editFoodFile').setInputFiles({name:'spaghetti-qa.png',mimeType:'image/png',buffer:png});
  await saveEditor();
  const editedRow=page.locator('.manage-food-row').filter({hasText:'Spaghetti QA Edit'}).first();
  assert(await editedRow.count()===1);
  assert((await editedRow.innerText()).includes('Active · Edited'));
  const savedBuilt=await page.evaluate(({appKey})=>{
    const d=JSON.parse(localStorage.getItem(appKey)); return d.custom.find(x=>x.id==='spaghetti');
  },{appKey});
  assert(savedBuilt,'Edited built-in override should persist');
  assert.strictEqual(savedBuilt.name,'Spaghetti QA Edit');
  assert.strictEqual(savedBuilt.image,'idb:spaghetti');
  log('Built-in Edit PASS', 'name + replacement photo persisted without duplicating meal');

  log('Custom Quick Cut creation');
  await page.locator('#openFoodEditor').click();
  await page.waitForTimeout(60);
  assert.strictEqual(await page.locator('#addCustomQuickCut').count(),1);
  await page.locator('#addCustomQuickCut').click();
  await page.waitForTimeout(50);
  assert.strictEqual(await page.locator('.custom-qc-tile').count(),1);
  assert.strictEqual(await page.locator('#addCustomQuickCut').count(),1);
  let qcRename=page.locator('[data-custom-qc-rename]').last();
  await qcRename.fill('Favorites');
  await qcRename.press('Enter');
  await page.waitForTimeout(50);
  let qcFile=page.locator('[data-custom-qc-file]').last();
  await qcFile.setInputFiles({name:'favorites.png',mimeType:'image/png',buffer:png});
  await page.waitForTimeout(100);
  assert.strictEqual(await page.locator('.custom-qc-tile').count(),1);
  assert(await page.locator('.custom-qc-photo').first().evaluate(el=>getComputedStyle(el).backgroundImage.includes('data:image')));
  await page.locator('#addCustomQuickCut').click();
  await page.waitForTimeout(50);
  assert.strictEqual(await page.locator('.custom-qc-tile').count(),2);
  log('Custom Quick Cut PASS', 'creation + rename + upload + automatic second Custom box');

  log('Add Meal using Custom Quick Cut');
  const favCheck=page.locator('input[name="editQuickCut"][value="Favorites"]');
  assert(await favCheck.isChecked());
  await page.locator('#editFoodName').fill('QA Custom Meal');
  await fillNutrition();
  await page.locator('#editFoodFile').setInputFiles({name:'custom-meal.png',mimeType:'image/png',buffer:png});
  await saveEditor();
  const customRow=page.locator('.manage-food-row').filter({hasText:'QA Custom Meal'}).first();
  assert(await customRow.count()===1);
  assert((await customRow.innerText()).includes('Active · Custom'));
  log('Add Meal PASS');

  log('Custom Quick Cut visible in Meal deck');
  await page.locator('#foodBackTop').click();
  await page.locator('#foodStart').click();
  await page.waitForTimeout(100);
  assert.strictEqual(await page.locator('#foodQuick [data-food-quick="Favorites"]').count(),1);
  const qBefore=await countValue();
  await page.locator('#foodQuick [data-food-quick="Favorites"]').click();
  await page.waitForTimeout(80);
  assert(await countValue() < qBefore, 'Custom Quick Cut should filter the deck');
  await page.locator('#foodQuick [data-food-quick="Favorites"]').click();
  await page.waitForTimeout(80);
  await page.locator('#foodBackTop').click();
  log('Custom Quick Cut deck PASS');

  log('Rename Custom Quick Cut migrates meal assignments');
  await tapManage();
  const customEdit=page.locator('.manage-food-row').filter({hasText:'QA Custom Meal'}).first();
  await customEdit.locator('[data-food-edit]').click();
  await page.waitForTimeout(60);
  const qcInput=page.locator('[data-custom-qc-rename]').first();
  assert.strictEqual(await qcInput.inputValue(),'Favorites');
  await qcInput.fill('My Picks');
  await qcInput.press('Enter');
  await page.waitForTimeout(60);
  await page.locator('#foodEditorForm button.cut').click();
  await page.waitForTimeout(120);
  const assignment=await page.evaluate(({appKey})=>{
    const d=JSON.parse(localStorage.getItem(appKey));return {
      meal:d.custom.find(x=>x.id==='qa-custom-meal'),
      qcs:d.customQuickCuts
    };
  },{appKey});
  assert(assignment.meal.quickCuts.includes('My Picks'));
  assert(!assignment.meal.quickCuts.includes('Favorites'));
  assert(assignment.qcs.some(x=>x.name==='My Picks'));
  log('Custom rename migration PASS');

  log('Delete Custom Quick Cut + reassign');
  await customEdit.locator('[data-food-edit]').click();
  await page.waitForTimeout(60);
  const deleteQc=page.locator('[data-custom-qc-delete]').first();
  await deleteQc.click();
  await page.waitForTimeout(50);
  await confirm();
  await page.locator('input[name="editQuickCut"][value="Other"]').check();
  await saveEditor();
  const postDelete=await page.evaluate(({appKey})=>{
    const d=JSON.parse(localStorage.getItem(appKey));return {
      meal:d.custom.find(x=>x.id==='qa-custom-meal'),
      qcs:d.customQuickCuts
    };
  },{appKey});
  assert(!postDelete.qcs.some(x=>x.name==='My Picks'));
  assert(!postDelete.meal.quickCuts.includes('My Picks'));
  assert(postDelete.meal.quickCuts.includes('Other'));
  log('Custom Quick Cut delete PASS');

  log('Universal custom meal Delete + Recovery');
  const customRow2=page.locator('.manage-food-row').filter({hasText:'QA Custom Meal'}).first();
  await customRow2.locator('[data-food-delete]').click();
  await confirm();
  await page.waitForTimeout(100);
  assert.strictEqual(await page.locator('.manage-food-row').filter({hasText:'QA Custom Meal'}).count(),0);
  assert(await page.locator('.deleted-meals-section').innerText().then(t=>t.includes('QA Custom Meal')));
  await page.locator('.deleted-meals-section [data-food-deleted-restore]').filter({hasText:''}).first().click();
  await page.waitForTimeout(100);
  assert.strictEqual(await page.locator('.manage-food-row').filter({hasText:'QA Custom Meal'}).count(),1);
  log('Custom meal Delete/Restore PASS');

  log('Built-in Delete + recovery');
  const tacos=page.locator('.manage-food-row').filter({hasText:'Tacos'}).first();
  await tacos.locator('[data-food-delete]').click();
  await confirm();
  await page.waitForTimeout(100);
  assert.strictEqual(await page.locator('.manage-food-row').filter({hasText:'Tacos'}).count(),0);
  assert(await page.locator('.deleted-meals-section').innerText().then(t=>t.includes('Tacos')));
  const deletedTacos=page.locator('.deleted-meals-section .manage-food-row').filter({hasText:'Tacos'}).first();
  await deletedTacos.locator('[data-food-deleted-restore]').click();
  await page.waitForTimeout(100);
  assert.strictEqual(await page.locator('.manage-food-row').filter({hasText:'Tacos'}).count(),1);
  log('Built-in Delete/Restore PASS');

  log('Settings Reset & Restore');
  await page.locator('#manageFoodsModal [data-close]').click();
  await openMenu();
  await page.locator('#settings').click();
  await page.waitForTimeout(120);
  assert.strictEqual(await page.locator('#resetRestore').count(),1);
  assert.strictEqual(await page.locator('#systemRestore').count(),0);
  assert.strictEqual(await page.locator('#resetAppData').count(),0);
  await page.locator('#resetRestore').click();
  await page.waitForTimeout(60);
  assert.strictEqual(await page.locator('#restoreDefaultsOption').count(),1);
  assert.strictEqual(await page.locator('#fullResetOption').count(),1);
  await page.locator('#restoreDefaultsOption').click();
  await page.waitForTimeout(70);
  await confirm();
  await page.waitForTimeout(120);
  assert.strictEqual(await page.locator('.screen.home').isVisible(),true);
  log('Restore Defaults PASS');

  await tapManage();
  assert.strictEqual(await page.locator('.manage-food-row').count(),117, 'Custom meal should survive Restore Defaults');
  assert.strictEqual(await page.locator('.manage-food-row').filter({hasText:'Spaghetti QA Edit'}).count(),0);
  assert.strictEqual(await page.locator('.manage-food-row').filter({hasText:'Spaghetti'}).count(),1);
  assert.strictEqual(await page.locator('.manage-food-row').filter({hasText:'Tacos'}).count(),1);
  log('Restore Defaults preservation PASS', 'custom meal retained; built-ins restored');

  log('Full Reset');
  await page.locator('#manageFoodsModal [data-close]').click();
  await openMenu(); await page.locator('#settings').click(); await page.waitForTimeout(100);
  await page.locator('#resetRestore').click(); await page.waitForTimeout(60);
  await page.locator('#fullResetOption').click(); await page.waitForTimeout(60);
  await confirm(); await page.waitForTimeout(150);
  await tapManage();
  assert.strictEqual(await page.locator('.manage-food-row').count(),116);
  assert.strictEqual(await page.locator('.manage-food-row').filter({hasText:'QA Custom Meal'}).count(),0);
  log('Full Reset PASS', 'returned to 116 built-in meals');

  log('Last-meal Cut => Hungry mode');
  await page.locator('#manageFoodsModal [data-close]').click();
  await page.locator('#foodBackTop').click().catch(()=>{});
  const singleIds=await page.evaluate(()=>window.DINLIMINATE_FOODS.map(x=>x.id));
  await page.evaluate(({key,ids})=>{
    localStorage.removeItem(key);
    localStorage.setItem(key,JSON.stringify({hidden:ids.slice(1),schemaVersion:5}));
  },{key:appKey,ids:singleIds});
  await page.reload(); await page.waitForTimeout(150);
  await page.locator('#foodStart').click(); await page.waitForTimeout(80);
  assert.strictEqual(await countValue(),1);
  await page.locator('#foodCut').click(); await page.waitForTimeout(120);
  await assertVisible('#winner');
  assert.strictEqual(await page.locator('#winName').innerText(),'Nothing left — hungry mode');
  assert(await page.locator('#hungryNote').isVisible());
  assert.strictEqual(await page.locator('#hungryNote').innerText(),'Fish Sticks?');
  log('Hungry mode PASS');

  log('Last-meal Maybe => winner');
  await page.goto(BASE+'/?qa=cp714');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(({key,ids})=>{
    localStorage.removeItem(key);
    localStorage.setItem(key,JSON.stringify({hidden:ids.slice(1),schemaVersion:5}));
  },{key:appKey,ids:singleIds});
  await page.reload(); await page.waitForTimeout(120);
  await page.locator('#foodStart').click(); await page.waitForTimeout(50);
  await page.locator('#foodMaybe').click(); await page.waitForTimeout(120);
  assert(await page.locator('#winner').isVisible());
  assert.notStrictEqual(await page.locator('#winName').innerText(),'Nothing left — hungry mode');
  log('Last-meal Maybe PASS');

  log('Last-meal Choose => winner');
  await page.goto(BASE+'/?qa=cp714');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(({key,ids})=>{
    localStorage.removeItem(key);
    localStorage.setItem(key,JSON.stringify({hidden:ids.slice(1),schemaVersion:5}));
  },{key:appKey,ids:singleIds});
  await page.reload(); await page.waitForTimeout(120);
  await page.locator('#foodStart').click(); await page.waitForTimeout(50);
  await page.locator('#foodChoose').click(); await page.waitForTimeout(120);
  assert(await page.locator('#winner').isVisible());
  assert.notStrictEqual(await page.locator('#winName').innerText(),'Nothing left — hungry mode');
  log('Last-meal Choose PASS');

  log('Browser console/page errors');
  assert.deepStrictEqual(consoleErrors,[],'Console errors: '+consoleErrors.join(' | '));
  assert.deepStrictEqual(pageErrors,[],'Page errors: '+pageErrors.join(' | '));
  log('ALL MEALS USER TESTS PASS');
  console.log(JSON.stringify({consoleErrors,pageErrors},null,2));

  await context.close();
  await browser.close();
  server.close();
}

main().catch(err=>{
  console.error('[USER-TEST] FAIL:',err.stack||err);
  try { server.close(); } catch {}
  process.exitCode=1;
});
