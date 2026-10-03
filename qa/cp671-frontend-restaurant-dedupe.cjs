const assert=require('assert/strict');
const fs=require('fs');

const source=fs.readFileSync(require('path').join(__dirname,'..','app.js'),'utf8');
const start=source.indexOf('function restaurantNameTokensUI');
const end=source.indexOf('function restaurantCanonicalId');
assert.ok(start>=0&&end>start,'UI restaurant dedupe block must exist');

const extracted=source.slice(start,end);
const factory=new Function(
  'normKey','milesBetween','RESTAURANT_TAXONOMY',
  extracted+'; return {dedupeRestaurantPool,restaurantNameFamily,restaurantNameSimilarityUI,restaurantNameCoreMatchUI,restaurantAddressSimilarityUI};'
);
const normKey=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const milesBetween=(lat1,lon1,lat2,lon2)=>{
  const a=Number(lat1),b=Number(lon1),c=Number(lat2),d=Number(lon2);
  if(![a,b,c,d].every(Number.isFinite))return NaN;
  const R=3958.7613,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,z=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;
  return 2*R*Math.asin(Math.sqrt(z));
};
const RESTAURANT_TAXONOMY={
  restaurantIdentityKey:()=>'', 
  classifyRestaurant:()=>({tags:[],primary:'American'})
};
const {dedupeRestaurantPool,restaurantNameFamily,restaurantNameSimilarityUI,restaurantNameCoreMatchUI,restaurantAddressSimilarityUI}=factory(normKey,milesBetween,RESTAURANT_TAXONOMY);

const row=(id,name,address,lat,lon,source)=>({id,name,address,lat,lon,distance:1,source});
assert.equal(restaurantNameFamily('Excell Market Bar-B-Q'),'excell market bbq','Frontend must canonicalize Bar-B-Q');
assert.ok(restaurantNameSimilarityUI('Excell BBQ','Excell Market Bar-B-Q')>=0.60,'Excell name variants must match');
assert.ok(restaurantNameSimilarityUI('Strippers Chicken','Chicken Strippers')>=0.60,'Strippers Chicken variants must match');
assert.ok(restaurantAddressSimilarityUI('3102 Ashland City Rd, Clarksville, TN 37043','3102 Ashland City Road, Clarksville, Tennessee 37043')>=0.90,'Equivalent addresses must match');
assert.ok(typeof restaurantNameCoreMatchUI==='function','Core restaurant name matcher must exist');
assert.equal(restaurantNameCoreMatchUI('Excell Market & BBQ','Excell Bar-B-Q'),true,'Excell variants must share a core restaurant identity token');

const exactExcell=dedupeRestaurantPool([
 row('ex1','Excell Market & BBQ','3102 Ashland City Rd, Clarksville, TN 37043',36.5304,-87.3601,'OpenStreetMap'),
 row('ex2','Excell Bar-B-Q','3102 Ashland City Road, Clarksville, TN 37043',36.53042,-87.36008,'ArcGIS')
]);
assert.equal(exactExcell.length,1,'Exact reported Excell Market & BBQ / Excell Bar-B-Q duplicate must collapse to one result');

assert.equal(dedupeRestaurantPool([
 row('a','Excell BBQ','3102 Ashland City Rd, Clarksville, TN 37043',36.5304,-87.3601,'OpenStreetMap'),
 row('b','Excell Market Bar-B-Q','3102 Ashland City Road, Clarksville, Tennessee 37043',36.53042,-87.36008,'ArcGIS')
]).length,1,'Excell duplicate must collapse in the FRONTEND pool');

assert.equal(dedupeRestaurantPool([
 row('a','Strippers Chicken','124 S 10th St, Clarksville, TN 37040',36.5280,-87.3590,'OpenStreetMap'),
 row('b','Chicken Strippers','124 South 10th Street, Clarksville, TN 37040',36.52804,-87.35896,'Photon')
]).length,1,'Strippers Chicken duplicate must collapse in the FRONTEND pool');

assert.equal(dedupeRestaurantPool([
 row('a','Panda Garden','1000 Market St, Clarksville, TN 37040',36.53,-87.36,'Photon'),
 row('b','Burger House','1000 Market Street, Clarksville, TN 37040',36.53001,-87.36001,'ArcGIS')
]).length,2,'Same address alone must not merge unrelated restaurants');

assert.equal(dedupeRestaurantPool([
 row('a','Chris Pizza','100 Main St, Clarksville, TN 37040',36.53,-87.36,'Photon'),
 row('b','Chris Pizza','800 College St, Clarksville, TN 37040',36.55,-87.34,'ArcGIS')
]).length,2,'Same name at different addresses must remain separate');

assert.ok(source.includes('const previousRows=[];'),'Fresh restaurant searches must not carry the stale previous restaurant pool forward');
console.log('CP671 frontend restaurant dedupe regression: PASS');
