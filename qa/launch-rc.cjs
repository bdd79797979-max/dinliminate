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
  'qa/security-hardening-smoke.cjs','qa/cp1155-meal-deck-never-stuck-smoke.cjs','qa/cp1161-meal-card-no-fallback-flash.cjs','qa/cp1162-tutorial-current-ui-smoke.cjs'
];

function read(file){return fs.readFileSync(path.join(root,file),'utf8');}
function exists(file){try{fs.accessSync(path.join(root,file));return true;}catch{return false;}}
function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}

for(const file of requiredFiles)assert('required file '+file,exists(file));

const sourceFiles=[
 'app.js','viewport.js','sw.js',
 'api/restaurants.js','api/restaurant-photo.js','api/google-restaurant-photo.js',
 'api/google-usage.js','api/family.js','api/family-store.js','api/image.js'
];
const syntax={};
for(const file of sourceFiles){
 const src=read(file);
 try{new Function(src);syntax[file]='PASS';}
 catch(err){syntax[file]='FAIL: '+err.message;}
}
const failedSyntax=Object.entries(syntax).filter(([,status])=>status!=='PASS');
assert('JavaScript syntax gate',failedSyntax.length===0,JSON.stringify(failedSyntax));

const index=read('index.html');
const sw=read('sw.js');
const manifest=JSON.parse(read('manifest.webmanifest'));
const release=JSON.parse(read('app-release.json'));
const releaseManifest=JSON.parse(read('release-manifest.json'));
const pkg=JSON.parse(read('package.json'));

const build=Number(release.build);
const expectedCheckpoint=String(release.checkpoint||'');
const expectedBranch=String(release.sourceBranch||'');
assert('release build is a positive integer',Number.isInteger(build)&&build>0);
assert('current build agrees across manifests',releaseManifest.build===build);
assert('checkpoint metadata is synchronized',releaseManifest.checkpoint===expectedCheckpoint);
assert('deployment verification stays false',release.vercelProductionVerified===false&&releaseManifest.vercelProductionVerified===false);
assert('release branches agree',releaseManifest.sourceBranch===expectedBranch);
assert('launch candidate branch is explicit',expectedBranch==='cp1157-radius-no-25mi-overpass-bottleneck'&&expectedCheckpoint==='CP1157');

for(const asset of [`./app.js?v=${build}`,`./styles.css?v=${build}`,`./viewport.js?v=${build}`,`./logo.svg?v=${build}`,`./icon.svg?v=${build}`]){
 assert('index cache '+asset,index.includes(asset));
 assert('service-worker cache '+asset,sw.includes(asset));
}
assert('service-worker shell version',sw.includes(`const CACHE='dinliminate-shell-v${build}'`));
assert('PWA standalone',manifest.display==='standalone'&&manifest.orientation==='portrait');
assert('PWA icons versioned',manifest.icons.some(x=>String(x.src).includes(`?v=${build}`)));

const app=read('app.js');
const restaurants=read('api/restaurants.js');
const gphoto=read('api/google-restaurant-photo.js');
const rphoto=read('api/restaurant-photo.js');
const usage=read('api/google-usage.js');
const family=read('api/family.js');
const familyStore=read('api/family-store.js');
const image=read('api/image.js');

assert('Google budget is centralized',usage.includes("const TABLE = 'dinliminate_google_sku_usage_v1'")&&
 gphoto.includes("reserveGoogleSku('place-photo',HARD_LIMITS['place-photo'])")&&
 !gphoto.includes('disableGoogleForMonth'));
assert('Google usage fails closed',usage.includes("GOOGLE_UNTRACKED_SKU_LIMIT || '0'")&&usage.includes("reason: 'budget-unconfigured'"));
assert('restaurant search has strict query matching',restaurants.includes('function restaurantSearchMatches')&&restaurants.includes('.filter(r=>restaurantSearchMatches(r,searchTerm))'));
assert('restaurant search has duplicate protection',restaurants.includes('sharedDistinctiveName')&&restaurants.includes('sameAddress&&sharedDistinctiveName&&sharedCategory'));
assert('restaurant radius is bounded',restaurants.includes('Math.min(MAX_RADIUS')&&restaurants.includes('Math.min(50,radius)'));
assert('restaurant photo rejects generic fallback',rphoto.includes("No verified venue photo was found from the allowed non-Google sources"));
assert('Google photo exact-match checks name/address/location',gphoto.includes('exactPlaceMatch(place,args.name,args.address,args.lat,args.lon)'));
assert('hours are timezone-aware',restaurants.includes("timezone:'auto'")&&app.includes('Intl.DateTimeFormat')&&app.includes('hoursTimeZone'));
assert('Family requests are bounded',family.includes('REQUEST_TOO_LARGE')&&family.includes('64*1024')&&family.includes('limited(req,action,actionLimit)'));
assert('Family snapshot URLs are safe',familyStore.includes('function safeHttpUrl')&&familyStore.includes("['https:','http:'].includes(u.protocol)"));
assert('image proxy validates redirects',image.includes("redirect:'manual'")&&image.includes('Redirected image host not allowed')&&image.includes('redirectCount<=3'));
assert('photo endpoints are throttled',gphoto.includes('photoRateLimited(req')&&rphoto.includes('restaurantPhotoRateLimited(req'));
assert('swipe card does not resize',app.includes("translate3d('+dx.toFixed(1)+'px,0,0) rotate(")&&!app.slice(app.indexOf('function bindSwipeCard'),app.indexOf('function bindRestaurantSwipe')).includes("card.style.transform='scale("));
assert('four decision controls remain canonical',
 /id="foodBack"/.test(index)&&/id="foodCut"/.test(index)&&/id="foodMaybe"/.test(index)&&/id="foodChoose"/.test(index)
);
assert('Family uses normal decision screens',app.includes("show('food');foodQuick();drawFood();familyNormalBar('meal','decision',data)")&&
 app.includes("show('restaurant');restaurantQuick();drawRestaurants();familyNormalBar('restaurant','decision',data)"));
assert('history integrity metadata present',release.historyIntegrity&&release.historyIntegrity.length>0);
assert('test:rc command exists',pkg.scripts?.['test:rc']==='node qa/launch-rc.cjs');
assert('launch candidate metadata present',String(release.launchCandidate||'').includes('one deployment reserved for candidate verification'));

const checkpointSmoke=[
 ['CP1077 Google usage','qa/google-usage-smoke.cjs'],
 ['CP1078 Search Core','qa/restaurant-search-core-smoke.cjs'],
 ['CP1079 Photo Certification','qa/restaurant-photo-certification-smoke.cjs'],
 ['CP1080 Hours Reliability','qa/restaurant-hours-smoke.cjs'],
 ['CP1081 Decision UI','qa/restaurant-decision-ui-smoke.cjs'],
 ['CP1084 Brand/PWA','qa/brand-pwa-final-smoke.cjs'],
 ['CP1085 Security','qa/security-hardening-smoke.cjs'],
 ['CP1155 Meal deck never-stuck','qa/cp1155-meal-deck-never-stuck-smoke.cjs'],
 ['CP1161 Meal first-paint no fallback flash','qa/cp1161-meal-card-no-fallback-flash.cjs'],
 ['CP1162 Tutorial current UI','qa/cp1162-tutorial-current-ui-smoke.cjs'],
 ['CP1157 Restaurant radius','qa/cp1157-restaurant-radius-smoke.cjs']
];
for(const [,file] of checkpointSmoke)assert('checkpoint smoke exists '+file,exists(file));

console.log(JSON.stringify({
 ok:true,
 release:'CP1092',
 syntaxFiles:sourceFiles.length,
 requiredFiles:requiredFiles.length,
 checkpointSmokeCoverage:checkpointSmoke.map(x=>x[0]),
 deploymentCreated:false,
 productionVerification:false
},null,2));
