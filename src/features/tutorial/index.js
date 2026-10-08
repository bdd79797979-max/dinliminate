import { state as S } from '../../state/store.js';
import { $ } from '../../ui/dom.js';
const navigation={};
export function configureTutorial(next={}){Object.assign(navigation,next);}

const tutorialState=S.tutorialState;
 navigation.closeDrawer?.(true);
 window.requestAnimationFrame(begin);
}
function tutorialStepsForScreen(screen){
 if(screen==='home')return[
  {target:'#tutorialModeToggle',title:'TUTORIAL',body:'Tap this bubble to move to the next step.',avoid:['#home .home-foot']},
  {target:'#home-slogan',title:'DINLIMINATE',body:'Swipe meals or restaurants to narrow down your choices until you have a decision.',avoid:['#home .home-foot','#foodStart','#restStart','#menu']},
  {targets:['#foodStart .home-choice-content','#restStart .home-choice-content'],title:'GET STARTED',body:'Tap At Home or Restaurant to get started.',action:'home-choice',avoid:['#home .home-foot','#menu']}
 ];
 if(screen==='food')return[
  {target:'#foodMaybe',title:'MAYBE',body:'Keep this meal in consideration.'},
  {target:'#foodCut',title:'CUT',body:'Remove this meal.'},
  {target:'#foodBack',title:'Back',body:'Return to the previous meal.'},
  {target:'#foodChoose',title:'CHOOSE',body:'Make your decision early.',action:'choose'},
  {target:'#foodDetails',title:'DETAILS',body:'See more about this meal.'},
  {target:'#foodMealTimeToggle',title:'MEAL TIMES',body:'Narrow down by meal time.',avoid:['#foodQuickToggle','#mealTimeQuick','#foodQuick']},
  {target:'#foodQuickToggle',title:'CUISINE',body:'Narrow down by cuisine type.',avoid:['#foodMealTimeToggle','#mealTimeQuick','#foodQuick']},
  {target:'#foodMaybeDeck',title:'ALL / MAYBES / COUNT',body:'Switch between all remaining meals and Maybes. See how many choices remain.'},
  {target:'#foodMenu',title:'MENU',body:'This opens the app menu.',avoid:['#drawer']},
  tutorialState.firstDecisionScreen==='restaurant'
   ? {target:'#foodMenu',title:'FINISH TOUR',body:'You started with Restaurant. You are done — return to Home to finish the Tour.',action:'finish-tour'}
   : {target:'#foodMenu',title:'ENTER RESTAURANT',body:'Continue the Tour through the Restaurant side of Dinliminate.',action:'enter-restaurant'}
 ];
 if(screen==='restaurant')return[
  {target:'#locate',title:'CURRENT LOCATION',body:'Use your current location.'},
  {target:'#address',title:'ADDRESS SEARCH',body:'Search from an address.'},
  {target:'#find',title:'REFRESH',body:'Refresh your restaurant results.'},
  {target:'#radius',title:'RADIUS',body:'Choose how far to search.'},
  {target:'#restaurantHomeBack',title:'BACK TO HOME',body:'Return to the homepage.'},
  {target:'#restMaybe',title:'MAYBE',body:'Keep this restaurant in consideration.'},
  {target:'#restCut',title:'CUT',body:'Remove this restaurant.'},
  {target:'#restBack',title:'Back',body:'Return to the previous restaurant.'},
  {target:'#restChoose',title:'CHOOSE',body:'Make your decision early.',action:'choose'},
  {target:'#restaurantSearchToggle',title:'RESTAURANT SEARCH',body:'Search for a specific restaurant.',avoid:['#restaurantSearchBox']},
  {target:'#restaurantQuickToggle',title:'CUISINE',body:'Narrow down by cuisine type.',avoid:['#restQuick','#restaurantSearchToggle','#restaurantHoursToggle']},
  {target:'#restaurantHoursToggle',title:'OPEN',body:'Show only restaurants that are open now. Tap again to show all.',avoid:['#restaurantHoursQuick','#restQuick','#restaurantSearchToggle']},
  {target:'#restaurantMaybeDeck',title:'ALL / MAYBES / COUNT',body:'Switch between all remaining restaurants and Maybes. See how many choices remain.'},
  {target:'#restaurantMenu',title:'MENU',body:'This opens the app menu.',avoid:['#drawer']},
  tutorialState.firstDecisionScreen==='food'
   ? {target:'#restaurantMenu',title:'FINISH TOUR',body:'You started with Meals. You are done — return to Home to finish the Tour.',action:'finish-tour'}
   : {target:'#restaurantMenu',title:'ENTER MEALS',body:'Continue the Tour through the Meals side of Dinliminate.',action:'enter-food'}
 ];
 if(screen==='winner')return[
  {target:'#restart',title:'START OVER',body:'Tap Start Over to return to this decision path and continue the Tour.',action:'winner-restart'}
 ];
 return[];
}
function tutorialUnionRect(selectors){
 const rects=(selectors||[]).map(sel=>{try{return document.querySelector(sel)?.getBoundingClientRect()||null}catch{return null}})
  .filter(r=>r&&r.width&&r.height);
 if(!rects.length)return null;
 return{
  left:Math.min(...rects.map(r=>r.left)),
  top:Math.min(...rects.map(r=>r.top)),
  right:Math.max(...rects.map(r=>r.right)),
  bottom:Math.max(...rects.map(r=>r.bottom)),
  width:Math.max(...rects.map(r=>r.right))-Math.min(...rects.map(r=>r.left)),
  height:Math.max(...rects.map(r=>r.bottom))-Math.min(...rects.map(r=>r.top))
 };
}
function tutorialTargetRect(step){
 if(Array.isArray(step?.targets)){
  return tutorialUnionRect(step.targets);
 }
 const target=step?.target?document.querySelector(step.target):null;
 if(!target)return null;
 const main=target.getBoundingClientRect();
 if(!main.width||!main.height)return null;
 return main;
}
function tutorialBlockerRects(step){
 const target=tutorialTargetRect(step);
 const tx=target?(target.left+target.right)/2:null;
 const ty=target?(target.top+target.bottom)/2:null;
 return (step?.avoid||[]).map(sel=>{
  try{
   const el=document.querySelector(sel),r=el?.getBoundingClientRect();
   if(!r||!r.width||!r.height)return null;
   // A parent/container that contains the highlighted target should not
   // become a placement blocker; it would force the bubble away from the
   // very control it is explaining.
   if(Number.isFinite(tx)&&Number.isFinite(ty)&&tx>=r.left&&tx<=r.right&&ty>=r.top&&ty<=r.bottom)return null;
   return r;
  }catch{return null}
 }).filter(Boolean);
}
function tutorialPosition(expectedToken=tutorialState.token,retry=0){
 if(expectedToken!==tutorialState.token||!tutorialState.active||tutorialState.screen!==S.screen)return;
 const step=tutorialState.steps[tutorialState.index];
 const bubble=document.querySelector('#tutorialBubble'),spot=document.querySelector('#tutorialSpotlight');
 const rect=tutorialTargetRect(step);
 if(!bubble||!rect){
  if(retry<24){
   window.requestAnimationFrame(()=>tutorialPosition(expectedToken,retry+1));
  }else{
   tutorialToast('Tour could not find the highlighted control.');
   stopTutorialMode();
  }
  return;
 }
 spot.style.left=(rect.left-6)+'px';
 spot.style.top=(rect.top-6)+'px';
 spot.style.width=(rect.width+12)+'px';
 spot.style.height=(rect.height+12)+'px';
 bubble.classList.remove('is-visible');
 bubble.style.visibility='hidden';
 bubble.dataset.side='';
 bubble.style.left='0px';
 bubble.style.top='0px';
 requestAnimationFrame(()=>{
  if(expectedToken!==tutorialState.token||!tutorialState.active||tutorialState.screen!==S.screen)return;
  const vv=window.visualViewport;
  const vw=Math.max(1,Math.round(vv?.width||window.innerWidth));
  const vh=Math.max(1,Math.round(vv?.height||window.innerHeight));
  const bw=bubble.offsetWidth||280;
  const bh=bubble.offsetHeight||96;
  const gap=14;
  const margin=12;
  const blockers=[rect,...tutorialBlockerRects(step)];
  const overlapScore=(x,y)=>{
   const b={left:x,top:y,right:x+bw,bottom:y+bh};
   return blockers.reduce((score,r)=>{
    const horizontal=Math.max(0,Math.min(b.right,r.right)-Math.max(b.left,r.left));
    const vertical=Math.max(0,Math.min(b.bottom,r.bottom)-Math.max(b.top,r.top));
    return score+(horizontal*vertical);
   },0);
  };
  const distanceToRect=(x,y)=>{
   const cx=x+bw/2,cy=y+bh/2;
   const tx=(rect.left+rect.right)/2,ty=(rect.top+rect.bottom)/2;
   return Math.hypot(cx-tx,cy-ty);
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(value,max));
  const insideViewport=(x,y)=>x>=margin&&y>=margin&&x+bw<=vw-margin&&y+bh<=vh-margin;
  const candidates=[
   {side:'top',x:rect.left+rect.width/2-bw/2,y:rect.top-bh-gap,priority:0},
   {side:'bottom',x:rect.left+rect.width/2-bw/2,y:rect.bottom+gap,priority:0},
   {side:'left',x:rect.left-bw-gap,y:rect.top+rect.height/2-bh/2,priority:1},
   {side:'right',x:rect.right+gap,y:rect.top+rect.height/2-bh/2,priority:1},
   {side:'top-left',x:rect.left-bw-gap,y:rect.top-bh-gap,priority:2},
   {side:'top-right',x:rect.right+gap,y:rect.top-bh-gap,priority:2},
   {side:'bottom-left',x:rect.left-bw-gap,y:rect.bottom+gap,priority:2},
   {side:'bottom-right',x:rect.right+gap,y:rect.bottom+gap,priority:2}
  ];
  const scored=candidates.map(candidate=>{
   const x=clamp(candidate.x,margin,vw-bw-margin);
   const y=clamp(candidate.y,margin,vh-bh-margin);
   const overflow=Math.abs(x-candidate.x)+Math.abs(y-candidate.y);
   const overlap=overlapScore(x,y);
   const valid=insideViewport(x,y)&&overlap===0;
   const score=(valid?0:100000000)+(overlap*1000)+(overflow*25)+(distanceToRect(x,y)*1)+(candidate.priority*2);
   return {...candidate,x,y,valid,score};
  });
  let picked=scored.filter(item=>item.valid).sort((a,b)=>a.score-b.score)[0];
  if(!picked)picked=scored.sort((a,b)=>a.score-b.score)[0]||scored[0];
  if(expectedToken!==tutorialState.token||!tutorialState.active||tutorialState.screen!==S.screen)return;
  bubble.dataset.side=picked.side;
  bubble.style.left=picked.x+'px';
  bubble.style.top=picked.y+'px';
  bubble.style.visibility='visible';
  requestAnimationFrame(()=>{
   if(expectedToken!==tutorialState.token||!tutorialState.active||tutorialState.screen!==S.screen)return;
   bubble.classList.add('is-visible');
  });
 });
}
function renderTutorialStep(){
 if(!tutorialModeEnabled()||!tutorialState.active){stopTutorialMode();return;}
 const step=tutorialState.steps[tutorialState.index];if(!step){stopTutorialMode();return;}
 const layer=document.querySelector('#tutorialLayer');if(!layer){ensureTutorialUI();return renderTutorialStep();}
 layer.classList.remove('hidden');layer.setAttribute('aria-hidden','false');
 const bubble=document.querySelector('#tutorialBubble');
 const title=document.querySelector('#tutorialBubbleTitle'),body=document.querySelector('#tutorialBubbleBody');
 if(title)title.textContent=step.title;if(body)body.textContent=step.body;
 if(!bubble){ensureTutorialUI();return renderTutorialStep();}
 bubble.classList.toggle('is-action-step',!!step.action);
 bubble.disabled=false;
 bubble.setAttribute('aria-disabled','false');
 bubble.dataset.action=step.action||'';
 tutorialState.awaitingAction=!!step.action;
 const expectedToken=tutorialState.token;
 requestAnimationFrame(()=>tutorialPosition(expectedToken));
}
function tutorialNavigateTo(screen,index=0){
 if(!tutorialModeEnabled()||!tutorialState.active)return;
 const normalized=['home','food','restaurant','winner'].includes(screen)?screen:'';
 if(!normalized)return;
 const steps=tutorialStepsForScreen(normalized);if(!steps.length){stopTutorialMode();return;}
 tutorialInvalidateTransition('tutorial-navigation');
 const expectedToken=tutorialState.token;
 tutorialState.screen=normalized;
 tutorialState.steps=steps;
 tutorialState.index=Math.max(0,Math.min(Number.isInteger(index)?index:0,steps.length-1));
 tutorialState.awaitingAction=!!steps[tutorialState.index]?.action;
 document.body.classList.add('tutorial-mode-on');
 ensureTutorialUI();
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(expectedToken!==tutorialState.token||!tutorialState.active||S.screen!==normalized)return;
  renderTutorialStep();
 }));
}
function startTutorialForScreen(screen,force=false,options={}){
 if(!force&&!tutorialModeEnabled())return;
 const normalized=['home','food','restaurant','winner'].includes(screen)?screen:'';
 if(!normalized){return;}
 const nextIndex=Number.isInteger(options.index)?Math.max(0,options.index):0;
 tutorialNavigateTo(normalized,nextIndex);
}
function tutorialEnterDecisionScreen(screen,index=0){
 if(!tutorialModeEnabled()||!tutorialState.active)return;
 tutorialState.pendingDecisionScreen='';
 startTutorialForScreen(screen,true,{index});
}
function tutorialMarkHomeChoice(screen){
 if(!tutorialModeEnabled()||!tutorialState.active)return;
 const step=tutorialState.steps[tutorialState.index];
 if(step?.action!=='home-choice')return;
 tutorialState.awaitingAction=false;
 tutorialState.pendingDecisionScreen=screen;
 if(!tutorialState.firstDecisionScreen)tutorialState.firstDecisionScreen=screen;
}
function tutorialMarkChoose(screen){
 if(!tutorialModeEnabled()||!tutorialState.active)return;
 const step=tutorialState.steps[tutorialState.index];
 if(step?.action!=='choose')return;
 tutorialState.awaitingAction=false;
 tutorialState.returnContext={screen,index:tutorialState.index};
}
function tutorialWinnerRestart(){
 if(!tutorialModeEnabled()||!tutorialState.active||!tutorialState.returnContext)return false;
 const context={...tutorialState.returnContext};
 tutorialState.returnContext=null;
 const resumeIndex=context.index+1;
 if(context.screen==='food')navigation.startFood({tutorialResumeIndex:resumeIndex});
 else if(context.screen==='restaurant')navigation.openRestaurant({tutorialResumeIndex:resumeIndex});
 else return false;
 return true;
}
function advanceTutorial(){
 const step=tutorialState.steps[tutorialState.index];
 if(step?.action==='choose'){
  const sourceScreen=tutorialState.screen;
  const item=sourceScreen==='food' ? S.pool?.[S.index] : restaurantPoolFiltered()?.[S.restaurantIndex];
  if(item){
   tutorialState.awaitingAction=false;
   tutorialState.returnContext={screen:sourceScreen,index:tutorialState.index};
   navigation.winner(item,sourceScreen==='restaurant'?'restaurant':'food',{tutorial:true});
  }
  return;
 }
 if(step?.action==='enter-restaurant'){
  tutorialState.awaitingAction=false;
  navigation.openRestaurant({tutorialResumeIndex:0});
  return;
 }
 if(step?.action==='enter-food'){
  tutorialState.awaitingAction=false;
  navigation.startFood({tutorialResumeIndex:0});
  return;
 }
 if(step?.action==='finish-tour'){
  tutorialState.awaitingAction=false;
  stopTutorialMode();
  home();
  tutorialToast('Tour complete');
  return;
 }
 if(step?.action==='winner-restart'){
  tutorialState.awaitingAction=true;
  return;
 }
 if(step?.action){return;}
 tutorialState.index++;
 if(tutorialState.index>=tutorialState.steps.length){stopTutorialMode();return;}
 renderTutorialStep();
}
let tutorialPointerContext=null;
let tutorialSuppressClick=null;

function tutorialTargetHit(event,selector){
 try{return !!event.target?.closest?.(selector);}catch{return false;}
}
function tutorialAdvanceFromTarget(event,step){
 if(step?.action==='home-choice'){
  const choice=event.target?.closest?.('#foodStart,#restStart');
  if(!choice)return false;
  const nextScreen=choice.id==='restStart'?'restaurant':'food';
  tutorialMarkHomeChoice(nextScreen);
  if(nextScreen==='restaurant')navigation.openRestaurant({tutorialResumeIndex:0});
  else navigation.startFood({tutorialResumeIndex:0});
  return true;
 }
 if(step?.action==='enter-restaurant'||step?.action==='enter-food'){
  advanceTutorial();
  return true;
 }
 if(step?.action==='winner-restart'){
  handleWinnerRestart();
  return true;
 }
 advanceTutorial();
 return true;
}
function tutorialCurrentTargetForEvent(event,step){
 if(!step?.target)return null;
 if(step.action==='home-choice')return event.target?.closest?.('#foodStart,#restStart')||null;
 return tutorialTargetHit(event,String(step.target)) ? event.target?.closest?.(String(step.target)) : null;
}
function tutorialBlockPointer(){ return false; }
function tutorialHandlePointerUp(){ return false; }
function tutorialHandlePointerCancel(){ return false; }
let tutorialDispatchingAction=false;
function tutorialHighlightedTargetClick(event){
 if(!tutorialModeEnabled()||!tutorialState.active)return;
 const step=tutorialState.steps[tutorialState.index];
 if(step?.action==='home-choice'){
  const target=event.target?.closest?.('#foodStart,#restStart');
  if(!target)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const nextScreen=target.id==='restStart'?'restaurant':'food';
  tutorialMarkHomeChoice(nextScreen);
  if(nextScreen==='restaurant')navigation.openRestaurant({tutorialResumeIndex:0});
  else navigation.startFood({tutorialResumeIndex:0});
  return;
 }
 if(step?.action==='choose'){
  const target=event.target?.closest?.('#foodChoose,#restChoose');
  if(!target)return;
  tutorialMarkChoose(target.id==='restChoose'?'restaurant':'food');
 }
}
function bindTutorialUI(){
 ensureTutorialUI();
 const bubble=document.querySelector('#tutorialBubble');
 if(bubble&&!bubble.dataset.bound){bubble.dataset.bound='1';bubble.addEventListener('click',advanceTutorial);}
 const toggle=document.querySelector('#tutorialModeToggle');
 if(toggle&&!toggle.dataset.bound){
  toggle.dataset.bound='1';
  toggle.addEventListener('click',event=>{
   event.preventDefault();
   event.stopPropagation();
   if(tutorialModeEnabled()&&tutorialState.active){
    stopTutorialMode();
    tutorialHideOverlay();
    navigation.closeDrawer?.(true);
   }else startTutorialFromHome();
  });
 }
 const toggleSettings=document.querySelector('#tutorialModeSettings');
 if(toggleSettings&&!toggleSettings.dataset.bound){
  toggleSettings.dataset.bound='1';
  toggleSettings.addEventListener('click',event=>{
   event.preventDefault();
   event.stopPropagation();
   startTutorialFromHome();
  });
 }
 document.addEventListener('click',event=>{
  if(!tutorialModeEnabled()||!tutorialState.active)return;
  const target=event.target?.closest?.('#foodStart,#restStart');
  const step=tutorialState.steps[tutorialState.index];
  if(target&&step?.action==='home-choice'){
   event.preventDefault();
   event.stopPropagation();
   const nextScreen=target.id==='restStart'?'restaurant':'food';
   tutorialMarkHomeChoice(nextScreen);
   if(nextScreen==='restaurant')navigation.openRestaurant({tutorialResumeIndex:0});
   else navigation.startFood({tutorialResumeIndex:0});
  }
 },true);
 document.addEventListener('click',event=>{
  if(!tutorialModeEnabled()||!tutorialState.active)return;
  const target=event.target?.closest?.('#foodChoose,#restChoose');
  if(target){
   tutorialMarkChoose(target.id==='restChoose'?'restaurant':'food');
  }
 },true);
 let tutorialPositionScheduled=false;
 const scheduleTutorialPosition=()=>{
  if(!tutorialState.active||tutorialPositionScheduled)return;
  tutorialPositionScheduled=true;
  window.requestAnimationFrame(()=>{
   tutorialPositionScheduled=false;
   if(tutorialState.active)tutorialPosition(tutorialState.token);
  });
 };
 window.addEventListener('resize',scheduleTutorialPosition,{passive:true});
 window.addEventListener('scroll',scheduleTutorialPosition,{passive:true,capture:true});
 document.addEventListener('scroll',scheduleTutorialPosition,{passive:true,capture:true});
 if(window.visualViewport){
  window.visualViewport.addEventListener('resize',scheduleTutorialPosition,{passive:true});
  window.visualViewport.addEventListener('scroll',scheduleTutorialPosition,{passive:true});
 }
}

export { configureTutorial, tutorialState, tutorialStepsForScreen, tutorialUnionRect, tutorialTargetRect, tutorialBlockerRects, tutorialPosition, renderTutorialStep, tutorialNavigateTo, startTutorialForScreen, tutorialEnterDecisionScreen, tutorialMarkHomeChoice, tutorialMarkChoose, tutorialWinnerRestart, advanceTutorial, tutorialTargetHit, tutorialAdvanceFromTarget, tutorialCurrentTargetForEvent, tutorialBlockPointer, tutorialHandlePointerUp, tutorialHandlePointerCancel, tutorialHighlightedTargetClick, bindTutorialUI };
