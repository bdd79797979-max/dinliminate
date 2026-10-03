import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=String(process.env.BASE_URL||'').replace(/\/$/,'');
assert(base,'BASE_URL is required');

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,timezoneId:'America/Chicago'});
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+String(e)));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});

const release=await page.request.get(base+'/app-release.json',{cache:'no-store'});
assert.equal(release.status(),200,'Static release metadata must be HTTP 200');
const releaseJson=await release.json();
assert.equal(String(releaseJson.build),'643');
assert.equal(String(releaseJson.checkpoint),'CP643');

const response=await page.goto(base+'/?cp643-live=1',{waitUntil:'domcontentloaded',timeout:30000});
assert(response&&response.ok(),'Hosted app root must load successfully');
const health=await page.request.get(base+'/api/restaurant-search?mode=health');
assert.notEqual(health.status(),401,'Restaurant health endpoint must not require deploy-preview authentication');
assert.equal(health.status(),200,'Restaurant health endpoint must be HTTP 200');
const healthJson=await health.json();
assert.equal(healthJson.ok,true);
assert.equal(Number(healthJson.maxRadiusMiles),100);
assert(response&&response.ok(),'Hosted app must load');
assert.match(await page.title(),/Dinner Decisions Simplified|Dinliminate/);
assert.equal(await page.locator('#foodStart').isVisible(),true);
assert.equal(await page.locator('#restStart').isVisible(),true);
await page.locator('#restStart').click();
await page.waitForTimeout(250);
assert.equal(await page.locator('#restaurant').isVisible(),true);
assert.equal(await page.locator('#locate').isVisible(),true);
assert.equal(await page.locator('#find').isVisible(),true);
assert.equal(await page.locator('#radius').isVisible(),true);
assert.equal(await page.locator('#restaurantSearch').isVisible(),true);

const photoUrl=base+'/api/restaurant-photo?name='+encodeURIComponent("Wendy's")
  +'&address='+encodeURIComponent('2800 Wilma Rudolph Blvd, Clarksville, TN 37040-5016')
  +'&officialWebsite='+encodeURIComponent('https://locations.wendys.com/united-states/tn/clarksville/2800-wilma-rudolph-blvd');
const photo=await page.request.get(photoUrl,{timeout:30000});
assert.equal(photo.status(),200,'Exact official-site Wendy location should yield a real venue image; got '+photo.status());
assert.match(String(photo.headers()['content-type']||''),/^image\//);
const source=String(photo.headers()['x-restaurant-photo-source']||'');
assert.ok(['official-venue-page','exact-public-venue-page','exact-public-venue-image','osm-exact-poi'].includes(source),'Photo source must be an allowed exact-venue tier, got '+source);
const body=await photo.body();
assert.ok(body.length>=4000,'Returned venue image should not be a tiny placeholder');

const fake=await page.request.get(base+'/api/restaurant-photo?name='+encodeURIComponent('Dinliminate Completely Fake Restaurant 918273')
  +'&address='+encodeURIComponent('918273 No Such Street, Clarksville, TN 37040'),{timeout:30000});
assert.notEqual(fake.status(),200,'Unknown restaurant must not receive a generic photo');

assert.equal(errors.length,0,'Hosted page should have no page/console errors: '+errors.join(' | '));
await browser.close();

console.log(JSON.stringify({
  ok:true,
  base,
  release:releaseJson,
  health:healthJson,
  officialVenuePhoto:{restaurant:"Wendy's",address:'2800 Wilma Rudolph Blvd, Clarksville, TN 37040-5016',source,bytes:body.length},
  unknownRestaurantStatus:fake.status(),
  browser:{home:true,restaurantScreen:true,locationControls:true,noConsoleErrors:true}
},null,2));
