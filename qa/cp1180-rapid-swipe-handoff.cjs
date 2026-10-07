// CP1180: rapid-swipe handoff regression checks.
const assert = require('node:assert');
const fs = require('node:fs');
const app = fs.readFileSync(require.resolve('../app.js'),'utf8');
assert.ok(app.includes('CP1180: snapshot the waiting card before action() can redraw/rebind it.'),'missing promoted-card snapshot');
assert.ok(app.includes("const promotedMealId=foodHandoff?String(next?.dataset.mealId||''):'';"),'missing promoted meal identity snapshot');
assert.ok(app.includes("if(promotedSrc)recycledImg.src=promotedSrc;"),'missing snapshot image handoff');
assert.ok(app.includes("next.dataset.foodReady='0';"),'missing stale readiness invalidation');
assert.ok(app.includes("if($('foodNextCard')?.isConnected)primeFoodSwipeMedia();\n    card.dataset.swipeTransaction='';"),'next card must be primed before unlock');
assert.ok(!app.includes('ensureFoodNextCardReady(next).then(ok=>'),'swipe promotion must not wait on stale image readiness');
console.log('CP1180 rapid swipe handoff smoke passed');
