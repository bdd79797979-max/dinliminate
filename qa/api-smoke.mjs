const fs=require('fs');
const vm=require('vm');
const assert=require('assert/strict');

(async()=>{

const source=fs.readFileSync('api/restaurants.js','utf8');

function loadWithFetch(fetchImpl){
  const sandbox={
    module:{exports:{}},
    exports:{},
    fetch:fetchImpl,
    AbortController,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    console
  };
  vm.runInNewContext(source,sandbox,{filename:'api/restaurants.js'});
  return sandbox.module.exports;
}

function resCapture(){
  return {
    statusCode:200,
    body:null,
    status(code){this.statusCode=code;return this;},
    json(body){this.body=body;return body;}
  };
}

function feature(name,lat,lon,props={}){
  return {type:'Feature',geometry:{type:'Point',coordinates:[lon,lat]},properties:{name,...props}};
}

const baseFeature = feature('Neighborhood Grill',36.5,-87.3,{osm_key:'amenity',osm_value:'restaurant',cuisine:'american'});
const fastFeature = feature("McDonald's",36.51,-87.31,{osm_key:'amenity',osm_value:'fast_food',brand:"McDonald's"});

async function okResponse(body){return {ok:true,status:200,text:async()=>JSON.stringify(body)};}

let calls=[];
const api=loadWithFetch(async(url)=>{
  calls.push(url);
  if(url.includes('photon.komoot.io')){
    if(url.includes('q=restaurant')) return okResponse({features:[baseFeature]});
    if(url.includes('q=fast+food')) return okResponse({features:[]});
    return okResponse({features:[]});
  }
  if(url.includes('overpass')){
    const query=decodeURIComponent(url.split('data=')[1]||'');
    if(query.includes('amenity="fast_food"')) return okResponse({elements:[{type:'node',id:77,lat:36.51,lon:-87.31,tags:{name:"McDonald's",amenity:'fast_food'}}]});
    return okResponse({elements:[]});
  }
  throw new Error('unexpected URL '+url);
});

let res=resCapture();
await api({query:{mode:'health'},headers:{'x-forwarded-for':'qa-health'}},res);
assert.equal(res.statusCode,200);
assert.equal(res.body.version,'r19');
assert.equal(res.body.maxRadiusMiles,50);

res=resCapture();
await api({query:{mode:'search',lat:'36.5',lon:'-87.3',radius:'10'},headers:{'x-forwarded-for':'qa-search'}},res);
assert.equal(res.statusCode,200);
assert.equal(res.body.fastFoodCount,1,'fast-food fallback should supplement restaurant results');
assert.ok(res.body.results.some(x=>x.fastFood&&x.name.includes("McDonald")),'fallback should include McDonald\'s');
assert.equal(res.body.radiusMiles,10);

calls=[];
const apiWide=loadWithFetch(async(url)=>{
  calls.push(url);
  if(url.includes('photon.komoot.io')) {
    if(url.includes('q=restaurant')) return okResponse({features:[feature('Burger King',40,-80,{osm_key:'amenity',osm_value:'restaurant',brand:"Wendy's"})]});
    if(url.includes('q=fast+food')) return okResponse({features:[]});
    return okResponse({features:[]});
  }
  throw new Error('wide search should not need Overpass when Photon has restaurant results');
});
res=resCapture();
await apiWide({query:{mode:'search',lat:'40',lon:'-80',radius:'50'},headers:{'x-forwarded-for':'qa-wide'}},res);
assert.equal(res.statusCode,200);
assert.equal(res.body.radiusMiles,50);
assert.equal(res.body.results[0].photo.includes('1572802419224'),'Burger King name mapping should win over a contradictory brand');

const apiError=loadWithFetch(async()=>{throw new Error('provider down');});
res=resCapture();
await apiError({query:{mode:'search',lat:'41',lon:'-81',radius:'10'},headers:{'x-forwarded-for':'qa-error'}},res);
assert.equal(res.statusCode,502);
assert.equal(res.body.code,'PROVIDER_UNAVAILABLE');

console.log('Dinliminate API smoke: PASS');

})().catch(err=>{console.error(err);process.exitCode=1});
