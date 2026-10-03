import assert from 'node:assert/strict';

const base=String(process.env.BASE_URL||'').replace(/\/$/,'');
assert(base,'BASE_URL is required');

async function get(path,options={}){
  const res=await fetch(base+path,{redirect:'follow',...options});
  const text=await res.text();
  return {res,text};
}

const home=await get('/');
assert.equal(home.res.status,200,'Hosted home must return HTTP 200');
assert.match(home.text,/Dinner Decisions Simplified/);
assert.match(home.text,/Find a restaurant/);
assert.match(home.text,/Choose a meal/);

const release=await get('/app-release.json');
assert.equal(release.res.status,200);
const releaseJson=JSON.parse(release.text);
assert.equal(String(releaseJson.build),'643');
assert.equal(String(releaseJson.checkpoint),'CP643');

const health=await get('/api/restaurant-search?mode=health');
assert.equal(health.res.status,200,'Restaurant health must return HTTP 200');
const healthJson=JSON.parse(health.text);
assert.equal(healthJson.ok,true);
assert.equal(Number(healthJson.maxRadiusMiles),100);

const photoPath='/api/restaurant-photo?name='+encodeURIComponent("Wendy's")
  +'&address='+encodeURIComponent('2800 Wilma Rudolph Blvd, Clarksville, TN 37040-5016')
  +'&officialWebsite='+encodeURIComponent('https://locations.wendys.com/united-states/tn/clarksville/2800-wilma-rudolph-blvd');
const photo=await get(photoPath,{cache:'no-store'});
assert.equal(photo.res.status,200,'Exact official-site Wendy location should produce a real venue image');
assert.match(String(photo.res.headers.get('content-type')||''),/^image\//);
const source=String(photo.res.headers.get('x-restaurant-photo-source')||'');
assert.ok(['official-venue-page','exact-public-venue-page','exact-public-venue-image','osm-exact-poi'].includes(source),'Photo source must be an allowed exact-venue tier');
const bytes=Buffer.byteLength(photo.text,'utf8');
assert.ok(bytes>4000,'Photo response must contain more than a tiny placeholder');

const fake=await get('/api/restaurant-photo?name='+encodeURIComponent('Dinliminate Completely Fake Restaurant 918273')
  +'&address='+encodeURIComponent('918273 No Such Street, Clarksville, TN 37040'));
assert.notEqual(fake.res.status,200,'Unknown restaurant must not receive a generic photo');

console.log(JSON.stringify({
  ok:true,
  base,
  release:releaseJson,
  health:healthJson,
  home:{status:home.res.status,expectedContent:true},
  officialVenuePhoto:{restaurant:"Wendy's",address:'2800 Wilma Rudolph Blvd, Clarksville, TN 37040-5016',source,bytes},
  unknownRestaurantStatus:fake.res.status
},null,2));

// CP643 final public-preview access check trigger.
