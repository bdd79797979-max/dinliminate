import { store } from '../../state/store.js';
const S = store.get();
import { $ } from '../../ui/dom.js';
import { esc } from '../../ui/esc.js';
import { appToast, appConfirm, openModal } from '../../ui/modal.js';
import { save, clearPersistedStorage } from '../../state/storage.js';
import { buildFood, foodQuick, mealTimeNames } from '../meals/index.js';
import { readHistory } from '../history/index.js';
import { imageProxyUrl, home, removeFoodOverlays, APP_VERSION, APP_BUILD, APP_BUILD_DATE, HUNGRY_IMAGE, FINAL_RESTAURANT_IMAGE, DEFAULT_MEAL_TIME_DEFS, getDefaultFoods, closeDrawer, resetRestaurantPhotoCaches } from '../../main.js';
import { openPhotoDB, PHOTO_STORE, storedPhotoIds } from '../../state/storage.js';
import { tutorialModeEnabled, tutorialState, stopTutorialMode, tutorialHideOverlay, startTutorialFromHome } from '../tutorial/index.js';
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
 settingsActionButton('googleUsageSettings','◉','Google Usage','Monthly Google API requests, caps, and remaining budget.','google-usage-action')+
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
 $('googleUsageSettings').onclick=()=>googleUsageView();
}
function privacyView() {
const body = '<div class="info-copy"><h4>Privacy & Data</h4><p>Dinliminate uses your selected address or optional device location to find nearby restaurants. Location access is optional.</p><p>Restaurant/address results are retrieved through Dinliminate’s search service using third-party mapping and place providers. Your exact location or selected address is used for that search request.</p><p>Your meal choices, hidden items, history, and custom-meal information are stored on this device using browser storage. Custom food photos may be stored in IndexedDB on the device.</p><p>Restaurant and meal images may be loaded from third-party image hosts. Restaurant availability, hours, phone numbers, websites, and menu information can change and are supplied by external providers.</p></div>';
openModal('privacyModal','Privacy',body);
}

const GOOGLE_USAGE_SKUS = Object.freeze({
 'text-search-pro':'Text Search · Pro',
 'nearby-search-pro':'Nearby Search · Pro',
 'text-search-enterprise':'Text Search · Enterprise',
 'nearby-search-enterprise':'Nearby Search · Enterprise',
 'place-details-pro':'Place Details · Pro',
 'place-details-essentials':'Place Details · Essentials',
 'place-details-enterprise':'Place Details · Enterprise',
 'place-photo':'Place Photos'
});
const GOOGLE_USAGE_SKU_ORDER = Object.keys(GOOGLE_USAGE_SKUS);
function googleUsageCount(value){
 const n=Number(value);
 return Number.isFinite(n)&&n>=0?new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(n):'—';
}
function googleUsageMonthLabel(value){
 const match=String(value||'').match(/^(\d{4})-(\d{2})$/);
 if(!match)return 'Current billing month';
 return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(Number(match[1]),Number(match[2])-1,1,12)));
}
function googleUsageDateLabel(value,timezone='America/Los_Angeles'){
 const date=new Date(String(value||''));
 if(!Number.isFinite(date.getTime()))return 'the next billing month';
 return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:timezone}).format(date);
}
function googleUsageStatusMeta(status){
 const states={
  ok:{label:'Within cap',className:'ok'},
  warning:{label:'Approaching cap',className:'warning'},
  exhausted:{label:'Monthly cap reached',className:'exhausted'},
  disabled:{label:'Disabled',className:'disabled'},
  'blocked-untracked':{label:'Tracking unavailable',className:'blocked'},
  unknown:{label:'Status unavailable',className:'unknown'}
 };
 return states[status]||states.unknown;
}
function googleUsageRowMarkup(sku){
 const key=String(sku?.sku||'');
 const label=GOOGLE_USAGE_SKUS[key]||key.replace(/-/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());
 const cap=Number(sku?.cap);
 const capValid=Number.isFinite(cap)&&cap>0;
 const used=sku?.used===null||sku?.used===undefined||sku?.used===''?null:Number(sku.used);
 const usedValid=used!==null&&Number.isFinite(used)&&used>=0;
 const remainingRaw=sku?.remaining===null||sku?.remaining===undefined?null:Number(sku.remaining);
 const remaining=remainingRaw!==null&&Number.isFinite(remainingRaw)&&remainingRaw>=0?remainingRaw:(usedValid&&capValid?Math.max(0,cap-used):null);
 const rawPercent=sku?.percent===null||sku?.percent===undefined?null:Number(sku.percent);
 const percent=usedValid&&capValid?Math.max(0,Math.min(100,Number.isFinite(rawPercent)?rawPercent:(used/cap)*100)):null;
 const status=googleUsageStatusMeta(String(sku?.status||'unknown'));
 const until=sku?.disabledUntil?googleUsageDateLabel(sku.disabledUntil):'';
 const usageText=usedValid&&capValid?googleUsageCount(used)+' / '+googleUsageCount(cap)+' used':'Usage unavailable';
 const remainingText=remaining===null?'Remaining unknown':googleUsageCount(remaining)+' remaining';
 const percentText=percent===null?'Usage unknown':percent.toFixed(1).replace(/\.0$/,'')+'% used';
 const progress=percent===null?'':'<div class="google-usage-progress" aria-label="'+esc(percentText)+'"><span style="width:'+percent.toFixed(1)+'%"></span></div>';
 const detail=until&&status.className==='disabled'?'Disabled until '+esc(until):remainingText;
 return '<article class="google-usage-row status-'+status.className+'" data-google-sku="'+esc(key)+'">'+
  '<div class="google-usage-row-head"><div class="google-usage-row-title"><b>'+esc(label)+'</b><span>'+esc(usageText)+'</span></div>'+
  '<span class="google-usage-status">'+esc(status.label)+'</span></div>'+
  (progress||'<div class="google-usage-progress is-unknown" aria-hidden="true"><span></span></div>')+
  '<div class="google-usage-row-foot"><span>'+esc(detail)+'</span><span>'+esc(percentText)+'</span></div></article>';
}
function renderGoogleUsage(data){
 if(!data||data.ok!==true||!Array.isArray(data.skus)||!data.skus.length)throw new Error('Unexpected Google usage response');
 const durable=data.durable===true;
 const month=googleUsageMonthLabel(data.month);
 let noticeClass='healthy',noticeTitle='Usage tracking is connected.',noticeText='Counts shown here come from Dinliminate’s monthly usage ledger.';
 if(!data.googleMasterEnabled){
  noticeClass='blocked';
  noticeTitle='Google services are disabled.';
  noticeText='The master switch is off. This tracker is read-only and cannot enable Google services.';
 }else if(!durable&&Number(data.untrackedLimit||0)<=0){
  noticeClass='blocked';
  noticeTitle='Durable tracking is unavailable.';
  noticeText='Google API calls are blocked until reliable monthly tracking is available. Usage is shown as unknown, not zero.';
 }else if(!durable){
  noticeClass='warning';
  noticeTitle='Only temporary tracking is available.';
  noticeText='These counts may reset when a serverless instance restarts, so they are not a reliable monthly total.';
 }else if(data.status==='limited'){
  noticeClass='warning';
  noticeTitle='One or more Google categories are limited.';
  noticeText='Review the individual rows below. Other categories may remain available.';
 }
 const billingTimezone=String(data.billingMonthTimeZone||'America/Los_Angeles');
 const resetDate=googleUsageDateLabel(data.nextBillingMonth,billingTimezone);
 const skus=[...data.skus].sort((a,b)=>{
  const ai=GOOGLE_USAGE_SKU_ORDER.indexOf(String(a?.sku||'')),bi=GOOGLE_USAGE_SKU_ORDER.indexOf(String(b?.sku||''));
  return (ai<0?999:ai)-(bi<0?999:bi);
 });
 return '<div class="google-usage-view">'+
  '<div class="google-usage-overview"><div><span class="google-usage-kicker">BILLING MONTH</span><h4>'+esc(month)+'</h4><p>Resets '+esc(resetDate)+' · Pacific time</p></div>'+
  '<span class="google-usage-tracker-state '+(durable?'connected':'not-connected')+'">'+(durable?'Durable tracker':'Tracker limited')+'</span></div>'+
  '<div class="google-usage-notice '+noticeClass+'" role="status"><b>'+esc(noticeTitle)+'</b><p>'+esc(noticeText)+'</p></div>'+
  '<div class="google-usage-grid">'+skus.map(googleUsageRowMarkup).join('')+'</div>'+
  '<p class="google-usage-footnote">These are Dinliminate-tracked API requests, not a live Google Cloud billing total. Viewing or refreshing this screen does not call Google APIs.</p>'+
  '</div>';
}
async function loadGoogleUsage(modal){
 const refresh=modal?.querySelector('#googleUsageRefresh');
 const target=modal?.querySelector('#googleUsageData');
 if(!modal?.isConnected||!refresh||!target)return;
 refresh.disabled=true;
 refresh.textContent='Loading…';
 target.setAttribute('aria-busy','true');
 try{
  const response=await fetch('/api/google-usage',{method:'GET',cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.ok!==true)throw new Error('Google usage endpoint unavailable');
  target.innerHTML=renderGoogleUsage(data);
 }catch(error){
  target.innerHTML='<div class="google-usage-error" role="alert"><b>Usage information is unavailable.</b><p>The tracker could not be read. Try Refresh again; unavailable data is not treated as zero usage.</p></div>';
 }finally{
  target.setAttribute('aria-busy','false');
  if(refresh.isConnected){refresh.disabled=false;refresh.textContent='↻ Refresh';}
 }
}
function googleUsageView(){
 const body='<div class="google-usage-panel"><div class="google-usage-toolbar"><p>Monthly usage and protective limits for Dinliminate’s Google integrations.</p><button class="google-usage-refresh" id="googleUsageRefresh" type="button">↻ Refresh</button></div><div id="googleUsageData" aria-live="polite" aria-busy="true"><div class="google-usage-loading">Loading monthly Google API usage…</div></div></div>';
 const modal=openModal('googleUsageModal','Google Usage Tracker',body);
 modal.querySelector('#googleUsageRefresh').onclick=()=>loadGoogleUsage(modal);
 void loadGoogleUsage(modal);
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
  try{resetRestaurantPhotoCaches();}catch(error){console.error('Dinliminate error',error)}
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

export { settingsActionButton, settingsView, privacyView, googleUsageView, exportHistoryPrint, exportPdfView, shareWinner, resetRound, resetRestoreView, copyAppUrl, addToPhoneFlow, shareApp, clearMealPhotoStorage, clearAllDinliminateStorage, updateAppFlow, resetAppDataFlow, systemRestoreFlow };
