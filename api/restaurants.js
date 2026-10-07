// CP1186: radius searches are independent and each selected radius gets direct origin coverage.
// CP1178: add bounded Overpass expansion for 25/50-mile radius coverage.
// CP1173: cumulative restaurant radius search — retained only as historical context.
const RESTAURANT_TAXONOMY=require('../data/restaurant-taxonomy');
const MAX_RADIUS=100;
const API_VERSION='r44';
const DEFAULT_RADIUS=10;
const DINING_AMENITIES='restaurant|fast_food';
const OVERPASS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://overpass.private.coffee/api/interpreter'];
const TARGETED_FAST=["McDonald's","Taco Bell","Wendy's","Burger King","KFC","Chick-fil-A","Popeyes","Subway","Sonic","Arby's","Whataburger","Five Guys","Raising Cane's","Wingstop","Bojangles","Cook Out","Dairy Queen","Zaxby's","Church's Chicken","Captain D's","Long John Silver's","Jimmy John's","Jersey Mike's","Firehouse Subs","Little Caesars","Domino's","Papa John's","Pizza Hut","Marco's Pizza","Krystal","Steak 'n Shake","White Castle","Freddy's","In-N-Out","Carl's Jr.","Panda Express","Jack in the Box","Hardee's","Del Taco","Checkers","Rally's"];
const FAST=/\b(?:mcdonald|taco bell|wendy|burger king|kfc|chick[- ]?fil[- ]?a|popeye|subway|sonic|arby|whataburger|five guys|culver|raising cane|wingstop|bojangles|cook ?out|dairy queen|jack in the box|hardee|del taco|checkers|rally|zaxby|churchs|captain ds|long john silver|jimmy john|jersey mike|firehouse subs|little caesars|domino|papa john|pizza hut|marcos pizza|krystal|steak ?n shake|white castle|freddy|in[- ]?n[- ]?out|carl.?s jr|panda express|jacks|chipotle)\b/i;
const cache=new Map(),buckets=new Map();
const SEARCH_BUDGET_MS=15000;
const WIDE_DISCOVERY_RESERVE_MS=11000;
const WIDE_RADIUS_THRESHOLD=50;
const RADIUS_DISCOVERY_THRESHOLD=3;
const WIDE_PROVIDER_RADIUS_CAP=50;
const WIDE_PRIMARY_TIMEBOX_MS=3500;
const WIDE_DISCOVERY_TIMEBOX_MS=12000;
const RADIUS_DISCOVERY_TIMEBOX_MS=11500;
const OVERPASS_HTTP_TIMEOUT_MS=5500;
const RADIUS_EXPANSION_QUERY_TIMEOUT_MS=3200;
const WIDE_OVERPASS_GROUP_SIZE=1;
const TILED_OVERPASS_GROUP_SIZE=1;
const MAX_SEARCH_PER_MINUTE=60;
const GOOGLE_KEY=String(process.env.GOOGLE_PLACES_API_KEY||process.env.GOOGLE_MAPS_API_KEY||'').trim();
const {reserveGoogleSku,disableGoogleSkuForMonth,googleUsageHealth,HARD_LIMITS}=require('./google-usage');
async function withinBudget(promise,ms,label){
 const wait=Math.max(250,ms);
 return Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve({__timeout:true,label}),wait))]);
}
function n(v,d=NaN){const x=Number(v);return Number.isFinite(x)?x:d}
function clamp(v){return Math.min(MAX_RADIUS,Math.max(1,n(v,DEFAULT_RADIUS)))}
function validCoords(lat,lon){return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function normalizeSearchQuery(s){return RESTAURANT_TAXONOMY.normalizeRestaurantSearch(s)}
function classifySearchTerm(s){return RESTAURANT_TAXONOMY.restaurantSearchClassification(s)}
function providerSearchTerms(s){
 const terms=RESTAURANT_TAXONOMY.searchAliasesFor(s).slice(0,2);
 const classification=RESTAURANT_TAXONOMY.restaurantSearchClassification(s);
 if(classification.kind==='category'&&classification.tag==='Burgers'&&!terms.includes('fast food'))terms.push('fast food');
 return terms.slice(0,4);
}
function searchRegexAlternatives(values){return '(?:'+values.map(searchRegex).filter(Boolean).join('|')+')';}
function searchRegex(value){return normalizeSearchQuery(value).split(' ').filter(Boolean).map(word=>word.split('').map(ch=>escapeOverpassRegex(ch)).join('[^a-z0-9]*')).join('[^a-z0-9]+')}
function isFastFoodName(name,brand='',operator=''){return FAST.test(String(name||'')+' '+String(brand||'')+' '+String(operator||''))}
function isClearlyNonDiningBusiness(row){
 const hay=norm([
  row?.name,row?.brand,row?.operator,row?.category,row?.cuisine,
  row?.providerType,row?.primaryType,
  Array.isArray(row?.types)?row.types.join(' '):row?.types,
  Array.isArray(row?.amenity)?row.amenity.join(' '):row?.amenity
 ].filter(Boolean).join(' '));
 if(!hay)return false;
 const nonDiningPattern=/\b(?:food supplier|food suppliers|food provider|food providers|food vendor|food vendors|food distributor|food distributors|food distribution|food wholesaler|food wholesalers|food wholesale|restaurant supply|restaurant supplies|restaurant supplier|restaurant suppliers|restaurant equipment|foodservice|food service company|food service supplier|food service distributor|food service equipment|wholesale food|wholesale foods|wholesale grocery|grocery distributor|grocery distribution|produce supplier|produce suppliers|produce distributor|produce distributors|produce company|meat supplier|meat suppliers|meat distributor|meat distributors|meat processing|meat processor|seafood supplier|seafood suppliers|seafood distributor|seafood distributors|beverage distributor|beverage distributors|commercial kitchen|catering supplier|catering suppliers|food processing|food processor|food manufacturing|food manufacturer|vending supplier|vending services|warehouse|warehousing|distribution center|logistics|freight|trucking|industrial|manufacturing|manufacturer|plumbing|hvac|heating and cooling|construction company|contractor|equipment supplier|equipment rental|office supply|office supplies|auto parts|car dealership|real estate|insurance|bank|attorney|law firm|accounting|consulting|storage facility|self storage|daycare|school|church|hospital|pharmacy|dentist|doctor|medical center)\b/i;
 if(nonDiningPattern.test(hay))return true;
 const knownNonDiningName=/\b(?:larson|larsons|larson's)\s+enterprises?\b/i;
 if(knownNonDiningName.test(norm(row?.name||'')))return true;
 const strongNonDiningType=/\b(?:supplier|suppliers|distributor|distributors|wholesaler|wholesalers|warehouse|warehouses|manufacturer|manufacturers|manufacturing|processor|processing|logistics|freight|trucking|industrial|contractor|plumbing|hvac|equipment supplier|restaurant equipment|commercial kitchen)\b/i;
 const diningHay=norm([
  row?.name,row?.brand,row?.operator,row?.cuisine,row?.providerType,row?.primaryType,
  Array.isArray(row?.types)?row.types.join(' '):row?.types
 ].filter(Boolean).join(' '));
 const diningType=/\b(?:restaurant|fast food|fast_food|pizzeria|diner|cafe|café|pub|tavern|bar|bistro|food truck|food court|food hall)\b/i;
 const sourceTypeHay=norm([row?.providerType,row?.primaryType,Array.isArray(row?.types)?row.types.join(' '):row?.types,Array.isArray(row?.amenity)?row.amenity.join(' '):row?.amenity].filter(Boolean).join(' '));
 if(strongNonDiningType.test(sourceTypeHay)&&!diningType.test(sourceTypeHay))return true;
 return strongNonDiningType.test(hay)&&!diningType.test(diningHay);
}
function filterNonDiningRows(rows){return (rows||[]).filter(row=>!isClearlyNonDiningBusiness(row))}
function miles(a,b,c,d){const R=3958.7613,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,z=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(z))}
async function json(url,opt={},timeout=9000){const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(url,{...opt,signal:ctl.signal,headers:{Accept:'application/json','User-Agent':'Dinliminate/1.0',...(opt.headers||{})}});const raw=await r.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{}if(!r.ok){const e=new Error('HTTP '+r.status);e.status=r.status;e.body=data;throw e}return data}finally{clearTimeout(t)}}
const HOURS_TIMEZONE_CACHE_TTL=6*60*60*1000;
const hoursTimezoneCache=new Map();
async function hoursTimezoneForCoordinates(lat,lon){
  const key=Number(lat).toFixed(3)+':'+Number(lon).toFixed(3);
  const hit=hoursTimezoneCache.get(key);
  if(hit&&Date.now()-hit.t<HOURS_TIMEZONE_CACHE_TTL)return hit.timeZone;
  try{
    const url='https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:String(lat),longitude:String(lon),timezone:'auto',forecast_days:'1'}).toString();
    const data=await json(url,{},2500);
    const timeZone=String(data?.timezone||'').trim();
    if(timeZone)hoursTimezoneCache.set(key,{t:Date.now(),timeZone});
    return timeZone;
  }catch{return '';}
}
async function googleBudgetedJson(skuKey,url,opt={},timeout=9000){
  const reservation=await reserveGoogleSku(skuKey,HARD_LIMITS[skuKey]);
  if(!reservation.ok){
    const e=new Error('Google '+skuKey+' monthly budget is exhausted.');
    e.code='GOOGLE_SKU_BUDGET';
    e.sku=skuKey;
    e.budget=reservation;
    throw e;
  }
  try{
    return await json(url,opt,timeout);
  }catch(e){
    if(Number(e?.status)===403||Number(e?.status)===429)await disableGoogleSkuForMonth(skuKey);
    throw e;
  }
}
function rate(req,mode){const headers=req?.headers||{},client=String(headers['x-forwarded-for']||headers['client-ip']||headers['x-nf-client-connection-ip']||headers['cf-connecting-ip']||'anon').split(',')[0].trim()||'anon',key=mode+':'+client,now=Date.now(),old=buckets.get(key),max=(mode==='suggest'||mode==='reverse'||mode==='resolve')?40:(mode==='search'?MAX_SEARCH_PER_MINUTE:18);if(!old||now-old.t>60000){buckets.set(key,{t:now,c:1});return false}old.c++;return old.c>max}
function osmRow(el,origin){const t=el?.tags||{},lat=n(el?.lat??el?.center?.lat),lon=n(el?.lon??el?.center?.lon),name=String(t.name||'').trim();if(!name||!Number.isFinite(lat)||!Number.isFinite(lon))return null;const amen=String(t.amenity||'restaurant').toLowerCase(),fast=amen==='fast_food'||isFastFoodName(name,String(t.brand||''),String(t.operator||''));let website=String(t.website||t['contact:website']||'').trim();if(website&&!/^https?:\/\//i.test(website))website='https://'+website;const key=norm(name)+'|'+lat.toFixed(4)+'|'+lon.toFixed(4);return{id:el?.osm_id?'osm-'+el.osm_id:'osm-'+key.replace(/ /g,'-'),name,category:fast?'Fast Food':(String(t.cuisine||'').trim()||'Restaurant'),fastFood:fast,cuisine:String(t.cuisine||''),providerType:String(t.amenity||''),address:[t['addr:housenumber'],t['addr:street'],t['addr:city'],t['addr:state'],t['addr:postcode']].filter(Boolean).join(', '),phone:String(t.phone||t['contact:phone']||''),website,opening_hours:String(t.opening_hours||''),hoursSource:String(t.opening_hours||'')?'OpenStreetMap':'',lat,lon,distance:miles(origin.lat,origin.lon,lat,lon),photo:String(t.image||t.image_url||''),menuItems:[t.dish,t['dish:name'],t['menu:items'],t.menu_items].flatMap(v=>String(v||'').split(/[|;•,]/)).map(x=>x.trim()).filter(Boolean).slice(0,10),brand:String(t.brand||''),source:'OpenStreetMap'} }
function queryClause(lat,lon,radius,types=DINING_AMENITIES){
 const m=Math.round(Math.min(50,radius)*1609.344);
 if(types==='fast_food'){
   const pattern='mcdonald|taco bell|wendy|burger king|kfc|chick[- ]?fil[- ]?a|popeye|subway|sonic|arby|whataburger|five guys|culver|raising cane|wingstop|bojangles|cook ?out|dairy queen|jack in the box|hardee|del taco|checkers|rally|zaxby|churchs|captain ds|long john silver|jimmy john|jersey mike|firehouse subs|little caesars|domino|papa john|pizza hut|marcos pizza|krystal|steak ?n shake|white castle|freddy|in[- ]?n[- ]?out|carl.?s jr|panda express|jacks|chipotle';
   return 'nwr[amenity="fast_food"][name](around:'+m+','+lat+','+lon+');nwr[name~"'+pattern+'",i](around:'+m+','+lat+','+lon+');nwr[brand~"'+pattern+'",i](around:'+m+','+lat+','+lon+');';
 }
 return 'nwr[amenity~"^('+types+')$"][name](around:'+m+','+lat+','+lon+');';
}
function query(lat,lon,radius,types=DINING_AMENITIES){
 return '[out:json][timeout:16];('+queryClause(lat,lon,radius,types)+');out center tags;';
}
function queryMany(points,types=DINING_AMENITIES,timeoutSeconds=10){
 return '[out:json][timeout:'+Math.max(6,Math.min(16,Number(timeoutSeconds)||10))+'];('+points.map(c=>queryClause(c.lat,c.lon,c.radius,types)).join('')+');out center tags;';
}
function centers(lat,lon,r){
 const radius=clamp(r);
 // Deterministic overlapping search tiles. The final origin-distance filter
 // still guarantees that only places inside the user's selected radius return.
 // 1-10mi: one exact-radius circle.
 if(radius<=10)return[{lat,lon,radius}];
 // 11-25mi: 15mi tiles on a 6-point ring plus the origin.
 if(radius<=25){
  const tile=15,ring=15,count=6,out=[{lat,lon,radius:tile}];
  const a=ring/69,b=ring/(69*Math.max(.35,Math.cos(lat*Math.PI/180)));
  for(let i=0;i<count;i++){
   const ang=i*2*Math.PI/count;
   out.push({lat:lat+Math.sin(ang)*a,lon:lon+Math.cos(ang)*b,radius:tile});
  }
  return out;
 }
 // 26-50mi: 30mi tiles on a 6-point ring plus the origin.
 if(radius<=50){
  const tile=30,ring=30,count=6,out=[{lat,lon,radius:tile}];
  const a=ring/69,b=ring/(69*Math.max(.35,Math.cos(lat*Math.PI/180)));
  for(let i=0;i<count;i++){
   const ang=i*2*Math.PI/count;
   out.push({lat:lat+Math.sin(ang)*a,lon:lon+Math.cos(ang)*b,radius:tile});
  }
  return out;
 }
 // 51-100mi: a 40mi origin tile plus a 12-point 75mi outer ring of 40mi
 // tiles. This fully covers the 100mi disk with overlap while keeping each
 // upstream query comfortably below the 50mi provider cap.
 const tile=40,ring=75,count=12,out=[{lat,lon,radius:tile}];
 const a=ring/69,b=ring/(69*Math.max(.35,Math.cos(lat*Math.PI/180)));
 for(let i=0;i<count;i++){
  const ang=i*2*Math.PI/count;
  out.push({lat:lat+Math.sin(ang)*a,lon:lon+Math.cos(ang)*b,radius:tile});
 }
 return out;
}

function providerCenters(lat,lon,radius){
 const r=clamp(radius);
 if(r<=1)return[{lat,lon,radius:r}];
 const spec=r<=3?{tile:2.1,ring:1.8,count:6}:r<=5?{tile:3.3,ring:3,count:6}:{tile:6,ring:6,count:6};
 const out=[{lat,lon,radius:radius}];
 const a=spec.ring/69,b=spec.ring/(69*Math.max(.35,Math.cos(lat*Math.PI/180)));
 for(let i=0;i<spec.count;i++){
  const ang=i*2*Math.PI/spec.count;
  out.push({lat:lat+Math.sin(ang)*a,lon:lon+Math.cos(ang)*b,radius:spec.tile});
 }
 return out;
}

async function tiledPhotonPlaces(lat,lon,radius,searchTerm=''){
 const points=providerCenters(lat,lon,radius),rows=[],errors=[];
 // Two tiles at a time avoids hammering public providers while still giving
 // small radii deterministic geographic coverage instead of one capped query.
 for(let i=0;i<points.length;i+=2){
  const settled=await Promise.allSettled(points.slice(i,i+2).map(p=>photonPlaces(p.lat,p.lon,p.radius,searchTerm)));
  for(const result of settled){
   if(result.status!=='fulfilled'){errors.push(String(result.reason?.message||result.reason||'Photon tile failed'));continue;}
   rows.push(...(result.value?.rows||[]));
   errors.push(...(result.value?.errors||[]));
  }
 }
 return{rows:dedupe(rows),errors,tiles:points.length};
}

async function tiledArcgisPlaces(lat,lon,radius,searchTerm=''){
 const points=providerCenters(lat,lon,radius),rows=[],errors=[];
 for(let i=0;i<points.length;i+=2){
  const settled=await Promise.allSettled(points.slice(i,i+2).map(p=>arcgisPlaces(p.lat,p.lon,p.radius,searchTerm)));
  for(const result of settled){
   if(result.status!=='fulfilled'){errors.push(String(result.reason?.message||result.reason||'ArcGIS tile failed'));continue;}
   rows.push(...(result.value?.rows||[]));
   errors.push(...(result.value?.errors||[]));
  }
 }
 return{rows:dedupe(rows),errors,tiles:points.length};
}

function photonRow(feature,origin){
 const p=feature?.properties||{},c=feature?.geometry?.coordinates||[],lon=n(c[0]),lat=n(c[1]),name=String(p.name||p.label||'').split(',')[0].trim();
 if(!name||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 const osmValue=String(p.osm_value||'').toLowerCase(),amenity=String(p.type||p.osm_key||'').toLowerCase(),fast=osmValue==='fast_food'||amenity==='fast_food'||isFastFoodName(name,String(p.brand||''),String(p.operator||''));
 const website=String(p.website||p.url||'').trim(),dist=miles(origin.lat,origin.lon,lat,lon);
 return {id:p.osm_id?'photon-'+p.osm_id:'photon-'+norm(name)+'-'+lat.toFixed(5)+'-'+lon.toFixed(5),name,category:fast?'Fast Food':(String(p.cuisine||'').trim()||'Restaurant'),fastFood:fast,cuisine:String(p.cuisine||''),providerType:String(p.osm_value||p.osm_key||p.type||''),address:[p.street,p.housenumber,p.city||p.town||p.village,p.state,p.postcode].filter(Boolean).join(', '),phone:String(p.phone||''),website:(/^https?:/.test(website)?website:(website?'https://'+website:'')),opening_hours:String(p.opening_hours||''),hoursSource:String(p.opening_hours||'')?'OpenStreetMap':'',lat,lon,distance:dist,photo:String(p.image||p.image_url||''),menuItems:[p.dish,p['dish:name'],p.menu_items,p['menu:items']].flatMap(v=>String(v||'').split(/[|;•,]/)).map(x=>x.trim()).filter(Boolean).slice(0,10),brand:String(p.brand||''),source:'Photon POI'};
}
async function photonPlaces(lat,lon,radius,searchTerm=''){
 const r=Math.min(MAX_RADIUS,Math.max(1,radius)),latD=r/69,lonD=r/(69*Math.max(.35,Math.cos(lat*Math.PI/180))),bbox=[lon-lonD,lat-latD,lon+lonD,lat+latD].join(',');
 const limit=radius>25?'250':'120',term=normalizeSearchQuery(searchTerm);
 const terms=providerSearchTerms(term);
 const base=[];
 for(const qTerm of terms){
   base.push(new URLSearchParams({q:qTerm||'restaurant',osm_tag:'amenity:restaurant',bbox,limit,lang:'en',countrycode:'US',dedupe:'1',lat:String(lat),lon:String(lon),zoom:'12'}));
   base.push(new URLSearchParams({q:qTerm||'fast food',osm_tag:'amenity:fast_food',bbox,limit,lang:'en',countrycode:'US',dedupe:'1',lat:String(lat),lon:String(lon),zoom:'12'}));
 }
 const rows=[],errors=[];
 const consume=(result)=>{if(result.status!=='fulfilled'){errors.push(String(result.reason?.message||result.reason));return}for(const feature of result.value?.features||[]){const pv=feature?.properties||{},ov=String(pv.osm_value||'').toLowerCase(),ok=String(pv.osm_key||'').toLowerCase();if(ok==='amenity'&&!DINING_AMENITIES.split('|').includes(ov)&&!FAST.test(String(pv.name||pv.brand||pv.operator||'')))continue;const row=photonRow(feature,{lat,lon});if(row&&row.distance<=radius&&!isClearlyNonDiningBusiness(row))rows.push(row)}};
 for(const result of await Promise.allSettled(base.map(p=>json('https://photon.komoot.io/api/?'+p.toString(),{},2200))))consume(result);
 const primaryFastCount=rows.filter(r=>r.fastFood).length;
 const missingKnown=!term && radius<=25 && rows.length===0 ? TARGETED_FAST.filter(name=>!rows.some(r=>norm(r.name)===norm(name)||norm(r.name).includes(norm(name)))).slice(0,3) : [];
 if(missingKnown.length){
   const qs=missingKnown.map(q=>new URLSearchParams({q,bbox,limit:'10',lang:'en',countrycode:'US',dedupe:'1',lat:String(lat),lon:String(lon),zoom:'12'}));
   for(const result of await Promise.allSettled(qs.map(p=>json('https://photon.komoot.io/api/?'+p.toString(),{},1800))))consume(result);
 }
 return {rows,errors};
}

async function arcgisPlaces(lat,lon,radius,searchTerm='',timeout=2400){
 const r=Math.min(MAX_RADIUS,Math.max(1,radius)),latD=r/69,lonD=r/(69*Math.max(.35,Math.cos(lat*Math.PI/180)));
 const extent=[lon-lonD,lat-latD,lon+lonD,lat+latD].join(',');
 const terms=providerSearchTerms(searchTerm),categories=['Restaurant','Fast Food'],rows=[],errors=[];
 const jobs=[];
 for(const category of categories)for(const term of terms)jobs.push((async()=>{
   const params=new URLSearchParams({SingleLine:term,category,location:lon+','+lat,searchExtent:extent,maxLocations:'50',outFields:'PlaceName,Type,Place_addr,City,Region,Country,Phone,URL',forStorage:'false',f:'json'});
   return {category,data:await json('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?'+params.toString(),{},timeout)};
 })());
 const results=await Promise.allSettled(jobs);
 for(const result of results){
   if(result.status!=='fulfilled'){errors.push(String(result.reason?.message||result.reason));continue}
   const category=result.value.category;
   for(const cand of result.value.data?.candidates||[]){
     const a=cand?.location||{},cl=n(a.y),cn=n(a.x),attrs=cand?.attributes||{},name=String(attrs.PlaceName||cand.address||'').trim();
     if(!name||!Number.isFinite(cl)||!Number.isFinite(cn))continue;
     const fast=category==='Fast Food'||isFastFoodName(name,String(attrs.Type||''));
     const row={id:'arcgis-'+norm(name)+'-'+cl.toFixed(5)+'-'+cn.toFixed(5),name,category:fast?'Fast Food':'Restaurant',fastFood:fast,cuisine:'',providerType:String(attrs.Type||''),address:String(attrs.Place_addr||cand.address||''),phone:String(attrs.Phone||attrs.phone||''),website:String(attrs.URL||attrs.Url||attrs.url||''),opening_hours:'',lat:cl,lon:cn,distance:miles(lat,lon,cl,cn),photo:'',menuItems:[],brand:'',source:'ArcGIS POI'};
     if(row.distance<=r&&!isClearlyNonDiningBusiness(row))rows.push(row);
   }
 }
 return {rows,errors};
}

function radiusExpansionSpec(radius){
 const r=clamp(radius);
 if(r<=10)return null;
 if(r<=25)return {tile:15,ring:15,count:6};
 if(r<=50)return {tile:30,ring:30,count:6};
 return {tile:50,ring:60,count:10};
}
function radiusExpansionCenters(lat,lon,radius){
 const spec=radiusExpansionSpec(radius);
 if(!spec)return [];
 const a=spec.ring/69,b=spec.ring/(69*Math.max(.35,Math.cos(lat*Math.PI/180)));
 const out=[{lat,lon,radius:spec.tile}];
 for(let i=0;i<spec.count;i++){
  const ang=i*2*Math.PI/spec.count;
  out.push({
   lat:lat+Math.sin(ang)*a,
   lon:lon+Math.cos(ang)*b,
   radius:spec.tile
  });
 }
 return out;
}
async function radiusOverpassExpansion(lat,lon,radius,searchTerm=''){
 const points=radiusExpansionCenters(lat,lon,radius);
 if(!points.length)return{rows:[],errors:[],tiles:0,provider:'none'};
 return overpassPoints(points,lat,lon,radius,'restaurant|fast_food',searchTerm,OVERPASS,OVERPASS_HTTP_TIMEOUT_MS);
}

async function photonRadiusExpansion(lat,lon,radius,searchTerm=''){
 const points=radiusExpansionCenters(lat,lon,radius),rows=[],errors=[];
 if(!points.length)return{rows,errors,tiles:0,provider:'none'};
 const tasks=points.map(p=>photonWideCenterPlaces(
   p.lat,p.lon,p.radius,lat,lon,radius,searchTerm
 ));
 const settled=await Promise.allSettled(tasks);
 for(const result of settled){
  if(result.status!=='fulfilled'){
   errors.push(String(result.reason?.message||result.reason||'Photon expansion failed'));
   continue;
  }
  rows.push(...(result.value?.rows||[]));
  errors.push(...(result.value?.errors||[]));
 }
 return{rows:dedupe(rows),errors,tiles:points.length,provider:'Photon expansion'};
}

async function photonWideCenterPlaces(tileLat,tileLon,searchExtentRadius,originLat,originLon,selectedRadius,searchTerm=''){
 const r=Math.min(50,Math.max(1,Number(searchExtentRadius)||50));
 const latD=r/69,lonD=r/(69*Math.max(.35,Math.cos(tileLat*Math.PI/180)));
 const bbox=[tileLon-lonD,tileLat-latD,tileLon+lonD,tileLat+latD].join(',');
 const base=[
  new URLSearchParams({q:searchTerm||'restaurant',osm_tag:'amenity:restaurant',bbox,limit:'250',lang:'en',countrycode:'US',dedupe:'1',lat:String(tileLat),lon:String(tileLon),zoom:'11'}),
  new URLSearchParams({q:searchTerm||'fast food',osm_tag:'amenity:fast_food',bbox,limit:'250',lang:'en',countrycode:'US',dedupe:'1',lat:String(tileLat),lon:String(tileLon),zoom:'11'})
 ];
 const rows=[],errors=[];
 const settled=await Promise.allSettled(base.map(p=>json('https://photon.komoot.io/api/?'+p.toString(),{},RADIUS_EXPANSION_QUERY_TIMEOUT_MS)));
 for(const result of settled){
  if(result.status!=='fulfilled'){
   errors.push(String(result.reason?.message||result.reason||'Photon expansion failed'));
   continue;
  }
  for(const feature of result.value?.features||[]){
   const row=photonRow(feature,{lat:originLat,lon:originLon});
   if(row&&row.distance<=selectedRadius&&!isClearlyNonDiningBusiness(row))rows.push(row);
  }
 }
 return{rows,errors};
}

function firstProviderWithRows(tasks,timeoutMs=1800){
 const started=Date.now();
 return new Promise(resolve=>{
   let settled=0,done=false;
   const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value)};
   const timer=setTimeout(()=>finish({provider:'timeout',value:{rows:[],errors:['Primary provider race timed out']}}),Math.max(600,timeoutMs));
   tasks.forEach((task,i)=>{
     Promise.resolve(task).then(value=>{
       settled++;
       if(value&&Array.isArray(value.rows)&&value.rows.length){
         finish({provider:i,value});
       }else if(settled===tasks.length){
         finish({provider:'empty',value:{rows:[],errors:['All primary providers returned no restaurants'],elapsedMs:Date.now()-started}});
       }
     }).catch(error=>{
       settled++;
       if(settled===tasks.length)finish({provider:'error',value:{rows:[],errors:[String(error?.message||error||'Primary providers failed')],elapsedMs:Date.now()-started}});
     });
   });
 });
}
async function photonWidePlaces(lat,lon,radius,searchTerm=''){
 const points=widePhotonCenters(lat,lon,radius),rows=[],errors=[];
 const settled=await Promise.allSettled(points.map(p=>photonWideCenterPlaces(p.lat,p.lon,50,searchTerm)));
 for(const result of settled){
  if(result.status!=='fulfilled'){errors.push(String(result.reason?.message||result.reason||'Photon outer expansion failed'));continue}
  rows.push(...(result.value?.rows||[]));
  errors.push(...(result.value?.errors||[]));
 }
 return {rows:dedupe(rows),errors,expansionPoints:points.length};
}

function searchQueryClause(lat,lon,radius,searchTerm){
 const m=Math.round(Math.min(50,radius)*1609.344),pattern=searchRegexAlternatives(providerSearchTerms(searchTerm));
 if(!pattern)return '';
 return 'nwr[amenity~"^(restaurant|fast_food)$"][name~"'+pattern+'",i](around:'+m+','+lat+','+lon+');nwr[amenity~"^(restaurant|fast_food)$"][brand~"'+pattern+'",i](around:'+m+','+lat+','+lon+');nwr[amenity~"^(restaurant|fast_food)$"][operator~"'+pattern+'",i](around:'+m+','+lat+','+lon+');nwr[amenity~"^(restaurant|fast_food)$"][cuisine~"'+pattern+'",i](around:'+m+','+lat+','+lon+');';
}
function searchQueryMany(points,searchTerm,timeoutSeconds=10){return '[out:json][timeout:'+Math.max(6,Math.min(16,Number(timeoutSeconds)||10))+'];('+points.map(c=>searchQueryClause(c.lat,c.lon,c.radius,searchTerm)).join('')+');out center tags;'}
function radiusDiscoveryPlan(lat,lon,radius){
 const r=clamp(radius),coverage=centers(lat,lon,r),groups=[];
 const groupSize=r>WIDE_RADIUS_THRESHOLD?WIDE_OVERPASS_GROUP_SIZE:TILED_OVERPASS_GROUP_SIZE;
 for(let i=0;i<coverage.length;i+=groupSize)groups.push(coverage.slice(i,i+groupSize));
 return {
  mode:r>WIDE_RADIUS_THRESHOLD?'wide':'tiled',
  reserveMs:r>WIDE_RADIUS_THRESHOLD?WIDE_DISCOVERY_RESERVE_MS:0,
  coveragePoints:coverage.length,
  groups
 };
}
async function overpassPoints(points,originLat,originLon,radius,types='restaurant|fast_food',searchTerm='',endpoints=OVERPASS,timeout=OVERPASS_HTTP_TIMEOUT_MS){
 const term=normalizeSearchQuery(searchTerm),seconds=Math.max(6,Math.min(16,Math.ceil(Number(timeout||OVERPASS_HTTP_TIMEOUT_MS)/1000)));
 const data=term?searchQueryMany(points,term,seconds):queryMany(points,types,seconds),rows=[],errors=[];
 // Use one mirror at a time per tile. When a mirror errors or returns an empty
 // result, immediately try the next mirror for that same geographic tile.
 for(const ep of endpoints){
  try{
   const payload=await json(ep+'?data='+encodeURIComponent(data),{},timeout);
   const elements=payload?.elements||[];
   for(const el of elements){const r=osmRow(el,{lat:originLat,lon:originLon});if(r&&r.distance<=radius)rows.push(r);}
   if(elements.length)return{rows:dedupe(rows),errors};
   errors.push('Overpass returned no elements');
  }catch(e){
   errors.push(String(e?.message||e||'request failed'));
  }
 }
 return{rows:dedupe(rows),errors};
}
async function tiledRadiusOverpass(lat,lon,radius,types='restaurant|fast_food',searchTerm=''){
 const plan=radiusDiscoveryPlan(lat,lon,radius),rows=[],errors=[];
 const endpointPairs=plan.groups.map((_,i)=>[
   OVERPASS[i%OVERPASS.length],
   OVERPASS[(i+1)%OVERPASS.length]
 ]);
 const tasks=plan.groups.map((group,i)=>overpassPoints(
   group,lat,lon,radius,types,searchTerm,endpointPairs[i],OVERPASS_HTTP_TIMEOUT_MS
 ));
 const settled=await Promise.allSettled(tasks);
 for(const result of settled){
   if(result.status!=='fulfilled'){errors.push(String(result.reason?.message||result.reason||'radius discovery failed'));continue;}
   rows.push(...(result.value.rows||[]));
   errors.push(...(result.value.errors||[]));
 }
 return{rows:dedupe(rows),errors,groups:plan.groups.length,coveragePoints:plan.coveragePoints,endpointPairs:endpointPairs.length*2};
}
async function overpass(lat,lon,radius,types='restaurant|fast_food',searchTerm=''){
 return tiledRadiusOverpass(lat,lon,radius,types,searchTerm);
}
async function wideRadiusOverpass(lat,lon,radius,searchTerm=''){
 const result=await tiledRadiusOverpass(lat,lon,radius,'restaurant|fast_food',searchTerm);
 return{...result};
}
const KNOWN_RESTAURANT_WEBSITES={
  "mcdonald's":'https://www.mcdonalds.com',"taco bell":'https://www.tacobell.com',"wendy's":'https://www.wendys.com',"the thirsty goat":'https://www.thirstygoatsango.com',"johnny's big burger":'https://thebigburger.com',"edward's steakhouse":'https://www.edwardssteakhouse.net',"shelbys trio":'https://www.toasttab.com/local/order/shelbys-trio-304-north-2nd-street',"thirsty goat":'https://www.thirstygoatsango.com',"burger king":'https://www.bk.com',"kfc":'https://www.kfc.com',"chick fil a":'https://www.chick-fil-a.com',"popeyes":'https://www.popeyes.com',"subway":'https://www.subway.com',"sonic":'https://www.sonicdrivein.com',"arby's":'https://www.arbys.com',"whataburger":'https://whataburger.com',"five guys":'https://www.fiveguys.com',"culver's":'https://www.culvers.com',"raising cane's":'https://www.raisingcanes.com',"wingstop":'https://www.wingstop.com',"bojangles":'https://www.bojangles.com',"cook out":'https://www.cookout.com',"dairy queen":'https://www.dairyqueen.com',"zaxby's":'https://www.zaxbys.com',"church's chicken":'https://www.churchs.com',"captain d's":'https://www.captainds.com',"long john silver's":'https://www.ljsilvers.com',"jimmy john's":'https://www.jimmyjohns.com',"jersey mike's":'https://www.jerseymikes.com',"firehouse subs":'https://www.firehousesubs.com',"little caesars":'https://littlecaesars.com',"domino's":'https://www.dominos.com',"papa john's":'https://www.papajohns.com',"pizza hut":'https://www.pizzahut.com',"marco's pizza":'https://www.marcos.com',"krystal":'https://www.krystal.com',"steak 'n shake":'https://www.steaknshake.com',"white castle":'https://www.whitecastle.com',"freddy's":'https://www.freddys.com',"panda express":'https://www.pandaexpress.com',"jack in the box":'https://www.jackinthebox.com',"hardee's":'https://www.hardees.com',"del taco":'https://www.deltaco.com',"checkers":'https://www.checkers.com',"rally's":'https://www.rallys.com',"chipotle":'https://www.chipotle.com',"applebee's":'https://www.applebees.com',"chili's":'https://www.chilis.com',"olive garden":'https://www.olivegarden.com',"waffle house":'https://www.wafflehouse.com'
};
const officialWebsiteCache=new Map();
const OFFICIAL_WEBSITE_CACHE_TTL=7*24*60*60*1000;
const OFFICIAL_WEBSITE_NEGATIVE_TTL=24*60*60*1000;
const BLOCKED_WEBSITE_HOSTS=new Set([
 'google.com','www.google.com','bing.com','www.bing.com','yelp.com','www.yelp.com',
 'tripadvisor.com','www.tripadvisor.com','facebook.com','www.facebook.com',
 'instagram.com','www.instagram.com','doordash.com','www.doordash.com',
 'ubereats.com','www.ubereats.com','grubhub.com','www.grubhub.com',
 'restaurantguru.com','www.restaurantguru.com','restaurantji.com','www.restaurantji.com',
 'usarestaurants.info','www.usarestaurants.info'
]);
const WEBSITE_DISCOVERY_HOSTS=new Set([
 'facebook.com','www.facebook.com','m.facebook.com','l.facebook.com',
 'instagram.com','www.instagram.com',
 'yelp.com','www.yelp.com','tripadvisor.com','www.tripadvisor.com',
 'yellowpages.com','www.yellowpages.com','mapquest.com','www.mapquest.com',
 'foursquare.com','www.foursquare.com','bbb.org','www.bbb.org',
 'chamberofcommerce.com','www.chamberofcommerce.com',
 'visitclarksvilletn.com','www.visitclarksvilletn.com',
 'restaurantguru.com','www.restaurantguru.com','restaurantji.com','www.restaurantji.com',
 'usarestaurants.info','www.usarestaurants.info'
]);
const WEBSITE_QUERY_FILLERS=new Set(['the','a','an','of','at','on','in','restaurant','restaurants','location','store','llc','inc','co','company','ltd']);
function websiteHost(url){
 try{return new URL(String(url||'')).hostname.toLowerCase().replace(/^www\./,'');}catch{return ''}
}
function isBlockedWebsite(url){
 const host=websiteHost(url);
 if(!host)return true;
 return [...BLOCKED_WEBSITE_HOSTS].some(x=>host===x||host.endsWith('.'+x));
}
function isDiscoveryHost(url){
 const host=websiteHost(url);
 return !!host&&[...WEBSITE_DISCOVERY_HOSTS].some(x=>host===x||host.endsWith('.'+x));
}
function safeWebsiteUrl(url){
 const raw=String(url||'').trim();
 if(!/^https?:\/\//i.test(raw)||isBlockedWebsite(raw))return '';
 try{
  const u=new URL(raw);u.hash='';
  return u.toString();
 }catch{return ''}
}
function safeDiscoveryUrl(url,base=''){
 const raw=String(url||'').trim();
 if(!raw)return '';
 try{
  const absolute=/^https?:\/\//i.test(raw)?raw:new URL(raw,base||undefined).toString();
  if(!/^https?:\/\//i.test(absolute)||!isDiscoveryHost(absolute))return '';
  return absolute;
 }catch{return ''}
}
function websiteBusinessTokens(value){
 return normalizeSearchQuery(value).split(' ').filter(x=>x.length>=3&&!WEBSITE_QUERY_FILLERS.has(x));
}
function digitsOnly(value){return String(value||'').replace(/\D/g,'');}
function htmlText(value){
 return String(value||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/\s+/g,' ').trim();
}
async function fetchValidatedWebsite(url,options={},validate=safeWebsiteUrl,maxRedirects=4){
  let current=validate(url);
  if(!current)return null;
  for(let hop=0;hop<=maxRedirects;hop++){
    const response=await fetch(current,{...options,redirect:'manual'});
    if(!(response.status>=300&&response.status<400))return {response,url:current};
    const location=response.headers.get('location');
    if(!location)return null;
    try{
      const next=new URL(location,current).toString();
      if(!validate(next))return null;
      current=next;
    }catch{return null}
  }
  return null;
}

async function fetchWebPage(url,timeout=3500,maxBytes=1200000){
 const page=safeWebsiteUrl(url);if(!page)return null;
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
 try{
  const result=await fetchValidatedWebsite(page,{headers:{
   Accept:'text/html,application/xhtml+xml',
   'Accept-Language':'en-US,en;q=0.8',
   'User-Agent':'Mozilla/5.0 (compatible; Dinliminate/1.0; official-website-resolver)'
  },signal:ctl.signal},safeWebsiteUrl);
  if(!result)return null;
  const response=result.response;
  if(!response.ok||isBlockedWebsite(result.url))return null;
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>maxBytes)return null;
  return {url:page,finalUrl:result.url,html:bytes.toString('utf8')};
 }catch{return null}finally{clearTimeout(timer)}
}
async function fetchDiscoveryPage(url,timeout=3000,maxBytes=1000000){
 const page=safeDiscoveryUrl(url);if(!page)return null;
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
 try{
  const result=await fetchValidatedWebsite(page,{headers:{
   Accept:'text/html,application/xhtml+xml',
   'Accept-Language':'en-US,en;q=0.8',
   'User-Agent':'Mozilla/5.0 (compatible; Dinliminate/1.0; official-web-presence-resolver)'
  },signal:ctl.signal},safeDiscoveryUrl);
  if(!result)return null;
  const response=result.response;
  if(!response.ok)return null;
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>maxBytes)return null;
  const finalUrl=safeWebsiteUrl(result.url);
  if(finalUrl&&!isDiscoveryHost(result.url))return {url:page,finalUrl,html:bytes.toString('utf8')};
  if(!isDiscoveryHost(result.url))return null;
  return {url:page,finalUrl:'',html:bytes.toString('utf8')};
 }catch{return null}finally{clearTimeout(timer)}
}
async function fetchBingSearchPage(query){
 const url='https://www.bing.com/search?'+new URLSearchParams({q:String(query||''),mkt:'en-US',first:'1'}).toString();
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),3500);
 try{
  const response=await fetch(url,{headers:{
   Accept:'text/html,application/xhtml+xml',
   'Accept-Language':'en-US,en;q=0.8',
   'User-Agent':'Mozilla/5.0 (compatible; Dinliminate/1.0; official-web-presence-resolver)'
  },signal:ctl.signal});
  if(!response.ok)return null;
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>800000)return null;
  return bytes.toString('utf8');
 }catch{return null}finally{clearTimeout(timer)}
}
function decodeHtmlAttribute(value){
 return String(value||'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}

async function fetchPublicSearchPage(base,query){
 const url=base+'?'+new URLSearchParams({q:String(query||''),mkt:'en-US',first:'1'}).toString();
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),3200);
 try{
  const response=await fetch(url,{headers:{
   Accept:'text/html,application/xhtml+xml',
   'Accept-Language':'en-US,en;q=0.8',
   'User-Agent':'Mozilla/5.0 (compatible; Dinliminate/1.0; official-web-presence-resolver)'
  },signal:ctl.signal});
  if(!response.ok)return null;
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>900000)return null;
  return bytes.toString('utf8');
 }catch{return null}finally{clearTimeout(timer)}
}
async function fetchDuckDuckGoSearchPage(query){
 return fetchPublicSearchPage('https://html.duckduckgo.com/html/',query);
}
async function fetchGoogleWebSearchPage(query){
 return fetchPublicSearchPage('https://www.google.com/search',query);
}
function extractSearchResultUrl(raw,base='https://www.google.com/'){
 const decoded=decodeHtmlAttribute(raw);
 try{
  const absolute=/^https?:\/\//i.test(decoded)?decoded:new URL(decoded,base).toString();
  const u=new URL(absolute);
  for(const key of ['q','url','uddg']){
   const nested=u.searchParams.get(key);
   if(nested&&/^https?:\/\//i.test(nested))return nested;
  }
  return absolute;
 }catch{return ''}
}
function extractGenericSearchResults(html,sourceHost=''){
 const out=[],seen=new Set();
 const add=(raw,title='')=>{
  const url=extractSearchResultUrl(raw);
  if(!url)return;
  const host=websiteHost(url);if(!host||host===sourceHost||host.includes('google.')||host.includes('bing.')||host.includes('duckduckgo.'))return;
  const canonical=safeWebsiteUrl(url)||safeDiscoveryUrl(url);
  if(!canonical||seen.has(canonical))return;
  seen.add(canonical);
  const kind=isDiscoveryHost(canonical)?(host.includes('facebook.com')?'facebook':host.includes('instagram.com')?'instagram':'directory'):'website';
  out.push({url:canonical,title:htmlText(title),kind});
 };
 const anchorRe=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/ig;
 let m;
 while((m=anchorRe.exec(String(html||'')))&&out.length<30)add(m[1],m[2]);
 const urlRe=/(https?:\/\/[^\s"'<>]+)/ig;
 while((m=urlRe.exec(String(html||'')))&&out.length<40)add(m[1],'');
 return out;
}
function directWebsiteDomainCandidates(name,address,brand=''){
 const nameWords=websiteBusinessTokens(name);
 const brandWords=websiteBusinessTokens(brand);
 const compact=(words)=>words.join('');
 const stripThe=(words)=>words.filter(x=>x!=='the');
 const addr=normalizeSearchQuery(address).split(' ').filter(Boolean);
 const city=addr.length?addr.slice(-3).find(x=>x.length>=4&&!/^\d+$/.test(x))||'':'';
 const state=addr.includes('tn')?'tn':'';
 const bases=[];
 for(const words of [stripThe(nameWords),stripThe(brandWords)]){
  const core=compact(words);
  if(core&&core.length>=5)bases.push(core);
  if(core&&city)bases.push(core+city);
  if(core&&state)bases.push(core+state);
  if(core&&!core.endsWith('s'))bases.push(core+'s');
  if(core&&city&&!core.endsWith('s'))bases.push(core+'s'+city);
 }
 return [...new Set(bases)]
  .filter(x=>/^[a-z0-9]+$/.test(x))
  .slice(0,10)
  .flatMap(x=>['https://'+x+'.com']);
}
function extractBingDiscoveryResults(html){
 return extractGenericSearchResults(html,'bing.com');
}
function extractBingWebsiteResults(html){
 return extractBingDiscoveryResults(html).filter(x=>x.kind==='website').map(({url,title})=>({url,title}));
}
function extractExternalWebsiteLinks(html,sourceUrl=''){
 const out=[],seen=new Set(),sourceHost=websiteHost(sourceUrl);
 const add=(raw,text='')=>{
  let href=decodeHtmlAttribute(raw).trim();if(!href)return;
  try{
   if(!/^https?:\/\//i.test(href))href=new URL(href,sourceUrl).toString();
   const u=new URL(href);
   if(u.hostname==='l.facebook.com'){
    const redirected=u.searchParams.get('u')||u.searchParams.get('url');
    if(redirected)href=decodeURIComponent(redirected);
   }
  }catch{return}
  const safe=safeWebsiteUrl(href);if(!safe)return;
  const host=websiteHost(safe);
  if(!host||host===sourceHost||seen.has(safe))return;
  seen.add(safe);
  const label=normalizeSearchQuery(text);
  let score=0;
  if(/\b(?:website|official|site|homepage|order|menu)\b/i.test(label))score+=30;
  if(host.split('.')[0].length>=5)score+=5;
  out.push({url:safe,title:text,score});
 };
 const anchorRe=/<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/ig;
 let m;
 while((m=anchorRe.exec(String(html||'')))&&out.length<40)add(m[1],htmlText(m[2]));
 const plainRe=/(https?:\/\/[^\s"'<>]+)/ig;
 while((m=plainRe.exec(String(html||'')))&&out.length<50)add(m[1],'');
 return out.sort((a,b)=>b.score-a.score);
}
function parseJsonLdObjects(html){
  const out=[];
  const re=/<script\b[^>]*type=[\"']application\/ld\+json[\"'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while((match=re.exec(String(html||'')))){
    let raw=String(match[1]||'').trim();
    if(!raw)continue;
    raw=raw.replace(/^<!--[\s\S]*?-->/,'').trim();
    try{
      const parsed=JSON.parse(raw);
      const visit=(value)=>{
        if(Array.isArray(value)){value.forEach(visit);return;}
        if(!value||typeof value!=='object')return;
        out.push(value);
        if(Array.isArray(value['@graph']))value['@graph'].forEach(visit);
      };
      visit(parsed);
    }catch{}
  }
  return out;
}
function jsonLdTypeIsRestaurant(value){
  const type=value?.['@type'];
  const list=Array.isArray(type)?type:[type];
  return list.some(x=>/restaurant|foodestablishment|localbusiness/i.test(String(x||'')));
}
function normalizeOpeningHoursValue(value){
  if(Array.isArray(value))return value.map(x=>String(x||'').trim()).filter(Boolean);
  if(typeof value==='string'&&value.trim())return [value.trim()];
  return [];
}
function formatOpeningHoursSpecification(specs){
  if(!Array.isArray(specs))return [];
  const dayNames={Mo:'Mon',Tu:'Tue',We:'Wed',Th:'Thu',Fr:'Fri',Sa:'Sat',Su:'Sun',
    Monday:'Mon',Tuesday:'Tue',Wednesday:'Wed',Thursday:'Thu',Friday:'Fri',Saturday:'Sat',Sunday:'Sun'};
  const groups=new Map();
  for(const spec of specs){
    if(!spec||typeof spec!=='object')continue;
    const days=Array.isArray(spec.dayOfWeek)?spec.dayOfWeek:[spec.dayOfWeek];
    const opens=String(spec.opens||'').trim(),closes=String(spec.closes||'').trim();
    if(!opens||!closes)continue;
    const range=opens+'–'+closes;
    for(const rawDay of days){
      const raw=String(rawDay||'').split('/').pop();
      const short=dayNames[raw]||raw;
      if(!short)continue;
      if(!groups.has(range))groups.set(range,[]);
      groups.get(range).push(short);
    }
  }
  return [...groups.entries()].map(([range,days])=>[...new Set(days)].join(', ')+' '+range);
}
function extractOfficialRestaurantData(html){
  const objects=parseJsonLdObjects(html);
  const restaurant=objects.find(jsonLdTypeIsRestaurant)||objects.find(x=>{
    return x&&(
      typeof x.openingHours!=='undefined' ||
      typeof x.openingHoursSpecification!=='undefined' ||
      typeof x.telephone!=='undefined'
    );
  });
  if(!restaurant)return {name:'',phone:'',website:'',opening_hours:'',menu:''};
  const hours=[
    ...normalizeOpeningHoursValue(restaurant.openingHours),
    ...formatOpeningHoursSpecification(restaurant.openingHoursSpecification)
  ];
  const menu=typeof restaurant.menu==='string'?restaurant.menu:'';
  return {
    name:String(restaurant.name||'').trim(),
    phone:String(restaurant.telephone||'').trim(),
    website:String(restaurant.url||'').trim(),
    opening_hours:[...new Set(hours)].slice(0,14).join(' · '),
    menu:String(menu||'').trim()
  };
}
async function officialRestaurantDetails(name,address,phone,website){
  const candidate=String(website||'').trim();
  let officialUrl='';
  if(candidate){
    const page=await fetchWebPage(candidate,2800,1200000);
    if(page){
      const verified=verifiedWebsiteCandidate({...page,url:page.finalUrl||page.url},name,address,'',phone);
      if(verified)officialUrl=verified.url;
      if(officialUrl){
        const data=extractOfficialRestaurantData(page.html);
        return {
          ok:true,
          source:'official-website',
          website:officialUrl,
          phone:data.phone,
          opening_hours:data.opening_hours,
          menu:data.menu
        };
      }
    }
  }
  const discovered=await resolveOfficialWebsite({name,address,brand:'',website:candidate,phone});
  officialUrl=String(discovered?.website||'').trim();
  if(!officialUrl)return {ok:false,source:'none'};
  const page=await fetchWebPage(officialUrl,3000,1200000);
  if(!page)return {ok:false,source:'official-website'};
  const verified=verifiedWebsiteCandidate({...page,url:page.finalUrl||page.url},name,address,'',phone);
  if(!verified)return {ok:false,source:'official-website'};
  const data=extractOfficialRestaurantData(page.html);
  return {
    ok:true,
    source:'official-website',
    website:verified.url,
    phone:data.phone,
    opening_hours:data.opening_hours,
    menu:data.menu
  };
}

function websitePageScore(pageUrl,html,name,address,brand='',phone=''){
 const source=normalizeSearchQuery(htmlText(html).slice(0,1400000)+' '+pageUrl);
 const nameTokens=[...new Set(websiteBusinessTokens(name))];
 const brandTokens=[...new Set(websiteBusinessTokens(brand))];
 const allTokens=[...new Set([...nameTokens,...brandTokens])];
 const hits=allTokens.filter(t=>source.includes(t)).length;
 const ratio=allTokens.length?hits/allTokens.length:0;
 const nameHits=nameTokens.filter(t=>source.includes(t)).length;
 const nameRatio=nameTokens.length?nameHits/nameTokens.length:0;
 const brandHits=brandTokens.filter(t=>source.includes(t)).length;
 const brandRatio=brandTokens.length?brandHits/brandTokens.length:0;
 const number=(String(address||'').match(/\b\d{1,6}\b/)||[])[0];
 const addrNorm=normalizeSearchQuery(address);
 const addressTokens=addrNorm.split(' ').filter(x=>x.length>=3&&!/^\d+$/.test(x));
 const locationTokens=addressTokens.slice(-6);
 const locationHits=locationTokens.filter(x=>source.includes(x)).length;
 const cityTokens=addressTokens.slice(-3),cityHits=cityTokens.filter(x=>source.includes(x)).length;
 const host=websiteHost(pageUrl);
 const hostBrandHits=allTokens.filter(t=>host.includes(t)).length;
 const phoneDigits=digitsOnly(phone),sourceDigits=digitsOnly(html);
 const phoneMatch=phoneDigits.length>=7&&sourceDigits.includes(phoneDigits.slice(-Math.min(10,phoneDigits.length)));
 let score=0;
 score+=Math.min(38,nameRatio*38);
 score+=Math.min(20,brandRatio*20);
 if(number&&source.includes(number))score+=22;
 if(cityHits>=2)score+=14;else if(cityHits===1)score+=7;
 if(name&&source.includes(normalizeSearchQuery(name)))score+=18;
 if(hostBrandHits)score+=Math.min(22,hostBrandHits*11);
 if(phoneMatch)score+=28;
 if(/\b(?:about|locations|location|contact|menu|order|visit|hours)\b/.test(source))score+=6;
 return Math.round(score);
}
function verifiedWebsiteCandidate(page,name,address,brand='',phone=''){
 if(!page?.url||!page?.html||isBlockedWebsite(page.url))return null;
 const score=websitePageScore(page.url,page.html,name,address,brand,phone);
 const source=normalizeSearchQuery(htmlText(page.html).slice(0,1400000));
 const nameTokens=[...new Set(websiteBusinessTokens(name))];
 const brandTokens=[...new Set(websiteBusinessTokens(brand))];
 const nameRatio=nameTokens.length?nameTokens.filter(t=>source.includes(t)).length/nameTokens.length:0;
 const brandRatio=brandTokens.length?brandTokens.filter(t=>source.includes(t)).length/brandTokens.length:0;
 const identity=source.includes(normalizeSearchQuery(name))||nameRatio>=0.7||brandRatio>=0.8;
 const number=(String(address||'').match(/\b\d{1,6}\b/)||[])[0];
 const addrParts=normalizeSearchQuery(address).split(' ').filter(x=>x.length>=3&&!/^\d+$/.test(x));
 const locationHits=addrParts.slice(-6).filter(x=>source.includes(x)).length;
 const phoneDigits=digitsOnly(phone),sourceDigits=digitsOnly(page.html);
 const phoneMatch=phoneDigits.length>=7&&sourceDigits.includes(phoneDigits.slice(-Math.min(10,phoneDigits.length)));
 const location=(!number||source.includes(number)||locationHits>=2||phoneMatch);
 return identity&&location&&score>=66?{url:page.url,score}:null;
}
function websiteSearchHitScore(hit,name,address,brand='',phone=''){
 const title=normalizeSearchQuery([hit?.title,hit?.url].filter(Boolean).join(' '));
 const nameTokens=[...new Set(websiteBusinessTokens(name))];
 const brandTokens=[...new Set(websiteBusinessTokens(brand))];
 const allTokens=[...new Set([...nameTokens,...brandTokens])];
 const ratio=allTokens.length?allTokens.filter(t=>title.includes(t)).length/allTokens.length:0;
 const host=websiteHost(hit?.url);
 const hostBrandHits=allTokens.filter(t=>host.includes(t)).length;
 const exactName=name&&title.includes(normalizeSearchQuery(name));
 const addressNorm=normalizeSearchQuery(address);
 const addressParts=addressNorm.split(' ').filter(x=>x.length>=3&&!/^\d+$/.test(x));
 const number=(String(address||'').match(/\b\d{1,6}\b/)||[])[0];
 const cityHits=addressParts.slice(-3).filter(x=>title.includes(x)).length;
 const phoneDigits=digitsOnly(phone),titleDigits=digitsOnly(title);
 let score=ratio*36+(exactName?25:0)+hostBrandHits*20+(number&&title.includes(number)?18:0)+(cityHits?10:0)+(phoneDigits.length>=7&&titleDigits.includes(phoneDigits.slice(-7))?24:0);
 return Math.round(score);
}
function verifiedWebsiteSearchHit(hit,name,address,brand='',phone=''){
 if(!hit?.url||isBlockedWebsite(hit.url)||isDiscoveryHost(hit.url))return null;
 const score=websiteSearchHitScore(hit,name,address,brand,phone);
 const title=normalizeSearchQuery(hit.title||'');
 const allTokens=[...new Set([...websiteBusinessTokens(name),...websiteBusinessTokens(brand)])];
 const ratio=allTokens.length?allTokens.filter(t=>title.includes(t)).length/allTokens.length:0;
 const host=websiteHost(hit.url);
 const hostBrand=allTokens.some(t=>host.includes(t));
 const number=(String(address||'').match(/\b\d{1,6}\b/)||[])[0];
 const addressParts=normalizeSearchQuery(address).split(' ').filter(x=>x.length>=3&&!/^\d+$/.test(x));
 const cityHits=addressParts.slice(-3).filter(x=>title.includes(x)).length;
 const identity=title.includes(normalizeSearchQuery(name||''))||ratio>=0.75;
 const location=!number||title.includes(number)||cityHits>=1;
 return hostBrand&&identity&&location&&score>=70?{url:safeWebsiteUrl(hit.url),score}:null;
}
function officialPageSearchScore(hit,name,address,brand=''){
 if(!hit?.url||!isDiscoveryHost(hit.url))return 0;
 const title=normalizeSearchQuery(hit.title||'');
 const tokens=[...new Set([...websiteBusinessTokens(name),...websiteBusinessTokens(brand)])];
 const ratio=tokens.length?tokens.filter(t=>title.includes(t)).length/tokens.length:0;
 const exact=name&&title.includes(normalizeSearchQuery(name));
 const addr=normalizeSearchQuery(address).split(' ').filter(x=>x.length>=3&&!/^\d+$/.test(x));
 const cityHit=addr.slice(-3).some(x=>title.includes(x));
 return Math.round(ratio*60+(exact?25:0)+(cityHit?15:0));
}
async function discoverOfficialWebsite(name,address,brand='',phone=''){
 const key=normalizeSearchQuery([name,address,brand,phone].filter(Boolean).join('|'));
 if(!key)return {website:'',officialPage:'',source:'none'};
 const cached=officialWebsiteCache.get(key);
 const cacheTtl=cached?.url||cached?.officialPage?OFFICIAL_WEBSITE_CACHE_TTL:OFFICIAL_WEBSITE_NEGATIVE_TTL;
 if(cached&&Date.now()-cached.t<cacheTtl)return {website:cached.url||'',officialPage:cached.officialPage||'',source:cached.source||'cache'};
 if(cached)officialWebsiteCache.delete(key);
 const known=knownRestaurantWebsite({name,brand});
 if(known){
  const result={website:known,officialPage:'',source:'known-brand'};
  officialWebsiteCache.set(key,{t:Date.now(),...result});
  return result;
 }

 // First try cheap, deterministic domain candidates. This avoids depending on
 // any particular search engine's HTML markup and is still protected by full
 // restaurant identity/address/phone verification before acceptance.
 const domainCandidates=directWebsiteDomainCandidates(name,address,brand)
   .map(url=>({url,title:'domain candidate',kind:'website'}));
 const candidateChecks=await Promise.allSettled(domainCandidates.map(async candidate=>{
  const page=await fetchWebPage(candidate.url,2400,900000);
  const verified=page?verifiedWebsiteCandidate({...page,url:page.finalUrl||page.url},name,address,brand,phone):null;
  return verified?{...verified,source:'domain-candidate'}:null;
 }));
 const domainVerified=candidateChecks.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value).sort((a,b)=>b.score-a.score);
 if(domainVerified[0]){
  const result={website:domainVerified[0].url,officialPage:'',source:'domain-candidate'};
  officialWebsiteCache.set(key,{t:Date.now(),...result});
  return result;
 }

 const safeName=String(name||'').replace(/["']/g,'').trim();
 const safeAddress=String(address||'').replace(/["']/g,'').trim();
 const addressParts=normalizeSearchQuery(address).split(' ').filter(Boolean);
 const city=addressParts.slice(-3).join(' ');
 const phoneClean=digitsOnly(phone);
 const queries=[];
 if(safeName&&safeAddress)queries.push('"'+safeName+'" "'+safeAddress+'" official website');
 if(safeName&&city)queries.push('"'+safeName+'" "'+city+'" official website');
 if(safeName)queries.push('"'+safeName+'" restaurant website');
 if(safeName&&phoneClean)queries.push('"'+safeName+'" "'+phoneClean.slice(-10)+'" website');
 if(safeName&&city)queries.push('site:facebook.com "'+safeName+'" "'+city+'"');
 if(safeName&&city)queries.push('site:instagram.com "'+safeName+'" "'+city+'"');
 if(safeName&&safeAddress)queries.push('"'+safeName+'" "'+safeAddress+'" website');

 const searchSources=[
  {base:'https://www.bing.com/search',host:'bing.com'},
  {base:'https://html.duckduckgo.com/html/',host:'duckduckgo.com'},
  {base:'https://www.google.com/search',host:'google.com'}
 ];
 const searchPages=[];
 for(const source of searchSources){
  const settled=await Promise.allSettled(queries.slice(0,4).map(q=>fetchPublicSearchPage(source.base,q)));
  for(const p of settled)if(p.status==='fulfilled'&&p.value)searchPages.push({source,html:p.value});
 }
 const results=[];
 for(const item of searchPages){
  const found=extractGenericSearchResults(item.html,item.source.host);
  for(const hit of found)if(!results.some(x=>x.url===hit.url))results.push(hit);
 }
 const directHits=results.filter(x=>x.kind==='website').sort((a,b)=>websiteSearchHitScore(b,name,address,brand,phone)-websiteSearchHitScore(a,name,address,brand,phone));
 const directChecks=await Promise.allSettled(directHits.slice(0,14).map(async hit=>{
  const page=await fetchWebPage(hit.url,3000,1200000);
  if(page){
   const verified=verifiedWebsiteCandidate({...page,url:page.finalUrl||page.url},name,address,brand,phone);
   if(verified)return {...verified,source:'official-search'};
  }
  const snippet=verifiedWebsiteSearchHit(hit,name,address,brand,phone);
  return snippet?{...snippet,source:'official-search-snippet'}:null;
 }));
 const directVerified=directChecks.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value).sort((a,b)=>b.score-a.score);
 if(directVerified[0]){
  const result={website:directVerified[0].url,officialPage:'',source:directVerified[0].source};
  officialWebsiteCache.set(key,{t:Date.now(),...result});
  return result;
 }
 const discoveryHits=results.filter(x=>x.kind!=='website').sort((a,b)=>officialPageSearchScore(b,name,address,brand)-officialPageSearchScore(a,name,address,brand));
 const discoveryPages=await Promise.allSettled(discoveryHits.slice(0,10).map(async hit=>({hit,page:await fetchDiscoveryPage(hit.url)})));
 const outbound=[],officialPages=[];
 for(const result of discoveryPages){
  if(result.status!=='fulfilled'||!result.value.page)continue;
  const {hit,page}=result.value;
  if(page.finalUrl){
   const verified=verifiedWebsiteCandidate({url:page.finalUrl,html:page.html},name,address,brand,phone);
   if(verified)outbound.push({...verified,source:hit.kind==='facebook'?'facebook-redirect':'discovery-redirect'});
  }
  for(const link of extractExternalWebsiteLinks(page.html,page.url).slice(0,15)){
   outbound.push({...link,source:hit.kind==='facebook'?'facebook-link':hit.kind==='instagram'?'instagram-link':'directory-link'});
  }
  if(hit.kind==='facebook'||hit.kind==='instagram'){
   const pageScore=officialPageSearchScore(hit,name,address,brand);
   if(pageScore>=60)officialPages.push({url:safeDiscoveryUrl(hit.url),score:pageScore,source:'official-page-'+hit.kind});
  }
 }
 const outboundChecks=await Promise.allSettled(outbound.slice(0,22).map(async candidate=>{
  const page=await fetchWebPage(candidate.url,3000,1200000);
  const verified=page?verifiedWebsiteCandidate({...page,url:page.finalUrl||page.url},name,address,brand,phone):null;
  return verified?{...verified,source:candidate.source}:null;
 }));
 const outboundVerified=outboundChecks.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value).sort((a,b)=>b.score-a.score);
 if(outboundVerified[0]){
  const result={website:outboundVerified[0].url,officialPage:'',source:outboundVerified[0].source};
  officialWebsiteCache.set(key,{t:Date.now(),...result});
  return result;
 }
 const bestPage=officialPages.sort((a,b)=>b.score-a.score)[0];
 const result={website:'',officialPage:bestPage?.url||'',source:bestPage?.source||'none'};
 officialWebsiteCache.set(key,{t:Date.now(),...result});
 return result;
}
async function resolveOfficialWebsite(row){
 const direct=safeWebsiteUrl(row?.website);
 if(direct)return {website:direct,officialPage:'',source:'provider'};
 const known=knownRestaurantWebsite(row);
 if(known)return {website:known,officialPage:'',source:'known-brand'};
 return discoverOfficialWebsite(row?.name,row?.address,row?.brand,row?.phone);
}
function knownRestaurantWebsite(row){
 const name=norm(row?.name),brand=norm(row?.brand);
 for(const [key,url] of Object.entries(KNOWN_RESTAURANT_WEBSITES)){
  const k=norm(key); if(name===k||name.includes(k)||brand===k||brand.includes(k))return url;
 }
 return '';
}
function escapeOverpassRegex(value){return String(value||'').replace(/[\\^$.*+?()[\\]{}|]/g,'\\\\$&').replace(/"/g,'\\\"');}
function contactQuery(lat,lon,radius,names){
 const pattern=names.map(escapeOverpassRegex).filter(Boolean).join('|');
 const m=Math.round(Math.min(25,Math.max(1,radius))*1609.344);
 return '[out:json][timeout:5];nwr[amenity~"^(restaurant|fast_food)$"][name~"^('+pattern+')$",i](around:'+m+','+lat+','+lon+');out center tags;';
}
async function contactEnrichment(lat,lon,radius,names){
 if(!names.length)return{rows:[],errors:[]};
 const data=contactQuery(lat,lon,radius,names),rows=[],errors=[];
 const settled=await Promise.allSettled(OVERPASS.map(ep=>json(ep+'?data='+encodeURIComponent(data),{},3200)));
 for(const result of settled){
  if(result.status!=='fulfilled'){errors.push(String(result.reason?.message||result.reason||'request failed'));continue;}
  for(const el of result.value?.elements||[]){const r=osmRow(el,{lat,lon});if(r&&r.distance<=radius)rows.push(r);}
 }
 return{rows:dedupe(rows),errors};
}
async function googleSearchPlaces(lat,lon,radius,searchTerm){
 if(!GOOGLE_KEY)return{rows:[],errors:[]};
 const term=normalizeSearchQuery(searchTerm),meters=Math.round(Math.min(50000,Math.max(1609,radius*1609.344))),rows=[],errors=[];
 if(!term)return googlePlaces(lat,lon,radius);
 const terms=providerSearchTerms(term);
 const requests=await Promise.allSettled(terms.map(termVariant=>googleBudgetedJson('text-search-enterprise','https://places.googleapis.com/v1/places:searchText',{
   method:'POST',
   headers:{
     'Content-Type':'application/json',
     'X-Goog-Api-Key':GOOGLE_KEY,
     'X-Goog-FieldMask':'places.id,places.displayName,places.location,places.formattedAddress,places.primaryType,places.types,places.currentOpeningHours.openNow,places.regularOpeningHours.weekdayDescriptions,places.businessStatus'
   },
   body:JSON.stringify({
     textQuery:termVariant+' restaurant',
     pageSize:20,
     locationBias:{circle:{center:{latitude:lat,longitude:lon},radius:meters}},
     regionCode:'US'
   })
 },6500)));
 for(const result of requests){
   if(result.status!=='fulfilled'){errors.push(String(result.reason?.message||result.reason||'Google text search failed'));continue}
   const data=result.value;
   for(const p of data?.places||[]){
    const loc=p?.location||{},plat=n(loc.latitude),plon=n(loc.longitude),name=String(p?.displayName?.text||'').trim();
    if(!name||!Number.isFinite(plat)||!Number.isFinite(plon))continue;
    const types=Array.isArray(p?.types)?p.types.map(String):[];
    const fast=types.includes('fast_food_restaurant')||types.includes('fast_food')||isFastFoodName(name);
    const openNow=typeof p?.currentOpeningHours?.openNow==='boolean'?p.currentOpeningHours.openNow:undefined;
     const regularHours=Array.isArray(p?.regularOpeningHours?.weekdayDescriptions)?p.regularOpeningHours.weekdayDescriptions.map(String).filter(Boolean).join(' · '):'';
    const businessStatus=String(p?.businessStatus||'');
    if(businessStatus==='CLOSED_PERMANENTLY')continue;
    const distance=miles(lat,lon,plat,plon);
    if(distance>radius)continue;
    rows.push({id:p.id?'google-search-'+p.id:'google-search-'+norm(name)+'-'+plat.toFixed(5)+'-'+plon.toFixed(5),name,category:fast?'Fast Food':'Restaurant',fastFood:fast,cuisine:'',address:String(p?.formattedAddress||''),phone:String(p?.nationalPhoneNumber||''),website:String(p?.websiteUri||''),opening_hours:regularHours,openNow,hoursSource:typeof openNow==='boolean'?'Google Places':(regularHours?'Google Places':''),lat:plat,lon:plon,distance,photo:'',menuItems:[],brand:'',source:'Google Places Search',googlePlaceId:p.id||''});
   }
 }
 return{rows:dedupe(rows),errors};
}

async function googlePlaces(lat,lon,radius){
 if(!GOOGLE_KEY)return{rows:[],errors:[]};
 const meters=Math.round(Math.min(50000,Math.max(1609,radius*1609.344))),rows=[],errors=[];
 try{
  const data=await googleBudgetedJson('nearby-search-enterprise','https://places.googleapis.com/v1/places:searchNearby',{
   method:'POST',
   headers:{
    'Content-Type':'application/json',
    'X-Goog-Api-Key':GOOGLE_KEY,
    'X-Goog-FieldMask':'places.id,places.displayName,places.location,places.formattedAddress,places.primaryType,places.types,places.currentOpeningHours.openNow,places.regularOpeningHours.weekdayDescriptions,places.businessStatus'
   },
   body:JSON.stringify({includedTypes:['restaurant','fast_food_restaurant'],maxResultCount:20,locationRestriction:{circle:{center:{latitude:lat,longitude:lon},radius:meters}}})
  },6500);
  for(const p of data?.places||[]){
   const loc=p?.location||{},plat=n(loc.latitude),plon=n(loc.longitude),name=String(p?.displayName?.text||'').trim();
   if(!name||!Number.isFinite(plat)||!Number.isFinite(plon))continue;
   const types=Array.isArray(p?.types)?p.types.map(String):[];
   const fast=types.includes('fast_food_restaurant')||types.includes('fast_food')||isFastFoodName(name);
   const openNow=typeof p?.currentOpeningHours?.openNow==='boolean'?p.currentOpeningHours.openNow:undefined;
   const regularHours=Array.isArray(p?.regularOpeningHours?.weekdayDescriptions)?p.regularOpeningHours.weekdayDescriptions.map(String).filter(Boolean).join(' · '):'';
   const businessStatus=String(p?.businessStatus||'');
   if(businessStatus==='CLOSED_PERMANENTLY')continue;
   rows.push({id:p.id?'google-'+p.id:'google-'+norm(name)+'-'+plat.toFixed(5)+'-'+plon.toFixed(5),name,category:fast?'Fast Food':'Restaurant',fastFood:fast,cuisine:'',primaryType:String(p.primaryType||''),types,providerType:types.join(' '),address:String(p?.formattedAddress||''),phone:String(p?.nationalPhoneNumber||''),website:String(p?.websiteUri||''),opening_hours:regularHours,openNow,hoursSource:typeof openNow==='boolean'?'Google Places':(regularHours?'Google Places':''),lat:plat,lon:plon,distance:miles(lat,lon,plat,plon),photo:'',menuItems:[],brand:'',source:'Google Places',googlePlaceId:p.id||''});
  }
 }catch(e){errors.push(String(e?.message||e||'Google Places failed'));}
 return{rows,errors};
}
async function googleContactEnrichment(rows,originLat,originLon){
 if(!GOOGLE_KEY)return{rows:[],errors:[]};
 const targets=(rows||[]).filter(r=>!r.phone||!r.website||!r.opening_hours).slice(0,12);
 if(!targets.length)return{rows:[],errors:[]};
 const errors=[],out=[];
 let cursor=0;
 async function one(r){
  const q=[r.name,r.address].filter(Boolean).join(', ');
  try{
   const data=await googleBudgetedJson('text-search-enterprise','https://places.googleapis.com/v1/places:searchText',{
    method:'POST',
    headers:{
     'Content-Type':'application/json',
     'X-Goog-Api-Key':GOOGLE_KEY,
     'X-Goog-FieldMask':'places.id,places.displayName,places.location,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.primaryType,places.types,places.currentOpeningHours.openNow,places.regularOpeningHours.weekdayDescriptions,places.businessStatus'
    },
    body:JSON.stringify({
     textQuery:q+' restaurant',
     pageSize:3,
     locationBias:{circle:{center:{latitude:originLat,longitude:originLon},radius:Math.min(25000,Math.max(3000,Number(r.distance||0)*1609+5000))}},
     regionCode:'US'
    })
   },5200);
   const candidates=Array.isArray(data?.places)?data.places:[];
   const baseLat=Number(r.lat),baseLon=Number(r.lon);
   const best=candidates.map(p=>{
    const loc=p?.location||{},lat=n(loc.latitude),lon=n(loc.longitude),name=String(p?.displayName?.text||'').trim();
    if(!name||!Number.isFinite(lat)||!Number.isFinite(lon))return null;
    const types=Array.isArray(p?.types)?p.types.map(String):[];
    const openNow=typeof p?.currentOpeningHours?.openNow==='boolean'?p.currentOpeningHours.openNow:undefined;
    const regularHours=Array.isArray(p?.regularOpeningHours?.weekdayDescriptions)?p.regularOpeningHours.weekdayDescriptions.map(String).filter(Boolean).join(' · '):'';
    const businessStatus=String(p?.businessStatus||'');
    if(businessStatus==='CLOSED_PERMANENTLY')return null;
    const distance=Number.isFinite(baseLat)&&Number.isFinite(baseLon)?miles(baseLat,baseLon,lat,lon):miles(originLat,originLon,lat,lon);
    const target=norm(r.name),candidate=norm(name);
    const nameMatch=target===candidate||candidate.includes(target)||target.includes(candidate);
    return !nameMatch||distance>1.5?null:{id:p.id?'google-contact-'+p.id:'google-contact-'+norm(name),name,address:String(p?.formattedAddress||r.address||''),phone:String(p?.nationalPhoneNumber||''),website:String(p?.websiteUri||r.website||''),openNow,hoursSource:regularHours?'Google Places':(typeof openNow==='boolean'?'Google Places':''),lat,lon,distance:miles(originLat,originLon,lat,lon),category:types.includes('fast_food_restaurant')||types.includes('fast_food')?'Fast Food':(r.category||'Restaurant'),primaryType:String(p.primaryType||''),types,providerType:types.join(' '),fastFood:types.includes('fast_food_restaurant')||types.includes('fast_food')||!!r.fastFood,cuisine:r.cuisine||'',opening_hours:regularHours||r.opening_hours||'',photo:'',menuItems:r.menuItems||[],brand:r.brand||'',source:'Google Places Search',googlePlaceId:p.id||''};
   }).filter(Boolean).sort((a,b)=>Number(a.distance)-Number(b.distance))[0];
   if(best)out.push({...best,_targetId:r.id});
  }catch(e){errors.push(String(e?.message||e||'Google contact lookup failed'));}
 }
 const workers=Array.from({length:Math.min(3,targets.length)},async()=>{
  while(cursor<targets.length){const i=cursor++;await one(targets[i]);}
 });
 await Promise.all(workers);
 return{rows:dedupe(out),errors};
}
async function googlePlaceDetails(placeId){
  const id=String(placeId||'').trim();
  if(!GOOGLE_KEY||!/^ChI[A-Za-z0-9_-]+$/.test(id))return{ok:false,reason:'missing-place-id'};
  const reservation=await reserveGoogleSku('place-details-enterprise',HARD_LIMITS['place-details-enterprise']);
  if(!reservation.ok)return{ok:false,reason:'monthly-budget',budget:reservation};
  try{
    const data=await json('https://places.googleapis.com/v1/places/'+encodeURIComponent(id),{
      method:'GET',
      headers:{
        'X-Goog-Api-Key':GOOGLE_KEY,
        'X-Goog-FieldMask':'id,displayName,formattedAddress,location,nationalPhoneNumber,websiteUri,regularOpeningHours.weekdayDescriptions,currentOpeningHours.openNow,currentOpeningHours.weekdayDescriptions,businessStatus,primaryType,types'
      }
    },5200);
    const regularHours=Array.isArray(data?.regularOpeningHours?.weekdayDescriptions)
      ?data.regularOpeningHours.weekdayDescriptions.map(String).filter(Boolean).join(' · '):'';
    const currentHours=Array.isArray(data?.currentOpeningHours?.weekdayDescriptions)
      ?data.currentOpeningHours.weekdayDescriptions.map(String).filter(Boolean).join(' · '):'';
    return{
      ok:true,
      source:'Google Places',
      googlePlaceId:String(data?.id||id),
      name:String(data?.displayName?.text||'').trim(),
      address:String(data?.formattedAddress||'').trim(),
      phone:String(data?.nationalPhoneNumber||'').trim(),
      website:String(data?.websiteUri||'').trim(),
      opening_hours:regularHours,
      currentOpeningHours:currentHours,
      openNow:typeof data?.currentOpeningHours?.openNow==='boolean'?data.currentOpeningHours.openNow:null,
      businessStatus:String(data?.businessStatus||''),
      primaryType:String(data?.primaryType||''),
      types:Array.isArray(data?.types)?data.types.map(String):[]
    };
  }catch(e){
    if(Number(e?.status)===403||Number(e?.status)===429)await disableGoogleSkuForMonth('place-details-enterprise');
    return{ok:false,reason:'google-error',error:String(e?.message||e||'Google Place Details failed')};
  }
}
function applyGoogleContactPatches(rows,patches){
 const byId=new Map((rows||[]).map(row=>[String(row?.id||''),row]));
 for(const patch of (patches||[])){
  const target=byId.get(String(patch?._targetId||''));
  if(!target)continue;
  for(const key of ['address','phone','website','opening_hours','hoursSource','openNow','googlePlaceId']){
   if(key==='openNow'){
    if(typeof patch.openNow==='boolean')target.openNow=patch.openNow;
   }else if(!target[key]&&patch[key])target[key]=patch[key];
  }
  if(patch.googlePlaceId)target.googlePlaceId=patch.googlePlaceId;
  target.contactEnriched=true;
 }
 return rows;
}
function providerPriority(r){const s=String(r?.source||'');return s.startsWith('OpenStreetMap')?0:s.startsWith('Photon')?1:2}
const RESTAURANT_NAME_VARIANT_BLOCKERS=new Set(['express','market','grill','kitchen','cafe','coffee','bar','deli','bakery','house','shop','and','at','inside','food','foods','eatery','restaurant','restaurants']);
function restaurantNameTokens(value){
  let text=norm(String(value||'').replace(/[’']s\b/gi,' '));
  text=text.replace(/\bbar\s+b\s+q\b/g,'bbq');
  text=text.replace(/\bbarbecue\b/g,'bbq');
  text=text.replace(/\bb\s+q\b/g,'bbq');
  return text.split(' ').filter(Boolean);
}
function nameVariantMatch(a,b){
  const aa=restaurantNameTokens(a),bb=restaurantNameTokens(b);
  if(!aa.length||!bb.length)return false;
  const as=new Set(aa),bs=new Set(bb);
  const shared=aa.filter(t=>bs.has(t)).length;
  const shorter=Math.min(as.size,bs.size),union=new Set([...aa,...bb]).size;
  if(as.size===bs.size&&shared===as.size)return true;
  if(shared!==shorter || shared/union<0.6)return false;
  const longer=aa.length>=bb.length?aa:bb;
  const shorterSet=aa.length>=bb.length?bs:as;
  const extras=longer.filter(token=>!shorterSet.has(token));
  return !extras.some(token=>RESTAURANT_NAME_VARIANT_BLOCKERS.has(token));
}
function normAddress(s){
  const map={
   street:'st',st:'st',road:'rd',rd:'rd',avenue:'ave',ave:'ave',boulevard:'blvd',blvd:'blvd',
   drive:'dr',dr:'dr',lane:'ln',ln:'ln',parkway:'pkwy',pkwy:'pkwy',highway:'hwy',hwy:'hwy',
   route:'rte',rte:'rte',circle:'cir',cir:'cir',court:'ct',ct:'ct',place:'pl',pl:'pl',
   trail:'trl',trl:'trl',terrace:'ter',ter:'ter',way:'way',
   north:'n',n:'n',south:'s',s:'s',east:'e',e:'e',west:'w',w:'w',
   alabama:'al',alaska:'ak',arizona:'az',arkansas:'ar',california:'ca',colorado:'co',
   connecticut:'ct',delaware:'de',florida:'fl',georgia:'ga',hawaii:'hi',idaho:'id',
   illinois:'il',indiana:'in',iowa:'ia',kansas:'ks',kentucky:'ky',louisiana:'la',
   maine:'me',maryland:'md',massachusetts:'ma',michigan:'mi',minnesota:'mn',
   mississippi:'ms',missouri:'mo',montana:'mt',nebraska:'ne',nevada:'nv',
   'new-hampshire':'nh',newhampshire:'nh','new-jersey':'nj',newjersey:'nj',
   'new-mexico':'nm',newmexico:'nm','new-york':'ny',newyork:'ny',
   northcarolina:'nc','north-dakota':'nd',northdakota:'nd',ohio:'oh',oklahoma:'ok',
   oregon:'or',pennsylvania:'pa',rhodeisland:'ri','rhode-island':'ri',
   southcarolina:'sc','south-dakota':'sd',southdakota:'sd',tennessee:'tn',tn:'tn',
   texas:'tx',utah:'ut',vermont:'vt',virginia:'va',washington:'wa',
   westvirginia:'wv','west-virginia':'wv',wisconsin:'wi',wyoming:'wy',
   'district-of-columbia':'dc',districtcolumbia:'dc',dc:'dc'
  };
  const tokens=norm(String(s||'')).split(' ').filter(Boolean).map(x=>map[x]||x);
  return tokens.join(' ').replace(/\b(?:usa|united\s+states)\b/g,'').replace(/\s+/g,' ').trim();
}
function phoneKey(value){return norm(String(value||'').replace(/[^0-9]/g,''));}
function websiteKey(value){
  try{
    const u=new URL(String(value||''));
    return (u.hostname||'').toLowerCase().replace(/^www\./,'')+u.pathname.replace(/\/$/,'').toLowerCase();
  }catch{return norm(value||'')}
}
function sameContact(x,r){
  const xp=phoneKey(x?.phone),rp=phoneKey(r?.phone);
  if(xp&&rp&&xp.length>=10&&rp.length>=10&&xp.slice(-10)===rp.slice(-10))return true;
  const xw=websiteKey(x?.website),rw=websiteKey(r?.website);
  if(xw&&rw&&xw===rw)return true;
  return false;
}
function restaurantNameKey(value){return norm(String(value||'').replace(/[’']s\b/gi,'s'));}
function restaurantStreetKey(value){
  const raw=normAddress(value||'');
  if(!raw)return '';
  const tokens=raw.split(' ').filter(Boolean);
  const start=(tokens[0]||'').match(/^\d+[a-z]?$/i)?1:0;
  const suffixes=new Set(['st','rd','ave','blvd','dr','ln','pkwy','hwy','rte','cir','ct','pl','trl','ter','way']);
  const street=[];
  for(let i=start;i<tokens.length&&street.length<6;i++){
    street.push(tokens[i]);
    if(suffixes.has(tokens[i]))break;
  }
  return street.join(' ').trim();
}
function restaurantAddressKey(value){
  const raw=normAddress(value||'');
  if(!raw)return '';
  const tokens=raw.split(' ').filter(Boolean);
  const number=tokens[0]||'';
  const street=restaurantStreetKey(value);
  return /^\d+[a-z]?$/i.test(number)&&street ? number+'|'+street : street;
}
function restaurantNameSimilarity(a,b){
  const aa=restaurantNameTokens(a),bb=restaurantNameTokens(b);
  if(!aa.length||!bb.length)return 0;
  const as=new Set(aa),bs=new Set(bb);
  const shared=[...as].filter(t=>bs.has(t)).length;
  const shorter=Math.min(as.size,bs.size);
  const union=new Set([...as,...bs]).size;
  if(!shared||!shorter||!union)return 0;
  const coverage=shared/shorter;
  const jaccard=shared/union;
  // Short-name coverage matters more than raw character similarity:
  // "Excell BBQ" vs "Excell Market Bar-B-Q", and
  // "Strippers Chicken" vs "Chicken Strippers".
  if(coverage>=0.75&&jaccard>=0.60)return Math.max(coverage,jaccard);
  return 0;
}
function restaurantAddressSimilarity(a,b){
  const ax=normAddress(a||''),ar=normAddress(b||'');
  if(!ax||!ar)return 0;
  if(ax===ar)return 1;
  const kx=restaurantAddressKey(a),kr=restaurantAddressKey(b);
  if(kx&&kr&&kx===kr)return 0.90;
  const sx=restaurantStreetKey(a),sr=restaurantStreetKey(b);
  if(sx&&sr&&sx===sr)return 0.72;
  const xt=ax.split(' '),rt=ar.split(' '),shared=xt.filter(t=>rt.includes(t)).length;
  const coverage=shared/Math.min(xt.length,rt.length);
  return coverage>=0.80?0.80:0;
}
function addressHasStreetNumber(value){return /^\s*\d+[a-z]?\b/i.test(String(value||''));}
function sameRestaurant(x,r){
  if(!x||!r)return false;

  const sameName=restaurantNameKey(x.name)===restaurantNameKey(r.name);
  const nameScore=restaurantNameSimilarity(x.name,r.name);
  const nameVariant=nameVariantMatch(x.name,r.name);
  const sameNameFamily=sameName||nameVariant;

  const sameBrand=!!norm(x.brand)&&!!norm(r.brand)&&norm(x.brand)===norm(r.brand);
  const xTags=RESTAURANT_TAXONOMY.classifyRestaurant(x).tags||[];
  const rTags=RESTAURANT_TAXONOMY.classifyRestaurant(r).tags||[];
  const sharedCategory=xTags.some(tag=>rTags.includes(tag));
  const xNameTokens=new Set(restaurantNameTokens(x.name)),rNameTokens=new Set(restaurantNameTokens(r.name));
  const sharedDistinctiveName=xNameTokens.size&&rNameTokens.size
    ? [...xNameTokens].some(token=>token.length>=4&&!RESTAURANT_NAME_VARIANT_BLOCKERS.has(token)&&rNameTokens.has(token))
    : false;
  const identityKey=RESTAURANT_TAXONOMY.restaurantIdentityKey(x);
  const rowIdentityKey=RESTAURANT_TAXONOMY.restaurantIdentityKey(r);
  const dist=Number.isFinite(x.lat)&&Number.isFinite(x.lon)&&Number.isFinite(r.lat)&&Number.isFinite(r.lon)
    ? miles(x.lat,x.lon,r.lat,r.lon) : Infinity;

  const ax=normAddress(x.address||''), ar=normAddress(r.address||'');
  const conflictingAddress=!!ax&&!!ar&&ax!==ar;
  const addressScore=restaurantAddressSimilarity(x.address,r.address);
  const sameAddress=addressScore>=0.90;
  const sameStreet=addressScore>=0.72;
  const partialAddress=!addressHasStreetNumber(x.address)||!addressHasStreetNumber(r.address);
  const originDistanceClose=Number.isFinite(Number(x.distance))&&Number.isFinite(Number(r.distance))
    &&Math.abs(Number(x.distance)-Number(r.distance))<=0.05;
  const sameCanonicalIdentity=!!identityKey&&identityKey===rowIdentityKey&&(
    sameAddress||(sameStreet&&originDistanceClose&&partialAddress)
  );

  // Primary identity rule: same/similar physical address + similar name.
  if(sameAddress&&sameNameFamily)return true;
  // CP1078: merge provider naming variants such as "Excell Market & BBQ"
  // and "Excell Bar-B-Q" when they resolve to the same place and share
  // a distinctive name token plus the same cuisine identity.
  if(sameAddress&&sharedDistinctiveName&&sharedCategory)return true;
  if(addressScore>=0.90&&sameNameFamily)return true;
  if(sameStreet&&sameNameFamily&&originDistanceClose&&partialAddress)return true;
  // CP972: Photon can return a venue with reordered address fields or without
  // a housenumber. Merge very-close same-name provider rows so richer
  // address/contact data is retained for exact photo resolution.
  if(sameNameFamily&&dist<=0.08&&partialAddress)return true;

  // Strong provider-independent identity signals.
  if(sameCanonicalIdentity)return true;
  if(sameContact(x,r)&&!conflictingAddress&&dist<=0.20)return true;
  if(sameNameFamily&&!conflictingAddress&&dist<=0.10)return true;

  // Known brand/profile safeguards.
  if(sameBrand&&sameAddress)return true;
  if(sameName&&sameBrand&&!conflictingAddress&&dist<=0.20)return true;
  if(nameScore>=0.60&&sameBrand&&!conflictingAddress&&dist<=0.20)return true;
  return false;
}
function dedupe(rows){
  const ordered=[...(rows||[])].filter(Boolean).sort((a,b)=>providerPriority(a)-providerPriority(b));
  const map=new Map(),index=new Map();
  const normId=v=>String(v||'').trim();
  const cellKey=(lat,lon)=>Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))
    ?Math.floor(Number(lat)*100)+'|'+Math.floor(Number(lon)*100):'';
  function candidateKeys(row){
    const out=[];
    const id=normId(row?.id);
    if(id)out.push('id:'+id);
    const name=restaurantNameKey(row?.name);
    if(name)out.push('name:'+name);
    const addr=restaurantAddressKey(row?.address||'');
    if(addr)out.push('addr:'+addr);
    const phone=phoneKey(row?.phone);
    if(phone)out.push('phone:'+phone);
    const website=websiteKey(row?.website);
    if(website)out.push('web:'+website);
    const cell=cellKey(row?.lat,row?.lon);
    if(cell){
      const [la,lo]=cell.split('|').map(Number);
      for(let dlat=-1;dlat<=1;dlat++)for(let dlon=-1;dlon<=1;dlon++)out.push('cell:'+(la+dlat)+'|'+(lo+dlon));
    }
    return [...new Set(out)];
  }
  function mergeInto(target,r){
    target.fastFood=target.fastFood||r.fastFood;
    if(typeof r.openNow==='boolean' && (typeof target.openNow!=='boolean' || String(r.source||'').startsWith('Google')))target.openNow=r.openNow;
    for(const f of ['address','phone','website','opening_hours','photo','cuisine','brand','operator'])if(!target[f]&&r[f])target[f]=r[f];
    if(!target.googlePlaceId&&r.googlePlaceId)target.googlePlaceId=r.googlePlaceId;
    target.menuItems=[...new Set([...(target.menuItems||[]),...(r.menuItems||[])])].slice(0,10);
    if(!target.hoursSource&&r.hoursSource)target.hoursSource=r.hoursSource;
  }
  for(const r of ordered){
    const candidates=new Set();
    for(const ck of candidateKeys(r))for(const key of (index.get(ck)||[]))candidates.add(key);
    let key=null;
    for(const candidate of candidates){
      const x=map.get(candidate);
      if(x&&sameRestaurant(x,r)){key=candidate;break}
    }
    if(!key){
      const nameKey=norm(r.name),addr=normAddress(r.address||''),phone=phoneKey(r.phone),website=websiteKey(r.website);
      key=(nameKey+'|'+(addr||phone||website||('geo-'+Math.round(r.lat*1000)+'|'+Math.round(r.lon*1000)))).slice(0,220);
      let suffix=1;
      while(map.has(key)) key=key+'|'+(++suffix);
      map.set(key,{...r});
    }else{
      mergeInto(map.get(key),r);
    }
    const storedKeys=candidateKeys(map.get(key));
    for(const ck of storedKeys){
      let bucket=index.get(ck);
      if(!bucket){bucket=[];index.set(ck,bucket);}
      if(!bucket.includes(key))bucket.push(key);
    }
  }
  return[...map.values()].sort((a,b)=>a.distance-b.distance);
}
function restaurantSearchMatches(row,searchTerm){
 const q=normalizeSearchQuery(searchTerm);
 if(!q)return true;
 const classification=RESTAURANT_TAXONOMY.restaurantSearchClassification(q);
 const tags=RESTAURANT_TAXONOMY.classifyRestaurant(row).tags||[];
 if(classification.kind==='category'&&classification.tag){
   return classification.tag==='Burgers'
     ? tags.includes('Burgers')||tags.includes('Fast Food')
     : tags.includes(classification.tag);
 }
 const filler=new Set(RESTAURANT_TAXONOMY.fillerWords||['restaurant','restaurants','place','places','food','foodie','near','me']);
 const hay=normalizeSearchQuery([
   row?.name,row?.brand,row?.operator,row?.category,row?.cuisine,row?.primaryType,row?.providerType,
   Array.isArray(row?.types)?row.types.join(' '):row?.types,
   ...(Array.isArray(row?.menuItems)?row.menuItems:[])
 ].filter(Boolean).join(' '));
 const words=q.split(' ').filter(word=>word&&!filler.has(word));
 return !words.length || words.every(word=>hay.includes(word));
}
function restaurantHasAnyHoursData(row){
 return typeof row?.openNow==='boolean'||!!String(row?.opening_hours||'').trim();
}
function restaurantPhotoMeta(r){
  const raw=String(r?.photo||'').trim();
  const source=String(r?.source||'');
  const osmBacked=source.startsWith('OpenStreetMap')||source.startsWith('Photon POI');
  if(/^https:\/\//i.test(raw)){
    return {
      photo:raw,
      photoFallback:'',
      photoSource:osmBacked?'osm-poi':'provider',
      photoIsGeneric:false,
      photoConfidence:osmBacked?0.95:0.6
    };
  }
  return {
    photo:'',
    photoFallback:'',
    photoSource:'none',
    photoIsGeneric:false,
    photoConfidence:0
  };
}
function image(r){return restaurantPhotoMeta(r).photo;}
function geocodeCandidateScore(query,display,baseScore=0,kind=''){
 const qNorm=normalizeSearchQuery(query),dNorm=normalizeSearchQuery(display),kindNorm=normalizeSearchQuery(kind);
 const qTokens=qNorm.split(' ').filter(Boolean),dTokens=new Set(dNorm.split(' ').filter(Boolean));
 let score=Number(baseScore)||0;
 for(const token of qTokens){
   if(dTokens.has(token))score+=18;
   else if(token.length>=4&&dNorm.includes(token))score+=8;
   else score-=4;
 }
 const numberMatch=qNorm.match(/^([0-9]+[a-z]?)(?:\s|$)/i);
 if(numberMatch){
   const nTok=numberMatch[1].toLowerCase();
   if(new RegExp('^'+nTok+'\\b').test(dNorm))score+=100;
   else if(/^[0-9]+/.test(dNorm))score-=140;
 }
 const zip=(qNorm.match(/\b\d{5}\b/)||[])[0];
 if(zip)score += dNorm.includes(zip)?70:-35;
 if(qNorm.includes('clarksville'))score += dNorm.includes('clarksville')?35:-60;
 if(qNorm.includes('tn'))score += /\btn\b|tennessee/.test(dNorm)?20:-25;
 if(qNorm.includes('iron workers'))score += dNorm.includes('iron workers')?70:-100;

 // For area searches, prefer a true locality over a business/POI that
 // happens to contain the same city/state words.
 const areaQuery=!numberMatch && (/\b(?:tn|ky|ga|al|il|mo|tennessee|kentucky|georgia|alabama|missouri)\b/i.test(qNorm)||qNorm.includes(','));
 const localityKind=/\b(?:locality|city|town|village|municipality|county seat|place)\b/i.test(kindNorm);
 const poiKind=/\b(?:poi|business|shop|restaurant|school|hospital|police|office|building)\b/i.test(kindNorm);
 if(areaQuery){
   if(localityKind)score+=180;
   if(poiKind)score-=70;
   if(/\b(?:police|school|hospital|clinic|bank|team|urgent|office)\b/i.test(dNorm))score-=55;
 }
 return score;
}
async function geocode(q){
 const clean=String(q||'').trim().slice(0,180);
 if(!clean)throw Object.assign(new Error('Enter a location.'),{code:'EMPTY_LOCATION'});
 const rows=[];
 const [arc,pho]=await Promise.allSettled([
  json('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?'+new URLSearchParams({SingleLine:clean,f:'json',maxLocations:'8',outFields:'*',forStorage:'false',countryCode:'USA'}),{},8000),
  json('https://photon.komoot.io/api/?'+new URLSearchParams({q:clean,limit:'8',lang:'en',countrycode:'US'}),{},8000)
 ]);
 if(arc.status==='fulfilled'){
  for(const c of arc.value?.candidates||[]){
   const lat=n(c?.location?.y),lon=n(c?.location?.x),display=String(c.address||c.attributes?.Match_addr||clean);
   if(validCoords(lat,lon)){const kind=String(c.attributes?.Addr_type||c.attributes?.Type||'');rows.push({lat,lon,display,source:'ArcGIS',kind,score:geocodeCandidateScore(clean,display,n(c.score,0),kind)});}
  }
 }
 if(pho.status==='fulfilled'){
  for(const f of pho.value?.features||[]){
   const c=f?.geometry?.coordinates||[],lon=n(c[0]),lat=n(c[1]);
   if(!validCoords(lat,lon))continue;
   const display=[f?.properties?.name,f?.properties?.housenumber,f?.properties?.street,f?.properties?.city||f?.properties?.town,f?.properties?.state,f?.properties?.postcode].filter(Boolean).join(', ')||clean;
   const kind=String(f?.properties?.type||f?.properties?.osm_value||f?.properties?.osm_key||'');rows.push({lat,lon,display,source:'Photon',kind,score:geocodeCandidateScore(clean,display,100,kind)});
  }
 }
 if(!rows.length)throw Object.assign(new Error('That address or area could not be located.'),{code:'NOT_FOUND'});
 const exactNumber=normalizeSearchQuery(clean).match(/^([0-9]+[a-z]?)(?:\\s|$)/i);
 const ranked=rows
  .sort((a,b)=>b.score-a.score)
  .filter((row,i,all)=>all.findIndex(x=>normalizeSearchQuery(x.display)===normalizeSearchQuery(row.display))===i);
 if(exactNumber){
   const matching=ranked.filter(row=>new RegExp('^'+exactNumber[1].toLowerCase()+'\\b').test(normalizeSearchQuery(row.display)));
   if(matching.length)return matching[0];
   throw Object.assign(new Error('That street address could not be matched exactly. Please choose the matching address from the suggestions.'),{code:'ADDRESS_MISMATCH'});
 }
 return ranked[0];
}
async function suggest(q){
 const clean=String(q||'').trim().slice(0,180);if(clean.length<2)return[];
 const rows=[];
 const [arc,pho]=await Promise.allSettled([
  json('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?'+new URLSearchParams({SingleLine:clean,f:'json',maxLocations:'7',outFields:'*',forStorage:'false',countryCode:'USA'}),{},6000),
  json('https://photon.komoot.io/api/?'+new URLSearchParams({q:clean,limit:'7',lang:'en',countrycode:'US'}),{},6000)
 ]);
 if(arc.status==='fulfilled')for(const c of arc.value?.candidates||[]){const lat=n(c?.location?.y),lon=n(c?.location?.x);if(validCoords(lat,lon))rows.push({lat,lon,display:String(c.address||c.attributes?.Match_addr||clean),source:'ArcGIS'})}
 if(pho.status==='fulfilled')for(const f of pho.value?.features||[]){const c=f?.geometry?.coordinates||[],lon=n(c[0]),lat=n(c[1]);if(validCoords(lat,lon))rows.push({lat,lon,display:[f?.properties?.name,f?.properties?.city||f?.properties?.town,f?.properties?.state,f?.properties?.postcode].filter(Boolean).join(', ')||clean,source:'Photon'})}
 rows.sort((a,b)=>Number(b.score||0)-Number(a.score||0));
 const seen=new Set();return rows.filter(x=>{const k=norm(x.display);if(seen.has(k))return false;seen.add(k);return true}).slice(0,7)
}
async function reverse(lat,lon){try{const d=await json('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?'+new URLSearchParams({location:lon+','+lat,f:'json'}),{},7000);return String(d?.address?.Match_addr||'Current location')}catch{return'Current location'}}
function requestQuery(req){
 const source=req?.query&&typeof req.query==='object'?req.query:(req?.queryStringParameters&&typeof req.queryStringParameters==='object'?req.queryStringParameters:null);
 if(source){
  const out=new URLSearchParams();
  for(const [key,value] of Object.entries(source)){
   if(value==null)continue;
   const val=Array.isArray(value)?value[0]:value;
   if(val!=null)out.set(key,String(val));
  }
  return out;
 }
 try{return new URL(String(req?.url||'/'),'https://dinliminate.local').searchParams}catch{return new URLSearchParams()}
}
async function handler(req,res){const q=requestQuery(req),mode=String(q.get('mode')||'health').toLowerCase();if(mode!=='search'&&rate(req,mode))return res.status(429).json({ok:false,code:'RATE_LIMITED',message:'Too many requests. Try again shortly.'});try{
if(mode==='health'){if(res.setHeader)res.setHeader('Cache-Control','public, max-age=60, s-maxage=60, stale-while-revalidate=120');return res.status(200).json({ok:true,version:API_VERSION,maxRadiusMiles:MAX_RADIUS,googlePlacesConfigured:!!GOOGLE_KEY,googleUsage:await googleUsageHealth(),providers:['OpenStreetMap Overpass','ArcGIS','Photon',...(GOOGLE_KEY?['Google Places']:[]),'Open-Meteo timezone']});}
if(mode==='suggest'){if(res.setHeader)res.setHeader('Cache-Control','public, max-age=30, s-maxage=30, stale-while-revalidate=60');return res.status(200).json({ok:true,results:await suggest(q.get('q'))});}
if(mode==='resolve'){const x=await geocode(q.get('q'));return res.status(200).json({ok:true,...x})}
if(mode==='reverse'){const lat=n(q.get('lat')),lon=n(q.get('lon'));if(!validCoords(lat,lon))return res.status(400).json({ok:false,message:'Coordinates are invalid.'});if(res.setHeader)res.setHeader('Cache-Control','public, max-age=300, s-maxage=300, stale-while-revalidate=600');return res.status(200).json({ok:true,display:await reverse(lat,lon)})}
if(mode==='details'){
  const placeId=String(q.get('placeId')||q.get('googlePlaceId')||'').trim();
  const name=String(q.get('name')||'').trim().slice(0,160);
  const address=String(q.get('address')||'').trim().slice(0,240);
  const phone=String(q.get('phone')||'').trim().slice(0,80);
  const website=String(q.get('website')||'').trim().slice(0,700);
  let googleResult={ok:false,source:'none'};
  if(placeId){
    googleResult=await googlePlaceDetails(placeId);
  }
  if(googleResult?.ok){
    if(!googleResult.opening_hours||!googleResult.phone||!googleResult.website){
      const official=await officialRestaurantDetails(name||googleResult.name,address||googleResult.address,phone||googleResult.phone,website||googleResult.website);
      if(official?.ok){
        if(!googleResult.website&&official.website)googleResult.website=official.website;
        if(!googleResult.phone&&official.phone)googleResult.phone=official.phone;
        if(!googleResult.opening_hours&&official.opening_hours)googleResult.opening_hours=official.opening_hours;
        if(official.menu)googleResult.menu=official.menu;
        if(official.source)googleResult.fallbackSource=official.source;
      }
    }
    if(res.setHeader)res.setHeader('Cache-Control','private, no-store');
    return res.status(200).json(googleResult);
  }
  const official=await officialRestaurantDetails(name,address,phone,website);
  if(res.setHeader)res.setHeader('Cache-Control','private, no-store');
  return res.status(200).json(official?.ok?official:{ok:false,source:googleResult?.source||'none',message:'Restaurant details are not currently available.'});
}
if(mode==='website'){
 const name=String(q.get('name')||'').trim().slice(0,160),address=String(q.get('address')||'').trim().slice(0,240),brand=String(q.get('brand')||'').trim().slice(0,160),providerWebsite=String(q.get('website')||'').trim().slice(0,700),phone=String(q.get('phone')||'').trim().slice(0,80);
 if(!name)return res.status(400).json({ok:false,message:'Restaurant name is required.'});
 const result=await resolveOfficialWebsite({name,address,brand,website:providerWebsite,phone});
 if(res.setHeader)res.setHeader('Cache-Control','public, max-age=300, s-maxage=300, stale-while-revalidate=600');
 return res.status(200).json({ok:true,website:result.website||'',officialPage:result.officialPage||'',source:result.source||'none'});
}
if(mode==='search'){
 const startedAt=Date.now();
 const lat=n(q.get('lat')),lon=n(q.get('lon')),radius=clamp(q.get('radius')),searchTerm=normalizeSearchQuery(q.get('q')||'');
 if(!validCoords(lat,lon))return res.status(400).json({ok:false,message:'Coordinates are invalid.'});
 const key=lat.toFixed(4)+':'+lon.toFixed(4)+':'+radius+':'+searchTerm,hit=cache.get(key);
 if(hit&&Date.now()-hit.t<60000)return res.status(200).json(hit.data);
 if(rate(req,mode))return res.status(429).json({ok:false,code:'RATE_LIMITED',message:'Restaurant search is temporarily busy. Please try again.'});
 if(res.setHeader)res.setHeader('Cache-Control','public, max-age=30, s-maxage=30, stale-while-revalidate=60');
 const wideSearch=radius>WIDE_RADIUS_THRESHOLD;
 const discoveryPlan=radiusDiscoveryPlan(lat,lon,radius);
  const hoursTimezonePromise=hoursTimezoneForCoordinates(lat,lon);
 const primaryBudget=Math.max(2800,SEARCH_BUDGET_MS-(wideSearch?discoveryPlan.reserveMs:0));
 // Wide searches keep primary providers inside their proven 50-mile envelope.
 // Deterministic tiled discovery fills the full selected geographic disk, and
 // the final true-distance filter removes every out-of-radius row.
 // CP1183: 25/50-mile searches query their requested radius directly.
 // Small searches keep the stable 10-mile core. For 25/50, direct provider
 // coverage is primary and the tiled expansion layer remains supplemental.
 // The final origin-distance filter still enforces the exact selected radius.
 const providerRadius=wideSearch
   ? WIDE_PROVIDER_RADIUS_CAP
   : radius>=25
     ? Math.min(radius,WIDE_PROVIDER_RADIUS_CAP)
     : 10;
 const discoveryPromise=radius>10
   ? withinBudget(
       Promise.allSettled([
         photonRadiusExpansion(lat,lon,radius,searchTerm),
         radius<=50 ? radiusOverpassExpansion(lat,lon,radius,searchTerm) : Promise.resolve({rows:[],errors:[],provider:'none'})
       ]).then(results=>{
         const rows=[],errors=[];
         for(const result of results){
           if(result.status==='fulfilled'){
             rows.push(...(result.value?.rows||[]));
             errors.push(...(result.value?.errors||[]));
           }else{
             errors.push(String(result.reason?.message||result.reason||'Radius expansion provider failed'));
           }
         }
         return {rows:dedupe(rows),errors};
       }),
       WIDE_DISCOVERY_TIMEBOX_MS,
       'Radius expansion timed out'
     )
   : null;
 // CP1158: nearby provider calls are individually time-boxed. The previous
 // implementation awaited raw Photon/ArcGIS/Google promises, so a slow
 // upstream could hold the serverless function until Vercel's 30-second cap.
 const nearbyProviderTimeout=radius<=10?10000:Math.min(4200,Math.max(2800,primaryBudget));
 const primaryPromise=wideSearch
   ? [withinBudget(arcgisPlaces(lat,lon,providerRadius,searchTerm,2100),nearbyProviderTimeout,'Wide ArcGIS lookup timed out')]
   : [
     // CP1168/r39: 3/5/10-mile searches also add OSM discovery so provider result caps do not flatten the small-radius choices.
     // One ArcGIS/Photon query can hit a result ceiling; independent local
     // tiles recover nearby venues and the final origin-distance filter keeps
     // the selected radius exact.
     withinBudget(photonPlaces(lat,lon,providerRadius,searchTerm),nearbyProviderTimeout,'Photon lookup timed out'),
     withinBudget(arcgisPlaces(lat,lon,providerRadius,searchTerm),nearbyProviderTimeout,'ArcGIS lookup timed out'),
     searchTerm ? Promise.resolve({rows:[],errors:[]}) : withinBudget(googlePlaces(lat,lon,providerRadius),nearbyProviderTimeout,'Google nearby lookup timed out')
   ];
let primaryBatch,parallelWide=null,fastProvider='none';
 if(wideSearch){
   // Wide searches keep the fast providers anchored to 50 miles. Each provider gets
   // a full wide-search timebox, while tiled Overpass discovery supplies the
   // outer-radius coverage through independent, redundant tile requests.
   const wideTasks=[
     withinBudget(arcgisPlaces(lat,lon,providerRadius,searchTerm,2100),WIDE_PRIMARY_TIMEBOX_MS,'Wide ArcGIS lookup timed out'),
     withinBudget(photonPlaces(lat,lon,providerRadius,searchTerm),WIDE_PRIMARY_TIMEBOX_MS,'Wide Photon lookup timed out'),
     withinBudget(searchTerm?googleSearchPlaces(lat,lon,providerRadius,searchTerm):googlePlaces(lat,lon,providerRadius),WIDE_PRIMARY_TIMEBOX_MS,'Wide Google lookup timed out')
   ];
   const settled=await Promise.allSettled(wideTasks);
   primaryBatch={
     arcgis:settled[0],
     widePhoton:settled[1],
     google:settled[2]
   };   fastProvider='wide';
   const discoveryRemaining=Math.max(0,SEARCH_BUDGET_MS-(Date.now()-startedAt));
   parallelWide=discoveryRemaining>500
     ? await withinBudget(discoveryPromise,Math.min(WIDE_DISCOVERY_TIMEBOX_MS,discoveryRemaining),'Wide radius discovery timed out')
     : {__timeout:true,reason:'Wide radius discovery deferred'};
 }else{
   // CP972: keep both fast primary providers. ArcGIS often supplies the
   // street number, phone, and website that Photon omits, which exact photo
   // matching needs to identify the correct venue.
   const tasks=primaryPromise;
   const settled=await Promise.allSettled(tasks);
   primaryBatch=settled;
   const firstWithRows=settled.findIndex(x=>x?.status==='fulfilled'&&Array.isArray(x.value?.rows)&&x.value.rows.length);
   fastProvider=firstWithRows>=0?firstWithRows:'none';
 }
 let photonResult={status:'rejected',reason:new Error('Photon not selected')};
 let arcgisResult={status:'rejected',reason:new Error('ArcGIS not selected')};
 let googleResult={status:'rejected',reason:new Error('Google not selected')};
 let widePhotonResult={status:'rejected',reason:new Error('Wide Photon provider not used')};
 if(wideSearch){
   if(primaryBatch?.arcgis?.status==='fulfilled')arcgisResult=primaryBatch.arcgis;
   else if(primaryBatch?.arcgis?.reason)arcgisResult={status:'rejected',reason:primaryBatch.arcgis.reason};
   if(primaryBatch?.widePhoton?.status==='fulfilled'){
     widePhotonResult=primaryBatch.widePhoton;
   }else if(primaryBatch?.widePhoton?.reason){
     widePhotonResult={status:'rejected',reason:primaryBatch.widePhoton.reason};
   }
   if(primaryBatch?.google?.status==='fulfilled'){
     googleResult=primaryBatch.google;
   }else if(primaryBatch?.google?.reason){
     googleResult={status:'rejected',reason:primaryBatch.google.reason};
   }
 }else if(Array.isArray(primaryBatch)){
   photonResult=primaryBatch[0]||photonResult;
   arcgisResult=primaryBatch[1]||arcgisResult;
   googleResult=primaryBatch[2]||googleResult;
   widePhotonResult=primaryBatch[3]||widePhotonResult;
 }else if(primaryBatch?.rows){
   const v={status:'fulfilled',value:primaryBatch};
   if(fastProvider===0)photonResult=v;
   else if(fastProvider===1)arcgisResult=v;
   else if(fastProvider===2)googleResult=v;
 }
 const photonOut=photonResult.status==='fulfilled'?photonResult.value:{rows:[],errors:[String(photonResult.reason?.message||photonResult.reason||'Photon unavailable')]};
 const widePhotonOut=widePhotonResult.status==='fulfilled'?widePhotonResult.value:{rows:[],errors:wideSearch?[String(widePhotonResult.reason?.message||widePhotonResult.reason||'Wide Photon unavailable')]:[]};
 if(wideSearch)photonOut.rows=[...(photonOut.rows||[]),...(widePhotonOut.rows||[])];
 if(wideSearch)photonOut.errors=[...(photonOut.errors||[]),...(widePhotonOut.errors||[])];
 const arcgisOut=arcgisResult.status==='fulfilled'?arcgisResult.value:{rows:[],errors:[String(arcgisResult.reason?.message||arcgisResult.reason||'ArcGIS unavailable')]};
 let googleOut=googleResult.status==='fulfilled'?googleResult.value:{rows:[],errors:[String(googleResult.reason?.message||googleResult.reason||'Google Places unavailable')]};

 let preliminary=filterNonDiningRows(dedupe([...(googleOut.rows||[]),...(photonOut.rows||[]),...(arcgisOut.rows||[])]));
 let osmOut={rows:[],errors:[]};

 // CP1168: deterministic tiled radius discovery runs alongside the fast provider pass and is merged
 // before final matching. 10/25/50 mile searches therefore get an actual
 // geographic discovery layer instead of inheriting a 100-result provider cap.
 // CP1168/r38 also tiles the primary providers for 1/3/5/10 miles so the
 // smallest radius choices no longer collapse onto the same capped result set.
 if(discoveryPromise){
   const got=wideSearch ? parallelWide : await discoveryPromise;
   if(got&&!got.__timeout){
     osmOut.rows.push(...(got.rows||[]));
     osmOut.errors.push(...(got.errors||[]));
   }else{
     osmOut.errors.push(wideSearch?'Wide radius discovery timed out':'Radius discovery timed out');
   }
   preliminary=filterNonDiningRows(dedupe([
     ...(preliminary||[]),
     ...(osmOut.rows||[])
   ]));
 }

 const preliminarySearchMatches=searchTerm
   ? preliminary.filter(row=>restaurantSearchMatches(row,searchTerm)).length
   : preliminary.length;

 if(searchTerm && preliminarySearchMatches===0){
   const remaining=Math.max(0,SEARCH_BUDGET_MS-(Date.now()-startedAt));
   const fallbackBudget=Math.min(3200,remaining);
   if(fallbackBudget>600){
     const fallbackTasks=[
       withinBudget(googleSearchPlaces(lat,lon,providerRadius,searchTerm),fallbackBudget,'Google named search fallback timed out'),
       (radius<=25 && (!discoveryPromise || !osmOut.rows.length))
         ? withinBudget(overpass(lat,lon,radius,'restaurant|fast_food',searchTerm),Math.min(1800,fallbackBudget),'OSM named search fallback timed out')
         : Promise.resolve({rows:[],errors:[]})
     ];
     const fallback=await Promise.allSettled(fallbackTasks);
     if(fallback[0]?.status==='fulfilled')googleOut=fallback[0].value||googleOut;
     if(fallback[1]?.status==='fulfilled')osmOut.rows.push(...(fallback[1].value?.rows||[]));
     if(fallback[1]?.status==='fulfilled')osmOut.errors.push(...(fallback[1].value?.errors||[]));
     preliminary=filterNonDiningRows(dedupe([
       ...(googleOut.rows||[]),
       ...(photonOut.rows||[]),
       ...(arcgisOut.rows||[]),
       ...(osmOut.rows||[])
     ]));
   }
 }
 let contactOut={rows:[],errors:[]};
 const contactCandidates=filterNonDiningRows(dedupe([...preliminary,...osmOut.rows]));
 const contactAllowed=!wideSearch;
 const missingContactNames=contactCandidates
   .filter(r=>!r.phone)
   .sort((a,b)=>Number(b.fastFood)-Number(a.fastFood)||Number(a.distance||0)-Number(b.distance||0))
   .map(r=>r.name)
   .filter(Boolean)
   .filter((name,i,a)=>a.findIndex(x=>norm(x)===norm(name))===i)
   .slice(0,12);
 const contactRemaining=Math.max(0,SEARCH_BUDGET_MS-(Date.now()-startedAt));
 if(contactAllowed&&missingContactNames.length&&contactRemaining>2300&&preliminary.length<3){
   const expandedNames=[...new Set(contactCandidates.filter(r=>missingContactNames.some(n=>norm(n)===norm(r.name))).flatMap(r=>[r.name,r.brand,r.operator]).filter(Boolean))].slice(0,12);
   const got=await withinBudget(contactEnrichment(lat,lon,Math.min(radius,25),expandedNames),Math.min(1900,contactRemaining),'Restaurant contact enrichment timed out');
   if(got&&!got.__timeout)contactOut=got; else contactOut.errors.push('Contact enrichment timed out');
  }
  // CP1053: keep Enterprise Google enrichment on demand. Regular searches
  // remain in the lower-cost discovery tier; Details requests the Enterprise
  // fields only when the user actually opens a restaurant.
  const googleContactOut={rows:[],errors:[]};
  const hoursTimeZone=await Promise.race([hoursTimezonePromise,new Promise(resolve=>setTimeout(()=>resolve(''),650))]).catch(()=>'');
  const rows=filterNonDiningRows(dedupe([...contactCandidates,...contactOut.rows])).map(r=>{
   const distance=miles(lat,lon,n(r.lat),n(r.lon));
   return {...r,distance};
 }).filter(r=>Number.isFinite(r.distance)&&r.distance<=radius+0.001).filter(r=>restaurantSearchMatches(r,searchTerm)).map(r=>{
   const direct=safeWebsiteUrl(r.website); const known=knownRestaurantWebsite(r); const cachedKey=normalizeSearchQuery([r.name,r.address,r.brand].filter(Boolean).join('|')); const cachedEntry=officialWebsiteCache.get(cachedKey); const cached=(cachedEntry&&Date.now()-cachedEntry.t<OFFICIAL_WEBSITE_CACHE_TTL)?cachedEntry.url:''; const website=direct||known||cached;
   const phone=String(r.phone||'').trim();
   const classification=RESTAURANT_TAXONOMY.classifyRestaurant({...r,website,phone}); const canonicalCategory=classification.primary||r.category||'American'; const classifiedFastFood=classification.tags.includes('Fast Food'); const photo=restaurantPhotoMeta(r); return {...r,category:canonicalCategory,fastFood:classifiedFastFood,quickCutTags:classification.tags,quickCutEvidence:classification.evidence,...photo,website,phone,websiteSource:r.website?'provider':(known?'known-brand':(cached?'official-search':'google-search-fallback')),phoneSource:phone?'provider':'google-search-fallback',hoursTimeZone:String(hoursTimeZone||r.hoursTimeZone||''),hoursSource:r.hoursSource||(r.opening_hours?(String(r.source||'').startsWith('OpenStreetMap')||String(r.source||'').startsWith('Photon')?'OpenStreetMap':'provider'):'')};
  });
 const hoursCoverage={knownOpenNow:rows.filter(r=>typeof r.openNow==='boolean').length,openingHours:rows.filter(r=>!!String(r.opening_hours||'').trim()).length,unknown:rows.filter(r=>!restaurantHasAnyHoursData(r)).length,hoursSourceBreakdown:rows.reduce((acc,r)=>{const k=String(r.hoursSource||'unknown');acc[k]=(acc[k]||0)+1;return acc;}, {})};
const data={ok:true,version:API_VERSION,googlePlacesConfigured:!!GOOGLE_KEY,radiusMiles:radius,searchQuery:searchTerm,total:rows.length,fastFoodCount:rows.filter(r=>RESTAURANT_TAXONOMY.classifyRestaurant(r).tags.includes('Fast Food')).length,lat,lon,searchLatencyMs:Date.now()-startedAt,searchBudgetMs:SEARCH_BUDGET_MS,discoveryMode:discoveryPlan.mode,discoveryReserveMs:discoveryPlan.reserveMs,discoveryGroups:discoveryPlan.groups.length,discoveryCoveragePoints:discoveryPlan.coveragePoints,providerSearchRadiusMiles:providerRadius,providerExpansionPoints:discoveryPlan.coveragePoints,hoursCoverage, primaryWinner:fastProvider,providers:{google:(googleOut.rows||[]).length,googleContact:(googleContactOut.rows||[]).length,photon:(photonOut.rows||[]).length,arcgis:(arcgisOut.rows||[]).length,overpass:(osmOut.rows||[]).length,contact:(contactOut.rows||[]).length},providerErrors:[...googleOut.errors,...photonOut.errors,...arcgisOut.errors,...osmOut.errors,...contactOut.errors,...googleContactOut.errors].slice(0,8),results:rows};
 cache.set(key,{t:Date.now(),data});return res.status(200).json(data)}
return res.status(400).json({ok:false,message:'Unknown mode.'})
}catch(e){console.error('dinliminate-'+API_VERSION,e);return res.status(502).json({ok:false,code:String(e?.code||'SERVICE'),message:String(e?.message||'Restaurant service unavailable.')})}}
handler._test={directWebsiteDomainCandidates,fetchPublicSearchPage,fetchDuckDuckGoSearchPage,fetchGoogleWebSearchPage,fetchDiscoveryPage,officialPageSearchScore,verifiedWebsiteSearchHit,websiteSearchHitScore,extractExternalWebsiteLinks,extractBingDiscoveryResults,isDiscoveryHost,isFastFoodName,dedupe,isClearlyNonDiningBusiness,filterNonDiningRows,restaurantNameTokens,nameVariantMatch,sameRestaurant,restaurantStreetKey,addressHasStreetNumber,normAddress,phoneKey,websiteKey,requestQuery,centers,radiusDiscoveryPlan,normalizeSearchQuery,searchRegex,searchRegexAlternatives,searchQueryClause,providerSearchTerms,classifySearchTerm,rate,restaurantPhotoMeta,restaurantSearchMatches,image,knownRestaurantWebsite,isBlockedWebsite,fetchWebPage,fetchBingSearchPage,extractBingWebsiteResults,websitePageScore,verifiedWebsiteCandidate,discoverOfficialWebsite,resolveOfficialWebsite,googleContactEnrichment,googlePlaceDetails,officialRestaurantDetails,extractOfficialRestaurantData,applyGoogleContactPatches,hoursTimezoneForCoordinates,restaurantIdentityKey:RESTAURANT_TAXONOMY.restaurantIdentityKey,restaurantNameSimilarity,restaurantAddressSimilarity,classifyRestaurant:RESTAURANT_TAXONOMY.classifyRestaurant};
module.exports=handler;
// CP790 deployment trigger: corrected hours cleanup + locality geocoding.