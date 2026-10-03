const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');

const index=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','styles.css'),'utf8');

assert.match(index,/id="locate"/,'Current Location control must exist');
assert.match(index,/id="find"/,'Restaurant Find/Refresh control must exist');

const marker='/* CP681 — match Restaurant Refresh to the Location/Search control footprint. */';
const markerPos=css.lastIndexOf(marker);
assert(markerPos>=0,'CP681 style block must exist');
const refreshRule=css.slice(markerPos,css.indexOf('}\n#restaurant .location-main .find .find-icon',markerPos)+1);
assert(refreshRule.includes('width:36px!important'),'Refresh width must be 36px');
assert(refreshRule.includes('height:36px!important'),'Refresh height must be 36px');
assert(refreshRule.includes('border-radius:50%!important'),'Refresh must be circular');
assert(refreshRule.includes('background:#0b0b0b!important'),'Refresh must have a black background');
assert(refreshRule.includes('border:1px solid #d7bd7b!important'),'Refresh must have a gold outline');
assert.match(css,/#restaurant \.location-main \.find \.find-icon\{[\s\S]*?color:#d7bd7b!important/,'Refresh icon must be gold');
assert.match(css,/#restaurant \.location-main \.find \.find-spinner\{[\s\S]*?border-top-color:#d7bd7b!important/,'Refresh spinner must be gold');

assert.match(css,/#restaurant \.radius-search\{[\s\S]*?width:36px!important[\s\S]*?height:36px!important/,'Restaurant Search control must remain 36px square footprint');
assert.match(css,/#restaurant \.radius-search\{[\s\S]*?border-radius:50%!important/,'Restaurant Search control must remain circular');
assert.match(css,/#restaurant \.location-main \.find[\s\S]*?\.find-spinner/,'Refresh control must include a spinner style');

assert.match(app,/state==='refresh'/,'Refresh state must remain wired in renderFindButton');
assert.match(app,/setFindBusy\(busy\)/,'Refresh busy-state handler must remain wired');
assert.match(app,/busy \? '[\s\S]*find-spinner/s,'Busy state must render spinner');
assert.match(app,/state==='refresh'\s*\?/s,'Idle location state must render refresh icon');
assert.match(app,/$\('find'\)\.onclick = \(\) => \{\s*searchRestaurants\(\);/,'Refresh/Find button must remain wired to searchRestaurants');

console.log('CP681 restaurant refresh control QA: PASS');
