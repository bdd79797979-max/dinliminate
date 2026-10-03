const handler=require('../api/restaurants.js');
function call(query){
  return new Promise((resolve,reject)=>{
    let out={statusCode:200,body:null};
    const res={status(code){out.statusCode=code;return res},json(body){out.body=body;resolve(out);return res}};
    Promise.resolve(handler({url:'/?'+new URLSearchParams(query).toString(),headers:{}},res)).catch(reject);
  });
}
(async()=>{
 const health=await call({mode:'health'});
 if(health.statusCode!==200||!health.body?.ok||health.body.version!=='r27')throw new Error('health failed: '+JSON.stringify(health.body));
 const suggestion=await call({mode:'suggest',q:'37040'});
 if(suggestion.statusCode!==200||!suggestion.body?.ok||!suggestion.body.results?.length)throw new Error('address suggestions failed');
 const resolved=await call({mode:'resolve',q:'Clarksville, TN 37040'});
 if(resolved.statusCode!==200||!resolved.body?.ok)throw new Error('address resolve failed: '+JSON.stringify(resolved.body));
 const search=await call({mode:'search',lat:resolved.body.lat,lon:resolved.body.lon,radius:'10'});
 if(search.statusCode!==200||!search.body?.ok)throw new Error('restaurant search failed: '+JSON.stringify(search.body));
 if(search.body.version!=='r27')throw new Error('search version mismatch: '+search.body.version);
 if(typeof search.body.timezone!=='string')throw new Error('search timezone field missing');
 const falseFast=(search.body.results||[]).filter(x=>/(ruby tuesday|applebee|chili.?s|olive garden|longhorn|outback|cracker barrel|texas roadhouse|red lobster|panera)/i.test(String(x.name||''))&&x.fastFood);
 if(falseFast.length)throw new Error('full-service chain incorrectly classified as fast food: '+falseFast.map(x=>x.name).join(', '));
 if(Number(search.body.fastFoodCount)>=2 && Number(search.body.providers?.overpass||0)!==0)throw new Error('Overpass should not run when primary providers already return multiple fast-food results');
 if(!Array.isArray(search.body.results))throw new Error('restaurant results missing');
 if(!(Number(search.body.fastFoodCount)>=1))throw new Error('live restaurant search returned no fast-food results: '+JSON.stringify({total:search.body.total,fastFoodCount:search.body.fastFoodCount,providers:search.body.providers}));
 const badCoords=await call({mode:'search',lat:999,lon:-87,radius:'10'}); if(badCoords.statusCode!==400)throw new Error('invalid latitude should return 400');
 const exact=await call({mode:'resolve',q:'801 Iron Workers Rd, Clarksville, TN 37043'});
 if(exact.statusCode!==200||!exact.body?.ok)throw new Error('Iron Workers address resolve failed: '+JSON.stringify(exact.body));
 const local=await call({mode:'search',lat:exact.body.lat,lon:exact.body.lon,radius:'10'});
 const localNameList=(local.body.results||[]).map(x=>String(x.name||''));
 const family=(name)=>String(name||'').toLowerCase().replace(/[’']s\\b/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\\s+/g,' ').trim();
 const ironPairs=[];
 for(let i=0;i<localNameList.length;i++)for(let j=i+1;j<localNameList.length;j++){
   const aa=family(localNameList[i]),bb=family(localNameList[j]);
   const xi=local.body.results[i],xj=local.body.results[j];
   const dt=(Number.isFinite(xi.lat)&&Number.isFinite(xi.lon)&&Number.isFinite(xj.lat)&&Number.isFinite(xj.lon))?Math.hypot((xi.lat-xj.lat)*69,(xi.lon-xj.lon)*55):999;
   if(dt<=0.2 && ((aa.includes('head')&&aa.includes('bbq')&&bb.includes('head')&&bb.includes('bbq')) || (aa.includes('chris')&&aa.includes('pizza')&&bb.includes('chris')&&bb.includes('pizza')))) ironPairs.push([localNameList[i],localNameList[j],dt]);
 }
 if(ironPairs.length) throw new Error('Iron Workers duplicate restaurant records remain: '+JSON.stringify(ironPairs));
 if(local.statusCode!==200||!local.body?.ok)throw new Error('Iron Workers restaurant search failed: '+JSON.stringify(local.body));
 const localNames=(local.body.results||[]).map(x=>String(x.name||'').toLowerCase());
 const required=['ruby tuesday','chipotle','thirsty goat'];
 for(const name of required) if(!localNames.some(x=>x.includes(name))) throw new Error('Iron Workers search missing '+name+': '+JSON.stringify({total:local.body.total,names:localNames.slice(0,80),providers:local.body.providers}));
 const tight=await call({mode:'search',lat:resolved.body.lat,lon:resolved.body.lon,radius:'1'}); if(tight.statusCode!==200||!tight.body?.ok||tight.body.radiusMiles!==1)throw new Error('1-mile radius failed: '+JSON.stringify(tight.body));
 const wide=await call({mode:'search',lat:resolved.body.lat,lon:resolved.body.lon,radius:'50'}); if(wide.statusCode!==200||!wide.body?.ok||wide.body.radiusMiles!==50)throw new Error('50-mile radius failed: '+JSON.stringify(wide.body));
 
 const radiusCoverage=handler._test?.centers;
 if(typeof radiusCoverage!=='function')throw new Error('radius coverage test hook missing');
 const centers50=radiusCoverage(36.5304,-87.3601,50);
 if(centers50.length!==1)throw new Error('50-mile search should use the requested 50-mile origin coverage circle');
 if(!centers50.every(p=>Number(p.radius)===50))throw new Error('50-mile coverage circles must each be 50 miles');
 const radiusChecks=[];
 const radiusTotals=[];
 for(const radius of [1,3,5,10,25,50,100]){
   const rr=await call({mode:'search',lat:36.5304,lon:-87.3601,radius:String(radius)});
   if(rr.statusCode!==200||!rr.body?.ok||rr.body.radiusMiles!==radius)throw new Error('radius contract failed at '+radius+'mi: '+JSON.stringify(rr.body));
   const outOfRange=(rr.body.results||[]).filter(x=>Number(x.distance)>radius+0.2);
   if(outOfRange.length)throw new Error('radius leakage at '+radius+'mi: '+outOfRange.slice(0,3).map(x=>x.name).join(', '));
   if(!(Number(rr.body.fastFoodCount)>=1))throw new Error('fast food missing at '+radius+'mi');
   const signatures=(rr.body.results||[]).map(x=>String(x.name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+'|'+String(x.address||'').toLowerCase().replace(/\b(street|road|avenue|boulevard)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim());
   const duplicateSignatures=signatures.filter((x,i,a)=>a.indexOf(x)!==i);
   if(duplicateSignatures.length)throw new Error('duplicate venue signatures at '+radius+'mi: '+duplicateSignatures.slice(0,3).join(' · '));
   radiusChecks.push({radius,total:rr.body.total,fastFoodCount:rr.body.fastFoodCount});
   radiusTotals.push({radius,total:Number(rr.body.total)||0});
 }
 const radiusDrops=radiusTotals.filter((x,i)=>i>0&&x.total<radiusTotals[i-1].total).map((x,i)=>({from:radiusTotals[i].radius,to:x.radius,fromTotal:radiusTotals[i].total,toTotal:x.total}));
 if(radiusDrops.length) console.warn('Provider result counts varied across larger radius requests; distance filtering and radius contract remain enforced:',JSON.stringify(radiusDrops));

 console.log(JSON.stringify({health:health.body,suggestions:suggestion.body.results.length,resolved:resolved.body.display,restaurantCount:search.body.total,fastFoodCount:search.body.fastFoodCount,providers:search.body.providers,ironWorkers:{display:exact.body.display,total:local.body.total,names:(local.body.results||[]).filter(x=>required.some(n=>String(x.name||'').toLowerCase().includes(n))).map(x=>x.name)}}));
})().catch(err=>{console.error(err);process.exit(1)});
