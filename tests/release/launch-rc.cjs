'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..', '..');
const requiredFiles = [
  'index.html','boot.js','styles.css','src/main.js','viewport.js','sw.js',
  'manifest.webmanifest','logo.svg','icon.svg','app-release.json','api/_lib/http.js','api/_lib/rateLimit.js','api/_lib/ssrf.js','api/_lib/imageHosts.js',
  'release-manifest.json','package.json','scripts/stamp.mjs','api/restaurants.js',
  'api/restaurant-photo.js','api/google-restaurant-photo.js',
  'api/google-usage.js','api/family.js','api/family-store.js','api/image.js'
];

const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const exists = file => fs.existsSync(path.join(root, file));

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
const releaseManifest=JSON.parse(read('release-manifest.json'));
const manifest=JSON.parse(read('manifest.webmanifest'));
const index=read('index.html');
const sw=read('sw.js');
const main=read('src/main.js');
const imageHosts=read('api/_lib/imageHosts.js');
const e2e=read('tests/e2e/behavior.spec.mjs');
const vercel=read('vercel.json');
const build=Number(release.build);

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
assert.ok(read('index.html').includes('<script type="module" src="./src/main.js?v='+build+'"></script>'),'production entry must be native ESM');
const swipeMachineSource=read('src/features/swipe/swipeMachine.js');
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
assert.match(index, /<script type="module" src="\.\/src\/main\.js\?v=\d+"><\/script>/, 'index.html must load native ESM entry');
assert.ok(main.includes("import { FOODS } from '../data/foods.js';"),'main must import foods as ESM');
assert.ok(main.includes("import RESTAURANT_TAXONOMY from './data/restaurant-taxonomy.js';"),'main must import taxonomy as ESM');
assert.equal(main.includes('window.__DINLIMINATE_'),false,'production main must not publish custom globals');
assert.equal(main.includes('function diagnosisMiles'),false,'production main must not contain diagnostics');
assert.equal((main.match(/\\bcatch\\s*\\{\\s*\\}/g)||[]).length,0,'production main must not contain empty catches');
assert.ok(fs.existsSync(path.join(root,'dev','diagnostics','index.html')),'development diagnostics must be outside production app');
assert.ok(index.indexOf('./boot.js?v='+build)<index.indexOf('./viewport.js?v='+build),'boot.js must load before viewport.js');
assert.ok(sw.includes('./boot.js?v='+build),'sw.js must precache boot.js');
assert.ok(sw.includes('./src/data/restaurant-taxonomy.js?v='+build),'sw.js must version src restaurant taxonomy data');

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
 './boot.js?v='+build,'./src/main.js?v='+build,'./styles.css?v='+build,'./viewport.js?v='+build,
 './logo.svg?v='+build,'./icon.svg?v='+build,'./apple-touch-icon.png?v='+build,
];
for(const asset of versionedAssets){
 assert.ok(index.includes(asset),'index.html missing versioned asset: '+asset);
 assert.ok(sw.includes(asset),'sw.js missing versioned asset: '+asset);
}
assert.ok(sw.includes("const CACHE='dinliminate-shell-v"+build+"'"),'service-worker shell cache is not on release build');
assert.equal(manifest.display,'standalone','PWA must remain standalone');
assert.equal(manifest.orientation,'portrait','PWA must remain portrait');
assert.ok(Array.isArray(manifest.icons)&&manifest.icons.length>=2,'PWA must expose at least two icons');
assert.ok(manifest.icons.every(icon=>String(icon.src||'').includes('?v='+build)),'PWA icon versions must match release build');

console.log(JSON.stringify({ok:true,build,checks:{requiredFiles:requiredFiles.length,syntax:syntaxFiles.length,versionedAssets:versionedAssets.length,pwaIcons:manifest.icons.length}},null,2));
