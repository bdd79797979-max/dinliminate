'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const release=JSON.parse(fs.readFileSync('app-release.json','utf8'));
const releaseManifest=JSON.parse(fs.readFileSync('release-manifest.json','utf8'));

new Function(app);

const finishStart=app.indexOf('const finishFlight=decisionId=>{',app.indexOf('function bindSwipeCard'));
const finishEnd=app.indexOf('\n const commit=(dx,speed=0)=>{',finishStart);
assert(finishStart>=0&&finishEnd>finishStart,'finishFlight block is present');
const finish=app.slice(finishStart,finishEnd);
assert(!finish.includes('clearExitAnimation();'),'finished Web Animation is not cancelled during finish');
assert(finish.includes('exitAnimation=null;'),'finished Web Animation reference is cleared without rollback');
assert(finish.includes('void completeAfterExit(decisionId);'),'exit completion still advances the decision');

const drawStart=app.indexOf('function drawFood(options={})');
const drawEnd=app.indexOf('\nfunction foodCommit',drawStart);
const drawFood=app.slice(drawStart,drawEnd);
assert(drawFood.includes('const holdCardForMedia=!!foodCard&&!sameMealReady;'),'Meal draw has a full-card media readiness gate');
assert(drawFood.includes('previousMealId'),'Meal draw tracks the prior rendered meal');
assert(drawFood.includes('if(holdCardForMedia){'),'Meal card stays hidden until its new image is ready');

const detailStart=app.indexOf('async function detailsSheet');
const detailEnd=app.indexOf('\nfunction historyImageSource',detailStart);
const details=app.slice(detailStart,detailEnd);
assert(details.includes('let gidx=Math.max(0,Math.min(Number(item._mealPhotoIndex||0),detailPhotos.length-1));'),'Meal Details starts from the current card photo index');
assert(details.includes("if(gcount)gcount.textContent=(gidx+1)+' / '+detailPhotos.length;"),'Meal Details counter matches the starting photo index');
assert(!details.includes("hydrateRestaurantPhoto(item,'#detailsModal')"),'Restaurant Details has no post-open photo replacement');

assert(index.includes('id="bootShield"'),'Navigation boot shield exists');
assert(index.includes('dinliminate-page-unloading #bootShield'),'Navigation unload state re-shows the shield');
assert(index.includes('dinliminate-ready #bootShield'),'Shield is removed only after the ready class');
assert(app.includes("document.documentElement.classList.add('dinliminate-ready');"),'Ready class is set after route/paint startup');

assert(Number(release.build)===1304,'Release build is CP1304');
assert(release.checkpoint==='CP1304','Release checkpoint is CP1304');
assert(release.sourceBranch==='main','Release source branch is main');
assert(Number(releaseManifest.build)===1304,'Release manifest build is CP1304');
assert(releaseManifest.checkpoint==='CP1304','Release manifest checkpoint is CP1304');
assert(releaseManifest.sourceBranch==='main','Release manifest source branch is main');
assert(index.includes('app.js?v=1304'),'Index app version is 1304');
assert(index.includes('styles.css?v=1304'),'Index style version is 1304');
assert(sw.includes('dinliminate-shell-v1304'),'Service worker shell is 1304');
assert(sw.includes('./app.js?v=1304'),'Service worker app asset is 1304');
assert(sw.includes('./styles.css?v=1304'),'Service worker styles asset is 1304');

console.log('CP1304 transition/refresh/details smoke: PASS');
