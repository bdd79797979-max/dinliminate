'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
const api=fs.readFileSync('api/restaurants.js','utf8');

assert.match(app,/async function searchRestaurants\(options=\{\}\)/);
assert.match(app,/S\.restaurantSearchRadius=radius/);
assert.match(app,/Number\(options\?\.radius \?\? \$\('radius'\)\?\.value\)/);
assert.match(app,/Number\(event\?\.currentTarget\?\.value\)\|\|10/);
assert.match(app,/searchRestaurants\(\{radius:selectedRadius\}\)/);
assert.match(app,/const returnedRadius=Number\(d\.radiusMiles\)/);
assert.match(app,/Restaurant search returned the wrong radius/);

assert.match(api,/const preliminarySearchMatches=searchTerm/);
assert.match(api,/preliminary\.filter\(row=>restaurantSearchMatches\(row,searchTerm\)\)\.length/);
assert.match(api,/if\(searchTerm && preliminarySearchMatches===0\)/);
assert.match(api,/googleSearchPlaces\(lat,lon,providerRadius,searchTerm\)/);
assert.match(api,/radius<=25\s*\n?\s*\? withinBudget\(overpass\(lat,lon,radius,'restaurant\|fast_food',searchTerm\)/);

for(const radius of [1,3,5,10,25,50,100]){
  assert.match(api,new RegExp('radius=clamp\\(q\\.get\\(\\'radius\\'\\)\\)'));
  assert.match(api,new RegExp('Math\.min\\(MAX_RADIUS,Math\.max\\(1'));
}

console.log('CP1158 restaurant location/search deep smoke: PASS');
