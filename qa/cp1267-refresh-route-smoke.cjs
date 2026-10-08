const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

assert.match(index, /localStorage\.getItem\('dinliminate\.start-screen'\)/, 'index must read the startup route marker before first paint');
assert.match(index, /dinliminate-start-food/, 'index must support a saved Meals first-paint route');
assert.match(index, /dinliminate-start-restaurant/, 'index must support a saved Restaurant first-paint route');
assert.match(index, /dinliminate-start-(?:food|restaurant|winner|family) #home[\s\S]*?\{display:none!important\}/, 'saved startup routes must hide Home before paint');
assert.match(index, /dinliminate-start-food #food[\s\S]*?\{display:block!important\}/, 'saved Meals route must be visible before paint');

assert.match(app, /localStorage\.setItem\('dinliminate\.start-screen', String\(screen\)\)/, 'show() must keep the startup route marker current');
assert.match(app, /requestAnimationFrame\(\(\)=>requestAnimationFrame\(\(\)=>\{/, 'app reveal must wait for two paint frames');
assert.match(app, /remove\('dinliminate-booting','dinliminate-page-unloading'\)/, 'boot classes must be removed only after the target screen is prepared');
assert.doesNotMatch(app, /CP1138 — reveal only after the correct persisted screen has been painted\.\nrequestAnimationFrame\(\(\)=>document\.documentElement\.classList\.remove\('dinliminate-booting'\)\)/, 'old single-frame reveal must be gone');

console.log('CP1267 refresh-route smoke: PASS');
