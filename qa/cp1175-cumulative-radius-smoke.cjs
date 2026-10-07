'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
const api=fs.readFileSync('api/restaurants.js','utf8');

assert.match(api,/const providerRadius=wideSearch\?WIDE_PROVIDER_RADIUS_CAP:10;/,
  'All non-wide searches must use the stable 10-mile provider core.');
assert.match(api,/function radiusExpansionSpec\(radius\)/,
  'Radius-specific expansion must exist.');
assert.match(api,/if\(r<=25\)return \{tile:15,ring:15,count:6\};/,
  '25-mile searches must use a dedicated 15-mile tile expansion.');
assert.match(api,/if\(r<=50\)return \{tile:30,ring:30,count:6\};/,
  '50-mile searches must use a dedicated 30-mile tile expansion.');
assert.match(api,/return \{tile:50,ring:60,count:10\};/,
  '100-mile searches must use a dedicated 50-mile tile expansion.');
assert.match(api,/function photonRadiusExpansion\(lat,lon,radius,searchTerm=''\)/,
  'Photon radius expansion must be available.');
assert.match(api,/photonRow\(feature,\{lat:originLat,lon:originLon\}\)/,
  'Expansion results must calculate distance from the true search origin.');
assert.match(api,/row\.distance<=selectedRadius/,
  'Expansion results must be filtered to the exact user-selected radius.');
assert.match(api,/const discoveryPromise=radius>10/,
  '25/50/100-mile searches must actually invoke radius expansion.');
assert.match(api,/const RADIUS_EXPANSION_QUERY_TIMEOUT_MS=3200;/,
  'Radius expansion timeout must be explicitly defined.');
assert.match(api,/RADIUS_EXPANSION_QUERY_TIMEOUT_MS/,
  'Radius expansion must use the defined timeout constant.');

assert.match(app,/const priorPool=sameLocationQuery/,
  'The client must retain previously discovered restaurants for the same location/query.');
assert.match(app,/const mergedRows=sameLocationQuery\?\[\.\.\.priorPool,\.\.\.incomingRows\]/,
  'Increasing radius must merge new results into the existing pool.');
assert.match(app,/dedupeRestaurantPool\(mergedRows\)\.filter/,
  'Merged radius results must still be deduped and distance-filtered.');

console.log('CP1175 cumulative radius smoke: PASS');
