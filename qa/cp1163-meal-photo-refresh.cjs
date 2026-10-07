'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const foodsSource=fs.readFileSync('data/foods.js','utf8');
const appSource=fs.readFileSync('app.js','utf8');
new Function(foodsSource);
new Function(appSource);

const rhs=foodsSource.slice(foodsSource.indexOf('=')+1).replace(/;\s*$/,'');
const foods=JSON.parse(rhs);

const requested=[
 'southern-vegetable-plate','meatloaf','salisbury-steak','stuffed-peppers','goulash',
 'southern-vegetable-beef-soup','chicken-dumplings','biscuits-gravy','buttermilk-cornbread',
 'sloppy-joes','cabbage','steak-potato','meatball-subs','tuna-melt','pbj','pot-pie','blt',
 'reuben','gumbo','pimento-cheese-sandwich','protein-bar','ham-dinner','liver-and-onions',
 'pinto-beans-cornbread','clam-chowder','honey-buns-little-debbie'
];

const byId=new Map(foods.map(item=>[String(item.id),item]));
for(const id of requested){
 assert(byId.has(id),'requested meal remains in catalog: '+id);
 const item=byId.get(id);
 const image=String(item.image||'');
 assert(/^https:\/\/images\.(pexels\.com|unsplash\.com)\//.test(image),'approved image host for '+id);
 assert(image.length>0,'primary image exists for '+id);
}

assert(!byId.has('chili-cheese-baked-potato'),'retired Chili Cheese Baked Potato is removed from built-in catalog');

// These were the clearly mismatched/reused photos replaced in this checkpoint.
const expectedRefs={
 'meatloaf':'photos/2397401/pexels-photo-2397401.jpeg',
 'stuffed-peppers':'photos/22698511/pexels-photo-22698511.jpeg',
 'goulash':'photos/38441086/pexels-photo-38441086.jpeg',
 'sloppy-joes':'photos/6358875/pexels-photo-6358875.jpeg',
 'steak-potato':'photos/5638543/pexels-photo-5638543.jpeg',
 'meatball-subs':'photos/39285888/pexels-photo-39285888.jpeg',
 'pot-pie':'photos/29535632/pexels-photo-29535632.jpeg',
 'liver-and-onions':'photos/8878358/pexels-photo-8878358.jpeg',
 'pinto-beans-cornbread':'photos/6316673/pexels-photo-6316673.jpeg'
};
for(const [id,ref] of Object.entries(expectedRefs)){
 assert(byId.get(id).image.includes(ref),'refreshed image is not the expected approved candidate for '+id);
}

assert.notEqual(byId.get('meatball-subs').image,byId.get('sloppy-joes').image,'meatball sub must not reuse sloppy joe photo');
assert.notEqual(byId.get('liver-and-onions').image,byId.get('steak-potato').image,'liver & onions must not reuse steak photo');
assert.notEqual(byId.get('pinto-beans-cornbread').image,'https://images.pexels.com/photos/6995300/pexels-photo-6995300.jpeg?auto=compress&cs=tinysrgb&w=1600','pinto beans must not use generic meal-prep photo');

assert.match(appSource,/const RETIRED_BUILTIN_MEAL_IDS = new Set\(\['chili-cheese-baked-potato'\]\)/);
assert.match(appSource,/S\.custom=filterRetiredMeals\(S\.custom\)/);
assert.match(appSource,/S\.pool=filterRetiredMeals\(Array\.isArray\(S\.pool\)\?S\.pool:\[\]\)/);

console.log('CP1163 meal photo refresh + retired meal cleanup smoke: PASS');
