'use strict';

const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const release=JSON.parse(fs.readFileSync(path.join(root,'app-release.json'),'utf8'));

function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}

function isolate(source,start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i);
 assert('function boundaries: '+start,i>=0&&j>i);
 return source.slice(i,j);
}

new Function(app);
new Function(sw);

// Meal Times and Cuisine are one mutually-exclusive refine group.
const refine=isolate(app,'function setFoodRefinePanel(kind,open=null){','\nfunction bindMealTimeCuts');
assert('Meal refine controller exists',refine.includes("kind==='meal-times'"));
assert('Meal Times opens while closing Cuisine',refine.includes("S.mealTimeCutsCollapsed=!next")&&refine.includes("food:true"));
assert('Cuisine opens while closing Meal Times',refine.includes("if(next)S.mealTimeCutsCollapsed=true")&&refine.includes("food:!next"));
assert('Meal Cuisine click uses shared controller',app.includes("setFoodRefinePanel('cuisine')"));
assert('Meal Times click uses shared controller',app.includes("setFoodRefinePanel('meal-times')"));

// Startup must not paint the HTML-default Home screen before persisted state restores.
assert('startup boot class is added before app paint',
 index.includes("document.documentElement.classList.add('dinliminate-booting')")
);
assert('startup boot class hides the app',
 css.includes("html.dinliminate-booting body>.app")&&css.includes("visibility:hidden!important")
);
assert('startup boot class is removed after initialization',
 app.includes("document.documentElement.classList.remove('dinliminate-booting')")
);

// Menu hierarchy: subview X -> menu; menu X -> current underlying page.
const menuCalls=[
 "openModal('historyModal','History',body,{returnToMenu:true})",
 "openModal('manageFoodsModal','Manage Meals',body,{returnToMenu:true})",
 "openModal('settingsModal','Settings',body,{returnToMenu:true})",
 "openModal('resetRestoreModal','Reset & Restore',body,{returnToMenu:true})",
 "openModal('privacyModal','Privacy',body,{returnToMenu:true})",
 "openModal('exportPdfModal','Export PDF',body,{returnToMenu:true})"
];
menuCalls.forEach((x,i)=>assert('menu return '+i,app.includes(x)));
assert('Manage Meals editor preserves menu back-stack',
 app.includes("openModal('foodEditorModal',isEdit?'Edit Meal':'Add Meal',body,{returnToMenu:managerWasOpen})")
);
assert('modal close explicitly reopens menu when requested',
 app.includes("if(returnToMenu){openDrawer();return;}")
);
assert('drawer close leaves current screen intact',
 app.includes("const closeDrawer=(immediate=false)=>")&&app.includes("drawer?.classList.remove('is-open')")
);

// Restaurant card information must sit above Photo by attribution.
assert('restaurant card copy lifted',
 css.includes("#restaurant .restaurant-card-stack #restaurantCard .card-copy")&&
 css.includes("bottom:34px!important")
);
assert('small-phone restaurant card copy lifted',
 css.includes("@media(max-width:390px)")&&css.includes("bottom:31px!important")
);

// Pinch must have its own gesture mode and suppress swipe processing.
assert('restaurant pinch mode is tracked',
 app.includes("surface.dataset.restaurantPinchActive='1'")&&
 app.includes("surface.dataset.restaurantPinchActive='0'")
);
assert('swipe ignores pinch mode',
 app.includes("if(card.dataset.restaurantPinchActive==='1')return;")&&
 app.includes("if(card.dataset.restaurantPinchActive==='1'){if(phase==='dragging')cancel();return;")
);
assert('restaurant card binds pinch',
 app.includes("bindRestaurantPhotoPinch($('restaurantCard')?.querySelector('img'));")
);
assert('pinch range is capped',
 app.includes("Math.min(3.5,startScale*(d/startDistance))")
);

// Tutorial placement and text follow the new controls.
assert('Meal Times tutorial explains exclusivity',
 app.includes("Opening this closes Cuisine.")
);
assert('Cuisine tutorial explains exclusivity',
 app.includes("Opening this closes Meal Times.")
);
assert('winner Start Over tutorial has larger separation',
 app.includes("gap=step.action==='winner-restart'?30:14")
);
assert('menu tutorial no longer says tap the bubble to navigate',
 !app.includes("Tap this tutorial bubble to continue")
);

// Shell cache versions must match all current UI assets.
assert('index app cache synced',index.includes('./app.js?v=1085-ui2'));
assert('index viewport cache synced',index.includes('./viewport.js?v=1085-ui2'));
assert('index logo cache synced',index.includes('./logo.svg?v=1085-ui2'));
assert('index styles cache synced',index.includes('./styles.css?v=1085-ui2'));
assert('SW shell cache synced',
 sw.includes("dinliminate-shell-v1085-ui2")&&
 sw.includes("./app.js?v=1085-ui2")&&
 sw.includes("./viewport.js?v=1085-ui2")&&
 sw.includes("./styles.css?v=1085-ui2")
);

// Release provenance.
assert('checkpoint remains explicitly unverified',
 release.sourceBranch==='cp1085-ui-fixes' &&
 release.checkpoint==='CP1085-UI' &&
 release.vercelProductionVerified===false
);

console.log(JSON.stringify({
 ok:true,
 mealRefine:'exclusive',
 startupFlash:'boot-gated',
 menuBackStack:'nested -> menu -> current page',
 restaurantCardInfo:'lifted above photo attribution',
 restaurantPinch:'isolated from swipe',
 tutorial:'updated for current controls',
 cache:'synchronized',
 deploymentCreated:false
},null,2));
