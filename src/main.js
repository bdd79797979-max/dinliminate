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
import { clearLegacySwipeInstructions, dismissSwipeHint, maybeShowInCardSwipeCoach, setChoiceCount, foodChoiceIndex, drawFood, foodCommit, foodCut, foodMaybe, resolveFoodAfterDecision, foodBack, triggerSwipeHaptic, waitForSwipeImage, stageSwipePreview, nextFoodIndexList, buildPreparedFoodCard, cachePreparedFoodCards, ensurePreparedFoodNextCardMarkup, setFoodNextCardImage, populateFoodNextCard, prepareFoodNextCard, preloadSwipeImage, waitForVisualImage, primeFoodSwipeMedia, bindRestaurantPhotoPinch, bindSwipeCard, bindFoodSwipe, startFood, waitForNextPaints } from './features/swipe/index.js';

import { ensureMealTimeSettings, mealTimeCatalog, mealTimeOptions, mealTimeNames, mealTimeDefinition, currentMealTimeName, syncMealTimeReferences, mealTimesFor, mealTimeFor, foodBasePool, foodPool, buildFood, setMaybeDeck, allChoiceRows, choiceDeckRows, maybeDeckRows, maybeDeckCount, allDeckCount, renderMaybeDeckToggle, bindMaybeDeckToggle, renderRestaurantHours, bindRestaurantHours, renderQuickCutsCollapse, bindQuickCutsCollapse, mealTimeFilterNames, normalizeMealTimeFilter, renderMealTimeCuts, bindMealTimeCuts, foodQuick, mealNameSimilarMatches, selectedMealTimesFromEditor, renderFoodEditorMealTimes, renameMealTimeInFoodEditor, addMealTimeInFoodEditor, moveMealTimeInFoodEditor, toggleMealTimeInFoodEditor, foodEditor, deletedFoodRows, restoreDeletedMeal, manageFoodsView } from './features/meals/index.js';
import { settingsActionButton, settingsView, privacyView, exportHistoryPrint, exportPdfView, shareWinner, resetRound, resetRestoreView, copyAppUrl, addToPhoneFlow, shareApp, clearMealPhotoStorage, clearAllDinliminateStorage, updateAppFlow, resetAppDataFlow, systemRestoreFlow } from './features/settings/index.js';
import { milesBetween, restaurantAddressFamily, restaurantNameTokensUI, restaurantNameFamily, restaurantNameCoreTokensUI, restaurantNameCoreMatchUI, restaurantNameSimilarityUI, restaurantAddressKeyUI, restaurantAddressSimilarityUI, restaurantStreetFamily, addressHasStreetNumber, restaurantNameVariantMatchUI, restaurantPhotoQualityScore, dedupeRestaurantPool, restaurantCanonicalId, restaurantHidden, restaurantSearchText, restaurantIsFastFood, restaurantCuisineTags, restaurantCuisineEvidence, restaurantCategory, restaurantQuickMatches, restaurantCategorySearchMatches, restaurantSearchTermMatches, restaurantMatchesQuery, restaurantClockParts, restaurantHoursState, restaurantHoursMatches, restaurantPoolHourFiltered, restaurantChoiceIndex, restaurantPoolBase, restaurantPoolFiltered, updateRestaurantStatus, restaurantQuick, renderLocationSource, displayRestaurantLocationLabel, setLocation, renderFindButton, setFindBusy, setLocationBusy, requestBrowserPosition, locationMovedMiles, invalidateAddressSuggestions, addressLooksComplete, renderSuggestions, clearSuggestions, moveSuggestion, openRestaurant, restaurantBack, bindCardButton, bindRestaurantSwipe, scheduleRestaurantProviderSearch, renderRestaurantSearchControl, collapseRestaurantSearch, setRestaurantRefinePanel, closeRestaurantSearch, bindRestaurantTools, reverseLocationLabel, useLocation, maybeAutoRefreshRestaurantLocation, chooseAddressSuggestion, suggestAddresses, enrichRestaurantHoursForOpenNow, responseJson, fetchRestaurantEndpoint, searchRestaurants, drawRestaurants, restaurantCut, restaurantMaybe, restaurantHide } from './features/restaurants/index.js';
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
function foodHideItem(item) {
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


export { foodQuickImage, bindImageFallbackAttrs, drawFood, imageProxyUrl, normalizeMealPhotoRef, dedupeMealPhotos, mealPhotoList, customQuickCutImage, show, openModal, readImageFile };

export { show, startFood, openRestaurant, winner, closeDrawer };
