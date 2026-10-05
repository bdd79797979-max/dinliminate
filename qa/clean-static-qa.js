const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync('app.js','utf8');
const css=fs.readFileSync('styles.css','utf8');
const foodsSource=fs.readFileSync('data/foods.js','utf8');
const taxonomy=fs.readFileSync('data/restaurant-taxonomy.js','utf8');
const api=fs.readFileSync('api/restaurants.js','utf8');
const release=JSON.parse(fs.readFileSync('app-release.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('release-manifest.json','utf8'));
const releaseApi=fs.readFileSync('api/release.js','utf8');
const sw=fs.readFileSync('sw.js','utf8');

new vm.Script(foodsSource); new vm.Script(app); new vm.Script(api); new vm.Script(fs.readFileSync('api/image.js','utf8').replace('export default async function handler','async function handler')); new vm.Script(fs.readFileSync('api/restaurant-photo.js','utf8'));

assert.equal(manifest.build,release.build,'Release manifest build must match app-release');
assert.equal(manifest.checkpoint,release.checkpoint,'Release manifest checkpoint must match app-release');
assert.equal(Number(String(release.checkpoint).replace(/^CP/,'')),release.build,'Checkpoint number must match release build');
assert.equal(manifest.sourceBranch,release.sourceBranch,'Release manifest branch must match app-release');
assert.ok(releaseApi.includes("require('../app-release.json')"),'Vercel release endpoint must use app-release.json');
assert.ok(!releaseApi.includes("require('../release.json')"),'Obsolete release.json must not be referenced');

assert.ok(html.includes('Meal Decisions Simplified'),'Home headline must be current');
assert.ok(html.includes('<strong>AT HOME</strong><span>Your meal awaits</span>'),'At Home Home treatment must remain current');
assert.ok(html.includes('<strong>RESTAURANT</strong><span>Your table awaits</span>'),'Restaurant Home treatment must remain current');
assert.ok(app.includes('Swipe until it’s revealed.'),'One-time Home onboarding line must be present in runtime');
assert.ok(html.includes('id="addToPhone"')&&html.includes('id="shareApp"'),'Home Add and Share controls must both exist');
assert.ok(html.includes('styles.css?v='+release.build)&&html.includes('app.js?v='+release.build),'Frontend asset cache-busting must match current build');
assert.ok(!html.includes('id="restaurantSearch"')&&!html.includes('id="hoursToggle"'),'Restaurant Search and Open/All controls must remain hidden for now');
assert.ok(html.includes('id="restaurantQuery"')&&html.includes('id="restaurantSearchBox"'),'Hidden Restaurant search implementation may remain available for later re-exposure');
assert.ok(app.includes("const next=String(value);"),'Choice counts must use numeric-only labels');
assert.ok(html.includes('id="foodMaybeDeck"')&&html.includes('id="restaurantMaybeDeck"'),'Meals and Restaurants must both have the shared ALL · MAYBES control');
assert.ok(!html.includes('food-all-maybe-toggle')&&!html.includes('restaurant-all-maybe-toggle'),'No screen-specific All-Maybes class may remain in source markup');
assert.ok(!html.includes('class="deck-filter-all"')&&!html.includes('class="deck-filter-maybe"'),'Source markup must not start with legacy A/heart All-Maybes symbols');
assert.ok(html.includes('class="deck-filter-toggle quick-filter-toggle all-maybe-toggle" id="foodMaybeDeck" type="button"')&&html.includes('id="foodMaybeDeck"')&&html.includes('<span class="deck-filter-label-all" aria-hidden="true">ALL</span><span class="deck-filter-divider" aria-hidden="true">·</span><span class="deck-filter-label-maybe" aria-hidden="true">MAYBES</span>'),'Meals All-Maybes source markup must be canonical');
assert.ok(html.includes('class="deck-filter-toggle quick-filter-toggle all-maybe-toggle" id="restaurantMaybeDeck" type="button"')&&html.includes('id="restaurantMaybeDeck"')&&html.includes('<span class="deck-filter-label-all" aria-hidden="true">ALL</span><span class="deck-filter-divider" aria-hidden="true">·</span><span class="deck-filter-label-maybe" aria-hidden="true">MAYBES</span>'),'Restaurant All-Maybes source markup must be canonical');



assert.ok(app.includes("let APP_BUILD = '"+release.build+"'"),'Offline release fallback must match current build');
assert.ok(app.includes('function bindSwipeCard')&&app.includes('requestAnimationFrame'),'Swipe engine must use the current stabilized motion path');
assert.ok(app.includes("bindCardButton('restMaybe'")&&app.includes("bindCardButton('restCut'"),'Restaurant decision buttons must use the protected binding');
assert.ok(app.includes('detailNoteEdit')&&app.includes('detailNotesDelete'),'Per-note Edit and delete controls must be wired');
assert.ok(app.includes('function setItemNote(item,type,note)')&&app.includes('else delete S.notes[key]'),'Item note deletion must use the central note helper');
assert.ok(app.includes('const runtimeBuild=String(d?.build||\'\');'),'Diagnosis must compare runtime release metadata dynamically');
assert.ok(!app.includes("==='701'")&&!app.includes("cp701-app-diagnosis-refresh"),'Diagnosis must not hardcode CP701 release identity');

const foodsMatch=foodsSource.match(/window\.DINLIMINATE_FOODS\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
assert(foodsMatch,'Food data must expose the current global catalog');
const foods=JSON.parse(foodsMatch[1]);
assert.equal(foods.length,116,'Built-in meal catalog must contain 116 meals');
assert.equal(new Set(foods.map(x=>x.id)).size,116,'Built-in meal IDs must be unique');
assert.equal(new Set(foods.map(x=>x.name)).size,116,'Built-in meal names must be unique');
assert(foods.every(x=>x.image&&x.ingredients?.length&&x.nutrition&&x.quickCuts?.length&&x.recipe),'Every built-in meal must have complete Details data');
assert.equal(foods.filter(x=>x.quickCuts?.includes('Pork')).length,0,'Food Pork Quick Cut must remain removed');
for(const name of ['Lasagna','Vegetable Lasagna','Salisbury Steak','Stuffed Peppers','Health Shake','White Fish','Chicken Pot Pie','BLT','Reuben','Hot Dog','Corn Dog','Orange Chicken','Chicken Teriyaki','Sushi','Pancakes','Omelet','Oatmeal','Shrimp','Crab Cakes','Gumbo','Chicken Nuggets','Ramen','Pimento Cheese Sandwich','Liver & Onions','Enchiladas','Fish Sticks','Protein Bar']) assert(foods.some(x=>x.name===name),'Missing current meal: '+name);

assert.ok(taxonomy.includes('Fast Food')&&taxonomy.includes('Burgers')&&taxonomy.includes('Pizza'),'Restaurant taxonomy must include current Quick Cuts');
assert.ok(api.includes("const API_VERSION='r27'"),'Restaurant API must be r27');
assert.ok(api.includes('MAX_RADIUS=100'),'Restaurant API must cap radius at 100 miles');
assert.ok(api.includes('process.env.GOOGLE_PLACES_API_KEY')&&api.includes('process.env.GOOGLE_MAPS_API_KEY'),'Google Places support must remain optional, not required');
assert.ok(api.includes('Photon')||api.includes('photon'),'No-credential discovery must retain non-Google providers');

assert.ok(sw.includes("const CACHE='dinliminate-shell-v"+release.build+"'"),'Service-worker shell cache must match current build');
assert.ok(sw.includes("'./app-release.json'")&&sw.includes("'./release-manifest.json'"),'Service worker must cache release metadata');
assert.ok(css.includes('.luxury-home .home-icon-action')&&css.includes('.restaurant-card-utility'),'Premium Home and Restaurant utility styles must exist');
assert.ok(css.includes('quick-section .quick-cuts-collapse-toggle::after')&&css.includes('cp774QuickCutsSheen'),'Quick Cuts must use the selected subtle sheen');
assert.ok(css.includes('.swipe-card-coach')&&css.includes('pointer-events:none'),'Swipe lesson must be card-integrated, not floating');
assert.ok(css.includes('.swipe-hint,[data-swipe-instruction="true"]{display:none!important'),'Legacy floating swipe instruction selectors must be suppressed');
assert.ok(css.includes('.round-action.is-pressed')&&css.includes('scale(.94)'),'Decision controls must use press-in feedback');
assert.ok(css.includes('count-inline.count-updated'),'Choice count transition must exist');
assert.ok(css.includes('top:calc(env(safe-area-inset-top) + 62px)!important;'),'Utility modals must open below the top header');
assert.ok(html.includes('<strong>AT HOME</strong><span>Your meal awaits</span>'),'Home At Home wording must be exact');
assert.ok(html.includes('<strong>RESTAURANT</strong><span>Your table awaits</span>'),'Home Restaurant wording must be exact');
assert.ok(!html.includes('DINE IN')&&!html.includes('DINE OUT')&&!html.includes('Reveal your meal')&&!html.includes('Reveal your restaurant'),'Home must not retain the old choice wording');
assert.ok(css.includes('CP786')&&css.includes('rgba(221,194,139,.48)')&&css.includes('#e3ca92'),'Home luxury champagne-gold polish must exist');

assert.ok(css.includes('max-height:calc(100dvh - env(safe-area-inset-top) - 76px)!important;'),'Utility modals must preserve usable viewport height when top-aligned');
assert.ok(css.includes('round-maybe::before')&&css.includes('cp774MaybeGlow'),'Maybe restrained glow must exist');
assert.ok(css.includes('details-modal')&&css.includes('detail-hero .history-detail-photo'),'Details fast reveal styling must exist');
assert.ok(css.includes('cp774HomeAmbient'),'Home ambient animation must remain subtle and isolated');
assert.ok(css.includes('.home-card-photo.is-pressed'),'Whole Home photo card must respond to touch');
assert.ok(!css.includes('.swipe-hint{')||!app.includes("createElement('button')")||!app.includes('id=\'swipeHint\''),'Floating swipe instruction implementation must remain absent');
assert.ok(css.includes('min-height:44px')&&css.includes('height:44px'),'Current utility hit-area rules must include 44px targets');

assert.ok(!html.includes('Pass Around')&&!app.includes('Pass Around')&&!app.includes('passAround'),'Pass Around must remain absent from active UI/runtime');
assert.ok(!html.includes('All Cut')&&!html.includes('allCuts*='),'All Cut must remain absent');



// CP988 swipe engine assertions
const swipeStart=app.indexOf('function bindSwipeCard(');
const swipeEnd=app.indexOf('function bindMealPhotoCountControls()',swipeStart);
assert(swipeStart>=0&&swipeEnd>swipeStart,'CP988 swipe engine must have a bounded implementation');
const swipeBody=app.slice(swipeStart,swipeEnd);
assert(swipeBody.includes("phase='idle'")&&swipeBody.includes("phase='dragging'")&&swipeBody.includes("phase='committing'")&&swipeBody.includes("phase='completing'"),'CP988 swipe engine must use an explicit gesture state machine');
assert(swipeBody.includes("card.style.pointerEvents='none'"),'Committed swipe card must be removed from pointer input');
assert(swipeBody.includes("card.dataset.swipePhase='committing'"),'Committed swipe phase must be externally guarded');
assert(swipeBody.includes("card.addEventListener('transitionend',handleTransitionEnd)"),'Swipe completion must follow the actual exit transition');
assert(swipeBody.includes("completionTimer=window.setTimeout(completeAfterExit,duration+180)"),'Swipe completion must have a safety timeout');
assert(!swipeBody.includes('await ensureSwipePreviewReady(next)'), 'Swipe commit must never block on next-card image preparation');
assert(swipeBody.includes("const exitDistance=Math.max(Math.ceil(window.innerWidth*1.25)"),'Swipe exit distance must guarantee a full off-screen exit');
assert(swipeBody.includes("function handleTransitionEnd(e)"),'Swipe engine must have a transition completion handler');
assert(css.includes('card[data-swipe-phase="committing"]')&&css.includes('pointer-events:none!important'),'CSS must hard-lock a committed card from input');
assert(html.includes('styles.css?v=988')&&html.includes('app.js?v=988'),'Frontend cache markers must be CP988');
assert(app.includes("let APP_BUILD = '988'"),'Runtime fallback build must be CP988');


console.log('Dinliminate CP988 static QA: PASS');
console.log(JSON.stringify({build:release.build,checkpoint:release.checkpoint,foods:foods.length,api:'r27',swCache:'v786',hiddenRestaurantSearch:true,hiddenOpenAll:true}));

assert.ok(html.includes('id="menu"')&&html.includes('id="foodMenu"')&&html.includes('id="restaurantMenu"')&&html.includes('id="winnerMenu"')&&html.includes('id="familyMenu"'),'All hamburger menu buttons must exist');
assert.ok(app.includes('const showMenuHint=')&&app.includes("hint.textContent='Menu'"),'Hamburger activation must provide a Menu hint');
assert.ok(app.includes('const navigateFromDrawer=(navigate)=>{')&&app.includes('closeDrawer(true);'),'Menu navigation must close the drawer immediately');
assert.ok(app.includes('function handleWinnerRestart()')&&app.includes("$('restart').onclick = handleWinnerRestart;"),'Winner Start Over must use one stable handler');
assert.ok(app.includes('function clearAllDinliminateStorage()')&&app.includes("key.startsWith('dinliminate.')")&&app.includes("caches.delete(name)")&&app.includes('unregister()'),'Full Reset must clear app storage, caches, and service workers');
assert.ok(app.includes('function bindRestaurantPhotoPinch(')&&app.includes("classList.add('restaurant-photo-zoomable')"),'Restaurant photos must support pinch zoom');
assert.ok(app.includes("if(e.isPrimary===false){")&&app.includes('settleBack();'),'Pinch start must cancel swipe tracking');
assert.ok(!app.includes('<button class="menu" type="button" id="appConfirmClose'),'Confirm close must not reuse the hamburger menu class');
assert.ok(!app.includes('<button class="menu" data-close'),'Modal close must not reuse the hamburger menu class');
assert.ok(css.includes('background:transparent!important')&&css.includes('#familyMenu span')&&css.includes('.menu-hint'),'Hamburger presentation must be shared and boxless with Menu hint');
