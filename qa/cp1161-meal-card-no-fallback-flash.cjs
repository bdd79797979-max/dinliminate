const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
new vm.Script(app,{filename:'app.js'});

assert.match(app,/function loadMealPhotoCandidates\(img,candidates,target\)/);
assert.match(app,/img\.src=url;\n    img\.style\.visibility='visible';/);

const drawStart=app.indexOf('function drawFood(){');
const drawEnd=app.indexOf('function foodCommit',drawStart);
assert(drawStart>=0&&drawEnd>drawStart,'drawFood block found');
const draw=app.slice(drawStart,drawEnd);
assert.match(draw,/img\.removeAttribute\('src'\);/);
assert.match(draw,/img\.style\.visibility='hidden';/);
assert.doesNotMatch(draw,/img\.src=FINAL_FOOD_IMAGE;\s*img\.style\.visibility='visible';/);

const nextStart=app.indexOf('function setFoodNextCardImage');
const nextEnd=app.indexOf('function populateFoodNextCard',nextStart);
assert(nextStart>=0&&nextEnd>nextStart,'next-card loader block found');
const next=app.slice(nextStart,nextEnd);
assert.match(next,/nextCard\.dataset\.foodImageReady='0';/);
assert.match(next,/img\.removeAttribute\('src'\);/);
assert.match(next,/img\.style\.visibility='hidden';/);
assert.match(next,/const promise=loadMealPhotoCandidates\(/);
assert.doesNotMatch(next,/const promise=Promise\.resolve\(true\);/);
assert.match(next,/nextCard\.dataset\.foodImageReady=ok\?'1':'-1'/);

const swipeStart=app.indexOf('function bindSwipeCard');
const swipeEnd=app.indexOf('function bindMealPhotoCountControls',swipeStart);
const swipe=app.slice(swipeStart,swipeEnd);
assert.match(swipe,/ensureFoodNextCardReady\(next\)\.then\(ok=>/);
assert.match(swipe,/if\(staticWaitingCard&&next\.dataset\.foodReady!=='1'\)/);

console.log('CP1161 meal card no-fallback-flash smoke: PASS');
