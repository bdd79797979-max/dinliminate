import { $ } from './dom.js';
import { esc } from './esc.js';

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


import { state as S } from '../state/store.js';
import { itemNote, setItemNote, saveItemNotes } from '../state/storage.js';
import { mealTimesFor } from '../features/meals/index.js';
import { restaurantFallbackImage } from '../features/restaurants/index.js';
import { imageProxyUrl, mealImageUrl, mealPhotoList, foodPhoto, foodPhotoFallback, hydrateMealPhotoGallery, restaurantWebsitePresentation, hydrateRestaurantWebsite, restaurantPhoneSearchUrl, restaurantDirectionsUrl, bindImageFallback, swapImageWhenReady, phoneHref, show, foodHideItem, HUNGRY_IMAGE, FINAL_FOOD_IMAGE, FINAL_RESTAURANT_IMAGE } from '../main.js';

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



export { openModal, bindDetailNotes, visibleCardDetailImage, warmDetailImage, detailsSheet };
