import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent((req.url||'/').split('?')[0]),rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');
 const file=path.join(root,rel);
 if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(4174,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1});
const failures=[];
page.on('pageerror',e=>failures.push(String(e)));
await page.goto('http://127.0.0.1:4174/?perf=1');
await page.waitForLoadState('domcontentloaded');
await page.waitForTimeout(500);
const metrics=await page.evaluate(()=>({
 domContentLoaded:performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd||0,
 loadEvent:performance.getEntriesByType('navigation')[0]?.loadEventEnd||0,
 resources:performance.getEntriesByType('resource').reduce((n,x)=>n+(x.transferSize||0),0),
 js:performance.getEntriesByType('resource').filter(x=>x.name.endsWith('.js')).reduce((n,x)=>n+(x.transferSize||0),0),
 css:performance.getEntriesByType('resource').filter(x=>x.name.endsWith('.css')).reduce((n,x)=>n+(x.transferSize||0),0)
}));
assert.equal(failures.length,0,'Performance page errors: '+failures.join(' | '));
assert.ok(metrics.domContentLoaded<2500,'DOMContentLoaded exceeds 2.5s: '+metrics.domContentLoaded);
assert.ok(metrics.resources<450000,'Transferred resource budget exceeded: '+metrics.resources);
assert.ok(metrics.js<180000,'JS transfer budget exceeded (180 KB): '+metrics.js);
assert.ok(metrics.css<80000,'CSS transfer budget exceeded: '+metrics.css);
console.log(JSON.stringify({metrics}));
await browser.close();server.close();
