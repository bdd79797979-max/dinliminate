'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
new Function(app);
assert.match(app,/let APP_BUILD = '1250';/);

const start=app.indexOf("if(!isOverlapCard&&ctx?.sourceCard===card)");
const cloneBlockStart=app.indexOf("if(!isOverlapCard&&ctx?.sourceCard===card)",start);
const createStart=app.indexOf("const clone=next.cloneNode(true);",cloneBlockStart);
const createEnd=app.indexOf("bindSwipeCard(clone.id",createStart);
assert(createStart>=0&&createEnd>createStart,'overlap clone creation block found');
const block=app.slice(createStart,createEnd);

assert.match(block,/CP1250: keep the real waiting card visible/);
assert.match(block,/next\.style\.visibility='visible'/);
assert.match(block,/next\.style\.pointerEvents='none'/);
assert.doesNotMatch(block,/next\.style\.visibility='hidden'/);

console.log('CP1250 never-hide-waiting-card smoke: PASS');
