import { store } from '../../state/store.js';
const S = store.get();
import { $ } from '../../ui/dom.js';
import { esc } from '../../ui/esc.js';
import { save } from '../../state/storage.js';
import { mealTimeNames, buildFood, foodQuick, renderMaybeDeckToggle, bindMaybeDeckToggle } from '../meals/index.js';
import { FINAL_FOOD_IMAGE, HUNGRY_IMAGE, hydrateMealPhotoGallery } from '../../main.js';
import { tutorialModeEnabled, tutorialState, tutorialEnterDecisionScreen } from '../tutorial/index.js';
import { familyEnterMaybes, familyPickSingle } from '../family/index.js';
import { bindCardButton } from '../restaurants/index.js';
import { detailsSheet } from '../../ui/modal.js';
import { mealPhotoList, foodPhoto, foodPhotoFallback } from '../../main.js';
import { winner } from '../winner/index.js';
import { markMealImageUnavailable, swapImageWhenReady, loadMealPhotoCandidates, ensureMealCardPhotoPager } from '../../main.js';
import { updateDecisionBackButtons, pushDecisionHistory, captureFoodDecisionState, restoreFoodDecisionState, legacyFoodBack, show, previewDecisionCount, familyNormalBar, familyIsBrowseStage, familyBrowseNext, familyBrowsePrevious, familyBrowseBack, familyRoundStage } from '../../main.js';
import { bindSwipeCard, getSwipeMachine, triggerSwipeHaptic } from './swipeMachine.js';

function clearLegacySwipeInstructions(){
 document.querySelectorAll('.swipe-card-coach,.swipe-hint,[data-swipe-instruction="true"]').forEach(el=>el.remove());
}
function dismissSwipeHint(){
 clearLegacySwipeInstructions();
 S.swipeHintDismissed=true;save();
}
document.addEventListener('pointerdown',event=>{
 const target=event.target;
 if(!(target instanceof Element))return;
 if(target.closest('#food .card,#restaurant .card,#food .unified-swipe-actions .round-action,#restaurant .unified-swipe-actions .round-action')){
   dismissSwipeHint();
 }
},true);
function maybeShowInCardSwipeCoach(){
 if(S.swipeHintDismissed){clearLegacySwipeInstructions();return;}
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
function normalizeFoodPoolIdentities(){
 const source=Array.isArray(S.pool)?S.pool:[];
 const oldIndex=Math.max(0,Math.min(Number(S.index)||0,Math.max(0,source.length-1)));
 const selectedId=String(source[oldIndex]?.id||'');
 const seen=new Set(),unique=[];
 for(const item of source){
  const id=String(item?.id||'').trim();
  if(!id||seen.has(id))continue;
  seen.add(id);unique.push(item);
 }
 if(unique.length!==source.length){
  S.pool=unique;
  const selectedIndex=selectedId?unique.findIndex(item=>String(item?.id||'')===selectedId):-1;
  S.index=selectedIndex>=0?selectedIndex:Math.max(0,Math.min(oldIndex,Math.max(0,unique.length-1)));
 }
 return S.pool;
}
function drawFood(options={}){
 normalizeFoodPoolIdentities();
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
 const holdCardForMedia=!!foodCard&&!sameMealReady;
 const loadToken=String(Number(img.dataset.mealLoadToken||0)+1);
 img.dataset.mealLoadToken=loadToken;
 let mealReadyResolve=()=>{};
 const mealReadyPromise=new Promise(resolve=>{mealReadyResolve=resolve;});
 if(foodCard){
  foodCard.dataset.mealLoadToken=loadToken;
  foodCard.__mealReadyPromise=mealReadyPromise;
  if(holdCardForMedia)foodCard.dataset.mediaPending='true';
  else delete foodCard.dataset.mediaPending;
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
    delete foodCard.dataset.mediaPending;
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
 // CP1326: update the waiting card's identity immediately on every active-card
 // selection. Its image loader is token-fenced, so an older photo response cannot
 // restore a stale preview while this Meal's own photo is still arriving.
 if(!options.deferPrime)primeFoodSwipeMedia();
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
 foodCommit('maybe',item);S.maybe.add(item.id);
 const recyclesMaybeRound=!!S.maybeDeck||!!S.foodMaybeRound;
 if(recyclesMaybeRound){
  // Advance before redraw so an already-kept Meal never pins the active card.
  // Modulo wrap intentionally lets a one-card Maybe round repeat continuously.
  const nextIndex=foodChoiceIndex(S.pool,(S.index+1)%Math.max(1,S.pool.length),true);
  if(nextIndex>=0)S.index=nextIndex;
 }
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

function waitForSwipeImage(img,card,key,timeoutMs=1400){
 if(!img||!card)return Promise.resolve(false);
 const token=String(card.dataset.swipePreviewToken||'');
 const expectedKey=String(key??'');
 const sameTarget=()=>card.isConnected
   && String(card.dataset.swipePreviewToken||'')===token
   && String(card.dataset.swipePreviewKey||'')===expectedKey
   && card.querySelector('img')===img;
 const previousCleanup=img.__swipePreviewCleanup;
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
   Promise.resolve(decoded).catch(error=>{console.error('Dinliminate async operation failed',error);}).then(()=>{
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
let foodNextCardRenderSequence=0;
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
 const renderSequence=String(++foodNextCardRenderSequence);
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
 nextCard.dataset.previewRenderSequence=renderSequence;
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
  if(nextCard.dataset.previewRenderSequence!==renderSequence||nextCard.dataset.mealId!==view.id)return false;
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
   Promise.resolve(decoded).catch(error=>{console.error('Dinliminate async operation failed',error);}).then(()=>finish(img.naturalWidth>0&&img.naturalHeight>0));
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

function bindFoodSwipe(){bindSwipeCard('foodCard',context=>familyIsBrowseStage('meal')?familyBrowseNext('meal'):foodCut(context?.row||S.pool[S.index],{fromSwipe:true}),context=>familyIsBrowseStage('meal')?familyBrowsePrevious('meal'):foodMaybe(context?.row||S.pool[S.index],{fromSwipe:true}),{kind:'food',getContext:()=>{const item=S.pool[S.index];return {id:String(item?.id||''),row:item,wasMaybe:!!item&&S.maybe.has(item.id)};},onPreview:context=>previewDecisionCount('food',context.direction,context.wasMaybe)});}
export { clearLegacySwipeInstructions, dismissSwipeHint, maybeShowInCardSwipeCoach, setChoiceCount, foodChoiceIndex, drawFood, foodCommit, foodCut, foodMaybe, resolveFoodAfterDecision, foodBack, waitForSwipeImage, stageSwipePreview, nextFoodIndexList, buildPreparedFoodCard, cachePreparedFoodCards, ensurePreparedFoodNextCardMarkup, setFoodNextCardImage, populateFoodNextCard, prepareFoodNextCard, preloadSwipeImage, waitForVisualImage, primeFoodSwipeMedia, bindRestaurantPhotoPinch, bindSwipeCard, getSwipeMachine, triggerSwipeHaptic, bindFoodSwipe, startFood, waitForNextPaints };
