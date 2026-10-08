'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
new Function(app);
assert.match(app,/let APP_BUILD = '1248';/);

const p=app.indexOf('const finishFlight=()=>');
const q=app.indexOf(' // CP1222: button decisions',p);
assert(p>=0&&q>p,'finishFlight found');
const finish=app.slice(p,q);

assert.match(finish,/CP1248: never hide the real prepared waiting card/);
assert.match(finish,/ctx\.previewCard\.style\.visibility='visible'/);
assert.match(finish,/ctx\.previewCard\.style\.pointerEvents='none'/);
assert.doesNotMatch(finish,/ctx\.previewCard\.style\.visibility='hidden'/);
assert.match(finish,/card\.__swipeVisualBridge=ctx\.clone;/);

console.log('CP1248 no-swipe-gap handoff smoke: PASS');
