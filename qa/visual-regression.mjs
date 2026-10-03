import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent((req.url||'/').split('?')[0]),rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');
  const file=path.join(root,rel);
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(4176,'127.0.0.1',r));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await page.goto('http://127.0.0.1:4176/?visual=1');
await page.waitForLoadState('domcontentloaded');
await page.locator('#restStart').click();
await page.waitForTimeout(250);
const shot='/tmp/dinliminate-restaurant-start-393.png';
await page.screenshot({path:shot,fullPage:false});
const png=PNG.sync.read(fs.readFileSync(shot));
const baseline=JSON.parse(fs.readFileSync(path.join(root,'qa/visual-baseline.json'),'utf8'));
assert.equal(png.width,baseline.screenshot.width,'Visual baseline width changed');
assert.equal(png.height,baseline.screenshot.height,'Visual baseline height changed');

function signature(img){
  const vals=[]; const gray=new Array(baseline.grid*baseline.grid);
  for(let y=0;y<baseline.grid;y++) for(let x=0;x<baseline.grid;x++){
    const sx=Math.min(img.width-1,Math.floor((x+0.5)*img.width/baseline.grid));
    const sy=Math.min(img.height-1,Math.floor((y+0.5)*img.height/baseline.grid));
    const idx=(sy*img.width+sx)*4;
    gray[y*baseline.grid+x]=0.299*img.data[idx]+0.587*img.data[idx+1]+0.114*img.data[idx+2];
  }
  const mean=gray.reduce((a,b)=>a+b,0)/gray.length;
  let bits='';
  for(const v of gray)bits+=v>=mean?'1':'0';
  const hash=BigInt('0b'+bits).toString(16).padStart(256,'0');
  return {mean,hash};
}
const sig=signature(png);
let diff=0; for(let i=0;i<sig.hash.length;i++) if(sig.hash[i]!==baseline.avgHash[i]) diff++;
const meanDelta=Math.abs(sig.mean-baseline.mean);
assert.ok(diff<=24,'Restaurant start visual signature changed too much: '+diff+'/256 hex nibbles');
assert.ok(meanDelta<=8,'Restaurant start visual brightness changed too much: '+meanDelta.toFixed(2));
console.log(JSON.stringify({signature:sig,hexNibbleDiff:diff,meanDelta:+meanDelta.toFixed(2),shot}));
await browser.close();server.close();
