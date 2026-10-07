// CP1183: independent 25/50 radius provider search regression checks.
const assert=require('node:assert');
const fs=require('node:fs');
const api=fs.readFileSync(require.resolve('../api/restaurants.js'),'utf8');
assert.ok(api.includes('const providerRadius=wideSearch'),'providerRadius logic missing');
assert.ok(api.includes(': radius>=25'),'25/50 branch missing');
assert.ok(api.includes('Math.min(radius,WIDE_PROVIDER_RADIUS_CAP)'),'25/50 provider radius cap missing');
assert.ok(api.includes("const API_VERSION='r43'"),'API version should advance for CP1183');
assert.ok(api.includes('photonRadiusExpansion(lat,lon,radius,searchTerm)'),'Photon expansion should remain supplemental');
assert.ok(api.includes('radius<=50 ? radiusOverpassExpansion'),'Overpass expansion should remain supplemental for 25/50');
console.log('CP1183 independent radius smoke passed');
