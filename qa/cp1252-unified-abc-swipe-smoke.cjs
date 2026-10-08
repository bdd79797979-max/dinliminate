'use strict';

const fs=require('node:fs');
const assert=require('node:assert/strict');

const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');

new Function(app);

assert.match(app,/function bindSwipeCard\(cardId,nextId,onCut,onMaybe,options=\{\}\)/);
assert.match(app,/thirdId:'foodThirdCard'/);
assert.match(app,/thirdId:'restaurantThirdCard'/);
assert.match(app,/function ensureDeckImageReady/);
assert.match(app,/dataset\.deckReady==='1'/);
assert.match(app,/preserveSwipe:true/);
assert.match(app,/refreshFoodSwipeDeckAfterDecision\(promotedPreview\)/);
assert.match(app,/refreshRestaurantSwipeDeckAfterDecision\(promotedPreview\)/);
assert.doesNotMatch(app,/ensureFoodNextCardReady\(/);
assert.doesNotMatch(app,/SWIPE_OVERLAP_DELAY/);
assert.doesNotMatch(app,/swipeOverlapContext/);
assert.doesNotMatch(app,/__swipeVisualBridge/);
assert.match(app,/function ensureFoodDeckThirdCard/);
assert.match(app,/function primeRestaurantSwipeDeck/);
assert.match(app,/async function primeRestaurantSwipeDeck/);
assert.match(app,/__deckReadyPromise/);
assert.match(css,/CP1252 — unified A\/B\/C swipe deck/);

console.log('CP1252 unified A/B/C swipe smoke: PASS');
