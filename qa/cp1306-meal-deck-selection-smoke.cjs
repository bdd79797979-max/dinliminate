'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const release=JSON.parse(fs.readFileSync('app-release.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('release-manifest.json','utf8'));
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
new Function(app);

const choiceStart=app.indexOf('function foodChoiceIndex(rows,start,keepState=false){');
const choiceEnd=app.indexOf('\\nfunction',choiceStart+20);
const choice=app.slice(choiceStart,choiceEnd);
assert(choice.includes('S.foodCuts?.has(id)'),'Meal selector checks Cut state');
assert(choice.includes('if(cut)continue;'),'Cut meals cannot be selected');
assert(choice.includes('keepState?maybe:!maybe'),'selector still distinguishes all vs Maybe state');

const maybeStart=app.indexOf('function foodMaybe(item=S.pool[S.index],options={}){');
const maybeEnd=app.indexOf('\\nfunction resolveFoodAfterDecision',maybeStart);
const maybe=app.slice(maybeStart,maybeEnd);
assert(maybe.includes("S.maybe.add(item.id)"));
assert(!maybe.match(/S\.index\s*=/),'foodMaybe no longer performs a second index advance');

const resolveStart=app.indexOf('function resolveFoodAfterDecision(options={}){');
const resolveEnd=app.indexOf('\\nfunction foodBack',resolveStart);
const resolve=app.slice(resolveStart,resolveEnd);
assert(resolve.includes('foodChoiceIndex(S.pool,S.index,false)'));
assert(resolve.includes("winner({name:'Nothing left — hungry mode'"));
assert(resolve.includes('foodChoiceIndex(S.pool,S.index,true)'));

const nextStart=app.indexOf('function nextFoodIndexList(count=FOOD_SWIPE_PRELOAD_DEPTH){');
const nextEnd=app.indexOf('\\nfunction buildPreparedFoodCard',nextStart);
const next=app.slice(nextStart,nextEnd);
assert(!next.includes('ni=(cursor+1)%pool.length'),'waiting preview no longer falls back to arbitrary pool item');
assert(next.includes('foodChoiceIndex('),'waiting preview uses authoritative Meal selector');

assert.equal(Number(release.build),1306);
assert.equal(Number(manifest.build),1306);
assert.equal(release.checkpoint,'CP1306');
assert.equal(manifest.checkpoint,'CP1306');
assert.equal(release.sourceBranch,'main');
assert.equal(manifest.sourceBranch,'main');
assert.equal(pkg.scripts['test:rc'],'node qa/launch-rc.cjs && node qa/cp1303-swipe-cleanup-smoke.cjs && node qa/cp1304-transition-visual-smoke.cjs && node qa/cp1305-swipe-stability-smoke.cjs && node qa/cp1306-meal-deck-selection-smoke.cjs');
assert(index.includes('./app.js?v=1306'));
assert(index.includes('./styles.css?v=1306'));
assert(index.includes('./data/foods.js?v=1306'));
assert(sw.includes("const CACHE='dinliminate-shell-v1306'"));
assert(sw.includes('./app.js?v=1306'));
assert(sw.includes('./styles.css?v=1306'));

console.log('CP1306 Meal deck selection smoke: PASS');
