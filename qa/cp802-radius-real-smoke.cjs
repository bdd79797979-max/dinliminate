const assert=require('node:assert/strict');
const handler=require('../api/restaurants.js');

function call(url){
  return new Promise((resolve,reject)=>{
    const req={method:'GET',url};
    const res={
      status(code){this.statusCode=code;return this;},
      json(payload){resolve({status:this.statusCode||200,data:payload});},
      setHeader(){}
    };
    Promise.resolve(handler(req,res)).catch(reject);
  });
}
function key(row){
  return String(row.name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
(async()=>{
 const lat=36.5298,lon=-87.3595;
 const r50=await call('/api/restaurant-search?mode=search&lat='+lat+'&lon='+lon+'&radius=50');
 assert.equal(r50.status,200,'50-mile search must return HTTP 200');
 assert.equal(r50.data.ok,true,'50-mile search must succeed');
 const r100=await call('/api/restaurant-search?mode=search&lat='+lat+'&lon='+lon+'&radius=100');
 assert.equal(r100.status,200,'100-mile search must return HTTP 200');
 assert.equal(r100.data.ok,true,'100-mile search must succeed');
 assert.equal(r100.data.radiusMiles,100);
 assert.equal(r50.data.radiusMiles,50);
 const core50=r50.data.results.filter(x=>Number(x.distance)<=50.001);
 const core100=r100.data.results.filter(x=>Number(x.distance)<=50.001);
 const outer100=r100.data.results.filter(x=>Number(x.distance)>50.001&&Number(x.distance)<=100.001);
 const names50=new Set(core50.map(key).filter(Boolean));
 const names100=new Set(core100.map(key).filter(Boolean));
 let shared=0; for(const n of names50)if(names100.has(n))shared++;
 const retention=names50.size?shared/names50.size:1;
 assert.ok(core50.length>0,'50-mile search must have core results');
 assert.ok(core100.length>0,'100-mile search must retain 50-mile core results');
 assert.ok(outer100.length>0,'100-mile search must add restaurants beyond 50 miles');
 assert.ok(retention>=0.50,'100-mile search must retain at least half of the 50-mile restaurant-name core; actual retention='+retention.toFixed(2));
 assert.ok(r100.data.discoveryMode==='wide','100-mile search must use wide discovery');
 assert.ok(Number(r100.data.providerSearchRadiusMiles)<=50,'Provider core radius must remain capped at 50 miles');
 console.log(JSON.stringify({
   ok:true,
   r50Total:r50.data.total,
   r100Total:r100.data.total,
   core50:core50.length,
   core100:core100.length,
   outer100:outer100.length,
   nameRetention:+retention.toFixed(3),
   wideProviders:r100.data.providers,
   errors:r100.data.providerErrors
 },null,2));
})().catch(err=>{console.error(err.stack||err);process.exit(1);});
