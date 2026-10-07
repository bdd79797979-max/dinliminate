'use strict';
const assert=require('node:assert/strict');
const handler=require('../api/restaurants.js');
const lat=36.5298,lon=-87.3595;
function run(radius){
 return new Promise((resolve,reject)=>{
  const req={query:{mode:'search',lat:String(lat),lon:String(lon),radius:String(radius)}};
  const res={_status:200,status(code){this._status=code;return this;},setHeader(){},json(payload){if(this._status>=400)reject(new Error(JSON.stringify(payload)));else resolve(payload);}};
  Promise.resolve(handler(req,res)).catch(reject);
 });
}
(async()=>{
 const radii=[1,3,5,10,25,50,100],out=[];
 for(const radius of radii){
  const data=await run(radius);
  assert.equal(data.ok,true,'radius '+radius+' should succeed');
  assert.equal(data.radiusMiles,radius); assert.ok(Array.isArray(data.results));
  const seen=new Set();
  for(const row of data.results){
   assert.ok(Number(row.distance)<=radius+0.001,'out-of-radius row at '+radius+': '+row.name+' '+row.distance);
   const key=String(row.id||''); assert.ok(!seen.has(key),'duplicate id '+key+' at '+radius); seen.add(key);
  }
  out.push({radius:radius,total:data.total,fastFood:data.fastFoodCount,latencyMs:data.searchLatencyMs,discoveryMode:data.discoveryMode,groups:data.discoveryGroups,coverage:data.discoveryCoveragePoints,overpass:data.providers?.overpass||0,providerErrors:data.providerErrors||[]});
 }
 for(let i=1;i<out.length;i++) assert.ok(out[i].total>=out[i-1].total,'radius counts must not shrink: '+out[i-1].radius+'mi='+out[i-1].total+', '+out[i].radius+'mi='+out[i].total);
 for(const row of out.filter(x=>x.radius>=25)){
  assert.ok(row.groups>=3,'radius '+row.radius+' should use multiple geographic batches');
  assert.ok(row.coverage>=7,'radius '+row.radius+' should expose deterministic coverage points');
  assert.ok(!row.providerErrors.some(e=>/Radius discovery timed out|Wide radius discovery timed out/i.test(String(e))),'radius '+row.radius+' must not report a discovery timeout');
 }
 console.log(JSON.stringify({ok:true,radii:out},null,2));
})().catch(err=>{console.error(err.stack||err);process.exit(1)});