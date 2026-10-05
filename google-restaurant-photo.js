'use strict';

const { neon } = require('@neondatabase/serverless');
const GOOGLE_PLACES_API_KEY=String(process.env.GOOGLE_PLACES_API_KEY||'').trim();
const DATABASE_URL=String(process.env.GOOGLE_PHOTO_BUDGET_DATABASE_URL||process.env.FAMILY_DATABASE_URL||process.env.DATABASE_URL||process.env.POSTGRES_URL||'').trim();
const DEFAULT_MONTHLY_LIMIT=Math.max(1,Number.parseInt(process.env.GOOGLE_PHOTO_MONTHLY_HARD_LIMIT||'850',10)||850);
const UNTRACKED_LIMIT=Math.max(0,Number.parseInt(process.env.GOOGLE_PHOTO_UNTRACKED_LIMIT||'0',10)||0);
const MONTH_TABLE='dinliminate_google_photo_usage';
let dbPromise=null,localMonth='',localCount=0,quotaDisabledMonth='';
function monthKey(){const d=new Date();return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')}
function nextMonthIso(){const d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)).toISOString()}
function clean(v,max=300){return String(v||'').trim().replace(/[\x00-\x1f\x7f]/g,' ').slice(0,max)}
function normalize(v){return clean(v,1000).toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function addressNumber(v){const m=String(v||'').match(/\b\d{1,6}\b/);return m?m[0]:''}
function cityTokens(v){return normalize(v).split(' ').filter(x=>x.length>=4&&!/^\d+$/.test(x)).slice(-5)}
function distanceMiles(a,b,c,d){const R=3958.7613,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,z=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(z))}
function placeNameMatches(place,name,brand=''){
 const candidate=normalize(place?.displayName?.text||place?.name||'');
 const target=normalize(name);
 const brandTarget=normalize(brand);
 if(!candidate||(!target&&!brandTarget))return false;
 const variants=[target,brandTarget].filter(Boolean);
 for(const value of variants){
  if(candidate===value||candidate.includes(value)||value.includes(candidate))return true;
  const a=new Set(value.split(' ').filter(x=>x.length>=3));
  const b=new Set(candidate.split(' ').filter(x=>x.length>=3));
  const shared=[...a].filter(x=>b.has(x)).length;
  if(a.size&&shared/Math.min(a.size,b.size||1)>=0.65)return true;
 }
 return false;
}
function exactPlaceMatch(place,name,address,lat,lon,brand=''){
 const formatted=normalize(place?.formattedAddress||''),input=normalize(address),number=addressNumber(address);
 if(!placeNameMatches(place,name,brand))return false;
 if(number&&!formatted.includes(number))return false;
 const cities=cityTokens(address);
 if(cities.length&&!cities.some(t=>formatted.includes(t)))return false;
 if(Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Number.isFinite(Number(place?.location?.latitude))&&Number.isFinite(Number(place?.location?.longitude))&&distanceMiles(Number(lat),Number(lon),Number(place.location.latitude),Number(place.location.longitude))>0.35)return false;
 const postal=(input.match(/\b\d{5}(?:-\d{4})?\b/)||[])[0];
 if(postal&&!formatted.includes(postal.slice(0,5)))return false;
 return true;
}
function photoQuality(photo,index){
 const w=Number(photo?.widthPx)||0,h=Number(photo?.heightPx)||0;if(!w||!h)return -1000;
 const pixels=w*h,ratio=w/h;let score=700-index*8;
 if(w>=1200)score+=80;if(pixels>=700000)score+=55;else if(pixels<250000)score-=120;
 if(ratio>=1&&ratio<=2.25)score+=35;if(ratio<0.55||ratio>3)score-=150;return score;
}
async function budgetDb(){
 if(!DATABASE_URL)return null;
 if(!dbPromise)dbPromise=(async()=>{const sql=neon(DATABASE_URL);await sql.query('CREATE TABLE IF NOT EXISTS dinliminate_google_photo_usage (month_key text PRIMARY KEY, request_count integer NOT NULL DEFAULT 0, disabled_until timestamptz NULL, updated_at timestamptz NOT NULL DEFAULT now())');return sql})();
 return dbPromise;
}
async function reservePhotoRequest(){
 const month=monthKey();if(!GOOGLE_PLACES_API_KEY)return {ok:false,reason:'no-key'};if(quotaDisabledMonth===month)return {ok:false,reason:'google-quota-disabled'};
 const sql=await budgetDb().catch(()=>null);
 if(!sql){if(UNTRACKED_LIMIT<=0)return {ok:false,reason:'budget-unconfigured'};if(localMonth!==month){localMonth=month;localCount=0;}if(localCount>=UNTRACKED_LIMIT)return {ok:false,reason:'untracked-limit'};localCount++;return {ok:true,count:localCount};}
 await sql.query('INSERT INTO dinliminate_google_photo_usage (month_key,request_count,disabled_until,updated_at) VALUES ($1,0,NULL,now()) ON CONFLICT(month_key) DO NOTHING',[month]);
 const rows=await sql.query('UPDATE dinliminate_google_photo_usage SET request_count=request_count+1,updated_at=now() WHERE month_key=$1 AND (disabled_until IS NULL OR disabled_until<=now()) AND request_count<$2 RETURNING request_count',[month,DEFAULT_MONTHLY_LIMIT]);
 if(!rows.length)return {ok:false,reason:'monthly-budget'};return {ok:true,count:Number(rows[0].request_count)||0};
}
async function disableGoogleForMonth(){
 const month=monthKey();quotaDisabledMonth=month;const sql=await budgetDb().catch(()=>null);if(!sql)return;
 await sql.query('INSERT INTO dinliminate_google_photo_usage (month_key,request_count,disabled_until,updated_at) VALUES ($1,0,$2,now()) ON CONFLICT(month_key) DO UPDATE SET disabled_until=$2,updated_at=now()',[month,nextMonthIso()]).catch(()=>{});
}
function isQuotaError(status,body){const text=normalize(JSON.stringify(body||''));return status===403&&/resource exhausted|quota|billing|rate limit|daily limit|monthly/.test(text)}
async function googleJson(url,options={},timeout=6500){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
 try{const res=await fetch(url,{...options,signal:ctl.signal,headers:{'Content-Type':'application/json','X-Goog-Api-Key':GOOGLE_PLACES_API_KEY,...(options.headers||{})}});const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{}if(!res.ok){const err=new Error('Google Places request failed ('+res.status+').');err.status=res.status;err.body=data;throw err;}return data||{};}finally{clearTimeout(timer)}
}
async function googlePhotoMedia(photoName){
 const budget=await reservePhotoRequest();if(!budget.ok)return null;
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),7000),url='https://places.googleapis.com/v1/'+photoName+'/media?maxHeightPx=1050&maxWidthPx=1400';
 try{const res=await fetch(url,{signal:ctl.signal,headers:{Accept:'image/avif,image/webp,image/jpeg,image/png','X-Goog-Api-Key':GOOGLE_PLACES_API_KEY,'User-Agent':'Dinliminate/1.0 (Google Places photo)'}});if(!res.ok){let body=null;try{body=await res.json()}catch{}if(isQuotaError(res.status,body))await disableGoogleForMonth();return null;}const type=(res.headers.get('content-type')||'').split(';')[0].toLowerCase();if(!type.startsWith('image/')||type==='image/svg+xml'||type==='image/svg')return null;const bytes=Buffer.from(await res.arrayBuffer());if(bytes.length<4000||bytes.length>10*1024*1024)return null;return {type,bytes};}finally{clearTimeout(timer)}
}
async function findPlaceIds(name,address,lat,lon,preferredPlaceId){
 const ids=[];
 const exactId=clean(preferredPlaceId,220);
 if(/^ChI[A-Za-z0-9_-]+$/.test(exactId))ids.push(exactId);
 const query=[clean(name,160),clean(address,240)].filter(Boolean).join(', ');
 if(query){
  const body={textQuery:query,pageSize:5};
  if(Number.isFinite(Number(lat))&&Number.isFinite(Number(lon)))body.locationBias={circle:{center:{latitude:Number(lat),longitude:Number(lon)},radius:1500}};
  const data=await googleJson('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'X-Goog-FieldMask':'places.id'},body:JSON.stringify(body)});
  for(const p of Array.isArray(data.places)?data.places:[]){
   const id=String(p?.id||'').trim();
   if(/^ChI[A-Za-z0-9_-]+$/.test(id)&&!ids.includes(id))ids.push(id);
  }
 }
 return ids.slice(0,5);
}
async function getPlaceDetails(placeId){if(!placeId)return null;return googleJson('https://places.googleapis.com/v1/places/'+encodeURIComponent(placeId),{method:'GET',headers:{'X-Goog-FieldMask':'id,formattedAddress,location,photos'}})}
async function tryGoogleRestaurantPhoto(input){
 if(!GOOGLE_PLACES_API_KEY)return null;const args=input||{};
 try{
  const ids=await findPlaceIds(args.name,args.address,args.lat,args.lon,args.placeId);
  if(!ids.length)return null;
  for(const id of ids){
   const place=await getPlaceDetails(id);
   if(!place||!exactPlaceMatch(place,args.name,args.address,args.lat,args.lon,args.brand))continue;
   const photos=Array.isArray(place.photos)?place.photos.slice(0,10):[];
   if(!photos.length)continue;
   const ranked=photos.map((p,i)=>({photo:p,score:photoQuality(p,i)})).filter(x=>x.score>-500).sort((a,b)=>b.score-a.score);
   for(const item of ranked.slice(0,2)){
    const photo=item.photo,media=await googlePhotoMedia(photo.name);if(!media)continue;
    const author=Array.isArray(photo.authorAttributions)?photo.authorAttributions.map(a=>({displayName:clean(a?.displayName,120),uri:clean(a?.uri,600)})).filter(a=>a.displayName&&/^https:\/\//i.test(a.uri)).slice(0,3):[];
    const googleMapsUri=clean(photo.googleMapsUri,800);
    return {media,source:'google-places',sourceName:'Google',sourceUrl:googleMapsUri||'https://www.google.com/maps',attributions:[{displayName:'Google',uri:googleMapsUri||'https://www.google.com/maps'},...author],googlePlaceId:id};
   }
  }
 }catch(err){if(isQuotaError(Number(err?.status)||0,err?.body))await disableGoogleForMonth();}
 return null;
}
module.exports={tryGoogleRestaurantPhoto};