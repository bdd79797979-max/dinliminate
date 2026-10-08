import { state as S } from '../../state/store.js';
import { $ } from '../../ui/dom.js';
import { esc } from '../../ui/esc.js';
import { save } from '../../state/storage.js';
import { mealPhotoList, foodPhoto, foodPhotoFallback } from '../meals/index.js';
import { winner } from '../winner/index.js';
import { markMealImageUnavailable, swapImageWhenReady, loadMealPhotoCandidates, ensureMealCardPhotoPager } from '../../main.js';
import { updateDecisionBackButtons, pushDecisionHistory, captureFoodDecisionState, restoreFoodDecisionState, legacyFoodBack, show, previewDecisionCount, familyNormalBar, familyIsBrowseStage, familyBrowseNext, familyBrowsePrevious, familyBrowseBack, familyRoundStage } from '../../main.js';

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


function bindFoodSwipe(){bindSwipeCard('foodCard',()=>familyIsBrowseStage('meal')?familyBrowseNext('meal'):foodCut(undefined,{fromSwipe:true}),()=>familyIsBrowseStage('meal')?familyBrowsePrevious('meal'):foodMaybe(undefined,{fromSwipe:true}))}
async 
export { clearLegacySwipeInstructions, dismissSwipeHint, maybeShowInCardSwipeCoach, setChoiceCount, foodChoiceIndex, drawFood, foodCommit, foodCut, foodMaybe, resolveFoodAfterDecision, foodBack, triggerSwipeHaptic, waitForSwipeImage, stageSwipePreview, nextFoodIndexList, buildPreparedFoodCard, cachePreparedFoodCards, ensurePreparedFoodNextCardMarkup, setFoodNextCardImage, populateFoodNextCard, prepareFoodNextCard, preloadSwipeImage, waitForVisualImage, primeFoodSwipeMedia, bindRestaurantPhotoPinch, bindSwipeCard, bindFoodSwipe, startFood, waitForNextPaints };
