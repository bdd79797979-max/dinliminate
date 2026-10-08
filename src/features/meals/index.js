import { state as S } from '../../state/store.js';
import { $ } from '../../ui/dom.js';
import { esc } from '../../ui/esc.js';
import { appToast, appConfirm } from '../../ui/modal.js';
import { save, getStoredPhoto, putStoredPhoto, deleteStoredPhoto, storeMealPhotoSet } from '../../state/storage.js';
import { foodQuickImage, bindImageFallbackAttrs, imageProxyUrl, normalizeMealPhotoRef, dedupeMealPhotos, mealPhotoList, customQuickCutImage, show, readImageFile } from '../../main.js';
import { drawFood } from '../swipe/index.js';

function ensureMealTimeSettings(){
 const current=S.mealTimeSettings&&typeof S.mealTimeSettings==='object'&&!Array.isArray(S.mealTimeSettings)?S.mealTimeSettings:{};
 if(!current.names||typeof current.names!=='object'||Array.isArray(current.names))current.names={};
 if(!Array.isArray(current.custom))current.custom=[];
 if(!Array.isArray(current.order))current.order=[];
 if(!(current.disabled instanceof Set))current.disabled=new Set(Array.isArray(current.disabled)?current.disabled:[]);
 current.custom=current.custom.map(x=>({id:String(x?.id||('custom-meal-time-'+Math.random().toString(36).slice(2,9))),name:String(x?.name||'').trim()})).filter(x=>x.name);
 const validIds=new Set([...DEFAULT_MEAL_TIME_DEFS.map(x=>x.id),...current.custom.map(x=>x.id)]);
 current.order=[...current.order.map(String).filter(id=>validIds.has(id)),...DEFAULT_MEAL_TIME_DEFS.map(x=>x.id),...current.custom.map(x=>x.id)].filter((id,i,a)=>a.indexOf(id)===i);
 current.disabled=new Set([...current.disabled].map(String).filter(id=>validIds.has(id)));
 DEFAULT_MEAL_TIME_DEFS.forEach(def=>{if(!String(current.names[def.id]||'').trim())current.names[def.id]=def.name;});
 S.mealTimeSettings=current;
 return current;
}
function mealTimeCatalog(){
 const cfg=ensureMealTimeSettings();
 const defaults=DEFAULT_MEAL_TIME_DEFS.map(def=>({id:def.id,defaultName:def.name,name:String(cfg.names[def.id]||def.name).trim()||def.name,custom:false}));
 const customs=(cfg.custom||[]).map(x=>({id:String(x.id),defaultName:'',name:String(x.name||'').trim(),custom:true})).filter(x=>x.name);
 const byId=new Map([...defaults,...customs].map(x=>[x.id,x]));
 return cfg.order.map(String).map(id=>byId.get(id)).filter(Boolean).concat([...byId.values()].filter(x=>!cfg.order.includes(x.id)));
}
function mealTimeOptions(){return mealTimeCatalog().map(x=>({...x,enabled:!S.mealTimeSettings.disabled.has(x.id)}));}
function mealTimeNames(){return mealTimeOptions().filter(x=>x.enabled).map(x=>x.name);}
function mealTimeDefinition(value){
 const key=normKey(value);
 if(!key)return null;
 return mealTimeCatalog().find(x=>normKey(x.name)===key || (x.defaultName&&normKey(x.defaultName)===key))||null;
}
function currentMealTimeName(value){
 const found=mealTimeDefinition(value);
 return found?.name||String(value||'').trim();
}
function syncMealTimeReferences(oldName,newName,id){
 const replaceIn=item=>{
  if(!item||!Array.isArray(item.mealTimes))return;
  item.mealTimes=[...new Set(item.mealTimes.map(value=>String(value||'').trim()===oldName?newName:value).filter(Boolean))];
  if(!item.mealTimes.length)item.mealTimes=[newName];
 };
 S.custom.forEach(replaceIn);
 S.deletedCustomMeals?.forEach(replaceIn);
 S.mealTimeFilters=new Set([...S.mealTimeFilters||[]].map(value=>value===oldName?newName:value));
}
function mealTimesFor(item){
 const raw=Array.isArray(item?.mealTimes)?item.mealTimes:(item?.mealTime?[item.mealTime]:[]);
 const explicit=raw.map(currentMealTimeName).filter(Boolean);
 if(explicit.length)return [...new Set(explicit)];
 const category=String(item?.category||'').trim().toLowerCase();
 const cuts=(Array.isArray(item?.quickCuts)?item.quickCuts:[item?.category]).map(x=>String(x||'').trim().toLowerCase());
 const fallbackId=category==='breakfast'||cuts.includes('breakfast')
   ?'breakfast'
   :(category==='snack'||category==='dessert'||category==='desserts'||cuts.some(x=>x==='snack'||x==='dessert'||x==='desserts')
     ?'snacks-desserts':'lunch-dinner');
 const found=mealTimeCatalog().find(x=>x.id===fallbackId);
 return [found?.name||'Lunch / Dinner'];
}
function mealTimeFor(item){ return mealTimesFor(item)[0]||mealTimeNames()[0]||'Lunch / Dinner'; }
function foodBasePool(){
 const rows=allFoods().filter(item=>{
  if(S.hidden.has(item.id)||S.foodCuts.has(item.id))return false;
  if(S.mealTimeFilters?.size){const times=mealTimesFor(item);if(!times.some(t=>S.mealTimeFilters.has(t)))return false;}
  const cuts=Array.isArray(item.quickCuts)?item.quickCuts:[item.category];
  if([...S.cutCats].some(label=>cuts.includes(label)))return false;
  return true;
 });
 // CP1225: keep Fish Sticks as the final card in every Meals deck,
 // including filtered and Maybe views, without changing catalog data.
 const fishIndex=rows.findIndex(item=>String(item?.id||'')==='fish-sticks');
 if(fishIndex>=0){
  const [fish]=rows.splice(fishIndex,1);
  rows.push(fish);
 }
 return rows;
}
function foodPool(){
 const base=foodBasePool();
 return S.maybeDeck ? base.filter(item=>S.maybe.has(item.id)) : base;
}
function buildFood() {
S.pool = foodPool();
S.index = Math.max(0, Math.min(S.index, Math.max(0, S.pool.length - 1)));
}
function setMaybeDeck(kind, enabled){
 const next=!!enabled;
 const hasMaybe=maybeDeckCount(kind)>0;
 // Never enter Maybe mode when there are no Maybe choices.
 if(next && !hasMaybe){
  S.maybeDeck=false;
  if(kind==='food'){S.foodMaybeRound=false;S.index=0;buildFood();drawFood();}
  else{S.restaurantMaybeRound=false;S.restaurantIndex=0;drawRestaurants();}
  renderMaybeDeckToggle(kind);save();
  return;
 }
 if(kind==='food'){
  S.maybeDeck=next; S.foodMaybeRound=next; S.index=0; buildFood(); drawFood();
 }else{
  S.maybeDeck=next; S.restaurantMaybeRound=next; S.restaurantIndex=0; drawRestaurants();
 }
 renderMaybeDeckToggle(kind); save();
}
function allChoiceRows(kind){
 if(kind==='food')return foodBasePool();
 // CP1214: ALL is the decision pool, not the photo-readiness pool.
 // A missing/unavailable photo must never lower the restaurant count.
 return restaurantPoolHourFiltered();
}
function choiceDeckRows(kind){
 const all=allChoiceRows(kind);
 return S.maybeDeck ? all.filter(row=>kind==='food'?S.maybe.has(row.id):!!row._maybe) : all;
}
function maybeDeckRows(kind){
 return allChoiceRows(kind).filter(row=>kind==='food'?S.maybe.has(row.id):!!row._maybe);
}
function maybeDeckCount(kind){return maybeDeckRows(kind).length;}
function allDeckCount(kind){return allChoiceRows(kind).length;}
function renderMaybeDeckToggle(kind){
 const id=kind==='food'?'foodMaybeDeck':'restaurantMaybeDeck';
 const btn=$(id);if(!btn)return;
 const allCount=allDeckCount(kind);
 const maybeCount=maybeDeckCount(kind);
 const isMaybe=!!S.maybeDeck;
 const visibleCount=isMaybe?maybeCount:allCount;
 const hasMaybes=maybeCount>0;
 btn.dataset.mode=isMaybe?'maybe':'all';
 btn.dataset.allCount=String(allCount);
 btn.dataset.maybeCount=String(maybeCount);
 btn.dataset.visibleCount=String(visibleCount);
 btn.disabled=false;
 const target=isMaybe?'Show all choices':'Show Maybe choices';
 btn.setAttribute('aria-label',isMaybe?'Viewing Maybe choices ('+maybeCount+'). Tap to show all choices ('+allCount+').':'Viewing all choices ('+allCount+'). Tap to show Maybe choices ('+maybeCount+').');
 btn.setAttribute('aria-pressed',isMaybe?'true':'false');
 btn.title=target;
 btn.classList.add('canonical-maybe-control');
 btn.innerHTML='<span class="maybe-control-all" aria-hidden="true">ALL</span><span class="maybe-control-divider" aria-hidden="true">·</span><span class="maybe-control-maybe" aria-hidden="true">MAYBES</span><span class="maybe-control-count" aria-hidden="true">'+visibleCount+'</span>';
 btn.classList.toggle('is-maybe',isMaybe);
 btn.classList.toggle('is-all',!isMaybe);
 btn.classList.toggle('has-maybes',hasMaybes);
}
function bindMaybeDeckToggle(kind){
 const id=kind==='food'?'foodMaybeDeck':'restaurantMaybeDeck';
 const btn=$(id);if(!btn)return;
 btn.onclick=()=>{
  const hasMaybe=maybeDeckCount(kind)>0;
  if(!S.maybeDeck && !hasMaybe)return;
  setMaybeDeck(kind,!S.maybeDeck);
 };
 renderMaybeDeckToggle(kind);
}
function renderRestaurantHours(){
 const toggle=$('restaurantHoursToggle');if(!toggle)return;
 const active=String(S.restaurantHours||'all')==='open';
 // CP1211: Restaurant Hours is now a single binary filter. Legacy "closed"
 // state is treated as the default all-restaurants state.
 S.restaurantHours=active?'open':'all';
 S.restaurantHoursCollapsed=true;
 const chips=$('restaurantHoursQuick');
 if(chips){
  chips.innerHTML='';
  chips.classList.add('is-rail-collapsed');
  chips.setAttribute('aria-hidden','true');
 }
 toggle.classList.remove('is-open');
 toggle.classList.toggle('is-active',active);
 toggle.dataset.mode=active?'open':'all';
 toggle.setAttribute('data-active',active?'true':'false');
 toggle.setAttribute('aria-expanded','false');
 toggle.setAttribute('aria-pressed',active?'true':'false');
 toggle.setAttribute('aria-label',active?'Turn Open filter off — show all restaurants':'Show only restaurants open now');
 toggle.title=active?'Show all restaurants':'Show only restaurants open now';
}
function bindRestaurantHours(){
 const toggle=$('restaurantHoursToggle');
 if(!toggle)return;
 toggle.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   const next=String(S.restaurantHours||'all')==='open'?'all':'open';
   S.restaurantHours=next;
   S.restaurantIndex=0;
   S.restaurantMaybeRound=false;
   renderRestaurantHours();
   if(next==='open'){
     const sameSearch=restaurantHoursEnrichmentKey===String(S.restaurantSearchKey||'');
     const recentlyEnriched=sameSearch&&(Date.now()-restaurantHoursEnrichedAt)<10*60*1000;
     if(!recentlyEnriched){
       updateRestaurantStatus();
       enrichRestaurantHoursForOpenNow().then(()=>{
         if(S.screen!=='restaurant'||S.restaurantHours!=='open')return;
         updateRestaurantStatus();
         drawRestaurants();
         save();
       }).catch(()=>{
         if(S.screen==='restaurant'&&S.restaurantHours==='open'){
           updateRestaurantStatus();
           drawRestaurants();
           save();
         }
       });
     }else{
       updateRestaurantStatus();
       drawRestaurants();
       save();
     }
   }else{
     updateRestaurantStatus();
     drawRestaurants();
     save();
   }
 };
 renderRestaurantHours();
}
function renderQuickCutsCollapse(kind){
 const section=kind==='food'?document.querySelector('#food .quick-section'):document.querySelector('#restaurant .restaurant-quick-section');
 const toggle=kind==='food'?document.getElementById('foodQuickToggle'):section?.querySelector('.quick-cuts-collapse-toggle');
 const chips=kind==='food'?document.getElementById('foodQuick'):document.getElementById('restQuick');
 if(!section||!toggle||!chips)return;
 const collapsed=!!S.quickCutsCollapsed?.[kind];
 if(kind==='food'){
  // Hard-lock the Meals refine panels so Cuisine and Meal Times can never both be open.
  if(!collapsed && !S.mealTimeCutsCollapsed)S.mealTimeCutsCollapsed=true;
  section.classList.remove('is-collapsed');
  chips.classList.toggle('is-rail-collapsed',collapsed);
  const mealTimeChips=document.getElementById('mealTimeQuick');
  mealTimeChips?.classList.toggle('is-rail-collapsed',!!S.mealTimeCutsCollapsed);
  mealTimeChips?.setAttribute('aria-hidden',String(!!S.mealTimeCutsCollapsed));
 }else{
  section.classList.toggle('is-collapsed',collapsed);
 }
 toggle.classList.toggle('is-open',!collapsed);
 toggle.setAttribute('aria-expanded',String(!collapsed));
 toggle.setAttribute('aria-label',(collapsed?'Show ':'Hide ')+'Cuisine');
 toggle.title=collapsed?'Show Cuisine':'Hide Cuisine';
 chips.setAttribute('aria-hidden',String(collapsed));
}
function bindQuickCutsCollapse(kind){
 const section=kind==='food'?document.querySelector('#food .quick-section'):document.querySelector('#restaurant .restaurant-quick-section');
 const toggle=kind==='food'?document.getElementById('foodQuickToggle'):section?.querySelector('.quick-cuts-collapse-toggle');
 if(!toggle)return;
 toggle.onclick=event=>{
   event.preventDefault();
   event.stopPropagation();
   if(kind==='restaurant'){
     setRestaurantRefinePanel('cuisine');
     save();
     return;
   }
   const nextOpen=!!S.quickCutsCollapsed?.[kind];
   S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),[kind]:!nextOpen};
   if(!nextOpen && kind==='food'){
    // Meal Times and Cuisine Cuts are mutually exclusive on the Meals screen.
    S.mealTimeCutsCollapsed=true;
    renderMealTimeCuts();
   }
   renderQuickCutsCollapse(kind);
   save();
 };
 renderQuickCutsCollapse(kind);
}
function mealTimeFilterNames(){
 const available=mealTimeOptions().filter(x=>x.enabled).map(x=>String(x.name||'').trim()).filter(Boolean);
 return [...new Set(available)];
}
function normalizeMealTimeFilter(){
 const available=mealTimeFilterNames();
 const allowed=new Set(available);
 const incoming=[...(S.mealTimeFilters||[])].map(currentMealTimeName).map(x=>String(x||'').trim()).filter(x=>allowed.has(x));
 const selected=new Set(incoming);
 // The canonical default is ALL Meal Times. Never persist an invalid/empty filter.
 if(!selected.size&&available.length)available.forEach(name=>selected.add(name));
 S.mealTimeFilters=selected;
 return {available,selected};
}
function renderMealTimeCuts(){
 const toggle=document.getElementById('foodMealTimeToggle');
 const chips=document.getElementById('mealTimeQuick');
 if(!toggle||!chips)return;

 const {available,selected}=normalizeMealTimeFilter();
 const allSelected=available.length>0&&available.every(name=>selected.has(name));
 const activeLabels=available.filter(name=>selected.has(name));
 const summary=allSelected?'All Meal Times':activeLabels.join(', ');
 const collapsed=!!S.mealTimeCutsCollapsed;
 if(!collapsed && !S.quickCutsCollapsed?.food){
  // Hard-lock the Meals refine panels: opening Meal Times closes Cuisine.
  S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:true,restaurant:true}),food:true};
  const cuisineChips=document.getElementById('foodQuick');
  cuisineChips?.classList.add('is-rail-collapsed');
  cuisineChips?.setAttribute('aria-hidden','true');
 }

 // The header behaves like Cuisine: normal state is restrained; only the
 // opened control goes white. Filter selection itself does not recolor the
 // header button.
 toggle.classList.toggle('is-open',!collapsed);
 toggle.classList.remove('is-active');
 toggle.setAttribute('aria-expanded',String(!collapsed));
 toggle.setAttribute('aria-pressed',String(!collapsed));
 toggle.setAttribute('data-all-selected',allSelected?'true':'false');
 toggle.setAttribute('data-selected-count',String(activeLabels.length));
 toggle.setAttribute('aria-label',(collapsed?'Show ':'Hide ')+'Meal Times'+(allSelected?'':' — '+summary));
 toggle.title=(collapsed?'Show ':'Hide ')+'Meal Times'+(allSelected?'':' — '+summary);

 chips.classList.toggle('is-rail-collapsed',collapsed);
 chips.setAttribute('aria-hidden',String(collapsed));
 chips.dataset.selected=activeLabels.join('|');
 chips.dataset.allSelected=allSelected?'true':'false';
 chips.innerHTML=available.map(label=>{
   const active=selected.has(label);
   return '<button class="chip meal-time-chip'+(active?' is-active':'')+'" data-meal-time="'+esc(label)+'" data-active="'+(active?'true':'false')+'" type="button" aria-pressed="'+(active?'true':'false')+'">'+esc(label)+'</button>';
 }).join('');

 chips.querySelectorAll('[data-meal-time]').forEach(btn=>{
  btn.onclick=(event)=>{
   event.preventDefault();
   event.stopPropagation();
   const label=currentMealTimeName(btn.dataset.mealTime);
   if(!label||!available.includes(label))return;

   const next=new Set(S.mealTimeFilters||[]);
   if(next.has(label)){
    // At least one Meal Time stays selected; otherwise the state would become
    // ambiguous. To get ALL, simply reselect the removed time.
    if(next.size>1)next.delete(label);
   }else{
    next.add(label);
   }
   S.mealTimeFilters=new Set([...next].filter(name=>available.includes(name)));
   normalizeMealTimeFilter();
   S.index=0;
   buildFood();
   drawFood();
   renderMealTimeCuts();
   save();
  };
 });
}
function bindMealTimeCuts(){
 const toggle=document.getElementById('foodMealTimeToggle');
 if(!toggle)return;
 toggle.onclick=(event)=>{
  event.preventDefault();
  event.stopPropagation();
  const nextOpen=!!S.mealTimeCutsCollapsed;
  S.mealTimeCutsCollapsed=!nextOpen;
  if(!nextOpen){
   // Meal Times and Cuisine Cuts are mutually exclusive on the Meals screen.
   S.quickCutsCollapsed={...(S.quickCutsCollapsed||{food:false,restaurant:false}),food:true};
   renderQuickCutsCollapse('food');
  }
  renderMealTimeCuts();
  save();
 };
 renderMealTimeCuts();
}
function foodQuick() {
 const labels=foodQuickLabels();
 const existing=[...document.querySelectorAll('#foodQuick [data-food-quick]')].map(btn=>btn.dataset.foodQuick);
 if(existing.length!==labels.length||existing.some((x,i)=>x!==labels[i])){
  $('foodQuick').innerHTML = labels.map(label => {
   const src=foodQuickImage(label);
   return '<button class="chip photo-chip" data-food-quick="'+esc(label)+'"><img class="quick-chip-photo" src="'+esc(src)+'" alt="'+esc(label)+' meal photo" draggable="false"><span>'+esc(label)+'</span></button>';
  }).join('');
  bindImageFallbackAttrs('[data-food-quick] img');
 }
 document.querySelectorAll('#foodQuick [data-food-quick]').forEach(btn => {
  const label=btn.dataset.foodQuick;
  const img=btn.querySelector('.quick-chip-photo');if(img)img.src=foodQuickImage(label);
  btn.classList.toggle('cut',S.cutCats.has(label));
  btn.onclick = () => {
   S.cutCats.has(label) ? S.cutCats.delete(label) : S.cutCats.add(label);
   S.index=0;
   buildFood();
   foodQuick();
   drawFood();
   save();
  };
 });
 bindQuickCutsCollapse('food');
 renderMealTimeCuts();
 bindMealTimeCuts();
}


function mealNameSimilarMatches(name,excludeId=''){
 const target=String(name||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 if(!target)return [];
 const targetTokens=new Set(target.split(/\s+/).filter(Boolean));
 const score=(value)=>{
  const other=String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  if(!other||other===target)return other===target?1:0;
  if(other.includes(target)||target.includes(other))return .82;
  const set=new Set(other.split(/\s+/).filter(Boolean));
  let overlap=0;for(const token of targetTokens)if(set.has(token))overlap++;
  const union=new Set([...targetTokens,...set]).size;
  return union?overlap/union:0;
 };
 return allFoods().map(item=>({item,score:score(item?.name)}))
  .filter(x=>x.score>=.6&&String(x.item?.id||'')!==String(excludeId||''))
  .sort((a,b)=>b.score-a.score)
  .slice(0,3).map(x=>x.item?.name).filter(Boolean);
}
async function requestMealAutofill(name,options={}){
 const section=String(options.section||'all');
 const response=await fetch('/api/meal-autofill',{
  method:'POST',
  headers:{'Content-Type':'application/json','Accept':'application/json'},
  body:JSON.stringify({
   name:String(name||'').trim(),
   section,
   cuisineOptions:foodQuickLabels(),
   mealTimeOptions:mealTimeNames(),
   current:options.current&&typeof options.current==='object'?options.current:{}
  }),
  cache:'no-store'
 });
 let data=null;try{data=await response.json();}catch(error){console.error('Dinliminate error',error)}
 if(!response.ok||!data?.ok)throw new Error(data?.message||'Meal Auto-Fill could not complete that request.');
 return data;
}

async function findOnlineMealPhoto(name) {
 try {
  const query=String(name||'').trim();
  if(!query)return '';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),4500);
  const url='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(query)+'&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json&formatversion=2&origin=*';
  const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
  clearTimeout(timer);
  if(!response.ok)return '';
  const data=await response.json();
  const pages=Array.isArray(data?.query?.pages)?data.query.pages:[];
  const terms=query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const ranked=pages.map(page=>{
   const title=String(page?.title||'').toLowerCase();
   const info=Array.isArray(page?.imageinfo)?page.imageinfo[0]:null;
   const src=String(info?.thumburl||info?.url||'');
   let score=0;
   for(const term of terms){if(title.includes(term))score+=3;}
   if(/\b(food|dish|meal|butter|sandwich|soup|pasta|rice|chicken|beef|pork|fish|seafood|vegetable|dessert|bread|potato)\b/.test(title))score+=1;
   if(src.startsWith('https://upload.wikimedia.org/'))score+=2;
   return {score,src};
  }).filter(x=>x.src);
  ranked.sort((a,b)=>b.score-a.score);
  return ranked[0]?.src||'';
 } catch {
  return '';
 }
}

function selectedMealTimesFromEditor(){
 return [...document.querySelectorAll('#editFoodMealTime input[name="editMealTime"]:checked')].map(x=>String(x.value||'').trim()).filter(Boolean);
}
function renderFoodEditorMealTimes(selectedOverride){
  const host=$('editFoodMealTime');
  const manager=$('editFoodMealTimeManager');
  const toggle=$('editMealTimesManage');
  if(!host)return;

  const selected=new Set(Array.isArray(selectedOverride)?selectedOverride:selectedMealTimesFromEditor());
  const options=mealTimeOptions();

  host.innerHTML=options
    .filter(item=>item.enabled)
    .map(item=>{
      const checked=selected.has(item.name)?' checked':'';
      return '<label class="quick-cut-tile meal-time-option"><input type="checkbox" name="editMealTime" value="'+esc(item.name)+'"'+checked+'><span>'+esc(item.name)+'</span></label>';
    })
    .join('');

  host.querySelectorAll('input[name="editMealTime"]').forEach(input=>{
    input.addEventListener('change',()=>{
      const checked=selectedMealTimesFromEditor();
      if(!checked.length){
        input.checked=true;
        appToast('Choose at least one Meal Time.');
      }
    });
  });

  if(toggle){
    const editing=!!manager&&!manager.classList.contains('hidden');
    toggle.textContent=editing?'Done':'Edit Meal Times';
    toggle.setAttribute('aria-expanded',String(editing));
  }

  if(manager){
    const catalog=mealTimeCatalog();
    manager.innerHTML=catalog.map((item,index)=>{
      const cfg=ensureMealTimeSettings();
      const isOff=cfg.disabled.has(item.id);
      const first=index===0;
      const last=index===catalog.length-1;
      const customDelete=item.custom
        ? '<button type="button" class="food-editor-meal-time-delete" data-food-editor-meal-time-delete="'+esc(item.id)+'" aria-label="Delete '+esc(item.name)+'">×</button>'
        : '';

      return '<div class="food-editor-meal-time-row" data-food-editor-meal-time-id="'+esc(item.id)+'">'
        +'<div class="food-editor-meal-time-main"><b>'+esc(item.name)+'</b><small>'+esc(item.custom?'CUSTOM':'DEFAULT')+(isOff?' · OFF':'')+'</small></div>'
        +'<div class="food-editor-meal-time-tools">'
        +'<button type="button" class="food-editor-meal-time-move" data-food-editor-meal-time-up="'+esc(item.id)+'" aria-label="Move '+esc(item.name)+' up"'+(first?' disabled':'')+'>↑</button>'
        +'<button type="button" class="food-editor-meal-time-move" data-food-editor-meal-time-down="'+esc(item.id)+'" aria-label="Move '+esc(item.name)+' down"'+(last?' disabled':'')+'>↓</button>'
        +'<button type="button" class="food-editor-meal-time-edit" data-food-editor-meal-time-edit="'+esc(item.id)+'">Edit</button>'
        +'<button type="button" class="food-editor-meal-time-toggle '+(isOff?'':'is-on')+'" data-food-editor-meal-time-toggle="'+esc(item.id)+'" aria-pressed="'+(isOff?'false':'true')+'">'+(isOff?'Off':'On')+'</button>'
        +customDelete
        +'</div></div>';
    }).join('')
    +'<div class="food-editor-meal-time-add"><input id="newFoodEditorMealTimeName" maxlength="28" placeholder="New Meal Time" autocomplete="off"><button type="button" id="addFoodEditorMealTime">＋ Add</button></div>';

    manager.querySelectorAll('[data-food-editor-meal-time-edit]').forEach(btn=>{
      btn.onclick=()=>renameMealTimeInFoodEditor(btn.dataset.foodEditorMealTimeEdit);
    });
    manager.querySelectorAll('[data-food-editor-meal-time-delete]').forEach(btn=>{
      btn.onclick=()=>deleteMealTimeInFoodEditor(btn.dataset.foodEditorMealTimeDelete);
    });
    manager.querySelectorAll('[data-food-editor-meal-time-up]').forEach(btn=>{
      btn.onclick=()=>moveMealTimeInFoodEditor(btn.dataset.foodEditorMealTimeUp,-1);
    });
    manager.querySelectorAll('[data-food-editor-meal-time-down]').forEach(btn=>{
      btn.onclick=()=>moveMealTimeInFoodEditor(btn.dataset.foodEditorMealTimeDown,1);
    });
    manager.querySelectorAll('[data-food-editor-meal-time-toggle]').forEach(btn=>{
      btn.onclick=()=>toggleMealTimeInFoodEditor(btn.dataset.foodEditorMealTimeToggle);
    });

    $('addFoodEditorMealTime')?.addEventListener('click',()=>{
      const input=$('newFoodEditorMealTimeName');
      addMealTimeInFoodEditor(input?.value);
      if(input){
        input.value='';
        input.focus();
      }
    });

    $('newFoodEditorMealTimeName')?.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        $('addFoodEditorMealTime')?.click();
      }
    });
  }
}
function renameMealTimeInFoodEditor(id){
 const item=mealTimeCatalog().find(x=>x.id===String(id));if(!item)return;
 const row=document.querySelector('[data-food-editor-meal-time-id="'+CSS.escape(String(id))+'"]'),main=row?.querySelector('.food-editor-meal-time-main');if(!main||main.querySelector('input'))return;
 const selected=selectedMealTimesFromEditor(),old=item.name;
 main.innerHTML='<input class="food-editor-meal-time-edit-input" maxlength="28" value="'+esc(old)+'" aria-label="Rename Meal Time">';
 const input=main.querySelector('input');
 const finish=commit=>{
  if(!commit){renderFoodEditorMealTimes(selected);return;}
  const next=String(input.value||'').trim();
  if(!next){appToast('Give the Meal Time a name.');input.focus();return;}
  if(mealTimeCatalog().some(x=>x.id!==item.id&&normKey(x.name)===normKey(next))){appToast('That Meal Time name is already in use.');input.focus();input.select();return;}
  const cfg=ensureMealTimeSettings();
  const nextSelected=selected.map(x=>x===old?next:x);
  if(item.custom){
   const custom=cfg.custom.find(x=>String(x.id)===String(id));if(custom)custom.name=next;
   syncMealTimeReferences(old,next,item.id);
  }else{
   const oldCurrent=cfg.names[item.id]||item.defaultName;cfg.names[item.id]=next;syncMealTimeReferences(oldCurrent,next,item.id);
  }
  save();buildFood();foodQuick();renderMealTimeCuts();renderFoodEditorMealTimes(nextSelected);
 };
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();finish(true)}else if(e.key==='Escape'){e.preventDefault();finish(false)}});
 input.addEventListener('blur',()=>window.setTimeout(()=>{if(document.body.contains(input))finish(true)},80));
 input.focus();input.select();
}
function addMealTimeInFoodEditor(name){
 const next=String(name||'').trim();
 if(!next){appToast('Give the new Meal Time a name.');return;}
 if(mealTimeCatalog().some(x=>normKey(x.name)===normKey(next))){appToast('That Meal Time name is already in use.');return;}
 const selected=selectedMealTimesFromEditor(),cfg=ensureMealTimeSettings(),id='meal-time-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
 const wasAllSelected=mealTimeNames().length>0&&mealTimeNames().every(time=>S.mealTimeFilters?.has(time));
 cfg.custom.push({id,name:next});cfg.order.push(id);cfg.order=[...new Set(cfg.order)];
 // A new Meal Time joins the global filter when the user was in the ALL state.
 // When the user was intentionally narrowed to specific times, preserve that choice.
 if(wasAllSelected){
  S.mealTimeFilters=new Set([...(S.mealTimeFilters||[]),next]);
 }
 save();buildFood();foodQuick();renderMealTimeCuts();renderFoodEditorMealTimes([...selected,next]);appToast(next+' added to this meal.');
}
async function deleteMealTimeInFoodEditor(id){
 const item=mealTimeCatalog().find(x=>x.id===String(id));if(!item?.custom)return;
 if(!await appConfirm('Delete '+item.name+'?','Meals using this Meal Time will move to '+(mealTimeCatalog().find(x=>x.id==='lunch-dinner')?.name||'Lunch / Dinner')+'.','Delete Meal Time'))return;
 const selected=selectedMealTimesFromEditor(),fallback=mealTimeOptions().find(x=>x.enabled&&x.id!==String(id))?.name||mealTimeOptions().find(x=>x.enabled)?.name||'Lunch / Dinner',replace=item.name;
 S.custom.forEach(meal=>{if(Array.isArray(meal.mealTimes))meal.mealTimes=[...new Set(meal.mealTimes.map(x=>x===replace?fallback:x).filter(Boolean))]});
 S.deletedCustomMeals?.forEach(meal=>{if(Array.isArray(meal.mealTimes))meal.mealTimes=[...new Set(meal.mealTimes.map(x=>x===replace?fallback:x).filter(Boolean))]});
 const cfg=ensureMealTimeSettings();cfg.custom=cfg.custom.filter(x=>String(x.id)!==String(id));cfg.order=cfg.order.filter(x=>String(x)!==String(id));cfg.disabled.delete(String(id));
 // Keep the global filter synchronized with the catalog. Removing a custom
 // Meal Time also removes it from the active filter; an empty filter means ALL.
 const nextFilter=new Set(S.mealTimeFilters||[]);
 nextFilter.delete(replace);
 const remainingNames=mealTimeNames().filter(name=>name!==replace);
 if(!nextFilter.size)remainingNames.forEach(name=>nextFilter.add(name));
 S.mealTimeFilters=nextFilter;
 const nextSelected=selected.map(x=>x===replace?fallback:x);
 save();buildFood();foodQuick();renderMealTimeCuts();renderFoodEditorMealTimes(nextSelected);appToast(item.name+' deleted.');
}
function moveMealTimeInFoodEditor(id,direction){
 const cfg=ensureMealTimeSettings(),key=String(id),idx=cfg.order.findIndex(x=>String(x)===key),to=idx+direction;
 if(idx<0||to<0||to>=cfg.order.length)return;
 [cfg.order[idx],cfg.order[to]]=[cfg.order[to],cfg.order[idx]];
 save();renderFoodEditorMealTimes();
}
function toggleMealTimeInFoodEditor(id){
 const cfg=ensureMealTimeSettings(),key=String(id),currentlyOff=cfg.disabled.has(key);
 if(!currentlyOff&&mealTimeOptions().filter(x=>x.enabled).length<=1){appToast('Keep at least one Meal Time active.');return;}
 const selected=selectedMealTimesFromEditor(),item=mealTimeCatalog().find(x=>x.id===key),oldName=item?.name;
 const namesBefore=mealTimeOptions().filter(x=>x.enabled).map(x=>x.name);
 const wasAllSelected=namesBefore.length>0&&namesBefore.every(name=>S.mealTimeFilters?.has(name));
 if(currentlyOff)cfg.disabled.delete(key);
 else{
  cfg.disabled.add(key);
  if(oldName){
   const nextSelected=selected.filter(x=>x!==oldName);
   if(!nextSelected.length){cfg.disabled.delete(key);appToast('Keep at least one Meal Time selected for this meal.');return;}
  }
 }
 // Keep the global Meal Time filter aligned with enabled catalog entries.
 const nextFilter=new Set(S.mealTimeFilters||[]);
 if(currentlyOff){
  if(wasAllSelected&&oldName)nextFilter.add(oldName);
 }else if(oldName){
  nextFilter.delete(oldName);
 }
 const enabledNames=mealTimeNames();
 const valid=new Set(enabledNames);
 for(const name of [...nextFilter])if(!valid.has(name))nextFilter.delete(name);
 if(!nextFilter.size)enabledNames.forEach(name=>nextFilter.add(name));
 S.mealTimeFilters=nextFilter;
 save();buildFood();foodQuick();renderMealTimeCuts();renderFoodEditorMealTimes(selected.filter(x=>x!==oldName));
}
function foodEditor(item=null) {
const isEdit=!!item;
const defaultItem=isEdit?getDefaultFoods().find(x=>String(x.id)===String(item?.id)):null;
const isBuiltInEdit=!!defaultItem;
const managerWasOpen = !!$('manageFoodsModal');
if(managerWasOpen){ $('manageFoodsModal')?.remove(); $('manageFoodsModalBg')?.remove(); }
const cats=[...FOOD_QUICK,'Other',...(S.customQuickCuts||[]).map(x=>String(x.name||'').trim()).filter(Boolean)];
const existingCuts=Array.isArray(item?.quickCuts)&&item.quickCuts.length ? [...item.quickCuts] : [item?.category||'American'];
const existingMealTimes=isEdit?new Set(mealTimesFor(item)):new Set();
const nut=item?.nutrition||{};
const ingredientsText=Array.isArray(item?.ingredients)?item.ingredients.join('\n'):'';
const descriptionText=String(item?.description||'').trim();
let editorPhotos=dedupeMealPhotos(mealPhotoList(item),8);
let editorPhotosReady=Promise.resolve();
const body='<form class="add" id="foodEditorForm">'+
'<div class="meal-editor-name-row"><input id="editFoodName" placeholder="Meal name" required value="'+esc(item?.name||'')+'"><button type="button" class="meal-autofill-action" id="editFoodAutoFill">Auto-Fill Meal</button></div><small id="editFoodDuplicateHint" class="meal-editor-duplicate-hint" aria-live="polite"></small><div id="editFoodAutoFillStatus" class="meal-autofill-status" aria-live="polite"></div>'+'<fieldset class="quick-cut-editor meal-category-editor"><legend>Cuisine Cuts <button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="cuisine">Refresh</button></legend><p class="meal-category-helper">Choose every cuisine category or food type you want this meal associated with. Custom adds a reusable Cuisine Cut with its own name and photo.</p><div id="editFoodQuickCuts" class="quick-cut-editor-grid custom-taxonomy-grid"></div></fieldset><fieldset class="quick-cut-editor meal-time-editor"><div class="meal-time-editor-head"><span class="meal-time-editor-title">Meal Times</span><span class="meal-time-editor-actions"><button type="button" class="meal-time-edit-toggle" id="editMealTimesManage" aria-expanded="false">Edit Meal Times</button><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="mealTimes">Refresh</button></span></div><p class="meal-category-helper">Choose one or more Meal Times for this meal.</p><div id="editFoodMealTime" class="quick-cut-editor-grid meal-time-editor-grid"></div><div id="editFoodMealTimeManager" class="food-editor-meal-time-manager hidden" aria-label="Edit Meal Times"></div></fieldset>'+
'<div class="meal-editor-section"><div class="meal-editor-section-head"><div class="meal-editor-section-title">Nutrition per serving</div><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="nutrition">Refresh</button></div><p class="meal-editor-helper">Nutrition is an estimate based on a typical serving.</p><small id="editFoodNutritionBasis" class="meal-autofill-basis" aria-live="polite"></small><div class="meal-nutrition-editor-grid">'+
'<label>Calories<input id="editFoodCalories" type="number" min="0" step="1" inputmode="numeric" placeholder="520" value="'+esc(nut.calories??'')+'"><span>kcal</span></label>'+
'<label>Protein<input id="editFoodProtein" type="number" min="0" step="0.1" inputmode="decimal" placeholder="27" value="'+esc(nut.protein??'')+'"><span>g</span></label>'+
'<label>Carbs<input id="editFoodCarbs" type="number" min="0" step="0.1" inputmode="decimal" placeholder="46" value="'+esc(nut.carbs??'')+'"><span>g</span></label>'+
'<label>Fat<input id="editFoodFat" type="number" min="0" step="0.1" inputmode="decimal" placeholder="25" value="'+esc(nut.fat??'')+'"><span>g</span></label>'+
'<label>Sodium<input id="editFoodSodium" type="number" min="0" step="1" inputmode="numeric" placeholder="1050" value="'+esc(nut.sodium??'')+'"><span>mg</span></label>'+
'</div></div>'+
'<div class="meal-editor-text-label"><div class="meal-editor-text-head"><span>About this meal</span><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="description">Refresh</button></div><textarea id="editFoodDescription" placeholder="A short description of the meal (optional)" rows="3">'+esc(descriptionText)+'</textarea></div>'+
'<div class="meal-editor-text-label"><div class="meal-editor-text-head"><span>Ingredients</span><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="ingredients">Refresh</button></div><textarea id="editFoodIngredients" placeholder="One ingredient per line" rows="5">'+esc(ingredientsText)+'</textarea></div>'+
'<div class="meal-editor-text-label"><div class="meal-editor-text-head"><span>Recipe / preparation</span><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="recipe">Refresh</button></div><textarea id="editFoodRecipe" placeholder="Preparation steps or recipe (optional)" rows="5">'+esc(item?.recipe||'')+'</textarea></div>'+(isEdit?'<section class="meal-editor-note-section"><div class="meal-editor-note-copy"><b>Add a note</b><small>Private to this device. Keep a reminder, favorite, or thought with this meal.</small></div><textarea id="editFoodNote" maxlength="1200" rows="3" placeholder="Write a note about this meal…">'+esc(itemNote(item,'food'))+'</textarea></section>':'')+
'<div class="meal-editor-photo-section"><div class="meal-editor-photo-copy"><div class="meal-editor-photo-head"><b>'+(isEdit?'Replace meal photo':'Photo from iPhone/device')+'</b><button type="button" class="meal-autofill-refresh" data-meal-autofill-refresh="photo">Find Another</button></div><small>'+(isEdit?'Add more photos, reorder them, or leave the existing order unchanged. The first photo is the Cover shown on the meal card and result.':'Upload a photo from your device, or paste a photo URL below.')+'</small><small id="editFoodPhotoStatus" class="meal-autofill-basis" aria-live="polite"></small></div><label class="file-label"><span>Add Photos</span><input id="editFoodFile" type="file" accept="image/*" multiple></label></div>'+'<input id="editFoodPhoto" placeholder="Photo URL (optional)" inputmode="url" value="'+esc(item?.image && !String(item.image).startsWith('idb:') && !String(item.image).startsWith('data:image/')?item.image:'')+'">'+
'<button class="cut">'+(isEdit?'Save Meal':'Add Meal')+'</button></form>';

const modal=openModal('foodEditorModal',isEdit?'Edit Meal':'Add Meal',body);
const autoFillButton=$('editFoodAutoFill');
const autoFillStatus=$('editFoodAutoFillStatus');
const duplicateHint=$('editFoodDuplicateHint');
const nutritionBasis=$('editFoodNutritionBasis');
const photoStatus=$('editFoodPhotoStatus');
const foodNameInput=$('editFoodName');
const readAutofillCurrent=()=>{
 const numeric=id=>{const value=String($(id)?.value||'').trim();return value===''?'':Number(value)};
 return {
  cuisine:[...document.querySelectorAll('input[name="editQuickCut"]:checked')].map(x=>String(x.value||'').trim()).filter(Boolean),
  mealTimes:[...document.querySelectorAll('input[name="editMealTime"]:checked')].map(x=>String(x.value||'').trim()).filter(Boolean),
  description:String($('editFoodDescription')?.value||'').trim(),
  ingredients:String($('editFoodIngredients')?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean),
  recipe:String($('editFoodRecipe')?.value||'').trim(),
  nutrition:{calories:numeric('editFoodCalories'),protein:numeric('editFoodProtein'),carbs:numeric('editFoodCarbs'),fat:numeric('editFoodFat'),sodium:numeric('editFoodSodium')},
  photo:String($('editFoodPhoto')?.value||'').trim(),
  photos:[...editorPhotos]
 };
};
const setChecked=(selector,values)=>{
 const wanted=new Set((Array.isArray(values)?values:[]).map(x=>String(x||'').trim()));
 if(!wanted.size)return;
 document.querySelectorAll(selector).forEach(input=>{input.checked=wanted.has(String(input.value||'').trim());});
};
const setAutofillStatus=(message,state='')=>{
 if(!autoFillStatus)return;
 autoFillStatus.textContent=message||'';
 autoFillStatus.dataset.state=state;
};
const refreshDuplicateHint=()=>{
 if(!duplicateHint)return;
 const matches=mealNameSimilarMatches(foodNameInput?.value||'',item?.id||'');
 duplicateHint.textContent=matches.length?'Similar meal already in your library: '+matches.join(', '):'';
};
const applyMealAutofill=(data,section)=>{
 const draft=data?.draft||{};
 if((section==='all'||section==='cuisine')&&Array.isArray(draft.cuisine)&&draft.cuisine.length)setChecked('input[name="editQuickCut"]',draft.cuisine);
 if((section==='all'||section==='mealTimes')&&Array.isArray(draft.mealTimes)&&draft.mealTimes.length)setChecked('input[name="editMealTime"]',draft.mealTimes);
 if((section==='all'||section==='description')&&String(draft.description||'').trim())$('editFoodDescription').value=draft.description;
 if((section==='all'||section==='ingredients')&&Array.isArray(draft.ingredients)&&draft.ingredients.length)$('editFoodIngredients').value=draft.ingredients.join('\n');
 if((section==='all'||section==='recipe')&&String(draft.recipe||'').trim())$('editFoodRecipe').value=draft.recipe;
 if((section==='all'||section==='nutrition')&&draft.nutrition){
  const n=draft.nutrition;
  if(n.calories!=='')$('editFoodCalories').value=n.calories;
  if(n.protein!=='')$('editFoodProtein').value=n.protein;
  if(n.carbs!=='')$('editFoodCarbs').value=n.carbs;
  if(n.fat!=='')$('editFoodFat').value=n.fat;
  if(n.sodium!=='')$('editFoodSodium').value=n.sodium;
  if(nutritionBasis)nutritionBasis.textContent=draft.nutritionBasis?'Nutrition estimate · '+draft.nutritionBasis:'Nutrition estimate · Typical serving';
 }
 if(section==='all'||section==='photo'){
  const photo=data?.photo?.url||'';
  if(photo){
   editorPhotos=dedupeMealPhotos([photo,...editorPhotos],8);
   $('editFoodPhoto').value=photo;
   if(photoStatus)photoStatus.textContent=(data?.photo?.provider||'')?String(data.photo.provider).replace(/^./,c=>c.toUpperCase())+' photo selected · '+String(data.photo.query||''):'Photo selected';
   if(typeof renderMealPhotos==='function')renderMealPhotos();
  }else if(photoStatus)photoStatus.textContent='No strong exact-match Pexels or Unsplash photo found. Add one manually.';
 }
};
const runMealAutofill=async(section='all')=>{
 if(!MEAL_AUTOFILL_ENABLED)return;
 const name=String(foodNameInput?.value||'').trim();
 if(!name){foodNameInput?.focus();setAutofillStatus('Enter a meal name first.','error');return;}
 const targetButton=section==='all'?autoFillButton:modal.querySelector('[data-meal-autofill-refresh="'+section+'"]');
 if(targetButton){targetButton.disabled=true;targetButton.dataset.originalLabel=targetButton.textContent;targetButton.textContent=section==='photo'?'Finding…':section==='all'?'Filling…':'Refreshing…';}
 if(section==='all')setAutofillStatus('Preparing a meal draft…');
 try{
  const data=await requestMealAutofill(name,{section,current:readAutofillCurrent()});
  applyMealAutofill(data,section);
  if(section==='all'){
   const duplicate=mealNameSimilarMatches(name,item?.id||'');
   setAutofillStatus((data?.photo?.url?'Meal draft ready to review.':'Meal draft ready to review; no strong exact-match photo was found.')+(duplicate.length?' · '+duplicate[0]+' is similar in your library.':''),data?.photo?.url?'success':'notice');
  }
 }catch(error){
  const message=String(error?.message||'Meal Auto-Fill could not complete that request.');
  if(section==='all')setAutofillStatus(message,'error');else appToast(message);
 }finally{
  if(targetButton){targetButton.disabled=false;targetButton.textContent=targetButton.dataset.originalLabel||'Refresh';}
 }
};
autoFillButton?.addEventListener('click',()=>runMealAutofill('all'));
foodNameInput?.addEventListener('input',refreshDuplicateHint);
refreshDuplicateHint();
modal.querySelectorAll('[data-meal-autofill-refresh]').forEach(btn=>btn.addEventListener('click',()=>runMealAutofill(String(btn.dataset.mealAutofillRefresh||''))));

const mealTimeManageToggle=$('editMealTimesManage'),mealTimeManager=$('editFoodMealTimeManager');
mealTimeManageToggle?.addEventListener('click',()=>{
 const open=mealTimeManager?.classList.toggle('hidden')===false;
 mealTimeManageToggle.setAttribute('aria-expanded',String(open));
 mealTimeManageToggle.textContent=open?'Done':'Edit Meal Times';
 if(open)renderFoodEditorMealTimes();
});
renderFoodEditorMealTimes([...existingMealTimes]);
const mealPhotoFile=$('editFoodFile');
const initialPhotoInput=normalizeMealPhotoRef($('editFoodPhoto')?.value);
if(mealPhotoFile){
 mealPhotoFile.multiple=true;
 const label=mealPhotoFile.closest('.file-label')?.querySelector('span');
 if(label)label.textContent='Add photos';
 const photoSection=mealPhotoFile.closest('.meal-editor-photo-section');
 const grid=document.createElement('div');grid.id='mealPhotoEditorGrid';grid.className='meal-photo-editor-grid';photoSection?.appendChild(grid);
 const count=document.createElement('small');count.id='mealPhotoEditorCount';count.className='meal-photo-editor-count';photoSection?.appendChild(count);
  const refreshMealPhotoEditorLabels=()=>{
   const cards=[...grid.querySelectorAll('.meal-photo-editor-card')];
   cards.forEach((card,i)=>{
    card.classList.toggle('is-main',i===0);
    const label=card.querySelector('.meal-photo-editor-card-tools>span');
    if(label)label.textContent=i===0?'COVER':'PHOTO '+(i+1);
    const image=card.querySelector('img');
    if(image)image.alt=i===0?'Cover photo':'Meal photo '+(i+1);
    const remove=card.querySelector('[data-meal-photo-remove]');
    if(remove)remove.setAttribute('aria-label','Remove meal photo '+(i+1));
   });
   count.textContent=editorPhotos.length+' / 8 photos · touch-drag to reorder · first is Cover';
  };
  const syncMealPhotoEditorOrder=()=>{
   editorPhotos=[...grid.querySelectorAll('.meal-photo-editor-card')]
    .map(card=>card.__mealPhotoRef)
    .filter(Boolean);
   editorPhotos=dedupeMealPhotos(editorPhotos,8);
   refreshMealPhotoEditorLabels();
  };
  const bindMealPhotoEditorDrag=()=>{
   if(grid.dataset.dragBound==='1')return;
   grid.dataset.dragBound='1';
   let drag=null;
   const removeGhost=()=>{
    if(drag?.ghost?.isConnected)drag.ghost.remove();
    if(drag?.placeholder?.isConnected)drag.placeholder.remove();
   };
   const cleanup=(commit)=>{
    if(!drag)return;
    const state=drag;
    document.removeEventListener('pointermove',onMove,true);
    document.removeEventListener('pointerup',onUp,true);
    document.removeEventListener('pointercancel',onCancel,true);
    if(state.dragging){
     if(state.placeholder?.isConnected){
      if(commit)state.placeholder.replaceWith(state.card);
      else state.placeholder.replaceWith(state.card);
     }
     state.card.classList.remove('is-drag-source');
     state.card.style.visibility='';
     state.card.style.pointerEvents='';
     if(commit)syncMealPhotoEditorOrder();
    }else{
     state.card.classList.remove('is-drag-source');
     state.card.style.visibility='';
     state.card.style.pointerEvents='';
    }
    if(state.ghost?.isConnected)state.ghost.remove();
    state.ghost=null;state.placeholder=null;
    drag=null;
   };
   const beginDrag=e=>{
    if(!drag||drag.dragging)return;
    drag.dragging=true;
    if(e.cancelable)e.preventDefault();
    const rect=drag.card.getBoundingClientRect();
    drag.offsetX=e.clientX-rect.left;
    drag.offsetY=e.clientY-rect.top;
    const placeholder=document.createElement('div');
    placeholder.className='meal-photo-drag-placeholder';
    placeholder.style.height=rect.height+'px';
    placeholder.style.width=rect.width+'px';
    placeholder.setAttribute('aria-hidden','true');
    drag.placeholder=placeholder;
    drag.card.replaceWith(placeholder);
    drag.ghost=drag.card.cloneNode(true);
    drag.ghost.classList.remove('is-main','is-drag-source');
    drag.ghost.classList.add('meal-photo-drag-ghost');
    drag.ghost.style.width=rect.width+'px';
    drag.ghost.style.height=rect.height+'px';
    document.body.appendChild(drag.ghost);
    drag.card.classList.add('is-drag-source');
    drag.card.style.visibility='hidden';
    drag.card.style.pointerEvents='none';
    moveGhost(e);
   };
   const moveGhost=e=>{
    if(!drag?.ghost)return;
    drag.ghost.style.left=(e.clientX-drag.offsetX)+'px';
    drag.ghost.style.top=(e.clientY-drag.offsetY)+'px';
   };
   function onMove(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(!drag.dragging){
     if(Math.hypot(dx,dy)<8)return;
     beginDrag(e);
    }
    if(!drag?.dragging)return;
    if(e.cancelable)e.preventDefault();
    moveGhost(e);
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.meal-photo-editor-card');
    if(!target||!grid.contains(target)||target===drag.card)return;
    const rect=target.getBoundingClientRect();
    const midY=rect.top+rect.height/2,midX=rect.left+rect.width/2;
    const before=e.clientY<midY || (Math.abs(e.clientY-midY)<rect.height*.30 && e.clientX<midX);
    const anchor=before?target:target.nextElementSibling;
    if(anchor===drag.placeholder)return;
    if(before && drag.placeholder.nextElementSibling===target)return;
    if(!before && target.nextElementSibling===drag.placeholder)return;
    grid.insertBefore(drag.placeholder,anchor||null);
   }
   function onUp(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    if(drag.dragging&&e.cancelable)e.preventDefault();
    cleanup(true);
   }
   function onCancel(e){
    if(!drag||e.pointerId!==drag.pointerId)return;
    cleanup(true);
   }
   grid.onpointerdown=e=>{
    if(e.isPrimary===false||e.button!=null&&e.button!==0)return;
    if(e.target.closest?.('button'))return;
    const card=e.target.closest?.('.meal-photo-editor-card');
    if(!card||!grid.contains(card))return;
    cleanup(false);
    drag={card,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,dragging:false,ghost:null,placeholder:null,offsetX:0,offsetY:0};
    document.addEventListener('pointermove',onMove,true);
    document.addEventListener('pointerup',onUp,true);
    document.addEventListener('pointercancel',onCancel,true);
   };
  };
  const renderMealPhotos=()=>{
   editorPhotos=dedupeMealPhotos(editorPhotos,8);
   count.textContent=editorPhotos.length+' / 8 photos · touch-drag to reorder · first is Cover';
   grid.innerHTML=editorPhotos.map((src,i)=>'<div class="meal-photo-editor-card '+(i===0?'is-main':'')+'" data-meal-photo-index="'+i+'"><img src="'+esc(imageProxyUrl(src||FINAL_FOOD_IMAGE))+'" alt="'+esc(i===0?'Cover photo':'Meal photo '+(i+1))+'" draggable="false"><div class="meal-photo-editor-card-tools"><span>'+(i===0?'COVER':'PHOTO '+(i+1))+'</span><div><button type="button" class="meal-photo-remove" aria-label="Remove meal photo '+(i+1)+'">×</button></div></div></div>').join('');
   [...grid.querySelectorAll('.meal-photo-editor-card')].forEach((card,i)=>{
    card.__mealPhotoRef=editorPhotos[i];
   });
   grid.querySelectorAll('.meal-photo-remove').forEach(btn=>btn.onclick=e=>{
    e.preventDefault();e.stopPropagation();
    const card=btn.closest('.meal-photo-editor-card'),ref=card?.__mealPhotoRef;
    if(ref){editorPhotos=editorPhotos.filter(photo=>photo!==ref);}else{
     const idx=[...grid.querySelectorAll('.meal-photo-editor-card')].indexOf(card);
     if(idx>=0)editorPhotos.splice(idx,1);
    }
    renderMealPhotos();
   });
   bindMealPhotoEditorDrag();
  };
 editorPhotosReady=hydrateStoredMealPhotoList(item).then(photos=>{editorPhotos=photos.slice(0,8);renderMealPhotos();}).catch(()=>renderMealPhotos());
 renderMealPhotos();
 const ingestMealPhotoFiles=async(fileList)=>{
  try{
   await editorPhotosReady;
   const selected=[...(fileList||[])].filter(file=>file?.type?.startsWith('image/'));
   const room=Math.max(0,8-editorPhotos.length);
   if(!room){appToast('You already have 8 meal photos. Remove one before adding another.');return;}
   const added=await Promise.all(selected.slice(0,room).map(readImageFile));
   const seen=new Set(dedupeMealPhotos(editorPhotos,8)),unique=[];
   for(const raw of added.filter(Boolean)){
    const ref=normalizeMealPhotoRef(raw);if(!ref||seen.has(ref))continue;
    seen.add(ref);unique.push(ref);
    if(editorPhotos.length+unique.length>=8)break;
   }
   editorPhotos=dedupeMealPhotos([...editorPhotos,...unique],8);
   renderMealPhotos();
   appToast(unique.length===1?'Photo added.':unique.length>1?unique.length+' photos added.':'No new photos added.');
  }catch(e){appToast(e.message);}
 };
 mealPhotoFile.onchange=async()=>{
  await ingestMealPhotoFiles(mealPhotoFile.files);
  mealPhotoFile.value='';
 };
}
const renderEditorQuickCuts=focusId=>{
 const host=$('editFoodQuickCuts');if(!host)return;
 const standard=[...FOOD_QUICK,'Other'];
 host.innerHTML=standard.map(label=>'<label class="quick-cut-tile"><input type="checkbox" name="editQuickCut" value="'+esc(label)+'" '+(existingCuts.includes(label)?'checked':'')+'><span>'+esc(label)+'</span></label>').join('');
 host.insertAdjacentHTML('beforeend',(S.customQuickCuts||[]).map(qc=>{
   const name=String(qc?.name||'').trim();if(!name)return '';
   const src=customQuickCutImage(name);
   return '<div class="custom-qc-tile" data-custom-qc-id="'+esc(qc.id)+'"><label class="quick-cut-tile custom-qc-select"><input type="checkbox" name="editQuickCut" value="'+esc(name)+'" '+(existingCuts.includes(name)?'checked':'')+'><span class="custom-qc-photo" style="background-image:url(\''+esc(src)+'\')"></span><span class="custom-qc-label">'+esc(name)+'</span></label><div class="custom-qc-tools"><label class="custom-qc-upload" title="Upload Cuisine Cut photo"><span aria-hidden="true">＋</span><input type="file" accept="image/*" data-custom-qc-file="'+esc(qc.id)+'"></label><input class="custom-qc-rename" type="text" value="'+esc(name)+'" aria-label="Rename '+esc(name)+'" data-custom-qc-rename="'+esc(qc.id)+'"><button type="button" class="custom-qc-delete" data-custom-qc-delete="'+esc(qc.id)+'" aria-label="Delete '+esc(name)+'">×</button></div></div>';
 }).join(''));
 host.insertAdjacentHTML('beforeend','<button type="button" class="quick-cut-custom-add" id="addCustomQuickCut"><span>＋</span><b>Custom</b><small>New box</small></button>');
 host.querySelectorAll('[data-custom-qc-file]').forEach(input=>input.onchange=async()=>{
   const id=input.dataset.customQcFile,qc=(S.customQuickCuts||[]).find(x=>String(x.id)===String(id));if(!qc)return;
   try{const data=await readImageFile(input.files?.[0]);if(!data)return;const storageId='quickcut:'+id;const ok=await putStoredPhoto(storageId,data);if(!ok){appToast('Could not save that Cuisine Cut photo on this device.');return;}qc.image=data;save();foodQuick();renderEditorQuickCuts(id);appToast('Cuisine Cut photo updated.');}catch(e){appToast(e.message);}
 });
 host.querySelectorAll('[data-custom-qc-rename]').forEach(input=>input.onchange=()=>{
   const id=input.dataset.customQcRename,qc=(S.customQuickCuts||[]).find(x=>String(x.id)===String(id));if(!qc)return;
   const old=String(qc.name||'').trim(),next=input.value.trim();
   if(!next){input.value=old;appToast('Give the Custom Cuisine Cut a name.');return;}
   const conflict=[...FOOD_QUICK,'Other',...(S.customQuickCuts||[]).filter(x=>x!==qc).map(x=>x.name)].some(x=>normKey(x)===normKey(next));
   if(conflict){input.value=old;appToast('That Cuisine Cut name is already in use.');return;}
   qc.name=next;
   const selectedIndex=existingCuts.indexOf(old);if(selectedIndex>=0)existingCuts[selectedIndex]=next;
   S.custom.forEach(meal=>{
     if(Array.isArray(meal.quickCuts))meal.quickCuts=meal.quickCuts.map(x=>x===old?next:x);
     if(meal.category===old)meal.category=next;
   });
   if(S.cutCats.has(old)){S.cutCats.delete(old);S.cutCats.add(next);}
   save();buildFood();foodQuick();renderEditorQuickCuts(id);
 });
 host.querySelectorAll('[data-custom-qc-delete]').forEach(btn=>btn.onclick=async()=>{
   const id=btn.dataset.customQcDelete,qc=(S.customQuickCuts||[]).find(x=>String(x.id)===String(id));if(!qc)return;
   const name=String(qc.name||'Custom Cuisine Cut');
   if(!await appConfirm('Delete '+name+'?','This removes the Custom Cuisine Cut from your category list and unassigns it from meals.','Delete Cuisine Cut'))return;
   S.customQuickCuts=S.customQuickCuts.filter(x=>String(x.id)!==String(id));
   const cutIndex=existingCuts.indexOf(name);if(cutIndex>=0)existingCuts.splice(cutIndex,1);
   S.custom.forEach(meal=>{
     if(Array.isArray(meal.quickCuts))meal.quickCuts=meal.quickCuts.filter(x=>x!==name);
     if(meal.category===name)meal.category=meal.quickCuts?.[0]||'Other';
     if(!meal.quickCuts?.length)meal.quickCuts=['Other'];
   });
   S.cutCats.delete(name);
   await deleteStoredPhoto('quickcut:'+id);
   save();buildFood();foodQuick();renderEditorQuickCuts();appToast(name+' deleted.');
 });
 $('addCustomQuickCut').onclick=()=>{
   const taken=new Set([...FOOD_QUICK,'Other',...(S.customQuickCuts||[]).map(x=>String(x.name||''))]);
   let number=(S.customQuickCuts||[]).length+1,name='Custom '+number;
   while(taken.has(name)){number++;name='Custom '+number;}
   const id='custom-qc-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
   S.customQuickCuts.push({id,name,image:''});
   existingCuts.push(name);
   save();renderEditorQuickCuts(id);
   const input=host.querySelector('[data-custom-qc-rename="'+id+'"]');input?.focus();input?.select();
 };
};
renderEditorQuickCuts();
$('foodEditorForm').onsubmit=async e=>{
e.preventDefault();
const name=$('editFoodName').value.trim();
const mealTimes=[...document.querySelectorAll('input[name="editMealTime"]:checked')].map(x=>String(x.value||'').trim()).filter(x=>mealTimeOptions().some(def=>def.name===x));
if(!mealTimes.length){appToast('Choose at least one Meal Time.');return;}
let quickCuts=[...document.querySelectorAll('input[name="editQuickCut"]:checked')].map(x=>x.value);
if(!quickCuts.length){appToast('Choose at least one Cuisine Cut.');return;}
const preferred=item?.category&&quickCuts.includes(item.category)?item.category:quickCuts[0];
quickCuts=[preferred,...quickCuts.filter(x=>x!==preferred)];
const cat=preferred;
const readNumeric=id=>{
const value=$(id).value.trim();
if(!value)return '';
const number=Number(value);
return Number.isFinite(number)&&number>=0?number:'';
};
const nutritionValues={
calories:readNumeric('editFoodCalories'),
protein:readNumeric('editFoodProtein'),
carbs:readNumeric('editFoodCarbs'),
fat:readNumeric('editFoodFat'),
sodium:readNumeric('editFoodSodium')
};
const nutrition={
 calories:nutritionValues.calories===''?0:nutritionValues.calories,
 protein:nutritionValues.protein===''?0:nutritionValues.protein,
 carbs:nutritionValues.carbs===''?0:nutritionValues.carbs,
 fat:nutritionValues.fat===''?0:nutritionValues.fat,
 sodium:nutritionValues.sodium===''?0:nutritionValues.sodium
};
const description=String($('editFoodDescription').value||'').trim();
const ingredients=String($('editFoodIngredients').value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
const editorNote=isEdit?String($('editFoodNote')?.value||'').trim():'';
await editorPhotosReady;
const photoInput=normalizeMealPhotoRef($('editFoodPhoto').value);
const photoInputChanged=photoInput!==initialPhotoInput;
if(photoInputChanged&&photoInput)editorPhotos=dedupeMealPhotos([photoInput,...editorPhotos],8);
else editorPhotos=dedupeMealPhotos(editorPhotos,8);
let photo=editorPhotos[0]||'';
if(!photo&&!isEdit){
 const saveButton=document.querySelector('#foodEditorForm button.cut');
 if(saveButton){saveButton.disabled=true;saveButton.dataset.originalLabel=saveButton.textContent;saveButton.textContent='Finding photo…';}
 photo=await findOnlineMealPhoto(name);
 if(saveButton){saveButton.disabled=false;saveButton.textContent=saveButton.dataset.originalLabel||'Add Meal';}
 if(photo)editorPhotos=[photo];
}
if(!editorPhotos.length)editorPhotos=[photo||DEFAULT_FOOD_IMAGE];
photo=editorPhotos[0];
let recipe=$('editFoodRecipe').value.trim();
if(!name)return;
if(isEdit&&isBuiltInEdit){
 const id=String(item.id),idx=S.custom.findIndex(x=>String(x.id)===id),previous=idx>=0?S.custom[idx]:null;let savedPhotos;
 try{savedPhotos=await storeMealPhotoSet(id,editorPhotos);}catch(err){appToast(err.message);return;}
 const orderedPhotos=dedupeMealPhotos(savedPhotos,8),coverPhoto=orderedPhotos[0]||'';
 const updated={...defaultItem,...(previous||{}),builtInEdit:true,builtInId:id,id,name,primary:defaultItem.primary,category:cat,quickCuts,mealTimes,images:orderedPhotos,image:coverPhoto,description,ingredients,recipe,nutrition};
 if(idx>=0)S.custom[idx]=updated;else S.custom.push(updated);S.maybe.delete(id);S.hidden.delete(id);
} else if(isEdit){
 const idx=S.custom.findIndex(x=>x.id===item.id);if(idx<0)return;const id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 if(id!==item.id&&allFoods().some(x=>x.id===id)){appToast('A meal with that name already exists.');return;}
 let savedPhotos;try{savedPhotos=await storeMealPhotoSet(id,editorPhotos);}catch(err){appToast(err.message);return;}
 if(id!==item.id)await deleteStoredMealPhotos(item.id);
 const orderedPhotos=dedupeMealPhotos(savedPhotos,8),coverPhoto=orderedPhotos[0]||DEFAULT_FOOD_IMAGE;
 const updated={...S.custom[idx],id,name,primary:S.custom[idx].primary,category:cat,quickCuts,mealTimes,images:orderedPhotos,image:coverPhoto,description,ingredients,recipe,nutrition};S.custom[idx]=updated;
 if(id!==item.id){const oldNoteKey='food:'+item.id,newNoteKey='food:'+id;if(S.notes[oldNoteKey]){S.notes[newNoteKey]=S.notes[oldNoteKey];delete S.notes[oldNoteKey];saveItemNotes();}}
 S.maybe.delete(item.id);S.hidden.delete(item.id);
} else {
 const id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');if(allFoods().some(x=>x.id===id)){appToast('A meal with that name already exists.');return;}
 let savedPhotos;try{savedPhotos=await storeMealPhotoSet(id,editorPhotos);}catch(err){appToast(err.message);return;}
 const orderedPhotos=dedupeMealPhotos(savedPhotos,8),coverPhoto=orderedPhotos[0]||DEFAULT_FOOD_IMAGE;
 const added={id,name,primary:id,category:cat,quickCuts,mealTimes,images:orderedPhotos,image:coverPhoto,description,ingredients,recipe};if(nutrition)added.nutrition=nutrition;S.custom.push(added);
}
if(!S.custom.some(x=>Array.isArray(x.quickCuts)&&x.quickCuts.includes('Other')))S.cutCats.delete('Other');
if(isEdit) setItemNote({id:(S.custom.find(x=>x.id===name.toLowerCase().replace(/[^a-z0-9]+/g,'-'))?.id||item?.id),name},'food',editorNote);
buildFood(); foodQuick(); save(); modal.remove(); $('foodEditorModalBg')?.remove();
if(S.screen==='food' && !isEdit){ show('food'); foodQuick(); drawFood(); }
else manageFoodsView();
};
}
function deletedFoodRows(){
 const defaults=getDefaultFoods(),defaultIds=new Set(defaults.map(x=>String(x.id))),overrides=new Map((S.custom||[]).map(x=>[String(x.id),x]));
 const built=defaults.filter(x=>(S.deleted||new Set()).has(String(x.id))).map(item=>{
  const override=overrides.get(String(item.id)),source=override||item;
  return Object.assign({},item,override||{},{builtInEdit:!!override,builtInId:String(item.id),deleted:true,quickCuts:Array.isArray(source.quickCuts)&&source.quickCuts.length?source.quickCuts:[String(source.category||item.category||'American')]});
 });
 const customs=(S.deletedCustomMeals||[]).filter(x=>!defaultIds.has(String(x.id))).map(x=>Object.assign({},x,{deleted:true,quickCuts:Array.isArray(x.quickCuts)&&x.quickCuts.length?x.quickCuts:[x.category||'American']}));
 return built.concat(customs);
}
async function deleteMealFromLibrary(id){
 const row=allFoods().find(x=>String(x.id)===String(id));if(!row)return;
 if(!await appConfirm('Delete '+row.name+'?','This removes the meal from decisions. You can restore it from Deleted Meals; built-in meals can also be recovered with Restore Defaults.','Delete Meal'))return;
 const key=String(id),defaultIds=new Set(getDefaultFoods().map(x=>String(x.id)));
 S.deleted.add(key);S.hidden.delete(key);S.foodCuts.delete(key);S.maybe.delete(key);
 if(!defaultIds.has(key)){
  if(!S.deletedCustomMeals.some(x=>String(x.id)===key))S.deletedCustomMeals.push({...row});
  const idx=S.custom.findIndex(x=>String(x.id)===key);if(idx>=0)S.custom.splice(idx,1);
 }
 buildFood();foodQuick();save();manageFoodsView();
}
function restoreDeletedMeal(id){
 const key=String(id),defaultIds=new Set(getDefaultFoods().map(x=>String(x.id)));
 if(defaultIds.has(key))S.deleted.delete(key);
 else{
  const archived=S.deletedCustomMeals.find(x=>String(x.id)===key);
  if(archived&&!S.custom.some(x=>String(x.id)===key))S.custom.push({...archived});
  S.deletedCustomMeals=S.deletedCustomMeals.filter(x=>String(x.id)!==key);
  S.deleted.delete(key);
 }
 buildFood();foodQuick();save();manageFoodsView();
}
function manageFoodsView() {
 const rows=allFoods(),deletedRows=deletedFoodRows();
 const defaultIds=new Set(getDefaultFoods().map(x=>String(x.id)));
 const rowMarkup=(item,deleted=false)=>{
  const id=String(item.id),hidden=S.hidden.has(id),builtIn=defaultIds.has(id),customRecord=S.custom.find(x=>String(x.id)===id),edited=builtIn&&!!customRecord,customOnly=!builtIn&&!!customRecord;
  const state=deleted?'Deleted':(hidden?'Hidden':'Active');
  const stateLabel=state+(edited?' · Edited':(customOnly?' · Custom':''));
  const mealTimeLabel=mealTimesFor(item).join(' · ');
  const primary=deleted
    ? '<button class="manage-row-action manage-restore" data-food-deleted-restore="'+esc(id)+'">Restore</button>'
    : hidden
      ? '<button class="manage-row-action manage-restore" data-food-restore="'+esc(id)+'">Restore</button>'
      : '<button class="manage-row-action manage-hide" data-food-hide="'+esc(id)+'">Hide</button>';
  const extra=deleted?'':'<button class="manage-row-action manage-edit" data-food-edit="'+esc(id)+'">Edit</button>';
  const deleteAction=deleted?'':'<button class="manage-row-action manage-delete" data-food-delete="'+esc(id)+'">Delete</button>';
  return '<div class="food-row manage-food-row"><span class="manage-food-name"><b>'+esc(item.name)+'</b><small class="row-state '+(deleted?'is-deleted':(hidden?'is-hidden':'is-active'))+'">'+esc(stateLabel)+'</small><small class="row-meal-time">'+esc(mealTimeLabel)+'</small></span><span class="food-row-actions">'+extra+primary+deleteAction+'</span></div>';
 };
 const body='<div class="manage-meals-view"><div class="manage-hero"><span class="manage-kicker">MEAL LIBRARY</span><h4>Shape your choices.</h4><p>Edit any meal, replace its photo, hide it from decisions, or delete it. Deleted meals stay recoverable on this device.</p></div>'+
 '<button class="manage-add-action" id="openFoodEditor" type="button"><span class="manage-add-icon" aria-hidden="true">＋</span><span>Add Meal</span></button>'+
 '<div class="food-list">'+rows.map(x=>rowMarkup(x)).join('')+'</div>'+
 (deletedRows.length?'<section class="deleted-meals-section"><div class="deleted-meals-heading"><span class="manage-kicker">RECOVERY</span><h5>Deleted Meals</h5><p>Restore a deleted meal without changing the rest of your library.</p></div><div class="food-list">'+deletedRows.map(x=>rowMarkup(x,true)).join('')+'</div></section>':'')+
 '</div>';
 const modal=openModal('manageFoodsModal','Manage Meals',body);
 $('openFoodEditor').onclick=()=>foodEditor();
 modal.querySelectorAll('[data-food-restore]').forEach(btn=>btn.onclick=()=>{S.hidden.delete(btn.dataset.foodRestore);buildFood();save();manageFoodsView();});
 modal.querySelectorAll('[data-food-hide]').forEach(btn=>btn.onclick=()=>{S.hidden.add(btn.dataset.foodHide);buildFood();save();manageFoodsView();});
 modal.querySelectorAll('[data-food-edit]').forEach(btn=>btn.onclick=()=>{const row=allFoods().find(x=>String(x.id)===String(btn.dataset.foodEdit));if(row){modal.remove();$('manageFoodsModalBg')?.remove();foodEditor(row);}});
 modal.querySelectorAll('[data-food-delete]').forEach(btn=>btn.onclick=()=>deleteMealFromLibrary(btn.dataset.foodDelete));
 modal.querySelectorAll('[data-food-deleted-restore]').forEach(btn=>btn.onclick=()=>restoreDeletedMeal(btn.dataset.foodDeletedRestore));
}


export { ensureMealTimeSettings, mealTimeCatalog, mealTimeOptions, mealTimeNames, mealTimeDefinition, currentMealTimeName, syncMealTimeReferences, mealTimesFor, mealTimeFor, foodBasePool, foodPool, buildFood, setMaybeDeck, allChoiceRows, choiceDeckRows, maybeDeckRows, maybeDeckCount, allDeckCount, renderMaybeDeckToggle, bindMaybeDeckToggle, renderRestaurantHours, bindRestaurantHours, renderQuickCutsCollapse, bindQuickCutsCollapse, mealTimeFilterNames, normalizeMealTimeFilter, renderMealTimeCuts, bindMealTimeCuts, foodQuick, mealNameSimilarMatches, selectedMealTimesFromEditor, renderFoodEditorMealTimes, renameMealTimeInFoodEditor, addMealTimeInFoodEditor, moveMealTimeInFoodEditor, toggleMealTimeInFoodEditor, foodEditor, deletedFoodRows, restoreDeletedMeal, manageFoodsView };
