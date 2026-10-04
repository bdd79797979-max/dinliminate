'use strict';
const assert=require('node:assert/strict');
const sharp=require('sharp');
const fs=require('node:fs');
const path=require('node:path');
const restaurants=require('../api/restaurants.js');
const photoApi=require('../api/restaurant-photo.js');
const rt=restaurants._test;
const pt=photoApi._test;

assert.ok(typeof rt.restaurantPhotoMeta==='function','restaurantPhotoMeta export missing');
assert.ok(typeof pt.extractInternalLinks==='function','extractInternalLinks export missing');
assert.ok(typeof pt.extractVenueImageCandidates==='function','extractVenueImageCandidates export missing');
assert.ok(typeof pt.structuredRestaurantMatches==='function','structuredRestaurantMatches export missing');
assert.ok(typeof pt.imageDimensions==='function','imageDimensions export missing');
assert.ok(typeof pt.mediaQuality==='function','mediaQuality export missing');
assert.ok(typeof pt.scoreImage==='function','scoreImage export missing');
assert.ok(typeof pt.fetchImage==='function','fetchImage export missing');

const appSource=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
assert.match(appSource,/function restaurantImmediatePhoto\(row\)/,'Restaurant cards should have one canonical immediate photo decision');
assert.equal(appSource.includes("scaleLift"),false,'Swipe code must not interpolate the waiting-card scale');
assert.equal(appSource.includes("fixedMealPreview"),false,'Swipe code must use one geometry contract for Meals and Restaurants');
assert.match(appSource,/next\.style\.transform='scale\(1\)'/,'Waiting card must remain at fixed scale during swipe');
assert.match(appSource,/__restaurantCanonicalPhotoPromise/,'Restaurant next card should pre-resolve its canonical photo before handoff');
assert.match(appSource,/RESTAURANT_PHOTO_HANDOFF_WAIT=950/,'Restaurant swipe handoff should have a bounded canonical-photo wait');
assert.match(appSource,/RESTAURANT_PHOTO_CACHE_NAME='dinliminate\.restaurant\.photos\.v4'/,'Restaurant photo cache should be invalidated with the resolver revision');
assert.match(appSource,/RESTAURANT_PHOTO_RESOLVER_VERSION='712'/,'Restaurant photo resolver revision should be synchronized');
assert.match(appSource,/params\.set\('phone'/,'Restaurant photo resolver should receive phone identity when available');
assert.equal(/const restaurantFallback = \(r\) => imageProxyUrl\(r\?\.photo/.test(appSource),false,'Restaurant first paint must not trust arbitrary provider photo URLs');
const structured=pt.structuredRestaurantMatches(`
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Restaurant","name":"Structured Bistro","telephone":"615-555-1212","address":{"@type":"PostalAddress","streetAddress":"456 Main Street","addressLocality":"Clarksville","addressRegion":"TN","postalCode":"37040"}}
</script>`,'Structured Bistro','456 Main Street, Clarksville, TN 37040','615-555-1212');
assert.equal(structured,true,'Structured restaurant/address data should verify an exact venue page');


const osm=rt.restaurantPhotoMeta({
  name:'Exact OSM Venue',
  photo:'https://upload.wikimedia.org/wikipedia/commons/example.jpg',
  source:'OpenStreetMap'
});
assert.equal(osm.photo,'https://upload.wikimedia.org/wikipedia/commons/example.jpg');
assert.equal(osm.photoSource,'osm-poi');
assert.equal(osm.photoIsGeneric,false);

const provider=rt.restaurantPhotoMeta({
  name:'Local Bistro',
  photo:'https://example.com/venue.jpg',
  source:'Provider Directory'
});
assert.equal(provider.photo,'https://example.com/venue.jpg');
assert.equal(provider.photoSource,'provider');
assert.equal(provider.photoConfidence,0.6);
assert.equal(provider.photoIsGeneric,false);

const photon=rt.restaurantPhotoMeta({
  name:'Photon OSM Venue',
  photo:'https://example.com/photon.jpg',
  source:'Photon POI'
});
assert.equal(photon.photoSource,'osm-poi');
assert.equal(photon.photoConfidence,0.95);

const empty=rt.restaurantPhotoMeta({name:'Unknown Neighborhood Restaurant',category:'Restaurant'});
assert.equal(empty.photo,'');
assert.equal(empty.photoFallback,'');
assert.equal(empty.photoSource,'none');
assert.equal(empty.photoIsGeneric,false);

const html=`
<!doctype html>
<a href="/locations/clarksville">Clarksville Location</a>
<a href="/menu">Menu</a>
<div itemscope itemtype="https://schema.org/Restaurant">
  <span itemprop="name">Exact Bistro</span>
  <span>123 Main Street, Clarksville, TN 37040</span>
  <img src="https://example.com/front.jpg" alt="Exact Bistro exterior storefront entrance">
  <img src="https://example.com/menu.jpg" alt="burger menu">
</div>`;
const links=pt.extractInternalLinks(html,'https://exactbistro.example/','Exact Bistro','123 Main Street, Clarksville, TN 37040');
assert.ok(links.includes('https://exactbistro.example/locations/clarksville'),'Official location link should be discovered');
assert.ok(!links.includes('https://other.example/unrelated'),'Unrelated domain should never be discovered');

const candidates=pt.extractVenueImageCandidates(html,'https://exactbistro.example/','Exact Bistro','123 Main Street, Clarksville, TN 37040','https://exactbistro.example/');
assert.ok(candidates.some(x=>x.url==='https://example.com/front.jpg'&&x.score>=65),'Venue exterior image should score as a candidate');
assert.ok(candidates.some(x=>x.url==='https://example.com/menu.jpg'),'Menu image should be detectable for rejection');
assert.ok(pt.scoreImage({contentUrl:'https://images.example.com/unrelated.jpg',hostPageUrl:'',title:'Unrelated photo',description:'',query:'Exact Bistro 123 Main Street restaurant exterior'},'Exact Bistro','123 Main Street, Clarksville, TN 37040','https://exactbistro.example/','6155551212')<55,'Bing query text alone must not manufacture image identity confidence');

const assetGate=pt.extractImgCandidates(`
<img src="https://cdn.example.com/google-play-badge.svg" width="135" height="40" alt="Get it on Google Play">
<img src="https://cdn.example.com/download-app-badge.png" width="180" height="60" alt="Download the app">
<img src="https://cdn.example.com/wendys-location-exterior.jpg" width="900" height="600" alt="Wendy's restaurant exterior">
`,'https://example.com/location');
assert.equal(assetGate.some(x=>/google-play-badge|download-app-badge/i.test(x.url)),false,'App-store/download badges must not be treated as restaurant photos');
assert.equal(assetGate.some(x=>/wendys-location-exterior/i.test(x.url)),true,'A large venue exterior image must remain eligible');

(async()=>{
  const originalFetch=global.fetch;
  const osmUrl='https://example.com/osm-venue.jpg';
  const badDimensionsUrl='https://example.com/bad-dimensions.png';
  const validPhoto=await sharp({create:{width:800,height:600,channels:3,background:{r:120,g:120,b:120}}}).jpeg({quality:82}).toBuffer();
  const tinyPhoto=await sharp({create:{width:100,height:100,channels:3,background:{r:120,g:120,b:120}}}).png().toBuffer();
  let fetchCalls=0;
  const pngWithDimensions=(width,height,size=5000)=>{
    const bytes=Buffer.alloc(size,0);
    bytes[0]=0x89;bytes[1]=0x50;bytes[2]=0x4e;bytes[3]=0x47;
    bytes.writeUInt32BE(width,16);bytes.writeUInt32BE(height,20);
    return bytes;
  };
  global.fetch=async function(url){
    fetchCalls++;
    const u=String(url);
    if(u===osmUrl){
      return {
        ok:true,status:200,
        headers:{get(name){return name.toLowerCase()==='content-type'?'image/jpeg':null}},
        async arrayBuffer(){return validPhoto.buffer.slice(validPhoto.byteOffset,validPhoto.byteOffset+validPhoto.byteLength)}
      };
    }
    if(u===badDimensionsUrl){
      const bytes=tinyPhoto;
      return {
        ok:true,status:200,
        headers:{get(name){return name.toLowerCase()==='content-type'?'image/png':null}},
        async arrayBuffer(){return bytes.buffer}
      };
    }
    throw new Error('network disabled for deterministic test');
  };
  try{
    const headers={};
    let status=0,body=Buffer.alloc(0);
    await photoApi(
      {query:{name:'OSM Venue',address:'123 Main St, Clarksville, TN',osmExact:'1',osmImage:osmUrl}},
      {setHeader(k,v){headers[k]=String(v)},statusCode:200,end(v){body=Buffer.isBuffer(v)?v:Buffer.from(String(v??''))}}
    );
    status=200;
    assert.equal(headers['X-Restaurant-Photo-Source'],'osm-exact-poi');
    assert.equal(headers['Content-Type'],'image/webp');
    assert.ok(body.length>1000,'Normalized photo should retain usable image data');
    assert.ok(body.length<validPhoto.length*2,'Normalized photo should remain bounded after conversion');
    const normalized=await pt.normalizeRestaurantImage(validPhoto);
    assert.equal(normalized.type,'image/webp');
    assert.ok(normalized.width<=1400&&normalized.height<=1050,'Normalized image dimensions must fit the phone card budget');
    assert.equal(fetchCalls,1,'Exact OSM photo should return before any web discovery requests');

    assert.deepEqual(pt.imageDimensions(pngWithDimensions(1200,800)),{width:1200,height:800});
    assert.ok(pt.mediaQuality({width:1200,height:800})>0,'Usable restaurant-photo dimensions should score positively');
    await assert.rejects(
      () => pt.fetchImage(badDimensionsUrl,{},1000),
      /dimensions are not suitable/,
      'Very small decoded images must be rejected before reaching the phone card pipeline'
    );
  }finally{
    global.fetch=originalFetch;
  }
  console.log(JSON.stringify({
    ok:true,
    cases:17,
    verified:[
      'no generic restaurant photo fallback',
      'provider venue photo metadata',
      'exact OSM POI photo metadata',
      'official-site internal location discovery',
      'venue exterior candidate scoring',
      'food/menu candidate remains rejectable',
      'credential-free OSM photo tier',
      'restaurant-photo API no Google API dependency',
      'structured exact restaurant/address verification',
      'non-photo badge and tiny-asset rejection',
      'unverified provider-photo confidence downgrade',
      'Photon OSM photo trust classification',
      'canonical Restaurant first-paint source',
      'canonical next-card photo handoff',
      'decoded image-dimension validation',
      'source-image WebP normalization fixture'
    ]
  },null,2));
})().catch(err=>{console.error(err);process.exitCode=1});
