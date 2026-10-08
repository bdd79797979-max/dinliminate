const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('app.js','utf8');

function extract(startMarker,endMarker){
 const start=source.indexOf(startMarker);
 const end=source.indexOf(endMarker,start);
 assert.ok(start>=0,'missing '+startMarker);
 assert.ok(end>start,'missing end marker '+endMarker);
 return source.slice(start,end);
}

const captureFoodSrc=extract('function captureFoodDecisionState(){','function captureRestaurantDecisionState');
const captureRestSrc=extract('function captureRestaurantDecisionState(){','function mealItemLookup');
const restoreFoodSrc=extract('function restoreFoodDecisionState(state){','function restoreRestaurantDecisionState');
const restoreRestSrc=extract('function restoreRestaurantDecisionState(state){','function legacyFoodBack');

const S={
 pool:[
  {id:'a',name:'Alpha'},
  {id:'b',name:'Bravo'},
  {id:'c',name:'Charlie'}
 ],
 index:0,
 foodCuts:new Set(),
 maybe:new Set(),
 maybeDeck:false,
 foodMaybeRound:false,
 cutCats:new Set(),
 mealTimeFilters:new Set(['Breakfast','Lunch / Dinner','Snacks / Desserts']),
 quickCutsCollapsed:{food:true,restaurant:true},
 mealTimeCutsCollapsed:true,
 restaurantPool:[
  {id:'r1',name:'Alpha Grill',_maybe:false,_cut:false,_hidden:false},
  {id:'r2',name:'Bravo BBQ',_maybe:false,_cut:false,_hidden:false},
  {id:'r3',name:'Charlie Pizza',_maybe:false,_cut:false,_hidden:false}
 ],
 restaurantIndex:0,
 restaurantCuts:new Set(),
 restaurantMaybeDeck:false,
 maybeDeck:false,
 restaurantMaybeRound:false,
 restaurantQuery:'',
 restaurantHours:'all',
 restaurantHoursCollapsed:true,
 restaurantSearchRadius:10,
 restaurantSearchKey:'10:test',
 restaurantSearchQuery:'',
 restaurantSearchOrigin:{lat:36.5,lon:-87.3},
 restaurantSearchTimeZone:'America/Chicago',
 restaurantSearchDegraded:false
};

const catalog=new Map(S.pool.map(x=>[x.id,{...x}]));
const mealCapture=new Function('S',captureFoodSrc+'; return captureFoodDecisionState;')(S);
const mealRestore=new Function('S','mealItemLookup','mealTimeNames',restoreFoodSrc+'; return restoreFoodDecisionState;')(
 S,
 ()=>new Map(catalog),
 ()=>['Breakfast','Lunch / Dinner','Snacks / Desserts']
);
const restCapture=new Function('S',captureRestSrc+'; return captureRestaurantDecisionState;')(S);
const restRows=()=>S.restaurantPool;
const restRestore=new Function('S','restaurantPoolFiltered',restoreRestSrc+'; return restoreRestaurantDecisionState;')(S,restRows);

const beforeMeal=mealCapture();
S.pool=[S.pool[1],S.pool[2]];
S.index=0;
S.maybe=new Set(['b']);
S.foodCuts=new Set(['a']);
S.foodMaybeRound=true;
assert.equal(mealRestore(beforeMeal),true);
assert.deepEqual(S.pool.map(x=>x.id),['a','b','c']);
assert.equal(S.index,0);
assert.deepEqual([...S.maybe],[]);
assert.deepEqual([...S.foodCuts],[]);
assert.equal(S.foodMaybeRound,false);
console.log('Meal snapshot restore: PASS');

const beforeRest=restCapture();
S.restaurantPool[0]._cut=true;
S.restaurantPool[1]._maybe=true;
S.restaurantIndex=2;
assert.equal(restRestore(beforeRest),true);
assert.deepEqual(S.restaurantPool.map(x=>x.id),['r1','r2','r3']);
assert.equal(S.restaurantIndex,0);
assert.equal(S.restaurantPool[0]._cut,false);
assert.equal(S.restaurantPool[1]._maybe,false);
assert.equal(S.restaurantRestoreExact,true);
console.log('Restaurant snapshot restore: PASS');

assert.match(source,/if\(prepared\.firstId&&!restoreExact\)\{/,'restaurant photo preparation must not overwrite exact Back restore');
assert.match(source,/const restoreExact=!!S\.foodRestoreExact;/,'food exact-restore flag missing');
assert.match(source,/const restoreExact=!!S\.restaurantRestoreExact;/,'restaurant exact-restore flag missing');
assert.match(source,/if\(kind==='food'\)\{S\.foodHistory=\[\];S\.foodActions=\[\];/,'meal context reset must clear stale actions');
assert.match(source,/if\(phase!=='idle'\)return 'busy';/,'swipe transaction busy outcome missing');
assert.match(source,/return 'accepted';/,'swipe transaction accepted outcome missing');
console.log('CP1262 structural safeguards: PASS');
