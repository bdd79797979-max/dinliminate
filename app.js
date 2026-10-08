// CP1181: stale waiting-card safe rapid swipe handoff.
// CP1180: eliminate stale waiting-card reuse during rapid meal swipes.
// CP1186: radius changes always rebuild an independent restaurant pool; no prior-radius carry-forward.
// CP1171: preserve the swipe transaction lock across card rebinds.
// CP1170: make meal swipe handoff immediate for rapid swipes.
// CP1067: stabilize first card and make All/Maybe counts derive from the actual choice catalog.\n// CP988: Swipe Engine v2 — atomic gestures, immediate exit, exact-once completion.
// CP950 final tree sync: Meal swipe gate removed; keep this commit as the deploy source of truth.

(() => {
'use strict';
// CP954 restaurant first-paint restoration: exact/direct venue photos win before generic fallback.
// CP945 photo-pipeline release sync: canonical Restaurant photo handoff + cache revision.
const getDefaultFoods = () => Array.isArray(window.DINLIMINATE_FOODS) ? window.DINLIMINATE_FOODS : [];
// CP1149 — meal photo policy: official source first, exact same-meal backup second, never a generic food fallback.
const DEFAULT_FOOD_IMAGE = '';
const $ = (id) => document.getElementById(id);

const KEY = 'dinliminate.clean.cp1';
const HISTORY_KEY = 'dinliminate.clean.history';
const APP_VERSION = '1.0';
// CP973 — photo-ready Restaurant first paint + four-card swipe prewarm.
let foodSwipeHandoff=false;
let restaurantSwipeHandoff=false;
// CP1241: let the next card begin a real swipe during the tail of the previous card's flight.
const SWIPE_OVERLAP_DELAY=95;
let swipeOverlapContext=null;
let swipeOverlapSerial=0;
// CP1070: one-at-a-time Restaurant refine panels + category-aware Cuisine filtering.
let APP_BUILD = '1251';
fetch('./app-release.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(meta=>{if(meta?.build)APP_BUILD=String(meta.build)}).catch(()=>{});
const HUNGRY_IMAGE = 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" rx="52" fill="#090909"/><circle cx="600" cy="400" r="170" fill="none" stroke="#f5f1e8" stroke-width="18"/><circle cx="535" cy="365" r="14" fill="#f5f1e8"/><circle cx="665" cy="365" r="14" fill="#f5f1e8"/><path d="M515 495c52-62 118-62 170 0" fill="none" stroke="#f5f1e8" stroke-width="18" stroke-linecap="round"/></svg>');
const RESTAURANT_TAXONOMY = window.DINLIMINATE_RESTAURANT_TAXONOMY;
if(!RESTAURANT_TAXONOMY) throw new Error('Restaurant taxonomy failed to load.');
const FOOD_QUICK = ['American','Southern','Mexican','Italian','Asian','Pasta','Soup/Stew','Healthy','Seafood','Potato'];
const foodQuickLabels=()=>[...FOOD_QUICK,'Other',...(S.customQuickCuts||[]).map(x=>String(x?.name||'').trim()).filter(Boolean)];
const REST_QUICK = [...RESTAURANT_TAXONOMY.tags];
const QUICK_IMAGES = {
Southern:'https://images.pexels.com/photos/2397401/pexels-photo-2397401.jpeg?auto=compress&cs=tinysrgb&w=700', // Meatloaf & Mashed Potatoes
Pasta:'https://images.pexels.com/photos/6287520/pexels-photo-6287520.jpeg?auto=compress&cs=tinysrgb&w=700', // Spaghetti
Asian:'https://images.pexels.com/photos/32845321/pexels-photo-32845321.jpeg?auto=compress&cs=tinysrgb&w=700', // Fried Rice
Mexican:'https://images.pexels.com/photos/12317911/pexels-photo-12317911.jpeg?auto=compress&cs=tinysrgb&w=700', // Tacos / Mexican Stir Fry family
'Soup/Stew':'https://images.pexels.com/photos/15305397/pexels-photo-15305397.jpeg?auto=compress&cs=tinysrgb&w=700', // Soup & Sandwich
Healthy:'https://images.pexels.com/photos/11906476/pexels-photo-11906476.jpeg?auto=compress&cs=tinysrgb&w=700', // Salad Bowl
Breakfast:'https://images.pexels.com/photos/5852231/pexels-photo-5852231.jpeg?auto=compress&cs=tinysrgb&w=700', // Eggs & Toast
American:'https://images.pexels.com/photos/12034622/pexels-photo-12034622.jpeg?auto=compress&cs=tinysrgb&w=700', // Burger
Snack:'https://images.pexels.com/photos/6422042/pexels-photo-6422042.jpeg?auto=compress&cs=tinysrgb&w=700', // Popcorn
Italian:'https://images.pexels.com/photos/7813574/pexels-photo-7813574.jpeg?auto=compress&cs=tinysrgb&w=700', // Pizza
Seafood:'https://images.pexels.com/photos/3763847/pexels-photo-3763847.jpeg?auto=compress&cs=tinysrgb&w=700', // Grilled salmon
Potato:'https://images.pexels.com/photos/273825/pexels-photo-273825.jpeg?auto=compress&cs=tinysrgb&w=700' // Roasted potatoes
};
const REST_QUICK_IMAGES = {
'Fast Food':'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=85',
Southern:'https://images.pexels.com/photos/2397401/pexels-photo-2397401.jpeg?auto=compress&cs=tinysrgb&w=900',
Burgers:'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=85',
Pizza:'https://images.unsplash.com/photo-1579684947550-22e945225d9a?auto=format&fit=crop&w=900&q=85',
Mexican:'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=85',
American:'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85',
Italian:'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=900&q=85',
Asian:'https://images.pexels.com/photos/32845321/pexels-photo-32845321.jpeg?auto=compress&cs=tinysrgb&w=900',
Indian:'https://images.unsplash.com/photo-1680993032090-1ef7ea9b51e5?auto=format&fit=crop&w=900&q=85',
Mediterranean:'https://images.unsplash.com/photo-1743674453093-592bed88018e?auto=format&fit=crop&w=900&q=85',
BBQ:'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=900&q=85',
Seafood:'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?auto=format&fit=crop&w=900&q=85',
Breakfast:'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=900&q=85'
};
const S = {
screen:'home',
hidden:new Set(),
deleted:new Set(),
hiddenRestaurants:{},
cutCats:new Set(),
foodCuts:new Set(),
maybe:new Set(),
maybeDeck:false,
foodMaybeRound:false,
custom:[],
customQuickCuts:[],
deletedCustomMeals:[],
pool:[],
index:0,
foodActions:[],
restaurantPool:[],
restaurantIndex:0,
restaurantCuts:new Set(),
restaurantActions:[],
restaurantMaybeRound:false,
restaurantQuery:'',
restaurantHours:'all',
restaurantHoursCollapsed:true,
location:null,
locationSource:'none',
restaurantSearchLatencyMs:0,
restaurantSearchRadius:10,
saved:false,
storageWarning:false,
restaurantSearchDegraded:false,
locationFreshAt:null,
winnerItem:null,
winnerType:'food',
hungryWheelChoice:null,
hungryWheelSpinning:false,
hungryWheelRotation:0,
hungryWheelDisplayItems:null,
hungryWheelLandedId:null,
hungryWheelSpinPhase:'idle',
hungryWheelVelocity:0,
hungryWheelFrame:null,
hungryWheelLastFrame:0,

hungryWheelDragging:false,
hungryWheelDragAngle:0,
hungryWheelDragRotation:0,
hungryWheelDragLastTime:0,
hungryWheelDragVelocity:0,
hungryRestaurantChoice:null,
hungryRestaurantPendingChoice:null,
hungryWheelSpinToken:0,
schemaVersion:4,
notes:{},
restaurantSearchOrigin:null,
restaurantSearchKey:'',
quickCutsCollapsed:{food:true,restaurant:true},
mealTimeCutsCollapsed:true,
mealTimeFilters:new Set(['Breakfast','Lunch / Dinner','Snacks / Desserts']),
mealTimeSettings:{custom:[],names:{},order:[],disabled:new Set()},
familyNormalMode:'idle',familyDecisionType:'',familyNormalRoundId:'',familyNormalStage:0,familyNormalAutoResume:false,familyNormalVoteBusy:false,familyActiveData:null,familyVotedIds:new Set(),familyPollTimer:0,familyPollBusy:false,familyCompareBothMode:'',familyCompareBothGroupId:'',familyCompareBothMealWinner:null,familyBrowseHistory:[],
tutorialMode:false
};
const IMAGE_PROXY_HOSTS=new Set(['images.pexels.com','images.unsplash.com','commons.wikimedia.org','upload.wikimedia.org','thumb.wikimedia.org','static.wixstatic.com','static.spotapps.co','www.goodnes.com','hips.hearstapps.com','calliesbiscuits.com','vinovoss.com','www.southernliving.com','southernbite.com','snapcalorie-webflow-website.s3.us-east-2.amazonaws.com','butterhearth.com','slicelife.imgix.net','cdn.shopify.com','savouryflavor.com','resizer.otstatic.com','kookycrunch.com','cdn.apartmenttherapy.info','shop.barebells.com','b1880159.assetcdn.net','www.mybakingaddiction.com','a.fsimg.co.nz','ourstate.s3.amazonaws.com','whitneybond.com','thedailymeal.com','crockncle.com','www.africanbites.com','www.foodrepublic.com','shop.camelliabrand.com','parade.com','sweetasirem.com','www.sugardale.com','myhomemaderecipe.com','www.finedininglovers.com']);

const BUILTIN_MEAL_IMAGE_HOSTS=new Set(['images.pexels.com','images.unsplash.com']);
function isBuiltInMeal(item){
 const id=String(item?.id||'');
 return !!id&&getDefaultFoods().some(x=>String(x?.id||'')===id);
}
function isApprovedBuiltInMealImage(value){
 const src=normalizeMealPhotoRef(value);
 if(!/^https:\/\//i.test(src))return false;
 try{return BUILTIN_MEAL_IMAGE_HOSTS.has(new URL(src).hostname.toLowerCase());}catch{return false;}
}
function imageProxyUrl(raw){
 const src=String(raw||'');
 if(!/^https:\/\//i.test(src)||src.startsWith('/api/image?')||src.startsWith('data:')||src.startsWith('blob:'))return src;
 try{const u=new URL(src);if(!IMAGE_PROXY_HOSTS.has(u.hostname))return src;return '/api/image?url='+encodeURIComponent(u.href);}catch{return src;}
}
function mealImageUrl(raw){
 const src=normalizeMealPhotoRef(raw);
 if(!/^https:\/\//i.test(src))return src;
 if(src.startsWith('/api/image?'))return src.includes('meal=1')?src:src.replace('/api/image?','/api/image?meal=1&');
 try{
  const u=new URL(src);
  if(!IMAGE_PROXY_HOSTS.has(u.hostname))return src;
  return '/api/image?meal=1&url='+encodeURIComponent(u.href);
 }catch{return src;}
}
function normalizeMealPhotoRef(value){return String(value??'').trim();}
function dedupeMealPhotos(photos,max=8){
 const out=[],seen=new Set();
 for(const raw of Array.isArray(photos)?photos:[]){
  const ref=normalizeMealPhotoRef(raw);if(!ref||seen.has(ref))continue;
  seen.add(ref);out.push(ref);if(out.length>=max)break;
 }
 return out;
}
function mealPhotoList(item){
 const candidates=[];
 const add=(value)=>{
  const ref=normalizeMealPhotoRef(value);
  if(!ref)return;
  if(isBuiltInMeal(item)&&!isApprovedBuiltInMealImage(ref))return;
  candidates.push(ref);
 };
 add(item?.image);
 add(item?.backupImage);
 for(const ref of Array.isArray(item?.images)?item.images:[])add(ref);
 return dedupeMealPhotos(candidates,8);
}
function mealOfficialPhoto(item){
 const value=normalizeMealPhotoRef(item?.officialImage);
 if(!value||value.startsWith('idb:'))return '';
 if(isBuiltInMeal(item)&&!isApprovedBuiltInMealImage(value))return '';
 return value;
}
// CP1156 — built-in meal photos use only approved stable hosts; local data/blob references are not valid catalog photos.
function assertBuiltInMealPhotoPolicy(item){
 if(!item)return true;
 if(!isBuiltInMeal(item))return true;
 const refs=mealPhotoList(item);
 const official=mealOfficialPhoto(item);
 return [...(official?[official]:[]),...refs].every(ref=>isApprovedBuiltInMealImage(ref));
}
function foodPhoto(item){
 if(!item)return '';
 if(!assertBuiltInMealPhotoPolicy(item))return '';
 const official=mealOfficialPhoto(item);
 if(official)return mealImageUrl(official);
 const primary=normalizeMealPhotoRef(mealPhotoList(item)[0]);
 if(primary && !primary.startsWith('idb:'))return mealImageUrl(primary);
 return '';
}
function foodPhotoFallback(item){
 if(!item)return '';
 const official=mealOfficialPhoto(item);
 const refs=mealPhotoList(item);
 for(const ref of refs){
  const value=normalizeMealPhotoRef(ref);
  if(!value||value===official)continue;
  if(value.startsWith('idb:'))continue;
  return mealImageUrl(value);
 }
 return '';
}
async function resolveMealPhotoRef(ref,item=null){
 const value=normalizeMealPhotoRef(ref);if(!value)return '';
 if(value.startsWith('idb:')){const data=await getStoredPhoto(value.slice(4));return data||'';}
 return mealImageUrl(value);
}
async function hydrateMealPhotoGallery(item){
 const refs=mealPhotoList(item);if(!refs.length){
  const primary=foodPhoto(item);
  return primary?[primary]:[];
 }
 const loaded=[];
 for(const ref of refs){try{const src=await resolveMealPhotoRef(ref,item);if(src)loaded.push(src);}catch{}}
 return loaded;
}
function ensureMealCardPhotoPager(card,count,index){
 if(!card)return null;
 let pager=card.querySelector('.meal-card-photo-pager');
 if(count<=1){pager?.remove();return null;}
 if(!pager){
  pager=document.createElement('button');
  pager.type='button';
  pager.className='meal-card-photo-pager';
  pager.setAttribute('aria-label','View next meal photo');
  card.appendChild(pager);
 }
 pager.textContent=(index+1)+' / '+count;
 pager.title='View next photo';
 return pager;
}
function customQuickCutByName(label){
 const key=normKey(label);
 return (S.customQuickCuts||[]).find(x=>normKey(x?.name)===key)||null;
}
function customQuickCutImage(label){
 const item=customQuickCutByName(label),src=String(item?.image||'');
 if(src&&!src.startsWith('idb:'))return imageProxyUrl(src);
 return imageProxyUrl(QUICK_IMAGES.American);
}
function foodQuickImage(label){return QUICK_IMAGES[label]?imageProxyUrl(QUICK_IMAGES[label]):customQuickCutImage(label);}
const KNOWN_RESTAURANT_WEBSITES={
  "mcdonald's":'https://www.mcdonalds.com',"taco bell":'https://www.tacobell.com',"wendy's":'https://www.wendys.com',"the thirsty goat":'https://www.thirstygoatsango.com',"johnny's big burger":'https://thebigburger.com',"edward's steakhouse":'https://www.edwardssteakhouse.net',"shelbys trio":'https://www.toasttab.com/local/order/shelbys-trio-304-north-2nd-street',"sweet p's":'https://sweetpssouthernstyle.com',"sweet p's southern style":'https://sweetpssouthernstyle.com',"gray smoke barbecue":'https://graysmokebarbecue.com/',"gray smoke":'https://graysmokebarbecue.com/',"gray's smoke":'https://graysmokebarbecue.com/',"cap's neighborhood bar & grill":'https://capssangogrill.com/',"caps neighborhood bar & grill":'https://capssangogrill.com/',"caps neighborhood bar and grill":'https://capssangogrill.com/',"cap’s neighborhood bar & grill":'https://capssangogrill.com/',"burger king":'https://www.bk.com',"kfc":'https://www.kfc.com',"chick fil a":'https://www.chick-fil-a.com',"popeyes":'https://www.popeyes.com',"subway":'https://www.subway.com',"sonic":'https://www.sonicdrivein.com',"arby's":'https://www.arbys.com',"whataburger":'https://whataburger.com',"five guys":'https://www.fiveguys.com',"culver's":'https://www.culvers.com',"raising cane's":'https://www.raisingcanes.com',"wingstop":'https://www.wingstop.com',"bojangles":'https://www.bojangles.com',"cook out":'https://www.cookout.com',"dairy queen":'https://www.dairyqueen.com',"zaxby's":'https://www.zaxbys.com',"church's chicken":'https://www.churchs.com',"captain d's":'https://www.captainds.com',"long john silver's":'https://www.ljsilvers.com',"jimmy john's":'https://www.jimmyjohns.com',"jersey mike's":'https://www.jerseymikes.com',"firehouse subs":'https://www.firehousesubs.com',"little caesars":'https://littlecaesars.com',"domino's":'https://www.dominos.com',"papa john's":'https://www.papajohns.com',"pizza hut":'https://www.pizzahut.com',"marco's pizza":'https://www.marcos.com',"krystal":'https://www.krystal.com',"steak 'n shake":'https://www.steaknshake.com',"white castle":'https://www.whitecastle.com',"freddy's":'https://www.freddys.com',"panda express":'https://www.pandaexpress.com',"jack in the box":'https://www.jackinthebox.com',"hardee's":'https://www.hardees.com',"del taco":'https://www.deltaco.com',"checkers":'https://www.checkers.com',"rally's":'https://www.rallys.com',"chipotle":'https://www.chipotle.com',"applebee's":'https://www.applebees.com',"chili's":'https://www.chilis.com',"olive garden":'https://www.olivegarden.com',"waffle house":'https://www.wafflehouse.com'
};
function knownRestaurantWebsite(row){
 const name=normKey(row?.name),brand=normKey(row?.brand);
 for(const [key,url] of Object.entries(KNOWN_RESTAURANT_WEBSITES)){
  const k=normKey(key);
  if(name===k||name.includes(k)||brand===k||brand.includes(k))return url;
 }
 return '';
}
const restaurantWebsiteInflight=new Map();
const restaurantWebsiteCache=new Map();
const RESTAURANT_WEBSITE_CACHE_KEY='dinliminate.restaurant.websites.v1';
const RESTAURANT_WEBSITE_CACHE_TTL=14*24*60*60*1000;
function restaurantWebsiteRowKey(row){
 return normKey([row?.name,row?.address,row?.brand].filter(Boolean).join('|'));
}
function loadRestaurantWebsiteStore(){
 try{
  const raw=JSON.parse(localStorage.getItem(RESTAURANT_WEBSITE_CACHE_KEY)||'{}');
  const now=Date.now();
  for(const [key,value] of Object.entries(raw||{})){
   if(value&&now-Number(value.t||0)<RESTAURANT_WEBSITE_CACHE_TTL&&(typeof value.url==='string'||typeof value.officialPage==='string')){
    restaurantWebsiteCache.set(key,value);
   }
  }
 }catch{}
}
function saveRestaurantWebsiteStore(){
 try{
  const out={},now=Date.now();
  for(const [key,value] of restaurantWebsiteCache){
   if(value&&now-Number(value.t||0)<RESTAURANT_WEBSITE_CACHE_TTL)out[key]=value;
  }
  localStorage.setItem(RESTAURANT_WEBSITE_CACHE_KEY,JSON.stringify(out));
 }catch{}
}
loadRestaurantWebsiteStore();
function cachedRestaurantWebsiteEntry(row){
 const key=restaurantWebsiteRowKey(row),value=restaurantWebsiteCache.get(key);
 return value||null;
}
function cachedRestaurantWebsite(row){
 return cachedRestaurantWebsiteEntry(row)?.url||'';
}
function cachedRestaurantOfficialPage(row){
 return cachedRestaurantWebsiteEntry(row)?.officialPage||'';
}
function storeRestaurantWebsitePresence(row,presence){
 const key=restaurantWebsiteRowKey(row);
 if(!key||!presence)return;
 const url=safeExternalUrl(presence.website||'');
 const officialPage=safeExternalUrl(presence.officialPage||'')||String(presence.officialPage||'');
 if(!url&&!officialPage)return;
 restaurantWebsiteCache.set(key,{url,officialPage,t:Date.now(),source:String(presence.source||'')});
 saveRestaurantWebsiteStore();
}
function storeRestaurantWebsite(row,url,source=''){
 storeRestaurantWebsitePresence(row,{website:url,source});
}
function restaurantWebsiteDirect(row){
 const direct=safeExternalUrl(row?.website);
 if(direct)return direct;
 const known=knownRestaurantWebsite(row);
 if(known)return known;
 return cachedRestaurantWebsite(row);
}
function restaurantOfficialPageDirect(row){
 const page=cachedRestaurantOfficialPage(row);
 if(!page)return '';
 try{
  const u=new URL(page);
  const h=u.hostname.toLowerCase().replace(/^www\./,'');
  return ['facebook.com','instagram.com'].some(x=>h===x||h.endsWith('.'+x))?page:'';
 }catch{return ''}
}
function restaurantWebsitePresentation(row){
 const website=restaurantWebsiteDirect(row);
 if(website)return{url:website,kind:'website',source:'website'};
 const page=restaurantOfficialPageDirect(row);
 if(page)return{url:page,kind:'official-page',source:'official-page'};
 const q=[row?.name,row?.address].filter(Boolean).join(' ').trim();
 return{url:'https://www.google.com/search?q='+encodeURIComponent((q||'restaurant')+' restaurant website'),kind:'search',source:'search'};
}
function restaurantWebsiteUrl(row){
 return restaurantWebsitePresentation(row).url;
}
async function hydrateRestaurantWebsite(row,scope){
 if(!row)return;
 const key=restaurantWebsiteRowKey(row);
 if(!key)return;
 const apply=(presence)=>{
  const data=presence||{};
  const website=safeExternalUrl(data.website||'');
  const page=safeExternalUrl(data.officialPage||'')||String(data.officialPage||'');
  const chosen=website?{url:website,kind:'website'}:(page?{url:page,kind:'official-page'}:{url:restaurantWebsitePresentation(row).url,kind:'search'});
  document.querySelectorAll((scope||'')+' [data-restaurant-website-key]').forEach(link=>{
   if(link.dataset.restaurantWebsiteKey!==key)return;
   link.href=chosen.url;
   link.target='_blank';
   link.rel='noopener noreferrer';
   const label=chosen.kind==='website'?'Website':(chosen.kind==='official-page'?'Official Page':'Search Website');
   link.title=label;
   link.dataset.restaurantWebsiteSource=String(data.source||chosen.kind);
   link.setAttribute('aria-label',chosen.kind==='website'?'Open '+String(row.name||'restaurant')+' website':chosen.kind==='official-page'?'Open the official Facebook or Instagram page for '+String(row.name||'restaurant'):'Search '+String(row.name||'restaurant')+' website');
  });
 };
 const direct=restaurantWebsiteDirect(row);
 if(direct){
  storeRestaurantWebsite(row,direct,'direct');
  apply({website:direct,source:'direct'});
  return direct;
 }
 const cached=cachedRestaurantWebsite(row);
 if(cached){
  row.website=cached;
  apply({website:cached,source:'cached'});
  return cached;
 }
 const cachedPage=restaurantOfficialPageDirect(row);
 if(cachedPage){
  apply({officialPage:cachedPage,source:'cached-official-page'});
  return cachedPage;
 }
 let pending=restaurantWebsiteInflight.get(key);
 if(!pending){
  const params=new URLSearchParams({
   mode:'website',
   name:String(row.name||''),
   address:String(row.address||''),
   brand:String(row.brand||''),
   website:String(row.website||''),
   phone:String(row.phone||row.nationalPhoneNumber||row['contact:phone']||'')
  });
  pending=(async()=>{
   const response=await fetch('/api/restaurants?'+params.toString(),{cache:'no-store'});
   if(!response.ok)throw new Error('Website resolver unavailable');
   const data=await response.json();
   const website=safeExternalUrl(data?.website);
   const officialPage=safeExternalUrl(data?.officialPage);
   if(website||officialPage){
    row.website=website||row.website||'';
    storeRestaurantWebsitePresence(row,{website,officialPage,source:String(data?.source||'official-search')});
   }
   return{website,officialPage,source:String(data?.source||'official-search')};
  })().finally(()=>restaurantWebsiteInflight.delete(key));
  restaurantWebsiteInflight.set(key,pending);
 }
 try{
  const presence=await pending;
  apply(presence);
  return presence.website||presence.officialPage||'';
 }catch{
  apply({});
  return '';
 }
}

async function hydrateRestaurantDetails(row,modal){
 if(!row||!modal||!row.googlePlaceId)return;
 const params=new URLSearchParams({
  mode:'details',
  placeId:String(row.googlePlaceId),
  name:String(row.name||''),
  address:String(row.address||''),
  phone:String(row.phone||row.nationalPhoneNumber||row['contact:phone']||''),
  website:String(row.website||'')
});
 try{
  const response=await fetch('/api/restaurants?'+params.toString(),{cache:'no-store'});
  if(!response.ok)return;
  const data=await response.json();
  if(!data?.ok)return;
  if(data.name && row.name && normKey(data.name)!==normKey(row.name))return;
  if(data.address)row.address=data.address;
  if(data.phone)row.phone=data.phone;
  if(data.website){
   const website=safeExternalUrl(data.website);
   if(website)row.website=website;
  }
  if(data.opening_hours)row.opening_hours=data.opening_hours;
  if(typeof data.openNow==='boolean')row.openNow=data.openNow;
  if(data.businessStatus)row.businessStatus=data.businessStatus;
  const hoursSection=modal.querySelector('#restaurantDetailHours');
  const hoursText=modal.querySelector('#restaurantDetailHoursText');
  if(hoursText&&data.opening_hours)hoursText.textContent=String(data.opening_hours);
  if(hoursSection&&data.opening_hours)hoursSection.classList.remove('hidden');
  const phoneLink=modal.querySelector('#restaurantDetailPhone');
  const phoneLabel=modal.querySelector('#restaurantDetailPhoneLabel');
  if(phoneLink&&data.phone){
   phoneLink.href=phoneHref(data.phone);
   phoneLink.target='';
   phoneLink.rel='';
  }
  if(phoneLabel&&data.phone)phoneLabel.textContent=String(data.phone);
  const websiteLink=modal.querySelector('#restaurantDetailWebsite');
  if(websiteLink&&row.website){
   const url=safeExternalUrl(row.website);
   if(url){
    websiteLink.href=url;
    websiteLink.title='Website';
    websiteLink.setAttribute('aria-label','Open '+String(row.name||'restaurant')+' website');
   }
  }
 }catch{}
}
function restaurantPhoneSearchUrl(row){
 const q=[row?.name,row?.address].filter(Boolean).join(' ').trim();
 return 'https://www.google.com/search?q='+encodeURIComponent((q||'restaurant')+' phone number');
}
function restaurantDirectionsUrl(row){
const lat=Number(row?.lat),lon=Number(row?.lon);
const destination=Number.isFinite(lat)&&Number.isFinite(lon)?lat+','+lon:(row?.address||row?.name||'restaurant');
return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(destination);
}
const FINAL_FOOD_IMAGE='./fallback-food.svg';
const FINAL_RESTAURANT_IMAGE='./fallback-restaurant.svg';
function markMealImageUnavailable(img){
 if(!img)return;
 img.dataset.imageFallback='true';
 const final=String(img.dataset.finalFallback||FINAL_FOOD_IMAGE||'').trim();
 if(final && String(img.currentSrc||img.src||'')!==final){img.src=final;}
 img.style.visibility='visible';
}
function bindImageFallbackAttrs(selector){
 document.querySelectorAll(selector).forEach(img=>{
  img.referrerPolicy='no-referrer';img.loading='eager';
  const final=img.dataset.finalFallback||FINAL_FOOD_IMAGE;
  img.addEventListener('error',()=>{
   const fallback=img.dataset.fallback||'',current=img.currentSrc||img.src;
   if(fallback&&current!==fallback){img.src=fallback;return;}
   if(final&&current!==final){img.dataset.imageFallback='true';img.src=final;return;}
   markMealImageUnavailable(img);
  });
 });
}
function bindImageFallback(selector,fallback,finalFallback=FINAL_RESTAURANT_IMAGE){
 document.querySelectorAll(selector).forEach(img=>{
  img.referrerPolicy='no-referrer';img.loading='eager';img.dataset.fallback=img.dataset.fallback||fallback;
  const final=img.dataset.finalFallback||finalFallback;
  img.addEventListener('error',()=>{
   const fb=img.dataset.fallback||'',current=img.currentSrc||img.src;
   if(fb&&current!==fb){img.src=fb;return;}
   if(final&&current!==final){img.dataset.imageFallback='true';img.src=final;return;}
   img.dataset.imageFallback='true';
  });
 });
}
function swapImageWhenReady(img,url){
 if(!img||!url||!img.isConnected)return Promise.resolve(false);
 const nextUrl=String(url);
 const current=img.currentSrc||img.src||'';
 if(current===nextUrl)return Promise.resolve(true);
 return new Promise(resolve=>{
  const probe=new Image();
  probe.decoding='async';
  let settled=false;
  const finish=ok=>{if(settled)return;settled=true;resolve(!!ok);};
  probe.onload=()=>{if(img.isConnected)img.src=nextUrl;finish(true);};
  probe.onerror=()=>finish(false);
  probe.src=nextUrl;
 });
}
function loadMealPhotoCandidates(img,candidates,target){
 const list=[];
 for(const raw of Array.isArray(candidates)?candidates:[]){
  const url=String(raw||'').trim();
  if(!url||url===FINAL_FOOD_IMAGE||list.includes(url))continue;
  list.push(url);
 }
 if(!img||!target||!list.length)return Promise.resolve(false);
 const token=String(target.dataset.mealLoadToken||'');
 const mealId=String(target.dataset.mealId||'');
 const stillCurrent=()=>img.isConnected&&target.isConnected
  &&String(target.dataset.mealLoadToken||'')===token
  &&String(target.dataset.mealId||'')===mealId;
 let index=0;
 const attempt=()=>{
  if(index>=list.length||!stillCurrent())return Promise.resolve(false);
  const url=list[index++];
  return new Promise(resolve=>{
   const probe=new Image();
   probe.decoding='async';
   probe.referrerPolicy='no-referrer';
   let settled=false;
   const finish=ok=>{if(settled)return;settled=true;resolve(!!ok);};
   probe.onload=async()=>{
    try{await probe.decode?.();}catch{}
    if(!stillCurrent()){finish(false);return;}
    img.src=url;
    img.style.visibility='visible';
    img.dataset.imageFallback='false';
    target.dataset.foodImageSource=url;
    finish(true);
   };
   probe.onerror=()=>{attempt().then(finish);};
   try{probe.src=url;}catch{attempt().then(finish);}
  });
 };
 return attempt();
}
const restaurantPhotoInflight=new Map();
const restaurantPhotoCache=new Map();
const restaurantPhotoMissCache=new Map();
const RESTAURANT_PHOTO_MEMORY_CACHE_MAX=18;
function trimRestaurantPhotoMemoryCache(){
 if(restaurantPhotoCache.size<=RESTAURANT_PHOTO_MEMORY_CACHE_MAX)return;
 const protectedKeys=new Set(
  [...document.querySelectorAll('img[data-restaurant-photo-key]')]
   .map(img=>String(img.dataset.restaurantPhotoKey||'').trim())
   .filter(Boolean)
 );
 const candidates=[...restaurantPhotoCache.entries()]
  .filter(([key])=>!protectedKeys.has(key))
  .sort((a,b)=>Number(a[1]?.lastUsedAt||0)-Number(b[1]?.lastUsedAt||0));
 while(restaurantPhotoCache.size>RESTAURANT_PHOTO_MEMORY_CACHE_MAX&&candidates.length){
  const [key,data]=candidates.shift();
  if(!restaurantPhotoCache.delete(key))continue;
  const url=String(data?.url||'');
  if(url.startsWith('blob:')){
   try{URL.revokeObjectURL(url);}catch{}
  }
 }
}
function touchRestaurantPhotoMemoryCache(rowKey,data){
 if(!rowKey||!data)return data;
 data.lastUsedAt=Date.now();
 restaurantPhotoCache.set(rowKey,data);
 trimRestaurantPhotoMemoryCache();
 return data;
}
const RESTAURANT_PHOTO_MISS_TTL=15*60*1000;
const RESTAURANT_PHOTO_RESOLVER_VERSION='1007';
const RESTAURANT_PHOTO_CACHE_NAME='dinliminate.restaurant.photos.v8';
const RESTAURANT_PHOTO_CACHE_MAX_AGE=14*24*60*60*1000;
const RESTAURANT_PHOTO_PREFETCH_COUNT=4;
const RESTAURANT_PHOTO_FIRST_PAINT_TIMEOUT=1600;
const RESTAURANT_PHOTO_NEAR_READY_TIMEOUT=650;
const RESTAURANT_NEUTRAL_IMAGE='./fallback-restaurant.svg';
const RESTAURANT_PHOTO_HANDOFF_WAIT=950;
let restaurantPhotoStoragePromise=null;
function restaurantPhotoCacheRequest(row){
 const identity=normKey(['v'+RESTAURANT_PHOTO_RESOLVER_VERSION,row?.name,row?.address].filter(Boolean).join('|'))||String(row?.id||row?.canonicalId||'unknown');
 let hash=2166136261;
 for(let i=0;i<identity.length;i++){hash^=identity.charCodeAt(i);hash=Math.imul(hash,16777619);}
 return new Request('/__dinliminate_restaurant_photo_cache__/'+(hash>>>0).toString(36));
}
async function openRestaurantPhotoCache(){
 if(!('caches' in window))return null;
 if(restaurantPhotoStoragePromise)return restaurantPhotoStoragePromise;
 restaurantPhotoStoragePromise=caches.open(RESTAURANT_PHOTO_CACHE_NAME).catch(()=>null);
 return restaurantPhotoStoragePromise;
}
function restaurantPhotoDataFromCachedResponse(response){
 if(!response)return null;
 const cachedAt=Number(response.headers.get('X-Dinliminate-Cached-At')||0);
 if(cachedAt && Date.now()-cachedAt>RESTAURANT_PHOTO_CACHE_MAX_AGE)return null;
 return response.blob().then(blob=>{
  if(!blob.type.startsWith('image/'))return null;
  return {
   url:URL.createObjectURL(blob),
   attributions:decodePhotoAttributions(response.headers.get('X-Restaurant-Photo-Attributions')),
   source:String(response.headers.get('X-Restaurant-Photo-Source')||'').trim(),
   sourceUrl:String(response.headers.get('X-Restaurant-Photo-Source-URL')||'').trim()
  };
 }).catch(()=>null);
}
async function getPersistentRestaurantPhoto(row){
 try{
  const cache=await openRestaurantPhotoCache();
  if(!cache)return null;
  const request=restaurantPhotoCacheRequest(row);
  const cached=await cache.match(request);
  if(!cached)return null;
  const data=await restaurantPhotoDataFromCachedResponse(cached);
  if(data)return data;
  await cache.delete(request);
 }catch{}
 return null;
}
async function putPersistentRestaurantPhoto(row,blob,attributions,source,sourceUrl){
 try{
  if(String(source||'').trim()==='google-places')return;
  const cache=await openRestaurantPhotoCache();
  if(!cache)return;
  const request=restaurantPhotoCacheRequest(row);
  const headers=new Headers({'Content-Type':blob.type||'image/jpeg','X-Dinliminate-Cached-At':String(Date.now()),'X-Restaurant-Photo-Source':String(source||'')});
  if(sourceUrl)headers.set('X-Restaurant-Photo-Source-URL',String(sourceUrl));
  if(attributions?.length){
   const raw=JSON.stringify(attributions);
   const bytes=new TextEncoder().encode(raw); let binary=''; for(const byte of bytes)binary+=String.fromCharCode(byte); let encoded=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
   headers.set('X-Restaurant-Photo-Attributions',encoded);
  }
  await cache.put(request,new Response(blob,{status:200,headers}));
 }catch{}
}
const KNOWN_RESTAURANT_PHOTO_FALLBACKS=[
 {names:["sweet p's southern style","sweet ps southern style"],url:"https://static.where-e.com/United_States/Tennessee/Sweet-Ps-Southern-Style_8c41d09a14d942d0ca25ab6076d3f05e.jpg"},
 {names:["gray smoke barbecue","gray smoke","gray's smoke"],url:"https://du9m0k402rjmo.cloudfront.net/images/P_23585/90a3488a-0fdb-47fa-9c6d-e76837ebc263.jpg"},
 {names:["cap's neighborhood bar & grill","caps neighborhood bar & grill","caps neighborhood bar and grill"],url:"https://clarksvillenow.sagacom.com/files/2024/05/CAPS-Neighborhood-Bar-Grill-7.jpg"},
 {names:["Reggie's BBQ","Reggie's BBQ Clarksville"],url:"https://d1w7312wesee68.cloudfront.net/XqjMLj3K3JQ1LOypRViqpaLKzbu0dXfv_cQwp2AxpXk/ext%3Awebp/quality%3A85/plain/s3%3A//toast-sites-resources-prod/restaurantImages/263daf0a-e243-4425-8d8a-9b75cbf93056/82d46202-8e46-4a18-9858-9ca3d930ca93-19"},
 {names:["Legends Smokehouse & Grill","Legends Smokehouse and Grill","Legends Smokehouse"],url:"https://5dee1204fff7f466a182.cdn6.editmysite.com/uploads/b/5dee1204fff7f466a182a4e6fe08b0edea7ec96d54c794955f8198991dae5da6/Untitled%20design%282%29_1713398838.png?optimize=medium&width=2400"},
 {names:["Johnny's Big Burger","Johnnys Big Burger"],url:"https://thebigburger.com/__l5e/assets-v1/3211c7e6-0473-4028-b8d0-db085ca4a369/frontpage.jpg"},
 {names:["Blackhorse Pub & Brewery","Blackhorse Pub and Brewery","Blackhorse"],url:"https://assets.site-static.com/userFiles/2147/image/Mark/Compress_Images_Special_Project/The%20Blackhorse%20Pub%20Brewery%2C%20TN.jpg"},
 {names:["Pbody's","Pbodys"],url:"https://img.p.mapq.st/?q=75&url=https%3A%2F%2Fmedia-cdn.tripadvisor.com%2Fmedia%2Fphoto-o%2F07%2F11%2Fa6%2F80%2Fpbody-s.jpg&w=3840"},
 {names:["The Catfish House","Catfish House"],url:"https://static.wixstatic.com/media/568437_1b8e1db53bfa4086b85fad232d3b91f4~mv2.jpg/v1/fill/w_960%2Ch_460%2Cal_c%2Cq_85%2Cenc_avif%2Cquality_auto/568437_1b8e1db53bfa4086b85fad232d3b91f4~mv2.jpg"},
 {names:["Liberty Park Grill"],url:"https://photos.smugmug.com/USA/Tennessee/Clarksville/i-L9DVxSZ/0/92fe32e8/L/ClarksvilleTN-369-L.jpg"},
 {names:["Cafe 931","Café 931"],url:"https://pub-ba1a74be17d7442a9f2541946eb9510e.r2.dev/shops/1f9865fb-9f52-490e-8c41-377ec5adab87/0.jpg"},
 {names:["Yada on Franklin","Yada"],url:"https://static.spotapps.co/spots/cd/9f903fe2ff4bd0b72d4439b91d8d95/full"},
 {names:["The Mailroom","Mailroom"],url:"https://images.squarespace-cdn.com/content/v1/6772c0e3152fba51d1e9cea1/1735573738359-OFYKQZMLW8GCX7TIKR0Q/Mailroom-Featured-Image-Header.jpg"},
 {names:["Silke's Old World Breads","Silkes Old World Breads","Silke's"],url:"https://silkesoldworldbreads.com/cdn/shop/files/outside_whole_bldg_for_web.jpg?v=1631571846&width=3840"},
 {names:["Casa D'Italia","Casa D’Italia","Casa D Italia","Casa D'Italia Ristorante"],url:"https://static.goto-where.com/70162-albums-1.jpg"}
];
function knownRestaurantPhotoFallback(row){
 const normalized=normKey(row?.name);
 if(!normalized)return '';
 const hit=KNOWN_RESTAURANT_PHOTO_FALLBACKS.find(entry=>entry.names.some(n=>{
  const key=normKey(n);
  return normalized===key||normalized.includes(key)||key.includes(normalized);
 }));
 return hit?.url||'';
}
function restaurantFallbackImage(row){
 const known=knownRestaurantPhotoFallback(row);
 return known||'';
}
function restaurantPhotoEndpointUrl(row){
 if(!row)return '';
 const params=new URLSearchParams();
 if(row.name)params.set('name',String(row.name));
 if(row.address)params.set('address',String(row.address));
 if(row.phone)params.set('phone',String(row.phone));
 const website=safeExternalUrl(row.website);
 if(website)params.set('website',website);
 const officialLocationPage=safeExternalUrl(row.officialLocationPage||row.officialLocation||'');
 if(officialLocationPage)params.set('officialLocationPage',officialLocationPage);
 const officialWebsite=website||safeExternalUrl(knownRestaurantWebsite(row));
 if(officialWebsite)params.set('officialWebsite',officialWebsite);
 const source=String(row.source||'');
 const osmPhoto=safeExternalUrl(row.photo);
 if(source.startsWith('OpenStreetMap')&&osmPhoto){
  params.set('osmExact','1');
  params.set('osmImage',osmPhoto);
 }
 if(row.googlePlaceId)params.set('placeId',String(row.googlePlaceId));
 if(Number.isFinite(Number(row.lat)))params.set('lat',String(row.lat));
 if(Number.isFinite(Number(row.lon)))params.set('lon',String(row.lon));
 params.set('resolver',RESTAURANT_PHOTO_RESOLVER_VERSION);
 return '/api/restaurant-photo?'+params.toString();
}
function restaurantImmediatePhoto(row){
 if(!row)return '';
 const rowKey=String(row?.id||row?.canonicalId||'').trim();
 const cached=rowKey?restaurantPhotoCache.get(rowKey):null;
 return cached?.url ? touchRestaurantPhotoMemoryCache(rowKey,cached).url : '';
}
function restaurantCardFallbackImage(){return '';}

function decodePhotoAttributions(raw){
 const value=String(raw||'').trim();if(!value)return[];
 try{
  let b64=value.replace(/-/g,'+').replace(/_/g,'/');while(b64.length%4)b64+='=';
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const data=JSON.parse(new TextDecoder().decode(bytes));
  return Array.isArray(data)?data.filter(x=>x&&x.displayName&&x.uri).slice(0,5):[]
 }catch{return[]}
}
function setRestaurantPhotoCredit(card,attributions,source,sourceUrl){
 const credit=card?.querySelector('.restaurant-photo-credit');if(!credit)return;
 const photoSource=String(source||'').trim().toLowerCase();
 const safeUrl=safeExternalUrl(sourceUrl||'');
 const safe=(attributions||[]).map(x=>({name:String(x.displayName||''),uri:safeExternalUrl(x.uri)})).filter(x=>x.name&&x.uri).slice(0,5);
 let html='';
 if(photoSource==='google-places'){
  const googleLink=safeUrl||safe.find(x=>x.name.toLowerCase()==='google')?.uri||'https://www.google.com/maps';
  const author=safe.filter(x=>x.name.toLowerCase()!=='google');
  html='Photo from <a href="'+esc(googleLink)+'" target="_blank" rel="noopener noreferrer">Google</a>';
  if(author.length)html+=' · Photo by '+author.map(x=>'<a href="'+esc(x.uri)+'" target="_blank" rel="noopener noreferrer">'+esc(x.name)+'</a>').join(', ');
 }else if(/^official-/.test(photoSource)){
  html=safeUrl
   ? 'Photo from <a href="'+esc(safeUrl)+'" target="_blank" rel="noopener noreferrer">Restaurant Website</a>'
   : 'Photo from Restaurant Website';
 }else if(safe.length){
  html='Photo from '+safe.map(x=>'<a href="'+esc(x.uri)+'" target="_blank" rel="noopener noreferrer">'+esc(x.name)+'</a>').join(', ');
 }else{
  credit.textContent='';credit.classList.remove('is-visible');return;
 }
 credit.innerHTML=html;
 credit.classList.add('is-visible');
}
async function loadRestaurantPhoto(row){
 if(!row)return null;
 const rowKey=String(row.id||row.canonicalId||'').trim();
 if(!rowKey)return null;
 const cacheHit=restaurantPhotoCache.get(rowKey);
 if(cacheHit?.url)return touchRestaurantPhotoMemoryCache(rowKey,cacheHit);
 const missAt=Number(restaurantPhotoMissCache.get(rowKey)||0);
 if(missAt&&Date.now()-missAt<RESTAURANT_PHOTO_MISS_TTL)return null;
 let pending=restaurantPhotoInflight.get(rowKey);
 if(!pending){
  const requestUrl=restaurantPhotoEndpointUrl(row);
  pending=(async()=>{
   const stored=await getPersistentRestaurantPhoto(row);
   if(stored)return stored;
   const res=await fetch(requestUrl,{cache:'no-store'});
   if(!res.ok){
    restaurantPhotoMissCache.set(rowKey,Date.now());
    throw new Error('Restaurant photo unavailable');
   }
   const blob=await res.blob();
   if(!blob.type.startsWith('image/')){
    restaurantPhotoMissCache.set(rowKey,Date.now());
    throw new Error('Restaurant photo response was not an image');
   }
   const attributions=decodePhotoAttributions(res.headers.get('X-Restaurant-Photo-Attributions'));
   const sourceName=String(res.headers.get('X-Restaurant-Photo-Source')||'').trim();
   const sourceUrl=String(res.headers.get('X-Restaurant-Photo-Source-URL')||'').trim();
   await putPersistentRestaurantPhoto(row,blob,attributions,sourceName,sourceUrl);
   return {url:URL.createObjectURL(blob),attributions,source:sourceName,sourceUrl};
  })().then(data=>{
   touchRestaurantPhotoMemoryCache(rowKey,data);
   restaurantPhotoMissCache.delete(rowKey);
   if(data.source)row.photoSource=data.source;
   if(data.sourceUrl)row.photoSourceUrl=data.sourceUrl;
   return data;
  }).finally(()=>restaurantPhotoInflight.delete(rowKey));
  restaurantPhotoInflight.set(rowKey,pending);
 }
 try{return await pending;}catch{return null;}
}
async function hydrateRestaurantPhoto(row,scope){
 if(!row)return;
 const rowKey=String(row.id||row.canonicalId||'').trim();
 if(!rowKey)return;
 const imgs=[...document.querySelectorAll(scope+' img[data-restaurant-photo-key]')].filter(img=>img.dataset.restaurantPhotoKey===rowKey);
 if(!imgs.length)return;
 const data=await loadRestaurantPhoto(row);
 if(!data?.url)return;
 imgs.forEach(async img=>{
  if(!img.isConnected)return;
  const card=img.closest('.next-card');
  // A promoted Restaurant layer owns its current photo identity until handoff finishes.
  if(card?.dataset.swipePromoted==='1'&&card.dataset.restaurantPhotoCanonical!=='1')return;
  const swapped=await swapImageWhenReady(img,data.url);
  if(swapped){
   img.dataset.restaurantPhotoLoaded='true';
   if(card)card.dataset.restaurantPhotoCanonical='1';
   setRestaurantPhotoCredit(img.closest('.card,.restaurant-detail-hero')||img.parentElement,data.attributions,data.source,data.sourceUrl);
  }
 });
}

async function waitForRestaurantPhotoDecoded(url,timeoutMs=2500){
 const src=String(url||'').trim();
 if(!src)return false;
 return await new Promise(resolve=>{
  const img=new Image();
  img.decoding='async';
  let done=false,timer=0;
  const finish=ok=>{
   if(done)return;
   done=true;
   clearTimeout(timer);
   img.onload=img.onerror=null;
   resolve(!!ok);
  };
  img.onload=()=>{
   const decoded=typeof img.decode==='function'?img.decode():Promise.resolve();
   Promise.resolve(decoded).catch(()=>{}).then(()=>finish(img.naturalWidth>0&&img.naturalHeight>0));
  };
  img.onerror=()=>finish(false);
  timer=window.setTimeout(()=>finish(img.complete&&img.naturalWidth>0&&img.naturalHeight>0),timeoutMs);
  img.src=src;
  if(img.complete&&img.naturalWidth>0){
   const decoded=typeof img.decode==='function'?img.decode():Promise.resolve();
   Promise.resolve(decoded).catch(()=>{}).then(()=>finish(img.naturalWidth>0&&img.naturalHeight>0));
  }
 });
}

async function prepareRestaurantPhotoDeck(rows,startIndex=0,needed=RESTAURANT_PHOTO_PREFETCH_COUNT+1){
 const source=Array.isArray(rows)?rows:[];
 if(!source.length||navigator.onLine===false)return {firstId:'',readyIds:[]};

 // CP1214: photo readiness must never remove a restaurant from the
 // decision pool or change the ALL/MAYBES count. Keep media failures as
 // presentation state only, while the choice pool remains filter-driven.
 const basePool=()=>restaurantPoolFiltered();
 const candidates=()=>basePool().filter(row=>!row._photoUnavailable);
 let cursor=Math.max(0,Math.min(Number(startIndex)||0,Math.max(0,source.length-1)));
 const readyIds=[];
 const tried=new Set();
 let safety=0;

 while(readyIds.length<needed&&safety<source.length+needed+8){
  const pool=candidates();
  if(!pool.length)break;

  let nextIndex=-1;
  for(let i=Math.max(0,Math.min(cursor,pool.length-1));i<pool.length;i++){
   if(!tried.has(String(pool[i]?.id||''))){nextIndex=i;break;}
  }
  if(nextIndex<0){
   for(let i=0;i<Math.min(cursor,pool.length);i++){
    if(!tried.has(String(pool[i]?.id||''))){nextIndex=i;break;}
   }
  }
  if(nextIndex<0)break;

  const row=pool[nextIndex];
  tried.add(String(row?.id||''));
  const data=await loadRestaurantPhoto(row).catch(()=>null);
  const ok=!!data?.url&&await waitForRestaurantPhotoDecoded(data.url);
  if(ok)readyIds.push(row.id);
  else{
   row._photoUnavailable=true;
   row._photoUnavailableAt=Date.now();
  }

  cursor=nextIndex+1;
  safety++;
 }

 const currentPool=basePool();
 const first=currentPool.find(row=>readyIds.includes(row.id));
 return {firstId:String(first?.id||''),readyIds};
}
async function primeRestaurantPhotosBeforeFirstPaint(rows,startIndex=0){
 const pool=Array.isArray(rows)?rows:[];
 if(navigator.onLine===false)return;
 const targets=[];
 for(let offset=0;offset<=RESTAURANT_PHOTO_PREFETCH_COUNT;offset++){
  const row=pool[startIndex+offset];
  if(row)targets.push(row);
 }
 if(!targets.length)return;
 const promises=targets.map(row=>loadRestaurantPhoto(row).catch(()=>null));
 const started=Date.now();
 try{
  await Promise.race([
   promises[0],
   new Promise(resolve=>window.setTimeout(resolve,RESTAURANT_PHOTO_FIRST_PAINT_TIMEOUT))
  ]);
  const elapsed=Date.now()-started;
  const remaining=Math.max(0,RESTAURANT_PHOTO_NEAR_READY_TIMEOUT-Math.max(0,elapsed));
  if(promises[1]&&remaining>0){
   await Promise.race([
    promises[1],
    new Promise(resolve=>window.setTimeout(resolve,remaining))
   ]);
  }
 }catch{}
}

let restaurantPhotoPrefetchTimer=0;
let restaurantPhotoPrefetchToken=0;
function prefetchRestaurantPhotos(rows,startIndex,count=RESTAURANT_PHOTO_PREFETCH_COUNT){
 const pool=Array.isArray(rows)?rows:[];
 if(navigator.onLine===false)return;
 const targets=[];
 for(let offset=1;offset<=count;offset++){
  const row=pool[startIndex+offset];
  if(row)targets.push(row);
 }
 if(!targets.length)return;
 const token=++restaurantPhotoPrefetchToken;
 if(restaurantPhotoPrefetchTimer){
  clearTimeout(restaurantPhotoPrefetchTimer);
  restaurantPhotoPrefetchTimer=0;
 }
 restaurantPhotoPrefetchTimer=window.setTimeout(()=>{
  restaurantPhotoPrefetchTimer=0;
  if(token!==restaurantPhotoPrefetchToken)return;
  targets.forEach(row=>{loadRestaurantPhoto(row).catch(()=>{});});
 },0);
}

function phoneHref(raw){
 const digits=String(raw||'').replace(/[^+0-9]/g,'');
 if(/^\+/.test(digits))return 'tel:'+digits;
 if(/^1\d{10}$/.test(digits))return 'tel:+'+digits;
 if(/^\d{10}$/.test(digits))return 'tel:+1'+digits;
 return digits?'tel:'+digits:'';
}
function safeExternalUrl(raw){
 try{
  const u=new URL(String(raw||''),location.origin);
  if(u.protocol!=='https:')return '';
  const host=u.hostname.toLowerCase(),current=String(location.hostname||'').toLowerCase();
  const appBrandHost=/(^|[.-])(?:dinliminate|diliminate)([.-]|$)/i.test(host);
  if(host===current||appBrandHost)return '';
  return u.href;
 }catch{return '';}
}
const normKey=(v)=>String(v??'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const removeAllById = (id) => document.querySelectorAll('#'+id).forEach(el => el.remove());
const removeFoodOverlays = () => ['manageFoodsModal','manageFoodsModalBg','foodEditorModal','foodEditorModalBg'].forEach(removeAllById);
const uniq = (a) => [...new Map((a || []).filter(Boolean).map(x => [String(x.id || x.name), x])).values()];
const allFoods = () => {
 const defaults=getDefaultFoods();
 const defaultIds=new Set(defaults.map(x=>String(x.id)));
 const deletedIds=S.deleted||new Set();
 const overrides=new Map((S.custom||[]).map(x=>[String(x.id),x]));
 const merged=defaults.filter(item=>!deletedIds.has(String(item.id))).map(item=>{
  const override=overrides.get(String(item.id));
  if(!override)return item;
  return Object.assign({},item,override,{builtInEdit:true,builtInId:String(item.id),quickCuts:Array.isArray(override.quickCuts)&&override.quickCuts.length?override.quickCuts:[override.category||item.category||'American'],mealTimes:mealTimesFor(override)});
 });
 const customOnly=S.custom.filter(x=>!defaultIds.has(String(x.id))&&!deletedIds.has(String(x.id))).map(x=>Object.assign({},x,{quickCuts:Array.isArray(x.quickCuts)&&x.quickCuts.length?x.quickCuts:[x.category||'American'],mealTimes:mealTimesFor(x)}));
 return merged.concat(customOnly);
};
const STORAGE_VERSION = 6;
const ITEM_NOTES_KEY = 'dinliminate.item.notes.v1';
function loadItemNotes(){
 try{
  const raw=JSON.parse(localStorage.getItem(ITEM_NOTES_KEY)||'{}');
  S.notes=(raw&&typeof raw==='object'&&!Array.isArray(raw))?raw:{};
 }catch{S.notes={};}
}
function saveItemNotes(){
 try{
  const clean={};
  Object.entries(S.notes||{}).forEach(([key,value])=>{
   const note=String(value??'').trim();
   if(note)clean[key]=note.slice(0,1200);
  });
  S.notes=clean;
  localStorage.setItem(ITEM_NOTES_KEY,JSON.stringify(clean));
  return true;
 }catch{return false;}
}
function itemNoteKey(item,type){
 if(type==='restaurant'){
  return 'restaurant:'+String(item?.canonicalId||restaurantCanonicalId(item)||item?.id||'unknown');
 }
 const directId=String(item?.sourceItemId||'').trim();
 if(directId)return 'food:'+directId;
 const found=allFoods().find(x=>normKey(x?.name)===normKey(item?.name));
 return 'food:'+String(found?.id||item?.id||item?.name||'unknown');
}
function itemNote(item,type){return String((S.notes||{})[itemNoteKey(item,type)]||'').trim();}
function setItemNote(item,type,note){
 const key=itemNoteKey(item,type),value=String(note??'').trim();
 if(value)S.notes[key]=value.slice(0,1200);else delete S.notes[key];
 saveItemNotes();
}
const PHOTO_DB_NAME = 'dinliminate.photos';
const PHOTO_STORE = 'images';
let photoDbPromise = null;
const storedPhotoIds = new Set();
function openPhotoDB() {
if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB unavailable'));
if (photoDbPromise) return photoDbPromise;
photoDbPromise = new Promise((resolve,reject) => {
const req = indexedDB.open(PHOTO_DB_NAME,1);
req.onupgradeneeded = () => {
if (!req.result.objectStoreNames.contains(PHOTO_STORE)) req.result.createObjectStore(PHOTO_STORE);
};
req.onsuccess = () => resolve(req.result);
req.onerror = () => reject(req.error || new Error('Could not open photo storage'));
});
return photoDbPromise;
}
async function putStoredPhoto(id,data) {
try {
const db=await openPhotoDB();
await new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readwrite');tx.objectStore(PHOTO_STORE).put(data,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not save photo'));});
storedPhotoIds.add(id); return true;
} catch { return false; }
}
async function getStoredPhoto(id) {
try {
const db=await openPhotoDB();
return await new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readonly');const req=tx.objectStore(PHOTO_STORE).get(id);req.onsuccess=()=>resolve(req.result||'');req.onerror=()=>reject(req.error||new Error('Could not read photo'));});
} catch { return ''; }
}
async function deleteStoredPhoto(id) {
try {
const db=await openPhotoDB();
await new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readwrite');tx.objectStore(PHOTO_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not delete photo'));});
} catch {}
}
function mealPhotoStorageKey(id,index=0){return index===0?String(id):String(id)+':photo:'+String(index);}
async function pruneMealPhotoKeys(id,keepCount){
 try{
  const db=await openPhotoDB();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(PHOTO_STORE,'readwrite'),store=tx.objectStore(PHOTO_STORE),req=store.getAllKeys();
   req.onsuccess=()=>{for(const key of req.result||[]){const k=String(key),prefix=String(id)+':photo:';if(k.startsWith(prefix)){const idx=Number(k.slice(prefix.length));if(!Number.isFinite(idx)||idx>=keepCount)store.delete(key);}}};
   req.onerror=()=>reject(req.error||new Error('Could not inspect meal photos'));
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not prune meal photos'));
  });
 }catch{}
}
async function storeMealPhotoSet(id,photos){
 const list=dedupeMealPhotos(photos,8),refs=[];
 for(let i=0;i<list.length;i++){
  const photo=list[i],key=mealPhotoStorageKey(id,i);
  if(photo.startsWith('data:image/')){
   const ok=await putStoredPhoto(key,photo);if(!ok)throw new Error('Could not save that meal photo on this device.');
   storedPhotoIds.add(key);refs.push('idb:'+key);
  }else refs.push(photo);
 }
 if(!String(list[0]||'').startsWith('data:image/'))await deleteStoredPhoto(id);
 await pruneMealPhotoKeys(id,refs.length);
 return refs;
}
async function hydrateStoredMealPhotoList(item){
 const refs=mealPhotoList(item),loaded=[];
 for(const ref of refs){if(String(ref).startsWith('idb:')){const data=await getStoredPhoto(String(ref).slice(4));if(data)loaded.push(data);}else loaded.push(ref);}
 return loaded;
}
async function hydrateCustomPhotos(){
 let changed=false;
 for(const item of S.custom){
  const refs=mealPhotoList(item),loaded=await hydrateStoredMealPhotoList(item);
  if(loaded.length){const clean=dedupeMealPhotos(loaded,8);item.images=clean;item.image=clean[0];if(clean.length!==refs.length)changed=true;}
  else if(refs.some(x=>String(x).startsWith('idb:'))){item.images=[];item.image='';changed=true;}
 }
 for(const item of (S.customQuickCuts||[])){
  const key='quickcut:'+String(item.id);
  if(String(item.image||'').startsWith('idb:')){
   const data=await getStoredPhoto(key);
   if(data){item.image=data;storedPhotoIds.add(key);changed=true;}else item.image='';
  }
 }
 for(const item of (S.deletedCustomMeals||[])){
  const refs=mealPhotoList(item),loaded=await hydrateStoredMealPhotoList(item);
  if(loaded.length){item.images=loaded;item.image=loaded[0];}
  else if(refs.some(x=>String(x).startsWith('idb:'))){item.images=[];item.image=DEFAULT_FOOD_IMAGE;}
 }
 if(changed)save();
}
function updateStorageIndicator() {
const el=$('storageIndicator'); if(!el)return;
el.classList.toggle('hidden', !S.storageWarning);
}
async function migrateCustomPhotos(){
 let changed=false;
 for(const item of S.custom){
  const photos=dedupeMealPhotos(mealPhotoList(item),8);if(!photos.length||!photos.some(x=>String(x).startsWith('data:image/')))continue;
  const refs=await storeMealPhotoSet(item.id,photos);
  item.images=refs;item.image=refs[0]||'';changed=true;
 }
 if(changed)save();
}
function save() {
const data = {
screen:S.screen, hidden:[...S.hidden], hiddenRestaurants:S.hiddenRestaurants,
cutCats:[...S.cutCats], foodCuts:[...S.foodCuts], maybe:[...S.maybe],
pool:S.pool, index:S.index, foodActions:S.foodActions,
restaurantPool:(Array.isArray(S.restaurantPool)?S.restaurantPool:[]).map(row=>{const copy={...row};delete copy._photoUnavailable;delete copy._photoUnavailableAt;return copy;}), restaurantIndex:S.restaurantIndex,
restaurantCuts:[...S.restaurantCuts], restaurantActions:S.restaurantActions,
restaurantQuery:S.restaurantQuery, restaurantHours:String(S.restaurantHours||'all'), restaurantHoursCollapsed:!!S.restaurantHoursCollapsed, location:S.location, locationSource:S.locationSource,
saved:S.saved, winnerItem:S.winnerItem, winnerType:S.winnerType, schemaVersion:STORAGE_VERSION, deleted:[...(S.deleted||[])], deletedCustomMeals:S.deletedCustomMeals||[],
restaurantSearchOrigin:S.restaurantSearchOrigin, restaurantSearchKey:S.restaurantSearchKey||'', restaurantSearchDegraded:!!S.restaurantSearchDegraded, locationFreshAt:S.locationFreshAt||null, maybeDeck:!!S.maybeDeck, foodMaybeRound:!!S.foodMaybeRound, restaurantMaybeRound:!!S.restaurantMaybeRound, quickCutsCollapsed:{food:!!S.quickCutsCollapsed?.food,restaurant:!!S.quickCutsCollapsed?.restaurant}, mealTimeCutsCollapsed:!!S.mealTimeCutsCollapsed, mealTimeFilters:[...S.mealTimeFilters],
mealTimeSettings:{custom:(S.mealTimeSettings?.custom||[]).map(x=>({id:String(x.id),name:String(x.name||'').trim()})).filter(x=>x.name),names:{...(S.mealTimeSettings?.names||{})},order:[...(S.mealTimeSettings?.order||[])],disabled:[...((S.mealTimeSettings?.disabled instanceof Set)?S.mealTimeSettings.disabled:new Set())]},
custom:S.custom.map(x=>{
 const photos=dedupeMealPhotos(mealPhotoList(x),8);
 const images=photos.map((photo,i)=>{
  const key=mealPhotoStorageKey(x.id,i);
  return String(photo).startsWith('data:image/')&&storedPhotoIds.has(key)?'idb:'+key:photo;
 });
 return {...x,images,image:images[0]||x.image||''};
}),
customQuickCuts:(S.customQuickCuts||[]).map(x=>({...x,image:(String(x.image||'').startsWith('data:image/') && storedPhotoIds.has('quickcut:'+x.id))?'idb:quickcut:'+x.id:x.image}))
};
try {
localStorage.setItem(KEY, JSON.stringify(data));
S.storageWarning=false;
updateStorageIndicator();
S.saved=true;
return true;
} catch {
S.storageWarning=true;
updateStorageIndicator();
S.saved=true;
return false;
}
}
function load() {
loadItemNotes();
try {
const raw = localStorage.getItem(KEY);
if (!raw) return false;
const d = JSON.parse(raw);

if(!Array.isArray(d.foodCuts)) d.foodCuts=[];
if(!d.foodCuts.length && Array.isArray(d.foodActions))
for(const a of d.foodActions) if(a?.type==='cut'&&a.id) d.foodCuts.push(a.id);
delete d.cutPrimary;
const legacyKeys=['cutPrimary','allCut','foodAllCut','savedRound','savedRoundType','legacyRestaurantPool','restaurantResults','pass','passDraftCount','passDraftNames','passDraftMode','passStartVoter'];
legacyKeys.forEach(key=>{try{delete d[key]}catch{}});
Object.assign(S, d);
legacyKeys.forEach(key=>{try{delete S[key]}catch{}});
S.hidden = new Set(d.hidden || []);
S.deleted = new Set(Array.isArray(d.deleted)?d.deleted:[]);
S.hiddenRestaurants = d.hiddenRestaurants || {};
S.cutCats = new Set(d.cutCats || []);
S.foodCuts = new Set(d.foodCuts || []);
S.maybe = new Set(d.maybe || []);
S.maybeDeck = !!d.maybeDeck;
S.foodMaybeRound = !!d.foodMaybeRound;
S.restaurantCuts = new Set(d.restaurantCuts || []);
S.foodActions = Array.isArray(d.foodActions) ? d.foodActions : [];
S.restaurantActions = Array.isArray(d.restaurantActions) ? d.restaurantActions : [];
S.restaurantMaybeRound = !!d.restaurantMaybeRound;
S.restaurantPool = Array.isArray(d.restaurantPool) ? d.restaurantPool.map(row=>{const copy={...row};delete copy._photoUnavailable;delete copy._photoUnavailableAt;return copy;}) : [];
S.custom = Array.isArray(d.custom) ? d.custom.map(item=>({...item,images:mealPhotoList(item)})) : [];
S.customQuickCuts = Array.isArray(d.customQuickCuts) ? d.customQuickCuts : [];

// CP1163 — permanently remove retired built-in meals from restored local state.
const RETIRED_BUILTIN_MEAL_IDS = new Set(['chili-cheese-baked-potato']);
let needsRetiredMealCleanupSave=false;
const hasRetiredMealId=(item)=>RETIRED_BUILTIN_MEAL_IDS.has(String(item?.id||''));
const filterRetiredMeals=(items)=>{
 if(!Array.isArray(items))return items;
 const filtered=items.filter(item=>!hasRetiredMealId(item));
 if(filtered.length!==items.length)needsRetiredMealCleanupSave=true;
 return filtered;
};
S.custom=filterRetiredMeals(S.custom);
S.deletedCustomMeals=filterRetiredMeals(Array.isArray(d.deletedCustomMeals)?d.deletedCustomMeals.map(item=>({...item,images:mealPhotoList(item)})):[]);
S.pool=filterRetiredMeals(Array.isArray(S.pool)?S.pool:[]);
S.foodActions=Array.isArray(S.foodActions)?S.foodActions.filter(action=>{
 const keep=!RETIRED_BUILTIN_MEAL_IDS.has(String(action?.id||''));
 if(!keep)needsRetiredMealCleanupSave=true;
 return keep;
}):[];
for(const id of RETIRED_BUILTIN_MEAL_IDS){
 if(S.hidden.delete(id))needsRetiredMealCleanupSave=true;
 if(S.deleted.delete(id))needsRetiredMealCleanupSave=true;
 if(S.foodCuts.delete(id))needsRetiredMealCleanupSave=true;
 if(S.maybe.delete(id))needsRetiredMealCleanupSave=true;
 if(S.winnerItem&&hasRetiredMealId(S.winnerItem)){S.winnerItem=null;S.winnerType='food';needsRetiredMealCleanupSave=true;}
}

// CP1032 — repair historical Buttermilk overrides after catalog cleanup.
let needsButtermilkRepairSave=false;
const legacyStandaloneButtermilk=S.custom.find(item=>String(item.id)==='buttermilk'&&normKey(item.name)==='buttermilk');
if(legacyStandaloneButtermilk){
 S.custom=S.custom.filter(item=>!(String(item.id)==='buttermilk'&&normKey(item.name)==='buttermilk'));
 needsButtermilkRepairSave=true;
}
const builtInButtermilkCornbread=S.custom.find(item=>String(item.id)==='buttermilk-cornbread');
if(builtInButtermilkCornbread){
 const savedName=normKey(builtInButtermilkCornbread.name);
 const savedImage=String(builtInButtermilkCornbread.image||'');
 const hasWrongFallback=/6287520|pasta|spaghetti/i.test(savedImage);
 if(!savedImage||hasWrongFallback||savedName==='buttermilk cornbread'){
  builtInButtermilkCornbread.name='Buttermilk & Cornbread';
  builtInButtermilkCornbread.image='https://ourstate.s3.amazonaws.com/assets/2025/01/FEB25-PE_Cornbread-and-Buttermilk__TimRobison.jpg';
  builtInButtermilkCornbread.images=[builtInButtermilkCornbread.image];
  needsButtermilkRepairSave=true;
 }
}
S.deletedCustomMeals = Array.isArray(d.deletedCustomMeals) ? d.deletedCustomMeals.map(item=>({...item,images:mealPhotoList(item)})) : [];

// CP1152 — restore the built-in meal label Chicken Fried Steak after older saved overrides.
let needsChickenFriedSteakNameRepairSave=false;
const repairChickenFriedSteakName=(item)=>{
 if(!item||String(item.id)!=='chicken-fried-steak')return false;
 if(normKey(item.name)!=='country fried steak')return false;
 item.name='Chicken Fried Steak';
 return true;
};
for(const item of S.custom) if(repairChickenFriedSteakName(item)) needsChickenFriedSteakNameRepairSave=true;
for(const item of S.deletedCustomMeals||[]) if(repairChickenFriedSteakName(item)) needsChickenFriedSteakNameRepairSave=true;
for(const item of S.pool||[]) if(repairChickenFriedSteakName(item)) needsChickenFriedSteakNameRepairSave=true;
if(S.winnerItem&&repairChickenFriedSteakName(S.winnerItem)) needsChickenFriedSteakNameRepairSave=true;
S.winnerType = d.winnerType || 'food';
S.restaurantSearchOrigin = d.restaurantSearchOrigin && Number.isFinite(Number(d.restaurantSearchOrigin.lat)) && Number.isFinite(Number(d.restaurantSearchOrigin.lon)) ? {lat:Number(d.restaurantSearchOrigin.lat),lon:Number(d.restaurantSearchOrigin.lon)} : null;
S.restaurantSearchKey = String(d.restaurantSearchKey||'');
S.locationSource = String(d.locationSource||'none');
S.restaurantHours = String(d.restaurantHours||'all')==='open' ? 'open' : 'all';
S.restaurantHoursCollapsed = true;
S.locationFreshAt = Number.isFinite(Number(d.locationFreshAt)) ? Number(d.locationFreshAt) : null;
S.quickCutsCollapsed = {food:Object.prototype.hasOwnProperty.call(d.quickCutsCollapsed||{},'food') ? !!d.quickCutsCollapsed.food : true,restaurant:Object.prototype.hasOwnProperty.call(d.quickCutsCollapsed||{},'restaurant') ? !!d.quickCutsCollapsed.restaurant : true};
S.mealTimeCutsCollapsed = Object.prototype.hasOwnProperty.call(d,'mealTimeCutsCollapsed') ? !!d.mealTimeCutsCollapsed : true;
// Keep the Meals refine panels mutually exclusive even when restoring older saved state.
if(!S.quickCutsCollapsed.food && !S.mealTimeCutsCollapsed){
  S.quickCutsCollapsed.food=true;
  S.mealTimeCutsCollapsed=true;
}
S.mealTimeSettings={custom:Array.isArray(d.mealTimeSettings?.custom)?d.mealTimeSettings.custom:[],names:d.mealTimeSettings?.names&&typeof d.mealTimeSettings.names==='object'?d.mealTimeSettings.names:{},order:Array.isArray(d.mealTimeSettings?.order)?d.mealTimeSettings.order:[],disabled:new Set(Array.isArray(d.mealTimeSettings?.disabled)?d.mealTimeSettings.disabled:[])};
ensureMealTimeSettings();
const availableMealTimeNames=mealTimeNames();
S.mealTimeFilters=new Set((Array.isArray(d.mealTimeFilters)?d.mealTimeFilters:(d.mealTimeFilter?[d.mealTimeFilter]:[])).map(currentMealTimeName).filter(x=>availableMealTimeNames.includes(x))); if(!S.mealTimeFilters.size) S.mealTimeFilters = new Set(availableMealTimeNames);
if(needsButtermilkRepairSave||needsChickenFriedSteakNameRepairSave||needsRetiredMealCleanupSave)save();
if(S.locationSource==='device' && S.location)S.locationSource='last';
S.restaurantSearchDegraded = !!d.restaurantSearchDegraded;
S.schemaVersion = STORAGE_VERSION;
return true;
} catch { return false; }
}
function show(screen) {
if(typeof tutorialModeEnabled==='function'&&typeof tutorialState!=='undefined'&&tutorialState.active&&tutorialState.screen&&tutorialState.screen!==screen){
 tutorialInvalidateTransition('screen-change');
}
document.querySelectorAll('.screen').forEach(x => x.classList.add('hidden'));
$(screen)?.classList.remove('hidden');
S.screen = screen;
document.querySelector('.app')?.classList.toggle('home-active',screen === 'home');
$('globalBack')?.classList.add('hidden');
$('appTopbar')?.classList.toggle('hidden', screen === 'food' || screen === 'restaurant' || screen === 'winner' || screen === 'family');
window.scrollTo?.(0,0);
}

const tutorialState={
 active:false,
 screen:'',
 index:0,
 steps:[],
 token:0,
 awaitingAction:false,
 pendingDecisionScreen:'',
 returnContext:null
};
function ensureTutorialUI(){
 if(document.querySelector('#tutorialLayer'))return;
 const layer=document.createElement('div');layer.id='tutorialLayer';layer.className='tutorial-layer hidden';layer.setAttribute('aria-hidden','true');
 layer.innerHTML='<div class="tutorial-spotlight" id="tutorialSpotlight" aria-hidden="true"></div><button class="tutorial-bubble" id="tutorialBubble" type="button"><span class="tutorial-bubble-title" id="tutorialBubbleTitle"></span><span class="tutorial-bubble-body" id="tutorialBubbleBody"></span></button>';
 document.body.appendChild(layer);
}
function tutorialModeEnabled(){return !!S.tutorialMode}
function tutorialHideOverlay(){
 const layer=document.querySelector('#tutorialLayer');
 if(layer){layer.classList.add('hidden');layer.setAttribute('aria-hidden','true');}
 const bubble=document.querySelector('#tutorialBubble');
 if(bubble){bubble.classList.remove('is-visible');bubble.style.visibility='hidden';}
}
function tutorialInvalidateTransition(reason=''){
 tutorialState.token++;
 tutorialHideOverlay();
 tutorialState.awaitingAction=false;
}
function tutorialToast(message){
 const old=document.querySelector('#tutorialModeToast');old?.remove();
 const toast=document.createElement('div');toast.id='tutorialModeToast';toast.className='tutorial-mode-toast';toast.textContent=message;document.body.appendChild(toast);
 requestAnimationFrame(()=>toast.classList.add('is-visible'));
 window.setTimeout(()=>{toast.classList.remove('is-visible');window.setTimeout(()=>toast.remove(),180)},1200);
}
function stopTutorialMode(){
 tutorialState.token++;
 tutorialState.active=false;
 tutorialState.screen='';
 tutorialState.index=0;
 tutorialState.steps=[];
 tutorialState.awaitingAction=false;
 tutorialState.pendingDecisionScreen='';
 tutorialState.returnContext=null;
 S.tutorialMode=false;
 const layer=document.querySelector('#tutorialLayer');if(layer){layer.classList.add('hidden');layer.setAttribute('aria-hidden','true');}
 document.querySelector('#tutorialBubble')?.classList.remove('is-visible');
 document.body.classList.remove('tutorial-mode-on');
}
function setTutorialMode(enabled,showNotice=true){
 const on=!!enabled;
 S.tutorialMode=on;
 if(!on){stopTutorialMode();if(showNotice)tutorialToast('Tutorial Mode OFF');return;}
 ensureTutorialUI();
 if(showNotice)tutorialToast('Tutorial Mode ON');
 startTutorialFromHome();
}
function startTutorialFromHome(){
 const begin=()=>{
  S.tutorialMode=true;
  document.body.classList.add('tutorial-mode-on');
  tutorialState.token++;
  tutorialState.active=true;
  tutorialState.screen='home';
  tutorialState.index=0;
  tutorialState.steps=[];
  tutorialState.awaitingAction=false;
  tutorialState.pendingDecisionScreen='';
  tutorialState.returnContext=null;
  show('home');
  startTutorialForScreen('home',true,{index:0});
 };
 closeDrawer?.(true);
 window.requestAnimationFrame(begin);
}
function tutorialStepsForScreen(screen){
 if(screen==='home')return[
  {target:'#tutorialModeToggle',title:'TOUR',body:'Tap this highlighted Tour button—or this guide—to move to the next step.',avoid:['#home .home-foot']},
  {target:'#home-slogan',title:'HOW IT WORKS',body:'Eliminate meals or restaurants until your choice is revealed.',avoid:['#home .home-foot','#foodStart','#restStart','#menu']},
  {targets:['#foodStart','#restStart'],title:'GET STARTED',body:'Tap Home or Restaurant to get started.',action:'home-choice',avoid:['#home .home-foot','#foodStart','#restStart','#menu']}
 ];
 if(screen==='food')return[
  {target:'#foodCard',title:'MEAL CARD',body:'This is the meal you are deciding on. Swipe left for Cut or right for Maybe, or use the buttons below. A committed card slides completely off-screen before the next choice takes over.'},
  {target:'#foodCut',title:'CUT',body:'Remove the current meal from this round.'},
  {target:'#foodMaybe',title:'MAYBE',body:'Keep the meal in consideration for your final choice.'},
  {target:'#foodBack',title:'BACK',body:'Undo your most recent meal decision and return to the previous card.'},
  {target:'#foodChoose',title:'CHOOSE',body:'Choose the current meal immediately and see your winner.',action:'choose'},
  {target:'#foodDetails',title:'DETAILS',body:'Open the meal details, including nutrition, ingredients, notes, and photos.'},
  {target:'#foodMealTimeToggle',title:'MEAL TIMES',body:'Show the Meal Times filters to narrow the deck to Breakfast, Lunch / Dinner, Snacks / Desserts, or your custom meal times.',avoid:['#foodQuickToggle','#mealTimeQuick','#foodQuick']},
  {target:'#foodQuickToggle',title:'CUISINE',body:'Open Cuisine to narrow the deck by cuisine type.',avoid:['#foodMealTimeToggle','#mealTimeQuick','#foodQuick']},
  {target:'#foodMaybeDeck',title:'ALL · MAYBES · COUNT',body:'Switch between all remaining meals and your Maybes, while keeping track of how many choices remain.'},
  {target:'#foodMenu',title:'MENU',body:'Open the menu for Manage Meals, History, Settings, Family Mode, and more.',avoid:['#drawer']},
  {target:'#foodMenu',title:'NEXT: RESTAURANTS',body:'Tap this Tour message to continue to the Restaurant side of Dinliminate.',action:'enter-restaurant'}
 ];
 if(screen==='restaurant')return[
  {target:'#locate',title:'CURRENT LOCATION',body:'Use your current location to search for nearby restaurants.'},
  {target:'#address',title:'ADDRESS',body:'Enter an address to search from a different starting point.'},
  {target:'#find',title:'FIND RESTAURANTS',body:'Run the restaurant search using your selected location, radius, and filters.'},
  {target:'#radius',title:'RADIUS',body:'Choose how far from the search location to look: 1, 3, 5, 10, 25, 50, or 100 miles.'},
  {target:'#restaurantCard',title:'RESTAURANT CARD',body:'This is the restaurant you are deciding on. Swipe left for Cut or right for Maybe, or use the buttons below. A committed card slides completely off-screen before the next choice takes over.'},
  {target:'#restCut',title:'CUT',body:'Remove the current restaurant from this round.'},
  {target:'#restMaybe',title:'MAYBE',body:'Keep the restaurant in consideration for your final choice.'},
  {target:'#restBack',title:'BACK',body:'Undo your most recent restaurant decision and return to the previous card.'},
  {target:'#restChoose',title:'CHOOSE',body:'Choose the current restaurant immediately and see your winner.',action:'choose'},
  {target:'#restaurantSearchToggle',title:'SEARCH',body:'Open Search to look for a specific restaurant or cuisine.',avoid:['#restaurantSearchBox']},
  {target:'#restaurantQuickToggle',title:'CUISINE',body:'Open Cuisine to narrow the restaurant deck by cuisine type.',avoid:['#restQuick','#restaurantSearchToggle','#restaurantHoursToggle']},
  {target:'#restaurantHoursToggle',title:'OPEN',body:'Show only restaurants confirmed open now, or keep all restaurants in the current pool.',avoid:['#restaurantHoursQuick','#restQuick','#restaurantSearchToggle']},
  {target:'#restaurantMaybeDeck',title:'ALL · MAYBES · COUNT',body:'Switch between all remaining restaurants and your Maybes, while keeping track of how many choices remain.'},
  {target:'#restaurantMenu',title:'MENU',body:'Open the menu for Manage Meals, History, Settings, Family Mode, and more.',avoid:['#drawer']},
  {target:'#restaurantMenu',title:'NEXT: MEALS',body:'Tap this Tour message to return to the Meals side of Dinliminate.',action:'enter-food'}
 ];
 if(screen==='winner')return[
  {target:'#details',title:'WINNER DETAILS',body:'Open the winner details for the meal or restaurant you selected.'},
  {target:'#share',title:'SHARE',body:'Share your winner with someone else.'},
  {target:'#restart',title:'START OVER',body:'Return to the decision path and continue the Tour.',action:'winner-restart'}
 ];
 return[];
}
function tutorialUnionRect(selectors){
 const rects=(selectors||[]).map(sel=>{try{return document.querySelector(sel)?.getBoundingClientRect()||null}catch{return null}})
  .filter(r=>r&&r.width&&r.height);
 if(!rects.length)return null;
 return{
  left:Math.min(...rects.map(r=>r.left)),
  top:Math.min(...rects.map(r=>r.top)),
  right:Math.max(...rects.map(r=>r.right)),
  bottom:Math.max(...rects.map(r=>r.bottom)),
  width:Math.max(...rects.map(r=>r.right))-Math.min(...rects.map(r=>r.left)),
  height:Math.max(...rects.map(r=>r.bottom))-Math.min(...rects.map(r=>r.top))
 };
}
function tutorialTargetRect(step){
 if(Array.isArray(step?.targets)){
  return tutorialUnionRect(step.targets);
 }
 const target=step?.target?document.querySelector(step.target):null;
 if(!target)return null;
 const main=target.getBoundingClientRect();
 if(!main.width||!main.height)return null;
 return main;
}
function tutorialBlockerRects(step){
 return (step?.avoid||[]).map(sel=>{
  try{return document.querySelector(sel)?.getBoundingClientRect()||null}catch{return null}
 }).filter(r=>r&&r.width&&r.height);
}
function tutorialPosition(expectedToken=tutorialState.token,retry=0){
 if(expectedToken!==tutorialState.token||!tutorialState.active||tutorialState.screen!==S.screen)return;
 const step=tutorialState.steps[tutorialState.index];
 const bubble=document.querySelector('#tutorialBubble'),spot=document.querySelector('#tutorialSpotlight');
 const rect=tutorialTargetRect(step);
 if(!bubble||!rect){
  if(retry<24){
   window.requestAnimationFrame(()=>tutorialPosition(expectedToken,retry+1));
  }else{
   tutorialToast('Tour could not find the highlighted control.');
   stopTutorialMode();
  }
  return;
 }
 spot.style.left=(rect.left-6)+'px';spot.style.top=(rect.top-6)+'px';spot.style.width=(rect.width+12)+'px';spot.style.height=(rect.height+12)+'px';
 bubble.classList.remove('is-visible');bubble.style.visibility='hidden';bubble.dataset.side='';bubble.style.left='0px';bubble.style.top='0px';
 requestAnimationFrame(()=>{
  if(expectedToken!==tutorialState.token||!tutorialState.active||tutorialState.screen!==S.screen)return;
  const bw=bubble.offsetWidth||280,bh=bubble.offsetHeight||96,vw=window.innerWidth,vh=window.innerHeight,gap=14,margin=12;
  const blockers=[rect,...tutorialBlockerRects(step)];
  const overlaps=(x,y)=>{
   const b={left:x,top:y,right:x+bw,bottom:y+bh};
   return blockers.some(r=>b.left<r.right+gap&&b.right>r.left-gap&&b.top<r.bottom+gap&&b.bottom>r.top-gap);
  };
  const inside=(x,y)=>x>=margin&&y>=margin&&x+bw<=vw-margin&&y+bh<=vh-margin&&!overlaps(x,y);
  const raw=[
   {side:'top',x:rect.left+rect.width/2-bw/2,y:rect.top-bh-gap},
   {side:'bottom',x:rect.left+rect.width/2-bw/2,y:rect.bottom+gap},
   {side:'left',x:rect.left-bw-gap,y:rect.top+rect.height/2-bh/2},
   {side:'right',x:rect.right+gap,y:rect.top+rect.height/2-bh/2},
   {side:'top-left',x:rect.left-bw-gap,y:rect.top-bh-gap},
   {side:'top-right',x:rect.right+gap,y:rect.top-bh-gap},
   {side:'bottom-left',x:rect.left-bw-gap,y:rect.bottom+gap},
   {side:'bottom-right',x:rect.right+gap,y:rect.bottom+gap},
   {side:'bottom-safe',x:vw/2-bw/2,y:vh-bh-margin}
  ];
  let picked=raw.find(c=>inside(c.x,c.y));
  if(!picked){
   const safe=raw.map(c=>({...c,x:Math.max(margin,Math.min(c.x,vw-bw-margin)),y:Math.max(margin,Math.min(c.y,vh-bh-margin))}));
   picked=safe.find(c=>!overlaps(c.x,c.y))||safe[safe.length-1];
  }
  if(expectedToken!==tutorialState.token||!tutorialState.active||tutorialState.screen!==S.screen)return;
  bubble.dataset.side=picked.side;bubble.style.left=picked.x+'px';bubble.style.top=picked.y+'px';bubble.style.visibility='visible';
  requestAnimationFrame(()=>{
   if(expectedToken!==tutorialState.token||!tutorialState.active||tutorialState.screen!==S.screen)return;
   bubble.classList.add('is-visible');
  });
 });
}
function renderTutorialStep(){
 if(!tutorialModeEnabled()||!tutorialState.active){stopTutorialMode();return;}
 const step=tutorialState.steps[tutorialState.index];if(!step){stopTutorialMode();return;}
 const layer=document.querySelector('#tutorialLayer');if(!layer){ensureTutorialUI();return renderTutorialStep();}
 layer.classList.remove('hidden');layer.setAttribute('aria-hidden','false');
 const bubble=document.querySelector('#tutorialBubble');
 const title=document.querySelector('#tutorialBubbleTitle'),body=document.querySelector('#tutorialBubbleBody');
 if(title)title.textContent=step.title;if(body)body.textContent=step.body;
 if(!bubble){ensureTutorialUI();return renderTutorialStep();}
 bubble.classList.toggle('is-action-step',!!step.action);
 bubble.disabled=false;
 bubble.setAttribute('aria-disabled','false');
 bubble.dataset.action=step.action||'';
 tutorialState.awaitingAction=!!step.action;
 const expectedToken=tutorialState.token;
 requestAnimationFrame(()=>tutorialPosition(expectedToken));
}
function tutorialNavigateTo(screen,index=0){
 if(!tutorialModeEnabled()||!tutorialState.active)return;
 const normalized=['home','food','restaurant','winner'].includes(screen)?screen:'';
 if(!normalized)return;
 const steps=tutorialStepsForScreen(normalized);if(!steps.length){stopTutorialMode();return;}
 tutorialInvalidateTransition('tutorial-navigation');
 const expectedToken=tutorialState.token;
 tutorialState.screen=normalized;
 tutorialState.steps=steps;
 tutorialState.index=Math.max(0,Math.min(Number.isInteger(index)?index:0,steps.length-1));
 tutorialState.awaitingAction=!!steps[tutorialState.index]?.action;
 document.body.classList.add('tutorial-mode-on');
 ensureTutorialUI();
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(expectedToken!==tutorialState.token||!tutorialState.active||S.screen!==normalized)return;
  renderTutorialStep();
 }));
}
function startTutorialForScreen(screen,force=false,options={}){
 if(!force&&!tutorialModeEnabled())return;
 const normalized=['home','food','restaurant','winner'].includes(screen)?screen:'';
 if(!normalized){return;}
 const nextIndex=Number.isInteger(options.index)?Math.max(0,options.index):0;
 tutorialNavigateTo(normalized,nextIndex);
}
function tutorialEnterDecisionScreen(screen,index=0){
 if(!tutorialModeEnabled()||!tutorialState.active)return;
 tutorialState.pendingDecisionScreen='';
 startTutorialForScreen(screen,true,{index});
}
function tutorialMarkHomeChoice(screen){
 if(!tutorialModeEnabled()||!tutorialState.active)return;
 const step=tutorialState.steps[tutorialState.index];
 if(step?.action!=='home-choice')return;
 tutorialState.awaitingAction=false;
 tutorialState.pendingDecisionScreen=screen;
}
function tutorialMarkChoose(screen){
 if(!tutorialModeEnabled()||!tutorialState.active)return;
 const step=tutorialState.steps[tutorialState.index];
 if(step?.action!=='choose')return;
 tutorialState.awaitingAction=false;
 tutorialState.returnContext={screen,index:tutorialState.index};
}
function tutorialWinnerRestart(){
 if(!tutorialModeEnabled()||!tutorialState.active||!tutorialState.returnContext)return false;
 const context={...tutorialState.returnContext};
 tutorialState.returnContext=null;
 const resumeIndex=context.index+1;
 if(context.screen==='food')startFood({tutorialResumeIndex:resumeIndex});
 else if(context.screen==='restaurant')openRestaurant({tutorialResumeIndex:resumeIndex});
 else return false;
 return true;
}
function advanceTutorial(){
 const step=tutorialState.steps[tutorialState.index];
 if(step?.action==='choose'){
  const sourceScreen=tutorialState.screen;
  const item=sourceScreen==='food' ? S.pool?.[S.index] : restaurantPoolFiltered()?.[S.restaurantIndex];
  if(item){
   tutorialState.awaitingAction=false;
   tutorialState.returnContext={screen:sourceScreen,index:tutorialState.index};
   winner(item,sourceScreen==='restaurant'?'restaurant':'food',{tutorial:true});
  }
  return;
 }
 if(step?.action==='enter-restaurant'){
  tutorialState.awaitingAction=false;
  openRestaurant({tutorialResumeIndex:0});
  return;
 }
 if(step?.action==='enter-food'){
  tutorialState.awaitingAction=false;
  stopTutorialMode();
  home();
  tutorialToast('Tutorial complete');
  return;
 }
 if(step?.action==='winner-restart'){
  tutorialState.awaitingAction=true;
  return;
 }
 if(step?.action){return;}
 tutorialState.index++;
 if(tutorialState.index>=tutorialState.steps.length){stopTutorialMode();return;}
 renderTutorialStep();
}
let tutorialPointerContext=null;
let tutorialSuppressClick=null;

function tutorialTargetHit(event,selector){
 try{return !!event.target?.closest?.(selector);}catch{return false;}
}
function tutorialAdvanceFromTarget(event,step){
 if(step?.action==='home-choice'){
  const choice=event.target?.closest?.('#foodStart,#restStart');
  if(!choice)return false;
  const nextScreen=choice.id==='restStart'?'restaurant':'food';
  tutorialMarkHomeChoice(nextScreen);
  if(nextScreen==='restaurant')openRestaurant({tutorialResumeIndex:0});
  else startFood({tutorialResumeIndex:0});
  return true;
 }
 if(step?.action==='choose'){
  advanceTutorial();
  return true;
 }
 if(step?.action==='enter-restaurant'||step?.action==='enter-food'){
  advanceTutorial();
  return true;
 }
 if(step?.action==='winner-restart'){
  handleWinnerRestart();
  return true;
 }
 advanceTutorial();
 return true;
}
function tutorialCurrentTargetForEvent(event,step){
 if(!step?.target)return null;
 if(step.action==='home-choice')return event.target?.closest?.('#foodStart,#restStart')||null;
 return tutorialTargetHit(event,String(step.target)) ? event.target?.closest?.(String(step.target)) : null;
}
function tutorialBlockPointer(event){
 if(!tutorialModeEnabled()||!tutorialState.active)return false;
 const step=tutorialState.steps[tutorialState.index];
 const target=tutorialCurrentTargetForEvent(event,step);
 if(!target)return false;
 tutorialPointerContext={
  pointerId:event.pointerId,
  target,
  screen:tutorialState.screen,
  index:tutorialState.index
 };
 event.preventDefault();
 event.stopImmediatePropagation();
 return true;
}
function tutorialHandlePointerUp(event){
 if(!tutorialPointerContext)return false;
 const ctx=tutorialPointerContext;
 tutorialPointerContext=null;
 if(ctx.pointerId!==event.pointerId)return false;
 event.preventDefault();
 event.stopImmediatePropagation();
 const stillSameScreen=tutorialState.active&&tutorialState.screen===ctx.screen&&tutorialState.index===ctx.index;
 if(stillSameScreen){
  tutorialSuppressClick={target:ctx.target,expires:Date.now()+650};
  const step=tutorialState.steps[ctx.index];
  tutorialAdvanceFromTarget(event,step);
 }
 return true;
}
function tutorialHandlePointerCancel(event){
 if(!tutorialPointerContext||tutorialPointerContext.pointerId!==event.pointerId)return false;
 tutorialPointerContext=null;
 event.preventDefault();
 event.stopImmediatePropagation();
 return true;
}
function tutorialHighlightedTargetClick(event){
 if(tutorialSuppressClick){
  const suppressed=tutorialSuppressClick;
  if(Date.now()<=suppressed.expires&&suppressed.target?.isConnected&&
     (event.target===suppressed.target||suppressed.target.contains?.(event.target))){
   tutorialSuppressClick=null;
   event.preventDefault();
   event.stopImmediatePropagation();
   return;
  }
  tutorialSuppressClick=null;
 }
 if(!tutorialModeEnabled()||!tutorialState.active)return;
 const step=tutorialState.steps[tutorialState.index];
 const target=tutorialCurrentTargetForEvent(event,step);
 if(!target)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 tutorialAdvanceFromTarget(event,step);
}
function bindTutorialUI(){
 ensureTutorialUI();
 const bubble=document.querySelector('#tutorialBubble');
 if(bubble&&!bubble.dataset.bound){
  bubble.dataset.bound='1';
  bubble.addEventListener('click',advanceTutorial);
 }
 if(!document.documentElement.dataset.tutorialTargetBound){
  document.documentElement.dataset.tutorialTargetBound='1';
  // CP1251: use the CP1076-style click capture as the tutorial's single
  // interaction gate. The previous pointerdown/up interception could lose
  // the Home/Restaurant choice when the release landed a few pixels away.
  document.documentElement.dataset.tutorialTargetBound='1';
  document.addEventListener('click',tutorialHighlightedTargetClick,true);
 }
 window.addEventListener('resize',()=>{if(tutorialState.active)window.requestAnimationFrame(()=>tutorialPosition(tutorialState.token))},{passive:true});
 window.addEventListener('scroll',()=>{if(tutorialState.active)window.requestAnimationFrame(()=>tutorialPosition(tutorialState.token))},{passive:true});
}

bindTutorialUI();

function closeOverlays() {

['drawer','drawerBg','modal','modalBg'].forEach(id => $(id)?.classList.add('hidden'));
['manageFoodsModal','manageFoodsModalBg','foodEditorModal','foodEditorModalBg','resetRestoreModal','resetRestoreModalBg','settingsModal','settingsModalBg','historyModal','historyModalBg','aboutModal','aboutModalBg','iphoneModal','iphoneModalBg','detailsModal','detailsModalBg'].forEach(id => $(id)?.remove());
clearSuggestions();
}
function home() {
closeOverlays();
S.screen = 'home';
show('home');
}
const DEFAULT_MEAL_TIME_DEFS=[
 {id:'breakfast',name:'Breakfast'},
 {id:'lunch-dinner',name:'Lunch / Dinner'},
 {id:'snacks-desserts',name:'Snacks / Desserts'}
];
const MEAL_TIME_CUTS=DEFAULT_MEAL_TIME_DEFS.map(x=>x.name);
function ensureMealTimeSettings(){
 const current=S.mealTimeSettings&&typeof S.mealTimeSettings==='object'&&!Array.isArray(S.mealTimeSettings)?S.mealTimeSettings:{};
 if(!current.names||typeof current.names!=='object'||Array.isArray(current.names))current.names={};
 if(!Array.isArray(current.custom))current.custom=[];
 if(!Array.isArray(current.order))current.order=[];
 if(!(current.disabled instanceof Set))current.disabled=new Set(Array.isArray(current.disabled)?current.disabled:[]);
 current.custom=current.custom.map(x=>({id:String(x?.id||('custom-meal-time-'+Math.random().toString(36).slice(2,9))),name:String(x?.name||'').trim()})).filter(x=>x.name);
 const validIds=new Set([...DEFAULT_MEAL_TIME_DEFS.map(x=>x.id),...current.custom.map(x=>x.id)]);
 current.order=[...current.order.map(String).filter(id=>validIds.has(id)),...DEFAULT_MEAL_TIME_DEFS.map(x=>x.id),...current.custom.map(x=>x.id)].filter((id,i,a)=>a.indexOf(id)===i);
 current.disabled=new Set([...current.disabled].map(String).filter(id=>validIds.has(id)));
 DEFAULT_MEAL_TIME_DEFS.forEach(def=>{if(!String(current.names[def.id]||'').trim())current.names[def.id]=def.name;});
 S.mealTimeSettings=current;
 return current;
}
function mealTimeCatalog(){
 const cfg=ensureMealTimeSettings();
 const defaults=DEFAULT_MEAL_TIME_DEFS.map(def=>({id:def.id,defaultName:def.name,name:String(cfg.names[def.id]||def.name).trim()||def.name,custom:false}));
 const customs=(cfg.custom||[]).map(x=>({id:String(x.id),defaultName:'',name:String(x.name||'').trim(),custom:true})).filter(x=>x.name);
 const byId=new Map([...defaults,...customs].map(x=>[x.id,x]));
 return cfg.order.map(String).map(id=>byId.get(id)).filter(Boolean).concat([...byId.values()].filter(x=>!cfg.order.includes(x.id)));
}
function mealTimeOptions(){return mealTimeCatalog().map(x=>({...x,enabled:!S.mealTimeSettings.disabled.has(x.id)}));}
function mealTimeNames(){return mealTimeOptions().filter(x=>x.enabled).map(x=>x.name);}
function mealTimeDefinition(value){
 const key=normKey(value);
 if(!key)return null;
 return mealTimeCatalog().find(x=>normKey(x.name)===key || (x.defaultName&&normKey(x.defaultName)===key))||null;
}
function currentMealTimeName(value){
 const found=mealTimeDefinition(value);
 return found?.name||String(value||'').trim();
}
function syncMealTimeReferences(oldName,newName,id){
 const replaceIn=item=>{
  if(!item||!Array.isArray(item.mealTimes))return;
  item.mealTimes=[...new Set(item.mealTimes.map(value=>String(value||'').trim()===oldName?newName:value).filter(Boolean))];
  if(!item.mealTimes.length)item.mealTimes=[newName];
 };
 S.custom.forEach(replaceIn);
 S.deletedCustomMeals?.forEach(replaceIn);
 S.mealTimeFilters=new Set([...S.mealTimeFilters||[]].map(value=>value===oldName?newName:value));
}
function mealTimesFor(item){
 const raw=Array.isArray(item?.mealTimes)?item.mealTimes:(item?.mealTime?[item.mealTime]:[]);
 const explicit=raw.map(currentMealTimeName).filter(Boolean);
 if(explicit.length)return [...new Set(explicit)];
 const category=String(item?.category||'').trim().toLowerCase();
 const cuts=(Array.isArray(item?.quickCuts)?item.quickCuts:[item?.category]).map(x=>String(x||'').trim().toLowerCase());
 const fallbackId=category==='breakfast'||cuts.includes('breakfast')
   ?'breakfast'
   :(category==='snack'||category==='dessert'||category==='desserts'||cuts.some(x=>x==='snack'||x==='dessert'||x==='desserts')
     ?'snacks-desserts':'lunch-dinner');
 const found=mealTimeCatalog().find(x=>x.id===fallbackId);
 return [found?.name||'Lunch / Dinner'];
}
function mealTimeFor(item){ return mealTimesFor(item)[0]||mealTimeNames()[0]||'Lunch / Dinner'; }
function foodBasePool(){
 const rows=allFoods().filter(item=>{
  if(S.hidden.has(item.id)||S.foodCuts.has(item.id))return false;
  if(S.mealTimeFilters?.size){const times=mealTimesFor(item);if(!times.some(t=>S.mealTimeFilters.has(t)))return false;}
  const cuts=Array.isArray(item.quickCuts)?item.quickCuts:[item.category];
  if([...S.cutCats].some(label=>cuts.includes(label)))return false;
  return true;
 });
 // CP1225: keep Fish Sticks as the final card in every Meals deck,
 // including filtered and Maybe views, without changing catalog data.
 const fishIndex=rows.findIndex(item=>String(item?.id||'')==='fish-sticks');
 if(fishIndex>=0){
  const [fish]=rows.splice(fishIndex,1);
  rows.push(fish);
 }
 return rows;
}
function foodPool(){
 const base=foodBasePool();
 return S.maybeDeck ? base.filter(item=>S.maybe.has(item.id)) : base;
}
function buildFood() {
S.pool = foodPool();
S.index = Math.max(0, Math.min(S.index, Math.max(0, S.pool.length - 1)));
}
function setMaybeDeck(kind, enabled){
 const next=!!enabled;
 const hasMaybe=maybeDeckCount(kind)>0;
 // Never enter Maybe mode when there are no Maybe choices.
 if(next && !hasMaybe){
  S.maybeDeck=false;
  if(kind==='food'){S.foodMaybeRound=false;S.index=0;buildFood();drawFood();}
  else{S.restaurantMaybeRound=false;S.restaurantIndex=0;drawRestaurants();}
  renderMaybeDeckToggle(kind);save();
  return;
 }
 if(kind==='food'){
  S.maybeDeck=next; S.foodMaybeRound=next; S.index=0; buildFood(); drawFood();
 }else{
  S.maybeDeck=next; S.restaurantMaybeRound=next; S.restaurantIndex=0; drawRestaurants();
 }
 renderMaybeDeckToggle(kind); save();
}
function allChoiceRows(kind){
 if(kind==='food')return foodBasePool();
 // CP1214: ALL is the decision pool, not the photo-readiness pool.
 // A missing/unavailable photo must never lower the restaurant count.
 return restaurantPoolHourFiltered();
}
function choiceDeckRows(kind){
 const all=allChoiceRows(kind);
 return S.maybeDeck ? all.filter(row=>kind==='food'?S.maybe.has(row.id):!!row._maybe) : all;
}
function maybeDeckRows(kind){
 return allChoiceRows(kind).filter(row=>kind==='food'?S.maybe.has(row.id):!!row._maybe);
}
function maybeDeckCount(kind){return maybeDeckRows(kind).length;}
function allDeckCount(kind){return allChoiceRows(kind).length;}
function renderMaybeDeckToggle(kind){
 const id=kind==='food'?'foodMaybeDeck':'restaurantMaybeDeck';
 const btn=$(id);if(!btn)return;
 const allCount=allDeckCount(kind);
 const maybeCount=maybeDeckCount(kind);
 const isMaybe=!!S.maybeDeck;
 const visibleCount=isMaybe?maybeCount:allCount;
 const hasMaybes=maybeCount>0;
 btn.dataset.mode=isMaybe?'maybe':'all';
 btn.dataset.allCount=String(allCount);
 btn.dataset.maybeCount=String(maybeCount);
 btn.dataset.visibleCount=String(visibleCount);
 btn.disabled=false;
 const target=isMaybe?'Show all choices':'Show Maybe choices';
 btn.setAttribute('aria-label',isMaybe?'Viewing Maybe choices ('+maybeCount+'). Tap to show all choices ('+allCount+').':'Viewing all choices ('+allCount+'). Tap to show Maybe choices ('+maybeCount+').');
 btn.setAttribute('aria-pressed',isMaybe?'true':'false');
 btn.title=target;
 btn.classList.add('canonical-maybe-control');
 btn.innerHTML='<span class="maybe-control-all" aria-hidden="true">ALL</span><span class="maybe-control-divider" aria-hidden="true">·</span><span class="maybe-control-maybe" aria-hidden="true">MAYBES</span><span class="maybe-control-count" aria-hidden="true">'+visibleCount+'</span>';
 btn.classList.toggle('is-maybe',isMaybe);
 btn.classList.toggle('is-all',!isMaybe);
 btn.classList.toggle('has-maybes',hasMaybes);
}
function bindMaybeDeckToggle(kind){
 const id=kind==='food'?'foodMaybeDeck':'restaurantMaybeDeck';
 const btn=$(id);if(!btn)return;
 btn.onclick=()=>{
  const hasMaybe=maybeDeckCount(kind)>0;
  if(!S.maybeDeck && !hasMaybe)return;
  setMaybeDeck(kind,!S.maybeDeck);
 };
 renderMaybeDeckToggle(kind);
}
function renderRestaurantHours(){
 const toggle=$('restaurantHoursToggle');if(!toggle)return;
 const active=String(S.restaurantHours||'all')==='open';
 // CP1211: Restaurant Hours is now a single binary filter. Legacy "closed"
 // state is treated as the default all-restaurants state.
 S.restaurantHours=active?'open':'all';
 S.restaurantHoursCollapsed=true;
 const chips=$('restaurantHoursQuick');
 if(chips){
  chips.innerHTML='';
  chips.classList.add('is-rail-collapsed');
  chips.setAttribute('aria-hidden','true');
 }
 toggle.classList.remove('is-open');
 toggle.classList.toggle('is-active',active);
 toggle.dataset.mode=active?'open':'all';
 toggle.setAttribute('data-active',active?'true':'false');
 toggle.setAttribute('aria-expanded','false');
 toggle.setAttribute('aria-pressed',active?'true':'false');
 toggle.setAttribute('aria-label',active?'Turn Open filter off — show all restaurants':'Show only restaurants open now');
 toggle.title=active?'Show all restaurants':'Show only restaurants open now';
}
function bindRestaurantHours(){
 const toggle=$('restaurantHoursToggle');
 if(!toggle)return;
 toggle.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   const next=String(S.restaurantHours||'all')==='open'?'all':'open';
   S.restaurantHours=next;
   S.restaurantIndex=0;
   S.restaurantMaybeRound=false;
   renderRestaurantHours();
   if(next==='open'){
     const sameSearch=restaurantHoursEnrichmentKey===String(S.restaurantSearchKey||'');
     const recentlyEnriched=sameSearch&&(Date.now()-restaurantHoursEnrichedAt)<10*60*1000;
     if(!recentlyEnriched){
       updateRestaurantStatus();
       enrichRestaurantHoursForOpenNow().then(()=>{
         if(S.screen!=='restaurant'||S.restaurantHours!=='open')return;
         updateRestaurantStatus();
         drawRestaurants();
         save();
       }).catch(()=>{
         if(S.screen==='restaurant'&&S.restaurantHours==='open'){
           updateRestaurantStatus();
           drawRestaurants();
           save();
         }
       });
     }else{
       updateRestaurantStatus();
       drawRestaurants();
       save();
     }
   }else{
     updateRestaurantStatus();
     drawRestaurants();
     save();
   }
 };
 renderRestaurantHours();
}
function renderQuickCutsCollapse(kind){
 const section=kind==='food'?document.querySelector('#food .quick-section'):document.querySelector('#restaurant .restaurant-quick-section');
 const toggle=kind==='food'?document.getElementById('foodQuickToggle'):section?.querySelector('.quick-cuts-collapse-toggle');
 const chips=kind==='food'?document.getElementById('foodQuick'):document.getElementById('restQuick');
 if(!section||!toggle||!chips)return;
 const collapsed=!!S.quickCutsCollapsed?.[kind];
 if(kind==='food'){
  // Hard-lock the Meals refine panels so Cuisine and Meal Times can never both be open.
  if(!collapsed && !S.mealTimeCutsCollapsed)S.mealTimeCutsCollapsed=true;
  section.classList.remove('is-collapsed');
  chips.classList.toggle('is-rail-collapsed',collapsed);
  const mealTimeChips=document.getElementById('mealTimeQuick');
  mealTimeChips?.classList.toggle('is-rail-collapsed',!!S.mealTimeCutsCollapsed);
  mealTimeChips?.setAttribute('aria-hidden',String(!!S.mealTimeCutsCollapsed));
 }else{
  section.classList.toggle('is-collapsed',collapsed);
 }
 toggle.classList.toggle('is-open',!collapsed);
 toggle.setAttribute('aria-expanded',String(!collapsed));
 toggle.setAttribute('aria-label',(collapsed?'Show ':'Hide ')+'Cuisine');
 toggle.title=collapsed?'Show Cuisine':'Hide Cuisine';
 chips.setAttribute('aria-hidden',String(collapsed));
}
function bindQuickCutsCollapse(kind){
 const section=kind==='food'?document.querySelector('#food .quick-section'):document.querySelector('#restaurant .restaurant-quick-section');
 const toggle=kind==='food'?document.getElementById('foodQuickToggle'):section?.querySelector('.quick-cuts-collapse-toggle');
 if(!toggle)return;
 toggle.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   if(kind==='restaurant'){
     setRestaurantRefinePanel('cuisine');
     save();
     return;
   }
   const nextOpen=!!S.quickCutsCollapsed?.[kind];
   S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),[kind]:!nextOpen};
   if(!nextOpen && kind==='food'){
    // Meal Times and Cuisine Cuts are mutually exclusive on the Meals screen.
    S.mealTimeCutsCollapsed=true;
    renderMealTimeCuts();
   }
   renderQuickCutsCollapse(kind);
   save();
 };
 renderQuickCutsCollapse(kind);
}
function mealTimeFilterNames(){
 const available=mealTimeOptions().filter(x=>x.enabled).map(x=>String(x.name||'').trim()).filter(Boolean);
 return [...new Set(available)];
}
function normalizeMealTimeFilter(){
 const available=mealTimeFilterNames();
 const allowed=new Set(available);
 const incoming=[...(S.mealTimeFilters||[])].map(currentMealTimeName).map(x=>String(x||'').trim()).filter(x=>allowed.has(x));
 const selected=new Set(incoming);
 // The canonical default is ALL Meal Times. Never persist an invalid/empty filter.
 if(!selected.size&&available.length)available.forEach(name=>selected.add(name));
 S.mealTimeFilters=selected;
 return {available,selected};
}
function renderMealTimeCuts(){
 const toggle=document.getElementById('foodMealTimeToggle');
 const chips=document.getElementById('mealTimeQuick');
 if(!toggle||!chips)return;

 const {available,selected}=normalizeMealTimeFilter();
 const allSelected=available.length>0&&available.every(name=>selected.has(name));
 const activeLabels=available.filter(name=>selected.has(name));
 const summary=allSelected?'All Meal Times':activeLabels.join(', ');
 const collapsed=!!S.mealTimeCutsCollapsed;
 if(!collapsed && !S.quickCutsCollapsed?.food){
  // Hard-lock the Meals refine panels: opening Meal Times closes Cuisine.
  S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:true,restaurant:true}),food:true};
  const cuisineChips=document.getElementById('foodQuick');
  cuisineChips?.classList.add('is-rail-collapsed');
  cuisineChips?.setAttribute('aria-hidden','true');
 }

 // The header behaves like Cuisine: normal state is restrained; only the
 // opened control goes white. Filter selection itself does not recolor the
 // header button.
 toggle.classList.toggle('is-open',!collapsed);
 toggle.classList.remove('is-active');
 toggle.setAttribute('aria-expanded',String(!collapsed));
 toggle.setAttribute('aria-pressed',String(!collapsed));
 toggle.setAttribute('data-all-selected',allSelected?'true':'false');
 toggle.setAttribute('data-selected-count',String(activeLabels.length));
 toggle.setAttribute('aria-label',(collapsed?'Show ':'Hide ')+'Meal Times'+(allSelected?'':' — '+summary));
 toggle.title=(collapsed?'Show ':'Hide ')+'Meal Times'+(allSelected?'':' — '+summary);

 chips.classList.toggle('is-rail-collapsed',collapsed);
 chips.setAttribute('aria-hidden',String(collapsed));
 chips.dataset.selected=activeLabels.join('|');
 chips.dataset.allSelected=allSelected?'true':'false';
 chips.innerHTML=available.map(label=>{
   const active=selected.has(label);
   return '<button class="chip meal-time-chip'+(active?' is-active':'')+'" data-meal-time="'+esc(label)+'" data-active="'+(active?'true':'false')+'" type="button" aria-pressed="'+(active?'true':'false')+'">'+esc(label)+'</button>';
 }).join('');

 chips.querySelectorAll('[data-meal-time]').forEach(btn=>{
  btn.onclick=(event)=>{
   event.preventDefault();
   event.stopPropagation();
   const label=currentMealTimeName(btn.dataset.mealTime);
   if(!label||!available.includes(label))return;

   const next=new Set(S.mealTimeFilters||[]);
   if(next.has(label)){
    // At least one Meal Time stays selected; otherwise the state would become
    // ambiguous. To get ALL, simply reselect the removed time.
    if(next.size>1)next.delete(label);
   }else{
    next.add(label);
   }
   S.mealTimeFilters=new Set([...next].filter(name=>available.includes(name)));
   normalizeMealTimeFilter();
   S.index=0;
   buildFood();
   drawFood();
   renderMealTimeCuts();
   save();
  };
 });
}
function bindMealTimeCuts(){
 const toggle=document.getElementById('foodMealTimeToggle');
 if(!toggle)return;
 toggle.onclick=(event)=>{
  event.preventDefault();
  event.stopPropagation();
  const nextOpen=!!S.mealTimeCutsCollapsed;
  S.mealTimeCutsCollapsed=!nextOpen;
  if(!nextOpen){
   // Meal Times and Cuisine Cuts are mutually exclusive on the Meals screen.
   S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),food:true};
   renderQuickCutsCollapse('food');
  }
  renderMealTimeCuts();
  save();
 };
 renderMealTimeCuts();
}
function foodQuick() {
 const labels=foodQuickLabels();
 const existing=[...document.querySelectorAll('#foodQuick [data-food-quick]')].map(btn=>btn.dataset.foodQuick);
 if(existing.length!==labels.length||existing.some((x,i)=>x!==labels[i])){
  $('foodQuick').innerHTML = labels.map(label => {
   const src=foodQuickImage(label);
   return '<button class="chip photo-chip" data-food-quick="'+esc(label)+'"><img class="quick-chip-photo" src="'+esc(src)+'" alt="'+esc(label)+' meal photo" draggable="false"><span>'+esc(label)+'</span></button>';
  }).join('');
  bindImageFallbackAttrs('[data-food-quick] img');
 }
 document.querySelectorAll('#foodQuick [data-food-quick]').forEach(btn => {
  const label=btn.dataset.foodQuick;
  const img=btn.querySelector('.quick-chip-photo');if(img)img.src=foodQuickImage(label);
  btn.classList.toggle('cut',S.cutCats.has(label));
  btn.onclick = () => {
   S.cutCats.has(label) ? S.cutCats.delete(label) : S.cutCats.add(label);
   S.index=0;
   buildFood();
   foodQuick();
   drawFood();
   save();
  };
 });
 bindQuickCutsCollapse('food');
 renderMealTimeCuts();
 bindMealTimeCuts();
}
function clearLegacySwipeInstructions(){
 document.querySelectorAll('.swipe-card-coach,.swipe-hint,[data-swipe-instruction="true"]').forEach(el=>el.remove());
}
function dismissSwipeHint(){
 clearLegacySwipeInstructions();
 try{localStorage.setItem('dinliminate.swipeHint.v5','1')}catch{}
}
document.addEventListener('pointerdown',event=>{
 const target=event.target;
 if(!(target instanceof Element))return;
 if(target.closest('#food .card,#restaurant .card,#food .unified-swipe-actions .round-action,#restaurant .unified-swipe-actions .round-action')){
   dismissSwipeHint();
 }
},true);
function maybeShowInCardSwipeCoach(){
 try{if(localStorage.getItem('dinliminate.swipeHint.v5')||localStorage.getItem('dinliminate.swipeHint.v4')){clearLegacySwipeInstructions();return;}}catch{}
 const card=S.screen==='restaurant' ? $('restaurantCard') : $('foodCard');
 if(!card || card.querySelector('.swipe-card-coach'))return;
 const coach=document.createElement('div');
 coach.className='swipe-card-coach';
 coach.setAttribute('role','note');
 coach.setAttribute('aria-label','Swipe left to Cut or right for Maybe. This lesson disappears after your first meaningful interaction.');
 coach.innerHTML='<span class="swipe-card-coach-cut">← CUT</span><span class="swipe-card-coach-mid">· SWIPE ·</span><span class="swipe-card-coach-maybe">MAYBE →</span>';
 card.appendChild(coach);
}

function startFood(options={}) {
S.foodActions = [];
S.maybe.clear();
S.maybeDeck = false;
S.foodMaybeRound = false;
S.cutCats.clear();
S.foodCuts.clear();
S.mealTimeFilters = new Set(mealTimeNames());
S.index = 0;
S.winnerItem = null;
buildFood();
foodQuick();
show('food');
drawFood();
save();
maybeShowInCardSwipeCoach();
if(tutorialModeEnabled()&&tutorialState.active){
 const resumeIndex=Number.isInteger(options?.tutorialResumeIndex)?options.tutorialResumeIndex:0;
 tutorialEnterDecisionScreen('food',resumeIndex);
}
}
function setChoiceCount(el,count){
 const value=Number(count)||0;
 const next=String(value);
 if(!el||el.textContent===next)return;
 el.textContent=next;
 el.classList.remove('count-updated');
 void el.offsetWidth;
 el.classList.add('count-updated');
 clearTimeout(el.__countPulseTimer);
 el.__countPulseTimer=window.setTimeout(()=>el.classList.remove('count-updated'),380);
}
function foodChoiceIndex(rows,start,keepState=false){
 const len=rows.length;if(!len)return -1;
 for(let step=0;step<len;step++){const i=(start+step)%len;if(keepState?S.maybe.has(rows[i].id):!S.maybe.has(rows[i].id))return i;}
 return -1;
}
function drawFood(){
 // CP1197: restore the visual waiting card, but never promote it into the live card.
 // The live meal card remains the only swipeable/committed card; the waiting card is
 // a separate, pointer-inert preview that is refreshed independently.
 if(!S.pool.length){winner({name:'Nothing left — hungry mode',image:HUNGRY_IMAGE,category:'Hungry'});return;}
 if(S.maybeDeck){
  S.index=Math.max(0,Math.min(S.index,S.pool.length-1));
 }else if(!S.foodMaybeRound){
  const ni=foodChoiceIndex(S.pool,S.index,false);
  if(ni>=0)S.index=ni;
  else if(S.maybe.size)S.foodMaybeRound=true;
 }
 const item=S.pool[S.index],img=$('foodImg');if(!img)return;
 const photoRefs=mealPhotoList(item),photoCount=photoRefs.length||1,photoIndex=0;item._mealPhotoIndex=0;
 const foodCard=$('foodCard');if(foodCard)foodCard.dataset.mealId=item.id;
 const handoffRendering=!!foodSwipeHandoff;
 const loadToken=String(Number(img.dataset.mealLoadToken||0)+1);
 img.dataset.mealLoadToken=loadToken;
 let mealReadyResolve=()=>{};
 const mealReadyPromise=new Promise(resolve=>{mealReadyResolve=resolve;});
 if(foodCard){
  foodCard.dataset.mealLoadToken=loadToken;
  foodCard.__mealReadyPromise=mealReadyPromise;
 }
 img.dataset.fallback=foodPhotoFallback(item);
 img.dataset.finalFallback=FINAL_FOOD_IMAGE;
 img.alt=item.name;img.referrerPolicy='no-referrer';img.loading='eager';img.decoding='async';
 img.dataset.imageFallback='true';
 img.onerror=function(){
  const fb=this.dataset.fallback||'',current=this.currentSrc||this.src;
  if(fb&&current!==fb){this.src=fb;return;}
  markMealImageUnavailable(this);
 };
 const primaryPhoto=foodPhoto(item),backupPhoto=foodPhotoFallback(item);
 // Paint the approved meal photo immediately. A failed request falls through
 // to the exact meal backup rather than leaving a blank card.
 img.style.visibility='visible';
 // CP1187: during swipe handoff the recycled card stays hidden until the promoted
 // next card has become the authoritative current card. Safari otherwise can
 // repaint the recycled card for one frame before the next card is ready.
 if(handoffRendering&&foodCard){
   foodCard.style.opacity='0';
   foodCard.style.visibility='hidden';
   foodCard.style.pointerEvents='none';
 }
 img.dataset.imageFallback='false';
 if(primaryPhoto)img.src=primaryPhoto;
 else if(backupPhoto)img.src=backupPhoto;
 else markMealImageUnavailable(img);
 if(foodCard){loadMealPhotoCandidates(img,[primaryPhoto,backupPhoto],foodCard).then(ok=>{
  if(String(img.dataset.mealLoadToken||'')===loadToken){
   if(!ok)markMealImageUnavailable(img);
   mealReadyResolve(!!ok);
  }else{
   mealReadyResolve(false);
  }
 });}else{
  mealReadyResolve(false);
 }
 if(foodCard){
  foodCard.querySelector('.maybe-stamp')?.remove();
  const photoPager=ensureMealCardPhotoPager(foodCard,photoCount,photoIndex);
  img.onclick=null;
  if(S.maybe.has(item.id)){const stamp=document.createElement('span');stamp.className='maybe-stamp';stamp.setAttribute('aria-label','Marked Maybe');stamp.textContent='MAYBE';foodCard.appendChild(stamp);}
 }
 $('foodName').textContent=item.name;$('foodCat').textContent=item.category;
 if(photoCount>1){hydrateMealPhotoGallery(item).then(photos=>{
  if(S.pool[S.index]!==item||String(img.dataset.mealLoadToken||'')!==loadToken)return;
  const usable=photos.filter(Boolean);
  const total=usable.length||1;
  const idx=Math.max(0,Math.min(Number(item._mealPhotoIndex||0),total-1));
  item._mealPhotoIndex=idx;
  if(usable[idx])swapImageWhenReady(img,usable[idx]);
  ensureMealCardPhotoPager(foodCard,usable.length>1?usable.length:1,idx);
 });}
 const foodBackButton=$('foodBack');if(foodBackButton){const familyBack=familyIsBrowseStage('meal')&&!familyBrowseSubmitted();foodBackButton.disabled=!familyBack&&S.foodActions.length===0;foodBackButton.setAttribute('aria-disabled',String(!familyBack&&S.foodActions.length===0));}
 renderMaybeDeckToggle('food');
 // CP1197: prepare the visual waiting card independently. It is never promoted.
 if(!foodSwipeHandoff)primeFoodSwipeMedia();
 maybeShowInCardSwipeCoach();if(!foodSwipeHandoff)bindFoodSwipe();bindMaybeDeckToggle('food');if(S.familyNormalMode==='setup'&&S.familyDecisionType==='meal')familyNormalBar('meal','setup',S.familyActiveData);bindCardButton('foodDetails',()=>detailsSheet(item,'food'));if($('foodChoose'))bindCardButton('foodChoose',()=>{dismissSwipeHint();if(S.familyNormalMode==='decision'&&S.familyDecisionType==='meal'){familyRoundStage()===1?familyEnterMaybes('meal'):familyPickSingle('meal');}else winner(item)});bindCardButton('foodCut',()=>foodCut());bindCardButton('foodMaybe',()=>foodMaybe());bindCardButton('foodBack',foodBack);
}
function foodCommit(type,item){const unkept=S.pool.filter(x=>!S.maybe.has(x.id)).length;S.foodActions.push({type,id:item.id,primary:item.primary,index:S.index,maybeRound:!!S.foodMaybeRound,hadMaybe:S.maybe.has(item.id),recycleOnUndo:type==='cut'&&S.maybe.size>0&&unkept===1});}
function foodCut(item=S.pool[S.index]){
 dismissSwipeHint();
 if(S.familyNormalMode==='decision'&&S.familyDecisionType==='meal'&&familyRoundStage()!==1){familyBrowsePrevious('meal');return;}
 if(!item)return;
 const unkept=S.pool.filter(x=>!S.maybe.has(x.id)).length;
 foodCommit('cut',item);
 const roundAfter=!!S.foodMaybeRound|| (S.maybe.size>0 && unkept<=1);
 S.foodActions[S.foodActions.length-1].roundAfter=roundAfter;
 S.foodCuts.add(item.id);buildFood();resolveFoodAfterDecision();
}
function foodMaybe(item=S.pool[S.index]){
 dismissSwipeHint();
 if(S.familyNormalMode==='decision'&&S.familyDecisionType==='meal'&&familyRoundStage()!==1){familyBrowseNext('meal');return;}
 if(!item)return;
 if(S.pool.length===1){foodCommit('maybe',item);winner(item);return;}
 foodCommit('maybe',item);S.maybe.add(item.id);
 if(!S.foodMaybeRound){
  const ni=foodChoiceIndex(S.pool,(S.index+1)%S.pool.length,false);
  if(ni>=0)S.index=ni;else{S.foodMaybeRound=true;S.index=foodChoiceIndex(S.pool,(S.index+1)%S.pool.length,true);}
 }else S.index=foodChoiceIndex(S.pool,(S.index+1)%S.pool.length,true);
 drawFood();save();
}
function resolveFoodAfterDecision(){
 if(!S.pool.length){winner({name:'Nothing left — hungry mode',image:HUNGRY_IMAGE,category:'Hungry'});return;}
 if(!S.foodMaybeRound){const ni=foodChoiceIndex(S.pool,S.index,false);if(ni>=0)S.index=ni;else if(S.maybe.size){S.foodMaybeRound=true;S.index=foodChoiceIndex(S.pool,0,true);}}
 S.index=Math.max(0,Math.min(S.index,S.pool.length-1));drawFood();save();
}
function foodBack(){
 if(familyIsBrowseStage('meal')){familyBrowseBack('meal');return;}
 const action=S.foodActions.pop();if(!action)return;
 if(action.type==='cut')S.foodCuts.delete(action.id);
 if(action.type==='maybe'){if(action.hadMaybe)S.maybe.add(action.id);else S.maybe.delete(action.id);}
 S.foodMaybeRound=!!action.maybeRound||!!action.recycleOnUndo||!!action.roundAfter;buildFood();
 const restored=S.pool.findIndex(x=>x.id===action.id);S.index=restored>=0?restored:Math.max(0,Math.min(action.index||0,Math.max(0,S.pool.length-1)));drawFood();save();
}

function triggerSwipeHaptic(){
 try{
  const nativeHandler=window?.webkit?.messageHandlers?.haptic;
  if(nativeHandler?.postMessage){nativeHandler.postMessage('light');return true;}
 }catch{}
 try{
  if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function'){
   return !!navigator.vibrate(8);
  }
 }catch{}
 return false;
}

function waitForSwipeImage(img,card,key,timeoutMs=1400){
 if(!img||!card)return Promise.resolve(false);
 const token=String(card.dataset.swipePreviewToken||'');
 const expectedKey=String(key??'');
 const sameTarget=()=>card.isConnected
   && String(card.dataset.swipePreviewToken||'')===token
   && String(card.dataset.swipePreviewKey||'')===expectedKey
   && card.querySelector('img')===img;
 let previousCleanup=img.__swipePreviewCleanup;
 if(typeof previousCleanup==='function'){try{previousCleanup();}catch{}}
 return new Promise(resolve=>{
  let done=false,timer=0;
  const cleanup=()=>{
   img.removeEventListener('load',onLoad);
   img.removeEventListener('error',onError);
   clearTimeout(timer);
   if(img.__swipePreviewCleanup===cleanup)img.__swipePreviewCleanup=null;
  };
  const finish=ok=>{
   if(done)return;
   done=true;
   cleanup();
   resolve(!!ok);
  };
  const decodeThenFinish=()=>{
   if(!sameTarget()){finish(false);return;}
   if(!img.complete||img.naturalWidth===0)return;
   const decoded=typeof img.decode==='function'?img.decode():Promise.resolve();
   Promise.resolve(decoded).catch(()=>{}).then(()=>{
    if(!sameTarget()){finish(false);return;}
    finish(img.naturalWidth>0);
   });
  };
  const onLoad=()=>decodeThenFinish();
  const onError=()=>{
   // An img.onerror fallback may replace src in the same event turn.
   window.setTimeout(()=>{
    if(!sameTarget()){finish(false);return;}
    if(img.complete&&img.naturalWidth>0){decodeThenFinish();return;}
    const current=String(img.currentSrc||img.src||'');
    const candidate=(()=>{try{return new URL(String(img.dataset.swipePreviewSrc||''),location.href).href;}catch{return String(img.dataset.swipePreviewSrc||'');}})();
    if(candidate && current!==candidate)return;
    finish(false);
   },0);
  };
  img.__swipePreviewCleanup=cleanup;
  img.addEventListener('load',onLoad);
  img.addEventListener('error',onError);
  timer=window.setTimeout(()=>{
   if(img.complete&&img.naturalWidth>0){decodeThenFinish();return;}
   finish(false);
  },timeoutMs);
  decodeThenFinish();
 });
}

function stageSwipePreview(card,img,src,key){
 if(!card||!img||!src)return Promise.resolve(false);
 const nextToken=String((Number(card.dataset.swipePreviewToken||0)+1));
 const previewKey=String(key??'');
 card.dataset.swipePreviewToken=nextToken;
 card.dataset.swipePreviewKey=previewKey;
 card.dataset.swipePreviewReady='0';
 card.__swipePreviewReadyPromise=null;
 card.style.transition='none';
 card.style.transform='scale(1)';
 card.style.opacity='1';
 card.style.filter='none';
 card.style.visibility='hidden';
 img.decoding='async';
 img.dataset.swipePreviewSrc=String(src);
 img.src=String(src);
 const ready=waitForSwipeImage(img,card,previewKey);
 card.__swipePreviewReadyPromise=ready;
 ready.then(ok=>{
  if(String(card.dataset.swipePreviewToken||'')!==nextToken)return;
  if(String(card.dataset.swipePreviewKey||'')!==previewKey)return;
  if(!card.isConnected||card.querySelector('img')!==img)return;
  card.dataset.swipePreviewReady=ok?'1':'0';
  if(ok&&!card.dataset.swipePromoted){
   card.style.visibility='visible';
   card.style.transition='';
  }
 });
 return ready;
}

async function ensureSwipePreviewReady(card){
 if(!card)return false;
 const pending=card.__swipePreviewReadyPromise;
 if(pending){
  const ok=await pending;
  if(ok)return true;
 }
 const img=card.querySelector('img');
 const fallback=String(img?.dataset?.fallback||'').trim();
 if(!img||!fallback)return false;
 let current='';
 try{current=String(new URL(img.currentSrc||img.src||'',location.href).href);}catch{current=String(img.currentSrc||img.src||'');}
 let fallbackUrl='';
 try{fallbackUrl=String(new URL(fallback,location.href).href);}catch{fallbackUrl=fallback;}
 if(fallbackUrl&&current===fallbackUrl)return false;
 const retry=stageSwipePreview(card,img,fallback,card.dataset.swipePreviewKey||'');
 return await retry;
}


const preparedFoodSwipeCards=new Map();
const FOOD_SWIPE_PRELOAD_DEPTH=3;

function nextFoodIndexList(count=FOOD_SWIPE_PRELOAD_DEPTH){
 const pool=Array.isArray(S.pool)?S.pool:[];
 if(pool.length<2)return [];
 const currentIndex=Math.max(0,Math.min(Number(S.index)||0,Math.max(0,pool.length-1)));
 const out=[],seen=new Set([currentIndex]);
 let cursor=currentIndex;
 for(let step=0;step<count;step++){
  let ni;
  if(S.maybeDeck){
   ni=(cursor+1)%pool.length;
  }else{
   ni=S.foodMaybeRound
    ?foodChoiceIndex(pool,(cursor+1)%pool.length,true)
    :foodChoiceIndex(pool,(cursor+1)%pool.length,false);
   if(ni<0&&pool.length>1)ni=(cursor+1)%pool.length;
  }
  if(ni<0||!pool[ni]||seen.has(ni))break;
  out.push(ni);
  seen.add(ni);
  cursor=ni;
 }
 return out;
}

function buildPreparedFoodCard(item){
 if(!item)return null;
 const refs=mealPhotoList(item);
 return {
  id:String(item.id||item.name||''),
  name:String(item.name||''),
  category:String(item.category||''),
  maybe:S.maybe.has(item.id),
  primary:foodPhoto(item),
  backup:foodPhotoFallback(item),
  photoRefs:refs,
  photoCount:refs.length||1
 };
}

function cachePreparedFoodCards(){
 const pool=Array.isArray(S.pool)?S.pool:[];
 const indices=nextFoodIndexList();
 const active=new Set();
 for(const index of indices){
  const item=pool[index];if(!item)continue;
  const view=buildPreparedFoodCard(item);if(!view?.id)continue;
  active.add(view.id);
  preparedFoodSwipeCards.set(view.id,view);
  preloadSwipeImage(view.primary);
  preloadSwipeImage(view.backup);
 }
 for(const id of [...preparedFoodSwipeCards.keys()]){
  if(!active.has(id))preparedFoodSwipeCards.delete(id);
 }
 return indices.map(index=>pool[index]).filter(Boolean);
}

function ensurePreparedFoodNextCardMarkup(nextCard){
 if(!nextCard)return null;
 let img=nextCard.querySelector('img.next-food-img')||nextCard.querySelector('img#foodNextImg');
 if(!img){
  img=document.createElement('img');
  nextCard.insertBefore(img,nextCard.firstChild);
 }
 img.classList.add('next-food-img');
 img.removeAttribute('id');

 let copy=nextCard.querySelector('.next-food-copy');
 if(!copy){
  copy=document.createElement('div');
  copy.className='card-copy next-food-copy';
  copy.innerHTML='<div class="card-info-row card-cuisine-row food-cuisine-row"><small class="next-food-cat card-cuisine-text"></small><span class="card-details-inline card-details-visual" aria-hidden="true"><svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 7.25h2M11 7.25h7M6 12h2M11 12h7M6 16.75h2M11 16.75h5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><h3 class="next-food-name"></h3>';
  nextCard.appendChild(copy);
 }
 let nameEl=copy.querySelector('.next-food-name');
 let catEl=copy.querySelector('.next-food-cat');
 if(!nameEl){
  nameEl=document.createElement('h3');
  nameEl.className='next-food-name';
  copy.appendChild(nameEl);
 }
 if(!catEl){
  catEl=document.createElement('small');
  catEl.className='next-food-cat';
  const row=copy.querySelector('.card-cuisine-row')||copy;
  row.insertBefore(catEl,row.firstChild);
 }
 return {img,nameEl,catEl};
}

function setFoodNextCardImage(nextCard,view){
 const parts=ensurePreparedFoodNextCardMarkup(nextCard);
 const img=parts?.img;
 if(!img)return Promise.resolve(false);
 const primary=String(view?.primary||'').trim();
 const backup=String(view?.backup||'').trim();
 const loadToken=String(Number(nextCard.dataset.mealLoadToken||0)+1);
 nextCard.dataset.mealLoadToken=loadToken;
 nextCard.dataset.foodImageReady='0';
 nextCard.dataset.foodImageSource='';
 img.alt=view.name||'';
 img.referrerPolicy='no-referrer';
 img.loading='eager';
 img.decoding='async';
 img.draggable=false;
 img.dataset.fallback=backup;
 img.dataset.finalFallback=FINAL_FOOD_IMAGE;
 img.dataset.imageFallback='true';
 img.onerror=function(){
  const fb=this.dataset.fallback||'',current=this.currentSrc||this.src;
  if(fb&&current!==fb){this.src=fb;this.dataset.imageFallback='false';return;}
  markMealImageUnavailable(this);
 };
 // Do not make the waiting card itself invisible while the photo warms up.
 img.style.visibility='visible';
 nextCard.style.visibility='visible';
 if(primary)img.src=primary;
 else if(backup)img.src=backup;
 else markMealImageUnavailable(img);
 nextCard.style.pointerEvents='none';
 const promise=loadMealPhotoCandidates(img,[primary,backup],nextCard).then(ok=>{
  if(!ok&&String(nextCard.dataset.mealLoadToken||'')===loadToken)markMealImageUnavailable(img);
  if(String(nextCard.dataset.mealLoadToken||'')===loadToken)nextCard.dataset.foodImageReady=ok?'1':'-1';
  return ok;
 });
 nextCard.__foodReadyPromise=promise;
 nextCard.__foodImageReadyPromise=promise;
 return promise;
}

function populateFoodNextCard(view){
 const nextCard=$('foodNextCard');
 if(!nextCard)return Promise.resolve(false);
 nextCard.classList.toggle('hidden',!view);
 nextCard.style.display=view?'block':'none';
 nextCard.style.visibility='hidden';
 nextCard.style.transition='none';
 nextCard.style.transform='none';
 nextCard.style.opacity='1';
 nextCard.style.filter='none';
 nextCard.style.pointerEvents='none';
 nextCard.dataset.swipePromoted='';
 nextCard.dataset.mealId=view?.id||'';
 nextCard.dataset.foodReady='0';
 nextCard.dataset.foodImageReady='0';

 const parts=ensurePreparedFoodNextCardMarkup(nextCard);
 const nameEl=parts?.nameEl;
 const catEl=parts?.catEl;
 if(nameEl)nameEl.textContent=view?.name||'';
 if(catEl)catEl.textContent=view?.category||'';

 nextCard.querySelector('.maybe-stamp')?.remove();
 if(view?.maybe){
  const stamp=document.createElement('span');
  stamp.className='maybe-stamp';
  stamp.setAttribute('aria-label','Marked Maybe');
  stamp.textContent='MAYBE';
  nextCard.appendChild(stamp);
 }

 if(!view)return Promise.resolve(false);

 return setFoodNextCardImage(nextCard,view).then(ok=>{
  if(nextCard.dataset.mealId!==view.id)return false;
  nextCard.dataset.foodReady=ok?'1':'-1';
  nextCard.style.visibility='visible';
  return ok;
 });
}

function prepareFoodNextCard(){
 const pool=Array.isArray(S.pool)?S.pool:[];
 const indices=nextFoodIndexList(1);
 const next=indices.length?pool[indices[0]]:null;
 const view=next?preparedFoodSwipeCards.get(String(next.id||next.name||''))||buildPreparedFoodCard(next):null;
 if(view)preparedFoodSwipeCards.set(view.id,view);
 return populateFoodNextCard(view);
}

function ensureFoodNextCardReady(nextCard){
 if(!nextCard)return Promise.resolve(false);
 if(nextCard.dataset.foodReady==='1')return Promise.resolve(true);
 if(nextCard.__foodReadyPromise)return nextCard.__foodReadyPromise;
 return Promise.resolve(false);
}

const swipeImagePreloads=new Map();
function preloadSwipeImage(src){
 const url=String(src||'').trim();if(!url)return;
 if(swipeImagePreloads.has(url))return;
 const img=new Image();
 img.decoding='async';
 img.loading='eager';
 img.referrerPolicy='no-referrer';
 img.src=url;
 swipeImagePreloads.set(url,img);
 while(swipeImagePreloads.size>12){
  const first=swipeImagePreloads.keys().next().value;
  swipeImagePreloads.delete(first);
 }
 try{img.decode?.().catch(()=>{});}catch{}
}

function primeFoodSwipeMedia(){
 const nextItems=cachePreparedFoodCards();
 const next=nextItems[0];
 const nextView=next?preparedFoodSwipeCards.get(String(next.id||next.name||''))||buildPreparedFoodCard(next):null;
 if(nextView)preparedFoodSwipeCards.set(nextView.id,nextView);
 return populateFoodNextCard(nextView);
}

function bindRestaurantPhotoPinch(target){
  const img=target?.tagName==='IMG'?target:target?.querySelector?.('img');
  if(!img)return;
  if(img.dataset.restaurantPinchBound==='1'){img.style.transform='none';return;}
  img.dataset.restaurantPinchBound='1';
  img.classList.add('restaurant-photo-zoomable');
  img.style.touchAction='none';
  img.style.transformOrigin='center center';
  const surface=img.closest('.card')||img,points=new Map();let scale=1,startDistance=0,startScale=1,pinching=false;
  const distance=()=>{const p=[...points.values()];return p.length<2?0:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);};
  const apply=()=>{img.style.transform=scale<=1.01?'none':'scale('+scale.toFixed(3)+')';};
  const finishPointer=e=>{points.delete(e.pointerId);if(points.size<2){pinching=false;if(scale<=1.01){scale=1;apply();}}};
  surface.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'||!e.target.closest?.('img'))return;
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(points.size===2){pinching=true;startDistance=Math.max(1,distance());startScale=scale;e.preventDefault();}
  },{passive:false});
  surface.addEventListener('pointermove',e=>{
    if(!pinching||e.pointerType!=='touch')return;
    const p=points.get(e.pointerId);if(!p)return;
    p.x=e.clientX;p.y=e.clientY;
    const d=distance();if(!d)return;
    scale=Math.max(1,Math.min(3.5,startScale*(d/startDistance)));apply();e.preventDefault();
  },{passive:false});
  surface.addEventListener('pointerup',finishPointer,{passive:true});
  surface.addEventListener('pointercancel',finishPointer,{passive:true});
}
function bindSwipeCard(cardId,nextId,onCut,onMaybe,options={}) {
 const card=$(cardId);if(!card)return;
 const isOverlapCard=options?.overlap===true;
 const next=$(nextId);
 const staticWaitingCard=cardId==='foodCard';
 const swipeBindingToken=String((Number(card.dataset.swipeBindingToken||0)+1));
 card.dataset.swipeBindingToken=swipeBindingToken;
 const inheritedSwipeLock=card.dataset.swipeTransaction==='active';

 // CP988: one physical gesture = one transaction. A committed card is
 // immediately removed from pointer input until its handoff is complete.
 let downX=0,lastX=0,lastMoveX=0,lastMoveTime=0,velocityX=0;
 // CP1171: preserve the transaction lock across draw/rebind cycles.
 let phase=inheritedSwipeLock?'locked':'idle',hapticTriggered=false,pointerId=null,suppressClickUntil=0,moveFrame=null;
 // CP1218 — tighter, quicker swipe feel without changing the card-stack architecture.
 let swipeThreshold=88,completionTimer=0,exitAnimation=null;

 card.style.touchAction='none';
 card.style.userSelect='none';
 card.style.webkitUserSelect='none';
 card.style.webkitTouchCallout='none';
 card.style.pointerEvents='auto';
 card.dataset.swipePhase=phase;

 card.querySelectorAll('img').forEach(img=>{
  img.draggable=false;
  if(img.dataset.swipeDragBound==='1')return;
  img.dataset.swipeDragBound='1';
  img.addEventListener('dragstart',e=>e.preventDefault(),{passive:false});
 });

 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const cancelMoveFrame=()=>{
  if(moveFrame!=null){
   try{cancelAnimationFrame(moveFrame);}catch{}
   moveFrame=null;
  }
 };
 const clearCompletionTimer=()=>{
  if(completionTimer){clearTimeout(completionTimer);completionTimer=0;}
 };
 const cardWidth=()=>Math.max(280,Number(card.clientWidth)||430);

 const resetCard=()=>{
  cancelMoveFrame();
  clearCompletionTimer();
  if(exitAnimation){try{exitAnimation.cancel();}catch{}exitAnimation=null;}
  card.classList.remove('swipe-active');
  card.style.transition='';
  card.style.transform='';
  card.style.opacity='1';
  card.style.visibility='visible';
  card.style.pointerEvents='auto';
  card.style.removeProperty('--swipe-tint-alpha');
  card.dataset.swipe='';
  card.dataset.swipePhase='idle';
  card.dataset.swipeTransaction='';
  phase='idle';
  if(next){
   if(staticWaitingCard)next.style.transform='none';else next.style.transform='scale(1)';
   next.style.opacity='1';
   next.style.filter='none';
   next.style.visibility='visible';
   next.dataset.swipePromoted='';
   const nextImg=next.querySelector('img');
   if(nextImg)nextImg.style.transform=staticWaitingCard?'none':'scale(1)';
  }
 };

 const settleBack=()=>{
  cancelMoveFrame();
  if(phase!=='dragging'&&phase!=='idle')return;
  phase='idle';
  card.classList.remove('swipe-active');
  card.style.transition='transform .18s cubic-bezier(.22,1,.36,1),opacity .18s ease';
  card.style.transform='translate3d(0,0,0) rotate(0deg)';
  card.style.opacity='1';
  card.style.visibility='visible';
  card.style.pointerEvents='auto';
  card.style.setProperty('--swipe-tint-alpha','0');
  card.dataset.swipe='';
  card.dataset.swipePhase='idle';
  window.setTimeout(()=>{
   if(phase==='idle'){
    card.style.transition='';
    card.style.transform='';
    if(isOverlapCard){
     const ctx=swipeOverlapContext;
     if(ctx?.clone===card){
      ctx.nextSettled=true;
      try{card.remove();}catch{}
      if(ctx.previewCard?.isConnected){
       ctx.previewCard.style.visibility='visible';
       ctx.previewCard.style.pointerEvents='none';
       ctx.previewCard.dataset.swipePromoted='';
      }
      if(ctx.sourceFlightDone&&ctx.sourceComplete&&!ctx.flushing){
       ctx.flushing=true;
       const sourceComplete=ctx.sourceComplete;
       swipeOverlapContext=null;
       Promise.resolve(sourceComplete()).catch(()=>{});
      }
     }
    }
   }
  },185);
 };

 const releasePointer=()=>{
  try{if(pointerId!=null&&card.hasPointerCapture?.(pointerId))card.releasePointerCapture(pointerId);}catch{}
  pointerId=null;
 };

 const cancel=()=>{
  if(phase!=='dragging')return;
  phase='idle';
  hapticTriggered=false;
  velocityX=0;
  releasePointer();
  settleBack();
 };

 // CP1181: repaired completeAfterExit from known-good CP1179 flow.
const completeAfterExit=async ()=>{
  if(phase!=='committing')return;
  clearCompletionTimer();
  card.removeEventListener('transitionend',handleTransitionEnd);
  const direction=String(card.dataset.swipeDirection||'');
  const action=direction==='cut'?onCut:onMaybe;
  const foodHandoff=staticWaitingCard&&cardId==='foodCard';
  const restaurantHandoff=cardId==='restaurantCard';
  // CP1181: snapshot the waiting card before action() can redraw/rebind it.
  const promotedMealId=foodHandoff?String(next?.dataset.mealId||''):'';
  const promotedImg=foodHandoff?next?.querySelector('img'):null;
  const promotedSrc=foodHandoff?String(promotedImg?.currentSrc||promotedImg?.src||promotedImg?.getAttribute('src')||''):'';
  const promotedAlt=foodHandoff?String(promotedImg?.alt||''):'';
  phase='completing';
  card.dataset.swipePhase='completing';
  if(foodHandoff)foodSwipeHandoff=true;
  if(restaurantHandoff)restaurantSwipeHandoff=true;

  // CP1188: once a swipe has committed, the swiped card is never allowed to
  // become visible again while the next state is being calculated. The next
  // card has already been promoted underneath it, so hiding the old card at
  // transition completion removes the one-frame Safari reappearance.
  card.style.transition='none';
  card.style.transform='none';
  card.style.opacity='0';
  card.style.visibility='hidden';
  card.style.pointerEvents='none';
  card.classList.remove('swipe-active');
  card.style.removeProperty('--swipe-tint-alpha');
  card.dataset.swipe='';

  if(foodHandoff){
   // CP1197: the waiting card remains underneath as a separate, inert preview.
   // The live card is still updated in place; the waiting card is never promoted.
  }

  try{
   await Promise.resolve(action?.());
  }catch(err){
   setTimeout(()=>{throw err;},0);
  }finally{
   if(foodHandoff){
    if(card.isConnected){
     // The action redraws the SAME live card while it is hidden. Wait for
     // that card's new meal image to settle before returning it to paint.
     try{
      const ready=card.__mealReadyPromise;
      if(ready)await Promise.race([ready,new Promise(resolve=>setTimeout(resolve,900))]);
     }catch{}
     const reveal=()=>{
      if(!card.isConnected)return;
      card.classList.remove('swipe-active');
      card.style.transition='none';
      card.style.transform='none';
      card.style.opacity='1';
      card.style.visibility='visible';
      card.style.pointerEvents='auto';
      card.style.removeProperty('--swipe-tint-alpha');
      card.dataset.swipe='';
      card.dataset.swipePhase='idle';
      card.dataset.swipeTransaction='';
      foodSwipeHandoff=false;
      // CP1246: the old overlap clone carried the visual continuity while the
      // recycled live card was preparing. Remove it only after the live card
      // is visible, never before.
      const bridge=card.__swipeVisualBridge;
      if(bridge?.isConnected){try{bridge.remove();}catch{}}
      card.__swipeVisualBridge=null;
      // CP1197b: refresh the waiting preview AFTER the live card is settled.
      // This keeps the preview one meal ahead without letting it participate
      // in the swipe handoff/promotion lifecycle.
      primeFoodSwipeMedia();
      bindFoodSwipe();
     };
     requestAnimationFrame(()=>requestAnimationFrame(reveal));
    }
   }else{
    
    // Restaurant redraws replace the card node. Never call resetCard() here:
    // that can briefly resurrect the just-swiped node while drawRestaurants()
    // is finishing its photo preparation.
    if(restaurantHandoff){
     restaurantSwipeHandoff=false;
     const freshRestaurantCard=$('restaurantCard');
     if(freshRestaurantCard){
      freshRestaurantCard.style.transition='none';
      freshRestaurantCard.style.transform='none';
      freshRestaurantCard.style.opacity='1';
      freshRestaurantCard.style.visibility='visible';
      freshRestaurantCard.style.pointerEvents='auto';
     }
    }else if(card.isConnected){
     if(isOverlapCard)card.remove();
     else resetCard();
    }else if(isOverlapCard){
     try{card.remove();}catch{}
    }
   }
  }
 };

 function handleTransitionEnd(e){
  if(phase!=='committing'||e.target!==card||e.propertyName!=='transform')return;
  completeAfterExit();
 }

 const commit=(dx,speed=0)=>{ 
  if(phase!=='dragging')return;
  cancelMoveFrame();
  phase='committing';
  card.dataset.swipePhase='committing';
  card.dataset.swipeTransaction='active';
  card.style.pointerEvents='none';
  hapticTriggered=false;
  suppressClickUntil=Date.now()+700;

  // CP1249: force the prepared waiting card into the painted stack before the
  // outgoing animation begins. The waiting card is pointer-inert; its optional
  // overlap clone is still used only for early next-card input.
  if(next?.isConnected){
   next.style.visibility='visible';
   next.style.opacity='1';
   next.style.filter='none';
   next.style.pointerEvents='none';
   next.style.willChange='transform,opacity';
  }
  releasePointer();

  const width=cardWidth();
  const direction=dx<0?-1:1;
  const decisionKind=cardId==='foodCard'?'food':'restaurant';
  const decisionId=decisionKind==='food'
    ?String(card.dataset.mealId||'')
    :String(card.querySelector('img[data-restaurant-photo-key]')?.dataset.restaurantPhotoKey||'');
  const decisionRow=decisionKind==='food'
    ?S.pool.find(item=>String(item?.id||'')===decisionId)
    :S.restaurantPool.find(item=>String(item?.id||'')===decisionId);
  // CP1218/CP1239 — count feedback lands at the commit point; data mutation
  // waits until the visual flight has completely cleared the viewport.
  previewDecisionCount(decisionKind,direction<0?'cut':'maybe',!!decisionRow?decisionKind==='food'?S.maybe.has(decisionRow.id):!!decisionRow._maybe:false);

  card.dataset.swipeDirection=direction<0?'cut':'maybe';
  card.dataset.swipeTransaction='active';

  // CP1239 — make the committed exit one atomic browser animation.
  // CP1241 — the outgoing flight remains unchanged; only the input handoff overlaps.
  // Start at the exact finger-release position, keep the card fully opaque,
  // and do not let transitionend/rebind lifecycle events control completion.
  const releaseAbs=Math.abs(dx);
  const releaseRotation=direction*clamp((releaseAbs/width)*11,0,11);
  const fromTransform='translate3d('+dx.toFixed(1)+'px,0,0) rotate('+releaseRotation.toFixed(2)+'deg)';
  card.style.transition='none';
  card.style.opacity='1';
  card.style.visibility='visible';
  card.style.transform=fromTransform;
  card.style.setProperty('--swipe-tint-alpha',String(clamp(releaseAbs/(Math.max(72,swipeThreshold)*2.7),0,.26)));
  void card.offsetWidth;

  const rect=card.getBoundingClientRect();
  const edgePadding=48;
  const remaining=direction<0 ? (rect.right+edgePadding) : (window.innerWidth-rect.left+edgePadding);
  const targetX=direction<0 ? (dx-remaining) : (dx+remaining);
  const targetTransform='translate3d('+targetX.toFixed(1)+'px,0,0) rotate('+((direction*11).toFixed(2))+'deg)';
  const magnitude=clamp(Math.abs(speed),0,2.4);
  const duration=Math.round(clamp(285-(magnitude*28),225,285));

  if(next&&!staticWaitingCard&&!isOverlapCard){
   const revealPromotedNext=()=>{
    if(!next.isConnected)return;
    const nextMealId=String(next.dataset.mealId||'');
    const activeMealId=String(card.dataset.mealId||'');
    if(staticWaitingCard&&(!nextMealId||nextMealId===activeMealId))return;
    next.dataset.swipePromoted='1';
    next.style.transition='none';
    next.style.transform=staticWaitingCard?'none':'scale(1)';
    next.style.visibility='visible';
    next.style.opacity='1';
    next.style.filter='none';
    const promotedImg=next.querySelector('img');
    if(promotedImg)promotedImg.style.transform=staticWaitingCard?'none':'scale(1)';
   };
   revealPromotedNext();
  }

  // CP1241: after a short overlap window, clone the already-prepared next card
  // into the active stack so a user can begin the next swipe before this card's
  // full flight has finished. The original preview stays intact underneath.
  if(!isOverlapCard&&next?.isConnected){
   const overlapToken=String(++swipeOverlapSerial);
   const kind=cardId==='foodCard'?'food':'restaurant';
   const nextIdValue=kind==='food'
     ?String(next.dataset.mealId||'')
     :String(next.querySelector('img[data-restaurant-photo-key]')?.dataset.restaurantPhotoKey||'');
   const nextItem=kind==='food'
     ?S.pool.find(item=>String(item?.id||'')===nextIdValue)
     :S.restaurantPool.find(row=>String(row?.id||'')===nextIdValue);
   const ctx={
    sourceCard:card,previewCard:next,token:overlapToken,clone:null,nextItem,
    nextGestureStarted:false,nextCommitted:false,nextSettled:false,
    sourceFlightDone:false,nextFlightDone:false,sourceComplete:null,nextComplete:null,flushing:false
   };
   swipeOverlapContext=ctx;
   window.setTimeout(()=>{
    if(swipeOverlapContext!==ctx||phase!=='committing'||ctx.nextGestureStarted||ctx.sourceFlightDone)return;
    if(!next.isConnected||!nextItem)return;
    const clone=next.cloneNode(true);
    clone.id='swipeOverlapCard-'+overlapToken;
    clone.classList.remove('next-card','hidden');
    clone.setAttribute('aria-hidden','false');
    clone.dataset.swipeOverlapToken=overlapToken;
    clone.dataset.swipePhase='idle';
    clone.dataset.swipeTransaction='';
    clone.style.visibility='visible';
    clone.style.opacity='1';
    clone.style.filter='none';
    clone.style.transform='none';
    clone.style.transition='none';
    clone.style.pointerEvents='auto';
    clone.style.zIndex='4';
    // CP1250: keep the real waiting card visible underneath the overlap
    // clone. The clone can become the interactive top card, but it must never
    // be the sole painted fallback; otherwise an unpainted clone can expose
    // the black stage for a frame.
    next.style.visibility='visible';
    next.style.opacity='1';
    next.style.pointerEvents='none';
    next.parentElement?.appendChild(clone);
    ctx.clone=clone;
    const cut=kind==='food'
      ?()=>familyIsBrowseStage('meal')?familyBrowseNext('meal'):foodCut(nextItem)
      :()=>familyIsBrowseStage('restaurant')?familyBrowseNext('restaurant'):restaurantCut(nextItem);
    const maybe=kind==='food'
      ?()=>familyIsBrowseStage('meal')?familyBrowsePrevious('meal'):foodMaybe(nextItem)
      :()=>familyIsBrowseStage('restaurant')?familyBrowsePrevious('restaurant'):restaurantMaybe(nextItem);
    bindSwipeCard(clone.id,'',cut,maybe,{overlap:true});
   },SWIPE_OVERLAP_DELAY);
  }

  dismissSwipeHint();
  if(exitAnimation){try{exitAnimation.cancel();}catch{}exitAnimation=null;}

  const finishFlight=()=>{
   if(phase!=='committing')return;
   if(exitAnimation){try{exitAnimation.cancel();}catch{}exitAnimation=null;}
   clearCompletionTimer();

   const ctx=swipeOverlapContext;
   if(!isOverlapCard&&ctx?.sourceCard===card){
    if(ctx.clone?.isConnected&&cardId==='foodCard')card.__swipeVisualBridge=ctx.clone;
    ctx.sourceFlightDone=true;
    ctx.sourceComplete=completeAfterExit;
    if(ctx.nextGestureStarted&&!ctx.nextSettled){
     // The first flight is visually finished, but hold its state redraw so it
     // cannot interrupt the user's in-progress next-card gesture.
     if(ctx.nextCommitted&&ctx.nextFlightDone&&!ctx.flushing){
      ctx.flushing=true;
      const sourceComplete=ctx.sourceComplete;
      const nextComplete=ctx.nextComplete;
      swipeOverlapContext=null;
      (async()=>{
       try{await sourceComplete();if(nextComplete)await nextComplete();}catch{}
      })();
     }
     return;
    }
    // CP1246: keep the already-visible overlap card on screen while the
    // recycled live card is redrawn and its new meal image is prepared. The
    // overlap card is the visual bridge, so there is no black/empty frame.
    if(ctx.clone?.isConnected){
     ctx.clone.style.visibility='visible';
     ctx.clone.style.opacity='1';
     ctx.clone.style.filter='none';
     ctx.clone.style.pointerEvents='none';
    }
    // CP1248: never hide the real prepared waiting card at handoff.
    // It remains the guaranteed visual fallback underneath the optional
    // interactive overlap clone, so the stack never becomes empty for a frame.
    if(ctx.previewCard?.isConnected){
     ctx.previewCard.style.visibility='visible';
     ctx.previewCard.style.opacity='1';
     ctx.previewCard.style.filter='none';
     ctx.previewCard.style.pointerEvents='none';
    }
    swipeOverlapContext=null;
    completeAfterExit();
    return;
   }

   if(isOverlapCard){
    const overlapCtx=swipeOverlapContext;
    if(overlapCtx?.clone===card){
     overlapCtx.nextFlightDone=true;
     overlapCtx.nextComplete=completeAfterExit;
     if(overlapCtx.sourceFlightDone&&!overlapCtx.flushing){
      overlapCtx.flushing=true;
      const sourceComplete=overlapCtx.sourceComplete;
      const nextComplete=overlapCtx.nextComplete;
      try{card.remove();}catch{}
      swipeOverlapContext=null;
      (async()=>{
       try{if(sourceComplete)await sourceComplete();if(nextComplete)await nextComplete();}catch{}
      })();
     }
     return;
    }
   }

   completeAfterExit();
  };

  if(typeof card.animate==='function'){
   exitAnimation=card.animate(
    [{transform:fromTransform},{transform:targetTransform}],
    {duration,easing:'cubic-bezier(.20,.84,.24,1)',fill:'forwards'}
   );
   exitAnimation.finished.then(()=>{
    if(phase==='committing')finishFlight();
   }).catch(()=>{});
   completionTimer=window.setTimeout(()=>{
    if(phase==='committing')finishFlight();
   },duration+500);
  }else{
   // Fallback for engines without Web Animations.
   requestAnimationFrame(()=>{
    if(phase!=='committing'||!card.isConnected)return;
    requestAnimationFrame(()=>{
     if(phase!=='committing'||!card.isConnected)return;
     card.style.transition='transform '+duration+'ms cubic-bezier(.20,.84,.24,1)';
     card.style.transform=targetTransform;
     completionTimer=window.setTimeout(()=>{
      if(phase==='committing')finishFlight();
     },duration+650);
    });
   });
  }
 };
 // CP1222: button decisions use the exact same off-screen commit path as a drag.
 // This preserves the existing handoff lifecycle while making Cut/Maybe feel
 // like a real swipe instead of instantly removing the card.
 card.__triggerSwipeDecision=(direction)=>{
  if(phase!=='idle'||card.dataset.swipeTransaction==='active')return 'busy';
  const dir=Number(direction)<0?-1:1;
  const distance=Math.max(48,swipeThreshold);
  // Treat a button press as a synthetic committed swipe so the existing
  // commit() path can perform the full off-screen exit and handoff.
  phase='dragging';
  card.dataset.swipePhase='dragging';
  commit(dir*distance,0);
  return 'accepted';
 };

 const paintMove=()=>{
  moveFrame=null;
  if(phase!=='dragging')return;
  const dx=lastX-downX;
  if(Math.abs(dx)<=3)return;
  const absX=Math.abs(dx),width=cardWidth();
  swipeThreshold=clamp(Math.round(width*.21),72,108);
  const progress=clamp(absX/swipeThreshold,0,1.5);
  const rotation=(dx<0?-1:1)*clamp((absX/width)*11,0,11);
  card.style.transform='translate3d('+dx.toFixed(1)+'px,0,0) rotate('+rotation.toFixed(2)+'deg)';
  card.style.opacity='1';
  card.style.setProperty('--swipe-tint-alpha',String(clamp(absX/(swipeThreshold*2.7),0,.26)));
  card.dataset.swipe=dx<0?'cut':'maybe';
  if(progress>=1&&!hapticTriggered){
   hapticTriggered=true;
   triggerSwipeHaptic();
  }
 };

 const scheduleMove=()=>{
  if(moveFrame!=null)return;
  moveFrame=requestAnimationFrame(paintMove);
 };

 const finish=(e)=>{
  if(phase!=='dragging')return;
  if(e?.clientX!=null)lastX=e.clientX;
  cancelMoveFrame();
  const dx=lastX-downX;
  const speed=Number.isFinite(velocityX)?velocityX/1000:0;
  swipeThreshold=clamp(Math.round(cardWidth()*.21),72,108);
  const distanceCommit=Math.abs(dx)>=swipeThreshold;
  const flickCommit=Math.abs(dx)>=48&&Math.abs(speed)>=.50;
  if(distanceCommit||flickCommit)commit(dx,speed);
  else{
   phase='idle';
   velocityX=0;
   releasePointer();
   settleBack();
  }
 };

 card.onpointerdown=e=>{
  if(e.isPrimary===false){
   if(phase==='dragging')cancel();
   return;
  }
  if(e.button!=null&&e.button!==0)return;
  if(phase==='locked'){
   if(card.dataset.swipeTransaction==='active')return;
   phase='idle';
   card.dataset.swipePhase='idle';
  }
  if(card.dataset.swipeTransaction==='active')return;
  if(phase!=='idle'||card.dataset.swipePhase!=='idle')return;
  if(e.target.closest?.('button,a,input,select'))return;
  if(isOverlapCard){
   const ctx=swipeOverlapContext;
   if(ctx?.clone===card)ctx.nextGestureStarted=true;
  }
  downX=e.clientX;
  lastX=e.clientX;
  lastMoveX=e.clientX;
  lastMoveTime=performance.now();
  velocityX=0;
  swipeThreshold=clamp(Math.round(cardWidth()*.21),72,108);
  phase='dragging';
  card.dataset.swipePhase='dragging';
  card.dataset.swipeDirection='';
  card.dataset.swipe='';
  card.classList.add('swipe-active');
  card.style.transition='none';
  card.style.opacity='1';
  card.style.visibility='visible';
  card.style.pointerEvents='auto';
  try{card.setPointerCapture?.(e.pointerId);}catch{}
  pointerId=e.pointerId;
 };

 card.onpointermove=e=>{
  if(phase!=='dragging'||e.isPrimary===false||e.pointerId!==pointerId)return;
  const now=performance.now();
  const x=e.clientX;
  const dt=Math.max(1,now-lastMoveTime);
  velocityX=((x-lastMoveX)/dt)*1000;
  lastMoveX=x;
  lastMoveTime=now;
  lastX=x;
  if(Math.abs(lastX-downX)>3){
   if(e.cancelable)e.preventDefault();
   scheduleMove();
  }
 };

 card.onpointerup=e=>finish(e);
 card.onpointercancel=cancel;
 card.onlostpointercapture=()=>{
  if(phase==='dragging')cancel();
 };
 card.onclick=e=>{
  if(Date.now()<suppressClickUntil){
   e.preventDefault();
   e.stopPropagation();
  }
 };
}
function bindMealPhotoCountControls(){
 if(document.documentElement.dataset.mealPhotoCountBound==='1')return;
 document.documentElement.dataset.mealPhotoCountBound='1';
 document.addEventListener('pointerup',e=>{
  const target=e.target instanceof Element?e.target:null;
  const pager=target?.closest?.('.meal-card-photo-pager');
  if(!pager)return;
  e.preventDefault();
  e.stopPropagation();
  if(pager.closest('#foodCard')){cycleFoodPhotoFromTap(pager);return;}
  pager.closest('.detail-photo-gallery')?.querySelector('[data-detail-photo-count]')?.__advancePhoto?.();
 },true);
}
function cycleFoodPhotoFromTap(target){
 const card=target?.closest?.('#foodCard')||$('foodCard'),img=card?.querySelector?.('#foodImg'),item=S.pool[S.index];
 if(!img||!item||!card)return false;
 const count=mealPhotoList(item).length||1;
 if(count<=1)return false;
 item._mealPhotoIndex=(Number(item._mealPhotoIndex||0)+1)%count;
 hydrateMealPhotoGallery(item).then(photos=>{
  if(S.pool[S.index]!==item)return;
  const total=photos.length||1;
  const idx=((Number(item._mealPhotoIndex||0)%total)+total)%total;
  item._mealPhotoIndex=idx;
  img.src=photos[idx]||foodPhoto(item);
  ensureMealCardPhotoPager(card,total,idx);
 });
 return true;
}

function previewDecisionCount(kind,type,wasMaybe=false){
 const btn=$(kind==='food'?'foodMaybeDeck':'restaurantMaybeDeck');
 if(!btn)return;
 const all=Math.max(0,Number(btn.dataset.allCount)||0);
 const maybes=Math.max(0,Number(btn.dataset.maybeCount)||0);
 const nextAll=Math.max(0,all-(type==='cut'?1:0));
 const nextMaybes=Math.max(0,maybes
   +(type==='maybe'&&!wasMaybe?1:0)
   -(type==='cut'&&wasMaybe?1:0));
 const visible=btn.dataset.mode==='maybe'?nextMaybes:nextAll;
 btn.dataset.allCount=String(nextAll);
 btn.dataset.maybeCount=String(nextMaybes);
 btn.dataset.visibleCount=String(visible);
 const count=btn.querySelector('.maybe-control-count');
 if(count){
  count.textContent=String(visible);
  count.classList.remove('decision-count-updated');
  void count.offsetWidth;
  count.classList.add('decision-count-updated');
  clearTimeout(count.__decisionCountTimer);
  count.__decisionCountTimer=window.setTimeout(()=>count.classList.remove('decision-count-updated'),220);
 }
}
function bindFoodSwipe(){bindSwipeCard('foodCard','foodNextCard',()=>familyIsBrowseStage('meal')?familyBrowseNext('meal'):foodCut(),()=>familyIsBrowseStage('meal')?familyBrowsePrevious('meal'):foodMaybe())}
function appToast(message){
document.querySelector('#appToast')?.remove();
const el=document.createElement('div'); el.id='appToast'; el.className='app-toast'; el.textContent=message;
document.body.appendChild(el);
setTimeout(()=>el.remove(),2200);
}
function appConfirm(title, message, confirmLabel='Confirm') {
return new Promise(resolve => {
document.querySelector('#appConfirmModal')?.remove();
document.querySelector('#appConfirmModalBg')?.remove();
const restoreFocus=document.activeElement instanceof HTMLElement ? document.activeElement : null;
const bg=document.createElement('div'); bg.id='appConfirmModalBg'; bg.className='modal-bg';
const modal=document.createElement('section'); modal.id='appConfirmModal'; modal.className='modal confirm-modal';
modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-labelledby','appConfirmTitle'); modal.setAttribute('aria-describedby','appConfirmMessage');
modal.innerHTML='<div class="confirm-hero"><span class="confirm-mark" aria-hidden="true">×</span><div><small>CONFIRM ACTION</small><h3 id="appConfirmTitle">'+esc(title)+'</h3></div><button class="modal-close" type="button" id="appConfirmClose" aria-label="Close confirmation">×</button></div>'+
'<div class="confirm-copy" id="appConfirmMessage">'+esc(message)+'</div>'+
'<div class="confirm-actions"><button type="button" class="secondary" id="appConfirmCancel">Cancel</button><button type="button" class="danger-action" id="appConfirmOk">'+esc(confirmLabel)+'</button></div>';
document.body.append(bg,modal);
const focusables=()=>[...modal.querySelectorAll('button:not([disabled]),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')];
let done=false;
const finish=v=>{
if(done)return; done=true; modal.remove(); bg.remove(); if(restoreFocus&&document.contains(restoreFocus))restoreFocus.focus(); resolve(v);
};
$('appConfirmCancel').onclick=()=>finish(false);
$('appConfirmClose').onclick=()=>finish(false);
$('appConfirmOk').onclick=()=>finish(true);
bg.onclick=()=>finish(false);
modal.onkeydown=e=>{
if(e.key==='Escape'){e.preventDefault();finish(false);return}
if(e.key==='Tab'){
const nodes=focusables(); if(!nodes.length)return;
const first=nodes[0],last=nodes[nodes.length-1];
if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
}
};
queueMicrotask(()=>$('appConfirmCancel')?.focus());
});
}
async function foodHideItem(item) {
if (!item) return false;
if (!await appConfirm('Hide this meal?', 'Hide '+item.name+' until you restore it in Settings.', 'Hide')) return false;
S.hidden.add(item.id);
buildFood();
S.index = Math.min(S.index, Math.max(0, S.pool.length - 1));
drawFood();
save();
return true;
}
async function foodHide() {
const item = S.pool[S.index];
if (!item) return;
if (!await appConfirm('Hide this meal?', 'Hide '+item.name+' until you restore it in Settings.', 'Hide')) return;
S.hidden.add(item.id);
buildFood();
S.index = Math.min(S.index, Math.max(0, S.pool.length - 1));
drawFood();
save();
}
function milesBetween(lat1,lon1,lat2,lon2){
 const a=Number(lat1),b=Number(lon1),c=Number(lat2),d=Number(lon2);
 if(![a,b,c,d].every(Number.isFinite))return NaN;
 const R=3958.7613,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,z=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;
 return 2*R*Math.asin(Math.sqrt(z));
}
function restaurantAddressFamily(value){
 const replacements={
  street:'st',road:'rd',avenue:'ave',boulevard:'blvd',drive:'dr',lane:'ln',parkway:'pkwy',highway:'hwy',route:'rte',
  circle:'cir',court:'ct',place:'pl',trail:'trl',terrace:'ter',north:'n',south:'s',east:'e',west:'w',
  alabama:'al',alaska:'ak',arizona:'az',arkansas:'ar',california:'ca',colorado:'co',connecticut:'ct',delaware:'de',
  florida:'fl',georgia:'ga',hawaii:'hi',idaho:'id',illinois:'il',indiana:'in',iowa:'ia',kansas:'ks',kentucky:'ky',
  louisiana:'la',maine:'me',maryland:'md',massachusetts:'ma',michigan:'mi',minnesota:'mn',mississippi:'ms',
  missouri:'mo',montana:'mt',nebraska:'ne',nevada:'nv','new-hampshire':'nh',newhampshire:'nh','new-jersey':'nj',
  newjersey:'nj','new-mexico':'nm',newmexico:'nm','new-york':'ny',newyork:'ny',northcarolina:'nc',
  'north-carolina':'nc','north-dakota':'nd',northdakota:'nd',ohio:'oh',oklahoma:'ok',oregon:'or',
  pennsylvania:'pa',rhodeisland:'ri','rhode-island':'ri',southcarolina:'sc','south-carolina':'sc',
  'south-dakota':'sd',southdakota:'sd',tennessee:'tn',tn:'tn',texas:'tx',utah:'ut',vermont:'vt',virginia:'va',
  washington:'wa',westvirginia:'wv','west-virginia':'wv',wisconsin:'wi',wyoming:'wy',
  'district-of-columbia':'dc',districtcolumbia:'dc',dc:'dc'
 };
 return normKey(value).split(' ').map(x=>replacements[x]||x).join(' ').replace(/\b(?:usa|united states)\b/g,'').replace(/\s+/g,' ').trim();
}
function restaurantNameTokensUI(value){
 const text=normKey(String(value||'').replace(/[’']s\b/gi,'s'))
   .replace(/\bbar\s+b\s+q\b/g,'bbq')
   .replace(/\bbarbecue\b/g,'bbq')
   .replace(/\bb\s+q\b/g,'bbq');
 return text.split(' ').filter(Boolean);
}
function restaurantNameFamily(value){return restaurantNameTokensUI(value).join(' ');}
const RESTAURANT_NAME_GENERIC_UI=new Set([
 'market','markets','bar','bars','bbq','barbecue','bq','restaurant','restaurants','grill','grills',
 'kitchen','cafe','café','coffee','house','food','foods','eatery','deli','bakery','pizza','pizzeria'
]);
function restaurantNameCoreTokensUI(value){
 return restaurantNameTokensUI(value).filter(t=>t.length>=4&&!RESTAURANT_NAME_GENERIC_UI.has(t));
}
function restaurantNameCoreMatchUI(a,b){
 const aa=new Set(restaurantNameCoreTokensUI(a)),bb=new Set(restaurantNameCoreTokensUI(b));
 if(!aa.size||!bb.size)return false;
 return [...aa].some(t=>bb.has(t));
}
function restaurantNameSimilarityUI(a,b){
 const aa=restaurantNameTokensUI(a),bb=restaurantNameTokensUI(b);
 if(!aa.length||!bb.length)return 0;
 const as=new Set(aa),bs=new Set(bb);
 const shared=[...as].filter(t=>bs.has(t)).length;
 const shorter=Math.min(as.size,bs.size),union=new Set([...as,...bs]).size;
 if(!shared||!shorter||!union)return restaurantNameCoreMatchUI(a,b)?1:0;
 const coverage=shared/shorter,jaccard=shared/union;
 return coverage>=0.75&&jaccard>=0.60?Math.max(coverage,jaccard):(restaurantNameCoreMatchUI(a,b)?1:0);
}
function restaurantAddressKeyUI(value){
 const raw=restaurantAddressFamily(value);
 if(!raw)return '';
 const tokens=raw.split(' ').filter(Boolean);
 const number=(tokens[0]||'').match(/^\d+[a-z]?$/i)?.[0]||'';
 const streetTokens=[];
 const suffixes=new Set(['st','rd','ave','blvd','dr','ln','pkwy','hwy','rte','cir','ct','pl','trl','ter','way']);
 const begin=number?1:0;
 for(let i=begin;i<tokens.length&&streetTokens.length<6;i++){
   streetTokens.push(tokens[i]);
   if(suffixes.has(tokens[i]))break;
 }
 return number&&streetTokens.length ? number+'|'+streetTokens.join(' ') : streetTokens.join(' ');
}
function restaurantAddressSimilarityUI(a,b){
 const ax=restaurantAddressFamily(a),bx=restaurantAddressFamily(b);
 if(!ax||!bx)return 0;
 if(ax===bx)return 1;
 const ka=restaurantAddressKeyUI(a),kb=restaurantAddressKeyUI(b);
 if(ka&&kb&&ka===kb)return 0.90;
 const sa=restaurantStreetFamily(a),sb=restaurantStreetFamily(b);
 if(sa&&sb&&sa===sb)return 0.72;
 const at=ax.split(' '),bt=bx.split(' '),shared=at.filter(t=>bt.includes(t)).length;
 const coverage=shared/Math.min(at.length,bt.length);
 return coverage>=0.80?0.80:0;
}
function restaurantStreetFamily(value){
 const raw=restaurantAddressFamily(value);
 if(!raw)return '';
 const first=raw.split(',')[0].trim();
 const tokens=first.split(' ').filter(Boolean);
 const start=/^\d+[a-z]?$/i.test(tokens[0]||'')?1:0;
 return tokens.slice(start,start+5).join(' ').trim();
}
function addressHasStreetNumber(value){return /^\s*\d+[a-z]?\b/i.test(String(value||''));}
const RESTAURANT_NAME_VARIANT_BLOCKERS_UI=new Set(['express','grill','kitchen','cafe','coffee','bar','deli','bakery','shop','and','at','inside','food','foods','eatery','restaurant','restaurants']);
function restaurantNameVariantMatchUI(a,b){
 const score=restaurantNameSimilarityUI(a,b);
 return score>=0.60;
}
function restaurantPhotoQualityScore(row){
 const confidence=Number(row?.photoConfidence);
 if(Number.isFinite(confidence))return confidence;
 const source=String(row?.photoSource||'').toLowerCase();
 if(source==='google-places')return 0.95;
 if(source==='provider')return 0.85;
 if(source==='known-entity')return 0.55;
 if(source==='cuisine-fallback')return 0.4;
 if(source==='generic-fallback')return 0.2;
 return /^https:\/\//i.test(String(row?.photo||''))?0.8:0;
}

function dedupeRestaurantPool(rows){
 const out=[];
 for(const row of (rows||[])){
  if(!row)continue;
  const name=restaurantNameFamily(row.name),address=restaurantAddressFamily(row.address||'');
  const phone=String(row.phone||'').replace(/\D/g,'').slice(-10),website=String(row.website||'').toLowerCase().replace(/^https?:\/\/(?:www\.)?/,'').replace(/\/$/,'');
  const lat=Number(row.lat),lon=Number(row.lon);
  let match=out.find(x=>{
   const xn=restaurantNameFamily(x.name),xa=restaurantAddressFamily(x.address||'');
   const xp=String(x.phone||'').replace(/\D/g,'').slice(-10),xw=String(x.website||'').toLowerCase().replace(/^https?:\/\/(?:www\.)?/,'').replace(/\/$/,'');
   const dist=milesBetween(x.lat,x.lon,lat,lon);
   const sameName=!!name&&name===xn;
   const nameScore=restaurantNameSimilarityUI(name,xn);
   const sameNameFamily=sameName||nameScore>=0.60;
   const sameAddrScore=restaurantAddressSimilarityUI(address,xa);
   const sameAddr=sameAddrScore>=0.90;
   const sameStreet=sameAddrScore>=0.72;
   const samePhysical=Number.isFinite(dist)&&dist<=0.15;
   const coreNameMatch=restaurantNameCoreMatchUI(name,xn);
   const sameAddressAndName=sameAddr&&(sameNameFamily||coreNameMatch);
   const sameStreetAndName=sameStreet&&(sameNameFamily||coreNameMatch)&&samePhysical;
   const sameNearbyAndName=samePhysical&&sameNameFamily&&(!address||!xa);
   const identityKey=RESTAURANT_TAXONOMY.restaurantIdentityKey(row);
   const existingIdentityKey=RESTAURANT_TAXONOMY.restaurantIdentityKey(x);
   const sameCanonicalIdentity=!!identityKey&&identityKey===existingIdentityKey&&samePhysical;
   const sameContact=(phone&&xp&&phone===xp)||(website&&xw&&website===xw);
   const strongContact=sameContact&&samePhysical;
   return sameAddressAndName
     || sameStreetAndName
     || sameNearbyAndName
     || sameCanonicalIdentity
     || strongContact;
  });
  if(!match){
    const inferred=RESTAURANT_TAXONOMY.classifyRestaurant(row);
    out.push({...row,category:(inferred.primary||row.category||'American'),quickCutTags:[...new Set([...(row.quickCutTags||[]),...inferred.tags])]});
    continue;
  }
  match.fastFood=match.fastFood||row.fastFood;
  if(typeof row.openNow==='boolean' && typeof match.openNow!=='boolean')match.openNow=row.openNow;
  if(restaurantPhotoQualityScore(row)>restaurantPhotoQualityScore(match)){
    if(row.photo)match.photo=row.photo;
    if(row.photoFallback)match.photoFallback=row.photoFallback;
    if(row.photoSource)match.photoSource=row.photoSource;
    if(Number.isFinite(Number(row.photoConfidence)))match.photoConfidence=Number(row.photoConfidence);
    if(typeof row.photoIsGeneric==='boolean')match.photoIsGeneric=row.photoIsGeneric;
    if(row.googlePlaceId)match.googlePlaceId=row.googlePlaceId;
  }
  for(const key of ['address','phone','website','opening_hours','photo','cuisine','brand','operator'])if(!match[key]&&row[key])match[key]=row[key];
  match.menuItems=[...new Set([...(Array.isArray(match.menuItems)?match.menuItems:[]),...(Array.isArray(row.menuItems)?row.menuItems:[])])].slice(0,10);
  match.quickCutTags=[...new Set([...(match.quickCutTags||[]),...(row.quickCutTags||[]),...RESTAURANT_TAXONOMY.classifyRestaurant({...match,...row}).tags])];
  const inferred=RESTAURANT_TAXONOMY.classifyRestaurant({...match,...row});
  if(!match.category || /^(restaurant|eatery|food)$/i.test(String(match.category)))match.category=inferred.primary||'American';
  match.distance=Math.min(Number(match.distance)||Infinity,Number(row.distance)||Infinity);
 }
 return out.sort((a,b)=>Number(a.distance)-Number(b.distance));
}
function restaurantCanonicalId(row){
const name=normKey(row?.name);
const address=normKey(row?.address);
const geo=(Number.isFinite(Number(row?.lat))&&Number.isFinite(Number(row?.lon))) ? Number(row.lat).toFixed(4)+'-'+Number(row.lon).toFixed(4) : '';
return 'restaurant-'+(name+'|'+(address||geo)).replace(/[^a-z0-9]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,150);
}
function restaurantHidden(row){
if(!row)return false;
if(S.hiddenRestaurants[row.id] || (row.canonicalId && S.hiddenRestaurants[row.canonicalId]))return true;
const targetName=normKey(row.name),targetAddr=normKey(row.address),targetCanonical=row.canonicalId||restaurantCanonicalId(row);
return Object.values(S.hiddenRestaurants||{}).some(x=>{
if(x.canonicalId && x.canonicalId===targetCanonical)return true;
if(normKey(x.name)!==targetName)return false;
if(targetAddr&&normKey(x.address)===targetAddr)return true;
if(x.lat!=null&&x.lon!=null&&row.lat!=null&&row.lon!=null){
const dlat=Math.abs(Number(x.lat)-Number(row.lat)),dlon=Math.abs(Number(x.lon)-Number(row.lon));
return dlat<0.001&&dlon<0.001;
}
return false;
});
}
function restaurantSearchText(row){
 return [
  row?.name,row?.brand,row?.operator,row?.category,row?.cuisine,
  restaurantCategory(row),
  ...(Array.isArray(row?.menuItems)?row.menuItems:[])
 ].filter(Boolean).join(' ');
}
const normalizeRestaurantSearch = RESTAURANT_TAXONOMY.normalizeRestaurantSearch;
const restaurantIdentityHay = RESTAURANT_TAXONOMY.identityHay;
function restaurantIsFastFood(row){
 return RESTAURANT_TAXONOMY.isFastFood(row);
}
function restaurantCuisineTags(row){
 const preset=Array.isArray(row?.quickCutTags)?row.quickCutTags:[];
 const inferred=RESTAURANT_TAXONOMY.classifyRestaurant(row).tags;
 return inferred.length ? inferred : [...new Set(preset)];
}
function restaurantCuisineEvidence(row){
 return RESTAURANT_TAXONOMY.classifyRestaurant(row).evidence;
}
function restaurantCategory(row){
 const inferred=RESTAURANT_TAXONOMY.classifyRestaurant(row);
 if(inferred.primary)return inferred.primary;
 const tags=restaurantCuisineTags(row),raw=String(row?.category||'').trim();
 if(/^(American|Mexican|Asian|Italian|Southern|BBQ|Seafood|Breakfast|Burgers|Fast Food)$/i.test(raw))return raw;
 const order=['Burgers','Pizza','Mexican','Asian','Italian','BBQ','Seafood','Breakfast','Southern','Fast Food','American'];
 for(const label of order) if(tags.includes(label)) return label;
 const providerRaw=RESTAURANT_TAXONOMY.normalizeRestaurantSearch([row?.cuisine,row?.category,row?.providerType,row?.primaryType,row?.types?.join?.(' ')].join(' '));
 const nameRaw=RESTAURANT_TAXONOMY.normalizeRestaurantSearch([row?.name,row?.brand,row?.operator].join(' '));
 const fallback=[
  ['Pizza',/\b(pizza|pizzeria|calzone)\b/],
  ['Mexican',/\b(mexican|taco|burrito|taqueria|enchilada|quesadilla|fajita)\b/],
  ['Asian',/\b(asian|chinese|japanese|thai|korean|sushi|ramen|pho|hibachi|teriyaki)\b/],
  ['Italian',/\b(italian|pasta|spaghetti|lasagna|ravioli|trattoria|ristorante)\b/],
  ['BBQ',/\b(bbq|barbecue|smokehouse|brisket|ribs|pulled pork)\b/],
  ['Seafood',/\b(seafood|fish house|catfish|shrimp|crab|lobster|oyster|salmon)\b/],
  ['Breakfast',/\b(breakfast|brunch|pancake|waffle|omelet|eggs benedict|biscuits and gravy)\b/],
  ['Burgers',/\b(burger|hamburger|cheeseburger|smashburger)\b/],
  ['Southern',/\b(southern|soul food|country cooking|meat and three|comfort food)\b/],
  ['American',/\b(diner|steakhouse|roadhouse|grill|bistro|pub|tavern|american)\b/]
 ];
 for(const [label,re] of fallback)if(re.test(nameRaw)||re.test(providerRaw))return label;
 return raw&&/^(restaurant|eatery|food)$/i.test(raw)?'American':(raw||'American');
}
function restaurantQuickMatches(row,label){
 const wanted=String(label||'').trim().toLowerCase();
 if(!wanted)return false;
 const tags=restaurantCuisineTags(row).map(x=>String(x||'').trim().toLowerCase());
 const category=String(restaurantCategory(row)||'').trim().toLowerCase();
 return tags.includes(wanted)||category===wanted;
}

function restaurantCategorySearchMatches(row,tag){
 const tags=restaurantCuisineTags(row);
 if(tag==='Burgers')return tags.includes('Burgers')||tags.includes('Fast Food');
 return tags.includes(tag);
}
function restaurantSearchTermMatches(row,term,hay){
 const normalized=normalizeRestaurantSearch(term);
 if(!normalized)return true;
 const classification=RESTAURANT_TAXONOMY.restaurantSearchClassification(normalized);
 if(classification.kind==='category'&&classification.tag) return restaurantCategorySearchMatches(row,classification.tag);
 const words=normalized.split(' ').filter(Boolean);
 if(words.length===1 && ['restaurant','restaurants','place','places'].includes(words[0]))return true;
 return words.every(word=>hay.includes(word));
}
function restaurantMatchesQuery(row){
 const q=String(S.restaurantQuery||'').trim();
 if(!q)return true;
 const classification=RESTAURANT_TAXONOMY.restaurantSearchClassification(q);
 if(classification.kind==='category'&&classification.tag)return restaurantCategorySearchMatches(row,classification.tag);
 const hay=normalizeRestaurantSearch(restaurantSearchText(row));
 return q.split(/\s+/).filter(Boolean).every(term=>restaurantSearchTermMatches(row,term,hay));
}

function restaurantClockParts(row){
  const timeZone=String(row?.hoursTimeZone||S.restaurantSearchTimeZone||'').trim();
  if(timeZone){
    try{
      const parts=new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
      const pick=type=>String(parts.find(p=>p.type===type)?.value||'');
      const dayMap={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
      const day=dayMap[pick('weekday')];
      const hour=Number(pick('hour')),minute=Number(pick('minute'));
      if(Number.isFinite(day)&&Number.isFinite(hour)&&Number.isFinite(minute))return {day,minute:hour*60+minute,timeZone};
    }catch{}
  }
  const now=new Date();
  return {day:now.getDay(),minute:now.getHours()*60+now.getMinutes(),timeZone:''};
}
function restaurantHoursState(row){
  if(typeof row?.openNow==='boolean')return row.openNow?'open':'closed';
  const status=String(row?.businessStatus||'').toUpperCase();
  if(status==='CLOSED_PERMANENTLY'||status==='CLOSED_TEMPORARILY')return 'closed';
  const raw=String(row?.opening_hours||'').trim();
  if(!raw)return 'unknown';
  if(/\b(?:24\s*\/\s*7|24\s*hours?)\b/i.test(raw))return 'open';

   const {day,minute}=restaurantClockParts(row);
  const dayNames=[['Su','Sun','Sunday'],['Mo','Mon','Monday'],['Tu','Tue','Tuesday'],['We','Wed','Wednesday'],['Th','Thu','Thursday'],['Fr','Fri','Friday'],['Sa','Sat','Saturday']];
  const aliases=new Map();
  dayNames.forEach((list,index)=>list.forEach(name=>aliases.set(name.toLowerCase(),index)));

  const appliesToDay=(selector,targetDay)=>{
    const s=String(selector||'').trim();
    if(!s)return true;
    const normalized=s.replace(/[–—−]/g,'-').replace(/\s+/g,' ');
    const ranges=[...normalized.matchAll(/\b(Su|Mo|Tu|We|Th|Fr|Sa|Sun|Mon|Tue|Wed|Thu|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\s*-\s*(Su|Mo|Tu|We|Th|Fr|Sa|Sun|Mon|Tue|Wed|Thu|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/gi)];
    for(const m of ranges){
      const a=aliases.get(m[1].toLowerCase()),b=aliases.get(m[2].toLowerCase());
      if(a==null||b==null)continue;
      if(a<=b ? targetDay>=a&&targetDay<=b : targetDay>=a||targetDay<=b)return true;
    }
    const tokens=normalized.match(/\b(?:Su|Mo|Tu|We|Th|Fr|Sa|Sun|Mon|Tue|Wed|Thu|Fri|Sat|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/gi)||[];
    return tokens.some(token=>aliases.get(token.toLowerCase())===targetDay);
  };

  const parseTime=(value,hint='')=>{
    const m=String(value||'').trim().toUpperCase().replace(/\s+/g,'').match(/^(\d{1,2})(?::(\d{2}))?(AM|PM)?$/);
    if(!m)return NaN;
    let hour=Number(m[1]),mins=Number(m[2]||0),ampm=m[3]||hint;
    if(mins>59)return NaN;
    if(ampm){
      if(hour<1||hour>12)return NaN;
      hour=ampm==='AM'?(hour===12?0:hour):(hour===12?12:hour+12);
    }else if(hour>23)return NaN;
    return hour*60+mins;
  };

  const timeRe=/(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*[-–—]\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/i;
  const clauses=raw.split(/\s*[;·•]\s*/).map(x=>x.trim()).filter(Boolean);
  const intervals=[];
  let applicable=false,sawClosed=false;

   const collect=(clause,targetDay)=>{
     const matches=[...String(clause||'').matchAll(new RegExp(timeRe.source,'gi'))];
     const selector=matches.length?String(clause||'').slice(0,matches[0].index).trim():String(clause||'').trim();
     if(!appliesToDay(selector,targetDay))return;
     applicable=true;
     if(/\b(?:off|closed)\b/i.test(clause)&&!matches.length){sawClosed=true;return;}
     if(!matches.length)return;
     for(const tm of matches){
       const startHasMeridiem=/\b(?:AM|PM)\b/i.test(tm[1]);
       const endMeridiem=(tm[2].match(/AM|PM/i)||[])[0]||'';
       const start=parseTime(tm[1],!startHasMeridiem?endMeridiem:'');
       const end=parseTime(tm[2]);
       if(Number.isFinite(start)&&Number.isFinite(end))intervals.push({start,end,targetDay});
     }
   };

  for(const clause of clauses)collect(clause,day);
  const todayCount=intervals.length;

  for(let i=todayCount;i<todayCount+clauses.length;i++){}
  const previousDay=(day+6)%7;
  const previousIntervals=[];
  const originalIntervals=intervals.length;
  for(const clause of clauses){
    const before=intervals.length;
    collect(clause,previousDay);
    if(intervals.length>before)previousIntervals.push(intervals[intervals.length-1]);
  }

  for(const interval of previousIntervals){
    if(interval.start>interval.end&&minute<=interval.end)return 'open';
  }
  for(let i=0;i<originalIntervals;i++){
    const interval=intervals[i];
    if(interval.start<=interval.end ? minute>=interval.start&&minute<=interval.end : minute>=interval.start||minute<=interval.end)return 'open';
  }
  return applicable&&sawClosed?'closed':(applicable?'closed':'unknown');
}
function restaurantHoursMatches(row){
  const mode=String(S.restaurantHours||'all')==='open'?'open':'all';
  return mode==='all'||restaurantHoursState(row)==='open';
}
function restaurantPoolHourFiltered(){return restaurantPoolBase().filter(restaurantHoursMatches);}
function restaurantChoiceIndex(rows,start,keepState=false){
 const len=rows.length;if(!len)return -1;
 for(let step=0;step<len;step++){const i=(start+step)%len;if(keepState?!!rows[i]._maybe:!rows[i]._maybe)return i;}
 return -1;
}
function restaurantPoolBase(){
 return (S.restaurantPool||[]).filter(row=>{
  if([...S.restaurantCuts].some(label=>restaurantQuickMatches(row,label)))return false;
  if(row._cut||row._hidden||restaurantHidden(row))return false;
  return restaurantMatchesQuery(row);
 });
}
function restaurantPoolFiltered(){
 // CP1214: photo readiness is presentation-only and cannot remove choices.
 const base=restaurantPoolHourFiltered();
 return S.maybeDeck ? base.filter(row=>row._maybe) : base;
}
function updateRestaurantStatus(){
 const el=$('status'); if(!el)return;
 const radius=Math.min(100,Math.max(1,Number(S.restaurantSearchRadius ?? $('radius')?.value)||10));
 const total=restaurantPoolHourFiltered().length,degraded=S.restaurantSearchDegraded;
 if(!total){
  el.textContent=degraded?'Restaurant sources are unavailable. Try again.':(S.restaurantHours==='open'?'No restaurants are open now in this radius.':'No restaurants match the current filters.');
  return;
 }
 const mode=S.restaurantHours==='open'?'open':'all';
 const modeLabel=mode==='open'?' · Open Now':'';
 el.textContent=total+' restaurant'+(total===1?'':'s')+' · '+radius+' mi'+modeLabel;
}

function restaurantQuick() {
 const labels=REST_QUICK;
 const existing=[...document.querySelectorAll('#restQuick [data-rest-quick]')].map(btn=>btn.dataset.restQuick);
 if(existing.length!==labels.length||existing.some((x,i)=>x!==labels[i])){
  $('restQuick').innerHTML = labels.map(label => {
   const src=imageProxyUrl(REST_QUICK_IMAGES[label] || REST_QUICK_IMAGES.American);
   return '<button class="chip photo-chip" data-rest-quick="'+esc(label)+'"><img class="quick-chip-photo" src="'+esc(src)+'" alt="'+esc(label)+' restaurant photo" draggable="false"><span>'+esc(label)+'</span></button>';
  }).join('');
  bindImageFallbackAttrs('[data-rest-quick] img');
 }
 document.querySelectorAll('#restQuick [data-rest-quick]').forEach(btn => {
  const label=btn.dataset.restQuick;
  btn.classList.toggle('cut',S.restaurantCuts.has(label));
  btn.onclick = () => {
   S.restaurantCuts.has(label) ? S.restaurantCuts.delete(label) : S.restaurantCuts.add(label);
   S.restaurantIndex=0;
   restaurantQuick();
   drawRestaurants();
   save();
  };
 });
 bindQuickCutsCollapse('restaurant');
}
function renderLocationSource(){
const el=$('locationSourceLabel'); if(!el)return;
const labels={device:'Using your location',last:'Last used location',address:'Using selected address',typed:'Address needs selection',none:'No location selected'};
el.textContent=labels[S.locationSource]||labels.none;
el.classList.toggle('is-ready',S.locationSource==='device'||S.locationSource==='address');
renderFindButton();
}
function displayRestaurantLocationLabel(value,originalQuery=''){
 const raw=String(value||'').trim().replace(/\s+/g,' ');
 const query=String(originalQuery||'').trim().replace(/\s+/g,' ');
 if(query && !addressLooksComplete(query)) return query;
 if(!raw)return query||'Current location';
 const parts=raw.split(',').map(x=>x.trim()).filter(Boolean);
 const stateIndex=parts.findIndex(x=>/^(Tennessee|TN|Kentucky|KY|Georgia|GA|Alabama|AL|Illinois|IL|Missouri|MO)$/i.test(x));
 if(stateIndex>=1){
  const stateMap={tennessee:'TN',tn:'TN',kentucky:'KY',ky:'KY',georgia:'GA',ga:'GA',alabama:'AL',al:'AL',illinois:'IL',il:'IL',missouri:'MO',mo:'MO'};
  const state=stateMap[parts[stateIndex].toLowerCase()]||parts[stateIndex];
  const city=parts[stateIndex-1];
  let street='';
  for(let i=0;i<stateIndex;i++){
    const p=parts[i];
    if(/^\d+[a-z]?$/i.test(p)&&parts[i+1]){street=p+' '+parts[i+1];break;}
    if(/^\d+\s+/i.test(p)){street=p;break;}
  }
  if(!street && stateIndex>=2 && !/^\d/.test(parts[stateIndex-2])) street=parts[stateIndex-2];
  if(street && city && street!==city)return street+', '+city+', '+state;
  if(city)return city+', '+state;
 }
 return parts.slice(0,3).join(', ');
}
function setLocation(lat, lon, label, source='address') {
S.location = {lat, lon, label};
S.locationSource = source;
if(source==='device')S.locationFreshAt=Date.now();
else S.locationFreshAt=null;
$('address').value = label || 'Current location';
renderLocationSource();
save();
}
let suggestController = null;
let restaurantSearchController = null;
let reverseLocationController = null;
let locationRequestActive = false;
let locationRequestSeq = 0;
function renderFindButton(){
 const btn=$('find');if(!btn)return;
 const hasSearchTarget=!!S.location || !!$('address')?.value.trim();
 const state=hasSearchTarget?'refresh':'find';
 const label=state==='refresh'?'Refresh restaurant search using this location and radius':'Find restaurants near the selected location';
 btn.dataset.state=state;
 btn.title=label;
 btn.innerHTML=state==='refresh'
  ? '<svg class="find-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 8.5V4.8l-2.2 2.2A7.5 7.5 0 1 0 19.2 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 4.8h-3.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sr-only">Refresh</span>'
  : '<svg class="find-icon find-locator-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21c4.2-4.8 6.4-8.2 6.4-11.3A6.4 6.4 0 0 0 5.6 9.7C5.6 12.8 7.8 16.2 12 21Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.2" fill="currentColor"/></svg><span class="sr-only">Find restaurants nearby</span>';
 btn.setAttribute('aria-label',label);
}
function setFindBusy(busy) {
const btn=$('find'); if(!btn)return;
btn.disabled=busy;
btn.setAttribute('aria-busy',String(busy));
const hasSearchTarget=!!S.location || !!$('address')?.value.trim();
 const state=busy?'busy':(hasSearchTarget?'refresh':'find');
btn.dataset.state=state;
btn.title=busy?'Searching for restaurants…':(state==='refresh'?'Refresh restaurant search using this location and radius':'Find restaurants near the selected location');
btn.innerHTML=busy
 ? '<span class="find-spinner" aria-hidden="true"></span><span class="sr-only">Searching</span>'
 : (state==='refresh'
   ? '<svg class="find-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 8.5V4.8l-2.2 2.2A7.5 7.5 0 1 0 19.2 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 4.8h-3.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sr-only">Refresh</span>'
   : '<svg class="find-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.8" cy="10.8" r="5.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15.2 15.2 4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span class="sr-only">Find</span>');
}
function setLocationBusy(busy) {
const btn=$('locate');if(!btn)return;
btn.disabled=busy;
btn.setAttribute('aria-busy',String(busy));
const label=busy?'Getting your current location…':'Use your current location for nearby restaurants';
btn.setAttribute('aria-label',label);
btn.title=label;
}
function requestBrowserPosition(options={}) {
return new Promise((resolve,reject)=>{
 try{
  navigator.geolocation.getCurrentPosition(resolve,reject,options);
 }catch(err){reject(err);}
});
}
function locationMovedMiles(a,b) {
return milesBetween(a?.lat,a?.lon,b?.lat,b?.lon);
}
async function reverseLocationLabel(lat,lon,seq) {
reverseLocationController?.abort();
const ctl=new AbortController();
reverseLocationController=ctl;
const timer=setTimeout(()=>ctl.abort(),5000);
try{
const r=await fetch('/api/restaurant-search?mode=reverse&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon),{signal:ctl.signal});
const d=await r.json();
if(seq!==locationRequestSeq||ctl.signal.aborted)return null;
if(!r.ok||!d.ok)return null;
return String(d.display||'Current location');
}catch{return null}
finally{clearTimeout(timer);if(reverseLocationController===ctl)reverseLocationController=null;}
}
async function useLocation() {
if (!navigator.geolocation) {
 $('status').textContent='Location is not available in this browser.';
 $('locationSourceLabel').textContent='Location unavailable';
 return false;
}
if(!window.isSecureContext){
 $('status').textContent='Location requires a secure connection. Open the HTTPS app address.';
 $('locationSourceLabel').textContent='Secure connection required';
 return false;
}
if(locationRequestActive)return false;
const seq=++locationRequestSeq;
locationRequestActive=true;
setLocationBusy(true);
invalidateAddressSuggestions();
$('locationSourceLabel').textContent='Getting your location…';
$('status').textContent='Allow location access when your browser asks.';
try{
 let permission='unknown';
 try{
  const p=await navigator.permissions?.query?.({name:'geolocation'});
  permission=p?.state||'unknown';
 }catch{}
 if(permission==='denied')throw Object.assign(new Error('Location permission is blocked for this site. Enable Location in your browser site permissions, then try again.'),{code:1});
 const attempts=[
  {enableHighAccuracy:true,timeout:8500,maximumAge:0},
  {enableHighAccuracy:false,timeout:10000,maximumAge:0},
  {enableHighAccuracy:false,timeout:12000,maximumAge:120000}
 ];
 let position=null,lastError=null;
 for(const options of attempts){
  if(seq!==locationRequestSeq) return false;
  try{position=await requestBrowserPosition(options);break;}catch(err){lastError=err;}
 }
 if(!position)throw lastError||new Error('Could not access your current location.');
 const loc={lat:Number(position.coords.latitude),lon:Number(position.coords.longitude)};
 if(!Number.isFinite(loc.lat)||!Number.isFinite(loc.lon))throw new Error('Your browser returned an invalid location.');
 setLocation(loc.lat,loc.lon,'Current location','device');
 $('locationSourceLabel').textContent='Using your current location';
 $('status').textContent='Location found. Finding nearby restaurants…';
 if(seq!==locationRequestSeq)return false;
 const searchPromise=searchRestaurants();
 const label=await reverseLocationLabel(loc.lat,loc.lon,seq).catch(()=>null);
 if(seq!==locationRequestSeq)return false;
 if(label){
  const visibleLabel=displayRestaurantLocationLabel(label,'');
  S.location={...S.location,label:visibleLabel};
  $('address').value=visibleLabel;
  $('locationSourceLabel').textContent='Using your current location';
  save();
 }
 await searchPromise;
 if(seq!==locationRequestSeq)return false;
 S.locationFreshAt=Date.now();
 S.locationSource='device';
 renderLocationSource();
 if(!S.restaurantSearchDegraded) $('status').textContent=S.restaurantPool.length?'Location ready.':'Location found, but no restaurants were returned.';
 save();
 return true;
}catch(err){
 if(seq!==locationRequestSeq)return false;
 const code=Number(err?.code);
 if(code===1){
  $('locationSourceLabel').textContent='Location permission needed';
  $('status').textContent=err?.message||'Location permission was denied. Enable Location for this site and try again.';
 }else if(code===3){
  $('locationSourceLabel').textContent='Location timed out';
  $('status').textContent='Your browser could not get a fresh location. Try again or enter an address.';
 }else if(code===2){
  $('locationSourceLabel').textContent='Location unavailable';
  $('status').textContent='Your device could not provide a location. Try again or enter an address.';
 }else{
  $('locationSourceLabel').textContent='Location unavailable';
  $('status').textContent=err?.message||'Could not access your current location. Try again or enter an address.';
 }
 return false;
}finally{
 if(seq===locationRequestSeq){
  locationRequestActive=false;
  setLocationBusy(false);
  renderLocationSource();
 }
}
}
let autoRestaurantRefreshActive=false;
async function maybeAutoRefreshRestaurantLocation(){
 if(autoRestaurantRefreshActive||S.screen!=='restaurant'||S.locationSource!=='device'||!S.location)return false;
 const age=Date.now()-Number(S.locationFreshAt||0);
 if(age<10*60*1000)return false;
 autoRestaurantRefreshActive=true;
 try{
  const pos=await requestBrowserPosition({enableHighAccuracy:false,timeout:2500,maximumAge:120000});
  const fresh={lat:Number(pos.coords.latitude),lon:Number(pos.coords.longitude)};
  if(!Number.isFinite(fresh.lat)||!Number.isFinite(fresh.lon))return false;
  const moved=locationMovedMiles(S.location,fresh);
  S.locationFreshAt=Date.now();
  if(Number.isFinite(moved)&&moved>=0.15){
   setLocation(fresh.lat,fresh.lon,'Current location','device');
   if(S.screen==='restaurant'){
    $('status').textContent='Location updated. Refreshing restaurants…';
    await searchRestaurants().catch(()=>{});
   }
   return true;
  }
  save();
 }catch{}
 finally{autoRestaurantRefreshActive=false;}
 return false;
}
let suggestTimer = 0;
let suggestSeq = 0;
let suggestionIndex = -1;
const suggestCache = new Map();
function invalidateAddressSuggestions() {
  suggestSeq++;
  clearTimeout(suggestTimer);
  suggestTimer=0;
  suggestController?.abort();
  suggestController=null;
  clearSuggestions();
}
function addressLooksComplete(value) {
  const q=String(value||'').trim().replace(/\s+/g,' ');
  if(!/^\d+\s+[^,]+/i.test(q))return false;
  if(/\b\d{5}(?:-\d{4})?\b/.test(q))return true;
  const parts=q.split(',').map(x=>x.trim()).filter(Boolean);
  if(parts.length>=3&&/\b[A-Z]{2}\b/i.test(parts[parts.length-2]))return true;
  const last=parts[parts.length-1]||'';
  return parts.length>=2&&/\b[A-Za-z][A-Za-z .'-]+\s+[A-Z]{2}\b/i.test(last);
}
async function chooseAddressSuggestion(index) {
  const opts=[...document.querySelectorAll('#suggestionsBox [data-suggestion]')];
  const btn=opts[index];
  if(!btn)return false;
  btn.click();
  return true;
}
async function suggestAddresses() {
const q = $('address').value.trim();
const seq = ++suggestSeq;
if (q.length < 2) { clearSuggestions(); $('status').textContent='Enter an address or use your location.'; return; }
const cached=suggestCache.get(q.toLowerCase());
if(cached&&Date.now()-cached.t<300000){ renderSuggestions(cached.rows); return; }
$('status').textContent='Searching addresses…';
clearTimeout(suggestTimer);
suggestTimer=setTimeout(async()=>{
suggestController?.abort();
suggestController=new AbortController();
try{
const r=await fetch('/api/restaurant-search?mode=suggest&q='+encodeURIComponent(q),{signal:suggestController.signal});
const d=await r.json();
if(seq!==suggestSeq)return;
const rows=Array.isArray(d.results)?d.results:[];
suggestCache.set(q.toLowerCase(),{t:Date.now(),rows});
renderSuggestions(rows);
}catch(e){
if(e?.name==='AbortError')return;
clearSuggestions();$('status').textContent='Address lookup is temporarily unavailable.';
}
},380);
}
function renderSuggestions(rows) {
suggestionIndex = -1;
let box = $('suggestionsBox');
if (!box) {
box = document.createElement('div');
box.id = 'suggestionsBox';
$('address').insertAdjacentElement('afterend', box);
}
box.innerHTML = (rows || []).map((row, i) =>
'<button type="button" role="option" aria-selected="false" id="addressSuggestion-'+i+'" data-suggestion="'+i+'">'+esc(row.display)+'</button>'
).join('');
const hasRows=!!rows?.length;
box.hidden=!hasRows;
box.style.display=hasRows ? 'grid' : 'none';
$('address')?.setAttribute('aria-expanded',String(hasRows));
$('address')?.removeAttribute('aria-activedescendant');
box.querySelectorAll('[data-suggestion]').forEach((btn, i) => {
  btn.onclick = async () => {
    const row = rows[i];
    suggestionIndex = -1;
    invalidateAddressSuggestions();
    /* CP892 — autocomplete selection commits the full resolved address returned by the provider. */
    setLocation(row.lat, row.lon, String(row.display||'').trim(),'address');
    $('status').textContent = 'Location selected. Searching restaurants…';
    await searchRestaurants();
  };
});
}
function clearSuggestions() {
suggestionIndex = -1;
const box = $('suggestionsBox');
if (box) { box.style.display = 'none'; box.hidden=true; }
$('address')?.setAttribute('aria-expanded','false');
$('address')?.removeAttribute('aria-activedescendant');
}
function moveSuggestion(delta){
const opts=[...document.querySelectorAll('#suggestionsBox [data-suggestion]')];
if(!opts.length)return false;
suggestionIndex=(suggestionIndex+delta+opts.length)%opts.length;
opts.forEach((el,i)=>el.setAttribute('aria-selected',String(i===suggestionIndex)));
const active=opts[suggestionIndex];
$('address')?.setAttribute('aria-activedescendant',active.id);
active.scrollIntoView?.({block:'nearest'});
return true;
}
let restaurantSearchSeq = 0;
let restaurantHoursEnrichmentSeq = 0;
async function enrichRestaurantHoursForOpenNow(){
  const pool=Array.isArray(S.restaurantPool)?S.restaurantPool:[];
  const unknown=pool
    .filter(row=>restaurantHoursState(row)==='unknown')
    .sort((a,b)=>Number(a.distance||Infinity)-Number(b.distance||Infinity))
    .slice(0,90);
  if(!unknown.length){
    restaurantHoursEnrichmentKey=String(S.restaurantSearchKey||'');
    restaurantHoursEnrichedAt=Date.now();
    return {ok:true,counts:{total:pool.length,alreadyKnown:pool.length,resolvedFromOfficialWebsite:0,resolvedByGooglePlaceDetails:0,resolvedByGoogleTextSearch:0,stillUnknown:0,open:pool.filter(r=>restaurantHoursState(r)==='open').length},google:{callsUsed:0,callsBudget:36}};
  }
  const seq=++restaurantHoursEnrichmentSeq;
  const payload={
    maxGoogleCalls:36,
    rows:unknown.map(row=>({
      id:String(row?.id||''),
      name:String(row?.name||'').slice(0,160),
      address:String(row?.address||'').slice(0,240),
      phone:String(row?.phone||'').slice(0,50),
      website:String(row?.website||'').slice(0,700),
      brand:String(row?.brand||'').slice(0,120),
      lat:Number(row?.lat),
      lon:Number(row?.lon),
      distance:Number(row?.distance),
      googlePlaceId:String(row?.googlePlaceId||'').trim(),
      opening_hours:String(row?.opening_hours||'').slice(0,1200),
      openNow:typeof row?.openNow==='boolean'?row.openNow:null,
      businessStatus:String(row?.businessStatus||''),
      hoursSource:String(row?.hoursSource||''),
      hoursTimeZone:String(row?.hoursTimeZone||S.restaurantSearchTimeZone||'')
    }))
  };
  $('status').textContent='Checking open hours…';
  try{
    const response=await fetch('/api/restaurants?mode=hours',{
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await responseJson(response,'Open hours could not be checked right now.');
    if(seq!==restaurantHoursEnrichmentSeq||S.screen!=='restaurant')return data;
    const patches=new Map((Array.isArray(data?.patches)?data.patches:[]).map(row=>[String(row?.id||''),row]));
    let applied=0;
    for(const row of S.restaurantPool||[]){
      const patch=patches.get(String(row?.id||''));
      if(!patch)continue;
      for(const key of ['name','address','phone','website','opening_hours','openNow','businessStatus','googlePlaceId']){
        if(patch[key]!==undefined&&patch[key]!==null&&patch[key]!=='')row[key]=patch[key];
      }
      if(patch.hoursSource)row.hoursSource=patch.hoursSource;
      applied++;
    }
    restaurantHoursEnrichmentKey=String(S.restaurantSearchKey||'');
    restaurantHoursEnrichedAt=Date.now();
    return {...data,applied};
  }catch(error){
    if(seq!==restaurantHoursEnrichmentSeq||S.screen!=='restaurant')return {ok:false,error:String(error?.message||error||'')};
    $('status').textContent='Open hours could not be checked. Showing confirmed hours only.';
    return {ok:false,error:String(error?.message||error||'Open hours enrichment failed.')};
  }
}

let restaurantHoursEnrichmentKey = '';
let restaurantHoursEnrichedAt = 0;
async function responseJson(response, message){
let body=null;
try{body=await response.json();}catch{throw new Error(message||'The restaurant search returned an invalid response.');}
return body;
}
async function fetchRestaurantEndpoint(url,signal){
let lastError=null;
for(let attempt=0;attempt<2;attempt++){
  try{
    const response=await fetch(url,{signal});
    if(response.ok || attempt===1 || ![429,500,502,503,504].includes(response.status)) return response;
    await new Promise(resolve=>setTimeout(resolve,response.status===429?500:250));
    if(signal?.aborted) throw Object.assign(new Error('Aborted'),{name:'AbortError'});
  }catch(e){
    if(e?.name==='AbortError')throw e;
    lastError=e;
    if(attempt===1)throw e;
    await new Promise(resolve=>setTimeout(resolve,250));
    if(signal?.aborted) throw Object.assign(new Error('Aborted'),{name:'AbortError'});
  }
}
throw lastError||new Error('Restaurant service unavailable.');
}
async function searchRestaurants(options={}) {
invalidateAddressSuggestions();
const searchSeq = ++restaurantSearchSeq;
restaurantSearchController?.abort();
restaurantSearchController = new AbortController();
const signal=restaurantSearchController.signal;
let timedOut=false;
const deadline=setTimeout(()=>{timedOut=true;restaurantSearchController.abort()},14500);
clearSuggestions(); setFindBusy(true); $('status').textContent = 'Searching restaurants…';
$('restStage')?.setAttribute('aria-busy','true');
$('restStage')?.classList.add('is-searching');
try {
let loc = S.location;
if (!loc) {
const q = $('address').value.trim();
if (!q) { $('status').textContent = 'Enter an address or use your location.'; return; }
const rr = await fetchRestaurantEndpoint('/api/restaurant-search?mode=resolve&q='+encodeURIComponent(q),signal);
const rd = await responseJson(rr,'Could not locate that address. Please try another address.');
if (searchSeq !== restaurantSearchSeq) return;
if (!rr.ok || !rd.ok) throw new Error(rr.status===429 ? 'Address lookup is temporarily busy. Please try again.' : (rd.message || 'Could not locate that address.'));
const visibleLabel=displayRestaurantLocationLabel(rd.display,q); loc = {lat:rd.lat, lon:rd.lon, label:visibleLabel}; S.location = loc; S.locationSource='address'; renderLocationSource(); $('address').value = visibleLabel;
}
const radius = Math.min(100,Math.max(1,Number(options?.radius ?? $('radius')?.value)||10));
S.restaurantSearchRadius=radius;
const searchTerm = String(S.restaurantQuery||'').trim().slice(0,100);
const searchKey = Number(loc.lat).toFixed(4)+':'+Number(loc.lon).toFixed(4)+':'+radius+':'+normalizeRestaurantSearch(searchTerm);
 const previousSearchKey=String(S.restaurantSearchKey||'');
 const previousOrigin=S.restaurantSearchOrigin&&Number.isFinite(Number(S.restaurantSearchOrigin.lat))&&Number.isFinite(Number(S.restaurantSearchOrigin.lon))
   ? {lat:Number(S.restaurantSearchOrigin.lat),lon:Number(S.restaurantSearchOrigin.lon)}
   : null;
 const sameLocationQuery=!!previousOrigin
   && Math.abs(previousOrigin.lat-Number(loc.lat))<=0.0002
   && Math.abs(previousOrigin.lon-Number(loc.lon))<=0.0002
   && normalizeRestaurantSearch(String(S.restaurantSearchQuery||''))===normalizeRestaurantSearch(searchTerm);
 // CP1186: radius changes must never inherit a prior-radius pool.
 let replacingSearchTarget=!!previousSearchKey&&previousSearchKey!==searchKey;
 if(replacingSearchTarget&&!sameLocationQuery){
   // CP1078: never leave the previous location/radius/query cards on screen
   // while a materially different restaurant search is being rebuilt.
   S.restaurantPool=[];
   S.restaurantSearchTimeZone='';
   S.restaurantIndex=0;
   S.restaurantActions=[];
   S.restaurantMaybeRound=false;
   S.maybeDeck=false;
   S.winnerItem=null;
   await drawRestaurants();
 }
const queryParam = searchTerm ? '&q='+encodeURIComponent(searchTerm) : '';
const rr = await fetchRestaurantEndpoint('/api/restaurant-search?mode=search&lat='+encodeURIComponent(loc.lat)+'&lon='+encodeURIComponent(loc.lon)+'&radius='+radius+queryParam,signal);
const d = await responseJson(rr,'Restaurant search returned an invalid response. Please try again.');
if (searchSeq !== restaurantSearchSeq) return;
if (!rr.ok || !d.ok) throw new Error(rr.status===429 ? 'Restaurant search is temporarily busy. Please try again.' : (d.message || 'Restaurant search failed.'));
const returnedRadius=Number(d.radiusMiles);
if(Number.isFinite(returnedRadius)&&Math.abs(returnedRadius-radius)>0.001){
 throw new Error('Restaurant search returned the wrong radius. Please try again.');
}
S.restaurantSearchDegraded = !!(d.providerErrors?.length);
S.restaurantSearchLatencyMs = Number(d.searchLatencyMs)||0;
S.restaurantSearchQuery = String(d.searchQuery||searchTerm||'');
S.restaurantSearchBudgetMs = Number(d.searchBudgetMs)||12000;
// Rebuild the active restaurant pool from the fresh provider response.
 // Do not carry the previous pool forward: stale rows can survive provider-side
 // dedupe/filter fixes and reappear as duplicate or non-restaurant cards.
 const incomingRows=(d.results || []).map(row => ({...row, providerId:row.id, canonicalId:restaurantCanonicalId(row), _maybe:false, _cut:false, _hidden:false})).filter(row=>{
 const dist=milesBetween(row.lat,row.lon,loc.lat,loc.lon);
 return Number.isFinite(dist) && dist<=radius+0.001;
});
// CP1186: each requested radius is rebuilt from its own provider response.
 const mergedRows=incomingRows;
 S.restaurantPool = dedupeRestaurantPool(mergedRows).filter(row=>{
   const dist=milesBetween(row.lat,row.lon,loc.lat,loc.lon);
   return Number.isFinite(dist)&&dist<=radius+0.001;
 }).sort((a,b)=>Number(a.distance||Infinity)-Number(b.distance||Infinity));
S.restaurantSearchOrigin = {lat:Number(loc.lat),lon:Number(loc.lon)};
S.restaurantSearchKey = searchKey;
 S.restaurantSearchTimeZone=String(d.hoursTimeZone||'');
S.restaurantIndex = 0; S.restaurantActions = []; S.restaurantMaybeRound = false;
S.winnerItem = null;
if(S.restaurantPool.length) {
  updateRestaurantStatus();
} else {
  $('status').textContent = d.providerErrors?.length ? 'Restaurant sources are unavailable. Try again.' : 'No restaurants found in this radius.';
}
restaurantQuick();
renderRestaurantHours();
if(S.restaurantPool.length){
  $('restStage')?.setAttribute('data-photo-state','preparing');
  await primeRestaurantPhotosBeforeFirstPaint(S.restaurantPool, S.restaurantIndex);
}
await drawRestaurants();
$('restStage')?.removeAttribute('data-photo-state');
save();
} catch (err) {
if (err?.name==='AbortError' || searchSeq !== restaurantSearchSeq) return;
S.restaurantSearchDegraded=true;
 if(replacingSearchTarget&&!sameLocationQuery){
   S.restaurantSearchTimeZone='';
   S.restaurantSearchKey='';
   S.restaurantPool=[];
   S.restaurantIndex=0;
   await drawRestaurants().catch(()=>{});
 }
$('status').textContent = timedOut ? 'The restaurant search took too long. Please try again.' : (err?.message || 'Could not complete the search.');
} finally {
clearTimeout(deadline);
if(searchSeq===restaurantSearchSeq){
  $('restStage')?.removeAttribute('aria-busy');
  $('restStage')?.classList.remove('is-searching');
  setFindBusy(false);
}
}
}
function openRestaurant(options={}) {
renderRestaurantSearchControl();
S.screen = 'restaurant';
S.restaurantActions = [];
S.restaurantMaybeRound = false;
S.maybeDeck = false;
S.restaurantQuery = '';
S.restaurantHours = 'all';
S.restaurantHoursCollapsed = true;
S.restaurantCuts.clear();
for (const row of S.restaurantPool || []) {
row._cut = false;
row._maybe = false;
}
S.winnerItem = null;
show('restaurant');
restaurantQuick();
renderRestaurantHours();
$('restaurantSearchBox')?.classList.add('hidden');
$('restaurantQuery').value = '';
maybeShowInCardSwipeCoach();

// Restaurant entry is location-first: use the device location automatically whenever
// this screen is entered or re-entered, while preserving a deliberate typed-address search.
const hasTypedAddress=!!String($('address')?.value||'').trim();
const shouldAutoUseDeviceLocation=S.locationSource==='device'||!hasTypedAddress;
if(shouldAutoUseDeviceLocation) {
 window.setTimeout(()=>{
   if(S.screen!=='restaurant'||locationRequestActive)return;
   const currentAddress=String($('address')?.value||'').trim();
   const preserveTypedAddress=!!currentAddress&&S.locationSource==='typed';
   if(!preserveTypedAddress) useLocation();
 },80);
}
if(tutorialModeEnabled()&&tutorialState.active){
 const resumeIndex=Number.isInteger(options?.tutorialResumeIndex)?options.tutorialResumeIndex:0;
 tutorialEnterDecisionScreen('restaurant',resumeIndex);
}
}
let restaurantDrawSeq=0;
async function drawRestaurants() {
const drawSeq=++restaurantDrawSeq;
renderRestaurantHours();
let rows = restaurantPoolFiltered();
renderRestaurantSearchControl();
updateRestaurantStatus();
renderMaybeDeckToggle('restaurant');
if (!rows.length) {
const hasResults=!!S.restaurantPool.length;
const message=hasResults ? (S.restaurantHours!=='all' && restaurantPoolBase().length ? 'No restaurants match the Hours filter.' : 'No restaurants match the current filters.') : (S.restaurantSearchDegraded ? 'Some restaurant sources are unavailable.' : (S.location ? 'No restaurants found in this radius.' : 'Set a location, then find restaurants.'));
const actions = (S.location || hasResults) ? '<div class="empty-actions">'+(hasResults?'<button class="secondary" id="clearRestaurantSearch">Clear filter</button>':'')+(S.location?'<button class="premium-retry" id="retryRestaurantSearch">Retry Search</button>':'')+'</div>' : '';
$('restStage').innerHTML = '<div class="empty"><b>Hungry.</b><span>'+esc(message)+'</span>'+actions+'</div>';
if($('retryRestaurantSearch')) $('retryRestaurantSearch').onclick=searchRestaurants;
if($('clearRestaurantSearch')) $('clearRestaurantSearch').onclick=()=>{S.restaurantQuery=''; if($('restaurantQuery'))$('restaurantQuery').value=''; drawRestaurants(); save();};
return;
}
S.restaurantIndex = Math.max(0, Math.min(S.restaurantIndex, rows.length - 1));
if(!S.restaurantMaybeRound){const ni=restaurantChoiceIndex(rows,S.restaurantIndex,false);if(ni>=0)S.restaurantIndex=ni;else if(rows.some(x=>x._maybe)){S.restaurantMaybeRound=true;S.restaurantIndex=restaurantChoiceIndex(rows,0,true);}}
const prepared=await prepareRestaurantPhotoDeck(rows,S.restaurantIndex,2);
if(drawSeq!==restaurantDrawSeq)return;
rows=restaurantPoolFiltered();
if(prepared.firstId){
 const readyIndex=rows.findIndex(row=>String(row.id)===String(prepared.firstId));
 if(readyIndex>=0)S.restaurantIndex=readyIndex;
}
if(S.restaurantIndex<0||S.restaurantIndex>=rows.length)S.restaurantIndex=0;
const row = rows[S.restaurantIndex];
if(!row)return;
const category = restaurantCategory(row);
const restaurantFallback = restaurantImmediatePhoto;
const image = restaurantFallback(row);
const distanceLabel=Number.isFinite(Number(row.distance)) ? Number(row.distance).toFixed(1)+' mi away' : '';
const restaurantMaybeBadge=row._maybe?'<span class="maybe-stamp restaurant-maybe-stamp" aria-label="Marked Maybe">MAYBE</span>':'';
const nextRow = rows[S.restaurantIndex + 1];
const nextImage = restaurantFallback(nextRow);
const shortAddress = row.address ? esc(String(row.address).split(',').slice(0,2).join(', ')) : '';
 const cardLocation = (shortAddress || distanceLabel) ? '<div class="restaurant-card-location-distance" title="'+esc(row.address||'')+'">'+[shortAddress,distanceLabel?esc(distanceLabel):''].filter(Boolean).join(' <span aria-hidden="true">•</span> ')+'</div>' : '';
const cardDetailsAction = '<button class="restaurant-card-utility restaurant-card-details-utility card-details-inline" id="restDetails" type="button" aria-label="Details" title="Details"><svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 7.25h2M11 7.25h7M6 12h2M11 12h7M6 16.75h2M11 16.75h5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
 const cardUtilityRow='<div class="card-info-row card-cuisine-row restaurant-card-meta-row"><span class="restaurant-card-meta card-cuisine-text">'+esc(category)+'</span>'+cardDetailsAction+'</div>';
$('restStage').innerHTML =
'<div class="restaurant-card-stack"><article class="card next-card '+(nextRow?'':'hidden')+'" id="restaurantNextCard" aria-hidden="true"><img src="'+esc(nextImage)+'" data-restaurant-photo-key="'+esc(nextRow?.id||'')+'" alt="'+esc(nextRow?.name||'')+'"><div class="shade"></div><div class="card-copy restaurant-next-copy">'+(nextRow?('<div class="card-info-row card-cuisine-row restaurant-card-meta-row"><span class="restaurant-card-meta card-cuisine-text">'+esc(restaurantCategory(nextRow))+'</span><span class="restaurant-card-utility restaurant-card-details-utility card-details-inline card-details-visual" aria-hidden="true"><svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 7.25h2M11 7.25h7M6 12h2M11 12h7M6 16.75h2M11 16.75h5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><h3>'+esc(nextRow.name||'')+'</h3>'): '')+'</div><div class="restaurant-photo-credit" aria-live="polite"></div></article><article class="card" id="restaurantCard"><img src="'+esc(image)+'" data-restaurant-photo-key="'+esc(row.id||'')+'" alt="'+esc(row.name)+'"><div class="shade"></div><div class="restaurant-card-photo-ui">'+restaurantMaybeBadge+'</div><div class="restaurant-photo-credit" aria-live="polite"></div><div class="card-copy">'+cardUtilityRow+'<h3>'+esc(row.name)+'</h3>'+cardLocation+'</div></div></article></div>'+'<div class="swipe-actions unified-swipe-actions" aria-label="Restaurant decision controls"><button class="round-action round-back secondary" id="restBack" aria-label="Back"><span>↶</span></button><button class="round-action round-cut cut" id="restCut" aria-label="Cut"><span>✕</span></button><button class="round-action round-maybe maybe" id="restMaybe" aria-label="Maybe"><span>♥</span></button><button class="round-action round-choose choose" id="restChoose" aria-label="Choose this restaurant"><span>✓</span></button></div>';
const current = rows[S.restaurantIndex];
const restBackButton=$('restBack');if(restBackButton){const familyBack=familyIsBrowseStage('restaurant')&&!familyBrowseSubmitted();restBackButton.disabled=!familyBack&&S.restaurantActions.length===0;restBackButton.setAttribute('aria-disabled',String(!familyBack&&S.restaurantActions.length===0));}
bindCardButton('restBack', restaurantBack);
bindCardButton('restCut', () => restaurantCut(current));
bindCardButton('restMaybe', () => restaurantMaybe(current));
bindCardButton('restChoose', () => {dismissSwipeHint();if(S.familyNormalMode==='decision'&&S.familyDecisionType==='restaurant'){familyRoundStage()===1?familyEnterMaybes('restaurant'):familyPickSingle('restaurant');}else winner(current)});
bindCardButton('restDetails', () => detailsSheet(current,'restaurant'));
bindRestaurantSwipe(current);bindMaybeDeckToggle('restaurant');
const handoffRestaurantCard=$('restaurantCard');
if(restaurantSwipeHandoff&&handoffRestaurantCard){
  handoffRestaurantCard.style.opacity='0';
  handoffRestaurantCard.style.visibility='hidden';
  handoffRestaurantCard.style.pointerEvents='none';
}
bindRestaurantPhotoPinch($('restaurantCard')?.querySelector('img'));
const restaurantNextCard=$('restaurantNextCard');
const restaurantNextImageEl=$('#restStage #restaurantNextCard img');
if(nextRow&&restaurantNextCard&&restaurantNextImageEl){
  restaurantNextImageEl.decoding='async';
  stageSwipePreview(restaurantNextCard,restaurantNextImageEl,nextImage,nextRow.id);
  restaurantNextCard.__restaurantCanonicalPhotoPromise=loadRestaurantPhoto(nextRow).then(async data=>{
   if(!data?.url)return null;
   if(!restaurantNextCard.isConnected||restaurantNextCard.dataset.swipePromoted==='1')return data.url;
   if(String(restaurantNextCard.dataset.swipePreviewKey||'')!==String(nextRow.id||''))return data.url;
   const swapped=await swapImageWhenReady(restaurantNextImageEl,data.url);
   if(swapped){
    restaurantNextImageEl.dataset.restaurantPhotoLoaded='true';
    restaurantNextCard.dataset.restaurantPhotoCanonical='1';
    setRestaurantPhotoCredit(restaurantNextCard,data.attributions);
   }
   return data.url;
  }).catch(()=>null);
}
hydrateRestaurantPhoto(row,'#restStage #restaurantCard');
if(nextRow)hydrateRestaurantPhoto(nextRow,'#restStage #restaurantNextCard');
prefetchRestaurantPhotos(rows,S.restaurantIndex,RESTAURANT_PHOTO_PREFETCH_COUNT);
maybeShowInCardSwipeCoach();
if(S.familyNormalMode==='setup'&&S.familyDecisionType==='restaurant')familyNormalBar('restaurant','setup',S.familyActiveData);
}
async function restaurantCut(row){
 dismissSwipeHint();
 if(S.familyNormalMode==='decision'&&S.familyDecisionType==='restaurant'&&familyRoundStage()!==1){familyBrowsePrevious('restaurant');return;}
 if(!row)return;
 const unkept=restaurantPoolFiltered().filter(x=>!x._maybe).length;
 S.restaurantActions.push({type:'cut',id:row.id,index:S.restaurantIndex,maybeRound:!!S.restaurantMaybeRound,hadMaybe:!!row._maybe,roundAfter:!!S.restaurantMaybeRound||(Array.isArray(S.restaurantPool)&&S.restaurantPool.some(x=>x._maybe)&&unkept<=1)});
 row._cut=true;
 const remaining=restaurantPoolFiltered();
 if(!remaining.length)winner({name:'Nothing left — hungry mode',image:HUNGRY_IMAGE,category:'Hungry'});else{S.restaurantIndex=Math.min(S.restaurantIndex,remaining.length-1);await drawRestaurants();}
 save();
}

async function restaurantMaybe(row){
 dismissSwipeHint();
 if(S.familyNormalMode==='decision'&&S.familyDecisionType==='restaurant'&&familyRoundStage()!==1){familyBrowseNext('restaurant');return;}
 if(!row)return;const rows=restaurantPoolFiltered();if(rows.length===1){winner(row);return;}
 const wasRecycle=S.restaurantMaybeRound;S.restaurantActions.push({type:'maybe',id:row.id,index:S.restaurantIndex,maybeRound:wasRecycle,hadMaybe:!!row._maybe});row._maybe=true;
 const remaining=restaurantPoolFiltered(),next=restaurantChoiceIndex(remaining,(S.restaurantIndex+1)%Math.max(1,remaining.length),wasRecycle);
 if(next>=0)S.restaurantIndex=next;else{S.restaurantMaybeRound=true;S.restaurantIndex=restaurantChoiceIndex(remaining,0,true);}
 await drawRestaurants();save();
}

function restaurantBack(){
 if(familyIsBrowseStage('restaurant')){familyBrowseBack('restaurant');return;}
 const action=S.restaurantActions.pop();if(!action)return;
 const row=S.restaurantPool.find(x=>x.id===action.id);if(row){if(action.type==='cut')row._cut=false;if(action.type==='maybe')row._maybe=!!action.hadMaybe;}
 S.restaurantMaybeRound=!!action.maybeRound||!!action.roundAfter;const rows=restaurantPoolFiltered(),restored=rows.findIndex(x=>x.id===action.id);
 S.restaurantIndex=restored>=0?restored:Math.max(0,Math.min(action.index||0,Math.max(0,rows.length-1)));drawRestaurants();save();
}

async function restaurantHide(row) {
if (!row) return false;
if (!await appConfirm('Hide this restaurant?', 'Hide '+row.name+' until you restore it in Settings.', 'Hide')) return false;
row._hidden = true;
S.hiddenRestaurants[row.id] = {
id:row.id,canonicalId:row.canonicalId||restaurantCanonicalId(row),name:row.name,photo:row.photo||row.image||'',category:restaurantCategory(row),
address:row.address||'',phone:row.phone||'',lat:row.lat,lon:row.lon,website:row.website||''
};
drawRestaurants();
save();
return true;
}
function bindCardButton(id,handler){
 const el=$(id);if(!el)return;
 const premiumDecision=/^(?:food|rest)(?:Cut|Maybe|Choose)$/.test(id);
 let pressTimer=0;
 el.setAttribute('type',el.getAttribute('type')||'button');
 el.style.touchAction='manipulation';
 el.style.webkitUserSelect='none';
 el.style.userSelect='none';

 const clearPress=()=>{
  if(!premiumDecision)return;
  clearTimeout(pressTimer);
  pressTimer=window.setTimeout(()=>el.classList.remove('is-pressed'),150);
 };

 el.onpointerdown=e=>{
  if(el.disabled)return;
  if(premiumDecision){
   clearTimeout(pressTimer);
   el.classList.add('is-pressed');
  }
 };

 // CP1244: buttons have one authoritative activation path. Pointerup is
 // visual-only; click is the command. This avoids pointerup + click double
 // activation and lets the swipe transaction be the single source of truth.
 el.onclick=e=>{
  if(el.disabled)return;
  const now=performance.now();
  if(premiumDecision){
   el.__dinliminateLastActivation=now;
   el.classList.add('is-pressed');
   if(id==='foodCut'||id==='restCut'||id==='foodMaybe'||id==='restMaybe')triggerSwipeHaptic();
  }

  clearPress();
  e?.preventDefault?.();
  e?.stopPropagation?.();

  if((id==='foodChoose'||id==='restChoose')&&typeof tutorialMarkChoose==='function'){
   tutorialMarkChoose(id==='restChoose'?'restaurant':'food');
  }

  try{
   const swipeCardId=(id==='foodCut'||id==='foodMaybe')?'foodCard':(id==='restCut'||id==='restMaybe')?'restaurantCard':'';
   const swipeDecision=(id==='foodCut'||id==='restCut')?-1:(id==='foodMaybe'||id==='restMaybe')?1:0;
   const swipeCard=swipeCardId?$(swipeCardId):null;

   if(swipeDecision&&swipeCard?.__triggerSwipeDecision){
    const transaction=swipeCard.__triggerSwipeDecision(swipeDecision);
    // CP1244: an active transaction consumes the command. Never fall through
    // to foodCut/foodMaybe/restaurantCut/restaurantMaybe while that card is
    // still leaving, even when the visual flight is still in progress.
    if(transaction==='accepted'||transaction==='busy')return;
   }

   const result=handler?.(e);
   if(result&&typeof result.catch==='function')result.catch(()=>{});
  }catch{}
 };
 el.onpointercancel=clearPress;
}

// CP1244 — One decision transaction per active card. A busy card consumes
// subsequent Cut/Maybe commands instead of letting them mutate app state.

function bindRestaurantSwipe(row){bindSwipeCard('restaurantCard','restaurantNextCard',()=>familyIsBrowseStage('restaurant')?familyBrowseNext('restaurant'):restaurantCut(row),()=>familyIsBrowseStage('restaurant')?familyBrowsePrevious('restaurant'):restaurantMaybe(row))}
let restaurantQueryTimer = 0;
function scheduleRestaurantProviderSearch(){
 clearTimeout(restaurantQueryTimer);
 const q=String(S.restaurantQuery||'').trim();
 if(q.length<2)return;
 restaurantQueryTimer=setTimeout(()=>{searchRestaurants();},650);
}
function renderRestaurantSearchControl(){
 const btn=$('restaurantSearchToggle');
 const box=$('restaurantSearchBox');
 if(!btn||!box)return;
 const isOpen=!box.classList.contains('hidden');
 btn.classList.toggle('is-open',isOpen);
 btn.setAttribute('aria-expanded',String(isOpen));
 btn.setAttribute('aria-label',isOpen?'Close Search':'Open Search');
 btn.title=isOpen?'Close Search':'Open Search';
}
function collapseRestaurantSearch(clear=false){
 clearTimeout(restaurantQueryTimer);
 restaurantQueryTimer=0;
 restaurantSearchSeq++;
 restaurantSearchController?.abort();
 restaurantSearchController=null;
 setFindBusy(false);
 const box=$('restaurantSearchBox');
 if(box)box.classList.add('hidden');
 if(clear){
   const input=$('restaurantQuery');
   if(input)input.value='';
   S.restaurantQuery='';
   S.restaurantIndex=0;
 }
 renderRestaurantSearchControl();
}
function setRestaurantRefinePanel(kind,open=null){
 const searchBox=$('restaurantSearchBox');
 const isSearchOpen=!!searchBox&&!searchBox.classList.contains('hidden');
 const isCuisineOpen=!S.quickCutsCollapsed?.restaurant;
 const isHoursOpen=!S.restaurantHoursCollapsed;
 const current=kind==='search'?isSearchOpen:(kind==='cuisine'?isCuisineOpen:isHoursOpen);
 const next=open===null?!current:!!open;
 if(kind==='search'){
  if(next){
   S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),restaurant:true};
   S.restaurantHoursCollapsed=true;
   searchBox?.classList.remove('hidden');
  }else collapseRestaurantSearch(false);
 }else if(kind==='cuisine'){
  if(next){
   collapseRestaurantSearch(false);
   S.restaurantHoursCollapsed=true;
   S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),restaurant:false};
  }else S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),restaurant:true};
 }else if(kind==='hours'){
  if(next){
   collapseRestaurantSearch(false);
   S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),restaurant:true};
   S.restaurantHoursCollapsed=false;
  }else S.restaurantHoursCollapsed=true;
 }
 renderRestaurantSearchControl();
 renderQuickCutsCollapse('restaurant');
 renderRestaurantHours();
}
function closeRestaurantSearch(){
 collapseRestaurantSearch(true);
 drawRestaurants();
 save();
}
function bindRestaurantTools(){
 bindRestaurantHours();
 const searchButton=$('restaurantSearchToggle');
 if(searchButton)searchButton.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   const box=$('restaurantSearchBox');
   if(!box)return;
   const willOpen=box.classList.contains('hidden');
   setRestaurantRefinePanel('search',willOpen);
   if(willOpen){
     const input=$('restaurantQuery');
     if(input)input.value=S.restaurantQuery||'';
     input?.focus();
   }
 };
 const queryInput=$('restaurantQuery');
 if(queryInput)queryInput.oninput=()=>{
   const previousQuery=String(S.restaurantQuery||'').trim();
   S.restaurantQuery=String(queryInput.value||'').trim().slice(0,100);
   S.restaurantIndex=0;
   save();
   if(!S.restaurantQuery && previousQuery){
     clearTimeout(restaurantQueryTimer); restaurantQueryTimer=0; searchRestaurants(); return;
   }
   scheduleRestaurantProviderSearch();
 };
 if(queryInput)queryInput.onkeydown=e=>{
   if(e.key==='Enter'){
     e.preventDefault();e.stopPropagation();
     clearTimeout(restaurantQueryTimer);restaurantQueryTimer=0;
     S.restaurantQuery=String(e.currentTarget?.value||'').trim().slice(0,100);
     S.restaurantIndex=0;
     if(S.restaurantQuery)searchRestaurants();
   }
 };
 renderRestaurantSearchControl();
}
let celebrationHideTimer=0;
function hideCelebration(){
 const el=$('celebration');
 if(celebrationHideTimer){clearTimeout(celebrationHideTimer);celebrationHideTimer=0;}
 if(el){el.classList.add('hidden');el.innerHTML='';}
}
function triggerCelebration(goldOnly=false) {
const el = $('celebration');
if (!el) return;
if(celebrationHideTimer){clearTimeout(celebrationHideTimer);celebrationHideTimer=0;}
el.innerHTML = ''; 
const colors = goldOnly
 ? ['#c6a46a','#f1d894','#fff7df','#d8b86b','#fffaf0']
 : ['#c6a46a','#f1d894','#f5f1e8','#ffb04a','#fffaf0'];
for (let b=0;b<3;b++) {
const burst = document.createElement('div');
burst.className='firework-burst burst-'+(b+1);
for (let i=0;i<18;i++) {
const p=document.createElement('span');
p.style.setProperty('--angle',(i*20)+'deg');
p.style.setProperty('--delay',(b*0.11 + (i%5)*0.015)+'s');
p.style.setProperty('--color',colors[i%colors.length]);
burst.appendChild(p);
}
el.appendChild(burst);
}
el.classList.remove('hidden');
celebrationHideTimer=window.setTimeout(()=>{el.classList.add('hidden');el.innerHTML='';celebrationHideTimer=0;},14000);
}
function triggerWinnerMoment(hungry=false){
 const el=$('winner');if(!el)return;
 el.classList.remove('winner-reveal');
 void el.offsetWidth;
 if(!hungry){
  el.classList.add('winner-reveal');
  triggerSwipeHaptic();
  window.setTimeout(()=>el.classList.remove('winner-reveal'),1800);
 }
}

function wheelPoint(cx,cy,r,angle){
const rad=angle*Math.PI/180;
return {x:cx+Math.cos(rad)*r,y:cy+Math.sin(rad)*r};
}

function sampleHungryWheel(pool,selected=null,count=12){
 const source=[...(pool||[])].filter(Boolean);
 if(!source.length)return [];
 const target=String(selected?.id||'');
 const others=source.filter(x=>String(x.id)!==target);
 for(let i=others.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[others[i],others[j]]=[others[j],others[i]];}
 const take=Math.min(count,source.length);
 const chosen=others.slice(0,Math.max(0,take-(selected?1:0)));
 if(selected){
   const slot=Math.floor(Math.random()*Math.min(take,Math.max(1,chosen.length+1)));
   chosen.splice(Math.min(slot,chosen.length),0,selected);
 }
 return chosen.slice(0,take);
}
function renderHungryWheel(){
 const svg=$('hungryWheel');
 const countEl=$('hungryWheelCount');
 if(!svg)return;
 const basePool=hungryWheelPool();
 const pool=basePool.length?basePool:allFoods();
 S.hungryWheelDisplayItems=pool;
 if(countEl)countEl.textContent=pool.length+' meals on the wheel';
 const cx=180,cy=180,r=168,inner=35,step=360/Math.max(1,pool.length);
 const fills=['#171716','#26333b','#4a3a25','#d9cdb7','#20282d','#5a4426','#191918','#31414a','#745b31','#c9bea9','#242c30','#846736'];
 svg.setAttribute('aria-label','Dinner wheel with '+pool.length+' meals');
 svg.innerHTML=pool.map((item,index)=>{
   const start=-90+index*step, end=start+step-.08;
   const p1=wheelPoint(cx,cy,r,start),p2=wheelPoint(cx,cy,r,end);
   const q1=wheelPoint(cx,cy,inner,end),q2=wheelPoint(cx,cy,inner,start);
   const d='M '+p1.x.toFixed(2)+' '+p1.y.toFixed(2)+' A '+r+' '+r+' 0 0 1 '+p2.x.toFixed(2)+' '+p2.y.toFixed(2)+' L '+q1.x.toFixed(2)+' '+q1.y.toFixed(2)+' A '+inner+' '+inner+' 0 0 0 '+q2.x.toFixed(2)+' '+q2.y.toFixed(2)+' Z';
   const landed=String(S.hungryWheelLandedId||'')===String(item.id);
   const fill=landed?'#c6a46a':fills[index%fills.length];
   return '<path class="wheel-segment'+(landed?' is-landed':'')+'" data-wheel-index="'+index+'" d="'+d+'" fill="'+fill+'" stroke="#0b0b0b" stroke-width="1.15"><title>Meal choice</title></path>';
 }).join('')+
 '<circle class="wheel-center" cx="180" cy="180" r="36" fill="#0e0e0d" stroke="#c6a46a" stroke-width="1.7"/>'+
 '<circle cx="180" cy="180" r="7" fill="#c6a46a"/>';
 svg.style.setProperty('--wheel-rotation',S.hungryWheelRotation+'deg');
 svg.style.setProperty('--wheel-resting-rotation',S.hungryWheelRotation+'deg');
}

function hungryWheelPool(){
const active=allFoods().filter(item=>!S.hidden.has(String(item.id)));
return active.length?active:allFoods();
}
function showHungryWheelResult(item){
const panel=$('hungryWheelPanel'),result=$('hungryWheelResult'),name=$('hungryWheelResultName'),img=$('hungryWheelResultImg'),choose=$('hungryWheelChoose'),spin=$('hungryWheelSpin');
if(name)name.textContent=item?.name||'';
if(img){
 const src=foodPhoto(item);
 img.src=src;
 img.alt=item?.name||'Chosen meal';
 img.onerror=function(){
   const fb=foodPhotoFallback(item);
   if(this.src!==fb)this.src=fb;
 };
}
result?.classList.remove('hidden');
panel?.classList.add('has-landed');
if(choose){choose.disabled=false;choose.classList.remove('hidden');}
if(spin){spin.disabled=false;spin.textContent='Spin Again';}
}
function hungryRestaurantPool(){
 const raw=(S.restaurantPool||[]).filter(row=>{
   if(!row)return false;
   if(row._hidden||restaurantHidden(row))return false;
   if(!restaurantMatchesQuery(row))return false;
   if([...S.restaurantCuts].some(label=>restaurantQuickMatches(row,label)))return false;
   return true;
 });
 const unique=dedupeRestaurantPool(raw);
 return unique.length?unique:raw;
}
function hungryRestaurantPick(excludeId=null){
 const pool=hungryRestaurantPool();
 if(!pool.length)return null;
 const candidates=excludeId==null?pool:pool.filter(row=>String(row.id)!==String(excludeId));
 const source=candidates.length?candidates:pool;
 const forced=Number(window.__DINLIMINATE_TEST_MYSTERY_INDEX);
 const index=Number.isInteger(forced)&&forced>=0&&forced<source.length?forced:Math.floor(Math.random()*source.length);
 return source[index]||null;
}
function renderHungryRestaurantMystery(item,covered=true){
 const card=$('hungryMysteryCard'),img=$('hungryMysteryImg'),result=$('hungryMysteryResult');
 const choose=$('hungryMysteryChoose'),again=$('hungryMysteryAgain'),reveal=$('hungryMysteryReveal');
 if(!card||!img||!result)return;
 if(item){
   const src=imageProxyUrl(item?.photo||item?.image||item?.photoFallback||restaurantFallbackImage(item));
   img.src=src;
   img.alt=item.name||'Mystery restaurant';
   img.onerror=function(){
     const fb=restaurantFallbackImage(item);
     if(this.src!==fb)this.src=fb;
   };
   img.dataset.restaurantPhotoKey=String(item.id||item.canonicalId||'');
 }
 card.classList.toggle('is-revealed',!covered);
 const cover=card.querySelector('.hungry-mystery-cover');
 if(cover)cover.classList.toggle('hidden',!covered);
 result.classList.toggle('hidden',covered||!item);
 if(item&&!covered){
   $('hungryMysteryResultImg').src=imageProxyUrl(item?.photo||item?.image||item?.photoFallback||restaurantFallbackImage(item));
   $('hungryMysteryResultImg').alt=item.name||'Chosen restaurant';
   $('hungryMysteryResultImg').dataset.restaurantPhotoKey=String(item.id||item.canonicalId||'');
   $('hungryMysteryResultName').textContent=item.name||'';
   const meta=[restaurantCategory(item),Number.isFinite(Number(item.distance))?Number(item.distance).toFixed(1)+' mi':String(item.address||'').split(',')[0]].filter(Boolean).join(' · ');
   $('hungryMysteryResultMeta').textContent=meta;
   hydrateRestaurantPhoto(item,'#hungryRestaurantPanel');
 }
 if(again){const canAgain=hungryRestaurantPool().length>=2;again.classList.toggle('hidden',covered||!canAgain);again.disabled=false;}
 if(choose)choose.classList.toggle('hidden',covered);
 if(reveal)reveal.classList.toggle('hidden',!covered);
}
function startHungryRestaurantMystery(){
 const countEl=$('hungryRestaurantCount');
 const pool=hungryRestaurantPool();
 if(countEl)countEl.textContent=pool.length?pool.length+' restaurants from your current search':'No restaurant options available';
 S.hungryRestaurantChoice=null;
 S.hungryRestaurantPendingChoice=null;
 const img=$('hungryMysteryImg');
 if(img){img.removeAttribute('src');img.alt='Mystery restaurant';}
 renderHungryRestaurantMystery(null,true);
 const reveal=$('hungryMysteryReveal');
 if(reveal)reveal.disabled=!pool.length;
}
function revealHungryRestaurant(){
 if(S.hungryRestaurantChoice)return;
 const item=S.hungryRestaurantPendingChoice||hungryRestaurantPick();
 if(!item){appToast('No restaurant options are available for a mystery pick.');return;}
 S.hungryRestaurantChoice=item;
 S.hungryRestaurantPendingChoice=null;
 const card=$('hungryMysteryCard'),reveal=$('hungryMysteryReveal'),result=$('hungryMysteryResult'),cover=card?.querySelector('.hungry-mystery-cover');
 if(!card||!result){renderHungryRestaurantMystery(item,false);return;}
 const img=$('hungryMysteryImg');
 if(img){
   const src=imageProxyUrl(item?.photo||item?.image||item?.photoFallback||restaurantFallbackImage(item));
   img.src=src; img.alt=item.name||'Mystery restaurant'; img.dataset.restaurantPhotoKey=String(item.id||item.canonicalId||'');
   img.onerror=function(){const fb=restaurantFallbackImage(item);if(fb&&this.src!==fb)this.src=fb;};
 }
 card.classList.remove('is-revealed');
 card.classList.add('is-revealing');
 cover?.classList.remove('hidden');
 result.classList.add('hidden');
 if(reveal){reveal.disabled=true;reveal.textContent='Unveiling…';}
 window.setTimeout(()=>{
   if(S.hungryRestaurantChoice!==item)return;
   card.classList.remove('is-revealing');
   card.classList.add('is-revealed');
   cover?.classList.add('hidden');
   renderHungryRestaurantMystery(item,false);
   const again=$('hungryMysteryAgain'),choose=$('hungryMysteryChoose');
   if(again)again.disabled=hungryRestaurantPool().length<2;
   if(choose)choose.focus?.();
 },1850);
}
function tryAnotherHungryRestaurant(){
 const current=S.hungryRestaurantChoice;
 const next=hungryRestaurantPick(current?.id);
 S.hungryRestaurantChoice=null;
 S.hungryRestaurantPendingChoice=next;
 renderHungryRestaurantMystery(null,true);
 const reveal=$('hungryMysteryReveal');
 if(reveal){
   reveal.disabled=!next;
   reveal.textContent='Reveal';
   reveal.classList.remove('hidden');
 }
 if(!next)appToast('No other restaurant options are available.');
}
function finishHungryWheelRotation(item,rotation){
 const svg=$('hungryWheel'),spin=$('hungryWheelSpin');
 S.hungryWheelRotation=rotation;
 S.hungryWheelChoice=item||null;
 S.hungryWheelLandedId=item?.id?String(item.id):null;
 S.hungryWheelSpinning=false;
 S.hungryWheelSpinPhase='idle';
 if(S.hungryWheelFrame){cancelAnimationFrame(S.hungryWheelFrame);S.hungryWheelFrame=null;}
 if(spin){spin.disabled=false;spin.setAttribute('aria-busy','false');spin.textContent='Spin Again';}
 svg?.classList.remove('is-spinning','is-continuous','is-slowing');
 if(svg){
   svg.style.setProperty('--wheel-rotation',rotation+'deg');
   svg.style.setProperty('--wheel-resting-rotation',rotation+'deg');
 }
 showHungryWheelResult(item);
 renderHungryWheel();
 triggerCelebration(true);
 triggerSwipeHaptic();
}

function startContinuousWheelSpin(){
 const svg=$('hungryWheel');
 if(!svg||S.hungryWheelSpinning)return;
 hideCelebration();
 if(S.hungryWheelSpinToken==null)S.hungryWheelSpinToken=0;
 S.hungryWheelSpinToken++;
 const pool=hungryWheelPool();
 if(!pool.length){appToast('There are no meals available to spin.');return;}
 S.hungryWheelDisplayItems=pool;
 S.hungryWheelSpinning=true;
 S.hungryWheelSpinPhase='spinning';
 S.hungryWheelWheelStartAt=performance.now();
 S.hungryWheelVelocity=420;
 S.hungryWheelLandedId=null;
 S.hungryWheelChoice=null;
 $('hungryWheelResult')?.classList.add('hidden');
 $('hungryWheelChoose')?.classList.add('hidden');
 $('hungryWheelPanel')?.classList.remove('has-landed');
 const spin=$('hungryWheelSpin');
 if(spin){spin.disabled=false;spin.textContent='Slow It Down';spin.setAttribute('aria-busy','true');}
 svg.classList.remove('is-slowing');
 svg.classList.add('is-continuous');
 const frame=(now)=>{
   if(!S.hungryWheelSpinning||S.hungryWheelSpinPhase!=='spinning')return;
   const dt=Math.min(40,Math.max(0,now-(S.hungryWheelLastFrame||now)));
   S.hungryWheelLastFrame=now;
   S.hungryWheelRotation+=S.hungryWheelVelocity*(dt/1000);
   svg.style.setProperty('--wheel-rotation',S.hungryWheelRotation+'deg');
   S.hungryWheelFrame=requestAnimationFrame(frame);
 };
 S.hungryWheelLastFrame=performance.now();
 S.hungryWheelFrame=requestAnimationFrame(frame);
}

function slowAndStopHungryWheel(){
 const svg=$('hungryWheel'),spin=$('hungryWheelSpin');
 if(!svg||!S.hungryWheelSpinning||S.hungryWheelSpinPhase!=='spinning')return;
 const pool=Array.isArray(S.hungryWheelDisplayItems)&&S.hungryWheelDisplayItems.length?S.hungryWheelDisplayItems:hungryWheelPool();
 if(!pool.length){S.hungryWheelSpinning=false;return;}
 const forced=Number(window.__DINLIMINATE_TEST_WHEEL_INDEX);
 const idx=Number.isInteger(forced)&&forced>=0&&forced<pool.length
   ? forced
   : Math.floor(Math.random()*pool.length);
 const item=pool[idx];
 const step=360/pool.length;
 const targetBase=-(idx*step+step/2);
 const current=S.hungryWheelRotation;
 const target=targetBase+360*Math.ceil((current-targetBase+720)/360);
 const token=S.hungryWheelSpinToken=Number(S.hungryWheelSpinToken||0)+1;
 S.hungryWheelSpinPhase='slowing';
 if(S.hungryWheelFrame){cancelAnimationFrame(S.hungryWheelFrame);S.hungryWheelFrame=null;}
 S.hungryWheelChoice=item;
 S.hungryWheelSpinning=true;
 if(spin){spin.disabled=true;spin.textContent='Slowing…';}
 svg.classList.remove('is-continuous');
 svg.classList.add('is-slowing');
 svg.style.setProperty('--wheel-rotation',target+'deg');
 const finish=()=>{if(token!==S.hungryWheelSpinToken)return;finishHungryWheelRotation(item,target);};
 svg.addEventListener('transitionend',finish,{once:true});
 window.setTimeout(()=>{if(S.hungryWheelSpinning&&S.hungryWheelSpinPhase==='slowing')finish();},3400);
}

function spinHungryWheel(){
 const spin=$('hungryWheelSpin');
 if(S.hungryWheelSpinPhase==='spinning'){slowAndStopHungryWheel();return;}
 if(S.hungryWheelSpinning)return;
 startContinuousWheelSpin();
}

function winner(item, explicitType=null, options={}) {
familyHideWinnerMeta();
const chosenFromWheel=!!S.hungryWheelChoice && String(S.hungryWheelChoice.id)===String(item?.id);
S.winnerItem = item;
S.winnerType = explicitType || (S.screen === 'restaurant' ? 'restaurant' : 'food');
if (item?.category !== 'Hungry' && item?.id && !options?.tutorial) recordHistory(item, S.winnerType, options);
show('winner');
if(tutorialModeEnabled()&&tutorialState.active&&tutorialState.returnContext){
 startTutorialForScreen('winner',true,{index:0});
}
const hungry = item?.category === 'Hungry';
S.hungryWheelChoice=null;
S.hungryWheelSpinning=false;
S.hungryWheelRotation=0;
S.hungryWheelDisplayItems=null;
S.hungryWheelLandedId=null;
S.hungryWheelSpinPhase='idle';
S.hungryWheelVelocity=0;S.hungryWheelFrame=null;
S.hungryRestaurantChoice=null;
S.hungryRestaurantPendingChoice=null;
S.hungryWheelSpinToken++;
const detailsBtn=$('details');
if(detailsBtn){detailsBtn.classList.toggle('hidden',hungry);detailsBtn.setAttribute('aria-hidden',String(hungry));detailsBtn.disabled=hungry;}
$('winner')?.classList.toggle('hungry-mode',hungry);
$('winnerEyebrow')?.classList.toggle('hidden',hungry);
$('winName').classList.toggle('hidden',hungry);
const isRestaurantHungry=hungry&&S.winnerType==='restaurant';
$('hungryWheelPanel')?.classList.toggle('hidden',!hungry||isRestaurantHungry);
$('hungryWheelPanel')?.setAttribute('aria-hidden',String(!hungry||isRestaurantHungry));
$('hungryRestaurantPanel')?.classList.toggle('hidden',!isRestaurantHungry);
$('hungryRestaurantPanel')?.setAttribute('aria-hidden',String(!isRestaurantHungry));
$('hungryNote').textContent=hungry
 ? (S.winnerType==='restaurant'?"You eliminated everything. It’s either this or Waffle House.":"You eliminated everything. It’s either this or Fish Sticks.")
 : '';
$('hungryNote').classList.toggle('hidden',!hungry);
$('winName').textContent = hungry ? 'HUNGRY ☹' : item.name;
const winImg = $('winImg');
if (!winImg) return;
winImg.classList.toggle('hungry-image', hungry);
 if(!hungry)winImg.dataset.noGenericFallback='1';
winImg.classList.toggle('hidden',hungry);
const winnerBaseFallback=S.winnerType==='restaurant'?restaurantFallbackImage(item):HUNGRY_IMAGE;
const winnerImage=S.winnerType==='food'
  ? mealImageUrl(item?.image || item?.photo || item?.photoFallback || winnerBaseFallback)
  : imageProxyUrl(item?.image || item?.photo || item?.photoFallback || winnerBaseFallback);
const winnerFallback=S.winnerType==='food'
  ? mealImageUrl(item?.photoFallback || item?.image || winnerBaseFallback)
  : imageProxyUrl(item?.photoFallback || item?.image || winnerBaseFallback);
winImg.src = winnerImage;
winImg.dataset.fallback = winnerFallback;
winImg.alt = item.name || 'Hungry';
winImg.referrerPolicy='no-referrer';
winImg.loading='eager';
winImg.onerror=function(){
  const fb=this.dataset.fallback||HUNGRY_IMAGE;
  const current=this.currentSrc||this.src;
  if(fb && current!==fb){this.src=fb;return;}
  if(!String(current||'').startsWith('data:image/svg') && HUNGRY_IMAGE){this.src=HUNGRY_IMAGE;}
};
winImg.dataset.restaurantPhotoKey = String(item?.id||item?.canonicalId||'');
if ($('celebration')) $('celebration').classList.toggle('hidden', hungry);
triggerWinnerMoment(hungry);
if(hungry){
  if(isRestaurantHungry){
    startHungryRestaurantMystery();
  }else{
    renderHungryWheel();

    $('hungryWheelPanel')?.classList.remove('has-landed');
    $('hungryWheelResult')?.classList.add('hidden');
    $('hungryWheelChoose')?.classList.add('hidden');
    const spinBtn=$('hungryWheelSpin');
    if(spinBtn){spinBtn.disabled=false;spinBtn.textContent='Spin the Wheel';spinBtn.setAttribute('aria-busy','false');}
  }
}else{
  if(!(chosenFromWheel && $('celebration') && !$('celebration').classList.contains('hidden')))triggerCelebration(chosenFromWheel);
  hydrateRestaurantPhoto(item,'#winner');
  bindRestaurantPhotoPinch(winImg);
}
save();
}
function openModal(id, title, body) {
const opener=document.activeElement;
$(id)?.remove();
$(id+'Bg')?.remove();
const isDrawerUtilityModal=['manageFoodsModal','historyModal','settingsModal'].includes(id);
const bg=document.createElement('div');
bg.id=id+'Bg';
bg.className='modal-bg'+(isDrawerUtilityModal?' modal-bg-open':' modal-bg-opening')+(id==='manageFoodsModal'?' manage-foods-modal-bg':'');
const modal=document.createElement('section');
modal.id=id;
modal.className='modal'+(isDrawerUtilityModal?' modal-open':' modal-opening');
if(isDrawerUtilityModal)modal.classList.add('utility-modal');
if(id==='detailsModal')modal.classList.add('details-modal');
modal.setAttribute('role','dialog');
modal.setAttribute('aria-modal','true');
modal.setAttribute('aria-labelledby',id+'Title');
modal.setAttribute('tabindex','-1');
modal.innerHTML='<div class="modal-head"><h3 id="'+id+'Title">'+esc(title)+'</h3><button class="modal-close" data-close aria-label="Close '+esc(title)+'">×</button></div>'+body;
document.body.append(bg,modal);
if(!isDrawerUtilityModal){
 requestAnimationFrame(()=>{
  bg.classList.add('modal-bg-open');
  modal.classList.add('modal-open');
  modal.classList.remove('modal-opening');
 });
}
let closed=false;
const returnToMenuWithoutFlash=()=>{
 const drawer=$('drawer'),drawerBg=$('drawerBg');
 // Make the destination menu fully visible before removing the modal/backdrop.
 // This prevents the underlying Meal/Restaurant/Home screen from ever being
 // exposed for a frame while a utility modal hands back to the main drawer.
 drawer?.classList.remove('hidden');
 drawerBg?.classList.remove('hidden');
 drawer?.classList.add('is-open');
 drawerBg?.classList.add('is-open');
 ['#menu','#foodMenu','#restaurantMenu','#winnerMenu','#familyMenu'].forEach(sel=>document.querySelector(sel)?.setAttribute('aria-expanded','true'));
};
const close=()=>{
 if(closed)return;
 closed=true;
 if(isDrawerUtilityModal){
  returnToMenuWithoutFlash();
  modal.remove();
  bg.remove();
  if(opener&&typeof opener.focus==='function')queueMicrotask(()=>opener.focus());
  if(id==='settingsModal')removeFoodOverlays();
  return;
 }
 modal.classList.remove('modal-open');
 modal.classList.add('modal-closing');
 bg.classList.remove('modal-bg-open');
 bg.classList.add('modal-bg-closing');
 window.setTimeout(()=>{
  modal.remove();bg.remove();
  if(opener&&typeof opener.focus==='function')queueMicrotask(()=>opener.focus());
  if(id==='settingsModal')removeFoodOverlays();
  if(S.screen&&$(S.screen))show(S.screen);
 },150);
};
bg.onclick=close;
modal.querySelector('[data-close]').onclick=close;
modal.addEventListener('keydown',e=>{
 if(e.key==='Escape'){e.preventDefault();close();return;}
 if(e.key==='Tab'){
  const f=[...modal.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled);
  if(!f.length)return;
  const first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
});
queueMicrotask(()=>modal.querySelector('[data-close]')?.focus());
return modal;
}
function bindDetailNotes(modal,item,type){
 const noteKey=itemNoteKey(item,type);
 const noteSection=modal.querySelector('#detailNotesSection');
 const toggle=modal.querySelector('#detailNotesToggle');
 const editButton=modal.querySelector('#detailNoteEdit');
 const deleteButton=modal.querySelector('#detailNotesDelete');
 const noteRow=modal.querySelector('#detailNoteRow');
 const editor=modal.querySelector('#detailNotesEditor');
 const field=modal.querySelector('#detailNotesInput');
 const saveButton=modal.querySelector('#detailNotesSave');
 const cancelButton=modal.querySelector('#detailNotesCancel');
 const preview=modal.querySelector('#detailNotesPreview');
 const empty=modal.querySelector('#detailNotesEmpty');
 if(!noteSection||!toggle||!editButton||!deleteButton||!noteRow||!editor||!field||!saveButton||!cancelButton)return;
 const render=()=>{
  const note=String((S.notes||{})[noteKey]||'').trim();
  const hasNote=!!note;
  if(preview)preview.textContent=note;
  noteRow.classList.toggle('hidden',!hasNote);
  empty?.classList.toggle('hidden',hasNote);
  const label=toggle.querySelector('span:last-child');
  if(label)label.textContent=' '+(hasNote?'Edit note':'Add a note');
  toggle.setAttribute('aria-label',hasNote?'Edit note for '+item.name:'Add a note for '+item.name);
  toggle.setAttribute('aria-expanded',(!editor.classList.contains('hidden')).toString());
 };
 const openEditor=()=>{
  editor.classList.remove('hidden');
  field.value=String((S.notes||{})[noteKey]||'');
  window.setTimeout(()=>field.focus(),0);
  render();
 };
 toggle.onclick=openEditor;
 editButton.onclick=openEditor;
 deleteButton.onclick=()=>{
  setItemNote(item,type,'');
  field.value='';
  editor.classList.add('hidden');
  render();
 };
 saveButton.onclick=()=>{
  setItemNote(item,type,field.value);
  editor.classList.add('hidden');
  render();
 };
 cancelButton.onclick=()=>{
  field.value=String((S.notes||{})[noteKey]||'');
  editor.classList.add('hidden');
  render();
 };
 field.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();cancelButton.click();}
 });
 render();
}

function detailsSheet(item,type){
 if(item?.category==='Hungry')return;
 const isRestaurant=type==='restaurant';
 const image=isRestaurant
  ? imageProxyUrl(item.image||item.photo||item.photoFallback||restaurantFallbackImage(item))
  : mealImageUrl(item.image||item.photo||item.photoFallback||HUNGRY_IMAGE);
 const note=itemNote(item,type);
 const notePreview=note.replace(/\s+/g,' ').trim();
 const notesSection='<section class="detail-section detail-notes-section" id="detailNotesSection"><div class="detail-section-head"><div><div class="detail-section-title">Notes</div><p class="detail-section-helper">Private to this device.</p></div><div class="detail-notes-actions"><button class="detail-notes-toggle" id="detailNotesToggle" type="button" aria-expanded="false"><span class="detail-notes-toggle-icon" aria-hidden="true">✎</span><span> '+(note?'Edit note':'Add a note')+'</span></button></div></div><div class="detail-note-row '+(note?'':'hidden')+'" id="detailNoteRow"><p class="detail-note-preview" id="detailNotesPreview">'+esc(notePreview)+'</p><div class="detail-note-row-actions"><button class="detail-note-edit" id="detailNoteEdit" type="button" aria-label="Edit note for '+esc(item.name)+'" title="Edit note"><span aria-hidden="true">✎</span><span>Edit</span></button><button class="detail-notes-delete" id="detailNotesDelete" type="button" aria-label="Delete note for '+esc(item.name)+'" title="Delete note"><span aria-hidden="true">×</span></button></div></div><p class="detail-notes-empty '+(note?'hidden':'')+'" id="detailNotesEmpty">Add a quick reminder, favorite, or thought.</p><div class="detail-notes-editor hidden" id="detailNotesEditor"><textarea id="detailNotesInput" maxlength="1200" rows="4" placeholder="Write a note about this '+(isRestaurant?'restaurant':'meal')+'…"></textarea><div class="detail-notes-editor-actions"><button class="secondary" id="detailNotesCancel" type="button">Cancel</button><button class="detail-notes-save" id="detailNotesSave" type="button">Save Note</button></div></div></section>';

 if(!isRestaurant){
   const cat=String(item.category||'Meal').trim();
   const nut=item.nutrition||{};
   const about=String(item.description||'').trim();
   const ingredients=Array.isArray(item.ingredients)?item.ingredients.filter(Boolean):[];
   const recipe=String(item.recipe||'').trim();
   const aboutSection=about?'<section class="detail-section"><div class="detail-section-title">About</div><p class="detail-body-copy">'+esc(about)+'</p></section>':'';
   const detailRows='<div class="detail-info-list">'+
     '<div class="detail-info-row"><span>Cuisine</span><strong>'+esc(cat)+'</strong></div>'+
     '<div class="detail-info-row"><span>Meal Times</span><strong>'+esc(mealTimesFor(item).join(' · '))+'</strong></div>'+
     (ingredients.length?'<div class="detail-info-row detail-info-row-stack"><span>Ingredients</span><strong>'+esc(ingredients.slice(0,16).join(' · '))+'</strong></div>':'')+
     (recipe?'<div class="detail-info-row detail-info-row-stack"><span>Preparation</span><strong>'+esc(recipe).replace(/\n/g,'<br>')+'</strong></div>':'')+
     '</div>';
   const nutrition=Object.values(nut).some(v=>String(v??'').trim()!=='')?
     '<section class="detail-section"><div class="detail-section-title">Typical nutrition · per serving</div><div class="nutrition-grid detail-nutrition-grid">'+
     '<div><b>'+esc(nut.calories||'—')+'</b><span>Calories</span></div>'+
     '<div><b>'+esc(nut.protein||'—')+' g</b><span>Protein</span></div>'+
     '<div><b>'+esc(nut.carbs||'—')+' g</b><span>Carbs</span></div>'+
     '<div><b>'+esc(nut.fat||'—')+' g</b><span>Fat</span></div>'+
     '<div><b>'+esc(nut.sodium||'—')+' mg</b><span>Sodium</span></div>'+
     '</div><p class="detail-note">'+esc(item.nutritionNote||'Typical estimate per serving.')+'</p></section>' : '';
   const hide='<div class="detail-secondary-actions"><button class="detail-hide-action" id="detailHide" type="button" aria-label="Hide this meal"><span class="detail-hide-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 5 19 19M8.7 8.7A5 5 0 0 0 7 12c1.4 2.8 3.3 4.2 5 4.2 1 0 2-.3 2.8-.9M10.2 5.9C10.8 5.7 11.4 5.7 12 5.7c1.7 0 3.6 1.4 5 4.2.4.8.7 1.5.8 2.1M14.1 14.1A3 3 0 0 1 9.9 9.9" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Hide Meal</span></button></div>';
   const detailPhotos=mealPhotoList(item),detailHero=detailPhotos.length>1?'<div class="detail-photo-gallery"><img class="history-detail-photo" src="'+esc(image)+'" data-final-fallback="'+FINAL_FOOD_IMAGE+'" alt="'+esc(item.name)+'"><button type="button" class="meal-card-photo-pager detail-photo-gallery-count" data-detail-photo-count aria-label="View next meal photo">1 / '+detailPhotos.length+'</button></div>':'<div class="detail-hero detail-meal-hero"><img class="history-detail-photo" src="'+esc(image)+'" data-final-fallback="'+FINAL_FOOD_IMAGE+'" alt="'+esc(item.name)+'"></div>';
   const photoCredit=item.photoAttribution&&item.photoAttributionUrl
     ?'<div class="restaurant-photo-credit is-visible" style="margin:8px 18px 0;font-size:9px">Photo: <a href="'+esc(item.photoAttributionUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(item.photoAttribution)+'</a> · <a href="'+esc(item.photoLicenseUrl||'')+'" target="_blank" rel="noopener noreferrer">'+esc(item.photoLicense||'License')+'</a></div>'
     :'';
const body='<div class="detail-unified detail-meal">'+detailHero+photoCredit+'<div class="detail-title-block detail-unified-title"><span class="detail-kicker">MEAL</span><h2>'+esc(item.name)+'</h2><p class="detail-subline">'+esc(cat)+' · Meal</p></div>'+aboutSection+'<section class="detail-section"><div class="detail-section-title">Details</div>'+detailRows+'</section>'+nutrition+notesSection+hide+'</div>';
   const modal=openModal('detailsModal','Details',body);
   bindImageFallback('#detailsModal img',foodPhotoFallback(item),FINAL_FOOD_IMAGE);
   if(detailPhotos.length>1){
    const gallery=modal.querySelector('.detail-photo-gallery'),gimg=gallery?.querySelector('.history-detail-photo'),gcount=gallery?.querySelector('[data-detail-photo-count]');let gidx=0;
    const renderGallery=()=>hydrateMealPhotoGallery({...item,images:detailPhotos}).then(photos=>{const total=photos.length||detailPhotos.length;gidx=((gidx%total)+total)%total;if(gimg)swapImageWhenReady(gimg,photos[gidx]||image);if(gcount)gcount.textContent=(gidx+1)+' / '+total;});
    gcount?.addEventListener('click',e=>{e.preventDefault();gidx++;renderGallery();});
   }
   bindDetailNotes(modal,item,'food');
   const detailHide=$('detailHide');
   if(detailHide)detailHide.onclick=async()=>{const hidden=await foodHideItem(item);if(hidden){modal.remove();$('detailsModalBg')?.remove();}};
   return;
 }

 const cat=restaurantCategory(item);
 const detailPhone=String(item.phone||item.nationalPhoneNumber||item['contact:phone']||'').trim();
 const phoneHrefValue=detailPhone?phoneHref(detailPhone):restaurantPhoneSearchUrl(item);
 const phoneLabel=detailPhone?detailPhone:'Find phone number';
 const hours=String(item.opening_hours||'').trim();
 const address=String(item.address||'').trim();
 const distance=Number.isFinite(Number(item.distance))?Number(item.distance).toFixed(1)+' mi away':'';
 const about=String(item.description||'').trim();
 const detailWebsitePresentation=restaurantWebsitePresentation(item);
 const detailWebsiteLabel=detailWebsitePresentation.kind==='website'?'Website':(detailWebsitePresentation.kind==='official-page'?'Official Page':'Search Website');
 const websiteAction='<a class="detail-icon-button restaurant-detail-action" href="'+esc(detailWebsitePresentation.url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(detailWebsiteLabel+' for '+item.name)+'" title="'+esc(detailWebsiteLabel)+'"><svg class="detail-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 10.5 18 6m0 0h-3.8M18 6v3.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 13.5v3.25A1.25 1.25 0 0 1 15.75 18h-9.5A1.25 1.25 0 0 1 5 16.75v-9.5A1.25 1.25 0 0 1 6.25 6H9.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg><span class="detail-action-label">'+esc(detailWebsiteLabel)+'</span></a>';
 const callAction='<a class="detail-icon-button restaurant-detail-action" href="'+esc(phoneHrefValue)+'" '+(detailPhone?'':'target="_blank" rel="noopener noreferrer')+' aria-label="'+esc((detailPhone?'Call ':'Find phone for ')+item.name)+'" title="'+esc(detailPhone?'Call':'Find phone')+'"><svg class="detail-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 4.8 9.8 4a1.6 1.6 0 0 1 1.9.9l1.2 3a1.6 1.6 0 0 1-.4 1.7l-1.1 1a12.5 12.5 0 0 0 3.9 3.9l1-1.1a1.6 1.6 0 0 1 1.7-.4l3 1.2a1.6 1.6 0 0 1 .9 1.9l-.8 2.6a2.1 2.1 0 0 1-2.4 1.4C11.3 18.9 5.1 12.7 4 6.2a2.1 2.1 0 0 1 1.4-2.4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg><span class="detail-action-label">'+esc(detailPhone?'Call':'Find phone')+'</span></a>';
 const directionsAction='<a class="detail-icon-button restaurant-detail-action" href="'+esc(restaurantDirectionsUrl(item))+'" target="_blank" rel="noopener noreferrer" aria-label="Get directions to '+esc(item.name)+'" title="Directions"><svg class="detail-action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="9" r="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/></svg><span class="detail-action-label">Directions</span></a>';
 const infoRows='<div class="detail-info-list">'+
   '<div class="detail-info-row"><span>Category</span><strong>'+esc(cat)+'</strong></div>'+
   (item.cuisine?'<div class="detail-info-row"><span>Cuisine</span><strong>'+esc(item.cuisine)+'</strong></div>':'')+
   (address?'<div class="detail-info-row detail-info-row-stack"><span>Location</span><strong>'+esc(address)+'</strong></div>':'')+
   (distance?'<div class="detail-info-row"><span>Distance</span><strong>'+esc(distance)+'</strong></div>':'')+
   '</div>';
 const hoursSection='<section class="detail-section '+(hours?'':'hidden')+'" id="restaurantDetailHours"><div class="detail-section-title">Hours</div><p class="detail-body-copy detail-hours-copy" id="restaurantDetailHoursText">'+esc(hours)+'</p></section>';
 const contactRows='<div class="detail-info-list detail-contact-list">'+
   '<a class="detail-info-row detail-info-row-link" id="restaurantDetailPhone" href="'+esc(phoneHrefValue)+'" '+(detailPhone?'':'target="_blank" rel="noopener noreferrer')+'><span>Phone</span><strong id="restaurantDetailPhoneLabel">'+esc(phoneLabel)+'</strong><span class="detail-row-arrow">↗</span></a>'+
   '</div>';
 const aboutSection=about?'<section class="detail-section"><div class="detail-section-title">About</div><p class="detail-body-copy">'+esc(about)+'</p></section>':'';
 const hide='<div class="detail-secondary-actions"><button class="detail-hide-action" id="detailHideRestaurant" type="button" aria-label="Hide this restaurant"><span class="detail-hide-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 5 19 19M8.7 8.7A5 5 0 0 0 7 12c1.4 2.8 3.3 4.2 5 4.2 1 0 2-.3 2.8-.9M10.2 5.9C10.8 5.7 11.4 5.7 12 5.7c1.7 0 3.6 1.4 5 4.2.4.8.7 1.5.8 2.1M14.1 14.1A3 3 0 0 1 9.9 9.9" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Hide Restaurant</span></button></div>';
 const body='<div class="detail-unified detail-restaurant"><div class="detail-hero detail-restaurant-hero"><img class="history-detail-photo" data-no-generic-fallback="1" src="'+esc(image)+'" data-restaurant-photo-key="'+esc(item.id||item.canonicalId||'')+'" data-final-fallback="'+esc(restaurantFallbackImage(item))+'" alt="'+esc(item.name)+'"><div class="restaurant-photo-credit" aria-live="polite"></div></div><div class="detail-title-block detail-unified-title"><span class="detail-kicker">RESTAURANT</span><h2>'+esc(item.name)+'</h2><p class="detail-subline">'+esc(cat)+'</p></div>'+aboutSection+'<section class="detail-section"><div class="detail-section-title">Details</div>'+infoRows+'</section>'+hoursSection+'<section class="detail-section"><div class="detail-section-title">Contact</div>'+contactRows+'</section>'+notesSection+'<section class="detail-utility-actions"><a class="detail-utility-action" id="restaurantDetailWebsite" data-restaurant-detail-website="1" href="'+esc(detailWebsitePresentation.url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(detailWebsiteLabel+' for '+item.name)+'" title="'+esc(detailWebsiteLabel)+'">Website</a>'+callAction+directionsAction+'</section>'+hide+'</div>';
 const modal=openModal('detailsModal','Restaurant Details',body);
 bindRestaurantPhotoPinch(modal.querySelector('.detail-restaurant-hero img'));
 bindImageFallback('#detailsModal img',image,restaurantFallbackImage(item));
 bindDetailNotes(modal,item,'restaurant');
 const detailHideRestaurant=$('detailHideRestaurant');
 if(detailHideRestaurant)detailHideRestaurant.onclick=async()=>{const hidden=await restaurantHide(item);if(hidden){modal.remove();$('detailsModalBg')?.remove();}};
 hydrateRestaurantPhoto(item,'#detailsModal');
 hydrateRestaurantWebsite(item,'#detailsModal');
}

function historyImageSource(row){
 const fallback=row?.type==='restaurant'?restaurantFallbackImage(row):HUNGRY_IMAGE;
 return row?.type==='restaurant'
  ? imageProxyUrl(row?.image||row?.photoFallback||fallback)
  : mealImageUrl(row?.image||row?.photoFallback||fallback);
}
function recordHistory(item, type, options={}) {
const history = readHistory();
const familyRoundId=String(options.familyRoundId||'').trim();
if(familyRoundId && history.some(x=>String(x?.familyRoundId||'')===familyRoundId)) return false;
history.unshift({
id:String(Date.now())+'-'+Math.random().toString(36).slice(2),
date:(() => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })(),
type,
name:item.name,
sourceItemId:type==='food'?(item.id||''):'',
image:item.image||item.photo||'',
photoFallback:type==='restaurant'?(item.photoFallback||restaurantFallbackImage(item)):(item.photoFallback||''),
photoSource:item.photoSource||'',
googlePlaceId:item.googlePlaceId||'',
photoIsGeneric:item.photoIsGeneric!==false,
category:item.category||restaurantCategory(item),
cuisine:item.cuisine||'',
quickCuts:type==='food'&&Array.isArray(item.quickCuts)?item.quickCuts.slice():[],
mealTimes:type==='food'?mealTimesFor(item):[],
address:item.address||'',
phone:item.phone||item.nationalPhoneNumber||'',
website:item.website||'',
opening_hours:item.opening_hours||'',
hoursState:item.hoursState||'',
menuItems:Array.isArray(item.menuItems)?item.menuItems.slice(0,10):[],
lat:Number.isFinite(Number(item.lat))?Number(item.lat):null,
lon:Number.isFinite(Number(item.lon))?Number(item.lon):null,
distance:Number.isFinite(Number(item.distance))?Number(item.distance):null,
familyRoundId:familyRoundId||null,
familyMode:!!options.familyMode
});
writeHistory(history);
return true;
}
function readHistory() {
try {
 const parsed=JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
 return Array.isArray(parsed) ? parsed.filter(row=>row&&typeof row==='object').slice(0,120) : [];
} catch { return []; }
}
function writeHistory(rows) {
try {
localStorage.setItem(HISTORY_KEY, JSON.stringify((rows||[]).slice(0,120)));
S.storageWarning=false; updateStorageIndicator();
return true;
} catch {
S.storageWarning=true; updateStorageIndicator();
return false;
}
}
function historyView() {
let cursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let modal = null;
let bodyHost = null;
const render = () => {
const history = readHistory();
const y = cursor.getFullYear(), m = cursor.getMonth();
const first = new Date(y,m,1).getDay(), last = new Date(y,m+1,0).getDate();
const today = new Date();
const todayKey = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
const mealCount=history.filter(x=>x?.type==='food').length;
const restaurantCount=history.filter(x=>x?.type==='restaurant').length;
const totalCount=history.length;
const tallyChosen=(type)=>{
 const counts=new Map();
 history.filter(x=>x?.type===type).forEach(x=>{
   const name=String(x?.name||'').trim();
   if(name)counts.set(name,(counts.get(name)||0)+1);
 });
 return [...counts.entries()]
   .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
   .slice(0,5);
};
const chosenMeals=tallyChosen('food');
const chosenRestaurants=tallyChosen('restaurant');
const choiceRows=(rows,emptyLabel)=>rows.length
 ? rows.map(([name,count],index)=>'<div class="history-choice-row"><span class="history-choice-rank">'+(index+1)+'</span><span class="history-choice-name">'+esc(name)+'</span><b class="history-choice-count">'+count+'×</b></div>').join('')
 : '<p class="history-stats-empty">'+emptyLabel+'</p>';
const statsMarkup='<section class="history-stats hidden" id="historyStats" aria-label="Your stats">'+
'<div class="history-stats-head"><div><span class="history-stats-kicker">YOUR STATS</span><b>What you choose most</b></div><span class="history-stats-note">'+totalCount+' decision'+(totalCount===1?'':'s')+'</span></div>'+
'<div class="history-stats-totals"><span>'+mealCount+' meal'+(mealCount===1?'':'s')+'</span><span>'+restaurantCount+' restaurant'+(restaurantCount===1?'':'s')+'</span></div>'+
'<div class="history-choice-section"><div class="history-choice-title">Meals chosen most</div><div class="history-choice-list">'+choiceRows(chosenMeals,'No meals chosen yet.')+'</div></div>'+
'<div class="history-choice-section"><div class="history-choice-title">Restaurants chosen most</div><div class="history-choice-list">'+choiceRows(chosenRestaurants,'No restaurants chosen yet.')+'</div></div>'+
'</section>';
let body = '<div class="history-intro"><div class="history-intro-copy"><span class="history-kicker">YOUR DECISIONS</span><h4>History</h4><p>Browse previous meal and restaurant choices by date.</p></div><button class="history-stats-toggle" id="historyStatsToggle" type="button" aria-expanded="false">Your Stats</button></div>'+statsMarkup+'<div class="history-calendar"><div class="cal-nav"><button class="text-btn" id="calPrev" aria-label="Previous month">‹</button><b>'+cursor.toLocaleString(undefined,{month:'long',year:'numeric'})+'</b><button class="text-btn" id="calNext" aria-label="Next month">›</button></div><div class="cal-grid cal-grid-20" role="grid" aria-label="'+cursor.toLocaleString(undefined,{month:'long',year:'numeric'})+' history">'; 
['S','M','T','W','T','F','S'].forEach(d => body += '<span class="cal-d" role="columnheader">'+d+'</span>');
for(let i=0;i<first;i++) body += '<span class="cal-empty" aria-hidden="true"></span>';
for(let day=1;day<=last;day++) {
const key = y+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
const entries = history.filter(x => x.date === key);
const todayClass = key===todayKey ? ' today' : '';
const limited = entries.slice(0,2);
const more = entries.length>2 ? '<span class="cal-more">+'+(entries.length-2)+'</span>' : '';
let dayMarkup;
if(limited.length===0){
  dayMarkup = '<div class="cal-day"><b>'+day+'</b></div>';
} else if(limited.length===1){
  const entry=limited[0];
  dayMarkup = '<div class="cal-day has single"><span class="cal-date-chip">'+day+'</span><div class="cal-photo-wrap"><button class="cal-photo-link" data-history-date="'+esc(entry.id)+'" aria-label="View '+esc(entry.name)+' from '+esc(key)+'"><img src="'+esc(historyImageSource(entry))+'" data-no-generic-fallback="'+(entry.type==='restaurant'?'1':'0')+'" data-restaurant-photo-key="'+esc(entry.type==='restaurant'?entry.id:'')+'" data-final-fallback="'+(entry.type==='restaurant'?FINAL_RESTAURANT_IMAGE:HUNGRY_IMAGE)+'" alt="'+esc(entry.name)+'"><span class="cal-photo-kind">'+(entry.type==='restaurant'?'Restaurant':'Food')+'</span></button><button class="cal-entry-x" data-history-delete="'+esc(entry.id)+'" aria-label="Remove '+esc(entry.name)+' from '+esc(key)+'">×</button></div></div>';
} else {
  dayMarkup = '<div class="cal-day has dual" aria-label="'+entries.length+' history entries on '+esc(key)+'"><span class="cal-date-chip">'+day+'</span>'+limited.map(entry=>'<div class="cal-photo-wrap"><button class="cal-photo-link" data-history-date="'+esc(entry.id)+'" aria-label="View '+esc(entry.name)+' from '+esc(key)+'"><img src="'+esc(historyImageSource(entry))+'" data-restaurant-photo-key="'+esc(entry.type==='restaurant'?entry.id:'')+'" data-final-fallback="'+(entry.type==='restaurant'?FINAL_RESTAURANT_IMAGE:HUNGRY_IMAGE)+'" alt="'+esc(entry.name)+'"><span class="cal-photo-kind">'+(entry.type==='restaurant'?'Restaurant':'Food')+'</span></button><button class="cal-entry-x" data-history-delete="'+esc(entry.id)+'" aria-label="Remove '+esc(entry.name)+' from '+esc(key)+'">×</button></div>').join('')+more+'</div>';
}
body += '<div class="cal-cell'+todayClass+'" role="gridcell">'+dayMarkup+'</div>';
}
body += '</div></div><div class="history-list">';
body += history.length ? '<div class="history-toolbar"><span class="status">'+history.length+' saved decision'+(history.length===1?'':'s')+'</span><button class="secondary" id="historyClearAll" type="button">Clear all</button></div>'+history.slice(0,30).map(x => '<button class="history-row history-open" data-history-id="'+esc(x.id)+'"><img src="'+esc(historyImageSource(x))+'" data-restaurant-photo-key="'+esc(x.type==='restaurant'?x.id:'')+'" data-final-fallback="'+(x.type==='restaurant'?FINAL_RESTAURANT_IMAGE:HUNGRY_IMAGE)+'" alt="'+esc(x.name)+'"><span><b>'+esc(x.name)+'</b><small>'+esc(x.date)+' · '+esc(x.type)+(x.type==='food'&&Array.isArray(x.mealTimes)&&x.mealTimes.length?' · '+esc(x.mealTimes.join(' · ')):'')+'</small></span></button>').join('') : '<p class="status">No history yet.</p>';
body += '</div>';
if(!modal||!modal.isConnected){
  modal = openModal('historyModal','History','<div id="historyModalBody"></div>');
  bodyHost = modal.querySelector('#historyModalBody');
}
if(!bodyHost)return;
bodyHost.innerHTML=body;
modal.scrollTop=0;
bindImageFallback('#historyModal img',FINAL_RESTAURANT_IMAGE,FINAL_RESTAURANT_IMAGE);
for(const row of history.slice(0,30)) if(row?.type==='restaurant'&&row?.id) hydrateRestaurantPhoto(row,'#historyModal');
$('historyStatsToggle').onclick=()=>{
  const panel=$('historyStats'),btn=$('historyStatsToggle'); if(!panel||!btn)return;
  const isHidden=panel.classList.toggle('hidden');
  btn.setAttribute('aria-expanded',String(!isHidden));
  btn.textContent=isHidden?'Your Stats':'Hide Stats';
};
$('calPrev').onclick = () => { cursor = new Date(y,m-1,1); render(); };
$('calNext').onclick = () => { cursor = new Date(y,m+1,1); render(); };
modal.querySelectorAll('[data-history-id]').forEach(btn => btn.onclick = () => {
const row = history.find(x => x.id === btn.dataset.historyId);
if (row) detailsSheet(row, row.type);
});
modal.querySelectorAll('[data-history-date]').forEach(btn => btn.onclick = () => {
const row = history.find(x => x.id === btn.dataset.historyDate);
if (row) detailsSheet(row, row.type);
});
if(history.length){
$('historyClearAll').onclick=async()=>{
if(!await appConfirm('Clear history?','This permanently removes all saved meal and restaurant decisions from this device.','Clear History'))return;
writeHistory([]);
render();
};
}
modal.querySelectorAll('[data-history-delete]').forEach(btn => {
const remove = (e) => {
e.preventDefault(); e.stopPropagation();
writeHistory(history.filter(x => x.id !== btn.dataset.historyDelete));
render();
};
btn.onclick = remove;
btn.onpointerdown = (e) => e.stopPropagation();
});
};
render();
}function readImageFile(file) {
return new Promise((resolve,reject) => {
if (!file) return resolve('');
if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
const reader = new FileReader();
reader.onerror = () => reject(new Error('Could not read that image.'));
reader.onload = () => {
const img = new Image();
img.onload = () => {
const max=1200, scale=Math.min(1,max/Math.max(img.width,img.height));
const canvas=document.createElement('canvas');
canvas.width=Math.max(1,Math.round(img.width*scale));
canvas.height=Math.max(1,Math.round(img.height*scale));
const ctx=canvas.getContext('2d');
ctx.drawImage(img,0,0,canvas.width,canvas.height);
resolve(canvas.toDataURL('image/jpeg',0.82));
};
img.onerror=()=>reject(new Error('Could not decode that image.'));
img.src=reader.result;
};
reader.readAsDataURL(file);
});
}
async function findOnlineMealPhoto(name) {
 try {
  const query=String(name||'').trim();
  if(!query)return '';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4500);
  const url='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(query)+'&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json&formatversion=2&origin=*';
  const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
  clearTimeout(timer);
  if(!response.ok)return '';
  const data=await response.json();
  const pages=Array.isArray(data?.query?.pages)?data.query.pages:[];
  const terms=query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const ranked=pages.map(page=>{
   const title=String(page?.title||'').toLowerCase();
   const info=Array.isArray(page?.imageinfo)?page.imageinfo[0]:null;
   const src=String(info?.thumburl||info?.url||'');
   let score=0;
   for(const term of terms){if(title.includes(term))score+=3;}
   if(/\b(food|dish|meal|butter|sandwich|soup|pasta|rice|chicken|beef|pork|fish|seafood|vegetable|dessert|bread|potato)\b/.test(title))score+=1;
   if(src.startsWith('https://upload.wikimedia.org/'))score+=2;
   return {score,src};
  }).filter(x=>x.src);
  ranked.sort((a,b)=>b.score-a.score);
  return ranked[0]?.src||'';
 } catch {
  return '';
 }
}

function selectedMealTimesFromEditor(){
 return [...document.querySelectorAll('#editFoodMealTime input[name="editMealTime"]:checked')].map(x=>String(x.value||'').trim()).filter(Boolean);
}
function renderFoodEditorMealTimes(selectedOverride){
  const host=$('editFoodMealTime');
  const manager=$('editFoodMealTimeManager');
  const toggle=$('editMealTimesManage');
  if(!host)return;

  const selected=new Set(Array.isArray(selectedOverride)?selectedOverride:selectedMealTimesFromEditor());
  const options=mealTimeOptions();

  host.innerHTML=options
    .filter(item=>item.enabled)
    .map(item=>{
      const checked=selected.has(item.name)?' checked':'';
      return '<label class="quick-cut-tile meal-time-option"><input type="checkbox" name="editMealTime" value="'+esc(item.name)+'"'+checked+'><span>'+esc(item.name)+'</span></label>';
    })
    .join('');

  host.querySelectorAll('input[name="editMealTime"]').forEach(input=>{
    input.addEventListener('change',()=>{
      const checked=selectedMealTimesFromEditor();
      if(!checked.length){
        input.checked=true;
        appToast('Choose at least one Meal Time.');
      }
    });
  });

  if(toggle){
    const editing=!!manager&&!manager.classList.contains('hidden');
    toggle.textContent=editing?'Done':'Edit Meal Times';
    toggle.setAttribute('aria-expanded',String(editing));
  }

  if(manager){
    const catalog=mealTimeCatalog();
    manager.innerHTML=catalog.map((item,index)=>{
      const cfg=ensureMealTimeSettings();
      const isOff=cfg.disabled.has(item.id);
      const first=index===0;
      const last=index===catalog.length-1;
      const customDelete=item.custom
        ? '<button type="button" class="food-editor-meal-time-delete" data-food-editor-meal-time-delete="'+esc(item.id)+'" aria-label="Delete '+esc(item.name)+'">×</button>'
        : '';

      return '<div class="food-editor-meal-time-row" data-food-editor-meal-time-id="'+esc(item.id)+'">'
        +'<div class="food-editor-meal-time-main"><b>'+esc(item.name)+'</b><small>'+esc(item.custom?'CUSTOM':'DEFAULT')+(isOff?' · OFF':'')+'</small></div>'
        +'<div class="food-editor-meal-time-tools">'
        +'<button type="button" class="food-editor-meal-time-move" data-food-editor-meal-time-up="'+esc(item.id)+'" aria-label="Move '+esc(item.name)+' up"'+(first?' disabled':'')+'>↑</button>'
        +'<button type="button" class="food-editor-meal-time-move" data-food-editor-meal-time-down="'+esc(item.id)+'" aria-label="Move '+esc(item.name)+' down"'+(last?' disabled':'')+'>↓</button>'
        +'<button type="button" class="food-editor-meal-time-edit" data-food-editor-meal-time-edit="'+esc(item.id)+'">Edit</button>'
        +'<button type="button" class="food-editor-meal-time-toggle '+(isOff?'':'is-on')+'" data-food-editor-meal-time-toggle="'+esc(item.id)+'" aria-pressed="'+(isOff?'false':'true')+'">'+(isOff?'Off':'On')+'</button>'
        +customDelete
        +'</div></div>';
    }).join('')
    +'<div class="food-editor-meal-time-add"><input id="newFoodEditorMealTimeName" maxlength="28" placeholder="New Meal Time" autocomplete="off"><button type="button" id="addFoodEditorMealTime">＋ Add</button></div>';

    manager.querySelectorAll('[data-food-editor-meal-time-edit]').forEach(btn=>{
      btn.onclick=()=>renameMealTimeInFoodEditor(btn.dataset.foodEditorMealTimeEdit);
    });
    manager.querySelectorAll('[data-food-editor-meal-time-delete]').forEach(btn=>{
      btn.onclick=()=>deleteMealTimeInFoodEditor(btn.dataset.foodEditorMealTimeDelete);
    });
    manager.querySelectorAll('[data-food-editor-meal-time-up]').forEach(btn=>{
      btn.onclick=()=>moveMealTimeInFoodEditor(btn.dataset.foodEditorMealTimeUp,-1);
    });
    manager.querySelectorAll('[data-food-editor-meal-time-down]').forEach(btn=>{
      btn.onclick=()=>moveMealTimeInFoodEditor(btn.dataset.foodEditorMealTimeDown,1);
    });
    manager.querySelectorAll('[data-food-editor-meal-time-toggle]').forEach(btn=>{
      btn.onclick=()=>toggleMealTimeInFoodEditor(btn.dataset.foodEditorMealTimeToggle);
    });

    $('addFoodEditorMealTime')?.addEventListener('click',()=>{
      const input=$('newFoodEditorMealTimeName');
      addMealTimeInFoodEditor(input?.value);
      if(input){
        input.value='';
        input.focus();
      }
    });

    $('newFoodEditorMealTimeName')?.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        $('addFoodEditorMealTime')?.click();
      }
    });
  }
}
function renameMealTimeInFoodEditor(id){
 const item=mealTimeCatalog().find(x=>x.id===String(id));if(!item)return;
 const row=document.querySelector('[data-food-editor-meal-time-id="'+CSS.escape(String(id))+'"]'),main=row?.querySelector('.food-editor-meal-time-main');if(!main||main.querySelector('input'))return;
 const selected=selectedMealTimesFromEditor(),old=item.name;
 main.innerHTML='<input class="food-editor-meal-time-edit-input" maxlength="28" value="'+esc(old)+'" aria-label="Rename Meal Time">';
 const input=main.querySelector('input');
 const finish=commit=>{
  if(!commit){renderFoodEditorMealTimes(selected);return;}
  const next=String(input.value||'').trim();
  if(!next){appToast('Give the Meal Time a name.');input.focus();return;}
  if(mealTimeCatalog().some(x=>x.id!==item.id&&normKey(x.name)===normKey(next))){appToast('That Meal Time name is already in use.');input.focus();input.select();return;}
  const cfg=ensureMealTimeSettings();
  const nextSelected=selected.map(x=>x===old?next:x);
  if(item.custom){
   const custom=cfg.custom.find(x=>String(x.id)===String(id));if(custom)custom.name=next;
   syncMealTimeReferences(old,next,item.id);
  }else{
   const oldCurrent=cfg.names[item.id]||item.defaultName;cfg.names[item.id]=next;syncMealTimeReferences(oldCurrent,next,item.id);
  }
  save();buildFood();foodQuick();renderMealTimeCuts();renderFoodEditorMealTimes(nextSelected);
 };
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(true)}else if(e.key==='Escape'){e.preventDefault();finish(false)}});
 input.addEventListener('blur',()=>window.setTimeout(()=>{if(document.body.contains(input))finish(true)},80));
 input.focus();input.select();
}
function addMealTimeInFoodEditor(name){
 const next=String(name||'').trim();
 if(!next){appToast('Give the new Meal Time a name.');return;}
 if(mealTimeCatalog().some(x=>normKey(x.name)===normKey(next))){appToast('That Meal Time name is already in use.');return;}
 const selected=selectedMealTimesFromEditor(),cfg=ensureMealTimeSettings(),id='meal-time-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
 const wasAllSelected=mealTimeNames().length>0&&mealTimeNames().every(time=>S.mealTimeFilters?.has(time));
 cfg.custom.push({id,name:next});cfg.order.push(id);cfg.order=[...new Set(cfg.order)];
 // A new Meal Time joins the global filter when the user was in the ALL state.
 // When the user was intentionally narrowed to specific times, preserve that choice.
 if(wasAllSelected){
  S.mealTimeFilters=new Set([...(S.mealTimeFilters||[]),next]);
 }
 save();buildFood();foodQuick();renderMealTimeCuts();renderFoodEditorMealTimes([...selected,next]);appToast(next+' added to this meal.');
}
async function deleteMealTimeInFoodEditor(id){
 const item=mealTimeCatalog().find(x=>x.id===String(id));if(!item?.custom)return;
 if(!await appConfirm('Delete '+item.name+'?','Meals using this Meal Time will move to '+(mealTimeCatalog().find(x=>x.id==='lunch-dinner')?.name||'Lunch / Dinner')+'.','Delete Meal Time'))return;
 const selected=selectedMealTimesFromEditor(),fallback=mealTimeOptions().find(x=>x.enabled&&x.id!==String(id))?.name||mealTimeOptions().find(x=>x.enabled)?.name||'Lunch / Dinner',replace=item.name;
 S.custom.forEach(meal=>{if(Array.isArray(meal.mealTimes))meal.mealTimes=[...new Set(meal.mealTimes.map(x=>x===replace?fallback:x).filter(Boolean))]});
 S.deletedCustomMeals?.forEach(meal=>{if(Array.isArray(meal.mealTimes))meal.mealTimes=[...new Set(meal.mealTimes.map(x=>x===replace?fallback:x).filter(Boolean))]});
 const cfg=ensureMealTimeSettings();cfg.custom=cfg.custom.filter(x=>String(x.id)!==String(id));cfg.order=cfg.order.filter(x=>String(x)!==String(id));cfg.disabled.delete(String(id));
 // Keep the global filter synchronized with the catalog. Removing a custom
 // Meal Time also removes it from the active filter; an empty filter means ALL.
 const nextFilter=new Set(S.mealTimeFilters||[]);
 nextFilter.delete(replace);
 const remainingNames=mealTimeNames().filter(name=>name!==replace);
 if(!nextFilter.size)remainingNames.forEach(name=>nextFilter.add(name));
 S.mealTimeFilters=nextFilter;
 const nextSelected=selected.map(x=>x===replace?fallback:x);
 save();buildFood();foodQuick();renderMealTimeCuts();renderFoodEditorMealTimes(nextSelected);appToast(item.name+' deleted.');
}
function moveMealTimeInFoodEditor(id,direction){
 const cfg=ensureMealTimeSettings(),key=String(id),idx=cfg.order.findIndex(x=>String(x)===key),to=idx+direction;
 if(idx<0||to<0||to>=cfg.order.length)return;
 [cfg.order[idx],cfg.order[to]]=[cfg.order[to],cfg.order[idx]];
 save();renderFoodEditorMealTimes();
}
function toggleMealTimeInFoodEditor(id){
 const cfg=ensureMealTimeSettings(),key=String(id),currentlyOff=cfg.disabled.has(key);
 if(!currentlyOff&&mealTimeOptions().filter(x=>x.enabled).length<=1){appToast('Keep at least one Meal Time active.');return;}
 const selected=selectedMealTimesFromEditor(),item=mealTimeCatalog().find(x=>x.id===key),oldName=item?.name;
 const namesBefore=mealTimeOptions().filter(x=>x.enabled).map(x=>x.name);
 const wasAllSelected=namesBefore.length>0&&namesBefore.every(name=>S.mealTimeFilters?.has(name));
 if(currentlyOff)cfg.disabled.delete(key);
 else{
  cfg.disabled.add(key);
  if(oldName){
   const nextSelected=selected.filter(x=>x!==oldName);
   if(!nextSelected.length){cfg.disabled.delete(key);appToast('Keep at least one Meal Time selected for this meal.');return;}
  }
 }
 // Keep the global Meal Time filter aligned with enabled catalog entries.
 const nextFilter=new Set(S.mealTimeFilters||[]);
 if(currentlyOff){
  if(wasAllSelected&&oldName)nextFilter.add(oldName);
 }else if(oldName){
  nextFilter.delete(oldName);
 }
 const enabledNames=mealTimeNames();
 const valid=new Set(enabledNames);
 for(const name of [...nextFilter])if(!valid.has(name))nextFilter.delete(name);
 if(!nextFilter.size)enabledNames.forEach(name=>nextFilter.add(name));
 S.mealTimeFilters=nextFilter;
 save();buildFood();foodQuick();renderMealTimeCuts();renderFoodEditorMealTimes(selected.filter(x=>x!==oldName));
}
function foodEditor(item=null) {
const isEdit=!!item;
const defaultItem=isEdit?getDefaultFoods().find(x=>String(x.id)===String(item?.id)):null;
const isBuiltInEdit=!!defaultItem;
const managerWasOpen = !!$('manageFoodsModal');
if(managerWasOpen){ $('manageFoodsModal')?.remove(); $('manageFoodsModalBg')?.remove(); }
const cats=[...FOOD_QUICK,'Other',...(S.customQuickCuts||[]).map(x=>String(x.name||'').trim()).filter(Boolean)];
const existingCuts=Array.isArray(item?.quickCuts)&&item.quickCuts.length ? [...item.quickCuts] : [item?.category||'American'];
const existingMealTimes=isEdit?new Set(mealTimesFor(item)):new Set();
const nut=item?.nutrition||{};
const ingredientsText=Array.isArray(item?.ingredients)?item.ingredients.join('\n'):'';
const descriptionText=String(item?.description||'').trim();
let editorPhotos=dedupeMealPhotos(mealPhotoList(item),8);
let editorPhotosReady=Promise.resolve();
const body='<form class="add" id="foodEditorForm">'+
'<input id="editFoodName" placeholder="Meal name" required value="'+esc(item?.name||'')+'">'+
'<fieldset class="quick-cut-editor meal-category-editor"><legend>Cuisine Cuts</legend><p class="meal-category-helper">Choose every cuisine category or food type you want this meal associated with. Custom adds a reusable Cuisine Cut with its own name and photo.</p><div id="editFoodQuickCuts" class="quick-cut-editor-grid custom-taxonomy-grid"></div></fieldset><fieldset class="quick-cut-editor meal-time-editor"><div class="meal-time-editor-head"><span class="meal-time-editor-title">Meal Times</span><button type="button" class="meal-time-edit-toggle" id="editMealTimesManage" aria-expanded="false">Edit Meal Times</button></div><p class="meal-category-helper">Choose one or more Meal Times for this meal.</p><div id="editFoodMealTime" class="quick-cut-editor-grid meal-time-editor-grid"></div><div id="editFoodMealTimeManager" class="food-editor-meal-time-manager hidden" aria-label="Edit Meal Times"></div></fieldset>'+
'<div class="meal-editor-section"><div class="meal-editor-section-title">Nutrition per serving</div><p class="meal-editor-helper">Fill in the five numbers that will appear in the meal Details screen.</p><div class="meal-nutrition-editor-grid">'+
'<label>Calories<input id="editFoodCalories" type="number" required min="0" step="1" inputmode="numeric" placeholder="520" value="'+esc(nut.calories??'')+'"><span>kcal</span></label>'+
'<label>Protein<input id="editFoodProtein" type="number" required min="0" step="0.1" inputmode="decimal" placeholder="27" value="'+esc(nut.protein??'')+'"><span>g</span></label>'+
'<label>Carbs<input id="editFoodCarbs" type="number" required min="0" step="0.1" inputmode="decimal" placeholder="46" value="'+esc(nut.carbs??'')+'"><span>g</span></label>'+
'<label>Fat<input id="editFoodFat" type="number" required min="0" step="0.1" inputmode="decimal" placeholder="25" value="'+esc(nut.fat??'')+'"><span>g</span></label>'+
'<label>Sodium<input id="editFoodSodium" type="number" required min="0" step="1" inputmode="numeric" placeholder="1050" value="'+esc(nut.sodium??'')+'"><span>mg</span></label>'+
'</div></div>'+
'<label class="meal-editor-text-label">About this meal<textarea id="editFoodDescription" placeholder="A short description of the meal (optional)" rows="3">'+esc(descriptionText)+'</textarea></label>'+
'<label class="meal-editor-text-label">Ingredients<textarea id="editFoodIngredients" placeholder="One ingredient per line" rows="5">'+esc(ingredientsText)+'</textarea></label>'+
'<label class="meal-editor-text-label">Recipe / preparation<textarea id="editFoodRecipe" placeholder="Preparation steps or recipe (optional)" rows="5">'+esc(item?.recipe||'')+'</textarea></label>'+(isEdit?'<section class="meal-editor-note-section"><div class="meal-editor-note-copy"><b>Add a note</b><small>Private to this device. Keep a reminder, favorite, or thought with this meal.</small></div><textarea id="editFoodNote" maxlength="1200" rows="3" placeholder="Write a note about this meal…">'+esc(itemNote(item,'food'))+'</textarea></section>':'')+
'<div class="meal-editor-photo-section"><div class="meal-editor-photo-copy"><b>'+(isEdit?'Replace meal photo':'Photo from iPhone/device')+'</b><small>'+(isEdit?'Add more photos, reorder them, or leave the existing order unchanged. The first photo is the Cover shown on the meal card and result.':'Upload a photo from your device, or paste a photo URL below.')+'</small></div><label class="file-label"><span>Add Photos</span><input id="editFoodFile" type="file" accept="image/*" multiple></label></div>'+'<input id="editFoodPhoto" placeholder="Photo URL (optional)" inputmode="url" value="'+esc(item?.image && !String(item.image).startsWith('idb:') && !String(item.image).startsWith('data:image/')?item.image:'')+'">'+
'<button class="cut">'+(isEdit?'Save Meal':'Add Meal')+'</button></form>';
const modal=openModal('foodEditorModal',isEdit?'Edit Meal':'Add Meal',body);
const mealTimeManageToggle=$('editMealTimesManage'),mealTimeManager=$('editFoodMealTimeManager');
mealTimeManageToggle?.addEventListener('click',()=>{
 const open=mealTimeManager?.classList.toggle('hidden')===false;
 mealTimeManageToggle.setAttribute('aria-expanded',String(open));
 mealTimeManageToggle.textContent=open?'Done':'Edit Meal Times';
 if(open)renderFoodEditorMealTimes();
});
renderFoodEditorMealTimes([...existingMealTimes]);
const mealPhotoFile=$('editFoodFile');
const initialPhotoInput=normalizeMealPhotoRef($('editFoodPhoto')?.value);
if(mealPhotoFile){
 mealPhotoFile.multiple=true;
 const label=mealPhotoFile.closest('.file-label')?.querySelector('span');
 if(label)label.textContent='Add photos';
 const photoSection=mealPhotoFile.closest('.meal-editor-photo-section');
 const grid=document.createElement('div');grid.id='mealPhotoEditorGrid';grid.className='meal-photo-editor-grid';photoSection?.appendChild(grid);
 const count=document.createElement('small');count.id='mealPhotoEditorCount';count.className='meal-photo-editor-count';photoSection?.appendChild(count);
  const refreshMealPhotoEditorLabels=()=>{
   const cards=[...grid.querySelectorAll('.meal-photo-editor-card')];
   cards.forEach((card,i)=>{
    card.classList.toggle('is-main',i===0);
    const label=card.querySelector('.meal-photo-editor-card-tools>span');
    if(label)label.textContent=i===0?'COVER':'PHOTO '+(i+1);
    const image=card.querySelector('img');
    if(image)image.alt=i===0?'Cover photo':'Meal photo '+(i+1);
    const remove=card.querySelector('[data-meal-photo-remove]');
    if(remove)remove.setAttribute('aria-label','Remove meal photo '+(i+1));
   });
   count.textContent=editorPhotos.length+' / 8 photos · touch-drag to reorder · first is Cover';
  };
  const syncMealPhotoEditorOrder=()=>{
   editorPhotos=[...grid.querySelectorAll('.meal-photo-editor-card')]
    .map(card=>card.__mealPhotoRef)
    .filter(Boolean);
   editorPhotos=dedupeMealPhotos(editorPhotos,8);
   refreshMealPhotoEditorLabels();
  };
  const bindMealPhotoEditorDrag=()=>{
   if(grid.dataset.dragBound==='1')return;
   grid.dataset.dragBound='1';
   let drag=null;
   const removeGhost=()=>{
    if(drag?.ghost?.isConnected)drag.ghost.remove();
    if(drag?.placeholder?.isConnected)drag.placeholder.remove();
   };
   const cleanup=(commit)=>{
    if(!drag)return;
    const state=drag;
    document.removeEventListener('pointermove',onMove,true);
    document.removeEventListener('pointerup',onUp,true);
    document.removeEventListener('pointercancel',onCancel,true);
    if(state.dragging){
     if(state.placeholder?.isConnected){
      if(commit)state.placeholder.replaceWith(state.card);
      else state.placeholder.replaceWith(state.card);
     }
     state.card.classList.remove('is-drag-source');
     state.card.style.visibility='';
     state.card.style.pointerEvents='';
     if(commit)syncMealPhotoEditorOrder();
    }else{
     state.card.classList.remove('is-drag-source');
     state.card.style.visibility='';
     state.card.style.pointerEvents='';
    }
    if(state.ghost?.isConnected)state.ghost.remove();
    state.ghost=null;state.placeholder=null;
    drag=null;
   };
   const beginDrag=e=>{
    if(!drag||drag.dragging)return;
    drag.dragging=true;
    if(e.cancelable)e.preventDefault();
    const rect=drag.card.getBoundingClientRect();
    drag.offsetX=e.clientX-rect.left;
    drag.offsetY=e.clientY-rect.top;
    const placeholder=document.createElement('div');
    placeholder.className='meal-photo-drag-placeholder';
    placeholder.style.height=rect.height+'px';
    placeholder.style.width=rect.width+'px';
    placeholder.setAttribute('aria-hidden','true');
    drag.placeholder=placeholder;
    drag.card.replaceWith(placeholder);
    drag.ghost=drag.card.cloneNode(true);
    drag.ghost.classList.remove('is-main','is-drag-source');
    drag.ghost.classList.add('meal-photo-drag-ghost');
    drag.ghost.style.width=rect.width+'px';
    drag.ghost.style.height=rect.height+'px';
    document.body.appendChild(drag.ghost);
    drag.card.classList.add('is-drag-source');
    drag.card.style.visibility='hidden';
    drag.card.style.pointerEvents='none';
    moveGhost(e);
   };
   const moveGhost=e=>{
    if(!drag?.ghost)return;
    drag.ghost.style.left=(e.clientX-drag.offsetX)+'px';
    drag.ghost.style.top=(e.clientY-drag.offsetY)+'px';
   };
   function onMove(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(!drag.dragging){
     if(Math.hypot(dx,dy)<8)return;
     beginDrag(e);
    }
    if(!drag?.dragging)return;
    if(e.cancelable)e.preventDefault();
    moveGhost(e);
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.meal-photo-editor-card');
    if(!target||!grid.contains(target)||target===drag.card)return;
    const rect=target.getBoundingClientRect();
    const midY=rect.top+rect.height/2,midX=rect.left+rect.width/2;
    const before=e.clientY<midY || (Math.abs(e.clientY-midY)<rect.height*.30 && e.clientX<midX);
    const anchor=before?target:target.nextElementSibling;
    if(anchor===drag.placeholder)return;
    if(before && drag.placeholder.nextElementSibling===target)return;
    if(!before && target.nextElementSibling===drag.placeholder)return;
    grid.insertBefore(drag.placeholder,anchor||null);
   }
   function onUp(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    if(drag.dragging&&e.cancelable)e.preventDefault();
    cleanup(true);
   }
   function onCancel(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    cleanup(true);
   }
   grid.onpointerdown=e=>{
    if(e.isPrimary===false||e.button!=null&&e.button!==0)return;
    if(e.target.closest?.('button'))return;
    const card=e.target.closest?.('.meal-photo-editor-card');
    if(!card||!grid.contains(card))return;
    cleanup(false);
    drag={card,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,dragging:false,ghost:null,placeholder:null,offsetX:0,offsetY:0};
    document.addEventListener('pointermove',onMove,true);
    document.addEventListener('pointerup',onUp,true);
    document.addEventListener('pointercancel',onCancel,true);
   };
  };
  const renderMealPhotos=()=>{
   editorPhotos=dedupeMealPhotos(editorPhotos,8);
   count.textContent=editorPhotos.length+' / 8 photos · touch-drag to reorder · first is Cover';
   grid.innerHTML=editorPhotos.map((src,i)=>'<div class="meal-photo-editor-card '+(i===0?'is-main':'')+'" data-meal-photo-index="'+i+'"><img src="'+esc(imageProxyUrl(src||FINAL_FOOD_IMAGE))+'" alt="'+esc(i===0?'Cover photo':'Meal photo '+(i+1))+'" draggable="false"><div class="meal-photo-editor-card-tools"><span>'+(i===0?'COVER':'PHOTO '+(i+1))+'</span><div><button type="button" class="meal-photo-remove" aria-label="Remove meal photo '+(i+1)+'">×</button></div></div></div>').join('');
   [...grid.querySelectorAll('.meal-photo-editor-card')].forEach((card,i)=>{
    card.__mealPhotoRef=editorPhotos[i];
   });
   grid.querySelectorAll('.meal-photo-remove').forEach(btn=>btn.onclick=e=>{
    e.preventDefault();e.stopPropagation();
    const card=btn.closest('.meal-photo-editor-card'),ref=card?.__mealPhotoRef;
    if(ref){editorPhotos=editorPhotos.filter(photo=>photo!==ref);}else{
     const idx=[...grid.querySelectorAll('.meal-photo-editor-card')].indexOf(card);
     if(idx>=0)editorPhotos.splice(idx,1);
    }
    renderMealPhotos();
   });
   bindMealPhotoEditorDrag();
  };
 editorPhotosReady=hydrateStoredMealPhotoList(item).then(photos=>{editorPhotos=photos.slice(0,8);renderMealPhotos();}).catch(()=>renderMealPhotos());
 renderMealPhotos();
 const ingestMealPhotoFiles=async(fileList)=>{
  try{
   await editorPhotosReady;
   const selected=[...(fileList||[])].filter(file=>file?.type?.startsWith('image/'));
   const room=Math.max(0,8-editorPhotos.length);
   if(!room){appToast('You already have 8 meal photos. Remove one before adding another.');return;}
   const added=await Promise.all(selected.slice(0,room).map(readImageFile));
   const seen=new Set(dedupeMealPhotos(editorPhotos,8)),unique=[];
   for(const raw of added.filter(Boolean)){
    const ref=normalizeMealPhotoRef(raw);if(!ref||seen.has(ref))continue;
    seen.add(ref);unique.push(ref);
    if(editorPhotos.length+unique.length>=8)break;
   }
   editorPhotos=dedupeMealPhotos([...editorPhotos,...unique],8);
   renderMealPhotos();
   appToast(unique.length===1?'Photo added.':unique.length>1?unique.length+' photos added.':'No new photos added.');
  }catch(e){appToast(e.message);}
 };
 mealPhotoFile.onchange=async()=>{
  await ingestMealPhotoFiles(mealPhotoFile.files);
  mealPhotoFile.value='';
 };
}
const renderEditorQuickCuts=focusId=>{
 const host=$('editFoodQuickCuts');if(!host)return;
 const standard=[...FOOD_QUICK,'Other'];
 host.innerHTML=standard.map(label=>'<label class="quick-cut-tile"><input type="checkbox" name="editQuickCut" value="'+esc(label)+'" '+(existingCuts.includes(label)?'checked':'')+'><span>'+esc(label)+'</span></label>').join('');
 host.insertAdjacentHTML('beforeend',(S.customQuickCuts||[]).map(qc=>{
   const name=String(qc?.name||'').trim();if(!name)return '';
   const src=customQuickCutImage(name);
   return '<div class="custom-qc-tile" data-custom-qc-id="'+esc(qc.id)+'"><label class="quick-cut-tile custom-qc-select"><input type="checkbox" name="editQuickCut" value="'+esc(name)+'" '+(existingCuts.includes(name)?'checked':'')+'><span class="custom-qc-photo" style="background-image:url(\''+esc(src)+'\')"></span><span class="custom-qc-label">'+esc(name)+'</span></label><div class="custom-qc-tools"><label class="custom-qc-upload" title="Upload Cuisine Cut photo"><span aria-hidden="true">＋</span><input type="file" accept="image/*" data-custom-qc-file="'+esc(qc.id)+'"></label><input class="custom-qc-rename" type="text" value="'+esc(name)+'" aria-label="Rename '+esc(name)+'" data-custom-qc-rename="'+esc(qc.id)+'"><button type="button" class="custom-qc-delete" data-custom-qc-delete="'+esc(qc.id)+'" aria-label="Delete '+esc(name)+'">×</button></div></div>';
 }).join(''));
 host.insertAdjacentHTML('beforeend','<button type="button" class="quick-cut-custom-add" id="addCustomQuickCut"><span>＋</span><b>Custom</b><small>New box</small></button>');
 host.querySelectorAll('[data-custom-qc-file]').forEach(input=>input.onchange=async()=>{
   const id=input.dataset.customQcFile,qc=(S.customQuickCuts||[]).find(x=>String(x.id)===String(id));if(!qc)return;
   try{const data=await readImageFile(input.files?.[0]);if(!data)return;const storageId='quickcut:'+id;const ok=await putStoredPhoto(storageId,data);if(!ok){appToast('Could not save that Cuisine Cut photo on this device.');return;}qc.image=data;save();foodQuick();renderEditorQuickCuts(id);appToast('Cuisine Cut photo updated.');}catch(e){appToast(e.message);}
 });
 host.querySelectorAll('[data-custom-qc-rename]').forEach(input=>input.onchange=()=>{
   const id=input.dataset.customQcRename,qc=(S.customQuickCuts||[]).find(x=>String(x.id)===String(id));if(!qc)return;
   const old=String(qc.name||'').trim(),next=input.value.trim();
   if(!next){input.value=old;appToast('Give the Custom Cuisine Cut a name.');return;}
   const conflict=[...FOOD_QUICK,'Other',...(S.customQuickCuts||[]).filter(x=>x!==qc).map(x=>x.name)].some(x=>normKey(x)===normKey(next));
   if(conflict){input.value=old;appToast('That Cuisine Cut name is already in use.');return;}
   qc.name=next;
   const selectedIndex=existingCuts.indexOf(old);if(selectedIndex>=0)existingCuts[selectedIndex]=next;
   S.custom.forEach(meal=>{
     if(Array.isArray(meal.quickCuts))meal.quickCuts=meal.quickCuts.map(x=>x===old?next:x);
     if(meal.category===old)meal.category=next;
   });
   if(S.cutCats.has(old)){S.cutCats.delete(old);S.cutCats.add(next);}
   save();buildFood();foodQuick();renderEditorQuickCuts(id);
 });
 host.querySelectorAll('[data-custom-qc-delete]').forEach(btn=>btn.onclick=async()=>{
   const id=btn.dataset.customQcDelete,qc=(S.customQuickCuts||[]).find(x=>String(x.id)===String(id));if(!qc)return;
   const name=String(qc.name||'Custom Cuisine Cut');
   if(!await appConfirm('Delete '+name+'?','This removes the Custom Cuisine Cut from your category list and unassigns it from meals.','Delete Cuisine Cut'))return;
   S.customQuickCuts=S.customQuickCuts.filter(x=>String(x.id)!==String(id));
   const cutIndex=existingCuts.indexOf(name);if(cutIndex>=0)existingCuts.splice(cutIndex,1);
   S.custom.forEach(meal=>{
     if(Array.isArray(meal.quickCuts))meal.quickCuts=meal.quickCuts.filter(x=>x!==name);
     if(meal.category===name)meal.category=meal.quickCuts?.[0]||'Other';
     if(!meal.quickCuts?.length)meal.quickCuts=['Other'];
   });
   S.cutCats.delete(name);
   await deleteStoredPhoto('quickcut:'+id);
   save();buildFood();foodQuick();renderEditorQuickCuts();appToast(name+' deleted.');
 });
 $('addCustomQuickCut').onclick=()=>{
   const taken=new Set([...FOOD_QUICK,'Other',...(S.customQuickCuts||[]).map(x=>String(x.name||''))]);
   let number=(S.customQuickCuts||[]).length+1,name='Custom '+number;
   while(taken.has(name)){number++;name='Custom '+number;}
   const id='custom-qc-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
   S.customQuickCuts.push({id,name,image:''});
   existingCuts.push(name);
   save();renderEditorQuickCuts(id);
   const input=host.querySelector('[data-custom-qc-rename="'+id+'"]');input?.focus();input?.select();
 };
};
renderEditorQuickCuts();
$('foodEditorForm').onsubmit=async e=>{
e.preventDefault();
const name=$('editFoodName').value.trim();
const mealTimes=[...document.querySelectorAll('input[name="editMealTime"]:checked')].map(x=>String(x.value||'').trim()).filter(x=>mealTimeOptions().some(def=>def.name===x));
if(!mealTimes.length){appToast('Choose at least one Meal Time.');return;}
let quickCuts=[...document.querySelectorAll('input[name="editQuickCut"]:checked')].map(x=>x.value);
if(!quickCuts.length){appToast('Choose at least one Cuisine Cut.');return;}
const preferred=item?.category&&quickCuts.includes(item.category)?item.category:quickCuts[0];
quickCuts=[preferred,...quickCuts.filter(x=>x!==preferred)];
const cat=preferred;
const readNumeric=id=>{
const value=$(id).value.trim();
if(!value)return '';
const number=Number(value);
return Number.isFinite(number)&&number>=0?number:'';
};
const nutritionValues={
calories:readNumeric('editFoodCalories'),
protein:readNumeric('editFoodProtein'),
carbs:readNumeric('editFoodCarbs'),
fat:readNumeric('editFoodFat'),
sodium:readNumeric('editFoodSodium')
};
if(Object.values(nutritionValues).some(value=>value==='')){
 appToast('Fill in Calories, Protein, Carbs, Fat, and Sodium.');
 return;
}
const nutrition=nutritionValues;
const description=String($('editFoodDescription').value||'').trim();
const ingredients=String($('editFoodIngredients').value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const editorNote=isEdit?String($('editFoodNote')?.value||'').trim():'';
await editorPhotosReady;
const photoInput=normalizeMealPhotoRef($('editFoodPhoto').value);
const photoInputChanged=photoInput!==initialPhotoInput;
if(photoInputChanged&&photoInput)editorPhotos=dedupeMealPhotos([photoInput,...editorPhotos],8);
else editorPhotos=dedupeMealPhotos(editorPhotos,8);
let photo=editorPhotos[0]||'';
if(!photo&&!isEdit){
 const saveButton=document.querySelector('#foodEditorForm button.cut');
 if(saveButton){saveButton.disabled=true;saveButton.dataset.originalLabel=saveButton.textContent;saveButton.textContent='Finding photo…';}
 photo=await findOnlineMealPhoto(name);
 if(saveButton){saveButton.disabled=false;saveButton.textContent=saveButton.dataset.originalLabel||'Add Meal';}
 if(photo)editorPhotos=[photo];
}
if(!editorPhotos.length)editorPhotos=[photo||DEFAULT_FOOD_IMAGE];
photo=editorPhotos[0];
let recipe=$('editFoodRecipe').value.trim();
if(!name)return;
if(isEdit&&isBuiltInEdit){
 const id=String(item.id),idx=S.custom.findIndex(x=>String(x.id)===id),previous=idx>=0?S.custom[idx]:null;let savedPhotos;
 try{savedPhotos=await storeMealPhotoSet(id,editorPhotos);}catch(err){appToast(err.message);return;}
 const orderedPhotos=dedupeMealPhotos(savedPhotos,8),coverPhoto=orderedPhotos[0]||'';
 const updated={...defaultItem,...(previous||{}),builtInEdit:true,builtInId:id,id,name,primary:defaultItem.primary,category:cat,quickCuts,mealTimes,images:orderedPhotos,image:coverPhoto,description,ingredients,recipe,nutrition};
 if(idx>=0)S.custom[idx]=updated;else S.custom.push(updated);S.maybe.delete(id);S.hidden.delete(id);
} else if(isEdit){
 const idx=S.custom.findIndex(x=>x.id===item.id);if(idx<0)return;const id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 if(id!==item.id&&allFoods().some(x=>x.id===id)){appToast('A meal with that name already exists.');return;}
 let savedPhotos;try{savedPhotos=await storeMealPhotoSet(id,editorPhotos);}catch(err){appToast(err.message);return;}
 if(id!==item.id)await deleteStoredMealPhotos(item.id);
 const orderedPhotos=dedupeMealPhotos(savedPhotos,8),coverPhoto=orderedPhotos[0]||DEFAULT_FOOD_IMAGE;
 const updated={...S.custom[idx],id,name,primary:S.custom[idx].primary,category:cat,quickCuts,mealTimes,images:orderedPhotos,image:coverPhoto,description,ingredients,recipe,nutrition};S.custom[idx]=updated;
 if(id!==item.id){const oldNoteKey='food:'+item.id,newNoteKey='food:'+id;if(S.notes[oldNoteKey]){S.notes[newNoteKey]=S.notes[oldNoteKey];delete S.notes[oldNoteKey];saveItemNotes();}}
 S.maybe.delete(item.id);S.hidden.delete(item.id);
} else {
 const id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');if(allFoods().some(x=>x.id===id)){appToast('A meal with that name already exists.');return;}
 let savedPhotos;try{savedPhotos=await storeMealPhotoSet(id,editorPhotos);}catch(err){appToast(err.message);return;}
 const orderedPhotos=dedupeMealPhotos(savedPhotos,8),coverPhoto=orderedPhotos[0]||DEFAULT_FOOD_IMAGE;
 const added={id,name,primary:id,category:cat,quickCuts,mealTimes,images:orderedPhotos,image:coverPhoto,description,ingredients,recipe};if(nutrition)added.nutrition=nutrition;S.custom.push(added);
}
if(!S.custom.some(x=>Array.isArray(x.quickCuts)&&x.quickCuts.includes('Other')))S.cutCats.delete('Other');
if(isEdit) setItemNote({id:(S.custom.find(x=>x.id===name.toLowerCase().replace(/[^a-z0-9]+/g,'-'))?.id||item?.id),name},'food',editorNote);
buildFood(); foodQuick(); save(); modal.remove(); $('foodEditorModalBg')?.remove();
if(S.screen==='food' && !isEdit){ show('food'); foodQuick(); drawFood(); }
else manageFoodsView();
};
}
function deletedFoodRows(){
 const defaults=getDefaultFoods(),defaultIds=new Set(defaults.map(x=>String(x.id))),overrides=new Map((S.custom||[]).map(x=>[String(x.id),x]));
 const built=defaults.filter(x=>(S.deleted||new Set()).has(String(x.id))).map(item=>{
  const override=overrides.get(String(item.id)),source=override||item;
  return Object.assign({},item,override||{},{builtInEdit:!!override,builtInId:String(item.id),deleted:true,quickCuts:Array.isArray(source.quickCuts)&&source.quickCuts.length?source.quickCuts:[String(source.category||item.category||'American')]});
 });
 const customs=(S.deletedCustomMeals||[]).filter(x=>!defaultIds.has(String(x.id))).map(x=>Object.assign({},x,{deleted:true,quickCuts:Array.isArray(x.quickCuts)&&x.quickCuts.length?x.quickCuts:[x.category||'American']}));
 return built.concat(customs);
}
async function deleteMealFromLibrary(id){
 const row=allFoods().find(x=>String(x.id)===String(id));if(!row)return;
 if(!await appConfirm('Delete '+row.name+'?','This removes the meal from decisions. You can restore it from Deleted Meals; built-in meals can also be recovered with Restore Defaults.','Delete Meal'))return;
 const key=String(id),defaultIds=new Set(getDefaultFoods().map(x=>String(x.id)));
 S.deleted.add(key);S.hidden.delete(key);S.foodCuts.delete(key);S.maybe.delete(key);
 if(!defaultIds.has(key)){
  if(!S.deletedCustomMeals.some(x=>String(x.id)===key))S.deletedCustomMeals.push({...row});
  const idx=S.custom.findIndex(x=>String(x.id)===key);if(idx>=0)S.custom.splice(idx,1);
 }
 buildFood();foodQuick();save();manageFoodsView();
}
function restoreDeletedMeal(id){
 const key=String(id),defaultIds=new Set(getDefaultFoods().map(x=>String(x.id)));
 if(defaultIds.has(key))S.deleted.delete(key);
 else{
  const archived=S.deletedCustomMeals.find(x=>String(x.id)===key);
  if(archived&&!S.custom.some(x=>String(x.id)===key))S.custom.push({...archived});
  S.deletedCustomMeals=S.deletedCustomMeals.filter(x=>String(x.id)!==key);
  S.deleted.delete(key);
 }
 buildFood();foodQuick();save();manageFoodsView();
}
function manageFoodsView() {
 const rows=allFoods(),deletedRows=deletedFoodRows();
 const defaultIds=new Set(getDefaultFoods().map(x=>String(x.id)));
 const rowMarkup=(item,deleted=false)=>{
  const id=String(item.id),hidden=S.hidden.has(id),builtIn=defaultIds.has(id),customRecord=S.custom.find(x=>String(x.id)===id),edited=builtIn&&!!customRecord,customOnly=!builtIn&&!!customRecord;
  const state=deleted?'Deleted':(hidden?'Hidden':'Active');
  const stateLabel=state+(edited?' · Edited':(customOnly?' · Custom':''));
  const mealTimeLabel=mealTimesFor(item).join(' · ');
  const primary=deleted
    ? '<button class="manage-row-action manage-restore" data-food-deleted-restore="'+esc(id)+'">Restore</button>'
    : hidden
      ? '<button class="manage-row-action manage-restore" data-food-restore="'+esc(id)+'">Restore</button>'
      : '<button class="manage-row-action manage-hide" data-food-hide="'+esc(id)+'">Hide</button>';
  const extra=deleted?'':'<button class="manage-row-action manage-edit" data-food-edit="'+esc(id)+'">Edit</button>';
  const deleteAction=deleted?'':'<button class="manage-row-action manage-delete" data-food-delete="'+esc(id)+'">Delete</button>';
  return '<div class="food-row manage-food-row"><span class="manage-food-name"><b>'+esc(item.name)+'</b><small class="row-state '+(deleted?'is-deleted':(hidden?'is-hidden':'is-active'))+'">'+esc(stateLabel)+'</small><small class="row-meal-time">'+esc(mealTimeLabel)+'</small></span><span class="food-row-actions">'+extra+primary+deleteAction+'</span></div>';
 };
 const body='<div class="manage-meals-view"><div class="manage-hero"><span class="manage-kicker">MEAL LIBRARY</span><h4>Shape your choices.</h4><p>Edit any meal, replace its photo, hide it from decisions, or delete it. Deleted meals stay recoverable on this device.</p></div>'+
 '<button class="manage-add-action" id="openFoodEditor" type="button"><span class="manage-add-icon" aria-hidden="true">＋</span><span>Add Meal</span></button>'+
 '<div class="food-list">'+rows.map(x=>rowMarkup(x)).join('')+'</div>'+
 (deletedRows.length?'<section class="deleted-meals-section"><div class="deleted-meals-heading"><span class="manage-kicker">RECOVERY</span><h5>Deleted Meals</h5><p>Restore a deleted meal without changing the rest of your library.</p></div><div class="food-list">'+deletedRows.map(x=>rowMarkup(x,true)).join('')+'</div></section>':'')+
 '</div>';
 const modal=openModal('manageFoodsModal','Manage Meals',body);
 $('openFoodEditor').onclick=()=>foodEditor();
 modal.querySelectorAll('[data-food-restore]').forEach(btn=>btn.onclick=()=>{S.hidden.delete(btn.dataset.foodRestore);buildFood();save();manageFoodsView();});
 modal.querySelectorAll('[data-food-hide]').forEach(btn=>btn.onclick=()=>{S.hidden.add(btn.dataset.foodHide);buildFood();save();manageFoodsView();});
 modal.querySelectorAll('[data-food-edit]').forEach(btn=>btn.onclick=()=>{const row=allFoods().find(x=>String(x.id)===String(btn.dataset.foodEdit));if(row){modal.remove();$('manageFoodsModalBg')?.remove();foodEditor(row);}});
 modal.querySelectorAll('[data-food-delete]').forEach(btn=>btn.onclick=()=>deleteMealFromLibrary(btn.dataset.foodDelete));
 modal.querySelectorAll('[data-food-deleted-restore]').forEach(btn=>btn.onclick=()=>restoreDeletedMeal(btn.dataset.foodDeletedRestore));
}
function settingsActionButton(id,icon,title,note,extraClass=''){
 return '<button class="settings-action '+extraClass+'" id="'+id+'" type="button"><span class="settings-action-icon" aria-hidden="true">'+icon+'</span><span class="settings-action-copy"><b>'+title+'</b><small>'+note+'</small></span><span class="settings-action-chevron" aria-hidden="true">›</span></button>';
}
function settingsView(){
 removeFoodOverlays();
 const hiddenRestaurants=Object.values(S.hiddenRestaurants);
 const body='<div class="settings-stack">'+
 '<section class="settings-section"><div class="settings-section-kicker">YOUR CHOICES</div><h4>Hidden Restaurants</h4><p class="settings-section-note">Restaurants you have chosen to hide stay out of your current restaurant decisions.</p><div class="settings-inline-list">'+
 (hiddenRestaurants.length?hiddenRestaurants.map(x=>'<div class="food-row settings-hidden-row"><span><b>'+esc(x.name)+'</b><small>Hidden restaurant</small></span><button class="restore settings-inline-action" data-setting-rest="'+esc(x.id)+'">Restore</button></div>').join(''):'<p class="settings-empty">No hidden restaurants.</p>')+
 '</div></section>'+
 '<section class="settings-section"><div class="settings-section-kicker">TOOLS</div><div class="settings-actions">'+
 
settingsActionButton('tutorialModeSettings','✦','Tutorial Mode','Walk through Home, Meals, Restaurants, and the Menu again.','tutorial-action')+
 settingsActionButton('appDiagnosis','⌁','App Diagnosis','Live checks for the current build and restaurant system.','diagnosis-action')+
 settingsActionButton('resetRestore','↺','Reset & Restore','Restore original meals or wipe all local app data.','restore-action')+
 '</div></section>'+
 '<section class="settings-section"><div class="settings-section-kicker">YOUR DATA</div><div class="settings-actions settings-actions-utility">'+
 settingsActionButton('exportPdf','▣','Export PDF','Save or share your Dinliminate history as a polished PDF.','export-action')+
 settingsActionButton('privacySettings','◇','Privacy & Data','How location, history, notes, and third-party data are handled.','privacy-action')+
 '</div></section>'+
 '<section class="settings-section settings-about-section"><div class="settings-section-kicker">ABOUT DINLIMINATE</div><div class="settings-about-copy"><p>Cut the dinner choices until one survives.</p></div><div class="about-meta"><p><span>Version</span><b>'+esc(APP_VERSION)+'</b></p><p><span>Build</span><b>'+esc(APP_BUILD)+'</b></p><p><span>Date</span><b>'+esc(new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(new Date()))+'</b></p></div><p class="about-credit">Made by Brian Dunn for Devona Dunn</p></section>'+
 '</div>';
 const modal=openModal('settingsModal','Settings',body);
 modal.querySelectorAll('[data-setting-rest]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.settingRest;delete S.hiddenRestaurants[id];const row=S.restaurantPool.find(x=>x.id===id);if(row)row._hidden=false;save();modal.remove();$('settingsModalBg')?.remove();settingsView();});
 $('appDiagnosis').onclick=()=>{modal.classList.add('diagnosis-modal');modal.style.minHeight='min(78svh,720px)';modal.style.maxHeight='88svh';appDiagnosisView(modal);};
 $('tutorialModeSettings').onclick=()=>{const next=!tutorialModeEnabled();modal.remove();$('settingsModalBg')?.remove();setTutorialMode(next,true);};
 $('resetRestore').onclick=()=>resetRestoreView();
 $('exportPdf').onclick=()=>exportPdfView();
 $('privacySettings').onclick=()=>privacyView();
}
function diagnosisMiles(a,b,c,d){
 const R=3958.7613,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p,z=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;
 return 2*R*Math.asin(Math.sqrt(z));
}
function diagnosisNameTokens(value){
 return String(value||'').toLowerCase().replace(/[’']s\b/gi,' ').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
}
function diagnosisNameVariant(a,b){
 const aa=diagnosisNameTokens(a),bb=diagnosisNameTokens(b);if(!aa.length||!bb.length)return false;
 const as=new Set(aa),bs=new Set(bb),shared=aa.filter(t=>bs.has(t)).length;
 return shared===Math.min(as.size,bs.size)&&shared/new Set([...aa,...bb]).size>=0.6;
}
function diagnosisRestaurantDuplicates(rows){
 const out=[];
 for(let i=0;i<(rows||[]).length;i++)for(let j=i+1;j<(rows||[]).length;j++){
  const a=rows[i],b=rows[j];
  const d=Number.isFinite(Number(a?.lat))&&Number.isFinite(Number(a?.lon))&&Number.isFinite(Number(b?.lat))&&Number.isFinite(Number(b?.lon))?diagnosisMiles(Number(a.lat),Number(a.lon),Number(b.lat),Number(b.lon)):Infinity;
  const addrA=normKey(a?.address),addrB=normKey(b?.address),sameAddr=addrA&&addrB&&addrA===addrB,sameName=normKey(a?.name)===normKey(b?.name),conflictingAddress=addrA&&addrB&&!sameAddr;
  if(d<=0.2&&!conflictingAddress&&(sameName||sameAddr||diagnosisNameVariant(a?.name,b?.name)))out.push([a?.name,b?.name,d]);
 }
 return out;
}
function foodPhotoAuditCatalog(foods){
 const byUrl=new Map(),missing=[];
 for(const food of foods||[]){
  const url=String(food?.image||'').trim();
  if(!url||url===DEFAULT_FOOD_IMAGE){missing.push(food?.name||food?.id||'Unnamed meal');continue;}
  if(!byUrl.has(url))byUrl.set(url,[]);
  byUrl.get(url).push(food);
 }
 const reused=[...byUrl.entries()]
  .filter(([,items])=>items.length>1)
  .map(([url,items])=>({url,meals:items.map(x=>x?.name||x?.id||'Unnamed meal')}))
  .sort((a,b)=>b.meals.length-a.meals.length);
 return {mealCount:(foods||[]).length,uniquePhotoCount:byUrl.size,missing,reused};
}
async function auditFoodPhotoUrls(foods){
 const urls=[...new Set((foods||[]).map(x=>String(x?.image||'').trim()).filter(x=>/^https?:\/\//i.test(x)))];
 const failed=[],checked=[];
 let cursor=0;
 const worker=async()=>{
  while(true){
   const i=cursor++;
   if(i>=urls.length)return;
   const url=urls[i],src=imageProxyUrl(url);
   const result=await new Promise(resolve=>{
    const img=new Image();let done=false;
    const timer=setTimeout(()=>{if(done)return;done=true;resolve({ok:false,timeout:true})},7000);
    img.onload=()=>{if(done)return;done=true;clearTimeout(timer);resolve({ok:true})};
    img.onerror=()=>{if(done)return;done=true;clearTimeout(timer);resolve({ok:false,timeout:false})};
    img.referrerPolicy='no-referrer';img.src=src;
   });
   checked.push({url,...result});
   if(!result.ok)failed.push(url);
  }
 };
 await Promise.all(Array.from({length:Math.min(8,urls.length)},()=>worker()));
 const failedSet=new Set(failed);
 return {uniqueUrls:urls.length,failed,failedSet,checked};
}
async function appDiagnosisView(existingModal){
 if(!existingModal||!document.body.contains(existingModal))return null;
 const shellClass='diagnosis-modal';
 const initialSections=['Core app','Meal system','Restaurant system','iPhone & PWA','Interaction stability','Build & launch'];
 const body='<div class="diagnosis-wrap"><div id="diagnosisBody" aria-busy="true"><div class="diagnosis-summary diagnosis-summary-strong"><span class="diagnosis-status-dot warn" aria-hidden="true"></span><div><b>App Diagnosis</b><small>Refreshing the current Dinliminate release.</small></div><strong>Live</strong></div>'+initialSections.map(label=>'<section class="diagnosis-section"><div class="diagnosis-section-head"><b>'+label+'</b><span>Checking…</span></div><div class="diagnosis-row info"><span class="diagnosis-mark" aria-hidden="true">i</span><span><b>Checking</b><small>Reading the current app state and release contracts.</small></span></div></section>').join('')+'</div><div class="diagnosis-runbar"><span id="diagnosisRunStatus" class="diagnosis-run-status" aria-live="polite">Checking…</span><button class="secondary diagnosis-refresh" id="diagnosisRefresh" type="button" aria-pressed="false" disabled aria-label="Run diagnostics again">Run again</button></div></div>';
 const modal=existingModal;
 modal.classList.add(shellClass);
 const head=modal.querySelector('.modal-head');
 [...modal.children].forEach(child=>{if(child!==head)child.remove();});
 const title=head?.querySelector('h3');
 if(title)title.textContent='App Diagnosis';
 const close=head?.querySelector('[data-close]');
 if(close)close.setAttribute('aria-label','Close App Diagnosis');
 modal.insertAdjacentHTML('beforeend',body);
 let running=false,run=0;
 const render=async()=>{
  if(running||!document.body.contains(modal))return;
  running=true;run++;
  const refresh=$('diagnosisRefresh'),runStatus=$('diagnosisRunStatus'),diagnosisBody=$('diagnosisBody');
  if(refresh){refresh.disabled=true;refresh.setAttribute('aria-pressed','true');refresh.classList.add('selected');refresh.classList.remove('complete');refresh.textContent='✓ Checking…';}
  if(runStatus){runStatus.textContent='Run '+run+' selected · checking now…';runStatus.classList.add('running');}
  if(diagnosisBody)diagnosisBody.setAttribute('aria-busy','true');
  const checks=[];
  const add=(section,state,label,detail)=>checks.push({section,state,label,detail});
  const pass=(s,l,d)=>add(s,'ok',l,d), warn=(s,l,d)=>add(s,'warn',l,d), info=(s,l,d)=>add(s,'info',l,d), fail=(s,l,d)=>add(s,'fail',l,d);
  const sectionLabels={core:'Core app',food:'Meal system',restaurant:'Restaurant system',runtime:'iPhone & PWA',release:'Build & launch'};
  try{
   /* Core app structure */
   const coreRequired=['home','food','restaurant','winner','menu','foodStart','restStart','addToPhone','shareApp','tutorialModeToggle','tutorialLayer'];
   const coreMissing=coreRequired.filter(id=>!$(id));
   coreMissing.length?fail('core','Home & navigation contract','Missing '+coreMissing.length+' required core element(s): '+coreMissing.join(', '),'Repair the missing shell element before relying on later checks.'):pass('core','Home & navigation contract','Home, Meal, Restaurant, Winner, Menu, and both Home utility actions are present.');
   const navLabels=[...document.querySelectorAll('#drawer-nav .drawer-row')].map(x=>x.textContent?.trim()).join(' ');
   const drawerSource=document.querySelector('#drawer')?.textContent||'';
   if(drawerSource.includes('Manage Meals')&&drawerSource.includes('History')&&drawerSource.includes('Settings')&&drawerSource.includes('Back to Start')&&!drawerSource.includes('Restaurants</b>'))pass('core','Navigation menu','Top-level navigation uses Manage Meals, History, Settings, and Back to Start.','Restaurants remain part of the dedicated Restaurant flow rather than a top-level menu item.');
   else warn('core','Navigation menu','Top-level navigation could not be fully verified from the current DOM.','Open the menu and rerun diagnosis.');
   const homeActions=[...document.querySelectorAll('[data-home-action]')];
   homeActions.length===3&&homeActions.every(x=>x.type==='button')?pass('core','Home utility actions','Add-to-phone, Share, and Tutorial are separate icon actions with button semantics.','All three Home utility actions share the same discreet icon treatment.'):fail('core','Home utility actions','The Home utility action contract is incomplete.','Expected exactly three data-home-action buttons.');
   const addIcon=$('addToPhone')?.querySelector('.phone-plus-icon'),shareIcon=$('shareApp')?.querySelector('.share-icon');
   addIcon&&shareIcon?pass('core','Home utility icons','Premium phone-plus and share icons are present.'):fail('core','Home utility icons','One or more Home utility icons are missing.','Restore the iPhone-plus and share artwork.');
   const actionHandlerSource=String(homeActionHandler?.toString?.()||'');
   actionHandlerSource.includes("action==='add'")&&actionHandlerSource.includes("action==='share'")&&actionHandlerSource.includes("action==='tutorial'")?pass('core','Home action routing','Add-to-phone, Share, and Tutorial each have independent click routing.'):fail('core','Home action routing','Home action routing is incomplete.','Add, Share, and Tutorial must all route through the Home action handler.');
   
   /* Meal system */
   const foods=getDefaultFoods();
   const foodIds=foods.map(x=>x?.id).filter(Boolean);
   const duplicateFoodIds=foodIds.length-new Set(foodIds).size;
   duplicateFoodIds?fail('food','Meal catalog',duplicateFoodIds+' duplicate meal ID(s) detected.','Duplicate IDs can destabilize card, Hide, Maybe, and History state.'):pass('food','Meal catalog',foods.length+' built-in meals loaded with unique IDs.','Current catalog is expected to contain the restored 116-meal set.');
   const requiredFoodNames=['Lasagna','Vegetable Lasagna','Salisbury Steak','Stuffed Peppers','Health Shake','White Fish','BLT','Reuben','Hot Dog','Corn Dog','Orange Chicken','Chicken Teriyaki','Sushi','Pancakes','Omelet','Oatmeal','Shrimp','Crab Cakes','Gumbo','Chicken Nuggets','Ramen','Pimento Cheese Sandwich','Liver & Onions','Enchiladas','Fish Sticks','Protein Bar'];
   const normalizedNames=new Set(foods.map(x=>String(x?.name||'').trim().toLowerCase()));
   const missingFoodNames=requiredFoodNames.filter(x=>!normalizedNames.has(x.toLowerCase()));
   missingFoodNames.length?warn('food','Requested meal coverage',missingFoodNames.length+' named requested meal(s) are not present by exact display name.',missingFoodNames.join(', ')):pass('food','Requested meal coverage','The current catalog contains the requested restored meal set by exact display name.');
   const invalidFood=foods.filter(x=>!x?.name||!x?.category||!x?.image||!Array.isArray(x?.quickCuts)||!x.quickCuts.length||!Array.isArray(x?.ingredients)||!x.ingredients.length||!x?.nutrition||!x?.recipe);
   invalidFood.length?fail('food','Meal details',invalidFood.length+' meal(s) are missing required Details data.',invalidFood.slice(0,8).map(x=>x?.name||x?.id).join(', ')+(invalidFood.length>8?' + more':'')):pass('food','Meal details','All built-in meals have photo, Cuisine Cut, ingredients, nutrition, and recipe/detail data.');
   const foodQuick=foodQuickLabels();
   const expectedFoodQuick=['American','Southern','Mexican','Italian','Asian','Pasta','Soup/Stew','Healthy','Seafood','Potato','Other'];
   const foodQuickContract=expectedFoodQuick.every((x,i)=>foodQuick[i]===x)&&foodQuick.length>=expectedFoodQuick.length;
   foodQuickContract?pass('food','Meal Cuisine Cuts','The current Food Cuisine Cut order is present.','Other remains conditional for custom meals.'):fail('food','Meal Cuisine Cuts','Food Cuisine Cuts are out of sync.','Expected American, Southern, Mexican, Italian, Asian, Pasta, Soup/Stew, Healthy, Seafood, Potato, Other.');
   const legacy=foods.filter(x=>/stouffer|frozen dinner/i.test(String(x?.name||'')));
   legacy.length?fail('food','Legacy meal cleanup',legacy.length+' Stouffer/frozen-dinner choice(s) remain.',legacy.map(x=>x.name).join(', ')):pass('food','Legacy meal cleanup','Stouffer/frozen-dinner legacy choice is absent.');
   const foodSourceChecks=typeof foodCut==='function'&&typeof foodMaybe==='function'&&typeof foodBack==='function'&&typeof bindCardButton==='function';
   foodSourceChecks?pass('food','Meal decision actions','Cut, Maybe, Choose, and Details use the current card-button path.','The direct Choose action remains separate from swipe decisions.'):warn('food','Meal decision actions','Source could not confirm every current card action binding.','Open a Meal card and rerun diagnosis.');
   const chooseCardActions=document.querySelectorAll('.choose-card-action');
   chooseCardActions.length?pass('food','Choose-this placement','Direct Choose actions are present on the current card layout.','They remain separated from the larger Cut/Maybe controls.'):info('food','Choose-this placement','The current card is not rendered on this screen, so direct Choose placement is deferred until a Meal card is open.');
   const noteSource=typeof bindDetailNotes==='function'&&typeof itemNoteKey==='function';
   noteSource?pass('food','Notes','Meal/Restaurant Details notes are stored locally and have edit/delete controls.'):warn('food','Notes','The local Notes implementation could not be confirmed from source.');
   
   /* Restaurant system */
   const radius=[...($('radius')?.options||[])].map(o=>Number(o.value)).filter(Number.isFinite);
   const expectedRadius=[1,3,5,10,25,50,100];
   radius.length===7&&expectedRadius.every((x,i)=>radius[i]===x)?pass('restaurant','Radius controls','1 / 3 / 5 / 10 / 25 / 50 / 100 miles are exposed.','The current API model is capped at 100 miles.'):fail('restaurant','Radius controls','Restaurant radius options are out of sync.', 'Expected exactly 1 / 3 / 5 / 10 / 25 / 50 / 100 miles.');
   const locationControls=['locate','address','find','radius'].every(id=>$(id));
   locationControls?pass('restaurant','Location controls','Use My Location, address search, Find/Refresh, and Radius controls are present.'):fail('restaurant','Location controls','One or more Restaurant location controls are missing.');
   const restaurantSearchBox=$('restaurantQuery')||document.querySelector('#restaurantSearchBox input');
   restaurantSearchBox?info('restaurant','Restaurant search','Restaurant search remains available in source but is intentionally hidden in the current UI.','The visible Restaurant shell does not expose a Search control right now.'):fail('restaurant','Restaurant search','Restaurant search input is missing from the source.');
   const restTaxonomy=Array.isArray(REST_QUICK)?REST_QUICK:[];
   const expectedRest=['Fast Food','Burgers','Pizza','Mexican','American','Italian','Asian','BBQ','Seafood','Breakfast','Southern'];
   expectedRest.every(x=>restTaxonomy.includes(x))?pass('restaurant','Restaurant Cuisine Cuts','Restaurant Cuisine Cuts include Fast Food and the current cuisine/category taxonomy.'):fail('restaurant','Restaurant Cuisine Cuts','The Restaurant taxonomy is missing one or more required categories.','Expected Fast Food, Burgers, Pizza, Mexican, American, Italian, Asian, BBQ, Seafood, Breakfast.');
   const hoursControl=!!document.getElementById('restaurantHoursToggle');
   hoursControl?pass('restaurant','Restaurant Hours filter','Search, Cuisine, and Hours are available on the Restaurant discovery rail.','Hours offers All / Open / Closed and filters the loaded pool locally without opening Restaurant Details.'):fail('restaurant','Restaurant Hours filter','The Restaurant Hours control is missing from the current shell.','Expected Search — Cuisine — Hours on the discovery rail.');
   const freshPoolSource=typeof searchRestaurants==='function'&&typeof restaurantPoolBase==='function';
   freshPoolSource?pass('restaurant','Fresh restaurant result pool','Current search results are filtered from the active restaurant pool.','Cuisine Cuts and search work from the current loaded result pool rather than a separate stale base list.'):fail('restaurant','Fresh restaurant result pool','The active restaurant pool functions could not be confirmed.');
   const deDupSource=typeof dedupeRestaurantPool==='function'&&typeof diagnosisRestaurantDuplicates==='function';
   deDupSource?pass('restaurant','Restaurant de-duplication','The current restaurant pipeline has identity/distance de-duplication plus diagnosis review logic.'):warn('restaurant','Restaurant de-duplication','De-duplication safeguards could not be fully confirmed from source.');
   const photoSourceChecks=typeof hydrateRestaurantPhoto==='function'&&typeof loadRestaurantPhoto==='function';
   photoSourceChecks?pass('restaurant','Restaurant photography','The current cards hydrate restaurant-specific photos through the dedicated restaurant photo pipeline.','The photo system can fall back safely when a venue-specific source is unavailable.'):fail('restaurant','Restaurant photography','The dedicated restaurant-photo pipeline is not visible in the current app source.');
   info('restaurant','Photo/search credential independence','Restaurant photography and search are integrated without requiring a Google credential in the client.','The backend can use provider/official/web verification paths when available; the diagnosis does not require a Google key to run.');
   const currentRestaurants=S.restaurantPool||[];
   currentRestaurants.length?info('restaurant','Current restaurant pool',currentRestaurants.length+' restaurant result(s) are loaded on this device.', 'Run the restaurant search to inspect live counts and current Cuisine Cut behavior.'):info('restaurant','Current restaurant pool','No Restaurant results are loaded on this screen.','This is normal while the diagnosis is opened from Home or Settings.');
   const healthUrl='./api/restaurant-search?mode=health&diagnosis='+Date.now();
   try{
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),5000);
    const rr=await fetch(healthUrl,{cache:'no-store',signal:ctl.signal});
    clearTimeout(tm);
    const d=await rr.json().catch(()=>null);
    rr.ok&&d?.ok?pass('restaurant','Restaurant API health','Healthy · version '+String(d.version||'unknown')+' · max radius '+String(d.maxRadiusMiles||'unknown')+' mi.','Health check is read-only and does not alter the current restaurant pool.'):warn('restaurant','Restaurant API health','Health endpoint returned HTTP '+rr.status+'.','This can affect location, radius, search, Cuisine Cuts, and restaurant cards.');
   }catch(e){warn('restaurant','Restaurant API health','Health check failed or timed out.','The diagnosis does not change location or search state.');
   }
   const googleUsageUrl='./api/google-usage?diagnosis='+Date.now();
   try{
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),5000);
    const rr=await fetch(googleUsageUrl,{cache:'no-store',signal:ctl.signal});
    clearTimeout(tm);
    const d=await rr.json().catch(()=>null);
    if(!rr.ok||!d?.ok){
      warn('restaurant','Google usage tracker','Tracker endpoint returned HTTP '+rr.status+'.','Google calls remain fail-closed when durable budget tracking is unavailable.');
    }else{
      const skus=Array.isArray(d.skus)?d.skus:[];
      const exhausted=skus.filter(x=>x.status==='exhausted'||x.status==='disabled');
      const warnings=skus.filter(x=>x.status==='warning');
      const photo=skus.find(x=>x.sku==='place-photo');
      const summary=photo&&photo.used!==null?'Photos '+photo.used+'/'+photo.cap+' · '+String(photo.remaining)+' remaining'+(warnings.length?' · warning threshold reached on '+warnings.length+' SKU(s)':''):'Google usage is not durably trackable in this runtime.';
      if(d.status==='blocked-untracked'){
        fail('restaurant','Google usage tracker',summary,'Durable Neon budget tracking is unavailable and the fail-closed guard is blocking untracked Google calls.');
      }else if(exhausted.length){
        warn('restaurant','Google usage tracker',summary,'At least one Google SKU is currently limited or disabled for the billing month.');
      }else if(warnings.length){
        warn('restaurant','Google usage tracker',summary,'At least one Google SKU is above 80% of its monthly cap.');
      }else{
        pass('restaurant','Google usage tracker',summary,'Read-only tracker is online; each Google SKU has a hard monthly cap.');
      }
    }
   }catch(e){warn('restaurant','Google usage tracker','Tracker check failed or timed out.','The app does not treat an unreachable tracker as permission to spend untracked Google usage.');
   }
   
   /* Interaction stability */
   const queryInputSource=String(document.querySelector('#restaurantQuery')?.oninput||'');
   const queryKeydownSource=String(document.querySelector('#restaurantQuery')?.onkeydown||'');
   const searchSource=typeof searchRestaurants==='function'?String(searchRestaurants):'';
   const queryStable=!queryInputSource.includes('drawRestaurants()')&&queryKeydownSource.includes('preventDefault')&&queryKeydownSource.includes('stopPropagation')&&queryKeydownSource.includes('searchRestaurants()');
   queryStable?pass('runtime','Restaurant keyboard submit','Restaurant Search Enter submits from the current field without redrawing the active card first.','Typing is state-only and debounced; the phone keyboard action is one explicit submit.'):fail('runtime','Restaurant keyboard submit','The Restaurant Search keyboard path can redraw or double-submit the card.','Keep typing state-only and let Enter perform one explicit search.');
   const searchTargetGuard=searchSource.includes("const previousSearchKey=String(S.restaurantSearchKey||'')")&&searchSource.includes('replacingSearchTarget=!!previousSearchKey&&previousSearchKey!==searchKey')&&searchSource.includes('if(replacingSearchTarget)');
   searchTargetGuard?pass('runtime','Search visual stability','Restaurant searches preserve the current card for the same target and intentionally clear it only when location, radius, or query changes.','A materially new search cannot leave stale cards visible, while routine submits do not blank the active card.'):fail('runtime','Search visual stability','The restaurant search target-change guard is missing or incomplete.','Keep the active card for same-target searches and clear stale cards only when the search key changes.');
   const stylesText=document.documentElement?Array.from(document.styleSheets).map(sheet=>{try{return Array.from(sheet.cssRules||[]).map(r=>r.cssText).join('\n')}catch{return ''}}).join('\n'):'';
   const coachLowered=/\.swipe-card-coach\{[^}]*bottom:6px/i.test(stylesText)&&/@media\(max-width:390px\)[\s\S]*?\.swipe-card-coach\{[^}]*bottom:4px/i.test(stylesText);
   coachLowered?pass('runtime','Swipe lesson placement','The first Swipe/Cut/Maybe lesson is anchored near the bottom action controls on phones.','The instruction stays inside the card and no longer sits high above the action row.'):warn('runtime','Swipe lesson placement','The source contains the Swipe/Cut/Maybe lesson, but final mobile spacing could not be verified here.','Physical iPhone spacing remains a device-check item.');
   const wheelStartSource=typeof startContinuousWheelSpin==='function'?String(startContinuousWheelSpin):'';
   const wheelFinishSource=typeof finishHungryWheelRotation==='function'?String(finishHungryWheelRotation):'';
   const wheelStable=wheelStartSource.includes('hideCelebration()')&&wheelStartSource.includes('S.hungryWheelSpinToken++')&&wheelFinishSource.includes('triggerCelebration(true)');
   wheelStable?pass('runtime','Hungry wheel repeat-spin isolation','A new wheel spin clears prior celebration state and advances the spin token before motion starts.','Old stop callbacks cannot resolve into a later spin.'):fail('runtime','Hungry wheel repeat-spin isolation','Repeat-spin state isolation is incomplete.','Reset celebration and invalidate prior wheel callbacks at spin start.');
   const photoCacheSource=typeof loadRestaurantPhoto==='function'?String(loadRestaurantPhoto):'';
   const cacheBound=photoCacheSource.includes('touchRestaurantPhotoMemoryCache')&&typeof trimRestaurantPhotoMemoryCache==='function'&&String(trimRestaurantPhotoMemoryCache).includes('URL.revokeObjectURL');
   const photoSwapSource=typeof swapImageWhenReady==='function'?String(swapImageWhenReady):'';
   cacheBound&&photoSwapSource.includes('new Image()')&&photoSwapSource.includes('probe.onload')?pass('runtime','Restaurant photo memory/flash protection','Restaurant photo memory is bounded and replacements are preloaded before the visible source changes.','This reduces iPhone memory pressure and photo source-change flashes.'):warn('runtime','Restaurant photo memory/flash protection','The bounded photo-cache or preloaded image swap safeguards could not be fully verified.','Repeat restaurant browsing on an iPhone remains an important stress test.');
   const prefetchSource=typeof prefetchRestaurantPhotos==='function'?String(prefetchRestaurantPhotos):'';
   prefetchSource.includes('restaurantPhotoPrefetchTimer')&&prefetchSource.includes('clearTimeout(restaurantPhotoPrefetchTimer)')?pass('runtime','Restaurant photo prefetch throttling','Rapid card movement coalesces background photo prefetch work instead of stacking loads.','This limits network and memory pressure during fast browsing.'):warn('runtime','Restaurant photo prefetch throttling','Photo prefetch throttling could not be fully verified.','Rapid swiping can otherwise increase network and memory pressure.');
   const appRuntimeVersion=String(APP_BUILD||'');
   let swVersionSynchronized=false;
   try{
    const swCheck=await fetch('./sw.js?diagnosis='+Date.now(),{cache:'no-store'});
    const swText=await swCheck.text();
    swVersionSynchronized=swCheck.ok&&swText.includes(`dinliminate-shell-v${appRuntimeVersion}`)&&swText.includes(`./app.js?v=${appRuntimeVersion}`);
   }catch{}
   swVersionSynchronized?pass('runtime','PWA runtime versioning','The app runtime and service-worker shell are synchronized to build '+appRuntimeVersion+'.','The cache-query and service-worker shell point to the same release.'):warn('runtime','PWA runtime versioning','The service-worker shell does not match app build '+appRuntimeVersion+'.','The app now unregisters an older worker and registers the current build-specific worker on load.');
   /* iPhone / PWA */
   const metaViewport=document.querySelector('meta[name="viewport"]')?.getAttribute('content')||'';
   metaViewport.includes('viewport-fit=cover')?pass('runtime','Safe-area configuration','viewport-fit=cover is enabled so the app can use the full iPhone display area.','This setting does not impose a width or height limit; safe-area insets are reserved only where content needs protection from the notch/home indicator.'):warn('runtime','Safe-area configuration','viewport-fit=cover is missing.','This can reduce safe-area coverage, but it is separate from whether the app shell fills the viewport.');
   const viewportWidth=Number(window.visualViewport?.width||window.innerWidth||0);
   const viewportHeight=Number(window.visualViewport?.height||window.innerHeight||0);
   const appEl=document.querySelector('.app');
   const activeScreen=document.querySelector('.screen:not(.hidden)');
   const appRect=appEl?.getBoundingClientRect?.();
   const screenRect=activeScreen?.getBoundingClientRect?.();
   const mobileViewport=viewportWidth>0&&viewportWidth<=1199;
   const widthMatches=!!appRect&&Math.abs(appRect.width-viewportWidth)<=2;
   const heightMatches=!!appRect&&viewportHeight>0&&Math.abs(appRect.height-viewportHeight)<=2;
   const appCenteredOffViewport=!!appRect&&(Math.abs(appRect.left)>2||Math.abs(appRect.right-viewportWidth)>2);
   const appStyles=appEl?getComputedStyle(appEl):null;
   const shellRulesGood=!!appStyles&&appStyles.width!=='auto'&&appStyles.maxWidth==='none'&&appStyles.marginLeft==='0px'&&appStyles.marginRight==='0px';
   const screenMatches=!!screenRect&&Math.abs(screenRect.width-viewportWidth)<=2&&viewportHeight>0&&Math.abs(screenRect.height-viewportHeight)<=2;
   if(mobileViewport&&widthMatches&&heightMatches&&!appCenteredOffViewport&&shellRulesGood)pass('runtime','Full iPhone viewport shell','The active app shell fills the visible viewport · '+Math.round(viewportWidth)+'×'+Math.round(viewportHeight)+' CSS px.','The shell is not constrained to the desktop 520px canvas on phone-sized viewports.');
   else if(mobileViewport)fail('runtime','Full iPhone viewport shell','The app shell is not filling the visible viewport · measured '+Math.round(Number(appRect?.width)||0)+'×'+Math.round(Number(appRect?.height)||0)+' against '+Math.round(viewportWidth)+'×'+Math.round(viewportHeight)+'.','This is the check that can expose a real full-iPhone sizing problem; safe-area configuration is evaluated separately above.');
   else info('runtime','Full iPhone viewport shell','Desktop-sized viewport detected · '+Math.round(viewportWidth)+'×'+Math.round(viewportHeight)+' CSS px.','The centered 520px desktop presentation is intentional outside the phone/tablet breakpoint; the physical iPhone gate must be run on the device.');
   if(mobileViewport&&screenMatches)pass('runtime','Active screen geometry','The visible app screen matches the full viewport.','The active screen is not leaving a viewport-sized gap inside the shell.');   const address16=!!document.querySelector('#address')&&String(getComputedStyle($('address')).fontSize)==='16px';
   const search16=!!document.querySelector('#restaurantSearchBox input')&&String(getComputedStyle(document.querySelector('#restaurantSearchBox input')).fontSize)==='16px';
   address16&&search16?pass('runtime','Safari form sizing','Restaurant editable fields are using 16px text to avoid Safari auto-zoom.'):info('runtime','Safari form sizing','16px field sizing is applied on phone media queries; this desktop runtime may not be using those rules.');
   const installSource=typeof addToPhoneFlow==='function'&&typeof deferredInstallPrompt!=='undefined';
   installSource?pass('runtime','Add to phone flow','The current PWA has an install-prompt path plus an iPhone Add to Home Screen fallback.'):fail('runtime','Add to phone flow','Install behavior is not fully wired in the current source.');
   const shareSource=typeof shareApp==='function'&&typeof copyAppUrl==='function';
   shareSource?pass('runtime','Share flow','Native sharing and clipboard fallbacks are present.'):fail('runtime','Share flow','The current Share action is missing a required fallback.');
   ('serviceWorker' in navigator)?pass('runtime','Service worker support','This browser supports the PWA service-worker API.'):warn('runtime','Service worker support','This browser cannot register a service worker.');
   const swSource=typeof navigator.serviceWorker!=='undefined';
   swSource?pass('runtime','PWA registration','The app registers its service worker on load.'):fail('runtime','PWA registration','Service-worker registration code is missing.');
   const phoneHitSource=!!document.querySelector('#restaurant .location-btn, #restaurant .find');
   phoneHitSource?pass('runtime','Touch target pass','The current mobile stylesheet provides 44px location action hit areas.'):info('runtime','Touch target pass','Mobile hit-area rules exist in the stylesheet; exact physical target sizing needs device verification.');
   const autoLocationSource=typeof maybeAutoRefreshRestaurantLocation==='function'&&typeof useLocation==='function';
   autoLocationSource?pass('runtime','Restaurant auto-location','The Restaurant flow can request location automatically when no location/address is already set.'):warn('runtime','Restaurant auto-location','Automatic Restaurant location entry behavior was not confirmed from source.');
   const addressCancelSource=typeof invalidateAddressSuggestions==='function'&&typeof useLocation==='function'&&typeof locationRequestSeq!=='undefined';
   addressCancelSource?pass('runtime','Manual address protection','Manual address editing cancels pending GPS state so typed addresses cannot be overwritten.'):warn('runtime','Manual address protection','Pending GPS cancellation could not be confirmed.');
   const offline=navigator.onLine===false;
   offline?warn('runtime','Network','Browser currently reports offline.','Restaurant search and remote photos need connectivity.'):pass('runtime','Network','Browser currently reports online.','Remote restaurant data and photography still depend on external services.');
   
   /* Build / launch */
   let releaseExpectedBuild=String(APP_BUILD),releaseExpectedBranch='';
   try{
    const local=await fetch('./app-release.json?diagnosis='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null);
    const manifest=await fetch('./release-manifest.json?diagnosis='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null);
    releaseExpectedBuild=String(local?.build||APP_BUILD);
    releaseExpectedBranch=String(local?.sourceBranch||'');
    const manifestBuild=String(manifest?.build||''),manifestBranch=String(manifest?.sourceBranch||'');
    if(releaseExpectedBuild&&manifestBuild&&releaseExpectedBuild===manifestBuild&&releaseExpectedBranch&&releaseExpectedBranch===manifestBranch)pass('release','Release metadata','Build '+releaseExpectedBuild+' is synchronized across app-release and release-manifest.','Current candidate branch: '+releaseExpectedBranch+'.');
    else fail('release','Release metadata','Current release metadata is inconsistent.','app-release build='+releaseExpectedBuild+', manifest build='+manifestBuild+', app branch='+releaseExpectedBranch+', manifest branch='+manifestBranch);
   }catch{warn('release','Release metadata','Release metadata files could not be read from this runtime.','Hosted build identity remains unconfirmed.');}
   try{
    const rr=await fetch('./api/release?diagnosis='+Date.now(),{cache:'no-store'});
    const d=await rr.json().catch(()=>null);
    const runtimeBuild=String(d?.build||'');
    const runtimeBranch=String(d?.sourceBranch||'');
    const runtimeMatches=rr.ok&&runtimeBuild===releaseExpectedBuild&&(runtimeBranch===releaseExpectedBranch||!runtimeBranch);
    runtimeMatches?pass('release','Release API identity','The runtime release endpoint matches the current build metadata.','Runtime Build '+runtimeBuild+(runtimeBranch?' · '+runtimeBranch:'')+'.'):warn('release','Release API identity','The runtime release endpoint does not match the current build metadata.','Runtime build='+runtimeBuild+', expected='+releaseExpectedBuild+', branch='+runtimeBranch);
   }catch{warn('release','Release API identity','The release endpoint could not be checked.','Hosted release identity remains unconfirmed.');}
   const currentReleaseSource=APP_BUILD===releaseExpectedBuild;
   currentReleaseSource?pass('release','About / Diagnosis build source','App build display starts from the current release fallback and refreshes from app-release.json.'):warn('release','About / Diagnosis build source','The app build display fallback is stale.');
   info('release','Hosted verification','Diagnosis is capable of checking live API/release endpoints from the current browser, but it does not claim Netlify/Vercel deployment success unless those endpoints answer accordingly.','Current target: dinliminate22.');
   info('release','Physical iPhone gate','Desktop/browser diagnosis cannot certify physical iPhone Safari/PWA behavior.','Final device check still covers install, GPS permission, touch/swipe behavior, and share/add-to-home-screen behavior.');
  }catch(e){
   fail('core','Diagnostic runtime','Unexpected diagnostic failure: '+String(e?.message||e),'The diagnosis itself encountered an error while checking the current runtime.');
  }
  const failures=checks.filter(x=>x.state==='fail').length,warnings=checks.filter(x=>x.state==='warn').length,passing=checks.filter(x=>x.state==='ok').length,infos=checks.filter(x=>x.state==='info').length;
  const overall=failures?'ACTION NEEDED':warnings?'REVIEW NEEDED':'HEALTHY';
  const bySection=[];
  for(const item of checks){let sec=bySection.find(x=>x.id===item.section);if(!sec){sec={id:item.section,items:[]};bySection.push(sec);}sec.items.push(item);}
  const stateIcon={ok:'✓',warn:'!',fail:'×',info:'i'};
  const sectionHtml=bySection.map(sec=>'<section class="diagnosis-section"><div class="diagnosis-section-head"><b>'+esc(sectionLabels[sec.id]||sec.id)+'</b><span>'+sec.items.filter(x=>x.state==='fail').length+' failed · '+sec.items.filter(x=>x.state==='warn').length+' warnings</span></div>'+sec.items.map(item=>'<div class="diagnosis-row '+item.state+'"><span class="diagnosis-mark" aria-hidden="true">'+stateIcon[item.state]+'</span><span><b>'+esc(item.label)+'</b><small>'+esc(item.detail)+'</small></span></div>').join('')+'</section>').join('');
  if(diagnosisBody){diagnosisBody.setAttribute('aria-busy','false');diagnosisBody.innerHTML='<div class="diagnosis-summary diagnosis-summary-strong"><span class="diagnosis-status-dot '+(failures?'bad':warnings?'warn':'good')+'" aria-hidden="true"></span><div><b>'+esc(overall)+'</b><small>'+failures+' failed · '+warnings+' warnings · '+passing+' passing · '+infos+' informational</small></div><strong>Run '+run+'</strong></div>'+sectionHtml+'<p class="diagnosis-footnote">Green means this runtime verified the check. Yellow means something deserves review. Red means the diagnosis found a concrete problem. Informational items are deliberate launch notes, not failures.</p>';}
  if(document.body.contains(modal)&&$('diagnosisRefresh')){$('diagnosisRefresh').disabled=false;$('diagnosisRefresh').setAttribute('aria-pressed','false');$('diagnosisRefresh').classList.remove('selected');$('diagnosisRefresh').classList.add('complete');$('diagnosisRefresh').textContent='↻ Run again';}
  if(document.body.contains(modal)&&$('diagnosisRunStatus')){$('diagnosisRunStatus').textContent='✓ Run '+run+' complete · '+(failures?'action needed':warnings?'review needed':'no actionable warnings');$('diagnosisRunStatus').classList.remove('running');}
  running=false;
 };
 $('diagnosisRefresh').onclick=()=>render();
 render();
 return modal;
}
function privacyView() {
const body = '<div class="info-copy"><h4>Privacy & Data</h4><p>Dinliminate uses your selected address or optional device location to find nearby restaurants. Location access is optional.</p><p>Restaurant/address results are retrieved through Dinliminate’s search service using third-party mapping and place providers. Your exact location or selected address is used for that search request.</p><p>Your meal choices, hidden items, history, and custom-meal information are stored on this device using browser storage. Custom food photos may be stored in IndexedDB on the device.</p><p>Restaurant and meal images may be loaded from third-party image hosts. Restaurant availability, hours, phone numbers, websites, and menu information can change and are supplied by external providers.</p></div>';
openModal('privacyModal','Privacy',body);
}
function exportHistoryPrint(scope){
 const all=readHistory();
 const filtered=scope==='food'?all.filter(x=>x?.type==='food'):scope==='restaurant'?all.filter(x=>x?.type==='restaurant'):all;
 if(!filtered.length){appToast('No '+(scope==='all'?'history':scope+' history')+' to export yet.');return;}
 const scopeLabel=scope==='food'?'Food':scope==='restaurant'?'Restaurants':'All History';
 const dateLabel=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(new Date());
 const rows=filtered.map(entry=>{
  const image=String(entry?.image||'').trim();
  const hasImage=!!image && image!==HUNGRY_IMAGE && image!==FINAL_RESTAURANT_IMAGE && image!=='idb:';
  const photo=hasImage?imageProxyUrl(image):'';
  const meta=[entry?.category||entry?.cuisine||'',entry?.type==='restaurant'?(entry?.address||''):''].filter(Boolean).map(esc).join(' · ');
  const contact=[entry?.phone||'',entry?.website||''].filter(Boolean).map(esc).join(' · ');
  return '<article class="pdf-entry"><div class="pdf-entry-head"><div><div class="pdf-entry-date">'+esc(entry?.date||'')+'</div><h2>'+esc(entry?.name||'Decision')+'</h2>'+ (meta?'<p>'+meta+'</p>':'')+(contact?'<p class="pdf-contact">'+contact+'</p>':'')+'</div></div>'+(photo?'<img src="'+esc(photo)+'" alt="" loading="eager">':'')+'</article>';
 }).join('');
 const w=window.open('','_blank');
 if(!w){appToast('Allow pop-ups to export the PDF.');return;}
 const css='@page{size:auto;margin:0.55in}html,body{margin:0;background:#fff;color:#151515;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{padding:28px}.pdf-header{border-bottom:1px solid #ddd;padding-bottom:18px;margin-bottom:18px}.pdf-kicker{font-size:10px;letter-spacing:.18em;color:#777;font-weight:800}.pdf-header h1{font-size:28px;letter-spacing:-.04em;margin:7px 0 4px}.pdf-header p{margin:0;color:#666;font-size:12px}.pdf-entry{break-inside:avoid;border-bottom:1px solid #e6e6e6;padding:0 0 18px;margin:0 0 18px}.pdf-entry-date{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#777;margin-bottom:5px}.pdf-entry h2{font-size:21px;letter-spacing:-.03em;margin:0 0 5px}.pdf-entry p{font-size:11px;color:#666;line-height:1.45;margin:3px 0}.pdf-contact{word-break:break-word}.pdf-entry img{display:block;width:100%;max-height:280px;object-fit:cover;border-radius:12px;margin-top:11px}.pdf-footer{margin-top:26px;padding-top:12px;border-top:1px solid #ddd;color:#888;font-size:9px;text-align:center}@media print{body{padding:0}}';
 w.document.open();
 w.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dinliminate — '+scopeLabel+'</title><style>'+css+'</style></head><body><header class="pdf-header"><div class="pdf-kicker">DINLIMINATE</div><h1>Dinner Decisions Simplified</h1><p>'+scopeLabel+' · Exported '+dateLabel+'</p></header>'+rows+'<footer class="pdf-footer">Dinner Decisions Simplified · Dinliminate</footer></body></html>');
 w.document.close();
 const printWhenReady=()=>{
  const imgs=[...w.document.images];
  Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))).then(()=>setTimeout(()=>{try{w.focus();w.print();}catch{}},250));
 };
 if(w.document.readyState==='complete')printWhenReady(); else w.addEventListener('load',printWhenReady,{once:true});
}
function exportPdfView(){
 const history=readHistory();
 if(!history.length){appToast('No history to export yet.');return;}
 const body='<div class="export-pdf-copy"><div class="export-pdf-kicker">SAVE YOUR DECISIONS</div><h4>Export your history</h4><p>Choose what to include. A print-ready PDF opens next, where you can save or share it from your device.</p><div class="export-pdf-options">'+
 '<button class="settings-action export-choice" data-export-scope="all" type="button"><span class="settings-action-icon">✦</span><span class="settings-action-copy"><b>All History</b><small>'+history.length+' saved decision'+(history.length===1?'':'s')+'</small></span><span class="settings-action-chevron">›</span></button>'+
 '<button class="settings-action export-choice" data-export-scope="food" type="button"><span class="settings-action-icon">◈</span><span class="settings-action-copy"><b>Food</b><small>'+history.filter(x=>x?.type==='food').length+' saved decision'+(history.filter(x=>x?.type==='food').length===1?'':'s')+'</small></span><span class="settings-action-chevron">›</span></button>'+
 '<button class="settings-action export-choice" data-export-scope="restaurant" type="button"><span class="settings-action-icon">⌖</span><span class="settings-action-copy"><b>Restaurants</b><small>'+history.filter(x=>x?.type==='restaurant').length+' saved decision'+(history.filter(x=>x?.type==='restaurant').length===1?'':'s')+'</small></span><span class="settings-action-chevron">›</span></button></div></div>';
 const modal=openModal('exportPdfModal','Export PDF',body);
 modal.querySelectorAll('[data-export-scope]').forEach(btn=>btn.onclick=()=>{const scope=btn.dataset.exportScope;modal.remove();$('exportPdfModalBg')?.remove();exportHistoryPrint(scope);});
}
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', event => {
 event.preventDefault();
 deferredInstallPrompt = event;
});
async function copyAppUrl(url){
 try{
  if(navigator.clipboard && window.isSecureContext){
   await navigator.clipboard.writeText(url);
   return true;
  }
 }catch{}
 try{
  const helper=document.createElement('textarea');
  helper.value=url;
  helper.setAttribute('readonly','');
  helper.style.position='fixed';
  helper.style.opacity='0';
  helper.style.pointerEvents='none';
  document.body.appendChild(helper);
  helper.select();
  const copied=document.execCommand('copy');
  helper.remove();
  return copied;
 }catch{return false;}
}
async function addToPhoneFlow(){
 if(deferredInstallPrompt){
  try{
   await deferredInstallPrompt.prompt();
   await deferredInstallPrompt.userChoice;
   deferredInstallPrompt=null;
   return;
  }catch{}
 }
 openModal('addToPhoneModal','How to add to your phone','<div class="add-phone-fallback"><span class="share-app-kicker">IPHONE</span><h4>Keep Dinliminate close.</h4><div class="add-phone-steps"><div class="add-phone-step"><span>1</span><p>Tap the <b>Share</b> button in Safari.</p></div><div class="add-phone-step"><span>2</span><p>Choose <b>Add to Home Screen</b>.</p></div><div class="add-phone-step"><span>3</span><p>Tap <b>Add</b>. Dinliminate will sit on your Home Screen like an app.</p></div></div><p class="add-phone-footnote">On Android or supported browsers, this action may install Dinliminate directly.</p></div>');
}
async function shareApp(){
 const url=String(location.href||'').split('#')[0];
 const shareData={title:'Dinliminate — Dinner Decisions Simplified',text:'Try Dinliminate — swipe until it’s decided.',url};
 if(typeof navigator.share==='function'){
  try{await navigator.share(shareData);return;}catch(err){if(err?.name==='AbortError')return;}
 }
 if(await copyAppUrl(url)){appToast('App link copied.');return;}
 openModal('shareAppModal','Share app','<div class="share-app-fallback"><span class="share-app-kicker">SHARE APP</span><h4>Pass it along.</h4><p>Use your device share controls or copy this link.</p><input class="share-app-url" type="text" readonly value="'+esc(url)+'" onclick="this.select()"><button class="detail-web-action share-app-copy" id="shareAppCopy" type="button">Copy link</button></div>');
 const copy=$('shareAppCopy');
 if(copy)copy.onclick=async()=>{if(await copyAppUrl(url)){appToast('App link copied.');}else{const field=document.querySelector('.share-app-url');field?.focus();field?.select();appToast('Select the link to copy it.');}};
}

function shareWinner() {
if (!S.winnerItem)return;
const text='Tonight: '+S.winnerItem.name;
if(navigator.share){navigator.share({title:'Dinliminate',text}).catch(()=>{});}
else if(navigator.clipboard) navigator.clipboard.writeText(text).then(()=>appToast('Decision copied.')).catch(()=>{});
}
async function clearMealPhotoStorage(id){
  const target=String(id||'').trim();
  if(!target)return;
  try{
    const db=await openPhotoDB();
    await new Promise(resolve=>{
      const tx=db.transaction(PHOTO_STORE,'readwrite'),store=tx.objectStore(PHOTO_STORE),req=store.getAllKeys();
      req.onsuccess=()=>{for(const rawKey of req.result||[]){const key=String(rawKey);if(key===target||key.startsWith(target+':photo:'))store.delete(rawKey);}};
      req.onerror=()=>resolve();
      tx.oncomplete=resolve;tx.onerror=resolve;tx.onabort=resolve;
    });
  }catch{}
  for(const key of [...storedPhotoIds])if(key===target||String(key).startsWith(target+':photo:'))storedPhotoIds.delete(key);
}
async function clearAllDinliminateStorage(){
  try{stopFamilyLobbyPolling();}catch{}
  try{familySessionClear();}catch{}
  try{
    const keys=[];
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith('dinliminate.'))keys.push(key);}
    keys.forEach(key=>localStorage.removeItem(key));
  }catch{}
  try{restaurantWebsiteCache.clear();restaurantWebsiteInflight.clear();}catch{}
  try{
    restaurantPhotoCache.forEach(data=>{if(String(data?.url||'').startsWith('blob:')){try{URL.revokeObjectURL(data.url)}catch{}}});
    restaurantPhotoCache.clear();restaurantPhotoMissCache.clear();restaurantPhotoInflight.clear();restaurantPhotoStoragePromise=null;
  }catch{}
  try{storedPhotoIds.clear();}catch{}
  try{
    const db=await openPhotoDB();
    await new Promise(resolve=>{
      const tx=db.transaction(PHOTO_STORE,'readwrite');
      tx.objectStore(PHOTO_STORE).clear();
      tx.oncomplete=resolve;tx.onerror=resolve;tx.onabort=resolve;
    });
  }catch{}
  try{
    if('caches' in window){
      const names=await caches.keys();
      await Promise.all(names.filter(name=>name.startsWith('dinliminate')).map(name=>caches.delete(name)));
    }
  }catch{}
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg=>reg.unregister()));
    }
  }catch{}
}
function resetRound(){
  S.hungryWheelSpinToken++;S.hungryWheelSpinning=false;S.hungryWheelChoice=null;S.hungryWheelRotation=0;S.hungryWheelDisplayItems=null;S.hungryWheelLandedId=null;S.hungryWheelSpinPhase='idle';S.hungryWheelVelocity=0;S.hungryWheelFrame=null;
  S.winnerItem=null;S.winnerType='food';S.foodActions=[];S.restaurantActions=[];S.maybe.clear();S.foodMaybeRound=false;S.cutCats.clear();S.foodCuts.clear();S.restaurantCuts.clear();S.restaurantMaybeRound=false;
  S.pool=[];S.restaurantPool=[];S.restaurantSearchOrigin=null;S.index=0;S.restaurantIndex=0;S.restaurantQuery='';S.restaurantHours='all';S.restaurantHoursCollapsed=true;S.restaurantSearchKey='';S.restaurantSearchDegraded=false;S.saved=false;
  try{localStorage.removeItem(KEY);}catch{}
  home();
}
function resetRestoreView(){
  document.querySelector('#settingsModal')?.remove();document.querySelector('#settingsModalBg')?.remove();removeFoodOverlays();
  const body='<div class="reset-restore-view"><div class="reset-restore-hero"><span class="manage-kicker">RESET &amp; RESTORE</span><h4>Choose what to return.</h4><p>Restore the original built-in meals without changing your custom meals or restaurant data, or start completely fresh by clearing all Dinliminate data on this device.</p></div><div class="reset-restore-actions"><button class="reset-restore-option restore-action" id="restoreDefaultsOption" type="button"><span class="reset-restore-icon">↺</span><span><b>Restore Defaults</b><small>Return built-in meals to their original catalog state and recover deleted built-in meals. Custom meals, Custom Cuisine Cuts, History, notes, Restaurant choices, and location settings remain.</small></span><span>›</span></button><button class="reset-restore-option reset-action" id="fullResetOption" type="button"><span class="reset-restore-icon">×</span><span><b>Full Reset</b><small>Erase all Dinliminate data stored on this device, including meals, choices, history, notes, custom photos, restaurant caches, and Family Mode session data.</small></span><span>›</span></button></div></div>';
  const modal=openModal('resetRestoreModal','Reset & Restore',body);
  $('restoreDefaultsOption').onclick=async()=>{modal.remove();$('resetRestoreModalBg')?.remove();await systemRestoreFlow();};
  $('fullResetOption').onclick=async()=>{modal.remove();$('resetRestoreModalBg')?.remove();await resetAppDataFlow();};
}
async function resetAppDataFlow(){
  if(!await appConfirm('Reset all app data?','This permanently removes all Dinliminate data stored on this device, including custom meals, history, hidden choices, notes, saved state, custom photos, restaurant photo cache, Meal Times and Family Mode session data.','Reset Everything'))return;
  await clearAllDinliminateStorage();
  S.hungryWheelSpinToken++;
  S.hungryWheelSpinning=false;S.hungryWheelChoice=null;S.hungryWheelRotation=0;S.hungryWheelDisplayItems=null;S.hungryWheelLandedId=null;S.hungryWheelSpinPhase='idle';S.hungryWheelVelocity=0;S.hungryWheelFrame=null;
  S.hungryRestaurantChoice=null;S.hungryRestaurantPendingChoice=null;
  S.hidden.clear();S.deleted.clear();S.deletedCustomMeals=[];S.customQuickCuts=[];S.hiddenRestaurants={};S.cutCats.clear();S.foodCuts.clear();S.maybe.clear();S.foodMaybeRound=false;S.restaurantCuts.clear();S.restaurantMaybeRound=false;
  S.mealTimeSettings={custom:[],names:{},order:DEFAULT_MEAL_TIME_DEFS.map(x=>x.id),disabled:new Set()};S.mealTimeFilters=new Set(mealTimeNames());
  S.pool=[];S.restaurantPool=[];S.index=0;S.restaurantIndex=0;S.foodActions=[];S.restaurantActions=[];S.winnerItem=null;S.winnerType='food';S.location=null;S.locationSource='none';S.locationFreshAt=null;S.restaurantSearchOrigin=null;S.restaurantSearchKey='';S.restaurantQuery='';S.restaurantHours='all';S.restaurantHoursCollapsed=true;S.restaurantSearchDegraded=false;S.storageWarning=false;S.saved=false;S.custom=[];S.notes={};
  S.familyNormalMode='idle';S.familyDecisionType='';S.familyNormalRoundId='';S.familyNormalStage=0;S.familyNormalAutoResume=false;S.familyNormalVoteBusy=false;S.familyActiveData=null;S.familyVotedIds=new Set();S.familyBrowseHistory=[];S.familyCompareBothMode='';S.familyCompareBothGroupId='';S.familyCompareBothMealWinner=null;S.familyVoteBusy=false;S.familyPollBusy=false;S.familyPollTimer=0;
  try{location.hash='';}catch{}
  window.location.reload();
}
async function systemRestoreFlow(){
  if(!await appConfirm('Restore built-in defaults?','This returns every built-in meal to its original catalog data, including its name, nutrition, ingredients, recipe data, photos, meal times, hidden/deleted state, and current meal-choice cuts. Custom meals, Custom Cuisine Cuts, History, user notes, Restaurant choices, location settings, and Family Mode remain on this device.','Restore Defaults'))return;
  const defaultIds=new Set(getDefaultFoods().map(x=>String(x.id)));
  for(const id of defaultIds) await clearMealPhotoStorage(id);
  S.custom=S.custom.filter(x=>!defaultIds.has(String(x.id)));
  S.deleted=new Set([...S.deleted].filter(id=>!defaultIds.has(String(id))));
  S.hidden=new Set([...S.hidden].filter(id=>!defaultIds.has(String(id))));
  S.foodCuts=new Set([...S.foodCuts].filter(id=>!defaultIds.has(String(id))));
  S.maybe=new Set([...S.maybe].filter(id=>!defaultIds.has(String(id))));
  S.foodActions=(Array.isArray(S.foodActions)?S.foodActions:[]).filter(a=>!defaultIds.has(String(a?.id||'')));
  S.foodMaybeRound=false;
  S.pool=[];S.index=0;S.winnerItem=null;S.winnerType='food';
  buildFood();foodQuick();save();
  document.querySelector('#settingsModal')?.remove();document.querySelector('#settingsModalBg')?.remove();document.querySelector('#resetRestoreModal')?.remove();document.querySelector('#resetRestoreModalBg')?.remove();document.querySelector('#drawer')?.classList.add('hidden');document.querySelector('#drawerBg')?.classList.add('hidden');
  home();appToast('Built-in meals restored.');
}
const homeActionHandler = (event) => {
 const button = event.target.closest?.('[data-home-action]');
 if(!button || button.disabled || !document.body.contains(button)) return;
 event.preventDefault();
 event.stopPropagation();
 const action = button.dataset.homeAction;
 if(action==='add') addToPhoneFlow();
 else if(action==='share') shareApp();
 else if(action==='tutorial'){
   if(tutorialModeEnabled()&&tutorialState.active){
    const step=tutorialState.steps[tutorialState.index];
    if(step?.target==='#tutorialModeToggle'){
     event.preventDefault();
     event.stopImmediatePropagation();
     tutorialAdvanceFromTarget(event,step);
    }
    return;
   }
   startTutorialFromHome();
 }
};
document.addEventListener('click', homeActionHandler, true);
function bindHomeCardPress(id){
 const el=$(id);if(!el)return;
 let timer=0;
 const down=()=>{clearTimeout(timer);el.classList.add('is-pressed');};
 const up=()=>{clearTimeout(timer);timer=window.setTimeout(()=>el.classList.remove('is-pressed'),140);};
 el.addEventListener('pointerdown',down,{passive:true});
 el.addEventListener('pointerup',up,{passive:true});
 el.addEventListener('pointercancel',up,{passive:true});
 el.addEventListener('pointerleave',up,{passive:true});
}

$('foodStart').onclick = startFood;
$('restStart').onclick = openRestaurant;
bindCardButton('foodCut',()=>foodCut());
bindCardButton('foodMaybe',()=>foodMaybe());
bindCardButton('foodBack',foodBack);
document.querySelectorAll('[data-home]').forEach(btn => btn.onclick = home);
bindHomeCardPress('foodStart');bindHomeCardPress('restStart');
let drawerCloseTimer=0;
// CP1071: remove the temporary Menu tooltip; the hamburger icon is self-explanatory.
const showMenuHint=()=>{};
const closeDrawer=(immediate=false)=>{
  clearTimeout(drawerCloseTimer);const drawer=$('drawer'),bg=$('drawerBg');
  drawer?.classList.remove('is-open');bg?.classList.remove('is-open');document.querySelector('#menuHint')?.remove();
  ['#menu','#foodMenu','#restaurantMenu','#winnerMenu','#familyMenu'].forEach(sel=>document.querySelector(sel)?.setAttribute('aria-expanded','false'));
  if(immediate){drawer?.classList.add('hidden');bg?.classList.add('hidden');return;}
  drawerCloseTimer=setTimeout(()=>{drawer?.classList.add('hidden');bg?.classList.add('hidden');},180);
};
const openDrawer=(event)=>{
  clearTimeout(drawerCloseTimer);const drawer=$('drawer'),bg=$('drawerBg');
  drawer?.classList.remove('hidden');bg?.classList.remove('hidden');
  requestAnimationFrame(()=>{drawer?.classList.add('is-open');bg?.classList.add('is-open');});
  ['#menu','#foodMenu','#restaurantMenu','#winnerMenu','#familyMenu'].forEach(sel=>document.querySelector(sel)?.setAttribute('aria-expanded','true'));
};
function decisionBackHome(){
 S.familyNormalMode='idle';
 S.familyNormalAutoResume=false;
 S.familyDecisionType='';
 S.familyNormalRoundId='';
 S.familyNormalStage=0;
 S.familyVotedIds=new Set();
 S.familyBrowseHistory=[];
 S.familyVoteBusy=false;
 stopFamilyLobbyPolling();
 home();
}
const foodBackTop = $('foodBackTop'); if (foodBackTop) foodBackTop.onclick = decisionBackHome;
const restaurantBackTop = $('restaurantBackTop'); if (restaurantBackTop) restaurantBackTop.onclick = decisionBackHome;
$('drawerClose').onclick = closeDrawer;
$('drawerBg').onclick = closeDrawer;
const navigateFromDrawer=(navigate)=>{
  closeDrawer(true);
  try{navigate?.();}catch{}
};
$('menu')?.addEventListener('click',openDrawer);
$('foodMenu')?.addEventListener('click',openDrawer);
$('restaurantMenu')?.addEventListener('click',openDrawer);
$('winnerMenu')?.addEventListener('click',openDrawer);
$('familyMenu')?.addEventListener('click',openDrawer);
$('manage').onclick = () => navigateFromDrawer(manageFoodsView);
$('settings').onclick = () => navigateFromDrawer(settingsView);
$('backToStart').onclick = () => navigateFromDrawer(home);
$('history').onclick = () => navigateFromDrawer(historyView);

async function locationPermissionState(){
  try{
    const permission = await navigator.permissions?.query?.({name:'geolocation'});
    return permission?.state || 'unknown';
  }catch{
    return 'unknown';
  }
}
function closeLocationPermissionSheet(){
  const modal=$('locationPermissionModal'),bg=$('locationPermissionBg');
  modal?.classList.add('hidden');
  bg?.classList.add('hidden');
  modal?.setAttribute('aria-hidden','true');
}
function openLocationPermissionSheet(state='prompt'){
  const modal=$('locationPermissionModal'),bg=$('locationPermissionBg'),title=$('locationPermissionTitle'),copy=$('locationPermissionText'),allow=$('locationPermissionAllow');
  if(!modal||!bg)return;
  if(state==='denied'){
    if(title)title.textContent='Location access is off';
    if(copy)copy.textContent='Turn on Location for this site in your browser settings, then come back and tap Use My Location again.';
    if(allow)allow.textContent='Try Again';
  }else{
    if(title)title.textContent='Know your location';
    if(copy)copy.textContent='Use your location to find restaurants around you. Dinliminate uses it only to set your search area.';
    if(allow)allow.textContent='Allow Location';
  }
  modal.classList.remove('hidden');
  bg.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  requestAnimationFrame(()=>allow?.focus());
}
async function requestLocationFromPrompt(){
  const state=await locationPermissionState();
  if(state==='granted'){
    useLocation();
    return;
  }
  if(state==='denied'){
    openLocationPermissionSheet('denied');
    return;
  }
  openLocationPermissionSheet('prompt');
}
$('locate').onclick = () => {
  requestLocationFromPrompt();
};
$('locationPermissionCancel')?.addEventListener('click',closeLocationPermissionSheet);
$('locationPermissionBg')?.addEventListener('click',closeLocationPermissionSheet);
$('locationPermissionAllow')?.addEventListener('click',async()=>{
  closeLocationPermissionSheet();
  await new Promise(resolve=>requestAnimationFrame(resolve));
  useLocation();
});
$('find').onclick = () => {
  searchRestaurants();
};
$('radius').addEventListener('change', event => {
 const selectedRadius=Math.min(100,Math.max(1,Number(event?.currentTarget?.value)||10));
 const hasLocation=!!S.location || !!$('address')?.value.trim();
 if(!hasLocation){$('status').textContent='Enter an address or use your location.';renderFindButton();return;}
 searchRestaurants({radius:selectedRadius});
});
$('address').addEventListener('input', () => {
  if(locationRequestActive){
    locationRequestSeq++;
    locationRequestActive=false;
    setLocationBusy(false);
  }
  S.location=null;
  S.locationSource='typed';
  S.restaurantSearchOrigin=null;
  renderLocationSource();
  suggestAddresses();
});
$('address').addEventListener('focus', () => {
  const input=$('address');
  if(!input)return;
  if(locationRequestActive){
    locationRequestSeq++;
    locationRequestActive=false;
    setLocationBusy(false);
  }
  const current=input.value.trim();
  if(current){
    invalidateAddressSuggestions();
    S.location=null;
    S.locationSource='typed';
    S.restaurantSearchOrigin=null;
    input.value='';
    renderLocationSource();
    $('status').textContent='Enter an address to search.';
  }else if(input.value.trim().length>=2){
    suggestAddresses();
  }
});
$('address').addEventListener('keydown', e => {
if(e.key==='ArrowDown'){ if(moveSuggestion(1)){e.preventDefault();return;} }
if(e.key==='ArrowUp'){ if(moveSuggestion(-1)){e.preventDefault();return;} }
if(e.key==='Enter'){
  const opts=[...document.querySelectorAll('#suggestionsBox [data-suggestion]')];
  if(suggestionIndex>=0&&opts[suggestionIndex]){
    e.preventDefault();
    chooseAddressSuggestion(suggestionIndex);
    return;
  }
  if(opts.length&&!addressLooksComplete($('address').value)){
    e.preventDefault();
    chooseAddressSuggestion(0);
    return;
  }
  e.preventDefault();
  invalidateAddressSuggestions();
  searchRestaurants();
}
if(e.key==='Escape'){ e.preventDefault(); invalidateAddressSuggestions(); }
});
bindRestaurantTools();
$('winnerBackTop')?.addEventListener('click', () => S.familyNormalMode==='winner' ? familyDismissWinner() : home());
$('hungryWheelSpin').onclick = (event) => {
 event?.preventDefault?.();
 event?.stopPropagation?.();
 spinHungryWheel();
};

$('hungryWheelChoose').onclick = () => {
  const choice=S.hungryWheelChoice;
  if(!choice || S.hungryWheelSpinning)return;
  winner(choice,'food');
};
$('hungryMysteryReveal').onclick = revealHungryRestaurant;
$('hungryMysteryAgain').onclick = tryAnotherHungryRestaurant;
$('hungryMysteryChoose').onclick = () => {
  const choice=S.hungryRestaurantChoice;
  if(!choice)return;
  S.hungryRestaurantChoice=null;
  winner(choice,'restaurant');
};
$('details').onclick = () => S.winnerItem && detailsSheet(S.winnerItem, S.winnerType || 'food');
$('share').onclick = shareWinner;
$('restart').onclick = handleWinnerRestart;
const updateOffline = () => $('offlineIndicator')?.classList.toggle('hidden', navigator.onLine !== false);
window.addEventListener('online', updateOffline);
window.addEventListener('offline', updateOffline);
window.addEventListener('online',()=>{if(S.screen==='restaurant')maybeAutoRefreshRestaurantLocation();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.screen==='restaurant')maybeAutoRefreshRestaurantLocation();});
updateOffline();
if ('serviceWorker' in navigator) window.addEventListener('load', async () => {
  try {
    // APP_BUILD has the current release as its synchronous fallback so the
    // first page load cannot register an older service-worker query string.
    const build = encodeURIComponent(String(APP_BUILD || '1054'));
    const desiredSuffix = `?v=${build}`;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => {
      const script = String(reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '');
      return script && !script.endsWith(desiredSuffix) ? reg.unregister() : Promise.resolve(false);
    }));
    const reg = await navigator.serviceWorker.register(`./sw.js${desiredSuffix}`, { updateViaCache: 'none' });
    await reg.update().catch(() => {});
  } catch {}
});
if(new URLSearchParams(location.search).get('qa')==='1') window.__DINLIMINATE_TEST__={safeExternalUrl,restaurantWebsiteUrl,knownRestaurantWebsite,restaurantPhoneSearchUrl,phoneHref,restaurantCategory,restaurantCuisineTags,restaurantCuisineEvidence,restaurantQuickMatches,restaurantMatchesQuery,normalizeRestaurantSearch,restaurantSearchTermMatches,dedupeRestaurantPool,restaurantNameSimilarityUI,restaurantNameCoreMatchUI,restaurantAddressSimilarityUI,restaurantFallbackImage,loadRestaurantPhoto,addressLooksComplete,locationMovedMiles,winner,recordHistory,hungryWheelPool,renderHungryWheel,spinHungryWheel,hungryRestaurantPool,hungryRestaurantPick,renderHungryRestaurantMystery,revealHungryRestaurant};
bindMealPhotoCountControls();
load();
renderLocationSource();
renderFindButton();
updateStorageIndicator();
hydrateCustomPhotos().then(()=>migrateCustomPhotos()).catch(()=>{});
// CP1138 — reveal only after the correct persisted screen has been painted.
requestAnimationFrame(()=>document.documentElement.classList.remove('dinliminate-booting'));
if (S.saved && S.screen === 'food' && S.pool.length) {
show('food'); foodQuick(); drawFood();
} else if (S.saved && S.screen === 'restaurant' && S.restaurantPool.length) {
show('restaurant'); restaurantQuick(); drawRestaurants();
} else {
home();
}
if (new URLSearchParams(location.search).get('qa') === '1') {
window.__DINLIMINATE_QA__ = {
snapshot: () => ({
screen:S.screen,
foodCatalog:allFoods().length,
foodPool:foodPool().map(x=>x.id),
restaurantPool:restaurantPoolFiltered().map(x=>x.id),
custom:S.custom.map(x=>({...x})),
allRestaurantIds:(S.restaurantPool||[]).map(x=>x.id),
foodActions:S.foodActions.map(x=>({...x})),
restaurantActions:S.restaurantActions.map(x=>({...x})),
hiddenFoods:[...S.hidden],
hiddenRestaurants:{...S.hiddenRestaurants},
cutCats:[...S.cutCats],
maybe:[...S.maybe],
mealTimeFilters:[...S.mealTimeFilters],
restaurantHours:String(S.restaurantHours||'all'),
mealTimeAllSelected:mealTimeOptions().filter(x=>x.enabled).every(item=>S.mealTimeFilters?.has(item.name)),
foodMaybeRound:!!S.foodMaybeRound,
restaurantMaybeRound:!!S.restaurantMaybeRound,
restaurantCuts:[...S.restaurantCuts],
winner:S.winnerItem ? {...S.winnerItem} : null,
winnerType:S.winnerType,
location:S.location ? {...S.location} : null,
locationSource:S.locationSource,
restaurantSearchOrigin:S.restaurantSearchOrigin ? {...S.restaurantSearchOrigin} : null
})
};
}
/* CP851 — Family Mode reuses the existing Meal / Restaurant screens. */
const FAMILY_SESSION_KEY='dinliminate.family.v1';

function familySessionRead(){try{const d=JSON.parse(localStorage.getItem(FAMILY_SESSION_KEY)||'null');return d&&typeof d.token==='string'&&d.token?d:null;}catch{return null;}}
function familySessionWrite(value){try{localStorage.setItem(FAMILY_SESSION_KEY,JSON.stringify(value));}catch{}}
function familySessionClear(){try{localStorage.removeItem(FAMILY_SESSION_KEY);}catch{}}
function familySetStatus(id,message,kind=''){const el=$(id);if(!el)return;el.textContent=message||'';el.dataset.state=kind;}
async function familyApi(action,payload={}){const response=await fetch('./api/family',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action,...payload})});let data=null;try{data=await response.json();}catch{}if(!response.ok||!data?.ok){const e=new Error(data?.message||'Family Mode could not complete that request.');e.code=data?.code||'FAMILY_REQUEST_FAILED';e.status=response.status;throw e;}return data;}

function familyShowEntry(){$('familyEntry')?.classList.remove('hidden');$('familyCreateForm')?.classList.add('hidden');$('familyJoinForm')?.classList.add('hidden');$('familyLobby')?.classList.add('hidden');['familySetup','familySwipe','familyWinner'].forEach(id=>$(id)?.classList.add('hidden'));}
function familyShowCreate(){$('familyEntry')?.classList.add('hidden');$('familyCreateForm')?.classList.remove('hidden');$('familyJoinForm')?.classList.add('hidden');$('familyLobby')?.classList.add('hidden');setTimeout(()=>$('familyCreateName')?.focus(),40);}
function familyShowJoin(){$('familyEntry')?.classList.add('hidden');$('familyCreateForm')?.classList.add('hidden');$('familyJoinForm')?.classList.remove('hidden');$('familyLobby')?.classList.add('hidden');setTimeout(()=>$('familyJoinCode')?.focus(),40);}
function familyDisplayMemberList(members,me){const box=$('familyMemberList');if(!box)return;box.innerHTML='';(Array.isArray(members)?members:[]).forEach(m=>{const row=document.createElement('div');row.className='family-member-row'+(m.role==='host'?' is-host':'');row.innerHTML='<span class="family-member-avatar"></span><span class="family-member-copy"><b></b><small></small></span><span class="family-member-status"></span>';row.querySelector('.family-member-avatar').textContent=(String(m.name||'?').trim().slice(0,1)||'?').toUpperCase();row.querySelector('.family-member-copy b').textContent=String(m.name||'Family member');row.querySelector('.family-member-copy small').textContent=m.role==='host'?'Host':'Member';row.querySelector('.family-member-status').textContent=me&&m.id===me.id?'You':(m.active===false?'Away':'Here');box.appendChild(row);});}

function familyEnsureNormalBar(type){
 const root=$(type==='meal'?'food':'restaurant');if(!root)return null;const id=type==='meal'?'foodFamilyNormalBar':'restaurantFamilyNormalBar';let bar=$(id);if(bar)return bar;
 bar=document.createElement('div');bar.id=id;bar.className='family-normal-bar';bar.style.cssText='margin:3px 8px 8px;padding:10px 11px;border:1px solid rgba(198,164,106,.24);border-radius:16px;background:linear-gradient(145deg,rgba(198,164,106,.09),rgba(255,255,255,.025));display:flex;align-items:center;justify-content:space-between;gap:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 12px 28px rgba(0,0,0,.14);';
 const ids=type==='meal'?{k:'foodFamilyNormalKicker',t:'foodFamilyNormalTitle',s:'foodFamilyNormalStatus',time:'foodFamilyNormalTime',btn:'foodFamilyNormalStart',end:'foodFamilyNormalEnd'}:{k:'restaurantFamilyNormalKicker',t:'restaurantFamilyNormalTitle',s:'restaurantFamilyNormalStatus',time:'restaurantFamilyNormalTime',btn:'restaurantFamilyNormalStart',end:'restaurantFamilyNormalEnd'};
 bar.innerHTML='<div style="display:grid;gap:2px;min-width:0"><span id="'+ids.k+'" style="font-size:8px;letter-spacing:.15em;color:#c6a46a;font-weight:850">DINNER TOGETHER</span><b id="'+ids.t+'" style="font-size:13px;line-height:1.1">Prepare dinner together.</b><small id="'+ids.s+'" style="font-size:9px;line-height:1.35;color:#777;max-width:330px">Use the normal '+(type==='meal'?'Meal':'Restaurant')+' screen, then start the shared dinner.</small></div><div style="display:flex;align-items:center;justify-content:flex-end;gap:7px;flex:0 0 auto"><label id="'+ids.time+'Wrap" style="display:grid;gap:3px;color:#8a847c;font-size:7px;letter-spacing:.12em;font-weight:850">DINNER BY<input id="'+ids.time+'" type="time" aria-label="Dinner by time" style="height:34px;min-width:92px;border:1px solid #3a342b;border-radius:10px;background:#151413;color:#eee;padding:0 7px;font-size:10px;font-weight:800"></label><button id="'+ids.btn+'" type="button" style="min-height:36px;padding:0 11px;border:1px solid #9b8050;border-radius:11px;background:#c6a46a;color:#111;font-size:9px;font-weight:900;white-space:nowrap">Start Family Dinner</button><button id="'+ids.end+'" type="button" class="family-end-button hidden" aria-label="End Family Dinner">END DINNER</button></div>';
 const anchor=type==='meal'?root.querySelector('.quick-section'):root.querySelector('.location-strip');root.insertBefore(bar,anchor||root.firstChild);const startButton=$(ids.btn),endButton=$(ids.end);
 if(startButton&&startButton.dataset.familyBound!=='1'){startButton.dataset.familyBound='1';startButton.addEventListener('click',()=>familyStartRoundFromNormal(type));}
 if(endButton&&endButton.dataset.familyBound!=='1'){endButton.dataset.familyBound='1';endButton.addEventListener('click',familyEndDinner);}
 return bar;
}
function familyNormalBar(type,mode='idle',data=null){
 const ids=type==='meal'?{k:'foodFamilyNormalKicker',t:'foodFamilyNormalTitle',s:'foodFamilyNormalStatus',time:'foodFamilyNormalTime',btn:'foodFamilyNormalStart',end:'foodFamilyNormalEnd'}:{k:'restaurantFamilyNormalKicker',t:'restaurantFamilyNormalTitle',s:'restaurantFamilyNormalStatus',time:'restaurantFamilyNormalTime',btn:'restaurantFamilyNormalStart',end:'restaurantFamilyNormalEnd'};
 const bar=familyEnsureNormalBar(type);if(!bar)return;const el=id=>$(id),start=el(ids.btn),end=el(ids.end),wrap=$(ids.time+'Wrap'),host=familySessionRead()?.member?.role==='host';bar.classList.toggle('hidden',mode==='idle');
 if(mode==='setup'){el(ids.k).textContent='DINNER TOGETHER · HOST SETUP';el(ids.t).textContent=type==='meal'?'Prepare the meal choices.':'Prepare the restaurant choices.';el(ids.s).textContent='Use the normal '+(type==='meal'?'Meal':'Restaurant')+' screen. When everyone is ready, start the shared dinner.';wrap?.classList.remove('hidden');start?.classList.toggle('hidden',!host);end?.classList.add('hidden');if(start)start.disabled=!host||((type==='meal'?S.pool.length:restaurantPoolFiltered().length)===0);return;}
 if(mode==='decision'&&data?.activeRound){const stage=Number(data.activeRound.currentStage)||1,copy=familyRoundCopy(stage),members=Array.isArray(data.roundMembers)?data.roundMembers.filter(x=>x.included):[],mine=familySessionRead()?.member?.id,meRow=members.find(x=>x.memberId===mine),key=stage===1?'submittedStage1':stage===2?'submittedStage2':'submittedTiebreak',submitted=members.filter(x=>!!x[key]).length,mineSubmitted=stage===1?!!meRow?.submittedStage1:stage===2?!!meRow?.submittedStage2:!!meRow?.submittedTiebreak;el(ids.k).textContent='DINNER TOGETHER · '+copy.title;el(ids.t).textContent=copy.instruction;el(ids.s).textContent=mineSubmitted?'✓ ENTERED · Waiting for the Family…':submitted+' of '+members.length+' entered'+(stage===1?' · Enter anytime':'');wrap?.classList.add('hidden');start?.classList.add('hidden');end?.classList.toggle('hidden',!host);familySetDecisionAction(type,stage,mineSubmitted);return;}
 if(mode==='winner'){el(ids.k).textContent='DINNER TOGETHER · DECIDED';el(ids.t).textContent='Dinner is decided.';el(ids.s).textContent='Everyone agreed on tonight’s dinner.';wrap?.classList.add('hidden');start?.classList.add('hidden');end?.classList.add('hidden');}
}
function familyDefaultDinnerTime(){const d=new Date(Date.now()+30*60*1000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function familyDinnerTargetIso(value){const p=String(value||'').split(':').map(Number);if(p.length!==2||!Number.isFinite(p[0])||!Number.isFinite(p[1]))return null;const d=new Date();d.setHours(p[0],p[1],0,0);if(d.getTime()<=Date.now()+120000)d.setDate(d.getDate()+1);return d.toISOString();}

function familyChooseNormalType(type){
 const s=familySessionRead();if(!s?.member||s.member.role!=='host')return;if(s.family?.activeRoundId)return;
 const compare=type==='both',actual=compare?'meal':type;
 if(compare){S.familyCompareBothMode='meal';S.familyCompareBothGroupId=globalThis.crypto?.randomUUID?.()||('family-both-'+Date.now());S.familyCompareBothMealWinner=null;}
 S.familyNormalMode='setup';S.familyDecisionType=actual;S.familyNormalRoundId='';S.familyNormalStage=0;S.familyNormalAutoResume=true;S.familyVotedIds=new Set();S.familyBrowseHistory=[];familyEnsureNormalBar(actual);
 if(actual==='meal')startFood();else openRestaurant();familyNormalBar(actual,'setup',S.familyActiveData);
 const t=$(actual==='meal'?'foodFamilyNormalTime':'restaurantFamilyNormalTime');if(t&&!t.value)t.value=familyDefaultDinnerTime();
}
function familyBuildNormalSnapshot(type){
 const raw=type==='meal'?S.pool.slice():restaurantPoolFiltered().slice();
 return{pool:raw.map(x=>({id:String(x.id||''),name:String(x.name||''),category:String(x.category||x.cuisine||''),cuisine:String(x.cuisine||''),image:String(x.image||x.photo||''),address:String(x.address||''),website:String(x.website||''),phone:String(x.phone||''),distance:Number.isFinite(Number(x.distance))?Number(x.distance):null})).filter(x=>x.id&&x.name),hostExcluded:[],location:S.location?{lat:Number(S.location.lat),lon:Number(S.location.lon)}:null,radius:Number($('radius')?.value||10),searchTerm:String(S.restaurantQuery||''),openState:String(S.restaurantHours||'all'),quickCuts:type==='restaurant'?[...S.restaurantCuts]:[],mealTimes:type==='meal'?[...S.mealTimeFilters]:[],compareBoth:S.familyCompareBothMode?{mode:'compare_both',track:S.familyCompareBothMode,groupId:S.familyCompareBothGroupId,mealWinner:S.familyCompareBothMealWinner||null}:null};
}
async function familyStartRoundFromNormal(type){
 const s=familySessionRead();if(!s?.token||s.member?.role!=='host')return;const status=type==='meal'?'foodFamilyNormalStatus':'restaurantFamilyNormalStatus',btn=type==='meal'?'foodFamilyNormalStart':'restaurantFamilyNormalStart',time=type==='meal'?'foodFamilyNormalTime':'restaurantFamilyNormalTime';
 const existing=S.familyActiveData?.activeRound||null;if(s.family?.activeRoundId){if(existing&&['swiping','final_swiping','tiebreak'].includes(existing.status)){familyBeginNormalDecision(S.familyActiveData);return;}if(existing&&existing.status==='complete'){existing.snapshot?.outcome==='no_winner'?familyShowNoWinner(existing):familyShowWinner(existing);return;}}
 const snapshot=familyBuildNormalSnapshot(type);if(!snapshot.pool.length){familySetStatus(status,type==='meal'?'There are no Meal choices left after your filters.':'Load at least one restaurant before starting the Family dinner.','error');return;}const target=familyDinnerTargetIso($(time)?.value);if(!target){familySetStatus(status,'Choose a dinner time.','error');return;}
 const b=$(btn);if(b){b.disabled=true;b.textContent='Starting…';}
 try{familySetStatus(status,'Locking your normal '+(type==='meal'?'Meal':'Restaurant')+' choices for everyone…','busy');let roundId=String(s.family?.activeRoundId||'');if(!roundId){const created=await familyApi('create-round',{token:s.token,decisionType:type,snapshot,dinnerTargetAt:target});roundId=String(created.id);familySessionWrite({...s,family:{...(s.family||{}),activeRoundId:roundId}});}await familyApi('start-round',{token:s.token});S.familyNormalMode='decision';S.familyNormalRoundId=roundId;S.familyNormalAutoResume=true;S.familyNormalStage=1;await familyRefreshState();}
 catch(err){if(err.code==='ROUND_ALREADY_STARTED'){const fresh=await familyRefreshState();if(fresh?.activeRound){familyBeginNormalDecision(fresh);return;}}familySetStatus(status,err.message||'Could not start the Family dinner.','error');}
 finally{if(b){b.disabled=false;b.textContent='Start Family Dinner';}}
}
function familyBeginNormalDecision(data){
 const round=data?.activeRound;if(!round)return;const type=round.decisionType==='restaurant'?'restaurant':'meal',stage=Number(round.currentStage)||1,stageData=familyNormalStagePool(round,data),same=S.familyNormalMode==='decision'&&S.familyNormalRoundId===String(round.id)&&S.familyDecisionType===type&&S.familyNormalStage===stage&&S.screen===(type==='meal'?'food':'restaurant');
 S.familyActiveData=data;S.familyDecisionType=type;S.familyNormalMode='decision';S.familyNormalRoundId=String(round.id);S.familyNormalStage=stage;S.familyNormalAutoResume=true;if(same){familyNormalBar(type,'decision',data);return;}
 S.winnerItem=null;S.winnerType=type==='restaurant'?'restaurant':'food';
 if(type==='meal'){S.foodActions=[];S.maybe.clear();S.foodMaybeRound=false;S.foodCuts.clear();S.cutCats.clear();S.maybeDeck=false;S.pool=stageData.remaining.map(x=>({...x}));S.index=0;show('food');foodQuick();drawFood();familyNormalBar('meal','decision',data);}else{S.restaurantActions=[];S.restaurantMaybeRound=false;S.restaurantCuts.clear();S.maybeDeck=false;S.restaurantQuery='';S.restaurantHours='all';S.restaurantHoursCollapsed=true;S.restaurantSearchKey='';S.restaurantSearchDegraded=false;S.restaurantPool=stageData.remaining.map(x=>({...x,_cut:false,_maybe:false}));S.restaurantIndex=0;show('restaurant');restaurantQuick();drawRestaurants();familyNormalBar('restaurant','decision',data);}
 familyStageAlert(type,stage);familySwipeInstruction(type,stage);
}
function familyNormalStagePool(round,data){
 const snapshot=round?.snapshot||{},all=Array.isArray(snapshot.pool)?snapshot.pool:[],stage=Number(round.currentStage)||1;let source=all;
 if(stage===2&&Array.isArray(snapshot.finalists)){const ids=new Set(snapshot.finalists.map(String));source=all.filter(x=>ids.has(String(x.id)));}
 if(stage===3&&Array.isArray(snapshot.tiebreakItems)){const ids=new Set(snapshot.tiebreakItems.map(String));source=all.filter(x=>ids.has(String(x.id)));}
 const voteStage=stage===1?'initial':stage===2?'finalist':'tiebreak',voted=new Set((data?.myVotes||[]).filter(v=>v.stage===voteStage).map(v=>String(v.itemId)));
 return{source,voted,voteStage,remaining:source.filter(x=>x&&!voted.has(String(x.id)))};
}
function familyIsBrowseStage(type){return S.familyNormalMode==='decision'&&S.familyDecisionType===type&&familyRoundStage()>1;}
function familyBrowseSource(type){return familyNormalStagePool(S.familyActiveData?.activeRound||null,S.familyActiveData||{}).source.filter(Boolean);}
function familyBrowseSubmitted(){const stage=familyRoundStage(),rows=Array.isArray(S.familyActiveData?.roundMembers)?S.familyActiveData.roundMembers:[],me=familySessionRead()?.member?.id,row=rows.find(x=>x.memberId===me);return stage===2?!!row?.submittedStage2:!!row?.submittedTiebreak;}
function familyBrowseRender(type,index){const source=familyBrowseSource(type);if(!source.length)return;const next=((Number(index)%source.length)+source.length)%source.length;if(type==='meal'){S.pool=source.map(x=>({...x}));S.index=next;drawFood();}else{S.restaurantPool=source.map(x=>({...x,_cut:false,_maybe:false}));S.restaurantIndex=next;drawRestaurants();}}
function familyBrowseNext(type){if(!familyIsBrowseStage(type)||familyBrowseSubmitted())return;const source=familyBrowseSource(type);if(!source.length)return;const current=type==='meal'?S.index:S.restaurantIndex;S.familyBrowseHistory.push({type,index:current});familyBrowseRender(type,current+1);}
function familyBrowsePrevious(type){if(!familyIsBrowseStage(type)||familyBrowseSubmitted())return;const source=familyBrowseSource(type);if(!source.length)return;const current=type==='meal'?S.index:S.restaurantIndex;S.familyBrowseHistory.push({type,index:current});familyBrowseRender(type,current-1);}
function familyBrowseBack(type){if(!familyIsBrowseStage(type)||familyBrowseSubmitted())return;for(let i=S.familyBrowseHistory.length-1;i>=0;i--){const e=S.familyBrowseHistory[i];if(e?.type!==type)continue;S.familyBrowseHistory.splice(i,1);familyBrowseRender(type,e.index);return;}const source=familyBrowseSource(type);if(!source.length)return;const current=type==='meal'?S.index:S.restaurantIndex;familyBrowseRender(type,current-1);}
function familyRoundStage(){return Number(S.familyActiveData?.activeRound?.currentStage)||1;}
function familyRoundCopy(stage){
 if(stage===1)return{title:'PICK MAYBES',instruction:"Don't be picky. Add anything you'd be happy eating.",action:'ENTER MAYBES',aria:'Enter Maybes'};
 if(stage===2)return{title:'PICK A FINALIST',instruction:'Swipe normally to browse. Pick the one you want most.',action:'ENTER CHOICE',aria:'Enter Choice'};
 return{title:'TIEBREAKER',instruction:'Swipe normally to browse. Pick one of the tied choices.',action:'ENTER CHOICE',aria:'Enter Choice'};
}
function familySetDecisionAction(type,stage,submitted){
 const btn=$(type==='meal'?'foodChoose':'restChoose'),copy=familyRoundCopy(stage);if(!btn)return;
 const label=submitted?'ENTERED':(stage===1?'ENTER MAYBES':'ENTER');
 btn.setAttribute('aria-label',label);btn.title=label;btn.dataset.familyAction=copy.action;btn.dataset.familyActionLabel=label;btn.disabled=!!submitted||S.familyNormalVoteBusy;
}function familyStageAlert(type,stage){
 // CP1082: Family Mode stays inside the normal decision screen. The persistent
 // Family bar and round instruction provide the stage cue without blocking it.
 document.getElementById('familyStageAlert')?.remove();
}
function familySwipeInstruction(type,stage){
 const root=$(type==='meal'?'food':'restaurant');if(!root)return;root.querySelector('.family-swipe-tip')?.remove();const tip=document.createElement('div');tip.className='family-swipe-tip';tip.innerHTML=stage===1?'<b>Round 1</b><span>Swipe or tap ♥ to build your Maybes. ✓ enters them.</span><button type="button" aria-label="Dismiss">×</button>':'<b>'+(stage===2?'Round 2':'Tiebreak')+'</b><span>Swipe left or right to browse. ✓ enters your choice.</span><button type="button" aria-label="Dismiss">×</button>';root.appendChild(tip);tip.querySelector('button').onclick=()=>tip.remove();window.setTimeout(()=>tip.remove(),6500);
}
async function familyEnterMaybes(type){
 if(S.familyNormalMode!=='decision'||familyRoundStage()!==1||S.familyNormalVoteBusy)return;
 const s=familySessionRead(),round=S.familyActiveData?.activeRound;if(!s?.token||!round)return;S.familyNormalVoteBusy=true;
 const status=type==='meal'?'foodFamilyNormalStatus':'restaurantFamilyNormalStatus';
 try{const ids=type==='restaurant' ? restaurantPoolFiltered().filter(x=>x?._maybe).map(x=>String(x.id||'')).filter(Boolean) : [...(S.maybe||new Set())].map(String).filter(Boolean);familySetStatus(status,'Entering '+ids.length+' Maybes for the Family…','busy');
  const d=await familyApi('enter-maybes',{token:s.token,roundId:round.id,itemIds:ids});
  if(d?.round?.status==='complete'){const r=d.round;familySessionWrite({...s,family:{...(s.family||{}),activeRoundId:null}});S.familyActiveData={...(S.familyActiveData||{}),activeRound:null,lastCompletedRound:r};r.snapshot?.outcome==='no_winner'?familyShowNoWinner(r):familyShowWinner(r);return;}
  if(d?.round?.currentStage&&Number(d.round.currentStage)!==1){familyBeginNormalDecision({...S.familyActiveData,activeRound:d.round});return;}
  await familyRefreshState();
 }catch(err){familySetStatus(status,err.message||'Could not enter your Maybes.','error');}finally{S.familyNormalVoteBusy=false;}
}
async function familyPickSingle(type){
 const stage=familyRoundStage();if(S.familyNormalMode!=='decision'||stage===1||S.familyNormalVoteBusy)return;
 const s=familySessionRead(),round=S.familyActiveData?.activeRound;if(!s?.token||!round)return;const item=type==='meal'?S.pool?.[S.index]:restaurantPoolFiltered()?.[S.restaurantIndex];if(!item)return;
 S.familyNormalVoteBusy=true;const status=type==='meal'?'foodFamilyNormalStatus':'restaurantFamilyNormalStatus',voteStage=stage===2?'finalist':'tiebreak';
 try{familySetStatus(status,stage===2?'Entering your finalist…':'Entering your tiebreak pick…','busy');const d=await familyApi('enter-choice',{token:s.token,roundId:round.id,stage:voteStage,itemId:String(item.id)});S.familyBrowseHistory=[];
  if(d?.round?.status==='complete'){const r=d.round;familySessionWrite({...s,family:{...(s.family||{}),activeRoundId:null}});S.familyActiveData={...(S.familyActiveData||{}),activeRound:null,lastCompletedRound:r};r.snapshot?.outcome==='no_winner'?familyShowNoWinner(r):familyShowWinner(r);return;}
  if(d?.round?.currentStage&&Number(d.round.currentStage)!==stage){familyBeginNormalDecision({...S.familyActiveData,activeRound:d.round});return;}
  await familyRefreshState();
 }catch(err){familySetStatus(status,err.message||'Could not save your pick.','error');}finally{S.familyNormalVoteBusy=false;}
}
function familySetWinnerMeta(round){
 const el=$('familyWinnerMeta')||(()=>{const p=document.createElement('p');p.id='familyWinnerMeta';p.className='family-winner-meta';$('winName')?.insertAdjacentElement('afterend',p);return p;})();if(!el)return;el.textContent=round?.snapshot?.outcome==='wheel'?'Decided together · won on the Family Wheel.':'Decided together · everyone already said yes to this choice.';el.classList.remove('hidden');
}
function familyHideWinnerMeta(){const el=$('familyWinnerMeta');if(el)el.classList.add('hidden');}
function familyShowNoWinner(round){
 const s=familySessionRead();if(s)familySessionWrite({...s,dismissedWinnerRoundId:String(round?.id||'')});S.familyActiveData={...(S.familyActiveData||{}),activeRound:null,lastCompletedRound:round};S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyNormalRoundId='';S.familyNormalStage=0;show('family');$('familyNoWinnerOverlay')?.remove();
 const overlay=document.createElement('div');overlay.id='familyNoWinnerOverlay';overlay.className='family-no-winner-overlay';const host=s?.member?.role==='host';
 overlay.innerHTML='<div class="family-no-winner-card"><span>DINNER TOGETHER</span><h3>NO DINNER WAS CHOSEN</h3><p>No finalist was entered by everyone. Start again or exit Dinner Together.</p><div class="family-no-winner-actions"><button type="button" class="family-restart-button" '+(host?'':'disabled')+'>RESTART</button><button type="button" class="family-exit-button">EXIT</button></div></div>';document.body.appendChild(overlay);overlay.querySelector('.family-restart-button')?.addEventListener('click',familyRestartFromNoWinner);overlay.querySelector('.family-exit-button')?.addEventListener('click',familyBackFromMode);
}
function familyResetCompareState(){S.familyCompareBothMode='';S.familyCompareBothGroupId='';S.familyCompareBothMealWinner=null;S.familyBrowseHistory=[];}
function familyRestartFromNoWinner(){const o=$('familyNoWinnerOverlay');o?.remove();const s=familySessionRead(),last=S.familyActiveData?.lastCompletedRound,cmp=last?.snapshot?.compareBoth;S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyNormalRoundId='';S.familyNormalStage=0;show('family');if(s?.member?.role==='host')window.setTimeout(()=>cmp?.mode==='compare_both'?familyChooseNormalType('both'):familyChooseNormalType(S.familyDecisionType||'meal'),80);else familySetStatus('familyLobbyStatus','Waiting for the host to restart the dinner.');}
function familyRestartAfterWinner(){const r=S.familyActiveData?.lastCompletedRound||S.familyActiveData?.activeRound,cmp=r?.snapshot?.compareBoth,s=familySessionRead();if(!s?.member||s.member.role!=='host'){familyDismissWinner();return;}familySessionWrite({...s,dismissedWinnerRoundId:null});S.familyNormalMode='idle';S.familyNormalAutoResume=true;S.familyNormalRoundId='';S.familyNormalStage=0;familyChooseNormalType(cmp?.mode==='compare_both'?'both':(S.familyDecisionType||'meal'));}
function familyContinueCompareRestaurant(round){const s=familySessionRead();if(s?.member?.role!=='host')return;S.familyCompareBothMode='restaurant';S.familyCompareBothGroupId=String(round?.snapshot?.compareBoth?.groupId||S.familyCompareBothGroupId);S.familyCompareBothMealWinner=round?.winnerItem||null;familyDismissWinner();window.setTimeout(()=>familyChooseNormalType('restaurant'),80);}
async function familyCreateCompareFinal(round){const s=familySessionRead(),cmp=round?.snapshot?.compareBoth;if(!s?.token||s.member?.role!=='host'||!cmp?.mealWinner||!round?.winnerItem)return;try{familySetStatus('familyLobbyStatus','Preparing the final dinner-type choice…','busy');const created=await familyApi('create-compare-final',{token:s.token,groupId:String(cmp.groupId||''),mealWinner:cmp.mealWinner,restaurantWinner:round.winnerItem});S.familyCompareBothMode='final';S.familyActiveData={...(S.familyActiveData||{}),activeRound:created,myVotes:[],roundMembers:[]};S.familyNormalMode='decision';S.familyDecisionType='meal';S.familyNormalRoundId=String(created.id);S.familyNormalStage=2;S.familyBrowseHistory=[];familyBeginNormalDecision({...S.familyActiveData,activeRound:created});}catch(err){familySetStatus('familyLobbyStatus',err.message||'Could not prepare the final dinner choice.','error');}}
function familyNormalBack(type){
 const active=S.familyNormalMode==='setup'||S.familyNormalMode==='decision'||S.familyNormalMode==='winner';
 if(active){S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyNormalRoundId='';S.familyNormalStage=0;S.familyBrowseHistory=[];show('family');familyRefreshState();return;}
 show('family');familyRefreshState();
}
function familyDecisionBack(type){familyNormalBack(type);}
function familyShowWinner(round){
 const item=round?.winnerItem,id=String(round?.id||'');if(!item)return;if(S.familyNormalMode==='winner'&&S.familyNormalRoundId===id&&S.screen==='winner')return;
 const cmp=round?.snapshot?.compareBoth||null;S.familyActiveData={...(S.familyActiveData||{}),activeRound:round,lastCompletedRound:round};S.familyNormalMode='winner';S.familyNormalRoundId=id;S.familyDecisionType=round.decisionType==='restaurant'?'restaurant':'meal';S.familyNormalAutoResume=true;winner(item,S.familyDecisionType,{familyRoundId:id,familyMode:true});
 const b=$('restart'),host=familySessionRead()?.member?.role==='host';if(b){b.disabled=false;if(cmp?.mode==='compare_both'&&cmp.track==='meal')b.textContent=host?'CONTINUE TO RESTAURANT':'WAITING FOR HOST';else if(cmp?.mode==='compare_both'&&cmp.track==='restaurant')b.textContent=host?'COMPARE THE TWO':'WAITING FOR HOST';else b.textContent=host?'START OVER':'BACK TO FAMILY';}
 familySetWinnerMeta(round);if(round?.snapshot?.outcome==='wheel')familyAnimateWheel(round);
}
function handleWinnerRestart(){
  if(tutorialWinnerRestart())return;
  if(S.familyNormalMode==='winner'){
    const round=S.familyActiveData?.activeRound||S.familyActiveData?.lastCompletedRound||null,cmp=round?.snapshot?.compareBoth||null,session=familySessionRead(),host=session?.member?.role==='host';
    if(round?.snapshot?.outcome==='no_winner')return familyRestartFromNoWinner();
    if(cmp?.mode==='compare_both'&&cmp.track==='meal')return host?familyContinueCompareRestaurant(round):familyDismissWinner();
    if(cmp?.mode==='compare_both'&&cmp.track==='restaurant')return host?familyCreateCompareFinal(round):familyDismissWinner();
    return host?familyRestartAfterWinner():familyDismissWinner();
  }
  return resetRound();
}
function familyDismissWinner(){const s=familySessionRead();if(s)familySessionWrite({...s,dismissedWinnerRoundId:S.familyNormalRoundId,lastWinnerItem:S.winnerItem||s.lastWinnerItem||null});S.familyNormalMode='idle';S.familyNormalAutoResume=true;show('family');familyRefreshState();}

function familyRenderState(data){
 const family=data?.family,me=data?.me;if(!family||!me)return;S.familyActiveData=data;
 $('familyJoinCodeDisplay').textContent=family.joinCode||'—';$('familyMemberCount').textContent=String(family.memberCount||0)+' of 8 here';familyDisplayMemberList(data.members||[],me);['familySetup','familySwipe','familyWinner'].forEach(id=>$(id)?.classList.add('hidden'));
 const activeRound=data.activeRound||null,completed=data.lastCompletedRound||null,stage=activeRound&&['swiping','final_swiping','tiebreak'].includes(activeRound.status),showWinner=!!completed&&familySessionRead()?.dismissedWinnerRoundId!==completed.id&&!activeRound,onNormal=['setup','decision','winner'].includes(S.familyNormalMode),noRound=!activeRound,cmp=completed?.snapshot?.compareBoth||null;
 $('familyLobby')?.classList.toggle('hidden',onNormal||stage||showWinner);
 const home=$('familySetupOpen'),rest=$('familyStartDecision'),both=$('familyCompareBoth');
 if(home){home.classList.toggle('hidden',!(me.role==='host'&&noRound));home.dataset.familyLobbyAction=cmp?.track==='meal'?'compare-restaurant':cmp?.track==='restaurant'?'compare-final':'meal';home.textContent=cmp?.track==='meal'?'CONTINUE TO RESTAURANT':cmp?.track==='restaurant'?'COMPARE THE TWO':'AT HOME';}
 if(rest){rest.classList.toggle('hidden',!(me.role==='host'&&noRound&&!cmp?.mode));rest.textContent='RESTAURANT';}
 if(both){both.classList.toggle('hidden',!(me.role==='host'&&noRound&&!cmp?.mode));}
 if(stage){if(S.familyNormalAutoResume)familyBeginNormalDecision(data);else if(S.screen==='family')familySetStatus('familyLobbyStatus','Dinner is underway. Open Family Mode again to resume.');return;}
 if(showWinner){if(S.familyNormalAutoResume)completed.snapshot?.outcome==='no_winner'?familyShowNoWinner(completed):familyShowWinner(completed);else if(S.screen==='family')familySetStatus('familyLobbyStatus','Dinner is decided.');return;}
 if(!activeRound&&['decision','winner'].includes(S.familyNormalMode)){S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyNormalRoundId='';S.familyNormalStage=0;show('family');familySetStatus('familyLobbyStatus','The Family dinner has ended.');return;}
 if(onNormal){familyNormalBar(S.familyDecisionType,S.familyNormalMode,data);return;}
 if(cmp?.mode==='compare_both'&&cmp.track==='meal')familySetStatus('familyLobbyStatus',me.role==='host'?'At Home is decided. Continue to Restaurants.':'At Home is decided. Waiting for the host.');else if(cmp?.mode==='compare_both'&&cmp.track==='restaurant')familySetStatus('familyLobbyStatus',me.role==='host'?'Both tracks are decided. Compare the two.':'Both tracks are decided. Waiting for the host.');else familySetStatus('familyLobbyStatus',me.role==='host'?'Everyone is here. Choose At Home, Restaurant, or Compare Both.':'You’re in. Waiting for the host.');
}async function familyRefreshState(){const s=familySessionRead();if(!s?.token)return null;try{const data=await familyApi('state',{token:s.token});familySessionWrite({...s,family:data.family,member:data.me,lastWinnerItem:data.activeRound?.winnerItem||data.lastCompletedRound?.winnerItem||s.lastWinnerItem||null,lastDecisionType:data.activeRound?.decisionType||data.lastCompletedRound?.decisionType||s.lastDecisionType||'food'});familyRenderState(data);return data;}catch(err){if(err.code==='UNAUTHORIZED')familySessionClear();familySetStatus('familyLobbyStatus',err.message||'Could not reconnect to this Family.','error');return null;}}
function startFamilyLobbyPolling(){if(S.familyPollTimer)return;S.familyPollTimer=setInterval(()=>{const s=familySessionRead(),shouldPoll=!!s?.token&&(S.screen==='family'||S.familyNormalMode!=='idle');if(shouldPoll&&!S.familyPollBusy){S.familyPollBusy=true;familyRefreshState().finally(()=>{S.familyPollBusy=false;});}else if(!shouldPoll){clearInterval(S.familyPollTimer);S.familyPollTimer=0;}},4000);}
function stopFamilyLobbyPolling(){if(S.familyPollTimer){clearInterval(S.familyPollTimer);S.familyPollTimer=0;}}
async function familyCreate(){const name=$('familyCreateName')?.value?.trim()||'';familySetStatus('familyCreateStatus','Creating…','busy');try{const data=await familyApi('create',{displayName:name});familySessionWrite({token:data.token,family:data.family,member:data.member});familyShowEntry();$('familyLobby')?.classList.remove('hidden');familyRenderState(data);familySetStatus('familyLobbyStatus','Family created. Share the code with everyone.');startFamilyLobbyPolling();}catch(err){familySetStatus('familyCreateStatus',err.message||'Could not create the Family.','error');}}
async function familyJoin(){const codeValue=$('familyJoinCode')?.value?.trim()||'',name=$('familyJoinName')?.value?.trim()||'';familySetStatus('familyJoinStatus','Joining…','busy');try{const data=await familyApi('join',{joinCode:codeValue,displayName:name});familySessionWrite({token:data.token,family:data.family,member:data.member});familyShowEntry();$('familyLobby')?.classList.remove('hidden');familyRenderState(data);familySetStatus('familyLobbyStatus','You’re in. Waiting for the host.');startFamilyLobbyPolling();}catch(err){familySetStatus('familyJoinStatus',err.message||'Could not join that Family.','error');}}
async function familyCopyCode(){const codeText=$('familyJoinCodeDisplay')?.textContent?.trim()||'';if(!codeText||codeText==='—')return;try{await navigator.clipboard.writeText(codeText);familySetStatus('familyLobbyStatus','Family code copied. Share it with everyone.');}catch{familySetStatus('familyLobbyStatus','Code: '+codeText);}}
async function familyShareCode(){const codeText=$('familyJoinCodeDisplay')?.textContent?.trim()||'';if(!codeText||codeText==='—')return;const shareData={title:'Dinliminate — Dinner Together',text:'Join our Dinliminate dinner decision. Family code: '+codeText};if(typeof navigator.share==='function'){try{await navigator.share(shareData);return;}catch(err){if(err?.name==='AbortError')return;}}try{await navigator.clipboard.writeText(shareData.text);familySetStatus('familyLobbyStatus','Invite copied. Share it with everyone.');}catch{familySetStatus('familyLobbyStatus',shareData.text);}}
async function familyOpen(){S.familyNormalAutoResume=true;['familySetup','familySwipe','familyWinner'].forEach(id=>$(id)?.classList.add('hidden'));show('family');const s=familySessionRead();if(!s?.token){S.familyNormalMode='idle';familyShowEntry();stopFamilyLobbyPolling();return;}await familyRefreshState();startFamilyLobbyPolling();}
async function familyEndDinner(){
 const s=familySessionRead();if(!s?.token||s.member?.role!=='host'||!s.family?.activeRoundId)return;
 if(!await appConfirm('End Dinner Together','End the active Family dinner for everyone? They will return to the Family lobby.','End Dinner'))return;
 try{await familyApi('end-round',{token:s.token});familyResetCompareState();S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyNormalRoundId='';S.familyNormalStage=0;S.familyActiveData=null;show('family');await familyRefreshState();familySetStatus('familyLobbyStatus','Dinner ended by the host. You can start a new one anytime.');}
 catch(err){familySetStatus('familyLobbyStatus',err.message||'Could not end the Family dinner.','error');}
}
async function familyLeave(){const s=familySessionRead();if(!await appConfirm('Leave Family Mode',s?.family?.activeRoundId?'A Family dinner is active. You can leave and rejoin later.':'Leave this Family on this device?','Leave'))return;familyResetCompareState();S.familyNormalMode='idle';S.familyNormalAutoResume=false;stopFamilyLobbyPolling();if(s?.token){try{await familyApi('leave',{token:s.token});}catch(err){familySetStatus('familyLobbyStatus',err.message||'Could not leave the Family.','error');return;}}familySessionClear();familyShowEntry();show('family');}
async function familyRotateCode(){const s=familySessionRead();if(!s?.token)return;try{const d=await familyApi('rotate-code',{token:s.token});familySessionWrite({...s,family:{...(s.family||{}),joinCode:d.joinCode}});await familyRefreshState();}catch(err){familySetStatus('familyLobbyStatus',err.message||'Could not regenerate the code.','error');}}
function familyBackFromMode(){S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyDecisionType='';S.familyVotedIds=new Set();familyResetCompareState();stopFamilyLobbyPolling();home();}

$('foodHomeBack')?.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();home();});
$('restaurantHomeBack')?.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();home();});
$('familyMode')?.addEventListener('click',()=>navigateFromDrawer(familyOpen));$('familyBackTop')?.addEventListener('click',familyBackFromMode);
$('familyCreateChoice')?.addEventListener('click',familyShowCreate);$('familyJoinChoice')?.addEventListener('click',familyShowJoin);$('familyCreateBack')?.addEventListener('click',familyShowEntry);$('familyJoinBack')?.addEventListener('click',familyShowEntry);
$('familyCreateSubmit')?.addEventListener('click',familyCreate);$('familyJoinSubmit')?.addEventListener('click',familyJoin);$('familyLeave')?.addEventListener('click',familyLeave);$('familyCopyCode')?.addEventListener('click',familyCopyCode);$('familyShareCode')?.addEventListener('click',familyShareCode);$('familyRotateCode')?.addEventListener('click',familyRotateCode);
$('familySetupOpen')?.addEventListener('click',()=>{const a=$('familySetupOpen')?.dataset.familyLobbyAction||'meal',r=S.familyActiveData?.lastCompletedRound;if(a==='compare-restaurant'&&r){S.familyCompareBothMode='restaurant';S.familyCompareBothMealWinner=r.winnerItem;S.familyCompareBothGroupId=String(r.snapshot?.compareBoth?.groupId||S.familyCompareBothGroupId);familyChooseNormalType('restaurant');}else if(a==='compare-final'&&r)familyCreateCompareFinal(r);else familyChooseNormalType('meal');});$('familyStartDecision')?.addEventListener('click',()=>familyChooseNormalType('restaurant'));$('familyCompareBoth')?.addEventListener('click',()=>familyChooseNormalType('both'));
$('familySetupBack')?.addEventListener('click',()=>familyNormalBack(S.familyDecisionType||'meal'));$('foodFamilyNormalStart')?.addEventListener('click',()=>familyStartRoundFromNormal('meal'));$('restaurantFamilyNormalStart')?.addEventListener('click',()=>familyStartRoundFromNormal('restaurant'));
$('familyCreateName')?.addEventListener('keydown',e=>{if(e.key==='Enter')familyCreate();});$('familyJoinName')?.addEventListener('keydown',e=>{if(e.key==='Enter')familyJoin();});$('familyJoinCode')?.addEventListener('input',e=>{const v=e.target.value.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,6);e.target.value=v.length>3?v.slice(0,3)+' · '+v.slice(3):v;});

})();
// CP1069 FINAL DEPLOYMENT TRIGGER