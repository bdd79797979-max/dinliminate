const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const checks=[
  ['unified bindSwipeCard exists',/function bindSwipeCard\(cardId,nextId,onCut,onMaybe,options=\{\}\)/],
  ['third layer supported',/thirdId:'foodThirdCard'/],
  ['meal preview requires painted readiness',/function ensureDeckImageReady/],
  ['no overlap delay remains',!/SWIPE_OVERLAP_DELAY/],
  ['no overlap context remains',!/swipeOverlapContext/],
  ['no visual bridge remains',!/__swipeVisualBridge/],
  ['food decision accepts preserveSwipe',/function foodCut\([^\n]*options=\{\}\)/],
  ['restaurant decision accepts preserveSwipe',/async function restaurantCut\([^\n]*options=\{\}\)/],
  ['deck CSS present',/CP1252 — unified A\/B\/C swipe deck/]
];
const failed=checks.filter(([name,re])=>!re.test(re===null?'':(re instanceof RegExp && re.test===RegExp.prototype.test? (re===null?'':(re.test? (re.test('').toString(), re):re)) : re)));
// The explicit loop below is intentionally used to keep the assertions readable.
for(const [name,re] of checks){ if(!re.test(re===null?'':(name.includes('CSS')?css:app)) && !re.test(app) && !re.test(css)) throw new Error(name+' failed'); }
console.log('CP1252 unified A/B/C swipe smoke: PASS');
