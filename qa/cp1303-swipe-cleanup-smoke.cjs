'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const release=JSON.parse(fs.readFileSync('app-release.json','utf8'));
const releaseManifest=JSON.parse(fs.readFileSync('release-manifest.json','utf8'));

new Function(app);

const legacySymbols=[
  'SWIPE_OVERLAP_DELAY',
  'swipeOverlapContext',
  'swipeOverlapSerial',
  'foodSwipeHandoff',
  'restaurantSwipeHandoff',
  'setDeckPreviewDepth(',
  'waitForMealCardReady(',
  'ensureFoodNextCardReady(',
  'isOverlapCard'
];
for(const symbol of legacySymbols){
  assert.equal(app.includes(symbol),false,'retired swipe symbol remains: '+symbol);
}

const bindStart=app.indexOf('function bindSwipeCard(cardId,onCut,onMaybe){');
assert(bindStart>=0,'single swipe binder is present');
const bindEnd=app.indexOf('\nfunction bindMealPhotoCountControls',bindStart);
assert(bindEnd>bindStart,'single swipe binder has a bounded source block');
const swipe=app.slice(bindStart,bindEnd);

assert.match(swipe,/let phase='idle'/);
assert.match(swipe,/phase='committing'/);
assert.match(swipe,/card\.style\.visibility='hidden'/);
assert.match(swipe,/action\?\.\(\{fromSwipe:true,decisionId\}\)/);
assert.match(swipe,/card\.animate\(/);
assert.match(swipe,/card\.dataset\.swipeTransaction='active'/);
assert.match(swipe,/card\.style\.pointerEvents='none'/);
assert.doesNotMatch(swipe,/95ms|overlap|cloneNode/);

const mealLoader=app.slice(app.indexOf('function loadMealPhotoCandidates'),app.indexOf('\nconst restaurantPhotoInflight',app.indexOf('function loadMealPhotoCandidates')));
assert.match(mealLoader,/await preloadSwipeImage\(url\)/);
assert.match(mealLoader,/img\.src=url/);
assert(mealLoader.indexOf('await preloadSwipeImage(url)')<mealLoader.indexOf('img.src=url'),'Meal source is assigned only after readiness');

const drawFoodStart=app.indexOf('function drawFood(options={})');
const drawFoodEnd=app.indexOf('\nfunction foodCommit',drawFoodStart);
const drawFood=app.slice(drawFoodStart,drawFoodEnd);
assert.match(drawFood,/const handoffRendering=!!options\.swipeHandoff/);
assert.match(drawFood,/img\.style\.visibility='hidden'/);
assert.doesNotMatch(drawFood,/if\(primaryPhoto\)img\.src=primaryPhoto/);
assert.doesNotMatch(drawFood,/else if\(backupPhoto\)img\.src=backupPhoto/);
assert.match(drawFood,/if\(handoffRendering\)/);

const restaurantHydrationStart=app.indexOf('async function hydrateRestaurantPhoto(row,scope){');
const restaurantHydrationEnd=app.indexOf('\nasync function waitForRestaurantPhotoDecoded',restaurantHydrationStart);
const hydration=app.slice(restaurantHydrationStart,restaurantHydrationEnd);
assert.match(hydration,/const data=await loadRestaurantPhoto\(row\)/);
assert.match(hydration,/return data;/);

assert.equal(app.includes("hydrateRestaurantPhoto(item,'#detailsModal')"),false,'Restaurant Details still has a post-open photo replacement');
assert.match(app,/const currentPhotoPromise=hydrateRestaurantPhoto\(row,'#restStage #restaurantCard'\)/);
assert.match(app,/await waitForVisualImage\(data\.url,freshImg,1200\)/);

const rcBuild=Number(release.build);
assert.equal(release.sourceBranch,'main');
assert.equal(releaseManifest.sourceBranch,'main');
assert.equal(releaseManifest.build,rcBuild);
assert.match(index,new RegExp('app\\.js\\?v='+rcBuild));
assert.match(index,new RegExp('styles\\.css\\?v='+rcBuild));
assert.match(sw,new RegExp('dinliminate-shell-v'+rcBuild));
assert.match(sw,new RegExp('app\\.js\\?v='+rcBuild));

console.log('CP1303 swipe cleanup regression: PASS');
