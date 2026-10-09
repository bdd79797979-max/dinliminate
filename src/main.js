
import { FOODS } from '../data/foods.js';
import RESTAURANT_TAXONOMY from './data/restaurant-taxonomy.js';
import { store } from './state/store.js';
const S = store.get();
import { $, readImageFile } from './ui/dom.js';
import { imageProxyUrl, mealImageUrl } from './api/client.js';
import { esc } from './ui/esc.js';
import { configureModal, appToast, appConfirm, openModal, bindDetailNotes, visibleCardDetailImage, warmDetailImage, detailsSheet } from './ui/modal.js';
import { configureStorage, save, loadItemNotes, saveItemNotes, itemNoteKey, itemNote, setItemNote, openPhotoDB, putStoredPhoto, getStoredPhoto, deleteStoredPhoto, mealPhotoStorageKey, pruneMealPhotoKeys, storeMealPhotoSet, hydrateStoredMealPhotoList, hydrateCustomPhotos, updateStorageIndicator, migrateCustomPhotos } from './state/storage.js';
import { configureMigrations, load } from './state/migrations.js';
import { historyImageSource, recordHistory, readHistory, writeHistory, historyView, HISTORY_KEY } from './features/history/index.js';
import { hideCelebration, triggerCelebration, triggerWinnerMoment, wheelPoint, sampleHungryWheel, renderHungryWheel, hungryWheelPool, showHungryWheelResult, hungryRestaurantPool, hungryRestaurantPick, renderHungryRestaurantMystery, startHungryRestaurantMystery, revealHungryRestaurant, tryAnotherHungryRestaurant, finishHungryWheelRotation, startContinuousWheelSpin, slowAndStopHungryWheel, spinHungryWheel, winner } from './features/winner/index.js';
import { clearLegacySwipeInstructions, dismissSwipeHint, maybeShowInCardSwipeCoach, setChoiceCount, foodChoiceIndex, drawFood, foodCommit, foodCut, foodMaybe, resolveFoodAfterDecision, foodBack, waitForSwipeImage, stageSwipePreview, nextFoodIndexList, buildPreparedFoodCard, cachePreparedFoodCards, ensurePreparedFoodNextCardMarkup, setFoodNextCardImage, populateFoodNextCard, prepareFoodNextCard, preloadSwipeImage, waitForVisualImage, primeFoodSwipeMedia, bindRestaurantPhotoPinch, bindSwipeCard, bindFoodSwipe, startFood, waitForNextPaints } from './features/swipe/index.js';

import { ensureMealTimeSettings, mealTimeCatalog, mealTimeOptions, mealTimeNames, mealTimeDefinition, currentMealTimeName, syncMealTimeReferences, mealTimesFor, mealTimeFor, foodBasePool, foodPool, buildFood, setMaybeDeck, allChoiceRows, choiceDeckRows, maybeDeckRows, maybeDeckCount, allDeckCount, renderMaybeDeckToggle, bindMaybeDeckToggle, renderRestaurantHours, bindRestaurantHours, renderQuickCutsCollapse, bindQuickCutsCollapse, mealTimeFilterNames, normalizeMealTimeFilter, renderMealTimeCuts, bindMealTimeCuts, foodQuick, mealNameSimilarMatches, selectedMealTimesFromEditor, renderFoodEditorMealTimes, renameMealTimeInFoodEditor, addMealTimeInFoodEditor, moveMealTimeInFoodEditor, toggleMealTimeInFoodEditor, foodEditor, deletedFoodRows, restoreDeletedMeal, manageFoodsView } from './features/meals/index.js';
import { familySessionRead, familySessionWrite, familySessionClear, familySetStatus, familyShowEntry, familyShowCreate, familyShowJoin, familyDisplayMemberList, familyEnsureNormalBar, familyNormalBar, familyDefaultDinnerTime, familyDinnerTargetIso, familyChooseNormalType, familyBuildNormalSnapshot, familyBeginNormalDecision, familyNormalStagePool, familyIsBrowseStage, familyBrowseSource, familyBrowseSubmitted, familyBrowseRender, familyBrowseNext, familyBrowsePrevious, familyBrowseBack, familyRoundStage, familyRoundCopy, familySetDecisionAction, familySwipeInstruction, familySetWinnerMeta, familyHideWinnerMeta, familyShowNoWinner, familyResetCompareState, familyRestartFromNoWinner, familyRestartAfterWinner, familyContinueCompareRestaurant, familyNormalBack, familyDecisionBack, familyShowWinner, handleWinnerRestart, familyDismissWinner, familyRenderState, startFamilyLobbyPolling, stopFamilyLobbyPolling, familyBackFromMode, familyApi, familyStartRoundFromNormal, familyEnterMaybes, familyPickSingle, familyCreateCompareFinal, familyCreate, familyJoin, familyCopyCode, familyShareCode, familyOpen, familyEndDinner, familyLeave, familyRotateCode } from './features/family/index.js';
import { settingsActionButton, settingsView, privacyView, exportHistoryPrint, exportPdfView, shareWinner, resetRound, resetRestoreView, copyAppUrl, addToPhoneFlow, shareApp, clearMealPhotoStorage, clearAllDinliminateStorage, updateAppFlow, resetAppDataFlow, systemRestoreFlow } from './features/settings/index.js';
import { milesBetween, restaurantAddressFamily, restaurantNameTokensUI, restaurantNameFamily, restaurantNameCoreTokensUI, restaurantNameCoreMatchUI, restaurantNameSimilarityUI, restaurantAddressKeyUI, restaurantAddressSimilarityUI, restaurantStreetFamily, addressHasStreetNumber, restaurantNameVariantMatchUI, restaurantPhotoQualityScore, dedupeRestaurantPool, restaurantCanonicalId, restaurantHidden, restaurantSearchText, restaurantIsFastFood, restaurantCuisineTags, restaurantCuisineEvidence, restaurantCategory, restaurantQuickMatches, restaurantCategorySearchMatches, restaurantSearchTermMatches, restaurantMatchesQuery, restaurantClockParts, restaurantHoursState, restaurantHoursMatches, restaurantPoolHourFiltered, restaurantChoiceIndex, restaurantPoolBase, restaurantPoolFiltered, updateRestaurantStatus, restaurantQuick, renderLocationSource, displayRestaurantLocationLabel, setLocation, renderFindButton, setFindBusy, setLocationBusy, requestBrowserPosition, locationMovedMiles, invalidateAddressSuggestions, addressLooksComplete, renderSuggestions, clearSuggestions, moveSuggestion, openRestaurant, restaurantBack, bindCardButton, bindRestaurantSwipe, scheduleRestaurantProviderSearch, renderRestaurantSearchControl, collapseRestaurantSearch, setRestaurantRefinePanel, closeRestaurantSearch, bindRestaurantTools, reverseLocationLabel, useLocation, maybeAutoRefreshRestaurantLocation, chooseAddressSuggestion, suggestAddresses, enrichRestaurantHoursForOpenNow, responseJson, fetchRestaurantEndpoint, searchRestaurants, drawRestaurants, restaurantCut, restaurantMaybe, restaurantHide, bindRestaurantAddressInputs } from './features/restaurants/index.js';
import { tutorialStepsForScreen, tutorialUnionRect, tutorialTargetRect, tutorialBlockerRects, tutorialPosition, renderTutorialStep, tutorialNavigateTo, startTutorialForScreen, tutorialEnterDecisionScreen, tutorialMarkHomeChoice, tutorialMarkChoose, tutorialWinnerRestart, advanceTutorial, tutorialTargetHit, tutorialAdvanceFromTarget, tutorialCurrentTargetForEvent, tutorialBlockPointer, tutorialHandlePointerUp, tutorialHandlePointerCancel, tutorialHighlightedTargetClick, bindTutorialUI, tutorialInvalidateTransition, tutorialState } from './features/tutorial/index.js';

'use strict';
// CP954 restaurant first-paint restoration: exact/direct venue photos win before generic fallback.
// CP945 photo-pipeline release sync: canonical Restaurant photo handoff + cache revision.
const getDefaultFoods = () => Array.isArray(FOODS) ? FOODS : [];
function normalizeChocolateCoveredPeanutsPhoto(){
 const id=CHOCOLATE_COVERED_PEANUTS_ID,photo=CHOCOLATE_COVERED_PEANUTS_PHOTO;
 let changed=false;
 for(const collection of [S.custom,S.deletedCustomMeals]){
  if(!Array.isArray(collection))continue;
  for(const item of collection){
   if(String(item?.id||'')!==id)continue;
   if(item.image!==photo){item.image=photo;changed=true;}
   if(!Array.isArray(item.images)||item.images.length!==1||item.images[0]!==photo){item.images=[photo];changed=true;}
   for(const key of ['backupImage','officialImage']){
    if(Object.prototype.hasOwnProperty.call(item,key)){delete item[key];changed=true;}
   }
  }
 }
 if(changed)save();
 storeMealPhotoSet(id,[photo]).catch(error=>console.error('Dinliminate stored photo cleanup failed',error));
}
// CP1149 — meal photo policy: official source first, exact same-meal backup second, never a generic food fallback.
const DEFAULT_FOOD_IMAGE = '';
const CHOCOLATE_COVERED_PEANUTS_ID = 'chocolate-covered-peanuts';
const CHOCOLATE_COVERED_PEANUTS_PHOTO = "https://images.pexels.com/photos/38594567/pexels-photo-38594567.jpeg?auto=compress&cs=tinysrgb&w=1800";

const SELECTED_BUILTIN_MEAL_PHOTOS = Object.freeze({
  "jell-o": "https://images.pexels.com/photos/7428697/pexels-photo-7428697.jpeg?auto=compress&cs=tinysrgb&w=1800",
  "protein-bar": "https://images.pexels.com/photos/3735187/pexels-photo-3735187.jpeg?auto=compress&cs=tinysrgb&w=1800",
  "grilled-cheese": "https://images.pexels.com/photos/37395121/pexels-photo-37395121.jpeg?auto=compress&cs=tinysrgb&w=1800",
  "salad-bowl": "https://images.pexels.com/photos/4101804/pexels-photo-4101804.jpeg?auto=compress&cs=tinysrgb&w=1800",
  "pasta-alfredo": "https://images.pexels.com/photos/11220208/pexels-photo-11220208.jpeg?auto=compress&cs=tinysrgb&w=1800"
});
function normalizeSelectedBuiltInMealPhotos(){
 let changed=false;
 const apply=item=>{
  const photo=SELECTED_BUILTIN_MEAL_PHOTOS[String(item?.id||'')];
  if(!photo||!item)return;
  if(item.image!==photo){item.image=photo;changed=true;}
  if(!Array.isArray(item.images)||item.images.length!==1||item.images[0]!==photo){item.images=[photo];changed=true;}
  for(const key of ['backupImage','officialImage']){
   if(Object.prototype.hasOwnProperty.call(item,key)){delete item[key];changed=true;}
  }
 };
 for(const collection of [S.custom,S.deletedCustomMeals,S.pool]){
  if(!Array.isArray(collection))continue;
  for(const item of collection)apply(item);
 }
 apply(S.winnerItem);
 if(changed)save();
 for(const [id,photo] of Object.entries(SELECTED_BUILTIN_MEAL_PHOTOS)){
  storeMealPhotoSet(id,[photo]).catch(error=>console.error('Dinliminate selected meal photo cleanup failed',error));
 }
}


const KEY = 'dinliminate:v1';
const APP_VERSION = '1.0';

// CP973 — photo-ready Restaurant first paint + four-card swipe prewarm.
// CP1070: one-at-a-time Restaurant refine panels + category-aware Cuisine filtering.
const APP_BUILD = '1366';
const APP_BUILD_DATE = '2026-10-09';
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
const RESTAURANT_WEBSITE_CACHE_TTL=14*24*60*60*1000;
function restaurantWebsiteRowKey(row){
 return normKey([row?.name,row?.address,row?.brand].filter(Boolean).join('|'));
}
function loadRestaurantWebsiteStore(){const raw=S.restaurantWebsiteCache&&typeof S.restaurantWebsiteCache==='object'&&!Array.isArray(S.restaurantWebsiteCache)?S.restaurantWebsiteCache:{};const now=Date.now();for(const [key,value] of Object.entries(raw)){if(value&&now-Number(value.t||0)<RESTAURANT_WEBSITE_CACHE_TTL&&(typeof value.url==='string'||typeof value.officialPage==='string'))restaurantWebsiteCache.set(key,value);}}
function saveRestaurantWebsiteStore(){const out={},now=Date.now();for(const [key,value] of restaurantWebsiteCache){if(value&&now-Number(value.t||0)<RESTAURANT_WEBSITE_CACHE_TTL)out[key]=value;}S.restaurantWebsiteCache=out;save();}
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
const imageSwapRequestTokens=new WeakMap();
function swapImageWhenReady(img,url){
 if(!img||!url||!img.isConnected)return Promise.resolve(false);
 const nextUrl=String(url);
 const requestToken=(imageSwapRequestTokens.get(img)||0)+1;
 imageSwapRequestTokens.set(img,requestToken);
 const owner=img.closest?.('#foodCard,#restaurantCard,#restaurantNextCard')||null;
 const ownerId=String(owner?.id||'');
 const identity={
  mealId:String(owner?.dataset?.mealId||''),
  mealLoadToken:String(owner?.dataset?.mealLoadToken||''),
  imageMealLoadToken:String(img.dataset?.mealLoadToken||''),
  photoKey:String(img.dataset?.restaurantPhotoKey||''),
  previewToken:String(owner?.dataset?.swipePreviewToken||''),
  previewKey:String(owner?.dataset?.swipePreviewKey||'')
 };
 const stillCurrent=()=>{
  if(!img.isConnected||imageSwapRequestTokens.get(img)!==requestToken)return false;
  if(!owner)return true;
  if(!owner.isConnected||!owner.contains(img)||owner.id!==ownerId)return false;
  if(ownerId==='foodCard'){
   return String(owner.dataset.mealId||'')===identity.mealId
    &&String(owner.dataset.mealLoadToken||'')===identity.mealLoadToken
    &&String(img.dataset.mealLoadToken||'')===identity.imageMealLoadToken
    &&identity.imageMealLoadToken===identity.mealLoadToken;
  }
  if(ownerId==='restaurantCard'||ownerId==='restaurantNextCard'){
   if(String(img.dataset.restaurantPhotoKey||'')!==identity.photoKey)return false;
   if(ownerId==='restaurantNextCard'){
    return String(owner.dataset.swipePreviewToken||'')===identity.previewToken
     &&String(owner.dataset.swipePreviewKey||'')===identity.previewKey
     &&identity.previewKey===identity.photoKey;
   }
   return true;
  }
  return true;
 };
 const current=normalizeMealImageUrl(img.currentSrc||img.src||'');
 const expected=normalizeMealImageUrl(nextUrl);
 if(current===expected&&img.complete&&img.naturalWidth>0&&stillCurrent())return Promise.resolve(true);
 return new Promise(resolve=>{
  const probe=new Image();
  probe.decoding='async';
  let settled=false;
  const finish=ok=>{if(settled)return;settled=true;resolve(!!ok);};
  probe.onload=async()=>{
   try{await probe.decode?.();}catch(error){console.error('Dinliminate error',error);}
   if(!stillCurrent()){finish(false);return;}
   try{img.src=nextUrl;finish(true);}
   catch(error){console.error('Dinliminate image assignment error',error);finish(false);}
  };
  probe.onerror=()=>finish(false);
  probe.src=nextUrl;
 });
}
function normalizeMealImageUrl(value){
 try{return new URL(String(value||''),document.baseURI).href;}catch{return String(value||'');}
}
function waitForMealImageReady(img,url,stillCurrent,timeoutMs=1800){
 const expected=normalizeMealImageUrl(url);
 return new Promise(resolve=>{
  let finished=false,checking=false,timer=0;
  const cleanup=()=>{
   clearTimeout(timer);
   img.removeEventListener('load',onLoad);
   img.removeEventListener('error',onError);
  };
  const finish=ok=>{
   if(finished)return;
   finished=true;cleanup();resolve(!!ok);
  };
  const verify=async()=>{
   if(finished||checking)return;
   if(!stillCurrent()){finish(false);return;}
   const current=normalizeMealImageUrl(img.currentSrc||img.src);
   if(current!==expected||!img.complete||img.naturalWidth<=0)return;
   checking=true;
   try{if(typeof img.decode==='function')await img.decode();}catch(error){console.error('Dinliminate image decode error',error);}
   checking=false;
   if(!stillCurrent()){finish(false);return;}
   finish(img.isConnected&&img.complete&&img.naturalWidth>0
    &&normalizeMealImageUrl(img.currentSrc||img.src)===expected);
  };
  const onLoad=()=>{void verify();};
  const onError=()=>finish(false);
  img.addEventListener('load',onLoad);
  img.addEventListener('error',onError);
  timer=window.setTimeout(()=>finish(false),Math.max(250,Number(timeoutMs)||1800));
  img.style.visibility='hidden';
  try{img.src=url;}catch(error){console.error('Dinliminate meal image assignment error',error);finish(false);return;}
  void verify();
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
   const preloaded=await preloadSwipeImage(url);
   if(!preloaded||!stillCurrent())continue;
   const painted=await waitForMealImageReady(img,url,stillCurrent);
   if(!painted||!stillCurrent())continue;
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
function resetRestaurantPhotoCaches(){
 for(const data of restaurantPhotoCache.values()){
  if(String(data?.url||'').startsWith('blob:')){try{URL.revokeObjectURL(data.url);}catch(error){console.error('Dinliminate cache cleanup error',error);}}
 }
 restaurantWebsiteCache.clear();
 restaurantWebsiteInflight.clear();
 restaurantPhotoCache.clear();
 restaurantPhotoMissCache.clear();
 restaurantPhotoInflight.clear();
 restaurantPhotoStoragePromise=null;
}

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
   const bytes=new TextEncoder().encode(raw); let binary=''; for(const byte of bytes)binary+=String.fromCharCode(byte); const encoded=btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
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
   Promise.resolve(decoded).catch(error=>{console.error('Dinliminate async operation failed',error);}).then(()=>finish(img.naturalWidth>0&&img.naturalHeight>0));
  };
  img.onerror=()=>finish(false);
  timer=window.setTimeout(()=>finish(img.complete&&img.naturalWidth>0&&img.naturalHeight>0),timeoutMs);
  img.src=src;
  if(img.complete&&img.naturalWidth>0){
   const decoded=typeof img.decode==='function'?img.decode():Promise.resolve();
   Promise.resolve(decoded).catch(error=>{console.error('Dinliminate async operation failed',error);}).then(()=>finish(img.naturalWidth>0&&img.naturalHeight>0));
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
  targets.forEach(row=>{loadRestaurantPhoto(row).catch(error=>{console.error('Dinliminate async operation failed',error);});});
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
 const activeCard=document.getElementById('restaurantCard');
 const activeImg=activeCard?.querySelector?.('img[data-restaurant-photo-key]');
 const activeId=String(activeCard?.dataset?.restaurantId||'');
 const activePhotoSrc=activeImg
  &&String(activeImg.dataset.restaurantPhotoKey||'')===activeId
  &&String(activeImg.dataset.restaurantPhotoLoaded||'')==='true'
  &&activeImg.complete&&activeImg.naturalWidth>0
  ?String(activeImg.currentSrc||activeImg.src||'').trim():'';
 return {
  activeCard:{id:activeId,photoSrc:activePhotoSrc},
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

function focusFamilyReturnTarget(target){
 if(!target)return;
 try{target.focus({preventScroll:true});}catch{target.focus();}
}

function closeFamilyDrawer(immediate=false,restoreFocus=true) {
 const family=$('family'),bg=$('familyDrawerBg');
 family?.classList.remove('is-open');bg?.classList.remove('is-open');
 bg?.setAttribute('aria-hidden','true');
 S.familyDrawerOpen=false;
 const returnFocus=familyDrawerReturnFocus;
 familyDrawerReturnFocus=null;
 const finish=()=>{
  if(S.familyDrawerOpen)return;
  family?.classList.add('hidden');bg?.classList.add('hidden');
  if(restoreFocus&&returnFocus?.isConnected&&returnFocus.getClientRects().length){
   focusFamilyReturnTarget(returnFocus)
  }
 };
 if(immediate){family?.classList.add('hidden');bg?.classList.add('hidden');if(restoreFocus&&returnFocus?.isConnected&&returnFocus.getClientRects().length){focusFamilyReturnTarget(returnFocus)}return;}
 window.setTimeout(finish,180);
}

function closeFamilyDrawerToMenu(){
 const trigger=familyDrawerReturnFocus;
 const visible=el=>!!el&&el.isConnected&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
 const fallbackId=({home:'menu',food:'foodMenu',restaurant:'restaurantMenu',winner:'winnerMenu'})[S.screen]||'menu';
 const fallback=$(fallbackId);
 const target=visible(trigger)?trigger:(visible(fallback)?fallback:null);
 // Restore the main menu and its full-screen cover before the Family panel
 // begins sliding away. The cover layers overlap, so the prior screen is
 // never exposed while the phone UI hands control back to the menu.
 if(target)openDrawer({currentTarget:target});
 $('drawer')?.classList.add('is-open');
 $('drawerBg')?.classList.add('is-open');
 closeFamilyDrawer(false,false);
}

function familyDrawerKeydown(event){
 if(!S.familyDrawerOpen)return;
 const family=$('family');
 if(!family)return;
 if(event.key==='Escape'){
  event.preventDefault();closeFamilyDrawerToMenu();return;
 }
 if(event.key!=='Tab')return;
 const focusable=[...family.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')]
  .filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
 if(!focusable.length){event.preventDefault();return;}
 const first=focusable[0],last=focusable[focusable.length-1],active=document.activeElement;
 if(!family.contains(active)){event.preventDefault();first.focus();return;}
 if(event.shiftKey&&active===first){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&active===last){event.preventDefault();first.focus();}
}
document.addEventListener('keydown',familyDrawerKeydown,true);

const HOME_DOOR_SOURCE_WIDTH=720;
const HOME_DOOR_SOURCE_HEIGHT=1280;
const HOME_DOOR_PANES=[
 {id:'foodStart',points:[[132,190],[319,190],[317,856],[130,856]]},
 {id:'restStart',points:[[414,190],[600,188],[603,856],[412,856]]}
];
let homeWindowLayoutFrame=0;
let homeLogoEntrancePlayed=false;
function syncHomeWindowHitAreas(){
 const home=$('home'),app=document.querySelector('.app');
 if(!home||!app?.classList.contains('home-active'))return;
 const width=home.clientWidth,height=home.clientHeight;
 if(width<1||height<1)return;
 const scale=Math.max(width/HOME_DOOR_SOURCE_WIDTH,height/HOME_DOOR_SOURCE_HEIGHT);
 const offsetX=(width-HOME_DOOR_SOURCE_WIDTH*scale)/2,offsetY=(height-HOME_DOOR_SOURCE_HEIGHT*scale)/2;
 const compact=window.matchMedia('(max-width:390px)').matches;
 for(const pane of HOME_DOOR_PANES){
  const button=$(pane.id);if(!button)continue;
  const mapped=pane.points.map(([x,y])=>({x:offsetX+x*scale,y:offsetY+y*scale}));
  const xs=mapped.map(p=>p.x),ys=mapped.map(p=>p.y);
  const left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
  const paneWidth=Math.max(1,right-left),paneHeight=Math.max(1,bottom-top);
  const oldButtonLeft=pane.id==='foodStart'?width*.18+(compact?-3:-4):width*(compact?.60:.57)+(compact?3:4);
  const oldButtonWidth=width*.30;
  const contentNudge=pane.id==='foodStart'?(compact?-3:-5):(compact?2:3);
  const labelCenter=oldButtonLeft+oldButtonWidth/2+contentNudge;
  const labelTop=height*.42+(compact?width*.06:3)-1;
  const polygon=mapped.map(p=>(((p.x-left)/paneWidth)*100).toFixed(3)+'% '+(((p.y-top)/paneHeight)*100).toFixed(3)+'%').join(',');
  button.style.setProperty('--home-window-left',left+'px');
  button.style.setProperty('--home-window-top',top+'px');
  button.style.setProperty('--home-window-width',paneWidth+'px');
  button.style.setProperty('--home-window-height',paneHeight+'px');
  button.style.setProperty('--home-window-clip','polygon('+polygon+')');
  button.style.setProperty('--home-choice-label-center',(labelCenter-left)+'px');
  button.style.setProperty('--home-choice-label-top',(labelTop-top)+'px');
  button.dataset.homeWindowHit='true';
  button.style.left='var(--home-window-left)';button.style.top='var(--home-window-top)';
  button.style.right='auto';button.style.bottom='auto';
  button.style.width='var(--home-window-width)';button.style.height='var(--home-window-height)';
  button.style.padding='0';button.style.transform='none';
  button.style.clipPath='var(--home-window-clip)';button.style.webkitClipPath='var(--home-window-clip)';
  button.classList.add('home-window-hit');
 }
}
function scheduleHomeWindowLayout(){
 if(homeWindowLayoutFrame)return;
 homeWindowLayoutFrame=window.requestAnimationFrame(()=>{homeWindowLayoutFrame=0;syncHomeWindowHitAreas();});
}
function maybePlayInitialHomeLogoEntrance(){
 if(homeLogoEntrancePlayed||!document.documentElement.classList.contains('dinliminate-ready'))return;
 const app=document.querySelector('.app');
 if(!app?.classList.contains('home-active'))return;
 homeLogoEntrancePlayed=true;app.dataset.homeLogoEntrancePlayed='true';app.classList.add('home-logo-entrance');
 const finish=()=>app.classList.remove('home-logo-entrance');
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return;}
 window.setTimeout(finish,420);
}
const homeLogoReadyObserver=new MutationObserver(()=>maybePlayInitialHomeLogoEntrance());
homeLogoReadyObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
window.addEventListener('resize',scheduleHomeWindowLayout,{passive:true});
window.addEventListener('orientationchange',scheduleHomeWindowLayout,{passive:true});
window.visualViewport?.addEventListener('resize',scheduleHomeWindowLayout,{passive:true});
function show(screen) {
if(screen==='family'){
 const family=$('family'),bg=$('familyDrawerBg'),navDrawer=$('drawer');
 const menuHandoff=!!navDrawer&&!navDrawer.classList.contains('hidden')&&navDrawer.classList.contains('is-open');
 if(!S.familyDrawerOpen){
  if(S.screen==='family'){
   const returnScreen=S.familyDrawerReturnScreen||'home';
   document.querySelectorAll('.screen').forEach(x=>x.classList.add('hidden'));
   $(returnScreen)?.classList.remove('hidden');
   S.screen=returnScreen;save();
   document.querySelector('.app')?.classList.toggle('home-active',returnScreen==='home');
   if(returnScreen==='home'){scheduleHomeWindowLayout();maybePlayInitialHomeLogoEntrance();}
   $('appTopbar')?.classList.toggle('hidden',returnScreen==='food'||returnScreen==='restaurant'||returnScreen==='winner');
  }
  S.familyDrawerReturnScreen=S.screen||'home';
 }
 const anchorId=String(navDrawer?.dataset.menuAnchorId||'');
 const visible=el=>!!el&&el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden';
 let trigger=anchorId?$(anchorId):null;
 if(!visible(trigger)){
  const byScreen={home:'menu',food:'foodMenu',restaurant:'restaurantMenu',winner:'winnerMenu'};
  trigger=$(byScreen[S.screen]||'menu');
 }
 if(!visible(trigger))trigger=['menu','foodMenu','restaurantMenu','winnerMenu'].map(id=>$(id)).find(visible)||null;
 if(trigger?.getBoundingClientRect){
  const rect=trigger.getBoundingClientRect();
  const panelTop=Math.max(0,Math.ceil(rect.bottom+4));
  family?.style.setProperty('--family-panel-top',panelTop+'px');
  family?.style.setProperty('--family-trigger-top',Math.max(0,rect.top)+'px');
  family?.style.setProperty('--family-trigger-right',Math.max(0,(document.documentElement.clientWidth||window.innerWidth)-rect.right)+'px');
  family?.style.setProperty('--family-trigger-width',rect.width+'px');
  family?.style.setProperty('--family-trigger-height',rect.height+'px');
  familyDrawerReturnFocus=trigger;
 }
 family?.classList.remove('hidden');bg?.classList.remove('hidden');
 bg?.setAttribute('aria-hidden','false');
 // When entered from the shared Menu, make its covering backdrop opaque
 // before the menu backdrop is removed. The panel itself still slides in.
 if(menuHandoff)bg?.classList.add('is-open');
 S.familyDrawerOpen=true;
 window.requestAnimationFrame(()=>{
  if(!S.familyDrawerOpen)return;
  family?.classList.add('is-open');bg?.classList.add('is-open');
  family?.querySelector('#familyCloseTop')?.focus({preventScroll:true});
 });
 return;
}
if(S.familyDrawerOpen)closeFamilyDrawer(true,false);
if(typeof tutorialModeEnabled==='function'&&typeof tutorialState!=='undefined'&&tutorialState.active&&tutorialState.screen&&tutorialState.screen!==screen){
 tutorialInvalidateTransition('screen-change');
}
document.querySelectorAll('.screen').forEach(x => x.classList.add('hidden'));
$(screen)?.classList.remove('hidden');
const screenChanged=S.screen!==screen;S.screen=screen;if(screenChanged)save();
document.querySelector('.app')?.classList.toggle('home-active',screen === 'home');
if(screen==='home'){scheduleHomeWindowLayout();maybePlayInitialHomeLogoEntrance();}
// CP1311: critical-boot route selectors are one-shot hints. Leaving them on
// would override .hidden and let a previous screen flash back after navigation.
document.documentElement.classList.remove('dinliminate-start-food','dinliminate-start-restaurant','dinliminate-start-winner','dinliminate-start-family');
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
 const ownerId=String(item.id||''),loadToken=String(card.dataset.mealLoadToken||''),imageToken=String(img.dataset.mealLoadToken||'');
 const stillCurrent=()=>card.isConnected&&img.isConnected&&card.querySelector('#foodImg')===img
  &&S.pool[S.index]===item&&String(card.dataset.mealId||'')===ownerId
  &&String(card.dataset.mealLoadToken||'')===loadToken
  &&String(img.dataset.mealLoadToken||'')===imageToken;
 const count=mealPhotoList(item).length||1;
 if(count<=1)return false;
 item._mealPhotoIndex=(Number(item._mealPhotoIndex||0)+1)%count;
 hydrateMealPhotoGallery(item).then(photos=>{
  if(!stillCurrent())return;
  const total=photos.length||1;
  const idx=((Number(item._mealPhotoIndex||0)%total)+total)%total;
  item._mealPhotoIndex=idx;
  const nextUrl=photos[idx]||foodPhoto(item);
  if(!nextUrl)return;
  swapImageWhenReady(img,nextUrl).then(swapped=>{
   if(!swapped||!stillCurrent())return;
   ensureMealCardPhotoPager(card,total,idx);
  }).catch(error=>console.error('Dinliminate meal photo swap error',error));
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
let familyDrawerReturnFocus=null;
// CP1071: remove the temporary Menu tooltip; the hamburger icon is self-explanatory.
const showMenuHint=()=>{};
let drawerHandoffReleaseTimer=0;
const closeDrawer=(immediate=false)=>{
  clearTimeout(drawerCloseTimer);clearTimeout(drawerHandoffReleaseTimer);
  const drawer=$('drawer'),bg=$('drawerBg');
  drawer?.classList.remove('is-open');bg?.classList.remove('is-open');document.querySelector('#menuHint')?.remove();
  ['#menu','#foodMenu','#restaurantMenu','#winnerMenu'].forEach(sel=>document.querySelector(sel)?.setAttribute('aria-expanded','false'));
  if(immediate){drawer?.classList.add('hidden');bg?.classList.add('hidden');return;}
  drawerCloseTimer=setTimeout(()=>{drawer?.classList.add('hidden');bg?.classList.add('hidden');},180);
};
const openDrawer=(event)=>{
  clearTimeout(drawerCloseTimer);clearTimeout(drawerHandoffReleaseTimer);const drawer=$('drawer'),bg=$('drawerBg');
  const trigger=event?.currentTarget;
  if(drawer&&trigger&&typeof trigger.getBoundingClientRect==='function'){
    const rect=trigger.getBoundingClientRect();
    const top=Math.max(0,rect.top);
    const right=Math.max(0,(document.documentElement.clientWidth||window.innerWidth)-rect.right);
    drawer.style.setProperty('--drawer-trigger-top',top+'px');
    drawer.style.setProperty('--drawer-trigger-right',right+'px');
    drawer.style.setProperty('--drawer-trigger-width',rect.width+'px');
    drawer.style.setProperty('--drawer-trigger-height',rect.height+'px');
    drawer.dataset.menuAnchorId=String(trigger.id||'');
  }
  drawer?.classList.remove('hidden');bg?.classList.remove('hidden');
  requestAnimationFrame(()=>{drawer?.classList.add('is-open');bg?.classList.add('is-open');});
  ['#menu','#foodMenu','#restaurantMenu','#winnerMenu'].forEach(sel=>document.querySelector(sel)?.setAttribute('aria-expanded','true'));
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
  clearTimeout(drawerCloseTimer);clearTimeout(drawerHandoffReleaseTimer);
  const drawer=$('drawer'),bg=$('drawerBg');
  // Mount the destination while the menu is still open so it can detect the
  // handoff and create its own backdrop in the same task.
  try{navigate?.();}catch(error){console.error('Dinliminate error',error);closeDrawer(true);return;}
  // Hide the menu panel, but keep its full-screen backdrop as a handoff cover.
  // We release it only after the destination's own opaque backdrop is painted.
  drawer?.classList.remove('is-open');drawer?.classList.add('hidden');
  bg?.classList.remove('hidden');bg?.classList.add('is-open');
  document.querySelector('#menuHint')?.remove();
  ['#menu','#foodMenu','#restaurantMenu','#winnerMenu'].forEach(sel=>document.querySelector(sel)?.setAttribute('aria-expanded','false'));
  let frames=0;
  const destinationCoverReady=()=>{
    const familyBg=$('familyDrawerBg');
    if(familyBg&&!familyBg.classList.contains('hidden')&&familyBg.classList.contains('is-open')
      &&Number.parseFloat(getComputedStyle(familyBg).opacity)>=.99)return true;
    for(const id of ['manageFoodsModalBg','historyModalBg','settingsModalBg']){
      const target=$(id);
      if(target&&!target.classList.contains('hidden')&&target.classList.contains('modal-bg-open')
        &&!target.classList.contains('modal-bg-opening')
        &&Number.parseFloat(getComputedStyle(target).opacity)>=.99)return true;
    }
    return false;
  };
  const releaseCover=()=>{
    frames++;
    const ready=destinationCoverReady();
    // Home has no destination panel; two paints are enough because the screen
    // switch happens synchronously above. Panel routes wait for their backdrop.
    const simpleHome=S.screen==='home';
    if(!ready&&!simpleHome&&frames<120){window.requestAnimationFrame(releaseCover);return;}
    bg?.classList.remove('is-open');
    const finish=()=>{
      // If the user reopened the menu during the fade, leave its backdrop alone.
      if(!bg?.classList.contains('is-open'))bg?.classList.add('hidden');
    };
    bg?.addEventListener('transitionend',event=>{
      if(event.target===bg&&event.propertyName==='opacity')finish();
    },{once:true});
    drawerHandoffReleaseTimer=window.setTimeout(finish,240);
  };
  window.requestAnimationFrame(()=>window.requestAnimationFrame(releaseCover));
};
$('menu')?.addEventListener('click',openDrawer);
$('foodMenu')?.addEventListener('click',openDrawer);
$('restaurantMenu')?.addEventListener('click',openDrawer);
$('winnerMenu')?.addEventListener('click',openDrawer);

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
bindRestaurantAddressInputs();
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
    if (typeof reg?.update === 'function') {
      await reg.update().catch(error => console.warn('Dinliminate service-worker update check failed', error));
    }
  } catch(error){console.error('Dinliminate error',error)}
});
configureStorage({$,restaurantCanonicalId,allFoods,normKey,mealPhotoList,dedupeMealPhotos,DEFAULT_FOOD_IMAGE,ensureMealTimeSettings,mealTimeNames,currentMealTimeName,STORAGE_VERSION,KEY});
configureMigrations({loadItemNotes,ensureMealTimeSettings,mealTimeNames,currentMealTimeName,mealPhotoList,normKey,DEFAULT_FOOD_IMAGE,STORAGE_VERSION,KEY});
configureModal({mealTimesFor,restaurantFallbackImage,imageProxyUrl,mealImageUrl,mealPhotoList,foodPhoto,foodPhotoFallback,hydrateMealPhotoGallery,restaurantWebsitePresentation,hydrateRestaurantWebsite,restaurantPhoneSearchUrl,restaurantDirectionsUrl,bindImageFallback,swapImageWhenReady,phoneHref,show,foodHideItem,HUNGRY_IMAGE,FINAL_FOOD_IMAGE,FINAL_RESTAURANT_IMAGE});

bindMealPhotoCountControls();
load();
normalizeSelectedBuiltInMealPhotos();
normalizeChocolateCoveredPeanutsPhoto();
loadRestaurantWebsiteStore();
renderLocationSource();
renderFindButton();
updateStorageIndicator();
hydrateCustomPhotos().then(()=>migrateCustomPhotos()).catch(error=>{console.error('Dinliminate async operation failed',error);});

/* CP1279 — deep transition audit:
   Prime the first persisted/default media while Home is still covering the app.
   Decision screens are rendered behind the boot mask and are not revealed until
   their first visible media path has settled. No fixed delay is added. */
try{
 const firstMeal=foodBasePool()?.[0];
 const firstMealSrc=firstMeal?(foodPhoto(firstMeal)||foodPhotoFallback(firstMeal)||FINAL_FOOD_IMAGE):'';
 if(firstMealSrc)preloadSwipeImage(firstMealSrc);
 const firstRestaurant=restaurantPoolFiltered()?.[S.restaurantIndex||0];
 if(firstRestaurant)loadRestaurantPhoto(firstRestaurant).then(data=>{if(data?.url)waitForRestaurantPhotoDecoded(data.url).catch(error=>{console.error('Dinliminate async operation failed',error);});}).catch(error=>{console.error('Dinliminate async operation failed',error);});
}catch(error){console.error('Dinliminate error',error)}

(async()=>{
 if (S.saved && S.screen === 'food' && S.pool.length) {
  show('food');
  foodQuick();
  drawFood({deferPrime:true});
  await $('foodCard')?.__mealReadyPromise;
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
bindTutorialUI();


export { HISTORY_KEY };

export { RESTAURANT_PHOTO_PREFETCH_COUNT, HUNGRY_IMAGE, FINAL_RESTAURANT_IMAGE };


export { foodQuickImage, foodPhoto, foodPhotoFallback, restaurantFallbackImage, bindImageFallbackAttrs, drawFood, imageProxyUrl, normalizeMealPhotoRef, dedupeMealPhotos, mealPhotoList, customQuickCutImage, show, startFood, openRestaurant, winner, closeDrawer, closeFamilyDrawer, closeFamilyDrawerToMenu, openModal, home, mealImageUrl, bindImageFallback, hydrateRestaurantPhoto, swapImageWhenReady, setRestaurantPhotoCredit, prefetchRestaurantPhotos, clearDecisionHistory, updateDecisionBackButtons, pushDecisionHistory, captureRestaurantDecisionState, restoreRestaurantDecisionState, legacyRestaurantBack, familyNormalBar, familyIsBrowseStage, familyBrowseNext, familyBrowsePrevious, familyBrowseBack, familyRoundStage, markMealImageUnavailable, loadMealPhotoCandidates, ensureMealCardPhotoPager, captureFoodDecisionState, restoreFoodDecisionState, legacyFoodBack, previewDecisionCount, familyHideWinnerMeta, APP_VERSION, APP_BUILD, APP_BUILD_DATE, DEFAULT_FOOD_IMAGE, FINAL_FOOD_IMAGE, FOOD_QUICK, DEFAULT_MEAL_TIME_DEFS, normKey, allFoods, foodQuickLabels, getDefaultFoods, MEAL_AUTOFILL_ENABLED, removeFoodOverlays, primeRestaurantPhotosBeforeFirstPaint, prepareRestaurantPhotoDeck, restaurantImmediatePhoto, loadRestaurantPhoto, restaurantWebsiteCache, restaurantWebsiteInflight, restaurantPhotoCache, restaurantPhotoMissCache, restaurantPhotoInflight, resetRestaurantPhotoCaches, bindMealPhotoCountControls, hydrateMealPhotoGallery, navigateFromDrawer };


