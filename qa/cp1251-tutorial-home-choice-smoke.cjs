'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
const html=fs.readFileSync('index.html','utf8');
new Function(app);

const tutorialStart=app.indexOf('function tutorialStepsForScreen(screen){');
const tutorialEnd=app.indexOf('\nfunction tutorialUnionRect',tutorialStart);
assert(tutorialStart>=0&&tutorialEnd>tutorialStart,'tutorial step function found');
const tutorial=app.slice(tutorialStart,tutorialEnd);

assert.match(tutorial,/target:'#tutorialModeToggle'/,'Tour target remains the real Tour control');
assert.match(tutorial,/target:'#home-slogan'/,'How-it-works target remains the real slogan');
assert.match(tutorial,/targets:\['#foodStart','#restStart'\]/,'Get Started targets the two actual Home/Restaurant choices');
assert.doesNotMatch(tutorial,/target:'#home \.home-choice-rail'/,'Tutorial must not target the full-screen choice rail');
assert.match(tutorial,/title:'GET STARTED'/);
assert.match(tutorial,/body:'Tap Home or Restaurant to get started\.'/);

const targetStart=app.indexOf('function tutorialTargetRect(step){');
const targetEnd=app.indexOf('\nfunction tutorialBlockerRects',targetStart);
const targetFn=app.slice(targetStart,targetEnd);
assert.match(targetFn,/Array\.isArray\(step\?\.targets\)/);
assert.match(targetFn,/return tutorialUnionRect\(step\.targets\)/);

const bindStart=app.indexOf('function bindTutorialUI(){');
const bindEnd=app.indexOf('\nbindTutorialUI\(\);',bindStart);
const binding=app.slice(bindStart,bindEnd);
assert.match(binding,/document\.addEventListener\('click',tutorialHighlightedTargetClick,true\)/,'Tutorial uses click capture');
assert.doesNotMatch(binding,/document\.addEventListener\('pointerdown',tutorialBlockPointer,true\)/,'Old pointerdown gate is not bound');
assert.doesNotMatch(binding,/document\.addEventListener\('pointerup',tutorialHandlePointerUp,true\)/,'Old pointerup gate is not bound');

for(const id of ['tutorialModeToggle','foodStart','restStart']){
 assert(html.includes('id="'+id+'"'),'HTML target exists: '+id);
}
assert(html.includes('id="home-slogan"'),'Home slogan target exists');

assert.match(app,/let APP_BUILD = '1251';/);

console.log('CP1251 tutorial Home/Restaurant target + tap smoke: PASS');
