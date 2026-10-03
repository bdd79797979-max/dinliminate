import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
  const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');
  const file=path.join(root,rel);
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(4175,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true});
const page=await context.newPage();
const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
await page.route('**/*',async route=>{
  const u=route.request().url();
  if(u.startsWith('https://images.pexels.com/')||u.startsWith('https://images.unsplash.com/')||u.startsWith('https://commons.wikimedia.org/')||u.includes('/api/image?url=')){
    return route.fulfill({status:200,contentType:'image/png',body:tinyPng});
  }
  return route.continue();
});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:4175/?a11y=1');
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(250);

async function checkVisibleSurface(label){
  const report=await page.evaluate(()=>{
    const interactive=[...document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>{
      const r=el.getBoundingClientRect(),s=getComputedStyle(el);
      return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';
    }).map(el=>({tag:el.tagName,id:el.id,aria:el.getAttribute('aria-label'),text:(el.innerText||'').trim(),title:el.getAttribute('title'),name:el.getAttribute('name')}));
    const images=[...document.images].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).display!=='none'}).map(el=>({id:el.id,alt:el.alt,src:el.currentSrc||el.src}));
    const dialogs=[...document.querySelectorAll('[role="dialog"]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0}).map(el=>({id:el.id,ariaModal:el.getAttribute('aria-modal')}));
    return {interactive,images,dialogs};
  });
  const unnamed=report.interactive.filter(x=>!(x.aria||x.text||x.title||x.name));
  assert.equal(unnamed.length,0,label+' has unnamed visible interactive controls: '+JSON.stringify(unnamed));
  const missingAlt=report.images.filter(x=>!String(x.alt||'').trim());
  assert.equal(missingAlt.length,0,label+' has visible images without alt text: '+JSON.stringify(missingAlt));
  for(const d of report.dialogs) {
    assert.equal(d.ariaModal,'true',label+' visible dialog must be modal');
  }
}

await checkVisibleSurface('Home');
await page.locator('#foodStart').click();
await page.waitForTimeout(100);
await checkVisibleSurface('Food');
await page.locator('#foodDetails').click();
await page.waitForTimeout(100);
await checkVisibleSurface('Food Details');
await page.locator('#foodDetails').count();
await page.locator('#detailsModal [data-close]').click();
await page.locator('#foodBackTop').click();
await page.locator('#restStart').click();
await page.waitForTimeout(100);
await checkVisibleSurface('Restaurant');

const nonResourceErrors=errors.filter(x=>!/^Failed to load resource: the server responded with a status of (403|404) \(\)$/.test(x));
console.log('Accessibility resource console warnings (allowed by image fallback/HTTP image smoke):',errors.length-nonResourceErrors.length);
assert.equal(nonResourceErrors.length,0,'Accessibility browser errors: '+nonResourceErrors.join(' | '));
console.log('Dinliminate accessibility smoke: PASS');
await browser.close();
server.close();
