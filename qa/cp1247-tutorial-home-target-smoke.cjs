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

assert.match(tutorial,/target:'#tutorialModeToggle'/);
assert.match(tutorial,/target:'#home-slogan'/);
assert.match(tutorial,/title:'TOUR'/);
assert.match(tutorial,/title:'HOW IT WORKS'/);
assert.match(tutorial,/title:'GET STARTED'/);

const positionStart=app.indexOf('function tutorialPosition(');
const positionEnd=app.indexOf('\nfunction renderTutorialStep(',positionStart);
assert(positionStart>=0&&positionEnd>positionStart,'tutorial position function found');
const position=app.slice(positionStart,positionEnd);
assert.match(position,/retry<24/);
assert.match(position,/Tour could not find the highlighted control/);
assert.match(position,/stopTutorialMode\(\)/);

const pointerStart=app.indexOf('function tutorialBlockPointer(event)');
const bindEnd=app.indexOf('\nbindTutorialUI();',pointerStart);
const binding=app.slice(pointerStart,bindEnd);
assert.match(binding,/function tutorialBlockPointer\(event\)/);
assert.match(binding,/function tutorialHandlePointerUp\(event\)/);
assert.match(binding,/function tutorialHighlightedTargetClick\(event\)/);
assert.match(binding,/event\.stopImmediatePropagation\(\)/);
assert.match(binding,/tutorialSuppressClick/);

const homeHandlerStart=app.indexOf('const homeActionHandler = (event) =>');
const homeHandlerEnd=app.indexOf("\ndocument.addEventListener('click', homeActionHandler",homeHandlerStart);
const homeHandler=app.slice(homeHandlerStart,homeHandlerEnd);
assert.match(homeHandler,/if\(tutorialModeEnabled\(\)&&tutorialState\.active\)/);
assert.doesNotMatch(homeHandler,/tutorialModeEnabled\(\)&&tutorialState\.active\) stopTutorialMode\(\)/);

for(const id of ['tutorialModeToggle','foodStart','restStart']){
 assert(html.includes('id="'+id+'"'),'HTML target exists: '+id);
}
assert(html.includes('id="home-slogan"'),'Home slogan must expose the tutorial target id');

const sloganClassIndex=html.indexOf('class="home-slogan"');
const sloganIdIndex=html.indexOf('id="home-slogan"');
assert(sloganClassIndex>=0&&sloganIdIndex>sloganClassIndex,'Home slogan id is attached to the slogan element');

assert.match(app,/let APP_BUILD = '1247';/);

console.log('CP1247 tutorial Home target smoke: PASS');
