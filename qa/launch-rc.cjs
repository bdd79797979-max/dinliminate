'use strict';

const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const requiredFiles=[
 'index.html','styles.css','app.js','viewport.js','sw.js','manifest.webmanifest',
 'logo.svg','icon.svg','app-release.json','release-manifest.json','package.json',
 'api/restaurants.js','api/restaurant-photo.js','api/google-restaurant-photo.js',
 'api/google-usage.js','api/family.js','api/family-store.js','api/image.js',
 'qa/google-usage-smoke.cjs','qa/restaurant-search-core-smoke.cjs',
 'qa/restaurant-photo-certification-smoke.cjs','qa/restaurant-hours-smoke.cjs',
 'qa/restaurant-decision-ui-smoke.cjs','qa/brand-pwa-final-smoke.cjs',
 'qa/security-hardening-smoke.cjs'
];
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const exists=f=>{try{fs.accessSync(path.join(root,f));return true}catch{return false}};
const assert=(name,ok,detail='')=>{if(!ok)throw new Error(name+(detail?': '+detail:''))};

for(const file of requiredFiles)assert('required file '+file,exists(file));

const sourceFiles=['app.js','viewport.js','sw.js','api/restaurants.js','api/restaurant-photo.js','api/google-restaurant-photo.js','api/google-usage.js','api/family.js','api/family-store.js','api/image.js'];
for(const file of sourceFiles){try{new Function(read(file))}catch(e){throw new Error(file+' syntax: '+e.message)}}

const index=read('index.html'),sw=read('sw.js'),manifest=JSON.parse(read('manifest.webmanifest'));
const release=JSON.parse(read('app-release.json')),manifestRelease=JSON.parse(read('release-manifest.json'));
const app=read('app.js'),restaurants=read('api/restaurants.js'),family=read('api/family.js'),familyStore=read('api/family-store.js');
const image=read('api/image.js'),gphoto=read('api/google-restaurant-photo.js'),rphoto=read('api/restaurant-photo.js'),usage=read('api/google-usage.js');
const pkg=JSON.parse(read('package.json'));

assert('current build is CP1086',release.build===1086&&manifestRelease.build===1086&&release.checkpoint==='CP1086'&&manifestRelease.checkpoint==='CP1086');
assert('deployment remains unverified',release.vercelProductionVerified===false&&manifestRelease.vercelProductionVerified===false);
assert('hardened source branch recorded',release.sourceBranch==='cp1086-automated-rc-hardened'&&manifestRelease.sourceBranch==='cp1086-automated-rc-hardened');

for(const asset of ['./app.js?v=1086','./styles.css?v=1086','./viewport.js?v=1086','./logo.svg?v=1086','./icon.svg?v=1086']){
 assert('index cache '+asset,index.includes(asset));
 assert('service worker cache '+asset,sw.includes(asset));
}
assert('service worker shell',sw.includes("const CACHE='dinliminate-shell-v1086'"));
assert('PWA standalone',manifest.display==='standalone'&&manifest.orientation==='portrait');
assert('PWA icon versions',manifest.icons.some(x=>String(x.src).includes('?v=1086')));

assert('Google budget centralized',usage.includes("dinliminate_google_sku_usage_v1")&&gphoto.includes("reserveGoogleSku('place-photo',HARD_LIMITS['place-photo'])")&&!gphoto.includes('disableGoogleForMonth'));
assert('Google budget fail-closed',usage.includes("GOOGLE_UNTRACKED_SKU_LIMIT")&&usage.includes("budget-unconfigured"));
assert('search strict matching',restaurants.includes('function restaurantSearchMatches')&&restaurants.includes('.filter(r=>restaurantSearchMatches(r,searchTerm))'));
assert('search dedupe protection',restaurants.includes('sameAddress&&sharedDistinctiveName&&sharedCategory'));
assert('search radius bounded',restaurants.includes('Math.min(50,radius)')&&restaurants.includes('MAX_RADIUS=100'));
assert('photo no generic fallback',rphoto.includes('No verified venue photo was found from the allowed non-Google sources'));
assert('Google exact venue matching',gphoto.includes('exactPlaceMatch(place')&&gphoto.includes('displayName'));
assert('hours timezone-aware',restaurants.includes("timezone:'auto'")&&app.includes('Intl.DateTimeFormat')&&app.includes('hoursTimeZone'));
assert('Family auth hashed',familyStore.includes("token_hash = $1")&&familyStore.includes('hash(value)'));
assert('Family role checks',familyStore.includes('HOST_REQUIRED'));
assert('Family URL sanitizer',familyStore.includes('function safeHttpUrl')&&familyStore.includes("u.protocol!=='https:'")&&familyStore.includes('u.username||u.password'));
assert('Family endpoint bounds',family.includes('REQUEST_TOO_LARGE')&&family.includes('64*1024')&&family.includes('limited(req,action,actionLimit)'));
assert('image proxy hardened',image.includes("redirect:'error'")&&image.includes('MAX_URL_LENGTH=2048')&&image.includes('imageRateLimited(req'));
assert('restaurant server errors generic',restaurants.includes("message:'Restaurant service unavailable. Please try again.'"));
assert('shared security headers exist',fs.readFileSync(path.join(root,'vercel.json'),'utf8').includes('Content-Security-Policy'));
assert('swipe remains non-scaling',app.includes("translate3d('+dx.toFixed(1)+'px,0,0) rotate(")&&!app.slice(app.indexOf('function bindSwipeCard'),app.indexOf('function bindRestaurantSwipe')).includes("card.style.transform='scale("));
assert('four canonical controls',index.includes('id="foodBack"')&&index.includes('id="foodCut"')&&index.includes('id="foodMaybe"')&&index.includes('id="foodChoose"'));
assert('family uses normal decision screens',app.includes("familyNormalBar('meal','decision',data)")&&app.includes("familyNormalBar('restaurant','decision',data)"));
assert('checkpoint smokes exist',requiredFiles.filter(x=>x.startsWith('qa/')).every(exists));
assert('test:rc command exists',pkg.scripts?.['test:rc']==='node qa/launch-rc.cjs');

console.log(JSON.stringify({ok:true,checkpoint:'CP1086',syntaxFiles:sourceFiles.length,requiredFiles:requiredFiles.length,security:'hardened',deploymentCreated:false,productionVerified:false},null,2));
