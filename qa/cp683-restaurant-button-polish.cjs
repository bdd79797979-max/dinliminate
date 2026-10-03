const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

const cp683=css.slice(css.lastIndexOf('/* CP683 — restore the blue All/Maybe'));
assert.match(cp683,/\.unified-swipe-actions \.round-show-maybe\{[\s\S]*?background:linear-gradient\(180deg,#71aecb,#4e839f\)!important/,'All/Maybe button must be blue');
assert.match(cp683,/\.unified-swipe-actions \.round-show-maybe\{[\s\S]*?border:1px solid #8dc5e0!important/,'All/Maybe button must have thin blue outline');
assert.match(cp683,/\.unified-swipe-actions \.round-show-maybe span\{[\s\S]*?color:#050607!important/,'All/Maybe glyph must be black');
assert.match(cp683,/\.deck-filter-heart\{[\s\S]*?font-size:17px!important/,'Maybe state must use heart glyph styling');
assert.match(cp683,/\.deck-filter-all\{[\s\S]*?font-size:16px!important/,'All state must use A glyph styling');
assert.match(cp683,/#restaurant \.location-main \.find\{[\s\S]*?border-width:1px!important[\s\S]*?border-style:solid!important/,'Restaurant Refresh border must be 1px');
assert.match(cp683,/#restaurant \.location-main \.find\{[\s\S]*?box-shadow:0 6px 16px #0006!important/,'Refresh must avoid the heavier prior visual treatment');
assert.match(app,/btn\.innerHTML=S\.maybeDeck\s*\n\s*\? '<span class="deck-filter-heart"/,'Maybe renderer must use heart');
assert.match(app,/: '<span class="deck-filter-all"/,'All renderer must use A');
assert.match(app,/id="restaurantMaybeDeck"/,'Restaurant deck button must remain wired');
assert.match(app,/setFindBusy\(busy\)/,'Restaurant refresh busy behavior must remain wired');

const a=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
new Function(a);
console.log('CP683 restaurant button polish QA: PASS');