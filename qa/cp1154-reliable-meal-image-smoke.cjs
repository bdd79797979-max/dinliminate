const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const app=fs.readFileSync('app.js','utf8');
const foodsSource=fs.readFileSync('data/foods.js','utf8');

new vm.Script(app,{filename:'app.js'});
const match=foodsSource.match(/^window\.DINLIMINATE_FOODS=(.*);$/s);
assert.ok(match,'foods.js must expose DINLIMINATE_FOODS');
const foods=JSON.parse(match[1]);

assert.equal(foods.length,117,'Built-in meal catalog count changed unexpectedly');
assert.ok(foods.every(x=>x&&x.id&&x.name),'Every built-in meal must have an id and name');
assert.ok(foods.every(x=>typeof x.image==='string'&&/^https:\/\//.test(x.image)),'Every built-in meal must keep an external HTTPS image URL');
assert.equal((foodsSource.match(/data:image\//gi)||[]).length,0,'Meal catalog must not embed image bytes');
assert.equal((foodsSource.match(/\b(?:blob|idb):/gi)||[]).length,0,'Meal catalog must not store local image blobs/IDs');

assert.match(app,/function mealImageSources\(item\)/);
assert.match(app,/add\(item\?\.officialImage\)/);
assert.match(app,/add\(item\?\.backupImage\)/);
assert.match(app,/add\(item\?\.image\)/);
assert.match(app,/function foodPhoto\(item\)\{return mealImageSources\(item\)\[0\]\|\|'';\}/);
assert.match(app,/function foodPhotoFallback\(item\)\{return mealImageSources\(item\)\[1\]\|\|'';\}/);
assert.match(app,/for\(const src of view\.sources\)preloadSwipeImage\(src\);/);
assert.match(app,/function preloadSwipeImage\(src\)/);
assert.match(app,/const record=\{img,promise,ok:null\};/);
assert.match(app,/async function setFoodNextCardImage\(nextCard,view\)/);
assert.match(app,/const sources=Array\.isArray\(view\?\.sources\)&&view\.sources\.length/);
assert.match(app,/if\(!record\?\.ok\)continue;/);
assert.doesNotMatch(app,/foodQuickImage\(.*\).*foodPhoto/);
assert.equal((app.match(/function foodPhotoFallback\(/g)||[]).length,1,'Only one meal fallback resolver may exist');

console.log('CP1154 reliable meal image system smoke: PASS');
console.log(JSON.stringify({
 meals:foods.length,
 officialImages:foods.filter(x=>x.officialImage).length,
 embeddedImageBytes:0,
 storedBuiltInImageBlobs:0,
 sourcePolicy:'official -> exact backup(s) -> meal image',
 runtimeStoragePolicy:'URLs only; image bytes are not bundled or persisted by meal catalog'
},null,2));
