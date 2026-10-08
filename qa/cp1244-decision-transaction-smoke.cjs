'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
new Function(app);

const buttonStart=app.indexOf('function bindCardButton(id,handler){');
const buttonEnd=app.indexOf('\nfunction bindRestaurantSwipe',buttonStart);
assert(buttonStart>=0&&buttonEnd>buttonStart,'bindCardButton found');
const button=app.slice(buttonStart,buttonEnd);

const triggerStart=app.indexOf('card.__triggerSwipeDecision=');
const triggerEnd=app.indexOf('\n\n const paintMove=',triggerStart);
assert(triggerStart>=0&&triggerEnd>triggerStart,'swipe button trigger found');
const trigger=app.slice(triggerStart,triggerEnd);

assert.match(button,/el\.onclick=e=>/);
assert.doesNotMatch(button,/el\.onpointerup=/);
assert.match(button,/const transaction=swipeCard\.__triggerSwipeDecision\(swipeDecision\)/);
assert.match(button,/transaction==='accepted'\|\|transaction==='busy'/);
assert.match(button,/Never fall through/);

assert.match(trigger,/if\(phase!=='idle'\|\|card\.dataset\.swipeTransaction==='active'\)return 'busy';/);
assert.match(trigger,/return 'accepted';/);
assert.match(app,/card\.dataset\.swipeTransaction='active';/);

const bindCount=(app.match(/function bindCardButton\(id,handler\)\{/g)||[]).length;
assert.equal(bindCount,1,'Only one button binding implementation should remain');

assert.match(app,/let APP_BUILD = '1244';/);

console.log('CP1244 decision transaction smoke: PASS');
