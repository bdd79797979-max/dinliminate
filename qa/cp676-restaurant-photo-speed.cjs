const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');

const photo=require('../api/restaurant-photo');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const photoText=fs.readFileSync(path.join(__dirname,'..','api','restaurant-photo.js'),'utf8');

assert.equal(typeof photo._test?.fastOfficialVenuePhoto,'function','fast official photo helper should exist');
assert.equal(typeof photo._test?.knownPublicPhotoPage,'function','known public photo hint helper should exist');
assert.equal(typeof photo._test?.knownRestaurantPhoto,'function','known restaurant photo helper should exist');
assert.equal(typeof photo._test?.fastKnownRestaurantPhoto,'function','fast known restaurant photo helper should exist');

assert(photo._test.knownRestaurantPhoto("Sweet P's Southern Style","3371 US-41 ALT, Clarksville, TN 37043")?.image?.includes('Sweet-Ps-Southern-Style_8c41d09a14d942d0ca25ab6076d3f05e.jpg'),'Sweet P should have a direct known venue photo');
assert(photo._test.knownRestaurantPhoto("Gray Smoke Barbecue","Clarksville, TN")?.image?.includes('90a3488a-0fdb-47fa-9c6d-e76837ebc263.jpg'),'Gray Smoke should have a direct known venue photo');
assert(photo._test.knownRestaurantPhoto("CAP’s Neighborhood Bar & Grill","2720 Madison St, Clarksville, TN 37043")?.image?.includes('CAPS-Neighborhood-Bar-Grill-7.jpg'),'CAPs should have a direct known venue photo');
assert.equal(photo._test.knownPublicPhotoPage('Excell Market & BBQ'),'https://www.visitclarksvilletn.com/listing/excell-bar-b-q/128/','Excell should have a verified fast public photo-page hint');

assert.match(app,/async function loadRestaurantPhoto\(row\)/,'shared restaurant photo loader should exist');
assert.match(app,/prefetchRestaurantPhotos\(rows,S\.restaurantIndex,RESTAURANT_PHOTO_PREFETCH_COUNT\)/,'restaurant card rendering should trigger photo prefetch');
assert.match(app,/const run=\(\)=>targets\.forEach\(row=>\{loadRestaurantPhoto\(row\)/,'prefetch should load rows without requiring DOM image elements');
assert.match(app,/"the thirsty goat":'https:\/\/www\.thirstygoatsango\.com'/,'Thirsty Goat official site hint should exist');
assert.match(app,/"sweet p's":'https:\/\/sweetpssouthernstyle\.com'/,'Sweet P official site hint should exist');
assert.match(app,/const KNOWN_RESTAURANT_PHOTO_FALLBACKS=/,'known restaurant photo fallbacks should exist');
assert.match(app,/"gray smoke barbecue":'https:\/\/graysmokebarbecue\.com\//,'Gray Smoke official site hint should exist');
assert.match(app,/"cap's neighborhood bar & grill":'https:\/\/capssangogrill\.com\//,'CAPs official site hint should exist');

assert.match(photoText,/site:visitclarksvilletn\.com/,'Visit Clarksville should be searched as a local photo discovery source');
assert.match(photoText,/site:clarksvillenow\.com/,'ClarksvilleNow should be searched as a local publication photo discovery source');

console.log('Restaurant photo discovery smoke: PASS');
