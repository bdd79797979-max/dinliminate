'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/restaurants.js');
const lat=36.5298,lon=-87.3595,radii=[1,3,5,10,25,50,100];

async function search(radius){
 return new Promise((resolve,reject)=>{
  const req={method:'GET',query:{mode:'search',lat:String(lat),lon:String(lon),radius:String(radius),q:''},headers:{}};
  let status=200;
  const res={status(c){status=c;return this;},setHeader(){return this;},json(body){resolve({status,body});return this;}};
  Promise.resolve(handler(req,res)).catch(reject);
 });
}
(async()=>{
 const counts={};const duplicatePairs=[];
 for(const radius of radii){
  const out=await search(radius);
  assert.equal(out.status,200,JSON.stringify(out.body));
  assert.equal(out.body.ok,true);
  assert.equal(Number(out.body.radiusMiles),radius);
  assert.equal(Number(out.body.total),new Set((out.body.results||[]).map(r=>r.id)).size,'duplicate ids at '+radius+'mi');
  for(const row of out.body.results||[])assert.ok(Number(row.distance)<=radius+0.01, radius+'mi returned '+row.name+' at '+row.distance+'mi');
  counts[radius]=Number(out.body.total);
  console.log(JSON.stringify({radius,total:out.body.total,fastFood:out.body.fastFoodCount,mode:out.body.discoveryMode,coverage:out.body.discoveryCoveragePoints,groups:out.body.discoveryGroups,providerRadius:out.body.providerSearchRadiusMiles,providers:out.body.providers,latencyMs:out.body.searchLatencyMs,errors:out.body.providerErrors}));
 }
 for(let i=1;i<radii.length;i++)if(counts[radii[i]]===counts[radii[i-1]])duplicatePairs.push([radii[i-1],radii[i]]);
 console.log('RADIUS_COUNTS='+JSON.stringify(counts));
 console.log('IDENTICAL_ADJACENT_COUNTS='+JSON.stringify(duplicatePairs));
 assert.equal((await search(100)).body.discoveryCoveragePoints,9,'CP1165 should have 9-point wide coverage');
 assert.equal((await search(100)).body.providerSearchRadiusMiles,50,'CP1165 100mi provider envelope should cap at 50');
 console.log('CP1165 LIVE RADIUS TEST: PASS');
})().catch(e=>{console.error(e);process.exit(1);});
