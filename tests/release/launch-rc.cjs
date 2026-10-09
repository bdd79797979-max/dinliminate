'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const requiredFiles = [
  'index.html','boot.js','tokens.css','base.css','chrome.css','modal.css','swipe.css','home.css','meals.css','restaurants.css','winner.css','history.css','family.css','settings.css','tutorial.css','menu.css','src/main.js','viewport.js','sw.js',
  'manifest.webmanifest','logo.svg','icon.svg','app-release.json','api/_lib/http.js','api/_lib/rateLimit.js','api/_lib/ssrf.js','api/_lib/imageHosts.js',
  'release-manifest.json','package.json','scripts/stamp.mjs','api/restaurants.js',
  'api/restaurant-photo.js','api/google-restaurant-photo.js',
  'api/google-usage.js','api/family.js','api/family-store.js','api/image.js'
];

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));
const css = file => read(file);

for (const file of requiredFiles) {
  assert.equal(exists(file), true, 'required file is missing: ' + file);
}

const syntaxFiles = [
  'boot.js','scripts/stamp.mjs','src/main.js','src/data/restaurant-taxonomy.js','viewport.js','sw.js','api/restaurants.js',
  'api/restaurant-photo.js','api/google-restaurant-photo.js',
  'api/google-usage.js','api/family.js','api/family-store.js','api/image.js'
];

for (const file of syntaxFiles) {
  const absolute = path.join(root, file);
  assert.doesNotThrow(() => cp.execFileSync(process.execPath, ['--check', absolute], {stdio:'pipe'}), 'JavaScript syntax failed: '+file);
}

const release=JSON.parse(read('app-release.json'));
const build=Number(release.build);
const releaseManifest=JSON.parse(read('release-manifest.json'));
const manifest=JSON.parse(read('manifest.webmanifest'));
const index=read('index.html');
const sw=read('sw.js');
const main=read('src/main.js');
const boot=read('boot.js');
const imageHosts=read('api/_lib/imageHosts.js');
const e2e=read('tests/e2e/behavior.spec.mjs');
const homeCss=read('home.css');
const menuCss=read('menu.css');
assert.ok(index.indexOf('./menu.css?v='+build)>index.indexOf('./tutorial.css?v='+build),'menu.css must load last');
assert.ok(menuCss.includes('.drawer-window'),'menu.css defines shared drawer-window styling');
for(const id of ['familyMode','manage','history','settings'])assert.ok(index.includes('class="drawer-window" id="'+id+'"'),'All menu choices use only the shared window class: '+id);
assert.equal(css('chrome.css').includes('.drawer-row{'),false,'Legacy drawer-row styles must not compete');
assert.equal(css('chrome.css').includes('.drawer-head{'),false,'Legacy drawer-head styles must not compete');
assert.equal(css('restaurants.css').includes('.drawer .drawer-nav'),false,'Legacy drawer-nav spacing must not compete');
assert.equal(css('tutorial.css').includes('.app > #drawer .drawer-window'),false,'Tutorial stylesheet must not override menu windows');
assert.doesNotMatch(css('home.css'),/\.app\.home-active > #drawer \.drawer-close\{[^}]*position:/,'Home CSS must not compete with drawer close positioning');

assert.match(homeCss,/html:root \.app:not\(\.home-active\) > #home\s*\{\s*display:none\s*\}/,'Home screen must be hidden outside the Home route');
assert.doesNotMatch(homeCss,/\.app\.home-active\{[^}]*url\(/,'app shell must not own the homepage background image');
const swipeFeatureSource=read('src/features/swipe/index.js');
assert.ok(swipeFeatureSource.includes("foodCard.dataset.mediaPending='true'"),'Meal redraw must mark a pending media handoff');
const vercel=read('vercel.json');
const styleFiles=['tokens.css','base.css','chrome.css','modal.css','swipe.css','home.css','meals.css','restaurants.css','winner.css','history.css','family.css','settings.css','tutorial.css','menu.css'];
for(const file of styleFiles){const css=read(file);let depth=0;for(const ch of css){if(ch==='{')depth++;else if(ch==='}')depth--;};assert.equal(depth,0,'CSS braces must balance: '+file);assert.equal(css.includes('!important'),false,'CSS must not contain !important: '+file);}
for(const file of styleFiles)assert.ok(index.includes('./'+file+'?v='+build),'index.html missing stylesheet: '+file);
for(const file of styleFiles)assert.ok(sw.includes('./'+file+'?v='+build),'sw.js missing stylesheet: '+file);
assert.equal(fs.existsSync(path.join(root,'styles.css')),false,'legacy monolithic stylesheet must be removed');

const targetModulePaths=[
  'src/main.js',
  'src/state/store.js','src/state/storage.js','src/state/migrations.js',
  'src/features/swipe/index.js','src/features/swipe/swipeMachine.js','src/features/meals/index.js','src/features/restaurants/index.js',
  'src/features/winner/index.js','src/features/history/index.js','src/features/family/index.js',
  'src/features/settings/index.js','src/features/tutorial/index.js',
  'src/api/client.js','src/ui/dom.js','src/ui/esc.js','src/ui/modal.js'
];
for(const file of targetModulePaths){
  assert.equal(exists(file),true,'native ESM module is missing: '+file);
}
const productionModuleFiles=targetModulePaths;
for(const file of productionModuleFiles){
  const source=read(file);
  assert.equal((source.match(/\bcatch\s*\{\s*\}/g)||[]).length,0,'production module contains an empty catch: '+file);
  assert.equal(source.includes('String(fn).includes('),false,'production module contains forbidden String(fn).includes diagnostic check: '+file);
  assert.equal(source.includes('window.__DINLIMINATE_'),false,'production module publishes a Dinliminate global: '+file);
  assert.equal((source.match(/window\.[A-Za-z_$][\w$]*\s*=/g)||[]).length,0,'production module assigns a window global: '+file);
}
const storeSource=read('src/state/store.js');
assert.match(storeSource,/export const store=Object\.freeze\(\{/,'store module must export the central store');
assert.match(storeSource,/get\(key\)/,'central store must expose get');
assert.match(storeSource,/set\(key,value\)/,'central store must expose set');
assert.match(storeSource,/subscribe\(listener\)/,'central store must expose subscribe');
assert.ok(read('index.html').includes('<script type="module" src="./src/main.js"></script>'),'production entry must be native ESM');
const swipeMachineSource=read('src/features/swipe/swipeMachine.js');
assert.ok(swipeMachineSource.includes("const mediaPending=card.dataset.mediaPending==='true'"),'swipe cleanup must preserve pending media visibility');
assert.match(swipeMachineSource,/thresholdRatio:\s*0\.21/,'swipe threshold must be 21%');
assert.match(swipeMachineSource,/thresholdMinPx:\s*72/,'swipe minimum clamp must be 72px');
assert.match(swipeMachineSource,/thresholdMaxPx:\s*108/,'swipe maximum clamp must be 108px');
assert.match(swipeMachineSource,/flickVelocityPxPerMs:\s*0\.5/,'swipe flick velocity threshold must be configured');
assert.ok(swipeMachineSource.includes('card.animate'),'swipe exit must use the Web Animations API');
assert.equal(swipeMachineSource.includes("card.onpointerdown="),false,'swipe machine must use pointer event listeners');
assert.equal(swipeMachineSource.includes('transitionend'),false,'swipe machine must not use transitionend');
assert.equal(swipeMachineSource.includes("phase='settling'"),false,'legacy settling state must be removed');
assert.equal(swipeMachineSource.includes("phase='completing'"),false,'legacy completing state must be removed');


assert.ok(Number.isInteger(build)&&build>0,'release build must be a positive integer');
assert.match(String(release.buildDate||''),/^\d{4}-\d{2}-\d{2}$/,'release build date must be YYYY-MM-DD');
assert.equal(releaseManifest.build,build,'release-manifest build must match app-release build');
assert.equal(release.sourceBranch,'main','release source branch must be main');
assert.equal(releaseManifest.sourceBranch,'main','release-manifest source branch must be main');
assert.equal((index.match(/<script(?![^>]*src)[^>]*>/g)||[]).length,0,'index.html must not contain inline executable scripts');
assert.ok(index.includes('./boot.js?v='+build),'index.html must load boot.js');
assert.equal(exists('styles.css'),false,'legacy monolithic styles.css must be removed');
  assert.equal(css('tokens.css').includes('!important'),false,'tokens.css must not contain !important');
  assert.equal(css('base.css').includes('!important'),false,'base.css must not contain !important');
  assert.equal(css('chrome.css').includes('!important'),false,'chrome.css must not contain !important');
  assert.equal(css('modal.css').includes('!important'),false,'modal.css must not contain !important');
  assert.equal(css('swipe.css').includes('!important'),false,'swipe.css must not contain !important');
  assert.equal(css('home.css').includes('!important'),false,'home.css must not contain !important');
  assert.equal(css('meals.css').includes('!important'),false,'meals.css must not contain !important');
  assert.equal(css('restaurants.css').includes('!important'),false,'restaurants.css must not contain !important');
  assert.equal(css('winner.css').includes('!important'),false,'winner.css must not contain !important');
  assert.equal(css('history.css').includes('!important'),false,'history.css must not contain !important');
  assert.equal(css('family.css').includes('!important'),false,'family.css must not contain !important');
  assert.equal(css('settings.css').includes('!important'),false,'settings.css must not contain !important');
  assert.equal(css('tutorial.css').includes('!important'),false,'tutorial.css must not contain !important');
assert.match(index, /<script type="module" src="\.\/src\/main\.js"><\/script>/, 'index.html must load native ESM entry');
assert.doesNotMatch(index, /<script type="module" src="\.\/src\/main\.js\?v=/, 'ES module entry URL must not be versioned');
assert.ok(main.includes("import { FOODS } from '../data/foods.js';"),'main must import foods as ESM');
assert.ok(main.includes("import RESTAURANT_TAXONOMY from './data/restaurant-taxonomy.js';"),'main must import taxonomy from the source ESM module');
assert.equal(main.includes('window.__DINLIMINATE_'),false,'production main must not publish custom globals');
assert.equal(main.includes('function diagnosisMiles'),false,'production main must not contain diagnostics');
assert.equal((main.match(/\\bcatch\\s*\\{\\s*\\}/g)||[]).length,0,'production main must not contain empty catches');
assert.equal(boot.includes('dinliminate.clean.cp1'),false,'boot must not read legacy CP1 storage');
assert.equal(boot.includes('dinliminate.start-screen'),false,'boot must not read legacy start-screen storage');
assert.equal(main.includes('localStorage.'),false,'production main must not persist localStorage directly');
assert.equal(fs.existsSync(path.join(root,'styles.css')),false,'legacy monolithic stylesheet must be removed');
assert.ok(fs.existsSync(path.join(root,'dev','diagnostics','index.html')),'development diagnostics must be outside production app');
assert.ok(index.indexOf('./boot.js?v='+build)<index.indexOf('./viewport.js?v='+build),'boot.js must load before viewport.js');
assert.ok(sw.includes('./boot.js?v='+build),'sw.js must precache boot.js');
assert.ok(sw.includes('./src/data/restaurant-taxonomy.js')&&!sw.includes('./src/data/restaurant-taxonomy.js?v='),'sw.js must precache the unversioned src restaurant taxonomy module');

const staleIndex=[...index.matchAll(/(\.\/[^"'()\s]+)\?v=(\d+)/g)].filter(m=>Number(m[2])!==build);
const staleSw=[...sw.matchAll(/(\.\/[^"'()\s]+)\?v=(\d+)/g)].filter(m=>Number(m[2])!==build);
assert.equal(staleIndex.length,0,'index.html contains stale ?v= assets');
assert.equal(staleSw.length,0,'sw.js contains stale ?v= assets');

assert.ok(!main.includes("fetch('./app-release.json',{cache:'no-store'})"),'src/main.js must not overwrite APP_BUILD at runtime');
assert.ok(main.includes("const APP_BUILD = '"+build+"';"),'src/main.js build must be stamped from app-release');
assert.ok(main.includes("const APP_BUILD_DATE = '"+release.buildDate+"';"),'src/main.js build date must be stamped from app-release');
assert.ok(!main.includes('/api/restaurant-search'),'frontend must use /api/restaurants only');
assert.ok(!e2e.includes('/api/restaurant-search'),'browser tests must use /api/restaurants only');
assert.equal(fs.existsSync(path.join(root,'api/restaurant-search.js')),false,'legacy restaurant-search alias must be removed');
assert.equal(fs.existsSync(path.join(root,'netlify.toml')),false,'Netlify config must be removed');
assert.equal(fs.existsSync(path.join(root,'netlify')),false,'Netlify directory must be removed');
assert.ok(!vercel.includes('api/restaurant-search.js'),'Vercel config must not define the legacy alias');
const restaurantsApi=read('api/restaurants.js');
assert.equal(restaurantsApi.includes("https://www.google.com/search"),false,'restaurant website discovery must not scrape Google search-result HTML');
assert.equal(restaurantsApi.includes('fetchGoogleWebSearchPage'),false,'Google web-search helper must be removed from the production source');
assert.ok(restaurantsApi.includes("base:'https://www.bing.com/search'"),'restaurant website discovery must retain Bing');
assert.ok(restaurantsApi.includes("base:'https://html.duckduckgo.com/html/'"),'restaurant website discovery must retain DuckDuckGo');
assert.ok(sw.includes("importScripts('./api/_lib/imageHosts.js?v="+build+"')"),'service worker must use the shared image-host file');
assert.ok(sw.includes("new Set(self.DINLIMINATE_IMAGE_HOSTS||[])"),'service worker must use the shared image-host allowlist');
assert.ok(imageHosts.includes('HOSTS=Object.freeze'),'shared image-host allowlist must be centralized');
assert.ok(main.includes("scope:'meal-autofill',perMinute:8,dailyCap:100")||read('api/meal-autofill.js').includes("scope:'meal-autofill',perMinute:8,dailyCap:100"),'meal-autofill rate limit/daily cap must be enabled');

const versionedAssets=[
 './boot.js?v='+build,'./viewport.js?v='+build,
 './logo.svg?v='+build,'./icon.svg?v='+build,'./apple-touch-icon.png?v='+build,
 './tokens.css?v='+build,'./base.css?v='+build,'./chrome.css?v='+build,'./modal.css?v='+build,'./swipe.css?v='+build,'./home.css?v='+build,'./meals.css?v='+build,'./restaurants.css?v='+build,'./winner.css?v='+build,'./history.css?v='+build,'./family.css?v='+build,'./settings.css?v='+build,'./tutorial.css?v='+build,'./menu.css?v='+build,
];
for(const asset of versionedAssets){
 assert.ok(index.includes(asset),'index.html missing versioned asset: '+asset);
 assert.ok(sw.includes(asset),'sw.js missing versioned asset: '+asset);
}
const shellCacheName='dinliminate-shell-v'+build;
assert.ok(sw.includes("const CACHE='"+shellCacheName+"'"),'service-worker shell cache version must be explicitly bumped');
const srcFiles=[];
const walkSrc=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walkSrc(full);else srcFiles.push('./'+path.relative(root,full).split(path.sep).join('/'));}};
walkSrc(path.join(root,'src'));
srcFiles.sort();
const shellMatch=sw.match(/const SHELL=(\[[\s\S]*?\]);/);
assert.ok(shellMatch,'service worker must declare its shell precache list');
const shellAssets=JSON.parse(shellMatch[1]);
const precachedSrc=shellAssets.filter(asset=>asset.startsWith('./src/')).sort();
assert.equal(srcFiles.length,18,'expected exactly 18 files under src/');
assert.deepEqual(precachedSrc,srcFiles,'service worker must precache every src file exactly once');
assert.ok(precachedSrc.every(asset=>!asset.includes('?v=')),'src module URLs must not carry version query strings');
assert.ok(shellAssets.includes('./data/foods.js'),'service worker must precache the unversioned food data dependency');
assert.equal(manifest.display,'standalone','PWA must remain standalone');
assert.equal(manifest.orientation,'portrait','PWA must remain portrait');
assert.ok(Array.isArray(manifest.icons)&&manifest.icons.length>=2,'PWA must expose at least two icons');
assert.ok(manifest.icons.every(icon=>String(icon.src||'').includes('?v='+build)),'PWA icon versions must match release build');

console.log(JSON.stringify({ok:true,build,checks:{requiredFiles:requiredFiles.length,syntax:syntaxFiles.length,versionedAssets:versionedAssets.length,pwaIcons:manifest.icons.length}},null,2));
