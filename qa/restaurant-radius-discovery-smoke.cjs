const assert=require('assert/strict');
const fs=require('fs'),vm=require('vm');
const apiSrc=fs.readFileSync('api/restaurants.js','utf8');
assert(apiSrc.includes("const API_VERSION='r26'"),'Restaurant API should report r25 after current radius discovery hardening');
assert(apiSrc.includes('WIDE_DISCOVERY_RESERVE_MS'),'Wide searches must reserve time for geographic discovery');
assert(apiSrc.includes('WIDE_PROVIDER_RADIUS_CAP=50'),'Wide primary providers must remain anchored to their 50-mile result envelope');
assert(apiSrc.includes('WIDE_PRIMARY_TIMEBOX_MS=10000'),'Wide primary providers need a full 10-second timebox');
assert(apiSrc.includes('WIDE_DISCOVERY_TIMEBOX_MS=10000'),'Wide discovery needs a full 10-second timebox');
assert(apiSrc.includes('WIDE_RADIUS_THRESHOLD=25'),'Wide discovery threshold should remain above 25 miles');
assert(apiSrc.includes('async function wideRadiusOverpass'),'Wide searches must use the multi-batch Overpass path');
assert(apiSrc.includes('async function overpassPoints'),'Overpass discovery should support independent geographic batches');
assert(apiSrc.includes("radius<=25 && primaryFastCount<3"),'Targeted fast-food fallback should stay bounded to local searches so it cannot starve wide discovery');
assert(apiSrc.includes("contactAllowed=!wideSearch"),'Wide-radius contact enrichment must not consume the reserved discovery budget');
assert(apiSrc.includes("const term=normalizeSearchQuery(searchTerm)"),'Overpass search must safely normalize its optional search term');

const context={module:{exports:{}},exports:{},require,process,fetch};
vm.runInNewContext(apiSrc,context,{filename:'api/restaurants.js'});
const t=context.module.exports._test||{};
assert.equal(typeof t.centers,'function');
assert.equal(typeof t.radiusDiscoveryPlan,'function');

const p25=t.radiusDiscoveryPlan(36.53,-87.34,25);
assert.equal(p25.mode,'nearby');
assert.equal(p25.reserveMs,0);
assert.equal(p25.groups.length,1);
assert.equal(p25.groups[0].length,1);
assert.equal(p25.groups[0][0].radius,25);

const p50=t.radiusDiscoveryPlan(36.53,-87.34,50);
assert.equal(p50.mode,'wide');
assert.equal(p50.reserveMs,1500);
assert.equal(p50.coveragePoints,1);
assert.equal(p50.groups.length,1);
assert.equal(p50.groups[0].length,1);
assert.equal(p50.groups[0][0].radius,50);

const p100=t.radiusDiscoveryPlan(36.53,-87.34,100); assert.equal(p100.mode,'wide'); assert.equal(p100.reserveMs,1500); assert.equal(p100.coveragePoints,13); assert.equal(p100.groups.length,4); assert.equal(JSON.stringify(p100.groups.map(g=>g.length)),JSON.stringify([4,4,4,1]),'100-mile discovery batch sizes'); assert(p100.groups.flat().every(x=>x.radius===50),'100-mile discovery must use overlapping <=50-mile provider circles'); assert(apiSrc.includes('const providerRadius=wideSearch?Math.min(radius,WIDE_PROVIDER_RADIUS_CAP):radius'),'100-mile provider searches must stay inside the 50-mile provider envelope'); assert(apiSrc.includes('const endpointPairs=plan.groups.map'),'Wide discovery must assign redundant Overpass endpoint pairs'); assert(apiSrc.includes('OVERPASS[(i+1)%OVERPASS.length]'),'Wide discovery must use a second mirror per geographic batch');
console.log('restaurant radius discovery smoke: PASS');
