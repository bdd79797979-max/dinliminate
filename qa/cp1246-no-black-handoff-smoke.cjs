'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
new Function(app);

assert.match(app,/let APP_BUILD = '1246';/);
assert.match(app,/CP1246: keep the already-visible overlap card/);
assert.match(app,/card\.__swipeVisualBridge=ctx\.clone;/);
assert.match(app,/const bridge=card\.__swipeVisualBridge;/);
assert.match(app,/bridge\.style\.visibility='visible'/);

const finish=app.slice(app.indexOf('const finishFlight=()=>'),app.indexOf(' // CP1222: button decisions',app.indexOf('const finishFlight=()=>')));
const bridgeStore=finish.indexOf('card.__swipeVisualBridge=ctx.clone');
const oldRemove=finish.indexOf("if(ctx.clone){try{ctx.clone.remove();}catch{}}");
assert(bridgeStore>=0,'Visual bridge must be captured before source context cleanup');
assert.equal(oldRemove,-1,'Prepared overlap bridge must not be removed before live-card reveal');

const reveal=app.slice(app.indexOf('const completeAfterExit=async()=>'),app.indexOf('function handleTransitionEnd',app.indexOf('const completeAfterExit=async()=>')));
const removeBridge=reveal.indexOf('const bridge=card.__swipeVisualBridge');
const revealLive=reveal.indexOf("card.style.visibility='visible'");
assert(removeBridge>revealLive,'Bridge removal must occur after the live card is revealed');

console.log('CP1246 no-black swipe handoff smoke: PASS');
