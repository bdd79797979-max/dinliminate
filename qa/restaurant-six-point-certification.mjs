import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const release=JSON.parse(fs.readFileSync(path.join(root,'app-release.json'),'utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent((req.url||'/').split('?')[0]);
  const rel=pathname==='/'?'index.html':pathname.replace(/^\//,'');
  const file=path.join(root,rel);
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain'});fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(4174,'127.0.0.1',resolve));

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({
  viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true,timezoneId:'America/Chicago'
});
await context.grantPermissions(['geolocation'],{origin:'http://127.0.0.1:4174'});
await context.setGeolocation({latitude:36.5304,longitude:-87.3601});
const page=await context.newPage();

const png1x1=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const requests=[],badResponses=[],pageErrors=[],consoleErrors=[];
let reverseFailure=false;
const googlePhotoAttributionHeader=Buffer.from(JSON.stringify([{displayName:'Dinliminate Photo Credit',uri:'https://maps.google.com/'}])).toString('base64url');
const googlePhotoRow={id:'google-photo-test',name:'Google Photo Test Grill',category:'Restaurant',fastFood:false,cuisine:'american',distance:1.6,address:'111 Photo Test Ave, Clarksville, TN',website:'',phone:'',opening_hours:'24/7',openNow:true,photo:'',photoFallback:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',photoSource:'google-places',photoIsGeneric:false,photoConfidence:.95,googlePlaceId:'ChIJ1234567890',menuItems:['Grilled Chicken']};

const allResults=[
 {id:'mcd',name:"McDonald's",category:'Fast Food',fastFood:true,cuisine:'burger',distance:.8,address:'100 Main St, Clarksville, TN',website:'https://www.mcdonalds.com',phone:'(931) 555-0101',opening_hours:'24/7',openNow:true,menuItems:['Big Mac','Fries'],photo:'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=85'},
 {id:'waffle',name:'Waffle House',category:'American',fastFood:false,cuisine:'breakfast',distance:2.8,address:'200 Riverside Dr, Clarksville, TN',website:'https://www.wafflehouse.com',phone:'(931) 555-0102',opening_hours:'24/7',openNow:true,menuItems:['Waffles'],photo:'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=1200&q=85'},
 {id:'taco',name:'Taco Bell',category:'Fast Food',fastFood:true,cuisine:'mexican',distance:4.2,address:'300 Madison St, Clarksville, TN',website:'https://www.tacobell.com',phone:'(931) 555-0103',opening_hours:'24/7',openNow:true,menuItems:['Tacos'],photo:'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=1200&q=85'},
 {id:'pizza',name:'Pizza House',category:'Italian',fastFood:false,cuisine:'pizza',distance:9,address:'400 College St, Clarksville, TN',website:'https://example.com',phone:'',opening_hours:'24/7',openNow:true,menuItems:['Pizza'],photo:'https://images.unsplash.com/photo-1579684947550-22e945225d9a?auto=format&fit=crop&w=1200&q=85'},
 {id:'thirsty-goat',name:'Thirsty Goat',category:'Fast Food',fastFood:true,cuisine:'',distance:7,address:'450 College St, Clarksville, TN',website:'',phone:'',opening_hours:'24/7',openNow:true,menuItems:[],photo:'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1200&q=85'},
 {id:'american',name:'American Grill',category:'American',fastFood:false,cuisine:'burger',distance:24,address:'500 Main St, Clarksville, TN',website:'',phone:'',opening_hours:'24/7',openNow:true,menuItems:['Chicken','Burger'],photo:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85'},
 {id:'italian',name:'Pasta House',category:'Italian',fastFood:false,cuisine:'italian',distance:49,address:'600 College St, Clarksville, TN',website:'',phone:'',opening_hours:'24/7',openNow:true,menuItems:['Pasta'],photo:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=85'},
 {id:'asian',name:'Asian Garden',category:'Asian',fastFood:false,cuisine:'asian',distance:49.5,address:'700 Madison St, Clarksville, TN',website:'',phone:'',opening_hours:'',hoursState:'unknown',hoursSource:'provider-missing',menuItems:['Noodles'],photo:'https://images.unsplash.com/photo-1515669097368-22e681b4d36c?auto=format&fit=crop&w=1200&q=85'},
 {id:'bbq',name:'Clarksville BBQ',category:'BBQ',fastFood:false,cuisine:'bbq',distance:20,address:'800 BBQ Rd, Clarksville, TN',website:'',phone:'',opening_hours:'24/7',openNow:true,menuItems:['BBQ'],photo:'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=85'},
 {id:'seafood',name:'Seafood Dock',category:'Seafood',fastFood:false,cuisine:'seafood',distance:21,address:'900 River Rd, Clarksville, TN',website:'',phone:'',opening_hours:'24/7',openNow:true,menuItems:['Fish'],photo:'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&w=1200&q=85'},
 {id:'closed',name:'Closed Grill',category:'American',fastFood:false,cuisine:'american',distance:5.5,address:'1000 Main St, Clarksville, TN',website:'',phone:'',opening_hours:'24/7',openNow:false,hoursState:'closed',hoursSource:'provider-normalized',menuItems:[],photo:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85'},
 {id:'outer75',name:'Outer 75 Grill',category:'American',fastFood:false,cuisine:'american',distance:75,address:'1200 River Rd, Clarksville, TN',website:'',phone:'',opening_hours:'24/7',openNow:true,menuItems:['Grill'],photo:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85'},
 {id:'outer95',name:'Outer 95 Cafe',category:'American',fastFood:false,cuisine:'american',distance:95,address:'1300 River Rd, Clarksville, TN',website:'',phone:'',opening_hours:'24/7',openNow:true,menuItems:['Cafe'],photo:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85'}
];

// Give every fixture a deterministic coordinate that matches its declared distance from the QA origin.
for(const [i,row] of allResults.entries()){
  const angle=(i*37)%360;
  const milesToLat=Number(row.distance||0)/69.0;
  const milesToLon=Number(row.distance||0)/(69.0*Math.cos(36.5298*Math.PI/180));
  const rad=angle*Math.PI/180;
  row.lat=36.5298 + milesToLat*Math.cos(rad);
  row.lon=-87.3601 + milesToLon*Math.sin(rad);
}

page.on('pageerror',e=>pageErrors.push(String(e)));
page.on('console',m=>{
  if(m.type()!=='error') return;
  const msg=m.text();
  if(reverseFailure && /Failed to load resource: the server responded with a status of 502/.test(msg)) return;
  consoleErrors.push(msg);
});
page.on('response',r=>{
  if(r.status()<400) return;
  if(reverseFailure && r.status()===502 && /\/api\/restaurant-search\?mode=reverse&lat=36\.5304&lon=-87\.3601/.test(r.url())) return;
  badResponses.push({status:r.status(),url:r.url()});
});
page.on('request',r=>{if(r.url().includes('/api/restaurant-search?mode=search'))requests.push(r.url())});

await page.route('**/*',async route=>{
 const u=route.request().url();
 if(u.includes('/api/release')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,name:'Dinliminate',version:'1.0',build:String(release.build),sourceBranch:release.sourceBranch,expectedBranch:release.sourceBranch})});
 if(u.includes('/api/restaurant-search?mode=health')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,version:'qa',maxRadiusMiles:100,providers:['qa']})});
 if(u.includes('/api/restaurant-search?mode=suggest')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,results:[
   {lat:36.5298,lon:-87.3588,display:'801 Iron Workers Rd, Clarksville, TN 37043'},
   {lat:36.5200,lon:-87.3500,display:'123 Main St, Clarksville, TN 37040'}
 ]})});
 if(u.includes('/api/restaurant-search?mode=resolve')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,lat:36.5298,lon:-87.3588,display:'801 Iron Workers Rd, Clarksville, TN 37043'})});
 if(u.includes('/api/restaurant-search?mode=reverse')){
   if(reverseFailure)return route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({ok:false,message:'QA reverse unavailable'})});
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,display:'Current location (QA)'})});
 }
 if(u.includes('/api/restaurant-search?mode=search')){
   const url=new URL(u),radius=Number(url.searchParams.get('radius')||10),q=String(url.searchParams.get('q')||'').toLowerCase();
   let results=allResults.filter(x=>x.distance<=radius+1e-9);
   if(q.replace(/[^a-z0-9]+/g,' ').includes('google photo test'))results=[googlePhotoRow];
   if(q){
     const nq=q.replace(/[^a-z0-9]+/g,' ').trim();
     if(nq.includes('mcdonald'))results=results.filter(x=>x.id==='mcd');
     else if(nq.includes('burger'))results=results.filter(x=>['mcd','waffle','american'].includes(x.id));
     else if(nq.includes('mexican'))results=results.filter(x=>x.id==='taco');
     else if(nq.includes('fish'))results=results.filter(x=>x.id==='seafood');
     else if(nq.includes('breakfast'))results=results.filter(x=>x.id==='waffle');
     else if(nq.includes('fast food'))results=results.filter(x=>['mcd','taco'].includes(x.id));
     else if(nq.includes('pizza')||nq.includes('pasta'))results=results.filter(x=>['pizza','italian','thirsty-goat'].includes(x.id));
   }
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
     ok:true,version:'qa',radiusMiles:radius,total:results.length,fastFoodCount:results.filter(x=>x.fastFood).length,timezone:'America/Chicago',searchQuery:q,searchLatencyMs:150,searchBudgetMs:12000,results
   })});
 }
 if(u.includes('/api/restaurant-photo?placeId=ChIJ1234567890')){
   return route.fulfill({status:200,contentType:'image/jpeg',headers:{'X-Restaurant-Photo-Attributions':googlePhotoAttributionHeader},body:png1x1});
 }
 if(u.includes('/api/image?url='))return route.fulfill({status:200,contentType:'image/jpeg',body:png1x1});
 if(u.startsWith('https://images.unsplash.com/')||u.startsWith('https://images.pexels.com/'))return route.fulfill({status:200,contentType:'image/png',body:png1x1});
 return route.continue();
});

const settle=()=>page.waitForTimeout(180);
const snap=()=>page.evaluate(()=>window.__DINLIMINATE_QA__?.snapshot());
async function waitForRestaurant(expectedQuery=''){
 const wanted=String(expectedQuery||'').trim().toLowerCase();
 const requestBaseline=requests.length;
 await page.waitForFunction((baseline)=>window.__DINLIMINATE_QA__?.snapshot?.()||document.querySelector('#status'),{timeout:50},requestBaseline).catch(()=>{});
 const requestDeadline=Date.now()+15000;
 while(requests.length<=requestBaseline&&Date.now()<requestDeadline) await new Promise(resolve=>setTimeout(resolve,100));
 if(requests.length<=requestBaseline) throw new Error('Restaurant search request did not start.');
 await page.waitForFunction(()=>{const t=document.querySelector('#status')?.textContent||'';const findBusy=document.querySelector('#find')?.getAttribute('aria-busy')==='true';const searchBusy=/Searching restaurants|Refreshing restaurants|Location found/.test(t);return !findBusy&&!searchBusy;},{timeout:30000});
 if(wanted){
   await page.waitForFunction((wanted)=>{const snap=window.__DINLIMINATE_QA__?.snapshot?.();const currentQuery=String(snap?.restaurantSearchQuery||'').trim().toLowerCase();return currentQuery.includes(wanted);},{timeout:30000},wanted);
 }
 await settle();
}
async function openRestaurantScreen(){await page.locator('#restStart').click();await settle();}
async function hiddenSearch(value,expectedQuery=value){
  const requestBaseline=requests.length;
  await page.evaluate(value=>{
    const input=document.querySelector('#restaurantQuery');
    if(!input)throw new Error('Hidden restaurant search field is missing.');
    input.value=String(value||'');
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },value);
  if(String(value||'').trim()) await waitForRestaurant(expectedQuery);
  else {
    await page.waitForTimeout(800);
    await page.locator('#find').click();
    await waitForRestaurant();
  }
}

await page.goto('http://127.0.0.1:4174/?qa=1');
await page.waitForLoadState('domcontentloaded');
await settle();

// Persisted device coordinates must reopen as a last-used location, not as freshly confirmed GPS.
await page.evaluate(() => localStorage.setItem('dinliminate.clean.cp1', JSON.stringify({
  screen:'home',saved:true,location:{lat:36.5304,lon:-87.3601,label:'Previous location'},locationSource:'device',
  locationFreshAt:Date.now()-86400000,restaurantPool:[],pool:[],custom:[]
})));
await page.reload();
await page.waitForLoadState('domcontentloaded');
await settle();
assert.equal(await page.locator('#locationSourceLabel').textContent(),'Last used location');
const report={};
report["1_use_location"]={};
await openRestaurantScreen();

// Double-tap protection: the first request puts the button into a disabled/busy state,
// preventing a second acquisition from starting while the first one is active.
await page.evaluate(() => {
  window.__DINLIMINATE_GEO_CALLS__=0;
  const geo=navigator.geolocation;
  geo.getCurrentPosition=(success,error,options)=>{
    window.__DINLIMINATE_GEO_CALLS__++;
    setTimeout(()=>success({coords:{latitude:36.5304,longitude:-87.3601,accuracy:25}}),550);
  };
});
await page.locator('#locate').click();
assert.equal(await page.locator('#locate').isDisabled(),true);
assert.equal(await page.locator('#locate').getAttribute('aria-busy'),'true');
await page.locator('#locate').click({force:true}).catch(()=>{});
await page.waitForTimeout(120);
assert.equal(await page.evaluate(()=>window.__DINLIMINATE_GEO_CALLS__),1);
await waitForRestaurant();
await page.waitForFunction(()=>document.querySelector('#locate')?.getAttribute('aria-busy')==='false');
assert.equal(await page.locator('#locate').isDisabled(),false);
assert.equal(await page.locator('#locate').getAttribute('aria-busy'),'false');

await page.locator('#locate').click();
await waitForRestaurant();
let s=await snap();
assert.equal(s.locationSource,'device');
assert.ok(Math.abs(Number(s.location?.lat)-36.5304)<0.001);
assert.ok(Math.abs(Number(s.location?.lon)+87.3601)<0.001);
assert.equal((await page.locator('#locationSourceLabel').textContent()).trim(),'Using your location');
report["1_use_location"].success=true;
report["1_use_location"].coordinates=s.location;
report["1_use_location"].source=await page.locator('#locationSourceLabel').innerText();

// Also verify graceful fallback when reverse lookup fails.
reverseFailure=true;
await page.locator('#locate').click();
await waitForRestaurant();
s=await snap();
assert.equal(s.locationSource,'device');
assert.ok(Math.abs(Number(s.location?.lat)-36.5304)<0.001);
reverseFailure=false;
report["1_use_location"].reverseFailureFallback=true;

// 2. Address search with autocomplete and later address replacement.
report["2_search_address"]={};
await page.locator('#address').fill('801 Iron');
await page.waitForSelector('#suggestionsBox button',{state:'visible'});
assert.ok(await page.locator('#suggestionsBox button').count()>=2);
await page.locator('#suggestionsBox button').first().click();
await waitForRestaurant();
s=await snap();
assert.equal(s.locationSource,'address');
assert.equal(await page.locator('#address').inputValue(),'801 Iron Workers Rd, Clarksville, TN 37043');
assert.equal(Number(s.location.lat),36.5298);
report["2_search_address"].autocomplete=true;
report["2_search_address"].selectedAddress=await page.locator('#address').inputValue();
report["2_search_address"].coordinates=s.location;

// Also verify a complete typed address can be submitted directly with Enter (without choosing a suggestion).
await page.locator('#address').fill('801 Iron Workers Rd, Clarksville, TN 37043');
await page.locator('#address').press('Enter');
await waitForRestaurant();
s=await snap();
assert.equal(s.locationSource,'address');
assert.equal(await page.locator('#address').inputValue(),'801 Iron Workers Rd, Clarksville, TN 37043');
report["2_search_address"].directEnter=true;

// Enter Address behavior: a partial/ambiguous-looking input with visible suggestions should choose the top suggestion;
// a complete-looking street address should resolve the typed value directly.
assert.equal(await page.evaluate(v=>window.__DINLIMINATE_TEST__.addressLooksComplete(v),'801 Iron'),false);
assert.equal(await page.evaluate(v=>window.__DINLIMINATE_TEST__.addressLooksComplete(v),'801 Iron Workers Rd, Clarksville, TN 37043'),true);
assert.equal(await page.evaluate(({a,b})=>window.__DINLIMINATE_TEST__.locationMovedMiles(a,b),{
 a:{lat:36.5304,lon:-87.3601},
 b:{lat:36.5304,lon:-87.3601}
}),0);

await page.locator('#address').fill('801 Iron');
await page.waitForSelector('#suggestionsBox button',{state:'visible'});
await page.locator('#address').press('Enter');
await waitForRestaurant();
s=await snap();
assert.equal(s.locationSource,'address');
assert.equal(await page.locator('#address').inputValue(),'801 Iron Workers Rd, Clarksville, TN 37043');
report["2_search_address"].partialEnterSelectsTopSuggestion=true;

await page.locator('#address').fill('801 Iron Workers Rd, Clarksville, TN 37043');
await page.waitForSelector('#suggestionsBox button',{state:'visible'});
await page.locator('#address').press('Enter');
await waitForRestaurant();
s=await snap();
assert.equal(s.locationSource,'address');
assert.equal(await page.locator('#address').inputValue(),'801 Iron Workers Rd, Clarksville, TN 37043');
assert.ok((await page.locator('#suggestionsBox').getAttribute('hidden'))!==null,'Suggestions should be dismissed after direct Enter resolution.');
report["2_search_address"].completeEnterResolvesDirectly=true;
report["2_search_address"].enterBehavior='Partial/ambiguous-looking input selects visible top suggestion; complete-looking street address resolves directly.';

// 2b. Cuisine/category regression: Thirsty Goat may be tagged fast food by a provider but is a pizza venue.
const thirstyGoat=allResults.find(x=>x.id==='thirsty-goat');
assert.equal(await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantCategory(row),thirstyGoat),'Pizza');
const waffleHouse=allResults.find(x=>x.id==='waffle');
assert.equal(await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantCategory(row),waffleHouse),'Breakfast');
assert.equal(await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantQuickMatches(row,'Breakfast'),waffleHouse),true);
assert.equal(await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantQuickMatches(row,'Pizza'),thirstyGoat),true);
assert.equal(await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantQuickMatches(row,'Fast Food'),thirstyGoat),false);
report["2_search_address"].thirstyGoatCuisine='Pizza override verified; Pizza Quick Cut matches while the incorrect provider fast-food tag is ignored for this known venue.';

// 2c. Deep Restaurant Quick Cut association matrix.
// Identity/category/cuisine should drive primary associations; one incidental menu item must not create a cuisine tag.
const associationCases=[
 {name:"McDonald's",category:'Fast Food',fastFood:true,cuisine:'burger',menuItems:['Big Mac','Fries'],yes:['Fast Food','Burgers'],no:['Pizza','Italian','Seafood']},
 {name:'Taco Bell',category:'Fast Food',fastFood:true,cuisine:'mexican',menuItems:['Tacos'],yes:['Fast Food','Mexican'],no:['Italian','Seafood']},
 {name:'Waffle House',category:'American',fastFood:false,cuisine:'breakfast',menuItems:['Waffles'],yes:['American','Breakfast'],no:['Mexican','Pizza']},
 {name:'Olive Garden',category:'Restaurant',fastFood:false,cuisine:'italian',menuItems:['Pasta'],yes:['Italian'],no:['Seafood','Mexican']},
 {name:'Red Lobster',category:'Restaurant',fastFood:false,cuisine:'seafood',menuItems:['Shrimp'],yes:['Seafood'],no:['Italian','Mexican']},
 {name:"Joe's Pizza",category:'Restaurant',fastFood:false,cuisine:'',menuItems:[],yes:['Pizza'],no:['Mexican','Seafood']},
 {name:'American Grill',category:'American',fastFood:false,cuisine:'burger',menuItems:['Burger'],yes:['American','Burgers'],no:['Seafood']},
 {name:'Neighborhood Burger Menu',category:'American',fastFood:false,cuisine:'american',menuItems:['Burger'],yes:['American'],no:['Burgers']},
 {name:'Main Street Restaurant',category:'American',fastFood:false,cuisine:'american',menuItems:['Shrimp'],yes:['American'],no:['Seafood']},
 {name:'The Thirsty Goat',category:'Fast Food',fastFood:true,cuisine:'',menuItems:[],yes:['Pizza'],no:['Fast Food']},
 {name:'Smokehouse Kitchen',category:'Restaurant',fastFood:false,cuisine:'',menuItems:[],yes:['BBQ'],no:['Seafood']},
 {name:'Southern Home Cooking',category:'Restaurant',fastFood:false,cuisine:'',menuItems:[],yes:['Southern'],no:['BBQ']},
 {name:'Tokyo Ramen',category:'Restaurant',fastFood:false,cuisine:'',menuItems:['Ramen','Sushi'],yes:['Asian'],no:['Mexican']},
 {name:'Casa Cafe',category:'Restaurant',fastFood:false,cuisine:'',menuItems:['Tacos','Burritos'],yes:['Mexican'],no:['Italian']},
 {name:'Pasta Corner',category:'Restaurant',fastFood:false,cuisine:'',menuItems:['Pasta','Ravioli'],yes:['Italian'],no:['Mexican']},
 {name:'Neighborhood Cafe',category:'American',fastFood:false,cuisine:'american',menuItems:['Pasta'],yes:['American'],no:['Italian']},
 {name:'Seafood & Grill',category:'Restaurant',fastFood:false,cuisine:'',menuItems:[],yes:['Seafood'],no:[]}
];
for(const row of associationCases){
 const tags=await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantCuisineTags(row),row);
 for(const label of row.yes)assert.ok(tags.includes(label),row.name+' should match '+label+'; got '+JSON.stringify(tags));
 for(const label of row.no)assert.equal(tags.includes(label),false,row.name+' should not match '+label+'; got '+JSON.stringify(tags));
}
const evidence=await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantCuisineEvidence(row),associationCases.find(x=>x.name==="Joe's Pizza"));
assert.ok(evidence.Pizza?.includes('restaurant name'),"Quick Cut evidence should identify Joe's Pizza by restaurant name");
const weakMenu=await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantCuisineTags(row),{name:'Neighborhood Cafe',category:'Restaurant',cuisine:'',fastFood:false,menuItems:['Shrimp']});
assert.equal(weakMenu.includes('Seafood'),false,'One incidental menu item must not create Seafood');
report["2_search_address"].quickCutAssociationMatrix={cases:associationCases.length,identityFirst:true,weakMenuGuard:true,evidenceHook:true};


// 3. All seven radius values; verify request forwarding, exact radius contract, result monotonicity, and containment.
report["3_radius"]={};
const radii=[1,3,5,10,25,50,100];
const radiusRows=[];
for(const r of radii){
  await page.locator('#radius').selectOption(String(r));
  await page.waitForFunction(expected=>Number(document.querySelector('#radius')?.value)===expected,r);
  await waitForRestaurant();
  const snapNow=await snap();
  assert.equal(Number(await page.locator('#radius').inputValue()),r);
  assert.equal(Number(snapNow.restaurantSearchOrigin?.lat),36.5298);
  const ids=snapNow.allRestaurantIds;
  assert.equal(new Set(ids).size,ids.length);
  if(!ids.length) console.log('Radius diagnostic',JSON.stringify({radius:r,status:await page.locator('#status').textContent(),findBusy:await page.locator('#find').getAttribute('aria-busy'),loc:snapNow.restaurantSearchOrigin,searchKey:snapNow.restaurantSearchOrigin,lastRequest:requests.at(-1),pool:snapNow.restaurantPool}));
  const outOfRange=(await page.evaluate(()=>window.__DINLIMINATE_QA__?.snapshot())).restaurantPool;
  const expected=allResults.filter(x=>x.distance<=r).map(x=>x.id);
  assert.deepEqual(new Set(ids),new Set(expected));
  const searchUrl=requests.at(-1)||'';
  assert.equal(Number(new URL(searchUrl).searchParams.get('radius')),r);
  radiusRows.push({miles:r,count:ids.length,fastFood:ids.filter(id=>allResults.find(x=>x.id===id)?.fastFood).length,requestRadius:Number(new URL(searchUrl).searchParams.get('radius'))});
}
for(let i=1;i<radiusRows.length;i++)assert.ok(radiusRows[i].count>=radiusRows[i-1].count);
report["3_radius"].rows=radiusRows;
report["3_radius"].monotonic=true;
report["3_radius"].tested=radii;
report["3_radius"].maxRadiusVerified=true;

// 4. Restaurant Search box: provider request plus local result presentation.
report["4_search_restaurants"]={};
assert.equal(await page.locator('#restaurantSearch').count(),0,'Restaurant Search opener must remain hidden for now'); await page.locator('#restaurantQuery').evaluate(el=>el.classList.contains('hidden')||el.closest('#restaurantSearchBox')?.classList.contains('hidden'));
await settle();
requests.length=0;
await hiddenSearch('Mcdonalds');
await settle();
s=await snap();
assert.deepEqual(s.restaurantPool,['mcd'],'Local restaurant query filter should narrow the active pool immediately.');
s=await snap();
assert.deepEqual(s.restaurantPool,['mcd']);
assert.ok(requests.some(u=>String(new URL(u).searchParams.get('q')||'').toLowerCase()==='mcdonalds'),'Explicit restaurant search was not sent to provider search');
report["4_search_restaurants"].mcdonalds={matched:s.restaurantPool,providerQuery:requests.at(-1)};

// Restaurant card certification: decision-first hierarchy, compact utilities, and small-iPhone bounds.
const cardSummary=await page.evaluate(()=>({
  width:document.querySelector('#restaurantCard')?.getBoundingClientRect().width||0,
  cardRight:document.querySelector('#restaurantCard')?.getBoundingClientRect().right||0,
  cardBottom:document.querySelector('#restaurantCard')?.getBoundingClientRect().bottom||0,
  viewportWidth:window.innerWidth,
  viewportHeight:window.innerHeight,
  cardDetailLines:document.querySelectorAll('#restaurantCard .card-detail-line,#restaurantCard .card-status,#restaurantCard .card-card-actions').length,
  utilities:document.querySelectorAll('#restaurantCard .restaurant-card-utility').length,
  scrollWidth:document.documentElement.scrollWidth
}));
assert.equal(cardSummary.cardDetailLines,0,'Restaurant card should not contain directory-style detail blocks.');
assert.equal(cardSummary.utilities,2,'Restaurant card should contain Details and Website utilities.');
assert.equal(await page.locator('#restDetails').count(),1,'Restaurant Details utility must exist.');
assert.equal(await page.locator('#restaurantCard .restaurant-card-utility[href^="tel:"]').count(),0,'Restaurant card should keep phone access in Details rather than as a separate card utility.');
assert.ok(await page.locator('#restaurantCard .restaurant-card-utility[target="_blank"]').count()>=1,'Restaurant card must keep an external Website/lookup utility.');
report["4_search_restaurants"].cardHierarchy=cardSummary;

for(const width of [320,375,390]){
  await page.setViewportSize({width,height:852});
  await settle();
  await page.waitForSelector('#restaurantCard');
  const v=await page.evaluate(()=>{const r=document.querySelector('#restaurantCard')?.getBoundingClientRect();return r?{vw:innerWidth,vh:innerHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,scrollWidth:document.documentElement.scrollWidth}:null;});
  assert.ok(v && v.left>=-1 && v.right<=v.vw+1,'Restaurant card exceeds horizontal viewport at '+width+'px.');
  assert.ok(v && v.width<=v.vw-20,'Restaurant card is too wide at '+width+'px.');
  assert.ok(v && v.top>=0 && v.bottom<=v.vh+1,'Restaurant card exceeds viewport height at '+width+'px.');
  assert.ok(v && v.scrollWidth<=v.vw+1,'Horizontal page overflow at '+width+'px.');
  report["4_search_restaurants"].smallPhone=report["4_search_restaurants"].smallPhone||{};
  report["4_search_restaurants"].smallPhone[String(width)]=v;
}
await page.setViewportSize({width:393,height:852});
await settle();

// Photo pipeline: a Google-backed venue should hydrate its current Tinder card and Details image,
// retain an immediate fallback while loading, and surface the required author attribution.
await hiddenSearch('Google Photo Test');
s=await snap();
assert.deepEqual(s.restaurantPool,['google-photo-test']);
const googleCardImg=page.locator('#restaurantCard img[data-google-photo-id="ChIJ1234567890"]');
await page.waitForFunction(()=>document.querySelector('#restaurantCard img[data-google-photo-loaded="true"]')!==null);
assert.ok((await googleCardImg.getAttribute('src')).startsWith('blob:'),'Google venue photo should hydrate into an object URL.');
assert.equal(await page.locator('#restaurantCard .restaurant-photo-credit').evaluate(el=>el.classList.contains('is-visible')),true);
assert.ok((await page.locator('#restaurantCard .restaurant-photo-credit').innerText()).includes('Dinliminate Photo Credit'));
report["5_photo"].googleVenueCard=true;

await page.locator('#restDetails').click();
await page.waitForSelector('#detailsModal');
await page.waitForFunction(()=>document.querySelector('#detailsModal img[data-google-photo-loaded="true"]')!==null);
assert.equal(await page.locator('#detailsModal .restaurant-photo-credit').evaluate(el=>el.classList.contains('is-visible')),true);
assert.ok((await page.locator('#detailsModal .restaurant-photo-credit').innerText()).includes('Dinliminate Photo Credit'));
report["5_photo"].googleVenueDetails=true;
await page.locator('#detailsModal [data-close]').click();

// Winner + History continuity: Google-backed restaurant photo identity survives the decision and rehydrates in History.
await page.evaluate(row=>window.__DINLIMINATE_TEST__.winner(row),googlePhotoRow);
await page.waitForSelector('#winner');
assert.equal(await page.locator('#celebration').evaluate(el=>el.classList.contains('hidden')),false,'Restaurant Winner should trigger the same celebration as Food.');
await page.waitForFunction(()=>document.querySelector('#winImg[data-google-photo-id="ChIJ1234567890"][data-google-photo-loaded="true"]')!==null);
const storedHistory=await page.evaluate(()=>JSON.parse(localStorage.getItem('dinliminate.clean.history')||'[]')[0]);
assert.equal(storedHistory.googlePlaceId,'ChIJ1234567890');
assert.equal(storedHistory.photoSource,'google-places');
assert.ok(storedHistory.photoFallback,'History should retain an immediate photo fallback.');
report["5_photo"].restaurantWinnerCelebration=true;
report["5_photo"].historyPhotoIdentityPersisted=true;

await page.locator('#menu').click();
await page.locator('#history').click();
await page.waitForSelector('#historyModal');
const historyGoogleImg=page.locator('#historyModal img[data-google-photo-id="ChIJ1234567890"]').first();
assert.equal(await historyGoogleImg.count(),1,'History should retain the Google Place ID on its restaurant image.');
await page.waitForFunction(()=>document.querySelector('#historyModal img[data-google-photo-loaded="true"]')!==null);
assert.ok((await historyGoogleImg.getAttribute('src')).startsWith('blob:'),'History should rehydrate the Google venue photo.');
report["5_photo"].historyPhotoHydrated=true;


await hiddenSearch('burger');
s=await snap();
assert.deepEqual(new Set(s.restaurantPool),new Set(['mcd','american']));
assert.ok(requests.some(u=>new URL(u).searchParams.get('q')==='burger'));
report["4_search_restaurants"].burger=s.restaurantPool;
await hiddenSearch('mexican');
s=await snap();
assert.deepEqual(s.restaurantPool,['taco']);
assert.ok(requests.some(u=>new URL(u).searchParams.get('q')==='mexican'));
report["4_search_restaurants"].mexican=s.restaurantPool;
await hiddenSearch('fish');
s=await snap();
assert.deepEqual(s.restaurantPool,['seafood']);
assert.ok(requests.some(u=>new URL(u).searchParams.get('q')==='fish'));
report["4_search_restaurants"].fish=s.restaurantPool;
await hiddenSearch('pizza restaurant');
s=await snap();
assert.deepEqual(new Set(s.restaurantPool),new Set(['pizza','thirsty-goat']));
report["4_search_restaurants"].pizzaRestaurant=s.restaurantPool;
await hiddenSearch('breakfast restaurant');
s=await snap();
assert.deepEqual(s.restaurantPool,['waffle']);
report["4_search_restaurants"].breakfastRestaurant=s.restaurantPool;
await page.evaluate(()=>{const input=document.querySelector('#restaurantQuery');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));}); await page.locator('#find').click(); await waitForRestaurant();

// Hours data-model contract: explicit normalized state is used, provider openNow remains supported, and unknown is preserved.
const openFixture=allResults.find(x=>x.id==='mcd');
const closedFixture=allResults.find(x=>x.id==='closed');
const unknownFixture=allResults.find(x=>x.id==='asian');
assert.equal(await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantHourState(row),openFixture),'open');
assert.equal(await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantHourState(row),closedFixture),'closed');
assert.equal(await page.evaluate(row=>window.__DINLIMINATE_TEST__.restaurantHourState(row),unknownFixture),'unknown');
report["5_hours_model"]={open:'open',closed:'closed',unknown:'unknown',normalizedStateUsed:true};

// 5. Restaurant hours are informational only; they must not filter the decision deck.
report["5_hours_model"]={open:'open',closed:'closed',unknown:'unknown',normalizedStateUsed:true};
report["5_open_all"]={controlPresent:false,nonFiltering:true};
assert.equal(await page.locator('#hoursToggle').count(),0,'Restaurant Open/All hours control must remain hidden for now');
const noHoursSnap=await page.evaluate(()=>window.__DINLIMINATE_QA__?.snapshot());
assert.ok(noHoursSnap.restaurantPool.includes('closed'),'Closed restaurants must remain in the decision pool; hours must not filter results');
await page.locator('#restDetails').click(); await page.waitForTimeout(120);
assert.equal(await page.locator('#detailsModal').count(),1,'Restaurant Details should open for hours verification');
const detailsHoursText=await page.locator('#detailsModal').innerText();
assert(detailsHoursText.includes('Open now')||detailsHoursText.includes('Closed now')||detailsHoursText.includes('Hours unknown'),'Restaurant Details should retain informational hours status');
await page.locator('#detailsModal [data-close]').click(); await page.waitForTimeout(80);

// 6. All ten Quick Cuts: verify they render as photos and each toggled cut changes the active filter.
report["6_quick_cuts"]={};
const labels=['Fast Food','Burgers','Pizza','Mexican','American','Italian','Asian','BBQ','Seafood','Breakfast'];
assert.equal(await page.locator('#restQuick [data-rest-quick]').count(),10);
assert.deepEqual(await page.locator('#restQuick [data-rest-quick]').evaluateAll(els=>els.map(x=>x.textContent.trim())),labels);
assert.equal(await page.locator('#restQuick [data-rest-quick] .quick-chip-photo').count(),10);
const quickResults={};
for(const label of labels){
  const before=(await snap()).restaurantPool.length;
  await page.locator('[data-rest-quick="'+label+'"]').click();
  await settle();
  const after=await snap();
  const matching=after.restaurantPool;
  assert.ok(matching.length<before,'Quick Cut '+label+' did not narrow the active pool');
  quickResults[label]={beforeCount:before,remaining:matching,remainingCount:matching.length};
  await page.locator('[data-rest-quick="'+label+'"]').click();
  await settle();
  assert.equal((await snap()).restaurantPool.length,before,'Quick Cut '+label+' did not restore the pool when toggled off');
}
s=await snap();
assert.equal(await page.locator('#restQuick [data-rest-quick]').count(),10);
report["6_quick_cuts"].results=quickResults;
report["6_quick_cuts"].allRenderedWithPhotos=true;

// Reliability pass: five consecutive Refresh operations at the same location/radius.
requests.length=0;
for(let i=0;i<5;i++){
  await page.locator('#find').click();
  await waitForRestaurant();
}
assert.ok(requests.length>=5,'Five consecutive Refresh operations should each reach the restaurant endpoint');
report.repeatedRefreshes={attempts:5,searchRequests:requests.length};

assert.equal(pageErrors.length,0,'Browser page errors: '+JSON.stringify(pageErrors));
assert.equal(consoleErrors.length,0,'Browser console errors: '+JSON.stringify(consoleErrors));
assert.equal(badResponses.length,0,'HTTP errors: '+JSON.stringify(badResponses));
report.global={pageErrors,consoleErrors,badResponses,releaseBuild:release.build};
console.log(JSON.stringify(report,null,2));

await browser.close();
await new Promise(resolve=>server.close(resolve));
