'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const raw=fs.readFileSync('data/foods.js','utf8');
const start=raw.indexOf('[');
const end=raw.lastIndexOf(']');
assert(start>=0&&end>start,'foods array found');
const foods=JSON.parse(raw.slice(start,end+1));

assert.equal(foods.length,117,'Meal catalog should contain 117 meals');
const ids=foods.map(x=>x.id);
assert.equal(new Set(ids).size,ids.length,'Meal IDs must be unique');
assert.equal(foods.at(-1).id,'fish-sticks','Fish Sticks must remain the final meal');
assert.equal(foods.filter(x=>x.id==='chocolate-covered-peanuts').length,1,'Chocolate Covered Peanuts should appear once');

const byId=id=>foods.find(x=>x.id===id);
assert.match(byId('meatloaf').image,/images\.unsplash\.com/);
assert.match(byId('southern-vegetable-plate').image,/images\.unsplash\.com/);
assert.match(byId('chicken-dumplings').image,/images\.unsplash\.com/);
assert.match(byId('southern-vegetable-beef-soup').image,/images\.unsplash\.com/);
assert.equal(byId('pbj').image,'https://images.unsplash.com/photo-1632848129232-f816b590e5e3?auto=format&fit=crop&w=1800&q=85','PB&J should retain the verified free Unsplash image');
assert.match(byId('chocolate-covered-peanuts').image,/images\.unsplash\.com/);

assert.match(byId('biscuits-gravy').image,/images\.pexels\.com/,'Do not downgrade Biscuits & Gravy to a weaker generic Unsplash image');
assert.match(byId('white-chicken-chili').image,/images\.pexels\.com/,'Do not downgrade White Chicken Chili to a weaker generic Unsplash image');

assert.equal(foods.at(-2).id,'chocolate-covered-peanuts','Chocolate Covered Peanuts should be immediately before Fish Sticks');
assert.equal(foods.at(-1).id,'fish-sticks');

console.log('CP1245 meal catalog/photo smoke: PASS');
