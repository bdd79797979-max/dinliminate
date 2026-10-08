const fs=require('fs');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
function must(label,ok){if(!ok)throw new Error(label+' failed');}
must('app.js parses',(()=>{try{new Function(app);return true;}catch(e){console.error(e.message);return false;}})());
must('unified bindSwipeCard exists',/function bindSwipeCard\(cardId,nextId,onCut,onMaybe,options=\{\}\)/.test(app));
must('third layer supported',/thirdId:'foodThirdCard'/.test(app)&&/restaurantThirdCard/.test(app));
must('painted readiness gate exists',/function ensureDeckImageReady/.test(app));
must('old overlap delay removed',!/SWIPE_OVERLAP_DELAY/.test(app));
must('old overlap context removed',!/swipeOverlapContext/.test(app));
must('old visual bridge removed',!/__swipeVisualBridge/.test(app));
must('meal swipe preserves visual card',/function foodCut\([^\n]*options=\{\}\)/.test(app)&&/preserveSwipe/.test(app));
must('restaurant swipe preserves visual card',/async function restaurantCut\([^\n]*options=\{\}\)/.test(app)&&/restaurantCut\(row,args\[0\]/.test(app));
must('deck layering CSS exists',/CP1252 — unified A\/B\/C swipe deck/.test(css));
console.log('CP1252 unified A/B/C swipe smoke: PASS');
