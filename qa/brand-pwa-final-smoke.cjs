'use strict';

const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const manifest=fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8');
const viewport=fs.readFileSync(path.join(root,'viewport.js'),'utf8');
const logo=fs.readFileSync(path.join(root,'logo.svg'),'utf8');
const icon=fs.readFileSync(path.join(root,'icon.svg'),'utf8');
const release=JSON.parse(fs.readFileSync(path.join(root,'app-release.json'),'utf8'));

function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}

assert('branded logo asset exists',logo.includes('<svg')&&logo.includes('Dinliminate'));
assert('logo uses satin-gold treatment',/linearGradient id="gold"/.test(logo)&&logo.includes('stroke="url(#edge)"'));
assert('home points at restored logo',
 index.includes('./logo.svg?v=1084')&&index.includes('class="dinliminate-logo-symbol"')
);
assert('viewport script is current',
 index.includes('./viewport.js?v=1084')&&viewport.includes('visualViewport')
);
assert('styles and app caches are current',
 index.includes('./styles.css?v=1084')&&index.includes('./app.js?v=1084')
);
assert('service worker precaches current viewport',
 sw.includes("'./viewport.js?v=1084'"));
assert('service worker precaches branded logo',
 sw.includes("'./logo.svg?v=1084'"));
assert('service worker shell is CP1084',
 sw.includes("const CACHE='dinliminate-shell-v1084'"));
assert('manifest icon versions are current',
 manifest.includes('./icon-512.png?v=1084')&&
 manifest.includes('./apple-touch-icon.png?v=1084')&&
 manifest.includes('./icon.svg?v=1084')
);
assert('main icon asset exists',icon.includes('<svg')&&icon.includes('Dinliminate'));
assert('release metadata is CP1084',
 release.build===1084&&release.checkpoint==='CP1084'&&release.vercelProductionVerified===false
);
assert('no deployment marker claims verification',
 release.vercelProductionVerified===false
);

console.log(JSON.stringify({
 ok:true,
 logoRestored:true,
 viewportCache:1084,
 styleCache:1084,
 appCache:1084,
 swCache:'dinliminate-shell-v1084',
 pwaIcons:1084,
 deploymentCreated:false
},null,2));
