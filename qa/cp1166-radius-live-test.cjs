'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/restaurants.js');

const lat=36.5298, lon=-87.3595;
const radii=[1,3,5,10,25,50,100];

function runSearch(radius){
  return new Promise((resolve,reject)=>{
    const req={method:'GET',query:{mode:'search',lat:String(lat),lon:String(lon),radius:String(radius),q:''},headers:{}};
    let statusCode=200;
    const res={
      status(code){statusCode=code;return this;},
      setHeader(){return this;},
      json(body){resolve({statusCode,body});return this;}
    };
    Promise.resolve(handler(req,res)).catch(reject);
  });
}

(async()=>{
  const results=[];
  for(const radius of radii){
    const out=await runSearch(radius);
    assert.equal(out.statusCode,200,JSON.stringify(out.body));
    assert.equal(out.body.ok,true);
    assert.equal(Number(out.body.radiusMiles),radius);
    for(const row of out.body.results||[]){
      assert.ok(Number(row.distance)<=radius+0.01,
        radius+'mi returned out-of-radius restaurant: '+row.name+' at '+row.distance);
    }
    results.push(out.body);
    console.log(JSON.stringify({
      radius,
      total:out.body.total,
      fastFood:out.body.fastFoodCount,
      discoveryMode:out.body.discoveryMode,
      coveragePoints:out.body.discoveryCoveragePoints,
      discoveryGroups:out.body.discoveryGroups,
      providerRadius:out.body.providerSearchRadiusMiles,
      providers:out.body.providers,
      latencyMs:out.body.searchLatencyMs,
      errors:out.body.providerErrors
    }));
  }

  const byRadius=Object.fromEntries(results.map(x=>[Number(x.radiusMiles),x.total]));
  const suspiciousPairs=[[1,3],[3,5],[5,10],[10,25],[25,50],[50,100]].filter(([a,b])=>byRadius[a]===byRadius[b]);
  console.log('RADIUS_COUNTS='+JSON.stringify(byRadius));
  console.log('SUSPICIOUS_REPEATS='+JSON.stringify(suspiciousPairs));
  if(suspiciousPairs.length){
    console.warn('Radius regression warning: identical counts at '+JSON.stringify(suspiciousPairs));
  }
  const wide50=results.find(x=>x.radiusMiles===50),wide100=results.find(x=>x.radiusMiles===100);
  assert.equal(wide50.discoveryMode,'nearby');
  assert.equal(wide50.providerSearchRadiusMiles,50);
  assert.equal(wide100.discoveryMode,'wide');
  assert.equal(wide100.providerSearchRadiusMiles,50);
  assert.ok(Number(wide100.discoveryCoveragePoints)>=9);
  console.log('LIVE RADIUS TEST: PASS (distance filtering + radius expansion architecture validated)');
})().catch(err=>{console.error(err);process.exit(1);});
