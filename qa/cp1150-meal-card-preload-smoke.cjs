const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');

new vm.Script(app,{filename:'app.js'});
assert.equal((app.match(/function foodPhotoFallback\(/g)||[]).length,1,'foodPhotoFallback must have one definition');
assert.match(app,/const preparedFoodSwipeCards=new Map\(\)/);
assert.match(app,/function nextFoodIndexList\(/);
assert.match(app,/function buildPreparedFoodCard\(/);
assert.match(app,/function populateFoodNextCard\(/);
assert.match(app,/function ensureFoodNextCardReady\(/);
assert.match(app,/preloadSwipeImage\(view\.primary\)/);
assert.match(app,/preloadSwipeImage\(view\.backup\)/);
assert.match(app,/ensureFoodNextCardReady\(waiting\)/);
assert.doesNotMatch(app,/foodSwipeCardWarmHost/);
assert.doesNotMatch(app,/swipeCardLayoutPreloads/);
assert.match(html,/id="foodNextCard"[^>]*aria-hidden="true"/);
assert.match(html,/class="[^"]*next-food-img[^"]*"/);
assert.match(html,/class="[^"]*next-food-cat[^"]*"/);
assert.match(html,/class="[^"]*next-food-name[^"]*"/);
console.log('CP1150 meal-card preload smoke: PASS');
