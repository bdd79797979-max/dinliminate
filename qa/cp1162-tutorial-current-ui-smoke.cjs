'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
new Function(app);
new Function(app.slice(app.indexOf('function tutorialStepsForScreen'),app.indexOf('\nfunction tutorialUnionRect')));

const tutorialStart=app.indexOf('function tutorialStepsForScreen(screen){');
const tutorialEnd=app.indexOf('\nfunction tutorialUnionRect',tutorialStart);
assert(tutorialStart>=0&&tutorialEnd>tutorialStart,'tutorial step function found');
const tutorial=app.slice(tutorialStart,tutorialEnd);

for(const selector of [
  '#home .home-choice-rail','#home .home-foot',
  '#foodCard','#foodCut','#foodMaybe','#foodBack','#foodChoose','#foodDetails',
  '#foodMealTimeToggle','#foodQuickToggle','#foodMaybeDeck','#foodMenu',
  '#locate','#address','#find','#radius','#restaurantCard','#restCut','#restMaybe','#restBack','#restChoose',
  '#restaurantSearchToggle','#restaurantQuickToggle','#restaurantHoursToggle','#restaurantMaybeDeck','#restaurantMenu',
  '#details','#share','#restart'
]){
  const id=selector.match(/^#([A-Za-z0-9_-]+)$/)?.[1];
  if(id) assert(html.includes('id="'+id+'"'), 'HTML id exists: '+id);
}

assert.match(tutorial,/title:'MEAL CARD'/);
assert.match(tutorial,/title:'MEAL TIMES'/);
assert.match(tutorial,/title:'CUISINE'/);
assert.match(tutorial,/title:'ALL · MAYBES · COUNT'/);
assert.match(tutorial,/title:'OPEN NOW'/);
assert.match(tutorial,/title:'NEXT: RESTAURANTS'/);
assert.match(tutorial,/title:'NEXT: MEALS'/);
assert.match(tutorial,/title:'WINNER DETAILS'/);
assert.doesNotMatch(tutorial,/title:'ENTER RESTAURANT'/);
assert.doesNotMatch(tutorial,/title:'ENTER MEALS'/);
assert.doesNotMatch(tutorial,/target:'#foodMenu',title:'Menu',body:'This opens the app menu\.'/);

console.log('CP1162 tutorial current-UI smoke: PASS');
