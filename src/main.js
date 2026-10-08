// CP1181: stale waiting-card safe rapid swipe handoff.
// CP1180: eliminate stale waiting-card reuse during rapid meal swipes.
// CP1186: radius changes always rebuild an independent restaurant pool; no prior-radius carry-forward.
// CP1171: preserve the swipe transaction lock across card rebinds.
// CP1170: make meal swipe handoff immediate for rapid swipes.
// CP1067: stabilize first card and make All/Maybe counts derive from the actual choice catalog.\n// CP988: Swipe Engine v2 — atomic gestures, immediate exit, exact-once completion.
// CP950 final tree sync: Meal swipe gate removed; keep this commit as the deploy source of truth.

import { FOODS } from '../data/foods.js';
import RESTAURANT_TAXONOMY from './data/restaurant-taxonomy.js';
import { state as S } from './state/store.js';
import { $ } from './ui/dom.js';
import { esc } from './ui/esc.js';
import { appToast, appConfirm } from './ui/modal.js';
import { configureStorage, save, loadItemNotes, saveItemNotes, itemNoteKey, itemNote, setItemNote, openPhotoDB, putStoredPhoto, getStoredPhoto, deleteStoredPhoto, mealPhotoStorageKey, pruneMealPhotoKeys, storeMealPhotoSet, hydrateStoredMealPhotoList, hydrateCustomPhotos, updateStorageIndicator, migrateCustomPhotos } from './state/storage.js';
import { configureMigrations, load } from './state/migrations.js';
import { historyImageSource, recordHistory, readHistory, writeHistory, historyView, HISTORY_KEY } from './features/history/index.js';
import { hideCelebration, triggerCelebration, triggerWinnerMoment, wheelPoint, sampleHungryWheel, renderHungryWheel, hungryWheelPool, showHungryWheelResult, hungryRestaurantPool, hungryRestaurantPick, renderHungryRestaurantMystery, startHungryRestaurantMystery, revealHungryRestaurant, tryAnotherHungryRestaurant, finishHungryWheelRotation, startContinuousWheelSpin, slowAndStopHungryWheel, spinHungryWheel, winner } from './features/winner/index.js';
import { milesBetween, restaurantAddressFamily, restaurantNameTokensUI, restaurantNameFamily, restaurantNameCoreTokensUI, restaurantNameCoreMatchUI, restaurantNameSimilarityUI, restaurantAddressKeyUI, restaurantAddressSimilarityUI, restaurantStreetFamily, addressHasStreetNumber, restaurantNameVariantMatchUI, restaurantPhotoQualityScore, dedupeRestaurantPool, restaurantCanonicalId, restaurantHidden, restaurantSearchText, restaurantIsFastFood, restaurantCuisineTags, restaurantCuisineEvidence, restaurantCategory, restaurantQuickMatches, restaurantCategorySearchMatches, restaurantSearchTermMatches, restaurantMatchesQuery, restaurantClockParts, restaurantHoursState, restaurantHoursMatches, restaurantPoolHourFiltered, restaurantChoiceIndex, restaurantPoolBase, restaurantPoolFiltered, updateRestaurantStatus, restaurantQuick, renderLocationSource, displayRestaurantLocationLabel, setLocation, renderFindButton, setFindBusy, setLocationBusy, requestBrowserPosition, locationMovedMiles, invalidateAddressSuggestions, addressLooksComplete, renderSuggestions, clearSuggestions, moveSuggestion, openRestaurant, restaurantBack, bindCardButton, bindRestaurantSwipe, scheduleRestaurantProviderSearch, renderRestaurantSearchControl, collapseRestaurantSearch, setRestaurantRefinePanel, closeRestaurantSearch, bindRestaurantTools } from './features/restaurants/index.js';
import { tutorialStepsForScreen, tutorialUnionRect, tutorialTargetRect, tutorialBlockerRects, tutorialPosition, renderTutorialStep, tutorialNavigateTo, startTutorialForScreen, tutorialEnterDecisionScreen, tutorialMarkHomeChoice, tutorialMarkChoose, tutorialWinnerRestart, advanceTutorial, tutorialTargetHit, tutorialAdvanceFromTarget, tutorialCurrentTargetForEvent, tutorialBlockPointer, tutorialHandlePointerUp, tutorialHandlePointerCancel, tutorialHighlightedTargetClick, bindTutorialUI, tutorialState } from './features/tutorial/index.js';

'use strict';
// CP954 restaurant first-paint restoration: exact/direct venue photos win before generic fallback.
// CP945 photo-pipeline release sync: canonical Restaurant photo handoff + cache revision.
const getDefaultFoods = () => Array.isArray(FOODS) ? FOODS : [];
// CP1149 — meal photo policy: official source first, exact same-meal backup second, never a generic food fallback.
const DEFAULT_FOOD_IMAGE = '';

const KEY = 'dinliminate.clean.cp1';
const HISTORY_KEY = 'dinliminate.clean.history';
const APP_VERSION = '1.0';

// CP973 — photo-ready Restaurant first paint + four-card swipe prewarm.
// CP1070: one-at-a-time Restaurant refine panels + category-aware Cuisine filtering.
const APP_BUILD = '1308';
const APP_BUILD_DATE = '2026-10-08';
const MEAL_AUTOFILL_ENABLED = false;
const HUNGRY_IMAGE = 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" rx="52" fill="#090909"/><circle cx="600" cy="400" r="170" fill="none" stroke="#f5f1e8" stroke-width="18"/><circle cx="535" cy="365" r="14" fill="#f5f1e8"/><circle cx="665" cy="365" r="14" fill="#f5f1e8"/><path d="M515 495c52-62 118-62 170 0" fill="none" stroke="#f5f1e8" stroke-width="18" stroke-linecap="round"/></svg>');
const FOOD_QUICK = ['American','Southern','Mexican','Italian','Asian','Pasta','Soup/Stew','Healthy','Seafood','Potato'];
const foodQuickLabels=()=>[...FOOD_QUICK,'Other',...(S.customQuickCuts||[]).map(x=>String(x?.name||'').trim()).filter(Boolean)];
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

// State is owned by the application store; feature code accesses it through the imported state proxy.

const IMAGE_PROXY_HOSTS=new Set(['images.pexels.com','images.unsplash.com','cdn.pixabay.com','commons.wikimedia.org','upload.wikimedia.org','thumb.wikimedia.org','static.wixstatic.com','static.spotapps.co','www.goodnes.com','hips.hearstapps.com','calliesbiscuits.com','vinovoss.com','www.southernliving.com','southernbite.com','snapcalorie-webflow-website.s3.us-east-2.amazonaws.com','butterhearth.com','slicelife.imgix.net','cdn.shopify.com','savouryflavor.com','resizer.otstatic.com','kookycrunch.com','cdn.apartmenttherapy.info','shop.barebells.com','b1880159.assetcdn.net','www.mybakingaddiction.com','a.fsimg.co.nz','ourstate.s3.amazonaws.com','whitneybond.com','thedailymeal.com','crockncle.com','www.africanbites.com','www.foodrepublic.com','shop.camelliabrand.com','parade.com','sweetasirem.com','www.sugardale.com','myhomemaderecipe.com','www.finedininglovers.com']);

const BUILTIN_MEAL_IMAGE_HOSTS=new Set(['images.pexels.com','images.unsplash.com','cdn.pixabay.com']);
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
 for(const ref of refs){try{const src=await resolveMealPhotoRef(ref,item);if(src)loaded.push(src);}catch(error){console.error('Dinliminate error',error)}}
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
 }catch(error){console.error('Dinliminate error',error)}
}
function saveRestaurantWebsiteStore(){
 try{
  const out={},now=Date.now();
  for(const [key,value] of restaurantWebsiteCache){
   if(value&&now-Number(value.t||0)<RESTAURANT_WEBSITE_CACHE_TTL)out[key]=value;
  }
  localStorage.setItem(RESTAURANT_WEBSITE_CACHE_KEY,JSON.stringify(out));
 }catch(error){console.error('Dinliminate error',error)}
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
 }catch(error){console.error('Dinliminate error',error)}
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
  probe.onload=async()=>{try{await probe.decode?.();}catch(error){console.error('Dinliminate error',error)}if(img.isConnected)img.src=nextUrl;finish(true);};
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
 const attempt=async()=>{
  for(const url of list){
   if(!stillCurrent())return false;
   const ready=await preloadSwipeImage(url);
   if(!ready||!stillCurrent())continue;
   try{img.src=url;}catch{continue;}
   img.style.visibility='visible';
   img.dataset.imageFallback='false';
   target.dataset.foodImageSource=url;
   return true;
  }
  return false;
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
   try{URL.revokeObjectURL(url);}catch(error){console.error('Dinliminate error',error)}
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
 }catch(error){console.error('Dinliminate error',error)}
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
 }catch(error){console.error('Dinliminate error',error)}
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
 if(!row)return null;
 const rowKey=String(row.id||row.canonicalId||'').trim();
 if(!rowKey)return null;
 const imgs=[...document.querySelectorAll(scope+' img[data-restaurant-photo-key]')]
  .filter(img=>img.dataset.restaurantPhotoKey===rowKey);
 if(!imgs.length)return null;
 const data=await loadRestaurantPhoto(row);
 if(!data?.url)return null;
 for(const img of imgs){
  if(!img.isConnected)continue;
  const swapped=await swapImageWhenReady(img,data.url);
  if(swapped){
   img.dataset.restaurantPhotoLoaded='true';
   setRestaurantPhotoCredit(img.closest('.card,.restaurant-detail-hero')||img.parentElement,data.attributions,data.source,data.sourceUrl);
  }
 }
 return data;
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
 }catch(error){console.error('Dinliminate error',error)}
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
const STORAGE_VERSION = 7;
const DECISION_HISTORY_LIMIT = 256;

function clearDecisionHistory(kind){
 if(kind==='food'){S.foodHistory=[];S.foodActions=[];}
 else if(kind==='restaurant'){S.restaurantHistory=[];S.restaurantActions=[];}
 updateDecisionBackButtons();
}

function updateDecisionBackButtons(){
 const foodBackButton=$('foodBack');
 if(foodBackButton){
  const familyBack=typeof familyIsBrowseStage==='function'&&familyIsBrowseStage('meal')&&!familyBrowseSubmitted();
  const disabled=!familyBack&&S.foodHistory.length===0;
  foodBackButton.disabled=disabled;
  foodBackButton.setAttribute('aria-disabled',String(disabled));
 }
 const restaurantBackButton=$('restBack');
 if(restaurantBackButton){
  const familyBack=typeof familyIsBrowseStage==='function'&&familyIsBrowseStage('restaurant')&&!familyBrowseSubmitted();
  const disabled=!familyBack&&S.restaurantHistory.length===0;
  restaurantBackButton.disabled=disabled;
  restaurantBackButton.setAttribute('aria-disabled',String(disabled));
 }
}

function pushDecisionHistory(kind,state){
 const history=kind==='food'?S.foodHistory:S.restaurantHistory;
 history.push(state);
 if(history.length>DECISION_HISTORY_LIMIT)history.splice(0,history.length-DECISION_HISTORY_LIMIT);
 updateDecisionBackButtons();
}

function captureFoodDecisionState(){
 return {
  poolIds:(Array.isArray(S.pool)?S.pool:[]).map(item=>String(item?.id||'')).filter(Boolean),
  index:Number(S.index)||0,
  foodCuts:[...S.foodCuts],
  maybe:[...S.maybe],
  maybeDeck:!!S.maybeDeck,
  foodMaybeRound:!!S.foodMaybeRound,
  cutCats:[...S.cutCats],
  mealTimeFilters:[...(S.mealTimeFilters||[])],
  quickCutsCollapsed:{...(S.quickCutsCollapsed||{})},
  mealTimeCutsCollapsed:!!S.mealTimeCutsCollapsed
 };
}

function captureRestaurantDecisionState(){
 return {
  poolIds:(Array.isArray(S.restaurantPool)?S.restaurantPool:[]).map(row=>String(row?.id||'')).filter(Boolean),
  rowStates:(Array.isArray(S.restaurantPool)?S.restaurantPool:[]).map(row=>({
   id:String(row?.id||''),
   maybe:!!row?._maybe,
   cut:!!row?._cut,
   hidden:!!row?._hidden
  })).filter(x=>x.id),
  index:Number(S.restaurantIndex)||0,
  restaurantCuts:[...S.restaurantCuts],
  maybeDeck:!!S.maybeDeck,
  restaurantMaybeRound:!!S.restaurantMaybeRound,
  restaurantQuery:String(S.restaurantQuery||''),
  restaurantHours:String(S.restaurantHours||'all')==='open'?'open':'all',
  restaurantHoursCollapsed:!!S.restaurantHoursCollapsed,
  restaurantSearchRadius:Number(S.restaurantSearchRadius)||10,
  restaurantSearchKey:String(S.restaurantSearchKey||''),
  restaurantSearchQuery:String(S.restaurantSearchQuery||''),
  restaurantSearchOrigin:S.restaurantSearchOrigin&&Number.isFinite(Number(S.restaurantSearchOrigin.lat))&&Number.isFinite(Number(S.restaurantSearchOrigin.lon))
    ?{lat:Number(S.restaurantSearchOrigin.lat),lon:Number(S.restaurantSearchOrigin.lon)}:null,
  restaurantSearchTimeZone:String(S.restaurantSearchTimeZone||''),
  restaurantSearchDegraded:!!S.restaurantSearchDegraded
 };
}

function mealItemLookup(){
 const map=new Map();
 const add=item=>{
  const id=String(item?.id||'');
  if(id&&!map.has(id))map.set(id,item);
 };
 for(const item of (Array.isArray(S.pool)?S.pool:[]))add(item);
 for(const item of getDefaultFoods())add(item);
 for(const item of (Array.isArray(S.custom)?S.custom:[]))add(item);
 for(const item of (Array.isArray(S.deletedCustomMeals)?S.deletedCustomMeals:[]))add(item);
 return map;
}

function restoreFoodDecisionState(state){
 if(!state||!Array.isArray(state.poolIds))return false;
 S.foodCuts=new Set(Array.isArray(state.foodCuts)?state.foodCuts:[]);
 S.maybe=new Set(Array.isArray(state.maybe)?state.maybe:[]);
 S.maybeDeck=!!state.maybeDeck;
 S.foodMaybeRound=!!state.foodMaybeRound;
 S.cutCats=new Set(Array.isArray(state.cutCats)?state.cutCats:[]);
 S.mealTimeFilters=new Set(Array.isArray(state.mealTimeFilters)?state.mealTimeFilters:mealTimeNames());
 S.quickCutsCollapsed={...(state.quickCutsCollapsed||{food:true,restaurant:true})};
 S.mealTimeCutsCollapsed=!!state.mealTimeCutsCollapsed;
 const lookup=mealItemLookup();
 S.pool=state.poolIds.map(id=>lookup.get(String(id))).filter(Boolean).map(item=>({
  ...item,
  ...(Array.isArray(item?.quickCuts)?{quickCuts:[...item.quickCuts]}:{}),
  ...(Array.isArray(item?.mealTimes)?{mealTimes:[...item.mealTimes]}:{}),
  ...(Array.isArray(item?.images)?{images:[...item.images]}:{})
 }));
 S.index=Math.max(0,Math.min(Number(state.index)||0,Math.max(0,S.pool.length-1)));
 S.foodRestoreExact=true;
 return true;
}

function restoreRestaurantDecisionState(state){
 if(!state||!Array.isArray(state.poolIds))return false;
 S.restaurantCuts=new Set(Array.isArray(state.restaurantCuts)?state.restaurantCuts:[]);
 S.maybeDeck=!!state.maybeDeck;
 S.restaurantMaybeRound=!!state.restaurantMaybeRound;
 S.restaurantQuery=String(state.restaurantQuery||'');
 S.restaurantHours=String(state.restaurantHours||'all')==='open'?'open':'all';
 S.restaurantHoursCollapsed=!!state.restaurantHoursCollapsed;
 S.restaurantSearchRadius=Number(state.restaurantSearchRadius)||10;
 S.restaurantSearchKey=String(state.restaurantSearchKey||'');
 S.restaurantSearchQuery=String(state.restaurantSearchQuery||'');
 S.restaurantSearchOrigin=state.restaurantSearchOrigin&&Number.isFinite(Number(state.restaurantSearchOrigin.lat))&&Number.isFinite(Number(state.restaurantSearchOrigin.lon))
  ?{lat:Number(state.restaurantSearchOrigin.lat),lon:Number(state.restaurantSearchOrigin.lon)}:null;
 S.restaurantSearchTimeZone=String(state.restaurantSearchTimeZone||'');
 S.restaurantSearchDegraded=!!state.restaurantSearchDegraded;

 const byId=new Map((Array.isArray(S.restaurantPool)?S.restaurantPool:[]).map(row=>[String(row?.id||''),row]));
 for(const rs of Array.isArray(state.rowStates)?state.rowStates:[]){
  const row=byId.get(String(rs.id||''));
  if(!row)continue;
  row._maybe=!!rs.maybe;
  row._cut=!!rs.cut;
  row._hidden=!!rs.hidden;
 }
 const ordered=state.poolIds.map(id=>byId.get(String(id))).filter(Boolean);
 if(ordered.length)S.restaurantPool=ordered;
 S.restaurantIndex=Math.max(0,Math.min(Number(state.index)||0,Math.max(0,restaurantPoolFiltered().length-1)));
 S.restaurantRestoreExact=true;
 return true;
}

function legacyFoodBack(){
 const action=S.foodActions.pop();if(!action)return false;
 if(action.type==='cut')S.foodCuts.delete(action.id);
 if(action.type==='maybe'){if(action.hadMaybe)S.maybe.add(action.id);else S.maybe.delete(action.id);}
 S.foodMaybeRound=!!action.maybeRound||!!action.recycleOnUndo||!!action.roundAfter;
 buildFood();
 const restored=S.pool.findIndex(x=>x.id===action.id);
 S.index=restored>=0?restored:Math.max(0,Math.min(action.index||0,Math.max(0,S.pool.length-1)));
 drawFood();save();return true;
}

function legacyRestaurantBack(){
 const action=S.restaurantActions.pop();if(!action)return false;
 const row=S.restaurantPool.find(x=>x.id===action.id);
 if(row){if(action.type==='cut')row._cut=false;if(action.type==='maybe')row._maybe=!!action.hadMaybe;}
 S.restaurantMaybeRound=!!action.maybeRound||!!action.roundAfter;
 const rows=restaurantPoolFiltered(),restored=rows.findIndex(x=>x.id===action.id);
 S.restaurantIndex=restored>=0?restored:Math.max(0,Math.min(action.index||0,Math.max(0,rows.length-1)));
 drawRestaurants();save();return true;
}

function show(screen) {
if(typeof tutorialModeEnabled==='function'&&typeof tutorialState!=='undefined'&&tutorialState.active&&tutorialState.screen&&tutorialState.screen!==screen){
 tutorialInvalidateTransition('screen-change');
}
document.querySelectorAll('.screen').forEach(x => x.classList.add('hidden'));
$(screen)?.classList.remove('hidden');
S.screen = screen;
try{localStorage.setItem('dinliminate.start-screen',String(screen));}catch(error){console.error('Dinliminate error',error)}
document.querySelector('.app')?.classList.toggle('home-active',screen === 'home');
$('globalBack')?.classList.add('hidden');
$('appTopbar')?.classList.toggle('hidden', screen === 'food' || screen === 'restaurant' || screen === 'winner' || screen === 'family');
window.scrollTo?.(0,0);
}

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
 try{localStorage.setItem('dinliminate.swipeHint.v5','1')}catch(error){console.error('Dinliminate error',error)}
}
document.addEventListener('pointerdown',event=>{
 const target=event.target;
 if(!(target instanceof Element))return;
 if(target.closest('#food .card,#restaurant .card,#food .unified-swipe-actions .round-action,#restaurant .unified-swipe-actions .round-action')){
   dismissSwipeHint();
 }
},true);
function maybeShowInCardSwipeCoach(){
 try{if(localStorage.getItem('dinliminate.swipeHint.v5')||localStorage.getItem('dinliminate.swipeHint.v4')){clearLegacySwipeInstructions();return;}}catch(error){console.error('Dinliminate error',error)}
 const card=S.screen==='restaurant' ? $('restaurantCard') : $('foodCard');
 if(!card || card.querySelector('.swipe-card-coach'))return;
 const coach=document.createElement('div');
 coach.className='swipe-card-coach';
 coach.setAttribute('role','note');
 coach.setAttribute('aria-label','Swipe left to Cut or right for Maybe. This lesson disappears after your first meaningful interaction.');
 coach.innerHTML='<span class="swipe-card-coach-cut">← CUT</span><span class="swipe-card-coach-mid">· SWIPE ·</span><span class="swipe-card-coach-maybe">MAYBE →</span>';
 card.appendChild(coach);
}

async function startFood(options={}) {
S.foodActions = [];
S.foodHistory = [];
S.maybe.clear();
S.maybeDeck = false;
S.foodMaybeRound = false;
S.cutCats.clear();
S.foodCuts.clear();
S.mealTimeFilters = new Set(mealTimeNames());
S.index = 0;
S.winnerItem = null;
buildFood();

const firstItem=S.pool[S.index];
const firstSrc=firstItem ? (foodPhoto(firstItem)||foodPhotoFallback(firstItem)||FINAL_FOOD_IMAGE) : FINAL_FOOD_IMAGE;
if(firstSrc)preloadSwipeImage(firstSrc);
foodQuick();
drawFood({deferPrime:true});
show('food');
save();
maybeShowInCardSwipeCoach();
requestAnimationFrame(()=>{
  primeFoodSwipeMedia();
  if(tutorialModeEnabled()&&tutorialState.active){
   const resumeIndex=Number.isInteger(options?.tutorialResumeIndex)?options.tutorialResumeIndex:0;
   tutorialEnterDecisionScreen('food',resumeIndex);
  }
});
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
 const list=Array.isArray(rows)?rows:[];
 const len=list.length;if(!len)return -1;
 const from=Math.max(0,Math.floor(Number(start)||0));
 for(let step=0;step<len;step++){
  const i=(from+step)%len;
  const row=list[i],id=row?.id;
  if(id==null)continue;
  const cut=S.foodCuts?.has(id);
  const maybe=S.maybe.has(id);
  if(cut)continue;
  if(keepState?maybe:!maybe)return i;
 }
 return -1;
}
function drawFood(options={}){
 // The live Meal card is the only authoritative decision card. The waiting card
 // is pointer-inert and must never be used as a source for active-card selection.
 if(!S.pool.length){winner({name:'Nothing left — hungry mode',image:HUNGRY_IMAGE,category:'Hungry'});return;}
 const restoreExact=!!S.foodRestoreExact;
 S.foodRestoreExact=false;
 if(S.maybeDeck){
  const ni=foodChoiceIndex(S.pool,S.index,true);
  if(ni>=0)S.index=ni;
 }else if(restoreExact){
  S.index=Math.max(0,Math.min(S.index,S.pool.length-1));
 }else{
  const ni=foodChoiceIndex(S.pool,S.index,S.foodMaybeRound);
  if(ni>=0)S.index=ni;
  else if(!S.foodMaybeRound&&S.maybe.size){
   S.foodMaybeRound=true;
   const maybeIndex=foodChoiceIndex(S.pool,0,true);
   if(maybeIndex>=0)S.index=maybeIndex;
  }
 }
 const item=S.pool[S.index],img=$('foodImg');if(!img)return;
 const photoRefs=mealPhotoList(item),photoCount=photoRefs.length||1;
 const foodCard=$('foodCard');
 const previousMealId=String(foodCard?.dataset?.mealId||'');
 const previousImageReady=String(img.dataset.mealPhotoLoaded||'false')==='true'
  &&img.complete&&img.naturalWidth>0;
 const previousSrc=String(img.currentSrc||img.src||'').trim();
 const primaryPhoto=foodPhoto(item),backupPhoto=foodPhotoFallback(item);
 const sameMealReady=previousMealId===String(item.id||'')&&previousImageReady
  &&(!primaryPhoto||previousSrc===primaryPhoto||previousSrc===backupPhoto);
 const photoIndex=Math.max(0,Math.min(Number(item._mealPhotoIndex||0),Math.max(0,photoCount-1)));
 item._mealPhotoIndex=photoIndex;
 if(foodCard)foodCard.dataset.mealId=item.id;
 const handoffRendering=!!options.swipeHandoff;
 const holdCardForMedia=!!foodCard&&!sameMealReady;
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
 // Never expose the previous decoded bitmap while this DOM node is rebound.
 img.style.visibility='hidden';
 if(holdCardForMedia){
   foodCard.style.transition='none';
   foodCard.style.opacity='0';
   foodCard.style.visibility='hidden';
   foodCard.style.pointerEvents='none';
 }
 img.dataset.imageFallback='false';
 img.dataset.mealPhotoLoaded='false';
 img.dataset.foodImageSource='';
 if(!primaryPhoto&&!backupPhoto)markMealImageUnavailable(img);
 if(foodCard){loadMealPhotoCandidates(img,[primaryPhoto,backupPhoto],foodCard).then(ok=>{
  if(String(img.dataset.mealLoadToken||'')===loadToken){
   if(!ok)markMealImageUnavailable(img);
   if(ok)img.dataset.mealPhotoLoaded='true';
   mealReadyResolve(!!ok);
   if(holdCardForMedia){
    foodCard.style.transition='none';
    foodCard.style.transform='none';
    foodCard.style.opacity='1';
    foodCard.style.visibility='visible';
    foodCard.style.pointerEvents='auto';
   }
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
 updateDecisionBackButtons();
 renderMaybeDeckToggle('food');
 // CP1197: prepare the visual waiting card independently. It is never promoted.
 if(!handoffRendering&&!options.deferPrime)primeFoodSwipeMedia();
 maybeShowInCardSwipeCoach();bindFoodSwipe();bindMaybeDeckToggle('food');if(S.familyNormalMode==='setup'&&S.familyDecisionType==='meal')familyNormalBar('meal','setup',S.familyActiveData);bindCardButton('foodDetails',()=>detailsSheet(item,'food'));if($('foodChoose'))bindCardButton('foodChoose',()=>{dismissSwipeHint();if(S.familyNormalMode==='decision'&&S.familyDecisionType==='meal'){familyRoundStage()===1?familyEnterMaybes('meal'):familyPickSingle('meal');}else winner(item)});bindCardButton('foodCut',()=>foodCut());bindCardButton('foodMaybe',()=>foodMaybe());bindCardButton('foodBack',foodBack);
}
function foodCommit(type,item){pushDecisionHistory('food',captureFoodDecisionState());const unkept=S.pool.filter(x=>!S.maybe.has(x.id)).length;S.foodActions.push({type,id:item.id,primary:item.primary,index:S.index,maybeRound:!!S.foodMaybeRound,hadMaybe:S.maybe.has(item.id),recycleOnUndo:type==='cut'&&S.maybe.size>0&&unkept===1});}
function foodCut(item=S.pool[S.index],options={}){
 dismissSwipeHint();
 if(S.familyNormalMode==='decision'&&S.familyDecisionType==='meal'&&familyRoundStage()!==1){familyBrowsePrevious('meal');return;}
 if(!item)return;
 const unkept=S.pool.filter(x=>!S.maybe.has(x.id)).length;
 foodCommit('cut',item);
 const roundAfter=!!S.foodMaybeRound|| (S.maybe.size>0 && unkept<=1);
 S.foodActions[S.foodActions.length-1].roundAfter=roundAfter;
 S.foodCuts.add(item.id);
 resolveFoodAfterDecision({swipeHandoff:!!options.fromSwipe});
}
function foodMaybe(item=S.pool[S.index],options={}){
 dismissSwipeHint();
 if(S.familyNormalMode==='decision'&&S.familyDecisionType==='meal'&&familyRoundStage()!==1){familyBrowseNext('meal');return;}
 if(!item)return;
 if(S.pool.length===1){foodCommit('maybe',item);winner(item);return;}
 foodCommit('maybe',item);S.maybe.add(item.id);
 // drawFood() owns the single post-decision selection step. Do not advance
 // S.index here as well, or the active deck can skip/re-enter cards.
 drawFood({swipeHandoff:!!options.fromSwipe});save();
}
function resolveFoodAfterDecision(options={}){
 if(!S.pool.length){winner({name:'Nothing left — hungry mode',image:HUNGRY_IMAGE,category:'Hungry'});return;}
 if(!S.foodMaybeRound){
  const ni=foodChoiceIndex(S.pool,S.index,false);
  if(ni>=0)S.index=ni;
  else if(S.maybe.size){
   S.foodMaybeRound=true;
   S.index=foodChoiceIndex(S.pool,0,true);
  }else{
   winner({name:'Nothing left — hungry mode',image:HUNGRY_IMAGE,category:'Hungry'});
   return;
  }
 }
 if(S.foodMaybeRound){
  const ni=foodChoiceIndex(S.pool,S.index,true);
  if(ni>=0)S.index=ni;
  else{
   winner({name:'Nothing left — hungry mode',image:HUNGRY_IMAGE,category:'Hungry'});
   return;
  }
 }
 S.index=Math.max(0,Math.min(S.index,Math.max(0,S.pool.length-1)));
 drawFood(options);save();
}
function foodBack(){
 if(familyIsBrowseStage('meal')){familyBrowseBack('meal');return;}
 if($('foodCard')?.dataset.swipeTransaction==='active')return;
 const state=S.foodHistory.pop();
 if(!state){legacyFoodBack();updateDecisionBackButtons();return;}
 S.foodActions.pop();
 if(!restoreFoodDecisionState(state))return;
 drawFood();save();updateDecisionBackButtons();
}

function triggerSwipeHaptic(){
 try{
  const nativeHandler=window?.webkit?.messageHandlers?.haptic;
  if(nativeHandler?.postMessage){nativeHandler.postMessage('light');return true;}
 }catch(error){console.error('Dinliminate error',error)}
 try{
  if(typeof navigator!=='undefined'&&typeof navigator.vibrate==='function'){
   return !!navigator.vibrate(8);
  }
 }catch(error){console.error('Dinliminate error',error)}
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
 if(typeof previousCleanup==='function'){try{previousCleanup();}catch(error){console.error('Dinliminate error',error)}}
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
  if(ok){
   card.style.visibility='visible';
   card.style.transition='';
  }
 });
 return ready;
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
  const ni=foodChoiceIndex(
   pool,
   (cursor+1)%Math.max(1,pool.length),
   !!S.maybeDeck || !!S.foodMaybeRound
  );
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
 // Reused Meal cards must never expose the previous meal's decoded bitmap.
 // The current image becomes visible only after its own source is preloaded/decoded.
 img.style.visibility='hidden';
 nextCard.style.visibility='visible';
 if(!primary&&!backup)markMealImageUnavailable(img);
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


const swipeImagePreloads=new Map();
function preloadSwipeImage(src){
 const url=String(src||'').trim();if(!url)return Promise.resolve(false);
 const cached=swipeImagePreloads.get(url);
 if(cached){
  if(cached.__readyPromise)return cached.__readyPromise;
  if(cached.complete&&cached.naturalWidth>0)return Promise.resolve(true);
 }
 const img=new Image();
 img.decoding='sync';
 img.loading='eager';
 img.referrerPolicy='no-referrer';
 let settled=false;
 const readyPromise=new Promise(resolve=>{
  const finish=ok=>{if(settled)return;settled=true;resolve(!!ok);};
  img.onload=()=>{
   const decoded=typeof img.decode==='function'?img.decode():Promise.resolve();
   Promise.resolve(decoded).catch(()=>{}).then(()=>finish(img.naturalWidth>0&&img.naturalHeight>0));
  };
  img.onerror=()=>finish(false);
  try{img.src=url;}catch{finish(false);}
 });
 img.__readyPromise=readyPromise;
 swipeImagePreloads.set(url,img);
 readyPromise.then(ok=>{if(!ok&&swipeImagePreloads.get(url)===img)swipeImagePreloads.delete(url);});
 while(swipeImagePreloads.size>12){
  const first=swipeImagePreloads.keys().next().value;
  if(first===url)break;
  swipeImagePreloads.delete(first);
 }
 return readyPromise;
}
function waitForVisualImage(src,existingImage=null,timeoutMs=1200){
 const url=String(src||'').trim();
 if(!url)return Promise.resolve(false);
 if(existingImage){
  const current=String(existingImage.currentSrc||existingImage.src||'').trim();
  if(current===url&&existingImage.complete&&existingImage.naturalWidth>0){
   return Promise.resolve(typeof existingImage.decode==='function'
    ? existingImage.decode().catch(()=>true).then(()=>true)
    : true);
  }
 }
 const ready=preloadSwipeImage(url);
 return Promise.race([
  ready,
  new Promise(resolve=>window.setTimeout(()=>resolve(false),Math.max(0,Number(timeoutMs)||0)))
 ]).then(Boolean);
}

async function waitForNextPaints(count=2){
 for(let i=0;i<count;i++)await new Promise(resolve=>requestAnimationFrame(resolve));
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

function bindSwipeCard(cardId,onCut,onMaybe){
 const card=$(cardId);
 if(!card)return;
 const bindingToken=String(Number(card.dataset.swipeBindingToken||0)+1);
 card.dataset.swipeBindingToken=bindingToken;
 const bindingStillCurrent=()=>String(card.dataset.swipeBindingToken||'')===bindingToken;

 let phase='idle',pointerId=null,downX=0,lastX=0,downY=0,lastMoveX=0,lastMoveTime=0,velocityX=0;
 let moveFrame=0,flightTimer=0,settleTimer=0,suppressClickUntil=0,hapticTriggered=false,moved=false;
 let swipeThreshold=88;

 card.style.touchAction='none';
 card.style.userSelect='none';
 card.style.webkitUserSelect='none';
 card.style.webkitTouchCallout='none';
 card.style.pointerEvents='auto';
 card.dataset.swipePhase='idle';
 card.dataset.swipeTransaction='';

 card.querySelectorAll('img').forEach(img=>{
  img.draggable=false;
  if(img.dataset.swipeDragBound==='1')return;
  img.dataset.swipeDragBound='1';
  img.addEventListener('dragstart',e=>e.preventDefault(),{passive:false});
 });

 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 const widthForSwipe=()=>Math.max(280,Number(card.clientWidth)||430);

 const cancelMoveFrame=()=>{
  if(moveFrame){cancelAnimationFrame(moveFrame);moveFrame=0;}
 };
 const clearFlightTimer=()=>{
  if(flightTimer){clearTimeout(flightTimer);flightTimer=0;}
 };
 const clearSettleTimer=()=>{
  if(settleTimer){clearTimeout(settleTimer);settleTimer=0;}
 };
 const releasePointer=()=>{
  try{
   if(pointerId!=null&&card.hasPointerCapture?.(pointerId))card.releasePointerCapture(pointerId);
  }catch(error){console.error('Dinliminate error',error)}
  pointerId=null;
 };
 const setIdleVisuals=()=>{
  cancelMoveFrame();
  clearFlightTimer();
  clearSettleTimer();
  card.classList.remove('swipe-active');
  card.style.willChange='';
  card.style.transition='';
  card.style.transform='';
  card.style.opacity='1';
  card.style.visibility='visible';
  card.style.pointerEvents='auto';
  card.style.removeProperty('--swipe-tint-alpha');
  card.dataset.swipe='';
  card.dataset.swipePhase='idle';
  card.dataset.swipeTransaction='';
  card.dataset.swipeFinalTransform='';
  phase='idle';
 };
 const settleBack=()=>{
  cancelMoveFrame();
  clearSettleTimer();
  if(phase!=='dragging')return;
  phase='settling';
  card.dataset.swipePhase='settling';
  card.style.pointerEvents='auto';
  card.style.visibility='visible';
  card.style.opacity='1';
  card.style.setProperty('--swipe-tint-alpha','0');
  card.style.willChange='transform';
  card.style.transition='transform 220ms cubic-bezier(.22,1,.36,1),opacity 180ms ease';
  void card.offsetWidth;
  card.style.transform='translate3d(0,0,0) rotate(0deg)';
  const finish=()=>{
   if(!bindingStillCurrent()||phase!=='settling')return;
   clearSettleTimer();
   setIdleVisuals();
  };
  const onEnd=e=>{
   if(e.propertyName==='transform')finish();
  };
  card.addEventListener('transitionend',onEnd,{once:true});
  settleTimer=window.setTimeout(()=>{
   card.removeEventListener('transitionend',onEnd);
   finish();
  },280);
 };
 const completeAfterExit=async(decisionId)=>{
  if(phase!=='committing'||!bindingStillCurrent())return;
  phase='completing';
  card.dataset.swipePhase='completing';
  card.style.transition='none';
  card.style.pointerEvents='none';
  card.style.willChange='transform,opacity';
  card.style.opacity='0';
  card.style.visibility='hidden';
  card.style.transform='none';
  card.style.removeProperty('--swipe-tint-alpha');
  card.classList.remove('swipe-active');
  releasePointer();
  const action=card.dataset.swipeDirection==='cut'?onCut:onMaybe;
  try{
   await Promise.resolve(action?.({fromSwipe:true,decisionId}));
  }catch(err){
   setTimeout(()=>{throw err;},0);
  }
  if(!bindingStillCurrent()||!card.isConnected)return;
  const stillSameFood=cardId==='foodCard'&&String(card.dataset.mealId||'')===String(decisionId||'');
  if(stillSameFood&&S.screen==='food')setIdleVisuals();
 };
 const finishFlight=decisionId=>{
  if(phase!=='committing'||!bindingStillCurrent())return;
  clearFlightTimer();
  card.style.transition='none';
  card.style.transform=card.dataset.swipeFinalTransform||card.style.transform;
  void card.offsetWidth;
  void completeAfterExit(decisionId);
 };
 const commit=(dx,speed=0)=>{
  if(phase!=='dragging')return;
  cancelMoveFrame();
  clearFlightTimer();
  clearSettleTimer();
  phase='committing';
  card.dataset.swipePhase='committing';
  card.dataset.swipeTransaction='active';
  card.style.pointerEvents='none';
  card.style.willChange='transform,opacity';
  hapticTriggered=false;
  suppressClickUntil=Date.now()+700;
  releasePointer();

  const width=widthForSwipe();
  const direction=dx<0?-1:1;
  const decisionKind=cardId==='foodCard'?'food':'restaurant';
  const decisionId=decisionKind==='food'
   ?String(card.dataset.mealId||'')
   :String(card.querySelector('img[data-restaurant-photo-key]')?.dataset.restaurantPhotoKey||'');
  const decisionRow=decisionKind==='food'
   ?S.pool.find(item=>String(item?.id||'')===decisionId)
   :S.restaurantPool.find(item=>String(item?.id||'')===decisionId);

  previewDecisionCount(
   decisionKind,
   direction<0?'cut':'maybe',
   decisionRow ? (decisionKind==='food'?S.maybe.has(decisionRow.id):!!decisionRow._maybe) : false
  );

  card.dataset.swipeDirection=direction<0?'cut':'maybe';
  const releaseAbs=Math.abs(dx);
  const releaseRotation=direction*clamp((releaseAbs/width)*11,0,11);
  const fromTransform='translate3d('+dx.toFixed(1)+'px,0,0) rotate('+releaseRotation.toFixed(2)+'deg)';
  const rect=card.getBoundingClientRect(),edgePadding=48;
  const remaining=direction<0?(rect.right+edgePadding):(window.innerWidth-rect.left+edgePadding);
  const targetX=direction<0?(dx-remaining):(dx+remaining);
  const targetTransform='translate3d('+targetX.toFixed(1)+'px,0,0) rotate('+((direction*11).toFixed(2))+'deg)';
  const magnitude=clamp(Math.abs(speed),0,2.4);
  const duration=Math.round(clamp(300-(magnitude*30),240,300));

  dismissSwipeHint();
  card.style.transition='none';
  card.style.opacity='1';
  card.style.visibility='visible';
  card.style.transform=fromTransform;
  card.style.setProperty('--swipe-tint-alpha',String(clamp(releaseAbs/(Math.max(72,swipeThreshold)*2.7),0,.26)));
  card.dataset.swipeFinalTransform=targetTransform;
  void card.offsetWidth;

  const finish=()=>{
   if(!bindingStillCurrent()||phase!=='committing')return;
   finishFlight(decisionId);
  };
  const onEnd=e=>{
   if(e.propertyName==='transform')finish();
  };
  card.addEventListener('transitionend',onEnd);
  requestAnimationFrame(()=>{
   if(!bindingStillCurrent()||phase!=='committing')return;
   card.style.transition='transform '+duration+'ms cubic-bezier(.20,.84,.24,1)';
   card.style.transform=targetTransform;
  });
  flightTimer=window.setTimeout(()=>{
   card.removeEventListener('transitionend',onEnd);
   finish();
  },duration+70);
 };
 card.__triggerSwipeDecision=direction=>{
  if(phase!=='idle')return 'busy';
  phase='dragging';
  card.dataset.swipePhase='dragging';
  commit(Number(direction)<0?-swipeThreshold:swipeThreshold,0);
  return 'accepted';
 };

 const paintMove=()=>{
  moveFrame=0;
  if(phase!=='dragging')return;
  const dx=lastX-downX;
  if(Math.abs(dx)<=3)return;
  const width=widthForSwipe();
  swipeThreshold=clamp(Math.round(width*.21),72,108);
  const absX=Math.abs(dx);
  const rotation=(dx<0?-1:1)*clamp((absX/width)*11,0,11);
  card.style.transform='translate3d('+dx.toFixed(1)+'px,0,0) rotate('+rotation.toFixed(2)+'deg)';
  card.style.opacity='1';
  card.style.setProperty('--swipe-tint-alpha',String(clamp(absX/(swipeThreshold*2.7),0,.26)));
  card.dataset.swipe=dx<0?'cut':'maybe';
  moved=true;
  if(absX>=swipeThreshold&&!hapticTriggered){
   hapticTriggered=true;
   triggerSwipeHaptic();
  }
 };
 const scheduleMove=()=>{
  if(moveFrame)return;
  moveFrame=requestAnimationFrame(paintMove);
 };
 const finishGesture=e=>{
  if(phase!=='dragging')return;
  if(e?.clientX!=null)lastX=e.clientX;
  cancelMoveFrame();
  const dx=lastX-downX;
  const speed=Number.isFinite(velocityX)?velocityX/1000:0;
  swipeThreshold=clamp(Math.round(widthForSwipe()*.21),72,108);
  if(Math.abs(dx)>=swipeThreshold||(Math.abs(dx)>=48&&Math.abs(speed)>=.50))commit(dx,speed);
  else{
   velocityX=0;
   releasePointer();
   settleBack();
  }
 };
 card.onpointerdown=e=>{
  if(e.isPrimary===false)return;
  if(e.button!=null&&e.button!==0)return;
  if(phase!=='idle'||card.dataset.swipeTransaction==='active')return;
  if(e.target.closest?.('button,a,input,select'))return;
  downX=e.clientX;lastX=e.clientX;downY=e.clientY;
  lastMoveX=e.clientX;lastMoveTime=performance.now();velocityX=0;moved=false;
  swipeThreshold=clamp(Math.round(widthForSwipe()*.21),72,108);
  phase='dragging';
  card.dataset.swipePhase='dragging';
  card.dataset.swipeDirection='';
  card.dataset.swipe='';
  card.classList.add('swipe-active');
  card.style.transition='none';
  card.style.opacity='1';
  card.style.visibility='visible';
  card.style.pointerEvents='auto';
  card.style.willChange='transform';
  try{card.setPointerCapture?.(e.pointerId);}catch(error){console.error('Dinliminate error',error)}
  pointerId=e.pointerId;
 };
 card.onpointermove=e=>{
  if(phase!=='dragging'||e.isPrimary===false||e.pointerId!==pointerId)return;
  const now=performance.now(),dt=Math.max(1,now-lastMoveTime);
  velocityX=((e.clientX-lastMoveX)/dt)*1000;
  lastMoveX=e.clientX;lastMoveTime=now;lastX=e.clientX;
  if(Math.abs(lastX-downX)>3){
   if(e.cancelable)e.preventDefault();
   scheduleMove();
  }
 };
 card.onpointerup=e=>finishGesture(e);
 card.onpointercancel=()=>{
  if(phase==='dragging'){velocityX=0;releasePointer();settleBack();}
 };
 card.onlostpointercapture=()=>{
  if(phase==='dragging'){velocityX=0;releasePointer();settleBack();}
 };
 card.onclick=e=>{
  if(Date.now()<suppressClickUntil){e.preventDefault();e.stopPropagation();}
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
function bindFoodSwipe(){bindSwipeCard('foodCard',()=>familyIsBrowseStage('meal')?familyBrowseNext('meal'):foodCut(undefined,{fromSwipe:true}),()=>familyIsBrowseStage('meal')?familyBrowsePrevious('meal'):foodMaybe(undefined,{fromSwipe:true}))}
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

function visibleCardDetailImage(item,type){
 const card=type==='restaurant'?$('restaurantCard'):$('foodCard');
 const img=card?.querySelector?.('img');
 if(!img)return '';
 if(type==='restaurant'){
  const key=String(item?.id||item?.canonicalId||'').trim();
  const currentKey=String(img.dataset.restaurantPhotoKey||'').trim();
  const rendered=img.complete&&img.naturalWidth>0;
  if(!key||!currentKey||key!==currentKey||!rendered)return '';
 }else{
  const key=String(item?.id||'').trim();
  const currentKey=String(card?.dataset.mealId||'').trim();
  const loaded=String(img.dataset.mealPhotoLoaded||'false')==='true';
  // The Meals card DOM node is reused. Never reuse its prior bitmap until the
  // current meal's own image has completed resolution.
  if(!key||!currentKey||key!==currentKey||!loaded)return '';
 }
 const src=String(img.currentSrc||img.src||'').trim();
 if(!src||src.startsWith('data:image/svg'))return '';
 return src;
}
function warmDetailImage(src){
 const url=String(src||'').trim();
 if(!url||url.startsWith('data:')||url.startsWith('blob:'))return;
 try{
  const img=new Image();
  img.decoding='sync';
  img.fetchPriority='high';
  img.referrerPolicy='no-referrer';
  img.src=url;
  if(typeof img.decode==='function')img.decode().catch(()=>{});
 }catch(error){console.error('Dinliminate error',error)}
}
async function detailsSheet(item,type){
 if(item?.category==='Hungry')return;
 const isRestaurant=type==='restaurant';
 const sourceCard=type==='restaurant'?$('restaurantCard'):$('foodCard');
 const sourceImage=sourceCard?.querySelector?.('img')||null;
 const cardImage=visibleCardDetailImage(item,type);
 const image=isRestaurant
  ? (cardImage||imageProxyUrl(item.image||item.photo||item.photoFallback||restaurantFallbackImage(item)))
  : (cardImage||foodPhoto(item)||mealImageUrl(item.image||item.photo||item.photoFallback||HUNGRY_IMAGE));
 // CP1280: the card is already the authoritative visual source. Do not block
 // opening Details on a second network/decode wait; warm the same URL and let
 // the modal reuse the browser's decoded resource immediately.
 warmDetailImage(image);
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
   const detailImg=modal.querySelector('.history-detail-photo');
   if(detailImg){
    detailImg.loading='eager';
    detailImg.fetchPriority='high';
    detailImg.decoding='sync';
    /* The visible card is already the authoritative rendered image. Keep the
       same resolved URL so the Details image can reuse the browser's decoded
       resource instead of starting a second photo resolution path. */
    if(cardImage && detailImg.src!==cardImage)detailImg.src=cardImage;
   }
   bindImageFallback('#detailsModal img',foodPhotoFallback(item),FINAL_FOOD_IMAGE);
   if(detailPhotos.length>1){
     let gidx=Math.max(0,Math.min(Number(item._mealPhotoIndex||0),detailPhotos.length-1));
     if(gcount)gcount.textContent=(gidx+1)+' / '+detailPhotos.length;
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
 const detailImg=modal.querySelector('.detail-restaurant-hero .history-detail-photo');
 if(detailImg){
  detailImg.loading='eager';
  detailImg.fetchPriority='high';
  detailImg.decoding='sync';
  if(cardImage && detailImg.src!==cardImage)detailImg.src=cardImage;
 }
 bindRestaurantPhotoPinch(modal.querySelector('.detail-restaurant-hero img'));
 bindImageFallback('#detailsModal img',image,restaurantFallbackImage(item));
 bindDetailNotes(modal,item,'restaurant');
 const detailHideRestaurant=$('detailHideRestaurant');
 if(detailHideRestaurant)detailHideRestaurant.onclick=async()=>{const hidden=await restaurantHide(item);if(hidden){modal.remove();$('detailsModalBg')?.remove();}};
 hydrateRestaurantWebsite(item,'#detailsModal');
}

function mealNameSimilarMatches(name,excludeId=''){
 const target=String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 if(!target)return [];
 const targetTokens=new Set(target.split(/\s+/).filter(Boolean));
 const score=(value)=>{
  const other=String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  if(!other||other===target)return other===target?1:0;
  if(other.includes(target)||target.includes(other))return .82;
  const set=new Set(other.split(/\s+/).filter(Boolean));
  let overlap=0;for(const token of targetTokens)if(set.has(token))overlap++;
  const union=new Set([...targetTokens,...set]).size;
  return union?overlap/union:0;
 };
 return allFoods().map(item=>({item,score:score(item?.name)}))
  .filter(x=>x.score>=.6&&String(x.item?.id||'')!==String(excludeId||''))
  .sort((a,b)=>b.score-a.score)
  .slice(0,3).map(x=>x.item?.name).filter(Boolean);
}
async function requestMealAutofill(name,options={}){
 const section=String(options.section||'all');
 const response=await fetch('/api/meal-autofill',{
  method:'POST',
  headers:{'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify({
   name:String(name||'').trim(),
   section,
   cuisineOptions:foodQuickLabels(),
   mealTimeOptions:mealTimeNames(),
   current:options.current&&typeof options.current==='object'?options.current:{}
  }),
  cache:'no-store'
 });
 let data=null;try{data=await response.json();}catch(error){console.error('Dinliminate error',error)}
 if(!response.ok||!data?.ok)throw new Error(data?.message||'Meal Auto-Fill could not complete that request.');
 return data;
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
'<div class="meal-editor-name-row"><input id="editFoodName" placeholder="Meal name" required value="'+esc(item?.name||'')+'"><button type="button" class="meal-autofill-action" id="editFoodAutoFill">Auto-Fill Meal</button></div><small id="editFoodDuplicateHint" class="meal-editor-duplicate-hint" aria-live="polite"></small><div id="editFoodAutoFillStatus" class="meal-autofill-status" aria-live="polite"></div>'+'<fieldset class="quick-cut-editor meal-category-editor"><legend>Cuisine Cuts <button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="cuisine">Refresh</button></legend><p class="meal-category-helper">Choose every cuisine category or food type you want this meal associated with. Custom adds a reusable Cuisine Cut with its own name and photo.</p><div id="editFoodQuickCuts" class="quick-cut-editor-grid custom-taxonomy-grid"></div></fieldset><fieldset class="quick-cut-editor meal-time-editor"><div class="meal-time-editor-head"><span class="meal-time-editor-title">Meal Times</span><span class="meal-time-editor-actions"><button type="button" class="meal-time-edit-toggle" id="editMealTimesManage" aria-expanded="false">Edit Meal Times</button><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="mealTimes">Refresh</button></span></div><p class="meal-category-helper">Choose one or more Meal Times for this meal.</p><div id="editFoodMealTime" class="quick-cut-editor-grid meal-time-editor-grid"></div><div id="editFoodMealTimeManager" class="food-editor-meal-time-manager hidden" aria-label="Edit Meal Times"></div></fieldset>'+
'<div class="meal-editor-section"><div class="meal-editor-section-head"><div class="meal-editor-section-title">Nutrition per serving</div><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="nutrition">Refresh</button></div><p class="meal-editor-helper">Nutrition is an estimate based on a typical serving.</p><small id="editFoodNutritionBasis" class="meal-autofill-basis" aria-live="polite"></small><div class="meal-nutrition-editor-grid">'+
'<label>Calories<input id="editFoodCalories" type="number" min="0" step="1" inputmode="numeric" placeholder="520" value="'+esc(nut.calories??'')+'"><span>kcal</span></label>'+
'<label>Protein<input id="editFoodProtein" type="number" min="0" step="0.1" inputmode="decimal" placeholder="27" value="'+esc(nut.protein??'')+'"><span>g</span></label>'+
'<label>Carbs<input id="editFoodCarbs" type="number" min="0" step="0.1" inputmode="decimal" placeholder="46" value="'+esc(nut.carbs??'')+'"><span>g</span></label>'+
'<label>Fat<input id="editFoodFat" type="number" min="0" step="0.1" inputmode="decimal" placeholder="25" value="'+esc(nut.fat??'')+'"><span>g</span></label>'+
'<label>Sodium<input id="editFoodSodium" type="number" min="0" step="1" inputmode="numeric" placeholder="1050" value="'+esc(nut.sodium??'')+'"><span>mg</span></label>'+
'</div></div>'+
'<div class="meal-editor-text-label"><div class="meal-editor-text-head"><span>About this meal</span><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="description">Refresh</button></div><textarea id="editFoodDescription" placeholder="A short description of the meal (optional)" rows="3">'+esc(descriptionText)+'</textarea></div>'+
'<div class="meal-editor-text-label"><div class="meal-editor-text-head"><span>Ingredients</span><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="ingredients">Refresh</button></div><textarea id="editFoodIngredients" placeholder="One ingredient per line" rows="5">'+esc(ingredientsText)+'</textarea></div>'+
'<div class="meal-editor-text-label"><div class="meal-editor-text-head"><span>Recipe / preparation</span><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="recipe">Refresh</button></div><textarea id="editFoodRecipe" placeholder="Preparation steps or recipe (optional)" rows="5">'+esc(item?.recipe||'')+'</textarea></div>'+(isEdit?'<section class="meal-editor-note-section"><div class="meal-editor-note-copy"><b>Add a note</b><small>Private to this device. Keep a reminder, favorite, or thought with this meal.</small></div><textarea id="editFoodNote" maxlength="1200" rows="3" placeholder="Write a note about this meal…">'+esc(itemNote(item,'food'))+'</textarea></section>':'')+
'<div class="meal-editor-photo-section"><div class="meal-editor-photo-copy"><div class="meal-editor-photo-head"><b>'+(isEdit?'Replace meal photo':'Photo from iPhone/device')+'</b><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="photo">Find Another</button></div><small>'+(isEdit?'Add more photos, reorder them, or leave the existing order unchanged. The first photo is the Cover shown on the meal card and result.':'Upload a photo from your device, or paste a photo URL below.')+'</small><small id="editFoodPhotoStatus" class="meal-autofill-basis" aria-live="polite"></small></div><label class="file-label"><span>Add Photos</span><input id="editFoodFile" type="file" accept="image/*" multiple></label></div>'+'<input id="editFoodPhoto" placeholder="Photo URL (optional)" inputmode="url" value="'+esc(item?.image && !String(item.image).startsWith('idb:') && !String(item.image).startsWith('data:image/')?item.image:'')+'">'+
'<button class="cut">'+(isEdit?'Save Meal':'Add Meal')+'</button></form>';

const modal=openModal('foodEditorModal',isEdit?'Edit Meal':'Add Meal',body);
const autoFillButton=$('editFoodAutoFill');
const autoFillStatus=$('editFoodAutoFillStatus');
const duplicateHint=$('editFoodDuplicateHint');
const nutritionBasis=$('editFoodNutritionBasis');
const photoStatus=$('editFoodPhotoStatus');
const foodNameInput=$('editFoodName');
const readAutofillCurrent=()=>{
 const numeric=id=>{const value=String($(id)?.value||'').trim();return value===''?'':Number(value)};
 return {
  cuisine:[...document.querySelectorAll('input[name="editQuickCut"]:checked')].map(x=>String(x.value||'').trim()).filter(Boolean),
  mealTimes:[...document.querySelectorAll('input[name="editMealTime"]:checked')].map(x=>String(x.value||'').trim()).filter(Boolean),
  description:String($('editFoodDescription')?.value||'').trim(),
  ingredients:String($('editFoodIngredients')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),
  recipe:String($('editFoodRecipe')?.value||'').trim(),
  nutrition:{calories:numeric('editFoodCalories'),protein:numeric('editFoodProtein'),carbs:numeric('editFoodCarbs'),fat:numeric('editFoodFat'),sodium:numeric('editFoodSodium')},
  photo:String($('editFoodPhoto')?.value||'').trim(),
  photos:[...editorPhotos]
 };
};
const setChecked=(selector,values)=>{
 const wanted=new Set((Array.isArray(values)?values:[]).map(x=>String(x||'').trim()));
 if(!wanted.size)return;
 document.querySelectorAll(selector).forEach(input=>{input.checked=wanted.has(String(input.value||'').trim());});
};
const setAutofillStatus=(message,state='')=>{
 if(!autoFillStatus)return;
 autoFillStatus.textContent=message||'';
 autoFillStatus.dataset.state=state;
};
const refreshDuplicateHint=()=>{
 if(!duplicateHint)return;
 const matches=mealNameSimilarMatches(foodNameInput?.value||'',item?.id||'');
 duplicateHint.textContent=matches.length?'Similar meal already in your library: '+matches.join(', '):'';
};
const applyMealAutofill=(data,section)=>{
 const draft=data?.draft||{};
 if((section==='all'||section==='cuisine')&&Array.isArray(draft.cuisine)&&draft.cuisine.length)setChecked('input[name="editQuickCut"]',draft.cuisine);
 if((section==='all'||section==='mealTimes')&&Array.isArray(draft.mealTimes)&&draft.mealTimes.length)setChecked('input[name="editMealTime"]',draft.mealTimes);
 if((section==='all'||section==='description')&&String(draft.description||'').trim())$('editFoodDescription').value=draft.description;
 if((section==='all'||section==='ingredients')&&Array.isArray(draft.ingredients)&&draft.ingredients.length)$('editFoodIngredients').value=draft.ingredients.join('\n');
 if((section==='all'||section==='recipe')&&String(draft.recipe||'').trim())$('editFoodRecipe').value=draft.recipe;
 if((section==='all'||section==='nutrition')&&draft.nutrition){
  const n=draft.nutrition;
  if(n.calories!=='')$('editFoodCalories').value=n.calories;
  if(n.protein!=='')$('editFoodProtein').value=n.protein;
  if(n.carbs!=='')$('editFoodCarbs').value=n.carbs;
  if(n.fat!=='')$('editFoodFat').value=n.fat;
  if(n.sodium!=='')$('editFoodSodium').value=n.sodium;
  if(nutritionBasis)nutritionBasis.textContent=draft.nutritionBasis?'Nutrition estimate · '+draft.nutritionBasis:'Nutrition estimate · Typical serving';
 }
 if(section==='all'||section==='photo'){
  const photo=data?.photo?.url||'';
  if(photo){
   editorPhotos=dedupeMealPhotos([photo,...editorPhotos],8);
   $('editFoodPhoto').value=photo;
   if(photoStatus)photoStatus.textContent=(data?.photo?.provider||'')?String(data.photo.provider).replace(/^./,c=>c.toUpperCase())+' photo selected · '+String(data.photo.query||''):'Photo selected';
   if(typeof renderMealPhotos==='function')renderMealPhotos();
  }else if(photoStatus)photoStatus.textContent='No strong exact-match Pexels or Unsplash photo found. Add one manually.';
 }
};
const runMealAutofill=async(section='all')=>{
 if(!MEAL_AUTOFILL_ENABLED)return;
 const name=String(foodNameInput?.value||'').trim();
 if(!name){foodNameInput?.focus();setAutofillStatus('Enter a meal name first.','error');return;}
 const targetButton=section==='all'?autoFillButton:modal.querySelector('[data-meal-autofill-refresh="'+section+'"]');
 if(targetButton){targetButton.disabled=true;targetButton.dataset.originalLabel=targetButton.textContent;targetButton.textContent=section==='photo'?'Finding…':section==='all'?'Filling…':'Refreshing…';}
 if(section==='all')setAutofillStatus('Preparing a meal draft…');
 try{
  const data=await requestMealAutofill(name,{section,current:readAutofillCurrent()});
  applyMealAutofill(data,section);
  if(section==='all'){
   const duplicate=mealNameSimilarMatches(name,item?.id||'');
   setAutofillStatus((data?.photo?.url?'Meal draft ready to review.':'Meal draft ready to review; no strong exact-match photo was found.')+(duplicate.length?' · '+duplicate[0]+' is similar in your library.':''),data?.photo?.url?'success':'notice');
  }
 }catch(error){
  const message=String(error?.message||'Meal Auto-Fill could not complete that request.');
  if(section==='all')setAutofillStatus(message,'error');else appToast(message);
 }finally{
  if(targetButton){targetButton.disabled=false;targetButton.textContent=targetButton.dataset.originalLabel||'Refresh';}
 }
};
autoFillButton?.addEventListener('click',()=>runMealAutofill('all'));
foodNameInput?.addEventListener('input',refreshDuplicateHint);
refreshDuplicateHint();
modal.querySelectorAll('[data-meal-autofill-refresh]').forEach(btn=>btn.addEventListener('click',()=>runMealAutofill(String(btn.dataset.mealAutofillRefresh||''))));

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
const nutrition={
 calories:nutritionValues.calories===''?0:nutritionValues.calories,
 protein:nutritionValues.protein===''?0:nutritionValues.protein,
 carbs:nutritionValues.carbs===''?0:nutritionValues.carbs,
 fat:nutritionValues.fat===''?0:nutritionValues.fat,
 sodium:nutritionValues.sodium===''?0:nutritionValues.sodium
};
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
 '<section class="settings-section"><div class="settings-section-kicker">APP</div><div class="settings-actions">'+
 settingsActionButton('updateApp','↻','Update','Check for and load the latest Dinliminate build.','update-action')+
 settingsActionButton('privacySettings','◇','Privacy','How location, history, notes, images, and third-party services are handled.','privacy-action')+
 settingsActionButton('restoreApp','↺','Restore','Return built-in meals to their original catalog state.','restore-action')+
 settingsActionButton('resetApp','×','Reset','Erase all Dinliminate data stored on this device.','reset-action danger-action')+
 '</div></section>'+
 '<section class="settings-section settings-about-section"><div class="settings-section-kicker">ABOUT DINLIMINATE</div><div class="settings-about-copy"><p>Cut the dinner choices until one survives.</p></div><div class="about-meta"><p><span>Version</span><b>'+esc(APP_VERSION)+'</b></p><p><span>Build</span><b>'+esc(APP_BUILD)+'</b></p><p><span>Date</span><b>'+esc(new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(new Date(APP_BUILD_DATE+'T12:00:00')))+'</b></p></div><p class="about-credit">Made by Brian Dunn for Devona Dunn</p></section>'+
 '</div>';
 const modal=openModal('settingsModal','Settings',body);
 modal.querySelectorAll('[data-setting-rest]').forEach(btn=>btn.onclick=()=>{const id=btn.dataset.settingRest;delete S.hiddenRestaurants[id];const row=S.restaurantPool.find(x=>x.id===id);if(row)row._hidden=false;save();modal.remove();$('settingsModalBg')?.remove();settingsView();});
 $('updateApp').onclick=async()=>{modal.remove();$('settingsModalBg')?.remove();await updateAppFlow();};
 $('resetApp').onclick=async()=>{modal.remove();$('settingsModalBg')?.remove();await resetAppDataFlow();};
 $('restoreApp').onclick=async()=>{modal.remove();$('settingsModalBg')?.remove();await systemRestoreFlow();};
 $('privacySettings').onclick=()=>privacyView();
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
  Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}))).then(()=>setTimeout(()=>{try{w.focus();w.print();}catch(error){console.error('Dinliminate error',error)}},250));
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
 }catch(error){console.error('Dinliminate error',error)}
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
  }catch(error){console.error('Dinliminate error',error)}
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
  }catch(error){console.error('Dinliminate error',error)}
  for(const key of [...storedPhotoIds])if(key===target||String(key).startsWith(target+':photo:'))storedPhotoIds.delete(key);
}
async function clearAllDinliminateStorage(){
  try{stopFamilyLobbyPolling();}catch(error){console.error('Dinliminate error',error)}
  try{familySessionClear();}catch(error){console.error('Dinliminate error',error)}
  try{
    const keys=[];
    for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&key.startsWith('dinliminate.'))keys.push(key);}
    keys.forEach(key=>localStorage.removeItem(key));
  }catch(error){console.error('Dinliminate error',error)}
  try{restaurantWebsiteCache.clear();restaurantWebsiteInflight.clear();}catch(error){console.error('Dinliminate error',error)}
  try{
    restaurantPhotoCache.forEach(data=>{if(String(data?.url||'').startsWith('blob:')){try{URL.revokeObjectURL(data.url)}catch(error){console.error('Dinliminate error',error)}}});
    restaurantPhotoCache.clear();restaurantPhotoMissCache.clear();restaurantPhotoInflight.clear();restaurantPhotoStoragePromise=null;
  }catch(error){console.error('Dinliminate error',error)}
  try{storedPhotoIds.clear();}catch(error){console.error('Dinliminate error',error)}
  try{
    const db=await openPhotoDB();
    await new Promise(resolve=>{
      const tx=db.transaction(PHOTO_STORE,'readwrite');
      tx.objectStore(PHOTO_STORE).clear();
      tx.oncomplete=resolve;tx.onerror=resolve;tx.onabort=resolve;
    });
  }catch(error){console.error('Dinliminate error',error)}
  try{
    if('caches' in window){
      const names=await caches.keys();
      await Promise.all(names.filter(name=>name.startsWith('dinliminate')).map(name=>caches.delete(name)));
    }
  }catch(error){console.error('Dinliminate error',error)}
  try{
    if('serviceWorker' in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg=>reg.unregister()));
    }
  }catch(error){console.error('Dinliminate error',error)}
}
function resetRound(){
  S.hungryWheelSpinToken++;S.hungryWheelSpinning=false;S.hungryWheelChoice=null;S.hungryWheelRotation=0;S.hungryWheelDisplayItems=null;S.hungryWheelLandedId=null;S.hungryWheelSpinPhase='idle';S.hungryWheelVelocity=0;S.hungryWheelFrame=null;
  S.winnerItem=null;S.winnerType='food';S.foodActions=[];S.restaurantActions=[];S.foodHistory=[];S.restaurantHistory=[];S.maybe.clear();S.foodMaybeRound=false;S.cutCats.clear();S.foodCuts.clear();S.restaurantCuts.clear();S.restaurantMaybeRound=false;
  S.pool=[];S.restaurantPool=[];S.restaurantSearchOrigin=null;S.index=0;S.restaurantIndex=0;S.restaurantQuery='';S.restaurantHours='all';S.restaurantHoursCollapsed=true;S.restaurantSearchKey='';S.restaurantSearchDegraded=false;S.saved=false;
  try{localStorage.removeItem(KEY);}catch(error){console.error('Dinliminate error',error)}
  home();
}
async function updateAppFlow(){
 appToast('Checking for updates…');
 try{
  const registrations=await navigator.serviceWorker?.getRegistrations?.()||[];
  await Promise.all(registrations.map(reg=>reg.update().catch(()=>{})));
 }catch(error){console.error('Dinliminate error',error)}
 try{
  const url=new URL(window.location.href);
  url.searchParams.set('_update',String(Date.now()));
  window.location.replace(url.toString());
 }catch{
  window.location.reload();
 }
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
  S.pool=[];S.restaurantPool=[];S.index=0;S.restaurantIndex=0;S.foodActions=[];S.restaurantActions=[];S.foodHistory=[];S.restaurantHistory=[];S.winnerItem=null;S.winnerType='food';S.location=null;S.locationSource='none';S.locationFreshAt=null;S.restaurantSearchOrigin=null;S.restaurantSearchKey='';S.restaurantQuery='';S.restaurantHours='all';S.restaurantHoursCollapsed=true;S.restaurantSearchDegraded=false;S.storageWarning=false;S.saved=false;S.custom=[];S.notes={};
  S.familyNormalMode='idle';S.familyDecisionType='';S.familyNormalRoundId='';S.familyNormalStage=0;S.familyNormalAutoResume=false;S.familyNormalVoteBusy=false;S.familyActiveData=null;S.familyVotedIds=new Set();S.familyBrowseHistory=[];S.familyCompareBothMode='';S.familyCompareBothGroupId='';S.familyCompareBothMealWinner=null;S.familyVoteBusy=false;S.familyPollBusy=false;S.familyPollTimer=0;
  try{location.hash='';}catch(error){console.error('Dinliminate error',error)}
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
    event.preventDefault();
    event.stopImmediatePropagation();
    stopTutorialMode();
    tutorialHideOverlay();
    closeDrawer?.(true);
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
  try{navigate?.();}catch(error){console.error('Dinliminate error',error)}
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
    const build = encodeURIComponent(String(APP_BUILD));
    const desiredSuffix = `?v=${build}`;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => {
      const script = String(reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '');
      return script && !script.endsWith(desiredSuffix) ? reg.unregister() : Promise.resolve(false);
    }));
    const reg = await navigator.serviceWorker.register(`./sw.js${desiredSuffix}`, { updateViaCache: 'none' });
    await reg.update().catch(() => {});
  } catch(error){console.error('Dinliminate error',error)}
});
bindMealPhotoCountControls();
load();
renderLocationSource();
renderFindButton();
updateStorageIndicator();
hydrateCustomPhotos().then(()=>migrateCustomPhotos()).catch(()=>{});

/* CP1279 — deep transition audit:
   Prime the first persisted/default media while Home is still covering the app.
   Decision screens are rendered behind the boot mask and are not revealed until
   their first visible media path has settled. No fixed delay is added. */
try{
 const firstMeal=foodBasePool()?.[0];
 const firstMealSrc=firstMeal?(foodPhoto(firstMeal)||foodPhotoFallback(firstMeal)||FINAL_FOOD_IMAGE):'';
 if(firstMealSrc)preloadSwipeImage(firstMealSrc);
 const firstRestaurant=restaurantPoolFiltered()?.[S.restaurantIndex||0];
 if(firstRestaurant)loadRestaurantPhoto(firstRestaurant).then(data=>{if(data?.url)waitForRestaurantPhotoDecoded(data.url).catch(()=>{});}).catch(()=>{});
}catch(error){console.error('Dinliminate error',error)}

(async()=>{
 if (S.saved && S.screen === 'food' && S.pool.length) {
  show('food');
  foodQuick();
  drawFood({deferPrime:true});
  primeFoodSwipeMedia();
 } else if (S.saved && S.screen === 'restaurant' && S.restaurantPool.length) {
  show('restaurant');
  restaurantQuick();
  await drawRestaurants({startup:true});
 } else {
  home();
 }
 await waitForNextPaints(2);
 document.documentElement.classList.remove('dinliminate-booting');
 document.documentElement.classList.add('dinliminate-ready');
})();
/* CP851 — Family Mode reuses the existing Meal / Restaurant screens. */
const FAMILY_SESSION_KEY='dinliminate.family.v1';

function familySessionRead(){try{const d=JSON.parse(localStorage.getItem(FAMILY_SESSION_KEY)||'null');return d&&typeof d.token==='string'&&d.token?d:null;}catch{return null;}}
function familySessionWrite(value){try{localStorage.setItem(FAMILY_SESSION_KEY,JSON.stringify(value));}catch(error){console.error('Dinliminate error',error)}}
function familySessionClear(){try{localStorage.removeItem(FAMILY_SESSION_KEY);}catch(error){console.error('Dinliminate error',error)}}
function familySetStatus(id,message,kind=''){const el=$(id);if(!el)return;el.textContent=message||'';el.dataset.state=kind;}
async function familyApi(action,payload={}){const response=await fetch('./api/family',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action,...payload})});let data=null;try{data=await response.json();}catch(error){console.error('Dinliminate error',error)}if(!response.ok||!data?.ok){const e=new Error(data?.message||'Family Mode could not complete that request.');e.code=data?.code||'FAMILY_REQUEST_FAILED';e.status=response.status;throw e;}return data;}

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
 if(type==='meal'){S.foodActions=[];S.foodHistory=[];S.maybe.clear();S.foodMaybeRound=false;S.foodCuts.clear();S.cutCats.clear();S.maybeDeck=false;S.pool=stageData.remaining.map(x=>({...x}));S.index=0;show('food');foodQuick();drawFood();familyNormalBar('meal','decision',data);}else{S.restaurantActions=[];S.restaurantHistory=[];S.restaurantMaybeRound=false;S.restaurantCuts.clear();S.maybeDeck=false;S.restaurantQuery='';S.restaurantHours='all';S.restaurantHoursCollapsed=true;S.restaurantSearchKey='';S.restaurantSearchDegraded=false;S.restaurantPool=stageData.remaining.map(x=>({...x,_cut:false,_maybe:false}));S.restaurantIndex=0;show('restaurant');restaurantQuick();drawRestaurants();familyNormalBar('restaurant','decision',data);}
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


configureTutorial({show,startFood,openRestaurant,winner,closeDrawer});
bindTutorialUI();

configureStorage({$,restaurantCanonicalId,allFoods,normKey,mealPhotoList,dedupeMealPhotos,DEFAULT_FOOD_IMAGE,ensureMealTimeSettings,mealTimeNames,currentMealTimeName,STORAGE_VERSION,KEY});
configureMigrations({loadItemNotes,ensureMealTimeSettings,mealTimeNames,currentMealTimeName,mealPhotoList,normKey,DEFAULT_FOOD_IMAGE,STORAGE_VERSION,KEY});

export { HISTORY_KEY };

export { RESTAURANT_PHOTO_PREFETCH_COUNT, RESTAURANT_NAME_GENERIC_UI, RESTAURANT_NAME_VARIANT_BLOCKERS_UI, HUNGRY_IMAGE, FINAL_RESTAURANT_IMAGE };


export { show, startFood, openRestaurant, winner, closeDrawer };
