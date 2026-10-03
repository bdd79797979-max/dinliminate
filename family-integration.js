/* CP845 — Dinner Together visual integration layer.
   The proven Family room/vote backend remains intact; this layer presents shared
   decisions using Dinliminate's normal Meals/Restaurant/Winner surfaces. */
(() => {
'use strict';

const $ = id => document.getElementById(id);
const SESSION_HINT = 'family';
const HISTORY_KEY = 'dinliminate.clean.history';
const DISMISSED_KEY = 'dinliminate.dinnerTogether.dismissed.v1';
const SWIPE_HINT_KEY = 'dinliminate.family.swipeLesson.v1';
const FALLBACK_FOOD = './fallback-food.svg';
const FALLBACK_RESTAURANT = './fallback-restaurant.svg';

let state = null;
let currentRoundId = '';
let currentType = '';
let currentItems = [];
let currentItem = null;
let busy = false;
let lastStage = 0;
let lastWinnerId = '';
let pointerState = null;
let pollTimer = 0;
let observer = null;

function sessionRecord() {
  try {
    for (const key of Object.keys(localStorage)) {
      const raw = localStorage.getItem(key);
      if (!raw || raw.length > 20000) continue;
      let value;
      try { value = JSON.parse(raw); } catch { continue; }
      const token = String(value?.token || '').trim();
      const family = value?.family;
      if (token && family && (family.id || family.joinCode)) return {key,value};
    }
  } catch {}
  return null;
}

function dismissedWinnerId() {
  try { return String(localStorage.getItem(DISMISSED_KEY) || ''); } catch { return ''; }
}
function dismissWinner(id) {
  try { localStorage.setItem(DISMISSED_KEY, String(id || '')); } catch {}
}
function clearDismissedWinner() {
  try { localStorage.removeItem(DISMISSED_KEY); } catch {}
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.toggle('hidden', screen.id !== id);
  });
}
function toast(message) {
  document.querySelector('#dinnerTogetherToast')?.remove();
  const el = document.createElement('div');
  el.id = 'dinnerTogetherToast';
  el.className = 'app-toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}

async function familyApi(action, extra={}) {
  const session = sessionRecord();
  if (!session) throw new Error('Your Dinner Together session is not available.');
  const response = await fetch('./api/family', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    cache:'no-store',
    body:JSON.stringify({action,token:session.value.token,...extra})
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || 'Dinner Together could not complete that request.');
  }
  return data;
}

function restoreFamilySessionPatch(patch) {
  const record = sessionRecord();
  if (!record) return;
  try {
    localStorage.setItem(record.key, JSON.stringify({...record.value,...patch}));
  } catch {}
}

function participants(data) {
  const rows = Array.isArray(data?.roundMembers) && data.roundMembers.length
    ? data.roundMembers.filter(x => x?.included)
    : Array.isArray(data?.members) ? data.members.filter(x => x?.active) : [];
  return rows.length || Number(data?.family?.memberCount) || 0;
}

function stageInfo(round) {
  const stage = Number(round?.currentStage) || 1;
  const voteStage = stage === 1 ? 'initial' : stage === 2 ? 'finalist' : 'tiebreak';
  let pool = Array.isArray(round?.snapshot?.pool) ? round.snapshot.pool : [];
  if (stage === 2 && Array.isArray(round.snapshot.finalists)) {
    const ids = new Set(round.snapshot.finalists.map(String));
    pool = pool.filter(x => x && ids.has(String(x.id)));
  } else if (stage === 3 && Array.isArray(round.snapshot.tiebreakItems)) {
    const ids = new Set(round.snapshot.tiebreakItems.map(String));
    pool = pool.filter(x => x && ids.has(String(x.id)));
  }
  const excluded = new Set(Array.isArray(round?.snapshot?.hostExcluded)
    ? round.snapshot.hostExcluded.map(String) : []);
  pool = pool.filter(x => x?.id && !excluded.has(String(x.id)));
  const voted = new Set((state?.myVotes || [])
    .filter(x => x?.stage === voteStage).map(x => String(x.itemId)));
  return {stage,voteStage,pool,voted};
}

function currentStageItems(round) {
  const info = stageInfo(round);
  return info.pool.filter(x => !info.voted.has(String(x.id)));
}

function stageTotal(round) {
  return stageInfo(round).pool.length;
}

function fullFood(item) {
  const foods = Array.isArray(window.DINLIMINATE_FOODS) ? window.DINLIMINATE_FOODS : [];
  return foods.find(x => String(x?.id) === String(item?.id)) || item || {};
}

function imageWithFallback(img,item,type) {
  if (!img || !item) return;
  const raw = String(item.image || item.photo || item.photoFallback || '').trim();
  const fallback = type === 'restaurant' ? FALLBACK_RESTAURANT : FALLBACK_FOOD;
  img.alt = String(item.name || 'Dinner choice');
  img.loading = 'eager';
  img.referrerPolicy = 'no-referrer';
  img.dataset.rawFamilyImage = raw;
  img.dataset.familyProxyTried = '0';
  img.onerror = () => {
    if (raw && img.dataset.familyProxyTried !== '1' && /^https?:\/\//i.test(raw)) {
      img.dataset.familyProxyTried = '1';
      img.src = './api/image?url=' + encodeURIComponent(raw);
      return;
    }
    img.src = fallback;
  };
  img.src = raw || fallback;
}

function ensureContext(type) {
  const screen = $(type === 'meal' ? 'food' : 'restaurant');
  if (!screen) return;
  let ctx = $('dinnerTogetherContext');
  if (!ctx) {
    ctx = document.createElement('div');
    ctx.id = 'dinnerTogetherContext';
    ctx.className = 'family-decision-context';
    ctx.innerHTML = '<span>DINNER TOGETHER</span><b id="dinnerTogetherProgress"></b><button id="dinnerTogetherLeave" type="button">Leave</button>';
    screen.querySelector('.decision-bar')?.insertAdjacentElement('afterend', ctx);
    $('dinnerTogetherLeave').addEventListener('click', () => leaveDinner());
  } else if (ctx.parentElement !== screen) {
    screen.querySelector('.decision-bar')?.insertAdjacentElement('afterend', ctx);
  }
}

function removeContext() {
  $('dinnerTogetherContext')?.remove();
}

function addSwipeHint(card) {
  if (!card || localStorage.getItem(SWIPE_HINT_KEY)) return;
  if (card.querySelector('.family-card-hint')) return;
  const hint = document.createElement('span');
  hint.className = 'family-card-hint';
  hint.textContent = '← CUT · SWIPE · MAYBE →';
  card.appendChild(hint);
}
function dismissSwipeHint() {
  try { localStorage.setItem(SWIPE_HINT_KEY,'1'); } catch {}
  document.querySelectorAll('.family-card-hint').forEach(x => x.remove());
}

function setProgress(round) {
  const {voteStage} = stageInfo(round);
  const voted = (state?.myVotes || []).filter(x => x?.stage === voteStage).length;
  const total = stageTotal(round);
  const p = $('dinnerTogetherProgress');
  if (p) p.textContent = participants(state) + ' at the table · ' + voted + ' of ' + total;
  return {voted,total};
}

function cleanupNormalOverlay() {
  ['dinnerTogetherWaiting','dinnerTogetherRestaurantWaiting'].forEach(id => $(id)?.remove());
  $('foodStack')?.classList.remove('family-decision-card-hidden');
  $('food .swipe-actions')?.classList.remove('family-decision-actions-hidden');
  $('restStage')?.classList.remove('family-decision-card-hidden');
}

function renderWaiting(type,round) {
  cleanupNormalOverlay();
  const root = type === 'meal'
    ? $('foodStack')?.parentElement
    : $('restStage')?.parentElement;
  if (!root) return;
  const id = type === 'meal' ? 'dinnerTogetherWaiting' : 'dinnerTogetherRestaurantWaiting';
  const wait = document.createElement('div');
  wait.id = id;
  wait.className = 'family-decision-waiting';
  const members = Array.isArray(state?.roundMembers) ? state.roundMembers.filter(x => x.included) : [];
  const stage = Number(round.currentStage) || 1;
  const key = stage === 1 ? 'submittedStage1' : stage === 2 ? 'submittedStage2' : 'submittedTiebreak';
  const finished = members.filter(x => x[key]).length;
  wait.innerHTML = '<span>YOUR PICKS ARE IN</span><b>You’re all set.</b><small></small>';
  wait.querySelector('small').textContent = members.length
    ? finished + ' of ' + members.length + ' finished. We’ll move everyone forward together.'
    : 'Waiting for everyone at the table…';
  root.appendChild(wait);
  if (type === 'meal') {
    $('foodStack')?.classList.add('family-decision-card-hidden');
    $('food .swipe-actions')?.classList.add('family-decision-actions-hidden');
  } else {
    $('restStage')?.classList.add('family-decision-card-hidden');
  }
}

async function submitStageIfNeeded(round,info) {
  const key = String(round.id || '') + ':' + info.voteStage;
  if (currentRoundId === key) return;
  currentRoundId = key;
  try {
    await familyApi('submit-stage',{roundId:round.id,stage:info.voteStage});
    await refresh();
  } catch (error) {
    toast(error.message || 'Could not finish your picks.');
  }
}

function renderMeal(round,items) {
  cleanupNormalOverlay();
  document.querySelector('#food .quick-section')?.classList.add('family-decision-hidden');
  document.querySelector('#food .decision-bar')?.insertAdjacentElement;
  const item = items[0], next = items[1] || null;
  currentItem = item;
  const progress = setProgress(round);
  $('foodCount').textContent = progress.voted + ' of ' + progress.total;
  $('foodName').textContent = String(item.name || 'Choice');
  $('foodCat').textContent = String(item.category || item.cuisine || '');
  imageWithFallback($('foodImg'),item,'meal');
  $('foodNextCard')?.classList.toggle('hidden',!next);
  if (next) imageWithFallback($('foodNextImg'),next,'meal');
  $('foodBack')?.classList.add('hidden');
  addSwipeHint($('foodCard'));
  bindCardInteractions('food');
}

function renderRestaurant(round,items) {
  cleanupNormalOverlay();
  document.querySelector('#restaurant .location-strip')?.classList.add('family-decision-hidden');
  document.querySelector('#restaurant .restaurant-quick-section')?.classList.add('family-decision-hidden');
  const row = items[0], next = items[1] || null;
  currentItem = row;
  const category = String(row?.category || row?.cuisine || 'Restaurant');
  const address = row?.address ? esc(String(row.address).split(',').slice(0,2).join(', ')) : '';
  const distance = Number.isFinite(Number(row?.distance)) ? Number(row.distance).toFixed(1) + ' mi away' : '';
  const meta = [address,distance ? esc(distance) : ''].filter(Boolean).join(' <span aria-hidden="true">•</span> ');
  const details = '<button class="restaurant-card-utility restaurant-card-details-utility" id="restDetails" type="button" aria-label="Details" title="Details"><svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7.25h2M11 7.25h7M6 12h2M11 12h7M6 16.75h2M11 16.75h5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>';
  $('restStage').innerHTML =
    '<div class="restaurant-card-stack"><article class="card next-card '+(next?'':'hidden')+'" id="restaurantNextCard" aria-hidden="true"><img id="dinnerTogetherRestaurantNextImg" alt=""><div class="shade"></div></article><article class="card" id="restaurantCard"><img id="dinnerTogetherRestaurantImg" alt=""><div class="shade"></div><div class="card-copy"><div class="restaurant-card-meta-row"><span class="restaurant-card-meta">'+esc(category)+'</span>'+details+'</div><h3>'+esc(row?.name || '')+'</h3>'+(meta?'<div class="restaurant-card-location-distance">'+meta+'</div>':'')+'</div></article></div><div class="swipe-actions unified-swipe-actions" aria-label="Restaurant decision controls"><button class="round-action round-back secondary hidden" id="restBack" aria-label="Back"><span>↶</span></button><button class="round-action round-cut cut" id="restCut" aria-label="Cut"><span>✕</span></button><button class="round-action round-maybe maybe" id="restMaybe" aria-label="Maybe"><span>♥</span></button><button class="round-action round-choose choose" id="restChoose" aria-label="Choose this restaurant"><span>✓</span></button></div>';
  imageWithFallback($('dinnerTogetherRestaurantImg'),row,'restaurant');
  if (next) imageWithFallback($('dinnerTogetherRestaurantNextImg'),next,'restaurant');
  $('restaurantCount').textContent = setProgress(round).voted + ' of ' + setProgress(round).total;
  addSwipeHint($('restaurantCard'));
  bindCardInteractions('restaurant');
}

function renderIntegrated(round) {
  currentType = round?.decisionType === 'restaurant' ? 'restaurant' : 'meal';
  ensureContext(currentType);
  const items = currentStageItems(round);
  currentItems = items;
  showScreen(currentType === 'restaurant' ? 'restaurant' : 'food');
  document.querySelector('#family')?.classList.add('hidden');
  if (lastStage && lastStage !== Number(round.currentStage)) {
    toast(Number(round.currentStage) >= 3 ? 'One last decision.' : 'A few favorites remain.');
  }
  lastStage = Number(round.currentStage) || 1;
  if (!items.length) {
    renderWaiting(currentType,round);
    submitStageIfNeeded(round,stageInfo(round));
    return;
  }
  if (currentType === 'meal') renderMeal(round,items);
  else renderRestaurant(round,items);
}

async function vote(choice) {
  if (busy || !currentItem || !state?.activeRound) return;
  busy = true;
  dismissSwipeHint();
  const round = state.activeRound;
  const info = stageInfo(round);
  const itemId = String(currentItem.id);
  try {
    const data = await familyApi('vote',{
      roundId:round.id,
      stage:info.voteStage,
      itemId,
      choice
    });
    state = {...state,activeRound:data.round || round,myVotes:[
      ...(state.myVotes || []),
      {stage:info.voteStage,itemId,choice}
    ],roundMembers:data.roundMembers || state.roundMembers};
    currentItem = null;
    renderState(state);
  } catch (error) {
    toast(error.message || 'Could not save that choice.');
  } finally {
    busy = false;
  }
}

function bindCardSwipe(card) {
  if (!card || card.dataset.dinnerSwipeBound === '1') return;
  card.dataset.dinnerSwipeBound = '1';
  const onDown = e => {
    if (!state?.activeRound || e.isPrimary === false) return;
    if (e.button != null && e.button !== 0) return;
    if (e.target?.closest?.('button,a,input,select')) return;
    pointerState = {card,id:e.pointerId,startX:e.clientX,lastX:e.clientX,moved:false};
    card.classList.add('swipe-active');
    card.setPointerCapture?.(e.pointerId);
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onMove = e => {
    if (!pointerState || pointerState.card !== card || e.pointerId !== pointerState.id) return;
    pointerState.lastX=e.clientX;
    const dx=e.clientX-pointerState.startX;
    if (Math.abs(dx)>8) {
      pointerState.moved=true;
      card.style.transform='translate3d('+dx+'px,0,0) rotate('+(dx < 0 ? -3 : 3)+'deg)';
      e.preventDefault();e.stopImmediatePropagation();
    }
  };
  const onUp = e => {
    if (!pointerState || pointerState.card !== card || e.pointerId !== pointerState.id) return;
    const dx=(e.clientX ?? pointerState.lastX)-pointerState.startX;
    card.style.transform='';card.classList.remove('swipe-active');
    pointerState=null;
    e.stopImmediatePropagation();
    if (Math.abs(dx)>=85) vote(dx < 0 ? 'cut' : 'maybe');
  };
  const onCancel = e => {
    if (!pointerState || pointerState.card !== card) return;
    card.style.transform='';card.classList.remove('swipe-active');pointerState=null;e.stopImmediatePropagation();
  };
  card.addEventListener('pointerdown',onDown,{capture:true});
  card.addEventListener('pointermove',onMove,{capture:true});
  card.addEventListener('pointerup',onUp,{capture:true});
  card.addEventListener('pointercancel',onCancel,{capture:true});
}

function bindCardInteractions(type) {
  const card = $(type === 'meal' ? 'foodCard' : 'restaurantCard');
  bindCardSwipe(card);
  const ids = type === 'meal'
    ? [['foodCut','cut'],['foodMaybe','maybe'],['foodChoose','choose']]
    : [['restCut','cut'],['restMaybe','maybe'],['restChoose','choose']];
  ids.forEach(([id,choice]) => {
    const el=$(id);
    if (!el || el.dataset.dinnerActionBound==='1') return;
    el.dataset.dinnerActionBound='1';
    el.addEventListener('click',e=>{
      if (!state?.activeRound) return;
      e.preventDefault();e.stopImmediatePropagation();vote(choice);
    },{capture:true});
  });
  const detail=$(type === 'meal' ? 'foodDetails' : 'restDetails');
  if(detail && detail.dataset.dinnerDetailsBound!=='1'){
    detail.dataset.dinnerDetailsBound='1';
    detail.addEventListener('click',e=>{
      e.preventDefault();e.stopImmediatePropagation();
      if (currentItem) openDetails(currentItem,type);
    },{capture:true});
  }
  const back=$(type === 'meal' ? 'foodBackTop' : 'restaurantBackTop');
  if(back && back.dataset.dinnerBackBound!=='1'){
    back.dataset.dinnerBackBound='1';
    back.addEventListener('click',e=>{
      if(!state?.activeRound) return;
      e.preventDefault();e.stopImmediatePropagation();leaveDinner();
    },{capture:true});
  }
}

function setWinnerImage(item,type) {
  const image=$('winImg');
  if(!image)return;
  imageWithFallback(image,item,type);
  image.classList.remove('hidden');
}

function familyCelebration() {
  const el=$('celebration'); if(!el)return;
  el.innerHTML='';
  el.classList.remove('hidden','family-bridge-celebration');
  el.classList.add('family-bridge-celebration');
  for(let i=0;i<28;i++){
    const p=document.createElement('i');
    const angle=(i/28)*Math.PI*2, distance=70+(i%7)*13;
    p.style.setProperty('--fx',String(Math.cos(angle)*distance)+'px');
    p.style.setProperty('--fy',String(Math.sin(angle)*distance-15)+'px');
    p.style.setProperty('--fr',String((i%2?1:-1)*(40+(i%5)*18))+'deg');
    p.style.animationDelay=(i%7)*18+'ms';
    el.appendChild(p);
  }
}

function familyHistory(item,type,roundId) {
  if(!item || !roundId)return;
  let rows=[];
  try { rows=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); if(!Array.isArray(rows))rows=[]; } catch { rows=[]; }
  if(rows.some(x=>String(x?.familyRoundId||'')===String(roundId)))return;
  const source=type==='food'?fullFood(item):item;
  const now=new Date();
  const date=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  rows.unshift({
    id:String(Date.now())+'-'+Math.random().toString(36).slice(2),
    date,type,name:source.name||item.name||'',
    sourceItemId:type==='food'?(source.id||item.id||''):'',
    image:source.image||source.photo||item.image||item.photo||'',
    photoFallback:type==='restaurant'?(source.photoFallback||item.photoFallback||''):(source.photoFallback||''),
    photoSource:source.photoSource||'',
    googlePlaceId:source.googlePlaceId||'',
    photoIsGeneric:source.photoIsGeneric!==false,
    category:source.category||'',
    cuisine:source.cuisine||'',
    quickCuts:type==='food'&&Array.isArray(source.quickCuts)?source.quickCuts.slice():[],
    mealTimes:type==='food'?(Array.isArray(source.mealTimes)?source.mealTimes.slice():[]):[],
    address:source.address||item.address||'',
    phone:source.phone||source.nationalPhoneNumber||item.phone||'',
    website:source.website||item.website||'',
    opening_hours:source.opening_hours||'',
    hoursState:source.hoursState||'',
    menuItems:Array.isArray(source.menuItems)?source.menuItems.slice(0,10):[],
    lat:Number.isFinite(Number(source.lat??item.lat))?Number(source.lat??item.lat):null,
    lon:Number.isFinite(Number(source.lon??item.lon))?Number(source.lon??item.lon):null,
    distance:Number.isFinite(Number(source.distance??item.distance))?Number(source.distance??item.distance):null,
    familyRoundId:String(roundId),familyMode:true
  });
  try { localStorage.setItem(HISTORY_KEY,JSON.stringify(rows.slice(0,120))); } catch {}
}

function showWinner(round) {
  const item=round?.winnerItem;if(!item)return;
  const id=String(round.id||'');
  if (dismissedWinnerId()===id) { showScreen('family'); removeContext(); return; }
  const changed=lastWinnerId!==id;
  lastWinnerId=id;
  currentRoundId='';
  currentItem=item;
  currentItems=[];
  currentType=round.decisionType==='restaurant'?'restaurant':'meal';
  removeContext();cleanupNormalOverlay();
  showScreen('winner');
  $('winnerEyebrow').textContent='TONIGHT’S DINNER';
  $('winName').textContent=String(item.name||'Dinner is decided');
  $('hungryNote')?.classList.add('hidden');
  $('hungryWheelPanel')?.classList.add('hidden');
  $('hungryRestaurantPanel')?.classList.add('hidden');
  $('winType')?.classList.add('hidden');
  let context=$('familyWinnerContext');
  if(!context){
    context=document.createElement('p');context.id='familyWinnerContext';context.className='family-winner-context';
    $('winName')?.insertAdjacentElement('afterend',context);
  }
  context.textContent='Decided together.';
  context.classList.remove('hidden');
  setWinnerImage(item,currentType);
  $('restart').textContent=state?.me?.role==='host'?'Decide Again':'Back to Dinner';
  if(changed){familyHistory(item,currentType,id);familyCelebration();}
}

function safeUrl(raw,fallbackQuery='') {
  const value=String(raw||'').trim();
  if(/^https?:\/\//i.test(value))return value;
  return fallbackQuery ? 'https://www.google.com/search?q='+encodeURIComponent(fallbackQuery) : '';
}
function phoneUrl(phone) {
  const digits=String(phone||'').replace(/[^\d+]/g,'');
  return digits ? 'tel:'+digits : '';
}

function closeDetails() {
  $('dinnerTogetherDetailsBg')?.remove();$('dinnerTogetherDetails')?.remove();
}
function openDetails(item,type) {
  closeDetails();
  const source=type==='meal'?fullFood(item):item;
  const name=String(source.name||item.name||'Choice');
  const bg=document.createElement('div');bg.id='dinnerTogetherDetailsBg';bg.className='modal-bg';
  const modal=document.createElement('section');modal.id='dinnerTogetherDetails';modal.className='modal details-modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  const rows=[];
  if(type==='meal'){
    if(source.category)rows.push('<div class="detail-info-row"><span>Type</span><strong>'+esc(source.category)+'</strong></div>');
    if(source.cuisine)rows.push('<div class="detail-info-row"><span>Cuisine</span><strong>'+esc(source.cuisine)+'</strong></div>');
    if(source.ingredients)rows.push('<div class="detail-info-row"><span>Ingredients</span><strong>'+esc(Array.isArray(source.ingredients)?source.ingredients.join(', '):source.ingredients)+'</strong></div>');
    if(source.nutrition)rows.push('<div class="detail-info-row"><span>Nutrition</span><strong>'+esc(typeof source.nutrition==='string'?source.nutrition:JSON.stringify(source.nutrition))+'</strong></div>');
  } else {
    if(source.category||source.cuisine)rows.push('<div class="detail-info-row"><span>Type</span><strong>'+esc(source.category||source.cuisine||'Restaurant')+'</strong></div>');
    if(source.address)rows.push('<div class="detail-info-row"><span>Address</span><strong>'+esc(source.address)+'</strong></div>');
    if(source.distance)rows.push('<div class="detail-info-row"><span>Distance</span><strong>'+esc(Number(source.distance).toFixed(1)+' mi away')+'</strong></div>');
    if(source.phone)rows.push('<div class="detail-info-row"><span>Phone</span><strong>'+esc(source.phone)+'</strong></div>');
    if(source.hoursState)rows.push('<div class="detail-info-row"><span>Status</span><strong>'+esc(source.hoursState)+'</strong></div>');
  }
  const action=[];
  if(type==='restaurant'){
    const website=safeUrl(source.website,name);
    const phone=phoneUrl(source.phone||source.nationalPhoneNumber);
    const address=String(source.address||'').trim();
    if(website)action.push('<a class="secondary" target="_blank" rel="noopener" href="'+esc(website)+'">Website</a>');
    if(phone)action.push('<a class="secondary" href="'+esc(phone)+'">Call</a>');
    if(address)action.push('<a class="secondary" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address)+'">Directions</a>');
  }
  modal.innerHTML='<div class="modal-head"><div><span class="family-kicker">DETAILS</span><h3>'+esc(name)+'</h3></div><button class="menu" type="button" id="dinnerTogetherDetailsClose" aria-label="Close details">×</button></div>'+(rows.length?'<div class="family-detail-grid">'+rows.join('')+'</div>':'<p class="drawer-note">Details will appear here when available.</p>')+(action.length?'<div class="family-detail-actions">'+action.join('')+'</div>':'');
  document.body.append(bg,modal);
  $('dinnerTogetherDetailsClose').addEventListener('click',closeDetails);
  bg.addEventListener('click',closeDetails);
}

async function shareWinner(round) {
  const name=String(round?.winnerItem?.name||$('winName')?.textContent||'Tonight’s dinner');
  const text='Tonight’s dinner: '+name+'. Decided together with Dinliminate.';
  try {
    if(navigator.share){await navigator.share({title:'Tonight’s Dinner',text});return;}
    await navigator.clipboard.writeText(text);toast('Winner text copied.');
  } catch {}
}

async function leaveDinner() {
  if(!state?.activeRound){
    showScreen('family');removeContext();return;
  }
  try {
    if(!window.confirm('Leave this dinner?\n\nYour choices are saved, but you’ll miss this one. The dinner will keep going.'))return;
  } catch { return; }
  try { await familyApi('leave-round',{roundId:state.activeRound.id}); } catch {}
  state=null;currentItem=null;currentItems=[];currentType='';busy=false;removeContext();showScreen('family');await refresh();
}

async function decideAgain() {
  const id=String(state?.lastCompletedRound?.id || lastWinnerId || '');
  if(id)dismissWinner(id);
  removeContext();showScreen('family');
  lastWinnerId='';
  await refresh();
  if(state?.me?.role==='host')window.dispatchEvent(new CustomEvent('dinliminate-family-decide-again'));
}

async function dismissWinnerAndReturn() {
  const id=String(lastWinnerId||state?.lastCompletedRound?.id||'');
  if(id)dismissWinner(id);
  lastWinnerId='';currentItem=null;showScreen('family');await refresh();
}

function renderCoordinator(data) {
  const family=data?.family,me=data?.me;
  if(!family||!me)return;
  const host=me.role==='host',count=Number(family.memberCount||0);
  const title=$('familyLobbyTitle'),status=$('familyLobbyStatus');
  if(title){
    title.textContent=host
      ? (count>=2 ? 'Everyone’s here.' : 'Waiting for everyone to join…')
      : 'You’re in.';
  }
  if(status && !data.activeRound){
    status.textContent=host
      ? (count>=2 ? 'Ready to set up dinner.' : 'Share the code when they arrive.')
      : 'Waiting for the host…';
  }
}

function renderState(data) {
  state=data;
  const active=data?.activeRound;
  const completed=data?.lastCompletedRound || (!active && data?.activeRound?.status==='complete' ? data.activeRound : null);
  if(active && ['swiping','final_swiping','tiebreak'].includes(String(active.status))){
    renderIntegrated(active);
    return;
  }
  if(completed?.status==='complete' && completed?.winnerItem){
    showWinner(completed);
    return;
  }
  currentItems=[];currentItem=null;currentType='';removeContext();cleanupNormalOverlay();showScreen('family');renderCoordinator(data);
}

async function refresh() {
  const session=sessionRecord();
  if(!session?.value?.token)return;
  try {
    const data=await familyApi('state');
    renderState(data);
  } catch (error) {
    if(/session|active|unauthorized/i.test(String(error?.message||'')))toast(error.message||'Dinner Together session unavailable.');
  }
}

function installBridgeObservers() {
  if(observer)return;
  observer=new MutationObserver(() => {
    if(state?.activeRound && ['swiping','final_swiping','tiebreak'].includes(String(state.activeRound.status))){
      const visible=document.querySelector('#food:not(.hidden),#restaurant:not(.hidden)');
      if(!visible)renderIntegrated(state.activeRound);
    } else if(state?.lastCompletedRound?.winnerItem && !document.querySelector('#winner:not(.hidden)') && dismissedWinnerId()!==String(state.lastCompletedRound.id||'')){
      showWinner(state.lastCompletedRound);
    }
  });
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
}

document.addEventListener('click',e => {
  const id=e.target?.closest?.('#familyStart')?.id;
  if(id){e.preventDefault();e.stopImmediatePropagation();$('familyMode')?.click();return;}
  const help=e.target?.closest?.('#familyHelp');
  if(help){e.preventDefault();e.stopImmediatePropagation();openHelp();return;}
  const winnerDetail=e.target?.closest?.('#details');
  if(winnerDetail && lastWinnerId && state?.lastCompletedRound?.winnerItem){e.preventDefault();e.stopImmediatePropagation();openDetails(state.lastCompletedRound.winnerItem,currentType);return;}
  const winnerShare=e.target?.closest?.('#share');
  if(winnerShare && lastWinnerId && state?.lastCompletedRound){e.preventDefault();e.stopImmediatePropagation();shareWinner(state.lastCompletedRound);return;}
  const winnerAgain=e.target?.closest?.('#restart');
  if(winnerAgain && lastWinnerId){e.preventDefault();e.stopImmediatePropagation();decideAgain();return;}
  const winnerBack=e.target?.closest?.('#winnerBackTop');
  if(winnerBack && lastWinnerId){e.preventDefault();e.stopImmediatePropagation();dismissWinnerAndReturn();return;}
},{capture:true});

function openHelp() {
  document.querySelector('#dinnerTogetherHelpBg')?.remove();document.querySelector('#dinnerTogetherHelp')?.remove();
  const bg=document.createElement('div');bg.id='dinnerTogetherHelpBg';bg.className='modal-bg';
  const modal=document.createElement('section');modal.id='dinnerTogetherHelp';modal.className='modal';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
  modal.innerHTML='<div class="modal-head"><div><span class="family-kicker">DINNER TOGETHER</span><h3>How it works</h3></div><button class="menu" type="button" id="dinnerTogetherHelpClose" aria-label="Close">×</button></div><div class="family-help-sheet"><p><b>1 — Create or Join</b><span>The host creates a dinner and shares the code.</span></p><p><b>2 — Pick the choices</b><span>Choose Meals or Restaurants.</span></p><p><b>3 — Everyone swipes</b><span><strong>← Cut</strong> what you don’t want. <strong>→ Maybe</strong> keeps it in play.</span></p><p><b>4 — Dinliminate narrows it down</b><span>Everyone’s choices are combined automatically.</span></p><p><b>5 — Reveal</b><span>One dinner is chosen together.</span></p><small class="family-help-footer">No accounts. Just join and decide.</small></div>';
  document.body.append(bg,modal);
  $('dinnerTogetherHelpClose').addEventListener('click',()=>{bg.remove();modal.remove()});
  bg.addEventListener('click',()=>{bg.remove();modal.remove()});
}

function boot() {
  $('familyStart')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();$('familyMode')?.click()},{capture:true});
  $('familyHelp')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openHelp()},{capture:true});
  installBridgeObservers();
  refresh();
  clearInterval(pollTimer);
  pollTimer=setInterval(refresh,2800);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
else boot();

})();
