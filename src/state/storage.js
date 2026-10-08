import { store } from './store.js';
const S = store.get();
import { $ } from '../ui/dom.js';

let deps={
  restaurantCanonicalId:item=>String(item?.canonicalId||item?.id||'unknown'),
  allFoods:()=>[],
  normKey:value=>String(value||'').trim().toLowerCase(),
  mealPhotoList:item=>Array.isArray(item?.images)?item.images.filter(Boolean):(item?.image?[item.image]:[]),
  dedupeMealPhotos:photos=>Array.isArray(photos)?[...new Set(photos.filter(Boolean))]:[],
  DEFAULT_FOOD_IMAGE:'',
  STORAGE_VERSION:7,
  KEY:'dinliminate:v1'
};
export function configureStorage(next={}){ deps={...deps,...next}; }

function loadItemNotes(){S.notes=(S.notes&&typeof S.notes==='object'&&!Array.isArray(S.notes))?S.notes:{};}
function saveItemNotes(){const clean={};Object.entries(S.notes||{}).forEach(([key,value])=>{const note=String(value??'').trim();if(note)clean[key]=note.slice(0,1200);});S.notes=clean;return save();}
function itemNoteKey(item,type){
 if(type==='restaurant'){
  return 'restaurant:'+String(item?.canonicalId||deps.restaurantCanonicalId(item)||item?.id||'unknown');
 }
 const directId=String(item?.sourceItemId||'').trim();
 if(directId)return 'food:'+directId;
 const found=deps.allFoods().find(x=>deps.normKey(x?.name)===deps.normKey(item?.name));
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
} catch(error){console.error('Dinliminate storage error',error);return false;}
}
async function getStoredPhoto(id) {
try {
const db=await openPhotoDB();
return await new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readonly');const req=tx.objectStore(PHOTO_STORE).get(id);req.onsuccess=()=>resolve(req.result||'');req.onerror=()=>reject(req.error||new Error('Could not read photo'));});
} catch(error){console.error('Dinliminate storage error',error);return '';}
}
async function deleteStoredPhoto(id) {
try {
const db=await openPhotoDB();
await new Promise((resolve,reject)=>{const tx=db.transaction(PHOTO_STORE,'readwrite');tx.objectStore(PHOTO_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not delete photo'));});
} catch(error){console.error('Dinliminate storage error',error)}
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
 }catch(error){console.error('Dinliminate storage error',error)}
}
async function storeMealPhotoSet(id,photos){
 const list=deps.dedupeMealPhotos(photos,8),refs=[];
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
 const refs=deps.mealPhotoList(item),loaded=[];
 for(const ref of refs){if(String(ref).startsWith('idb:')){const data=await getStoredPhoto(String(ref).slice(4));if(data)loaded.push(data);}else loaded.push(ref);}
 return loaded;
}
async function hydrateCustomPhotos(){
 let changed=false;
 for(const item of S.custom){
  const refs=deps.mealPhotoList(item),loaded=await hydrateStoredMealPhotoList(item);
  if(loaded.length){const clean=deps.dedupeMealPhotos(loaded,8);item.images=clean;item.image=clean[0];if(clean.length!==refs.length)changed=true;}
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
  const refs=deps.mealPhotoList(item),loaded=await hydrateStoredMealPhotoList(item);
  if(loaded.length){item.images=loaded;item.image=loaded[0];}
  else if(refs.some(x=>String(x).startsWith('idb:'))){item.images=[];item.image=deps.DEFAULT_FOOD_IMAGE;}
 }
 if(changed)save();
}
async function deleteStoredMealPhotos(id){
 const target=String(id||'').trim();if(!target)return;
 try{
  const db=await openPhotoDB();
  await new Promise((resolve,reject)=>{
   const tx=db.transaction(PHOTO_STORE,'readwrite'),objectStore=tx.objectStore(PHOTO_STORE),req=objectStore.getAllKeys();
   req.onsuccess=()=>{for(const rawKey of req.result||[]){const key=String(rawKey);if(key===target||key.startsWith(target+':photo:')){objectStore.delete(rawKey);storedPhotoIds.delete(key);}}};
   req.onerror=()=>reject(req.error||new Error('Could not inspect stored meal photos'));
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('Could not delete stored meal photos'));tx.onabort=()=>reject(tx.error||new Error('Meal photo deletion was interrupted'));
  });
 }catch(error){console.error('Dinliminate storage error',error);}
}

function updateStorageIndicator() {
const el=$('storageIndicator'); if(!el)return;
el.classList.toggle('hidden', !S.storageWarning);
}
async function migrateCustomPhotos(){
 let changed=false;
 for(const item of S.custom){
  const photos=deps.dedupeMealPhotos(deps.mealPhotoList(item),8);if(!photos.length||!photos.some(x=>String(x).startsWith('data:image/')))continue;
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
saved:S.saved, winnerItem:S.winnerItem, winnerType:S.winnerType, schemaVersion:deps.STORAGE_VERSION, deleted:[...(S.deleted||[])], deletedCustomMeals:S.deletedCustomMeals||[],
history:Array.isArray(S.history)?S.history.slice(0,120):[],familySession:S.familySession||null,restaurantWebsiteCache:S.restaurantWebsiteCache&&typeof S.restaurantWebsiteCache==='object'?S.restaurantWebsiteCache:{},swipeHintDismissed:!!S.swipeHintDismissed,restaurantSearchOrigin:S.restaurantSearchOrigin, restaurantSearchKey:S.restaurantSearchKey||'', restaurantSearchDegraded:!!S.restaurantSearchDegraded, locationFreshAt:S.locationFreshAt||null, maybeDeck:!!S.maybeDeck, foodMaybeRound:!!S.foodMaybeRound, restaurantMaybeRound:!!S.restaurantMaybeRound, quickCutsCollapsed:{food:!!S.quickCutsCollapsed?.food,restaurant:!!S.quickCutsCollapsed?.restaurant}, mealTimeCutsCollapsed:!!S.mealTimeCutsCollapsed, mealTimeFilters:[...S.mealTimeFilters],
mealTimeSettings:{custom:(S.mealTimeSettings?.custom||[]).map(x=>({id:String(x.id),name:String(x.name||'').trim()})).filter(x=>x.name),names:{...(S.mealTimeSettings?.names||{})},order:[...(S.mealTimeSettings?.order||[])],disabled:[...((S.mealTimeSettings?.disabled instanceof Set)?S.mealTimeSettings.disabled:new Set())]},
custom:S.custom.map(x=>{
 const photos=deps.dedupeMealPhotos(deps.mealPhotoList(x),8);
 const images=photos.map((photo,i)=>{
  const key=mealPhotoStorageKey(x.id,i);
  return String(photo).startsWith('data:image/')&&storedPhotoIds.has(key)?'idb:'+key:photo;
 });
 return {...x,images,image:images[0]||x.image||''};
}),
customQuickCuts:(S.customQuickCuts||[]).map(x=>({...x,image:(String(x.image||'').startsWith('data:image/') && storedPhotoIds.has('quickcut:'+x.id))?'idb:quickcut:'+x.id:x.image}))
};
try {
localStorage.setItem(deps.KEY, JSON.stringify(data));
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


const STORAGE_KEY='dinliminate:v1';
const LEGACY_STORAGE_KEYS=Object.freeze(['dinliminate.clean.cp1','dinliminate.item.notes.v1','dinliminate.clean.history','dinliminate.family.v1','dinliminate.restaurant.websites.v1','dinliminate.start-screen','dinliminate.swipeHint.v4','dinliminate.swipeHint.v5']);
function clearPersistedStorage(){try{localStorage.removeItem(STORAGE_KEY);LEGACY_STORAGE_KEYS.forEach(key=>localStorage.removeItem(key));return true;}catch(error){console.error('Dinliminate storage error',error);return false;}}
export {STORAGE_KEY,LEGACY_STORAGE_KEYS,PHOTO_STORE,storedPhotoIds,clearPersistedStorage,loadItemNotes,saveItemNotes,itemNoteKey,itemNote,setItemNote,openPhotoDB,putStoredPhoto,getStoredPhoto,deleteStoredPhoto,mealPhotoStorageKey,pruneMealPhotoKeys,storeMealPhotoSet,deleteStoredMealPhotos,hydrateStoredMealPhotoList,hydrateCustomPhotos,updateStorageIndicator,migrateCustomPhotos,save};
