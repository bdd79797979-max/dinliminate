'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
new Function(app);
assert.match(app,/let APP_BUILD = '1249';/);

const commitStart=app.indexOf('const commit=(dx,speed=0)=>{');
const commitEnd=app.indexOf('\n\n  dismissSwipeHint();',commitStart);
assert(commitStart>=0&&commitEnd>commitStart,'commit function found');
const commit=app.slice(commitStart,commitEnd);

assert.match(commit,/CP1249: force the prepared waiting card/);
assert.match(commit,/next\.style\.visibility='visible'/);
assert.match(commit,/next\.style\.opacity='1'/);
assert.match(commit,/next\.style\.pointerEvents='none'/);
assert.match(commit,/next\.style\.willChange='transform,opacity'/);

const finishStart=app.indexOf('const finishFlight=()=>');
const finishEnd=app.indexOf(' // CP1222: button decisions',finishStart);
const finish=app.slice(finishStart,finishEnd);
assert.match(finish,/CP1248: never hide the real prepared waiting card/);
assert.match(finish,/ctx\.previewCard\.style\.visibility='visible'/);
assert.doesNotMatch(finish,/ctx\.previewCard\.style\.visibility='hidden'/);

assert.match(css,/\.next-card\{[^}]*will-change:transform,opacity;backface-visibility:hidden/);

console.log('CP1249 commit-time card handoff smoke: PASS');
