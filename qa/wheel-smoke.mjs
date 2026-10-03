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
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,timezoneId:'America/Chicago'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://127.0.0.1:4173/?qa=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(250);
assert.equal(errors.length,0,'Wheel page must not throw page errors: '+errors.join(' | '));

await page.evaluate(()=>{
 const item=window.DINLIMINATE_FOODS?.[0]||{id:'qa-meal',name:'QA Meal',category:'American',image:''};
 window.__DINLIMINATE_TEST__.winner({id:'qa-hungry',name:'HUNGRY',category:'Hungry',image:item.image||''});
});
await page.waitForTimeout(120);

assert.equal(await page.locator('#hungryWheelPanel').isVisible(),true);
assert.equal(await page.locator('#hungryWheel').locator('.wheel-segment').count(),12,'Wheel should show 12 readable choices');
assert.equal(await page.locator('#hungryWheel').locator('.wheel-label').count(),12,'Wheel should have 12 readable labels');
assert.equal(await page.locator('#hungryWheelPanel .hungry-wheel-pointer').count(),1);
assert.match(await page.locator('#hungryWheelCount').innerText(),/meals available · 12 on the wheel/);

const spin=page.locator('#hungryWheelSpin');
await spin.click();
assert.equal(await spin.isDisabled(),true,'Spin must lock while animating');
await page.waitForFunction(() => !document.querySelector('#hungryWheelSpin')?.disabled,{timeout:7000});
assert.equal(await page.locator('#hungryWheelResult').isVisible(),true,'Spin should land on a result');
assert.equal(await spin.innerText(),'Spin Again');
assert.equal(await page.locator('#hungryWheelChoose').isVisible(),true,'Choose button should appear after the wheel stops');

await page.evaluate(()=>{
 const panel=document.querySelector('.hungry-wheel-stage');
 panel.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7,clientX:196,clientY:620,pointerType:'touch'}));
 panel.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:7,clientX:300,clientY:570,pointerType:'touch'}));
 panel.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7,clientX:300,clientY:570,pointerType:'touch'}));
});
await page.waitForFunction(() => !document.querySelector('#hungryWheelSpin')?.disabled,{timeout:5000});
assert.equal(await page.locator('#hungryWheelResult').isVisible(),true,'Manual flick should settle to a result');
assert.equal(await page.locator('#hungryWheelChoose').isVisible(),true,'Choose should remain available after manual flick');

const landed=await page.locator('#hungryWheel .wheel-segment.is-landed').count();
assert.equal(landed,1,'Exactly one wheel segment should be highlighted when landed');

await page.locator('#hungryWheelChoose').click();
await page.waitForTimeout(180);
assert.equal(await page.locator('#winner').isVisible(),true);
assert.equal(await page.locator('#celebration').isVisible(),true,'Choosing the wheel result should trigger celebration');
const fireworkColors=await page.locator('#celebration .firework-burst span').evaluateAll(spans=>spans.map(s=>s.style.getPropertyValue('--color')).filter(Boolean));
assert.ok(fireworkColors.length>0,'Gold fireworks should render particles');
assert.ok(fireworkColors.every(c=>['#c6a46a','#f1d894','#fff7df','#d8b86b','#fffaf0'].includes(c)),'Wheel-choice fireworks must stay in the gold/white palette');

await browser.close();
server.close();
console.log('WHEEL_SMOKE_OK');
