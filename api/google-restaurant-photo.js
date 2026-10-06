'use strict';

const { pacificMonthKey, nextPacificMonthIso, reserveGoogleSku, HARD_LIMITS, googleUsageHealth, disableGoogleSkuForMonth, googleServicesEnabled } = require('./google-usage');

const GOOGLE_PLACES_API_KEY=String(process.env.GOOGLE_PLACES_API_KEY||'').trim();
const photoRateBuckets=new Map();
function photoRateLimited(req,key,max=24){
  const headers=req?.headers||{},ip=String(headers['x-forwarded-for']||headers['x-real-ip']||'anon').split(',')[0].trim()||'anon';
  const bucketKey=ip+':'+key,now=Date.now(),old=photoRateBuckets.get(bucketKey);
  if(!old||now-old.at>60000){photoRateBuckets.set(bucketKey,{at:now,count:1});return false;}
  old.count++;return old.count>max;
}
function clean(v,max=300){return String(v||'').trim().replace(/[\x00-\x1f\x7f]/g,' ').slice(0,max)}
function normalize(v){return clean(v,1000).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function addressNumber(v){const m=String(v||'').match(/\b\d{1,6}\b/);return m?m[0]:''}
function cityTokens(v){return normalize(v).split(' ').filter(x=>x.length>=4&&!/^\d+$/.test(x)).slice(-5)}
function canonicalVenueNameTokens(v){
  return normalize(v)
    .replace(/\bbar\s+b\s+q\b/g,'bbq')
    .replace(/\bbarbecue\b/g,'bbq')
    .replace(/\bbarbeque\b/g,'bbq')
    .split(' ')
    .filter(Boolean);
}
function venueNameMatches(candidate,input){
  const a=canonicalVenueNameTokens(candidate),b=canonicalVenueNameTokens(input);
  if(!a.length||!b.length)return false;
  if(a.join(' ')===b.join(' '))return true;
  const shared=a.filter(token=>b.includes(token)).length;
  const coverage=shared/Math.min(a.length,b.length);
  const hasDistinctive= a.some(token=>token.length>=4&&b.includes(token));
  return hasDistinctive&&coverage>=0.75;
}
function distanceMiles(a,b,c,d){
  const R=3958.7613,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,z=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;
  return 2*R*Math.asin(Math.sqrt(z));
}
function exactPlaceMatch(place,name,address,lat,lon){
  const formatted=normalize(place?.formattedAddress||'');
  const input=normalize(address);
  const placeName=normalize(place?.displayName?.text||place?.displayName||place?.name||'');
  const number=addressNumber(address);
  if(!venueNameMatches(placeName,name))return false;
  if(number&&!formatted.includes(number))return false;
  const inputCities=cityTokens(address);
  if(!inputCities.some(t=>formatted.includes(t)))return false;
  if(Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Number.isFinite(Number(place?.location?.latitude))&&Number.isFinite(Number(place?.location?.longitude)))
    if(distanceMiles(Number(lat),Number(lon),Number(place.location.latitude),Number(place.location.longitude))>0.35)return false;
  const postal=(input.match(/\b\d{5}(?:-\d{4})?\b/)||[])[0];
  if(postal&&!formatted.includes(postal.slice(0,5)))return false;
  return true;
}
function photoQuality(photo,index){
  const w=Number(photo?.widthPx)||0,h=Number(photo?.heightPx)||0;
  if(!w||!h)return -1000;
  const pixels=w*h,ratio=w/h;
  let score=700-index*8;
  if(w>=1200)score+=80;
  if(pixels>=700000)score+=55;else if(pixels<250000)score-=120;
  if(ratio>=1&&ratio<=2.25)score+=35;
  if(ratio<0.55||ratio>3)score-=150;
  return score;
}
function isQuotaError(status,body){
  const text=normalize(JSON.stringify(body||{}));
  return status===403&&/resource exhausted|quota|billing|rate limit|daily limit|monthly/.test(text);
}
async function googleJson(url,options={},timeout=6500){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
  try{
    const res=await fetch(url,{...options,signal:ctl.signal,headers:{'Content-Type':'application/json','X-Goog-Api-Key':GOOGLE_PLACES_API_KEY,...(options.headers||{})}});
    const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{}
    if(!res.ok){const err=new Error('Google Places request failed ('+res.status+').');err.status=res.status;err.body=data;throw err;}
    return data||{};
  }finally{clearTimeout(timer)}
}
async function googlePhotoMedia(photoName){
  const budget=await reserveGoogleSku('place-photo',HARD_LIMITS['place-photo']);
  if(!budget.ok){
    console.warn('dinliminate-google-photo-budget-block',{reason:budget.reason,count:budget.count||0});
    return null;
  }
  const url='https://places.googleapis.com/v1/'+photoName+'/media?maxHeightPx=1050&maxWidthPx=1400';
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),7000);
  try{
    const res=await fetch(url,{signal:ctl.signal,headers:{'Accept':'image/avif,image/webp,image/jpeg,image/png','X-Goog-Api-Key':GOOGLE_PLACES_API_KEY,'User-Agent':'Dinliminate/1.0 (Google Places photo)'}});
    if(!res.ok){let body=null;try{body=await res.json()}catch{};if(isQuotaError(res.status,body))await disableGoogleSkuForMonth('place-photo');return null;}
    const type=(res.headers.get('content-type')||'').split(';')[0].toLowerCase();
    if(!type.startsWith('image/')||type==='image/svg+xml'||type==='image/svg')return null;
    const bytes=Buffer.from(await res.arrayBuffer());
    if(bytes.length<4000||bytes.length>10*1024*1024)return null;
    return {type,bytes};
  }finally{clearTimeout(timer)}
}
async function findPlaceId(name,address,lat,lon,preferredPlaceId){
  const exactId=clean(preferredPlaceId,220);
  if(/^ChI[A-Za-z0-9_-]+$/.test(exactId))return exactId;
  const query=[clean(name,160),clean(address,240)].filter(Boolean).join(', ');
  const body={textQuery:query,pageSize:5};
  if(Number.isFinite(Number(lat))&&Number.isFinite(Number(lon)))body.locationBias={circle:{center:{latitude:Number(lat),longitude:Number(lon)},radius:1500}};
  const budget=await reserveGoogleSku('text-search-pro',HARD_LIMITS['text-search-pro']);
  if(!budget.ok)return '';
  let data;
  try{
    data=await googleJson('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.location'},body:JSON.stringify(body)});
  }catch(err){
    if(Number(err?.status)===403||Number(err?.status)===429)await disableGoogleSkuForMonth('text-search-pro');
    throw err;
  }
  const candidates=Array.isArray(data.places)?data.places:[];
  const exact=candidates.find(p=>exactPlaceMatch(p,name,address,lat,lon));
  if(exact?.id)return String(exact.id).trim();
  return '';
}
async function getPlaceDetails(placeId){
  if(!placeId)return null;
  const budget=await reserveGoogleSku('place-details-essentials',HARD_LIMITS['place-details-essentials']);
  if(!budget.ok){
    console.warn('dinliminate-google-place-details-budget-block',{reason:budget.reason,count:budget.count||0,limit:budget.limit||HARD_LIMITS['place-details-essentials']});
    return null;
  }
  try{
    return await googleJson('https://places.googleapis.com/v1/places/'+encodeURIComponent(placeId),{
      method:'GET',
      headers:{'X-Goog-FieldMask':'id,displayName,formattedAddress,location,photos'}
    });
  }catch(err){
    if(Number(err?.status)===403||Number(err?.status)===429)await disableGoogleSkuForMonth('place-details-essentials');
    throw err;
  }
}
async function tryGoogleRestaurantPhoto(input){
  if(!GOOGLE_PLACES_API_KEY||!googleServicesEnabled())return null;
  const args=input||{};
  try{
    const id=await findPlaceId(args.name,args.address,args.lat,args.lon,args.placeId);
    if(!id){
      console.warn('dinliminate-google-photo-no-place',{name:clean(args.name,160),address:clean(args.address,240),placeId:clean(args.placeId,220)});
      return null;
    }
    const place=await getPlaceDetails(id);
    if(!place){
      console.warn('dinliminate-google-photo-no-details',{name:clean(args.name,160),placeId:id});
      return null;
    }
    const exact=exactPlaceMatch(place,args.name,args.address,args.lat,args.lon);
    const photos=Array.isArray(place.photos)?place.photos.slice(0,10):[];
    if(!exact){
      console.warn('dinliminate-google-photo-exact-mismatch',{name:clean(args.name,160),requestedAddress:clean(args.address,240),placeId:id,formattedAddress:clean(place.formattedAddress,240),lat:place.location?.latitude,lon:place.location?.longitude});
      return null;
    }
    if(!photos.length){
      console.warn('dinliminate-google-photo-no-photos',{name:clean(args.name,160),placeId:id,formattedAddress:clean(place.formattedAddress,240)});
      return null;
    }
    const ranked=photos.map((p,i)=>({photo:p,score:photoQuality(p,i)})).filter(x=>x.score>-500).sort((a,b)=>b.score-a.score);
    for(const item of ranked.slice(0,2)){
      const photo=item.photo,media=await googlePhotoMedia(photo.name);if(!media)continue;
      const author=Array.isArray(photo.authorAttributions)?photo.authorAttributions.map(a=>({displayName:clean(a?.displayName,120),uri:clean(a?.uri,600)})).filter(a=>a.displayName&&/^https:\/\//i.test(a.uri)).slice(0,3):[];
      const googleMapsUri=clean(photo.googleMapsUri,800);
      const attributions=[{displayName:'Google',uri:googleMapsUri||'https://www.google.com/maps'},...author];
      return {media,source:'google-places',sourceName:'Google',sourceUrl:googleMapsUri||'https://www.google.com/maps',attributions,googlePlaceId:id};
    }
  }catch(err){
    console.error('dinliminate-google-photo-error',{
      name:clean(args?.name,160),
      address:clean(args?.address,240),
      status:Number(err?.status)||0,
      body:err?.body||null,
      message:String(err?.message||err||'unknown')
    });
    if(isQuotaError(Number(err?.status)||0,err?.body))await disableGoogleSkuForMonth('place-photo');
  }
  return null;
}
function googlePhotoQuery(req){
 const q=req?.query&&typeof req.query==='object'?req.query:(req?.queryStringParameters||{});
 return q||{};
}
function sendGoogleJson(res,status,payload){
 res.statusCode=status;
 res.setHeader?.('Content-Type','application/json; charset=utf-8');
 res.setHeader?.('Cache-Control','no-store');
 res.end?.(JSON.stringify(payload));
 return res;
}
function sendGoogleMedia(res,found){
 if(!found?.media)return sendGoogleJson(res,404,{ok:false,error:'No verified Google restaurant photo was found'});
 res.setHeader?.('Content-Type',found.media.type);
 res.setHeader?.('Cache-Control','no-store');
 res.setHeader?.('X-Content-Type-Options','nosniff');
 res.setHeader?.('X-Restaurant-Photo-Source',found.source||'google-places');
 res.setHeader?.('X-Restaurant-Photo-Source-URL',found.sourceUrl||'https://www.google.com/maps');
 if(Array.isArray(found.attributions)&&found.attributions.length){
  res.setHeader?.('X-Restaurant-Photo-Attributions',Buffer.from(JSON.stringify(found.attributions)).toString('base64url'));
 }
 res.statusCode=200;
 res.end?.(found.media.bytes);
 return res;
}
async function handler(req,res){
 res.setHeader?.('Cache-Control','no-store');
 res.setHeader?.('X-Content-Type-Options','nosniff');
 res.setHeader?.('Referrer-Policy','no-referrer');
 if(String(req?.method||'GET').toUpperCase()!=='GET')return sendGoogleJson(res,405,{ok:false,error:'GET required'});
 const q=googlePhotoQuery(req);
 const mode=String(q.mode||'photo').toLowerCase();
 if(mode==='health'){
  return sendGoogleJson(res,200,{
   ok:true,
   googlePlacesConfigured:!!GOOGLE_PLACES_API_KEY,
   durableBudgetConfigured:!!process.env.GOOGLE_BUDGET_DATABASE_URL||!!process.env.FAMILY_DATABASE_URL||!!process.env.DATABASE_URL||!!process.env.POSTGRES_URL,
   monthlyHardLimit:HARD_LIMITS['place-photo'],
   billingMonthTimeZone:'America/Los_Angeles',
   usageSkus:await googleUsageHealth()
  });
 }
 if(photoRateLimited(req,mode==='health'?'health':'photo',mode==='health'?60:24))return sendGoogleJson(res,429,{ok:false,error:'Too many photo requests. Please try again shortly.'});
 const name=clean(q.name,160);
 const address=clean(q.address,240);
 if(!name)return sendGoogleJson(res,400,{ok:false,error:'Restaurant name is required'});
 try{
  const found=await tryGoogleRestaurantPhoto({
   name,
   address,
   lat:q.lat,
   lon:q.lon,
   phone:q.phone,
   placeId:q.placeId||q.googlePlaceId
  });
  return sendGoogleMedia(res,found);
 }catch(err){
  console.error('dinliminate-google-restaurant-photo',err);
  return sendGoogleJson(res,502,{ok:false,error:'Google restaurant photo lookup failed'});
 }
}
handler.tryGoogleRestaurantPhoto=tryGoogleRestaurantPhoto;
handler._test={tryGoogleRestaurantPhoto,exactPlaceMatch,venueNameMatches,canonicalVenueNameTokens,photoQuality,findPlaceId,getPlaceDetails,googlePhotoMedia};
module.exports=handler;