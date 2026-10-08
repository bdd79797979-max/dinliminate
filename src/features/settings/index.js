import { store } from '../../state/store.js';
const S = store.get();
import { $ } from '../../ui/dom.js';
import { esc } from '../../ui/esc.js';
import { appToast, appConfirm, openModal } from '../../ui/modal.js';
import { save, clearPersistedStorage } from '../../state/storage.js';
import { buildFood, foodQuick, mealTimeNames } from '../meals/index.js';
import { readHistory } from '../history/index.js';
import { imageProxyUrl, home } from '../../main.js';
import { familySessionClear, stopFamilyLobbyPolling } from '../family/index.js';

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
if(navigator.share){navigator.share({title:'Dinliminate',text}).catch(error=>{console.error('Dinliminate async operation failed',error);});}
else if(navigator.clipboard) navigator.clipboard.writeText(text).then(()=>appToast('Decision copied.')).catch(error=>{console.error('Dinliminate async operation failed',error);});
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
     clearPersistedStorage();

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
  save();
  home();
}
async function updateAppFlow(){
 appToast('Checking for updates…');
 try{
  const registrations=await navigator.serviceWorker?.getRegistrations?.()||[];
  await Promise.all(registrations.map(reg=>reg.update().catch(error=>{console.error('Dinliminate async operation failed',error);})));
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

export { settingsActionButton, settingsView, privacyView, exportHistoryPrint, exportPdfView, shareWinner, resetRound, resetRestoreView, copyAppUrl, addToPhoneFlow, shareApp, clearMealPhotoStorage, clearAllDinliminateStorage, updateAppFlow, resetAppDataFlow, systemRestoreFlow };
