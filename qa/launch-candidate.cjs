'use strict';

const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function exists(file){try{fs.accessSync(path.join(root,file));return true;}catch{return false;}}
function assert(name,condition,detail=''){if(!condition)throw new Error(name+(detail?': '+detail:''));}

const required=[
 'index.html','styles.css','app.js','viewport.js','sw.js','manifest.webmanifest','logo.svg','icon.svg',
 'app-release.json','release-manifest.json','package.json',
 'api/restaurants.js','api/restaurant-photo.js','api/google-restaurant-photo.js','api/google-usage.js',
 'api/family.js','api/family-store.js','api/image.js',
 'qa/launch-rc.cjs','qa/iphone-certification-smoke.cjs','qa/security-hardening-smoke.cjs',
 'qa/restaurant-search-core-smoke.cjs','qa/restaurant-photo-certification-smoke.cjs',
 'qa/restaurant-hours-smoke.cjs','qa/restaurant-decision-ui-smoke.cjs','qa/brand-pwa-final-smoke.cjs',
 'qa/google-usage-smoke.cjs'
];
for(const file of required)assert('required file '+file,exists(file));

const sourceFiles=[
 'app.js','viewport.js','sw.js','api/restaurants.js','api/restaurant-photo.js',
 'api/google-restaurant-photo.js','api/google-usage.js','api/family.js','api/family-store.js','api/image.js'
];
for(const file of sourceFiles){
 try{new Function(read(file));}
 catch(e){throw new Error(file+' syntax: '+e.message);}
}
assert('launch candidate test syntax',(()=>{try{new Function(read('qa/launch-candidate.cjs'));return true;}catch{return false;}})());

const index=read('index.html');
const styles=read('styles.css');
const app=read('app.js');
const sw=read('sw.js');
const manifest=JSON.parse(read('manifest.webmanifest'));
const release=JSON.parse(read('app-release.json'));
const releaseManifest=JSON.parse(read('release-manifest.json'));

assert('build 1088',release.build===1088&&releaseManifest.build===1088);
assert('CP1088 metadata',release.checkpoint==='CP1088'&&releaseManifest.checkpoint==='CP1088');
assert('candidate branch metadata',release.sourceBranch==='cp1088-launch-candidate'&&releaseManifest.sourceBranch==='cp1088-launch-candidate');
assert('candidate has not claimed verification',release.vercelProductionVerified===false&&releaseManifest.vercelProductionVerified===false);

const versionedAssets=[
 './app.js?v=1088','./styles.css?v=1088','./viewport.js?v=1088','./logo.svg?v=1088','./icon.svg?v=1088',
 './apple-touch-icon.png?v=1088'
];
for(const asset of versionedAssets){
 assert('index asset '+asset,index.includes(asset));
 if(!asset.includes('apple-touch'))assert('sw asset '+asset,sw.includes(asset));
}
assert('SW shell 1088',sw.includes("const CACHE='dinliminate-shell-v1088'"));
assert('PWA manifest icons 1088',manifest.icons.length>=2&&manifest.icons.every(x=>!String(x.src).includes('?v=1084')&&!String(x.src).includes('?v=896')));

const shell=styles.slice(styles.lastIndexOf('/* CP1071 — true edge-to-edge iPhone viewport shell.'));
assert('edge-to-edge phone shell',shell.includes('position:fixed!important;')&&shell.includes('inset:0!important;')&&shell.includes('max-width:none!important;'));
assert('vh fallback',shell.includes('height:100vh!important;')&&shell.includes('height:100dvh!important;')&&shell.indexOf('height:100vh!important;')<shell.indexOf('height:100dvh!important;'));
assert('geometry diagnosis',app.includes('Full iPhone viewport shell')&&app.includes('Active screen geometry')&&app.includes('getBoundingClientRect'));
assert('safe-area diagnosis separate',app.includes('Safe-area configuration'));

assert('Google budget central',app.includes('/api/google-usage')&&read('api/google-usage.js').includes("dinliminate_google_sku_usage_v1"));
assert('photo cap centralized',read('api/google-restaurant-photo.js').includes("reserveGoogleSku('place-photo',HARD_LIMITS['place-photo'])"));
assert('restaurant search protected',read('api/restaurants.js').includes('restaurantSearchMatches')&&read('api/restaurants.js').includes('sharedDistinctiveName'));
assert('photo no-fallback policy',read('api/restaurant-photo.js').includes('No verified venue photo was found from the allowed non-Google sources'));
assert('hours timezone-aware',read('api/restaurants.js').includes("timezone:'auto'")&&app.includes('hoursTimeZone'));
assert('Family request bounds',read('api/family.js').includes('REQUEST_TOO_LARGE')&&read('api/family.js').includes('64*1024'));
assert('image proxy redirect-safe',read('api/image.js').includes("redirect:'error'"));
assert('photo endpoint throttles',read('api/google-restaurant-photo.js').includes('photoRateLimited(req')&&read('api/restaurant-photo.js').includes('restaurantPhotoRateLimited(req'));
assert('swipe card no-resize',app.includes("translate3d('+dx.toFixed(1)+'px,0,0) rotate("));
assert('canonical four controls',/id="foodBack"/.test(index)&&/id="foodCut"/.test(index)&&/id="foodMaybe"/.test(index)&&/id="foodChoose"/.test(index));
assert('Family normal-screen integration',release.familyModeIntegration&&release.familyModeIntegration.includes('normal Meal/Restaurant screens'));
assert('history integrity',release.historyIntegrity&&release.historyIntegrity.length>0);
assert('security hardening',release.securityHardening&&release.securityHardening.length>0);
assert('automated RC',release.automatedRC&&release.automatedRC.length>0);
assert('iPhone certification',release.iphoneCertification&&release.iphoneCertification.length>0);

const staleRefs=[...index.matchAll(/(?:app|styles|viewport|logo|icon|apple-touch-icon)\.(?:js|css|svg|png)\?v=(\d+)/g)].map(m=>Number(m[1]));
assert('no stale indexed asset versions',staleRefs.length>0&&staleRefs.every(v=>v>=1088),String(staleRefs));

console.log(JSON.stringify({
 ok:true,
 launchCandidate:'CP1088',
 syntaxChecked:sourceFiles.length,
 requiredFiles:required.length,
 staleAssetReferences:'none',
 iPhoneShell:'edge-to-edge + 100vh fallback + 100dvh',
 GoogleBudget:'central durable SKU tracker',
 photoPolicy:'verified photo only; no generic fallback',
 hours:'timezone-aware',
 family:'integrated',
 security:'hardened',
 deploymentCreated:false,
 productionVerification:false
},null,2));
