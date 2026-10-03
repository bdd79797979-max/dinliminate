const assert=require('assert/strict');
const handler=require('../api/restaurants.js');

function fakeResponse(body,status=200){
  return {ok:status>=200&&status<300,status,statusText:'OK',text:async()=>JSON.stringify(body)};
}
async function call(query,ip){
  let status=200,body=null;
  await handler({url:'/?'+new URLSearchParams(query).toString(),headers:{'x-forwarded-for':ip}},{
    setHeader(){},
    status(code){status=code;return this;},
    json(payload){body=payload;return this;}
  });
  return {status,body};
}

(async()=>{
 const original=global.fetch;
 global.fetch=async url=>{
   const u=String(url);
   if(u.includes('photon.komoot.io')) return fakeResponse({type:'FeatureCollection',features:[]});
   if(u.includes('geocode.arcgis.com')) return fakeResponse({candidates:[]});
   if(u.includes('api.open-meteo.com')) return fakeResponse({timezone:'America/Chicago'});
   throw new Error('simulated provider outage');
 };
 const partial=await call({mode:'search',lat:36.5304,lon:-87.3601,radius:'10'},'qa-partial');
 assert.equal(partial.status,200);
 assert.equal(partial.body.ok,true);
 assert.equal(partial.body.total,0);
 assert.ok(Array.isArray(partial.body.providerErrors) && partial.body.providerErrors.length>0,'partial provider failure should be reported');
 global.fetch=async()=>{throw new Error('simulated total provider outage')};
 const all=await call({mode:'search',lat:36.5304,lon:-87.3601,radius:'11'},'qa-all');
 assert.equal(all.status,502);
 assert.equal(all.body.ok,false);
 global.fetch=original;
 console.log('restaurant provider failure smoke: PASS');
})().catch(err=>{global.fetch=global.__originalFetch||global.fetch;console.error(err);process.exit(1)});
