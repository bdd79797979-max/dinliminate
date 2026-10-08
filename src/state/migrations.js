import { store } from './store.js';
const S = store.get();
import { save } from './storage.js';

let loadItemNotes;
let ensureMealTimeSettings;
let mealTimeNames;
let currentMealTimeName;
let mealPhotoList;
let normKey;
let DEFAULT_FOOD_IMAGE='';
let STORAGE_VERSION=7;
let KEY='dinliminate:v1';
const OLD_PRIMARY_KEY='dinliminate.clean.cp1';
const LEGACY_KEYS=Object.freeze([OLD_PRIMARY_KEY,'dinliminate.item.notes.v1','dinliminate.clean.history','dinliminate.family.v1','dinliminate.restaurant.websites.v1','dinliminate.start-screen','dinliminate.swipeHint.v4','dinliminate.swipeHint.v5']);

export function configureMigrations(next={}){
  loadItemNotes=next.loadItemNotes;ensureMealTimeSettings=next.ensureMealTimeSettings;mealTimeNames=next.mealTimeNames;
  currentMealTimeName=next.currentMealTimeName;mealPhotoList=next.mealPhotoList;normKey=next.normKey;
  DEFAULT_FOOD_IMAGE=next.DEFAULT_FOOD_IMAGE||'';STORAGE_VERSION=Number(next.STORAGE_VERSION||7);KEY=String(next.KEY||KEY);
}

function parseLegacyJson(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(error){console.error('Dinliminate migration parse error',key,error);return fallback;}}
function legacySideData(){
  const history=parseLegacyJson('dinliminate.clean.history',[]),notes=parseLegacyJson('dinliminate.item.notes.v1',{}),family=parseLegacyJson('dinliminate.family.v1',null),websites=parseLegacyJson('dinliminate.restaurant.websites.v1',{});
  return {history:Array.isArray(history)?history.filter(row=>row&&typeof row==='object').slice(0,120):[],notes:notes&&typeof notes==='object'&&!Array.isArray(notes)?notes:{},familySession:family&&typeof family==='object'?family:null,restaurantWebsiteCache:websites&&typeof websites==='object'&&!Array.isArray(websites)?websites:{},startScreen:String(localStorage.getItem('dinliminate.start-screen')||'').trim(),swipeHintDismissed:!!(localStorage.getItem('dinliminate.swipeHint.v4')||localStorage.getItem('dinliminate.swipeHint.v5'))};
}
function removeLegacyKeys(){for(const key of LEGACY_KEYS)try{localStorage.removeItem(key);}catch(error){console.error('Dinliminate migration cleanup error',key,error);}}
function load(){
  try{
    const primary=localStorage.getItem(KEY),legacyPrimary=primary?null:localStorage.getItem(OLD_PRIMARY_KEY),legacy=legacySideData();
    const hasLegacy=!!legacyPrimary||legacy.history.length>0||Object.keys(legacy.notes).length>0||!!legacy.familySession||Object.keys(legacy.restaurantWebsiteCache).length>0||!!legacy.startScreen||legacy.swipeHintDismissed;
    if(!primary&&!legacyPrimary&&!hasLegacy)return false;
    const d=JSON.parse(primary||legacyPrimary||'{}');
    if(!Array.isArray(d.history)||!d.history.length)d.history=legacy.history;
    if(!d.notes||typeof d.notes!=='object'||Array.isArray(d.notes))d.notes=legacy.notes;
    if(!d.familySession&&legacy.familySession)d.familySession=legacy.familySession;
    if(!d.restaurantWebsiteCache||typeof d.restaurantWebsiteCache!=='object'||Array.isArray(d.restaurantWebsiteCache))d.restaurantWebsiteCache=legacy.restaurantWebsiteCache;
    if(!d.swipeHintDismissed&&legacy.swipeHintDismissed)d.swipeHintDismissed=true;
    if(!d.screen&&legacy.startScreen)d.screen=legacy.startScreen;

if(!Array.isArray(d.foodCuts)) d.foodCuts=[];
if(!d.foodCuts.length && Array.isArray(d.foodActions))
for(const a of d.foodActions) if(a?.type==='cut'&&a.id) d.foodCuts.push(a.id);
delete d.cutPrimary;
const legacyKeys=['cutPrimary','allCut','foodAllCut','savedRound','savedRoundType','legacyRestaurantPool','restaurantResults','pass','passDraftCount','passDraftNames','passDraftMode','passStartVoter'];
legacyKeys.forEach(key=>{try{delete d[key]}catch(error){console.error('Dinliminate error',error)}});
Object.assign(S, d);
S.history=Array.isArray(d.history)?d.history.filter(row=>row&&typeof row==='object').slice(0,120):[];
S.familySession=d.familySession&&typeof d.familySession==='object'?d.familySession:null;
S.restaurantWebsiteCache=d.restaurantWebsiteCache&&typeof d.restaurantWebsiteCache==='object'&&!Array.isArray(d.restaurantWebsiteCache)?d.restaurantWebsiteCache:{};
S.swipeHintDismissed=!!d.swipeHintDismissed;
legacyKeys.forEach(key=>{try{delete S[key]}catch(error){console.error('Dinliminate error',error)}});
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
S.foodHistory = Array.isArray(d.foodHistory) ? d.foodHistory.filter(x=>x&&Array.isArray(x.poolIds)) : [];
S.restaurantHistory = Array.isArray(d.restaurantHistory) ? d.restaurantHistory.filter(x=>x&&Array.isArray(x.poolIds)) : [];
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
if(S.locationSource==='device' && S.location)S.locationSource='last';
S.restaurantSearchDegraded = !!d.restaurantSearchDegraded;
S.schemaVersion=STORAGE_VERSION;const persisted=save();if(persisted)removeLegacyKeys();return persisted;
}catch(error){console.error('Dinliminate migration error',error);return false;}
}


export { load };
