'use strict';

const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');

function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}

function ordered(ids){
 const positions=ids.map(id=>index.indexOf('id="'+id+'"'));
 return positions.every((pos,i)=>pos>=0&&(i===0||pos>positions[i-1]));
}

assert('meal controls are Back / Cut / Maybe / Choose',
 ordered(['foodBack','foodCut','foodMaybe','foodChoose'])
);
const drawRestaurants=between(app,'async function drawRestaurants() {','\\nasync function restaurantCut');
assert('restaurant controls are Back / Cut / Maybe / Choose',
 ['restBack','restCut','restMaybe','restChoose'].every(id=>drawRestaurants.includes('id="'+id+'"')) &&
 drawRestaurants.indexOf('id="restBack"')<drawRestaurants.indexOf('id="restCut"')&&
 drawRestaurants.indexOf('id="restCut"')<drawRestaurants.indexOf('id="restMaybe"')&&
 drawRestaurants.indexOf('id="restMaybe"')<drawRestaurants.indexOf('id="restChoose"')
);
assert('meal and restaurant actions use one unified control class',
 index.includes('class="swipe-actions unified-swipe-actions"')&&
 app.includes("bindCardButton('foodCut'")&&app.includes("bindCardButton('restCut'")
);
assert('restaurant details remains a card utility',
 app.includes("bindCardButton('restDetails', () => detailsSheet(current,'restaurant'))")
);
const swipeStart=app.indexOf('function bindSwipeCard(cardId,nextId,onCut,onMaybe) {');
const swipeEnd=app.indexOf('function bindRestaurantSwipe',swipeStart);
const swipe=app.slice(swipeStart,swipeEnd);
assert('active swipe only translates/rotates',
 swipe.includes("translate3d('+dx.toFixed(1)+'px,0,0) rotate(")&&
 !swipe.includes("card.style.transform='scale(")
);
assert('waiting card is not resized during active swipe',
 swipe.includes("next.style.transform=staticWaitingCard?'none':'scale(1)'")
);
assert('button activation has repeat-fire guard',
 app.includes('const last=Number(el.__dinliminateLastActivation)||0;')&&
 app.includes('if(now-last<180)return;')
);
assert('first swipe hint is in the card DOM',
 app.includes('card.appendChild(coach)')&&app.includes('← CUT')&&app.includes('MAYBE →')
);
assert('All / Maybes control is shared',
 app.includes('function renderMaybeDeckToggle(kind)')&&
 index.includes('id="foodMaybeDeck"')&&index.includes('id="restaurantMaybeDeck"')&&
 app.includes('canonical-maybe-control')
);
assert('count stays text-only',
 app.includes('maybe-control-count')&&app.includes('setChoiceCount')
);
assert('search diagnosis understands target changes',
 app.includes('const searchTargetGuard=searchSource.includes')&&
 app.includes('replacingSearchTarget=!!previousSearchKey&&previousSearchKey!==searchKey')
);
assert('CP1081 cache versions are synchronized',
 index.includes('./app.js?v=1081')&&sw.includes('dinliminate-shell-v1081')&&sw.includes('./app.js?v=1081')
);

console.log(JSON.stringify({
 ok:true,
 controls:'Back / Cut / Maybe / Choose',
 activeSwipe:'translate/rotate only',
 waitingCard:'fixed size',
 hint:'inside active card',
 allMaybe:'shared text control',
 cacheVersion:1081
},null,2));
