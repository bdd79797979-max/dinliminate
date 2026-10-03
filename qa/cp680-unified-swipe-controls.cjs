const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');

const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');

function controls(source,mode){
  const marker=mode==='food'
    ? '<div class="swipe-actions unified-swipe-actions" aria-label="Meal decision controls">'
    : '<div class="swipe-actions unified-swipe-actions" aria-label="Restaurant decision controls">';
  const start=source.indexOf(marker);
  assert.ok(start>=0,mode+' unified swipe rail must exist');
  const end=source.indexOf('</div>',start)+6;
  return source.slice(start,end);
}

const food=controls(index,'food');
assert.deepEqual(
  [...food.matchAll(/id="([^"]+)"/g)].map(m=>m[1]),
  ['foodBack','foodCut','foodMaybe','foodMaybeDeck'],
  'Meal buttons must be Back, Cut, Maybe, Show/Maybe in that order'
);
assert.equal(food.includes('foodHide'),false,'Meal Hide must not be on the bottom rail');
assert.equal(food.includes('addFood'),false,'Add Meal must not be on the bottom rail');

const restMarker='<div class="swipe-actions unified-swipe-actions" aria-label="Restaurant decision controls">';
const restStart=app.indexOf(restMarker);
assert.ok(restStart>=0,'Restaurant unified swipe rail must be rendered dynamically');
const restEnd=app.indexOf("';",restStart);
const rest=app.slice(restStart,restEnd);
assert.deepEqual(
  ['restBack','restCut','restMaybe','restaurantMaybeDeck'].map(id=>rest.indexOf('id="'+id+'"')),
  [0,1,2,3].map(i=>i>=0),
  'Restaurant rail IDs must all be present'
);
assert.ok(rest.indexOf('id="restBack"')<rest.indexOf('id="restCut"'),'Restaurant Back must precede Cut');
assert.ok(rest.indexOf('id="restCut"')<rest.indexOf('id="restMaybe"'),'Restaurant Cut must precede Maybe');
assert.ok(rest.indexOf('id="restMaybe"')<rest.indexOf('id="restaurantMaybeDeck"'),'Restaurant Maybe must precede Show/Maybe');
assert.equal(rest.includes('restHide'),false,'Restaurant Hide must not be on the bottom rail');

assert.equal(app.includes("$('foodHide').onclick"),false,'Stale Meal Hide startup binding must be removed');
assert.equal(app.includes("$('addFood').onclick"),false,'Stale Add Meal startup binding must be removed');
assert.equal(app.includes("bindCardButton('restHide'"),false,'Stale Restaurant Hide card binding must be removed');

assert.match(app,/id="detailHide".*Hide this meal/s,'Meal Details must contain Hide this meal with its icon');
assert.match(app,/id="detailHideRestaurant".*Hide this restaurant/s,'Restaurant Details must contain Hide this restaurant with its icon');
assert.match(app,/detailHideRestaurant.*restaurantHide(item)/s,'Restaurant Details hide must call restaurantHide');
assert.match(app,/detailHide.*foodHideItem(item)/s,'Meal Details hide must call foodHideItem');

assert.match(css,/.unified-swipe-actions{/, 'Unified swipe rail CSS must exist');
assert.match(css,/justify-content:center!important;/, 'Unified swipe rail must be centered');
assert.match(css,/.unified-swipe-actions .round-cut,\n.unified-swipe-actions .round-maybe\{[\s\S]*width:60px/, 'Cut and Maybe must be larger');
assert.match(css,/.detail-hide-icon{/, 'Details hide icon styling must exist');

console.log('CP680 unified swipe controls QA: PASS');
