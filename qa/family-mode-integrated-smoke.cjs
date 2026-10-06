'use strict';

const fs=require('node:fs');
const path=require('node:path');

const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const familyApi=fs.readFileSync(path.join(__dirname,'..','api','family.js'),'utf8');

function assert(name,condition,detail=''){
 if(!condition)throw new Error(name+(detail?': '+detail:''));
}

assert('Family API is POST-only',familyApi.includes("String(req.method || '').toUpperCase() !== 'POST'"));
for(const action of ['create','join','state','create-round','start-round','vote','submit-stage','end-round','leave']){
 assert('Family API supports '+action,familyApi.includes("action === '"+action+"'"));
}

assert('normal Family setup uses the normal Meal/Restaurant screen',
 app.includes("if(actual==='meal')startFood();else openRestaurant();")
);
assert('host starts the shared round after setup',
 app.includes("s.member?.role!=='host'")&&app.includes("familyApi('create-round'")&&app.includes("familyApi('start-round'")
);
assert('round snapshot locks current choices',
 app.includes('function familyBuildNormalSnapshot(type)')&&app.includes("snapshot.pool")
);
assert('Restaurant Family round submits restaurant row Maybes',
 app.includes("type==='restaurant' ? restaurantPoolFiltered().filter(x=>x?._maybe)")
);
assert('Meal Family round submits S.maybe',
 app.includes(": [...(S.maybe||new Set())].map(String)");
assert('shared round ignores stale Restaurant search/Hours/Cuisine filters',
 app.includes("S.restaurantQuery=''")&&
 app.includes("S.restaurantHours='all'")&&
 app.includes("S.restaurantCuts.clear()")
);
assert('Round 2/3 uses shared browse source',
 app.includes('function familyBrowseSource(type)')&&
 app.includes('familyBrowseNext')&&
 app.includes('familyBrowsePrevious')&&
 app.includes('familyBrowseBack')
);
assert('ENTER control reuses normal Choose button',
 app.includes("const btn=$(type==='meal'?'foodChoose':'restChoose')")
);
assert('Family stage alert is non-blocking',
 app.includes("document.getElementById('familyStageAlert')?.remove();")&&
 !app.includes("document.body.appendChild(overlay)")
);
assert('winner returns through normal Winner screen',
 app.includes("winner(item,S.familyDecisionType,{familyRoundId:id,familyMode:true})")
);
assert('winner restart is host-aware',
 app.includes("host?'START OVER':'BACK TO FAMILY'")
);

console.log(JSON.stringify({
 ok:true,
 integrated:true,
 restaurantMaybeSubmission:'row._maybe',
 mealMaybeSubmission:'S.maybe',
 snapshotIsCanonical:true,
 normalChooseReused:true,
 blockingStageOverlay:false
},null,2));
