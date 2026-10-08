import { store } from '../../state/store.js';
const S = store.get();
import { $ } from '../../ui/dom.js';
import { esc } from '../../ui/esc.js';
import { recordHistory } from '../history/index.js';
import { triggerSwipeHaptic } from '../swipe/index.js';
import { imageProxyUrl, mealImageUrl, show, familyHideWinnerMeta, HUNGRY_IMAGE, FINAL_RESTAURANT_IMAGE } from '../../main.js';
import { foodPhoto, foodPhotoFallback } from '../../main.js';
import { bindRestaurantPhotoPinch } from '../swipe/index.js';
import { dedupeRestaurantPool, restaurantHidden, restaurantCategory, restaurantQuickMatches, restaurantMatchesQuery } from '../restaurants/index.js';
import { restaurantFallbackImage } from '../../main.js';

function hideCelebration(){
 const el=$('celebration');
 if(celebrationHideTimer){clearTimeout(celebrationHideTimer);celebrationHideTimer=0;}
 if(el){el.classList.add('hidden');el.innerHTML='';}
}
function triggerCelebration(goldOnly=false) {
const el = $('celebration');
if (!el) return;
if(celebrationHideTimer){clearTimeout(celebrationHideTimer);celebrationHideTimer=0;}
el.innerHTML = ''; 
const colors = goldOnly
 ? ['#c6a46a','#f1d894','#fff7df','#d8b86b','#fffaf0']
 : ['#c6a46a','#f1d894','#f5f1e8','#ffb04a','#fffaf0'];
for (let b=0;b<3;b++) {
const burst = document.createElement('div');
burst.className='firework-burst burst-'+(b+1);
for (let i=0;i<18;i++) {
const p=document.createElement('span');
p.style.setProperty('--angle',(i*20)+'deg');
p.style.setProperty('--delay',(b*0.11 + (i%5)*0.015)+'s');
p.style.setProperty('--color',colors[i%colors.length]);
burst.appendChild(p);
}
el.appendChild(burst);
}
el.classList.remove('hidden');
celebrationHideTimer=window.setTimeout(()=>{el.classList.add('hidden');el.innerHTML='';celebrationHideTimer=0;},14000);
}
function triggerWinnerMoment(hungry=false){
 const el=$('winner');if(!el)return;
 el.classList.remove('winner-reveal');
 void el.offsetWidth;
 if(!hungry){
  el.classList.add('winner-reveal');
  triggerSwipeHaptic();
  window.setTimeout(()=>el.classList.remove('winner-reveal'),1800);
 }
}

function wheelPoint(cx,cy,r,angle){
const rad=angle*Math.PI/180;
return {x:cx+Math.cos(rad)*r,y:cy+Math.sin(rad)*r};
}

function sampleHungryWheel(pool,selected=null,count=12){
 const source=[...(pool||[])].filter(Boolean);
 if(!source.length)return [];
 const target=String(selected?.id||'');
 const others=source.filter(x=>String(x.id)!==target);
 for(let i=others.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[others[i],others[j]]=[others[j],others[i]];}
 const take=Math.min(count,source.length);
 const chosen=others.slice(0,Math.max(0,take-(selected?1:0)));
 if(selected){
   const slot=Math.floor(Math.random()*Math.min(take,Math.max(1,chosen.length+1)));
   chosen.splice(Math.min(slot,chosen.length),0,selected);
 }
 return chosen.slice(0,take);
}
function renderHungryWheel(){
 const svg=$('hungryWheel');
 const countEl=$('hungryWheelCount');
 if(!svg)return;
 const basePool=hungryWheelPool();
 const pool=basePool.length?basePool:allFoods();
 S.hungryWheelDisplayItems=pool;
 if(countEl)countEl.textContent=pool.length+' meals on the wheel';
 const cx=180,cy=180,r=168,inner=35,step=360/Math.max(1,pool.length);
 const fills=['#171716','#26333b','#4a3a25','#d9cdb7','#20282d','#5a4426','#191918','#31414a','#745b31','#c9bea9','#242c30','#846736'];
 svg.setAttribute('aria-label','Dinner wheel with '+pool.length+' meals');
 svg.innerHTML=pool.map((item,index)=>{
   const start=-90+index*step, end=start+step-.08;
   const p1=wheelPoint(cx,cy,r,start),p2=wheelPoint(cx,cy,r,end);
   const q1=wheelPoint(cx,cy,inner,end),q2=wheelPoint(cx,cy,inner,start);
   const d='M '+p1.x.toFixed(2)+' '+p1.y.toFixed(2)+' A '+r+' '+r+' 0 0 1 '+p2.x.toFixed(2)+' '+p2.y.toFixed(2)+' L '+q1.x.toFixed(2)+' '+q1.y.toFixed(2)+' A '+inner+' '+inner+' 0 0 0 '+q2.x.toFixed(2)+' '+q2.y.toFixed(2)+' Z';
   const landed=String(S.hungryWheelLandedId||'')===String(item.id);
   const fill=landed?'#c6a46a':fills[index%fills.length];
   return '<path class="wheel-segment'+(landed?' is-landed':'')+'" data-wheel-index="'+index+'" d="'+d+'" fill="'+fill+'" stroke="#0b0b0b" stroke-width="1.15"><title>Meal choice</title></path>';
 }).join('')+
 '<circle class="wheel-center" cx="180" cy="180" r="36" fill="#0e0e0d" stroke="#c6a46a" stroke-width="1.7"/>'+
 '<circle cx="180" cy="180" r="7" fill="#c6a46a"/>';
 svg.style.setProperty('--wheel-rotation',S.hungryWheelRotation+'deg');
 svg.style.setProperty('--wheel-resting-rotation',S.hungryWheelRotation+'deg');
}

function hungryWheelPool(){
const active=allFoods().filter(item=>!S.hidden.has(String(item.id)));
return active.length?active:allFoods();
}
function showHungryWheelResult(item){
const panel=$('hungryWheelPanel'),result=$('hungryWheelResult'),name=$('hungryWheelResultName'),img=$('hungryWheelResultImg'),choose=$('hungryWheelChoose'),spin=$('hungryWheelSpin');
if(name)name.textContent=item?.name||'';
if(img){
 const src=foodPhoto(item);
 img.src=src;
 img.alt=item?.name||'Chosen meal';
 img.onerror=function(){
   const fb=foodPhotoFallback(item);
   if(this.src!==fb)this.src=fb;
 };
}
result?.classList.remove('hidden');
panel?.classList.add('has-landed');
if(choose){choose.disabled=false;choose.classList.remove('hidden');}
if(spin){spin.disabled=false;spin.textContent='Spin Again';}
}
function hungryRestaurantPool(){
 const raw=(S.restaurantPool||[]).filter(row=>{
   if(!row)return false;
   if(row._hidden||restaurantHidden(row))return false;
   if(!restaurantMatchesQuery(row))return false;
   if([...S.restaurantCuts].some(label=>restaurantQuickMatches(row,label)))return false;
   return true;
 });
 const unique=dedupeRestaurantPool(raw);
 return unique.length?unique:raw;
}
function hungryRestaurantPick(excludeId=null){
 const pool=hungryRestaurantPool();
 if(!pool.length)return null;
 const candidates=excludeId==null?pool:pool.filter(row=>String(row.id)!==String(excludeId));
 const source=candidates.length?candidates:pool;
 const index=Number.isInteger(forced)&&forced>=0&&forced<source.length?forced:Math.floor(Math.random()*source.length);
 return source[index]||null;
}
function renderHungryRestaurantMystery(item,covered=true){
 const card=$('hungryMysteryCard'),img=$('hungryMysteryImg'),result=$('hungryMysteryResult');
 const choose=$('hungryMysteryChoose'),again=$('hungryMysteryAgain'),reveal=$('hungryMysteryReveal');
 if(!card||!img||!result)return;
 if(item){
   const src=imageProxyUrl(item?.photo||item?.image||item?.photoFallback||restaurantFallbackImage(item));
   img.src=src;
   img.alt=item.name||'Mystery restaurant';
   img.onerror=function(){
     const fb=restaurantFallbackImage(item);
     if(this.src!==fb)this.src=fb;
   };
   img.dataset.restaurantPhotoKey=String(item.id||item.canonicalId||'');
 }
 card.classList.toggle('is-revealed',!covered);
 const cover=card.querySelector('.hungry-mystery-cover');
 if(cover)cover.classList.toggle('hidden',!covered);
 result.classList.toggle('hidden',covered||!item);
 if(item&&!covered){
   $('hungryMysteryResultImg').src=imageProxyUrl(item?.photo||item?.image||item?.photoFallback||restaurantFallbackImage(item));
   $('hungryMysteryResultImg').alt=item.name||'Chosen restaurant';
   $('hungryMysteryResultImg').dataset.restaurantPhotoKey=String(item.id||item.canonicalId||'');
   $('hungryMysteryResultName').textContent=item.name||'';
   const meta=[restaurantCategory(item),Number.isFinite(Number(item.distance))?Number(item.distance).toFixed(1)+' mi':String(item.address||'').split(',')[0]].filter(Boolean).join(' · ');
   $('hungryMysteryResultMeta').textContent=meta;
   hydrateRestaurantPhoto(item,'#hungryRestaurantPanel');
 }
 if(again){const canAgain=hungryRestaurantPool().length>=2;again.classList.toggle('hidden',covered||!canAgain);again.disabled=false;}
 if(choose)choose.classList.toggle('hidden',covered);
 if(reveal)reveal.classList.toggle('hidden',!covered);
}
function startHungryRestaurantMystery(){
 const countEl=$('hungryRestaurantCount');
 const pool=hungryRestaurantPool();
 if(countEl)countEl.textContent=pool.length?pool.length+' restaurants from your current search':'No restaurant options available';
 S.hungryRestaurantChoice=null;
 S.hungryRestaurantPendingChoice=null;
 const img=$('hungryMysteryImg');
 if(img){img.removeAttribute('src');img.alt='Mystery restaurant';}
 renderHungryRestaurantMystery(null,true);
 const reveal=$('hungryMysteryReveal');
 if(reveal)reveal.disabled=!pool.length;
}
function revealHungryRestaurant(){
 if(S.hungryRestaurantChoice)return;
 const item=S.hungryRestaurantPendingChoice||hungryRestaurantPick();
 if(!item){appToast('No restaurant options are available for a mystery pick.');return;}
 S.hungryRestaurantChoice=item;
 S.hungryRestaurantPendingChoice=null;
 const card=$('hungryMysteryCard'),reveal=$('hungryMysteryReveal'),result=$('hungryMysteryResult'),cover=card?.querySelector('.hungry-mystery-cover');
 if(!card||!result){renderHungryRestaurantMystery(item,false);return;}
 const img=$('hungryMysteryImg');
 if(img){
   const src=imageProxyUrl(item?.photo||item?.image||item?.photoFallback||restaurantFallbackImage(item));
   img.src=src; img.alt=item.name||'Mystery restaurant'; img.dataset.restaurantPhotoKey=String(item.id||item.canonicalId||'');
   img.onerror=function(){const fb=restaurantFallbackImage(item);if(fb&&this.src!==fb)this.src=fb;};
 }
 card.classList.remove('is-revealed');
 card.classList.add('is-revealing');
 cover?.classList.remove('hidden');
 result.classList.add('hidden');
 if(reveal){reveal.disabled=true;reveal.textContent='Unveiling…';}
 window.setTimeout(()=>{
   if(S.hungryRestaurantChoice!==item)return;
   card.classList.remove('is-revealing');
   card.classList.add('is-revealed');
   cover?.classList.add('hidden');
   renderHungryRestaurantMystery(item,false);
   const again=$('hungryMysteryAgain'),choose=$('hungryMysteryChoose');
   if(again)again.disabled=hungryRestaurantPool().length<2;
   if(choose)choose.focus?.();
 },1850);
}
function tryAnotherHungryRestaurant(){
 const current=S.hungryRestaurantChoice;
 const next=hungryRestaurantPick(current?.id);
 S.hungryRestaurantChoice=null;
 S.hungryRestaurantPendingChoice=next;
 renderHungryRestaurantMystery(null,true);
 const reveal=$('hungryMysteryReveal');
 if(reveal){
   reveal.disabled=!next;
   reveal.textContent='Reveal';
   reveal.classList.remove('hidden');
 }
 if(!next)appToast('No other restaurant options are available.');
}
function finishHungryWheelRotation(item,rotation){
 const svg=$('hungryWheel'),spin=$('hungryWheelSpin');
 S.hungryWheelRotation=rotation;
 S.hungryWheelChoice=item||null;
 S.hungryWheelLandedId=item?.id?String(item.id):null;
 S.hungryWheelSpinning=false;
 S.hungryWheelSpinPhase='idle';
 if(S.hungryWheelFrame){cancelAnimationFrame(S.hungryWheelFrame);S.hungryWheelFrame=null;}
 if(spin){spin.disabled=false;spin.setAttribute('aria-busy','false');spin.textContent='Spin Again';}
 svg?.classList.remove('is-spinning','is-continuous','is-slowing');
 if(svg){
   svg.style.setProperty('--wheel-rotation',rotation+'deg');
   svg.style.setProperty('--wheel-resting-rotation',rotation+'deg');
 }
 showHungryWheelResult(item);
 renderHungryWheel();
 triggerCelebration(true);
 triggerSwipeHaptic();
}

function startContinuousWheelSpin(){
 const svg=$('hungryWheel');
 if(!svg||S.hungryWheelSpinning)return;
 hideCelebration();
 if(S.hungryWheelSpinToken==null)S.hungryWheelSpinToken=0;
 S.hungryWheelSpinToken++;
 const pool=hungryWheelPool();
 if(!pool.length){appToast('There are no meals available to spin.');return;}
 S.hungryWheelDisplayItems=pool;
 S.hungryWheelSpinning=true;
 S.hungryWheelSpinPhase='spinning';
 S.hungryWheelWheelStartAt=performance.now();
 S.hungryWheelVelocity=420;
 S.hungryWheelLandedId=null;
 S.hungryWheelChoice=null;
 $('hungryWheelResult')?.classList.add('hidden');
 $('hungryWheelChoose')?.classList.add('hidden');
 $('hungryWheelPanel')?.classList.remove('has-landed');
 const spin=$('hungryWheelSpin');
 if(spin){spin.disabled=false;spin.textContent='Slow It Down';spin.setAttribute('aria-busy','true');}
 svg.classList.remove('is-slowing');
 svg.classList.add('is-continuous');
 const frame=(now)=>{
   if(!S.hungryWheelSpinning||S.hungryWheelSpinPhase!=='spinning')return;
   const dt=Math.min(40,Math.max(0,now-(S.hungryWheelLastFrame||now)));
   S.hungryWheelLastFrame=now;
   S.hungryWheelRotation+=S.hungryWheelVelocity*(dt/1000);
   svg.style.setProperty('--wheel-rotation',S.hungryWheelRotation+'deg');
   S.hungryWheelFrame=requestAnimationFrame(frame);
 };
 S.hungryWheelLastFrame=performance.now();
 S.hungryWheelFrame=requestAnimationFrame(frame);
}

function slowAndStopHungryWheel(){
 const svg=$('hungryWheel'),spin=$('hungryWheelSpin');
 if(!svg||!S.hungryWheelSpinning||S.hungryWheelSpinPhase!=='spinning')return;
 const pool=Array.isArray(S.hungryWheelDisplayItems)&&S.hungryWheelDisplayItems.length?S.hungryWheelDisplayItems:hungryWheelPool();
 if(!pool.length){S.hungryWheelSpinning=false;return;}
 const idx=Number.isInteger(forced)&&forced>=0&&forced<pool.length
   ? forced
   : Math.floor(Math.random()*pool.length);
 const item=pool[idx];
 const step=360/pool.length;
 const targetBase=-(idx*step+step/2);
 const current=S.hungryWheelRotation;
 const target=targetBase+360*Math.ceil((current-targetBase+720)/360);
 const token=S.hungryWheelSpinToken=Number(S.hungryWheelSpinToken||0)+1;
 S.hungryWheelSpinPhase='slowing';
 if(S.hungryWheelFrame){cancelAnimationFrame(S.hungryWheelFrame);S.hungryWheelFrame=null;}
 S.hungryWheelChoice=item;
 S.hungryWheelSpinning=true;
 if(spin){spin.disabled=true;spin.textContent='Slowing…';}
 svg.classList.remove('is-continuous');
 svg.classList.add('is-slowing');
 svg.style.setProperty('--wheel-rotation',target+'deg');
 const finish=()=>{if(token!==S.hungryWheelSpinToken)return;finishHungryWheelRotation(item,target);};
 svg.addEventListener('transitionend',finish,{once:true});
 window.setTimeout(()=>{if(S.hungryWheelSpinning&&S.hungryWheelSpinPhase==='slowing')finish();},3400);
}

function spinHungryWheel(){
 const spin=$('hungryWheelSpin');
 if(S.hungryWheelSpinPhase==='spinning'){slowAndStopHungryWheel();return;}
 if(S.hungryWheelSpinning)return;
 startContinuousWheelSpin();
}

function winner(item, explicitType=null, options={}) {
familyHideWinnerMeta();
const chosenFromWheel=!!S.hungryWheelChoice && String(S.hungryWheelChoice.id)===String(item?.id);
S.winnerItem = item;
S.winnerType = explicitType || (S.screen === 'restaurant' ? 'restaurant' : 'food');
if (item?.category !== 'Hungry' && item?.id && !options?.tutorial) recordHistory(item, S.winnerType, options);
show('winner');
if(tutorialModeEnabled()&&tutorialState.active&&tutorialState.returnContext){
 startTutorialForScreen('winner',true,{index:0});
}
const hungry = item?.category === 'Hungry';
S.hungryWheelChoice=null;
S.hungryWheelSpinning=false;
S.hungryWheelRotation=0;
S.hungryWheelDisplayItems=null;
S.hungryWheelLandedId=null;
S.hungryWheelSpinPhase='idle';
S.hungryWheelVelocity=0;S.hungryWheelFrame=null;
S.hungryRestaurantChoice=null;
S.hungryRestaurantPendingChoice=null;
S.hungryWheelSpinToken++;
const detailsBtn=$('details');
if(detailsBtn){detailsBtn.classList.toggle('hidden',hungry);detailsBtn.setAttribute('aria-hidden',String(hungry));detailsBtn.disabled=hungry;}
$('winner')?.classList.toggle('hungry-mode',hungry);
$('winnerEyebrow')?.classList.toggle('hidden',hungry);
$('winName').classList.toggle('hidden',hungry);
const isRestaurantHungry=hungry&&S.winnerType==='restaurant';
$('hungryWheelPanel')?.classList.toggle('hidden',!hungry||isRestaurantHungry);
$('hungryWheelPanel')?.setAttribute('aria-hidden',String(!hungry||isRestaurantHungry));
$('hungryRestaurantPanel')?.classList.toggle('hidden',!isRestaurantHungry);
$('hungryRestaurantPanel')?.setAttribute('aria-hidden',String(!isRestaurantHungry));
$('hungryNote').textContent=hungry
 ? (S.winnerType==='restaurant'?"You eliminated everything. It’s either this or Waffle House.":"You eliminated everything. It’s either this or Fish Sticks.")
 : '';
$('hungryNote').classList.toggle('hidden',!hungry);
$('winName').textContent = hungry ? 'HUNGRY ☹' : item.name;
const winImg = $('winImg');
if (!winImg) return;
winImg.classList.toggle('hungry-image', hungry);
 if(!hungry)winImg.dataset.noGenericFallback='1';
winImg.classList.toggle('hidden',hungry);
const winnerBaseFallback=S.winnerType==='restaurant'?restaurantFallbackImage(item):HUNGRY_IMAGE;
const winnerImage=S.winnerType==='food'
  ? mealImageUrl(item?.image || item?.photo || item?.photoFallback || winnerBaseFallback)
  : imageProxyUrl(item?.image || item?.photo || item?.photoFallback || winnerBaseFallback);
const winnerFallback=S.winnerType==='food'
  ? mealImageUrl(item?.photoFallback || item?.image || winnerBaseFallback)
  : imageProxyUrl(item?.photoFallback || item?.image || winnerBaseFallback);
winImg.src = winnerImage;
winImg.dataset.fallback = winnerFallback;
winImg.alt = item.name || 'Hungry';
winImg.referrerPolicy='no-referrer';
winImg.loading='eager';
winImg.onerror=function(){
  const fb=this.dataset.fallback||HUNGRY_IMAGE;
  const current=this.currentSrc||this.src;
  if(fb && current!==fb){this.src=fb;return;}
  if(!String(current||'').startsWith('data:image/svg') && HUNGRY_IMAGE){this.src=HUNGRY_IMAGE;}
};
winImg.dataset.restaurantPhotoKey = String(item?.id||item?.canonicalId||'');
if ($('celebration')) $('celebration').classList.toggle('hidden', hungry);
triggerWinnerMoment(hungry);
if(hungry){
  if(isRestaurantHungry){
    startHungryRestaurantMystery();
  }else{
    renderHungryWheel();

    $('hungryWheelPanel')?.classList.remove('has-landed');
    $('hungryWheelResult')?.classList.add('hidden');
    $('hungryWheelChoose')?.classList.add('hidden');
    const spinBtn=$('hungryWheelSpin');
    if(spinBtn){spinBtn.disabled=false;spinBtn.textContent='Spin the Wheel';spinBtn.setAttribute('aria-busy','false');}
  }
}else{
  if(!(chosenFromWheel && $('celebration') && !$('celebration').classList.contains('hidden')))triggerCelebration(chosenFromWheel);
  hydrateRestaurantPhoto(item,'#winner');
  bindRestaurantPhotoPinch(winImg);
}
save();
}

export { hideCelebration, triggerCelebration, triggerWinnerMoment, wheelPoint, sampleHungryWheel, renderHungryWheel, hungryWheelPool, showHungryWheelResult, hungryRestaurantPool, hungryRestaurantPick, renderHungryRestaurantMystery, startHungryRestaurantMystery, revealHungryRestaurant, tryAnotherHungryRestaurant, finishHungryWheelRotation, startContinuousWheelSpin, slowAndStopHungryWheel, spinHungryWheel, winner };
