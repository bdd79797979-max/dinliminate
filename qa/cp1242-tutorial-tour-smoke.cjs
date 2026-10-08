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

const bindStart=app.indexOf('function bindTutorialUI(){');
const bindEnd=app.indexOf('\nbindTutorialUI();',bindStart);
assert(bindStart>=0&&bindEnd>bindStart,'tutorial binding function found');
const binding=app.slice(bindStart,bindEnd);

assert.match(tutorial,/target:'#tutorialModeToggle'/);
assert.match(tutorial,/title:'TOUR'/);
assert.match(tutorial,/Tap this highlighted Tour button—or this guide/);
assert.match(tutorial,/title:'HOW IT WORKS'/);
assert.match(tutorial,/title:'NEXT: RESTAURANTS'/);
assert.match(tutorial,/title:'NEXT: MEALS'/);
assert.match(tutorial,/title:'WINNER DETAILS'/);

assert.match(app,/function tutorialTargetHit\(event,selector\)/);
assert.match(app,/function tutorialAdvanceFromTarget\(event,step\)/);
assert.match(app,/function tutorialHighlightedTargetClick\(event\)/);
assert.match(app,/event\.stopImmediatePropagation\(\)/);
assert.match(app,/document\.addEventListener\('click',tutorialHighlightedTargetClick,true\)/);
assert.match(app,/if\(step\?\.action==='home-choice'\)/);
assert.match(app,/if\(step\?\.action==='choose'\)/);
assert.match(app,/if\(step\?\.action==='winner-restart'\)/);

assert.doesNotMatch(binding,/document\.addEventListener\('click',event=>[\s\S]*#foodStart,#restStart/);
assert.doesNotMatch(binding,/document\.addEventListener\('click',event=>[\s\S]*#foodChoose,#restChoose/);
assert.doesNotMatch(app,/function tutorialOpenMenuTarget\(/);
assert.doesNotMatch(app,/function scheduleTutorialForScreen\(/);

const homeHandlerStart=app.indexOf('const homeActionHandler = (event) =>');
const homeHandlerEnd=app.indexOf('\ndocument.addEventListener(\'click\', homeActionHandler',homeHandlerStart);
assert(homeHandlerStart>=0&&homeHandlerEnd>homeHandlerStart,'home action handler found');
const homeHandler=app.slice(homeHandlerStart,homeHandlerEnd);
assert.match(homeHandler,/if\(tutorialModeEnabled\(\)&&tutorialState\.active\)/);
assert.doesNotMatch(homeHandler,/tutorialModeEnabled\(\)&&tutorialState\.active\) stopTutorialMode\(\)/);

for(const id of ['tutorialModeToggle','foodStart','restStart','addToPhone','shareApp']){
 assert(html.includes('id="'+id+'"'),'HTML id exists: '+id);
}

assert.match(app,/if\(!bubble\|\|!rect\)[\s\S]*retry<24/);
assert.match(app,/Tour could not find the highlighted control/);
assert.match(app,/startTutorialForScreen\('winner',true/);
assert.match(app,/tutorialWinnerRestart\(\)/);

console.log('CP1242 tutorial tour smoke: PASS');
