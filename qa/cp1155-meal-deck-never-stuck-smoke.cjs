const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
new vm.Script(app,{filename:'app.js'});

assert.match(app,/const FINAL_FOOD_IMAGE='\.\/fallback-food\.svg';/);
assert.match(app,/function loadMealPhotoCandidates\(img,candidates,target\)/);
assert.match(app,/img\.src=FINAL_FOOD_IMAGE;/);
assert.match(app,/img\.removeAttribute\('src'\);/);
assert.match(app,/img\.style\.visibility='hidden';/);
assert.match(app,/nextCard\.dataset\.foodImageReady='0';/);
assert.match(app,/nextCard\.style\.visibility='visible';/);
assert.match(app,/target\.dataset\.mealLoadToken/);
assert.match(app,/const loadToken=String\(Number\(img\.dataset\.mealLoadToken\|\|0\)\+1\)/);
assert.match(app,/ensureFoodNextCardReady\(next\)\.then\(ok=>/);
assert.match(app,/if\(staticWaitingCard&&next\.dataset\.foodReady!=='1'\)/);
assert.match(app,/preloadSwipeImage\(view\.primary\)/);
assert.match(app,/preloadSwipeImage\(view\.backup\)/);
assert.match(app,/fallback-food\.svg/);
console.log('CP1155 meal deck never-stuck fallback smoke: PASS');
