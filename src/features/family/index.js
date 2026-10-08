import { store } from '../../state/store.js';
const S = store.get();
import { $ } from '../../ui/dom.js';
import { show, home } from '../../main.js';
import { startFood } from '../swipe/index.js';
import { openRestaurant, restaurantPoolFiltered, drawRestaurants } from '../restaurants/index.js';
import { drawFood } from '../swipe/index.js';
import { winner } from '../winner/index.js';

const FAMILY_SESSION_KEY='dinliminate.family.v1';

function familySessionRead(){try{const d=JSON.parse(localStorage.getItem(FAMILY_SESSION_KEY)||'null');return d&&typeof d.token==='string'&&d.token?d:null;}catch{return null;}}
function familySessionWrite(value){try{localStorage.setItem(FAMILY_SESSION_KEY,JSON.stringify(value));}catch(error){console.error('Dinliminate error',error)}}
function familySessionClear(){try{localStorage.removeItem(FAMILY_SESSION_KEY);}catch(error){console.error('Dinliminate error',error)}}
function familySetStatus(id,message,kind=''){const el=$(id);if(!el)return;el.textContent=message||'';el.dataset.state=kind;}
async function familyApi(action,payload={}){const response=await fetch('./api/family',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action,...payload})});let data=null;try{data=await response.json();}catch(error){console.error('Dinliminate error',error)}if(!response.ok||!data?.ok){const e=new Error(data?.message||'Family Mode could not complete that request.');e.code=data?.code||'FAMILY_REQUEST_FAILED';e.status=response.status;throw e;}return data;}

function familyShowEntry(){$('familyEntry')?.classList.remove('hidden');$('familyCreateForm')?.classList.add('hidden');$('familyJoinForm')?.classList.add('hidden');$('familyLobby')?.classList.add('hidden');['familySetup','familySwipe','familyWinner'].forEach(id=>$(id)?.classList.add('hidden'));}
function familyShowCreate(){$('familyEntry')?.classList.add('hidden');$('familyCreateForm')?.classList.remove('hidden');$('familyJoinForm')?.classList.add('hidden');$('familyLobby')?.classList.add('hidden');setTimeout(()=>$('familyCreateName')?.focus(),40);}
function familyShowJoin(){$('familyEntry')?.classList.add('hidden');$('familyCreateForm')?.classList.add('hidden');$('familyJoinForm')?.classList.remove('hidden');$('familyLobby')?.classList.add('hidden');setTimeout(()=>$('familyJoinCode')?.focus(),40);}
function familyDisplayMemberList(members,me){const box=$('familyMemberList');if(!box)return;box.innerHTML='';(Array.isArray(members)?members:[]).forEach(m=>{const row=document.createElement('div');row.className='family-member-row'+(m.role==='host'?' is-host':'');row.innerHTML='<span class="family-member-avatar"></span><span class="family-member-copy"><b></b><small></small></span><span class="family-member-status"></span>';row.querySelector('.family-member-avatar').textContent=(String(m.name||'?').trim().slice(0,1)||'?').toUpperCase();row.querySelector('.family-member-copy b').textContent=String(m.name||'Family member');row.querySelector('.family-member-copy small').textContent=m.role==='host'?'Host':'Member';row.querySelector('.family-member-status').textContent=me&&m.id===me.id?'You':(m.active===false?'Away':'Here');box.appendChild(row);});}

function familyEnsureNormalBar(type){
 const root=$(type==='meal'?'food':'restaurant');if(!root)return null;const id=type==='meal'?'foodFamilyNormalBar':'restaurantFamilyNormalBar';let bar=$(id);if(bar)return bar;
 bar=document.createElement('div');bar.id=id;bar.className='family-normal-bar';bar.style.cssText='margin:3px 8px 8px;padding:10px 11px;border:1px solid rgba(198,164,106,.24);border-radius:16px;background:linear-gradient(145deg,rgba(198,164,106,.09),rgba(255,255,255,.025));display:flex;align-items:center;justify-content:space-between;gap:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 12px 28px rgba(0,0,0,.14);';
 const ids=type==='meal'?{k:'foodFamilyNormalKicker',t:'foodFamilyNormalTitle',s:'foodFamilyNormalStatus',time:'foodFamilyNormalTime',btn:'foodFamilyNormalStart',end:'foodFamilyNormalEnd'}:{k:'restaurantFamilyNormalKicker',t:'restaurantFamilyNormalTitle',s:'restaurantFamilyNormalStatus',time:'restaurantFamilyNormalTime',btn:'restaurantFamilyNormalStart',end:'restaurantFamilyNormalEnd'};
 bar.innerHTML='<div style="display:grid;gap:2px;min-width:0"><span id="'+ids.k+'" style="font-size:8px;letter-spacing:.15em;color:#c6a46a;font-weight:850">DINNER TOGETHER</span><b id="'+ids.t+'" style="font-size:13px;line-height:1.1">Prepare dinner together.</b><small id="'+ids.s+'" style="font-size:9px;line-height:1.35;color:#777;max-width:330px">Use the normal '+(type==='meal'?'Meal':'Restaurant')+' screen, then start the shared dinner.</small></div><div style="display:flex;align-items:center;justify-content:flex-end;gap:7px;flex:0 0 auto"><label id="'+ids.time+'Wrap" style="display:grid;gap:3px;color:#8a847c;font-size:7px;letter-spacing:.12em;font-weight:850">DINNER BY<input id="'+ids.time+'" type="time" aria-label="Dinner by time" style="height:34px;min-width:92px;border:1px solid #3a342b;border-radius:10px;background:#151413;color:#eee;padding:0 7px;font-size:10px;font-weight:800"></label><button id="'+ids.btn+'" type="button" style="min-height:36px;padding:0 11px;border:1px solid #9b8050;border-radius:11px;background:#c6a46a;color:#111;font-size:9px;font-weight:900;white-space:nowrap">Start Family Dinner</button><button id="'+ids.end+'" type="button" class="family-end-button hidden" aria-label="End Family Dinner">END DINNER</button></div>';
 const anchor=type==='meal'?root.querySelector('.quick-section'):root.querySelector('.location-strip');root.insertBefore(bar,anchor||root.firstChild);const startButton=$(ids.btn),endButton=$(ids.end);
 if(startButton&&startButton.dataset.familyBound!=='1'){startButton.dataset.familyBound='1';startButton.addEventListener('click',()=>familyStartRoundFromNormal(type));}
 if(endButton&&endButton.dataset.familyBound!=='1'){endButton.dataset.familyBound='1';endButton.addEventListener('click',familyEndDinner);}
 return bar;
}
function familyNormalBar(type,mode='idle',data=null){
 const ids=type==='meal'?{k:'foodFamilyNormalKicker',t:'foodFamilyNormalTitle',s:'foodFamilyNormalStatus',time:'foodFamilyNormalTime',btn:'foodFamilyNormalStart',end:'foodFamilyNormalEnd'}:{k:'restaurantFamilyNormalKicker',t:'restaurantFamilyNormalTitle',s:'restaurantFamilyNormalStatus',time:'restaurantFamilyNormalTime',btn:'restaurantFamilyNormalStart',end:'restaurantFamilyNormalEnd'};
 const bar=familyEnsureNormalBar(type);if(!bar)return;const el=id=>$(id),start=el(ids.btn),end=el(ids.end),wrap=$(ids.time+'Wrap'),host=familySessionRead()?.member?.role==='host';bar.classList.toggle('hidden',mode==='idle');
 if(mode==='setup'){el(ids.k).textContent='DINNER TOGETHER · HOST SETUP';el(ids.t).textContent=type==='meal'?'Prepare the meal choices.':'Prepare the restaurant choices.';el(ids.s).textContent='Use the normal '+(type==='meal'?'Meal':'Restaurant')+' screen. When everyone is ready, start the shared dinner.';wrap?.classList.remove('hidden');start?.classList.toggle('hidden',!host);end?.classList.add('hidden');if(start)start.disabled=!host||((type==='meal'?S.pool.length:restaurantPoolFiltered().length)===0);return;}
 if(mode==='decision'&&data?.activeRound){const stage=Number(data.activeRound.currentStage)||1,copy=familyRoundCopy(stage),members=Array.isArray(data.roundMembers)?data.roundMembers.filter(x=>x.included):[],mine=familySessionRead()?.member?.id,meRow=members.find(x=>x.memberId===mine),key=stage===1?'submittedStage1':stage===2?'submittedStage2':'submittedTiebreak',submitted=members.filter(x=>!!x[key]).length,mineSubmitted=stage===1?!!meRow?.submittedStage1:stage===2?!!meRow?.submittedStage2:!!meRow?.submittedTiebreak;el(ids.k).textContent='DINNER TOGETHER · '+copy.title;el(ids.t).textContent=copy.instruction;el(ids.s).textContent=mineSubmitted?'✓ ENTERED · Waiting for the Family…':submitted+' of '+members.length+' entered'+(stage===1?' · Enter anytime':'');wrap?.classList.add('hidden');start?.classList.add('hidden');end?.classList.toggle('hidden',!host);familySetDecisionAction(type,stage,mineSubmitted);return;}
 if(mode==='winner'){el(ids.k).textContent='DINNER TOGETHER · DECIDED';el(ids.t).textContent='Dinner is decided.';el(ids.s).textContent='Everyone agreed on tonight’s dinner.';wrap?.classList.add('hidden');start?.classList.add('hidden');end?.classList.add('hidden');}
}
function familyDefaultDinnerTime(){const d=new Date(Date.now()+30*60*1000);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function familyDinnerTargetIso(value){const p=String(value||'').split(':').map(Number);if(p.length!==2||!Number.isFinite(p[0])||!Number.isFinite(p[1]))return null;const d=new Date();d.setHours(p[0],p[1],0,0);if(d.getTime()<=Date.now()+120000)d.setDate(d.getDate()+1);return d.toISOString();}

function familyChooseNormalType(type){
 const s=familySessionRead();if(!s?.member||s.member.role!=='host')return;if(s.family?.activeRoundId)return;
 const compare=type==='both',actual=compare?'meal':type;
 if(compare){S.familyCompareBothMode='meal';S.familyCompareBothGroupId=globalThis.crypto?.randomUUID?.()||('family-both-'+Date.now());S.familyCompareBothMealWinner=null;}
 S.familyNormalMode='setup';S.familyDecisionType=actual;S.familyNormalRoundId='';S.familyNormalStage=0;S.familyNormalAutoResume=true;S.familyVotedIds=new Set();S.familyBrowseHistory=[];familyEnsureNormalBar(actual);
 if(actual==='meal')startFood();else openRestaurant();familyNormalBar(actual,'setup',S.familyActiveData);
 const t=$(actual==='meal'?'foodFamilyNormalTime':'restaurantFamilyNormalTime');if(t&&!t.value)t.value=familyDefaultDinnerTime();
}
function familyBuildNormalSnapshot(type){
 const raw=type==='meal'?S.pool.slice():restaurantPoolFiltered().slice();
 return{pool:raw.map(x=>({id:String(x.id||''),name:String(x.name||''),category:String(x.category||x.cuisine||''),cuisine:String(x.cuisine||''),image:String(x.image||x.photo||''),address:String(x.address||''),website:String(x.website||''),phone:String(x.phone||''),distance:Number.isFinite(Number(x.distance))?Number(x.distance):null})).filter(x=>x.id&&x.name),hostExcluded:[],location:S.location?{lat:Number(S.location.lat),lon:Number(S.location.lon)}:null,radius:Number($('radius')?.value||10),searchTerm:String(S.restaurantQuery||''),openState:String(S.restaurantHours||'all'),quickCuts:type==='restaurant'?[...S.restaurantCuts]:[],mealTimes:type==='meal'?[...S.mealTimeFilters]:[],compareBoth:S.familyCompareBothMode?{mode:'compare_both',track:S.familyCompareBothMode,groupId:S.familyCompareBothGroupId,mealWinner:S.familyCompareBothMealWinner||null}:null};
}
async function familyStartRoundFromNormal(type){
 const s=familySessionRead();if(!s?.token||s.member?.role!=='host')return;const status=type==='meal'?'foodFamilyNormalStatus':'restaurantFamilyNormalStatus',btn=type==='meal'?'foodFamilyNormalStart':'restaurantFamilyNormalStart',time=type==='meal'?'foodFamilyNormalTime':'restaurantFamilyNormalTime';
 const existing=S.familyActiveData?.activeRound||null;if(s.family?.activeRoundId){if(existing&&['swiping','final_swiping','tiebreak'].includes(existing.status)){familyBeginNormalDecision(S.familyActiveData);return;}if(existing&&existing.status==='complete'){existing.snapshot?.outcome==='no_winner'?familyShowNoWinner(existing):familyShowWinner(existing);return;}}
 const snapshot=familyBuildNormalSnapshot(type);if(!snapshot.pool.length){familySetStatus(status,type==='meal'?'There are no Meal choices left after your filters.':'Load at least one restaurant before starting the Family dinner.','error');return;}const target=familyDinnerTargetIso($(time)?.value);if(!target){familySetStatus(status,'Choose a dinner time.','error');return;}
 const b=$(btn);if(b){b.disabled=true;b.textContent='Starting…';}
 try{familySetStatus(status,'Locking your normal '+(type==='meal'?'Meal':'Restaurant')+' choices for everyone…','busy');let roundId=String(s.family?.activeRoundId||'');if(!roundId){const created=await familyApi('create-round',{token:s.token,decisionType:type,snapshot,dinnerTargetAt:target});roundId=String(created.id);familySessionWrite({...s,family:{...(s.family||{}),activeRoundId:roundId}});}await familyApi('start-round',{token:s.token});S.familyNormalMode='decision';S.familyNormalRoundId=roundId;S.familyNormalAutoResume=true;S.familyNormalStage=1;await familyRefreshState();}
 catch(err){if(err.code==='ROUND_ALREADY_STARTED'){const fresh=await familyRefreshState();if(fresh?.activeRound){familyBeginNormalDecision(fresh);return;}}familySetStatus(status,err.message||'Could not start the Family dinner.','error');}
 finally{if(b){b.disabled=false;b.textContent='Start Family Dinner';}}
}
function familyBeginNormalDecision(data){
 const round=data?.activeRound;if(!round)return;const type=round.decisionType==='restaurant'?'restaurant':'meal',stage=Number(round.currentStage)||1,stageData=familyNormalStagePool(round,data),same=S.familyNormalMode==='decision'&&S.familyNormalRoundId===String(round.id)&&S.familyDecisionType===type&&S.familyNormalStage===stage&&S.screen===(type==='meal'?'food':'restaurant');
 S.familyActiveData=data;S.familyDecisionType=type;S.familyNormalMode='decision';S.familyNormalRoundId=String(round.id);S.familyNormalStage=stage;S.familyNormalAutoResume=true;if(same){familyNormalBar(type,'decision',data);return;}
 S.winnerItem=null;S.winnerType=type==='restaurant'?'restaurant':'food';
 if(type==='meal'){S.foodActions=[];S.foodHistory=[];S.maybe.clear();S.foodMaybeRound=false;S.foodCuts.clear();S.cutCats.clear();S.maybeDeck=false;S.pool=stageData.remaining.map(x=>({...x}));S.index=0;show('food');foodQuick();drawFood();familyNormalBar('meal','decision',data);}else{S.restaurantActions=[];S.restaurantHistory=[];S.restaurantMaybeRound=false;S.restaurantCuts.clear();S.maybeDeck=false;S.restaurantQuery='';S.restaurantHours='all';S.restaurantHoursCollapsed=true;S.restaurantSearchKey='';S.restaurantSearchDegraded=false;S.restaurantPool=stageData.remaining.map(x=>({...x,_cut:false,_maybe:false}));S.restaurantIndex=0;show('restaurant');restaurantQuick();drawRestaurants();familyNormalBar('restaurant','decision',data);}
 familyStageAlert(type,stage);familySwipeInstruction(type,stage);
}
function familyNormalStagePool(round,data){
 const snapshot=round?.snapshot||{},all=Array.isArray(snapshot.pool)?snapshot.pool:[],stage=Number(round.currentStage)||1;let source=all;
 if(stage===2&&Array.isArray(snapshot.finalists)){const ids=new Set(snapshot.finalists.map(String));source=all.filter(x=>ids.has(String(x.id)));}
 if(stage===3&&Array.isArray(snapshot.tiebreakItems)){const ids=new Set(snapshot.tiebreakItems.map(String));source=all.filter(x=>ids.has(String(x.id)));}
 const voteStage=stage===1?'initial':stage===2?'finalist':'tiebreak',voted=new Set((data?.myVotes||[]).filter(v=>v.stage===voteStage).map(v=>String(v.itemId)));
 return{source,voted,voteStage,remaining:source.filter(x=>x&&!voted.has(String(x.id)))};
}
function familyIsBrowseStage(type){return S.familyNormalMode==='decision'&&S.familyDecisionType===type&&familyRoundStage()>1;}
function familyBrowseSource(type){return familyNormalStagePool(S.familyActiveData?.activeRound||null,S.familyActiveData||{}).source.filter(Boolean);}
function familyBrowseSubmitted(){const stage=familyRoundStage(),rows=Array.isArray(S.familyActiveData?.roundMembers)?S.familyActiveData.roundMembers:[],me=familySessionRead()?.member?.id,row=rows.find(x=>x.memberId===me);return stage===2?!!row?.submittedStage2:!!row?.submittedTiebreak;}
function familyBrowseRender(type,index){const source=familyBrowseSource(type);if(!source.length)return;const next=((Number(index)%source.length)+source.length)%source.length;if(type==='meal'){S.pool=source.map(x=>({...x}));S.index=next;drawFood();}else{S.restaurantPool=source.map(x=>({...x,_cut:false,_maybe:false}));S.restaurantIndex=next;drawRestaurants();}}
function familyBrowseNext(type){if(!familyIsBrowseStage(type)||familyBrowseSubmitted())return;const source=familyBrowseSource(type);if(!source.length)return;const current=type==='meal'?S.index:S.restaurantIndex;S.familyBrowseHistory.push({type,index:current});familyBrowseRender(type,current+1);}
function familyBrowsePrevious(type){if(!familyIsBrowseStage(type)||familyBrowseSubmitted())return;const source=familyBrowseSource(type);if(!source.length)return;const current=type==='meal'?S.index:S.restaurantIndex;S.familyBrowseHistory.push({type,index:current});familyBrowseRender(type,current-1);}
function familyBrowseBack(type){if(!familyIsBrowseStage(type)||familyBrowseSubmitted())return;for(let i=S.familyBrowseHistory.length-1;i>=0;i--){const e=S.familyBrowseHistory[i];if(e?.type!==type)continue;S.familyBrowseHistory.splice(i,1);familyBrowseRender(type,e.index);return;}const source=familyBrowseSource(type);if(!source.length)return;const current=type==='meal'?S.index:S.restaurantIndex;familyBrowseRender(type,current-1);}
function familyRoundStage(){return Number(S.familyActiveData?.activeRound?.currentStage)||1;}
function familyRoundCopy(stage){
 if(stage===1)return{title:'PICK MAYBES',instruction:"Don't be picky. Add anything you'd be happy eating.",action:'ENTER MAYBES',aria:'Enter Maybes'};
 if(stage===2)return{title:'PICK A FINALIST',instruction:'Swipe normally to browse. Pick the one you want most.',action:'ENTER CHOICE',aria:'Enter Choice'};
 return{title:'TIEBREAKER',instruction:'Swipe normally to browse. Pick one of the tied choices.',action:'ENTER CHOICE',aria:'Enter Choice'};
}
function familySetDecisionAction(type,stage,submitted){
 const btn=$(type==='meal'?'foodChoose':'restChoose'),copy=familyRoundCopy(stage);if(!btn)return;
 const label=submitted?'ENTERED':(stage===1?'ENTER MAYBES':'ENTER');
 btn.setAttribute('aria-label',label);btn.title=label;btn.dataset.familyAction=copy.action;btn.dataset.familyActionLabel=label;btn.disabled=!!submitted||S.familyNormalVoteBusy;
}function familyStageAlert(type,stage){
 // CP1082: Family Mode stays inside the normal decision screen. The persistent
 // Family bar and round instruction provide the stage cue without blocking it.
 document.getElementById('familyStageAlert')?.remove();
}
function familySwipeInstruction(type,stage){
 const root=$(type==='meal'?'food':'restaurant');if(!root)return;root.querySelector('.family-swipe-tip')?.remove();const tip=document.createElement('div');tip.className='family-swipe-tip';tip.innerHTML=stage===1?'<b>Round 1</b><span>Swipe or tap ♥ to build your Maybes. ✓ enters them.</span><button type="button" aria-label="Dismiss">×</button>':'<b>'+(stage===2?'Round 2':'Tiebreak')+'</b><span>Swipe left or right to browse. ✓ enters your choice.</span><button type="button" aria-label="Dismiss">×</button>';root.appendChild(tip);tip.querySelector('button').onclick=()=>tip.remove();window.setTimeout(()=>tip.remove(),6500);
}
async function familyEnterMaybes(type){
 if(S.familyNormalMode!=='decision'||familyRoundStage()!==1||S.familyNormalVoteBusy)return;
 const s=familySessionRead(),round=S.familyActiveData?.activeRound;if(!s?.token||!round)return;S.familyNormalVoteBusy=true;
 const status=type==='meal'?'foodFamilyNormalStatus':'restaurantFamilyNormalStatus';
 try{const ids=type==='restaurant' ? restaurantPoolFiltered().filter(x=>x?._maybe).map(x=>String(x.id||'')).filter(Boolean) : [...(S.maybe||new Set())].map(String).filter(Boolean);familySetStatus(status,'Entering '+ids.length+' Maybes for the Family…','busy');
  const d=await familyApi('enter-maybes',{token:s.token,roundId:round.id,itemIds:ids});
  if(d?.round?.status==='complete'){const r=d.round;familySessionWrite({...s,family:{...(s.family||{}),activeRoundId:null}});S.familyActiveData={...(S.familyActiveData||{}),activeRound:null,lastCompletedRound:r};r.snapshot?.outcome==='no_winner'?familyShowNoWinner(r):familyShowWinner(r);return;}
  if(d?.round?.currentStage&&Number(d.round.currentStage)!==1){familyBeginNormalDecision({...S.familyActiveData,activeRound:d.round});return;}
  await familyRefreshState();
 }catch(err){familySetStatus(status,err.message||'Could not enter your Maybes.','error');}finally{S.familyNormalVoteBusy=false;}
}
async function familyPickSingle(type){
 const stage=familyRoundStage();if(S.familyNormalMode!=='decision'||stage===1||S.familyNormalVoteBusy)return;
 const s=familySessionRead(),round=S.familyActiveData?.activeRound;if(!s?.token||!round)return;const item=type==='meal'?S.pool?.[S.index]:restaurantPoolFiltered()?.[S.restaurantIndex];if(!item)return;
 S.familyNormalVoteBusy=true;const status=type==='meal'?'foodFamilyNormalStatus':'restaurantFamilyNormalStatus',voteStage=stage===2?'finalist':'tiebreak';
 try{familySetStatus(status,stage===2?'Entering your finalist…':'Entering your tiebreak pick…','busy');const d=await familyApi('enter-choice',{token:s.token,roundId:round.id,stage:voteStage,itemId:String(item.id)});S.familyBrowseHistory=[];
  if(d?.round?.status==='complete'){const r=d.round;familySessionWrite({...s,family:{...(s.family||{}),activeRoundId:null}});S.familyActiveData={...(S.familyActiveData||{}),activeRound:null,lastCompletedRound:r};r.snapshot?.outcome==='no_winner'?familyShowNoWinner(r):familyShowWinner(r);return;}
  if(d?.round?.currentStage&&Number(d.round.currentStage)!==stage){familyBeginNormalDecision({...S.familyActiveData,activeRound:d.round});return;}
  await familyRefreshState();
 }catch(err){familySetStatus(status,err.message||'Could not save your pick.','error');}finally{S.familyNormalVoteBusy=false;}
}
function familySetWinnerMeta(round){
 const el=$('familyWinnerMeta')||(()=>{const p=document.createElement('p');p.id='familyWinnerMeta';p.className='family-winner-meta';$('winName')?.insertAdjacentElement('afterend',p);return p;})();if(!el)return;el.textContent=round?.snapshot?.outcome==='wheel'?'Decided together · won on the Family Wheel.':'Decided together · everyone already said yes to this choice.';el.classList.remove('hidden');
}
function familyHideWinnerMeta(){const el=$('familyWinnerMeta');if(el)el.classList.add('hidden');}
function familyShowNoWinner(round){
 const s=familySessionRead();if(s)familySessionWrite({...s,dismissedWinnerRoundId:String(round?.id||'')});S.familyActiveData={...(S.familyActiveData||{}),activeRound:null,lastCompletedRound:round};S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyNormalRoundId='';S.familyNormalStage=0;show('family');$('familyNoWinnerOverlay')?.remove();
 const overlay=document.createElement('div');overlay.id='familyNoWinnerOverlay';overlay.className='family-no-winner-overlay';const host=s?.member?.role==='host';
 overlay.innerHTML='<div class="family-no-winner-card"><span>DINNER TOGETHER</span><h3>NO DINNER WAS CHOSEN</h3><p>No finalist was entered by everyone. Start again or exit Dinner Together.</p><div class="family-no-winner-actions"><button type="button" class="family-restart-button" '+(host?'':'disabled')+'>RESTART</button><button type="button" class="family-exit-button">EXIT</button></div></div>';document.body.appendChild(overlay);overlay.querySelector('.family-restart-button')?.addEventListener('click',familyRestartFromNoWinner);overlay.querySelector('.family-exit-button')?.addEventListener('click',familyBackFromMode);
}
function familyResetCompareState(){S.familyCompareBothMode='';S.familyCompareBothGroupId='';S.familyCompareBothMealWinner=null;S.familyBrowseHistory=[];}
function familyRestartFromNoWinner(){const o=$('familyNoWinnerOverlay');o?.remove();const s=familySessionRead(),last=S.familyActiveData?.lastCompletedRound,cmp=last?.snapshot?.compareBoth;S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyNormalRoundId='';S.familyNormalStage=0;show('family');if(s?.member?.role==='host')window.setTimeout(()=>cmp?.mode==='compare_both'?familyChooseNormalType('both'):familyChooseNormalType(S.familyDecisionType||'meal'),80);else familySetStatus('familyLobbyStatus','Waiting for the host to restart the dinner.');}
function familyRestartAfterWinner(){const r=S.familyActiveData?.lastCompletedRound||S.familyActiveData?.activeRound,cmp=r?.snapshot?.compareBoth,s=familySessionRead();if(!s?.member||s.member.role!=='host'){familyDismissWinner();return;}familySessionWrite({...s,dismissedWinnerRoundId:null});S.familyNormalMode='idle';S.familyNormalAutoResume=true;S.familyNormalRoundId='';S.familyNormalStage=0;familyChooseNormalType(cmp?.mode==='compare_both'?'both':(S.familyDecisionType||'meal'));}
function familyContinueCompareRestaurant(round){const s=familySessionRead();if(s?.member?.role!=='host')return;S.familyCompareBothMode='restaurant';S.familyCompareBothGroupId=String(round?.snapshot?.compareBoth?.groupId||S.familyCompareBothGroupId);S.familyCompareBothMealWinner=round?.winnerItem||null;familyDismissWinner();window.setTimeout(()=>familyChooseNormalType('restaurant'),80);}
async function familyCreateCompareFinal(round){const s=familySessionRead(),cmp=round?.snapshot?.compareBoth;if(!s?.token||s.member?.role!=='host'||!cmp?.mealWinner||!round?.winnerItem)return;try{familySetStatus('familyLobbyStatus','Preparing the final dinner-type choice…','busy');const created=await familyApi('create-compare-final',{token:s.token,groupId:String(cmp.groupId||''),mealWinner:cmp.mealWinner,restaurantWinner:round.winnerItem});S.familyCompareBothMode='final';S.familyActiveData={...(S.familyActiveData||{}),activeRound:created,myVotes:[],roundMembers:[]};S.familyNormalMode='decision';S.familyDecisionType='meal';S.familyNormalRoundId=String(created.id);S.familyNormalStage=2;S.familyBrowseHistory=[];familyBeginNormalDecision({...S.familyActiveData,activeRound:created});}catch(err){familySetStatus('familyLobbyStatus',err.message||'Could not prepare the final dinner choice.','error');}}
function familyNormalBack(type){
 const active=S.familyNormalMode==='setup'||S.familyNormalMode==='decision'||S.familyNormalMode==='winner';
 if(active){S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyNormalRoundId='';S.familyNormalStage=0;S.familyBrowseHistory=[];show('family');familyRefreshState();return;}
 show('family');familyRefreshState();
}
function familyDecisionBack(type){familyNormalBack(type);}
function familyShowWinner(round){
 const item=round?.winnerItem,id=String(round?.id||'');if(!item)return;if(S.familyNormalMode==='winner'&&S.familyNormalRoundId===id&&S.screen==='winner')return;
 const cmp=round?.snapshot?.compareBoth||null;S.familyActiveData={...(S.familyActiveData||{}),activeRound:round,lastCompletedRound:round};S.familyNormalMode='winner';S.familyNormalRoundId=id;S.familyDecisionType=round.decisionType==='restaurant'?'restaurant':'meal';S.familyNormalAutoResume=true;winner(item,S.familyDecisionType,{familyRoundId:id,familyMode:true});
 const b=$('restart'),host=familySessionRead()?.member?.role==='host';if(b){b.disabled=false;if(cmp?.mode==='compare_both'&&cmp.track==='meal')b.textContent=host?'CONTINUE TO RESTAURANT':'WAITING FOR HOST';else if(cmp?.mode==='compare_both'&&cmp.track==='restaurant')b.textContent=host?'COMPARE THE TWO':'WAITING FOR HOST';else b.textContent=host?'START OVER':'BACK TO FAMILY';}
 familySetWinnerMeta(round);if(round?.snapshot?.outcome==='wheel')familyAnimateWheel(round);
}
function handleWinnerRestart(){
  if(tutorialWinnerRestart())return;
  if(S.familyNormalMode==='winner'){
    const round=S.familyActiveData?.activeRound||S.familyActiveData?.lastCompletedRound||null,cmp=round?.snapshot?.compareBoth||null,session=familySessionRead(),host=session?.member?.role==='host';
    if(round?.snapshot?.outcome==='no_winner')return familyRestartFromNoWinner();
    if(cmp?.mode==='compare_both'&&cmp.track==='meal')return host?familyContinueCompareRestaurant(round):familyDismissWinner();
    if(cmp?.mode==='compare_both'&&cmp.track==='restaurant')return host?familyCreateCompareFinal(round):familyDismissWinner();
    return host?familyRestartAfterWinner():familyDismissWinner();
  }
  return resetRound();
}
function familyDismissWinner(){const s=familySessionRead();if(s)familySessionWrite({...s,dismissedWinnerRoundId:S.familyNormalRoundId,lastWinnerItem:S.winnerItem||s.lastWinnerItem||null});S.familyNormalMode='idle';S.familyNormalAutoResume=true;show('family');familyRefreshState();}

function familyRenderState(data){
 const family=data?.family,me=data?.me;if(!family||!me)return;S.familyActiveData=data;
 $('familyJoinCodeDisplay').textContent=family.joinCode||'—';$('familyMemberCount').textContent=String(family.memberCount||0)+' of 8 here';familyDisplayMemberList(data.members||[],me);['familySetup','familySwipe','familyWinner'].forEach(id=>$(id)?.classList.add('hidden'));
 const activeRound=data.activeRound||null,completed=data.lastCompletedRound||null,stage=activeRound&&['swiping','final_swiping','tiebreak'].includes(activeRound.status),showWinner=!!completed&&familySessionRead()?.dismissedWinnerRoundId!==completed.id&&!activeRound,onNormal=['setup','decision','winner'].includes(S.familyNormalMode),noRound=!activeRound,cmp=completed?.snapshot?.compareBoth||null;
 $('familyLobby')?.classList.toggle('hidden',onNormal||stage||showWinner);
 const home=$('familySetupOpen'),rest=$('familyStartDecision'),both=$('familyCompareBoth');
 if(home){home.classList.toggle('hidden',!(me.role==='host'&&noRound));home.dataset.familyLobbyAction=cmp?.track==='meal'?'compare-restaurant':cmp?.track==='restaurant'?'compare-final':'meal';home.textContent=cmp?.track==='meal'?'CONTINUE TO RESTAURANT':cmp?.track==='restaurant'?'COMPARE THE TWO':'AT HOME';}
 if(rest){rest.classList.toggle('hidden',!(me.role==='host'&&noRound&&!cmp?.mode));rest.textContent='RESTAURANT';}
 if(both){both.classList.toggle('hidden',!(me.role==='host'&&noRound&&!cmp?.mode));}
 if(stage){if(S.familyNormalAutoResume)familyBeginNormalDecision(data);else if(S.screen==='family')familySetStatus('familyLobbyStatus','Dinner is underway. Open Family Mode again to resume.');return;}
 if(showWinner){if(S.familyNormalAutoResume)completed.snapshot?.outcome==='no_winner'?familyShowNoWinner(completed):familyShowWinner(completed);else if(S.screen==='family')familySetStatus('familyLobbyStatus','Dinner is decided.');return;}
 if(!activeRound&&['decision','winner'].includes(S.familyNormalMode)){S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyNormalRoundId='';S.familyNormalStage=0;show('family');familySetStatus('familyLobbyStatus','The Family dinner has ended.');return;}
 if(onNormal){familyNormalBar(S.familyDecisionType,S.familyNormalMode,data);return;}
 if(cmp?.mode==='compare_both'&&cmp.track==='meal')familySetStatus('familyLobbyStatus',me.role==='host'?'At Home is decided. Continue to Restaurants.':'At Home is decided. Waiting for the host.');else if(cmp?.mode==='compare_both'&&cmp.track==='restaurant')familySetStatus('familyLobbyStatus',me.role==='host'?'Both tracks are decided. Compare the two.':'Both tracks are decided. Waiting for the host.');else familySetStatus('familyLobbyStatus',me.role==='host'?'Everyone is here. Choose At Home, Restaurant, or Compare Both.':'You’re in. Waiting for the host.');
}async function familyRefreshState(){const s=familySessionRead();if(!s?.token)return null;try{const data=await familyApi('state',{token:s.token});familySessionWrite({...s,family:data.family,member:data.me,lastWinnerItem:data.activeRound?.winnerItem||data.lastCompletedRound?.winnerItem||s.lastWinnerItem||null,lastDecisionType:data.activeRound?.decisionType||data.lastCompletedRound?.decisionType||s.lastDecisionType||'food'});familyRenderState(data);return data;}catch(err){if(err.code==='UNAUTHORIZED')familySessionClear();familySetStatus('familyLobbyStatus',err.message||'Could not reconnect to this Family.','error');return null;}}
function startFamilyLobbyPolling(){if(S.familyPollTimer)return;S.familyPollTimer=setInterval(()=>{const s=familySessionRead(),shouldPoll=!!s?.token&&(S.screen==='family'||S.familyNormalMode!=='idle');if(shouldPoll&&!S.familyPollBusy){S.familyPollBusy=true;familyRefreshState().finally(()=>{S.familyPollBusy=false;});}else if(!shouldPoll){clearInterval(S.familyPollTimer);S.familyPollTimer=0;}},4000);}
function stopFamilyLobbyPolling(){if(S.familyPollTimer){clearInterval(S.familyPollTimer);S.familyPollTimer=0;}}
async function familyCreate(){const name=$('familyCreateName')?.value?.trim()||'';familySetStatus('familyCreateStatus','Creating…','busy');try{const data=await familyApi('create',{displayName:name});familySessionWrite({token:data.token,family:data.family,member:data.member});familyShowEntry();$('familyLobby')?.classList.remove('hidden');familyRenderState(data);familySetStatus('familyLobbyStatus','Family created. Share the code with everyone.');startFamilyLobbyPolling();}catch(err){familySetStatus('familyCreateStatus',err.message||'Could not create the Family.','error');}}
async function familyJoin(){const codeValue=$('familyJoinCode')?.value?.trim()||'',name=$('familyJoinName')?.value?.trim()||'';familySetStatus('familyJoinStatus','Joining…','busy');try{const data=await familyApi('join',{joinCode:codeValue,displayName:name});familySessionWrite({token:data.token,family:data.family,member:data.member});familyShowEntry();$('familyLobby')?.classList.remove('hidden');familyRenderState(data);familySetStatus('familyLobbyStatus','You’re in. Waiting for the host.');startFamilyLobbyPolling();}catch(err){familySetStatus('familyJoinStatus',err.message||'Could not join that Family.','error');}}
async function familyCopyCode(){const codeText=$('familyJoinCodeDisplay')?.textContent?.trim()||'';if(!codeText||codeText==='—')return;try{await navigator.clipboard.writeText(codeText);familySetStatus('familyLobbyStatus','Family code copied. Share it with everyone.');}catch{familySetStatus('familyLobbyStatus','Code: '+codeText);}}
async function familyShareCode(){const codeText=$('familyJoinCodeDisplay')?.textContent?.trim()||'';if(!codeText||codeText==='—')return;const shareData={title:'Dinliminate — Dinner Together',text:'Join our Dinliminate dinner decision. Family code: '+codeText};if(typeof navigator.share==='function'){try{await navigator.share(shareData);return;}catch(err){if(err?.name==='AbortError')return;}}try{await navigator.clipboard.writeText(shareData.text);familySetStatus('familyLobbyStatus','Invite copied. Share it with everyone.');}catch{familySetStatus('familyLobbyStatus',shareData.text);}}
async function familyOpen(){S.familyNormalAutoResume=true;['familySetup','familySwipe','familyWinner'].forEach(id=>$(id)?.classList.add('hidden'));show('family');const s=familySessionRead();if(!s?.token){S.familyNormalMode='idle';familyShowEntry();stopFamilyLobbyPolling();return;}await familyRefreshState();startFamilyLobbyPolling();}
async function familyEndDinner(){
 const s=familySessionRead();if(!s?.token||s.member?.role!=='host'||!s.family?.activeRoundId)return;
 if(!await appConfirm('End Dinner Together','End the active Family dinner for everyone? They will return to the Family lobby.','End Dinner'))return;
 try{await familyApi('end-round',{token:s.token});familyResetCompareState();S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyNormalRoundId='';S.familyNormalStage=0;S.familyActiveData=null;show('family');await familyRefreshState();familySetStatus('familyLobbyStatus','Dinner ended by the host. You can start a new one anytime.');}
 catch(err){familySetStatus('familyLobbyStatus',err.message||'Could not end the Family dinner.','error');}
}
async function familyLeave(){const s=familySessionRead();if(!await appConfirm('Leave Family Mode',s?.family?.activeRoundId?'A Family dinner is active. You can leave and rejoin later.':'Leave this Family on this device?','Leave'))return;familyResetCompareState();S.familyNormalMode='idle';S.familyNormalAutoResume=false;stopFamilyLobbyPolling();if(s?.token){try{await familyApi('leave',{token:s.token});}catch(err){familySetStatus('familyLobbyStatus',err.message||'Could not leave the Family.','error');return;}}familySessionClear();familyShowEntry();show('family');}
async function familyRotateCode(){const s=familySessionRead();if(!s?.token)return;try{const d=await familyApi('rotate-code',{token:s.token});familySessionWrite({...s,family:{...(s.family||{}),joinCode:d.joinCode}});await familyRefreshState();}catch(err){familySetStatus('familyLobbyStatus',err.message||'Could not regenerate the code.','error');}}
function familyBackFromMode(){S.familyNormalMode='idle';S.familyNormalAutoResume=false;S.familyDecisionType='';S.familyVotedIds=new Set();familyResetCompareState();stopFamilyLobbyPolling();home();}

$('foodHomeBack')?.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();home();});
$('restaurantHomeBack')?.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();home();});
$('familyMode')?.addEventListener('click',()=>navigateFromDrawer(familyOpen));$('familyBackTop')?.addEventListener('click',familyBackFromMode);
$('familyCreateChoice')?.addEventListener('click',familyShowCreate);$('familyJoinChoice')?.addEventListener('click',familyShowJoin);$('familyCreateBack')?.addEventListener('click',familyShowEntry);$('familyJoinBack')?.addEventListener('click',familyShowEntry);
$('familyCreateSubmit')?.addEventListener('click',familyCreate);$('familyJoinSubmit')?.addEventListener('click',familyJoin);$('familyLeave')?.addEventListener('click',familyLeave);$('familyCopyCode')?.addEventListener('click',familyCopyCode);$('familyShareCode')?.addEventListener('click',familyShareCode);$('familyRotateCode')?.addEventListener('click',familyRotateCode);
$('familySetupOpen')?.addEventListener('click',()=>{const a=$('familySetupOpen')?.dataset.familyLobbyAction||'meal',r=S.familyActiveData?.lastCompletedRound;if(a==='compare-restaurant'&&r){S.familyCompareBothMode='restaurant';S.familyCompareBothMealWinner=r.winnerItem;S.familyCompareBothGroupId=String(r.snapshot?.compareBoth?.groupId||S.familyCompareBothGroupId);familyChooseNormalType('restaurant');}else if(a==='compare-final'&&r)familyCreateCompareFinal(r);else familyChooseNormalType('meal');});$('familyStartDecision')?.addEventListener('click',()=>familyChooseNormalType('restaurant'));$('familyCompareBoth')?.addEventListener('click',()=>familyChooseNormalType('both'));
$('familySetupBack')?.addEventListener('click',()=>familyNormalBack(S.familyDecisionType||'meal'));$('foodFamilyNormalStart')?.addEventListener('click',()=>familyStartRoundFromNormal('meal'));$('restaurantFamilyNormalStart')?.addEventListener('click',()=>familyStartRoundFromNormal('restaurant'));
$('familyCreateName')?.addEventListener('keydown',e=>{if(e.key==='Enter')familyCreate();});$('familyJoinName')?.addEventListener('keydown',e=>{if(e.key==='Enter')familyJoin();});$('familyJoinCode')?.addEventListener('input',e=>{const v=e.target.value.replace(/[^a-z0-9]/gi,'').toUpperCase().slice(0,6);e.target.value=v.length>3?v.slice(0,3)+' · '+v.slice(3):v;});



export { familySessionRead, familySessionWrite, familySessionClear, familySetStatus, familyShowEntry, familyShowCreate, familyShowJoin, familyDisplayMemberList, familyEnsureNormalBar, familyNormalBar, familyDefaultDinnerTime, familyDinnerTargetIso, familyChooseNormalType, familyBuildNormalSnapshot, familyBeginNormalDecision, familyNormalStagePool, familyIsBrowseStage, familyBrowseSource, familyBrowseSubmitted, familyBrowseRender, familyBrowseNext, familyBrowsePrevious, familyBrowseBack, familyRoundStage, familyRoundCopy, familySetDecisionAction, familySwipeInstruction, familySetWinnerMeta, familyHideWinnerMeta, familyShowNoWinner, familyResetCompareState, familyRestartFromNoWinner, familyRestartAfterWinner, familyContinueCompareRestaurant, familyNormalBack, familyDecisionBack, familyShowWinner, handleWinnerRestart, familyDismissWinner, familyRenderState, startFamilyLobbyPolling, stopFamilyLobbyPolling, familyBackFromMode, familyApi, familyStartRoundFromNormal, familyEnterMaybes, familyPickSingle, familyCreateCompareFinal, familyCreate, familyJoin, familyCopyCode, familyShareCode, familyOpen, familyEndDinner, familyLeave, familyRotateCode };
