import { state as S } from '../../state/store.js';
import { $ } from '../../ui/dom.js';
import { esc } from '../../ui/esc.js';
import { imageProxyUrl, mealImageUrl, bindImageFallback, hydrateRestaurantPhoto, HUNGRY_IMAGE, FINAL_RESTAURANT_IMAGE } from '../../main.js';
import { mealTimesFor } from '../meals/index.js';
import { restaurantFallbackImage, restaurantCategory } from '../restaurants/index.js';


const HISTORY_KEY = 'dinliminate.clean.history';
function historyImageSource(row){
 const fallback=row?.type==='restaurant'?restaurantFallbackImage(row):HUNGRY_IMAGE;
 return row?.type==='restaurant'
  ? imageProxyUrl(row?.image||row?.photoFallback||fallback)
  : mealImageUrl(row?.image||row?.photoFallback||fallback);
}
function recordHistory(item, type, options={}) {
const history = readHistory();
const familyRoundId=String(options.familyRoundId||'').trim();
if(familyRoundId && history.some(x=>String(x?.familyRoundId||'')===familyRoundId)) return false;
history.unshift({
id:String(Date.now())+'-'+Math.random().toString(36).slice(2),
date:(() => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })(),
type,
name:item.name,
sourceItemId:type==='food'?(item.id||''):'',
image:item.image||item.photo||'',
photoFallback:type==='restaurant'?(item.photoFallback||restaurantFallbackImage(item)):(item.photoFallback||''),
photoSource:item.photoSource||'',
googlePlaceId:item.googlePlaceId||'',
photoIsGeneric:item.photoIsGeneric!==false,
category:item.category||restaurantCategory(item),
cuisine:item.cuisine||'',
quickCuts:type==='food'&&Array.isArray(item.quickCuts)?item.quickCuts.slice():[],
mealTimes:type==='food'?mealTimesFor(item):[],
address:item.address||'',
phone:item.phone||item.nationalPhoneNumber||'',
website:item.website||'',
opening_hours:item.opening_hours||'',
hoursState:item.hoursState||'',
menuItems:Array.isArray(item.menuItems)?item.menuItems.slice(0,10):[],
lat:Number.isFinite(Number(item.lat))?Number(item.lat):null,
lon:Number.isFinite(Number(item.lon))?Number(item.lon):null,
distance:Number.isFinite(Number(item.distance))?Number(item.distance):null,
familyRoundId:familyRoundId||null,
familyMode:!!options.familyMode
});
writeHistory(history);
return true;
}
function readHistory() {
try {
 const parsed=JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
 return Array.isArray(parsed) ? parsed.filter(row=>row&&typeof row==='object').slice(0,120) : [];
} catch { return []; }
}
function writeHistory(rows) {
try {
localStorage.setItem(HISTORY_KEY, JSON.stringify((rows||[]).slice(0,120)));
S.storageWarning=false; updateStorageIndicator();
return true;
} catch {
S.storageWarning=true; updateStorageIndicator();
return false;
}
}
function historyView() {
let cursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let modal = null;
let bodyHost = null;
const render = () => {
const history = readHistory();
const y = cursor.getFullYear(), m = cursor.getMonth();
const first = new Date(y,m,1).getDay(), last = new Date(y,m+1,0).getDate();
const today = new Date();
const todayKey = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
const mealCount=history.filter(x=>x?.type==='food').length;
const restaurantCount=history.filter(x=>x?.type==='restaurant').length;
const totalCount=history.length;
const tallyChosen=(type)=>{
 const counts=new Map();
 history.filter(x=>x?.type===type).forEach(x=>{
   const name=String(x?.name||'').trim();
   if(name)counts.set(name,(counts.get(name)||0)+1);
 });
 return [...counts.entries()]
   .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
   .slice(0,5);
};
const chosenMeals=tallyChosen('food');
const chosenRestaurants=tallyChosen('restaurant');
const choiceRows=(rows,emptyLabel)=>rows.length
 ? rows.map(([name,count],index)=>'<div class="history-choice-row"><span class="history-choice-rank">'+(index+1)+'</span><span class="history-choice-name">'+esc(name)+'</span><b class="history-choice-count">'+count+'×</b></div>').join('')
 : '<p class="history-stats-empty">'+emptyLabel+'</p>';
const statsMarkup='<section class="history-stats hidden" id="historyStats" aria-label="Your stats">'+
'<div class="history-stats-head"><div><span class="history-stats-kicker">YOUR STATS</span><b>What you choose most</b></div><span class="history-stats-note">'+totalCount+' decision'+(totalCount===1?'':'s')+'</span></div>'+
'<div class="history-stats-totals"><span>'+mealCount+' meal'+(mealCount===1?'':'s')+'</span><span>'+restaurantCount+' restaurant'+(restaurantCount===1?'':'s')+'</span></div>'+
'<div class="history-choice-section"><div class="history-choice-title">Meals chosen most</div><div class="history-choice-list">'+choiceRows(chosenMeals,'No meals chosen yet.')+'</div></div>'+
'<div class="history-choice-section"><div class="history-choice-title">Restaurants chosen most</div><div class="history-choice-list">'+choiceRows(chosenRestaurants,'No restaurants chosen yet.')+'</div></div>'+
'</section>';
let body = '<div class="history-intro"><div class="history-intro-copy"><span class="history-kicker">YOUR DECISIONS</span><h4>History</h4><p>Browse previous meal and restaurant choices by date.</p></div><button class="history-stats-toggle" id="historyStatsToggle" type="button" aria-expanded="false">Your Stats</button></div>'+statsMarkup+'<div class="history-calendar"><div class="cal-nav"><button class="text-btn" id="calPrev" aria-label="Previous month">‹</button><b>'+cursor.toLocaleString(undefined,{month:'long',year:'numeric'})+'</b><button class="text-btn" id="calNext" aria-label="Next month">›</button></div><div class="cal-grid cal-grid-20" role="grid" aria-label="'+cursor.toLocaleString(undefined,{month:'long',year:'numeric'})+' history">'; 
['S','M','T','W','T','F','S'].forEach(d => body += '<span class="cal-d" role="columnheader">'+d+'</span>');
for(let i=0;i<first;i++) body += '<span class="cal-empty" aria-hidden="true"></span>';
for(let day=1;day<=last;day++) {
const key = y+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
const entries = history.filter(x => x.date === key);
const todayClass = key===todayKey ? ' today' : '';
const limited = entries.slice(0,2);
const more = entries.length>2 ? '<span class="cal-more">+'+(entries.length-2)+'</span>' : '';
let dayMarkup;
if(limited.length===0){
  dayMarkup = '<div class="cal-day"><b>'+day+'</b></div>';
} else if(limited.length===1){
  const entry=limited[0];
  dayMarkup = '<div class="cal-day has single"><span class="cal-date-chip">'+day+'</span><div class="cal-photo-wrap"><button class="cal-photo-link" data-history-date="'+esc(entry.id)+'" aria-label="View '+esc(entry.name)+' from '+esc(key)+'"><img src="'+esc(historyImageSource(entry))+'" data-no-generic-fallback="'+(entry.type==='restaurant'?'1':'0')+'" data-restaurant-photo-key="'+esc(entry.type==='restaurant'?entry.id:'')+'" data-final-fallback="'+(entry.type==='restaurant'?FINAL_RESTAURANT_IMAGE:HUNGRY_IMAGE)+'" alt="'+esc(entry.name)+'"><span class="cal-photo-kind">'+(entry.type==='restaurant'?'Restaurant':'Food')+'</span></button><button class="cal-entry-x" data-history-delete="'+esc(entry.id)+'" aria-label="Remove '+esc(entry.name)+' from '+esc(key)+'">×</button></div></div>';
} else {
  dayMarkup = '<div class="cal-day has dual" aria-label="'+entries.length+' history entries on '+esc(key)+'"><span class="cal-date-chip">'+day+'</span>'+limited.map(entry=>'<div class="cal-photo-wrap"><button class="cal-photo-link" data-history-date="'+esc(entry.id)+'" aria-label="View '+esc(entry.name)+' from '+esc(key)+'"><img src="'+esc(historyImageSource(entry))+'" data-restaurant-photo-key="'+esc(entry.type==='restaurant'?entry.id:'')+'" data-final-fallback="'+(entry.type==='restaurant'?FINAL_RESTAURANT_IMAGE:HUNGRY_IMAGE)+'" alt="'+esc(entry.name)+'"><span class="cal-photo-kind">'+(entry.type==='restaurant'?'Restaurant':'Food')+'</span></button><button class="cal-entry-x" data-history-delete="'+esc(entry.id)+'" aria-label="Remove '+esc(entry.name)+' from '+esc(key)+'">×</button></div>').join('')+more+'</div>';
}
body += '<div class="cal-cell'+todayClass+'" role="gridcell">'+dayMarkup+'</div>';
}
body += '</div></div><div class="history-list">';
body += history.length ? '<div class="history-toolbar"><span class="status">'+history.length+' saved decision'+(history.length===1?'':'s')+'</span><button class="secondary" id="historyClearAll" type="button">Clear all</button></div>'+history.slice(0,30).map(x => '<button class="history-row history-open" data-history-id="'+esc(x.id)+'"><img src="'+esc(historyImageSource(x))+'" data-restaurant-photo-key="'+esc(x.type==='restaurant'?x.id:'')+'" data-final-fallback="'+(x.type==='restaurant'?FINAL_RESTAURANT_IMAGE:HUNGRY_IMAGE)+'" alt="'+esc(x.name)+'"><span><b>'+esc(x.name)+'</b><small>'+esc(x.date)+' · '+esc(x.type)+(x.type==='food'&&Array.isArray(x.mealTimes)&&x.mealTimes.length?' · '+esc(x.mealTimes.join(' · ')):'')+'</small></span></button>').join('') : '<p class="status">No history yet.</p>';
body += '</div>';
if(!modal||!modal.isConnected){
  modal = openModal('historyModal','History','<div id="historyModalBody"></div>');
  bodyHost = modal.querySelector('#historyModalBody');
}
if(!bodyHost)return;
bodyHost.innerHTML=body;
modal.scrollTop=0;
bindImageFallback('#historyModal img',FINAL_RESTAURANT_IMAGE,FINAL_RESTAURANT_IMAGE);
for(const row of history.slice(0,30)) if(row?.type==='restaurant'&&row?.id) hydrateRestaurantPhoto(row,'#historyModal');
$('historyStatsToggle').onclick=()=>{
  const panel=$('historyStats'),btn=$('historyStatsToggle'); if(!panel||!btn)return;
  const isHidden=panel.classList.toggle('hidden');
  btn.setAttribute('aria-expanded',String(!isHidden));
  btn.textContent=isHidden?'Your Stats':'Hide Stats';
};
$('calPrev').onclick = () => { cursor = new Date(y,m-1,1); render(); };
$('calNext').onclick = () => { cursor = new Date(y,m+1,1); render(); };
modal.querySelectorAll('[data-history-id]').forEach(btn => btn.onclick = () => {
const row = history.find(x => x.id === btn.dataset.historyId);
if (row) detailsSheet(row, row.type);
});
modal.querySelectorAll('[data-history-date]').forEach(btn => btn.onclick = () => {
const row = history.find(x => x.id === btn.dataset.historyDate);
if (row) detailsSheet(row, row.type);
});
if(history.length){
$('historyClearAll').onclick=async()=>{
if(!await appConfirm('Clear history?','This permanently removes all saved meal and restaurant decisions from this device.','Clear History'))return;
writeHistory([]);
render();
};
}
modal.querySelectorAll('[data-history-delete]').forEach(btn => {
const remove = (e) => {
e.preventDefault(); e.stopPropagation();
writeHistory(history.filter(x => x.id !== btn.dataset.historyDelete));
render();
};
btn.onclick = remove;
btn.onpointerdown = (e) => e.stopPropagation();
});
};
render();
}function readImageFile(file) {
return new Promise((resolve,reject) => {
if (!file) return resolve('');
if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
const reader = new FileReader();
reader.onerror = () => reject(new Error('Could not read that image.'));
reader.onload = () => {
const img = new Image();
img.onload = () => {
const max=1200, scale=Math.min(1,max/Math.max(img.width,img.height));
const canvas=document.createElement('canvas');
canvas.width=Math.max(1,Math.round(img.width*scale));
canvas.height=Math.max(1,Math.round(img.height*scale));
const ctx=canvas.getContext('2d');
ctx.drawImage(img,0,0,canvas.width,canvas.height);
resolve(canvas.toDataURL('image/jpeg',0.82));
};
img.onerror=()=>reject(new Error('Could not decode that image.'));
img.src=reader.result;
};
reader.readAsDataURL(file);
});
}


export { historyImageSource, recordHistory, readHistory, writeHistory, historyView, HISTORY_KEY };

import { openModal, detailsSheet } from '../../ui/modal.js';
