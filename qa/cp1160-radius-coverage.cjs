'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const api=fs.readFileSync('api/restaurants.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const restaurants=require('../api/restaurants');

assert.match(api,/const API_VERSION='r37'/);
assert.match(api,/const RADIUS_DISCOVERY_THRESHOLD=10/);
assert.match(api,/const RADIUS_DISCOVERY_TIMEBOX_MS=3200/);
assert.match(api,/const WIDE_OVERPASS_RING_MILES=63/);
assert.match(api,/const WIDE_OVERPASS_RING_POINTS=8/);
assert.match(api,/const WIDE_OVERPASS_GROUP_SIZE=3/);
assert.match(api,/radius>=RADIUS_DISCOVERY_THRESHOLD/);
assert.match(api,/withinBudget\(overpass\(lat,lon,radius,'restaurant\\|fast_food',searchTerm\),RADIUS_DISCOVERY_TIMEBOX_MS/);
assert.match(api,/providerExpansionPoints:wideSearch\?WIDE_OVERPASS_RING_POINTS\+1:1/);
assert.match(api,/\.filter\(r=>Number\.isFinite\(r\.distance\)&&r\.distance<=radius\+0\.001\)/);
assert.doesNotMatch(api,/withinBudget\(photonWidePlaces\(lat,lon,radius,searchTerm\),WIDE_PRIMARY_TIMEBOX_MS,'Wide Photon lookup timed out'\)/);

const centers=restaurants._test.centers;
for(const radius of [1,3,5,10,25,50]){
  assert.equal(centers(36.5298,-87.3595,radius).length,1,'radius '+radius+' should use one local discovery circle');
}
assert.equal(centers(36.5298,-87.3595,100).length,9,'100-mile radius should use center + 8 overlapping coverage circles');

function haversineMiles(a,b,c,d){
  const R=3958.7613,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p;
  const z=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;
  return 2*R*Math.asin(Math.sqrt(z));
}
const cov=centers(36.5298,-87.3595,100);
for(let deg=0;deg<360;deg+=15){
  const angle=deg*Math.PI/180;
  const lat=36.5298+Math.sin(angle)*(100/69);
  const lon=-87.3595+Math.cos(angle)*(100/(69*Math.cos(36.5298*Math.PI/180)));
  const nearest=Math.min(...cov.map(p=>haversineMiles(lat,lon,p.lat,p.lon)));
  assert.ok(nearest<=50.5,'100-mile boundary gap detected at '+deg+'° ('+nearest.toFixed(2)+' mi)');
}

assert.match(app,/const radius = Math\.min\(100,Math\.max\(1/);
assert.match(app,/S\.restaurantSearchRadius=radius/);

console.log('CP1160 radius coverage regression: PASS');
